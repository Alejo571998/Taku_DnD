import { expect, test, type Page } from '@playwright/test';

/**
 * TAKU DENTRO DEL PRODUCTO.
 *
 * Los tests de `tests/unit/taku.test.ts` cubren cuándo habla y cuándo se
 * calla. Acá se comprueba lo que solo se ve montado en la página real, que es
 * lo único que de verdad puede arruinar la experiencia:
 *
 *   · Que NO le robe un toque a ningún control.
 *   · Que se aparte cuando aparece información que importa más.
 *   · Que no se meta en el asistente de creación.
 *   · Que silenciarlo lo calle de verdad.
 *
 * Sobre el coste: con la burbuja en pantalla y la CPU a un cuarto, filtrar la
 * biblioteca midió 1.241–1.406 ms contra 951–986 ms sin Taku. Unos 300 ms de
 * más en el peor sitio posible. Los números salieron de mediciones aisladas con
 * la máquina en reposo; el presupuesto del arnés tiene una varianza de 3x y no
 * sirve para afirmar algo tan fino (ver `performance.spec.ts`).
 */

async function waitForContent(page: Page) {
  const seeding = page.getByText('Preparando tu biblioteca');
  await seeding.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  await expect(seeding).toBeHidden({ timeout: 150_000 });
}

const anchor = (page: Page) => page.getByRole('button', { name: 'Abrir la ayuda de Taku' });

test.describe('Taku', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  test('está en la esquina y abre su panel', async ({ page }) => {
    await page.goto('/');
    await waitForContent(page);

    await expect(anchor(page)).toBeVisible();
    await anchor(page).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Honestidad: mientras no haya chatbot, lo dice con esas palabras en vez
    // de poner un campo de texto que no contesta.
    await expect(dialog).toContainText(/todavía no sé conversar/i);
    await expect(dialog.getByRole('link', { name: /Buscar una regla/ })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('la burbuja NO intercepta el toque de lo que tapa', async ({ page }) => {
    await page.goto('/library');
    await waitForContent(page);

    const bubble = page.getByRole('status').filter({ hasText: /en español o en inglés/ });
    await expect(bubble).toBeVisible({ timeout: 15_000 });

    // Se pregunta al navegador qué hay en el centro de la burbuja. Si la
    // respuesta fuera la burbuja, un botón debajo quedaría inaccesible: es el
    // fallo que convierte a un acompañante en un estorbo.
    const box = await bubble.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    const onTop = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x!, y!);
        return el?.closest('[role="status"]') !== null ? 'burbuja' : 'lo de abajo';
      },
      [box.x + box.width / 2, box.y + box.height / 2],
    );

    expect(onTop, 'la burbuja tiene que dejar pasar el toque').toBe('lo de abajo');
  });

  test('no aparece en el asistente de creación', async ({ page }) => {
    await page.goto('/characters/new');
    await waitForContent(page);

    // Doce pasos con la decisión siempre abajo: una burbuja ahí compite de
    // frente con el botón de "Siguiente".
    await expect(anchor(page)).toHaveCount(0);
  });

  test('no aparece en las pantallas de cuenta: ahí ya está asomándose', async ({ page }) => {
    await page.goto('/auth/sign-in');

    await expect(anchor(page)).toHaveCount(0);
    // El de la tarjeta sí. El selector busca "taku" sin barras porque Next
    // sirve las imágenes por su optimizador y la ruta viaja codificada:
    // /_next/image?url=%2Ftaku%2Ftaku-192.png
    await expect(page.locator('img[src*="taku"]').first()).toBeVisible();
  });

  test('silenciarlo lo calla, y el acceso a la ayuda se queda', async ({ page }) => {
    await page.goto('/profile');
    await waitForContent(page);

    const toggle = page.getByRole('checkbox', { name: /Taku comenta la partida/ });
    await expect(toggle).toBeChecked();
    await toggle.uncheck();

    // Se va a una pantalla que normalmente dispara un consejo.
    await page.goto('/library');
    await waitForContent(page);
    await page.waitForTimeout(1500);

    await expect(page.getByRole('status').filter({ hasText: /en español o en inglés/ })).toHaveCount(0);

    // Silenciado no es escondido: sigue disponible para pedirle ayuda.
    await expect(anchor(page)).toBeVisible();

    await page.goto('/profile');
    await page.getByRole('checkbox', { name: /Taku comenta la partida/ }).check();
  });

  test('la preferencia sobrevive a recargar', async ({ page }) => {
    await page.goto('/profile');
    await waitForContent(page);

    await page.getByRole('checkbox', { name: /Taku comenta la partida/ }).uncheck();
    await page.reload();
    await waitForContent(page);

    await expect(page.getByRole('checkbox', { name: /Taku comenta la partida/ })).not.toBeChecked();

    await page.getByRole('checkbox', { name: /Taku comenta la partida/ }).check();
  });

  test('un consejo visto no vuelve, ni recargando la aplicación', async ({ page }) => {
    await page.goto('/library');
    await waitForContent(page);

    const tip = page.getByRole('status').filter({ hasText: /en español o en inglés/ });
    await expect(tip).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Cerrar el mensaje de Taku' }).click();

    // Lo visto se guarda en el navegador, no solo en memoria: si viviera en
    // memoria, mañana Taku volvería a explicar lo mismo.
    const guardado = await page.evaluate(() => localStorage.getItem('taku-vistos'));
    expect(guardado).toContain('library.first');

    await page.goto('/homebrew');
    await waitForContent(page);
    await page.goto('/library');
    await waitForContent(page);

    /*
      Se vigila durante OCHO segundos, más que los siete que dura la burbuja.

      La versión anterior de este test esperaba 1,5 s y comprobaba una vez, y
      pasaba sin que la persistencia existiera: se midió que la burbuja
      aparecía a los 70 ms y se iba a los 7 s, así que aquella comprobación
      llegaba cuando ya se había ido. Pasaba porque la burbuja había venido Y
      SE HABÍA IDO, no porque no viniera.
    */
    for (let i = 0; i < 16; i += 1) {
      await expect(tip).toHaveCount(0);
      await page.waitForTimeout(500);
    }
  });

  test('«volver a ver los consejos» los devuelve', async ({ page }) => {
    await page.goto('/library');
    await waitForContent(page);

    const tip = page.getByRole('status').filter({ hasText: /en español o en inglés/ });
    await expect(tip).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Cerrar el mensaje de Taku' }).click();

    // Sin esta salida, un consejo que apareció mientras mirabas para otro lado
    // se perdería para siempre.
    await page.goto('/profile');
    await page.getByRole('button', { name: /Volver a ver los consejos/ }).click();

    await page.goto('/library');
    await waitForContent(page);
    await expect(tip).toBeVisible({ timeout: 15_000 });
  });
});
