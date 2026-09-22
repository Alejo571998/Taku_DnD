'use client';

import { useMemo } from 'react';
import type { AnyDefinition } from '@domain/content/schemas';
import { definitionSchema } from '@domain/content/schemas';
import { DAMAGE_TYPES, MAGIC_SCHOOLS, SIZE_ES, damageTypeEs, magicSchoolEs, sizeEs } from '@domain/content/labels';
import { homebrewId, slugify } from '@domain/content/homebrew';
import { ABILITIES, ABILITY_NAME_ES, type AbilityId } from '@domain/character/ability';
import { SKILLS, SKILL_NAME_ES, type SkillId } from '@domain/character/skill';
import {
  CASTER_KINDS,
  CASTER_KIND_LABEL,
  CLASS_LEVELS,
  DEFAULT_ASI_LEVELS,
  buildStandardProgression,
  type CasterKind,
} from '@domain/rules/standardProgression';
import { RULESETS, type Ruleset } from '@domain/rules/ruleset';
import { lb } from '@domain/shared/units';
import { cn } from '@ui/design-system/cn';
import { Button } from '@ui/design-system/Button';
import { Chip } from '@ui/design-system/primitives';
import { useContentIndex } from '@ui/hooks/useAppData';

/**
 * EDITOR DE CONTENIDO PROPIO (MASTER SPEC §33)
 *
 * El editor NO escribe JSON a mano: rellena el MISMO esquema Zod que valida el
 * SRD. Por eso lo que sale de acá entra en la biblioteca, en el buscador y en
 * el motor de reglas sin ningún camino especial.
 *
 * Cubre lo que de verdad se crea en una mesa: objetos y conjuros, que son el
 * 90% de los casos, y también las piezas grandes —dotes, trasfondos, especies
 * y clases enteras—, que son las que hacen que un mundo casero se sienta
 * propio.
 *
 * Las piezas grandes traen un problema que las chicas no tienen: NO SON UNA
 * DEFINICIÓN, son varias. Una especie son sus rasgos; una clase son sus
 * rasgos por nivel. Por eso `buildDefinition` devuelve una definición
 * principal MÁS sus acompañantes, y el que guarda las escribe todas. Sin eso
 * habría que pedirle al usuario que creara veinte rasgos sueltos y los
 * enlazara a mano por id.
 *
 * Lo que el editor NO pregunta es lo que el SRD ya decidió: el bonificador de
 * competencia por nivel y la forma de la tabla de espacios salen de
 * `standardProgression`. Pedirlos sería pedirle al usuario que copie una
 * tabla que no puede cambiar.
 */

export const EDITABLE_TYPES = [
  'weapon',
  'armor',
  'gear',
  'magicItem',
  'spell',
  'feat',
  'background',
  'species',
  'class',
] as const;
export type EditableType = (typeof EDITABLE_TYPES)[number];

export const EDITABLE_TYPE_LABEL: Record<EditableType, string> = {
  weapon: 'Arma',
  armor: 'Armadura',
  gear: 'Objeto',
  magicItem: 'Objeto mágico',
  spell: 'Conjuro',
  feat: 'Dote',
  background: 'Trasfondo',
  species: 'Especie',
  class: 'Clase',
};

/** Las que generan definiciones acompañantes y no llevan peso ni se equipan. */
const BIG_TYPES: readonly EditableType[] = ['feat', 'background', 'species', 'class'];
export const isBigType = (type: EditableType): boolean => BIG_TYPES.includes(type);

export type EditorDraft = {
  type: EditableType;
  ruleset: Ruleset;
  name: string;
  description: string;
  weightLb: string;
  // Arma
  weaponCategory: 'simple' | 'martial';
  rangeType: 'melee' | 'ranged';
  damageDice: string;
  damageType: string;
  // Armadura
  armorCategory: 'light' | 'medium' | 'heavy' | 'shield';
  baseAc: string;
  addsDexBonus: boolean;
  maxDexBonus: string;
  stealthDisadvantage: boolean;
  // Objeto
  gearCategory: string;
  consumable: boolean;
  // Objeto mágico
  rarity: 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact';
  requiresAttunement: boolean;
  // Conjuro
  level: string;
  school: string;
  castingTime: string;
  spellRange: string;
  components: string[];
  duration: string;
  concentration: boolean;
  ritual: boolean;
  // Compartido por dote, trasfondo y especie
  abilityBonuses: AbilityBonusRow[];
  // Dote
  featPrerequisites: string;
  featCategory: string;
  // Trasfondo
  skillProficiencies: string;
  toolProficiencies: string;
  languageOptions: string;
  startingGold: string;
  featureName: string;
  featureDescription: string;
  // Equipo inicial: lo usan trasfondo y clase, y lo lee el creador de personajes
  startingEquipment: EquipmentRow[];
  // Especie
  speed: string;
  size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
  languages: string;
  traits: NamedEntry[];
  // Clase
  hitDie: string;
  savingThrows: AbilityId[];
  armorProficiencies: string;
  weaponProficiencies: string;
  skillChoose: string;
  skillFrom: SkillId[];
  subclassLevel: string;
  caster: CasterKind;
  spellAbility: AbilityId;
  preparesSpells: boolean;
  ritualCasting: boolean;
  asiLevels: number[];
  classFeatures: LeveledEntry[];
  equipmentChoices: EquipmentChoice[];
  subclasses: SubclassEntry[];
};

/** Una fila de "+2 a Fuerza". Se guardan como texto porque el campo es texto. */
export type AbilityBonusRow = { ability: AbilityId; bonus: string };

/** Un rasgo de especie: nombre y qué hace. El id lo pone el sistema. */
export type NamedEntry = { name: string; description: string };

/** Un rasgo de clase, que además llega a un nivel concreto. */
export type LeveledEntry = NamedEntry & { level: string };

/** Una línea de equipo inicial: qué definición y cuántas unidades. */
export type EquipmentRow = { definitionId: string; quantity: string };

/**
 * «Una espada larga O un hacha de mano»: un grupo y sus alternativas.
 *
 * El esquema del SRD permite elegir varias de un grupo (`choose`), pero el
 * paso de equipo del creador dibuja una sola tarjeta seleccionada por grupo.
 * El editor no ofrece lo que el creador no sabe resolver: un `choose: 2` que
 * nadie puede cumplir sería peor que no tenerlo (MASTER PROMPT §75).
 */
export type EquipmentChoice = {
  label: string;
  options: { label: string; items: EquipmentRow[] }[];
};

/**
 * Una subclase casera: su nombre, su gancho y los rasgos que da por nivel.
 *
 * Sin esto, una clase propia quedaba ATASCADA: `resolveCharacter` avisa de
 * «subclase pendiente» al llegar al nivel que la clase declara, y la subida de
 * nivel solo la ofrece si hay alguna con ese `classId`. Una clase sin
 * subclases arrastraba ese aviso para siempre.
 */
export type SubclassEntry = { name: string; flavor: string; features: LeveledEntry[] };

export function emptyDraft(type: EditableType = 'weapon', ruleset: Ruleset = '2014'): EditorDraft {
  return {
    type,
    ruleset,
    name: '',
    description: '',
    weightLb: '1',
    weaponCategory: 'simple',
    rangeType: 'melee',
    damageDice: '1d6',
    damageType: 'slashing',
    armorCategory: 'light',
    baseAc: '11',
    addsDexBonus: true,
    maxDexBonus: '',
    stealthDisadvantage: false,
    gearCategory: 'Adventuring Gear',
    consumable: false,
    rarity: 'uncommon',
    requiresAttunement: false,
    level: '1',
    school: 'evocation',
    castingTime: '1 acción',
    spellRange: '30 pies',
    components: ['V', 'S'],
    duration: 'Instantáneo',
    concentration: false,
    ritual: false,
    abilityBonuses: [],
    featPrerequisites: '',
    featCategory: 'general',
    skillProficiencies: '',
    toolProficiencies: '',
    languageOptions: '0',
    startingGold: '0',
    featureName: '',
    featureDescription: '',
    startingEquipment: [],
    speed: '30',
    size: 'Medium',
    languages: 'Common',
    traits: [],
    hitDie: '8',
    savingThrows: [],
    armorProficiencies: '',
    weaponProficiencies: '',
    skillChoose: '2',
    skillFrom: [],
    subclassLevel: '3',
    caster: 'none',
    spellAbility: 'int',
    preparesSpells: false,
    ritualCasting: false,
    asiLevels: [...DEFAULT_ASI_LEVELS],
    classFeatures: [],
    equipmentChoices: [],
    subclasses: [],
  };
}

/** Rellena el borrador desde una definición existente, para editarla. */
export function draftFrom(definition: AnyDefinition): EditorDraft {
  const base = emptyDraft(definition.type as EditableType, definition.rulesets[0] ?? '2014');
  const d = definition as Record<string, unknown>;

  const draft: EditorDraft = {
    ...base,
    name: definition.name,
    description: definition.description.join('\n\n'),
    // El dominio guarda centesimas de libra; el editor pide libras.
    weightLb: typeof d.weight === 'number' ? String(d.weight / 100) : base.weightLb,
  };

  switch (definition.type) {
    case 'weapon':
      return {
        ...draft,
        weaponCategory: definition.category,
        rangeType: definition.rangeType,
        damageDice: definition.damage?.dice ?? base.damageDice,
        damageType: definition.damage?.damageType ?? base.damageType,
      };
    case 'armor':
      return {
        ...draft,
        armorCategory: definition.category,
        baseAc: String(definition.baseAc),
        addsDexBonus: definition.addsDexBonus,
        maxDexBonus: definition.maxDexBonus == null ? '' : String(definition.maxDexBonus),
        stealthDisadvantage: definition.stealthDisadvantage,
      };
    case 'gear':
      return { ...draft, gearCategory: definition.category, consumable: definition.consumable };
    case 'magicItem':
      return {
        ...draft,
        rarity: definition.rarity === 'varies' ? 'uncommon' : definition.rarity,
        requiresAttunement: definition.requiresAttunement,
      };
    case 'spell':
      return {
        ...draft,
        level: String(definition.level),
        school: definition.school,
        castingTime: definition.castingTime,
        spellRange: definition.range,
        components: [...definition.components],
        duration: definition.duration,
        concentration: definition.concentration,
        ritual: definition.ritual,
      };
    case 'feat':
      return {
        ...draft,
        featPrerequisites: definition.prerequisites.join('\n'),
        featCategory: definition.category,
        abilityBonuses: definition.abilityBonuses.map((b) => ({
          ability: b.ability,
          bonus: String(b.bonus),
        })),
      };
    case 'background':
      return {
        ...draft,
        skillProficiencies: definition.skillProficiencies.join(', '),
        toolProficiencies: definition.toolProficiencies.join(', '),
        languageOptions: String(definition.languageOptions),
        startingGold: String(definition.startingGold),
        featureName: definition.feature?.name ?? '',
        featureDescription: definition.feature?.description.join('\n\n') ?? '',
        abilityBonuses: definition.abilityBonuses.map((b) => ({
          ability: b.ability,
          bonus: String(b.bonus),
        })),
        startingEquipment: equipmentRowsFrom(definition.startingEquipment),
      };
    case 'species':
      // Los rasgos NO se recuperan acá: son definiciones aparte y el borrador
      // solo conoce sus ids. Los rellena `draftWithCompanions`, que sí tiene
      // la biblioteca a mano.
      return {
        ...draft,
        speed: String(definition.speed),
        size: definition.size,
        languages: definition.languages.join(', '),
        abilityBonuses: definition.abilityBonuses.map((b) => ({
          ability: b.ability,
          bonus: String(b.bonus),
        })),
      };
    case 'class': {
      const asiLevels = Object.entries(definition.progression)
        .filter(([, row]) => row.abilityScoreImprovement)
        .map(([level]) => Number(level))
        .sort((a, b) => a - b);
      return {
        ...draft,
        hitDie: String(definition.hitDie),
        savingThrows: [...definition.savingThrows],
        armorProficiencies: definition.armorProficiencies.join(', '),
        weaponProficiencies: definition.weaponProficiencies.join(', '),
        skillChoose: String(definition.skillChoices?.choose ?? 2),
        skillFrom: (definition.skillChoices?.from ?? []).filter((s): s is SkillId =>
          (SKILLS as readonly string[]).includes(s),
        ),
        subclassLevel: String(definition.subclassLevel),
        caster: casterKindOf(definition.progression),
        spellAbility: definition.spellcasting?.ability ?? 'int',
        preparesSpells: definition.spellcasting?.preparesSpells ?? false,
        ritualCasting: definition.spellcasting?.ritualCasting ?? false,
        asiLevels: asiLevels.length > 0 ? asiLevels : [...DEFAULT_ASI_LEVELS],
        startingEquipment: equipmentRowsFrom(definition.startingEquipment),
        equipmentChoices: definition.startingEquipmentOptions.map((group) => ({
          label: group.label,
          options: group.options.map((option) => ({
            label: option.label,
            items: equipmentRowsFrom(option.items),
          })),
        })),
      };
    }
    default:
      return draft;
  }
}

/** El dominio guarda cantidades como número; el editor las pide como texto. */
function equipmentRowsFrom(
  items: readonly { definitionId: string; quantity: number }[],
): EquipmentRow[] {
  return items.map((item) => ({ definitionId: item.definitionId, quantity: String(item.quantity) }));
}

/**
 * Deduce el tipo de lanzador mirando a qué nivel aparece el primer espacio.
 *
 * Se deduce en vez de guardarse porque el esquema del SRD no tiene ese campo:
 * la tabla es el dato, y "medio lanzador" es una forma de describirla.
 */
function casterKindOf(progression: Record<string, { spellcasting?: unknown }>): CasterKind {
  const first = Object.entries(progression)
    .filter(([, row]) => row.spellcasting != null)
    .map(([level]) => Number(level))
    .sort((a, b) => a - b)[0];
  if (first == null) return 'none';
  if (first <= 1) return 'full';
  if (first <= 2) return 'half';
  return 'third';
}

/**
 * Completa el borrador de una especie o una clase con sus acompañantes.
 *
 * `draftFrom` trabaja con UNA definición porque es lo único que tiene. Para
 * reeditar hay que volver a juntar los rasgos, que viven aparte y solo se
 * reconocen por el prefijo del id de su padre.
 */
export function draftWithCompanions(
  definition: AnyDefinition,
  library: readonly AnyDefinition[],
): EditorDraft {
  const draft = draftFrom(definition);
  if (definition.type === 'species') {
    const byId = new Map(library.map((d) => [d.id, d]));
    return {
      ...draft,
      traits: definition.traits
        .map((traitId) => byId.get(traitId))
        .filter((t): t is AnyDefinition => t != null)
        .map((t) => ({ name: t.name, description: t.description.join('\n\n') })),
    };
  }
  if (definition.type === 'class') {
    /*
      EL ORDEN LO MANDA LA DEFINICIÓN, NO LA BIBLIOTECA.

      Filtrar `library` por prefijo devuelve lo que devuelva IndexedDB, que va
      por id: dos subclases escritas como "del Ojo" y "del Muro" reaparecían
      al revés. La clase ya guarda su propio orden —`subclasses` y las filas
      de `progression`—, así que se lee de ahí.
    */
    const byId = new Map(library.map((d) => [d.id, d]));
    const leveled = (d: AnyDefinition, level: string): LeveledEntry => ({
      name: d.name,
      description: d.description.join('\n\n'),
      level,
    });

    const featuresOf = (progression: Record<string, { features?: readonly string[] }>) =>
      Object.keys(progression)
        .sort((a, b) => Number(a) - Number(b))
        .flatMap((level) =>
          (progression[level]?.features ?? [])
            .map((featureId) => byId.get(featureId))
            .filter((d): d is AnyDefinition => d?.type === 'feature')
            .map((d) => leveled(d, level)),
        );

    return {
      ...draft,
      classFeatures: featuresOf(definition.progression),
      // Los rasgos de una subclase cuelgan de ELLA, no de la clase, y por eso
      // no aparecen en la progresión de la clase. Si aparecieran, al volver a
      // guardar se escribirían dos veces y todo personaje de la clase los
      // recibiría sin haber elegido subclase.
      subclasses: definition.subclasses
        .map((subclassId) => byId.get(subclassId))
        .filter((d): d is AnyDefinition => d?.type === 'subclass')
        .map((sub) => ({
          name: sub.name,
          flavor: (sub as { flavor?: string }).flavor ?? '',
          features: featuresOf(
            (sub as { progression?: Record<string, { features?: readonly string[] }> })
              .progression ?? {},
          ),
        })),
    };
  }
  return draft;
}

export type BuildOutcome =
  | {
      ok: true;
      definition: AnyDefinition;
      /**
       * Los rasgos de una especie o de una clase. Se guardan junto a la
       * principal, que los referencia por id: el esquema del SRD enlaza, no
       * anida, y el contenido propio usa el mismo esquema.
       */
      companions: readonly AnyDefinition[];
    }
  | { ok: false; issues: readonly string[] };

/**
 * Borrador → definición válida.
 *
 * Pasa por el MISMO esquema que el SRD. Si no valida, no entra: el editor no
 * tiene una puerta trasera por ser "contenido propio".
 */
export function buildDefinition(
  draft: EditorDraft,
  workspaceId: string,
  existingId?: string,
): BuildOutcome {
  const issues: string[] = [];
  if (draft.name.trim().length === 0) issues.push('Ponele un nombre.');
  if (draft.type === 'class' && draft.savingThrows.length !== 2) {
    issues.push('Una clase tiene competencia en exactamente dos salvaciones.');
  }
  if (issues.length > 0) return { ok: false, issues };

  const id = existingId ?? homebrewId(workspaceId, draft.type, draft.name);
  const weight = lb(Number(draft.weightLb) || 0);

  const shared = {
    id,
    name: draft.name.trim(),
    rulesets: [draft.ruleset],
    sourceId: `homebrew:${workspaceId}`,
    version: '1.0.0',
    language: 'es-419',
    description: draft.description
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0),
  };

  /** Base para un acompañante, con id derivado del padre para que sea estable. */
  const companionBase = (kind: string, entryName: string, entryDescription: string) => ({
    ...shared,
    id: `${id}:${kind}:${slugify(entryName)}`,
    name: entryName.trim(),
    description: entryDescription
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0),
  });

  const companionCandidates: unknown[] = [];
  const abilityBonuses = draft.abilityBonuses
    .filter((b) => b.bonus.trim() !== '' && Number(b.bonus) !== 0)
    .map((b) => ({ ability: b.ability, bonus: Number(b.bonus) || 0 }));
  const commaList = (value: string) =>
    value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  // Una fila sin definición elegida no es equipo: es una fila a medio llenar.
  const equipmentItems = (rows: readonly EquipmentRow[]) =>
    rows
      .filter((row) => row.definitionId.trim().length > 0)
      .map((row) => ({
        definitionId: row.definitionId,
        quantity: Math.max(1, Number(row.quantity) || 1),
      }));

  let candidate: unknown;
  switch (draft.type) {
    case 'weapon':
      candidate = {
        ...shared,
        type: 'weapon',
        category: draft.weaponCategory,
        rangeType: draft.rangeType,
        damage: { dice: draft.damageDice.trim(), damageType: draft.damageType },
        properties: [],
        weight,
      };
      break;
    case 'armor':
      candidate = {
        ...shared,
        type: 'armor',
        category: draft.armorCategory,
        baseAc: Number(draft.baseAc) || 10,
        addsDexBonus: draft.addsDexBonus,
        maxDexBonus: draft.maxDexBonus === '' ? null : Number(draft.maxDexBonus),
        strMinimum: 0,
        stealthDisadvantage: draft.stealthDisadvantage,
        weight,
      };
      break;
    case 'gear':
      candidate = {
        ...shared,
        type: 'gear',
        category: draft.gearCategory.trim() || 'Adventuring Gear',
        weight,
        packSize: 1,
        consumable: draft.consumable,
        ammunition: false,
      };
      break;
    case 'magicItem':
      candidate = {
        ...shared,
        type: 'magicItem',
        rarity: draft.rarity,
        requiresAttunement: draft.requiresAttunement,
        category: 'Wondrous Items',
        weight,
      };
      break;
    case 'spell':
      candidate = {
        ...shared,
        type: 'spell',
        level: Number(draft.level) || 0,
        school: draft.school,
        castingTime: draft.castingTime.trim() || '1 acción',
        range: draft.spellRange.trim() || 'Personal',
        components: draft.components,
        duration: draft.duration.trim() || 'Instantáneo',
        concentration: draft.concentration,
        ritual: draft.ritual,
        higherLevel: [],
        classes: [],
      };
      break;
    case 'feat':
      candidate = {
        ...shared,
        type: 'feat',
        prerequisites: draft.featPrerequisites
          .split('\n')
          .map((p) => p.trim())
          .filter((p) => p.length > 0),
        category: draft.featCategory.trim() || 'general',
        abilityBonuses,
      };
      break;
    case 'background': {
      const feature =
        draft.featureName.trim().length > 0
          ? {
              name: draft.featureName.trim(),
              description: draft.featureDescription
                .split('\n')
                .map((p) => p.trim())
                .filter((p) => p.length > 0),
            }
          : undefined;
      candidate = {
        ...shared,
        type: 'background',
        skillProficiencies: commaList(draft.skillProficiencies),
        toolProficiencies: commaList(draft.toolProficiencies),
        languageOptions: Number(draft.languageOptions) || 0,
        abilityBonuses,
        startingEquipment: equipmentItems(draft.startingEquipment),
        startingGold: Number(draft.startingGold) || 0,
        ...(feature ? { feature } : {}),
        personalityTraits: [],
        ideals: [],
        bonds: [],
        flaws: [],
      };
      break;
    }
    case 'species': {
      // Los rasgos se convierten en definiciones propias y la especie los
      // enlaza. Así un rasgo casero aparece en la biblioteca y en el buscador
      // igual que "Visión en la oscuridad", sin ningún camino especial.
      const traits = draft.traits.filter((t) => t.name.trim().length > 0);
      for (const trait of traits) {
        companionCandidates.push({
          ...companionBase('trait', trait.name, trait.description),
          type: 'trait',
          speciesIds: [id],
        });
      }
      candidate = {
        ...shared,
        type: 'species',
        speed: Number(draft.speed) || 30,
        size: draft.size,
        sizeDescription: '',
        abilityBonuses,
        languages: commaList(draft.languages),
        traits: traits.map((t) => `${id}:trait:${slugify(t.name)}`),
        subspecies: [],
        age: '',
        alignment: '',
      };
      break;
    }
    case 'class': {
      const features = draft.classFeatures.filter((f) => f.name.trim().length > 0);
      const featuresByLevel: Record<number, string[]> = {};

      for (const feature of features) {
        const level = Math.max(1, Math.min(20, Number(feature.level) || 1));
        const featureId = `${id}:feature:${slugify(feature.name)}`;
        companionCandidates.push({
          ...companionBase('feature', feature.name, feature.description),
          type: 'feature',
          classId: id,
          level,
        });
        (featuresByLevel[level] ??= []).push(featureId);
      }

      /*
        Cada subclase es una definición más, con sus propios rasgos colgando
        de ella. El motor no necesita saber que salieron del mismo formulario:
        las encuentra por `classId`, igual que a las del SRD.
      */
      const subclasses = draft.subclasses.filter((s) => s.name.trim().length > 0);
      const subclassIds: string[] = [];

      for (const subclass of subclasses) {
        const subclassId = `${id}:subclass:${slugify(subclass.name)}`;
        subclassIds.push(subclassId);
        const progression: Record<string, { features: string[] }> = {};

        for (const feature of subclass.features.filter((f) => f.name.trim().length > 0)) {
          const level = Math.max(1, Math.min(20, Number(feature.level) || 1));
          const featureId = `${subclassId}:feature:${slugify(feature.name)}`;
          companionCandidates.push({
            ...companionBase('feature', feature.name, feature.description),
            id: featureId,
            type: 'feature',
            classId: id,
            subclassId,
            level,
          });
          (progression[String(level)] ??= { features: [] }).features.push(featureId);
        }

        companionCandidates.push({
          ...companionBase('subclass', subclass.name, subclass.flavor),
          id: subclassId,
          type: 'subclass',
          classId: id,
          flavor: subclass.flavor.trim(),
          progression,
        });
      }

      candidate = {
        ...shared,
        type: 'class',
        hitDie: Number(draft.hitDie) || 8,
        savingThrows: draft.savingThrows,
        armorProficiencies: commaList(draft.armorProficiencies),
        weaponProficiencies: commaList(draft.weaponProficiencies),
        toolProficiencies: [],
        ...(draft.skillFrom.length > 0
          ? { skillChoices: { choose: Number(draft.skillChoose) || 2, from: draft.skillFrom } }
          : {}),
        startingEquipment: equipmentItems(draft.startingEquipment),
        startingEquipmentOptions: draft.equipmentChoices
          .map((group, index) => ({
            choose: 1,
            label: group.label.trim() || `Opción ${index + 1}`,
            options: group.options
              .map((option, optionIndex) => ({
                label: option.label.trim() || `Alternativa ${optionIndex + 1}`,
                items: equipmentItems(option.items),
              }))
              .filter((option) => option.items.length > 0),
          }))
          // Un grupo con una sola alternativa no es una elección: es equipo
          // fijo con un paso de más. El creador lo pintaría igual y la única
          // respuesta posible sería la que ya está.
          .filter((group) => group.options.length > 1),
        ...(draft.caster !== 'none'
          ? {
              spellcasting: {
                ability: draft.spellAbility,
                startsAtLevel: draft.caster === 'full' ? 1 : draft.caster === 'half' ? 2 : 3,
                preparesSpells: draft.preparesSpells,
                ritualCasting: draft.ritualCasting,
              },
            }
          : {}),
        progression: buildStandardProgression({
          caster: draft.caster,
          asiLevels: draft.asiLevels,
          featuresByLevel,
        }),
        subclassLevel: Number(draft.subclassLevel) || 3,
        subclasses: subclassIds,
      };
      break;
    }
    default:
      return { ok: false, issues: ['Tipo desconocido.'] };
  }

  const parsed = definitionSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `${i.path.join('.') || 'contenido'}: ${i.message}`),
    };
  }

  // Los acompañantes pasan por el mismo esquema. Si uno no valida, no se
  // guarda NADA: una especie con la mitad de sus rasgos es peor que ninguna.
  const companions: AnyDefinition[] = [];
  for (const raw of companionCandidates) {
    const companion = definitionSchema.safeParse(raw);
    if (!companion.success) {
      return {
        ok: false,
        issues: companion.error.issues.map(
          (i) => `rasgo · ${i.path.join('.') || 'contenido'}: ${i.message}`,
        ),
      };
    }
    companions.push(companion.data);
  }

  return { ok: true, definition: parsed.data, companions };
}

// ── Formulario ───────────────────────────────────────────────────────────────

export function HomebrewForm({
  draft,
  onChange,
  issues,
}: {
  draft: EditorDraft;
  onChange: (next: EditorDraft) => void;
  issues: readonly string[];
}) {
  const set = <K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) =>
    onChange({ ...draft, [key]: value });

  /*
    El catálogo del selector de equipo sale del índice de la EDICIÓN que se
    está editando. Un trasfondo de 2024 no puede empezar con un objeto que
    solo existe en 2014: el creador no lo encontraría y el personaje arrancaría
    con una fila de inventario apuntando a la nada.

    Incluye el contenido propio porque sale de la misma tabla, así que una
    clase casera puede empezar con un arma casera.
  */
  const content = useContentIndex(draft.ruleset);
  const catalogue = useMemo(() => {
    if (!content) return [];
    return EQUIPPABLE_TYPES.flatMap((type) =>
      content.all(type).map((d) => ({ id: d.id, name: d.name, type: d.type })),
    ).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [content]);

  return (
    <div className="space-y-5">
      {issues.length > 0 && (
        <ul
          role="alert"
          className="space-y-1 rounded-[var(--radius-md)] border border-[var(--danger-text)]/35 bg-[var(--danger-muted)] px-3.5 py-2.5 text-xs text-[var(--text-secondary)]"
        >
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}

      <Segmented
        label="Tipo"
        wrap
        options={EDITABLE_TYPES.map((t) => ({ value: t, label: EDITABLE_TYPE_LABEL[t] }))}
        value={draft.type}
        onChange={(v) => onChange({ ...emptyDraft(v as EditableType, draft.ruleset), name: draft.name })}
      />

      <Segmented
        label="Reglas"
        options={RULESETS.map((r) => ({ value: r, label: r }))}
        value={draft.ruleset}
        onChange={(v) => set('ruleset', v as Ruleset)}
      />

      <Text id="hb-name" label="Nombre" value={draft.name} onChange={(v) => set('name', v)} />

      {draft.type === 'weapon' && (
        <>
          <Segmented
            label="Categoría"
            options={[
              { value: 'simple', label: 'Sencilla' },
              { value: 'martial', label: 'Marcial' },
            ]}
            value={draft.weaponCategory}
            onChange={(v) => set('weaponCategory', v as 'simple' | 'martial')}
          />
          <Segmented
            label="Alcance"
            options={[
              { value: 'melee', label: 'Cuerpo a cuerpo' },
              { value: 'ranged', label: 'A distancia' },
            ]}
            value={draft.rangeType}
            onChange={(v) => set('rangeType', v as 'melee' | 'ranged')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Text id="hb-dice" label="Daño" value={draft.damageDice} onChange={(v) => set('damageDice', v)} placeholder="1d8" />
            <Select
              id="hb-damage-type"
              label="Tipo de daño"
              value={draft.damageType}
              onChange={(v) => set('damageType', v)}
              options={DAMAGE_TYPES.map((d) => ({ value: d, label: damageTypeEs(d) }))}
            />
          </div>
        </>
      )}

      {draft.type === 'armor' && (
        <>
          <Segmented
            label="Categoría"
            options={[
              { value: 'light', label: 'Ligera' },
              { value: 'medium', label: 'Media' },
              { value: 'heavy', label: 'Pesada' },
              { value: 'shield', label: 'Escudo' },
            ]}
            value={draft.armorCategory}
            onChange={(v) => set('armorCategory', v as EditorDraft['armorCategory'])}
          />
          <div className="grid grid-cols-2 gap-3">
            <Text id="hb-ac" label="CA base" value={draft.baseAc} onChange={(v) => set('baseAc', v)} numeric />
            <Text
              id="hb-maxdex"
              label="Tope de Destreza"
              value={draft.maxDexBonus}
              onChange={(v) => set('maxDexBonus', v)}
              placeholder="sin tope"
              numeric
            />
          </div>
          <Toggle label="Suma el modificador de Destreza" value={draft.addsDexBonus} onChange={(v) => set('addsDexBonus', v)} />
          <Toggle label="Desventaja en Sigilo" value={draft.stealthDisadvantage} onChange={(v) => set('stealthDisadvantage', v)} />
        </>
      )}

      {draft.type === 'gear' && (
        <>
          <Text id="hb-cat" label="Categoría" value={draft.gearCategory} onChange={(v) => set('gearCategory', v)} />
          <Toggle label="Se consume al usarlo" value={draft.consumable} onChange={(v) => set('consumable', v)} />
        </>
      )}

      {draft.type === 'magicItem' && (
        <>
          <Select
            id="hb-rarity"
            label="Rareza"
            value={draft.rarity}
            onChange={(v) => set('rarity', v as EditorDraft['rarity'])}
            options={[
              { value: 'common', label: 'Común' },
              { value: 'uncommon', label: 'Poco común' },
              { value: 'rare', label: 'Raro' },
              { value: 'very rare', label: 'Muy raro' },
              { value: 'legendary', label: 'Legendario' },
              { value: 'artifact', label: 'Artefacto' },
            ]}
          />
          <Toggle label="Requiere sintonización" value={draft.requiresAttunement} onChange={(v) => set('requiresAttunement', v)} />
        </>
      )}

      {draft.type === 'spell' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Select
              id="hb-level"
              label="Nivel"
              value={draft.level}
              onChange={(v) => set('level', v)}
              options={[
                { value: '0', label: 'Truco' },
                ...Array.from({ length: 9 }, (_, i) => ({ value: String(i + 1), label: `Nivel ${i + 1}` })),
              ]}
            />
            <Select
              id="hb-school"
              label="Escuela"
              value={draft.school}
              onChange={(v) => set('school', v)}
              options={MAGIC_SCHOOLS.map((s) => ({ value: s, label: magicSchoolEs(s) }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Text id="hb-time" label="Tiempo de lanzamiento" value={draft.castingTime} onChange={(v) => set('castingTime', v)} />
            <Text id="hb-range" label="Alcance" value={draft.spellRange} onChange={(v) => set('spellRange', v)} />
          </div>
          <Text id="hb-duration" label="Duración" value={draft.duration} onChange={(v) => set('duration', v)} />
          <fieldset>
            <legend className="text-xs font-medium text-[var(--text-secondary)]">Componentes</legend>
            <div className="mt-1.5 flex gap-2">
              {(['V', 'S', 'M'] as const).map((c) => {
                const active = draft.components.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      set(
                        'components',
                        active ? draft.components.filter((x) => x !== c) : [...draft.components, c],
                      )
                    }
                    className={cn(
                      'h-10 w-12 rounded-[var(--radius-md)] border text-sm font-medium transition-colors',
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent-text)]'
                        : 'border-[var(--border-default)] text-[var(--text-tertiary)]',
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <Toggle label="Concentración" value={draft.concentration} onChange={(v) => set('concentration', v)} />
          <Toggle label="Ritual" value={draft.ritual} onChange={(v) => set('ritual', v)} />
        </>
      )}

      {draft.type === 'feat' && (
        <>
          <Text id="hb-feat-cat" label="Categoría" value={draft.featCategory} onChange={(v) => set('featCategory', v)} />
          <LongText
            id="hb-feat-prereq"
            label="Requisitos"
            rows={2}
            value={draft.featPrerequisites}
            onChange={(v) => set('featPrerequisites', v)}
            placeholder={'Uno por línea.\nFuerza 13 o más'}
          />
          <AbilityBonuses rows={draft.abilityBonuses} onChange={(v) => set('abilityBonuses', v)} />
        </>
      )}

      {draft.type === 'background' && (
        <>
          <Text
            id="hb-bg-skills"
            label="Habilidades"
            value={draft.skillProficiencies}
            onChange={(v) => set('skillProficiencies', v)}
            placeholder="Separadas por comas"
          />
          <Text
            id="hb-bg-tools"
            label="Herramientas"
            value={draft.toolProficiencies}
            onChange={(v) => set('toolProficiencies', v)}
            placeholder="Separadas por comas"
          />
          <div className="grid grid-cols-2 gap-3">
            <Text id="hb-bg-langs" label="Idiomas a elegir" value={draft.languageOptions} onChange={(v) => set('languageOptions', v)} numeric />
            <Text id="hb-bg-gold" label="Oro inicial" value={draft.startingGold} onChange={(v) => set('startingGold', v)} numeric />
          </div>
          <Text id="hb-bg-feat" label="Rasgo del trasfondo" value={draft.featureName} onChange={(v) => set('featureName', v)} placeholder="Refugio del pueblo" />
          {draft.featureName.trim().length > 0 && (
            <LongText
              id="hb-bg-featdesc"
              label="Qué hace ese rasgo"
              rows={3}
              value={draft.featureDescription}
              onChange={(v) => set('featureDescription', v)}
            />
          )}
          {draft.ruleset === '2024' && (
            <AbilityBonuses rows={draft.abilityBonuses} onChange={(v) => set('abilityBonuses', v)} />
          )}
          <EquipmentList
            legend="Equipo inicial"
            hint="Va directo al inventario al crear el personaje, además del de la clase."
            rows={draft.startingEquipment}
            onChange={(v) => set('startingEquipment', v)}
            catalogue={catalogue}
            idPrefix="hb-bg-equip"
          />
        </>
      )}

      {draft.type === 'species' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Text id="hb-speed" label="Velocidad (pies)" value={draft.speed} onChange={(v) => set('speed', v)} numeric />
            <Select
              id="hb-size"
              label="Tamaño"
              value={draft.size}
              onChange={(v) => set('size', v as EditorDraft['size'])}
              options={Object.keys(SIZE_ES).map((s) => ({ value: s, label: sizeEs(s) }))}
            />
          </div>
          <Text id="hb-langs" label="Idiomas" value={draft.languages} onChange={(v) => set('languages', v)} placeholder="Separados por comas" />
          {/* En 2014 los bonificadores los da la especie; en 2024, el trasfondo. */}
          {draft.ruleset === '2014' && (
            <AbilityBonuses rows={draft.abilityBonuses} onChange={(v) => set('abilityBonuses', v)} />
          )}
          <EntryList
            legend="Rasgos"
            hint="Cada rasgo se guarda como una definición propia y aparece en la biblioteca."
            entries={draft.traits}
            onChange={(v) => set('traits', v)}
            addLabel="Añadir rasgo"
            namePlaceholder="Visión en la oscuridad"
          />
        </>
      )}

      {draft.type === 'class' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Select
              id="hb-hitdie"
              label="Dado de golpe"
              value={draft.hitDie}
              onChange={(v) => set('hitDie', v)}
              options={['6', '8', '10', '12'].map((d) => ({ value: d, label: `d${d}` }))}
            />
            <Text id="hb-subclass-lvl" label="Nivel de subclase" value={draft.subclassLevel} onChange={(v) => set('subclassLevel', v)} numeric />
          </div>

          <PickList
            legend="Salvaciones (elegí dos)"
            options={ABILITIES.map((a) => ({ value: a, label: ABILITY_NAME_ES[a] }))}
            selected={draft.savingThrows}
            onChange={(v) => set('savingThrows', v as AbilityId[])}
            max={2}
          />

          <Text
            id="hb-armor-prof"
            label="Armaduras"
            value={draft.armorProficiencies}
            onChange={(v) => set('armorProficiencies', v)}
            placeholder="light, medium, shields"
          />
          <Text
            id="hb-weapon-prof"
            label="Armas"
            value={draft.weaponProficiencies}
            onChange={(v) => set('weaponProficiencies', v)}
            placeholder="simple, martial"
          />

          <Text id="hb-skill-choose" label="Cuántas habilidades elige" value={draft.skillChoose} onChange={(v) => set('skillChoose', v)} numeric />
          <PickList
            legend="De cuáles puede elegir"
            options={SKILLS.map((s) => ({ value: s, label: SKILL_NAME_ES[s] }))}
            selected={draft.skillFrom}
            onChange={(v) => set('skillFrom', v as SkillId[])}
          />

          <Select
            id="hb-caster"
            label="Conjuros"
            value={draft.caster}
            onChange={(v) => set('caster', v as CasterKind)}
            options={CASTER_KINDS.map((k) => ({ value: k, label: CASTER_KIND_LABEL[k] }))}
          />
          {draft.caster !== 'none' && (
            <>
              <Select
                id="hb-spell-ability"
                label="Característica de lanzamiento"
                value={draft.spellAbility}
                onChange={(v) => set('spellAbility', v as AbilityId)}
                options={ABILITIES.map((a) => ({ value: a, label: ABILITY_NAME_ES[a] }))}
              />
              <Toggle label="Prepara conjuros" value={draft.preparesSpells} onChange={(v) => set('preparesSpells', v)} />
              <Toggle label="Puede lanzar rituales" value={draft.ritualCasting} onChange={(v) => set('ritualCasting', v)} />
              <p className="text-2xs leading-relaxed text-[var(--text-tertiary)]">
                La tabla de espacios la pone el sistema, igual que el bonificador de
                competencia. Son las del SRD y no cambian entre clases.
              </p>
            </>
          )}

          <PickList
            legend="Niveles con mejora de característica"
            options={CLASS_LEVELS.map((l) => ({ value: String(l), label: String(l) }))}
            selected={draft.asiLevels.map(String)}
            onChange={(v) => set('asiLevels', v.map(Number).sort((a, b) => a - b))}
            compact
          />

          <EntryList
            legend="Rasgos por nivel"
            hint="Cada rasgo se guarda aparte y la clase lo enlaza en su nivel."
            entries={draft.classFeatures}
            onChange={(v) => set('classFeatures', v as LeveledEntry[])}
            addLabel="Añadir rasgo"
            namePlaceholder="Oleada de acción"
            leveled
          />

          <SubclassList
            subclasses={draft.subclasses}
            onChange={(v) => set('subclasses', v)}
            subclassLevel={draft.subclassLevel}
          />

          <EquipmentList
            legend="Equipo inicial fijo"
            hint="Lo que llevan todos, sin elegir. Va al inventario al crear el personaje."
            rows={draft.startingEquipment}
            onChange={(v) => set('startingEquipment', v)}
            catalogue={catalogue}
            idPrefix="hb-class-equip"
          />

          <EquipmentChoiceList
            choices={draft.equipmentChoices}
            onChange={(v) => set('equipmentChoices', v)}
            catalogue={catalogue}
          />
        </>
      )}

      {!isBigType(draft.type) && draft.type !== 'spell' && (
        <Text
          id="hb-weight"
          label="Peso (libras)"
          value={draft.weightLb}
          onChange={(v) => set('weightLb', v)}
          numeric
        />
      )}

      <div>
        <label htmlFor="hb-desc" className="block text-xs font-medium text-[var(--text-secondary)]">
          Descripción
        </label>
        <textarea
          id="hb-desc"
          rows={5}
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Qué hace, cómo se usa, de dónde salió."
          className="mt-1.5 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm leading-relaxed outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
        />
      </div>
    </div>
  );
}

/** Vista previa en vivo: lo que el jugador va a ver en la biblioteca. */
export function DraftPreview({ draft, workspaceId }: { draft: EditorDraft; workspaceId: string }) {
  const outcome = useMemo(() => buildDefinition(draft, workspaceId), [draft, workspaceId]);
  if (!outcome.ok) return null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3.5">
      <p className="text-2xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Vista previa</p>
      <p className="mt-1.5 text-sm font-medium">{outcome.definition.name}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip tone="accent">{EDITABLE_TYPE_LABEL[draft.type]}</Chip>
        <Chip tone="neutral">{draft.ruleset}</Chip>
        <Chip tone="neutral">Propio</Chip>
      </div>
      <p className="mt-2 break-all text-2xs text-[var(--text-tertiary)]">{outcome.definition.id}</p>
    </div>
  );
}

// ── Controles ────────────────────────────────────────────────────────────────

function Text({
  id,
  label,
  value,
  onChange,
  placeholder,
  numeric,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode={numeric ? 'numeric' : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
      />
    </div>
  );
}

function LongText({
  id,
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm leading-relaxed outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
      />
    </div>
  );
}

/**
 * Selección múltiple sobre una lista cerrada.
 *
 * `max` sirve para "elegí dos salvaciones": al llegar al tope, marcar otra
 * suelta la más antigua en vez de no hacer nada. Un botón que deja de
 * responder parece roto.
 */
function PickList({
  legend,
  options,
  selected,
  onChange,
  max,
  compact,
}: {
  legend: string;
  options: { value: string; label: string }[];
  selected: readonly string[];
  onChange: (v: string[]) => void;
  max?: number;
  compact?: boolean;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
      return;
    }
    const next = [...selected, value];
    onChange(max != null && next.length > max ? next.slice(next.length - max) : next);
  };

  return (
    <fieldset>
      <legend className="text-xs font-medium text-[var(--text-secondary)]">{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(o.value)}
              className={cn(
                'rounded-[var(--radius-md)] border text-xs font-medium transition-colors',
                compact ? 'h-9 w-9' : 'h-9 px-3',
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent-text)]'
                  : 'border-[var(--border-default)] text-[var(--text-tertiary)]',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Filas de "+2 a Fuerza". Sin filas no hay bonificadores, que es lo normal. */
function AbilityBonuses({
  rows,
  onChange,
}: {
  rows: readonly AbilityBonusRow[];
  onChange: (v: AbilityBonusRow[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-[var(--text-secondary)]">
        Bonificadores de característica
      </legend>
      <div className="mt-1.5 space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <select
              aria-label={`Característica ${index + 1}`}
              value={row.ability}
              onChange={(e) =>
                onChange(rows.map((r, i) => (i === index ? { ...r, ability: e.target.value as AbilityId } : r)))
              }
              className="h-10 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 text-sm outline-none focus:border-[var(--accent)]"
            >
              {ABILITIES.map((a) => (
                <option key={a} value={a}>
                  {ABILITY_NAME_ES[a]}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              aria-label={`Bonificador ${index + 1}`}
              value={row.bonus}
              onChange={(e) =>
                onChange(rows.map((r, i) => (i === index ? { ...r, bonus: e.target.value } : r)))
              }
              className="h-10 w-16 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 text-center text-sm outline-none focus:border-[var(--accent)]"
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Quitar bonificador ${index + 1}`}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              Quitar
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...rows, { ability: 'str', bonus: '1' }])}
        >
          Añadir bonificador
        </Button>
      </div>
    </fieldset>
  );
}

/** Lista de rasgos con nombre y texto, y nivel cuando son de una clase. */
function EntryList({
  legend,
  hint,
  entries,
  onChange,
  addLabel,
  namePlaceholder,
  leveled,
  scope = 'rasgo',
}: {
  legend: string;
  hint: string;
  entries: readonly (NamedEntry | LeveledEntry)[];
  onChange: (v: (NamedEntry | LeveledEntry)[]) => void;
  addLabel: string;
  namePlaceholder: string;
  leveled?: boolean;
  /**
   * Con qué nombre se anuncian los campos. Una clase con subclases tiene VARIAS
   * listas de rasgos en la misma pantalla, y sin esto todas se llamarían
   * "Nombre del rasgo 1": quien la recorre escuchando no sabría en cuál está.
   */
  scope?: string;
}) {
  const update = (index: number, patch: Partial<LeveledEntry>) =>
    onChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));

  return (
    <fieldset>
      <legend className="text-xs font-medium text-[var(--text-secondary)]">{legend}</legend>
      <p className="mt-1 text-2xs leading-relaxed text-[var(--text-tertiary)]">{hint}</p>
      <div className="mt-2 space-y-3">
        {entries.map((entry, index) => (
          <div
            key={index}
            className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3"
          >
            <div className="flex items-center gap-2">
              {leveled && (
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`Nivel del ${scope} ${index + 1}`}
                  value={(entry as LeveledEntry).level ?? '1'}
                  onChange={(e) => update(index, { level: e.target.value })}
                  className="h-10 w-14 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-center text-sm outline-none focus:border-[var(--accent)]"
                />
              )}
              <input
                type="text"
                aria-label={`Nombre del ${scope} ${index + 1}`}
                value={entry.name}
                placeholder={namePlaceholder}
                onChange={(e) => update(index, { name: e.target.value })}
                className="h-10 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Quitar el ${scope} ${index + 1}`}
                onClick={() => onChange(entries.filter((_, i) => i !== index))}
              >
                Quitar
              </Button>
            </div>
            <textarea
              rows={2}
              aria-label={`Qué hace el ${scope} ${index + 1}`}
              value={entry.description}
              placeholder="Qué hace."
              onChange={(e) => update(index, { description: e.target.value })}
              className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
            />
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            onChange([...entries, leveled ? { name: '', description: '', level: '1' } : { name: '', description: '' }])
          }
        >
          {addLabel}
        </Button>
      </div>
    </fieldset>
  );
}

/** Lo que se puede llevar en la mochila, que es lo que puede ser equipo inicial. */
const EQUIPPABLE_TYPES = ['weapon', 'armor', 'gear', 'magicItem'] as const;

/**
 * Filas de equipo inicial.
 *
 * El selector es un `<select>` nativo con mil y pico entradas y no un buscador
 * a medida: el nativo ya trae búsqueda por teclado, funciona con lector de
 * pantalla sin que haya que reimplementar nada, y en el móvil abre la rueda
 * del sistema. Un combo propio sería más bonito y peor.
 */
function EquipmentList({
  legend,
  hint,
  rows,
  onChange,
  catalogue,
  idPrefix,
}: {
  legend: string;
  hint: string;
  rows: readonly EquipmentRow[];
  onChange: (v: EquipmentRow[]) => void;
  catalogue: readonly { id: string; name: string; type: string }[];
  idPrefix: string;
}) {
  const update = (index: number, patch: Partial<EquipmentRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <fieldset>
      <legend className="text-xs font-medium text-[var(--text-secondary)]">{legend}</legend>
      <p className="mt-1 text-2xs leading-relaxed text-[var(--text-tertiary)]">{hint}</p>
      <div className="mt-2 space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <select
              aria-label={`Objeto ${index + 1}`}
              value={row.definitionId}
              onChange={(e) => update(index, { definitionId: e.target.value })}
              className="h-10 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="">Elegí un objeto…</option>
              {EQUIPPABLE_TYPES.map((type) => (
                <optgroup key={type} label={EDITABLE_TYPE_LABEL[type]}>
                  {catalogue
                    .filter((item) => item.type === type)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              aria-label={`Cuántas unidades del objeto ${index + 1}`}
              value={row.quantity}
              onChange={(e) => update(index, { quantity: e.target.value })}
              className="h-10 w-14 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 text-center text-sm outline-none focus:border-[var(--accent)]"
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Quitar el objeto ${index + 1}`}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              Quitar
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          id={`${idPrefix}-add`}
          onClick={() => onChange([...rows, { definitionId: '', quantity: '1' }])}
        >
          Añadir objeto
        </Button>
      </div>
    </fieldset>
  );
}

/** Grupos de «esto O lo otro». El creador pinta una tarjeta por alternativa. */
function EquipmentChoiceList({
  choices,
  onChange,
  catalogue,
}: {
  choices: readonly EquipmentChoice[];
  onChange: (v: EquipmentChoice[]) => void;
  catalogue: readonly { id: string; name: string; type: string }[];
}) {
  const updateChoice = (index: number, patch: Partial<EquipmentChoice>) =>
    onChange(choices.map((choice, i) => (i === index ? { ...choice, ...patch } : choice)));

  return (
    <fieldset>
      <legend className="text-xs font-medium text-[var(--text-secondary)]">
        Equipo a elegir
      </legend>
      <p className="mt-1 text-2xs leading-relaxed text-[var(--text-tertiary)]">
        «Una espada larga o un hacha de mano». Hacen falta al menos dos alternativas
        por grupo: con una sola no hay nada que elegir y no se guarda.
      </p>
      <div className="mt-2 space-y-3">
        {choices.map((choice, index) => (
          <div
            key={index}
            className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                aria-label={`Nombre del grupo ${index + 1}`}
                value={choice.label}
                placeholder="Arma principal"
                onChange={(e) => updateChoice(index, { label: e.target.value })}
                className="h-10 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Quitar el grupo ${index + 1}`}
                onClick={() => onChange(choices.filter((_, i) => i !== index))}
              >
                Quitar
              </Button>
            </div>

            {choice.options.map((option, optionIndex) => (
              <div
                key={optionIndex}
                className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-2.5"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    aria-label={`Alternativa ${optionIndex + 1} del grupo ${index + 1}`}
                    value={option.label}
                    placeholder="Espada larga"
                    onChange={(e) =>
                      updateChoice(index, {
                        options: choice.options.map((o, i) =>
                          i === optionIndex ? { ...o, label: e.target.value } : o,
                        ),
                      })
                    }
                    className="h-10 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Quitar la alternativa ${optionIndex + 1} del grupo ${index + 1}`}
                    onClick={() =>
                      updateChoice(index, {
                        options: choice.options.filter((_, i) => i !== optionIndex),
                      })
                    }
                  >
                    Quitar
                  </Button>
                </div>
                <EquipmentList
                  legend="Qué trae esta alternativa"
                  hint=""
                  rows={option.items}
                  onChange={(items) =>
                    updateChoice(index, {
                      options: choice.options.map((o, i) =>
                        i === optionIndex ? { ...o, items } : o,
                      ),
                    })
                  }
                  catalogue={catalogue}
                  idPrefix={`hb-choice-${index}-${optionIndex}`}
                />
              </div>
            ))}

            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                updateChoice(index, {
                  options: [...choice.options, { label: '', items: [] }],
                })
              }
            >
              Añadir alternativa
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            onChange([
              ...choices,
              { label: '', options: [{ label: '', items: [] }, { label: '', items: [] }] },
            ])
          }
        >
          Añadir grupo
        </Button>
      </div>
    </fieldset>
  );
}

/** Las subclases de una clase propia, cada una con sus rasgos por nivel. */
function SubclassList({
  subclasses,
  onChange,
  subclassLevel,
}: {
  subclasses: readonly SubclassEntry[];
  onChange: (v: SubclassEntry[]) => void;
  subclassLevel: string;
}) {
  const update = (index: number, patch: Partial<SubclassEntry>) =>
    onChange(subclasses.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  return (
    <fieldset>
      <legend className="text-xs font-medium text-[var(--text-secondary)]">Subclases</legend>
      <p className="mt-1 text-2xs leading-relaxed text-[var(--text-tertiary)]">
        Al nivel {Number(subclassLevel) || 3} hay que elegir una. Si la clase no tiene
        ninguna, el personaje se queda con el aviso de «subclase pendiente» y no puede
        resolverlo.
      </p>
      <div className="mt-2 space-y-3">
        {subclasses.map((subclass, index) => (
          <div
            key={index}
            className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                aria-label={`Nombre de la subclase ${index + 1}`}
                value={subclass.name}
                placeholder="Senda del Berserker"
                onChange={(e) => update(index, { name: e.target.value })}
                className="h-10 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Quitar la subclase ${index + 1}`}
                onClick={() => onChange(subclasses.filter((_, i) => i !== index))}
              >
                Quitar
              </Button>
            </div>
            <textarea
              rows={2}
              aria-label={`De qué va la subclase ${index + 1}`}
              value={subclass.flavor}
              placeholder="De qué va, en una o dos frases."
              onChange={(e) => update(index, { flavor: e.target.value })}
              className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
            />
            <EntryList
              legend={`Rasgos de ${subclass.name.trim() || 'la subclase'}`}
              hint="Se suman a los de la clase en el nivel que digas."
              entries={subclass.features}
              onChange={(v) => update(index, { features: v as LeveledEntry[] })}
              addLabel={`Añadir rasgo a la subclase ${index + 1}`}
              namePlaceholder="Frenesí"
              leveled
              scope={`rasgo de la subclase ${index + 1}`}
            />
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...subclasses, { name: '', flavor: '', features: [] }])}
        >
          Añadir subclase
        </Button>
      </div>
    </fieldset>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 text-sm outline-none focus:border-[var(--accent)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * `wrap` no es cosmético.
 *
 * Con cinco opciones, una fila que se desplaza en horizontal está bien. Con
 * nueve, las dos últimas —Especie y Clase, justamente las que más cuesta
 * encontrar— quedan fuera de la vista detrás de una barra de desplazamiento
 * finita que nadie ve. Una función que no se ve no existe.
 */
function Segmented({
  label,
  options,
  value,
  onChange,
  wrap,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  wrap?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--text-secondary)]">{label}</p>
      <div
        className={cn(
          'mt-1.5 flex gap-1.5 pb-1',
          wrap ? 'flex-wrap' : 'scrollbar-slim overflow-x-auto',
        )}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
              value === o.value
                ? 'border-transparent bg-crimson-gradient text-[var(--accent-on)]'
                : 'border-[var(--border-default)] text-[var(--text-secondary)]',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="w-full justify-between"
    >
      <span className="text-sm font-normal">{label}</span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors',
          value ? 'bg-[var(--accent)]' : 'bg-[var(--surface-interactive)]',
        )}
      >
        <span
          className={cn(
            'absolute top-1 size-4 rounded-full bg-white transition-[left]',
            value ? 'left-5' : 'left-1',
          )}
        />
      </span>
    </Button>
  );
}
