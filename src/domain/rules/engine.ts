import type { AbilityId } from '../character/ability';
import type { Ruleset } from './ruleset';
import type { Condition, Effect, RuleDefinition, Trigger, ValueExpr } from './vocabulary';

/**
 * MOTOR DE REGLAS
 *
 * Evalua reglas declarativas contra un contexto de personaje y devuelve los
 * efectos que aplican. No calcula estadisticas: eso es responsabilidad del
 * motor de personaje, que consume estos efectos.
 *
 * Instanciado POR RULESET: jamas ve reglas de la otra edicion.
 */

/** Lo que una regla puede consultar. Deliberadamente minimo y de solo lectura. */
export type RuleContext = {
  readonly ruleset: Ruleset;
  readonly characterLevel: number;
  readonly proficiencyBonus: number;
  readonly classLevels: ReadonlyMap<string, number>;
  readonly abilityScores: Readonly<Record<AbilityId, number>>;
  readonly abilityModifiers: Readonly<Record<AbilityId, number>>;
  readonly featureIds: ReadonlySet<string>;
  readonly featIds: ReadonlySet<string>;
  readonly proficiencies: ReadonlySet<string>;
  readonly conditionIds: ReadonlySet<string>;
  readonly armorCategory: 'none' | 'light' | 'medium' | 'heavy';
  readonly usingShield: boolean;
  readonly wieldedWeaponProperties: ReadonlySet<string>;
  readonly resourcesAvailable: ReadonlyMap<string, number>;
};

export function evaluateCondition(condition: Condition, ctx: RuleContext): boolean {
  switch (condition.kind) {
    case 'hasFeature':
      return ctx.featureIds.has(condition.featureId);
    case 'hasFeat':
      return ctx.featIds.has(condition.featId);
    case 'hasProficiency':
      return ctx.proficiencies.has(condition.target);
    case 'isWearingArmor':
      return condition.category === 'any'
        ? ctx.armorCategory !== 'none'
        : ctx.armorCategory === condition.category;
    case 'isUsingShield':
      return ctx.usingShield === condition.value;
    case 'wieldsWeaponWithProperty':
      return ctx.wieldedWeaponProperties.has(condition.property);
    case 'hasCondition':
      return ctx.conditionIds.has(condition.condition);
    case 'classLevelAtLeast':
      return (ctx.classLevels.get(condition.classId) ?? 0) >= condition.level;
    case 'characterLevelAtLeast':
      return ctx.characterLevel >= condition.level;
    case 'abilityAtLeast':
      return ctx.abilityScores[condition.ability] >= condition.value;
    case 'resourceAvailable':
      return (ctx.resourcesAvailable.get(condition.resourceKey) ?? 0) >= condition.amount;
    case 'not':
      return !evaluateCondition(condition.condition, ctx);
    case 'allOf':
      return condition.conditions.every((c) => evaluateCondition(c, ctx));
    case 'anyOf':
      return condition.conditions.some((c) => evaluateCondition(c, ctx));
    default: {
      // Exhaustividad: si se añade un miembro a la union, TypeScript falla aqui.
      const _never: never = condition;
      void _never;
      return false;
    }
  }
}

export function evaluateValue(expr: ValueExpr, ctx: RuleContext): number {
  switch (expr.kind) {
    case 'constant':
      return expr.value;
    case 'abilityModifier':
      return ctx.abilityModifiers[expr.ability];
    case 'proficiencyBonus':
      return ctx.proficiencyBonus;
    case 'characterLevel':
      return Math.floor(ctx.characterLevel / (expr.divideBy || 1));
    case 'classLevel':
      return Math.floor((ctx.classLevels.get(expr.classId) ?? 0) / (expr.divideBy || 1));
    case 'half':
      return Math.floor(evaluateValue(expr.of as ValueExpr, ctx) / 2);
    default:
      return 0;
  }
}

const triggerMatches = (trigger: Trigger, target: Trigger['kind'], stat?: string): boolean => {
  if (trigger.kind !== target) return false;
  if (trigger.kind === 'computeStat' && stat != null) return trigger.stat === stat;
  return true;
};

export type AppliedEffect = {
  readonly effect: Effect;
  readonly rule: RuleDefinition;
};

/**
 * Reglas activas para un disparador. Ordenadas por prioridad: una regla de
 * prioridad alta se resuelve despues y puede acotar a las anteriores.
 */
export function collectEffects(
  rules: readonly RuleDefinition[],
  ctx: RuleContext,
  trigger: Trigger['kind'],
  stat?: string,
): readonly AppliedEffect[] {
  const applied: AppliedEffect[] = [];
  for (const rule of rules) {
    if (!rule.rulesets.includes(ctx.ruleset)) continue;
    if (!triggerMatches(rule.when, trigger, stat)) continue;
    if (!rule.if.every((c) => evaluateCondition(c, ctx))) continue;
    for (const effect of rule.then) applied.push({ effect, rule });
  }
  return applied.sort((a, b) => a.rule.priority - b.rule.priority);
}

/** Todas las reglas que aplican ahora mismo, sea cual sea el disparador. */
export function activeRules(rules: readonly RuleDefinition[], ctx: RuleContext): readonly RuleDefinition[] {
  return rules.filter(
    (r) => r.rulesets.includes(ctx.ruleset) && r.if.every((c) => evaluateCondition(c, ctx)),
  );
}

/**
 * Motor instanciado para un ruleset. La UI nunca ve reglas de otra edicion.
 */
export class RulesEngine {
  private readonly rules: readonly RuleDefinition[];

  constructor(allRules: readonly RuleDefinition[], readonly ruleset: Ruleset) {
    this.rules = allRules.filter((r) => r.rulesets.includes(ruleset));
  }

  get size(): number {
    return this.rules.length;
  }

  effectsFor(ctx: RuleContext, trigger: Trigger['kind'], stat?: string): readonly AppliedEffect[] {
    return collectEffects(this.rules, ctx, trigger, stat);
  }

  active(ctx: RuleContext): readonly RuleDefinition[] {
    return activeRules(this.rules, ctx);
  }

  /** Amplia el motor con reglas de Homebrew ya validadas. */
  withAdditional(extra: readonly RuleDefinition[]): RulesEngine {
    return new RulesEngine([...this.rules, ...extra], this.ruleset);
  }
}
