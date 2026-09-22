import { describe, expect, it } from 'vitest';
import { character } from '../fixtures/characters';
import { loadContent, srd14, srd24 } from '../fixtures/content';
import { decideCompatibility, findAlternative } from '@domain/rules/compatibility';
import { checkCompatibility } from '@domain/rules/ruleset';
import { executeCommand } from '@application/commands/execute';
import { RulesEngine } from '@domain/rules/engine';
import { SRD_RULES } from '@domain/rules/srd-rules';
import { isErr, isOk } from '@domain/shared/result';
import type { DefinitionId } from '@domain/shared/ids';

/**
 * COMPATIBILIDAD ENTRE EDICIONES (MASTER SPEC §4)
 *
 * La regla NO es "nunca mezclar": es "nunca mezclar en silencio". Lo que se
 * prueba aqui es que forzar deje rastro, y que el rastro se pueda deshacer.
 */

const c2014 = loadContent('2014');
const c2024 = loadContent('2024');
const engine = new RulesEngine(SRD_RULES, '2014');

describe('Veredicto', () => {
  it('lo que declara la edicion del personaje es compatible', () => {
    const fireball = c2014.get(srd14('spell', 'fireball'))!;
    expect(checkCompatibility(fireball.rulesets, '2014').verdict).toBe('compatible');
  });

  it('lo de la otra edicion NO lo es, y ofrece las tres opciones', () => {
    const fireball24 = c2024.get(srd24('spell', 'fireball'))!;
    const report = checkCompatibility(fireball24.rulesets, '2014');
    expect(report.verdict).toBe('incompatible');
    expect(report.options).toEqual(['findAlternative', 'useAnyway', 'cancel']);
  });
});

describe('Alternativa en la edicion del personaje', () => {
  it('encuentra el equivalente por nombre', () => {
    const fireball24 = c2024.get(srd24('spell', 'fireball'))!;
    const alternative = findAlternative(fireball24, c2014);
    expect(alternative?.name).toBe('Fireball');
    expect(alternative?.rulesets).toContain('2014');
  });

  it('sin equivalente, no ofrece buscarlo: seria una promesa vacia', () => {
    // "Alert" es una dote del SRD 5.2 que no existe en el 5.1.
    const alert = c2024.get(srd24('feat', 'alert'));
    if (!alert) return;

    const decision = decideCompatibility(alert, '2014', c2014);
    expect(decision.alternative).toBeUndefined();
    expect(decision.report.options).not.toContain('findAlternative');
    expect(decision.report.options).toContain('useAnyway');
  });

  it('nunca sustituye sola: devuelve la sugerencia, no la aplica', () => {
    const fireball24 = c2024.get(srd24('spell', 'fireball'))!;
    const decision = decideCompatibility(fireball24, '2014', c2014);
    expect(decision.definition.id).toBe(fireball24.id);
    expect(decision.alternative?.id).not.toBe(fireball24.id);
  });
});

describe('Registro de lo forzado', () => {
  const forced = srd24('spell', 'fireball') as DefinitionId;

  it('aceptar deja constancia con fecha y edicion de origen', () => {
    const state = character('2014').withClass('wizard', 3, 'evocation').build();
    const outcome = executeCommand(
      state,
      { type: 'AcceptIncompatibleContent', definitionId: forced, declared: ['2024'] },
      c2014,
      engine,
    );
    expect(isOk(outcome)).toBe(true);
    if (!isOk(outcome)) return;

    const override = outcome.value.state.compatibilityOverrides[0]!;
    expect(override.definitionId).toBe(forced);
    expect(override.declared).toEqual(['2024']);
    expect(Date.parse(override.acceptedAt)).not.toBeNaN();
  });

  it('aceptar dos veces no duplica el registro', () => {
    const state = character('2014').withClass('wizard', 3, 'evocation').build();
    const first = executeCommand(
      state,
      { type: 'AcceptIncompatibleContent', definitionId: forced, declared: ['2024'] },
      c2014,
      engine,
    );
    if (!isOk(first)) throw new Error('fallo');

    const second = executeCommand(
      first.value.state,
      { type: 'AcceptIncompatibleContent', definitionId: forced, declared: ['2024'] },
      c2014,
      engine,
    );
    if (!isOk(second)) throw new Error('fallo');
    expect(second.value.state.compatibilityOverrides).toHaveLength(1);
  });

  it('se puede quitar del registro, y volver a ponerlo', () => {
    const state = character('2014').withClass('wizard', 3, 'evocation').build();
    const accepted = executeCommand(
      state,
      { type: 'AcceptIncompatibleContent', definitionId: forced, declared: ['2024'] },
      c2014,
      engine,
    );
    if (!isOk(accepted)) throw new Error('fallo');

    const revoked = executeCommand(accepted.value.state, accepted.value.result.undo!, c2014, engine);
    if (!isOk(revoked)) throw new Error('fallo');
    expect(revoked.value.state.compatibilityOverrides).toHaveLength(0);

    const restored = executeCommand(revoked.value.state, revoked.value.result.undo!, c2014, engine);
    if (!isOk(restored)) throw new Error('fallo');
    expect(restored.value.state.compatibilityOverrides).toHaveLength(1);
  });

  it('quitar algo que no estaba forzado falla en vez de fingir', () => {
    const state = character('2014').withClass('wizard', 3, 'evocation').build();
    const outcome = executeCommand(
      state,
      { type: 'RevokeIncompatibleContent', definitionId: forced },
      c2014,
      engine,
    );
    expect(isErr(outcome)).toBe(true);
  });
});
