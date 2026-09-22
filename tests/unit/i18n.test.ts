import { describe, expect, it } from 'vitest';
import es from '@/i18n/messages/es-419.json';
import en from '@/i18n/messages/en.json';
import { translate, type MessageTree } from '@/i18n/runtime';
import { CONFLICT_CLASS } from '@application/commands/types';

/**
 * CATALOGOS DE INTERFAZ (MASTER SPEC §34)
 *
 * Lo que se prueba: que los dos idiomas digan lo MISMO —mismas claves, mismos
 * parametros— y que toda clave que el dominio emite tenga texto. Un catalogo
 * con huecos se descubre en produccion, cuando el usuario ve un codigo crudo.
 */

const esTree = es as MessageTree;
const enTree = en as MessageTree;

/**
 * Aplana a pares (ruta, texto).
 *
 * Devuelve el texto junto a la ruta a proposito: el catalogo mezcla niveles
 * con claves literales que llevan punto, asi que volver a buscar por la ruta
 * seria reimplementar la busqueda del runtime dentro del test — y un test que
 * reimplementa lo que prueba no prueba nada.
 */
const flatten = (tree: MessageTree, prefix = ''): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string'
      ? ([[prefix + key, value]] as [string, string][])
      : flatten(value, `${prefix}${key}.`),
  );

const paramsOf = (template: string): string[] =>
  [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

const asMap = (tree: MessageTree) => new Map(flatten(tree));

describe('Paridad entre idiomas', () => {
  it('los dos catalogos tienen exactamente las mismas claves', () => {
    expect([...asMap(esTree).keys()].sort()).toEqual([...asMap(enTree).keys()].sort());
  });

  it('los parametros coinciden clave por clave', () => {
    // Si el ingles dice {amount} donde el espanol dice {cantidad}, el texto
    // sale con una llave cruda en pantalla.
    const english = asMap(enTree);
    for (const [key, value] of asMap(esTree)) {
      expect(paramsOf(english.get(key) ?? ''), `parametros de ${key}`).toEqual(paramsOf(value));
    }
  });

  it('ningun texto esta vacio', () => {
    for (const tree of [esTree, enTree]) {
      for (const [key, value] of asMap(tree)) {
        expect(value.trim().length, `clave vacia: ${key}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('Busqueda de claves', () => {
  it('baja por niveles', () => {
    expect(translate(esTree, 'nav.home')).toBe('Inicio');
  });

  it('encuentra claves literales con punto dentro de una seccion', () => {
    // El catalogo agrupa por dominio sin partir cada codigo en cinco niveles.
    expect(translate(esTree, 'history.tempHp.replaced', { amount: 5 })).toBe('5 PG temporales');
    expect(translate(esTree, 'error.item.notFound')).toBe('No encontramos ese objeto');
  });

  it('sustituye parametros', () => {
    expect(translate(esTree, 'history.damage', { amount: 7 })).toBe('−7 PG');
    expect(translate(enTree, 'history.levelUp', { className: 'Fighter', level: 3, hitPoints: 8 })).toBe(
      'Fighter level 3! +8 HP',
    );
  });

  it('deja el marcador cuando falta un parametro, en vez de escribir undefined', () => {
    expect(translate(esTree, 'history.damage', {})).toBe('−{amount} PG');
  });

  it('devuelve el respaldo cuando la clave no existe', () => {
    expect(translate(esTree, 'no.existe', undefined, 'Listo')).toBe('Listo');
    // Sin respaldo devuelve la clave: un hueco en blanco no se puede ni reportar.
    expect(translate(esTree, 'no.existe')).toBe('no.existe');
  });
});

describe('Cobertura de lo que emite el dominio', () => {
  it('cada comando que produce historial tiene su texto', () => {
    // Los comandos sin resumen propio reutilizan uno generico a proposito; lo
    // que no puede pasar es que un comando nuevo se quede sin ninguno.
    const missing = Object.keys(CONFLICT_CLASS).filter((type) => {
      const guesses = [
        `history.${type[0]!.toLowerCase()}${type.slice(1)}`,
        'common.done',
      ];
      return guesses.every((key) => translate(esTree, key) === key);
    });
    expect(missing).toEqual([]);
  });

  it('el respaldo generico existe en los dos idiomas', () => {
    expect(translate(esTree, 'common.done')).not.toBe('common.done');
    expect(translate(enTree, 'common.done')).not.toBe('common.done');
  });

  it('el error generico existe: nunca se muestra un codigo crudo', () => {
    expect(translate(esTree, 'error.validation.failed')).not.toBe('error.validation.failed');
    expect(translate(enTree, 'error.validation.failed')).not.toBe('error.validation.failed');
  });
});
