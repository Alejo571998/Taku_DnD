/**
 * ETIQUETAS EN ESPAÑOL DE LOS CONJUNTOS CERRADOS DEL SRD
 *
 * Los tipos de daño, las escuelas de magia, las rarezas y las propiedades de
 * arma son ENUMERACIONES, no prosa: se pueden traducir de una vez y valen para
 * todo el contenido, incluido el Homebrew.
 *
 * La prosa del SRD —descripciones de conjuros, rasgos, monstruos— es otra
 * cosa: son obras derivadas bajo CC-BY y viven en `ContentTranslation`
 * (ver `src/i18n/config.ts`).
 */

export const DAMAGE_TYPE_ES: Record<string, string> = {
  acid: 'ácido',
  bludgeoning: 'contundente',
  cold: 'frío',
  fire: 'fuego',
  force: 'fuerza',
  lightning: 'relámpago',
  necrotic: 'necrótico',
  piercing: 'perforante',
  poison: 'veneno',
  psychic: 'psíquico',
  radiant: 'radiante',
  slashing: 'cortante',
  thunder: 'trueno',
};

export const MAGIC_SCHOOL_ES: Record<string, string> = {
  Abjuration: 'Abjuración',
  Conjuration: 'Conjuración',
  Divination: 'Adivinación',
  Enchantment: 'Encantamiento',
  Evocation: 'Evocación',
  Illusion: 'Ilusión',
  Necromancy: 'Nigromancia',
  Transmutation: 'Transmutación',
};

export const RARITY_ES: Record<string, string> = {
  common: 'común',
  uncommon: 'poco común',
  rare: 'raro',
  'very rare': 'muy raro',
  legendary: 'legendario',
  artifact: 'artefacto',
  varies: 'variable',
};

export const SIZE_ES: Record<string, string> = {
  Tiny: 'Diminuto',
  Small: 'Pequeño',
  Medium: 'Mediano',
  Large: 'Grande',
  Huge: 'Enorme',
  Gargantuan: 'Gargantuesco',
};

export const WEAPON_PROPERTY_ES: Record<string, string> = {
  ammunition: 'munición',
  finesse: 'sutil',
  heavy: 'pesada',
  light: 'ligera',
  loading: 'recarga',
  range: 'distancia',
  reach: 'alcance',
  special: 'especial',
  thrown: 'arrojadiza',
  'two-handed': 'a dos manos',
  versatile: 'versátil',
  monk: 'de monje',
};

export const ARMOR_CATEGORY_ES: Record<string, string> = {
  light: 'ligera',
  medium: 'media',
  heavy: 'pesada',
  shield: 'escudo',
};

export const WEAPON_CATEGORY_ES: Record<string, string> = {
  simple: 'simple',
  martial: 'marcial',
};

/**
 * El tipo de criatura del bloque de estadisticas. La ficha mostraba
 * «Mediano humanoid».
 */
export const CREATURE_TYPE_ES: Record<string, string> = {
  aberration: 'aberración',
  beast: 'bestia',
  celestial: 'celestial',
  construct: 'constructo',
  dragon: 'dragón',
  elemental: 'elemental',
  fey: 'feérico',
  fiend: 'infernal',
  giant: 'gigante',
  humanoid: 'humanoide',
  monstrosity: 'monstruosidad',
  ooze: 'cieno',
  plant: 'planta',
  undead: 'muerto viviente',
  'swarm of tiny beasts': 'enjambre de bestias Diminutas',
};

/**
 * Las siglas de moneda, las de la hoja oficial de 2024: `PP` es PLATA y `PPT`
 * platino. Ver `currency.ts`, que explica por que se cambiaron.
 */
export const COIN_ES: Record<string, string> = {
  cp: 'PC',
  sp: 'PP',
  ep: 'PE',
  gp: 'PO',
  pp: 'PPT',
};

/**
 * LAS COMPETENCIAS CON EQUIPO
 *
 * El bloque «Entrenamiento y competencias» de la ficha mostraba los
 * identificadores crudos: «all-armor», «simple-weapons», «shields».
 *
 * Esta lista NO es cerrada, y por eso se resuelve con `lookup`: el editor de
 * Homebrew guarda estas competencias como texto libre (ver `schemas.ts`, son
 * `z.array(z.string())`), asi que una clase propia puede traer cualquier
 * palabra y tiene que salir tal como la escribio su autor.
 *
 * Los nueve primeros son TODOS los que aparecen en los dos volcados del SRD.
 * `heavy-armor` no sale en ninguno —el guerrero recibe `all-armor`— pero es el
 * hermano que falta de una enumeracion que la propia aplicacion acepta.
 */
export const PROFICIENCY_ES: Record<string, string> = {
  'all-armor': 'Todas las armaduras',
  'light-armor': 'Armadura ligera',
  'medium-armor': 'Armadura media',
  'heavy-armor': 'Armadura pesada',
  shields: 'Escudos',
  'simple-weapons': 'Armas simples',
  'martial-weapons': 'Armas marciales',
  // El volcado escribe las herramientas de ladron de las dos maneras.
  'thieves-tools': 'Herramientas de ladrón',
  'tool-thieves-tools': 'Herramientas de ladrón',
  'herbalism-kit': 'Equipo de herboristería',
};

/** Cuando un objeto magico recupera cargas. */
export const CHARGE_RECOVERY_ES: Record<string, string> = {
  dawn: 'amanecer',
  dusk: 'anochecer',
  midnight: 'medianoche',
};

export const WEAPON_MASTERY_ES: Record<string, string> = {
  cleave: 'Hendidura',
  graze: 'Roce',
  nick: 'Tajo',
  push: 'Empuje',
  sap: 'Debilitar',
  slow: 'Ralentizar',
  topple: 'Derribo',
  vex: 'Hostigar',
};

/** Traduce si conocemos el término; si no, devuelve el original tal cual. */
const lookup = (dict: Record<string, string>) => (value: string | undefined): string => {
  if (!value) return '';
  return dict[value] ?? dict[value.toLowerCase()] ?? value;
};

export const damageTypeEs = lookup(DAMAGE_TYPE_ES);
export const magicSchoolEs = lookup(MAGIC_SCHOOL_ES);
export const rarityEs = lookup(RARITY_ES);
export const sizeEs = lookup(SIZE_ES);
export const weaponPropertyEs = lookup(WEAPON_PROPERTY_ES);
export const armorCategoryEs = lookup(ARMOR_CATEGORY_ES);
export const weaponCategoryEs = lookup(WEAPON_CATEGORY_ES);
export const weaponMasteryEs = lookup(WEAPON_MASTERY_ES);
export const creatureTypeEs = lookup(CREATURE_TYPE_ES);
export const coinEs = lookup(COIN_ES);
export const chargeRecoveryEs = lookup(CHARGE_RECOVERY_ES);
export const proficiencyEs = lookup(PROFICIENCY_ES);

/**
 * Listas ordenadas de las enumeraciones cerradas.
 *
 * El editor de Homebrew las usa para los desplegables: escribir "fuego" a mano
 * produciria contenido que el motor no sabe interpretar.
 */
export const DAMAGE_TYPES: readonly string[] = Object.keys(DAMAGE_TYPE_ES);
export const MAGIC_SCHOOLS: readonly string[] = Object.keys(MAGIC_SCHOOL_ES);
