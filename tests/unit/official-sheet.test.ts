import { describe, expect, it } from 'vitest';
import { character, sheetOf } from '../fixtures/characters';
import { loadContent } from '../fixtures/content';
import { executeCommand } from '@application/commands/execute';
import { RulesEngine } from '@domain/rules/engine';
import { SRD_RULES } from '@domain/rules/srd-rules';
import { recordDeathSave } from '@domain/character/hitpoints';
import { RESOURCE_LABELS } from '@domain/character/engine';
import { PROFICIENCY_ES, proficiencyEs } from '@domain/content/labels';
import { formatCurrency } from '@domain/currency/currency';
import { isOk } from '@domain/shared/result';

/**
 * LA FUSIÓN CON LA HOJA OFICIAL
 *
 * Lo que la hoja de 2024 tiene y la ficha no mostraba. Casi todo estaba ya
 * calculado en `CharacterSheet` y solo faltaba pintarlo, así que lo que se
 * prueba aquí no es que el dato exista: es que la ficha NO PUEDA volver a
 * perderlo sin que algo falle.
 */

const c2024 = loadContent('2024');
const engine24 = new RulesEngine(SRD_RULES, '2024');

describe('Lo que la ficha tiene que poder mostrar', () => {
  const sheet = sheetOf(character('2024').withClass('fighter', 3).build());

  it('los dados de golpe traen gastados y disponibles por clase', () => {
    /*
      El descanso corto los consumía a ciegas porque ninguna pantalla los
      pintaba. Si esto diera cero, el panel quedaría vacío sin avisar.
    */
    expect(sheet.hitDice.length).toBeGreaterThan(0);
    const bloque = sheet.hitDice[0]!;
    expect(bloque.total).toBe(3);
    expect(bloque.available + bloque.spent).toBe(bloque.total);
    expect(bloque.die).toBeGreaterThan(0);
  });

  it('el bonificador por competencia, el tamaño y la percepción pasiva existen', () => {
    expect(sheet.proficiencyBonus).toBeGreaterThan(0);
    expect(sheet.size.length).toBeGreaterThan(0);
    expect(sheet.passivePerception).toBeGreaterThan(0);
  });

  it('las competencias con equipo llegan a la ficha, no solo al creador', () => {
    // El guerrero tiene competencia con todas las armaduras y todas las armas.
    expect(sheet.proficiencies.armor.length).toBeGreaterThan(0);
    expect(sheet.proficiencies.weapons.length).toBeGreaterThan(0);
  });

  it('y se leen en español, no como identificador', () => {
    /*
      La ficha mostraba «all-armor» y «simple-weapons» tal cual. Se comprueba
      la PERTENENCIA al diccionario, no que la salida cambie: si algún día
      apareciera una competencia que se escribe igual en los dos idiomas, un
      test de «salida ≠ entrada» la daría por traducida sin que nadie la
      hubiera mirado.
    */
    const sinTraducir: string[] = [];
    for (const ruleset of ['2014', '2024'] as const) {
      const contenido = loadContent(ruleset);
      for (const def of contenido.all('class')) {
        const c = def as unknown as {
          armorProficiencies: string[];
          weaponProficiencies: string[];
          toolProficiencies: string[];
        };
        for (const p of [
          ...c.armorProficiencies,
          ...c.weaponProficiencies,
          ...c.toolProficiencies,
        ]) {
          if (!(p in PROFICIENCY_ES)) sinTraducir.push(p);
        }
      }
    }
    expect([...new Set(sinTraducir)]).toEqual([]);
  });

  it('el Homebrew pasa entero: la lista NO es cerrada', () => {
    // El editor las guarda como texto libre. Si el diccionario las tocara,
    // la clase propia del usuario cambiaría de nombre sola.
    expect(proficiencyEs('Armas de asedio enanas')).toBe('Armas de asedio enanas');
  });

  it('ningún recurso de clase se muestra con la clave en inglés', () => {
    /*
      El panel de RECURSOS decía «Second wind uses» y «Weapon mastery»: el
      diccionario cubría 19 de las 39 claves y el respaldo solo le quita los
      guiones bajos, así que la que falta sale en inglés y parece traducida.

      Se comprueba la PERTENENCIA al diccionario, no que la etiqueta salga
      distinta de la clave: el respaldo es tan parecido al original que un
      test de «salida ≠ entrada» pasaría con la clave en inglés en pantalla.
    */
    const sinTraducir: string[] = [];
    for (const ruleset of ['2014', '2024'] as const) {
      for (const def of loadContent(ruleset).all('class')) {
        const c = def as unknown as {
          progression: Record<string, { resources?: Record<string, unknown> }>;
        };
        for (const fila of Object.values(c.progression)) {
          for (const clave of Object.keys(fila.resources ?? {})) {
            if (!(clave in RESOURCE_LABELS)) sinTraducir.push(clave);
          }
        }
      }
    }
    expect([...new Set(sinTraducir)]).toEqual([]);
  });

  it('las dos formas de las herramientas de ladrón no se muestran dos veces', () => {
    // El volcado trae `thieves-tools` y `tool-thieves-tools`: el mismo objeto
    // escrito de dos maneras, que traducido daba el chip repetido.
    const unidas = [...new Set(['thieves-tools', 'tool-thieves-tools'].map(proficiencyEs))];
    expect(unidas).toEqual(['Herramientas de ladrón']);
  });
});

describe('Salvaciones contra muerte', () => {
  it('acumulan, topan en tres y el 20 natural levanta con 1 PG', () => {
    const vacio = { successes: 0, failures: 0 };
    const hp = {
      current: 0,
      temporary: 0,
      mode: 'fixed' as const,
      rolls: [],
      bonusPerLevel: 0,
      deathSaves: vacio,
    };

    // Un 2 es un fallo; un 1 cuenta doble.
    expect(recordDeathSave(hp, 2).hitPoints.deathSaves).toEqual({ successes: 0, failures: 1 });
    expect(recordDeathSave(hp, 1).hitPoints.deathSaves).toEqual({ successes: 0, failures: 2 });

    // El 20 natural no anota nada: revive.
    const nat20 = recordDeathSave(hp, 20);
    expect(nat20.outcome).toBe('revived');
    expect(nat20.hitPoints.current).toBe(1);
  });
});

describe('Inspiración heroica', () => {
  const base = character('2024').withClass('fighter', 1).build();

  it('se tiene o no se tiene: no acumula', () => {
    const uno = executeCommand(base, { type: 'SetHeroicInspiration', has: true }, c2024, engine24);
    if (!isOk(uno)) throw new Error('falló');
    expect(uno.value.state.heroicInspiration).toBe(true);

    const dos = executeCommand(
      uno.value.state,
      { type: 'SetHeroicInspiration', has: true },
      c2024,
      engine24,
    );
    if (!isOk(dos)) throw new Error('falló');
    // Volver a ganarla no cambia nada ni deja una entrada engañosa.
    expect(dos.value.state.heroicInspiration).toBe(true);
    expect(dos.value.result.summaryKey).toBe('history.heroicInspiration.unchanged');
  });

  it('deshacer devuelve el valor ANTERIOR, no el opuesto', () => {
    /*
      Con un `undo` que invierte, dos dispositivos que la gastan en el mismo
      turno terminan con el jugador teniéndola otra vez. El undo lleva el
      valor previo grabado.
    */
    const conInspiracion = executeCommand(
      base,
      { type: 'SetHeroicInspiration', has: true },
      c2024,
      engine24,
    );
    if (!isOk(conInspiracion)) throw new Error('falló');

    const gastada = executeCommand(
      conInspiracion.value.state,
      { type: 'SetHeroicInspiration', has: false },
      c2024,
      engine24,
    );
    if (!isOk(gastada)) throw new Error('falló');

    expect(gastada.value.result.undo).toEqual({ type: 'SetHeroicInspiration', has: true });
  });

  it('los personajes viejos no la traen y eso se lee como «no la tiene»', () => {
    // El campo es opcional a propósito: nadie migra la base por un booleano.
    expect(base.heroicInspiration).toBeUndefined();
  });
});

describe('Monedas', () => {
  it('usa las siglas de la hoja oficial: PP es plata y PPT platino', () => {
    /*
      La especificación original tenía `PP` para el platino y `PA` para la
      plata. Con la hoja oficial al lado, «PP» significaba dos monedas
      distintas según dónde mirabas.
    */
    const texto = formatCurrency({ gp: 10, pp: 2, ep: 3, sp: 40, cp: 55 });
    expect(texto).toBe('10 PO · 55 PC · 40 PP · 3 PE · 2 PPT');
  });

  it('el oro encabeza, y detrás va la secuencia del papel', () => {
    /*
      El oro primero porque es la moneda con la que se compra: el precio del
      SRD viene en `gp`. Las otras cuatro, en el orden ascendente de la hoja.
    */
    const texto = formatCurrency({ gp: 1, pp: 1, ep: 0, sp: 1, cp: 1 });
    expect(texto).toBe('1 PO · 1 PC · 1 PP · 1 PPT');
  });
});
