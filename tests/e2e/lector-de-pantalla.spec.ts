import { expect, test, type Page } from '@playwright/test';

/**
 * LA MITAD MECÁNICA DE LA AUDITORÍA CON LECTOR DE PANTALLA (deuda T14)
 *
 * `docs/02-AUDITORIA-LECTOR-DE-PANTALLA.md` dice, con razón, que una máquina
 * no puede juzgar si lo que se ESCUCHA tiene sentido. Eso sigue necesitando a
 * alguien con oídos.
 *
 * Pero de sus seis pruebas, buena parte no es cuestión de criterio sino de si
 * la información llega al árbol de accesibilidad, que es literalmente lo que
 * un lector de pantalla lee. Eso sí se comprueba, y conviene que quede fijado:
 * los cuatro fallos que encontró esta auditoría —el paso del creador, el botón
 * «Siguiente» bloqueado, el contador de la biblioteca y los avisos de
 * deshacer— eran todos de ese tipo y ninguno lo veía axe-core, porque axe
 * comprueba que un botón TENGA nombre, no que el nombre sirva para algo.
 *
 * Lo que queda para una persona: si las frases se entienden al oírlas, el
 * ritmo de las interrupciones, y si el recorrido resulta cómodo. Eso está en
 * el documento y no se automatiza.
 */

const irA = async (page: Page, ruta: string) => {
  await page.goto(ruta);
  await expect(page.locator('#contenido')).toBeVisible({ timeout: 90_000 });
};

// ── 1 · Llegar a lo importante ───────────────────────────────────────────────

test.describe('1 · Llegar a lo importante', () => {
  test('el salto al contenido es lo primero que recibe el foco y lleva a algún lado', async ({
    page,
  }) => {
    await irA(page, '/');

    await page.keyboard.press('Tab');
    const primero = page.locator(':focus');
    await expect(primero).toHaveText('Saltar al contenido');

    /*
      Que el enlace exista no basta: si apunta a un id que no está, el foco no
      se mueve y quien lo usa se queda donde estaba sin enterarse.
    */
    const destino = await primero.getAttribute('href');
    expect(destino).toBe('#contenido');
    await expect(page.locator('#contenido')).toBeAttached();
  });

  test('la navegación principal se anuncia por su nombre', async ({ page }) => {
    await irA(page, '/');
    // Sin nombre, un lector dice «navegación» a secas y hay más de una.
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeAttached();
  });
});

// ── 2 · Crear un personaje ───────────────────────────────────────────────────

test.describe('2 · Crear un personaje', () => {
  test('en cada paso se dice en cuál estás y cuántos faltan', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/characters/new');

    const aviso = page.locator('[role="status"]', { hasText: /^Paso \d+ de \d+:/ });
    await expect(aviso).toHaveText(/^Paso 1 de \d+: Reglas$/, { timeout: 90_000 });

    await page.getByRole('button', { name: /D&D \(2024\)/ }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // El paso cambiaba en silencio: el texto estaba en pantalla pero en dos
    // párrafos sueltos que nadie anunciaba.
    await expect(aviso).toHaveText(/^Paso 2 de \d+: Concepto$/);
  });

  test('«Siguiente» bloqueado se puede alcanzar y dice POR QUÉ no se puede', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/characters/new');
    await expect(page.getByRole('button', { name: /D&D \(2024\)/ })).toBeVisible({
      timeout: 90_000,
    });

    await page.getByRole('button', { name: /D&D \(2024\)/ }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Paso «Concepto»: sin nombre no se avanza.
    const siguiente = page.getByRole('button', { name: 'Siguiente' });
    await expect(siguiente).toBeDisabled();

    /*
      Con `disabled` de verdad el botón sale del recorrido por tabulador: quien
      no ve la pantalla no lo encuentra, y el motivo —que está escrito arriba—
      no lo lleva nadie hasta él. Con `aria-disabled` sigue enfocable.
    */
    await expect(siguiente).toHaveAttribute('aria-disabled', 'true');
    await siguiente.focus();
    await expect(siguiente).toBeFocused();

    const motivoId = await siguiente.getAttribute('aria-describedby');
    expect(motivoId).toBeTruthy();
    await expect(page.locator(`#${motivoId}`)).toHaveText(/nombre/i);
  });
});

// ── 3 · Recibir daño ─────────────────────────────────────────────────────────

test.describe('3 · Recibir daño', () => {
  test('el valor nuevo se anuncia, y caer a 0 también', async ({ page }) => {
    test.setTimeout(180_000);
    await crearPersonaje(page);

    const anuncio = page.locator('[role="status"][aria-live="assertive"]');

    /*
      Empieza vacío a propósito: si trajera el valor desde el principio lo
      cantaría al abrir la ficha, cuando nadie lo pidió.
    */
    await expect(anuncio).toHaveText('');

    await page.getByRole('button', { name: 'Recibir 1 de daño' }).click();
    await expect(anuncio).toHaveText(/\d+ de \d+ puntos de golpe/);

    for (let i = 0; i < 2; i += 1) {
      await page.getByRole('button', { name: 'Recibir 10 de daño' }).click();
    }
    // Quedarse en cero no es un número más: hay que oír que cayó.
    await expect(anuncio).toHaveText(/Inconsciente/);
  });

  test('cada «Deshacer» dice qué deshace', async ({ page }) => {
    test.setTimeout(180_000);
    await crearPersonaje(page);

    await page.getByRole('button', { name: 'Recibir 10 de daño' }).click();
    await page.getByRole('button', { name: 'Recibir 1 de daño' }).click();

    /*
      Los avisos se apilan. Con la etiqueta a secas se oían dos botones
      «Deshacer» idénticos; quien ve la pantalla lo resuelve mirando la fila.
    */
    const deshacer = page.getByRole('button', { name: /^Deshacer: / });
    await expect(deshacer).toHaveCount(2);

    const nombres = await deshacer.evaluateAll((els) =>
      els.map((e) => e.getAttribute('aria-label')),
    );
    expect(new Set(nombres).size).toBe(2);
  });
});

// ── 4 · Abrir y cerrar un diálogo ────────────────────────────────────────────

test.describe('4 · Abrir y cerrar un diálogo', () => {
  test('dice su título, atrapa el foco y lo devuelve al botón que lo abrió', async ({ page }) => {
    test.setTimeout(180_000);
    await crearPersonaje(page);

    const abridor = page.getByRole('button', { name: /puntos de golpe\. Tocá para ajustar/i });
    await abridor.focus();
    await abridor.click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    // Un diálogo sin nombre se anuncia como «diálogo» y nada más.
    await expect(dialogo).toHaveAccessibleName(/.+/);

    // El foco tiene que ENTRAR: si se queda fuera, con Tab se recorre la
    // página de atrás mientras el diálogo tapa la pantalla.
    await expect(dialogo.locator(':focus')).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();

    // Volver al principio de la página es el fallo clásico: obliga a rehacer
    // todo el recorrido para llegar adonde ya estabas.
    await expect(abridor).toBeFocused();
  });
});

// ── 5 · Buscar en la biblioteca ──────────────────────────────────────────────

test.describe('5 · Buscar en la biblioteca', () => {
  test('se dice cuántos resultados hay, y también cuando no hay ninguno', async ({ page }) => {
    test.setTimeout(120_000);
    await irA(page, '/library');

    const anuncio = page.locator('main p[role="status"]');
    await expect(anuncio).toHaveText(/\d+ resultados?$/, { timeout: 90_000 });

    const buscador = page.getByRole('searchbox').or(page.getByPlaceholder(/Busc/i)).first();
    await buscador.fill('bola de fuego');
    await expect(anuncio).toHaveText(/\d+ resultados?$/);

    /*
      Cero resultados se pinta en otra rama del componente, así que era el caso
      que se quedaba fuera: el número desaparecía y no lo reemplazaba nada.
    */
    await buscador.fill('zzzzqqqq');
    await expect(anuncio).toHaveText(/^Sin resultados para /);
  });
});

// ── 6 · Tirar un dado ────────────────────────────────────────────────────────

test.describe('6 · Tirar un dado', () => {
  test('el resultado se anuncia solo, sin ir a buscarlo', async ({ page }) => {
    test.setTimeout(120_000);
    await irA(page, '/dice');

    await page.getByRole('button', { name: /^d20$/ }).first().click();
    // El botón dice «Lanzar 1d20»: lleva la expresión, que cambia sola.
    await page.getByRole('button', { name: /^Lanzar / }).first().click();

    const resultado = page.locator('[role="status"][aria-live="polite"]').filter({
      hasText: /Resultado|ventaja/,
    });
    await expect(resultado.first()).toBeVisible();
    await expect(resultado.first()).toHaveText(/\d/);
  });
});

// ── Personaje de apoyo ───────────────────────────────────────────────────────

async function crearPersonaje(page: Page) {
  await page.goto('/characters/new');
  const next = page.getByRole('button', { name: 'Siguiente' });

  /*
    Se espera a que el paso esté completo ANTES de pulsar.

    Hace falta desde que «Siguiente» pasó a `aria-disabled`: Playwright lo
    respeta igual que a `disabled`, así que pulsar a ciegas se queda esperando
    los 180 segundos del test si el contenido de ese paso todavía no cargó.
    Antes el fallo era el mismo pero salía menos, que es lo peor que puede
    hacer un test.
  */
  const avanzar = async () => {
    await expect(next).toBeEnabled({ timeout: 60_000 });
    await next.click();
  };

  await page.getByRole('button', { name: /D&D \(2024\)/ }).click();
  await avanzar();

  await page.getByLabel('Nombre del personaje').fill('Vela de Prueba');
  await avanzar();

  await page.getByRole('button', { name: /^Enano/ }).first().click();
  await avanzar();

  await page.getByRole('button', { name: /^Guerrero/ }).click();
  await avanzar();

  await page.getByRole('button', { name: /^Acólito/ }).click();
  await avanzar();

  await page.getByRole('button', { name: 'Estándar' }).click();
  await avanzar();

  await page.getByRole('button', { name: 'Atletismo' }).click();
  await page.getByRole('button', { name: 'Percepción' }).click();
  await avanzar();

  for (let i = 0; i < 4; i += 1) await avanzar();

  await page.getByRole('button', { name: 'Crear personaje' }).click();
  await page.waitForURL(/\/characters\/.+\/play/, { timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Vela de Prueba' })).toBeVisible();
}
