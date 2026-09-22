import { expect, test, type Page } from '@playwright/test';

/**
 * TECLADO Y ANUNCIOS (MASTER SPEC §49)
 *
 * axe-core comprueba que los elementos TENGAN nombre, rol y contraste. No
 * comprueba nada de lo que de verdad decide si la aplicación se puede usar sin
 * ver la pantalla:
 *
 *   · ¿El foco va a algún lado razonable cuando se abre un diálogo?
 *   · ¿Se puede salir de él, y el foco vuelve a donde estaba?
 *   · ¿Se queda atrapado dentro mientras está abierto?
 *   · ¿Se ANUNCIA lo que acaba de pasar, o cambia la pantalla en silencio?
 *
 * El último punto es el más fácil de incumplir sin notarlo: un lector de
 * pantalla NO lee el cambio del `aria-label` de un elemento que no tiene el
 * foco. Actualizar el número en pantalla no anuncia nada, y quien no ve la
 * pantalla se queda sin saber si el toque hizo algo.
 *
 * Esto NO sustituye a una persona con un lector de pantalla —ver
 * `docs/02-AUDITORIA-LECTOR-DE-PANTALLA.md`—, pero cubre lo que se puede
 * comprobar sin oídos.
 */

async function waitForContent(page: Page) {
  const seeding = page.getByText('Preparando tu biblioteca');
  await seeding.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  await expect(seeding).toBeHidden({ timeout: 150_000 });
}

/** Qué tiene el foco ahora mismo, descrito como lo diría un lector. */
async function focused(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: 'body', name: '' };
    return {
      tag: el.tagName.toLowerCase(),
      name: (
        el.getAttribute('aria-label') ??
        el.textContent ??
        ''
      )
        .trim()
        .slice(0, 80),
    };
  });
}

test.describe('Navegación con teclado', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  test('lo primero que se tabula es el salto al contenido', async ({ page }) => {
    await page.goto('/');
    await waitForContent(page);

    // Sin esto, quien navega con teclado tiene que recorrer el menú entero en
    // cada página antes de llegar a lo que vino a leer.
    await page.keyboard.press('Tab');
    const first = await focused(page);
    expect(first.name).toContain('Saltar al contenido');

    // Y tiene que FUNCIONAR, no solo estar.
    await page.keyboard.press('Enter');
    await expect(page.locator('#contenido')).toBeVisible();
  });

  test('un diálogo recibe el foco, lo retiene y lo devuelve', async ({ page }) => {
    await page.goto('/homebrew');
    await waitForContent(page);

    const trigger = page.getByRole('button', { name: /Crear lo primero|^Crear$/ }).first();
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // 1 · El foco entró al diálogo. Si se quedara detrás, un lector de pantalla
    // seguiría leyendo la página de abajo, que ya no es lo que está pasando.
    const insideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog?.contains(document.activeElement) ?? false;
    });
    expect(insideDialog, 'el foco tiene que entrar al diálogo').toBe(true);

    // 2 · No se escapa. Veinte tabulaciones son más que los controles que hay:
    // si hubiera fuga, el foco estaría fuera al terminar.
    for (let i = 0; i < 20; i++) await page.keyboard.press('Tab');
    const stillInside = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog?.contains(document.activeElement) ?? false;
    });
    expect(stillInside, 'el foco no puede salirse del diálogo abierto').toBe(true);

    // 3 · Escape cierra.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    // 4 · Y el foco VUELVE al botón que lo abrió. Si volviera al principio de
    // la página, la persona perdería el sitio en cada interacción.
    await expect(trigger).toBeFocused();
  });

  test('el asistente de creación se recorre entero con Tab', async ({ page }) => {
    await page.goto('/characters/new');
    await waitForContent(page);

    // El foco tiene que avanzar, no quedarse quieto ni volver atrás: un orden
    // que salta es imposible de seguir a ciegas.
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const current = await focused(page);
      seen.push(`${current.tag}:${current.name}`);
    }

    // Nada de quedarse clavado en el mismo control.
    const repeatedInARow = seen.filter((name, i) => i > 0 && name === seen[i - 1]);
    expect(repeatedInARow, `el foco se quedó clavado: ${repeatedInARow[0]}`).toEqual([]);
    expect(seen.filter((s) => s !== 'body:').length).toBeGreaterThan(5);
  });
});

test.describe('Lo que pasa se dice en voz alta', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('crear un personaje para tener con qué probar', async () => {
    await page.goto('/characters/new');
    await waitForContent(page);

    const next = page.getByRole('button', { name: 'Siguiente' });
    await page.getByRole('button', { name: /D&D 5e \(2014\)/ }).click();
    await next.click();
    await page.getByLabel('Nombre del personaje').fill('Nima Sorda');
    await next.click();
    await page.getByRole('button', { name: /^Enano/ }).first().click();
    await page.getByRole('button', { name: /^Enano de las colinas/ }).click();
    await next.click();
    await page.getByRole('button', { name: /^Guerrero/ }).click();
    await next.click();
    await page.getByRole('button', { name: /^Acólito/ }).click();
    await next.click();
    await page.getByRole('button', { name: 'Estándar' }).click();
    await next.click();
    await page.getByRole('button', { name: 'Atletismo' }).click();
    await page.getByRole('button', { name: 'Percepción' }).click();
    await next.click();
    await next.click();
    await next.click();
    await next.click();
    await next.click();
    await page.getByRole('button', { name: 'Crear personaje' }).click();

    await expect(page.getByText('Puntos de golpe')).toBeVisible({ timeout: 90_000 });
  });

  test('recibir daño se anuncia con el valor nuevo', async () => {
    const hp = page.getByRole('button', { name: /puntos de golpe/i });
    const before = Number((await hp.textContent())?.trim());

    await page.getByRole('button', { name: 'Recibir 5 de daño' }).click();
    await expect(hp).toHaveText(String(before - 5));

    // Actualizar el número no es suficiente: hace falta una región viva que lo
    // diga. Sin esto, quien no ve la pantalla no sabe si el toque hizo algo.
    const announcement = page.locator('[aria-live]', {
      hasText: new RegExp(`${before - 5} de \\d+ puntos de golpe`),
    });
    await expect(announcement.first()).toBeAttached();
  });

  test('curarse también, y con el valor correcto', async () => {
    const hp = page.getByRole('button', { name: /puntos de golpe/i });
    const before = Number((await hp.textContent())?.trim());

    await page.getByRole('button', { name: 'Curar 5 puntos' }).click();
    await expect(hp).toHaveText(String(before + 5));

    const announcement = page.locator('[aria-live]', {
      hasText: new RegExp(`${before + 5} de \\d+ puntos de golpe`),
    });
    await expect(announcement.first()).toBeAttached();
  });

  test('al abrir la ficha no se anuncia nada: nadie lo pidió', async () => {
    await page.reload();
    await waitForContent(page);
    await expect(page.getByText('Puntos de golpe')).toBeVisible({ timeout: 90_000 });

    // Una región viva que llega con texto puesto lo canta al cargar. Molesta,
    // y peor: entrena a la persona a ignorarla, que es como se pierden los
    // avisos que sí importan.
    const spoken = await page
      .locator('[aria-live]')
      .evaluateAll((nodes) =>
        nodes.map((n) => (n.textContent ?? '').trim()).filter((t) => t.length > 0),
      );
    expect(spoken.filter((t) => /puntos de golpe/i.test(t))).toEqual([]);
  });

  test('la tirada de dados se anuncia', async () => {
    await page.goto('/dice');
    await waitForContent(page);

    await page.getByRole('button', { name: 'd20', exact: true }).click();
    await page.getByRole('button', { name: /^Lanzar/ }).click();

    // El resultado de un dado es LA información de esa pantalla. Si no se dice,
    // la pantalla no sirve sin ver.
    await expect(page.getByRole('status').first()).toBeVisible();
    const text = await page.getByRole('status').first().textContent();
    expect(text?.trim().length ?? 0).toBeGreaterThan(0);
  });
});
