'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { resolveCharacter } from '@domain/character/engine';
import type { CharacterSheet } from '@domain/character/sheet';
import type { CharacterState } from '@domain/character/state';
import { ContentIndex } from '@domain/content';
import {
  applyTranslation,
  matchTranslatedNames,
  type TranslationOverlay,
} from '@domain/content/translation';
import { RulesEngine } from '@domain/rules/engine';
import { SRD_RULES } from '@domain/rules/srd-rules';
import type { Ruleset } from '@domain/rules/ruleset';
import type { CharacterId, WorkspaceId } from '@domain/shared/ids';
import { isErr } from '@domain/shared/result';
import type { Command } from '@application/commands/types';
import { CharacterService } from '@application/services/character-service';
import { getDb, requestPersistentStorage } from '@infrastructure/local/db';
import {
  DexieCharacterRepository,
  DexieHistoryRepository,
  DexieOutboxRepository,
} from '@infrastructure/local/repositories';
import {
  getContentIndex,
  getContentVersion,
  getTranslationOverlay,
  invalidateContentIndex,
  loadTranslationOverlay,
  seedBuiltInContent,
  subscribeToContent,
  type SeedProgress,
} from '@infrastructure/content/loader';
import { useToast } from '@ui/components/AppProviders';
import { useSession } from '@ui/components/SessionProvider';
import { useT } from '@ui/components/LocaleProvider';
import type { Translator } from '@/i18n/runtime';
import { requestSyncAfterMutation } from './useSync';
import { recordDiagnostic } from './useDiagnostics';
import { diagnosticEvent, fromError } from '@application/observability/diagnostics';

/**
 * Puente entre la interfaz y las capas de abajo.
 *
 * La lectura va por `useLiveQuery` contra IndexedDB: cuando un comando cambia
 * un personaje, cada pantalla abierta se repinta sola. No hay que invalidar
 * cachés a mano porque la base local ES la caché.
 */

/**
 * Espacio de trabajo activo: el local mientras no hay cuenta, el de la cuenta
 * cuando la hay. La adopción del trabajo local la hace `SessionProvider`.
 */
export function useWorkspaceId(): WorkspaceId {
  return useSession().workspaceId;
}

const service = () =>
  new CharacterService(
    new DexieCharacterRepository(),
    new DexieOutboxRepository(),
    new DexieHistoryRepository(),
  );

// ── Contenido ────────────────────────────────────────────────────────────────

export type ContentStatus =
  | { phase: 'idle' }
  | { phase: 'seeding'; progress: SeedProgress | null }
  | { phase: 'ready'; definitions: number }
  | { phase: 'error'; message: string };

/**
 * Carga los packs incorporados en el primer arranque y deja el índice listo.
 * Es idempotente: en los arranques siguientes no descarga nada.
 */
export function useContentBootstrap(): ContentStatus {
  const [status, setStatus] = useState<ContentStatus>({ phase: 'idle' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // La traduccion se carga ANTES de construir cualquier indice: si
        // llegara despues, la biblioteca quedaria en ingles hasta recargar.
        await loadTranslationOverlay('es-419');

        const db = getDb();
        const already = await db.packs.count();
        if (already === 0) setStatus({ phase: 'seeding', progress: null });

        const result = await seedBuiltInContent((p) => {
          if (!cancelled) setStatus({ phase: 'seeding', progress: p });
        });

        // Safari borra el almacenamiento de sitios no instalados tras ~7 días
        // sin uso. Perder los personajes del usuario no es aceptable.
        await requestPersistentStorage();

        // Avisa a las pantallas abiertas de que ya hay contenido: sin esto,
        // las que pidieron el índice durante la carga se quedan sin nada.
        invalidateContentIndex();

        if (!cancelled) setStatus({ phase: 'ready', definitions: result.definitions });
      } catch (error) {
        void recordDiagnostic(fromError(error, 'content', 'content.seedFailed'));
        if (!cancelled) {
          setStatus({
            phase: 'error',
            message: error instanceof Error ? error.message : 'Error desconocido',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

/**
 * Índice de contenido en memoria.
 *
 * Se reconstruye cuando cambia la versión del contenido —al terminar el
 * volcado inicial, al importar un pack o al editar Homebrew—, así que una
 * pantalla abierta durante la carga no se queda con un índice vacío.
 */
export function useContentIndex(ruleset: Ruleset): ContentIndex | null {
  const version = useSyncExternalStore(subscribeToContent, getContentVersion, () => 0);
  const [index, setIndex] = useState<ContentIndex | null>(null);

  useEffect(() => {
    let cancelled = false;
    getContentIndex(ruleset)
      .then((i) => {
        if (!cancelled) setIndex(i);
      })
      .catch(() => {
        if (!cancelled) setIndex(new ContentIndex());
      });
    return () => {
      cancelled = true;
    };
  }, [ruleset, version]);

  return index;
}

/**
 * Superposición de traducción activa.
 *
 * Vive fuera de React, igual que el índice de contenido, y se lee con la misma
 * señal: así la cobertura siempre se cuenta contra el diccionario que de verdad
 * se aplicó. `getTranslationOverlay` devuelve el mismo objeto hasta que cambia,
 * que es justo lo que `useSyncExternalStore` necesita para no repintar de más.
 */
export function useTranslationOverlay(): TranslationOverlay {
  return useSyncExternalStore(subscribeToContent, getTranslationOverlay, getTranslationOverlay);
}

export function useRulesEngine(ruleset: Ruleset): RulesEngine {
  return useMemo(() => new RulesEngine(SRD_RULES, ruleset), [ruleset]);
}

/**
 * Nombre de una definición para mostrarlo, traducido.
 *
 * El inventario y el equipo lo sacaban del slug: `clothes-common` daba
 * «Clothes common». No es que faltara la traducción —el diccionario dice «Ropa
 * común»—, es que nadie iba a buscarla: se derivaba del id y quedaba en inglés
 * en medio de una ficha en castellano.
 *
 * El slug sigue siendo el último recurso, para el contenido propio de quien
 * juega y para cuando el índice todavía no cargó.
 */
export function useDefinitionName(ruleset: Ruleset): (definitionId: string) => string {
  const index = useContentIndex(ruleset);
  const overlay = useTranslationOverlay();

  return useMemo(() => {
    const delSlug = (id: string) =>
      (id.split(':').pop() ?? '').replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

    return (definitionId: string) => {
      const definition = index?.get(definitionId);
      if (!definition) return delSlug(definitionId);
      return applyTranslation(definition, overlay).name;
    };
  }, [index, overlay]);
}

/**
 * BÚSQUEDA GLOBAL DE LA BIBLIOTECA (MASTER SPEC §7)
 *
 * Las definiciones se guardan en INGLÉS y la traducción es una superposición.
 * Por eso hay que buscar por los dos nombres: quien escribe "Cegado" y quien
 * escribe "Blinded" esperan encontrar lo mismo.
 */
/**
 * Espera a que dejes de escribir antes de consultar.
 *
 * La consulta recorre las 3.039 definiciones entera: no hay índice que sirva
 * para "contiene". Medido contra el build de producción con la CPU a un cuarto
 * —un gama media de hace tres años, que es EL dispositivo según MASTER SPEC
 * §3.6— un recorrido cuesta **246 ms**.
 *
 * Eso, por sí solo, está bien. El problema es que sin esperar, escribir "fire"
 * son cuatro recorridos encadenados: cerca de un segundo de hilo principal
 * ocupado, y tres de esos cuatro resultados no los llega a ver nadie.
 *
 * 140 ms está por debajo del umbral en el que una respuesta deja de sentirse
 * inmediata, y por encima del intervalo entre teclas de alguien escribiendo
 * rápido.
 */
function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return settled;
}

export function useContentSearch(rawQuery: string, ruleset: Ruleset, types?: string[]) {
  const overlay = useTranslationOverlay();
  // Los filtros y la edición se aplican al instante: son un clic, no un tecleo.
  const query = useDebounced(rawQuery, 140);

  return useLiveQuery(
    async () => {
      const q = query.trim().toLowerCase();
      const db = getDb();
      const matchesType = (type: string) => !types || types.length === 0 || types.includes(type);

      if (q.length === 0) {
        const rows = await db.definitions
          .where('rulesets')
          .equals(ruleset)
          .filter((d) => matchesType(d.type))
          .limit(60)
          .toArray();
        return rows
          .map((d) => applyTranslation(d, overlay))
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      // Lo que coincide por su nombre en español no coincidiría por el inglés
      // guardado, así que se pide explícitamente por id.
      const translated = matchTranslatedNames(overlay, q);

      const rows = await db.definitions
        .filter((d) => {
          if (!d.rulesets.includes(ruleset)) return false;
          if (!matchesType(d.type)) return false;
          if (d.name.toLowerCase().includes(q)) return true;
          const key = d.id.split(':').slice(1).join(':');
          return translated.ids.has(d.id) || translated.keys.has(key);
        })
        .limit(200)
        .toArray();

      // Lo que empieza por el término va primero: es lo que espera quien busca.
      return rows
        .map((d) => applyTranslation(d, overlay))
        .sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
          const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 60);
    },
    [query, ruleset, types?.join(','), overlay],
    undefined,
  );
}

// ── Personajes ───────────────────────────────────────────────────────────────

export function useCharacters(): CharacterState[] | undefined {
  const workspaceId = useWorkspaceId();
  return useLiveQuery(async () => {
    const rows = await getDb().characters.where('workspaceId').equals(workspaceId as string).toArray();
    return rows.filter((r) => !r.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [workspaceId]);
}

export function useCharacter(id: CharacterId | undefined): CharacterState | undefined | null {
  return useLiveQuery(async () => {
    if (!id) return null;
    const row = await getDb().characters.get(id as string);
    return row && !row.deletedAt ? row : null;
  }, [id]);
}

/** Ficha derivada. Se recalcula sola cuando cambia el estado o el contenido. */
export function useCharacterSheet(state: CharacterState | undefined | null): CharacterSheet | null {
  const content = useContentIndex(state?.ruleset ?? '2014');
  const engine = useRulesEngine(state?.ruleset ?? '2014');

  return useMemo(() => {
    if (!state || !content || content.size === 0) return null;
    return resolveCharacter(state, content, engine);
  }, [state, content, engine]);
}

export function useHistory(characterId: CharacterId | undefined, limit = 30) {
  return useLiveQuery(async () => {
    if (!characterId) return [];
    const rows = await getDb().history.where('characterId').equals(characterId as string).toArray();
    return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }, [characterId, limit]);
}

export function usePendingSyncCount(): number {
  return useLiveQuery(() => getDb().outbox.count(), [], 0) ?? 0;
}

// ── Despacho de comandos ─────────────────────────────────────────────────────

export type DispatchFn = (command: Command, options?: { silent?: boolean }) => Promise<boolean>;

/**
 * Ejecuta comandos sobre un personaje y avisa del resultado.
 *
 * Los errores de dominio se traducen a lenguaje humano: nunca se muestra un
 * código crudo (MASTER SPEC §51, MASTER PROMPT §81).
 */
export function useDispatch(state: CharacterState | undefined | null): DispatchFn {
  const content = useContentIndex(state?.ruleset ?? '2014');
  const engine = useRulesEngine(state?.ruleset ?? '2014');
  const { notify } = useToast();
  const t = useT();

  return useCallback(
    async (command, options) => {
      if (!state || !content) return false;

      const outcome = await service().dispatch(state.id, command, content, engine);

      if (isErr(outcome)) {
        // El codigo de dominio y el tipo de comando bastan para reproducirlo.
        // Ni el nombre del personaje ni sus datos entran en el diagnostico.
        void recordDiagnostic(
          diagnosticEvent({
            level: 'warning',
            area: 'command',
            code: `command.rejected.${outcome.error.code}`,
            ...(outcome.error.detail ? { detail: outcome.error.detail } : {}),
            context: { command: command.type },
          }),
        );

        notify({
          message: t(`error.${outcome.error.code}`, undefined, t('error.validation.failed')),
          detail: describeErrorDetail(t, outcome.error.code, outcome.error.params),
          tone: 'danger',
        });
        return false;
      }

      // El cambio ya esta guardado en local; subirlo es asincrono y con
      // retardo para agrupar rafagas. Si no hay sesion, no hace nada.
      requestSyncAfterMutation();

      if (!options?.silent) {
        const { result } = outcome.value;
        const entryId = await service()
          .recentHistory(state.id, 1)
          .then((rows) => rows[0]?.id);

        notify({
          message: t(result.summaryKey, result.summaryParams, t('common.done')),
          tone: toneFor(command.type),
          ...(result.undo && entryId
            ? {
                action: {
                  label: 'Deshacer',
                  onClick: () => {
                    void service().undo(state.id, entryId, content, engine);
                  },
                },
              }
            : {}),
        });
      }

      return true;
    },
    [state, content, engine, notify, t],
  );
}

function toneFor(type: Command['type']): 'neutral' | 'success' | 'danger' | 'arcane' {
  if (type === 'DamageCharacter') return 'danger';
  if (type === 'HealCharacter' || type === 'AddTemporaryHitPoints') return 'success';
  if (type === 'CastSpell' || type === 'PrepareSpell') return 'arcane';
  if (type === 'ApplyLevelUp' || type === 'AwardExperience') return 'success';
  return 'neutral';
}

/**
 * Detalle de un error, solo cuando el catálogo lo tiene.
 *
 * El mensaje corto dice QUÉ pasó; el detalle dice qué hacer. No todos los
 * errores tienen algo útil que añadir, y rellenar con una frase genérica sería
 * ruido (MASTER SPEC §51).
 */
function describeErrorDetail(
  t: Translator,
  code: string,
  params?: Record<string, string | number>,
): string | undefined {
  const key = `errorDetail.${code}`;
  const detail = t(key, params, '');
  return detail === '' || detail === key ? undefined : detail;
}

export { service as characterService };
