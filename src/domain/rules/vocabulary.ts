import { z } from 'zod';

/**
 * VOCABULARIO CERRADO DE REGLAS
 *
 * Las reglas son DATOS, no codigo. No hay interprete, no hay `eval`, no hay
 * funciones: el Homebrew y el contenido importado son datos de origen no
 * confiable, y un interprete convertiria la importacion en ejecucion remota
 * de codigo.
 *
 * Cuando 5e presente una excepcion que no encaje, SE AÑADE UN MIEMBRO A LA
 * UNION. Nunca se escribe la excepcion dentro de un componente. TypeScript
 * marca exhaustivamente todos los puntos a actualizar: el compilador se
 * convierte en la lista de tareas.
 */

export const abilityRef = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']);

/** Expresion de valor: constante, modificador de caracteristica, o nivel. */
export const valueExprSchema = z.union([
  z.object({ kind: z.literal('constant'), value: z.number() }),
  z.object({ kind: z.literal('abilityModifier'), ability: abilityRef }),
  z.object({ kind: z.literal('proficiencyBonus') }),
  z.object({ kind: z.literal('characterLevel'), divideBy: z.number().default(1) }),
  z.object({ kind: z.literal('classLevel'), classId: z.string(), divideBy: z.number().default(1) }),
  z.object({ kind: z.literal('half'), of: z.lazy((): z.ZodTypeAny => valueExprSchema) }),
]);
export type ValueExpr = z.infer<typeof valueExprSchema>;

// ── Disparadores ─────────────────────────────────────────────────────────────

export const triggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('always') }),
  z.object({ kind: z.literal('computeStat'), stat: z.string() }),
  z.object({ kind: z.literal('attackRoll'), weaponCategory: z.string().optional() }),
  z.object({ kind: z.literal('damageRoll') }),
  z.object({ kind: z.literal('savingThrow'), ability: abilityRef.optional() }),
  z.object({ kind: z.literal('abilityCheck'), skill: z.string().optional() }),
  z.object({ kind: z.literal('shortRest') }),
  z.object({ kind: z.literal('longRest') }),
  z.object({ kind: z.literal('castSpell') }),
  z.object({ kind: z.literal('equipItem') }),
  z.object({ kind: z.literal('initiative') }),
]);
export type Trigger = z.infer<typeof triggerSchema>;

// ── Condiciones ──────────────────────────────────────────────────────────────

const conditionBase = [
  z.object({ kind: z.literal('hasFeature'), featureId: z.string() }),
  z.object({ kind: z.literal('hasFeat'), featId: z.string() }),
  z.object({ kind: z.literal('hasProficiency'), target: z.string() }),
  z.object({ kind: z.literal('isWearingArmor'), category: z.enum(['none', 'light', 'medium', 'heavy', 'any']) }),
  z.object({ kind: z.literal('isUsingShield'), value: z.boolean().default(true) }),
  z.object({ kind: z.literal('wieldsWeaponWithProperty'), property: z.string() }),
  z.object({ kind: z.literal('hasCondition'), condition: z.string() }),
  z.object({ kind: z.literal('classLevelAtLeast'), classId: z.string(), level: z.number().int() }),
  z.object({ kind: z.literal('characterLevelAtLeast'), level: z.number().int() }),
  z.object({ kind: z.literal('abilityAtLeast'), ability: abilityRef, value: z.number().int() }),
  z.object({ kind: z.literal('resourceAvailable'), resourceKey: z.string(), amount: z.number().int().default(1) }),
] as const;

export type Condition =
  | { kind: 'hasFeature'; featureId: string }
  | { kind: 'hasFeat'; featId: string }
  | { kind: 'hasProficiency'; target: string }
  | { kind: 'isWearingArmor'; category: 'none' | 'light' | 'medium' | 'heavy' | 'any' }
  | { kind: 'isUsingShield'; value: boolean }
  | { kind: 'wieldsWeaponWithProperty'; property: string }
  | { kind: 'hasCondition'; condition: string }
  | { kind: 'classLevelAtLeast'; classId: string; level: number }
  | { kind: 'characterLevelAtLeast'; level: number }
  | { kind: 'abilityAtLeast'; ability: z.infer<typeof abilityRef>; value: number }
  | { kind: 'resourceAvailable'; resourceKey: string; amount: number }
  | { kind: 'not'; condition: Condition }
  | { kind: 'allOf'; conditions: Condition[] }
  | { kind: 'anyOf'; conditions: Condition[] };

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    ...conditionBase,
    z.object({ kind: z.literal('not'), condition: conditionSchema }),
    z.object({ kind: z.literal('allOf'), conditions: z.array(conditionSchema) }),
    z.object({ kind: z.literal('anyOf'), conditions: z.array(conditionSchema) }),
  ]),
) as z.ZodType<Condition>;

// ── Efectos ──────────────────────────────────────────────────────────────────

export const modifierOpSchema = z.enum(['base', 'add', 'set', 'min', 'max', 'multiply']);

export const rollTargetSchema = z.enum([
  'attack', 'damage', 'initiative', 'save', 'check',
  'save.str', 'save.dex', 'save.con', 'save.int', 'save.wis', 'save.cha',
  'check.stealth', 'check.perception', 'check.athletics',
]);

/**
 * Formula alternativa de CA. Es DATO, no un `if` en el motor:
 * asi la Defensa sin armadura del Barbaro y la del Monje son la misma regla
 * con distintos parametros, y el Homebrew puede definir la suya.
 */
export const acFormulaSchema = z.object({
  base: z.number().int(),
  abilities: z.array(abilityRef),
  allowShield: z.boolean().default(true),
  requiresNoArmor: z.boolean().default(true),
  requiresNoShield: z.boolean().default(false),
});
export type AcFormula = z.infer<typeof acFormulaSchema>;

export const effectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('modifyStat'), stat: z.string(), op: modifierOpSchema, amount: valueExprSchema }),
  z.object({ kind: z.literal('addProficiency'), target: z.string() }),
  z.object({ kind: z.literal('setProficiencyLevel'), target: z.string(), level: z.enum(['none', 'half', 'proficient', 'expertise']) }),
  z.object({ kind: z.literal('grantAdvantage'), on: rollTargetSchema }),
  z.object({ kind: z.literal('grantDisadvantage'), on: rollTargetSchema }),
  z.object({ kind: z.literal('addResource'), key: z.string(), label: z.string(), maximum: valueExprSchema, recovery: z.enum(['shortRest', 'longRest', 'dawn', 'manual', 'never']) }),
  z.object({ kind: z.literal('applyCondition'), condition: z.string() }),
  z.object({ kind: z.literal('setAcFormula'), formula: acFormulaSchema, label: z.string() }),
  z.object({ kind: z.literal('modifyAttackRoll'), op: modifierOpSchema, amount: valueExprSchema, weaponProperty: z.string().optional(), weaponRange: z.enum(['melee', 'ranged']).optional() }),
  z.object({ kind: z.literal('modifyDamageRoll'), op: modifierOpSchema, amount: valueExprSchema, weaponProperty: z.string().optional(), weaponRange: z.enum(['melee', 'ranged']).optional() }),
  z.object({ kind: z.literal('modifySpeed'), op: modifierOpSchema, amount: valueExprSchema }),
  z.object({ kind: z.literal('modifyMaxHp'), op: modifierOpSchema, amount: valueExprSchema, perLevel: z.boolean().default(false) }),
  z.object({ kind: z.literal('grantExtraAttack'), count: z.number().int().default(1) }),
  z.object({ kind: z.literal('addLanguage'), language: z.string() }),
  z.object({ kind: z.literal('addSense'), sense: z.string() }),
]);
export type Effect = z.infer<typeof effectSchema>;

// ── Regla completa ───────────────────────────────────────────────────────────

export const ruleDefinitionSchema = z.object({
  id: z.string(),
  rulesets: z.array(z.enum(['2014', '2024'])).min(1),
  /** Etiqueta legible: es la que aparece en la trazabilidad del valor. */
  label: z.string(),
  when: triggerSchema,
  if: z.array(conditionSchema).default([]),
  then: z.array(effectSchema).min(1),
  priority: z.number().int().default(0),
  sourceId: z.string().default('system'),
});
export type RuleDefinition = z.infer<typeof ruleDefinitionSchema>;

export type Stat =
  | 'ac' | 'initiative' | 'speed' | 'maxHp' | 'passivePerception'
  | `ability.${'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'}`
  | `save.${'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'}`
  | `skill.${string}`;
