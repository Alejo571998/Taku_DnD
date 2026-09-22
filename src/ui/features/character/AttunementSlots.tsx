'use client';

import { Link2, Link2Off } from 'lucide-react';
import type { CharacterSheet } from '@domain/character/sheet';
import { cn } from '@ui/design-system/cn';
import { Card, SectionTitle } from '@ui/design-system/primitives';
import { useDefinitionName, type DispatchFn } from '@ui/hooks/useAppData';

/** El límite de las reglas. Vive en `inventory/operations.ts`; aquí solo se pinta. */
const RANURAS = 3;

/**
 * SINTONIZACIÓN CON OBJETOS MÁGICOS
 *
 * La hoja oficial tiene tres renglones explícitos. La aplicación lo marcaba
 * como un chip por objeto y avisaba al pasarse de tres, pero no había forma de
 * ver de un vistazo cuántas ranuras quedaban: había que recorrer la mochila.
 *
 * Se pintan siempre las tres, ocupadas o no. Una ranura vacía es información.
 */
export function AttunementSlots({
  sheet,
  dispatch,
}: {
  sheet: CharacterSheet;
  dispatch: DispatchFn;
}) {
  const nombreDe = useDefinitionName(sheet.ruleset);
  const sintonizados = sheet.state.inventory.filter((i) => i.attuned);

  // Si alguien forzó más de tres, se muestran todos: esconder el exceso sería
  // justo lo contrario de lo que el aviso intenta decir.
  const filas = Math.max(RANURAS, sintonizados.length);

  return (
    <section>
      <SectionTitle>Sintonización</SectionTitle>
      <Card className="divide-y divide-[var(--border-subtle)] p-0">
        {Array.from({ length: filas }, (_, i) => {
          const item = sintonizados[i];
          const exceso = i >= RANURAS;

          return (
            <div key={i} className="flex items-center gap-3 px-3.5 py-2.5">
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rotate-45 border',
                  item
                    ? exceso
                      ? 'border-[var(--danger)] bg-[var(--danger-muted)]'
                      : 'border-[var(--arcane)] bg-[var(--arcane-muted)]'
                    : 'border-[var(--border-default)]',
                )}
              >
                {item ? (
                  <Link2 className="size-3 -rotate-45 text-[var(--arcane-text)]" strokeWidth={2.4} />
                ) : (
                  <Link2Off
                    className="size-3 -rotate-45 text-[var(--text-tertiary)]"
                    strokeWidth={2.4}
                  />
                )}
              </span>

              <span className="min-w-0 flex-1 truncate text-sm">
                {item ? (
                  (item.customName ?? nombreDe(item.definitionId as string))
                ) : (
                  <span className="text-[var(--text-tertiary)]">Ranura libre</span>
                )}
              </span>

              {item && (
                <button
                  onClick={() => void dispatch({ type: 'UnattuneItem', itemId: item.id })}
                  className="shrink-0 text-2xs text-[var(--text-tertiary)] underline-offset-2 hover:underline"
                >
                  Desvincular
                </button>
              )}
            </div>
          );
        })}
      </Card>

      {sintonizados.length > RANURAS && (
        <p className="mt-2 text-xs text-[var(--danger-text)]">
          Tenés {sintonizados.length} objetos sintonizados y el máximo son {RANURAS}.
        </p>
      )}
    </section>
  );
}
