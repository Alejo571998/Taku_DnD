import { z } from 'zod';

/**
 * ESQUEMAS DE CONTENIDO
 *
 * Las definiciones son DATOS validados, nunca codigo. Todo contenido —SRD,
 * propio, Homebrew o importado— atraviesa estos esquemas antes de entrar al
 * sistema. Es la unica puerta.
 *
 * Los tipos de TypeScript se INFIEREN de aqui: un unico sitio que mantener.
 */

export const rulesetSchema = z.enum(['2014', '2024']);

export const definitionIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)+$/, 'Formato esperado: fuente:tipo:slug');

export const abilityIdSchema = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']);

export const damageTypeSchema = z.enum([
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
]);

export const licenseSchema = z.enum(['CC-BY-4.0', 'OGL-1.0a', 'ORC', 'proprietary', 'custom']);

export const contentTypeSchema = z.enum([
  'class', 'subclass', 'species', 'subspecies', 'background', 'feat',
  'spell', 'weapon', 'armor', 'gear', 'magicItem', 'condition',
  'skill', 'language', 'trait', 'feature', 'monster', 'rule',
]);

/** Procedencia: obligatoria en TODA definicion, incluido el Homebrew. */
export const contentSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  license: licenseSchema,
  /** Texto de atribucion que DEBE mostrarse en la aplicacion, no solo en el repo. */
  attribution: z.string().optional(),
  url: z.string().optional(),
  author: z.string().optional(),
});

/**
 * Las definiciones referencian su fuente por `sourceId`; el objeto completo
 * vive una sola vez en el manifiesto del pack. Repetir el texto de atribucion
 * en cada definicion multiplicaba el peso del contenido, y eso se paga en
 * cada carga offline.
 */
const baseDefinition = {
  id: definitionIdSchema,
  name: z.string().min(1),
  rulesets: z.array(rulesetSchema).min(1),
  sourceId: z.string(),
  version: z.string().default('1.0.0'),
  language: z.string().default('en'),
  description: z.array(z.string()).default([]),
};

// ── Conjuros ─────────────────────────────────────────────────────────────────

export const spellSchema = z.object({
  ...baseDefinition,
  type: z.literal('spell'),
  level: z.number().int().min(0).max(9),
  school: z.string(),
  castingTime: z.string(),
  range: z.string(),
  components: z.array(z.enum(['V', 'S', 'M'])),
  material: z.string().optional(),
  duration: z.string(),
  concentration: z.boolean(),
  ritual: z.boolean(),
  higherLevel: z.array(z.string()).default([]),
  classes: z.array(z.string()).default([]),
  damage: z
    .object({
      damageType: z.string().optional(),
      /** Dado por nivel de espacio: { "3": "8d6", "4": "9d6" } */
      atSlotLevel: z.record(z.string(), z.string()).optional(),
      /** Dado por nivel de personaje (trucos): { "1": "1d10", "5": "2d10" } */
      atCharacterLevel: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  save: z
    .object({
      ability: abilityIdSchema,
      onSuccess: z.enum(['none', 'half', 'other']).default('none'),
    })
    .optional(),
  attackType: z.enum(['melee', 'ranged']).optional(),
  areaOfEffect: z.object({ type: z.string(), size: z.number() }).optional(),
  healAtSlotLevel: z.record(z.string(), z.string()).optional(),
});

// ── Objetos ──────────────────────────────────────────────────────────────────

export const costSchema = z.object({
  quantity: z.number().min(0),
  unit: z.enum(['cp', 'sp', 'ep', 'gp', 'pp']),
});

export const weaponPropertySchema = z.enum([
  'ammunition', 'finesse', 'heavy', 'light', 'loading', 'range', 'reach',
  'special', 'thrown', 'two-handed', 'versatile', 'monk',
]);

export const weaponSchema = z.object({
  ...baseDefinition,
  type: z.literal('weapon'),
  category: z.enum(['simple', 'martial']),
  rangeType: z.enum(['melee', 'ranged']),
  damage: z.object({ dice: z.string(), damageType: z.string() }).optional(),
  twoHandedDamage: z.object({ dice: z.string(), damageType: z.string() }).optional(),
  properties: z.array(z.string()).default([]),
  range: z.object({ normal: z.number(), long: z.number().optional() }).optional(),
  throwRange: z.object({ normal: z.number(), long: z.number().optional() }).optional(),
  /** Centesimas de libra. */
  weight: z.number().int().min(0).default(0),
  cost: costSchema.optional(),
  /** Vinculo arma -> municion (MASTER SPEC §16). */
  ammunitionType: definitionIdSchema.optional(),
  mastery: z.string().optional(),
});

export const armorSchema = z.object({
  ...baseDefinition,
  type: z.literal('armor'),
  category: z.enum(['light', 'medium', 'heavy', 'shield']),
  baseAc: z.number().int(),
  addsDexBonus: z.boolean(),
  maxDexBonus: z.number().int().nullable().default(null),
  strMinimum: z.number().int().default(0),
  stealthDisadvantage: z.boolean().default(false),
  weight: z.number().int().min(0).default(0),
  cost: costSchema.optional(),
});

export const gearSchema = z.object({
  ...baseDefinition,
  type: z.literal('gear'),
  category: z.string(),
  /** Peso POR UNIDAD en centesimas de libra. */
  weight: z.number().int().min(0).default(0),
  /** Precio del paquete tal como aparece en el libro. */
  cost: costSchema.optional(),
  /** Unidades por paquete: el SRD vende las flechas de a 20. */
  packSize: z.number().int().min(1).default(1),
  /** Consumible: se gasta al usarse (MASTER SPEC §17). */
  consumable: z.boolean().default(false),
  /** Es municion: participa del consumo automatico. */
  ammunition: z.boolean().default(false),
});

export const magicItemSchema = z.object({
  ...baseDefinition,
  type: z.literal('magicItem'),
  rarity: z.enum(['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact', 'varies']),
  requiresAttunement: z.boolean().default(false),
  attunementRequirement: z.string().optional(),
  category: z.string().default('Wondrous Items'),
  charges: z.object({ maximum: z.number().int(), recovery: z.string() }).optional(),
  weight: z.number().int().min(0).default(0),
});

// ── Personaje ────────────────────────────────────────────────────────────────

export const spellSlotTableSchema = z.record(
  z.string(),
  z.object({
    cantripsKnown: z.number().int().optional(),
    spellsKnown: z.number().int().optional(),
    slots: z.array(z.number().int()).length(9),
  }),
);

export const classSchema = z.object({
  ...baseDefinition,
  type: z.literal('class'),
  hitDie: z.number().int(),
  savingThrows: z.array(abilityIdSchema),
  armorProficiencies: z.array(z.string()).default([]),
  weaponProficiencies: z.array(z.string()).default([]),
  toolProficiencies: z.array(z.string()).default([]),
  skillChoices: z.object({ choose: z.number().int(), from: z.array(z.string()) }).optional(),
  startingEquipment: z
    .array(z.object({ definitionId: definitionIdSchema, quantity: z.number().int() }))
    .default([]),
  startingEquipmentOptions: z
    .array(
      z.object({
        choose: z.number().int(),
        label: z.string(),
        options: z.array(
          z.object({
            label: z.string(),
            items: z.array(z.object({ definitionId: definitionIdSchema, quantity: z.number().int() })),
          }),
        ),
      }),
    )
    .default([]),
  spellcasting: z
    .object({
      ability: abilityIdSchema,
      startsAtLevel: z.number().int(),
      preparesSpells: z.boolean(),
      ritualCasting: z.boolean().default(false),
    })
    .optional(),
  /** Progresion por nivel: bonif. competencia, rasgos, espacios, recursos. */
  progression: z.record(
    z.string(),
    z.object({
      profBonus: z.number().int(),
      features: z.array(definitionIdSchema).default([]),
      abilityScoreImprovement: z.boolean().default(false),
      spellcasting: z
        .object({
          cantripsKnown: z.number().int().optional(),
          spellsKnown: z.number().int().optional(),
          slots: z.array(z.number().int()),
        })
        .optional(),
      /** Recursos especificos: { "action_surges": 1, "rages": 3 } */
      resources: z.record(z.string(), z.number()).default({}),
    }),
  ),
  subclassLevel: z.number().int().default(3),
  subclasses: z.array(definitionIdSchema).default([]),
  multiclassing: z
    .object({
      prerequisites: z.array(z.object({ ability: abilityIdSchema, minimum: z.number().int() })).default([]),
      proficiencies: z.array(z.string()).default([]),
    })
    .optional(),
});

export const subclassSchema = z.object({
  ...baseDefinition,
  type: z.literal('subclass'),
  classId: definitionIdSchema,
  flavor: z.string().default(''),
  progression: z
    .record(z.string(), z.object({ features: z.array(definitionIdSchema).default([]) }))
    .default({}),
  spellcasting: z
    .object({ ability: abilityIdSchema, preparesSpells: z.boolean(), startsAtLevel: z.number().int() })
    .optional(),
});

export const speciesSchema = z.object({
  ...baseDefinition,
  type: z.literal('species'),
  speed: z.number().int(),
  size: z.enum(['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']),
  sizeDescription: z.string().default(''),
  /** 2014: la especie da bonificadores. 2024: los da el trasfondo. */
  abilityBonuses: z.array(z.object({ ability: abilityIdSchema, bonus: z.number().int() })).default([]),
  languages: z.array(z.string()).default([]),
  traits: z.array(definitionIdSchema).default([]),
  subspecies: z.array(definitionIdSchema).default([]),
  age: z.string().default(''),
  alignment: z.string().default(''),
});

export const subspeciesSchema = z.object({
  ...baseDefinition,
  type: z.literal('subspecies'),
  speciesId: definitionIdSchema,
  abilityBonuses: z.array(z.object({ ability: abilityIdSchema, bonus: z.number().int() })).default([]),
  traits: z.array(definitionIdSchema).default([]),
});

export const backgroundSchema = z.object({
  ...baseDefinition,
  type: z.literal('background'),
  skillProficiencies: z.array(z.string()).default([]),
  toolProficiencies: z.array(z.string()).default([]),
  languageOptions: z.number().int().default(0),
  abilityBonuses: z.array(z.object({ ability: abilityIdSchema, bonus: z.number().int() })).default([]),
  feat: definitionIdSchema.optional(),
  startingEquipment: z
    .array(z.object({ definitionId: definitionIdSchema, quantity: z.number().int() }))
    .default([]),
  startingGold: z.number().int().default(0),
  feature: z.object({ name: z.string(), description: z.array(z.string()) }).optional(),
  personalityTraits: z.array(z.string()).default([]),
  ideals: z.array(z.string()).default([]),
  bonds: z.array(z.string()).default([]),
  flaws: z.array(z.string()).default([]),
});

export const featSchema = z.object({
  ...baseDefinition,
  type: z.literal('feat'),
  prerequisites: z.array(z.string()).default([]),
  category: z.string().default('general'),
  abilityBonuses: z.array(z.object({ ability: abilityIdSchema, bonus: z.number().int() })).default([]),
});

export const featureSchema = z.object({
  ...baseDefinition,
  type: z.literal('feature'),
  classId: definitionIdSchema.optional(),
  subclassId: definitionIdSchema.optional(),
  level: z.number().int().default(1),
});

export const traitSchema = z.object({
  ...baseDefinition,
  type: z.literal('trait'),
  speciesIds: z.array(definitionIdSchema).default([]),
});

export const conditionSchema = z.object({
  ...baseDefinition,
  type: z.literal('condition'),
});

export const skillDefSchema = z.object({
  ...baseDefinition,
  type: z.literal('skill'),
  ability: abilityIdSchema,
});

export const languageDefSchema = z.object({
  ...baseDefinition,
  type: z.literal('language'),
  category: z.string().default('Standard'),
  script: z.string().default(''),
});

export const ruleDocSchema = z.object({
  ...baseDefinition,
  type: z.literal('rule'),
  category: z.string().default('general'),
});

export const monsterSchema = z.object({
  ...baseDefinition,
  type: z.literal('monster'),
  size: z.string(),
  creatureType: z.string(),
  alignment: z.string(),
  armorClass: z.number().int(),
  hitPoints: z.number().int(),
  hitDice: z.string(),
  speed: z.record(z.string(), z.string()),
  abilities: z.object({
    str: z.number().int(), dex: z.number().int(), con: z.number().int(),
    int: z.number().int(), wis: z.number().int(), cha: z.number().int(),
  }),
  challengeRating: z.number(),
  xp: z.number().int(),
  proficiencyBonus: z.number().int().default(2),
  senses: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  languages: z.string().default(''),
  damageVulnerabilities: z.array(z.string()).default([]),
  damageResistances: z.array(z.string()).default([]),
  damageImmunities: z.array(z.string()).default([]),
  conditionImmunities: z.array(z.string()).default([]),
  specialAbilities: z.array(z.object({ name: z.string(), desc: z.string() })).default([]),
  actions: z.array(z.object({ name: z.string(), desc: z.string() })).default([]),
  legendaryActions: z.array(z.object({ name: z.string(), desc: z.string() })).default([]),
});

// ── Union de todas las definiciones ──────────────────────────────────────────

export const definitionSchema = z.discriminatedUnion('type', [
  spellSchema, weaponSchema, armorSchema, gearSchema, magicItemSchema,
  classSchema, subclassSchema, speciesSchema, subspeciesSchema,
  backgroundSchema, featSchema, featureSchema, traitSchema,
  conditionSchema, skillDefSchema, languageDefSchema, ruleDocSchema, monsterSchema,
]);

export const contentPackSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  version: z.string(),
  ruleset: rulesetSchema,
  language: z.string(),
  source: contentSourceSchema,
  /** Fuentes referenciables por `sourceId` desde las definiciones del pack. */
  sources: z.record(z.string(), contentSourceSchema).default({}),
  /** Packs incorporados no se pueden borrar; los importados si. */
  builtIn: z.boolean().default(false),
  counts: z.record(z.string(), z.number()).default({}),
});

// ── Tipos inferidos ──────────────────────────────────────────────────────────

export type Ruleset = z.infer<typeof rulesetSchema>;
export type ContentType = z.infer<typeof contentTypeSchema>;
export type ContentSource = z.infer<typeof contentSourceSchema>;
export type Cost = z.infer<typeof costSchema>;
export type SpellDefinition = z.infer<typeof spellSchema>;
export type WeaponDefinition = z.infer<typeof weaponSchema>;
export type ArmorDefinition = z.infer<typeof armorSchema>;
export type GearDefinition = z.infer<typeof gearSchema>;
export type MagicItemDefinition = z.infer<typeof magicItemSchema>;
export type ClassDefinition = z.infer<typeof classSchema>;
export type SubclassDefinition = z.infer<typeof subclassSchema>;
export type SpeciesDefinition = z.infer<typeof speciesSchema>;
export type SubspeciesDefinition = z.infer<typeof subspeciesSchema>;
export type BackgroundDefinition = z.infer<typeof backgroundSchema>;
export type FeatDefinition = z.infer<typeof featSchema>;
export type FeatureDefinition = z.infer<typeof featureSchema>;
export type TraitDefinition = z.infer<typeof traitSchema>;
export type ConditionDefinition = z.infer<typeof conditionSchema>;
export type SkillDefinition = z.infer<typeof skillDefSchema>;
export type LanguageDefinition = z.infer<typeof languageDefSchema>;
export type RuleDocDefinition = z.infer<typeof ruleDocSchema>;
export type MonsterDefinition = z.infer<typeof monsterSchema>;
export type AnyDefinition = z.infer<typeof definitionSchema>;
export type ContentPack = z.infer<typeof contentPackSchema>;

/** Cualquier objeto equipable o transportable. */
export type ItemDefinition =
  | WeaponDefinition
  | ArmorDefinition
  | GearDefinition
  | MagicItemDefinition;

export const isItemDefinition = (d: AnyDefinition): d is ItemDefinition =>
  d.type === 'weapon' || d.type === 'armor' || d.type === 'gear' || d.type === 'magicItem';
