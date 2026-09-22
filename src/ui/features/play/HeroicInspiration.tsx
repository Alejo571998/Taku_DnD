'use client';

import { Sparkle } from 'lucide-react';
import type { CharacterSheet } from '@domain/character/sheet';
import { cn } from '@ui/design-system/cn';
import { PanelTitle } from '@ui/design-system/primitives';
import type { DispatchFn } from '@ui/hooks/useAppData';

/**
 * INSPIRACIÓN HEROICA (2024)
 *
 * No existía en el modelo: era el único recuadro de la hoja oficial sin nada
 * detrás. Se tiene o no se tiene —no se acumula—, así que es un interruptor y
 * no un contador.
 *
 * Solo aparece en 2024. En 5.1 la mecánica se llama «inspiración» y no está en
 * el SRD, así que mostrar el recuadro ahí sería prometer una regla que la
 * edición elegida no trae.
 */
export function HeroicInspiration({
  sheet,
  dispatch,
}: {
  sheet: CharacterSheet;
  dispatch: DispatchFn;
}) {
  if (sheet.ruleset !== '2024') return null;

  const tiene = sheet.state.heroicInspiration === true;
  const estado = tiene ? 'La tenés: tocá para gastarla' : 'No la tenés: tocá si el GM te la da';

  /*
    El título va FUERA del botón a propósito. Un `h2` dentro de un `button` es
    HTML inválido —`button` solo admite contenido de frase— y además el rol de
    encabezado se lo come el cálculo del nombre accesible.

    Así que la tarjeta es una sección con su encabezado, y el botón es solo la
    línea de estado, estirado con `after:inset-0` para que se pueda tocar la
    tarjeta entera como antes. El `aria-label` repite el título porque quien
    recorre la pantalla por botones oye el control suelto, sin el encabezado
    que tiene encima.
  */
  return (
    <section
      className={cn(
        'surface-card relative flex items-center gap-3 px-4 py-3.5 transition-colors',
        tiene
          ? 'border-[var(--legendary)]'
          : 'hover:bg-[var(--surface-interactive)] focus-within:border-[var(--accent)]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          // El rombo de la hoja oficial, relleno cuando la tenés.
          'grid size-8 shrink-0 place-items-center rotate-45 border',
          tiene
            ? 'border-[var(--legendary)] bg-[var(--legendary)]'
            : 'border-[var(--border-default)]',
        )}
      >
        <Sparkle
          className={cn('size-4 -rotate-45', tiene ? 'text-black' : 'text-[var(--text-tertiary)]')}
          strokeWidth={2.4}
        />
      </span>

      <div className="min-w-0 flex-1">
        <PanelTitle>Inspiración heroica</PanelTitle>
        <button
          onClick={() => void dispatch({ type: 'SetHeroicInspiration', has: !tiene })}
          aria-pressed={tiene}
          aria-label={`Inspiración heroica. ${estado}`}
          className="block text-left text-sm outline-none after:absolute after:inset-0 after:content-['']"
        >
          {estado}
        </button>
      </div>
    </section>
  );
}
