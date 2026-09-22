import type { AdvantageChannel, Computed } from '../shared/computed';
import type { DefinitionId } from '../shared/ids';
import type { Feet, Weight } from '../shared/units';
import type { Ruleset } from '../rules/ruleset';
import type { AbilityId } from './ability';
import type { ProficiencyLevel, SkillId } from './skill';
import type { CharacterState, EquipmentSlot, InventoryItemState, ResourceState } from './state';

/**
 * FICHA DERIVADA — proyeccion, nunca persistida (MASTER PROMPT §57).
 *
 * Todo aqui se recalcula desde CharacterState. Cada numero trae sus
 * `contributions`, asi que la interfaz puede explicar CUALQUIER valor sin
 * implementar una sola regla.
 */
export type CharacterSheet = {
  readonly state: CharacterState;
  readonly ruleset: Ruleset;

  readonly level: number;
  readonly proficiencyBonus: number;
  readonly classes: readonly ResolvedClass[];
  readonly speciesName: string;
  readonly backgroundName: string;
  readonly isMulticlass: boolean;

  readonly abilities: Readonly<Record<AbilityId, AbilityBlock>>;
  readonly savingThrows: Readonly<Record<AbilityId, SaveBlock>>;
  readonly skills: Readonly<Record<SkillId, SkillBlock>>;

  readonly armorClass: Computed<number>;
  readonly initiative: Computed<number>;
  readonly speed: Computed<number>;
  readonly size: string;

  readonly hitPoints: HitPointsBlock;
  readonly hitDice: readonly HitDiceBlock[];

  readonly attacks: readonly Attack[];
  readonly spellcasting: readonly SpellcastingBlock[];
  readonly features: readonly ResolvedFeature[];
  readonly resources: readonly ResourceState[];

  readonly carrying: CarryingBlock;
  readonly passivePerception: number;
  readonly senses: readonly string[];

  readonly proficiencies: ProficiencyBlock;
  readonly activeConditions: readonly ResolvedCondition[];

  /** Avisos no bloqueantes: sin competencia, sobrecargado, sigilo con desventaja. */
  readonly warnings: readonly SheetWarning[];
};

export type AbilityBlock = {
  readonly id: AbilityId;
  readonly score: Computed<number>;
  readonly modifier: number;
};

export type SaveBlock = {
  readonly ability: AbilityId;
  readonly modifier: Computed<number>;
  readonly proficient: boolean;
  readonly advantage: AdvantageChannel;
};

export type SkillBlock = {
  readonly id: SkillId;
  readonly ability: AbilityId;
  readonly modifier: Computed<number>;
  readonly proficiency: ProficiencyLevel;
  readonly passive: number;
  readonly advantage: AdvantageChannel;
};

export type HitPointsBlock = {
  readonly current: number;
  readonly max: Computed<number>;
  readonly temporary: number;
  /** current + temporary: lo que realmente absorbe daño. */
  readonly effective: number;
  readonly percent: number;
  readonly status: 'healthy' | 'wounded' | 'bloodied' | 'critical' | 'down';
  readonly deathSaves: { readonly successes: number; readonly failures: number };
};

export type HitDiceBlock = {
  readonly classId: DefinitionId;
  readonly className: string;
  readonly die: number;
  readonly total: number;
  readonly spent: number;
  readonly available: number;
};

export type ResolvedClass = {
  readonly classId: DefinitionId;
  readonly name: string;
  readonly level: number;
  readonly hitDie: number;
  readonly subclassId?: DefinitionId;
  readonly subclassName?: string;
  readonly isPrimary: boolean;
  /** Nivel al que toca elegir subclase, si aun no se eligio. */
  readonly pendingSubclassAtLevel?: number;
};

export type AttackKind = 'weapon' | 'spell' | 'unarmed';

export type Attack = {
  readonly id: string;
  readonly name: string;
  readonly kind: AttackKind;
  readonly definitionId?: DefinitionId;
  readonly itemId?: string;
  readonly ability: AbilityId;
  readonly attackBonus: Computed<number>;
  /** Expresion de daño ya compuesta: "1d8+3". */
  readonly damageExpression: string;
  readonly damageType: string;
  readonly versatileExpression?: string;
  readonly range: string;
  readonly properties: readonly string[];
  readonly proficient: boolean;
  readonly advantage: AdvantageChannel;
  /** Municion vinculada, si el arma la consume. */
  readonly ammunition?: { readonly definitionId: DefinitionId; readonly itemId?: string; readonly remaining: number };
  readonly favorite: boolean;
};

export type SpellcastingBlock = {
  readonly classId: DefinitionId;
  readonly className: string;
  readonly ability: AbilityId;
  readonly spellAttackBonus: Computed<number>;
  readonly saveDc: Computed<number>;
  readonly preparesSpells: boolean;
  /** Maximo de conjuros preparables; null si la clase no prepara. */
  readonly preparedLimit: number | null;
  readonly preparedCount: number;
  readonly cantripsKnown: number;
  readonly slots: readonly SpellSlotBlock[];
  readonly ritualCasting: boolean;
};

export type SpellSlotBlock = {
  readonly level: number;
  readonly total: number;
  readonly used: number;
  readonly available: number;
};

export type ResolvedFeature = {
  readonly definitionId: DefinitionId;
  readonly name: string;
  readonly description: readonly string[];
  readonly sourceLabel: string;
  readonly level: number;
  readonly kind: 'class' | 'subclass' | 'species' | 'background' | 'feat';
};

export type ResolvedCondition = {
  readonly instanceId: string;
  readonly definitionId: DefinitionId;
  readonly name: string;
  readonly description: readonly string[];
  readonly level?: number;
  readonly sourceLabel?: string;
  readonly roundsRemaining?: number;
};

export type CarryingBlock = {
  readonly carried: Weight;
  readonly capacity: Weight;
  /** Umbral de la variante de carga: a partir de aqui baja la velocidad. */
  readonly encumberedAt: Weight;
  readonly heavilyEncumberedAt: Weight;
  readonly pushDragLift: Weight;
  readonly status: 'normal' | 'encumbered' | 'heavilyEncumbered' | 'exceeded';
  readonly percent: number;
  readonly speedPenalty: Feet;
};

export type ProficiencyBlock = {
  readonly armor: readonly string[];
  readonly weapons: readonly string[];
  readonly tools: readonly string[];
  readonly languages: readonly string[];
  readonly savingThrows: readonly AbilityId[];
};

export type SheetWarning = {
  readonly code:
    | 'armor.notProficient'
    | 'weapon.notProficient'
    | 'carrying.exceeded'
    | 'carrying.encumbered'
    | 'stealth.disadvantage'
    | 'armor.strengthRequirement'
    | 'attunement.overLimit'
    | 'spells.overPrepared'
    | 'subclass.pending';
  readonly params?: Readonly<Record<string, string | number>>;
};

/** Objeto equipado en un slot concreto. */
export const equippedIn = (
  inventory: readonly InventoryItemState[],
  slot: EquipmentSlot,
): InventoryItemState | undefined => inventory.find((i) => i.equippedSlot === slot);

export function hitPointStatus(current: number, max: number): HitPointsBlock['status'] {
  if (current <= 0) return 'down';
  const pct = max > 0 ? current / max : 0;
  if (pct <= 0.25) return 'critical';
  if (pct <= 0.5) return 'bloodied';
  if (pct < 1) return 'wounded';
  return 'healthy';
}
