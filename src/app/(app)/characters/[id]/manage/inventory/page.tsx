'use client';

import { use, useState } from 'react';
import { Backpack, Plus, Search, Star } from 'lucide-react';
import type { CharacterSheet } from '@domain/character/sheet';
import type { InventoryItemState, EquipmentSlot } from '@domain/character/state';
import { formatWeight, weightFromHundredths } from '@domain/shared/units';
import { asCharacterId, type DefinitionId, type InventoryItemId } from '@domain/shared/ids';
import { cn } from '@ui/design-system/cn';
import { Card, Chip, EmptyState, LoadingState, ProgressBar } from '@ui/design-system/primitives';
import { Sheet } from '@ui/design-system/Sheet';
import { Button } from '@ui/design-system/Button';
import { CharacterHeader } from '@ui/components/CharacterHeader';
import { TypeIcon } from '@ui/features/library/DefinitionDetail';
import { AttunementSlots } from '@ui/features/character/AttunementSlots';
import {
  useCharacter,
  useCharacterSheet,
  useContentSearch,
  useDefinitionName,
  useDispatch,
  type DispatchFn,
} from '@ui/hooks/useAppData';

/**
 * INVENTARIO (MASTER SPEC §13)
 *
 * Instancias, no definiciones: cada objeto del personaje puede tener nombre
 * propio, cantidad y notas sin tocar el contenido del que viene.
 */

const FILTERS = [
  { key: 'all', label: 'Todo' },
  { key: 'equipped', label: 'Equipado' },
  { key: 'weapon', label: 'Armas' },
  { key: 'armor', label: 'Armaduras' },
  { key: 'consumable', label: 'Consumibles' },
  { key: 'other', label: 'Otros' },
] as const;

export default function InventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const character = useCharacter(asCharacterId(id));
  const sheet = useCharacterSheet(character);
  const dispatch = useDispatch(character);

  const [filter, setFilter] = useState<string>('all');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<InventoryItemState | null>(null);

  if (!character || !sheet) return <LoadingState label="Cargando inventario…" />;

  const content = sheet;
  const items = character.inventory.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'equipped') return Boolean(item.equippedSlot);
    const def = contentTypeOf(item, sheet);
    if (filter === 'weapon') return def === 'weapon';
    if (filter === 'armor') return def === 'armor';
    if (filter === 'consumable') return def === 'consumable';
    return def === 'other';
  });

  return (
    <div className="animate-fade-in">
      <CharacterHeader sheet={content} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">Inventario</h2>
        <Button variant="primary" size="sm" leading={<Plus className="size-4" />} onClick={() => setAdding(true)}>
          Agregar
        </Button>
      </div>

      <Card className="mb-4 p-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-[var(--text-tertiary)]">Carga</span>
          <span className="text-numeric">
            {formatWeight(sheet.carrying.carried)} / {formatWeight(sheet.carrying.capacity)}
          </span>
        </div>
        <ProgressBar
          className="mt-2"
          value={sheet.carrying.carried}
          max={sheet.carrying.capacity}
          tone={sheet.carrying.status === 'exceeded' ? 'danger' : sheet.carrying.status === 'normal' ? 'accent' : 'warning'}
          label="Capacidad de carga"
        />
        {sheet.carrying.status !== 'normal' && (
          <p className="mt-2 text-xs text-[var(--warning-text)]">
            {sheet.carrying.status === 'exceeded'
              ? 'Superaste tu capacidad: no podés moverte con todo esto.'
              : `Sobrecargado: tu velocidad baja ${sheet.carrying.speedPenalty} pies.`}
          </p>
        )}
      </Card>

      <div className="scrollbar-slim -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all',
              filter === f.key
                ? 'border-transparent bg-crimson-gradient text-[var(--accent-on)]'
                : 'border-[var(--border-default)] text-[var(--text-secondary)]',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Backpack className="size-6" strokeWidth={1.8} />}
            title={filter === 'all' ? 'La mochila está vacía' : 'Nada en esta categoría'}
            description={
              filter === 'all'
                ? 'Agregá armas, armaduras y objetos. Calculamos el peso y los ataques por vos.'
                : 'Probá con otra categoría o agregá objetos nuevos.'
            }
            action={
              <Button variant="primary" onClick={() => setAdding(true)} leading={<Plus className="size-4" />}>
                Agregar objeto
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <InventoryRow item={item} sheet={sheet} onOpen={() => setSelected(item)} />
            </li>
          ))}
        </ul>
      )}

      {/*
        Las ranuras van DEBAJO de la mochila y no en su propia pantalla: la
        sintonización se decide mirando lo que llevás encima.
      */}
      <div className="mt-6">
        <AttunementSlots sheet={sheet} dispatch={dispatch} />
      </div>

      <AddItemSheet open={adding} onOpenChange={setAdding} sheet={sheet} dispatch={dispatch} />

      {selected && (
        <ItemDetailSheet
          item={selected}
          sheet={sheet}
          dispatch={dispatch}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function contentTypeOf(item: InventoryItemState, sheet: CharacterSheet): string {
  void sheet;
  const id = item.definitionId as string;
  if (id.includes(':weapon:')) return 'weapon';
  if (id.includes(':armor:')) return 'armor';
  if (id.includes(':magicItem:')) return 'other';
  return 'other';
}

function InventoryRow({
  item,
  sheet,
  onOpen,
}: {
  item: InventoryItemState;
  sheet: CharacterSheet;
  onOpen: () => void;
}) {
  const nombreDe = useDefinitionName(sheet.ruleset);
  const name = item.customName ?? nameOf(item, sheet, nombreDe);
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 text-left transition-[border-color,transform] hover:border-[var(--border-accent)] active:scale-[0.99]"
    >
      <TypeIcon type={(item.definitionId as string).split(':')[1] ?? 'gear'} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          {item.quantity > 1 && (
            <span className="text-numeric shrink-0 text-xs text-[var(--text-tertiary)]">×{item.quantity}</span>
          )}
          {item.favorite && <Star className="size-3 shrink-0 fill-[var(--legendary)] text-[var(--legendary)]" />}
        </span>
        <span className="block truncate text-xs text-[var(--text-tertiary)]">
          {item.equippedSlot ? 'Equipado' : 'En la mochila'}
        </span>
      </span>
      {item.attuned && <Chip tone="arcane">Sintonizado</Chip>}
    </button>
  );
}

/**
 * El nombre del ataque manda sobre el de la definición: si quien juega renombró
 * su espada, la mochila tiene que llamarla igual que la ficha.
 */
function nameOf(
  item: InventoryItemState,
  sheet: CharacterSheet,
  nombreDe: (id: string) => string,
): string {
  const attack = sheet.attacks.find((a) => a.itemId === (item.id as string));
  if (attack) return attack.name;
  return nombreDe(item.definitionId as string);
}

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

function ItemDetailSheet({
  item,
  sheet,
  dispatch,
  onClose,
}: {
  item: InventoryItemState;
  sheet: CharacterSheet;
  dispatch: DispatchFn;
  onClose: () => void;
}) {
  const nombreDe = useDefinitionName(sheet.ruleset);
  const name = item.customName ?? nameOf(item, sheet, nombreDe);
  const type = (item.definitionId as string).split(':')[1] ?? 'gear';
  const slots: EquipmentSlot[] =
    type === 'weapon'
      ? ['mainHand', 'offHand']
      : type === 'armor'
        ? ['armor', 'shield']
        : ['head', 'cloak', 'boots', 'gloves', 'belt', 'amulet', 'ring1', 'ring2'];

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={name} size="md">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Chip tone="neutral">Cantidad: {item.quantity}</Chip>
          {item.equippedSlot && <Chip tone="accent">{SLOT_LABELS[item.equippedSlot]}</Chip>}
          {item.attuned && <Chip tone="arcane">Sintonizado</Chip>}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {item.equippedSlot ? (
            <Button
              variant="secondary"
              onClick={() => {
                void dispatch({ type: 'UnequipItem', itemId: item.id });
                onClose();
              }}
            >
              Desequipar
            </Button>
          ) : (
            slots.slice(0, 2).map((slot) => (
              <Button
                key={slot}
                variant="secondary"
                onClick={() => {
                  void dispatch({ type: 'EquipItem', itemId: item.id, slot });
                  onClose();
                }}
              >
                {SLOT_LABELS[slot]}
              </Button>
            ))
          )}

          <Button
            variant="secondary"
            onClick={() => void dispatch({ type: 'ToggleItemFavorite', itemId: item.id })}
            leading={<Star className={cn('size-4', item.favorite && 'fill-current')} />}
          >
            {item.favorite ? 'Quitar de favoritos' : 'Favorito'}
          </Button>

          <Button
            variant="secondary"
            onClick={() => void dispatch({ type: 'ConsumeItem', itemId: item.id, amount: 1 })}
            disabled={item.quantity < 1}
          >
            Usar uno
          </Button>
        </div>

        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            void dispatch({ type: 'RemoveInventoryItem', itemId: item.id });
            onClose();
          }}
        >
          Eliminar del inventario
        </Button>
      </div>
    </Sheet>
  );
}

function AddItemSheet({
  open,
  onOpenChange,
  sheet,
  dispatch,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sheet: CharacterSheet;
  dispatch: DispatchFn;
}) {
  const [query, setQuery] = useState('');
  const results = useContentSearch(query, sheet.ruleset, ['weapon', 'armor', 'gear', 'magicItem']);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Agregar objeto" size="md">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar armas, armaduras, objetos…"
          autoFocus
          aria-label="Buscar objeto"
          className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-sunken)] pl-10 pr-3 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>

      <ul className="space-y-1.5">
        {(results ?? []).slice(0, 40).map((def) => (
          <li key={def.id}>
            <button
              onClick={() => {
                void dispatch({
                  type: 'AddInventoryItem',
                  definitionId: def.id as DefinitionId,
                  quantity: def.type === 'gear' && 'packSize' in def ? def.packSize : 1,
                });
                onOpenChange(false);
              }}
              className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2.5 text-left transition-colors hover:border-[var(--border-accent)]"
            >
              <TypeIcon type={def.type} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{def.name}</span>
                <span className="block truncate text-2xs text-[var(--text-tertiary)]">
                  {'weight' in def ? formatWeight(weightFromHundredths(def.weight)) : ''}
                </span>
              </span>
              <Plus className="size-4 shrink-0 text-[var(--accent-text)]" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export type { InventoryItemId };
