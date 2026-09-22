import { errCode, ok, type Result } from '../shared/result';
import type { ResourceInstanceId } from '../shared/ids';
import type { ResourceState } from '../character/state';

/**
 * RECURSOS GENERICOS (MASTER SPEC §22)
 *
 * `current / maximum` sirve para furias, ki, puntos de hechiceria, cargas de
 * objetos magicos y cualquier recurso de Homebrew. Un solo modelo.
 *
 * Gastar y recuperar son DELTAS con suelo y techo: conmutativos, sin conflicto
 * al sincronizar.
 */

export type Resources = readonly ResourceState[];

export const findResource = (rs: Resources, key: string): ResourceState | undefined =>
  rs.find((r) => r.key === key);

export function spendResource(rs: Resources, key: string, amount = 1): Result<Resources> {
  const resource = findResource(rs, key);
  if (!resource) return errCode('resource.notFound', { key });

  if (resource.current < amount) {
    return errCode('resource.insufficient', {
      resource: resource.label,
      have: resource.current,
      need: amount,
    });
  }

  return ok(rs.map((r) => (r.key === key ? { ...r, current: r.current - amount } : r)));
}

/** Recuperar nunca supera el maximo. */
export function restoreResource(rs: Resources, key: string, amount = 1): Resources {
  return rs.map((r) => (r.key === key ? { ...r, current: Math.min(r.maximum, r.current + amount) } : r));
}

export function setResource(rs: Resources, id: ResourceInstanceId, current: number): Resources {
  return rs.map((r) => (r.id === id ? { ...r, current: Math.max(0, Math.min(r.maximum, current)) } : r));
}

// ── Descansos ────────────────────────────────────────────────────────────────

export type RestKind = 'short' | 'long';

export type RestOutcome = {
  readonly resources: Resources;
  readonly recovered: readonly { readonly label: string; readonly amount: number }[];
};

/**
 * Descanso corto: recupera lo marcado como `shortRest`.
 * Los dados de golpe y los espacios de pacto los gestiona quien llama,
 * porque dependen del personaje completo.
 */
export function applyRest(rs: Resources, kind: RestKind): RestOutcome {
  const recovered: { label: string; amount: number }[] = [];

  const resources = rs.map((r) => {
    const recovers =
      kind === 'long'
        ? r.recovery === 'longRest' || r.recovery === 'shortRest' || r.recovery === 'dawn'
        : r.recovery === 'shortRest';

    if (!recovers || r.current >= r.maximum) return r;

    recovered.push({ label: r.label, amount: r.maximum - r.current });
    return { ...r, current: r.maximum };
  });

  return { resources, recovered };
}

/**
 * Dados de golpe recuperados tras un descanso largo: la mitad del total,
 * minimo 1 (regla del SRD).
 */
export const hitDiceRecoveredOnLongRest = (totalLevel: number): number =>
  Math.max(1, Math.floor(totalLevel / 2));
