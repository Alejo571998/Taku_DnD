import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * ACCESIBILIDAD (MASTER SPEC §49)
 *
 * axe-core corre dentro de la página ya pintada, con el contenido cargado y
 * los diálogos abiertos, y aplica las reglas de WCAG 2.1 A y AA.
 *
 * Que la página sea correcta en el navegador no se deduce del CSS: los
 * nombres accesibles, los roles y el orden del foco solo existen una vez que
 * el árbol está armado. Por eso se mide acá y no leyendo los tokens.
 *
 * QUÉ **NO** SUSTITUYE
 *   Un lector de pantalla de verdad, con una persona usándolo. axe cubre lo
 *   estructural, lo que se puede decidir mirando el DOM. Que la aplicación se
 *   ENTIENDA leída en voz alta —que el orden tenga sentido, que los avisos
 *   lleguen cuando importan— no lo puede medir una máquina. El guion para esa
 *   parte está en `docs/02-AUDITORIA-LECTOR-DE-PANTALLA.md`.
 *
 * Falla en vez de avisar: un aviso que nadie lee es una regresión consentida.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function waitForContent(page: Page) {
  const seeding = page.getByText('Preparando tu biblioteca');
  await seeding.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  await expect(seeding).toBeHidden({ timeout: 150_000 });
}

async function audit(page: Page, selector?: string) {
  const builder = new AxeBuilder({ page }).withTags(WCAG);
  if (selector) builder.include(selector);
  const { violations } = await builder.analyze();
  return violations;
}

/** El informe de axe es enorme; esto deja lo que hace falta para arreglarlo. */
function describeViolations(violations: Awaited<ReturnType<typeof audit>>): string {
  return violations
    .map((v) => {
      const where = v.nodes
        .slice(0, 3)
        .map((n) => `      ${n.target.join(' ')}`)
        .join('\n');
      return `  [${v.impact}] ${v.id}: ${v.help}\n${where}`;
    })
    .join('\n');
}

const PAGES: readonly { path: string; name: string }[] = [
  { path: '/', name: 'Inicio' },
  { path: '/characters', name: 'Personajes' },
  { path: '/library', name: 'Biblioteca' },
  { path: '/campaigns', name: 'Campañas' },
  { path: '/homebrew', name: 'Homebrew' },
  { path: '/profile', name: 'Perfil' },
];

test.describe('Accesibilidad', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // axe-core exige un contexto explícito: `browser.newPage()` le crea uno
    // implícito al que no puede inyectar su script y falla con
    // "Please use browser.newContext()".
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/');
    await waitForContent(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  for (const { path, name } of PAGES) {
    test(`${name} no tiene infracciones de WCAG AA`, async () => {
      await page.goto(path);
      await waitForContent(page);

      const violations = await audit(page);
      expect(violations, `\n${describeViolations(violations)}\n`).toEqual([]);
    });
  }

  test('el asistente de creación es accesible en cada paso', async () => {
    await page.goto('/characters/new');
    await waitForContent(page);

    // El asistente es la primera pantalla de todo el producto: si algo tiene
    // que ser navegable a ciegas, es esta.
    const violations = await audit(page);
    expect(violations, `\n${describeViolations(violations)}\n`).toEqual([]);
  });

  test('un diálogo abierto también', async () => {
    await page.goto('/homebrew');
    await waitForContent(page);
    await page.getByRole('button', { name: /Crear lo primero|^Crear$/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Los diálogos son donde más se rompe: el foco, el nombre accesible, el
    // aria-modal. Y son justo lo que un test de página entera se salta si no
    // se los abre a propósito.
    const violations = await audit(page);
    expect(violations, `\n${describeViolations(violations)}\n`).toEqual([]);
  });

  test('el tema claro cumple lo mismo que el oscuro', async ({ browser }) => {
    // El tema claro se mira menos que el oscuro, así que se audita aparte: es
    // la única forma de que "está bien" no dependa de que alguien se acuerde
    // de abrirlo. El contraste es lo primero que se degrada ahí.
    const lightContext = await browser.newContext();
    const light = await lightContext.newPage();
    await light.addInitScript(() => localStorage.setItem('taku-theme', 'light'));

    for (const { path } of PAGES) {
      await light.goto(path);
      await waitForContent(light);
      await expect(light.locator('html')).toHaveAttribute('data-theme', 'light');

      const violations = await audit(light);
      expect(violations, `\n${path} en tema claro:\n${describeViolations(violations)}\n`).toEqual([]);
    }

    await lightContext.close();
  });

  test('las filas que se añaden solas se distinguen al oírlas', async () => {
    await page.goto('/homebrew');
    await waitForContent(page);
    await page.getByRole('button', { name: /Crear lo primero|^Crear$/ }).first().click();
    await page.getByRole('button', { name: 'Clase', exact: true }).click();

    await page.getByRole('button', { name: 'Añadir rasgo' }).click();
    await page.getByRole('button', { name: 'Añadir rasgo' }).click();
    await page.getByRole('button', { name: 'Añadir rasgo' }).click();

    // Esto axe NO lo detecta: tres botones que se llamen "Quitar" pasan todas
    // sus reglas —cada uno TIENE nombre— y sin embargo, leídos en voz alta,
    // son indistinguibles. Quien no ve la pantalla no sabe cuál va a borrar.
    const dialog = page.getByRole('dialog');
    const names = await dialog
      .getByRole('button')
      .evaluateAll((elements) =>
        elements
          .map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim())
          .filter((name) => /quitar|borrar/i.test(name)),
      );

    expect(names.length).toBeGreaterThanOrEqual(3);
    expect(new Set(names).size, `Nombres repetidos: ${names.join(' · ')}`).toBe(names.length);
  });
});
