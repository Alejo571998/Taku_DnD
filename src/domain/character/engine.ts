import {
  contribution,
  emptyAdvantage,
  mergeAdvantage,
  resolve,
  source,
  withAdvantage,
  withDisadvantage,
  type AdvantageChannel,
  type Computed,
  type Contribution,
} from '../shared/computed';
import type { DefinitionId } from '../shared/ids';
import { addWeight, feet, scaleWeight, weightFromHundredths, ZERO_WEIGHT, type Weight } from '../shared/units';
import type { ContentIndex } from '../content';
import type { ArmorDefinition, WeaponDefinition } from '../content/schemas';
import { type RulesEngine, type RuleContext } from '../rules/engine';
import type { AcFormula, Effect } from '../rules/vocabulary';
import { abilityModifier, ABILITIES, type AbilityId } from './ability';
import {
  hitPointStatus,
  type Attack,
  type CarryingBlock,
  type CharacterSheet,
  type HitDiceBlock,
  type ResolvedClass,
  type ResolvedCondition,
  type ResolvedFeature,
  type SheetWarning,
  type SkillBlock,
  type SpellcastingBlock,
  type SpellSlotBlock,
} from './sheet';
import { proficiencyContribution, SKILL_ABILITY, SKILLS, type ProficiencyLevel, type SkillId } from './skill';
import { FULL_CASTER_SLOTS } from '../rules/standardProgression';
import {
  primaryClass,
  proficiencyBonusForLevel,
  totalLevel,
  type CharacterState,
  type InventoryItemState,
  type ResourceState,
} from './state';

/**
 * MOTOR DE PERSONAJE
 *
 * Funcion PURA: sin E/S, sin React, sin base de datos. Recibe estado +
 * contenido + reglas, devuelve la ficha derivada.
 *
 * Que sea pura tiene una consecuencia que importa: el MISMO motor corre en el
 * cliente (offline) y en el servidor (validacion), sin mantener dos
 * implementaciones que se desvian con el tiempo.
 *
 * Etapas:
 *   1 Base · 2 Progresion · 3 Origen · 4 Clases · 5 Dotes · 6 Equipo
 *   7 Condiciones · 8 Derivados · 9 Recursos · 10 Capacidad
 *
 * Cada etapa SOLO AÑADE contribuciones; ninguna sobrescribe el trabajo de la
 * anterior. Al final, la resolucion de modificadores decide.
 */
export function resolveCharacter(
  state: CharacterState,
  content: ContentIndex,
  engine: RulesEngine,
): CharacterSheet {
  const warnings: SheetWarning[] = [];

  // ── 1-2 · Base y progresion ────────────────────────────────────────────────
  const level = Math.max(1, totalLevel(state));
  const proficiencyBonus = proficiencyBonusForLevel(level);

  const classes = resolveClasses(state, content, warnings);
  const classLevels = new Map(state.classes.map((c) => [c.classId as string, c.level]));

  // ── 3-5 · Origen, clases, dotes → caracteristicas ──────────────────────────
  const abilityContribs = collectAbilityContributions(state, content);
  const abilities = {} as Record<AbilityId, { id: AbilityId; score: Computed<number>; modifier: number }>;
  for (const a of ABILITIES) {
    const score = resolve(abilityContribs[a]);
    abilities[a] = { id: a, score, modifier: abilityModifier(score.value) };
  }
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, abilities[a].modifier])) as Record<AbilityId, number>;
  const scores = Object.fromEntries(ABILITIES.map((a) => [a, abilities[a].score.value])) as Record<AbilityId, number>;

  // ── 6 · Equipo ─────────────────────────────────────────────────────────────
  const equipped = equippedItems(state, content);
  const armor = equipped.armor;
  const shield = equipped.shield;
  const armorCategory = armor?.def.category ?? 'none';

  // ── Competencias ───────────────────────────────────────────────────────────
  const features = collectFeatures(state, content);
  const featureIds = new Set(features.map((f) => f.definitionId as string));
  const proficiencies = collectProficiencies(state, content);

  const wieldedProps = new Set<string>();
  for (const w of equipped.weapons) for (const p of w.def.properties) wieldedProps.add(p);

  const resources = resolveResources(state, content, mods, proficiencyBonus);

  const ctx: RuleContext = {
    ruleset: state.ruleset,
    characterLevel: level,
    proficiencyBonus,
    classLevels,
    abilityScores: scores,
    abilityModifiers: mods,
    featureIds,
    featIds: new Set<string>(state.featIds),
    proficiencies,
    conditionIds: new Set(state.conditions.map((c) => c.definitionId as string)),
    armorCategory: armorCategory === 'shield' ? 'none' : armorCategory,
    usingShield: Boolean(shield),
    wieldedWeaponProperties: wieldedProps,
    resourcesAvailable: new Map(resources.map((r) => [r.key, r.current])),
  };

  // Efectos de reglas que otorgan competencias
  for (const { effect, rule } of engine.effectsFor(ctx, 'always')) {
    if (effect.kind === 'addProficiency') proficiencies.add(effect.target);
    void rule;
  }

  // ── 8 · Derivados ──────────────────────────────────────────────────────────
  const armorClass = computeArmorClass(ctx, engine, mods, armor, shield, warnings);
  const speed = computeSpeed(ctx, engine, state, content, armor, scores, warnings);
  const initiative = computeInitiative(ctx, engine, mods);
  const maxHp = computeMaxHp(ctx, engine, state, content, mods, level);

  const savingThrows = computeSaves(ctx, engine, state, content, mods, proficiencyBonus);
  const skills = computeSkills(ctx, engine, state, proficiencies, mods, proficiencyBonus, armor);

  const attacks = computeAttacks(state, content, ctx, engine, mods, proficiencies, proficiencyBonus, warnings);
  const spellcasting = computeSpellcasting(state, content, mods, proficiencyBonus, warnings);

  // ── 10 · Capacidad de carga ────────────────────────────────────────────────
  const carrying = computeCarrying(state, content, scores.str, speed.value);
  if (carrying.status === 'exceeded') warnings.push({ code: 'carrying.exceeded' });
  else if (carrying.status !== 'normal' && state.settings.encumbranceVariant) {
    warnings.push({ code: 'carrying.encumbered' });
  }

  const attunedCount = state.inventory.filter((i) => i.attuned).length;
  if (attunedCount > 3) warnings.push({ code: 'attunement.overLimit', params: { count: attunedCount } });

  const perception = skills.perception;
  const passivePerception = 10 + perception.modifier.value;

  const senses = new Set<string>();
  for (const { effect } of engine.effectsFor(ctx, 'always')) {
    if (effect.kind === 'addSense') senses.add(effect.sense);
  }

  const hpMax = maxHp.value;
  const current = Math.min(state.hitPoints.current, hpMax);

  return {
    state,
    ruleset: state.ruleset,
    level,
    proficiencyBonus,
    classes,
    speciesName: content.species(state.speciesId)?.name ?? '—',
    backgroundName: content.background(state.backgroundId)?.name ?? '—',
    isMulticlass: state.classes.length > 1,
    abilities,
    savingThrows,
    skills,
    armorClass,
    initiative,
    speed,
    size: content.species(state.speciesId)?.size ?? 'Medium',
    hitPoints: {
      current,
      max: maxHp,
      temporary: state.hitPoints.temporary,
      effective: current + state.hitPoints.temporary,
      percent: hpMax > 0 ? Math.round((current / hpMax) * 100) : 0,
      status: hitPointStatus(current, hpMax),
      deathSaves: state.hitPoints.deathSaves,
    },
    hitDice: computeHitDice(state, content),
    attacks,
    spellcasting,
    features,
    resources,
    carrying,
    passivePerception,
    senses: [...senses],
    proficiencies: {
      armor: [...proficiencies].filter((p) => /armor|shield/i.test(p)),
      weapons: [...proficiencies].filter((p) => /weapon/i.test(p)),
      tools: [...proficiencies].filter((p) => /tool|instrument|supplies|kit/i.test(p)),
      languages: [...state.languages],
      savingThrows: [...state.savingThrowProficiencies],
    },
    activeConditions: resolveConditions(state, content),
    warnings,
  };
}

// ── Etapas ───────────────────────────────────────────────────────────────────

function resolveClasses(
  state: CharacterState,
  content: ContentIndex,
  warnings: SheetWarning[],
): ResolvedClass[] {
  return state.classes.map((entry) => {
    const def = content.class(entry.classId);
    const sub = content.subclass(entry.subclassId);
    const resolved: ResolvedClass = {
      classId: entry.classId,
      name: def?.name ?? 'Clase desconocida',
      level: entry.level,
      hitDie: def?.hitDie ?? 8,
      isPrimary: entry.isPrimary,
      ...(entry.subclassId ? { subclassId: entry.subclassId } : {}),
      ...(sub ? { subclassName: sub.name } : {}),
    };
    const subclassLevel = def?.subclassLevel ?? 3;
    if (!entry.subclassId && entry.level >= subclassLevel) {
      warnings.push({ code: 'subclass.pending', params: { className: resolved.name, level: subclassLevel } });
      return { ...resolved, pendingSubclassAtLevel: subclassLevel };
    }
    return resolved;
  });
}

function collectAbilityContributions(
  state: CharacterState,
  content: ContentIndex,
): Record<AbilityId, Contribution[]> {
  const out = {} as Record<AbilityId, Contribution[]>;
  for (const a of ABILITIES) {
    out[a] = [contribution('base', state.abilityScores[a], source('base', 'Puntuación base'))];
  }

  // 2014: los bonificadores los da la especie. 2024: los da el trasfondo.
  const species = content.species(state.speciesId);
  if (species) {
    for (const b of species.abilityBonuses) {
      out[b.ability].push(contribution('add', b.bonus, source('species', species.name, species.id as DefinitionId)));
    }
  }
  const subspecies = content.subspecies(state.subspeciesId);
  if (subspecies) {
    for (const b of subspecies.abilityBonuses) {
      out[b.ability].push(contribution('add', b.bonus, source('species', subspecies.name, subspecies.id as DefinitionId)));
    }
  }
  const background = content.background(state.backgroundId);
  if (background) {
    for (const b of background.abilityBonuses) {
      out[b.ability].push(contribution('add', b.bonus, source('background', background.name, background.id as DefinitionId)));
    }
  }

  // Mejoras aplicadas (ASI, dotes, objetos permanentes)
  for (const inc of state.abilityIncreases) {
    out[inc.ability].push(contribution('add', inc.amount, source('feat', inc.sourceLabel, inc.sourceId)));
  }

  return out;
}

type EquippedArmor = { item: InventoryItemState; def: ArmorDefinition };
type EquippedWeapon = { item: InventoryItemState; def: WeaponDefinition };

function equippedItems(state: CharacterState, content: ContentIndex) {
  let armor: EquippedArmor | undefined;
  let shield: EquippedArmor | undefined;
  const weapons: EquippedWeapon[] = [];

  for (const item of state.inventory) {
    if (!item.equippedSlot) continue;
    const def = content.get(item.definitionId);
    if (!def) continue;
    if (def.type === 'armor') {
      if (def.category === 'shield') shield = { item, def };
      else armor = { item, def };
    } else if (def.type === 'weapon') {
      weapons.push({ item, def });
    }
  }
  return { armor, shield, weapons };
}

/**
 * CA. La formula base depende de la armadura equipada; las reglas pueden
 * aportar una formula alternativa (Defensa sin armadura) que compite con ella.
 * Gana la mas alta — en 5e el personaje usa la mejor, no las suma.
 */
function computeArmorClass(
  ctx: RuleContext,
  engine: RulesEngine,
  mods: Record<AbilityId, number>,
  armor: EquippedArmor | undefined,
  shield: EquippedArmor | undefined,
  warnings: SheetWarning[],
): Computed<number> {
  const contribs: Contribution[] = [];

  if (armor) {
    contribs.push(contribution('base', armor.def.baseAc, source('item', armor.item.customName ?? armor.def.name, armor.def.id as DefinitionId)));
    if (armor.def.addsDexBonus) {
      const cap = armor.def.maxDexBonus;
      const dex = cap == null ? mods.dex : Math.min(mods.dex, cap);
      contribs.push(contribution('add', dex, source('ability', cap == null ? 'Destreza' : `Destreza (máx. +${cap})`)));
    }
    if (armor.def.strMinimum > 0 && ctx.abilityScores.str < armor.def.strMinimum) {
      warnings.push({ code: 'armor.strengthRequirement', params: { required: armor.def.strMinimum, item: armor.def.name } });
    }
    if (armor.def.stealthDisadvantage) warnings.push({ code: 'stealth.disadvantage', params: { item: armor.def.name } });
  } else {
    contribs.push(contribution('base', 10, source('base', 'Sin armadura')));
    contribs.push(contribution('add', mods.dex, source('ability', 'Destreza')));
  }

  // Formulas alternativas aportadas por reglas
  for (const { effect, rule } of engine.effectsFor(ctx, 'computeStat', 'ac')) {
    if (effect.kind === 'setAcFormula') {
      const f: AcFormula = effect.formula;
      if (f.requiresNoArmor && armor) continue;
      if (f.requiresNoShield && shield) continue;
      const total = f.base + f.abilities.reduce((sum, a) => sum + mods[a], 0);
      contribs.push(contribution('set', total, source('class', effect.label), rule.id as never));
    }
    if (effect.kind === 'modifyStat' && effect.stat === 'ac') {
      contribs.push(contribution(effect.op, evaluate(effect, ctx), source('rule', rule.label), rule.id as never));
    }
  }

  if (shield) {
    contribs.push(contribution('add', shield.def.baseAc, source('item', shield.item.customName ?? shield.def.name, shield.def.id as DefinitionId)));
  }

  return resolve(contribs, 10);
}

function evaluate(effect: Extract<Effect, { amount: unknown }>, ctx: RuleContext): number {
  const amount = (effect as { amount: { kind: string; value?: number; ability?: AbilityId } }).amount;
  switch (amount.kind) {
    case 'constant':
      return amount.value ?? 0;
    case 'abilityModifier':
      return amount.ability ? ctx.abilityModifiers[amount.ability] : 0;
    case 'proficiencyBonus':
      return ctx.proficiencyBonus;
    case 'characterLevel':
      return ctx.characterLevel;
    default:
      return 0;
  }
}

function computeSpeed(
  ctx: RuleContext,
  engine: RulesEngine,
  state: CharacterState,
  content: ContentIndex,
  armor: EquippedArmor | undefined,
  scores: Record<AbilityId, number>,
  _warnings: SheetWarning[],
): Computed<number> {
  const species = content.species(state.speciesId);
  const contribs: Contribution[] = [
    contribution('base', species?.speed ?? 30, source('species', species?.name ?? 'Base')),
  ];

  // Armadura pesada sin la Fuerza requerida: -10 pies (regla del SRD).
  if (armor && armor.def.strMinimum > 0 && scores.str < armor.def.strMinimum) {
    contribs.push(contribution('add', -10, source('item', `${armor.def.name} (Fuerza insuficiente)`)));
  }

  for (const { effect, rule } of engine.effectsFor(ctx, 'computeStat', 'speed')) {
    if (effect.kind === 'modifySpeed') {
      contribs.push(contribution(effect.op, evaluate(effect, ctx), source('rule', rule.label)));
    }
  }

  return resolve(contribs, 30);
}

function computeInitiative(
  ctx: RuleContext,
  engine: RulesEngine,
  mods: Record<AbilityId, number>,
): Computed<number> {
  const contribs: Contribution[] = [contribution('base', mods.dex, source('ability', 'Destreza'))];
  for (const { effect, rule } of engine.effectsFor(ctx, 'initiative')) {
    if (effect.kind === 'modifyStat' && effect.stat === 'initiative') {
      contribs.push(contribution(effect.op, evaluate(effect, ctx), source('rule', rule.label)));
    }
  }
  return resolve(contribs);
}

/**
 * HP maximo DERIVADO de sus fuentes.
 * Nivel 1 de la clase primaria: dado completo. Resto: promedio fijo o tirada.
 */
function computeMaxHp(
  ctx: RuleContext,
  engine: RulesEngine,
  state: CharacterState,
  content: ContentIndex,
  mods: Record<AbilityId, number>,
  level: number,
): Computed<number> {
  const hp = state.hitPoints;

  if (hp.mode === 'manual' && hp.maxOverride != null) {
    return resolve([contribution('base', hp.maxOverride, source('manual', 'Máximo manual'))]);
  }

  const contribs: Contribution[] = [];
  const primary = primaryClass(state);
  const primaryDef = content.class(primary?.classId);
  const firstDie = primaryDef?.hitDie ?? 8;

  contribs.push(contribution('base', firstDie, source('class', `${primaryDef?.name ?? 'Clase'} (nivel 1, dado completo)`)));

  let levelsCounted = 1;
  for (const entry of state.classes) {
    const def = content.class(entry.classId);
    const die = def?.hitDie ?? 8;
    const average = Math.floor(die / 2) + 1;
    const levelsFromThis = entry === primary ? entry.level - 1 : entry.level;
    if (levelsFromThis <= 0) continue;

    if (hp.mode === 'rolled') {
      for (let i = 0; i < levelsFromThis; i++) {
        const rolled = hp.rolls[levelsCounted - 1];
        contribs.push(
          contribution('add', rolled ?? average, source('class', `${def?.name ?? 'Clase'} nivel ${levelsCounted + 1}`)),
        );
        levelsCounted++;
      }
    } else {
      contribs.push(
        contribution('add', average * levelsFromThis, source('class', `${def?.name ?? 'Clase'} (${levelsFromThis}× promedio ${average})`)),
      );
      levelsCounted += levelsFromThis;
    }
  }

  contribs.push(contribution('add', mods.con * level, source('ability', `Constitución ×${level}`)));

  if (hp.bonusPerLevel !== 0) {
    contribs.push(contribution('add', hp.bonusPerLevel * level, source('manual', `Bonificador ×${level}`)));
  }

  for (const { effect, rule } of engine.effectsFor(ctx, 'computeStat', 'maxHp')) {
    if (effect.kind === 'modifyMaxHp') {
      const amount = evaluate(effect, ctx) * (effect.perLevel ? level : 1);
      contribs.push(contribution(effect.op, amount, source('rule', rule.label)));
    }
  }

  contribs.push(contribution('min', 1, source('base', 'Mínimo 1')));
  return resolve(contribs);
}

function computeSaves(
  ctx: RuleContext,
  engine: RulesEngine,
  state: CharacterState,
  content: ContentIndex,
  mods: Record<AbilityId, number>,
  profBonus: number,
) {
  // Solo la clase primaria otorga competencias en salvacion (regla de multiclase).
  const primary = primaryClass(state);
  const primaryDef = content.class(primary?.classId);
  const fromClass = new Set<AbilityId>(primaryDef?.savingThrows ?? []);
  for (const a of state.savingThrowProficiencies) fromClass.add(a);

  const out = {} as CharacterSheet['savingThrows'];
  const mutable = out as Record<AbilityId, CharacterSheet['savingThrows'][AbilityId]>;

  for (const a of ABILITIES) {
    const proficient = fromClass.has(a);
    const contribs: Contribution[] = [
      contribution('base', mods[a], source('ability', 'Modificador de característica')),
    ];
    if (proficient) {
      contribs.push(contribution('add', profBonus, source('proficiency', 'Competencia')));
    }

    let advantage = emptyAdvantage();
    for (const { effect, rule } of engine.effectsFor(ctx, 'savingThrow')) {
      if (effect.kind === 'grantAdvantage' && (effect.on === 'save' || effect.on === `save.${a}`)) {
        advantage = withAdvantage(advantage, source('rule', rule.label));
      }
      if (effect.kind === 'grantDisadvantage' && (effect.on === 'save' || effect.on === `save.${a}`)) {
        advantage = withDisadvantage(advantage, source('rule', rule.label));
      }
    }

    mutable[a] = { ability: a, modifier: resolve(contribs), proficient, advantage };
  }
  return out;
}

function computeSkills(
  ctx: RuleContext,
  engine: RulesEngine,
  state: CharacterState,
  proficiencies: Set<string>,
  mods: Record<AbilityId, number>,
  profBonus: number,
  armor: EquippedArmor | undefined,
): Record<SkillId, SkillBlock> {
  const out = {} as Record<SkillId, SkillBlock>;

  for (const skill of SKILLS) {
    const ability = SKILL_ABILITY[skill];
    // Nivel explicito del personaje, o competencia otorgada por una regla.
    const explicit = state.skillProficiencies[skill];
    const granted = proficiencies.has(`skill-${skill}`);
    const level: ProficiencyLevel = explicit ?? (granted ? 'proficient' : 'none');

    const contribs: Contribution[] = [contribution('base', mods[ability], source('ability', 'Modificador de característica'))];
    const profPart = proficiencyContribution(level, profBonus);
    if (profPart !== 0) {
      const label = level === 'expertise' ? 'Pericia' : level === 'half' ? 'Media competencia' : 'Competencia';
      contribs.push(contribution('add', profPart, source('proficiency', label)));
    }

    let advantage = emptyAdvantage();
    if (skill === 'stealth' && armor?.def.stealthDisadvantage) {
      advantage = withDisadvantage(advantage, source('item', armor.def.name));
    }
    for (const { effect, rule } of engine.effectsFor(ctx, 'abilityCheck')) {
      if (effect.kind === 'grantAdvantage' && (effect.on === 'check' || effect.on === `check.${skill}`)) {
        advantage = withAdvantage(advantage, source('rule', rule.label));
      }
      if (effect.kind === 'grantDisadvantage' && (effect.on === 'check' || effect.on === `check.${skill}`)) {
        advantage = withDisadvantage(advantage, source('rule', rule.label));
      }
    }

    const modifier = resolve(contribs);
    out[skill] = {
      id: skill,
      ability,
      modifier,
      proficiency: level,
      passive: 10 + modifier.value,
      advantage,
    };
  }
  return out;
}

function collectProficiencies(state: CharacterState, content: ContentIndex): Set<string> {
  const out = new Set<string>(state.otherProficiencies);
  const primary = primaryClass(state);

  for (const entry of state.classes) {
    const def = content.class(entry.classId);
    if (!def) continue;
    // En multiclase, solo la clase primaria da el paquete completo.
    if (entry === primary) {
      for (const p of def.armorProficiencies) out.add(p);
      for (const p of def.weaponProficiencies) out.add(p);
      for (const p of def.toolProficiencies) out.add(p);
    } else if (def.multiclassing) {
      for (const p of def.multiclassing.proficiencies) out.add(p);
    }
  }

  const background = content.background(state.backgroundId);
  if (background) {
    for (const p of background.skillProficiencies) out.add(p);
    for (const p of background.toolProficiencies) out.add(p);
  }

  for (const [skill, level] of Object.entries(state.skillProficiencies)) {
    if (level && level !== 'none') out.add(`skill-${skill}`);
  }

  return out;
}

function collectFeatures(state: CharacterState, content: ContentIndex): ResolvedFeature[] {
  const out: ResolvedFeature[] = [];
  const seen = new Set<string>();

  const push = (id: DefinitionId | string, kind: ResolvedFeature['kind'], sourceLabel: string, level = 1) => {
    if (seen.has(id as string)) return;
    const def = content.get(id);
    if (!def) return;
    seen.add(id as string);
    out.push({
      definitionId: def.id as DefinitionId,
      name: def.name,
      description: def.description,
      sourceLabel,
      level,
      kind,
    });
  };

  const species = content.species(state.speciesId);
  if (species) for (const t of species.traits) push(t, 'species', species.name);
  const subspecies = content.subspecies(state.subspeciesId);
  if (subspecies) for (const t of subspecies.traits) push(t, 'species', subspecies.name);

  for (const entry of state.classes) {
    const def = content.class(entry.classId);
    if (def) {
      for (let lvl = 1; lvl <= entry.level; lvl++) {
        const row = def.progression[String(lvl)];
        if (!row) continue;
        for (const f of row.features) push(f, 'class', def.name, lvl);
      }
    }
    const sub = content.subclass(entry.subclassId);
    if (sub) {
      for (let lvl = 1; lvl <= entry.level; lvl++) {
        const row = sub.progression[String(lvl)];
        if (!row) continue;
        for (const f of row.features) push(f, 'subclass', sub.name, lvl);
      }
    }
  }

  for (const f of state.featIds) push(f, 'feat', 'Dote');

  const background = content.background(state.backgroundId);
  if (background?.feature) {
    out.push({
      definitionId: background.id as DefinitionId,
      name: background.feature.name,
      description: background.feature.description,
      sourceLabel: background.name,
      level: 1,
      kind: 'background',
    });
  }

  return out;
}

// ── Ataques ──────────────────────────────────────────────────────────────────

/**
 * Caracteristica de ataque segun las reglas:
 *   cuerpo a cuerpo → Fuerza, salvo `finesse` (elige la mejor)
 *   a distancia     → Destreza, salvo arrojadiza con `finesse`
 */
function attackAbility(def: WeaponDefinition, mods: Record<AbilityId, number>): AbilityId {
  const finesse = def.properties.includes('finesse');
  if (def.rangeType === 'ranged') return finesse && mods.str > mods.dex ? 'str' : 'dex';
  if (finesse) return mods.dex > mods.str ? 'dex' : 'str';
  return 'str';
}

function isProficientWith(def: WeaponDefinition, proficiencies: Set<string>): boolean {
  if (proficiencies.has(`${def.category}-weapons`)) return true;
  const slug = (def.id as string).split(':').pop() ?? '';
  return proficiencies.has(slug) || proficiencies.has(def.id as string);
}

function computeAttacks(
  state: CharacterState,
  content: ContentIndex,
  ctx: RuleContext,
  engine: RulesEngine,
  mods: Record<AbilityId, number>,
  proficiencies: Set<string>,
  profBonus: number,
  warnings: SheetWarning[],
): Attack[] {
  const attacks: Attack[] = [];
  const attackEffects = engine.effectsFor(ctx, 'attackRoll');
  const damageEffects = engine.effectsFor(ctx, 'damageRoll');

  for (const item of state.inventory) {
    const def = content.weapon(item.definitionId);
    if (!def) continue;
    // Solo cuenta lo equipado o lo marcado como favorito: la lista de ataques
    // debe ser corta y util durante la partida, no un catalogo.
    if (!item.equippedSlot && !item.favorite) continue;

    const ability = attackAbility(def, mods);
    const proficient = isProficientWith(def, proficiencies);
    if (!proficient) warnings.push({ code: 'weapon.notProficient', params: { item: def.name } });

    const atkContribs: Contribution[] = [
      contribution('base', mods[ability], source('ability', ability === 'dex' ? 'Destreza' : 'Fuerza')),
    ];
    if (proficient) atkContribs.push(contribution('add', profBonus, source('proficiency', 'Competencia')));

    let damageBonus = mods[ability];
    const damageSources: string[] = [];

    for (const { effect, rule } of attackEffects) {
      if (effect.kind !== 'modifyAttackRoll') continue;
      if (effect.weaponRange && effect.weaponRange !== def.rangeType) continue;
      if (effect.weaponProperty && !def.properties.includes(effect.weaponProperty)) continue;
      atkContribs.push(contribution(effect.op, evaluate(effect, ctx), source('rule', rule.label)));
    }
    for (const { effect, rule } of damageEffects) {
      if (effect.kind !== 'modifyDamageRoll') continue;
      if (effect.weaponRange && effect.weaponRange !== def.rangeType) continue;
      if (effect.weaponProperty && !def.properties.includes(effect.weaponProperty)) continue;
      damageBonus += evaluate(effect, ctx);
      damageSources.push(rule.label);
    }

    const dice = def.damage?.dice ?? '1d4';
    const damageExpression = damageBonus === 0 ? dice : `${dice}${damageBonus > 0 ? '+' : ''}${damageBonus}`;

    let ammunition: Attack['ammunition'];
    if (def.ammunitionType) {
      const ammoItem = state.inventory.find((i) => i.definitionId === def.ammunitionType);
      ammunition = {
        definitionId: def.ammunitionType as DefinitionId,
        ...(ammoItem ? { itemId: ammoItem.id as string } : {}),
        remaining: ammoItem?.quantity ?? 0,
      };
    }

    const attack: Attack = {
      id: `weapon:${item.id}`,
      name: item.customName ?? def.name,
      kind: 'weapon',
      definitionId: def.id as DefinitionId,
      itemId: item.id as string,
      ability,
      attackBonus: resolve(atkContribs),
      damageExpression,
      damageType: def.damage?.damageType ?? 'bludgeoning',
      ...(def.twoHandedDamage
        ? {
            versatileExpression:
              damageBonus === 0
                ? def.twoHandedDamage.dice
                : `${def.twoHandedDamage.dice}${damageBonus > 0 ? '+' : ''}${damageBonus}`,
          }
        : {}),
      range: def.rangeType === 'ranged' && def.range ? `${def.range.normal}/${def.range.long ?? def.range.normal} pies` : '1,5 m',
      properties: def.properties,
      proficient,
      advantage: emptyAdvantage(),
      ...(ammunition ? { ammunition } : {}),
      favorite: item.favorite,
    };
    attacks.push(attack);
  }

  // Golpe sin armas: siempre disponible.
  attacks.push({
    id: 'unarmed',
    name: 'Golpe sin armas',
    kind: 'unarmed',
    ability: 'str',
    attackBonus: resolve([
      contribution('base', mods.str, source('ability', 'Fuerza')),
      contribution('add', profBonus, source('proficiency', 'Competencia')),
    ]),
    damageExpression: `${Math.max(1, 1 + mods.str)}`,
    damageType: 'bludgeoning',
    range: '1,5 m',
    properties: [],
    proficient: true,
    advantage: emptyAdvantage(),
    favorite: false,
  });

  return attacks;
}

// ── Lanzamiento de conjuros ──────────────────────────────────────────────────

/**
 * Tabla de espacios del lanzador multiclase: es la del lanzador completo.
 * Vive en el dominio de reglas porque el editor de contenido propio la usa
 * para ofrecer una clase casera ya rellenada.
 */
const MULTICLASS_SLOTS = FULL_CASTER_SLOTS;

/** Cuanto aporta cada clase al nivel de lanzador combinado. */
const CASTER_FRACTION: Record<string, number> = {
  bard: 1, cleric: 1, druid: 1, sorcerer: 1, wizard: 1,
  paladin: 0.5, ranger: 0.5,
  warlock: 0, // El Brujo usa Magia de Pacto, tabla aparte.
};

function computeSpellcasting(
  state: CharacterState,
  content: ContentIndex,
  mods: Record<AbilityId, number>,
  profBonus: number,
  warnings: SheetWarning[],
): SpellcastingBlock[] {
  const casters = state.classes.filter((e) => content.class(e.classId)?.spellcasting);
  if (casters.length === 0) return [];

  // Nivel de lanzador combinado (solo relevante en multiclase).
  let combined = 0;
  for (const entry of casters) {
    const slug = (entry.classId as string).split(':').pop() ?? '';
    const fraction = CASTER_FRACTION[slug] ?? 1;
    combined += fraction === 1 ? entry.level : Math.floor(entry.level * fraction);
  }

  const useMulticlassTable = casters.length > 1;
  const sharedSlots = useMulticlassTable
    ? (MULTICLASS_SLOTS[Math.max(0, Math.min(19, combined - 1))] ?? MULTICLASS_SLOTS[0]!)
    : null;

  return casters.map((entry) => {
    const def = content.class(entry.classId)!;
    const sc = def.spellcasting!;
    const ability = sc.ability;
    const row = def.progression[String(entry.level)];

    const slotArray = sharedSlots ?? row?.spellcasting?.slots ?? new Array(9).fill(0);
    const slots: SpellSlotBlock[] = slotArray.map((total, i) => {
      const used = state.spells.slotsUsed[i] ?? 0;
      return { level: i + 1, total, used, available: Math.max(0, total - used) };
    });

    const preparedFromClass = state.spells.known.filter(
      (s) => s.sourceClassId === entry.classId && s.prepared && !s.alwaysPrepared,
    ).length;

    const preparedLimit = sc.preparesSpells
      ? row?.spellcasting?.spellsKnown ?? Math.max(1, mods[ability] + preparationLevels(entry.classId as string, entry.level))
      : null;

    if (preparedLimit != null && preparedFromClass > preparedLimit) {
      warnings.push({ code: 'spells.overPrepared', params: { limit: preparedLimit, count: preparedFromClass } });
    }

    return {
      classId: entry.classId,
      className: def.name,
      ability,
      spellAttackBonus: resolve([
        contribution('base', mods[ability], source('ability', 'Característica de lanzamiento')),
        contribution('add', profBonus, source('proficiency', 'Competencia')),
      ]),
      saveDc: resolve([
        contribution('base', 8, source('base', 'Base')),
        contribution('add', profBonus, source('proficiency', 'Competencia')),
        contribution('add', mods[ability], source('ability', 'Característica de lanzamiento')),
      ]),
      preparesSpells: sc.preparesSpells,
      preparedLimit,
      preparedCount: preparedFromClass,
      cantripsKnown: row?.spellcasting?.cantripsKnown ?? 0,
      slots,
      ritualCasting: sc.ritualCasting,
    };
  });
}

/** Paladin y Explorador preparan con medio nivel; el resto con nivel completo. */
function preparationLevels(classId: string, level: number): number {
  const slug = classId.split(':').pop() ?? '';
  return slug === 'paladin' || slug === 'artificer' ? Math.floor(level / 2) : level;
}

// ── Recursos, dados de golpe, condiciones, carga ─────────────────────────────

function resolveResources(
  state: CharacterState,
  content: ContentIndex,
  mods: Record<AbilityId, number>,
  _profBonus: number,
): ResourceState[] {
  const out: ResourceState[] = [...state.resources.filter((r) => !r.managed)];

  for (const entry of state.classes) {
    const def = content.class(entry.classId);
    const row = def?.progression[String(entry.level)];
    if (!def || !row) continue;
    for (const [key, maximum] of Object.entries(row.resources)) {
      if (typeof maximum !== 'number' || maximum <= 0) continue;
      const existing = state.resources.find((r) => r.key === key);
      out.push({
        id: existing?.id ?? (`managed:${key}` as ResourceState['id']),
        key,
        label: humanizeResourceKey(key),
        current: existing ? Math.min(existing.current, maximum) : maximum,
        maximum,
        recovery: existing?.recovery ?? defaultRecovery(key),
        sourceLabel: def.name,
        sourceId: def.id as DefinitionId,
        managed: true,
      });
    }
  }

  void mods;
  return out;
}

/**
 * Los nombres de los recursos de clase. Las 39 claves que traen los dos
 * volcados; antes había 19 y el panel de RECURSOS mostraba «Second wind uses»
 * y «Weapon mastery» en inglés, porque el respaldo de `humanizeResourceKey`
 * se limita a quitarle los guiones bajos a la clave.
 *
 * El vocabulario NO se eligió acá: cada nombre es el que ya usa el overlay de
 * traducción para ese mismo rasgo (`es-419.json`). Si no coincidieran, el
 * mismo rasgo se llamaría de dos maneras en la misma pantalla —el panel de
 * recursos arriba y la lista de aptitudes abajo—, que es exactamente lo que
 * pasaba con «Invocaciones» / «Invocaciones sobrenaturales».
 */
export const RESOURCE_LABELS: Record<string, string> = {
  rage_count: 'Furias',
  rages: 'Furias',
  rage_damage_bonus: 'Bonificador de furia',
  brutal_critical_dice: 'Crítico brutal (dados)',
  action_surges: 'Oleada de acción',
  indomitable_uses: 'Indomable',
  extra_attacks: 'Ataques adicionales',
  second_wind_uses: 'Segundo aliento',
  weapon_mastery: 'Maestría con armas',
  ki_points: 'Puntos ki',
  focus_points: 'Puntos de enfoque',
  martial_arts: 'Artes marciales',
  martial_arts_die: 'Artes marciales (dado)',
  unarmored_movement: 'Movimiento sin armadura',
  unarmored_movement_bonus: 'Movimiento sin armadura (bonificador)',
  sorcery_points: 'Puntos de hechicería',
  metamagic_known: 'Metamagia',
  creating_spell_slots: 'Crear espacios de conjuro',
  bardic_inspiration_die: 'Dado de inspiración',
  song_of_rest_die: 'Canción de descanso (dado)',
  magical_secrets_max_5: 'Secretos mágicos (nivel máx. 5)',
  magical_secrets_max_7: 'Secretos mágicos (nivel máx. 7)',
  magical_secrets_max_9: 'Secretos mágicos (nivel máx. 9)',
  channel_divinity_charges: 'Canalizar divinidad',
  destroy_undead_cr: 'Destruir muertos vivientes (VD)',
  wild_shape_max_cr: 'Forma salvaje (VD máx.)',
  wild_shape_uses: 'Forma salvaje (usos)',
  wild_shape_fly: 'Forma salvaje (vuelo)',
  wild_shape_swim: 'Forma salvaje (nado)',
  sneak_attack: 'Ataque furtivo',
  favored_enemies: 'Enemigos predilectos',
  favored_terrain: 'Terrenos predilectos',
  // El overlay las llama «Invocaciones sobrenaturales»: las dos claves son lo
  // mismo escrito distinto en cada volcado y tienen que leerse igual.
  invocations_known: 'Invocaciones sobrenaturales',
  eldritch_invocations: 'Invocaciones sobrenaturales',
  mystic_arcanum_level_6: 'Arcano místico (nivel 6)',
  mystic_arcanum_level_7: 'Arcano místico (nivel 7)',
  mystic_arcanum_level_8: 'Arcano místico (nivel 8)',
  mystic_arcanum_level_9: 'Arcano místico (nivel 9)',
  arcane_recovery_levels: 'Recuperación arcana',
  aura_range: 'Alcance del aura',
};

const humanizeResourceKey = (key: string): string =>
  RESOURCE_LABELS[key] ?? key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function defaultRecovery(key: string): ResourceState['recovery'] {
  if (/ki|action_surge|bardic|channel_divinity|arcane_recovery|second_wind/.test(key)) return 'shortRest';
  return 'longRest';
}

function computeHitDice(state: CharacterState, content: ContentIndex): HitDiceBlock[] {
  return state.classes.map((entry) => {
    const def = content.class(entry.classId);
    return {
      classId: entry.classId,
      className: def?.name ?? 'Clase',
      die: def?.hitDie ?? 8,
      total: entry.level,
      spent: entry.hitDiceSpent,
      available: Math.max(0, entry.level - entry.hitDiceSpent),
    };
  });
}

function resolveConditions(state: CharacterState, content: ContentIndex): ResolvedCondition[] {
  return state.conditions.map((c) => {
    const def = content.condition(c.definitionId);
    return {
      instanceId: c.id as string,
      definitionId: c.definitionId,
      name: def?.name ?? 'Condición',
      description: def?.description ?? [],
      ...(c.level != null ? { level: c.level } : {}),
      ...(c.sourceLabel ? { sourceLabel: c.sourceLabel } : {}),
      ...(c.roundsRemaining != null ? { roundsRemaining: c.roundsRemaining } : {}),
    };
  });
}

/** Multiplicador de capacidad por tamaño (SRD). */
const SIZE_MULTIPLIER: Record<string, number> = {
  Tiny: 0.5, Small: 1, Medium: 1, Large: 2, Huge: 4, Gargantuan: 8,
};

function computeCarrying(
  state: CharacterState,
  content: ContentIndex,
  strength: number,
  speedValue: number,
): CarryingBlock {
  let carried: Weight = ZERO_WEIGHT;
  for (const item of state.inventory) {
    const def = content.get(item.definitionId);
    const unit = item.weightOverride ?? (def && 'weight' in def ? (def.weight as number) : 0);
    carried = addWeight(carried, weightFromHundredths(unit * item.quantity));
  }

  const size = content.species(state.speciesId)?.size ?? 'Medium';
  const mult = SIZE_MULTIPLIER[size] ?? 1;

  // STR × 15 lb. En centesimas: STR × 1500.
  const capacity = scaleWeight(weightFromHundredths(strength * 1500), mult);
  const encumberedAt = scaleWeight(weightFromHundredths(strength * 500), mult);
  const heavilyEncumberedAt = scaleWeight(weightFromHundredths(strength * 1000), mult);
  const pushDragLift = scaleWeight(weightFromHundredths(strength * 3000), mult);

  let status: CarryingBlock['status'] = 'normal';
  let speedPenalty = 0;

  if (carried > capacity) {
    status = 'exceeded';
    speedPenalty = Math.min(speedValue, 20);
  } else if (state.settings.encumbranceVariant) {
    if (carried > heavilyEncumberedAt) {
      status = 'heavilyEncumbered';
      speedPenalty = 20;
    } else if (carried > encumberedAt) {
      status = 'encumbered';
      speedPenalty = 10;
    }
  }

  return {
    carried,
    capacity,
    encumberedAt,
    heavilyEncumberedAt,
    pushDragLift,
    status,
    percent: capacity > 0 ? Math.round((carried / capacity) * 100) : 0,
    speedPenalty: feet(speedPenalty),
  };
}

export { mergeAdvantage };
export type { AdvantageChannel };
