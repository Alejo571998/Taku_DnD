import {
  buildHomebrewPack,
  homebrewId,
  homebrewNamespace,
  homebrewPackMeta,
  parseHomebrewPack,
  type HomebrewPack,
  type ImportPreview,
  type ParseResult,
} from '@domain/content/homebrew';
import type { AnyDefinition, ContentPack } from '@domain/content/schemas';
import type { Ruleset } from '@domain/rules/ruleset';
import { errCode, ok, type Result } from '@domain/shared/result';
import type { WorkspaceId } from '@domain/shared/ids';

/**
 * CONTENIDO PROPIO
 *
 * El Homebrew vive en la MISMA tabla que el SRD, con otro `packId`. Esa
 * decisión es la que hace que aparezca solo en la biblioteca, en el buscador y
 * en el motor de reglas, sin una segunda ruta de lectura que se desincronice.
 *
 * Lo que lo mantiene separado no es dónde se guarda: es el espacio de nombres
 * del id, que nunca puede empezar por `srd-`.
 */

export interface HomebrewRepository {
  list(namespace: string): Promise<AnyDefinition[]>;
  get(id: string): Promise<AnyDefinition | undefined>;
  save(namespace: string, definition: AnyDefinition): Promise<void>;
  saveMany(namespace: string, definitions: readonly AnyDefinition[]): Promise<void>;
  remove(id: string): Promise<void>;
  existingIds(namespace: string): Promise<Set<string>>;
  upsertPack(pack: ContentPack): Promise<void>;
}

export type ImportMode = 'skip' | 'replace';

export type ImportResult = {
  readonly imported: number;
  readonly skipped: number;
  readonly replaced: number;
};

export class HomebrewService {
  constructor(private readonly repository: HomebrewRepository) {}

  namespaceFor(workspaceId: WorkspaceId): string {
    return homebrewNamespace(workspaceId as string);
  }

  async list(workspaceId: WorkspaceId): Promise<AnyDefinition[]> {
    return this.repository.list(this.namespaceFor(workspaceId));
  }

  /**
   * Crea o actualiza una definición propia.
   *
   * El id lo decide el sistema a partir del nombre: dejar que el usuario
   * escriba ids es abrir la puerta a que uno se llame `srd-2014:spell:fireball`.
   */
  async upsert(
    workspaceId: WorkspaceId,
    draft: AnyDefinition,
    options: { keepId?: boolean } = {},
  ): Promise<Result<AnyDefinition>> {
    const namespace = this.namespaceFor(workspaceId);
    const id = options.keepId
      ? draft.id
      : homebrewId(workspaceId as string, draft.type, draft.name);

    if (!id.startsWith(`${namespace}:`)) {
      return errCode('validation.failed', {}, 'el id no pertenece a este espacio de trabajo');
    }

    const definition = {
      ...draft,
      id,
      sourceId: `homebrew:${workspaceId}`,
      version: draft.version || '1.0.0',
    } as AnyDefinition;

    await this.repository.upsertPack(
      homebrewPackMeta(workspaceId as string, definition.rulesets[0] ?? '2014', 0),
    );
    await this.repository.save(namespace, definition);
    return ok(definition);
  }

  async remove(workspaceId: WorkspaceId, definitionId: string): Promise<Result<void>> {
    const namespace = this.namespaceFor(workspaceId);
    if (!definitionId.startsWith(`${namespace}:`)) {
      // La única defensa que importa: nadie borra el SRD desde acá, ni por
      // error ni a propósito.
      return errCode('validation.failed', {}, 'solo se puede borrar contenido propio');
    }
    await this.repository.remove(definitionId);
    return ok(undefined);
  }

  // ── Importación ────────────────────────────────────────────────────────────

  /** Paso de vista previa: analiza sin escribir nada. */
  async preview(workspaceId: WorkspaceId, raw: unknown): Promise<ParseResult> {
    const namespace = this.namespaceFor(workspaceId);
    const existing = await this.repository.list(namespace);
    const ids = new Set(existing.map((d) => d.id));
    const names = new Map(existing.map((d) => [d.id, d.name] as const));
    return parseHomebrewPack(raw, workspaceId as string, ids, names);
  }

  /** Paso final: solo se llama cuando el usuario ya vio qué iba a pasar. */
  async commit(
    workspaceId: WorkspaceId,
    preview: ImportPreview,
    mode: ImportMode,
  ): Promise<ImportResult> {
    const namespace = this.namespaceFor(workspaceId);
    const conflicting = new Set(preview.conflicts.map((c) => c.definitionId));

    const toWrite =
      mode === 'replace'
        ? preview.definitions
        : preview.definitions.filter((d) => !conflicting.has(d.id));

    await this.repository.upsertPack(
      homebrewPackMeta(workspaceId as string, preview.pack.ruleset, toWrite.length),
    );
    await this.repository.saveMany(namespace, toWrite);

    return {
      imported: toWrite.length,
      skipped: mode === 'skip' ? conflicting.size : 0,
      replaced: mode === 'replace' ? conflicting.size : 0,
    };
  }

  // ── Exportación ────────────────────────────────────────────────────────────

  /**
   * Exporta el contenido propio como paquete versionado.
   * Es también la garantía de que el usuario puede irse con lo suyo: un
   * producto que guarda tu trabajo y no te lo devuelve es una jaula.
   */
  async export(
    workspaceId: WorkspaceId,
    input: { name: string; author?: string; version?: string; ruleset: Ruleset },
  ): Promise<Result<HomebrewPack>> {
    const definitions = (await this.list(workspaceId)).filter((d) =>
      d.rulesets.includes(input.ruleset),
    );
    if (definitions.length === 0) {
      return errCode('validation.failed', {}, 'no hay contenido propio que exportar');
    }

    return ok(
      buildHomebrewPack({
        id: this.namespaceFor(workspaceId),
        name: input.name,
        ...(input.author ? { author: input.author } : {}),
        version: input.version ?? '1.0.0',
        ruleset: input.ruleset,
        definitions,
      }),
    );
  }
}
