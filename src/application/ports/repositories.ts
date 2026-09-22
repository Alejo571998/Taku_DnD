import type { CharacterState } from '@domain/character/state';
import type { AnyDefinition, ContentPack } from '@domain/content/schemas';
import type { CharacterId, ClientOpId, WorkspaceId } from '@domain/shared/ids';
import type { Ruleset } from '@domain/rules/ruleset';
import type { CommandEnvelope, HistoryEntry } from '../commands/types';

/**
 * PUERTOS
 *
 * La capa de aplicacion depende de estas INTERFACES, nunca de Dexie ni de
 * Supabase. Es lo que permite probar los casos de uso sin base de datos y
 * cambiar la implementacion sin tocar el dominio.
 */

export interface CharacterRepository {
  get(id: CharacterId): Promise<CharacterState | undefined>;
  list(workspaceId: WorkspaceId): Promise<CharacterState[]>;
  save(character: CharacterState): Promise<void>;
  delete(id: CharacterId): Promise<void>;
  /** Suscripcion reactiva: la interfaz se repinta sola al cambiar los datos. */
  observe?(id: CharacterId, onChange: (c: CharacterState | undefined) => void): () => void;
}

export interface ContentRepository {
  getDefinition(id: string): Promise<AnyDefinition | undefined>;
  listByType(type: string, ruleset: Ruleset): Promise<AnyDefinition[]>;
  listPacks(): Promise<ContentPack[]>;
  search(query: string, options?: { ruleset?: Ruleset; types?: string[]; limit?: number }): Promise<AnyDefinition[]>;
  loadAll(ruleset: Ruleset): Promise<AnyDefinition[]>;
  isSeeded(): Promise<boolean>;
}

export interface OutboxRepository {
  enqueue(envelope: CommandEnvelope): Promise<void>;
  pending(limit?: number): Promise<CommandEnvelope[]>;
  markSent(clientOpId: ClientOpId): Promise<void>;
  markFailed(clientOpId: ClientOpId, error: string): Promise<void>;
  count(): Promise<number>;
}

export interface HistoryRepository {
  append(entry: HistoryEntry): Promise<void>;
  recent(characterId: CharacterId, limit?: number): Promise<HistoryEntry[]>;
  markUndone(id: string): Promise<void>;
}
