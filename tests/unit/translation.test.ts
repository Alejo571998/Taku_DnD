import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadContent, srd14, srd24 } from '../fixtures/content';
import {
  applyTranslation,
  BLOCK_FIELDS,
  emptyOverlay,
  measureCoverage,
  translationKey,
  type TranslationOverlay,
} from '@domain/content/translation';

/**
 * TRADUCCION DEL CONTENIDO (MASTER SPEC §37)
 *
 * La cobertura es PARCIAL a proposito. Lo que se prueba aqui es que sea
 * honesta: que nunca invente texto, que no cruce ediciones, y que la interfaz
 * pueda saber exactamente que esta traducido.
 */

const overlay = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'public/content/translations/es-419.json'), 'utf8'),
) as TranslationOverlay;

const c2014 = loadContent('2014');
const c2024 = loadContent('2024');

describe('Claves', () => {
  it('quita la edicion del id para la clave comun', () => {
    expect(translationKey('srd-2014:condition:blinded')).toBe('condition:blinded');
    expect(translationKey('srd-2024:condition:blinded')).toBe('condition:blinded');
  });
});

describe('Aplicacion campo a campo', () => {
  it('traduce nombre y texto de una condicion de 2014', () => {
    const blinded = c2014.get(srd14('condition', 'blinded'))!;
    const translated = applyTranslation(blinded, overlay);

    expect(translated.name).toBe('Cegado');
    expect(translated.description[0]).toContain('no puede ver');
    expect(translated.translation).toBe('full');
  });

  it('sin traduccion, deja el original y lo declara', () => {
    // El diccionario ya cubre por nombre las 3.039 definiciones del SRD, así
    // que este caso YA NO SE ENCUENTRA buscándolo en la biblioteca. El camino
    // sigue importando: lo recorre todo lo que el diccionario no conoce —el
    // contenido propio de quien juega, y cualquier definición que se sume al
    // SRD antes de traducirla—. Se fabrica uno en vez de esperar a tenerlo.
    const known = c2014.get(srd14('condition', 'blinded'))!;
    const foreign = { ...known, id: 'srd-2014:condition:sin-traducir' };

    const translated = applyTranslation(foreign, overlay);
    expect(translated.name).toBe(foreign.name);
    expect(translated.description).toEqual(foreign.description);
    expect(translated.translation).toBe('none');
  });

  it('con solo el nombre traducido, el estado es parcial', () => {
    /*
      Este caso ya no se encuentra buscándolo: el diccionario cubre las 3.039
      definiciones, nombre y texto. Antes se nombraba `rule:combat` y se cayó
      al traducirlo; después se buscaba uno cualquiera y se cayó al no quedar
      ninguno. Las dos veces el test dependía del ESTADO del diccionario en vez
      de la regla. Se fabrica.
    */
    const known = c2014.get(srd14('condition', 'blinded'))!;
    expect(known.description.length, 'el caso solo sirve si hay texto').toBeGreaterThan(0);

    const soloNombre: TranslationOverlay = {
      ...emptyOverlay(),
      names: { [translationKey(known.id)]: 'Cegado' },
    };

    const translated = applyTranslation(known, soloNombre);
    expect(translated.name).toBe('Cegado');
    expect(translated.description).toEqual(known.description);
    expect(translated.translation).toBe('partial');
  });

  it('una superposicion vacia no cambia absolutamente nada', () => {
    const blinded = c2014.get(srd14('condition', 'blinded'))!;
    const untouched = applyTranslation(blinded, emptyOverlay());
    expect(untouched.name).toBe(blinded.name);
    expect(untouched.description).toEqual(blinded.description);
    expect(untouched.translation).toBe('none');
  });
});

describe('Las ediciones no se cruzan', () => {
  it('el nombre es comun, pero el texto de 2014 NO se filtra a 2024', () => {
    const blinded24 = c2024.get(srd24('condition', 'blinded'))!;
    const translated = applyTranslation(blinded24, overlay);

    expect(translated.name).toBe('Cegado');
    // El SRD 5.2 no trae texto para las condiciones: traducir la de 5.1 aqui
    // seria meter reglas de otra edicion sin que nadie se entere.
    expect(translated.description).toEqual(blinded24.description);
  });

  it('ninguna clave comun aporta descripciones', () => {
    // La forma del tipo lo impide, y el dato tiene que respetarlo tambien.
    for (const value of Object.values(overlay.names)) {
      expect(typeof value).toBe('string');
    }
  });
});

describe('Un texto traducido es una traducción, no un resumen', () => {
  /*
    LO QUE ESTO ATRAPA, Y POR QUÉ NO ES UNA MANÍA DE ESTILO.

    Las ocho reglas traducidas primero eran RESÚMENES: "Daño y curación" pasaba
    de 1.846 palabras a 109, el 6%. El texto en español se muestra EN LUGAR del
    original y la ficha lo declaraba "traducido" sin más. Quien juega en español
    leía media regla y creía haberla leído entera; quien juega en inglés jugaba
    con otras reglas. Eso es exactamente la clase de mentira que prohíbe
    MASTER PROMPT §75, y no la veía nadie porque nadie la medía.

    EL UMBRAL SUBIÓ DEL 60% AL 70%, Y NO POR GUSTO.

    Con el 60% este test daba verde mientras a «Archidruida» le faltaba la
    última oración —«Obtenés este beneficio tanto en tu forma normal como en la
    forma de bestia»—, un 69,5% que pasaba de largo. Lo encontró un repaso a
    mano, no el test, que es justo lo que el test tendría que evitar.

    Al 70% el texto más corto del diccionario queda en 70,19%: hay margen para
    el español apretado —«Un carcaj guarda hasta 20 flechas» es un 75%— y no lo
    hay para una oración perdida.
  */
  const words = (paragraphs: readonly string[]) =>
    paragraphs.join(' ').split(/\s+/).filter(Boolean).length;

  it('ninguna traducción baja del 70% de las palabras del original', () => {
    const tooShort: string[] = [];

    for (const content of [c2014, c2024]) {
      for (const definition of content.allDefinitions()) {
        const entry = overlay.entries[definition.id];
        if (!entry?.description || definition.description.length === 0) continue;

        // Debajo de quince palabras la proporción no dice nada: «# Combat» son
        // dos palabras y «# Combate» una, y eso ya es un 50% sin que falte nada.
        if (words(definition.description) < 15) continue;

        const ratio = words(entry.description) / words(definition.description);
        if (ratio < 0.7) {
          tooShort.push(`${definition.id}: ${Math.round(ratio * 100)}%`);
        }
      }
    }

    expect(tooShort, 'parecen resúmenes, no traducciones').toEqual([]);
  });
});

describe('Los bloques del monstruo (deuda T19)', () => {
  /*
    Un bloque de estadísticas no es prosa corrida: son apartados con título, y
    la ficha los pinta por posición. Traducir uno de menos no deja texto en
    inglés — deja al dragón SIN una de sus acciones, que es una regla que
    desaparece de la mesa sin que nadie lo note.
  */
  const dragon = c2014.allDefinitions().find((d) => d.type === 'monster' && d.actions.length > 2)!;

  it('aplica los tres bloques cuando vienen completos', () => {
    const traducido = applyTranslation(dragon, overlay);
    expect(traducido.type).toBe('monster');
    if (traducido.type !== 'monster') return;

    expect(traducido.actions).toHaveLength(dragon.type === 'monster' ? dragon.actions.length : 0);
    for (const a of traducido.actions) expect(a.name.length).toBeGreaterThan(0);
  });

  it('un bloque con menos apartados que el original NO se aplica', () => {
    if (dragon.type !== 'monster') throw new Error('hace falta un monstruo con acciones');

    const truncado: TranslationOverlay = {
      ...emptyOverlay(),
      names: { [translationKey(dragon.id)]: 'Dragón' },
      entries: {
        [dragon.id]: {
          description: ['texto'],
          actions: [{ name: 'Ataque múltiple', desc: 'Solo la primera.' }],
        },
      },
    };

    const traducido = applyTranslation(dragon, truncado);
    if (traducido.type !== 'monster') throw new Error('sigue siendo un monstruo');

    expect(traducido.actions, 'se queda con las del original, enteras').toEqual(dragon.actions);
    expect(traducido.translation, 'y lo declara pendiente').toBe('partial');
  });

  it('el material del conjuro deja de salir en inglés', () => {
    const conMaterial = c2014
      .all('spell')
      .find((s) => s.type === 'spell' && s.material?.includes('bat guano'))!;
    const traducido = applyTranslation(conMaterial, overlay);
    if (traducido.type !== 'spell') throw new Error('sigue siendo un conjuro');

    expect(traducido.material).toContain('guano');
    expect(traducido.material).not.toContain('bat guano');
  });
});

describe('Cobertura', () => {
  it('cuenta lo traducido de verdad, sin redondear a favor', () => {
    const coverage = measureCoverage(c2014.allDefinitions(), overlay);

    expect(coverage.total).toBeGreaterThan(1000);
    expect(coverage.full + coverage.partial + coverage.none).toBe(coverage.total);
  });

  it('no queda ninguna definicion sin nombre en español', () => {
    for (const content of [c2014, c2024]) {
      const coverage = measureCoverage(content.allDefinitions(), overlay);
      expect(coverage.none, 'el diccionario cubre por nombre las dos ediciones').toBe(0);
    }
  });

  it('las condiciones estan traducidas enteras en 2014', () => {
    const coverage = measureCoverage(c2014.allDefinitions(), overlay);
    const conditions = coverage.byType['condition']!;
    expect(conditions.translated).toBe(conditions.total);
  });

  it('los conjuros tambien, por nombre', () => {
    const coverage = measureCoverage(c2014.allDefinitions(), overlay);
    const spells = coverage.byType['spell']!;
    expect(spells.translated).toBe(spells.total);
  });

  it('por tipo distingue "tiene algo" de "no deja nada en inglés"', () => {
    /*
      `translated` es "tiene algo en español" y `full` es "no deja nada en
      inglés": no significan lo mismo, y la barra de la biblioteca usa el
      segundo. Mientras los objetos mágicos tenían el nombre y no el texto, la
      diferencia se veía sola en el diccionario; ya no, porque está todo
      traducido. Se fabrica el caso en vez de esperar a que vuelva a aparecer.
    */
    const item = c2014.get(srd14('magicItem', 'adamantine-armor'))!;
    expect(item.description.length, 'el caso solo sirve si hay texto').toBeGreaterThan(0);

    const soloNombre: TranslationOverlay = {
      ...emptyOverlay(),
      names: { [translationKey(item.id)]: 'Armadura de adamantina' },
    };

    const parcial = measureCoverage([item], soloNombre).byType['magicItem']!;
    expect(parcial.translated).toBe(1);
    expect(parcial.full).toBe(0);

    expect(measureCoverage([item], overlay).byType['magicItem']!.full).toBe(1);
  });

  it('lo que falta se cuenta y no se esconde', () => {
    /*
      Este test decía `partial > full`, y después `partial > 0`. Las dos veces
      era un estado pasajero escrito como si fuera una regla, y las dos veces
      se cayó al avanzar la traducción sin que nada estuviera mal.

      Lo que de verdad no puede pasar es que la cuenta mienta: `partial` tiene
      que valer EXACTAMENTE la cantidad de definiciones a las que todavía les
      queda prosa en inglés. El día que entre contenido sin traducir y la barra
      siga marcando 100%, esto se cae (MASTER PROMPT §75).
    */
    for (const content of [c2014, c2024]) {
      const definitions = [...content.allDefinitions()];
      const coverage = measureCoverage(definitions, overlay);

      const enIngles = definitions.filter((d) => {
        const entry = overlay.entries[d.id];
        if (d.description.length > 0 && !entry?.description) return true;
        if (d.type === 'spell' && d.material && entry?.fields?.material === undefined) return true;
        if (d.type === 'monster') {
          for (const field of BLOCK_FIELDS) {
            if (d[field].length > 0 && entry?.[field]?.length !== d[field].length) return true;
          }
        }
        return false;
      }).length;

      expect(coverage.partial, 'parcial = lo que sigue en inglés').toBe(enIngles);
      expect(coverage.full + coverage.partial + coverage.none).toBe(coverage.total);
    }
  });
});
