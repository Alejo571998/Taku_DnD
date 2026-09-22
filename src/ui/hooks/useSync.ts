'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterState } from '@domain/character/state';
import type { ContentIndex } from '@domain/content';
import type { RulesEngine } from '@domain/rules/engine';
import type { CharacterId, WorkspaceId } from '@domain/shared/ids';
import { isErr } from '@domain/shared/result';
import { CharacterService } from '@application/services/character-service';
import { SyncEngine } from '@application/sync/engine';
import { SyncScheduler, type SchedulerState } from '@application/sync/scheduler';
import type { ConflictResolution, SyncConflict } from '@application/sync/conflicts';
import { syncCursorStore, syncTransport } from '@infrastructure/composition';
import { getDb } from '@infrastructure/local/db';
import {
  DexieCharacterRepository,
  DexieConflictRepository,
  DexieHistoryRepository,
  DexieOutboxRepository,
} from '@infrastructure/local/repositories';
import { fromError } from '@application/observability/diagnostics';
import { useSession } from '@ui/components/SessionProvider';
import { recordDiagnostic } from './useDiagnostics';

/**
 * SINCRONIZACIÓN EN LA INTERFAZ
 *
 * El planificador decide cuándo sincronizar; este archivo solo le cuenta qué
 * está pasando en el navegador: volvió la red, volvió el foco, hubo un cambio.
 *
 * Nada de esto bloquea la interfaz. Si la nube no está configurada o no hay
 * sesión, la aplicación funciona exactamente igual — trabajar sin conexión es
 * el camino normal, no un modo degradado (MASTER SPEC §56).
 */

let singleton: { engine: SyncEngine; scheduler: SyncScheduler; workspaceId: WorkspaceId | null } | null =
  null;

function controller(): { engine: SyncEngine; scheduler: SyncScheduler } {
  if (!singleton) {
    const characters = new DexieCharacterRepository();
    const outbox = new DexieOutboxRepository();
    const conflicts = new DexieConflictRepository();
    const engine = new SyncEngine(syncTransport(), outbox, characters, syncCursorStore(), conflicts);
    const holder = { engine, scheduler: null as unknown as SyncScheduler, workspaceId: null };
    holder.scheduler = new SyncScheduler(engine, () => holder.workspaceId);
    singleton = holder;
  }
  return singleton;
}

/** Pide un ciclo tras una mutación. Lo llama `useDispatch` en cada comando. */
export function requestSyncAfterMutation(): void {
  singleton?.scheduler.request('mutation');
}

/**
 * Arranca el ciclo y lo conecta a los eventos del navegador.
 * Se monta UNA vez, en el armazón de la aplicación.
 */
export function useSyncRunner(): {
  state: SchedulerState;
  syncNow: () => void;
  enabled: boolean;
} {
  const { state: session, workspaceId } = useSession();
  const enabled = session.status === 'authenticated';
  const { scheduler } = useMemo(() => controller(), []);
  const [state, setState] = useState<SchedulerState>(() => scheduler.getState());

  useEffect(() => {
    if (singleton) singleton.workspaceId = enabled ? workspaceId : null;
  }, [enabled, workspaceId]);

  useEffect(
    () =>
      scheduler.subscribe((next) => {
        setState(next);
        // Un fallo de sincronizacion que solo se ve un segundo en un aviso es
        // un fallo que nadie va a poder arreglar despues.
        if (next.phase === 'error') {
          void recordDiagnostic(
            fromError(next.message, 'sync', 'sync.cycleFailed', { retryAt: next.retryAt ?? 0 }),
          );
        }
      }),
    [scheduler],
  );

  useEffect(() => {
    if (!enabled) {
      scheduler.stop();
      return;
    }

    scheduler.start();

    const onOnline = () => scheduler.request('online');
    const onFocus = () => {
      // Otro dispositivo pudo cambiar algo mientras esta pestaña estaba oculta.
      if (document.visibilityState === 'visible') scheduler.request('focus');
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onFocus);
      scheduler.stop();
    };
  }, [scheduler, enabled]);

  const syncNow = useCallback(() => {
    void scheduler.runNow('manual');
  }, [scheduler]);

  return { state, syncNow, enabled };
}

// ── Conflictos ───────────────────────────────────────────────────────────────

export function usePendingConflicts(): SyncConflict[] {
  return (
    useLiveQuery(async () => {
      const rows = await getDb().conflicts.where('status').equals('pending').toArray();
      return rows.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
    }, []) ?? []
  );
}

/** Trae la version del servidor para mostrarla al lado de la local. */
export function useServerVersion(characterId: string | null): CharacterState | null {
  const { workspaceId } = useSession();
  /**
   * Se guarda junto al id que se pidio. Asi, al cambiar de conflicto, NUNCA se
   * enseña la version de otro personaje mientras llega la nueva — y no hace
   * falta un setState sincrono dentro del efecto para limpiarlo.
   */
  const [entry, setEntry] = useState<{ id: string; state: CharacterState | null } | null>(null);

  useEffect(() => {
    if (!characterId) return;
    let cancelled = false;
    controller()
      .engine.fetchServerVersion(workspaceId, characterId)
      .then((state) => {
        if (!cancelled) setEntry({ id: characterId, state });
      })
      .catch(() => {
        if (!cancelled) setEntry({ id: characterId, state: null });
      });
    return () => {
      cancelled = true;
    };
  }, [characterId, workspaceId]);

  return characterId && entry?.id === characterId ? entry.state : null;
}

export type ConflictResolver = (
  characterId: CharacterId,
  resolution: ConflictResolution,
) => Promise<boolean>;

/**
 * Resuelve un conflicto con la decisión que tomó el usuario.
 * `adoptServerVersion` va contra el servidor, así que "usar la del servidor"
 * es de verdad y no una apuesta sobre lo que traerá el próximo ciclo.
 */
export function useResolveConflict(content: ContentIndex | null, engine: RulesEngine): ConflictResolver {
  const { workspaceId } = useSession();
  const busy = useRef(false);

  return useCallback(
    async (characterId, resolution) => {
      if (!content || busy.current) return false;
      busy.current = true;
      try {
        const { engine: sync } = controller();
        const service = new CharacterService(
          new DexieCharacterRepository(),
          new DexieOutboxRepository(),
          new DexieHistoryRepository(),
          new DexieConflictRepository(),
        );

        const outcome = await service.resolveConflict(characterId, resolution, content, engine, () =>
          sync.adoptServerVersion(workspaceId, characterId as string),
        );
        if (isErr(outcome)) return false;

        singleton?.scheduler.request('manual');
        return true;
      } finally {
        busy.current = false;
      }
    },
    [content, engine, workspaceId],
  );
}
