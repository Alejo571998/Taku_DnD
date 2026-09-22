'use client';

import { Dices } from 'lucide-react';
import type { CharacterSheet } from '@domain/character/sheet';
import { cn } from '@ui/design-system/cn';
import { PanelTitle } from '@ui/design-system/primitives';
import { TIPS } from '@ui/features/taku/lines';
import { useTakuCue } from '@ui/features/taku/TakuProvider';

/**
 * DADOS DE GOLPE
 *
 * `sheet.hitDice` traía `total`, `spent` y `available` por clase desde el
 * principio, y el descanso corto los gastaba a ciegas: no había pantalla que
 * los mostrara. En la hoja oficial es una casilla del encabezado, al lado de
 * los puntos de golpe, con «gastados» y «máx.».
 *
 * Los rombos se pintan gastados de izquierda a derecha. No se pueden tocar
 * para gastarlos: eso lo hace el descanso corto, que es donde la regla los
 * consume, y duplicar la vía llevaría a dos contadores que se pisan.
 */
export function HitDicePanel({ sheet }: { sheet: CharacterSheet }) {
  /*
    El consejo salta al gastar el PRIMER dado, no al abrir la ficha. Antes de
    gastar ninguno, cuántos devuelve un descanso largo no le importa a nadie;
    con el primero gastado empieza a importar, y es cuando se lee.
  */
  useTakuCue(
    sheet.hitDice.some((bloque) => bloque.spent > 0),
    TIPS.hitDiceRecovery,
  );

  if (sheet.hitDice.length === 0) return null;

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Dices className="size-4 text-[var(--text-tertiary)]" strokeWidth={2.4} />
        <PanelTitle>Dados de golpe</PanelTitle>
      </div>

      <div className="space-y-2.5 px-4 pb-4 pt-3">
        {sheet.hitDice.map((bloque) => (
          <div key={bloque.classId as string} className="flex items-center gap-3">
            <span className="text-numeric w-14 shrink-0 text-sm font-semibold">
              d{bloque.die}
            </span>

            <div
              className="flex min-w-0 flex-1 flex-wrap gap-1.5"
              role="img"
              aria-label={`${bloque.available} de ${bloque.total} dados de golpe d${bloque.die} disponibles`}
            >
              {Array.from({ length: bloque.total }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    // El mismo rombo que usa la hoja oficial.
                    'size-3.5 rotate-45 border',
                    i < bloque.available
                      ? 'border-[var(--accent)] bg-[var(--accent)]'
                      : 'border-[var(--border-default)]',
                  )}
                />
              ))}
            </div>

            <span className="text-numeric shrink-0 text-xs text-[var(--text-tertiary)]">
              {bloque.available}/{bloque.total}
            </span>
          </div>
        ))}

        {sheet.isMulticlass && (
          <p className="text-2xs leading-relaxed text-[var(--text-tertiary)]">
            Con multiclase los dados no se mezclan: cada clase gasta los suyos.
          </p>
        )}
      </div>
    </section>
  );
}
