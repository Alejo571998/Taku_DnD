import { describe, expect, it } from 'vitest';
import {
  buildDefinition,
  draftWithCompanions,
  emptyDraft,
  type EditorDraft,
} from '@ui/features/homebrew/HomebrewEditor';
import { isCompanionId, parentIdOf } from '@domain/content/homebrew';
import { DEFAULT_ASI_LEVELS, proficiencyBonusAtLevel } from '@domain/rules/standardProgression';
import type { AnyDefinition } from '@domain/content/schemas';
import { ContentIndex } from '@domain/content';
import { planLevelUp } from '@domain/character/progression';
import type { CharacterState } from '@domain/character/state';
import type { DefinitionId } from '@domain/shared/ids';
import { character } from '../fixtures/characters';
import { loadContent } from '../fixtures/content';

/**
 * ESPECIES Y CLASES CASERAS
 *
 * El editor cubría objetos y conjuros: una definición, un formulario. Especies
 * y clases rompen esa simetría porque NO son una definición sino varias —una
 * especie son sus rasgos—, y ahí es donde se puede colar contenido a medias.
 *
 * Lo que se comprueba acá es justo eso: que sale entero o no sale.
 */

const WS = 'w1234567-89ab-4cde-8f01-234567890abc';

const speciesDraft = (): EditorDraft => ({
  ...emptyDraft('species', '2014'),
  name: 'Elfo Nocturno',
  description: 'Vive donde no llega la luz.',
  speed: '35',
  size: 'Medium',
  languages: 'Common, Elvish',
  abilityBonuses: [{ ability: 'dex', bonus: '2' }],
  traits: [
    { name: 'Visión Nocturna', description: 'Ve en la oscuridad a 120 pies.' },
    { name: 'Paso Silencioso', description: 'Ventaja en Sigilo en penumbra.' },
  ],
});

const classDraft = (): EditorDraft => ({
  ...emptyDraft('class', '2014'),
  name: 'Centinela',
  hitDie: '10',
  savingThrows: ['con', 'wis'],
  armorProficiencies: 'light, medium, shields',
  weaponProficiencies: 'simple, martial',
  skillChoose: '2',
  skillFrom: ['perception', 'survival', 'athletics'],
  caster: 'half',
  spellAbility: 'wis',
  classFeatures: [
    { level: '1', name: 'Vigilia', description: 'No necesita dormir.' },
    { level: '5', name: 'Guardia Doble', description: 'Ataca dos veces.' },
  ],
});

describe('especies caseras', () => {
  it('genera la especie y un rasgo por cada rasgo escrito', () => {
    const built = buildDefinition(speciesDraft(), WS);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(built.definition.type).toBe('species');
    expect(built.companions).toHaveLength(2);
    expect(built.companions.every((c) => c.type === 'trait')).toBe(true);
  });

  it('la especie enlaza a sus rasgos por id, y los ids existen', () => {
    const built = buildDefinition(speciesDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    const species = built.definition as Extract<AnyDefinition, { type: 'species' }>;
    const companionIds = built.companions.map((c) => c.id);

    // Una especie que enlaza ids inexistentes deja al motor sin poder
    // resolverla, y el fallo aparece lejos: en la ficha, no acá.
    expect(species.traits).toHaveLength(2);
    for (const traitId of species.traits) {
      expect(companionIds).toContain(traitId);
    }
  });

  it('el id de un rasgo dice de quién es, sin tabla de relaciones', () => {
    const built = buildDefinition(speciesDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    for (const companion of built.companions) {
      expect(isCompanionId(companion.id)).toBe(true);
      expect(parentIdOf(companion.id)).toBe(built.definition.id);
    }
    // Y el padre NO es un acompañante: si lo fuera, desaparecería de la lista.
    expect(isCompanionId(built.definition.id)).toBe(false);
  });

  it('reabrir para editar recupera los rasgos', () => {
    const built = buildDefinition(speciesDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    const library = [built.definition, ...built.companions];
    const reopened = draftWithCompanions(built.definition, library);

    expect(reopened.traits.map((t) => t.name)).toEqual(['Visión Nocturna', 'Paso Silencioso']);
    expect(reopened.traits[0]?.description).toBe('Ve en la oscuridad a 120 pies.');
    expect(reopened.speed).toBe('35');
  });

  it('un rasgo sin nombre se descarta en vez de crear una definición vacía', () => {
    const built = buildDefinition(
      { ...speciesDraft(), traits: [{ name: '  ', description: 'algo' }] },
      WS,
    );
    if (!built.ok) throw new Error('no construyó');
    expect(built.companions).toHaveLength(0);
  });
});

describe('clases caseras', () => {
  it('rellena los veinte niveles sin preguntarlos', () => {
    const built = buildDefinition(classDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    const cls = built.definition as Extract<AnyDefinition, { type: 'class' }>;
    expect(Object.keys(cls.progression)).toHaveLength(20);
  });

  it('el bonificador de competencia es el del SRD, no uno inventado', () => {
    const built = buildDefinition(classDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    const cls = built.definition as Extract<AnyDefinition, { type: 'class' }>;
    // +2 hasta 4, +3 desde 5, +6 a nivel 17.
    expect(cls.progression['1']?.profBonus).toBe(2);
    expect(cls.progression['4']?.profBonus).toBe(2);
    expect(cls.progression['5']?.profBonus).toBe(3);
    expect(cls.progression['17']?.profBonus).toBe(6);
    expect(cls.progression['20']?.profBonus).toBe(6);

    for (const level of [1, 7, 13, 19]) {
      expect(cls.progression[String(level)]?.profBonus).toBe(proficiencyBonusAtLevel(level));
    }
  });

  it('un medio lanzador no tiene conjuros a nivel 1', () => {
    const built = buildDefinition(classDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    const cls = built.definition as Extract<AnyDefinition, { type: 'class' }>;
    // Una fila de lanzamiento con todo a cero haría aparecer un apartado de
    // conjuros vacío en la ficha de un personaje de nivel 1.
    expect(cls.progression['1']?.spellcasting).toBeUndefined();
    expect(cls.progression['2']?.spellcasting?.slots?.[0]).toBe(2);
    expect(cls.spellcasting?.startsAtLevel).toBe(2);
  });

  it('una clase sin conjuros no tiene ninguna fila de lanzamiento', () => {
    const built = buildDefinition({ ...classDraft(), caster: 'none' }, WS);
    if (!built.ok) throw new Error('no construyó');

    const cls = built.definition as Extract<AnyDefinition, { type: 'class' }>;
    expect(cls.spellcasting).toBeUndefined();
    expect(Object.values(cls.progression).every((r) => r.spellcasting == null)).toBe(true);
  });

  it('las mejoras de característica caen donde dice el borrador', () => {
    const built = buildDefinition(classDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    const cls = built.definition as Extract<AnyDefinition, { type: 'class' }>;
    const asi = Object.entries(cls.progression)
      .filter(([, row]) => row.abilityScoreImprovement)
      .map(([level]) => Number(level))
      .sort((a, b) => a - b);
    expect(asi).toEqual([...DEFAULT_ASI_LEVELS]);
  });

  it('cada rasgo queda enlazado en SU nivel', () => {
    const built = buildDefinition(classDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    const cls = built.definition as Extract<AnyDefinition, { type: 'class' }>;
    expect(cls.progression['1']?.features).toHaveLength(1);
    expect(cls.progression['5']?.features).toHaveLength(1);
    expect(cls.progression['3']?.features).toHaveLength(0);

    const ids = built.companions.map((c) => c.id);
    expect(ids).toContain(cls.progression['1']?.features[0]);
    expect(ids).toContain(cls.progression['5']?.features[0]);
  });

  it('exige dos salvaciones: ni una ni tres', () => {
    for (const savingThrows of [[], ['con'], ['con', 'wis', 'dex']] as const) {
      const built = buildDefinition({ ...classDraft(), savingThrows: [...savingThrows] }, WS);
      expect(built.ok).toBe(false);
      if (built.ok) continue;
      expect(built.issues.join(' ')).toMatch(/dos salvaciones/i);
    }
  });

  it('reabrir una clase deduce el tipo de lanzador de su propia tabla', () => {
    for (const caster of ['none', 'full', 'half', 'third'] as const) {
      const built = buildDefinition({ ...classDraft(), caster }, WS);
      if (!built.ok) throw new Error('no construyó');
      const reopened = draftWithCompanions(built.definition, [
        built.definition,
        ...built.companions,
      ]);
      // El esquema del SRD no guarda "medio lanzador": guarda la tabla. Que se
      // pueda volver de la tabla a la etiqueta es lo que hace reeditable una
      // clase sin inventar un campo que el SRD no tiene.
      expect(reopened.caster).toBe(caster);
    }
  });

  it('reabrir una clase recupera sus rasgos ordenados por nivel', () => {
    const built = buildDefinition(classDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    const reopened = draftWithCompanions(built.definition, [
      built.definition,
      ...built.companions,
    ]);
    expect(reopened.classFeatures.map((f) => [f.level, f.name])).toEqual([
      ['1', 'Vigilia'],
      ['5', 'Guardia Doble'],
    ]);
    expect(reopened.savingThrows).toEqual(['con', 'wis']);
    expect(reopened.hitDie).toBe('10');
  });
});

describe('dotes y trasfondos', () => {
  it('una dote guarda requisitos y bonificadores', () => {
    const built = buildDefinition(
      {
        ...emptyDraft('feat', '2014'),
        name: 'Centinela Alerta',
        featPrerequisites: 'Sabiduría 13 o más\nCompetencia en Percepción',
        abilityBonuses: [{ ability: 'wis', bonus: '1' }],
      },
      WS,
    );
    if (!built.ok) throw new Error('no construyó');

    const feat = built.definition as Extract<AnyDefinition, { type: 'feat' }>;
    expect(feat.prerequisites).toHaveLength(2);
    expect(feat.abilityBonuses).toEqual([{ ability: 'wis', bonus: 1 }]);
    // Una dote no arrastra rasgos: es una sola definición.
    expect(built.companions).toHaveLength(0);
  });

  it('un bonificador en blanco o en cero no llega a la definición', () => {
    const built = buildDefinition(
      {
        ...emptyDraft('feat', '2014'),
        name: 'Dote Vacía',
        abilityBonuses: [
          { ability: 'str', bonus: '' },
          { ability: 'dex', bonus: '0' },
          { ability: 'con', bonus: '2' },
        ],
      },
      WS,
    );
    if (!built.ok) throw new Error('no construyó');

    const feat = built.definition as Extract<AnyDefinition, { type: 'feat' }>;
    expect(feat.abilityBonuses).toEqual([{ ability: 'con', bonus: 2 }]);
  });

  it('un trasfondo separa habilidades por comas y guarda su rasgo', () => {
    const built = buildDefinition(
      {
        ...emptyDraft('background', '2014'),
        name: 'Guardabosques del Valle',
        skillProficiencies: 'Supervivencia, Naturaleza',
        toolProficiencies: 'Herramientas de herborista',
        startingGold: '15',
        featureName: 'Refugio del Valle',
        featureDescription: 'Siempre encontrás dónde dormir.',
      },
      WS,
    );
    if (!built.ok) throw new Error('no construyó');

    const bg = built.definition as Extract<AnyDefinition, { type: 'background' }>;
    expect(bg.skillProficiencies).toEqual(['Supervivencia', 'Naturaleza']);
    expect(bg.startingGold).toBe(15);
    expect(bg.feature?.name).toBe('Refugio del Valle');
  });
});

describe('el esquema manda igual para el contenido propio', () => {
  it('sin nombre no se construye nada', () => {
    const built = buildDefinition({ ...speciesDraft(), name: '   ' }, WS);
    expect(built.ok).toBe(false);
  });

  it('todo lo generado pasa el mismo Zod que el SRD', () => {
    // Si un acompañante no validara, la especie quedaría enlazando a un id que
    // nunca se escribió. Por eso el fallo de un rasgo tumba la operación entera.
    const built = buildDefinition(speciesDraft(), WS);
    if (!built.ok) throw new Error('no construyó');
    for (const definition of [built.definition, ...built.companions]) {
      expect(definition.sourceId).toBe(`homebrew:${WS}`);
      expect(definition.id.startsWith('srd')).toBe(false);
    }
  });
});

/**
 * SUBCLASES Y EQUIPO INICIAL
 *
 * Eran los dos huecos que quedaban del editor, y el primero no era cosmético:
 * `planLevelUp` solo ofrece elegir subclase si existe alguna con el `classId`
 * de la clase, y `resolveCharacter` avisa de «subclase pendiente» en cuanto se
 * llega al nivel que la clase declara. Una clase casera arrastraba ese aviso
 * para siempre porque no había forma de crearle una.
 *
 * Por eso lo que se comprueba no es que el formulario guarde los campos, sino
 * que el MOTOR resuelva: que la subclase se ofrezca al subir de nivel y que el
 * equipo llegue a la definición que el creador lee.
 */

const subclassDraft = (): EditorDraft => ({
  ...classDraft(),
  subclassLevel: '3',
  subclasses: [
    {
      name: 'Senda del Vigía',
      flavor: 'Nunca aparta la vista.',
      features: [
        { level: '3', name: 'Ojo Abierto', description: 'Ventaja en iniciativa.' },
        { level: '7', name: 'Guardia Eterna', description: 'No puede ser sorprendido.' },
      ],
    },
    { name: 'Senda del Muro', flavor: 'Aguanta.', features: [] },
  ],
});

describe('subclases caseras', () => {
  it('cada subclase es una definición propia que apunta a su clase', () => {
    const built = buildDefinition(subclassDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    const subs = built.companions.filter((d) => d.type === 'subclass');
    expect(subs).toHaveLength(2);
    for (const sub of subs) {
      expect((sub as Extract<AnyDefinition, { type: 'subclass' }>).classId).toBe(
        built.definition.id,
      );
    }

    const cls = built.definition as Extract<AnyDefinition, { type: 'class' }>;
    expect(cls.subclasses).toEqual(subs.map((s) => s.id));
  });

  it('los rasgos de la subclase NO se mezclan con los de la clase', () => {
    const built = buildDefinition(subclassDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    const cls = built.definition as Extract<AnyDefinition, { type: 'class' }>;
    // La clase de la maqueta da "Vigilia" a nivel 1 y "Guardia Doble" a nivel 5.
    // Si los de la subclase se colaran acá, TODOS los personajes de la clase
    // recibirían rasgos de una subclase que no eligieron.
    expect(cls.progression['3']?.features ?? []).toHaveLength(0);
    expect(cls.progression['7']?.features ?? []).toHaveLength(0);

    const vigia = built.companions.find(
      (d) => d.type === 'subclass' && d.name === 'Senda del Vigía',
    ) as Extract<AnyDefinition, { type: 'subclass' }> | undefined;
    expect(vigia?.progression['3']?.features).toHaveLength(1);
    expect(vigia?.progression['7']?.features).toHaveLength(1);
  });

  it('un rasgo de subclase sabe de qué subclase es', () => {
    const built = buildDefinition(subclassDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    const feature = built.companions.find((d) => d.name === 'Ojo Abierto') as
      | Extract<AnyDefinition, { type: 'feature' }>
      | undefined;
    expect(feature?.subclassId).toBeDefined();
    expect(feature?.level).toBe(3);
    // Cuelga de la subclase, no de la clase: es lo que permite recuperarlos
    // por separado al reeditar.
    expect(feature?.id.startsWith(`${feature?.subclassId}:feature:`)).toBe(true);
    expect(isCompanionId(feature!.id)).toBe(true);
    expect(parentIdOf(feature!.id)).toBe(built.definition.id);
  });

  it('una subclase sin rasgos sigue siendo elegible', () => {
    // "Senda del Muro" no tiene ninguno. Descartarla por eso dejaría al
    // usuario sin entender por qué desapareció del formulario.
    const built = buildDefinition(subclassDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    const muro = built.companions.find((d) => d.name === 'Senda del Muro');
    expect(muro).toBeDefined();
    expect((muro as Extract<AnyDefinition, { type: 'subclass' }>).progression).toEqual({});
  });

  it('reeditar recupera las subclases con sus rasgos, sin duplicar', () => {
    const built = buildDefinition(subclassDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    const library = [built.definition, ...built.companions];
    const draft = draftWithCompanions(built.definition, library);

    // En el ORDEN en que se escribieron. Filtrando la biblioteca por prefijo
    // salían por id —"del Muro" antes que "del Vigía"— y reabrir la clase
    // barajaba la lista.
    expect(draft.subclasses.map((s) => s.name)).toEqual([
      'Senda del Vigía',
      'Senda del Muro',
    ]);
    expect(draft.subclasses[0]?.features.map((f) => f.name)).toEqual([
      'Ojo Abierto',
      'Guardia Eterna',
    ]);
    // Los de la subclase no pueden aparecer también como rasgos de clase: al
    // volver a guardar se escribirían dos veces y el personaje los recibiría
    // sin haber elegido nada.
    expect(draft.classFeatures.map((f) => f.name)).toEqual(['Vigilia', 'Guardia Doble']);
  });
});

describe('una clase casera se puede subir de nivel de verdad', () => {
  const NEUTRAL = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const;

  const contentWith = (definition: AnyDefinition, companions: readonly AnyDefinition[]) =>
    new ContentIndex([...loadContent('2014').allDefinitions(), definition, ...companions]);

  const atLevel = (classId: string, level: number): CharacterState => ({
    ...character('2014').build(),
    classes: [{ classId: classId as DefinitionId, level, hitDiceSpent: 0, isPrimary: true }],
  });

  it('al llegar a su nivel de subclase, ofrece las que se crearon', () => {
    const built = buildDefinition(subclassDraft(), WS);
    if (!built.ok) throw new Error('no construyó');

    const plan = planLevelUp(
      atLevel(built.definition.id, 2),
      built.definition.id as DefinitionId,
      contentWith(built.definition, built.companions),
      NEUTRAL,
    );

    if (!plan.ok) throw new Error('no planificó');
    expect(plan.value.requiresSubclass).toBe(true);
    expect(plan.value.subclassOptions.map((s) => s.name).sort()).toEqual(
      ['Senda del Muro', 'Senda del Vigía'].sort(),
    );
  });

  it('sin subclases NO la pide: pedir lo que no existe deja al personaje atascado', () => {
    const built = buildDefinition({ ...subclassDraft(), subclasses: [] }, WS);
    if (!built.ok) throw new Error('no construyó');

    const plan = planLevelUp(
      atLevel(built.definition.id, 2),
      built.definition.id as DefinitionId,
      contentWith(built.definition, built.companions),
      NEUTRAL,
    );

    if (!plan.ok) throw new Error('no planificó');
    expect(plan.value.requiresSubclass).toBe(false);
  });
});

describe('equipo inicial casero', () => {
  const ANTORCHA = 'srd-2014:gear:torch';
  const CUERDA = 'srd-2014:gear:rope-hempen-50-feet';
  const ESPADA = 'srd-2014:weapon:longsword';

  it('un trasfondo guarda lo que lleva, con sus cantidades', () => {
    const built = buildDefinition(
      {
        ...emptyDraft('background', '2014'),
        name: 'Farolero',
        startingEquipment: [
          { definitionId: ANTORCHA, quantity: '10' },
          { definitionId: CUERDA, quantity: '1' },
        ],
      },
      WS,
    );
    if (!built.ok) throw new Error('no construyó');

    const bg = built.definition as Extract<AnyDefinition, { type: 'background' }>;
    expect(bg.startingEquipment).toEqual([
      { definitionId: ANTORCHA, quantity: 10 },
      { definitionId: CUERDA, quantity: 1 },
    ]);
  });

  it('una fila a medio llenar no llega a la definición', () => {
    const built = buildDefinition(
      {
        ...emptyDraft('background', '2014'),
        name: 'Farolero',
        startingEquipment: [
          { definitionId: '', quantity: '3' },
          { definitionId: ANTORCHA, quantity: '' },
        ],
      },
      WS,
    );
    if (!built.ok) throw new Error('no construyó');

    const bg = built.definition as Extract<AnyDefinition, { type: 'background' }>;
    // La primera se cae entera; la segunda se queda con una unidad, porque
    // "cero antorchas" en el inventario es una fila que no se puede usar.
    expect(bg.startingEquipment).toEqual([{ definitionId: ANTORCHA, quantity: 1 }]);
  });

  it('un grupo con una sola alternativa no se guarda: no hay nada que elegir', () => {
    const built = buildDefinition(
      {
        ...classDraft(),
        equipmentChoices: [
          {
            label: 'Arma',
            options: [{ label: 'Espada', items: [{ definitionId: ESPADA, quantity: '1' }] }],
          },
          {
            label: 'Luz',
            options: [
              { label: 'Antorchas', items: [{ definitionId: ANTORCHA, quantity: '10' }] },
              { label: 'Cuerda', items: [{ definitionId: CUERDA, quantity: '1' }] },
            ],
          },
        ],
      },
      WS,
    );
    if (!built.ok) throw new Error('no construyó');

    const cls = built.definition as Extract<AnyDefinition, { type: 'class' }>;
    expect(cls.startingEquipmentOptions).toHaveLength(1);
    expect(cls.startingEquipmentOptions[0]?.label).toBe('Luz');
    expect(cls.startingEquipmentOptions[0]?.choose).toBe(1);
  });

  it('reeditar devuelve el equipo tal como se guardó', () => {
    const built = buildDefinition(
      {
        ...classDraft(),
        startingEquipment: [{ definitionId: ESPADA, quantity: '1' }],
        equipmentChoices: [
          {
            label: 'Luz',
            options: [
              { label: 'Antorchas', items: [{ definitionId: ANTORCHA, quantity: '10' }] },
              { label: 'Cuerda', items: [{ definitionId: CUERDA, quantity: '1' }] },
            ],
          },
        ],
      },
      WS,
    );
    if (!built.ok) throw new Error('no construyó');

    const draft = draftWithCompanions(built.definition, [built.definition, ...built.companions]);
    expect(draft.startingEquipment).toEqual([{ definitionId: ESPADA, quantity: '1' }]);
    expect(draft.equipmentChoices[0]?.options[0]?.items).toEqual([
      { definitionId: ANTORCHA, quantity: '10' },
    ]);
  });
});
