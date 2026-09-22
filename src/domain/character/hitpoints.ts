import type { HitPointsState } from './state';

/**
 * PUNTOS DE GOLPE
 *
 * Las mutaciones se modelan como DELTAS, no como asignaciones.
 * Guardar "HP = 23" genera conflicto entre dispositivos; guardar "HP −7" no.
 * Es la decision que hace viable el offline multi-dispositivo sin CRDTs.
 */

export type DamageResult = {
  readonly hitPoints: HitPointsState;
  /** Cuanto absorbieron los PG temporales. */
  readonly absorbedByTemp: number;
  readonly appliedToCurrent: number;
  readonly wentDown: boolean;
  /** Daño >= maximo con el personaje a 0: muerte instantanea (SRD). */
  readonly instantDeath: boolean;
};

/**
 * Daño. Los PG temporales se consumen PRIMERO y no bajan de cero
 * antes de tocar los PG reales.
 */
export function applyDamage(hp: HitPointsState, amount: number, maxHp: number): DamageResult {
  const damage = Math.max(0, Math.round(amount));

  const absorbedByTemp = Math.min(hp.temporary, damage);
  const remaining = damage - absorbedByTemp;
  const newTemp = hp.temporary - absorbedByTemp;
  const newCurrent = Math.max(0, hp.current - remaining);

  const wentDown = hp.current > 0 && newCurrent === 0;
  // Muerte instantanea: el daño sobrante iguala o supera el maximo.
  const overkill = remaining - hp.current;
  const instantDeath = newCurrent === 0 && overkill >= maxHp;

  return {
    hitPoints: {
      ...hp,
      current: newCurrent,
      temporary: newTemp,
      // Recibir daño a 0 PG suma un fallo de salvacion contra muerte.
      deathSaves:
        hp.current === 0 && damage > 0
          ? { ...hp.deathSaves, failures: Math.min(3, hp.deathSaves.failures + 1) }
          : hp.deathSaves,
    },
    absorbedByTemp,
    appliedToCurrent: hp.current - newCurrent,
    wentDown,
    instantDeath,
  };
}

export type HealResult = {
  readonly hitPoints: HitPointsState;
  readonly healed: number;
  /** Curacion desperdiciada por llegar al maximo. */
  readonly wasted: number;
  readonly revived: boolean;
};

/** Curacion. Nunca supera el maximo y, al revivir, limpia salvaciones de muerte. */
export function applyHealing(hp: HitPointsState, amount: number, maxHp: number): HealResult {
  const healing = Math.max(0, Math.round(amount));
  const newCurrent = Math.min(maxHp, hp.current + healing);
  const healed = newCurrent - hp.current;
  const revived = hp.current === 0 && newCurrent > 0;

  return {
    hitPoints: {
      ...hp,
      current: newCurrent,
      deathSaves: revived ? { successes: 0, failures: 0 } : hp.deathSaves,
    },
    healed,
    wasted: healing - healed,
    revived,
  };
}

/**
 * PG temporales: NO se acumulan. El personaje elige quedarse con la mejor
 * fuente (regla de 5e). Sumarlos es un error clasico.
 */
export function applyTemporaryHitPoints(
  hp: HitPointsState,
  amount: number,
): { hitPoints: HitPointsState; replaced: boolean; kept: number } {
  const offered = Math.max(0, Math.round(amount));
  const takesNew = offered > hp.temporary;
  return {
    hitPoints: { ...hp, temporary: takesNew ? offered : hp.temporary },
    replaced: takesNew,
    kept: takesNew ? offered : hp.temporary,
  };
}

/** Ajuste directo del valor actual. Para correcciones manuales del jugador. */
export function setCurrentHitPoints(hp: HitPointsState, value: number, maxHp: number): HitPointsState {
  return { ...hp, current: Math.max(0, Math.min(maxHp, Math.round(value))) };
}

export type DeathSaveOutcome = 'stable' | 'dead' | 'pending' | 'revived';

/** Salvacion contra muerte. Un 20 natural revive con 1 PG; un 1 cuenta doble. */
export function recordDeathSave(
  hp: HitPointsState,
  roll: number,
): { hitPoints: HitPointsState; outcome: DeathSaveOutcome } {
  if (roll === 20) {
    return {
      hitPoints: { ...hp, current: 1, deathSaves: { successes: 0, failures: 0 } },
      outcome: 'revived',
    };
  }

  const isSuccess = roll >= 10;
  const increment = roll === 1 ? 2 : 1;

  const successes = Math.min(3, hp.deathSaves.successes + (isSuccess ? 1 : 0));
  const failures = Math.min(3, hp.deathSaves.failures + (isSuccess ? 0 : increment));

  if (successes >= 3) {
    return { hitPoints: { ...hp, deathSaves: { successes: 0, failures: 0 } }, outcome: 'stable' };
  }
  if (failures >= 3) {
    return { hitPoints: { ...hp, deathSaves: { successes, failures } }, outcome: 'dead' };
  }
  return { hitPoints: { ...hp, deathSaves: { successes, failures } }, outcome: 'pending' };
}
