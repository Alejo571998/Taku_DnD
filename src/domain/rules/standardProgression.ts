/**
 * TABLAS DE PROGRESIÓN ESTÁNDAR (SRD)
 *
 * Una clase de D&D no inventa su progresión: la copia de una de cuatro tablas
 * y cambia los rasgos. El bonificador de competencia es el mismo para todas,
 * los niveles de mejora de característica son casi siempre 4/8/12/16/19, y los
 * espacios de conjuro salen de la tabla de lanzador completo, medio o tercio.
 *
 * Tener esto en el dominio hace posible que el editor de contenido propio
 * OFREZCA una clase ya rellenada en vez de pedir doscientos números. Quien
 * crea una clase casera quiere decidir los rasgos, no volver a teclear que a
 * nivel 5 el bonificador es +3.
 *
 * Son datos del SRD 5.1 (CC-BY-4.0), igual que el resto del contenido.
 */

/** Espacios de conjuro del LANZADOR COMPLETO, niveles 1 a 20. */
export const FULL_CASTER_SLOTS: readonly (readonly number[])[] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/**
 * Lanzador MEDIO (paladín, explorador) y TERCIO (caballero místico).
 *
 * No son la tabla completa dividida: el medio empieza a nivel 2 y el tercio a
 * nivel 3, y redondean distinto. Se escriben enteras porque interpolarlas es
 * como se cuelan los errores.
 */
export const HALF_CASTER_SLOTS: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
];

export const THIRD_CASTER_SLOTS: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
];

export const CASTER_KINDS = ['none', 'full', 'half', 'third'] as const;
export type CasterKind = (typeof CASTER_KINDS)[number];

export const CASTER_KIND_LABEL: Record<CasterKind, string> = {
  none: 'No lanza conjuros',
  full: 'Lanzador completo (como el mago)',
  half: 'Medio lanzador (como el paladín)',
  third: 'Un tercio (como el caballero místico)',
};

const SLOT_TABLE: Record<Exclude<CasterKind, 'none'>, readonly (readonly number[])[]> = {
  full: FULL_CASTER_SLOTS,
  half: HALF_CASTER_SLOTS,
  third: THIRD_CASTER_SLOTS,
};

/** El nivel al que cada tipo de lanzador consigue su primer espacio. */
export const CASTER_START_LEVEL: Record<Exclude<CasterKind, 'none'>, number> = {
  full: 1,
  half: 2,
  third: 3,
};

/** Los niveles de mejora de característica de casi todas las clases. */
export const DEFAULT_ASI_LEVELS: readonly number[] = [4, 8, 12, 16, 19];

export const CLASS_LEVELS: readonly number[] = Array.from({ length: 20 }, (_, i) => i + 1);

export type StandardProgressionRow = {
  readonly profBonus: number;
  readonly features: readonly string[];
  readonly abilityScoreImprovement: boolean;
  readonly spellcasting?: {
    readonly cantripsKnown?: number;
    readonly spellsKnown?: number;
    readonly slots: readonly number[];
  };
  readonly resources: Readonly<Record<string, number>>;
};

/**
 * Construye la progresión de niveles 1 a 20 lista para el esquema de clase.
 *
 * Lo que el editor no pregunta —el bonificador de competencia, la forma de la
 * tabla de espacios— sale de acá ya resuelto. Lo que sí es una decisión de
 * diseño —qué rasgo llega a qué nivel, en qué niveles hay mejora— entra por
 * parámetro.
 */
export function buildStandardProgression(options: {
  readonly caster: CasterKind;
  readonly asiLevels: readonly number[];
  readonly featuresByLevel: Readonly<Record<number, readonly string[]>>;
  readonly cantripsByLevel?: Readonly<Record<number, number>>;
}): Record<string, StandardProgressionRow> {
  const out: Record<string, StandardProgressionRow> = {};

  for (const level of CLASS_LEVELS) {
    const row: {
      profBonus: number;
      features: readonly string[];
      abilityScoreImprovement: boolean;
      spellcasting?: StandardProgressionRow['spellcasting'];
      resources: Record<string, number>;
    } = {
      profBonus: proficiencyBonusAtLevel(level),
      features: options.featuresByLevel[level] ?? [],
      abilityScoreImprovement: options.asiLevels.includes(level),
      resources: {},
    };

    if (options.caster !== 'none') {
      const slots = SLOT_TABLE[options.caster][level - 1] ?? [];
      // Antes del nivel de inicio no hay bloque de lanzamiento: una fila con
      // todo a cero haría que el motor mostrara un apartado de conjuros vacío.
      if (level >= CASTER_START_LEVEL[options.caster]) {
        row.spellcasting = {
          slots: [...slots],
          ...(options.cantripsByLevel?.[level] != null
            ? { cantripsKnown: options.cantripsByLevel[level] }
            : {}),
        };
      }
    }

    out[String(level)] = row as StandardProgressionRow;
  }

  return out;
}

/** +2 a nivel 1, y uno más cada cuatro niveles. Igual para todas las clases. */
export function proficiencyBonusAtLevel(level: number): number {
  return 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4);
}
