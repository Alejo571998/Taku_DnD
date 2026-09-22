import { resolveCharacter } from '@domain/character/engine';
import {
  defaultSettings,
  emptyCurrency,
  emptyDeathSaves,
  emptyPersonality,
  emptySpellbook,
  type CharacterState,
  type InventoryItemState,
} from '@domain/character/state';
import type { AbilityGenerationMethod, AbilityScores } from '@domain/character/ability';
import type { ProficiencyLevel, SkillId } from '@domain/character/skill';
import type { ContentIndex } from '@domain/content';
import type { RulesEngine } from '@domain/rules/engine';
import type { Ruleset } from '@domain/rules/ruleset';
import {
  newCharacterId,
  newInventoryItemId,
  type DefinitionId,
  type WorkspaceId,
} from '@domain/shared/ids';

/**
 * CREACION DE PERSONAJE
 *
 * Convierte las elecciones del asistente en un `CharacterState` valido.
 * El equipo inicial, los PG y los recursos salen del contenido: no se piden
 * al usuario datos que el sistema puede deducir (MASTER PROMPT §3).
 */

export type CharacterDraft = {
  ruleset: Ruleset;
  name: string;
  playerName?: string;
  speciesId?: DefinitionId;
  subspeciesId?: DefinitionId;
  classId?: DefinitionId;
  subclassId?: DefinitionId;
  backgroundId?: DefinitionId;
  level: number;
  abilityScores: AbilityScores;
  abilityMethod: AbilityGenerationMethod;
  skillProficiencies: Partial<Record<SkillId, ProficiencyLevel>>;
  languages: string[];
  /** Opcion elegida en cada grupo de equipo inicial. */
  equipmentChoices: Record<string, number>;
  extraItems: { definitionId: DefinitionId; quantity: number }[];
  spells: DefinitionId[];
  cantrips: DefinitionId[];
  personality: { traits: string[]; ideals: string[]; bonds: string[]; flaws: string[] };
  appearance: Record<string, string>;
  backstory: string;
  alignment?: string;
  hitPointMode: 'fixed' | 'rolled';
  hitPointRolls: number[];
};

export function emptyDraft(ruleset: Ruleset = '2014'): CharacterDraft {
  return {
    ruleset,
    name: '',
    level: 1,
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    abilityMethod: 'standardArray',
    skillProficiencies: {},
    languages: [],
    equipmentChoices: {},
    extraItems: [],
    spells: [],
    cantrips: [],
    personality: { traits: [], ideals: [], bonds: [], flaws: [] },
    appearance: {},
    backstory: '',
    hitPointMode: 'fixed',
    hitPointRolls: [],
  };
}

export type DraftValidation = {
  readonly step: CreationStep;
  readonly complete: boolean;
  readonly issues: readonly { code: string; params?: Record<string, string | number> }[];
};

export const CREATION_STEPS = [
  'rules', 'concept', 'species', 'class', 'subclass', 'background',
  'abilities', 'proficiencies', 'equipment', 'spells',
  'personality', 'appearance', 'backstory', 'review',
] as const;

export type CreationStep = (typeof CREATION_STEPS)[number];

/** Valida un paso concreto. La interfaz lo usa para habilitar "Siguiente". */
export function validateStep(
  draft: CharacterDraft,
  step: CreationStep,
  content: ContentIndex,
): DraftValidation {
  const issues: { code: string; params?: Record<string, string | number> }[] = [];

  switch (step) {
    case 'rules':
      if (!draft.ruleset) issues.push({ code: 'creator.rules.required' });
      break;
    case 'concept':
      if (draft.name.trim().length === 0) issues.push({ code: 'creator.name.required' });
      break;
    case 'species':
      if (!draft.speciesId) issues.push({ code: 'creator.species.required' });
      else {
        const sub = content.subspeciesOf(draft.speciesId);
        if (sub.length > 0 && !draft.subspeciesId) issues.push({ code: 'creator.subspecies.required' });
      }
      break;
    case 'class':
      if (!draft.classId) issues.push({ code: 'creator.class.required' });
      break;
    case 'subclass': {
      const cls = content.class(draft.classId);
      if (cls && draft.level >= cls.subclassLevel && !draft.subclassId) {
        issues.push({ code: 'creator.subclass.required', params: { level: cls.subclassLevel } });
      }
      break;
    }
    case 'background':
      if (!draft.backgroundId) issues.push({ code: 'creator.background.required' });
      break;
    case 'abilities': {
      const total = Object.values(draft.abilityScores).reduce((a, b) => a + b, 0);
      if (total <= 60) issues.push({ code: 'creator.abilities.unassigned' });
      break;
    }
    case 'proficiencies': {
      const cls = content.class(draft.classId);
      const needed = cls?.skillChoices?.choose ?? 0;
      const chosen = Object.values(draft.skillProficiencies).filter((v) => v && v !== 'none').length;
      if (chosen < needed) {
        issues.push({ code: 'creator.skills.remaining', params: { remaining: needed - chosen } });
      }
      break;
    }
    case 'spells': {
      const cls = content.class(draft.classId);
      if (cls?.spellcasting) {
        const row = cls.progression[String(draft.level)];
        const cantripsNeeded = row?.spellcasting?.cantripsKnown ?? 0;
        if (draft.cantrips.length < cantripsNeeded) {
          issues.push({
            code: 'creator.cantrips.remaining',
            params: { remaining: cantripsNeeded - draft.cantrips.length },
          });
        }
      }
      break;
    }
    default:
      break;
  }

  return { step, complete: issues.length === 0, issues };
}

export function validateDraft(draft: CharacterDraft, content: ContentIndex): DraftValidation[] {
  return CREATION_STEPS.filter((s) => s !== 'review').map((s) => validateStep(draft, s, content));
}

export const isDraftComplete = (draft: CharacterDraft, content: ContentIndex): boolean =>
  validateDraft(draft, content).every((v) => v.complete);

/**
 * Materializa el borrador en un personaje real.
 *
 * PG: nivel 1 con el dado completo; el resto por promedio fijo o por las
 * tiradas que el jugador haya registrado. El maximo NUNCA se guarda: se
 * deriva de estas fuentes.
 */
export function createCharacter(
  draft: CharacterDraft,
  workspaceId: WorkspaceId,
  content: ContentIndex,
  engine: RulesEngine,
): CharacterState {
  const now = new Date().toISOString();
  const cls = content.class(draft.classId);
  const background = content.background(draft.backgroundId);

  const inventory: InventoryItemState[] = [];
  const push = (definitionId: DefinitionId, quantity: number) => {
    const def = content.get(definitionId);
    if (!def) return;
    inventory.push({
      id: newInventoryItemId(),
      definitionId,
      quantity,
      attuned: false,
      favorite: false,
    });
  };

  for (const item of cls?.startingEquipment ?? []) push(item.definitionId as DefinitionId, item.quantity);
  for (const item of background?.startingEquipment ?? []) push(item.definitionId as DefinitionId, item.quantity);

  (cls?.startingEquipmentOptions ?? []).forEach((group, groupIndex) => {
    const chosen = draft.equipmentChoices[String(groupIndex)];
    if (chosen == null) return;
    const option = group.options[chosen];
    for (const item of option?.items ?? []) push(item.definitionId as DefinitionId, item.quantity);
  });

  for (const item of draft.extraItems) push(item.definitionId, item.quantity);

  const spells = [...draft.cantrips, ...draft.spells].map((definitionId) => ({
    definitionId,
    prepared: true,
    favorite: false,
    alwaysPrepared: false,
    ...(draft.classId ? { sourceClassId: draft.classId } : {}),
  }));

  const state: CharacterState = {
    id: newCharacterId(),
    workspaceId,
    ruleset: draft.ruleset,
    name: draft.name.trim() || 'Sin nombre',
    ...(draft.playerName ? { playerName: draft.playerName } : {}),
    ...(draft.alignment ? { alignment: draft.alignment } : {}),
    experience: 0,
    ...(draft.speciesId ? { speciesId: draft.speciesId } : {}),
    ...(draft.subspeciesId ? { subspeciesId: draft.subspeciesId } : {}),
    ...(draft.backgroundId ? { backgroundId: draft.backgroundId } : {}),
    classes: draft.classId
      ? [
          {
            classId: draft.classId,
            ...(draft.subclassId ? { subclassId: draft.subclassId } : {}),
            level: draft.level,
            isPrimary: true,
            hitDiceSpent: 0,
          },
        ]
      : [],
    abilityScores: draft.abilityScores,
    abilityMethod: draft.abilityMethod,
    abilityIncreases: [],
    skillProficiencies: draft.skillProficiencies,
    savingThrowProficiencies: cls?.savingThrows ?? [],
    otherProficiencies: [],
    languages: draft.languages.length > 0 ? draft.languages : ['Common'],
    featIds: [],
    hitPoints: {
      current: 1,
      temporary: 0,
      mode: draft.hitPointMode,
      rolls: draft.hitPointRolls,
      bonusPerLevel: 0,
      deathSaves: emptyDeathSaves(),
    },
    inventory,
    currency: background?.startingGold ? { ...emptyCurrency(), gp: background.startingGold } : emptyCurrency(),
    spells: { ...emptySpellbook(), known: spells },
    resources: [],
    conditions: [],
    personality: { ...emptyPersonality(), ...draft.personality },
    appearance: draft.appearance,
    backstory: draft.backstory,
    notes: [],
    settings: defaultSettings(),
    compatibilityOverrides: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  // Ahora que el personaje existe, el motor dice cuantos PG maximos tiene.
  // Se empieza con la vida llena: nadie crea un personaje herido.
  const sheet = resolveCharacter(state, content, engine);
  return { ...state, hitPoints: { ...state.hitPoints, current: sheet.hitPoints.max.value } };
}
