'use client';

import { useState } from 'react';
import { Activity, Download, Trash2 } from 'lucide-react';
import type { DiagnosticEvent } from '@application/observability/diagnostics';
import { Button } from '@ui/design-system/Button';
import { Card, Chip, SectionTitle } from '@ui/design-system/primitives';
import { useToast } from '@ui/components/AppProviders';
import { downloadJson } from '@ui/hooks/useHomebrew';
import { useDiagnostics, useDiagnosticsActions, useDiagnosticsSummary } from '@ui/hooks/useDiagnostics';

/**
 * DIAGNÓSTICO (MASTER PROMPT §80)
 *
 * Sin nada de esto, un fallo intermitente es imposible de arreglar: el usuario
 * dice "a veces se rompe" y ahí termina la conversación.
 *
 * TAKU no manda telemetría a ningún lado. Lo que falla se anota acá y el
 * usuario elige si exporta el informe — que lleva qué falló y dónde, nunca el
 * nombre de un personaje ni una nota de partida.
 */

const AREA_LABEL: Record<string, string> = {
  sync: 'Sincronización',
  content: 'Contenido',
  command: 'Acciones',
  render: 'Pantallas',
  storage: 'Almacenamiento',
  auth: 'Cuenta',
};

export function DiagnosticsSection() {
  const summary = useDiagnosticsSummary();
  const events = useDiagnostics(20);
  const { clear, buildReport } = useDiagnosticsActions();
  const { notify } = useToast();
  const [expanded, setExpanded] = useState(false);

  if (summary.total === 0) {
    return (
      <section>
        <SectionTitle>Diagnóstico</SectionTitle>
        <Card className="p-4">
          <p className="flex items-center gap-2 text-sm">
            <Activity className="size-4 text-[var(--success-text)]" strokeWidth={2} />
            Sin incidencias registradas
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-tertiary)]">
            Si algo falla, queda anotado acá —en tu dispositivo— para que puedas contarnos qué pasó.
            TAKU no envía nada a ningún servidor por su cuenta.
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle>Diagnóstico</SectionTitle>
      <Card className="divide-y divide-[var(--border-subtle)]">
        <div className="flex items-center gap-3 p-4">
          <Activity
            className={summary.errors > 0 ? 'size-4 text-[var(--warning-text)]' : 'size-4 text-[var(--text-tertiary)]'}
            strokeWidth={2}
          />
          <span className="flex-1 text-sm">
            {summary.total} {summary.total === 1 ? 'incidencia' : 'incidencias'}
          </span>
          {summary.errors > 0 && <Chip tone="warning">{summary.errors} errores</Chip>}
        </div>

        <div className="flex flex-wrap gap-1.5 px-4 py-3">
          {Object.entries(summary.byArea).map(([area, n]) => (
            <Chip key={area} tone="neutral">
              {AREA_LABEL[area] ?? area}: {n}
            </Chip>
          ))}
        </div>

        {expanded && (
          <ul className="max-h-72 divide-y divide-[var(--border-subtle)] overflow-y-auto scrollbar-slim">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 p-3">
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Ocultar detalle' : 'Ver detalle'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              downloadJson(`taku-diagnostico-${Date.now()}.json`, await buildReport());
              notify({
                message: 'Informe descargado',
                detail: 'Lleva qué falló y en qué navegador. Nada de tus personajes ni tus notas.',
                tone: 'neutral',
              });
            }}
          >
            <Download className="size-4" />
            Exportar informe
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void clear()}>
            <Trash2 className="size-4" />
            Borrar
          </Button>
        </div>
      </Card>
    </section>
  );
}

function EventRow({ event }: { event: DiagnosticEvent }) {
  return (
    <li className="px-4 py-2.5">
      <div className="flex items-baseline gap-2">
        <span
          className={
            event.level === 'error'
              ? 'text-2xs font-semibold uppercase tracking-wide text-[var(--danger-text)]'
              : 'text-2xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]'
          }
        >
          {AREA_LABEL[event.area] ?? event.area}
        </span>
        <span className="text-numeric ml-auto text-2xs text-[var(--text-tertiary)]">
          {new Date(event.at).toLocaleString('es-419', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <p className="mt-0.5 break-words text-xs text-[var(--text-secondary)]">{event.code}</p>
      {event.detail && (
        <p className="mt-0.5 break-words text-2xs text-[var(--text-tertiary)]">{event.detail}</p>
      )}
    </li>
  );
}
