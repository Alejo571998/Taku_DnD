/**
 * LOS CAMPOS ESTRUCTURADOS DEL SRD
 *
 * Aquí viven los campos que no son ni prosa ni enumeración pura: los del
 * conjuro y los del bloque de estadísticas del monstruo. Las enumeraciones
 * cerradas —escuelas, rarezas, tipos de criatura— están en `labels.ts`.
 *
 * `castingTime`, `range` y `duration` no son prosa, y por eso no viven en la
 * traducción por id: son plantillas. Entre las dos ediciones dan 66 cadenas
 * distintas —«1 action», «150 feet», «up to 1 minute»— hechas de apenas una
 * docena de piezas. La ficha las mostraba en inglés aunque el conjuro entero
 * estuviera traducido, que era lo más visible que quedaba sin pasar.
 *
 * Se traducen POR PIEZAS, no por valor entero. Un diccionario de valores
 * completos habría que tocarlo la primera vez que el SRD escriba «45 feet», y
 * hasta entonces la ficha diría «45 feet» en medio del castellano.
 *
 * Las ocho condiciones largas —las de Contrahechizo, Escudo, Castigo divino—
 * sí son prosa y van enteras. Lo que no encaja en ninguna de las dos formas se
 * devuelve en inglés: preferimos que el hueco se vea a inventar una
 * traducción que nadie revisó.
 */

import { ABILITY_NAME_ES, type AbilityId } from '@domain/character/ability';

/** Unidades contables: singular y plural, porque «1 pie» no es «1 pies». */
const PIEZA_ES: Record<string, readonly [string, string]> = {
  action: ['acción', 'acciones'],
  'bonus action': ['acción adicional', 'acciones adicionales'],
  reaction: ['reacción', 'reacciones'],
  round: ['asalto', 'asaltos'],
  minute: ['minuto', 'minutos'],
  hour: ['hora', 'horas'],
  day: ['día', 'días'],
  week: ['semana', 'semanas'],
  month: ['mes', 'meses'],
  year: ['año', 'años'],
  foot: ['pie', 'pies'],
  mile: ['milla', 'millas'],
};

/** Plurales que no terminan en «-s». */
const IRREGULAR: Record<string, string> = { feet: 'foot' };

/** Valores que son una pieza sola, sin número delante. */
const SUELTA_ES: Record<string, string> = {
  action: 'Acción',
  'bonus action': 'Acción adicional',
  reaction: 'Reacción',
  self: 'Personal',
  touch: 'Toque',
  sight: 'A la vista',
  special: 'Especial',
  unlimited: 'Ilimitado',
  instantaneous: 'Instantáneo',
  'until dispelled': 'Hasta que se disipe',
  'until dispelled or triggered': 'Hasta que se disipe o se active',
};

/**
 * Las condiciones que el SRD 5.2 escribe como una frase entera. Son nueve
 * conjuros y una docena de palabras cada uno: se traducen a mano, como la
 * prosa, y se buscan por el valor exacto.
 */
const CONDICION_ES: Record<string, string> = {
  'action (overgrowth) or 8 hours (enrichment)':
    'Acción (Sobrecrecimiento) u 8 horas (Enriquecimiento)',
  'bonus action, which you take immediately after hitting a creature with a weapon':
    'Acción adicional, que realizás inmediatamente después de impactar a una criatura con un arma',
  'bonus action, which you take immediately after hitting a creature with a melee weapon or an unarmed strike':
    'Acción adicional, que realizás inmediatamente después de impactar a una criatura con un arma cuerpo a cuerpo o un Golpe sin Armas',
  'bonus action, which you take immediately after hitting a target with a melee weapon or an unarmed strike':
    'Acción adicional, que realizás inmediatamente después de impactar a un objetivo con un arma cuerpo a cuerpo o un Golpe sin Armas',
  'reaction, which you take when you are hit by an attack roll or targeted by the magic missile spell':
    'Reacción, que realizás cuando te impacta una tirada de ataque o cuando sos objetivo del conjuro Proyectil mágico',
  'reaction, which you take when you or a creature you can see within 60 feet of you falls':
    'Reacción, que realizás cuando vos, o una criatura que puedas ver a 60 pies o menos de vos, se cae',
  'reaction, which you take when you see a creature within 60 feet of yourself casting a spell with verbal, somatic, or material components':
    'Reacción, que realizás cuando ves a una criatura a 60 pies o menos de vos lanzar un conjuro con componentes Verbales, Somáticos o Materiales',
  'reaction, which you take in response to taking damage from a creature that you can see within 60 feet of yourself':
    'Reacción, que realizás en respuesta a recibir daño de una criatura que puedas ver a 60 pies o menos de vos',
};

const CANTIDAD = /^(\d+)\s+(.+)$/;
const HASTA = /^up to\s+(.+)$/i;
const CONCENTRACION = /^concentration,?\s*up to\s+(.+)$/i;

const singular = (unidad: string): string =>
  IRREGULAR[unidad] ?? (PIEZA_ES[unidad] ? unidad : unidad.replace(/s$/, ''));

/** «10 minutes» -> «10 minutos». Devuelve null si la unidad no está en la tabla. */
function cantidad(valor: string): string | null {
  const partes = valor.match(CANTIDAD);
  if (!partes) return null;
  const [, numero = '', unidad = ''] = partes;
  const pieza = PIEZA_ES[singular(unidad.toLowerCase())];
  if (!pieza) return null;
  return `${numero} ${Number(numero) === 1 ? pieza[0] : pieza[1]}`;
}

function traducir(valor: string): string | null {
  const concentracion = valor.match(CONCENTRACION);
  if (concentracion) {
    const resto = traducir(concentracion[1] ?? '');
    return resto === null ? null : `Concentración, hasta ${resto}`;
  }

  const hasta = valor.match(HASTA);
  if (hasta) {
    const resto = traducir(hasta[1] ?? '');
    return resto === null ? null : `Hasta ${resto}`;
  }

  const clave = valor.toLowerCase();
  return SUELTA_ES[clave] ?? CONDICION_ES[clave] ?? cantidad(valor);
}

/**
 * Traduce un tiempo de lanzamiento, un alcance o una duración del SRD.
 * Lo que no sabe traducir lo devuelve tal cual, en inglés.
 */
export function spellFieldEs(valor: string | undefined): string {
  if (!valor) return '';
  const limpio = valor.trim();
  if (limpio.length === 0) return '';
  return traducir(limpio) ?? limpio;
}

/** «dex» -> «Destreza». La ficha decía «DEX». */
export const saveAbilityEs = (ability: AbilityId): string => ABILITY_NAME_ES[ability];

// ── Idiomas ──────────────────────────────────────────────────────────────────

/**
 * El bloque del monstruo y la ficha de la especie nombran los idiomas en un
 * campo suelto, sin pasar por la traducción por id, así que los nombres están
 * dos veces: aquí y en `es-419.json`. Tienen que decir lo mismo —si el dragón
 * dice «Draconic» y la ficha del idioma dice «Dracónico», el que busque por
 * uno no encuentra el otro—, y hay un test que compara las dos listas.
 */
export const LANGUAGE_ES: Record<string, string> = {
  abyssal: 'Abisal',
  aquan: 'Acuano',
  auran: 'Aurano',
  celestial: 'Celestial',
  common: 'Común',
  'deep speech': 'Habla profunda',
  draconic: 'Dracónico',
  druidic: 'Druídico',
  dwarvish: 'Enano',
  elvish: 'Élfico',
  giant: 'Gigante',
  gnomish: 'Gnomo',
  goblin: 'Goblin',
  halfling: 'Mediano',
  ignan: 'Ignano',
  infernal: 'Infernal',
  orc: 'Orco',
  primordial: 'Primordial',
  sylvan: 'Silvano',
  terran: 'Terrano',
  undercommon: 'Infracomún',
  // Idiomas propios de una criatura: el SRD los nombra por ella.
  'blink dog': 'Perro parpadeante',
  'giant eagle': 'Águila gigante',
  'giant elk': 'Alce gigante',
  'giant owl': 'Búho gigante',
  gnoll: 'Gnoll',
  otyugh: 'Otyugh',
  sahuagin: 'Sahuagin',
  sphinx: 'Esfinge',
  'winter wolf': 'Lobo invernal',
  worg: 'Worg',
};

/**
 * Las cláusulas que el SRD escribe en prosa dentro del mismo campo. Son 41 y
 * no se componen de nada: se traducen enteras.
 */
export const LANGUAGE_CLAUSE_ES: Record<string, string> = {
  all: 'todos',
  "and infernal but can't speak": 'e infernal, pero no puede hablar',
  "and primordial but can't speak": 'y primordial, pero no puede hablar',
  "and sylvan but can't speak": 'y silvano, pero no puede hablar',
  'any four languages': 'cuatro idiomas cualesquiera',
  'any languages it knew in life': 'los idiomas que supiera en vida',
  'any one language': 'un idioma cualquiera',
  'any one language (usually common)': 'un idioma cualquiera (normalmente común)',
  'any six languages': 'seis idiomas cualesquiera',
  'any two languages': 'dos idiomas cualesquiera',
  "common (can't speak in boar form)": 'común (no puede hablar en forma de jabalí)',
  'common plus up to five other languages': 'común y hasta cinco idiomas más',
  'druidic plus any two languages': 'druídico y dos idiomas cualesquiera',
  'one language known by its creator': 'un idioma que conozca su creador',
  'the languages it knew in life': 'los idiomas que supiera en vida',
  "thieves' cant plus any two languages": 'jerga de ladrones y dos idiomas cualesquiera',
  'understands abyssal': 'entiende el abisal',
  "understands abyssal but can't speak": 'entiende el abisal, pero no puede hablar',
  "understands all languages it knew in life but can't speak":
    'entiende todos los idiomas que supiera en vida, pero no puede hablar',
  "understands all languages it spoke in life but can't speak":
    'entiende todos los idiomas que hablara en vida, pero no puede hablar',
  'understands celestial': 'entiende el celestial',
  "understands commands given in any language but can't speak":
    'entiende las órdenes dadas en cualquier idioma, pero no puede hablar',
  'understands common': 'entiende el común',
  "understands abyssal, celestial, infernal, and primordial but can't speak":
    'entiende el abisal, el celestial, el infernal y el primordial, pero no puede hablar',
  "understands abyssal, common, and infernal but can't speak":
    'entiende el abisal, el común y el infernal, pero no puede hablar',
  "understands celestial, common, elvish, and sylvan but can't speak":
    'entiende el celestial, el común, el élfico y el silvano, pero no puede hablar',
  "understands common, elvish, and sylvan but can't speak":
    'entiende el común, el élfico y el silvano, pero no puede hablar',
  "understands common and auran but can't speak": 'entiende el común y el aurano, pero no puede hablar',
  "understands common and draconic but can't speak": 'entiende el común y el dracónico, pero no puede hablar',
  "understands common and giant but can't speak": 'entiende el común y el gigante, pero no puede hablar',
  "understands common but can't speak": 'entiende el común, pero no puede hablar',
  "understands common but doesn't speak it": 'entiende el común, pero no lo habla',
  "understands deep speech but can't speak": 'entiende el habla profunda, pero no puede hablar',
  "understands draconic but can't speak": 'entiende el dracónico, pero no puede hablar',
  "understands infernal but can't speak": 'entiende el infernal, pero no puede hablar',
  "understands infernal but can't speak it": 'entiende el infernal, pero no lo habla',
  "understands sylvan but can't speak it": 'entiende el silvano, pero no lo habla',
  "understands the languages of its creator but can't speak":
    'entiende los idiomas de su creador, pero no puede hablar',
};

const TELEPATIA = /^telepathy\s+(\d+)\s*ft\.?(.*)$/i;
const SOLO_CON = /^\s*\(works only with creatures that understand (.+)\)\s*$/i;

function idioma(pieza: string): string {
  const clave = pieza.toLowerCase();
  const nombre = LANGUAGE_ES[clave] ?? LANGUAGE_CLAUSE_ES[clave];
  if (nombre) return nombre;

  const tele = pieza.match(TELEPATIA);
  if (tele) {
    const alcance = `telepatía ${tele[1]} pies`;
    const solo = (tele[2] ?? '').match(SOLO_CON);
    return solo ? `${alcance} (solo con criaturas que entiendan ${idioma(solo[1] ?? '')})` : alcance;
  }

  return pieza;
}

/**
 * «Common, Draconic, telepathy 120 ft.» -> «Común, Dracónico, telepatía 120
 * pies». El SRD mete en un solo campo nombres propios y frases sueltas.
 *
 * Se parte por comas, pero probando primero el trozo MÁS LARGO: hay cláusulas
 * que llevan comas dentro —«understands Common, Elvish, and Sylvan but can't
 * speak»— y partirlas a ciegas daba «entiende el común, Élfico, y silvano».
 */
export function languagesEs(valor: string | undefined): string {
  if (!valor) return '';
  const limpio = valor.trim();
  if (limpio.length === 0) return '';

  const piezas = limpio.split(/,\s*/).map((p) => p.trim());
  const salida: string[] = [];
  for (let i = 0; i < piezas.length; ) {
    let largo = piezas.length - i;
    for (; largo > 1; largo--) {
      const junto = piezas.slice(i, i + largo).join(', ');
      const clausula = LANGUAGE_CLAUSE_ES[junto.toLowerCase()];
      if (clausula) {
        salida.push(clausula);
        break;
      }
    }
    if (largo === 1) salida.push(idioma(piezas[i] ?? ''));
    i += largo;
  }
  return salida.join(', ');
}
