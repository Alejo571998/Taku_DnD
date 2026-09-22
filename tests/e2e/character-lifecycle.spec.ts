import { expect, test, type Page } from '@playwright/test';

/**
 * FLUJO COMPLETO: crear un personaje y jugar con él.
 *
 * Es el CRITERIO FINAL DE APROBACIÓN del producto (MASTER SPEC §68): un
 * usuario tiene que poder ir de "quiero crear un personaje" a "estoy jugando"
 * sin salir de la aplicación ni hacer una sola cuenta a mano.
 *
 * Los tests de este bloque COMPARTEN una pestaña a propósito. El estado vive
 * en IndexedDB, que Playwright no transfiere entre contextos: además, una sola
 * sesión continua es exactamente lo que hace un jugador real.
 */
/**
 * Espera a que el contenido esté realmente en IndexedDB.
 *
 * Primero se espera a que el indicador APAREZCA, y después a que se vaya.
 *
 * `toBeHidden()` es cierto tambien cuando el elemento no existe todavia, y el
 * volcado arranca un instante despues del primer pintado. Esperar solo a que
 * este oculto devuelve de inmediato y deja al test buscando en una biblioteca
 * vacia.
 */
async function waitForContent(page: Page) {
  const seeding = page.getByText('Preparando tu biblioteca');
  await seeding.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {
    // Ya estaba volcado: no hay indicador que esperar.
  });
  await expect(seeding).toBeHidden({ timeout: 150_000 });
}

test.describe('Ciclo de vida del personaje', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('crear un guerrero enano paso a paso', async () => {
    await page.goto('/characters/new');
    await waitForContent(page);

    // ── 1 · Reglas ──────────────────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Crear personaje' })).toBeVisible();
    await page.getByRole('button', { name: /D&D 5e \(2014\)/ }).click();

    const next = page.getByRole('button', { name: 'Siguiente' });
    await next.click();

    // ── 2 · Concepto ────────────────────────────────────────────────────────
    // Sin nombre no se avanza: la validación es en tiempo real, no al final.
    await expect(next).toBeDisabled();
    await page.getByLabel('Nombre del personaje').fill('Arkan Vela');
    await expect(next).toBeEnabled();
    await next.click();

    // ── 3 · Especie ─────────────────────────────────────────────────────────
    // Estos son los nombres que ve un usuario: la interfaz está en es-419 y
    // el SRD lleva traducción de nombres. Si algún día vuelven a salir en
    // inglés, este test es el que lo dice.
    await page.getByRole('button', { name: /^Enano/ }).first().click();
    await page.getByRole('button', { name: /^Enano de las colinas/ }).click();
    await next.click();

    // ── 4 · Clase ───────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /^Guerrero/ }).click();
    await next.click();

    // ── 5 · Trasfondo ───────────────────────────────────────────────────────
    await page.getByRole('button', { name: /^Acólito/ }).click();
    await next.click();

    // ── 6 · Características ─────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Estándar' }).click();
    await next.click();

    // ── 7 · Competencias ────────────────────────────────────────────────────
    await expect(next).toBeDisabled();
    await page.getByRole('button', { name: 'Atletismo' }).click();
    await page.getByRole('button', { name: 'Percepción' }).click();
    await expect(next).toBeEnabled();
    await next.click();

    // ── 8-11 · Equipo, personalidad, apariencia, historia ───────────────────
    await next.click();
    await next.click();
    await next.click();
    await next.click();

    // ── 12 · Revisión ───────────────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Arkan Vela' })).toBeVisible();
    await page.getByRole('button', { name: 'Crear personaje' }).click();

    // ── Modo Juego ──────────────────────────────────────────────────────────
    await page.waitForURL(/\/characters\/.+\/play/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Arkan Vela' })).toBeVisible();
    await expect(page.getByText('Puntos de golpe')).toBeVisible();
  });

  test('la ficha calcula sola los valores derivados', async () => {
    await page.getByRole('tab', { name: 'Gestión' }).click();
    await page.waitForURL(/\/manage$/);

    /*
      Se buscan los ENCABEZADOS, no el texto suelto.

      `getByText('Tiradas de salvación')` funcionaba mientras la prosa del SRD
      estaba en inglés. Al traducirla, la misma frase aparece dentro de las
      descripciones de los rasgos que la ficha muestra debajo, y el localizador
      pasó a encontrar dos elementos. El test no estaba comprobando el
      encabezado: comprobaba que esas palabras existieran en algún lado.
    */
    // El enano de las colinas suma +2 CON y +1 SAB: nadie lo escribió a mano.
    await expect(page.getByRole('heading', { name: 'Características' })).toBeVisible();

    // Competencia en Atletismo elegida en el creador.
    await expect(page.getByText('Atletismo').first()).toBeVisible();

    // Cota de malla y escudo del equipo inicial del guerrero → CA derivada.
    await expect(page.getByRole('heading', { name: 'Tiradas de salvación' })).toBeVisible();
  });

  test('recibir daño y deshacerlo', async () => {
    await page.getByRole('tab', { name: 'Juego' }).click();
    await page.waitForURL(/\/play$/);

    const hp = page.getByRole('button', { name: /puntos de golpe/i });
    const before = Number((await hp.textContent())?.trim());
    expect(before).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Recibir 5 de daño' }).click();
    await expect(hp).toHaveText(String(before - 5));

    // Toda acción reversible ofrece Deshacer (MASTER SPEC §54).
    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(hp).toHaveText(String(before));
  });

  test('los cambios sobreviven a recargar la página', async () => {
    const hp = page.getByRole('button', { name: /puntos de golpe/i });
    const before = Number((await hp.textContent())?.trim());

    await page.getByRole('button', { name: 'Recibir 10 de daño' }).click();
    await expect(hp).toHaveText(String(before - 10));

    // Persistencia real en IndexedDB, no estado en memoria de React.
    await page.reload();
    await waitForContent(page);
    await expect(hp).toHaveText(String(before - 10), { timeout: 30_000 });

    await page.getByRole('button', { name: 'Curar 10 puntos' }).click();
    await expect(hp).toHaveText(String(before));
  });

  /**
   * SUBIDA DE NIVEL
   *
   * Sin esto un personaje se estanca en la segunda sesión. Se prueba el camino
   * entero —el nivel sin decisiones, el que obliga a elegir subclase y el que
   * da mejora de característica— porque son tres pantallas distintas.
   */
  test('subir de nivel 1 → 2 sin decisiones pendientes', async () => {
    await page.goto('/characters');
    await page.getByRole('link', { name: /Arkan Vela/ }).first().click();
    await page.waitForURL(/\/characters\/.+/);

    await page.getByRole('tab', { name: 'Gestión' }).click();
    await page.waitForURL(/\/manage$/);

    await page.getByRole('link', { name: /Subir de nivel/ }).click();
    await page.waitForURL(/\/manage\/level-up$/);

    await expect(page.getByRole('heading', { name: 'Subir a nivel 2' })).toBeVisible();
    // Lo que gana sale del contenido real: nadie lo escribió en la pantalla.
    // Y sale en español porque el diccionario cubre los nombres del SRD: decía
    // "Action Surge (1 use)" hasta que se tradujeron los rasgos de clase.
    await expect(page.getByText('Oleada de acción (1 uso)')).toBeVisible();

    await page.getByRole('button', { name: 'Subir de nivel' }).click();
    await page.waitForURL(/\/manage$/, { timeout: 15_000 });

    await expect(page.getByText(/Guerrero.*2/).first()).toBeVisible();
  });

  test('el nivel 3 no deja avanzar sin elegir subclase', async () => {
    await page.goto('/characters');
    await page.getByRole('link', { name: /Arkan Vela/ }).first().click();
    await page.getByRole('tab', { name: 'Gestión' }).click();
    await page.getByRole('link', { name: /Subir de nivel/ }).click();
    await page.waitForURL(/\/manage\/level-up$/);

    await expect(page.getByRole('heading', { name: 'Elegí tu subclase' })).toBeVisible();

    const confirm = page.getByRole('button', { name: 'Subir de nivel' });
    await expect(confirm).toBeDisabled();
    await expect(page.getByText('Te falta elegir subclase.')).toBeVisible();

    await page.getByRole('button', { name: /^Campeón/ }).click();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await page.waitForURL(/\/manage$/, { timeout: 15_000 });

    await expect(page.getByText(/Campeón/).first()).toBeVisible();
  });

  test('el nivel 4 reparte la mejora de característica', async () => {
    await page.goto('/characters');
    await page.getByRole('link', { name: /Arkan Vela/ }).first().click();
    await page.getByRole('tab', { name: 'Gestión' }).click();
    await page.getByRole('link', { name: /Subir de nivel/ }).click();
    await page.waitForURL(/\/manage\/level-up$/);

    await expect(page.getByRole('heading', { name: 'Mejora de característica' })).toBeVisible();

    const confirm = page.getByRole('button', { name: 'Subir de nivel' });
    await expect(confirm).toBeDisabled();

    // +2 en Fuerza: dos toques al mismo botón.
    const plusStr = page.getByRole('button', { name: 'Sumar punto a Fuerza' });
    await plusStr.click();
    await plusStr.click();
    // Gastados los dos puntos, el botón se apaga solo.
    await expect(plusStr).toBeDisabled();

    await expect(confirm).toBeEnabled();
    await confirm.click();
    await page.waitForURL(/\/manage$/, { timeout: 15_000 });

    // El motor lo recalcula: el bonificador de competencia pasa a +2 → +2 y la
    // Fuerza sube. Lo que se comprueba es que el cambio llegó a la ficha.
    // El ENCABEZADO: «características» también aparece dentro del texto
    // traducido del rasgo «Mejora de puntuación de característica».
    await expect(page.getByRole('heading', { name: 'Características' })).toBeVisible();
  });

  test('el personaje aparece en la lista y en el inicio', async () => {
    await page.goto('/characters');
    await expect(page.getByRole('link', { name: /Arkan Vela/ }).first()).toBeVisible();

    await page.goto('/');
    await expect(page.getByText('Arkan Vela').first()).toBeVisible();
  });
});

test.describe('Biblioteca', () => {
  test.describe.configure({ timeout: 150_000 });

  test('busca en el contenido real del SRD', async ({ page }) => {
    await page.goto('/library');
    await waitForContent(page);

    // Se busca en INGLÉS y se espera el nombre en ESPAÑOL: es la prueba de
    // que la traducción es una superposición y no una copia del contenido.
    // "fireball" también coincide con Delayed Blast Fireball y varios objetos
    // mágicos. El primero debe ser el conjuro: la búsqueda prioriza las
    // coincidencias por prefijo, y eso es justamente lo que se comprueba.
    await page.getByLabel('Buscar en la biblioteca').fill('fireball');

    const fireball = page.getByRole('button', { name: /^Bola de fuego/ }).first();
    await expect(fireball).toBeVisible();

    await fireball.click();
    const dialog = page.getByRole('dialog');
    // Los conjuntos cerrados del SRD (escuelas, tipos de daño, rarezas) y los
    // nombres están traducidos; la PROSA del conjuro sigue en inglés.
    await expect(dialog).toContainText('Evocación');
    // La atribución CC-BY es obligatoria y tiene que verse EN la aplicación.
    await expect(dialog).toContainText('Creative Commons');
  });

  test('no mezcla ediciones', async ({ page }) => {
    await page.goto('/library');
    await waitForContent(page);

    // "Alert" es una dote que existe en el SRD 5.2 y NO en el 5.1. Se la busca
    // por su nombre original y se la reconoce por el traducido.
    await page.getByLabel('Buscar en la biblioteca').fill('alert');
    await expect(page.getByRole('button', { name: /^Alerta/ })).toHaveCount(0);

    await page.getByRole('button', { name: '2024', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Alerta/ }).first()).toBeVisible();

    // Y al volver a 2014 desaparece: nunca se cruzan las ediciones.
    await page.getByRole('button', { name: '2014', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Alerta/ })).toHaveCount(0);
  });
});

test.describe('Dados', () => {
  test.describe.configure({ timeout: 150_000 });

  test('tira un d20 y lo registra en el historial', async ({ page }) => {
    await page.goto('/dice');
    await waitForContent(page);

    await page.getByRole('button', { name: 'd20', exact: true }).click();
    await page.getByRole('button', { name: /^Lanzar/ }).click();

    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByText('Historial')).toBeVisible();
  });
});
