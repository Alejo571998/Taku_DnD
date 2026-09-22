import Dexie, { type Table } from 'dexie';
import type { CharacterState } from '@domain/character/state';
import type { AnyDefinition, ContentPack } from '@domain/content/schemas';
import type { CommandEnvelope, HistoryEntry } from '@application/commands/types';
import type { RuleDefinition } from '@domain/rules/vocabulary';
import type { SyncConflict } from '@application/sync/conflicts';
import type { CampaignState } from '@domain/campaign/campaign';
import type { DiagnosticEvent } from '@application/observability/diagnostics';

/**
 * BASE DE DATOS LOCAL
 *
 * IndexedDB via Dexie. Es la FUENTE DE LECTURA PRIMARIA de la aplicacion:
 * la interfaz lee de aqui, no de la red. Por eso todo funciona sin conexion
 * desde el primer momento, no como modo degradado.
 *
 * La cola `outbox` guarda los comandos pendientes de sincronizar.
 */

export type StoredCharacter = CharacterState & {
  /** Marca de sincronizacion: ultima version confirmada por el servidor. */
  syncedVersion?: number;
  deletedAt?: string;
};

export type OutboxEntry = CommandEnvelope & {
  /** Reintentos ya realizados. Sirve para el backoff exponencial. */
  attempts: number;
  lastError?: string;
  nextAttemptAt?: number;
  status: 'pending' | 'sending' | 'failed';
};

export type StoredDefinition = AnyDefinition & { packId: string };

export type SyncCursor = {
  key: 'cursor';
  /** Secuencia del servidor, NO un timestamp. */
  seq: number;
  lastSyncAt?: string;
};

export type DiceRollRecord = {
  id: string;
  characterId?: string;
  expression: string;
  total: number;
  mode: string;
  context?: string;
  detail: string;
  rolledAt: string;
};

export class CompanionDatabase extends Dexie {
  characters!: Table<StoredCharacter, string>;
  definitions!: Table<StoredDefinition, string>;
  packs!: Table<ContentPack, string>;
  homebrewRules!: Table<RuleDefinition, string>;
  outbox!: Table<OutboxEntry, string>;
  history!: Table<HistoryEntry, string>;
  rolls!: Table<DiceRollRecord, string>;
  meta!: Table<SyncCursor, string>;
  conflicts!: Table<SyncConflict, string>;
  campaigns!: Table<CampaignState, string>;
  diagnostics!: Table<DiagnosticEvent, string>;

  constructor(name = 'dnd-companion') {
    super(name);

    this.version(1).stores({
      // `&` unico, `*` multi-entrada. Los indices se eligen por las consultas
      // que hace la interfaz, no por costumbre.
      characters: '&id, workspaceId, ruleset, name, updatedAt, deletedAt',
      definitions: '&id, packId, type, name, *rulesets',
      packs: '&id, ruleset, builtIn',
      homebrewRules: '&id, *rulesets',
      outbox: '&clientOpId, characterId, status, nextAttemptAt, issuedAt',
      history: '&id, characterId, at',
      rolls: '&id, characterId, rolledAt',
      meta: '&key',
    });

    /**
     * v2 · Conflictos de sincronizacion.
     * Dexie migra solo: la v1 existente no pierde nada al abrirse como v2.
     */
    this.version(2).stores({
      conflicts: '&id, characterId, status, detectedAt',
    });

    /**
     * v3 · Campanas (MASTER SPEC §30).
     * Locales desde el primer dia: el esquema remoto ya las contempla, asi que
     * compartirlas mas adelante es enlazar identidades, no migrar datos.
     */
    this.version(3).stores({
      campaigns: '&id, workspaceId, ruleset, updatedAt, archivedAt',
    });

    /**
     * v4 · Diagnostico local (MASTER PROMPT §80).
     * Se queda EN EL DISPOSITIVO: no hay telemetria remota, y el usuario
     * decide si exporta el informe o no.
     */
    this.version(4).stores({
      diagnostics: '&id, at, level, area',
    });
  }
}

let instance: CompanionDatabase | null = null;

/**
 * Instancia unica. Se crea perezosamente porque en el servidor (SSR) no hay
 * IndexedDB y abrir la base alli rompe el renderizado.
 */
export function getDb(): CompanionDatabase {
  if (!instance) instance = new CompanionDatabase();
  return instance;
}

/** Solo para tests: base efimera con nombre propio. */
export function createTestDb(name: string): CompanionDatabase {
  return new CompanionDatabase(name);
}

export function resetDbInstance(): void {
  instance = null;
}

/**
 * Almacenamiento persistente.
 *
 * Safari borra el almacenamiento de sitios NO instalados tras ~7 dias sin
 * uso. Una aplicacion offline-first que pierde los personajes del usuario
 * esta rota, asi que lo pedimos explicitamente.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const e = await navigator.storage.estimate();
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch {
    return null;
  }
}
