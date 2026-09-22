import type { WorkspaceId } from '@domain/shared/ids';
import type { SyncEngine, SyncOutcome } from './engine';

/**
 * PLANIFICADOR DE SINCRONIZACIÓN
 *
 * El motor sabe CÓMO sincronizar; esto decide CUÁNDO. Se separan a propósito:
 * el motor se prueba sin temporizadores y el planificador sin red.
 *
 * Disparadores (MASTER SPEC §56):
 *   - al arrancar        → recuperar lo que quedó de la sesión anterior
 *   - al volver la red   → el momento en que por fin se puede
 *   - al volver el foco  → otro dispositivo pudo cambiar algo mientras tanto
 *   - cada N minutos     → red de seguridad para sesiones largas
 *   - tras una mutación  → con retardo, para no enviar una petición por tecla
 *
 * Ningún disparador viene del DOM aquí: quien los conecta es la capa de
 * interfaz. Así este archivo corre igual en un test sin navegador.
 */

export type SyncTrigger = 'startup' | 'online' | 'focus' | 'interval' | 'mutation' | 'manual';

export type SchedulerState =
  | { readonly phase: 'idle'; readonly lastSyncAt?: string; readonly lastOutcome?: SyncOutcome }
  | { readonly phase: 'syncing'; readonly trigger: SyncTrigger }
  | { readonly phase: 'error'; readonly message: string; readonly retryAt?: number };

export type SchedulerOptions = {
  /** Cada cuánto corre el ciclo de seguridad. */
  readonly intervalMs?: number;
  /** Espera tras una mutación antes de subir, para agrupar ráfagas. */
  readonly mutationDebounceMs?: number;
  /** Espera inicial del backoff tras un fallo. */
  readonly backoffBaseMs?: number;
  readonly backoffMaxMs?: number;
  readonly now?: () => number;
};

const DEFAULTS = {
  intervalMs: 5 * 60_000,
  mutationDebounceMs: 4_000,
  backoffBaseMs: 5_000,
  backoffMaxMs: 5 * 60_000,
};

export class SyncScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private failures = 0;
  private stopped = true;
  private state: SchedulerState = { phase: 'idle' };
  private readonly listeners = new Set<(s: SchedulerState) => void>();
  private readonly options: Required<Omit<SchedulerOptions, 'now'>> & { now: () => number };

  constructor(
    private readonly engine: SyncEngine,
    private readonly workspaceId: () => WorkspaceId | null,
    options: SchedulerOptions = {},
  ) {
    this.options = {
      intervalMs: options.intervalMs ?? DEFAULTS.intervalMs,
      mutationDebounceMs: options.mutationDebounceMs ?? DEFAULTS.mutationDebounceMs,
      backoffBaseMs: options.backoffBaseMs ?? DEFAULTS.backoffBaseMs,
      backoffMaxMs: options.backoffMaxMs ?? DEFAULTS.backoffMaxMs,
      now: options.now ?? (() => Date.now()),
    };
  }

  subscribe(listener: (s: SchedulerState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): SchedulerState {
    return this.state;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.interval = setInterval(() => this.request('interval'), this.options.intervalMs);
    this.request('startup');
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.interval) clearInterval(this.interval);
    this.timer = null;
    this.interval = null;
  }

  /**
   * Pide un ciclo. Las mutaciones se agrupan; el resto va de inmediato.
   * Un ciclo ya en marcha no se interrumpe: el motor es reentrante por bandera
   * y volver a pedirlo solo gastaría red.
   */
  request(trigger: SyncTrigger): void {
    if (this.stopped) return;

    const delay = trigger === 'mutation' ? this.options.mutationDebounceMs : 0;

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run(trigger);
    }, delay);
  }

  /** Corre ahora mismo y devuelve el resultado. Lo usa el botón "Sincronizar". */
  async runNow(trigger: SyncTrigger = 'manual'): Promise<SyncOutcome | null> {
    return this.run(trigger);
  }

  private async run(trigger: SyncTrigger): Promise<SyncOutcome | null> {
    if (this.running) return null;
    const workspaceId = this.workspaceId();
    if (!workspaceId) return null;

    this.running = true;
    this.emit({ phase: 'syncing', trigger });

    try {
      /**
       * La reconciliación solo en `startup` y `manual`.
       *
       * Son los dos momentos en los que "asegurate de que no me falta nada"
       * vale un viaje extra: al abrir la aplicación —que es cuando pudo pasar
       * cualquier cosa mientras no estaba— y cuando el usuario toca
       * sincronizar, que es justo lo que está pidiendo. En el latido de cada
       * minuto sería pedir el inventario entero para nada.
       */
      const reconcile = trigger === 'startup' || trigger === 'manual';
      const outcome = await this.engine.sync(workspaceId, { reconcile });
      this.failures = 0;
      this.emit({
        phase: 'idle',
        lastSyncAt: new Date(this.options.now()).toISOString(),
        ...(outcome ? { lastOutcome: outcome } : {}),
      });
      return outcome;
    } catch (error) {
      // Backoff exponencial con techo. Un servidor caído no merece una
      // petición por segundo desde cada dispositivo abierto.
      this.failures++;
      const wait = Math.min(
        this.options.backoffMaxMs,
        this.options.backoffBaseMs * 2 ** (this.failures - 1),
      );
      this.emit({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Error de sincronización',
        retryAt: this.options.now() + wait,
      });

      if (!this.stopped) {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          this.timer = null;
          void this.run('interval');
        }, wait);
      }
      return null;
    } finally {
      this.running = false;
    }
  }

  private emit(state: SchedulerState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}
