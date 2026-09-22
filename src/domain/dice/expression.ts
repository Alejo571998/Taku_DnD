import { errCode, ok, type Result } from '../shared/result';

/**
 * PARSER DE EXPRESIONES DE DADOS
 *
 * Propio, sin dependencias: la gramatica es minima y una libreria no se
 * justifica (MASTER PROMPT §5).
 *
 * Gramatica soportada:
 *   2d6+3          cantidad, dado, modificador
 *   1d20           simple
 *   4d6kh3         quedarse con las 3 mas altas (generacion de caracteristicas)
 *   2d20kl1        quedarse con la mas baja
 *   1d8+1d6+2      varios terminos
 *   d20            cantidad implicita = 1
 *   2d6-1          modificador negativo
 *   d100 / d10%    percentil
 */

export const DIE_SIZES = [4, 6, 8, 10, 12, 20, 100] as const;
export type DieSize = (typeof DIE_SIZES)[number];

export type KeepRule = { readonly mode: 'kh' | 'kl'; readonly count: number };

export type DiceTerm = {
  readonly kind: 'dice';
  readonly count: number;
  readonly sides: number;
  readonly keep?: KeepRule;
  readonly sign: 1 | -1;
};

export type ConstantTerm = {
  readonly kind: 'constant';
  readonly value: number;
  readonly sign: 1 | -1;
};

export type Term = DiceTerm | ConstantTerm;

export type DiceExpression = {
  readonly terms: readonly Term[];
  readonly source: string;
};

const MAX_DICE = 100;
const MAX_SIDES = 1000;

/** `2d6+3` → terminos. Devuelve Result: una expresion invalida no es excepcional. */
export function parseDiceExpression(input: string): Result<DiceExpression> {
  const normalized = input
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/d10%|d%/g, 'd100');

  if (normalized.length === 0) {
    return errCode('dice.invalidExpression', { input }, 'expresion vacia');
  }

  // Trocea manteniendo el signo: "2d6+3-1d4" → ["+2d6", "+3", "-1d4"]
  const chunks = normalized.replace(/^\+/, '').match(/[+-]?[^+-]+/g);
  if (!chunks) return errCode('dice.invalidExpression', { input });

  const terms: Term[] = [];
  for (const raw of chunks) {
    const sign: 1 | -1 = raw.startsWith('-') ? -1 : 1;
    const body = raw.replace(/^[+-]/, '');
    if (body.length === 0) return errCode('dice.invalidExpression', { input });

    if (body.includes('d')) {
      const m = body.match(/^(\d*)d(\d+)(?:(kh|kl)(\d*))?$/);
      if (!m) return errCode('dice.invalidExpression', { input }, `termino no reconocido: ${body}`);

      const count = m[1] === '' || m[1] === undefined ? 1 : Number(m[1]);
      const sides = Number(m[2]);

      if (count < 1 || count > MAX_DICE) {
        return errCode('dice.invalidExpression', { input, count }, `cantidad fuera de rango: ${count}`);
      }
      if (sides < 2 || sides > MAX_SIDES) {
        return errCode('dice.invalidExpression', { input, sides }, `caras fuera de rango: ${sides}`);
      }

      const term: DiceTerm = m[3]
        ? {
            kind: 'dice',
            count,
            sides,
            sign,
            keep: { mode: m[3] as 'kh' | 'kl', count: m[4] === '' || m[4] === undefined ? 1 : Number(m[4]) },
          }
        : { kind: 'dice', count, sides, sign };

      if (term.keep && (term.keep.count < 1 || term.keep.count > count)) {
        return errCode('dice.invalidExpression', { input }, `keep fuera de rango: ${body}`);
      }
      terms.push(term);
    } else {
      const value = Number(body);
      if (!Number.isFinite(value)) {
        return errCode('dice.invalidExpression', { input }, `constante no numerica: ${body}`);
      }
      terms.push({ kind: 'constant', value, sign });
    }
  }

  return ok({ terms, source: input });
}

/** Reescribe la expresion en forma canonica: `2d6+3`. */
export function formatDiceExpression(expr: DiceExpression): string {
  return expr.terms
    .map((t, i) => {
      const sign = t.sign < 0 ? '-' : i === 0 ? '' : '+';
      if (t.kind === 'constant') return `${sign}${t.value}`;
      const keep = t.keep ? `${t.keep.mode}${t.keep.count}` : '';
      return `${sign}${t.count}d${t.sides}${keep}`;
    })
    .join('');
}

/** Rango posible [minimo, maximo]. Util para mostrar "2-12" junto a `2d6`. */
export function expressionRange(expr: DiceExpression): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const t of expr.terms) {
    if (t.kind === 'constant') {
      min += t.sign * t.value;
      max += t.sign * t.value;
      continue;
    }
    const n = t.keep ? t.keep.count : t.count;
    const lo = n * 1;
    const hi = n * t.sides;
    if (t.sign > 0) {
      min += lo;
      max += hi;
    } else {
      min -= hi;
      max -= lo;
    }
  }
  return { min, max };
}

/** Promedio esperado. Para ordenar armas por daño sin tirar. */
export function expressionAverage(expr: DiceExpression): number {
  let total = 0;
  for (const t of expr.terms) {
    if (t.kind === 'constant') {
      total += t.sign * t.value;
      continue;
    }
    const avgDie = (t.sides + 1) / 2;
    // Aproximacion suficiente para ordenar: keep-highest sesga hacia arriba.
    const n = t.keep ? t.keep.count : t.count;
    total += t.sign * n * avgDie;
  }
  return total;
}

/** Suma un modificador plano a una expresion ya parseada. */
export function withModifier(expr: DiceExpression, modifier: number): DiceExpression {
  if (modifier === 0) return expr;
  return {
    ...expr,
    terms: [...expr.terms, { kind: 'constant', value: Math.abs(modifier), sign: modifier < 0 ? -1 : 1 }],
  };
}
