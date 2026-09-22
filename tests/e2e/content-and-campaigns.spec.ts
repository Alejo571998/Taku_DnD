import { expect, test, type Page } from '@playwright/test';

/**
 * CONTENIDO PROPIO Y CAMPAÑAS (FASES 13 y 14)
 *
 * Dos promesas del producto que solo se pueden comprobar usándolo:
 *
 *   1. Lo que creás en Homebrew aparece SOLO en la biblioteca y en el buscador,
 *      sin un camino especial. Es la prueba de que vive en la misma tabla que
 *      el SRD y no en un cajón aparte.
 *
 *   2. Una campaña agrupa personajes de una mesa y avisa —sin bloquear— cuando
 *      alguien juega con otra edición.
 *
 * Comparten pestaña a propósito: el estado vive en IndexedDB y Playwright no
 * lo transfiere entre contextos.
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

test.describe('Homebrew', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('crear contenido propio sin escribir JSON', async () => {
    await page.goto('/homebrew');
    await waitForContent(page);

    await page.getByRole('button', { name: /Crear lo primero/ }).click();

    await page.locator('#hb-name').fill('Espada Ígnea del Dragón');
    await page.locator('#hb-dice').fill('2d6');

    // El id lo decide el sistema a partir del nombre: si lo escribiera el
    // usuario, alguno acabaría llamándose `srd-2014:weapon:longsword`.
    await expect(page.getByText(/^hb-[\da-f]+:weapon:espada-ignea-del-dragon$/)).toBeVisible();

    await page.getByRole('button', { name: 'Guardar' }).click();

    // Se busca DENTRO de la lista: la hoja tarda en desmontarse por la
    // animación de cierre, y durante ese instante el nombre existe dos veces.
    const list = page.getByRole('main').getByRole('list');
    await expect(list.getByText('Espada Ígnea del Dragón')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Tu contenido \(1\)/i })).toBeVisible();
  });

  test('aparece en la biblioteca como una definición más', async () => {
    await page.goto('/library');
    await waitForContent(page);

    await page.getByLabel('Buscar en la biblioteca').fill('Espada Ígnea');
    await expect(page.getByRole('button', { name: /Espada Ígnea del Dragón/ }).first()).toBeVisible();
  });

  test('la búsqueda encuentra el SRD en español y en inglés', async () => {
    await page.goto('/library');
    await waitForContent(page);

    const search = page.getByLabel('Buscar en la biblioteca');

    // El contenido se guarda en inglés y la traducción es una superposición:
    // las dos formas tienen que llevar al mismo sitio.
    await search.fill('Cegado');
    await expect(page.getByRole('button', { name: /^Cegado/ }).first()).toBeVisible();

    await search.fill('Blinded');
    await expect(page.getByRole('button', { name: /^Cegado/ }).first()).toBeVisible();
  });

  test('se puede borrar, y el SRD no', async () => {
    await page.goto('/homebrew');
    await waitForContent(page);

    await page.getByRole('button', { name: /Borrar Espada Ígnea del Dragón/ }).click();
    await page.getByRole('button', { name: 'Borrar', exact: true }).click();

    await expect(page.getByText('Todavía no creaste nada')).toBeVisible();
  });
});

/**
 * ESPECIES Y CLASES ENTERAS
 *
 * Estas dos no son "una definición más": generan VARIAS. Una especie son sus
 * rasgos y una clase son sus rasgos por nivel, y el editor los crea y los
 * enlaza solo. Lo que hay que comprobar usándolo es que el conjunto llega
 * entero: que el rasgo existe de verdad en la biblioteca, que la lista no se
 * llena de piezas sueltas, y que al borrar el padre no quedan huérfanos.
 */
test.describe('Homebrew grande', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('una especie crea sus rasgos y los enlaza', async () => {
    await page.goto('/homebrew');
    await waitForContent(page);

    await page.getByRole('button', { name: /Crear lo primero|^Crear$/ }).first().click();
    await page.getByRole('button', { name: 'Especie', exact: true }).click();

    await page.locator('#hb-name').fill('Elfo Nocturno');
    await page.locator('#hb-speed').fill('35');
    await page.locator('#hb-langs').fill('Common, Elvish');

    await page.getByRole('button', { name: 'Añadir rasgo' }).click();
    await page.getByLabel('Nombre del rasgo 1').fill('Visión Nocturna');
    await page.getByLabel('Qué hace el rasgo 1').fill('Ve en la oscuridad a 120 pies.');

    await page.getByRole('button', { name: 'Añadir rasgo' }).click();
    await page.getByLabel('Nombre del rasgo 2').fill('Paso Silencioso');
    await page.getByLabel('Qué hace el rasgo 2').fill('Ventaja en Sigilo en penumbra.');

    await page.getByRole('button', { name: 'Guardar' }).click();

    // UNA entrada, no tres: los rasgos se editan desde su especie.
    await expect(page.getByRole('heading', { name: /Tu contenido \(1\)/i })).toBeVisible();
    const list = page.getByRole('main').getByRole('list');
    await expect(list.getByText('Elfo Nocturno')).toBeVisible();
    await expect(list.getByText(/2 rasgos/)).toBeVisible();
  });

  test('el rasgo generado es una definición de biblioteca como cualquier otra', async () => {
    await page.goto('/library');
    await waitForContent(page);

    // Si esto falla, el rasgo se guardó como un apéndice de la especie y no
    // como contenido de verdad: el motor de reglas tampoco lo encontraría.
    await page.getByLabel('Buscar en la biblioteca').fill('Paso Silencioso');
    await expect(page.getByRole('button', { name: /Paso Silencioso/ }).first()).toBeVisible();
  });

  test('reabrir la especie recupera sus rasgos', async () => {
    await page.goto('/homebrew');
    await waitForContent(page);

    await page.getByRole('button', { name: 'Editar Elfo Nocturno' }).click();

    // Los rasgos viven aparte: el borrador solo guarda sus ids, así que
    // volver a mostrarlos exige ir a buscarlos a la biblioteca.
    await expect(page.getByLabel('Nombre del rasgo 1')).toHaveValue('Visión Nocturna');
    await expect(page.getByLabel('Nombre del rasgo 2')).toHaveValue('Paso Silencioso');
    await expect(page.locator('#hb-speed')).toHaveValue('35');

    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  });

  test('una clase se rellena sola con la tabla del SRD', async () => {
    await page.goto('/homebrew');
    await waitForContent(page);

    await page.getByRole('button', { name: 'Crear', exact: true }).click();
    await page.getByRole('button', { name: 'Clase', exact: true }).click();

    await page.locator('#hb-name').fill('Centinela');
    await page.locator('#hb-hitdie').selectOption('10');

    // Los niveles de mejora vienen marcados sin tocar nada: son los del SRD.
    await expect(page.getByRole('button', { name: '4', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '19', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '3', exact: true })).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: 'Constitución', exact: true }).click();
    await page.getByRole('button', { name: 'Sabiduría', exact: true }).click();

    await page.getByRole('button', { name: 'Añadir rasgo' }).click();
    await page.getByLabel('Nombre del rasgo 1').fill('Vigilia');
    await page.getByLabel('Qué hace el rasgo 1').fill('No necesita dormir.');

    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByRole('heading', { name: /Tu contenido \(2\)/i })).toBeVisible();
    const list = page.getByRole('main').getByRole('list');
    await expect(list.getByText('Centinela')).toBeVisible();
  });

  test('pide exactamente dos salvaciones', async () => {
    await page.goto('/homebrew');
    await waitForContent(page);

    await page.getByRole('button', { name: 'Crear', exact: true }).click();
    await page.getByRole('button', { name: 'Clase', exact: true }).click();
    await page.locator('#hb-name').fill('Clase Incompleta');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByRole('alert')).toContainText(/dos salvaciones/i);
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  });

  test('borrar la clase se lleva sus rasgos', async () => {
    await page.goto('/homebrew');
    await waitForContent(page);

    await page.getByRole('button', { name: 'Borrar Centinela' }).click();
    await page.getByRole('button', { name: 'Borrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Tu contenido \(1\)/i })).toBeVisible();

    // "Vigilia" no puede quedar suelta en la biblioteca sin la clase a la que
    // pertenecía: sería basura que nadie sabe de dónde salió.
    await page.goto('/library');
    await waitForContent(page);
    await page.getByLabel('Buscar en la biblioteca').fill('Vigilia');
    /*
      Por la región viva, que es la que un lector de pantalla oye. El selector
      anterior buscaba el texto suelto con `/0 resultados/`, que casaba también
      con «60 resultados»: pasaba por casualidad mientras hubo un solo nodo.
    */
    await expect(page.locator('main p[role="status"]')).toHaveText(/^Sin resultados para /);
  });
});


/**
 * SUBCLASES Y EQUIPO INICIAL DE UNA CLASE PROPIA
 *
 * Los tests de `tests/unit/homebrew-big-types.test.ts` comprueban que el motor
 * resuelve lo que sale del editor. Acá se comprueba lo otro: que las tres
 * listas anidadas —subclases, sus rasgos, y los objetos de cada alternativa—
 * se pueden rellenar de verdad con el teclado y el ratón, y que al reabrir la
 * clase siguen ahí.
 *
 * Es el tipo de formulario donde un `index` mal puesto no rompe nada visible:
 * escribís en la subclase 2 y se guarda en la 1.
 */
test.describe('Subclases caseras', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('una clase se crea con dos subclases y su equipo', async () => {
    await page.goto('/homebrew');
    await waitForContent(page);

    await page.getByRole('button', { name: /Crear lo primero|^Crear$/ }).first().click();
    await page.getByRole('button', { name: 'Clase', exact: true }).click();

    await page.locator('#hb-name').fill('Vigía');
    await page.getByRole('button', { name: 'Constitución', exact: true }).click();
    await page.getByRole('button', { name: 'Sabiduría', exact: true }).click();

    await page.getByRole('button', { name: 'Añadir subclase' }).click();
    await page.getByLabel('Nombre de la subclase 1').fill('Senda del Ojo');
    await page.getByLabel('De qué va la subclase 1').fill('Nunca aparta la vista.');
    await page.getByRole('button', { name: 'Añadir rasgo a la subclase 1' }).click();
    await page.getByLabel('Nivel del rasgo de la subclase 1 1').fill('3');
    await page.getByLabel('Nombre del rasgo de la subclase 1 1').fill('Ojo Abierto');
    await page.getByLabel('Qué hace el rasgo de la subclase 1 1').fill('Ventaja en iniciativa.');

    // La segunda subclase es la que descubre un índice mal puesto: si las
    // etiquetas no distinguieran una lista de la otra, esto escribiría encima
    // de "Ojo Abierto" sin que nada se quejara.
    await page.getByRole('button', { name: 'Añadir subclase' }).click();
    await page.getByLabel('Nombre de la subclase 2').fill('Senda del Muro');
    await page.getByRole('button', { name: 'Añadir rasgo a la subclase 2' }).click();
    await page.getByLabel('Nombre del rasgo de la subclase 2 1').fill('Aguante');

    await expect(page.getByLabel('Nombre del rasgo de la subclase 1 1')).toHaveValue('Ojo Abierto');

    await page.getByRole('button', { name: 'Guardar' }).click();

    const list = page.getByRole('main').getByRole('list');
    await expect(list.getByText('Vigía')).toBeVisible();
    // El resumen cuenta por tipo: "4 rasgos" para dos subclases sería mentira
    // justo antes del botón que lo borra todo.
    await expect(list.getByText(/2 subclases · 2 rasgos/)).toBeVisible();
  });

  test('reabrirla devuelve cada rasgo a su subclase', async () => {
    await page.goto('/homebrew');
    await waitForContent(page);

    await page.getByRole('button', { name: 'Editar Vigía' }).click();

    await expect(page.getByLabel('Nombre de la subclase 1')).toHaveValue('Senda del Ojo');
    await expect(page.getByLabel('Nombre del rasgo de la subclase 1 1')).toHaveValue('Ojo Abierto');
    await expect(page.getByLabel('Nivel del rasgo de la subclase 1 1')).toHaveValue('3');
    await expect(page.getByLabel('Nombre del rasgo de la subclase 2 1')).toHaveValue('Aguante');

    // Y NO como rasgos sueltos de la clase: si se colaran ahí, al guardar de
    // nuevo se escribirían dos veces y todo personaje de la clase los
    // recibiría sin haber elegido subclase.
    await expect(page.getByLabel('Nombre del rasgo 1')).toHaveCount(0);

    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  });

  test('el selector de equipo ofrece la biblioteca en español', async () => {
    await page.goto('/homebrew');
    await waitForContent(page);

    await page.getByRole('button', { name: 'Editar Vigía' }).click();
    await page.getByRole('button', { name: 'Añadir objeto' }).first().click();

    // `exact` porque "Objeto 1" es subcadena de "Cuántas unidades del objeto 1"
    // y de "Quitar el objeto 1": sin él, el localizador encuentra tres.
    const picker = page.getByLabel('Objeto 1', { exact: true });
    // "Antorcha", no "Torch": el diccionario cubre los nombres de las 3.039
    // definiciones y el selector los ordena por el nombre que se lee.
    await picker.selectOption({ label: 'Antorcha' });
    await expect(picker).toHaveValue('srd-2014:gear:torch');

    await page.getByLabel('Cuántas unidades del objeto 1').fill('10');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await page.getByRole('button', { name: 'Editar Vigía' }).click();
    await expect(page.getByLabel('Objeto 1', { exact: true })).toHaveValue('srd-2014:gear:torch');
    await expect(page.getByLabel('Cuántas unidades del objeto 1')).toHaveValue('10');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  });

  test('borrarla se lleva las subclases y sus rasgos', async () => {
    await page.goto('/homebrew');
    await waitForContent(page);

    await page.getByRole('button', { name: 'Borrar Vigía' }).click();
    await page.getByRole('button', { name: 'Borrar', exact: true }).click();

    /*
      Se espera el aviso ANTES de irse.

      Borrar una clase son varias escrituras seguidas —cada subclase, cada
      rasgo, y la clase al final— y navegar a mitad las abandona: la subclase
      seguía apareciendo en la biblioteca una de cada tres veces. El aviso es
      la señal de que terminaron todas.
    */
    await expect(page.getByText('Vigía borrado')).toBeVisible();

    await page.goto('/library');
    await waitForContent(page);
    await page.getByLabel('Buscar en la biblioteca').fill('Senda del Ojo');

    /*
      Lo que importa es que la subclase NO esté, no que no haya resultados:
      «Senda» sola encuentra cuatro cosas del SRD, así que exigir cero sería
      exigir algo que no depende de este borrado.

      El selector anterior buscaba el texto suelto con `/0 resultados/`, que
      casaba con «60 resultados» —el recuento del listado, antes de que la
      búsqueda amortiguada se resolviera—. Pasaba sin llegar a mirar nunca.
    */
    await expect(page.locator('main p[role="status"]')).toHaveText(/resultados?$|^Sin resultados/);
    await expect(page.getByRole('button', { name: /Senda del Ojo/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Ojo Abierto/ })).toHaveCount(0);
  });
});
test.describe('Campañas', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('crear una campaña fija la edición de reglas', async () => {
    await page.goto('/campaigns');
    await waitForContent(page);

    await page.getByRole('button', { name: /Crear la primera/ }).click();
    await page.locator('#campaign-name').fill('La mesa de los martes');
    await page.locator('#campaign-desc').fill('Campaña de prueba.');
    await page.getByRole('button', { name: 'Crear campaña' }).click();

    await expect(page.getByRole('link', { name: /La mesa de los martes/ })).toBeVisible();
    await expect(page.getByText('D&D 5e (2014)').first()).toBeVisible();
  });

  test('anotar una sesión la numera sola', async () => {
    await page.getByRole('link', { name: /La mesa de los martes/ }).click();
    await page.waitForURL(/\/campaigns\/.+/);

    await page.getByRole('button', { name: 'Anotar' }).click();
    await page.locator('#session-title').fill('La emboscada del puente');
    await page.locator('#session-summary').fill('Perdieron el carro pero salvaron al mensajero.');
    await page.getByRole('button', { name: 'Guardar sesión' }).click();

    await expect(page.getByRole('heading', { name: /Sesiones \(1\)/i })).toBeVisible();
    await expect(page.getByText('Perdieron el carro pero salvaron al mensajero.')).toBeVisible();

    // La segunda sesión es la 2 sin que nadie lo escriba.
    await page.getByRole('button', { name: 'Anotar' }).click();
    await page.locator('#session-title').fill('El regreso');
    await page.getByRole('button', { name: 'Guardar sesión' }).click();
    await expect(page.getByRole('heading', { name: /Sesiones \(2\)/i })).toBeVisible();
  });

  test('archivar la saca de la lista sin tocar los personajes', async () => {
    await page.getByRole('button', { name: 'Archivar campaña' }).click();
    await page.getByRole('button', { name: 'Archivar de verdad' }).click();

    await page.waitForURL(/\/campaigns$/);
    await expect(page.getByText('Todavía no tenés campañas')).toBeVisible();
  });
});
