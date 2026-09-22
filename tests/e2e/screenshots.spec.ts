import { expect, test, type Page } from '@playwright/test';

/**
 * Captura de pantallas del producto.
 *
 * No es un test de regresión: es documentación viva. Se ejecuta a mano con
 * `npx playwright test screenshots --project=<mobile|desktop>` y deja las
 * imágenes en `docs/captures/`.
 */
test.describe('Capturas', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  async function ready() {
    const seeding = page.getByText('Preparando tu biblioteca');
    // `toBeHidden` pasa tambien si el indicador todavia no existe, asi que
    // primero hay que darle la oportunidad de aparecer.
    await seeding.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
    await expect(seeding).toBeHidden({ timeout: 150_000 });
    // Un respiro para que terminen las animaciones de entrada.
    await page.waitForTimeout(400);
  }

  /** Navegación tolerante: el servidor de desarrollo a veces aborta la primera. */
  async function go(url: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return;
      } catch {
        await page.waitForTimeout(800);
      }
    }
    // Último intento sin capturar: si vuelve a fallar, que lo diga.
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  const shot = (name: string, suffix: string) =>
    page.screenshot({ path: `docs/captures/${suffix}-${name}.png`, fullPage: false });

  test('recorrido completo', async ({}, testInfo) => {
    // Son 15 pantallas con esperas de animación: el timeout normal no alcanza.
    test.setTimeout(240_000);
    const suffix = testInfo.project.name;

    // ── Inicio vacío ────────────────────────────────────────────────────────
    await go('/');
    await ready();
    await shot('01-inicio-vacio', suffix);

    // El panel de Taku: la puerta del asistente, y hoy los atajos que de
    // verdad resuelven lo que la gente pregunta en mitad de una partida.
    await page.getByRole('button', { name: 'Abrir la ayuda de Taku' }).click();
    await page.waitForTimeout(500);
    await shot('01b-taku-panel', suffix);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // ── Creador ─────────────────────────────────────────────────────────────
    await go('/characters/new');
    await ready();
    await shot('02-creador-reglas', suffix);

    const next = page.getByRole('button', { name: 'Siguiente' });
    await page.getByRole('button', { name: /D&D 5e \(2014\)/ }).click();
    await next.click();

    await page.getByLabel('Nombre del personaje').fill('Arkan Vela');
    await next.click();

    await shot('03-creador-especie', suffix);
    // Estos son los nombres que ve un usuario: la interfaz está en es-419 y
    // el SRD lleva traducción de nombres. Si algún día vuelven a salir en
    // inglés, este test es el que lo dice.
    await page.getByRole('button', { name: /^Enano/ }).first().click();
    await page.getByRole('button', { name: /^Enano de las colinas/ }).click();
    await next.click();

    await shot('04-creador-clase', suffix);
    await page.getByRole('button', { name: /^Guerrero/ }).click();
    await next.click();

    await page.getByRole('button', { name: /^Acólito/ }).click();
    await next.click();

    await page.getByRole('button', { name: 'Estándar' }).click();
    await shot('05-creador-caracteristicas', suffix);
    await next.click();

    await page.getByRole('button', { name: 'Atletismo' }).click();
    await page.getByRole('button', { name: 'Percepción' }).click();
    await next.click();

    await next.click();
    await next.click();
    await next.click();
    await next.click();

    await page.waitForTimeout(300);
    await shot('06-creador-revision', suffix);

    await page.getByRole('button', { name: 'Crear personaje' }).click();
    // En desarrollo Next compila cada ruta la primera vez que se visita, así
    // que esperar por CONTENIDO visible es más fiable que esperar por la URL.
    await expect(page.getByText('Puntos de golpe')).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(600);

    // ── Modo Juego ──────────────────────────────────────────────────────────
    await shot('07-modo-juego', suffix);

    // ── Modo Gestión ────────────────────────────────────────────────────────
    await page.getByRole('tab', { name: 'Gestión' }).click();
    // El ENCABEZADO, no las palabras sueltas: con la prosa del SRD traducida,
    // «tiradas de salvación» aparece también dentro de los rasgos de la ficha.
    await expect(page.getByRole('heading', { name: 'Tiradas de salvación' })).toBeVisible({
      timeout: 90_000,
    });
    await page.waitForTimeout(500);
    await shot('08-modo-gestion', suffix);

    // ── Inventario ──────────────────────────────────────────────────────────
    await go(page.url().replace('/manage', '/manage/inventory'));
    await page.waitForTimeout(600);
    await shot('09-inventario', suffix);

    // ── Dinero ──────────────────────────────────────────────────────────────
    await go(page.url().replace('/inventory', '/money'));
    await page.waitForTimeout(600);
    await shot('10-dinero', suffix);

    // ── Biblioteca ──────────────────────────────────────────────────────────
    await go('/library');
    await ready();
    await page.getByLabel('Buscar en la biblioteca').fill('fire');
    await page.waitForTimeout(500);
    await shot('11-biblioteca', suffix);

    await page.getByRole('button', { name: /^Bola de fuego/ }).first().click();
    await page.waitForTimeout(400);
    await shot('12-biblioteca-detalle', suffix);
    await page.keyboard.press('Escape');

    // ── Dados ───────────────────────────────────────────────────────────────
    await go('/dice');
    await ready();
    await page.getByRole('button', { name: /^Lanzar/ }).click();
    await page.waitForTimeout(700);
    await shot('13-dados', suffix);

    // ── Inicio con personaje ────────────────────────────────────────────────
    await go('/');
    await page.waitForTimeout(700);
    await shot('14-inicio-con-personaje', suffix);

    // ── Subida de nivel ─────────────────────────────────────────────────────
    await go('/characters');
    await page.waitForTimeout(500);
    await page.getByRole('link', { name: /Arkan Vela/ }).first().click();
    await page.getByRole('tab', { name: 'Gestión' }).click();
    await page.getByRole('link', { name: /Subir de nivel/ }).click();
    await expect(page.getByRole('heading', { name: /Subir a nivel/ })).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(500);
    await shot('15-subir-de-nivel', suffix);

    // Nivel 2 → 3: el que obliga a elegir subclase.
    await page.getByRole('button', { name: 'Subir de nivel' }).click();
    // Por el ROL, no por el texto: la pantalla de subclase dice "se puede
    // cambiar después desde Gestión", así que buscar la palabra suelta
    // encuentra dos cosas y Playwright se planta.
    await expect(page.getByRole('tab', { name: 'Gestión' })).toBeVisible({ timeout: 90_000 });
    await page.getByRole('link', { name: /Subir de nivel/ }).click();
    await expect(page.getByRole('heading', { name: 'Elegí tu subclase' })).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(500);
    await shot('16-subir-de-nivel-subclase', suffix);

    // ── Homebrew ────────────────────────────────────────────────────────────
    await go('/homebrew');
    await ready();
    await shot('17-homebrew', suffix);

    await page.getByRole('button', { name: /Crear lo primero|^Crear$/ }).first().click();
    await page.locator('#hb-name').fill('Espada Ígnea');
    await page.waitForTimeout(500);
    await shot('18-homebrew-editor', suffix);

    // La clase entera: el formulario más grande de la aplicación, y la única
    // captura donde se ve que los veinte niveles se rellenan solos.
    await page.getByRole('button', { name: 'Clase', exact: true }).click();
    await page.locator('#hb-name').fill('Centinela');
    await page.getByRole('button', { name: 'Constitución', exact: true }).click();
    await page.getByRole('button', { name: 'Sabiduría', exact: true }).click();
    await page.waitForTimeout(500);
    await shot('19-homebrew-clase', suffix);
    await page.keyboard.press('Escape');

    // ── Campañas ────────────────────────────────────────────────────────────
    await go('/campaigns');
    await ready();
    await shot('20-campanas', suffix);

    // ── Cuenta ──────────────────────────────────────────────────────────────
    await go('/auth/sign-up');
    await page.waitForTimeout(700);
    await shot('21-crear-cuenta', suffix);

    // ── Perfil (cuenta, idioma, diagnóstico y atribución) ───────────────────
    await go('/profile');
    await page.waitForTimeout(700);
    await shot('22-perfil', suffix);

    // Las pantallas de cuenta: Taku asomándose por detrás de la tarjeta.
    await go('/auth/sign-up');
    await page.waitForTimeout(900);
    await shot('23-crear-cuenta-taku', suffix);
  });
});
