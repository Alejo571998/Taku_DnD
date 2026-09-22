'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Check, Laptop, Cloud } from 'lucide-react';
import { describeConflict, type SyncConflict } from '@application/sync/conflicts';
import { RulesEngine } from '@domain/rules/engine';
import { SRD_RULES } from '@domain/rules/srd-rules';
import type { CharacterId } from '@domain/shared/ids';
import { cn } from '@ui/design-system/cn';
import { Button } from '@ui/design-system/Button';
import { Sheet } from '@ui/design-system/Sheet';
import { useToast } from './AppProviders';
import { useContentIndex } from '@ui/hooks/useAppData';
import {
  usePendingConflicts,
  useResolveConflict,
  useServerVersion,
  useSyncRunner,
} from '@ui/hooks/useSync';

/**
 * CENTRO DE SINCRONIZACIÓN
 *
 * Dos cosas, ninguna intrusiva:
 *   - arrancar el ciclo y conectarlo a los eventos del navegador
 *   - avisar cuando hace falta una decisión HUMANA
 *
 * Un conflicto no se resuelve solo con una regla ingeniosa. Dos dispositivos
 * cambiaron lo mismo; solo el jugador sabe cuál vale.
 */
export function SyncCenter() {
  useSyncRunner();
  return <ConflictBanner />;
}

function ConflictBanner() {
  const conflicts = usePendingConflicts();
  const [open, setOpen] = useState<SyncConflict | null>(null);

  if (conflicts.length === 0) return null;
  const first = conflicts[0]!;

  return (
    <>
      <div
        role="status"
        className="fixed inset-x-0 z-40 mx-auto max-w-md px-4 lg:left-[var(--sidebar-width)]"
        // Por encima del aviso de "sin conexión": pueden coincidir.
        style={{ bottom: 'calc(var(--nav-offset) + 3.75rem)' }}
      >
        <button
          onClick={() => setOpen(first)}
          className="flex w-full items-center gap-2.5 rounded-full border border-[var(--warning-text)]/40 bg-[var(--surface-overlay)]/95 px-4 py-2.5 text-left shadow-[var(--shadow-overlay)] backdrop-blur-xl transition-transform active:scale-[0.99]"
        >
          <AlertTriangle className="size-4 shrink-0 text-[var(--warning-text)]" strokeWidth={2} />
          <span className="min-w-0 flex-1 text-xs">
            <span className="font-medium">
              {conflicts.length === 1
                ? `${first.characterName} cambió en dos lados`
                : `${conflicts.length} personajes cambiaron en dos lados`}
            </span>{' '}
            <span className="text-[var(--text-tertiary)]">Tocá para decidir.</span>
          </span>
        </button>
      </div>

      <ConflictSheet conflict={open} onClose={() => setOpen(null)} />
    </>
  );
}

function ConflictSheet({ conflict, onClose }: { conflict: SyncConflict | null; onClose: () => void }) {
  const content = useContentIndex(conflict?.localState.ruleset ?? '2014');
  const engine = new RulesEngine(SRD_RULES, conflict?.localState.ruleset ?? '2014');
  const resolve = useResolveConflict(content, engine);
  const { notify } = useToast();
  const [busy, setBusy] = useState<'local' | 'server' | null>(null);
  // La version del servidor se pide de verdad. Enseñar una comparacion
  // inventada seria peor que no enseñar ninguna.
  const serverState = useServerVersion(conflict?.characterId ?? null);

  const apply = async (as: 'local' | 'server') => {
    if (!conflict) return;
    setBusy(as);
    const done = await resolve(conflict.characterId as CharacterId, as);
    setBusy(null);
    if (done) {
      notify({
        message:
          as === 'local'
            ? 'Se mantuvo la versión de este dispositivo'
            : 'Se adoptó la versión del otro dispositivo',
        tone: 'success',
      });
      onClose();
    } else {
      notify({
        message: 'No pudimos resolverlo ahora',
        detail: 'Necesitamos conexión para traer la otra versión. Tus cambios siguen guardados acá.',
        tone: 'danger',
      });
    }
  };

  const fields = conflict && serverState ? describeConflict(conflict.localState, serverState) : [];

  return (
    <Sheet
      open={conflict !== null}
      onOpenChange={(v) => !v && onClose()}
      title="Dos versiones del mismo personaje"
      size="lg"
    >
      {conflict && (
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            <strong className="font-medium text-[var(--text-primary)]">{conflict.characterName}</strong>{' '}
            cambió en este dispositivo y en otro mientras estaban separados. Nada se borró: elegí con
            cuál seguir.
          </p>

          <div className="rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-3.5 py-3 text-xs text-[var(--text-tertiary)]">
            Detectado el{' '}
            {new Date(conflict.detectedAt).toLocaleString('es-419', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
            . {conflict.reason}
          </div>

          {fields.length > 0 && (
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 bg-[var(--surface-sunken)] px-3 py-2 text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                <span />
                <span>Acá</span>
                <span>Allá</span>
              </div>
              {fields.map((f) => (
                <div
                  key={f.label}
                  className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-t border-[var(--border-subtle)] px-3 py-2 text-xs"
                >
                  <span className="text-[var(--text-tertiary)]">{f.label}</span>
                  <span className="text-numeric text-right">{f.local}</span>
                  <span className="text-numeric text-right text-[var(--text-tertiary)]">{f.server}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2.5 sm:grid-cols-2">
            <ChoiceCard
              icon={<Laptop className="size-4" strokeWidth={2} />}
              title="Lo de este dispositivo"
              detail={`Versión ${conflict.localVersion}. Se sube y reemplaza la otra.`}
              loading={busy === 'local'}
              disabled={busy !== null}
              onClick={() => void apply('local')}
            />
            <ChoiceCard
              icon={<Cloud className="size-4" strokeWidth={2} />}
              title="Lo del otro dispositivo"
              detail={`Versión ${conflict.serverVersion}. Se descarta lo de acá.`}
              loading={busy === 'server'}
              disabled={busy !== null}
              onClick={() => void apply('server')}
            />
          </div>

          {!serverState && (
            <p className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <ArrowLeftRight className="size-3.5 shrink-0" />
              No pudimos traer la otra versión para compararla. Podés decidir igual: quedarte con
              lo de acá no necesita conexión.
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}

function ChoiceCard({
  icon,
  title,
  detail,
  loading,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] p-3.5 text-left transition-[border-color,transform]',
        disabled ? 'opacity-60' : 'hover:border-[var(--border-accent)] active:scale-[0.99]',
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {loading ? <Check className="size-4 animate-pulse" /> : icon}
        {title}
      </span>
      <span className="mt-1 block text-xs text-[var(--text-tertiary)]">{detail}</span>
    </button>
  );
}

/** Botón de sincronizar ahora. Vive en el perfil, no en cada pantalla. */
export function SyncNowButton() {
  const { state, syncNow, enabled } = useSyncRunner();
  if (!enabled) return null;

  return (
    <Button variant="secondary" size="sm" loading={state.phase === 'syncing'} onClick={syncNow}>
      Sincronizar ahora
    </Button>
  );
}
