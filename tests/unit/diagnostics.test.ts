import { describe, expect, it } from 'vitest';
import {
  buildReport,
  diagnosticEvent,
  fromError,
  sanitizeDetail,
  summarizeDiagnostics,
} from '@application/observability/diagnostics';

/**
 * DIAGNOSTICO (MASTER PROMPT §80)
 *
 * Lo que se prueba aqui no es que registre: es que NO registre de mas. Un
 * informe que el usuario exporta y comparte no puede llevarse por delante sus
 * notas de partida ni su correo.
 */

describe('Saneado', () => {
  it('quita correos', () => {
    expect(sanitizeDetail('Fallo al enviar a alejo@ejemplo.com desde el cliente')).toBe(
      'Fallo al enviar a [correo] desde el cliente',
    );
  });

  it('quita identificadores de personaje', () => {
    const detail = 'No se encontro 01a0ac51-167d-7596-8673-20413aea3257 en la base';
    expect(sanitizeDetail(detail)).toBe('No se encontro [id] en la base');
  });

  it('quita tokens', () => {
    expect(sanitizeDetail('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc')).toContain('[token]');
    expect(sanitizeDetail('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc')).not.toContain('eyJ');
  });

  it('acota el largo: un stack entero no cabe en un informe', () => {
    expect(sanitizeDetail('x'.repeat(5000)).length).toBe(400);
  });
});

describe('Eventos', () => {
  it('convierte un Error en evento sin perder el tipo', () => {
    const event = fromError(new TypeError('algo es undefined'), 'render', 'render.crashed');
    expect(event.level).toBe('error');
    expect(event.area).toBe('render');
    expect(event.detail).toBe('TypeError: algo es undefined');
  });

  it('acepta lo que no es un Error sin romperse', () => {
    expect(fromError({ raro: true }, 'sync', 'sync.weird').detail).toBe('Error desconocido');
    expect(fromError('cayo la red', 'sync', 'sync.offline').detail).toBe('cayo la red');
  });

  it('sanea tambien lo que viene de un Error', () => {
    const event = fromError(new Error('fallo para juan@correo.com'), 'auth', 'auth.failed');
    expect(event.detail).not.toContain('juan@correo.com');
  });
});

describe('Resumen e informe', () => {
  const events = [
    diagnosticEvent({ level: 'error', area: 'sync', code: 'sync.cycleFailed', at: '2026-01-02T00:00:00.000Z' }),
    diagnosticEvent({ level: 'warning', area: 'command', code: 'command.rejected', at: '2026-01-01T00:00:00.000Z' }),
    diagnosticEvent({ level: 'error', area: 'sync', code: 'sync.cycleFailed', at: '2026-01-03T00:00:00.000Z' }),
  ];

  it('cuenta errores y agrupa por area', () => {
    const summary = summarizeDiagnostics(events);
    expect(summary.total).toBe(3);
    expect(summary.errors).toBe(2);
    expect(summary.byArea['sync']).toBe(2);
    expect(summary.since).toBe('2026-01-01T00:00:00.000Z');
  });

  it('el informe lleva entorno y eventos, y nada mas', () => {
    const report = JSON.parse(buildReport(events, { app: 'TAKU 0.1.0', online: true }));
    expect(Object.keys(report).sort()).toEqual(['environment', 'events', 'generatedAt', 'summary']);
    expect(report.events).toHaveLength(3);
    expect(report.environment.app).toBe('TAKU 0.1.0');
  });
});
