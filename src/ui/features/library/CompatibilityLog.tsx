'use client';

import { AlertTriangle, Undo2 } from 'lucide-react';
import type { CharacterState } from '@domain/character/state';
import { RULESET_LABEL, type Ruleset } from '@domain/rules/ruleset';
import type { DefinitionId } from '@domain/shared/ids';
import { Button } from '@ui/design-system/Button';
import { Card, SectionTitle } from '@ui/design-system/primitives';
import { useContentIndex, type DispatchFn } from '@ui/hooks/useAppData';

/**
 * REGISTRO DE CONTENIDO FORZADO (MASTER SPEC §4)
 *
 * Forzar contenido de otra edición es legítimo. Esconderlo después no.
 *
 * Esta lista existe para que, tres sesiones más tarde, cuando alguien
 * pregunte "¿por qué este objeto pega tan fuerte?", la respuesta esté escrita
 * en la ficha y no dependa de la memoria de nadie.
 */
export function CompatibilityLog({
  character,
  dispatch,
}: {
  character: CharacterState;
  dispatch: DispatchFn;
}) {
  const content = useContentIndex(character.ruleset);
  const overrides = character.compatibilityOverrides;

  if (overrides.length === 0) return null;

  return (
    <div className="mt-6">
      <SectionTitle>Contenido de otra edición</SectionTitle>
      <Card className="divide-y divide-[var(--border-subtle)]">
        <p className="flex items-start gap-2.5 px-4 py-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--warning-text)]" />
          Este personaje juega con {RULESET_LABEL[character.ruleset]}. Estas{' '}
          {overrides.length === 1 ? 'entrada viene' : 'entradas vienen'} de otra edición y las
          aceptaste a propósito.
        </p>

        {overrides.map((override) => {
          // El contenido forzado NO está en el índice del personaje (es de la
          // otra edición): por eso puede faltar el nombre y se muestra el id.
          const name = content?.get(override.definitionId)?.name ?? override.definitionId;
          return (
            <div key={override.definitionId} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{name}</span>
                <span className="block text-xs text-[var(--text-tertiary)]">
                  {(override.declared as readonly Ruleset[])
                    .map((r) => RULESET_LABEL[r] ?? r)
                    .join(' · ')}
                  {' · '}
                  {new Date(override.acceptedAt).toLocaleDateString('es-419', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void dispatch({
                    type: 'RevokeIncompatibleContent',
                    definitionId: override.definitionId as DefinitionId,
                  })
                }
              >
                <Undo2 className="size-4" />
                Quitar del registro
              </Button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
