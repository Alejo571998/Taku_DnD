'use client';

import { use } from 'react';
import { Shirt } from 'lucide-react';
import type { EquipmentSlot } from '@domain/character/state';
import { EQUIPMENT_SLOTS } from '@domain/character/state';
import { asCharacterId } from '@domain/shared/ids';
import { cn } from '@ui/design-system/cn';
import { Card, Chip, LoadingState, SectionTitle } from '@ui/design-system/primitives';
import { CharacterHeader } from '@ui/components/CharacterHeader';
import { useCharacter, useCharacterSheet, useDefinitionName, useDispatch } from '@ui/hooks/useAppData';

/**
 * EQUIPAMIENTO (MASTER SPEC §15)
 *
 * Equipar un objeto modifica la ficha automáticamente. Los conflictos se
 * detectan y se explican: nunca se hace un cambio destructivo en silencio.
 */
const SLOT_LABELS: Record<EquipmentSlot, string> = {
  mainHand: 'Mano principal',
  offHand: 'Mano secundaria',
  twoHand: 'A dos manos',
  armor: 'Armadura',
  shield: 'Escudo',
  head: 'Cabeza',
  cloak: 'Capa',
  boots: 'Botas',
  gloves: 'Guantes',
  belt: 'Cinturón',
  amulet: 'Amuleto',
  ring1: 'Anillo 1',
  ring2: 'Anillo 2',
};

export default function EquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const character = useCharacter(asCharacterId(id));
  const sheet = useCharacterSheet(character);
  const dispatch = useDispatch(character);
  // Antes del return temprano: un hook no se puede llamar condicionalmente.
  const nombreDe = useDefinitionName(character?.ruleset ?? '2014');

  if (!character || !sheet) return <LoadingState label="Cargando…" />;

  const bySlot = new Map(
    character.inventory.filter((i) => i.equippedSlot).map((i) => [i.equippedSlot as EquipmentSlot, i]),
  );

  return (
    <div className="animate-fade-in">
      <CharacterHeader sheet={sheet} />

      <div className="mb-4 flex items-center gap-2.5">
        <Shirt className="size-5 text-[var(--accent-text)]" />
        <h2 className="font-display text-lg">Equipamiento</h2>
      </div>

      <Card className="mb-4 flex items-center justify-between p-4">
        <div>
          <p className="text-2xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Clase de armadura
          </p>
          <p className="text-numeric font-display text-3xl font-bold">{sheet.armorClass.value}</p>
        </div>
        <div className="flex max-w-[60%] flex-wrap justify-end gap-1.5">
          {sheet.armorClass.contributions
            .filter((c) => c.amount !== 0 || c.op === 'base' || c.op === 'set')
            .map((c, i) => (
              <Chip key={i} tone="neutral">
                {c.source.label} {c.op === 'add' && c.amount > 0 ? '+' : ''}
                {c.amount}
              </Chip>
            ))}
        </div>
      </Card>

      <SectionTitle>Ranuras</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        {EQUIPMENT_SLOTS.map((slot) => {
          const item = bySlot.get(slot);
          const attack = item ? sheet.attacks.find((a) => a.itemId === (item.id as string)) : undefined;
          const name = item?.customName ?? attack?.name ?? (item ? nombreDe(item.definitionId as string) : null);

          return (
            <div
              key={slot}
              className={cn(
                'flex items-center gap-3 rounded-[var(--radius-lg)] border p-3',
                item
                  ? 'border-[var(--border-accent)] bg-[var(--accent-muted)]'
                  : 'border-dashed border-[var(--border-default)] bg-transparent',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-2xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  {SLOT_LABELS[slot]}
                </span>
                <span className={cn('block truncate text-sm', !item && 'text-[var(--text-tertiary)]')}>
                  {name ?? 'Vacío'}
                </span>
              </span>

              {item && (
                <button
                  onClick={() => void dispatch({ type: 'UnequipItem', itemId: item.id })}
                  className="shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-interactive)]"
                >
                  Quitar
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-[var(--text-tertiary)]">
        Para equipar, entrá a un objeto desde el inventario. Detectamos conflictos —como llevar un arma
        a dos manos con la otra ocupada— y te lo explicamos antes de hacer nada.
      </p>
    </div>
  );
}

