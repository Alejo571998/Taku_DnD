import { expect, test, type Page } from '@playwright/test';

/**
 * PRESUPUESTO DE RENDIMIENTO (MASTER SPEC §3.6)
 *
 * "Funciona bien en el móvil" no es una medida. Esto sí lo es.
 *
 * SOLO CORRE CONTRA UN BUILD DE PRODUCCIÓN. Medir `next dev` daría números
 * bonitos o feos según el día y ninguno significaría nada: el paquete de
 * desarrollo no es el que se descarga nadie. Se salta solo si no se le apunta
 * a un servidor real:
 *
 *   npm run build && npx next start -p 3100
 *   PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test performance
 *
 * CÓMO SE SIMULA EL TELÉFONO
 *   CPU cuatro veces más lenta y red de 4G flojo, vía CDP. Es lo que hace
 *   Lighthouse para su puntuación móvil, y se acerca a un gama media de hace
 *   tres años, que es el aparato que de verdad se lleva a una partida.
 *
 * LO QUE **NO** ES: un teléfono de verdad. La CPU estrangulada no tiene la
 * memoria, ni el térmico, ni la GPU de uno. Sigue siendo una simulación, pero
 * es una simulación REPRODUCIBLE, que es más de lo que había.
 */

// Un presupuesto solo sirve si el número se decidió antes de medir.
const BUDGET = {
  /** Core Web Vitals llama "bueno" a 2,5 s. En 4G flojo y CPU /4. */
  lcpMs: 2500,
  /** Saltos de maquetación. Una ficha que se mueve sola mientras la leés. */
  cls: 0.1,
  /** JavaScript de primera carga, comprimido. */
  scriptKb: 400,
  /*
    LOS DOS DE ABAJO SON TOPES DE CATÁSTROFE, NO UN PRESUPUESTO FINO. Y hay que
    decirlo, porque un umbral con pinta de exacto invita a creerle.

    Medido en esta máquina, sin cambiar una línea de código entre ejecuciones:

      reloj de pared de la búsqueda   1.241 · 2.181 · 3.394 · 4.315 · 5.138 ms
      hilo principal ocupado            734 · 985 · 1.120 · 2.330 · 2.380 · 2.872 ms
      la tarea más larga                120 · 267 · 352 · 479 ms

    Una varianza de 3x no detecta una regresión del 20%. Con la máquina en
    reposo los valores buenos son ~1.000 ms de trabajo y ~140 ms de tarea más
    larga; con veinte builds encima, el triple. Ajustar el umbral hasta que
    pase en el peor caso convierte el test en un sello de goma.

    El tope de la tarea más larga estuvo en 400 ms y falló con 479 al correr la
    tanda completa: 400 caía DENTRO del rango medido, así que no era un umbral
    sino una moneda al aire. Subirlo no es tapar una regresión —no hubo cambio
    de código entre el 120 y el 479—; es dejar de afirmar una precisión que la
    máquina no da.

    Así que estos números están donde atrapan una catástrofe —algo que
    multiplique el trabajo por cuatro— y nada más. La señal de verdad es el
    desglose que el test imprime, comparado contra una máquina tranquila.
  */
  bootBlockingMs: 3500,
  searchBlockingMs: 4000,
  longestTaskMs: 900,
};

const PRODUCTION = process.env.PLAYWRIGHT_BASE_URL != null;

type Metrics = { lcp: number; cls: number; longTasks: number };

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  return cdp;
}

/**
 * Los observadores se instalan ANTES de navegar.
 *
 * LCP y CLS son eventos que ocurren durante la carga: engancharse después es
 * llegar tarde y medir cero, que parece un resultado excelente.
 */
async function observeVitals(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __vitals: Metrics };
    w.__vitals = { lcp: 0, cls: 0, longTasks: 0 };

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__vitals.lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        // Un salto provocado por el usuario no cuenta: si tocó algo, espera
        // que la pantalla cambie.
        if (!shift.hadRecentInput) w.__vitals.cls += shift.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__vitals.longTasks += entry.duration;
    }).observe({ type: 'longtask', buffered: true });
  });
}

test.describe('Rendimiento', () => {
  test.skip(
    !PRODUCTION,
    'Necesita un build de producción: PLAYWRIGHT_BASE_URL=http://localhost:3100',
  );
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('la portada carga dentro del presupuesto en un móvil lento', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await observeVitals(page);

    await throttle(page);
    await page.goto('/', { waitUntil: 'load' });
    // El primer arranque vuelca 3.039 definiciones a IndexedDB. Eso es trabajo
    // real y sale en el presupuesto: si molesta, molesta de verdad.
    await page.getByText('Preparando tu biblioteca').waitFor({ state: 'hidden', timeout: 150_000 });

    const vitals = await page.evaluate(
      () => (window as unknown as { __vitals: Metrics }).__vitals,
    );

    // El peso se lee del Resource Timing, no de la cabecera `content-length`:
    // Next sirve los chunks comprimidos y troceados, sin esa cabecera, y
    // sumarla daba 1 KB — un presupuesto que se cumple siempre porque mide
    // nada. `encodedBodySize` es lo que de verdad viajó por el cable.
    const scriptKb = await page.evaluate(
      () =>
        performance
          .getEntriesByType('resource')
          .filter((r) => (r as PerformanceResourceTiming).initiatorType === 'script')
          .reduce((total, r) => total + (r as PerformanceResourceTiming).encodedBodySize, 0) / 1024,
    );

    // El informe importa tanto como el veredicto: sin los números, un fallo
    // solo dice "más lento" y no dice cuánto ni en qué. Por eso acá el
    // console.log no es un resto de depuración: es la salida del test.
    // eslint-disable-next-line no-console
    console.log(
      `\n  LCP ${Math.round(vitals.lcp)} ms (presupuesto ${BUDGET.lcpMs})` +
        `\n  CLS ${vitals.cls.toFixed(3)} (presupuesto ${BUDGET.cls})` +
        `\n  Tareas largas ${Math.round(vitals.longTasks)} ms (presupuesto ${BUDGET.bootBlockingMs})` +
        `\n  JavaScript ${Math.round(scriptKb)} KB (presupuesto ${BUDGET.scriptKb})\n`,
    );

    expect(vitals.lcp, 'LCP').toBeLessThan(BUDGET.lcpMs);
    expect(vitals.cls, 'CLS').toBeLessThan(BUDGET.cls);
    expect(scriptKb, 'JavaScript de primera carga').toBeLessThan(BUDGET.scriptKb);
    // Antes esto se imprimía sin comprobarse, y el día que se duplicó nadie se
    // enteró: un número en la salida que no falla es decoración.
    expect(vitals.longTasks, 'hilo principal ocupado al arrancar').toBeLessThan(
      BUDGET.bootBlockingMs,
    );

    await context.close();
  });

  test('la biblioteca filtra 3.039 definiciones sin bloquear la pantalla', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/library');
    await page.getByText('Preparando tu biblioteca').waitFor({ state: 'hidden', timeout: 150_000 });

    // Se espera a que la lista exista ANTES de arrancar el cronómetro. Medir
    // desde aquí sin esperarla da el tiempo del primer pintado tras volcar
    // 3.039 definiciones —unos 3 segundos— y no el de la búsqueda.
    await expect(page.getByRole('main').getByRole('button').first()).toBeVisible({
      timeout: 30_000,
    });

    // Se estrangula DESPUÉS de cargar: lo que se mide acá es la búsqueda.
    await throttle(page);

    /*
      SE MIDE EL TRABAJO, NO EL RELOJ.

      La primera versión cronometraba de "terminé de escribir" a "veo el
      resultado". Ese número, en esta máquina y sin cambiar una línea de
      código, dio 1.241, 2.181, 3.394, 4.315 y 5.138 ms. Una varianza de 4x no
      puede detectar una regresión menor al 400%: el test no medía la
      aplicación, medía lo ocupada que estaba la máquina.

      Las TAREAS LARGAS sí son atribuibles. Son el trabajo que el hilo
      principal hace de verdad —recorrer las definiciones, repintar la lista—
      y en las mismas condiciones se movieron entre 715 y 1.029 ms. Eso es una
      medida con la que se puede trabajar.

      Y es la que importa para el usuario: una tarea larga es un momento en el
      que la pantalla no responde al dedo.
    */
    await page.evaluate(() => {
      const w = window as unknown as { __searchTasks: number[] };
      w.__searchTasks = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.__searchTasks.push(entry.duration);
      }).observe({ type: 'longtask', buffered: false });
    });

    const search = page.getByLabel('Buscar en la biblioteca');
    const started = Date.now();
    await search.fill('shillelagh');

    // "Shillelagh" no puede estar en pantalla antes de escribirlo: la lista
    // inicial son los primeros 60 por orden alfabético. Verlo aparecer
    // significa que ESTA consulta terminó.
    await expect(
      page.getByRole('main').getByRole('button', { name: /Shillelagh/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
    const wallClock = Date.now() - started;

    const tasks = await page.evaluate(
      () => (window as unknown as { __searchTasks: number[] }).__searchTasks,
    );
    const blocking = Math.round(tasks.reduce((a, b) => a + b, 0));
    const longest = Math.round(Math.max(0, ...tasks));

    // eslint-disable-next-line no-console -- la medición es la salida del test
    console.log(
      `\n  Búsqueda sobre 3.039 definiciones` +
        `\n    hilo principal ocupado: ${blocking} ms en ${tasks.length} tareas` +
        `\n    la más larga:           ${longest} ms (presupuesto ${BUDGET.longestTaskMs})` +
        `\n    reloj de pared:         ${wallClock} ms (informativo: varía 4x con la carga)\n`,
    );

    expect(blocking, 'hilo principal ocupado durante la búsqueda').toBeLessThan(
      BUDGET.searchBlockingMs,
    );
    // Una tarea suelta por encima de ~200 ms ya se siente como un toque
    // perdido, pero el tope no puede estar ahí: en esta máquina la misma
    // búsqueda midió entre 120 y 479 ms sin cambiar nada. El tope atrapa el
    // caso en que una tarea se coma el segundo entero.
    expect(longest, 'la tarea más larga de la búsqueda').toBeLessThan(BUDGET.longestTaskMs);

    await context.close();
  });
});
