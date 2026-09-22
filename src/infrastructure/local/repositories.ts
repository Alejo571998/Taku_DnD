import { liveQuery } from 'dexie';
import type { CharacterState } from '@domain/character/state';
import type { AnyDefinition, ContentPack } from '@domain/content/schemas';
import type { Ruleset } from '@domain/rules/ruleset';
import type { CharacterId, ClientOpId, WorkspaceId } from '@domain/shared/ids';
import type { CommandEnvelope, HistoryEntry } from '@application/commands/types';
import type {
  CharacterRepository,
  ContentRepository,
  HistoryRepository,
  OutboxRepository,
} from '@application/ports/repositories';
import type {
  ConflictRepository,
  ConflictResolution,
  SyncConflict,
} from '@application/sync/conflicts';
import type { HomebrewRepository } from '@application/homebrew/service';
import type {
  DiagnosticEvent,
  DiagnosticsSink,
} from '@application/observability/diagnostics';
import { getDb, type CompanionDatabase, type OutboxEntry } from './db';

/** Implementaciones Dexie de los puertos. Nada de esto sube a application/. */

export class DexieCharacterRepository implements CharacterRepository {
  constructor(private readonly db: CompanionDatabase = getDb()) {}

  async get(id: CharacterId): Promise<CharacterState | undefined> {
    const row = await this.db.characters.get(id as string);
    return row && !row.deletedAt ? row : undefined;
  }

  async list(workspaceId: WorkspaceId): Promise<CharacterState[]> {
    const rows = await this.db.characters.where('workspaceId').equals(workspaceId as string).toArray();
    return rows
      .filter((r) => !r.deletedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async save(character: CharacterState): Promise<void> {
    await this.db.characters.put(character as CharacterState & { syncedVersion?: number });
  }

  /**
   * Borrado logico: un tombstone. El borrado fisico impediria propagar la
   * baja a los demas dispositivos.
   */
  async delete(id: CharacterId): Promise<void> {
    await this.db.characters.update(id as string, { deletedAt: new Date().toISOString() });
  }

  observe(id: CharacterId, onChange: (c: CharacterState | undefined) => void): () => void {
    const sub = liveQuery(() => this.db.characters.get(id as string)).subscribe({
      next: (row) => onChange(row && !row.deletedAt ? row : undefined),
      error: () => onChange(undefined),
    });
    return () => sub.unsubscribe();
  }
}

export class DexieContentRepository implements ContentRepository {
  constructor(private readonly db: CompanionDatabase = getDb()) {}

  async getDefinition(id: string): Promise<AnyDefinition | undefined> {
    return this.db.definitions.get(id);
  }

  async listByType(type: string, ruleset: Ruleset): Promise<AnyDefinition[]> {
    return this.db.definitions
      .where('type')
      .equals(type)
      .filter((d) => d.rulesets.includes(ruleset))
      .toArray();
  }

  async listPacks(): Promise<ContentPack[]> {
    return this.db.packs.toArray();
  }

  async loadAll(ruleset: Ruleset): Promise<AnyDefinition[]> {
    return this.db.definitions.where('rulesets').equals(ruleset).toArray();
  }

  async isSeeded(): Promise<boolean> {
    return (await this.db.packs.count()) > 0;
  }

  /**
   * Busqueda global (MASTER SPEC §7: "buscar antes que navegar").
   *
   * Prefijo por indice cuando se puede, y filtro en memoria para el resto.
   * Con ~3000 definiciones esto es instantaneo; si creciera un orden de
   * magnitud, tocaria un indice invertido — pero no antes (MASTER PROMPT §61).
   */
  async search(
    query: string,
    options: { ruleset?: Ruleset; types?: string[]; limit?: number } = {},
  ): Promise<AnyDefinition[]> {
    const q = query.trim().toLowerCase();
    const limit = options.limit ?? 50;
    if (q.length === 0) return [];

    const collection = this.db.definitions.filter((d) => {
      if (options.ruleset && !d.rulesets.includes(options.ruleset)) return false;
      if (options.types && options.types.length > 0 && !options.types.includes(d.type)) return false;
      return d.name.toLowerCase().includes(q);
    });

    const results = await collection.limit(limit * 3).toArray();

    // Los que empiezan por el termino van primero: es lo que espera quien busca.
    return results
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.name.localeCompare(b.name);
      })
      .slice(0, limit);
  }
}

const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export class DexieOutboxRepository implements OutboxRepository {
  constructor(private readonly db: CompanionDatabase = getDb()) {}

  async enqueue(envelope: CommandEnvelope): Promise<void> {
    const entry: OutboxEntry = { ...envelope, attempts: 0, status: 'pending' };
    // `add` y no `put`: si el clientOpId ya existe, no se vuelve a encolar.
    // La idempotencia empieza aqui, no en el servidor.
    await this.db.outbox.add(entry).catch(() => undefined);
  }

  async pending(limit = 50): Promise<CommandEnvelope[]> {
    const now = Date.now();
    const rows = await this.db.outbox
      .where('status')
      .anyOf('pending', 'failed')
      .filter((e) => !e.nextAttemptAt || e.nextAttemptAt <= now)
      .limit(limit)
      .toArray();
    // Orden de emision: los comandos deben aplicarse en el orden en que ocurrieron.
    return rows.sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
  }

  async markSent(clientOpId: ClientOpId): Promise<void> {
    await this.db.outbox.delete(clientOpId as string);
  }

  /** Backoff exponencial con techo: reintentar cada 2s para siempre es hostil. */
  async markFailed(clientOpId: ClientOpId, error: string): Promise<void> {
    const entry = await this.db.outbox.get(clientOpId as string);
    if (!entry) return;
    const attempts = entry.attempts + 1;
    const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempts - 1));
    await this.db.outbox.update(clientOpId as string, {
      attempts,
      lastError: error,
      status: 'failed',
      nextAttemptAt: Date.now() + delay,
    });
  }

  async count(): Promise<number> {
    return this.db.outbox.count();
  }
}

export class DexieHistoryRepository implements HistoryRepository {
  private static readonly MAX_PER_CHARACTER = 200;

  constructor(private readonly db: CompanionDatabase = getDb()) {}

  async append(entry: HistoryEntry): Promise<void> {
    await this.db.history.put(entry);
    // El historial es para la sesion, no un archivo permanente: se poda.
    const count = await this.db.history.where('characterId').equals(entry.characterId as string).count();
    if (count > DexieHistoryRepository.MAX_PER_CHARACTER) {
      const oldest = await this.db.history
        .where('characterId')
        .equals(entry.characterId as string)
        .sortBy('at');
      const excess = oldest.slice(0, count - DexieHistoryRepository.MAX_PER_CHARACTER);
      await this.db.history.bulkDelete(excess.map((e) => e.id));
    }
  }

  async recent(characterId: CharacterId, limit = 30): Promise<HistoryEntry[]> {
    const rows = await this.db.history.where('characterId').equals(characterId as string).toArray();
    return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }

  async markUndone(id: string): Promise<void> {
    await this.db.history.update(id, { undone: true });
  }
}

/**
 * Conflictos de sincronizacion.
 *
 * Viven en la base LOCAL, no en la remota: el usuario tiene que poder
 * resolverlos aunque en ese momento se quede sin conexion.
 */
export class DexieConflictRepository implements ConflictRepository {
  constructor(private readonly db: CompanionDatabase = getDb()) {}

  async record(conflict: SyncConflict): Promise<void> {
    await this.db.conflicts.put(conflict);
  }

  async pending(): Promise<SyncConflict[]> {
    const rows = await this.db.conflicts.where('status').equals('pending').toArray();
    return rows.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  }

  async get(characterId: string): Promise<SyncConflict | undefined> {
    return this.db.conflicts.get(characterId);
  }

  async resolve(characterId: string, as: ConflictResolution): Promise<void> {
    await this.db.conflicts.update(characterId, { status: 'resolved', resolvedAs: as });
  }

  async count(): Promise<number> {
    return this.db.conflicts.where('status').equals('pending').count();
  }
}

/**
 * Contenido propio, en la MISMA tabla que el SRD pero con otro `packId`.
 *
 * Eso es lo que hace que aparezca solo en la biblioteca, en el buscador y en
 * el motor: no hay una segunda ruta de lectura que pueda desincronizarse.
 */
export class DexieHomebrewRepository implements HomebrewRepository {
  constructor(private readonly db: CompanionDatabase = getDb()) {}

  async list(namespace: string): Promise<AnyDefinition[]> {
    const rows = await this.db.definitions.where('packId').equals(namespace).toArray();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  async get(id: string): Promise<AnyDefinition | undefined> {
    return this.db.definitions.get(id);
  }

  async save(namespace: string, definition: AnyDefinition): Promise<void> {
    await this.db.definitions.put({ ...definition, packId: namespace, description: definition.description ?? [] });
  }

  async saveMany(namespace: string, definitions: readonly AnyDefinition[]): Promise<void> {
    if (definitions.length === 0) return;
    await this.db.definitions.bulkPut(
      definitions.map((d) => ({ ...d, packId: namespace, description: d.description ?? [] })),
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.definitions.delete(id);
  }

  async existingIds(namespace: string): Promise<Set<string>> {
    const rows = await this.db.definitions.where('packId').equals(namespace).primaryKeys();
    return new Set(rows as string[]);
  }

  async upsertPack(pack: ContentPack): Promise<void> {
    await this.db.packs.put(pack);
  }
}

/**
 * Diagnostico local con poda.
 *
 * Un registro que crece para siempre acaba comiendose la cuota de IndexedDB
 * del usuario, y entonces el que falla es el sistema que iba a avisar de los
 * fallos. Se guardan los ultimos 200 eventos y nada mas.
 */
export class DexieDiagnosticsSink implements DiagnosticsSink {
  private static readonly MAX_EVENTS = 200;

  constructor(private readonly db: CompanionDatabase = getDb()) {}

  async record(event: DiagnosticEvent): Promise<void> {
    await this.db.diagnostics.put(event);

    const total = await this.db.diagnostics.count();
    if (total <= DexieDiagnosticsSink.MAX_EVENTS) return;

    const oldest = await this.db.diagnostics
      .orderBy('at')
      .limit(total - DexieDiagnosticsSink.MAX_EVENTS)
      .primaryKeys();
    await this.db.diagnostics.bulkDelete(oldest as string[]);
  }

  async recent(limit = 50): Promise<DiagnosticEvent[]> {
    const rows = await this.db.diagnostics.orderBy('at').reverse().limit(limit).toArray();
    return rows;
  }

  async clear(): Promise<void> {
    await this.db.diagnostics.clear();
  }

  async count(): Promise<number> {
    return this.db.diagnostics.count();
  }
}
