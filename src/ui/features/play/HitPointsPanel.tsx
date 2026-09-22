'use client';

import { Heart, Minus, Plus, Shield } from 'lucide-react';
import { useState } from 'react';
import type { CharacterSheet } from '@domain/character/sheet';
import { cn } from '@ui/design-system/cn';
import { PanelTitle } from '@ui/design-system/primitives';
import { REACTIONS } from '@ui/features/taku/lines';
import { useTakuCue, useTakuTransition } from '@ui/features/taku/TakuProvider';
import { Sheet } from '@ui/design-system/Sheet';
import type { DispatchFn } from '@ui/hooks/useAppData';

/**
 * PUNTOS DE GOLPE (MASTER SPEC §11)
 *
 * Es el control más usado de toda la aplicación. Recibir daño y curarse tienen
 * que costar UN toque, y todo es reversible con "Deshacer" — por eso no hay
 * confirmaciones en el camino.
 *
 * ACCESIBILIDAD
 *
 * Cambiar el número y el `aria-label` del botón NO alcanza: un lector de
 * pantalla no lee el cambio de la etiqueta de un elemento que no tiene el
 * foco. Sin una región viva, tocar "recibir 5 de daño" no anuncia nada y
 * quien no ve la pantalla se queda sin saber si funcionó.
 *
 * La región empieza vacía a propósito: si tuviera el valor desde el principio,
 * lo cantaría al abrir la ficha, cuando nadie lo pidió.
 */
export function HitPointsPanel({
  sheet,
  dispatch,
}: {
  sheet: CharacterSheet;
  dispatch: DispatchFn;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'damage' | 'heal' | 'temp'>('damage');
  const hp = sheet.hitPoints;

  // Caer a 0 no es un número más: arranca las salvaciones contra muerte, que
  // es la regla que más se olvida en la mesa. Taku lo dice en vez de que
  // alguien tenga que acordarse.
  const down = hp.status === 'down';
  useTakuCue(down, () => REACTIONS.droppedToZero(sheet.state.name));

  // Levantarse solo se anuncia viniendo DE estar caído. Con `useTakuCue(!down)`
  // se diría "está de pie otra vez" al abrir la ficha de cualquier personaje
  // sano: una obviedad, y encima gastaría el turno de habla de Taku.
  useTakuTransition(down, true, false, () => REACTIONS.backFromZero(sheet.state.name));


  /*
    Se compara contra el valor del render anterior en vez de usar un efecto:
    así el anuncio ya está en el DOM en el mismo pintado en que cambia el
    número, y no un fotograma después.

    Se vigila el valor GUARDADO (`sheet.state`), no el que se muestra.

    El que se muestra sale de `Math.min(guardado, máximo)`, y el máximo se
    mueve solo mientras la ficha se hidrata: el motor lo recalcula cuando llega
    el paquete de contenido. Así que entrar a cualquier personaje hacía saltar
    el número —de 10 a 12, sin que nadie tocara nada— y eso contaba como un
    cambio: la ficha cantaba «12 de 12 puntos de golpe» al abrirse. Y como la
    región es `assertive`, ni siquiera esperaba turno: cortaba lo que el lector
    estuviera diciendo.

    El valor guardado no se mueve solo. Solo cambia cuando un comando lo
    cambia, que es exactamente cuando hay algo que anunciar.
  */
  const guardados = sheet.state.hitPoints.current;
  const [announced, setAnnounced] = useState<{ at: number; text: string }>({
    at: guardados,
    text: '',
  });

  if (announced.at !== guardados) {
    const suffix =
      hp.status === 'down'
        ? '. Inconsciente.'
        : hp.status === 'critical'
          ? '. Estado crítico.'
          : '';
    setAnnounced({
      at: guardados,
      text: `${hp.current} de ${hp.max.value} puntos de golpe${suffix}`,
    });
  }

  const openWith = (m: 'damage' | 'heal' | 'temp') => {
    setMode(m);
    setOpen(true);
  };

  const quick = (amount: number, kind: 'damage' | 'heal') => {
    void dispatch(
      kind === 'damage'
        ? { type: 'DamageCharacter', amount }
        : { type: 'HealCharacter', amount },
    );
  };

  const barTone =
    hp.status === 'down'
      ? 'bg-[var(--text-tertiary)]'
      : hp.status === 'critical'
        ? 'bg-[var(--danger)]'
        : hp.status === 'bloodied'
          ? 'bg-[var(--warning)]'
          : 'bg-[var(--success)]';

  return (
    <>
      {/*
        `aria-live="assertive"` y no "polite": el resultado de recibir daño es
        justo lo que la persona está esperando oír, y en medio de un combate
        llega tarde si tiene que esperar a que termine otro anuncio.
      */}
      <p className="sr-only" role="status" aria-live="assertive">
        {announced.text}
      </p>

      <section className="surface-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4">
          <Heart className="size-4 text-[var(--danger-text)]" strokeWidth={2.4} />
          <PanelTitle>Puntos de golpe</PanelTitle>
          {hp.temporary > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[var(--frost-muted,var(--arcane-muted))] px-2 py-0.5 text-2xs font-medium text-[var(--arcane-text)]">
              <Shield className="size-3" />+{hp.temporary} temp
            </span>
          )}
        </div>

        <div className="flex items-end gap-2 px-4 pt-1">
          <button
            onClick={() => openWith('damage')}
            className="text-numeric font-display text-5xl font-bold leading-none tracking-tight"
            aria-label={`${hp.current} de ${hp.max.value} puntos de golpe. Tocá para ajustar.`}
          >
            {hp.current}
          </button>
          <span className="text-numeric pb-1 text-lg text-[var(--text-tertiary)]">/ {hp.max.value}</span>
        </div>

        <div className="px-4 pt-3">
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div
              className={cn('h-full rounded-full transition-[width] duration-500', barTone)}
              style={{ width: `${hp.percent}%` }}
            />
          </div>
        </div>

        {/* Acciones de un toque: los valores frecuentes en una mesa real */}
        <div className="mt-4 grid grid-cols-2 gap-px bg-[var(--border-subtle)]">
          <div className="grid grid-cols-3 gap-px bg-[var(--border-subtle)]">
            {[1, 5, 10].map((n) => (
              <button
                key={`d${n}`}
                onClick={() => quick(n, 'damage')}
                className="flex h-12 items-center justify-center gap-0.5 bg-[var(--surface-raised)] text-sm font-semibold text-[var(--danger-text)] transition-colors hover:bg-[var(--danger-muted)]"
                aria-label={`Recibir ${n} de daño`}
              >
                <Minus className="size-3.5" strokeWidth={2.6} />
                {n}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-px bg-[var(--border-subtle)]">
            {[1, 5, 10].map((n) => (
              <button
                key={`h${n}`}
                onClick={() => quick(n, 'heal')}
                className="flex h-12 items-center justify-center gap-0.5 bg-[var(--surface-raised)] text-sm font-semibold text-[var(--success-text)] transition-colors hover:bg-[var(--success-muted)]"
                aria-label={`Curar ${n} puntos`}
              >
                <Plus className="size-3.5" strokeWidth={2.6} />
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-px border-t border-[var(--border-subtle)] bg-[var(--border-subtle)]">
          <button
            onClick={() => openWith('damage')}
            className="h-11 bg-[var(--surface-raised)] text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-interactive)]"
          >
            Daño…
          </button>
          <button
            onClick={() => openWith('heal')}
            className="h-11 bg-[var(--surface-raised)] text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-interactive)]"
          >
            Curar…
          </button>
          <button
            onClick={() => openWith('temp')}
            className="h-11 bg-[var(--surface-raised)] text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-interactive)]"
          >
            Temporales
          </button>
        </div>
      </section>

      <AmountSheet
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        onMode={setMode}
        current={hp.current}
        max={hp.max.value}
        temporary={hp.temporary}
        onSubmit={(amount) => {
          if (amount <= 0) return;
          void dispatch(
            mode === 'damage'
              ? { type: 'DamageCharacter', amount }
              : mode === 'heal'
                ? { type: 'HealCharacter', amount }
                : { type: 'AddTemporaryHitPoints', amount },
          );
          setOpen(false);
        }}
      />
    </>
  );
}

function AmountSheet({
  open,
  onOpenChange,
  mode,
  onMode,
  current,
  max,
  temporary,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'damage' | 'heal' | 'temp';
  onMode: (m: 'damage' | 'heal' | 'temp') => void;
  current: number;
  max: number;
  temporary: number;
  onSubmit: (amount: number) => void;
}) {
  const [value, setValue] = useState('');
  const amount = Number(value) || 0;

  const titles = {
    damage: 'Recibir daño',
    heal: 'Curarse',
    temp: 'Puntos de golpe temporales',
  };

  // Previsualización: el usuario ve el resultado ANTES de confirmar.
  const preview =
    mode === 'damage'
      ? Math.max(0, current - Math.max(0, amount - temporary))
      : mode === 'heal'
        ? Math.min(max, current + amount)
        : current;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={titles[mode]} size="sm">
      <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] p-1">
        {(['damage', 'heal', 'temp'] as const).map((m) => (
          <button
            key={m}
            onClick={() => onMode(m)}
            className={cn(
              'rounded-[var(--radius-sm)] py-2 text-xs font-medium transition-colors',
              mode === m
                ? 'bg-[var(--surface-interactive)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)]',
            )}
          >
            {m === 'damage' ? 'Daño' : m === 'heal' ? 'Curación' : 'Temp.'}
          </button>
        ))}
      </div>

      <input
        type="number"
        inputMode="numeric"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(amount);
        }}
        placeholder="0"
        aria-label="Cantidad"
        className="text-numeric mt-4 w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-4 py-5 text-center font-display text-4xl font-bold outline-none focus:border-[var(--accent)]"
      />

      <div className="mt-3 grid grid-cols-4 gap-2">
        {[1, 2, 5, 10].map((n) => (
          <button
            key={n}
            onClick={() => setValue(String((Number(value) || 0) + n))}
            className="h-10 rounded-[var(--radius-md)] border border-[var(--border-default)] text-sm font-medium transition-colors hover:bg-[var(--surface-interactive)]"
          >
            +{n}
          </button>
        ))}
      </div>

      {amount > 0 && mode !== 'temp' && (
        <p className="mt-4 text-center text-sm text-[var(--text-tertiary)]">
          {current} → <span className="font-semibold text-[var(--text-primary)]">{preview}</span> PG
          {mode === 'damage' && temporary > 0 && (
            <span className="block text-xs">
              {Math.min(temporary, amount)} absorbidos por los temporales
            </span>
          )}
        </p>
      )}

      {amount > 0 && mode === 'temp' && (
        <p className="mt-4 text-center text-xs text-[var(--text-tertiary)]">
          {amount > temporary
            ? `Reemplaza los ${temporary} temporales actuales. No se acumulan.`
            : `Conservás los ${temporary} que ya tenías: son mejores.`}
        </p>
      )}

      <button
        onClick={() => onSubmit(amount)}
        disabled={amount <= 0}
        className={cn(
          'mt-5 h-12 w-full rounded-[var(--radius-lg)] font-semibold text-white transition-[filter] disabled:opacity-40',
          mode === 'damage'
            ? 'bg-[var(--danger)]'
            : mode === 'heal'
              ? 'bg-[var(--success)]'
              : 'bg-[var(--arcane)]',
          'hover:brightness-110',
        )}
      >
        {titles[mode]}
      </button>
    </Sheet>
  );
}
