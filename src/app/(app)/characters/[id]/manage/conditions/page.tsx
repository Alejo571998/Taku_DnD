'use client';

import { use, useState } from 'react';
import { Plus } from 'lucide-react';
import { asCharacterId, type DefinitionId } from '@domain/shared/ids';
import { cn } from '@ui/design-system/cn';
import { Button } from '@ui/design-system/Button';
import { Card, EmptyState, LoadingState } from '@ui/design-system/primitives';
import { Sheet } from '@ui/design-system/Sheet';
import { CharacterHeader } from '@ui/components/CharacterHeader';
import { useCharacter, useCharacterSheet, useContentIndex, useDispatch } from '@ui/hooks/useAppData';

/**
 * CONDICIONES (MASTER SPEC §23)
 *
 * Separación definición/instancia: la condición "Envenenado" es contenido; que
 * ESTE personaje esté envenenado, desde cuándo y por qué, es estado suyo.
 */
export default function ConditionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const character = useCharacter(asCharacterId(id));
  const sheet = useCharacterSheet(character);
  const dispatch = useDispatch(character);
  const content = useContentIndex(character?.ruleset ?? '2014');
  const [adding, setAdding] = useState(false);

  if (!character || !sheet || !content) return <LoadingState label="Cargando…" />;

  const available = content.conditions();
  const activeIds = new Set(sheet.activeConditions.map((c) => c.definitionId as string));

  return (
    <div className="animate-fade-in">
      <CharacterHeader sheet={sheet} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">Condiciones</h2>
        <Button variant="primary" size="sm" leading={<Plus className="size-4" />} onClick={() => setAdding(true)}>
          Aplicar
        </Button>
      </div>

      {sheet.activeConditions.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin condiciones activas"
            description="Cuando algo te afecte —envenenado, derribado, asustado— aplicalo acá y lo vas a ver siempre a mano durante la partida."
            action={
              <Button variant="primary" onClick={() => setAdding(true)}>
                Aplicar condición
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {sheet.activeConditions.map((c) => (
            <li key={c.instanceId}>
              <details className="rounded-[var(--radius-lg)] border border-[var(--danger-text)]/30 bg-[var(--danger-muted)]">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    {c.sourceLabel && (
                      <span className="block truncate text-xs text-[var(--text-tertiary)]">{c.sourceLabel}</span>
                    )}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      void dispatch({ type: 'RemoveCondition', instanceId: c.instanceId });
                    }}
                    className="shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-interactive)]"
                  >
                    Quitar
                  </button>
                </summary>
                <div className="space-y-2 px-4 pb-4 text-sm text-[var(--text-secondary)]">
                  {c.description.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={adding} onOpenChange={setAdding} title="Aplicar condición" size="md">
        <ul className="space-y-1.5">
          {available.map((c) => {
            const isActive = activeIds.has(c.id as string);
            return (
              <li key={c.id}>
                <button
                  disabled={isActive}
                  onClick={() => {
                    void dispatch({ type: 'ApplyCondition', definitionId: c.id as DefinitionId });
                    setAdding(false);
                  }}
                  className={cn(
                    'w-full rounded-[var(--radius-md)] border p-3 text-left transition-colors',
                    isActive
                      ? 'border-[var(--border-subtle)] opacity-40'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-accent)]',
                  )}
                >
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-tertiary)]">{c.description[0]}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}
