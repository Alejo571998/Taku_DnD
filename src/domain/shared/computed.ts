import type { DefinitionId, RuleId } from './ids';

/**
 * TRAZABILIDAD DE VALORES DERIVADOS (MASTER SPEC §27)
 *
 * Todo valor calculado transporta su procedencia. Es requisito de dominio y,
 * a la vez, la funcion de producto que hace la aplicacion explicable:
 *
 *   CA 17 · Cota de malla 16 · Escudo +2 · Anillo +1 · Destreza +0 (pesada)
 *
 * La UI no calcula nada: lee `contributions` y las pinta.
 */

export type SourceKind =
  | 'base'
  | 'ability'
  | 'species'
  | 'class'
  | 'subclass'
  | 'background'
  | 'feat'
  | 'item'
  | 'condition'
  | 'spell'
  | 'proficiency'
  | 'manual'
  | 'rule';

export type SourceRef = {
  readonly kind: SourceKind;
  /** Nombre ya legible para la interfaz. */
  readonly label: string;
  readonly definitionId?: DefinitionId;
};

export type ModifierOp = 'base' | 'add' | 'set' | 'min' | 'max' | 'multiply';

export type Contribution = {
  readonly op: ModifierOp;
  readonly amount: number;
  readonly source: SourceRef;
  readonly ruleId?: RuleId;
  /** Si es false, la contribucion se registra pero no se aplica (no cumple condicion). */
  readonly active?: boolean;
};

export type Computed<T = number> = {
  readonly value: T;
  readonly contributions: readonly Contribution[];
};

export const source = (kind: SourceKind, label: string, definitionId?: DefinitionId): SourceRef => ({
  kind,
  label,
  ...(definitionId ? { definitionId } : {}),
});

export const contribution = (
  op: ModifierOp,
  amount: number,
  src: SourceRef,
  ruleId?: RuleId,
): Contribution => ({ op, amount, source: src, ...(ruleId ? { ruleId } : {}) });

/**
 * Resolucion de modificadores.
 *
 * Orden:
 *   1. base      — el valor de partida (el mayor gana si hay varios)
 *   2. set       — sobrescribe la base (p. ej. CA = 13 + DES de Defensa sin armadura)
 *   3. add       — se suman todos
 *   4. multiply  — se aplica despues de las sumas
 *   5. min/max   — topes finales (p. ej. DES maxima +2 en armadura media)
 *
 * `min` = suelo, `max` = techo. Se aplican al final porque en 5e los topes
 * acotan el resultado, no los sumandos.
 */
export function resolve(contributions: readonly Contribution[], fallbackBase = 0): Computed<number> {
  const active = contributions.filter((c) => c.active !== false);

  const bases = active.filter((c) => c.op === 'base');
  const sets = active.filter((c) => c.op === 'set');
  const adds = active.filter((c) => c.op === 'add');
  const mults = active.filter((c) => c.op === 'multiply');
  const mins = active.filter((c) => c.op === 'min');
  const maxes = active.filter((c) => c.op === 'max');

  let value = bases.length > 0 ? Math.max(...bases.map((c) => c.amount)) : fallbackBase;

  // El `set` de mayor valor gana. En 5e las formulas alternativas de CA no se
  // acumulan: el personaje elige la mejor.
  if (sets.length > 0) {
    value = Math.max(...sets.map((c) => c.amount));
  }

  for (const c of adds) value += c.amount;
  for (const c of mults) value = Math.floor(value * c.amount);

  for (const c of maxes) value = Math.min(value, c.amount);
  for (const c of mins) value = Math.max(value, c.amount);

  return { value, contributions };
}

export const computedOf = (value: number, contributions: readonly Contribution[] = []): Computed<number> => ({
  value,
  contributions,
});

/** Solo las contribuciones que realmente movieron la aguja. Para la UI. */
export function significantContributions(c: Computed<number>): readonly Contribution[] {
  return c.contributions.filter((x) => x.active !== false && (x.amount !== 0 || x.op === 'set' || x.op === 'base'));
}

// ── Canal de ventaja / desventaja ────────────────────────────────────────────

/**
 * VENTAJA Y DESVENTAJA NO SON NUMEROS.
 *
 * En 5e se anulan entre si y no se acumulan: tener tres fuentes de ventaja y
 * una de desventaja da una tirada NORMAL. Modelarlas como +5/-5 es el error
 * clasico que este canal evita.
 */
export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export type AdvantageChannel = {
  readonly advantage: readonly SourceRef[];
  readonly disadvantage: readonly SourceRef[];
};

export const emptyAdvantage = (): AdvantageChannel => ({ advantage: [], disadvantage: [] });

export function withAdvantage(ch: AdvantageChannel, src: SourceRef): AdvantageChannel {
  return { advantage: [...ch.advantage, src], disadvantage: ch.disadvantage };
}

export function withDisadvantage(ch: AdvantageChannel, src: SourceRef): AdvantageChannel {
  return { advantage: ch.advantage, disadvantage: [...ch.disadvantage, src] };
}

export function mergeAdvantage(a: AdvantageChannel, b: AdvantageChannel): AdvantageChannel {
  return {
    advantage: [...a.advantage, ...b.advantage],
    disadvantage: [...a.disadvantage, ...b.disadvantage],
  };
}

/** Regla de 5e: cualquier cantidad de ventaja + cualquier cantidad de desventaja = normal. */
export function resolveRollMode(ch: AdvantageChannel): RollMode {
  const hasAdv = ch.advantage.length > 0;
  const hasDis = ch.disadvantage.length > 0;
  if (hasAdv && hasDis) return 'normal';
  if (hasAdv) return 'advantage';
  if (hasDis) return 'disadvantage';
  return 'normal';
}
