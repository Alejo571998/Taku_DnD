import { isErr, ok, type Result } from '../shared/result';
import { parseDiceExpression, type DiceExpression, type DiceTerm, type Term } from './expression';
import type { RollMode } from '../shared/computed';

/**
 * TIRADA DE DADOS
 *
 * RNG criptografico por defecto: `Math.random()` no es aceptable
 * en una aplicacion cuyo producto SON las tiradas. La semilla inyectable
 * existe unicamente para que los tests sean deterministas.
 */

export type Rng = () => number;

/** [0, 1) con `crypto.getRandomValues`. */
export const cryptoRng: Rng = () => {
  const buf = new Uint32Array(1);
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } };
  if (!g.crypto?.getRandomValues) {
    throw new Error('No hay fuente de aleatoriedad criptografica disponible.');
  }
  g.crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 0x1_0000_0000;
};

/** RNG determinista (xorshift128) — SOLO para tests. */
export function seededRng(seed: number): Rng {
  let a = seed || 1;
  let b = 362436069;
  let c = 521288629;
  let d = 88675123;
  return () => {
    const t = a ^ (a << 11);
    a = b; b = c; c = d;
    d = (d ^ (d >>> 19)) ^ (t ^ (t >>> 8));
    return (d >>> 0) / 0x1_0000_0000;
  };
}

export const rollDie = (sides: number, rng: Rng = cryptoRng): number => Math.floor(rng() * sides) + 1;

export type DieRoll = {
  readonly sides: number;
  readonly value: number;
  /** Descartado por una regla keep-highest/keep-lowest. */
  readonly dropped: boolean;
};

export type TermResult = {
  readonly term: Term;
  readonly rolls: readonly DieRoll[];
  readonly subtotal: number;
};

export type RollResult = {
  readonly expression: string;
  readonly total: number;
  readonly terms: readonly TermResult[];
  readonly mode: RollMode;
  /** En ventaja/desventaja: ambas tiradas del d20, en orden. */
  readonly d20Pair?: readonly [number, number];
  readonly critical: 'hit' | 'miss' | null;
  readonly rolledAt: string;
};

function rollDiceTerm(term: DiceTerm, rng: Rng): TermResult {
  const raw: number[] = [];
  for (let i = 0; i < term.count; i++) raw.push(rollDie(term.sides, rng));

  let keptIdx: Set<number>;
  if (term.keep) {
    const order = raw
      .map((v, i) => ({ v, i }))
      .sort((x, y) => (term.keep!.mode === 'kh' ? y.v - x.v : x.v - y.v));
    keptIdx = new Set(order.slice(0, term.keep.count).map((o) => o.i));
  } else {
    keptIdx = new Set(raw.map((_, i) => i));
  }

  const rolls: DieRoll[] = raw.map((value, i) => ({
    sides: term.sides,
    value,
    dropped: !keptIdx.has(i),
  }));

  const sum = rolls.filter((r) => !r.dropped).reduce((a, r) => a + r.value, 0);
  return { term, rolls, subtotal: term.sign * sum };
}

function rollTerms(expr: DiceExpression, rng: Rng): { terms: TermResult[]; total: number } {
  const terms: TermResult[] = [];
  let total = 0;
  for (const t of expr.terms) {
    if (t.kind === 'constant') {
      const subtotal = t.sign * t.value;
      terms.push({ term: t, rolls: [], subtotal });
      total += subtotal;
    } else {
      const r = rollDiceTerm(t, rng);
      terms.push(r);
      total += r.subtotal;
    }
  }
  return { terms, total };
}

export type RollOptions = {
  readonly mode?: RollMode;
  readonly rng?: Rng;
  /** Detecta 20/1 natural. Solo tiene sentido en tiradas de ataque. */
  readonly detectCritical?: boolean;
};

/** Tira una expresion ya parseada. */
export function rollExpression(expr: DiceExpression, options: RollOptions = {}): RollResult {
  const rng = options.rng ?? cryptoRng;
  const mode = options.mode ?? 'normal';
  const rolledAt = new Date().toISOString();

  const firstD20 = expr.terms.find((t) => t.kind === 'dice' && t.sides === 20 && t.count === 1);

  // Ventaja/desventaja: se tira dos veces la expresion completa y se elige.
  // Solo aplica si hay exactamente un d20 en juego, como en las reglas.
  if (mode !== 'normal' && firstD20) {
    const a = rollTerms(expr, rng);
    const b = rollTerms(expr, rng);
    const d20A = a.terms.find((t) => t.term.kind === 'dice' && t.term.sides === 20)?.rolls[0]?.value ?? 0;
    const d20B = b.terms.find((t) => t.term.kind === 'dice' && t.term.sides === 20)?.rolls[0]?.value ?? 0;

    const takeFirst = mode === 'advantage' ? a.total >= b.total : a.total <= b.total;
    const chosen = takeFirst ? a : b;
    const chosenD20 = takeFirst ? d20A : d20B;

    return {
      expression: expr.source,
      total: chosen.total,
      terms: chosen.terms,
      mode,
      d20Pair: [d20A, d20B],
      critical: options.detectCritical ? criticalOf(chosenD20) : null,
      rolledAt,
    };
  }

  const { terms, total } = rollTerms(expr, rng);
  const natural = terms.find((t) => t.term.kind === 'dice' && t.term.sides === 20)?.rolls[0]?.value;

  return {
    expression: expr.source,
    total,
    terms,
    mode: 'normal',
    critical: options.detectCritical && natural != null ? criticalOf(natural) : null,
    rolledAt,
  };
}

const criticalOf = (natural: number): 'hit' | 'miss' | null =>
  natural === 20 ? 'hit' : natural === 1 ? 'miss' : null;

/** Parsea y tira en un paso. */
export function roll(expression: string, options: RollOptions = {}): Result<RollResult> {
  const parsed = parseDiceExpression(expression);
  if (isErr(parsed)) return parsed;
  return ok(rollExpression(parsed.value, options));
}

/**
 * Daño critico de 5e: se duplican los DADOS, no los modificadores.
 * Un error clasico es duplicar el total.
 */
export function criticalDamage(expr: DiceExpression): DiceExpression {
  const terms: Term[] = [];
  for (const t of expr.terms) {
    terms.push(t);
    if (t.kind === 'dice') terms.push(t);
  }
  return { ...expr, terms, source: `${expr.source} (critico)` };
}
