import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * EL MARKDOWN DEL SRD SE PINTA, NO SE ENSEÑA
 *
 * Los packs traen Markdown dentro de cada párrafo y la ficha los volcaba en un
 * `<p>` tal cual: la regla de Trampas empezaba literalmente por `## Traps` y su
 * tabla de CD se leía como una fila de barras verticales.
 *
 * Este archivo no prueba el componente: prueba que el CONTENIDO siga teniendo
 * la forma que el intérprete de `SrdText.tsx` sabe leer. Si algún día el
 * generador cambia y empieza a emitir, por ejemplo, tablas sin su fila de
 * guiones, esto falla acá y no en la pantalla de alguien.
 */

const CONTENT = path.resolve(process.cwd(), 'public', 'content');

const everyParagraph = (): string[] => {
  const out: string[] = [];
  for (const pack of ['srd-2014', 'srd-2024']) {
    for (const file of fs.readdirSync(path.join(CONTENT, pack))) {
      if (file === 'manifest.json') continue;
      const items = JSON.parse(fs.readFileSync(path.join(CONTENT, pack, file), 'utf8')) as {
        description?: string[];
      }[];
      for (const item of items) out.push(...(item.description ?? []));
    }
  }
  return out;
};

const lines = everyParagraph().flatMap((p) => p.split('\n'));

const TABLE_ROW = /^\s*\|(.*)\|\s*$/;
const TABLE_RULE = /^\s*\|[\s|:-]+\|\s*$/;

describe('la forma del Markdown del SRD', () => {
  it('sigue habiendo encabezados, listas y tablas que interpretar', () => {
    // Si esto diera cero, el intérprete estaría de adorno y habría que
    // quitarlo en vez de mantenerlo.
    expect(lines.filter((l) => /^#{1,6}\s/.test(l)).length).toBeGreaterThan(200);
    expect(lines.filter((l) => /^\s*[-*]\s/.test(l)).length).toBeGreaterThan(100);
    expect(lines.filter((l) => TABLE_ROW.test(l)).length).toBeGreaterThan(400);
  });

  it('ninguna tabla se queda sin su fila de guiones', () => {
    /*
      El intérprete solo trata un `|…|` como tabla si la línea siguiente es la
      de guiones. Es a propósito: sin esa señal, una frase con barras se
      convertiría en una tabla de una fila. Pero significa que una tabla mal
      formada del generador se pintaría como párrafo, con sus barras a la
      vista, y nadie se enteraría.
    */
    const huerfanas: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!TABLE_ROW.test(line) || TABLE_RULE.test(line)) continue;
      const anterior = lines[i - 1];
      const siguiente = lines[i + 1];
      const empiezaTabla = siguiente != null && TABLE_RULE.test(siguiente);
      const continuaTabla =
        anterior != null && (TABLE_ROW.test(anterior) || TABLE_RULE.test(anterior));
      if (!empiezaTabla && !continuaTabla) huerfanas.push(line.slice(0, 80));
    }

    expect(huerfanas, 'filas de tabla sin cabecera: se verían como texto con barras').toEqual([]);
  });

  it('no queda ningun salto de parrafo perdido del volcado de 5.2', () => {
    /*
      La API publica de 5.2 entrega cada objeto magico como UNA cadena, y por
      el camino pierde saltos: `...con duergar.Toughness. Tu Constitucion...`.
      `build-content.mjs` corta por ahi, y este test es el que avisa si el
      corte deja de aplicarse o si el volcado se rehace sin pasar por el.
    */
    const pegadas = lines
      .filter((l) => !TABLE_ROW.test(l))
      .filter((l) => /[a-z0-9][.:](?=[A-Z])/.test(l))
      .map((l) => l.slice(0, 80));

    expect(pegadas, 'parrafos pegados: el volcado de 5.2 no paso por el corte').toEqual([]);
  });

  it('las dos listas de arreglos del volcado siguen apuntando a algo', () => {
    /*
      Los arreglos viven en `data/srd-raw/2024/*.fix.json` porque son datos, no
      codigo. El riesgo de eso es que envejezcan en silencio: si el SRD arregla
      una entrada en origen o le cambia el slug, el parche deja de hacer nada y
      nadie se entera. Esto falla el dia que eso pase.
    */
    const raw = path.resolve(process.cwd(), 'data', 'srd-raw', '2024');
    const leer = (f: string) => JSON.parse(fs.readFileSync(path.join(raw, f), 'utf8'));

    const { _porque: _p, ...parches } = leer('magic-items.fix.json');
    const objetos = JSON.parse(
      fs.readFileSync(path.join(CONTENT, 'srd-2024', 'magicItem.json'), 'utf8'),
    ) as { id: string; description?: string[] }[];
    const ids = new Set(objetos.map((o) => o.id.split(':')[2]));
    expect(Object.keys(parches).filter((slug) => !ids.has(slug))).toEqual([]);

    // Y cada palabra pegada tiene que seguir pegada en el crudo y suelta en lo
    // construido: si una sobra, es que el volcado ya la arreglo.
    const { espacios, rayas } = leer('pegados.fix.json');
    const crudo = fs.readFileSync(path.join(raw, 'Magic-Items.json'), 'utf8');
    const servido = objetos.flatMap((o) => o.description ?? []).join(' ');
    const sobran = Object.keys({ ...espacios, ...rayas }).filter(
      (k) => !crudo.includes(k) || servido.includes(k),
    );
    expect(sobran, 'pares que ya no hacen falta o que el corte no aplico').toEqual([]);
  });

  it('no hay HTML crudo escondido en las descripciones', () => {
    // El intérprete construye nodos de React y nunca usa `innerHTML`, así que
    // una etiqueta acá no se ejecutaría: se vería. Que no la haya es lo que
    // permite seguir sin sanear nada.
    const conHtml = lines.filter((l) => /<\s*(script|iframe|img|a|div|span)\b/i.test(l));
    expect(conHtml).toEqual([]);
  });
});
