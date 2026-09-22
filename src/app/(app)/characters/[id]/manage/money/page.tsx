'use client';

import { use, useState } from 'react';
import { Coins, Minus, Plus } from 'lucide-react';
import {
  DENOMINATION_ABBR_ES,
  DENOMINATION_NAME_ES,
  DISPLAY_ORDER_ES,
  totalInGold,
  type Denomination,
} from '@domain/currency/currency';
import { asCharacterId } from '@domain/shared/ids';
import { cn } from '@ui/design-system/cn';
import { Button } from '@ui/design-system/Button';
import { Card, LoadingState, SectionTitle } from '@ui/design-system/primitives';
import { ConfirmDialog, Sheet } from '@ui/design-system/Sheet';
import { CharacterHeader } from '@ui/components/CharacterHeader';
import { useCharacter, useCharacterSheet, useDispatch } from '@ui/hooks/useAppData';

/**
 * DINERO (MASTER SPEC §20)
 *
 * Cinco contadores independientes. Las conversiones son explícitas y
 * confirmadas: convertir monedas a espaldas del jugador no es una comodidad,
 * es destruirle algo que era suyo.
 */
export default function MoneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const character = useCharacter(asCharacterId(id));
  const sheet = useCharacterSheet(character);
  const dispatch = useDispatch(character);

  const [editing, setEditing] = useState<Denomination | null>(null);
  const [confirmConsolidate, setConfirmConsolidate] = useState(false);

  if (!character || !sheet) return <LoadingState label="Cargando…" />;

  const purse = character.currency;

  return (
    <div className="animate-fade-in">
      <CharacterHeader sheet={sheet} />

      <div className="mb-4 flex items-center gap-2.5">
        <Coins className="size-5 text-[var(--legendary-text)]" />
        <h2 className="font-display text-lg">Dinero</h2>
      </div>

      <Card className="mb-4 p-5 text-center">
        <p className="text-2xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Valor total</p>
        <p className="text-numeric mt-1 font-display text-3xl font-bold">
          {totalInGold(purse).toLocaleString('es-419', { maximumFractionDigits: 2 })}{' '}
          <span className="text-lg text-[var(--text-tertiary)]">PO</span>
        </p>
      </Card>

      <SectionTitle>Monedas</SectionTitle>
      <div className="space-y-2">
        {DISPLAY_ORDER_ES.map((d) => (
          <div
            key={d}
            className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3"
          >
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                d === 'gp' && 'border-[var(--legendary-text)]/40 bg-[var(--legendary-muted)] text-[var(--legendary-text)]',
                d === 'pp' && 'border-[var(--frost-400,var(--arcane-text))]/40 bg-[var(--arcane-muted)] text-[var(--arcane-text)]',
                d === 'ep' && 'border-[var(--border-default)] text-[var(--text-secondary)]',
                d === 'sp' && 'border-[var(--border-strong)] text-[var(--text-secondary)]',
                d === 'cp' && 'border-[var(--accent-text)]/30 bg-[var(--accent-muted)] text-[var(--accent-text)]',
              )}
              aria-hidden="true"
            >
              {DENOMINATION_ABBR_ES[d]}
            </span>

            <div className="min-w-0 flex-1">
              {/* El nombre completo mitiga la ambigüedad de PP/PA en español */}
              <p className="text-sm font-medium">{DENOMINATION_NAME_ES[d]}</p>
              <p className="text-2xs text-[var(--text-tertiary)]">{DENOMINATION_ABBR_ES[d]}</p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => void dispatch({ type: 'RemoveCurrency', delta: { [d]: 1 } })}
                disabled={purse[d] <= 0}
                aria-label={`Quitar una ${DENOMINATION_NAME_ES[d]}`}
                className="flex size-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] disabled:opacity-35"
              >
                <Minus className="size-4" />
              </button>
              <button
                onClick={() => setEditing(d)}
                className="text-numeric w-14 text-center text-lg font-semibold"
                aria-label={`Editar ${DENOMINATION_NAME_ES[d]}`}
              >
                {purse[d]}
              </button>
              <button
                onClick={() => void dispatch({ type: 'AddCurrency', delta: { [d]: 1 } })}
                aria-label={`Agregar una ${DENOMINATION_NAME_ES[d]}`}
                className="flex size-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)]"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="secondary"
        className="mt-4 w-full"
        onClick={() => setConfirmConsolidate(true)}
      >
        Convertir a las monedas más grandes
      </Button>

      <ConfirmDialog
        open={confirmConsolidate}
        onOpenChange={setConfirmConsolidate}
        title="¿Convertir tus monedas?"
        description="Vamos a cambiar tus monedas pequeñas por las de mayor valor. El total no cambia, pero perdés las monedas originales. Podés deshacerlo después."
        confirmLabel="Convertir"
        tone="primary"
        onConfirm={() => void dispatch({ type: 'ConsolidateCurrency' })}
      />

      {editing && (
        <AmountSheet
          denomination={editing}
          current={purse[editing]}
          onClose={() => setEditing(null)}
          onApply={(delta) => {
            if (delta > 0) void dispatch({ type: 'AddCurrency', delta: { [editing]: delta } });
            else if (delta < 0) void dispatch({ type: 'RemoveCurrency', delta: { [editing]: -delta } });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function AmountSheet({
  denomination,
  current,
  onClose,
  onApply,
}: {
  denomination: Denomination;
  current: number;
  onClose: () => void;
  onApply: (delta: number) => void;
}) {
  const [value, setValue] = useState('');
  const amount = Number(value) || 0;

  return (
    <Sheet
      open
      onOpenChange={(v) => !v && onClose()}
      title={DENOMINATION_NAME_ES[denomination]}
      description={`Tenés ${current} ${DENOMINATION_ABBR_ES[denomination]}`}
      size="sm"
    >
      <input
        type="number"
        inputMode="numeric"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="0"
        aria-label="Cantidad"
        className="text-numeric w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-4 py-5 text-center font-display text-4xl font-bold outline-none focus:border-[var(--accent)]"
      />

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Button variant="danger" disabled={amount <= 0 || amount > current} onClick={() => onApply(-amount)}>
          Gastar {amount || ''}
        </Button>
        <Button variant="success" disabled={amount <= 0} onClick={() => onApply(amount)}>
          Recibir {amount || ''}
        </Button>
      </div>
    </Sheet>
  );
}
