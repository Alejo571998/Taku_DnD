import { chromium, devices } from 'playwright';

/*
  AUDITORÍA DE RESPONSIVE, MEDIDA

  Mirar capturas encuentra lo llamativo. Lo que rompe una interfaz en un
  teléfono real es lo que no se ve de un vistazo: un desborde de 3px que
  provoca scroll horizontal en TODA la página, un botón de 32px que un pulgar
  no acierta, un texto que queda debajo de la barra fija.

  Anchos: 320 es el suelo real (iPhone SE 1ª gen, Galaxy Fold cerrado), 375 el
  teléfono típico, 414 el grande, 768 la tablet, 1280 el escritorio.
*/

const BASE = 'http://localhost:3100';

const ANCHOS = [
  { n: 320, alto: 568, nombre: '320 (el suelo)' },
  { n: 375, alto: 812, nombre: '375 (teléfono)' },
  { n: 414, alto: 896, nombre: '414 (grande)' },
  { n: 768, alto: 1024, nombre: '768 (tablet)' },
  { n: 1280, alto: 800, nombre: '1280 (escritorio)' },
];

const RUTAS = [
  '/',
  '/characters',
  '/characters/new',
  '/library',
  '/campaigns',
  '/homebrew',
  '/dice',
  '/profile',
  '/auth/sign-in',
  '/auth/sign-up',
];

const AUDITORIA = `(() => {
  const vw = document.documentElement.clientWidth;
  const problemas = [];

  // 1 · Scroll horizontal: un solo elemento ancho arrastra la página entera.
  const scrollH = document.documentElement.scrollWidth;
  if (scrollH > vw + 1) {
    problemas.push({ tipo: 'scroll-horizontal', detalle: scrollH + 'px de contenido en ' + vw + 'px' });
  }

  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const nombre = (el) => {
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\\s+/g, ' ');
    return el.tagName.toLowerCase() + (t ? ' «' + t.slice(0, 34) + '»' : '');
  };

  // 2 · Elementos que se salen por la derecha.
  for (const el of document.querySelectorAll('main *, header *, nav *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 && r.width <= vw) {
      problemas.push({ tipo: 'se-sale', detalle: nombre(el) + ' llega a ' + Math.round(r.right) + 'px' });
    }
  }

  /*
    3 · Áreas de toque.

    Se mide el área que RESPONDE AL DEDO, no la caja del elemento. No son lo
    mismo: un control puede dibujarse de 6px y aceptar el toque en 26 gracias a
    un pseudoelemento estirado, que es justo la técnica para no deformar el
    diseño. Midiendo la caja, eso salía como un fallo que no existe.

    Se sondea hacia fuera desde el centro con \`elementFromPoint\`, que es lo que
    hace el navegador cuando alguien toca.
  */
  const alcanza = (el, cx, cy, dx, dy) => {
    const t = document.elementFromPoint(cx + dx, cy + dy);
    return t === el || (t !== null && el.contains(t));
  };

  const areaSensible = (el, r) => {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (document.elementFromPoint(cx, cy) === null) return r; // fuera de pantalla
    let arriba = 0;
    let abajo = 0;
    let izq = 0;
    let der = 0;
    for (let d = 1; d <= 24; d += 1) {
      if (alcanza(el, cx, cy, 0, -d)) arriba = d;
      else break;
    }
    for (let d = 1; d <= 24; d += 1) {
      if (alcanza(el, cx, cy, 0, d)) abajo = d;
      else break;
    }
    for (let d = 1; d <= 24; d += 1) {
      if (alcanza(el, cx, cy, -d, 0)) izq = d;
      else break;
    }
    for (let d = 1; d <= 24; d += 1) {
      if (alcanza(el, cx, cy, d, 0)) der = d;
      else break;
    }
    return { width: Math.max(r.width, izq + der + 1), height: Math.max(r.height, arriba + abajo + 1) };
  };

  const controles = document.querySelectorAll(
    'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=checkbox]'
  );
  for (const el of controles) {
    if (!visible(el)) continue;
    // El enlace de saltar al contenido mide 1x1 hasta que recibe el foco: es
    // así a propósito y no lo toca nadie con el dedo.
    if (el.classList.contains('sr-only')) continue;

    const r = el.getBoundingClientRect();
    const a = areaSensible(el, r);
    if (a.height < 24 || a.width < 24) {
      problemas.push({
        tipo: 'toque-muy-chico',
        detalle: nombre(el) + ' responde en ' + Math.round(a.width) + 'x' + Math.round(a.height),
      });
    } else if (a.height < 44 || a.width < 44) {
      problemas.push({
        tipo: 'toque-chico',
        detalle: nombre(el) + ' responde en ' + Math.round(a.width) + 'x' + Math.round(a.height),
      });
    }
  }

  /*
    4 · Texto que se corta SIN que nadie lo haya pedido.

    No cuenta el que lleva \`text-overflow: ellipsis\`: ahí el recorte es la
    decisión de diseño —un nombre largo en una fila de lista— y los puntos
    suspensivos avisan de que hay más. Tampoco el \`sr-only\`, que se recorta a
    1px a propósito porque solo existe para el lector de pantalla.

    Lo que sí es un fallo es el texto que desborda en silencio.
  */
  for (const el of document.querySelectorAll('main *')) {
    if (!visible(el) || el.children.length > 0) continue;
    if (el.classList.contains('sr-only')) continue;
    const cs = getComputedStyle(el);
    if (cs.textOverflow === 'ellipsis' || cs.overflow === 'auto' || cs.overflow === 'scroll') continue;
    if (el.scrollWidth > el.clientWidth + 2) {
      problemas.push({ tipo: 'texto-cortado', detalle: nombre(el) });
    }
  }

  return problemas;
})()`;

const browser = await chromium.launch();
const informe = new Map();

for (const ancho of ANCHOS) {
  const ctx = await browser.newContext({
    viewport: { width: ancho.n, height: ancho.alto },
    ...(ancho.n <= 414 ? devices['Pixel 5'].userAgent ? { userAgent: devices['Pixel 5'].userAgent } : {} : {}),
  });
  const page = await ctx.newPage();

  for (const ruta of RUTAS) {
    try {
      await page.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 60_000 });
    } catch {
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(1200);

    let problemas = [];
    try {
      problemas = await page.evaluate(AUDITORIA);
    } catch (e) {
      problemas = [{ tipo: 'error', detalle: e.message }];
    }

    for (const p of problemas) {
      const clave = `${p.tipo}|${p.detalle}`;
      const entrada = informe.get(clave) ?? { ...p, donde: new Set() };
      entrada.donde.add(`${ancho.n}px ${ruta}`);
      informe.set(clave, entrada);
    }
  }
  await ctx.close();
}

await browser.close();

// ── Informe ──────────────────────────────────────────────────────────────────

const porTipo = new Map();
for (const e of informe.values()) {
  const lista = porTipo.get(e.tipo) ?? [];
  lista.push(e);
  porTipo.set(e.tipo, lista);
}

const ORDEN = ['error', 'scroll-horizontal', 'toque-muy-chico', 'se-sale', 'toque-chico', 'texto-cortado'];
const TITULO = {
  'error': 'LA PÁGINA NO CARGÓ',
  'scroll-horizontal': 'SCROLL HORIZONTAL (lo más grave: mueve la página entera)',
  'se-sale': 'ELEMENTOS QUE SE SALEN POR LA DERECHA',
  'toque-muy-chico': 'ÁREAS DE TOQUE POR DEBAJO DE 24px (incumple WCAG 2.5.8, nivel AA)',
  'toque-chico': 'ÁREAS DE TOQUE ENTRE 24 y 44px (cumple AA, por debajo de la guía de Apple)',
  'texto-cortado': 'TEXTO QUE NO ENTRA',
};

let total = 0;
for (const tipo of ORDEN) {
  const lista = porTipo.get(tipo);
  if (!lista || lista.length === 0) continue;
  console.log('');
  console.log('── ' + TITULO[tipo] + ' — ' + lista.length);
  for (const e of lista.slice(0, 28)) {
    const donde = [...e.donde];
    const resumen = donde.length > 3 ? donde.slice(0, 3).join(', ') + ` … (+${donde.length - 3})` : donde.join(', ');
    console.log('   ' + e.detalle);
    console.log('      en: ' + resumen);
  }
  if (lista.length > 28) console.log('   … y ' + (lista.length - 28) + ' más');
  total += lista.length;
}

console.log('');
console.log(total === 0 ? '  Sin hallazgos.' : '  TOTAL: ' + total + ' problemas distintos');
