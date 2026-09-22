'use client';

import { Skull } from 'lucide-react';
import { useState } from 'react';
import type { CharacterSheet } from '@domain/character/sheet';
import { cn } from '@ui/design-system/cn';
import { PanelTitle } from '@ui/design-system/primitives';
import { Sheet } from '@ui/design-system/Sheet';
import type { DispatchFn } from '@ui/hooks/useAppData';

/**
 * SALVACIONES CONTRA MUERTE
 *
 * El dominio las llevaba enteras desde el principio —acumula, topa en tres,
 * el 20 natural revive y el 1 cuenta doble— y NINGUNA pantalla las pintaba.
 * Un personaje a 0 PG tenía las salvaciones contándose sin que quien juega
 * pudiera verlas, que es la regla que más se olvida en la mesa.
 *
 * Los rombos son los de la hoja oficial: tres para los éxitos, tres para los
 * fallos. Se pueden tocar para marcar a mano cuando la tirada se hizo con
 * dados de verdad, y hay un botón para tirar dentro de la aplicación.
 */
export function DeathSavesPanel({
  sheet,
  dispatch,
}: {
  sheet: CharacterSheet;
  dispatch: DispatchFn;
}) {
  const [pidiendoTirada, setPidiendoTirada] = useState(false);
  const { successes, failures } = sheet.hitPoints.deathSaves;

  /*
    El dominio no tiene un comando para «marcá un éxito»: tiene
    `RecordDeathSave` con la tirada. Tocar un rombo manda la tirada que
    produce ese resultado —10 para un éxito, 2 para un fallo— en vez de
    inventar una vía paralela que el motor no conoce.
  */
  const marcar = (kind: 'success' | 'failure') =>
    void dispatch({ type: 'RecordDeathSave', roll: kind === 'success' ? 10 : 2 });

  return (
    <>
      <section className="surface-card overflow-hidden border-[var(--danger)]">
        <div className="flex items-center gap-3 px-4 pt-4">
          <Skull className="size-4 text-[var(--danger-text)]" strokeWidth={2.4} />
          <PanelTitle>Salvaciones contra muerte</PanelTitle>
          <button
            onClick={() => void dispatch({ type: 'ResetDeathSaves' })}
            className="ml-auto text-2xs text-[var(--text-tertiary)] underline-offset-2 hover:underline"
          >
            Borrar
          </button>
        </div>

        <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)] px-4 pb-1 pt-3">
          <Fila
            label="Éxitos"
            marcados={successes}
            tone="success"
            onMark={() => marcar('success')}
          />
          <Fila
            label="Fallos"
            marcados={failures}
            tone="danger"
            onMark={() => marcar('failure')}
          />
        </div>

        <button
          onClick={() => setPidiendoTirada(true)}
          className="mt-3 h-11 w-full border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-interactive)]"
        >
          Tirar salvación…
        </button>
      </section>

      <TiradaSheet
        open={pidiendoTirada}
        onOpenChange={setPidiendoTirada}
        onSubmit={(roll) => {
          void dispatch({ type: 'RecordDeathSave', roll });
          setPidiendoTirada(false);
        }}
      />
    </>
  );
}

function Fila({
  label,
  marcados,
  tone,
  onMark,
}: {
  label: string;
  marcados: number;
  tone: 'success' | 'danger';
  onMark: () => void;
}) {
  return (
    <div className="bg-[var(--surface-raised)] px-3 py-2">
      <p className="text-2xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">{label}</p>
      <div className="mt-1.5 flex gap-1.5" role="group" aria-label={`${label}: ${marcados} de 3`}>
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            onClick={onMark}
            disabled={i < marcados}
            aria-label={
              i < marcados ? `${label} ${i + 1} de 3, marcado` : `Marcar ${label.toLowerCase()}`
            }
            className={cn(
              // El rombo de la hoja oficial: un cuadrado girado 45°.
              'size-4 rotate-45 border transition-colors',
              i < marcados
                ? tone === 'success'
                  ? 'border-[var(--success)] bg-[var(--success)]'
                  : 'border-[var(--danger)] bg-[var(--danger)]'
                : 'border-[var(--border-default)] hover:border-[var(--border-accent)]',
            )}
          />
        ))}
      </div>
    </div>
  );
}

function TiradaSheet({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (roll: number) => void;
}) {
  const [value, setValue] = useState('');
  const roll = Number(value) || 0;
  const valido = roll >= 1 && roll <= 20;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Salvación contra muerte" size="sm">
      <p className="text-sm text-[var(--text-secondary)]">
        Poné el resultado del d20. Con 10 o más es un éxito; un 20 natural te levanta con 1 PG y un
        1 natural cuenta como dos fallos.
      </p>

      <input
        type="number"
        inputMode="numeric"
        autoFocus
        min={1}
        max={20}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valido) onSubmit(roll);
        }}
        placeholder="0"
        aria-label="Resultado del d20"
        className="text-numeric mt-4 w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-4 py-5 text-center font-display text-4xl font-bold outline-none focus:border-[var(--accent)]"
      />

      <button
        onClick={() => onSubmit(roll)}
        disabled={!valido}
        className="mt-5 h-12 w-full rounded-[var(--radius-lg)] bg-[var(--danger)] font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-40"
      >
        Anotar
      </button>
    </Sheet>
  );
}
