import type { RuleDefinition } from './vocabulary';

/**
 * REGLAS DEL SRD COMO DATOS
 *
 * Aqui viven las reglas que no se pueden derivar de la ficha tecnica del
 * contenido: formulas alternativas de CA, estilos de combate, rasgos de
 * especie con efecto mecanico.
 *
 * NINGUNA de estas reglas es un `if` dentro del motor. La Defensa sin
 * armadura del Barbaro y la del Monje son la MISMA regla con distintos
 * parametros — y el Homebrew puede declarar la suya igual de facil.
 */

const constant = (value: number) => ({ kind: 'constant' as const, value });

/** Genera la misma regla para ambas ediciones cambiando solo el prefijo del ID. */
function bothEditions(
  build: (prefix: 'srd-2014' | 'srd-2024') => Omit<RuleDefinition, 'rulesets' | 'id'> & { id: string },
): RuleDefinition[] {
  return (['2014', '2024'] as const).map((rs) => {
    const r = build(`srd-${rs}`);
    return { ...r, id: `${r.id}@${rs}`, rulesets: [rs] } as RuleDefinition;
  });
}

export const SRD_RULES: readonly RuleDefinition[] = [
  // ── Formulas alternativas de CA ────────────────────────────────────────────
  ...bothEditions((p) => ({
    id: `rule:${p}:barbarian-unarmored-defense`,
    label: 'Defensa sin armadura (Bárbaro)',
    when: { kind: 'computeStat', stat: 'ac' },
    if: [{ kind: 'hasFeature', featureId: `${p}:feature:barbarian-unarmored-defense` }],
    then: [
      {
        kind: 'setAcFormula',
        label: 'Defensa sin armadura',
        formula: { base: 10, abilities: ['dex', 'con'], allowShield: true, requiresNoArmor: true, requiresNoShield: false },
      },
    ],
    priority: 10,
    sourceId: 'system',
  })),

  ...bothEditions((p) => ({
    id: `rule:${p}:monk-unarmored-defense`,
    label: 'Defensa sin armadura (Monje)',
    when: { kind: 'computeStat', stat: 'ac' },
    if: [{ kind: 'hasFeature', featureId: `${p}:feature:monk-unarmored-defense` }],
    then: [
      {
        kind: 'setAcFormula',
        label: 'Defensa sin armadura',
        formula: { base: 10, abilities: ['dex', 'wis'], allowShield: false, requiresNoArmor: true, requiresNoShield: true },
      },
    ],
    priority: 10,
    sourceId: 'system',
  })),

  // ── Estilos de combate ─────────────────────────────────────────────────────
  ...bothEditions((p) => ({
    id: `rule:${p}:fighting-style-archery`,
    label: 'Estilo de combate: Tiro con arco',
    when: { kind: 'attackRoll' },
    if: [{ kind: 'hasFeature', featureId: `${p}:feature:fighter-fighting-style-archery` }],
    then: [{ kind: 'modifyAttackRoll', op: 'add', amount: constant(2), weaponRange: 'ranged' }],
    priority: 0,
    sourceId: 'system',
  })),

  ...bothEditions((p) => ({
    id: `rule:${p}:fighting-style-defense`,
    label: 'Estilo de combate: Defensa',
    when: { kind: 'computeStat', stat: 'ac' },
    if: [
      { kind: 'hasFeature', featureId: `${p}:feature:fighter-fighting-style-defense` },
      { kind: 'isWearingArmor', category: 'any' },
    ],
    then: [{ kind: 'modifyStat', stat: 'ac', op: 'add', amount: constant(1) }],
    priority: 20,
    sourceId: 'system',
  })),

  ...bothEditions((p) => ({
    id: `rule:${p}:fighting-style-dueling`,
    label: 'Estilo de combate: Duelo',
    when: { kind: 'damageRoll' },
    if: [{ kind: 'hasFeature', featureId: `${p}:feature:fighter-fighting-style-dueling` }],
    then: [{ kind: 'modifyDamageRoll', op: 'add', amount: constant(2), weaponRange: 'melee' }],
    priority: 0,
    sourceId: 'system',
  })),

  // ── Rasgos de especie con efecto mecanico ──────────────────────────────────
  ...bothEditions((p) => ({
    id: `rule:${p}:dwarven-resilience`,
    label: 'Resistencia enana',
    when: { kind: 'savingThrow', ability: 'con' },
    if: [{ kind: 'hasFeature', featureId: `${p}:trait:dwarven-resilience` }],
    then: [{ kind: 'grantAdvantage', on: 'save.con' }],
    priority: 0,
    sourceId: 'system',
  })),

  ...bothEditions((p) => ({
    id: `rule:${p}:fey-ancestry`,
    label: 'Ascendencia feérica',
    when: { kind: 'savingThrow' },
    if: [{ kind: 'hasFeature', featureId: `${p}:trait:fey-ancestry` }],
    then: [{ kind: 'grantAdvantage', on: 'save' }],
    priority: 0,
    sourceId: 'system',
  })),

  ...bothEditions((p) => ({
    id: `rule:${p}:brave`,
    label: 'Valiente',
    when: { kind: 'savingThrow' },
    if: [{ kind: 'hasFeature', featureId: `${p}:trait:brave` }],
    then: [{ kind: 'grantAdvantage', on: 'save' }],
    priority: 0,
    sourceId: 'system',
  })),

  // ── Velocidad ──────────────────────────────────────────────────────────────
  ...bothEditions((p) => ({
    id: `rule:${p}:barbarian-fast-movement`,
    label: 'Movimiento rápido',
    when: { kind: 'computeStat', stat: 'speed' },
    if: [
      { kind: 'hasFeature', featureId: `${p}:feature:fast-movement` },
      { kind: 'not', condition: { kind: 'isWearingArmor', category: 'heavy' } },
    ],
    then: [{ kind: 'modifySpeed', op: 'add', amount: constant(10) }],
    priority: 0,
    sourceId: 'system',
  })),

  ...bothEditions((p) => ({
    id: `rule:${p}:monk-unarmored-movement-1`,
    label: 'Movimiento sin armadura',
    when: { kind: 'computeStat', stat: 'speed' },
    if: [
      { kind: 'hasFeature', featureId: `${p}:feature:unarmored-movement-1` },
      { kind: 'isWearingArmor', category: 'none' },
      { kind: 'isUsingShield', value: false },
    ],
    then: [{ kind: 'modifySpeed', op: 'add', amount: constant(10) }],
    priority: 0,
    sourceId: 'system',
  })),

  /**
   * Armadura pesada sin la Fuerza requerida: -10 pies de velocidad.
   * El motor conoce el requisito de la armadura equipada; esta regla solo
   * declara la penalizacion para que aparezca en la trazabilidad.
   */
  ...bothEditions((p) => ({
    id: `rule:${p}:dwarven-armor-speed`,
    label: 'Constitución enana',
    when: { kind: 'computeStat', stat: 'speed' },
    if: [{ kind: 'hasFeature', featureId: `${p}:trait:dwarven-combat-training` }],
    then: [{ kind: 'modifySpeed', op: 'add', amount: constant(0) }],
    priority: 0,
    sourceId: 'system',
  })),

  // ── Puntos de golpe ────────────────────────────────────────────────────────
  ...bothEditions((p) => ({
    id: `rule:${p}:dwarven-toughness`,
    label: 'Tenacidad enana',
    when: { kind: 'computeStat', stat: 'maxHp' },
    if: [{ kind: 'hasFeature', featureId: `${p}:trait:dwarven-toughness` }],
    then: [{ kind: 'modifyMaxHp', op: 'add', amount: constant(1), perLevel: true }],
    priority: 0,
    sourceId: 'system',
  })),

  // ── Competencias otorgadas por rasgos ──────────────────────────────────────
  ...bothEditions((p) => ({
    id: `rule:${p}:keen-senses`,
    label: 'Sentidos agudos',
    when: { kind: 'always' },
    if: [{ kind: 'hasFeature', featureId: `${p}:trait:keen-senses` }],
    then: [{ kind: 'addProficiency', target: 'skill-perception' }],
    priority: 0,
    sourceId: 'system',
  })),

  ...bothEditions((p) => ({
    id: `rule:${p}:darkvision`,
    label: 'Visión en la oscuridad',
    when: { kind: 'always' },
    if: [{ kind: 'hasFeature', featureId: `${p}:trait:darkvision` }],
    then: [{ kind: 'addSense', sense: 'darkvision.60' }],
    priority: 0,
    sourceId: 'system',
  })),

  // ── Ataques adicionales ────────────────────────────────────────────────────
  ...bothEditions((p) => ({
    id: `rule:${p}:extra-attack`,
    label: 'Ataque adicional',
    when: { kind: 'always' },
    if: [
      {
        kind: 'anyOf',
        conditions: [
          { kind: 'hasFeature', featureId: `${p}:feature:extra-attack-1` },
          { kind: 'hasFeature', featureId: `${p}:feature:barbarian-extra-attack` },
          { kind: 'hasFeature', featureId: `${p}:feature:paladin-extra-attack` },
          { kind: 'hasFeature', featureId: `${p}:feature:ranger-extra-attack` },
          { kind: 'hasFeature', featureId: `${p}:feature:monk-extra-attack` },
        ],
      },
    ],
    then: [{ kind: 'grantExtraAttack', count: 1 }],
    priority: 0,
    sourceId: 'system',
  })),
];

/** Reglas de una edicion concreta. */
export const srdRulesFor = (ruleset: '2014' | '2024'): readonly RuleDefinition[] =>
  SRD_RULES.filter((r) => r.rulesets.includes(ruleset));
