import { expect, test, type Page } from '@playwright/test';

/**
 * LO QUE SE FUSIONÓ DE LA HOJA OFICIAL
 *
 * Las capturas del recorrido ya ejercitan los paneles que aparecen siempre.
 * Estos dos no salen ahí porque dependen de un estado concreto: las
 * salvaciones contra muerte necesitan 0 PG, y la inspiración heroica solo
 * existe en 2024.
 *
 * Los dos estuvieron implementados y sin pintar durante meses. El test no
 * comprueba la regla —eso está en los unitarios— sino que la ficha los
 * MUESTRE, que es justo lo que faltaba.
 */

/** Igual que en los demás specs: el creador no sirve hasta que el SRD está. */
async function esperarContenido(page: Page) {
  const volcando = page.getByText('Preparando tu biblioteca');
  await volcando.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  await expect(volcando).toBeHidden({ timeout: 150_000 });
}

async function crear2024(page: Page) {
  await page.goto('/characters/new');
  await esperarContenido(page);
  const next = page.getByRole('button', { name: 'Siguiente' });

  /*
    Se espera a que el paso esté completo antes de pulsar. Pulsar a ciegas
    funcionaba casi siempre y fallaba de vez en cuando —si el contenido del
    paso no había cargado—, que es la peor forma de fallar: parece ruido.
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

  // Los pasos restantes no tienen elecciones obligatorias.
  for (let i = 0; i < 4; i += 1) await avanzar();

  await page.getByRole('button', { name: 'Crear personaje' }).click();
  await page.waitForURL(/\/characters\/.+\/play/, { timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Vela de Prueba' })).toBeVisible();
}

test.describe('La fusión con la hoja oficial', () => {
  test('la inspiración heroica se ve, se gasta y se recupera', async ({ page }) => {
    test.setTimeout(180_000);
    await crear2024(page);

    const boton = page.getByRole('button', { name: /Inspiración heroica/ });
    await expect(boton).toBeVisible();
    await expect(boton).toHaveAttribute('aria-pressed', 'false');

    await boton.click();
    await expect(boton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('La tenés: tocá para gastarla')).toBeVisible();

    await boton.click();
    await expect(boton).toHaveAttribute('aria-pressed', 'false');
  });

  test('la ficha se puede recorrer por encabezados', async ({ page }) => {
    test.setTimeout(180_000);
    await crear2024(page);

    /*
      Media pantalla se podía recorrer por encabezados —Ataques, Recursos y
      Condiciones usaban `SectionTitle`, que ya era un `h2`— y la otra media no,
      porque cada panel llevaba su título escrito a mano con un `span`.

      Se comprueba la JERARQUÍA, no que los títulos existan: un `h3` colgando
      de la nada, o dos `h1`, se leen tan mal como no tener encabezados.
    */
    const niveles = await page.evaluate(() =>
      [...document.querySelectorAll('main h1, main h2, main h3, main h4')].map((h) => ({
        nivel: Number(h.tagName[1]),
        texto: (h.textContent ?? '').trim(),
      })),
    );

    expect(niveles.length).toBeGreaterThan(4);
    expect(niveles.filter((h) => h.nivel === 1)).toHaveLength(1);
    expect(niveles[0]?.nivel).toBe(1);

    // Ningún salto: de un h2 no se pasa a un h4.
    let previo = 1;
    for (const h of niveles) {
      expect(h.nivel).toBeLessThanOrEqual(previo + 1);
      previo = h.nivel;
    }

    const textos = niveles.map((h) => h.texto);
    for (const titulo of ['Puntos de golpe', 'Dados de golpe', 'Inspiración heroica']) {
      expect(textos).toContain(titulo);
    }
  });

  test('los dados de golpe se muestran con lo que queda', async ({ page }) => {
    test.setTimeout(180_000);
    await crear2024(page);

    // Por el ROL: los títulos de los paneles son encabezados de verdad, así
    // que la pantalla se puede recorrer saltando de uno a otro. Si alguien los
    // devolviera a `span`, esto falla.
    await expect(page.getByRole('heading', { name: 'Dados de golpe' })).toBeVisible();
    // Nivel 1: un dado, sin gastar.
    await expect(page.getByLabel(/1 de 1 dados de golpe/)).toBeVisible();
  });

  test('a 0 PG aparecen las salvaciones contra muerte', async ({ page }) => {
    test.setTimeout(180_000);
    await crear2024(page);

    const panel = page.getByRole('heading', { name: 'Salvaciones contra muerte' });

    // Ninguna pantalla las mostraba: el dominio las contaba a ciegas.
    await expect(panel).toBeHidden();

    /*
      Bajar a 0 con el botón de daño rápido, que es lo que se usa en mesa.
      Exactamente dos golpes: el enano de nivel 1 tiene 12 PG, así que 10 y 10
      lo dejan en 0. Un tercero pegaría a un personaje ya inconsciente y el
      motor anotaría un fallo solo, que es justo lo que este test mide después.
    */
    const dano10 = page.getByRole('button', { name: 'Recibir 10 de daño' });
    await dano10.click();
    await dano10.click();

    await expect(panel).toBeVisible();

    const fallos = page.getByRole('group', { name: /Fallos: 0 de 3/ });
    await expect(fallos).toBeVisible();

    await page.getByRole('button', { name: 'Marcar fallos' }).first().click();
    await expect(page.getByRole('group', { name: /Fallos: 1 de 3/ })).toBeVisible();
  });
});
