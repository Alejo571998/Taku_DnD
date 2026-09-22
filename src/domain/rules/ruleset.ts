/**
 * RULESET (MASTER SPEC §4, §57 — "NO MEZCLAR REGLAS")
 *
 * El motor se instancia PARA UN RULESET y jamas ve reglas de la otra edicion.
 * No existe `if (ruleset === '2024')` esparcido por el dominio: existen dos
 * conjuntos de datos y un unico motor.
 */

export const RULESETS = ['2014', '2024'] as const;
export type Ruleset = (typeof RULESETS)[number];

export const RULESET_LABEL: Record<Ruleset, string> = {
  '2014': 'D&D 5e (2014)',
  '2024': 'D&D (2024)',
};

export const RULESET_SHORT: Record<Ruleset, string> = {
  '2014': '2014',
  '2024': '2024',
};

export function isRuleset(v: string): v is Ruleset {
  return (RULESETS as readonly string[]).includes(v);
}

/** Un contenido es compatible si declara el ruleset del personaje. */
export function supportsRuleset(declared: readonly Ruleset[], target: Ruleset): boolean {
  return declared.includes(target);
}

// ── Compatibilidad explicada ─────────────────────────────────────────────────

/**
 * Nunca se mezcla contenido en silencio (MASTER SPEC §4).
 * Cuando algo no encaja, el usuario recibe: que pasa, por que, y que opciones tiene.
 */
export type CompatibilityVerdict = 'compatible' | 'incompatible' | 'unknown';

export type CompatibilityReport = {
  readonly verdict: CompatibilityVerdict;
  readonly target: Ruleset;
  readonly declared: readonly Ruleset[];
  /** Clave de traduccion del motivo. Nunca texto crudo. */
  readonly reasonCode: 'ruleset.match' | 'ruleset.mismatch' | 'ruleset.undeclared';
  /** Opciones que la UI debe ofrecer, en orden de preferencia. */
  readonly options: readonly CompatibilityOption[];
};

export type CompatibilityOption = 'useAnyway' | 'findAlternative' | 'cancel';

export function checkCompatibility(
  declared: readonly Ruleset[],
  target: Ruleset,
): CompatibilityReport {
  if (declared.length === 0) {
    return {
      verdict: 'unknown',
      target,
      declared,
      reasonCode: 'ruleset.undeclared',
      options: ['useAnyway', 'cancel'],
    };
  }
  if (supportsRuleset(declared, target)) {
    return {
      verdict: 'compatible',
      target,
      declared,
      reasonCode: 'ruleset.match',
      options: [],
    };
  }
  return {
    verdict: 'incompatible',
    target,
    declared,
    reasonCode: 'ruleset.mismatch',
    options: ['findAlternative', 'useAnyway', 'cancel'],
  };
}

/**
 * Cuando el usuario fuerza contenido incompatible queda registrado en el
 * personaje. Forzar es legitimo; ocultarlo despues, no.
 */
export type CompatibilityOverride = {
  readonly definitionId: string;
  readonly acceptedAt: string;
  readonly declared: readonly Ruleset[];
};
