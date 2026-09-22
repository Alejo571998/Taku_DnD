import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncScheduler } from '@application/sync/scheduler';
import type { SyncEngine, SyncOutcome } from '@application/sync/engine';
import { asWorkspaceId } from '@domain/shared/ids';

/**
 * PLANIFICADOR DE SINCRONIZACION
 *
 * Lo que importa no es que llame al motor, sino CUANDO no lo llama: sin
 * agrupar rafagas y sin backoff, una mesa de cinco jugadores convierte cada
 * tirada de dado en una peticion.
 */

const WORKSPACE = asWorkspaceId('00000000-0000-7000-8000-000000000001');

const outcome: SyncOutcome = { pushed: 1, duplicates: 0, conflicts: 0, pulled: 0, cursor: 1 };

function fakeEngine(impl?: () => Promise<SyncOutcome | null>) {
  const sync = vi.fn(impl ?? (async () => outcome));
  return { engine: { sync } as unknown as SyncEngine, sync };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Disparadores', () => {
  it('sincroniza al arrancar', async () => {
    const { engine, sync } = fakeEngine();
    const scheduler = new SyncScheduler(engine, () => WORKSPACE);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(sync).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('agrupa una rafaga de mutaciones en una sola subida', async () => {
    const { engine, sync } = fakeEngine();
    const scheduler = new SyncScheduler(engine, () => WORKSPACE, { mutationDebounceMs: 1000 });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    sync.mockClear();

    // Diez acciones seguidas: una tirada, daño, curación… no son diez ciclos.
    for (let i = 0; i < 10; i++) scheduler.request('mutation');
    await vi.advanceTimersByTimeAsync(1000);

    expect(sync).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('volver la conexion dispara el ciclo sin esperar', async () => {
    const { engine, sync } = fakeEngine();
    const scheduler = new SyncScheduler(engine, () => WORKSPACE);
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    sync.mockClear();

    scheduler.request('online');
    await vi.advanceTimersByTimeAsync(0);

    expect(sync).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('el ciclo periodico sigue corriendo', async () => {
    const { engine, sync } = fakeEngine();
    const scheduler = new SyncScheduler(engine, () => WORKSPACE, { intervalMs: 60_000 });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    sync.mockClear();

    // 185s cubre tres disparos del intervalo mas el turno que cada uno encola.
    await vi.advanceTimersByTimeAsync(185_000);
    expect(sync).toHaveBeenCalledTimes(3);
    scheduler.stop();
  });

  it('sin workspace no se llama al motor', async () => {
    const { engine, sync } = fakeEngine();
    const scheduler = new SyncScheduler(engine, () => null);
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(sync).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it('parar cancela lo que quedaba pendiente', async () => {
    const { engine, sync } = fakeEngine();
    const scheduler = new SyncScheduler(engine, () => WORKSPACE, { mutationDebounceMs: 1000 });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    sync.mockClear();

    scheduler.request('mutation');
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(5000);

    expect(sync).not.toHaveBeenCalled();
  });
});

describe('Fallos y backoff', () => {
  it('espera cada vez mas tras cada fallo seguido', async () => {
    const { engine, sync } = fakeEngine(async () => {
      throw new Error('Servidor caído');
    });
    const scheduler = new SyncScheduler(engine, () => WORKSPACE, {
      backoffBaseMs: 1000,
      intervalMs: 10_000_000,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(sync).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(sync).toHaveBeenCalledTimes(2);

    // El segundo fallo NO reintenta al segundo: espera el doble.
    await vi.advanceTimersByTimeAsync(1000);
    expect(sync).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(sync).toHaveBeenCalledTimes(3);

    scheduler.stop();
  });

  it('el backoff tiene techo', async () => {
    const { engine } = fakeEngine(async () => {
      throw new Error('Servidor caído');
    });
    const scheduler = new SyncScheduler(engine, () => WORKSPACE, {
      backoffBaseMs: 1000,
      backoffMaxMs: 4000,
      intervalMs: 10_000_000,
      now: () => 0,
    });

    scheduler.start();
    for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(5000);

    const state = scheduler.getState();
    expect(state.phase).toBe('error');
    if (state.phase === 'error') expect(state.retryAt).toBeLessThanOrEqual(4000);
    scheduler.stop();
  });

  it('un ciclo correcto reinicia el backoff', async () => {
    let failing = true;
    const { engine, sync } = fakeEngine(async () => {
      if (failing) throw new Error('Servidor caído');
      return outcome;
    });
    const scheduler = new SyncScheduler(engine, () => WORKSPACE, {
      backoffBaseMs: 1000,
      intervalMs: 10_000_000,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sync).toHaveBeenCalledTimes(3);

    failing = false;
    scheduler.request('manual');
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.getState().phase).toBe('idle');

    // Tras el exito, el siguiente fallo vuelve a esperar lo minimo.
    failing = true;
    scheduler.request('manual');
    await vi.advanceTimersByTimeAsync(0);
    const calls = sync.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(sync).toHaveBeenCalledTimes(calls + 1);

    scheduler.stop();
  });
});

describe('Estado observable', () => {
  it('avisa a la interfaz de cada cambio de fase', async () => {
    const { engine } = fakeEngine();
    const scheduler = new SyncScheduler(engine, () => WORKSPACE);
    const phases: string[] = [];
    scheduler.subscribe((s) => phases.push(s.phase));

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(phases).toEqual(['syncing', 'idle']);
    scheduler.stop();
  });

  it('dos ciclos solapados no se pisan', async () => {
    const deferred = { resolve: () => {} };
    const { engine, sync } = fakeEngine(
      () =>
        new Promise<SyncOutcome>((resolve) => {
          deferred.resolve = () => resolve(outcome);
        }),
    );
    const scheduler = new SyncScheduler(engine, () => WORKSPACE);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    scheduler.request('online');
    await vi.advanceTimersByTimeAsync(0);

    expect(sync).toHaveBeenCalledTimes(1);
    deferred.resolve();
    scheduler.stop();
  });
});
