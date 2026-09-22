import type { ContentIndex, ClassDefinition, SubclassDefinition } from '../content';
import type { DefinitionId } from '../shared/ids';
import { errCode, ok, type Result } from '../shared/result';
import { DEFAULT_ABILITY_CAP, type AbilityId, type AbilityScores } from './ability';
import {
  primaryClass,
  proficiencyBonusForLevel,
  totalLevel,
  type AbilityIncrease,
  type CharacterClassEntry,
  type CharacterState,
  type CharacterSpellState,
} from './state';

/**
 * PROGRESION Y SUBIDA DE NIVEL (MASTER SPEC §29)
 *
 * La subida de nivel NO calcula nada derivado: cambia el ESTADO (el nivel de
 * una clase, las mejoras elegidas, los conjuros aprendidos) y deja que el
 * motor derive PG, competencia, espacios y recursos como siempre.
 *
 * Por eso este modulo no toca CA, ataques ni salvaciones: si lo hiciera,
 * estaria duplicando el motor y abriendo la puerta a que se desincronicen.
 */

export const MAX_CHARACTER_LEVEL = 20;

/**
 * Umbrales de experiencia del SRD. El indice 0 es el nivel 1.
 * La experiencia es OPCIONAL: muchas mesas suben de nivel por hitos. Por eso
 * nunca bloquea la subida, solo la sugiere (MASTER SPEC §29).
 */
export const XP_THRESHOLDS: readonly number[] = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

export function experienceForLevel(level: number): number {
  const clamped = Math.max(1, Math.min(MAX_CHARACTER_LEVEL, Math.floor(level)));
  return XP_THRESHOLDS[clamped - 1] ?? 0;
}

export function levelFromExperience(xp: number): number {
  let level = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (xp >= (XP_THRESHOLDS[i] ?? 0)) level = i + 1;
  }
  return level;
}

export type ExperienceProgress = {
  readonly level: number;
  readonly current: number;
  readonly currentLevelAt: number;
  /** Ausente en nivel 20: ya no hay siguiente umbral. */
  readonly nextLevelAt?: number;
  readonly remaining: number;
  /** 0..1 dentro del nivel actual. En nivel 20 siempre 1. */
  readonly fraction: number;
};

export function experienceProgress(xp: number): ExperienceProgress {
  const level = levelFromExperience(xp);
  const currentLevelAt = experienceForLevel(level);
  if (level >= MAX_CHARACTER_LEVEL) {
    return { level, current: xp, currentLevelAt, remaining: 0, fraction: 1 };
  }
  const nextLevelAt = experienceForLevel(level + 1);
  const span = nextLevelAt - currentLevelAt;
  return {
    level,
    current: xp,
    currentLevelAt,
    nextLevelAt,
    remaining: Math.max(0, nextLevelAt - xp),
    fraction: span > 0 ? Math.min(1, Math.max(0, (xp - currentLevelAt) / span)) : 0,
  };
}

// ── Multiclase ───────────────────────────────────────────────────────────────

export type MulticlassCheck = {
  readonly allowed: boolean;
  /** Requisitos que NO se cumplen, para explicar por que no se puede. */
  readonly missing: readonly { readonly ability: AbilityId; readonly minimum: number; readonly actual: number }[];
};

/**
 * Requisitos de multiclase. Se evaluan contra las caracteristicas EFECTIVAS
 * (las de la ficha, con bonificadores de especie y mejoras ya aplicados),
 * no contra las puntuaciones base.
 */
export function checkMulticlassPrerequisites(
  cls: ClassDefinition | undefined,
  effectiveScores: AbilityScores,
): MulticlassCheck {
  const prerequisites = cls?.multiclassing?.prerequisites ?? [];
  const missing = prerequisites
    .map((p) => ({ ability: p.ability, minimum: p.minimum, actual: effectiveScores[p.ability] ?? 0 }))
    .filter((p) => p.actual < p.minimum);
  return { allowed: missing.length === 0, missing };
}

// ── Plan de subida de nivel ──────────────────────────────────────────────────

export type HitPointMethod = 'average' | 'roll' | 'manual';

export type LevelUpFeature = {
  readonly id: DefinitionId;
  readonly name: string;
  readonly description: readonly string[];
};

export type LevelUpSpellcasting = {
  readonly ability: AbilityId;
  readonly preparesSpells: boolean;
  /** Slug del SRD para filtrar la lista de conjuros de la clase. */
  readonly classSlug: string;
  readonly cantripsToLearn: number;
  readonly spellsToLearn: number;
  readonly slotsBefore: readonly number[];
  readonly slotsAfter: readonly number[];
  /** Nivel de conjuro mas alto accesible tras subir. */
  readonly maxSpellLevel: number;
};

export type LevelUpResourceChange = {
  readonly key: string;
  readonly before: number;
  readonly after: number;
};

export type LevelUpPlan = {
  readonly classId: DefinitionId;
  readonly className: string;
  readonly isNewClass: boolean;
  readonly fromClassLevel: number;
  readonly toClassLevel: number;
  readonly fromTotalLevel: number;
  readonly toTotalLevel: number;

  readonly hitDie: number;
  readonly constitutionModifier: number;
  /** Promedio fijo del dado (mitad + 1), sin Constitucion. */
  readonly averageRoll: number;
  /** Lo que sube el maximo con el promedio, Constitucion incluida. */
  readonly averageHitPointGain: number;
  readonly currentHitPointMode: CharacterState['hitPoints']['mode'];

  readonly proficiencyBonusBefore: number;
  readonly proficiencyBonusAfter: number;

  readonly requiresSubclass: boolean;
  readonly subclassOptions: readonly SubclassDefinition[];

  readonly grantsAbilityScoreImprovement: boolean;
  readonly newFeatures: readonly LevelUpFeature[];
  readonly resourceChanges: readonly LevelUpResourceChange[];
  readonly spellcasting?: LevelUpSpellcasting;

  /** Identificador estable de esta subida, para poder revertirla con precision. */
  readonly stamp: string;
};

const featureOf = (content: ContentIndex, id: string): LevelUpFeature | undefined => {
  const def = content.get(id);
  if (!def) return undefined;
  return { id: def.id as DefinitionId, name: def.name, description: def.description ?? [] };
};

const highestSlotLevel = (slots: readonly number[]): number => {
  let max = 0;
  slots.forEach((count, index) => {
    if (count > 0) max = index + 1;
  });
  return max;
};

/** Slug del SRD a partir del id (srd-2014:class:wizard -> wizard). */
export const slugOf = (definitionId: string): string => definitionId.split(':').pop() ?? definitionId;

/**
 * Describe TODO lo que cambia al subir un nivel, antes de aplicarlo.
 * La interfaz no decide nada: solo muestra esto y recoge las elecciones.
 */
export function planLevelUp(
  state: CharacterState,
  classId: DefinitionId,
  content: ContentIndex,
  effectiveScores: AbilityScores,
): Result<LevelUpPlan> {
  const fromTotalLevel = totalLevel(state);
  if (fromTotalLevel >= MAX_CHARACTER_LEVEL) {
    return errCode('level.outOfRange', { level: fromTotalLevel }, 'nivel maximo alcanzado');
  }

  const cls = content.class(classId);
  if (!cls) return errCode('content.notFound', { id: classId }, 'clase desconocida');

  const existing = state.classes.find((c) => c.classId === classId);
  const isNewClass = existing === undefined;

  if (isNewClass) {
    const check = checkMulticlassPrerequisites(cls, effectiveScores);
    if (!check.allowed) {
      const first = check.missing[0];
      return errCode(
        'validation.failed',
        first ? { ability: first.ability, minimum: first.minimum, actual: first.actual } : {},
        'no cumple los requisitos de multiclase',
      );
    }
  }

  const fromClassLevel = existing?.level ?? 0;
  const toClassLevel = fromClassLevel + 1;
  const toTotalLevel = fromTotalLevel + 1;

  const rowBefore = cls.progression[String(fromClassLevel)];
  const rowAfter = cls.progression[String(toClassLevel)];
  if (!rowAfter) {
    return errCode('level.outOfRange', { level: toClassLevel }, 'la clase no define ese nivel');
  }

  const constitutionModifier = Math.floor(((effectiveScores.con ?? 10) - 10) / 2);
  const averageRoll = Math.floor(cls.hitDie / 2) + 1;

  const subclassOptions = content.subclassesOf(classId);
  const requiresSubclass =
    toClassLevel >= cls.subclassLevel && existing?.subclassId === undefined && subclassOptions.length > 0;

  const newFeatures = rowAfter.features
    .map((id) => featureOf(content, id))
    .filter((f): f is LevelUpFeature => f !== undefined);

  // Rasgos que aporta la subclase en este nivel, si ya hay una elegida.
  const chosenSubclass = content.subclass(existing?.subclassId);
  const subclassFeatures = (chosenSubclass?.progression?.[String(toClassLevel)]?.features ?? [])
    .map((id) => featureOf(content, id))
    .filter((f): f is LevelUpFeature => f !== undefined);

  const resourceChanges: LevelUpResourceChange[] = [];
  const keys = new Set([
    ...Object.keys(rowBefore?.resources ?? {}),
    ...Object.keys(rowAfter.resources ?? {}),
  ]);
  for (const key of keys) {
    const before = rowBefore?.resources?.[key] ?? 0;
    const after = rowAfter.resources?.[key] ?? 0;
    if (before !== after) resourceChanges.push({ key, before, after });
  }

  let spellcasting: LevelUpSpellcasting | undefined;
  if (cls.spellcasting && toClassLevel >= cls.spellcasting.startsAtLevel) {
    const before = rowBefore?.spellcasting;
    const after = rowAfter.spellcasting;
    const slotsAfter = after?.slots ?? [];
    spellcasting = {
      ability: cls.spellcasting.ability,
      preparesSpells: cls.spellcasting.preparesSpells,
      classSlug: slugOf(classId),
      cantripsToLearn: Math.max(0, (after?.cantripsKnown ?? 0) - (before?.cantripsKnown ?? 0)),
      spellsToLearn: Math.max(0, (after?.spellsKnown ?? 0) - (before?.spellsKnown ?? 0)),
      slotsBefore: before?.slots ?? [],
      slotsAfter,
      maxSpellLevel: highestSlotLevel(slotsAfter),
    };
  }

  return ok({
    classId,
    className: cls.name,
    isNewClass,
    fromClassLevel,
    toClassLevel,
    fromTotalLevel,
    toTotalLevel,
    hitDie: cls.hitDie,
    constitutionModifier,
    averageRoll,
    averageHitPointGain: Math.max(1, averageRoll + constitutionModifier),
    currentHitPointMode: state.hitPoints.mode,
    proficiencyBonusBefore: proficiencyBonusForLevel(fromTotalLevel),
    proficiencyBonusAfter: proficiencyBonusForLevel(toTotalLevel),
    requiresSubclass,
    subclassOptions,
    grantsAbilityScoreImprovement: rowAfter.abilityScoreImprovement === true,
    newFeatures: [...newFeatures, ...subclassFeatures],
    resourceChanges,
    ...(spellcasting ? { spellcasting } : {}),
    stamp: levelUpStamp(classId, toClassLevel),
  });
}

/**
 * Marca que identifica una subida concreta. Se guarda en `sourceId` de las
 * mejoras de caracteristica para poder deshacerla sin ambiguedad.
 */
export const levelUpStamp = (classId: DefinitionId, classLevel: number): string =>
  `levelup:${classId}:${classLevel}`;

// ── Elecciones y validacion ──────────────────────────────────────────────────

export type AbilityImprovement =
  | {
      readonly kind: 'abilities';
      readonly increases: readonly { readonly ability: AbilityId; readonly amount: number }[];
    }
  | { readonly kind: 'feat'; readonly featId: DefinitionId };

export type LevelUpChoice = {
  readonly hitPointMethod: HitPointMethod;
  /** Tirada concreta (`roll`) o maximo nuevo (`manual`). */
  readonly hitPointValue?: number;
  readonly subclassId?: DefinitionId;
  readonly improvement?: AbilityImprovement;
  readonly cantrips: readonly DefinitionId[];
  readonly spells: readonly DefinitionId[];
};

export type LevelUpIssue = {
  readonly field: 'hitPoints' | 'subclass' | 'improvement' | 'cantrips' | 'spells';
  readonly code: string;
  readonly params?: Record<string, string | number>;
};

/**
 * Valida las elecciones contra el plan. Devuelve TODOS los problemas, no solo
 * el primero: el usuario merece ver de una vez lo que le falta.
 */
export function validateLevelUp(
  plan: LevelUpPlan,
  choice: LevelUpChoice,
  effectiveScores: AbilityScores,
  content: ContentIndex,
): readonly LevelUpIssue[] {
  const issues: LevelUpIssue[] = [];

  if (choice.hitPointMethod === 'roll') {
    const value = choice.hitPointValue;
    if (value == null || !Number.isInteger(value) || value < 1 || value > plan.hitDie) {
      issues.push({ field: 'hitPoints', code: 'levelUp.roll.outOfRange', params: { die: plan.hitDie } });
    }
  }
  if (choice.hitPointMethod === 'manual') {
    const value = choice.hitPointValue;
    if (value == null || !Number.isInteger(value) || value < 1) {
      issues.push({ field: 'hitPoints', code: 'levelUp.manual.invalid' });
    }
  }

  if (plan.requiresSubclass && !choice.subclassId) {
    issues.push({ field: 'subclass', code: 'levelUp.subclass.required' });
  }
  if (choice.subclassId && !plan.subclassOptions.some((s) => s.id === choice.subclassId)) {
    issues.push({ field: 'subclass', code: 'levelUp.subclass.unknown' });
  }

  if (plan.grantsAbilityScoreImprovement) {
    const improvement = choice.improvement;
    if (!improvement) {
      issues.push({ field: 'improvement', code: 'levelUp.improvement.required' });
    } else if (improvement.kind === 'abilities') {
      const total = improvement.increases.reduce((sum, i) => sum + i.amount, 0);
      if (total !== 2) {
        issues.push({ field: 'improvement', code: 'levelUp.improvement.mustSpendTwo', params: { total } });
      }
      for (const inc of improvement.increases) {
        if (inc.amount < 1 || inc.amount > 2) {
          issues.push({
            field: 'improvement',
            code: 'levelUp.improvement.invalidAmount',
            params: { ability: inc.ability },
          });
        }
        const resulting = (effectiveScores[inc.ability] ?? 10) + inc.amount;
        if (resulting > DEFAULT_ABILITY_CAP) {
          issues.push({
            field: 'improvement',
            code: 'levelUp.improvement.overCap',
            params: { ability: inc.ability, cap: DEFAULT_ABILITY_CAP, resulting },
          });
        }
      }
    } else if (!content.feat(improvement.featId)) {
      issues.push({ field: 'improvement', code: 'levelUp.feat.unknown' });
    }
  }

  const sc = plan.spellcasting;
  if (sc) {
    if (choice.cantrips.length !== sc.cantripsToLearn) {
      issues.push({
        field: 'cantrips',
        code: 'levelUp.cantrips.count',
        params: { expected: sc.cantripsToLearn, chosen: choice.cantrips.length },
      });
    }
    if (choice.spells.length !== sc.spellsToLearn) {
      issues.push({
        field: 'spells',
        code: 'levelUp.spells.count',
        params: { expected: sc.spellsToLearn, chosen: choice.spells.length },
      });
    }
    for (const id of [...choice.cantrips, ...choice.spells]) {
      const spell = content.spell(id);
      if (!spell) {
        issues.push({ field: 'spells', code: 'levelUp.spell.unknown', params: { id } });
        continue;
      }
      if (spell.level > sc.maxSpellLevel) {
        issues.push({
          field: 'spells',
          code: 'levelUp.spell.tooHigh',
          params: { name: spell.name, level: spell.level, max: sc.maxSpellLevel },
        });
      }
    }
  } else if (choice.cantrips.length > 0 || choice.spells.length > 0) {
    issues.push({ field: 'spells', code: 'levelUp.spells.notACaster' });
  }

  return issues;
}

// ── Aplicacion ───────────────────────────────────────────────────────────────

/**
 * Reconstruye el array de tiradas implicito para los niveles ya existentes.
 *
 * Hace falta al pasar de promedio fijo a tirada: sin esto, cambiar de modo
 * reinterpretaria TODOS los niveles anteriores y el maximo saltaria solo.
 * Rellenar con los promedios deja el maximo exactamente igual que antes.
 */
export function backfillHitPointRolls(state: CharacterState, content: ContentIndex): number[] {
  const rolls: number[] = [];
  const primary = primaryClass(state);
  let index = 0;
  for (const entry of state.classes) {
    const die = content.class(entry.classId)?.hitDie ?? 8;
    const average = Math.floor(die / 2) + 1;
    const levels = entry === primary ? entry.level - 1 : entry.level;
    for (let i = 0; i < levels; i++) {
      rolls.push(state.hitPoints.rolls[index] ?? average);
      index++;
    }
  }
  return rolls;
}

export type LevelUpRevert = {
  readonly classId: DefinitionId;
  readonly stamp: string;
  /** La clase se creo en esta subida: hay que eliminar la entrada entera. */
  readonly removeClassEntry: boolean;
  readonly clearSubclass: boolean;
  /**
   * Longitud EXACTA del array de tiradas antes de subir.
   * No basta con quitar la ultima: pasar de promedio a tirada rellena los
   * niveles anteriores, y esas tiradas tambien hay que retirarlas.
   */
  readonly restoreRollCount: number;
  readonly restoreHitPointMode: CharacterState['hitPoints']['mode'];
  readonly restoreMaxOverride?: number;
  /** PG actuales antes de subir: subir de nivel cura, deshacer lo revierte. */
  readonly restoreCurrentHitPoints: number;
  readonly removeFeatId?: DefinitionId;
  readonly removeSpellIds: readonly DefinitionId[];
};

export type LevelUpApplication = {
  readonly patch: Partial<CharacterState>;
  /** Todo lo necesario para revertir exactamente esta subida. */
  readonly revert: LevelUpRevert;
  /** Cuanto subio el maximo de PG, para contarselo al usuario. */
  readonly hitPointGain: number;
};

/**
 * Aplica la subida al estado. Devuelve un PARCHE, no el estado completo:
 * quien llama (el ejecutor de comandos) es quien sube la version y la fecha.
 */
export function applyLevelUp(
  state: CharacterState,
  plan: LevelUpPlan,
  choice: LevelUpChoice,
  content: ContentIndex,
): Result<LevelUpApplication> {
  const cls = content.class(plan.classId);
  if (!cls) return errCode('content.notFound', { id: plan.classId }, 'clase desconocida');

  // ── Clases ────────────────────────────────────────────────────────────────
  const existing = state.classes.find((c) => c.classId === plan.classId);
  const subclassId = choice.subclassId ?? existing?.subclassId;

  const classes: CharacterClassEntry[] = existing
    ? state.classes.map((c) =>
        c.classId === plan.classId
          ? { ...c, level: c.level + 1, ...(subclassId ? { subclassId } : {}) }
          : c,
      )
    : [
        ...state.classes,
        {
          classId: plan.classId,
          ...(subclassId ? { subclassId } : {}),
          level: 1,
          isPrimary: state.classes.length === 0,
          hitDiceSpent: 0,
        },
      ];

  // ── Puntos de golpe ───────────────────────────────────────────────────────
  const hp = state.hitPoints;
  let hitPoints = hp;
  let hitPointGain: number;

  if (choice.hitPointMethod === 'manual') {
    const nextMax = choice.hitPointValue ?? hp.maxOverride ?? 1;
    hitPointGain = Math.max(0, nextMax - (hp.maxOverride ?? 0));
    hitPoints = { ...hp, mode: 'manual', maxOverride: nextMax };
  } else if (choice.hitPointMethod === 'roll') {
    const rolled = choice.hitPointValue ?? plan.averageRoll;
    const rolls = hp.mode === 'rolled' ? [...hp.rolls] : backfillHitPointRolls(state, content);
    rolls.push(rolled);
    hitPoints = { ...hp, mode: 'rolled', rolls };
    hitPointGain = Math.max(1, rolled + plan.constitutionModifier);
  } else {
    // Promedio fijo. Si ya se venia tirando, se registra el promedio como
    // tirada para no cambiar el modo a espaldas del jugador.
    if (hp.mode === 'rolled') {
      hitPoints = { ...hp, rolls: [...hp.rolls, plan.averageRoll] };
    }
    hitPointGain = plan.averageHitPointGain;
  }

  // Subir de nivel cura: los PG actuales suben lo mismo que el maximo.
  // El maximo NO se guarda nunca: lo deriva el motor.
  const restoreCurrentHitPoints = hp.current;
  hitPoints = { ...hitPoints, current: hitPoints.current + hitPointGain };

  // ── Mejora de caracteristica o dote ───────────────────────────────────────
  let abilityIncreases: readonly AbilityIncrease[] = state.abilityIncreases;
  let featIds: readonly DefinitionId[] = state.featIds;
  let removeFeatId: DefinitionId | undefined;

  const improvement = choice.improvement;
  if (plan.grantsAbilityScoreImprovement && improvement) {
    if (improvement.kind === 'abilities') {
      const label = `Mejora de característica (${plan.className} ${plan.toClassLevel})`;
      abilityIncreases = [
        ...state.abilityIncreases,
        ...improvement.increases.map((inc) => ({
          ability: inc.ability,
          amount: inc.amount,
          sourceLabel: label,
          sourceId: plan.stamp as DefinitionId,
        })),
      ];
    } else if (!state.featIds.includes(improvement.featId)) {
      featIds = [...state.featIds, improvement.featId];
      removeFeatId = improvement.featId;
    }
  }

  // ── Conjuros ──────────────────────────────────────────────────────────────
  const learned = [...choice.cantrips, ...choice.spells].filter(
    (id) => !state.spells.known.some((k) => k.definitionId === id),
  );
  const known: CharacterSpellState[] = [
    ...state.spells.known,
    ...learned.map((definitionId) => ({
      definitionId,
      // Los lanzadores que NO preparan conocen el conjuro siempre listo.
      prepared: plan.spellcasting?.preparesSpells === false,
      favorite: false,
      alwaysPrepared: false,
      sourceClassId: plan.classId,
    })),
  ];

  // ── Competencias de multiclase ────────────────────────────────────────────
  // Solo la clase INICIAL da competencias completas; al multiclasear se recibe
  // un subconjunto que la propia definicion declara.
  const otherProficiencies = plan.isNewClass
    ? [...new Set([...state.otherProficiencies, ...(cls.multiclassing?.proficiencies ?? [])])]
    : state.otherProficiencies;

  const patch: Partial<CharacterState> = {
    classes,
    hitPoints,
    abilityIncreases,
    featIds,
    spells: { ...state.spells, known },
    otherProficiencies,
  };

  return ok({
    patch,
    hitPointGain,
    revert: {
      classId: plan.classId,
      stamp: plan.stamp,
      removeClassEntry: plan.isNewClass,
      clearSubclass: choice.subclassId !== undefined && existing?.subclassId === undefined,
      restoreRollCount: hp.rolls.length,
      restoreHitPointMode: hp.mode,
      ...(hp.maxOverride !== undefined ? { restoreMaxOverride: hp.maxOverride } : {}),
      restoreCurrentHitPoints,
      ...(removeFeatId ? { removeFeatId } : {}),
      removeSpellIds: learned,
    },
  });
}

/** Deshace exactamente lo que hizo `applyLevelUp`. */
export function revertLevelUp(state: CharacterState, revert: LevelUpRevert): Partial<CharacterState> {
  const classes = revert.removeClassEntry
    ? state.classes.filter((c) => c.classId !== revert.classId)
    : state.classes.map((c) => {
        if (c.classId !== revert.classId) return c;
        const next: CharacterClassEntry = { ...c, level: Math.max(1, c.level - 1) };
        if (!revert.clearSubclass) return next;
        const { subclassId: _dropped, ...withoutSubclass } = next;
        void _dropped;
        return withoutSubclass as CharacterClassEntry;
      });

  const hp = state.hitPoints;
  const hitPoints: CharacterState['hitPoints'] = {
    ...hp,
    mode: revert.restoreHitPointMode,
    rolls: hp.rolls.slice(0, revert.restoreRollCount),
    current: revert.restoreCurrentHitPoints,
    ...(revert.restoreMaxOverride !== undefined ? { maxOverride: revert.restoreMaxOverride } : {}),
  };

  const removed = new Set<string>(revert.removeSpellIds);

  return {
    classes,
    hitPoints,
    abilityIncreases: state.abilityIncreases.filter((i) => i.sourceId !== revert.stamp),
    featIds: revert.removeFeatId ? state.featIds.filter((f) => f !== revert.removeFeatId) : state.featIds,
    spells: { ...state.spells, known: state.spells.known.filter((k) => !removed.has(k.definitionId)) },
  };
}
