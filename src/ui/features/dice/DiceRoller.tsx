'use client';

import { useCallback, useEffect, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { formatDiceExpression, parseDiceExpression, type DieSize } from '@domain/dice/expression';
import { rollExpression, type RollResult } from '@domain/dice/roller';
import { isErr } from '@domain/shared/result';
import type { RollMode } from '@domain/shared/computed';
import { cn } from '@ui/design-system/cn';
import { REACTIONS } from '@ui/features/taku/lines';
import { useTakuCue } from '@ui/features/taku/TakuProvider';
import { getDb } from '@infrastructure/local/db';
import { newUuid } from '@domain/shared/ids';

/**
 * TIRADA DE DADOS (MASTER SPEC §24)
 *
 * Aleatoriedad criptográfica, no `Math.random()`: en una
 * aplicación cuyo producto SON las tiradas, la calidad del generador no es
 * un detalle de implementación.
 */

const DICE: { sides: DieSize; label: string }[] = [
  { sides: 4, label: 'd4' },
  { sides: 6, label: 'd6' },
  { sides: 8, label: 'd8' },
  { sides: 10, label: 'd10' },
  { sides: 100, label: 'd10%' },
  { sides: 12, label: 'd12' },
  { sides: 20, label: 'd20' },
];

export function DiceRoller({
  characterId,
  compact = false,
  onRolled,
}: {
  characterId?: string;
  compact?: boolean;
  onRolled?: (result: RollResult) => void;
}) {
  const [sides, setSides] = useState<DieSize>(20);
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [mode, setMode] = useState<RollMode>('normal');
  const [result, setResult] = useState<RollResult | null>(null);
  const [rolling, setRolling] = useState(false);

  const expression = `${count}d${sides === 100 ? '100' : sides}${
    modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : modifier
  }`;

  const roll = useCallback(() => {
    const parsed = parseDiceExpression(expression);
    if (isErr(parsed)) return;

    setRolling(true);
    const outcome = rollExpression(parsed.value, {
      mode,
      detectCritical: sides === 20,
    });
    setResult(outcome);
    onRolled?.(outcome);

    void persistRoll(outcome, characterId);

    // La animación es breve a propósito: en una partida real nadie quiere
    // esperar a que un dado gire en la pantalla.
    setTimeout(() => setRolling(false), 420);
  }, [expression, mode, sides, characterId, onRolled]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {DICE.map((die) => (
          <button
            key={die.label}
            onClick={() => setSides(die.sides)}
            aria-pressed={sides === die.sides}
            className={cn(
              'h-11 rounded-[var(--radius-md)] border text-sm font-semibold transition-all duration-150',
              sides === die.sides
                ? 'border-transparent bg-crimson-gradient text-[var(--accent-on)] shadow-[var(--shadow-crimson)]'
                : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
            )}
          >
            {die.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stepper label="Cantidad" value={count} min={1} max={20} onChange={setCount} />
        <Stepper label="Modificador" value={modifier} min={-20} max={20} onChange={setModifier} showSign />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ToggleChip
          active={mode === 'advantage'}
          onClick={() => setMode(mode === 'advantage' ? 'normal' : 'advantage')}
          label="Ventaja"
          tone="success"
        />
        <ToggleChip
          active={mode === 'disadvantage'}
          onClick={() => setMode(mode === 'disadvantage' ? 'normal' : 'disadvantage')}
          label="Desventaja"
          tone="danger"
        />
      </div>

      <button
        onClick={roll}
        className="h-13 w-full rounded-[var(--radius-lg)] bg-crimson-gradient font-display text-base font-semibold text-[var(--accent-on)] shadow-[var(--shadow-crimson)] transition-[filter,box-shadow] hover:brightness-110 hover:shadow-[var(--shadow-crimson-lg)] active:scale-[0.99]"
      >
        Lanzar {formatDiceExpression(parseDiceExpressionSafe(expression))}
      </button>

      {result && <RollDisplay result={result} rolling={rolling} />}

      {!compact && <RollHistory characterId={characterId} />}
    </div>
  );
}

function parseDiceExpressionSafe(expr: string) {
  const parsed = parseDiceExpression(expr);
  return isErr(parsed) ? { terms: [], source: expr } : parsed.value;
}

/** El d20 con halo: es el dado de la marca y el que más se mira. */
export function RollDisplay({ result, rolling }: { result: RollResult; rolling: boolean }) {
  const isCrit = result.critical === 'hit';
  const isFumble = result.critical === 'miss';

  // Un 20 y un 1 natural son los dos momentos de la noche que la mesa recuerda.
  // Si Taku va a reaccionar a algo, es a esto.
  useTakuCue(isCrit && !rolling, REACTIONS.criticalHit);
  useTakuCue(isFumble && !rolling, REACTIONS.criticalMiss);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-xl)] border p-5 text-center',
        isCrit
          ? 'border-[var(--legendary-text)]/50 bg-[var(--legendary-muted)]'
          : isFumble
            ? 'border-[var(--danger-text)]/40 bg-[var(--danger-muted)]'
            : 'border-[var(--border-accent)] bg-[var(--surface-raised)]',
      )}
      role="status"
      aria-live="polite"
    >
      <p className="text-2xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
        {result.mode === 'advantage'
          ? 'Con ventaja'
          : result.mode === 'disadvantage'
            ? 'Con desventaja'
            : 'Resultado'}
      </p>

      <p
        className={cn(
          'text-numeric mt-1 font-display text-5xl font-bold leading-none',
          rolling && 'animate-tumble',
          isCrit && 'text-[var(--legendary-text)]',
          isFumble && 'text-[var(--danger-text)]',
        )}
      >
        {result.total}
      </p>

      {isCrit && <p className="mt-2 text-sm font-semibold text-[var(--legendary-text)]">¡Crítico!</p>}
      {isFumble && <p className="mt-2 text-sm font-semibold text-[var(--danger-text)]">Pifia</p>}

      {/* Desglose: cada dado individual, con los descartados tachados */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        {result.terms.map((term, i) =>
          term.rolls.length > 0 ? (
            term.rolls.map((die, j) => (
              <span
                key={`${i}-${j}`}
                className={cn(
                  'text-numeric inline-flex size-7 items-center justify-center rounded-[var(--radius-sm)] border text-xs',
                  die.dropped
                    ? 'border-[var(--border-subtle)] text-[var(--text-tertiary)] line-through opacity-50'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)]',
                )}
              >
                {die.value}
              </span>
            ))
          ) : (
            <span key={i} className="text-numeric text-xs text-[var(--text-tertiary)]">
              {term.subtotal >= 0 ? `+${term.subtotal}` : term.subtotal}
            </span>
          ),
        )}
      </div>

      {result.d20Pair && (
        <p className="text-numeric mt-2 text-xs text-[var(--text-tertiary)]">
          Tiradas: {result.d20Pair[0]} y {result.d20Pair[1]}
        </p>
      )}
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  showSign = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  showSign?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-2xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</p>
      <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--border-default)]">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Restar a ${label}`}
          className="flex h-11 w-11 items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-interactive)]"
        >
          <Minus className="size-4" />
        </button>
        <span className="text-numeric flex-1 text-center text-lg font-semibold">
          {showSign && value > 0 ? `+${value}` : value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`Sumar a ${label}`}
          className="flex h-11 w-11 items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-interactive)]"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: 'success' | 'danger';
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border text-sm font-medium transition-all',
        active
          ? tone === 'success'
            ? 'border-[var(--success-text)]/50 bg-[var(--success-muted)] text-[var(--success-text)]'
            : 'border-[var(--danger-text)]/50 bg-[var(--danger-muted)] text-[var(--danger-text)]'
          : 'border-[var(--border-default)] text-[var(--text-tertiary)] hover:border-[var(--border-strong)]',
      )}
    >
      <span
        className={cn(
          'size-3.5 rounded-full border-2',
          active
            ? tone === 'success'
              ? 'border-[var(--success-text)] bg-[var(--success-text)]'
              : 'border-[var(--danger-text)] bg-[var(--danger-text)]'
            : 'border-[var(--border-strong)]',
        )}
        aria-hidden="true"
      />
      {label}
    </button>
  );
}

/** Historial de tiradas (MASTER SPEC §25). Persistido, sobrevive al cierre. */
function RollHistory({ characterId }: { characterId?: string }) {
  const [rolls, setRolls] = useState<{ id: string; expression: string; total: number; rolledAt: string }[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const db = getDb();
      const rows = characterId
        ? await db.rolls.where('characterId').equals(characterId).toArray()
        : await db.rolls.toArray();
      if (!active) return;
      setRolls(rows.sort((a, b) => b.rolledAt.localeCompare(a.rolledAt)).slice(0, 12));
    };
    void load();
    const timer = setInterval(load, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [characterId]);

  if (rolls.length === 0) return null;

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-2xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        <RotateCcw className="size-3" />
        Historial
      </p>
      <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
        {rolls.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 bg-[var(--surface-raised)] px-3 py-2">
            <span className="text-numeric text-sm text-[var(--text-secondary)]">{r.expression}</span>
            <span className="text-numeric text-sm font-semibold">{r.total}</span>
            <span className="shrink-0 text-2xs text-[var(--text-tertiary)]">
              {new Date(r.rolledAt).toLocaleTimeString('es-419', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function persistRoll(result: RollResult, characterId?: string, context?: string): Promise<void> {
  try {
    await getDb().rolls.add({
      id: newUuid() as string,
      ...(characterId ? { characterId } : {}),
      expression: result.expression,
      total: result.total,
      mode: result.mode,
      ...(context ? { context } : {}),
      detail: result.terms
        .flatMap((t) => t.rolls.filter((d) => !d.dropped).map((d) => d.value))
        .join(','),
      rolledAt: result.rolledAt,
    });
  } catch {
    // Que falle el historial nunca debe impedir tirar un dado.
  }
}

export { persistRoll };
