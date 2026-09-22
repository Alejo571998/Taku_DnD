import type { CharacterState } from '@domain/character/state';
import type { ClientOpId, WorkspaceId } from '@domain/shared/ids';
import type { CommandEnvelope } from '../commands/types';
import type { CharacterRepository, OutboxRepository } from '../ports/repositories';
import type { ConflictRepository } from './conflicts';

/**
 * MOTOR DE SINCRONIZACIÓN
 *
 *   Base local → Outbox → Sync Engine → API → Base remota
 *
 * Trabajar sin conexión es el camino NORMAL, no un modo degradado: este motor
 * es lo que eventualmente reconcilia, y su ausencia nunca bloquea nada.
 */

export type SyncOutcome = {
  readonly pushed: number;
  readonly duplicates: number;
  readonly conflicts: number;
  readonly pulled: number;
  readonly cursor: number;
  /**
   * Cuántas entidades tuvo que arreglar la pasada de reconciliación.
   *
   * En condiciones normales es 0 siempre. Si deja de serlo con regularidad, el
   * cursor está perdiendo cambios y hay que mirar por qué.
   */
  readonly healed?: number;
};

export type SyncStatus =
  | { phase: 'idle'; pending: number; lastSyncAt?: string }
  | { phase: 'syncing' }
  | { phase: 'offline'; pending: number }
  | { phase: 'error'; message: string; pending: number };

/** Puerto de transporte. La implementación concreta vive en infrastructure/. */
export interface SyncTransport {
  isAvailable(): Promise<boolean>;
  push(
    workspaceId: WorkspaceId,
    operations: readonly CommandEnvelope[],
    snapshots: readonly { characterId: string; version: number; state: unknown }[],
  ): Promise<{
    results: { clientOpId: string; status: 'applied' | 'duplicate' | 'conflict' | 'rejected'; reason?: string }[];
    cursor: number;
  }>;
  pull(
    workspaceId: WorkspaceId,
    cursor: number,
  ): Promise<{
    changes: { entityId: string; operation: 'upsert' | 'delete'; state: unknown; version: number | null }[];
    cursor: number;
    hasMore: boolean;
  }>;
  /**
   * Estado actual de UNA entidad en el servidor.
   * Hace falta para resolver un conflicto eligiendo "la version del servidor":
   * cuando las dos versiones coinciden en numero pero no en contenido, el
   * ciclo de bajada no lo trae y habria que adivinar.
   */
  fetchEntity(
    workspaceId: WorkspaceId,
    entityId: string,
  ): Promise<{ state: unknown; version: number } | null>;
  /**
   * Inventario completo del workspace: solo ids y versiones, sin estado.
   *
   * Es la red de seguridad del cursor. Ver `SyncEngine.reconcile`.
   */
  fetchManifest(
    workspaceId: WorkspaceId,
  ): Promise<readonly { entityId: string; version: number; deleted: boolean }[]>;
}

export interface CursorStore {
  get(): Promise<number>;
  set(cursor: number, at: string): Promise<void>;
}

const BATCH_SIZE = 100;

export class SyncEngine {
  private running = false;

  constructor(
    private readonly transport: SyncTransport,
    private readonly outbox: OutboxRepository,
    private readonly characters: CharacterRepository,
    private readonly cursor: CursorStore,
    private readonly conflicts?: ConflictRepository,
  ) {}

  /**
   * Un ciclo completo: subir lo pendiente y bajar lo ajeno.
   *
   * Reentrante por bandera: dos ciclos solapados reenviarían las mismas
   * operaciones. La idempotencia del servidor lo cubriría, pero gastar red
   * para nada tampoco está bien.
   */
  async sync(
    workspaceId: WorkspaceId,
    options: { readonly reconcile?: boolean } = {},
  ): Promise<SyncOutcome | null> {
    if (this.running) return null;
    if (!(await this.transport.isAvailable())) return null;

    this.running = true;
    try {
      const pushResult = await this.pushPending(workspaceId);
      const pullResult = await this.pullChanges(workspaceId);
      const healed = options.reconcile ? await this.reconcile(workspaceId) : 0;

      return {
        ...pushResult,
        pulled: pullResult.pulled + healed,
        cursor: pullResult.cursor,
        healed,
      };
    } finally {
      this.running = false;
    }
  }

  /**
   * RED DE SEGURIDAD DEL CURSOR
   *
   * El cursor incremental tiene un agujero que no se puede tapar desde el
   * cliente: Postgres reserva el `seq` al INSERTAR, no al confirmar. Si dos
   * dispositivos escriben a la vez y el segundo confirma primero, un lector
   * puede ver el `seq` alto, adelantar el cursor y dejar el bajo —que confirma
   * un instante después— fuera de su alcance PARA SIEMPRE, porque la consulta
   * es `seq > cursor`.
   *
   * La ventana es de microsegundos y hace falta mala suerte. Pero "poco
   * probable" no es "imposible", y el síntoma sería el peor posible: un cambio
   * que se perdió en silencio, sin error, sin conflicto, sin rastro.
   *
   * Esto no lo evita: lo CURA. Se pide al servidor la lista de qué tiene y en
   * qué versión —solo ids y números, no estados— y se trae lo que falte o esté
   * atrasado. Es la diferencia entre "esperamos que no pase" y "si pasa, se
   * arregla en el siguiente arranque".
   *
   * No sustituye al cursor: corre solo al arrancar y cuando el usuario pide
   * sincronizar a mano. El ciclo normal sigue siendo incremental porque pedir
   * el inventario entero en cada latido sería absurdo.
   */
  async reconcile(workspaceId: WorkspaceId): Promise<number> {
    const manifest = await this.transport.fetchManifest(workspaceId);
    let healed = 0;

    for (const entry of manifest) {
      const local = await this.characters.get(entry.entityId as never);

      if (entry.deleted) {
        // Borrado en el servidor y todavía acá: la entrada de borrado se
        // perdió. Se borra, que es lo que el cursor debería haber traído.
        if (local) {
          await this.characters.delete(entry.entityId as never);
          healed++;
        }
        continue;
      }

      // Lo local más nuevo NO se toca: son cambios sin subir, y el ciclo de
      // subida los manda. Pisarlos acá sería perder trabajo del usuario.
      if (local && local.version >= entry.version) continue;

      const remote = await this.transport.fetchEntity(workspaceId, entry.entityId);
      if (!remote) continue;
      await this.characters.save(remote.state as CharacterState);
      healed++;
    }

    return healed;
  }

  private async pushPending(
    workspaceId: WorkspaceId,
  ): Promise<{ pushed: number; duplicates: number; conflicts: number }> {
    let pushed = 0;
    let duplicates = 0;
    let conflicts = 0;

    for (;;) {
      const pending = await this.outbox.pending(BATCH_SIZE);
      if (pending.length === 0) break;

      // Una instantánea por personaje afectado: el servidor necesita el estado
      // resultante, no solo la lista de comandos.
      const characterIds = [...new Set(pending.map((op) => op.characterId))];
      const snapshots: { characterId: string; version: number; state: CharacterState }[] = [];
      for (const id of characterIds) {
        const character = await this.characters.get(id);
        if (character) {
          snapshots.push({ characterId: id as string, version: character.version, state: character });
        }
      }

      let response;
      try {
        response = await this.transport.push(workspaceId, pending, snapshots);
      } catch (error) {
        // Fallo de red: se marcan como fallidas y el backoff exponencial hace
        // el resto. No se pierde nada.
        const message = error instanceof Error ? error.message : 'Error de red';
        for (const op of pending) await this.outbox.markFailed(op.clientOpId, message);
        break;
      }

      for (const result of response.results) {
        const id = result.clientOpId as ClientOpId;
        if (result.status === 'applied') {
          await this.outbox.markSent(id);
          pushed++;
        } else if (result.status === 'duplicate') {
          // Ya estaba aplicada: el reintento hizo su trabajo. Fuera de la cola.
          await this.outbox.markSent(id);
          duplicates++;
        } else if (result.status === 'conflict') {
          // Fuera de la cola: reenviarla volveria a chocar. Pero antes se
          // guarda la foto local, porque la bajada de este mismo ciclo va a
          // sobrescribir el personaje y el trabajo del usuario se perderia.
          await this.recordConflict(workspaceId, pending, id, result);
          await this.outbox.markSent(id);
          conflicts++;
        } else {
          await this.outbox.markFailed(id, result.reason ?? 'Rechazada por el servidor');
        }
      }

      if (pending.length < BATCH_SIZE) break;
    }

    return { pushed, duplicates, conflicts };
  }

  /**
   * Guarda el conflicto para que la interfaz pueda preguntar.
   * Sin repositorio de conflictos el motor sigue funcionando: se pierde la
   * posibilidad de resolver a mano, no la convergencia.
   */
  private async recordConflict(
    workspaceId: WorkspaceId,
    pending: readonly CommandEnvelope[],
    clientOpId: ClientOpId,
    result: { reason?: string; serverVersion?: number },
  ): Promise<void> {
    if (!this.conflicts) return;
    const envelope = pending.find((op) => op.clientOpId === clientOpId);
    if (!envelope) return;

    const local = await this.characters.get(envelope.characterId);
    if (!local) return;

    // Ya habia uno pendiente para este personaje: no se apilan. El usuario
    // resuelve una vez, no una por comando rechazado.
    const existing = await this.conflicts.get(envelope.characterId as string);
    if (existing && existing.status === 'pending') return;

    await this.conflicts.record({
      id: envelope.characterId as string,
      characterId: envelope.characterId as string,
      workspaceId: workspaceId as string,
      characterName: local.name,
      localVersion: local.version,
      serverVersion: result.serverVersion ?? local.version,
      localState: local,
      detectedAt: new Date().toISOString(),
      reason: result.reason ?? 'Otro dispositivo cambió este personaje.',
      status: 'pending',
    });
  }

  /**
   * Trae del servidor el estado de UNA entidad y lo adopta localmente.
   * Es lo que hace real la opcion "usar la version del servidor".
   */
  async adoptServerVersion(
    workspaceId: WorkspaceId,
    characterId: string,
  ): Promise<CharacterState | null> {
    const state = await this.fetchServerVersion(workspaceId, characterId);
    if (!state) return null;
    await this.characters.save(state);
    return state;
  }

  /**
   * Lee la version del servidor SIN adoptarla.
   * La interfaz la usa para mostrar la comparacion: pedirle al usuario que
   * elija sin enseñarle las dos versiones seria pedirle que adivine.
   */
  async fetchServerVersion(
    workspaceId: WorkspaceId,
    characterId: string,
  ): Promise<CharacterState | null> {
    const remote = await this.transport.fetchEntity(workspaceId, characterId);
    return remote ? (remote.state as CharacterState) : null;
  }

  private async pullChanges(workspaceId: WorkspaceId): Promise<{ pulled: number; cursor: number }> {
    let cursor = await this.cursor.get();
    let pulled = 0;

    for (;;) {
      const response = await this.transport.pull(workspaceId, cursor);
      if (response.changes.length === 0) break;

      for (const change of response.changes) {
        if (change.operation === 'delete') {
          await this.characters.delete(change.entityId as never);
          pulled++;
          continue;
        }

        const incoming = change.state as CharacterState | null;
        if (!incoming) continue;

        const local = await this.characters.get(change.entityId as never);

        /**
         * Convergencia: gana la versión más alta.
         *
         * Funciona porque las mutaciones de juego son deltas conmutativos
         * aplicados con idempotencia: el estado del servidor YA incluye lo que
         * este dispositivo envió. Si lo local es más nuevo, es que hay cambios
         * sin subir todavía — y se suben en el próximo ciclo.
         */
        if (!local || incoming.version > local.version) {
          await this.characters.save(incoming);
          pulled++;
        }
      }

      cursor = response.cursor;
      await this.cursor.set(cursor, new Date().toISOString());
      if (!response.hasMore) break;
    }

    return { pulled, cursor };
  }
}
