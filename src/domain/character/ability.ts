/**
 * Caracteristicas y sus modificadores.
 *
 * CASO CRITICO 1 (MASTER PROMPT §59): FUE 16 debe dar +3.
 */

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type AbilityId = (typeof ABILITIES)[number];

/** Abreviaturas en espanol para la interfaz. Los IDs internos nunca se traducen. */
export const ABILITY_ABBR_ES: Record<AbilityId, string> = {
  str: 'FUE',
  dex: 'DES',
  con: 'CON',
  int: 'INT',
  wis: 'SAB',
  cha: 'CAR',
};

/** Nombres completos. Enumeracion cerrada del SRD: se traduce, no se inventa. */
export const ABILITY_NAME_ES: Record<AbilityId, string> = {
  str: 'Fuerza',
  dex: 'Destreza',
  con: 'Constitución',
  int: 'Inteligencia',
  wis: 'Sabiduría',
  cha: 'Carisma',
};

export const ABILITY_NAME_KEY: Record<AbilityId, string> = {
  str: 'ability.str',
  dex: 'ability.dex',
  con: 'ability.con',
  int: 'ability.int',
  wis: 'ability.wis',
  cha: 'ability.cha',
};

export const MIN_ABILITY_SCORE = 1;
export const MAX_ABILITY_SCORE = 30;
/** Tope normal por progresion de personaje; los objetos magicos pueden superarlo. */
export const DEFAULT_ABILITY_CAP = 20;

/**
 * modificador = floor((puntuacion - 10) / 2)
 *
 * `Math.floor` es correcto tambien para valores por debajo de 10:
 * puntuacion 7 → floor(-1.5) = -2. Usar trunc() daria -1, que esta mal.
 */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** "+3" / "-1" / "+0" — el signo siempre visible, como en la ficha de papel. */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function isValidAbilityScore(score: number): boolean {
  return Number.isInteger(score) && score >= MIN_ABILITY_SCORE && score <= MAX_ABILITY_SCORE;
}

export function clampAbilityScore(score: number): number {
  return Math.min(MAX_ABILITY_SCORE, Math.max(MIN_ABILITY_SCORE, Math.round(score)));
}

export type AbilityScores = Record<AbilityId, number>;

export const defaultAbilityScores = (): AbilityScores => ({
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
});

// ── Metodos de generacion (MASTER PROMPT §14) ────────────────────────────────

export type AbilityGenerationMethod = 'standardArray' | 'pointBuy' | 'roll' | 'manual';

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/** Coste acumulado en Point Buy. Indice = puntuacion. */
const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

export function pointBuyCost(score: number): number | null {
  return POINT_BUY_COST[score] ?? null;
}

export function pointBuyTotal(scores: AbilityScores): number {
  return ABILITIES.reduce((sum, a) => sum + (pointBuyCost(scores[a]) ?? 0), 0);
}

export function pointBuyRemaining(scores: AbilityScores): number {
  return POINT_BUY_BUDGET - pointBuyTotal(scores);
}

export function isValidPointBuy(scores: AbilityScores): boolean {
  const allInRange = ABILITIES.every(
    (a) => scores[a] >= POINT_BUY_MIN && scores[a] <= POINT_BUY_MAX && pointBuyCost(scores[a]) !== null,
  );
  return allInRange && pointBuyTotal(scores) <= POINT_BUY_BUDGET;
}
