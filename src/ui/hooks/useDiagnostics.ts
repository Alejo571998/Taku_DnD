'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import {
  buildReport,
  summarizeDiagnostics,
  type DiagnosticEvent,
  type DiagnosticsSummary,
} from '@application/observability/diagnostics';
import { getDb, storageEstimate } from '@infrastructure/local/db';
import { DexieDiagnosticsSink } from '@infrastructure/local/repositories';

/**
 * DIAGNÓSTICO LOCAL
 *
 * No hay telemetría: lo que falla se anota en el dispositivo y el usuario
 * decide si lo comparte. Anotar NUNCA puede romper la operación que falló, así
 * que todo lo de acá traga sus propios errores a propósito.
 */

let sink: DexieDiagnosticsSink | null = null;

const getSink = (): DexieDiagnosticsSink => {
  sink ??= new DexieDiagnosticsSink();
  return sink;
};

/** Anota un evento. Si esto falla, no pasa nada más: se descarta. */
export async function recordDiagnostic(event: DiagnosticEvent): Promise<void> {
  try {
    await getSink().record(event);
  } catch {
    // Un sistema de diagnóstico que rompe la aplicación al fallar es peor que
    // no tener diagnóstico.
  }
}

export function useDiagnostics(limit = 50): DiagnosticEvent[] {
  return (
    useLiveQuery(async () => {
      const rows = await getDb().diagnostics.orderBy('at').reverse().limit(limit).toArray();
      return rows;
    }, [limit]) ?? []
  );
}

export function useDiagnosticsSummary(): DiagnosticsSummary {
  const events = useDiagnostics(200);
  return summarizeDiagnostics(events);
}

export type DiagnosticsActions = {
  clear: () => Promise<void>;
  buildReport: () => Promise<string>;
};

export function useDiagnosticsActions(): DiagnosticsActions {
  const clear = useCallback(async () => {
    await getSink().clear();
  }, []);

  const report = useCallback(async () => {
    const events = await getSink().recent(200);
    const storage = await storageEstimate();

    // Solo entorno técnico. Ni nombres, ni correos, ni contenido.
    return buildReport(events, {
      app: 'TAKU D&D 0.1.0',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 160) : 'desconocido',
      language: typeof navigator !== 'undefined' ? navigator.language : 'desconocido',
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      storageMb: storage ? Math.round((storage.usage / 1024 / 1024) * 10) / 10 : 0,
    });
  }, []);

  return { clear, buildReport: report };
}
