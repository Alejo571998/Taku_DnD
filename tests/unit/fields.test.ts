import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadContent } from '../fixtures/content';
import {
  LANGUAGE_CLAUSE_ES,
  LANGUAGE_ES,
  languagesEs,
  saveAbilityEs,
  spellFieldEs,
} from '@domain/content/fields';
import { CREATURE_TYPE_ES, chargeRecoveryEs, coinEs, creatureTypeEs } from '@domain/content/labels';
import type { MonsterDefinition, SpellDefinition } from '@domain/content/schemas';

/**
 * LOS CAMPOS ESTRUCTURADOS DEL CONJURO (deuda T18)
 *
 * Lo que se prueba es el MECANISMO, no el estado: que arme la cadena por
 * piezas en vez de buscarla entera, y que cuando no sabe, lo diga en ingles
 * en vez de inventar. Que hoy el SRD este cubierto al 100% es consecuencia,
 * y se comprueba aparte.
 */

const conjuros = (ruleset: '2014' | '2024') =>
  loadContent(ruleset).all('spell') as unknown as SpellDefinition[];

describe('Traduccion por piezas', () => {
  it('respeta el numero y traduce solo la unidad', () => {
    expect(spellFieldEs('150 feet')).toBe('150 pies');
    expect(spellFieldEs('10 minutes')).toBe('10 minutos');
  });

  it('arma valores que el SRD todavia no escribio', () => {
    // Ninguno de estos tres existe en el contenido: si salieran en ingles,
    // seria que hay una lista de valores enteros y no un compositor.
    expect(spellFieldEs('45 feet')).toBe('45 pies');
    expect(spellFieldEs('up to 3 minutes')).toBe('Hasta 3 minutos');
    expect(spellFieldEs('17 rounds')).toBe('17 asaltos');
  });

  it('concuerda el singular con el plural', () => {
    expect(spellFieldEs('1 foot')).toBe('1 pie');
    expect(spellFieldEs('5 feet')).toBe('5 pies');
    expect(spellFieldEs('1 mile')).toBe('1 milla');
    expect(spellFieldEs('500 miles')).toBe('500 millas');
  });

  it('el prefijo se compone con lo que sigue', () => {
    expect(spellFieldEs('Up to 1 hour')).toBe('Hasta 1 hora');
    expect(spellFieldEs('Concentration up to 10 minutes')).toBe('Concentración, hasta 10 minutos');
  });
});

describe('Lo que no sabe traducir', () => {
  it('se devuelve en ingles, no se inventa', () => {
    expect(spellFieldEs('7 fortnights')).toBe('7 fortnights');
    expect(spellFieldEs('Whenever the moon is full')).toBe('Whenever the moon is full');
  });

  it('deja pasar lo que ya viene en espanol del Homebrew', () => {
    // El editor guarda «1 acción» e «Instantáneo» tal cual: si el compositor
    // los tocara, el conjuro propio del usuario cambiaria solo.
    expect(spellFieldEs('1 acción')).toBe('1 acción');
    expect(spellFieldEs('Instantáneo')).toBe('Instantáneo');
  });

  it('un campo vacio no imprime nada', () => {
    expect(spellFieldEs(undefined)).toBe('');
    expect(spellFieldEs('   ')).toBe('');
  });
});

describe('Cobertura sobre el SRD', () => {
  it('no deja ningun tiempo, alcance ni duracion en ingles', () => {
    /*
      Aqui si vale mirar si la salida cambio: el contrato de `spellFieldEs` es
      devolver la entrada TAL CUAL cuando no sabe, asi que «igual a la entrada»
      es exactamente la señal de que no supo. Y si algun dia hubiera un valor
      que se escribe igual en los dos idiomas, estaria bien en castellano de
      todos modos.
    */
    const enIngles: string[] = [];
    for (const ruleset of ['2014', '2024'] as const) {
      for (const s of conjuros(ruleset)) {
        for (const valor of [s.castingTime, s.range, s.duration]) {
          if (valor && spellFieldEs(valor) === valor && /[a-z]/i.test(valor)) enIngles.push(valor);
        }
      }
    }
    expect([...new Set(enIngles)]).toEqual([]);
  });

  it('la salvacion dice la caracteristica, no la sigla inglesa', () => {
    expect(saveAbilityEs('dex')).toBe('Destreza');
    expect(saveAbilityEs('wis')).toBe('Sabiduría');

    // Solo 5.1: el volcado de 5.2 no trae el campo `dc` en ningun conjuro.
    const conSalvacion = conjuros('2014').filter((s) => s.save);
    expect(conSalvacion.length).toBeGreaterThan(0);
    for (const s of conSalvacion) expect(saveAbilityEs(s.save!.ability)).not.toBe(s.save!.ability.toUpperCase());
  });
});

// ── El resto de los campos estructurados ─────────────────────────────────────

const monstruos = (ruleset: '2014' | '2024') =>
  loadContent(ruleset).all('monster') as unknown as MonsterDefinition[];

describe('Idiomas', () => {
  it('traduce cada trozo del campo por separado', () => {
    expect(languagesEs('Common, Draconic')).toBe('Común, Dracónico');
    expect(languagesEs('Infernal, telepathy 120 ft.')).toBe('Infernal, telepatía 120 pies');
  });

  it('no parte una clausula que lleva comas dentro', () => {
    // Partir a ciegas por comas daba «entiende el común, Élfico, y silvano».
    expect(languagesEs("Giant Elk, understands Common, Elvish, and Sylvan but can't speak")).toBe(
      'Alce gigante, entiende el común, el élfico y el silvano, pero no puede hablar',
    );
  });

  it('la telepatia se arma con el numero que traiga', () => {
    // Si esto saliera en ingles, seria una lista de valores enteros.
    expect(languagesEs('telepathy 45 ft.')).toBe('telepatía 45 pies');
  });

  it('no deja ningun trozo fuera del diccionario', () => {
    /*
      No vale comprobar que la salida cambie: «Celestial» y «Primordial» se
      escriben igual en los dos idiomas, y un test asi los daria por
      traducidos aunque nadie los hubiera mirado. Se comprueba la PERTENENCIA.
    */
    const conocido = (trozo: string) => {
      const clave = trozo.toLowerCase();
      return (
        clave in LANGUAGE_ES ||
        clave in LANGUAGE_CLAUSE_ES ||
        /^telepathy\s+\d+\s*ft/i.test(trozo)
      );
    };

    const desconocidos = new Set<string>();
    for (const ruleset of ['2014', '2024'] as const) {
      for (const m of monstruos(ruleset)) {
        if (!m.languages) continue;
        for (const pieza of m.languages.split(/,\s*/)) {
          const trozo = pieza.trim();
          if (trozo.length > 0 && !conocido(trozo)) desconocidos.add(trozo);
        }
      }
    }
    expect([...desconocidos]).toEqual([]);
  });

  it('dice el mismo nombre de idioma que la biblioteca', () => {
    /*
      El diccionario de idiomas del monstruo es una copia: vive en el codigo
      porque el bloque de estadisticas no pasa por la traduccion por id. Si un
      dia alguien retoca el nombre en `es-419.json` y no aca, el buscador
      dejaria de encontrar por uno lo que muestra el otro.
    */
    const overlay = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/content/translations/es-419.json'), 'utf8'),
    ) as { names: Record<string, string> };

    const discrepancias: string[] = [];
    for (const [clave, nombre] of Object.entries(overlay.names)) {
      if (!clave.startsWith('language:')) continue;
      const enIngles = clave.slice('language:'.length).replace(/-/g, ' ');
      const nuestro = languagesEs(enIngles);
      if (nuestro !== enIngles && nuestro !== nombre) discrepancias.push(`${enIngles}: ${nuestro} ≠ ${nombre}`);
    }
    expect(discrepancias).toEqual([]);
  });
});

describe('Enumeraciones cerradas que faltaban', () => {
  it('el precio usa las siglas de la hoja oficial, no gp', () => {
    expect(coinEs('gp')).toBe('PO');
    // `PP` es plata y `PPT` platino, como en la hoja oficial de 2024.
    expect(coinEs('sp')).toBe('PP');
    expect(coinEs('pp')).toBe('PPT');
  });

  it('el tipo de criatura y la recarga estan en espanol', () => {
    expect(creatureTypeEs('humanoid')).toBe('humanoide');
    expect(chargeRecoveryEs('dawn')).toBe('amanecer');
  });

  it('no queda ningun tipo de criatura fuera del diccionario', () => {
    const enIngles = new Set<string>();
    for (const ruleset of ['2014', '2024'] as const) {
      for (const m of monstruos(ruleset)) {
        // Igual que con los idiomas: «elemental» y «celestial» son la misma
        // palabra en los dos idiomas, asi que se mira el diccionario.
        if (m.creatureType && !(m.creatureType.toLowerCase() in CREATURE_TYPE_ES)) enIngles.add(m.creatureType);
      }
    }
    expect([...enIngles]).toEqual([]);
  });
});
