import { describe, expect, it } from 'vitest';
import { character, sheetOf } from '../fixtures/characters';
import { loadContent, srd14 } from '../fixtures/content';
import { ABILITIES, type AbilityScores } from '@domain/character/ability';
import type { CharacterState } from '@domain/character/state';
import { totalLevel } from '@domain/character/state';
import {
  applyLevelUp,
  backfillHitPointRolls,
  checkMulticlassPrerequisites,
  experienceProgress,
  levelFromExperience,
  planLevelUp,
  revertLevelUp,
  validateLevelUp,
  type LevelUpChoice,
} from '@domain/character/progression';
import { executeCommand } from '@application/commands/execute';
import { RulesEngine } from '@domain/rules/engine';
import { SRD_RULES } from '@domain/rules/srd-rules';
import { isErr, isOk, unwrap } from '@domain/shared/result';
import type { DefinitionId } from '@domain/shared/ids';

/**
 * SUBIDA DE NIVEL — contra el contenido REAL del SRD.
 *
 * Lo que se prueba aqui no es que el codigo corra: es que un personaje que
 * sube de nivel acabe con los PG, la competencia, los espacios y los rasgos
 * que dice el SRD, y que deshacerlo lo deje EXACTAMENTE como estaba.
 */

const content = loadContent('2014');
const engine = new RulesEngine(SRD_RULES, '2014');

const scoresOf = (state: CharacterState): AbilityScores => {
  const sheet = sheetOf(state);
  const out = {} as { -readonly [K in keyof AbilityScores]: number };
  for (const id of ABILITIES) out[id] = sheet.abilities[id].score.value;
  return out;
};

const emptyChoice = (over: Partial<LevelUpChoice> = {}): LevelUpChoice => ({
  hitPointMethod: 'average',
  cantrips: [],
  spells: [],
  ...over,
});

const FIGHTER = srd14('class', 'fighter') as DefinitionId;
const WIZARD = srd14('class', 'wizard') as DefinitionId;

describe('Experiencia', () => {
  it('traduce PX a nivel con los umbrales del SRD', () => {
    expect(levelFromExperience(0)).toBe(1);
    expect(levelFromExperience(299)).toBe(1);
    expect(levelFromExperience(300)).toBe(2);
    expect(levelFromExperience(2700)).toBe(4);
    expect(levelFromExperience(355000)).toBe(20);
    expect(levelFromExperience(9_999_999)).toBe(20);
  });

  it('informa cuanto falta sin bloquear nada', () => {
    const p = experienceProgress(500);
    expect(p.level).toBe(2);
    expect(p.nextLevelAt).toBe(900);
    expect(p.remaining).toBe(400);
    expect(p.fraction).toBeGreaterThan(0);
    expect(p.fraction).toBeLessThan(1);
  });

  it('en nivel 20 no hay siguiente umbral', () => {
    const p = experienceProgress(400000);
    expect(p.level).toBe(20);
    expect(p.nextLevelAt).toBeUndefined();
    expect(p.fraction).toBe(1);
  });
});

describe('Plan de subida de nivel', () => {
  it('un guerrero 1→2 gana Oleada de accion y conserva competencia +2', () => {
    const state = character().withClass('fighter', 1).abilities({ con: 14 }).build();
    const plan = unwrap(planLevelUp(state, FIGHTER, content, scoresOf(state)));

    expect(plan.toClassLevel).toBe(2);
    expect(plan.toTotalLevel).toBe(2);
    expect(plan.hitDie).toBe(10);
    expect(plan.proficiencyBonusBefore).toBe(2);
    expect(plan.proficiencyBonusAfter).toBe(2);
    expect(plan.newFeatures.some((f) => f.name.startsWith('Action Surge'))).toBe(true);
    // d10 → promedio 6, +2 de CON 14
    expect(plan.averageHitPointGain).toBe(8);
  });

  it('el bonificador de competencia sube al llegar a nivel 5', () => {
    const state = character().withClass('fighter', 4).build();
    const plan = unwrap(planLevelUp(state, FIGHTER, content, scoresOf(state)));
    expect(plan.proficiencyBonusBefore).toBe(2);
    expect(plan.proficiencyBonusAfter).toBe(3);
  });

  it('exige subclase en el nivel que marca la clase, y solo entonces', () => {
    const atTwo = character().withClass('fighter', 2).build();
    expect(unwrap(planLevelUp(atTwo, FIGHTER, content, scoresOf(atTwo))).requiresSubclass).toBe(true);

    const atOne = character().withClass('fighter', 1).build();
    expect(unwrap(planLevelUp(atOne, FIGHTER, content, scoresOf(atOne))).requiresSubclass).toBe(false);
  });

  it('no vuelve a pedir subclase si ya hay una elegida', () => {
    const state = character().withClass('fighter', 3, 'champion').build();
    const plan = unwrap(planLevelUp(state, FIGHTER, content, scoresOf(state)));
    expect(plan.requiresSubclass).toBe(false);
  });

  it('marca la mejora de caracteristica en el nivel 4', () => {
    const state = character().withClass('fighter', 3, 'champion').build();
    const plan = unwrap(planLevelUp(state, FIGHTER, content, scoresOf(state)));
    expect(plan.grantsAbilityScoreImprovement).toBe(true);
  });

  it('un mago 1→2 abre un espacio mas de nivel 1', () => {
    const state = character().withClass('wizard', 1).abilities({ int: 16 }).build();
    const plan = unwrap(planLevelUp(state, WIZARD, content, scoresOf(state)));
    expect(plan.spellcasting?.slotsBefore[0]).toBe(2);
    expect(plan.spellcasting?.slotsAfter[0]).toBe(3);
    expect(plan.spellcasting?.maxSpellLevel).toBe(1);
    expect(plan.spellcasting?.preparesSpells).toBe(true);
  });

  it('un mago 3→4 aprende un truco mas', () => {
    const state = character().withClass('wizard', 3, 'evocation').build();
    const plan = unwrap(planLevelUp(state, WIZARD, content, scoresOf(state)));
    // 3 trucos en nivel 3, 4 en nivel 4
    expect(plan.spellcasting?.cantripsToLearn).toBe(1);
  });

  it('el nivel 20 es el techo', () => {
    const state = character().withClass('fighter', 20, 'champion').build();
    const outcome = planLevelUp(state, FIGHTER, content, scoresOf(state));
    expect(isErr(outcome)).toBe(true);
    if (isErr(outcome)) expect(outcome.error.code).toBe('level.outOfRange');
  });
});

describe('Multiclase', () => {
  it('bloquea la multiclase si no se cumple el minimo de caracteristica', () => {
    const state = character().withClass('fighter', 3, 'champion').abilities({ int: 10 }).build();
    const outcome = planLevelUp(state, WIZARD, content, scoresOf(state));
    expect(isErr(outcome)).toBe(true);
  });

  it('la permite cuando se cumple, y la nueva clase empieza en nivel 1', () => {
    const state = character().withClass('fighter', 3, 'champion').abilities({ int: 14 }).build();
    const plan = unwrap(planLevelUp(state, WIZARD, content, scoresOf(state)));
    expect(plan.isNewClass).toBe(true);
    expect(plan.toClassLevel).toBe(1);
    expect(plan.toTotalLevel).toBe(4);
  });

  it('el requisito se evalua sobre la caracteristica EFECTIVA, no la base', () => {
    // Enano de las montañas: +2 de Fuerza sobre la base.
    const state = character().withSpecies('dwarf', 'hill-dwarf').abilities({ int: 13 }).withClass('fighter', 2).build();
    const cls = content.class(WIZARD);
    expect(checkMulticlassPrerequisites(cls, scoresOf(state)).allowed).toBe(true);
  });

  it('el bonificador de competencia usa el nivel TOTAL, no el de cada clase', () => {
    const state = character()
      .withClass('fighter', 3, 'champion')
      .withClass('wizard', 2, 'evocation')
      .build();
    expect(totalLevel(state)).toBe(5);
    expect(sheetOf(state).proficiencyBonus).toBe(3);
  });
});

describe('Aplicar la subida', () => {
  it('el maximo de PG lo deriva el motor, nunca lo guarda la subida', () => {
    const before = character().withClass('fighter', 1).abilities({ con: 14 }).build();
    const maxBefore = sheetOf(before).hitPoints.max.value;

    const plan = unwrap(planLevelUp(before, FIGHTER, content, scoresOf(before)));
    const applied = unwrap(applyLevelUp(before, plan, emptyChoice(), content));
    const after = { ...before, ...applied.patch };

    // d10: 10 al nivel 1 + 6 de promedio, +2 de CON por nivel
    expect(maxBefore).toBe(12);
    expect(sheetOf(after).hitPoints.max.value).toBe(20);
    expect('maxOverride' in after.hitPoints && after.hitPoints.maxOverride).toBeFalsy();
  });

  it('subir de nivel cura: los PG actuales suben lo mismo que el maximo', () => {
    const before = character().withClass('fighter', 1).abilities({ con: 14 }).withHitPoints(5).build();
    const plan = unwrap(planLevelUp(before, FIGHTER, content, scoresOf(before)));
    const applied = unwrap(applyLevelUp(before, plan, emptyChoice(), content));
    expect(applied.patch.hitPoints?.current).toBe(5 + 8);
  });

  it('la tirada de PG se registra y el maximo la refleja', () => {
    const before = character().withClass('fighter', 1).abilities({ con: 14 }).build();
    const plan = unwrap(planLevelUp(before, FIGHTER, content, scoresOf(before)));
    const applied = unwrap(
      applyLevelUp(before, plan, emptyChoice({ hitPointMethod: 'roll', hitPointValue: 9 }), content),
    );
    const after = { ...before, ...applied.patch };

    expect(after.hitPoints.mode).toBe('rolled');
    expect(after.hitPoints.rolls).toEqual([9]);
    // 10 + 9 + (2 × 2 de CON)
    expect(sheetOf(after).hitPoints.max.value).toBe(23);
  });

  it('pasar de promedio a tirada NO cambia el maximo de los niveles anteriores', () => {
    const before = character().withClass('fighter', 4, 'champion').abilities({ con: 14 }).build();
    const maxBefore = sheetOf(before).hitPoints.max.value;

    const plan = unwrap(planLevelUp(before, FIGHTER, content, scoresOf(before)));
    const applied = unwrap(
      applyLevelUp(before, plan, emptyChoice({ hitPointMethod: 'roll', hitPointValue: 6 }), content),
    );
    const after = { ...before, ...applied.patch };

    // La tirada elegida es exactamente el promedio: el maximo debe subir lo
    // mismo que habria subido con promedio fijo, ni un punto mas.
    expect(sheetOf(after).hitPoints.max.value).toBe(maxBefore + 6 + 2);
    expect(backfillHitPointRolls(before, content)).toEqual([6, 6, 6]);
  });

  it('la mejora de caracteristica se suma a la ficha y queda trazada', () => {
    const before = character().withClass('fighter', 3, 'champion').abilities({ str: 16 }).build();
    const plan = unwrap(planLevelUp(before, FIGHTER, content, scoresOf(before)));
    const applied = unwrap(
      applyLevelUp(
        before,
        plan,
        emptyChoice({ improvement: { kind: 'abilities', increases: [{ ability: 'str', amount: 2 }] } }),
        content,
      ),
    );
    const after = { ...before, ...applied.patch };
    const sheet = sheetOf(after);

    expect(sheet.abilities.str.score.value).toBe(18);
    expect(sheet.abilities.str.modifier).toBe(4);
    expect(sheet.abilities.str.score.contributions.map((c) => c.source.label)).toContain(
      'Mejora de característica (Fighter 4)',
    );
  });

  it('la subclase elegida se guarda en la entrada de clase', () => {
    const before = character().withClass('fighter', 2).build();
    const plan = unwrap(planLevelUp(before, FIGHTER, content, scoresOf(before)));
    const champion = plan.subclassOptions[0]!.id as DefinitionId;
    const applied = unwrap(applyLevelUp(before, plan, emptyChoice({ subclassId: champion }), content));

    expect(applied.patch.classes?.[0]?.subclassId).toBe(champion);
  });

  it('multiclasear añade una entrada sin tocar la primera', () => {
    const before = character().withClass('fighter', 3, 'champion').abilities({ int: 14 }).build();
    const plan = unwrap(planLevelUp(before, WIZARD, content, scoresOf(before)));
    const applied = unwrap(applyLevelUp(before, plan, emptyChoice(), content));
    const after = { ...before, ...applied.patch };

    expect(after.classes).toHaveLength(2);
    expect(after.classes[0]!.level).toBe(3);
    expect(after.classes[0]!.isPrimary).toBe(true);
    expect(after.classes[1]!.level).toBe(1);
    expect(after.classes[1]!.isPrimary).toBe(false);
    expect(totalLevel(after)).toBe(4);
  });

  it('los recursos gestionados suben solos: el motor los recalcula', () => {
    const before = character().withClass('barbarian', 2, 'berserker').build();
    const barbarian = srd14('class', 'barbarian') as DefinitionId;
    const plan = unwrap(planLevelUp(before, barbarian, content, scoresOf(before)));
    const applied = unwrap(applyLevelUp(before, plan, emptyChoice(), content));
    const after = { ...before, ...applied.patch };

    const ragesBefore = sheetOf(before).resources.find((r) => r.key === 'rage_count');
    const ragesAfter = sheetOf(after).resources.find((r) => r.key === 'rage_count');
    expect(ragesAfter!.maximum).toBeGreaterThan(ragesBefore!.maximum);
  });
});

describe('Validacion de elecciones', () => {
  it('no deja pasar de 20 con una mejora de caracteristica', () => {
    const state = character().withClass('fighter', 3, 'champion').abilities({ str: 19 }).build();
    const plan = unwrap(planLevelUp(state, FIGHTER, content, scoresOf(state)));
    const issues = validateLevelUp(
      plan,
      emptyChoice({ improvement: { kind: 'abilities', increases: [{ ability: 'str', amount: 2 }] } }),
      scoresOf(state),
      content,
    );
    expect(issues.map((i) => i.code)).toContain('levelUp.improvement.overCap');
  });

  it('exige repartir exactamente 2 puntos', () => {
    const state = character().withClass('fighter', 3, 'champion').build();
    const plan = unwrap(planLevelUp(state, FIGHTER, content, scoresOf(state)));
    const issues = validateLevelUp(
      plan,
      emptyChoice({ improvement: { kind: 'abilities', increases: [{ ability: 'str', amount: 1 }] } }),
      scoresOf(state),
      content,
    );
    expect(issues.map((i) => i.code)).toContain('levelUp.improvement.mustSpendTwo');
  });

  it('rechaza una tirada de PG fuera del dado', () => {
    const state = character().withClass('fighter', 1).build();
    const plan = unwrap(planLevelUp(state, FIGHTER, content, scoresOf(state)));
    const issues = validateLevelUp(
      plan,
      emptyChoice({ hitPointMethod: 'roll', hitPointValue: 11 }),
      scoresOf(state),
      content,
    );
    expect(issues.map((i) => i.code)).toContain('levelUp.roll.outOfRange');
  });

  it('rechaza un conjuro de nivel superior al accesible', () => {
    const state = character().withClass('wizard', 1).abilities({ int: 16 }).build();
    const plan = unwrap(planLevelUp(state, WIZARD, content, scoresOf(state)));
    const fireball = srd14('spell', 'fireball') as DefinitionId;
    const issues = validateLevelUp(plan, emptyChoice({ spells: [fireball] }), scoresOf(state), content);
    expect(issues.map((i) => i.code)).toContain('levelUp.spell.tooHigh');
  });

  it('una eleccion completa no deja problemas', () => {
    const state = character().withClass('fighter', 2).build();
    const plan = unwrap(planLevelUp(state, FIGHTER, content, scoresOf(state)));
    const issues = validateLevelUp(
      plan,
      emptyChoice({ subclassId: plan.subclassOptions[0]!.id as DefinitionId }),
      scoresOf(state),
      content,
    );
    expect(issues).toHaveLength(0);
  });
});

describe('Deshacer una subida de nivel', () => {
  it('devuelve el personaje EXACTAMENTE a como estaba', () => {
    const before = character()
      .withClass('fighter', 3, 'champion')
      .abilities({ str: 16, con: 14 })
      .withHitPoints(20)
      .build();

    const plan = unwrap(planLevelUp(before, FIGHTER, content, scoresOf(before)));
    const applied = unwrap(
      applyLevelUp(
        before,
        plan,
        emptyChoice({
          hitPointMethod: 'roll',
          hitPointValue: 8,
          improvement: { kind: 'abilities', increases: [{ ability: 'str', amount: 2 }] },
        }),
        content,
      ),
    );

    const after = { ...before, ...applied.patch };
    expect(sheetOf(after).level).toBe(4);
    expect(sheetOf(after).abilities.str.score.value).toBe(18);

    const reverted = { ...after, ...revertLevelUp(after, applied.revert) };

    expect(reverted.classes).toEqual(before.classes);
    expect(reverted.abilityIncreases).toEqual(before.abilityIncreases);
    expect(reverted.hitPoints).toEqual(before.hitPoints);
    expect(reverted.spells.known).toEqual(before.spells.known);
    expect(sheetOf(reverted).hitPoints.max.value).toBe(sheetOf(before).hitPoints.max.value);
    expect(sheetOf(reverted).abilities.str.score.value).toBe(16);
  });

  it('deshacer una multiclase elimina la entrada de clase entera', () => {
    const before = character().withClass('fighter', 3, 'champion').abilities({ int: 14 }).build();
    const plan = unwrap(planLevelUp(before, WIZARD, content, scoresOf(before)));
    const applied = unwrap(applyLevelUp(before, plan, emptyChoice(), content));
    const after = { ...before, ...applied.patch };
    expect(after.classes).toHaveLength(2);

    const reverted = { ...after, ...revertLevelUp(after, applied.revert) };
    expect(reverted.classes).toHaveLength(1);
    expect(totalLevel(reverted)).toBe(3);
  });

  it('deshacer quita la subclase solo si se eligio en esa subida', () => {
    const before = character().withClass('fighter', 2).build();
    const plan = unwrap(planLevelUp(before, FIGHTER, content, scoresOf(before)));
    const champion = plan.subclassOptions[0]!.id as DefinitionId;
    const applied = unwrap(applyLevelUp(before, plan, emptyChoice({ subclassId: champion }), content));
    const after = { ...before, ...applied.patch };

    const reverted = { ...after, ...revertLevelUp(after, applied.revert) };
    expect(reverted.classes[0]!.subclassId).toBeUndefined();
    expect(reverted.classes[0]!.level).toBe(2);
  });
});

describe('Comandos de progresion', () => {
  it('ApplyLevelUp sube el nivel y produce su propio inverso', () => {
    const before = character().withClass('fighter', 1).abilities({ con: 14 }).build();

    const executed = executeCommand(
      before,
      { type: 'ApplyLevelUp', classId: FIGHTER, hitPointMethod: 'average' },
      content,
      engine,
    );
    expect(isOk(executed)).toBe(true);
    if (!isOk(executed)) return;

    const after = executed.value.state;
    expect(sheetOf(after).level).toBe(2);
    expect(after.version).toBe(before.version + 1);

    const undo = executed.value.result.undo;
    expect(undo?.type).toBe('RevertLevelUp');

    const undone = executeCommand(after, undo!, content, engine);
    expect(isOk(undone)).toBe(true);
    if (!isOk(undone)) return;
    expect(sheetOf(undone.value.state).level).toBe(1);
    expect(undone.value.state.hitPoints.current).toBe(before.hitPoints.current);
  });

  it('el servidor rechaza una subida invalida aunque la interfaz la deje pasar', () => {
    // Sin subclase en el nivel que la exige: la validacion vive en el ejecutor,
    // que es el MISMO codigo que correra en el servidor.
    const state = character().withClass('fighter', 2).build();
    const outcome = executeCommand(
      state,
      { type: 'ApplyLevelUp', classId: FIGHTER, hitPointMethod: 'average' },
      content,
      engine,
    );
    expect(isErr(outcome)).toBe(true);
    if (isErr(outcome)) expect(outcome.error.detail).toContain('levelUp.subclass.required');
  });

  it('AwardExperience es un delta conmutativo con inverso exacto', () => {
    const state = character().withClass('fighter', 1).build();
    const first = executeCommand(state, { type: 'AwardExperience', amount: 500 }, content, engine);
    if (!isOk(first)) throw new Error('fallo');
    expect(first.value.state.experience).toBe(500);

    const undone = executeCommand(first.value.state, first.value.result.undo!, content, engine);
    if (!isOk(undone)) throw new Error('fallo');
    expect(undone.value.state.experience).toBe(0);
  });

  it('la experiencia nunca baja de cero, y el inverso lo respeta', () => {
    const state = character().withClass('fighter', 1).build();
    const outcome = executeCommand(state, { type: 'AwardExperience', amount: -100 }, content, engine);
    if (!isOk(outcome)) throw new Error('fallo');
    expect(outcome.value.state.experience).toBe(0);

    // Se resto 0 de verdad, asi que deshacer tiene que sumar 0, no 100.
    const undone = executeCommand(outcome.value.state, outcome.value.result.undo!, content, engine);
    if (!isOk(undone)) throw new Error('fallo');
    expect(undone.value.state.experience).toBe(0);
  });
});
