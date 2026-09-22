import { describe, expect, it } from 'vitest';
import { character, sheetOf } from '../fixtures/characters';
import { loadContent } from '../fixtures/content';
import { abilityModifier } from '@domain/character/ability';
import { applyDamage, applyHealing, applyTemporaryHitPoints } from '@domain/character/hitpoints';
import { consumeAmmunition } from '@domain/inventory/operations';
import { castSpell } from '@domain/spells/operations';
import { restoreResource, spendResource } from '@domain/resources/operations';
import { addCurrency, formatCurrency, subtractCurrency, totalInCopper } from '@domain/currency/currency';
import { checkCompatibility } from '@domain/rules/ruleset';
import { isErr, isOk, unwrap } from '@domain/shared/result';
import type { DefinitionId, ResourceInstanceId } from '@domain/shared/ids';
import { weightFromHundredths } from '@domain/shared/units';

/**
 * LOS 15 CASOS CRITICOS (MASTER PROMPT §59)
 *
 * Contra el contenido REAL del SRD, no contra maquetas. Un motor probado solo
 * con datos inventados no demuestra nada: los bugs de 5e viven en los casos
 * concretos.
 */

describe('CASO 1 · FUE 16 debe dar modificador +3', () => {
  it('calcula el modificador con floor((puntuacion - 10) / 2)', () => {
    expect(abilityModifier(16)).toBe(3);
  });

  it('lo refleja en la ficha resuelta', () => {
    const sheet = character('2014').withClass('fighter', 1).abilities({ str: 16 }).sheet();
    expect(sheet.abilities.str.score.value).toBe(16);
    expect(sheet.abilities.str.modifier).toBe(3);
  });

  it('redondea hacia abajo tambien en negativos: 7 → -2', () => {
    // trunc() daria -1, que esta mal. Es el bug clasico del modificador.
    expect(abilityModifier(7)).toBe(-2);
    expect(abilityModifier(9)).toBe(-1);
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(1)).toBe(-5);
    expect(abilityModifier(30)).toBe(10);
  });

  it('expone la procedencia del valor', () => {
    const sheet = character('2014')
      .withClass('fighter', 1)
      .withSpecies('dwarf')
      .abilities({ con: 14 })
      .sheet();
    const labels = sheet.abilities.con.score.contributions.map((c) => c.source.label);
    expect(labels).toContain('Puntuación base');
    expect(labels).toContain('Dwarf');
  });
});

describe('CASO 2 · Ataque con arma con competencia suma el bonificador', () => {
  it('guerrero con espada larga: +FUE +competencia', () => {
    const sheet = character('2014')
      .withClass('fighter', 1)
      .abilities({ str: 16 })
      .withItem('weapon', 'longsword', { slot: 'mainHand' })
      .sheet();

    const attack = sheet.attacks.find((a) => a.name === 'Longsword');
    expect(attack).toBeDefined();
    expect(attack!.proficient).toBe(true);
    // +3 de Fuerza, +2 de competencia
    expect(attack!.attackBonus.value).toBe(5);
    expect(attack!.damageExpression).toBe('1d8+3');
  });

  it('la trazabilidad nombra la competencia', () => {
    const sheet = character('2014')
      .withClass('fighter', 1)
      .abilities({ str: 16 })
      .withItem('weapon', 'longsword', { slot: 'mainHand' })
      .sheet();
    const attack = sheet.attacks.find((a) => a.name === 'Longsword')!;
    expect(attack.attackBonus.contributions.map((c) => c.source.label)).toContain('Competencia');
  });
});

describe('CASO 3 · Sin competencia NO se suma el bonificador', () => {
  it('mago con espada larga: solo el modificador de caracteristica', () => {
    const sheet = character('2014')
      .withClass('wizard', 1)
      .abilities({ str: 16 })
      .withItem('weapon', 'longsword', { slot: 'mainHand' })
      .sheet();

    const attack = sheet.attacks.find((a) => a.name === 'Longsword')!;
    expect(attack.proficient).toBe(false);
    expect(attack.attackBonus.value).toBe(3); // solo FUE, sin +2
  });

  it('avisa en la ficha, pero no bloquea: 5e penaliza, no prohibe', () => {
    const sheet = character('2014')
      .withClass('wizard', 1)
      .withItem('weapon', 'longsword', { slot: 'mainHand' })
      .sheet();
    expect(sheet.warnings.some((w) => w.code === 'weapon.notProficient')).toBe(true);
  });
});

describe('CASO 4 · Municion 23 → 22', () => {
  it('descuenta exactamente una flecha', () => {
    const state = character('2014')
      .withClass('ranger', 1)
      .withItem('weapon', 'longbow', { slot: 'twoHand' })
      .withItem('gear', 'arrow', { quantity: 23 })
      .build();

    const arrows = 'srd-2014:gear:arrow' as DefinitionId;
    const result = consumeAmmunition(state.inventory, arrows, 1);

    expect(isOk(result)).toBe(true);
    expect(unwrap(result).remaining).toBe(22);
  });

  it('el arco declara su municion vinculada', () => {
    const sheet = character('2014')
      .withClass('ranger', 1)
      .withItem('weapon', 'longbow', { slot: 'twoHand' })
      .withItem('gear', 'arrow', { quantity: 23 })
      .sheet();

    const bow = sheet.attacks.find((a) => a.name === 'Longbow')!;
    expect(bow.ammunition?.definitionId).toBe('srd-2014:gear:arrow');
    expect(bow.ammunition?.remaining).toBe(23);
  });

  it('al llegar a cero, la instancia desaparece del inventario', () => {
    const state = character('2014')
      .withClass('ranger', 1)
      .withItem('gear', 'arrow', { quantity: 1 })
      .build();

    const result = consumeAmmunition(state.inventory, 'srd-2014:gear:arrow' as DefinitionId, 1);
    expect(unwrap(result).inventory).toHaveLength(0);
  });
});

describe('CASO 5 · Sin municion: impide o advierte segun configuracion', () => {
  it('falla con un error explicable, no con una excepcion', () => {
    const state = character('2014')
      .withClass('ranger', 1)
      .withItem('gear', 'arrow', { quantity: 0 })
      .build();

    const result = consumeAmmunition(state.inventory, 'srd-2014:gear:arrow' as DefinitionId, 1);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('ammunition.depleted');
      // El error trae los datos que la UI necesita para explicarlo.
      expect(result.error.params).toMatchObject({ have: 0, need: 1 });
    }
  });

  it('tambien falla si no existe ninguna instancia de esa municion', () => {
    const state = character('2014').withClass('ranger', 1).build();
    const result = consumeAmmunition(state.inventory, 'srd-2014:gear:arrow' as DefinitionId, 1);
    expect(isErr(result)).toBe(true);
  });

  it('el ajuste de consumo automatico existe y por defecto esta activo', () => {
    const state = character('2014').withClass('ranger', 1).build();
    expect(state.settings.autoConsumeAmmunition).toBe(true);

    const off = character('2014')
      .withClass('ranger', 1)
      .withSettings({ autoConsumeAmmunition: false })
      .build();
    expect(off.settings.autoConsumeAmmunition).toBe(false);
  });
});

describe('CASO 6 · Lanzar un conjuro consume el espacio correcto', () => {
  it('mago de nivel 5 lanza Fireball: los espacios de nivel 3 bajan de 2 a 1', () => {
    const builder = character('2014').withClass('wizard', 5).abilities({ int: 16 });
    const sheet = builder.sheet();
    const casting = sheet.spellcasting[0]!;

    const level3 = casting.slots.find((s) => s.level === 3)!;
    expect(level3.total).toBe(2);
    expect(level3.available).toBe(2);

    const result = castSpell(
      sheet.state.spells,
      loadContent('2014'),
      'srd-2014:spell:fireball' as DefinitionId,
      3,
      casting.slots,
    );

    expect(isOk(result)).toBe(true);
    const outcome = unwrap(result);
    expect(outcome.consumedSlot).toBe(true);
    expect(outcome.slotsRemaining).toBe(1);
    expect(outcome.spells.slotsUsed[2]).toBe(1);
  });

  it('un truco no consume espacio', () => {
    const builder = character('2014').withClass('wizard', 5).abilities({ int: 16 });
    const sheet = builder.sheet();
    const result = castSpell(
      sheet.state.spells,
      loadContent('2014'),
      'srd-2014:spell:fire-bolt' as DefinitionId,
      0,
      sheet.spellcasting[0]!.slots,
    );
    expect(unwrap(result).consumedSlot).toBe(false);
  });

  it('sin espacios disponibles, falla con un motivo', () => {
    const builder = character('2014').withClass('wizard', 5).abilities({ int: 16 });
    const sheet = builder.sheet();
    const noSlots = sheet.spellcasting[0]!.slots.map((s) => ({ ...s, available: 0 }));

    const result = castSpell(
      sheet.state.spells,
      loadContent('2014'),
      'srd-2014:spell:fireball' as DefinitionId,
      3,
      noSlots,
    );
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('spellSlot.insufficient');
  });

  it('no permite lanzar con un espacio de nivel inferior al del conjuro', () => {
    const builder = character('2014').withClass('wizard', 5).abilities({ int: 16 });
    const sheet = builder.sheet();
    const result = castSpell(
      sheet.state.spells,
      loadContent('2014'),
      'srd-2014:spell:fireball' as DefinitionId,
      1,
      sheet.spellcasting[0]!.slots,
    );
    expect(isErr(result)).toBe(true);
  });

  it('calcula la CD de salvacion: 8 + competencia + caracteristica', () => {
    const sheet = character('2014').withClass('wizard', 5).abilities({ int: 16 }).sheet();
    // 8 + 3 (competencia nivel 5) + 3 (INT 16)
    expect(sheet.spellcasting[0]!.saveDc.value).toBe(14);
    expect(sheet.spellcasting[0]!.spellAttackBonus.value).toBe(6);
  });
});

describe('CASO 7 · Recurso 3/3 → 2/3 → 3/3', () => {
  const resources = [
    {
      id: 'r1' as ResourceInstanceId,
      key: 'rages',
      label: 'Furias',
      current: 3,
      maximum: 3,
      recovery: 'longRest' as const,
      sourceLabel: 'Bárbaro',
      managed: true,
    },
  ];

  it('gasta uno', () => {
    const after = unwrap(spendResource(resources, 'rages', 1));
    expect(after[0]!.current).toBe(2);
    expect(after[0]!.maximum).toBe(3);
  });

  it('lo recupera', () => {
    const spent = unwrap(spendResource(resources, 'rages', 1));
    const restored = restoreResource(spent, 'rages', 1);
    expect(restored[0]!.current).toBe(3);
  });

  it('nunca supera el maximo al recuperar', () => {
    expect(restoreResource(resources, 'rages', 99)[0]!.current).toBe(3);
  });

  it('no permite gastar mas de lo disponible', () => {
    const result = spendResource(resources, 'rages', 4);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('resource.insufficient');
  });

  it('el motor genera los recursos de clase desde la progresion', () => {
    const sheet = character('2014').withClass('barbarian', 3).sheet();
    const rages = sheet.resources.find((r) => r.key === 'rage_count');
    expect(rages).toBeDefined();
    expect(rages!.label).toBe('Furias');
    // Barbaro nivel 3: 3 furias por descanso largo.
    expect(rages!.maximum).toBe(3);
    expect(rages!.recovery).toBe('longRest');
  });
});

describe('CASO 8 · Daño: 30 HP → 23 HP', () => {
  it('resta exactamente el daño recibido', () => {
    const hp = {
      current: 30,
      temporary: 0,
      mode: 'fixed' as const,
      rolls: [],
      bonusPerLevel: 0,
      deathSaves: { successes: 0, failures: 0 },
    };
    const result = applyDamage(hp, 7, 30);
    expect(result.hitPoints.current).toBe(23);
    expect(result.appliedToCurrent).toBe(7);
    expect(result.wentDown).toBe(false);
  });

  it('nunca baja de cero', () => {
    const hp = {
      current: 5,
      temporary: 0,
      mode: 'fixed' as const,
      rolls: [],
      bonusPerLevel: 0,
      deathSaves: { successes: 0, failures: 0 },
    };
    const result = applyDamage(hp, 100, 30);
    expect(result.hitPoints.current).toBe(0);
    expect(result.wentDown).toBe(true);
  });

  it('daño masivo con el personaje a 0: muerte instantanea', () => {
    const hp = {
      current: 10,
      temporary: 0,
      mode: 'fixed' as const,
      rolls: [],
      bonusPerLevel: 0,
      deathSaves: { successes: 0, failures: 0 },
    };
    expect(applyDamage(hp, 45, 30).instantDeath).toBe(true);
    expect(applyDamage(hp, 20, 30).instantDeath).toBe(false);
  });
});

describe('CASO 9 · Curacion: 23 HP → 30 HP sin superar el maximo', () => {
  const hp = {
    current: 23,
    temporary: 0,
    mode: 'fixed' as const,
    rolls: [],
    bonusPerLevel: 0,
    deathSaves: { successes: 0, failures: 0 },
  };

  it('cura hasta el valor pedido', () => {
    expect(applyHealing(hp, 7, 30).hitPoints.current).toBe(30);
  });

  it('no supera el maximo y reporta lo desperdiciado', () => {
    const result = applyHealing(hp, 50, 30);
    expect(result.hitPoints.current).toBe(30);
    expect(result.healed).toBe(7);
    expect(result.wasted).toBe(43);
  });

  it('revivir desde 0 limpia las salvaciones contra muerte', () => {
    const down = { ...hp, current: 0, deathSaves: { successes: 1, failures: 2 } };
    const result = applyHealing(down, 5, 30);
    expect(result.revived).toBe(true);
    expect(result.hitPoints.deathSaves).toEqual({ successes: 0, failures: 0 });
  });
});

describe('CASO 10 · PG temporales respetan sus reglas', () => {
  const hp = {
    current: 20,
    temporary: 5,
    mode: 'fixed' as const,
    rolls: [],
    bonusPerLevel: 0,
    deathSaves: { successes: 0, failures: 0 },
  };

  it('NO se acumulan: se queda con la mejor fuente', () => {
    expect(applyTemporaryHitPoints(hp, 8).hitPoints.temporary).toBe(8);
    expect(applyTemporaryHitPoints(hp, 3).hitPoints.temporary).toBe(5);
    // Sumar 5 + 8 = 13 seria el error clasico.
    expect(applyTemporaryHitPoints(hp, 8).hitPoints.temporary).not.toBe(13);
  });

  it('absorben el daño antes que los PG reales', () => {
    const result = applyDamage(hp, 3, 30);
    expect(result.absorbedByTemp).toBe(3);
    expect(result.hitPoints.temporary).toBe(2);
    expect(result.hitPoints.current).toBe(20);
  });

  it('el sobrante pasa a los PG reales', () => {
    const result = applyDamage(hp, 9, 30);
    expect(result.absorbedByTemp).toBe(5);
    expect(result.hitPoints.temporary).toBe(0);
    expect(result.hitPoints.current).toBe(16);
  });

  it('la ficha expone los PG efectivos', () => {
    const sheet = character('2014')
      .withClass('fighter', 3)
      .abilities({ con: 14 })
      .withHitPoints(20, 5)
      .sheet();
    expect(sheet.hitPoints.effective).toBe(25);
  });
});

describe('CASO 11 · El peso del inventario se actualiza correctamente', () => {
  it('suma peso por cantidad, en centesimas de libra', () => {
    const sheet = character('2014')
      .withClass('fighter', 1)
      .abilities({ str: 15 })
      .withItem('armor', 'chain-mail')
      .withItem('weapon', 'longsword')
      .sheet();

    // Cota de malla 55 lb + espada larga 3 lb = 58 lb = 5800 centesimas
    expect(sheet.carrying.carried).toBe(weightFromHundredths(5800));
  });

  it('la capacidad es FUE × 15 lb', () => {
    const sheet = character('2014').withClass('fighter', 1).abilities({ str: 15 }).sheet();
    expect(sheet.carrying.capacity).toBe(weightFromHundredths(15 * 1500));
  });

  it('detecta exceso de carga', () => {
    const sheet = character('2014')
      .withClass('fighter', 1)
      .abilities({ str: 3 })
      .withItem('armor', 'chain-mail', { quantity: 2 })
      .sheet();
    expect(sheet.carrying.status).toBe('exceeded');
    expect(sheet.warnings.some((w) => w.code === 'carrying.exceeded')).toBe(true);
  });

  it('la aritmetica entera no deriva al sumar muchas veces', () => {
    // 200 objetos de 0,5 lb = exactamente 100 lb. En coma flotante derivaria.
    const builder = character('2014').withClass('fighter', 1).abilities({ str: 20 });
    for (let i = 0; i < 200; i++) builder.withItem('gear', 'arrow', { quantity: 1 });
    // La flecha pesa 0,05 lb → 5 centesimas. 200 × 5 = 1000 exacto.
    expect(builder.sheet().carrying.carried).toBe(weightFromHundredths(1000));
  });
});

describe('CASO 12 · Dinero conserva las cinco denominaciones', () => {
  const purse = { gp: 10, pp: 2, ep: 3, sp: 40, cp: 55 };

  it('mantiene los cinco contadores independientes', () => {
    expect(Object.keys(purse).sort()).toEqual(['cp', 'ep', 'gp', 'pp', 'sp']);
  });

  it('calcula el total en cobre sin perdida', () => {
    // 10 po=1000, 2 pp=2000, 3 pe=150, 40 pa=400, 55 pc=55
    expect(totalInCopper(purse)).toBe(3605);
  });

  it('sumar y restar no destruye denominaciones', () => {
    const added = addCurrency(purse, { gp: 5, cp: 10 });
    expect(added).toEqual({ gp: 15, pp: 2, ep: 3, sp: 40, cp: 65 });

    const removed = unwrap(subtractCurrency(added, { gp: 5, cp: 10 }));
    expect(removed).toEqual(purse);
  });

  it('NO convierte en silencio: si falta una denominacion concreta, falla', () => {
    const result = subtractCurrency({ gp: 0, pp: 5, ep: 0, sp: 0, cp: 0 }, { gp: 1 });
    expect(isErr(result)).toBe(true);
    // Tiene 5 pp (=50 po de valor) pero cero po. Convertir sin preguntar
    // seria destruir monedas a espaldas del jugador.
  });

  it('el oro primero y las siglas de la hoja oficial: PO · PC · PP · PE · PPT', () => {
    /*
      `PP` es PLATA y `PPT` platino, como en la hoja de 2024. Antes era al
      revés y la misma sigla significaba dos monedas distintas según si
      mirabas la aplicación o el papel.

      El oro encabeza porque es con lo que se compra —el precio del SRD viene
      en `gp`—; detrás van las otras cuatro en la secuencia del papel.
    */
    const text = formatCurrency(purse);
    expect(text).toBe('10 PO · 55 PC · 40 PP · 3 PE · 2 PPT');
  });

  /*
    ESTO ESTABA ROTO Y NADIE LO VEÍA.

    El SRD da el oro inicial del trasfondo como `{quantity: 15, unit: "gp"}`, y
    el volcado lo copiaba tal cual en un campo que el esquema declara entero.
    `formatCurrency` se lo pasaba a `Intl.NumberFormat`, y la ficha de CUALQUIER
    personaje con trasfondo Acólito decía **«NaN PO»**.

    El filtro `c[d] !== 0` no lo atrapaba, porque `NaN !== 0` es cierto. Lo
    atrapa este test, que comprueba las dos mitades: que el contenido traiga
    números, y que el formateador no pueda escupir NaN aunque le entren.
  */
  it('el oro inicial de los trasfondos es un número, no el objeto del SRD', () => {
    for (const ruleset of ['2014', '2024'] as const) {
      for (const background of loadContent(ruleset).all('background')) {
        const gold = (background as { startingGold?: unknown }).startingGold;
        expect(typeof gold, `${background.id} trae ${JSON.stringify(gold)}`).toBe('number');
        expect(Number.isFinite(gold as number)).toBe(true);
      }
    }
  });

  it('el monedero nunca se muestra como NaN', () => {
    const roto = { ...purse, gp: Number.NaN };
    expect(formatCurrency(roto)).not.toContain('NaN');
  });
});

describe('CASO 13 · Ruleset 2014 no acepta contenido 2024 en silencio', () => {
  it('marca el contenido incompatible y explica las opciones', () => {
    const report = checkCompatibility(['2024'], '2014');
    expect(report.verdict).toBe('incompatible');
    expect(report.reasonCode).toBe('ruleset.mismatch');
    expect(report.options).toContain('findAlternative');
    expect(report.options).toContain('cancel');
    expect(report.options).toContain('useAnyway');
  });

  it('el indice de contenido filtrado por ruleset no cruza ediciones', () => {
    const only2014 = loadContent('2014').compatibleWith('2014');
    expect(only2014.size).toBeGreaterThan(0);
    for (const def of only2014.classes()) {
      expect(def.rulesets).toContain('2014');
      expect(def.rulesets).not.toContain('2024');
    }
  });

  it('el contenido de 2024 no aparece al filtrar por 2014', () => {
    const mixed = loadContent('2024');
    expect(mixed.compatibleWith('2014').size).toBe(0);
  });
});

describe('CASO 14 · Ruleset 2024 aplica sus propias reglas', () => {
  it('carga el contenido de 2024 y lo declara como tal', () => {
    const content = loadContent('2024');
    const fighter = content.class('srd-2024:class:fighter');
    expect(fighter).toBeDefined();
    expect(fighter!.rulesets).toEqual(['2024']);
  });

  it('resuelve una ficha completa con reglas 2024', () => {
    const sheet = character('2024')
      .withClass('fighter', 5)
      .abilities({ str: 16, con: 14 })
      .withItem('weapon', 'longsword', { slot: 'mainHand' })
      .sheet();

    expect(sheet.ruleset).toBe('2024');
    expect(sheet.proficiencyBonus).toBe(3);
    const attack = sheet.attacks.find((a) => a.name === 'Longsword')!;
    expect(attack.attackBonus.value).toBe(6); // +3 FUE, +3 competencia
  });

  it('en 2024 las armas declaran su propiedad de maestria', () => {
    const longsword = loadContent('2024').weapon('srd-2024:weapon:longsword');
    expect(longsword!.mastery).toBe('sap');
    // En 2014 esa propiedad no existe.
    expect(loadContent('2014').weapon('srd-2014:weapon:longsword')!.mastery).toBeUndefined();
  });

  it('los motores de cada edicion no comparten reglas', () => {
    const sheet14 = character('2014').withClass('barbarian', 1).sheet();
    const sheet24 = character('2024').withClass('barbarian', 1).sheet();
    expect(sheet14.ruleset).not.toBe(sheet24.ruleset);
  });
});

describe('Integridad general de la ficha', () => {
  it('un guerrero enano de nivel 5 sale coherente de punta a punta', () => {
    const sheet = character('2014')
      .withClass('fighter', 5, 'champion')
      .withSpecies('dwarf', 'hill-dwarf')
      .withBackground('acolyte')
      .abilities({ str: 16, dex: 12, con: 14, int: 10, wis: 13, cha: 8 })
      .withItem('armor', 'chain-mail', { slot: 'armor' })
      .withItem('armor', 'shield', { slot: 'shield' })
      .withItem('weapon', 'longsword', { slot: 'mainHand' })
      .withSkill('athletics')
      .sheet();

    expect(sheet.level).toBe(5);
    expect(sheet.proficiencyBonus).toBe(3);
    // Enano: +2 CON → 16 → modificador +3
    expect(sheet.abilities.con.modifier).toBe(3);
    // Cota de malla 16 (sin DES) + escudo 2
    expect(sheet.armorClass.value).toBe(18);
    // Atletismo: +3 FUE +3 competencia
    expect(sheet.skills.athletics.modifier.value).toBe(6);
    expect(sheet.skills.athletics.passive).toBe(16);
    // Sigilo con desventaja por la armadura pesada
    expect(sheet.skills.stealth.advantage.disadvantage.length).toBeGreaterThan(0);
    expect(sheet.hitDice[0]!.die).toBe(10);
    expect(sheet.hitPoints.max.value).toBeGreaterThan(30);
  });

  it('todo valor derivado trae su procedencia', () => {
    const sheet = character('2014')
      .withClass('fighter', 5)
      .withItem('armor', 'chain-mail', { slot: 'armor' })
      .withItem('armor', 'shield', { slot: 'shield' })
      .sheet();

    expect(sheet.armorClass.contributions.length).toBeGreaterThanOrEqual(2);
    const labels = sheet.armorClass.contributions.map((c) => c.source.label);
    expect(labels).toContain('Chain Mail');
    expect(labels).toContain('Shield');
  });

  it('la ficha se recalcula: nunca hay derivados guardados', () => {
    const state = character('2014').withClass('fighter', 5).abilities({ str: 16 }).build();
    const a = sheetOf(state);
    const b = sheetOf({ ...state, abilityScores: { ...state.abilityScores, str: 20 } });
    expect(a.abilities.str.modifier).toBe(3);
    expect(b.abilities.str.modifier).toBe(5);
  });
});
