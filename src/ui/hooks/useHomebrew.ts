'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo } from 'react';
import type { AnyDefinition } from '@domain/content/schemas';
import type { Ruleset } from '@domain/rules/ruleset';
import { isErr } from '@domain/shared/result';
import {
  HomebrewService,
  type ImportMode,
  type ImportResult,
} from '@application/homebrew/service';
import type { ImportPreview, ParseResult } from '@domain/content/homebrew';
import { getDb } from '@infrastructure/local/db';
import { invalidateContentIndex } from '@infrastructure/content/loader';
import { DexieHomebrewRepository } from '@infrastructure/local/repositories';
import { useWorkspaceId } from './useAppData';

/**
 * Contenido propio en la interfaz.
 *
 * Tras cada escritura se invalida el índice: el Homebrew vive en la misma
 * tabla que el SRD, así que sin esa señal la biblioteca seguiría mostrando el
 * estado anterior hasta recargar.
 */
export function useHomebrewService(): HomebrewService {
  return useMemo(() => new HomebrewService(new DexieHomebrewRepository()), []);
}

export function useHomebrewDefinitions(): AnyDefinition[] | undefined {
  const workspaceId = useWorkspaceId();
  const service = useHomebrewService();
  const namespace = service.namespaceFor(workspaceId);

  return useLiveQuery(async () => {
    const rows = await getDb().definitions.where('packId').equals(namespace).toArray();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [namespace]);
}

export type HomebrewActions = {
  save: (definition: AnyDefinition, options?: { keepId?: boolean }) => Promise<boolean>;
  remove: (definitionId: string) => Promise<boolean>;
  preview: (raw: unknown) => Promise<ParseResult>;
  commit: (preview: ImportPreview, mode: ImportMode) => Promise<ImportResult>;
  exportPack: (input: { name: string; author?: string; ruleset: Ruleset }) => Promise<string | null>;
};

export function useHomebrewActions(): HomebrewActions {
  const workspaceId = useWorkspaceId();
  const service = useHomebrewService();

  const save = useCallback<HomebrewActions['save']>(
    async (definition, options) => {
      const outcome = await service.upsert(workspaceId, definition, options ?? {});
      if (isErr(outcome)) return false;
      invalidateContentIndex();
      return true;
    },
    [service, workspaceId],
  );

  const remove = useCallback<HomebrewActions['remove']>(
    async (definitionId) => {
      const outcome = await service.remove(workspaceId, definitionId);
      if (isErr(outcome)) return false;
      invalidateContentIndex();
      return true;
    },
    [service, workspaceId],
  );

  const preview = useCallback<HomebrewActions['preview']>(
    (raw) => service.preview(workspaceId, raw),
    [service, workspaceId],
  );

  const commit = useCallback<HomebrewActions['commit']>(
    async (previewed, mode) => {
      const result = await service.commit(workspaceId, previewed, mode);
      invalidateContentIndex();
      return result;
    },
    [service, workspaceId],
  );

  const exportPack = useCallback<HomebrewActions['exportPack']>(
    async (input) => {
      const outcome = await service.export(workspaceId, input);
      if (isErr(outcome)) return null;
      return JSON.stringify(outcome.value, null, 2);
    },
    [service, workspaceId],
  );

  return { save, remove, preview, commit, exportPack };
}

/**
 * Descarga un archivo generado en el navegador.
 *
 * Es la garantía de que el usuario puede irse con su trabajo: un producto que
 * guarda lo tuyo y no te lo devuelve es una jaula (MASTER SPEC §34).
 */
export function downloadJson(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
