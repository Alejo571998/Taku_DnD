import { resolveCharacter } from '@domain/character/engine';
import type { CharacterSheet } from '@domain/character/sheet';
import {
  defaultSettings,
  emptyCurrency,
  emptyDeathSaves,
  emptyPersonality,
  emptySpellbook,
  type CharacterState,
  type EquipmentSlot,
  type InventoryItemState,
} from '@domain/character/state';
import type { AbilityScores } from '@domain/character/ability';
import type { ProficiencyLevel, SkillId } from '@domain/character/skill';
import { type ContentIndex } from '@domain/content';
import { RulesEngine } from '@domain/rules/engine';
import { SRD_RULES } from '@domain/rules/srd-rules';
import type { Ruleset } from '@domain/rules/ruleset';
import {
  asCharacterId,
  asWorkspaceId,
  newInventoryItemId,
  type DefinitionId,
} from '@domain/shared/ids';
import { loadContent } from './content';

/**
 * Constructor de personajes de prueba.
 *
 * Encadenable y explicito: cada test declara SOLO lo que le importa, y el
 * resto queda en valores neutros. Un fixture que hay que leer entero para
 * entender un test es un fixture que estorba.
 */
export class CharacterBuilder {
  private state: CharacterState;
  private readonly content: ContentIndex;

  constructor(ruleset: Ruleset = '2014') {
    this.content = loadContent(ruleset);
    const now = new Date('2026-01-01T00:00:00.000Z').toISOString();
    this.state = {
      id: asCharacterId('11111111-1111-7111-8111-111111111111'),
      workspaceId: asWorkspaceId('22222222-2222-7222-8222-222222222222'),
      ruleset,
      name: 'Personaje de prueba',
      experience: 0,
      classes: [],
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      abilityMethod: 'manual',
      abilityIncreases: [],
      skillProficiencies: {},
      savingThrowProficiencies: [],
      otherProficiencies: [],
      languages: ['Common'],
      featIds: [],
      hitPoints: {
        current: 10,
        temporary: 0,
        mode: 'fixed',
        rolls: [],
        bonusPerLevel: 0,
        deathSaves: emptyDeathSaves(),
      },
      inventory: [],
      currency: emptyCurrency(),
      spells: emptySpellbook(),
      resources: [],
      conditions: [],
      personality: emptyPersonality(),
      appearance: {},
      backstory: '',
      notes: [],
      settings: defaultSettings(),
      compatibilityOverrides: [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
  }

  abilities(scores: Partial<AbilityScores>): this {
    this.state = { ...this.state, abilityScores: { ...this.state.abilityScores, ...scores } };
    return this;
  }

  withClass(classSlug: string, level = 1, subclassSlug?: string): this {
    const prefix = this.state.ruleset === '2014' ? 'srd-2014' : 'srd-2024';
    this.state = {
      ...this.state,
      classes: [
        ...this.state.classes,
        {
          classId: `${prefix}:class:${classSlug}` as DefinitionId,
          ...(subclassSlug ? { subclassId: `${prefix}:subclass:${subclassSlug}` as DefinitionId } : {}),
          level,
          isPrimary: this.state.classes.length === 0,
          hitDiceSpent: 0,
        },
      ],
    };
    return this;
  }

  withSpecies(slug: string, subspeciesSlug?: string): this {
    const prefix = this.state.ruleset === '2014' ? 'srd-2014' : 'srd-2024';
    this.state = {
      ...this.state,
      speciesId: `${prefix}:species:${slug}` as DefinitionId,
      ...(subspeciesSlug ? { subspeciesId: `${prefix}:subspecies:${subspeciesSlug}` as DefinitionId } : {}),
    };
    return this;
  }

  withBackground(slug: string): this {
    const prefix = this.state.ruleset === '2014' ? 'srd-2014' : 'srd-2024';
    this.state = { ...this.state, backgroundId: `${prefix}:background:${slug}` as DefinitionId };
    return this;
  }

  /** Añade un objeto por slug. `type` debe coincidir con el del contenido. */
  withItem(
    type: 'weapon' | 'armor' | 'gear' | 'magicItem',
    slug: string,
    options: { quantity?: number; slot?: EquipmentSlot; favorite?: boolean; attuned?: boolean } = {},
  ): this {
    const prefix = this.state.ruleset === '2014' ? 'srd-2014' : 'srd-2024';
    const item: InventoryItemState = {
      id: newInventoryItemId(),
      definitionId: `${prefix}:${type}:${slug}` as DefinitionId,
      quantity: options.quantity ?? 1,
      attuned: options.attuned ?? false,
      favorite: options.favorite ?? false,
      ...(options.slot ? { equippedSlot: options.slot } : {}),
    };
    this.state = { ...this.state, inventory: [...this.state.inventory, item] };
    return this;
  }

  withSkill(skill: SkillId, level: ProficiencyLevel = 'proficient'): this {
    this.state = {
      ...this.state,
      skillProficiencies: { ...this.state.skillProficiencies, [skill]: level },
    };
    return this;
  }

  withProficiency(...targets: string[]): this {
    this.state = { ...this.state, otherProficiencies: [...this.state.otherProficiencies, ...targets] };
    return this;
  }

  withHitPoints(current: number, temporary = 0): this {
    this.state = { ...this.state, hitPoints: { ...this.state.hitPoints, current, temporary } };
    return this;
  }

  withSettings(settings: Partial<CharacterState['settings']>): this {
    this.state = { ...this.state, settings: { ...this.state.settings, ...settings } };
    return this;
  }

  patch(fn: (s: CharacterState) => CharacterState): this {
    this.state = fn(this.state);
    return this;
  }

  build(): CharacterState {
    // Toda clase necesita al menos un nivel para que la ficha tenga sentido.
    if (this.state.classes.length === 0) return { ...this.state };
    return { ...this.state };
  }

  sheet(): CharacterSheet {
    const engine = new RulesEngine(SRD_RULES, this.state.ruleset);
    return resolveCharacter(this.build(), this.content, engine);
  }

  get contentIndex(): ContentIndex {
    return this.content;
  }
}

export const character = (ruleset: Ruleset = '2014') => new CharacterBuilder(ruleset);

/** Ficha a partir de un estado ya construido. */
export function sheetOf(state: CharacterState): CharacterSheet {
  const content = loadContent(state.ruleset);
  const engine = new RulesEngine(SRD_RULES, state.ruleset);
  return resolveCharacter(state, content, engine);
}
