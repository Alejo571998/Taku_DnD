import { resolveCharacter } from '@domain/character/engine';
import type { CharacterSheet } from '@domain/character/sheet';
import type { CharacterState } from '@domain/character/state';
import type { ContentIndex } from '@domain/content';
import type { RulesEngine } from '@domain/rules/engine';
import { errCode, isErr, ok, type Result } from '@domain/shared/result';
import { newClientOpId, newUuid, type CharacterId } from '@domain/shared/ids';
import { executeCommand } from '../commands/execute';
import type { Command, CommandEnvelope, CommandResult, HistoryEntry } from '../commands/types';
import type {
  CharacterRepository,
  HistoryRepository,
  OutboxRepository,
} from '../ports/repositories';
import type { ConflictRepository, ConflictResolution } from '../sync/conflicts';

/**
 * SERVICIO DE PERSONAJE
 *
 * El unico camino por el que la interfaz modifica un personaje.
 *
 * Secuencia de cada accion:
 *   1. aplicar en memoria          ← la interfaz responde YA
 *   2. persistir en la base local  ← sobrevive al cierre
 *   3. registrar en el historial   ← Deshacer y trazabilidad
 *   4. encolar en el outbox        ← se sincroniza cuando haya red
 *
 * Si no hay conexion, los pasos 1-3 funcionan igual. Eso es offline-first:
 * no un modo degradado, sino el camino normal.
 */
export class CharacterService {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly outbox: OutboxRepository,
    private readonly history: HistoryRepository,
    private readonly conflicts?: ConflictRepository,
  ) {}

  async load(id: CharacterId): Promise<CharacterState | undefined> {
    return this.characters.get(id);
  }

  sheet(state: CharacterState, content: ContentIndex, engine: RulesEngine): CharacterSheet {
    return resolveCharacter(state, content, engine);
  }

  /** Ejecuta un comando y deja el sistema coherente. */
  async dispatch(
    characterId: CharacterId,
    command: Command,
    content: ContentIndex,
    engine: RulesEngine,
  ): Promise<Result<{ state: CharacterState; result: CommandResult }>> {
    const current = await this.characters.get(characterId);
    if (!current) return errCode('character.notFound', { id: characterId as string });

    const executed = executeCommand(current, command, content, engine);
    if (isErr(executed)) return executed;

    const { state, result } = executed.value;

    const envelope: CommandEnvelope = {
      clientOpId: newClientOpId(),
      characterId,
      command,
      issuedAt: new Date().toISOString(),
      baseVersion: current.version,
    };

    await this.characters.save(state);

    const entry: HistoryEntry = {
      id: newUuid() as string,
      characterId,
      clientOpId: envelope.clientOpId,
      command,
      result,
      at: envelope.issuedAt,
      undone: false,
    };
    await this.history.append(entry);
    await this.outbox.enqueue(envelope);

    return ok({ state, result });
  }

  /**
   * Deshacer (MASTER SPEC §54).
   *
   * No revierte el estado a una foto anterior: ejecuta el comando INVERSO.
   * Asi el deshacer viaja por el mismo camino que cualquier otra accion y se
   * sincroniza igual — sin un mecanismo paralelo que pueda divergir.
   */
  async undo(
    characterId: CharacterId,
    entryId: string,
    content: ContentIndex,
    engine: RulesEngine,
  ): Promise<Result<{ state: CharacterState; result: CommandResult }>> {
    const entries = await this.history.recent(characterId, 100);
    const entry = entries.find((e) => e.id === entryId);

    if (!entry) return errCode('validation.failed', {}, 'entrada de historial no encontrada');
    if (entry.undone) return errCode('validation.failed', {}, 'esta accion ya se deshizo');
    if (!entry.result.undo) return errCode('validation.failed', {}, 'esta accion no se puede deshacer');

    const outcome = await this.dispatch(characterId, entry.result.undo, content, engine);
    if (isErr(outcome)) return outcome;

    await this.history.markUndone(entryId);
    return outcome;
  }

  /** Ultima accion deshacible. Alimenta el boton "Deshacer" del Modo Juego. */
  async lastUndoable(characterId: CharacterId): Promise<HistoryEntry | undefined> {
    const entries = await this.history.recent(characterId, 20);
    return entries.find((e) => !e.undone && e.result.undo);
  }

  async recentHistory(characterId: CharacterId, limit = 30): Promise<HistoryEntry[]> {
    return this.history.recent(characterId, limit);
  }

  /**
   * RESOLUCION DE CONFLICTOS
   *
   * El sistema nunca elige por el usuario. Aqui solo se ejecuta lo que ya
   * decidio, y queda registrado: descartar el trabajo de un dispositivo no
   * puede ser una operacion invisible.
   *
   * `adoptServer` trae el estado remoto. Se recibe como funcion para que el
   * servicio no dependa del transporte de sincronizacion.
   */
  async resolveConflict(
    characterId: CharacterId,
    resolution: ConflictResolution,
    content: ContentIndex,
    engine: RulesEngine,
    adoptServer?: () => Promise<CharacterState | null>,
  ): Promise<Result<{ state: CharacterState; result: CommandResult }>> {
    const conflict = await this.conflicts?.get(characterId as string);
    if (!conflict) return errCode('validation.failed', {}, 'no hay conflicto pendiente');

    if (resolution === 'server') {
      // Traer la version remota de verdad. Si no se puede (sin conexion),
      // no se resuelve nada: fingir que se adopto seria mentir.
      const remote = adoptServer ? await this.adoptOrNull(adoptServer) : null;
      if (remote) await this.characters.save(remote);
      else if (!(await this.characters.get(characterId))) {
        return errCode('character.notFound', { id: characterId as string });
      }
    } else {
      // Restaurar la foto local: la bajada pudo haberla pisado entre el
      // choque y este momento.
      await this.characters.save(conflict.localState);
    }

    const outcome = await this.dispatch(
      characterId,
      { type: 'ResolveSyncConflict', keep: resolution, serverVersion: conflict.serverVersion },
      content,
      engine,
    );
    if (isErr(outcome)) return outcome;

    await this.conflicts?.resolve(characterId as string, resolution);
    return outcome;
  }

  private async adoptOrNull(fn: () => Promise<CharacterState | null>): Promise<CharacterState | null> {
    try {
      return await fn();
    } catch {
      return null;
    }
  }

  async pendingConflictCount(): Promise<number> {
    return (await this.conflicts?.count()) ?? 0;
  }

  async pendingSyncCount(): Promise<number> {
    return this.outbox.count();
  }

  async save(state: CharacterState): Promise<void> {
    await this.characters.save(state);
  }

  async delete(id: CharacterId): Promise<void> {
    await this.characters.delete(id);
  }
}
