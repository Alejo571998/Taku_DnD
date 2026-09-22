import { errCode, ok, type Result } from '../shared/result';
import type { DefinitionId, InventoryItemId } from '../shared/ids';
import { newInventoryItemId } from '../shared/ids';
import type { ContentIndex } from '../content';
import type { WeaponDefinition } from '../content/schemas';
import type { EquipmentSlot, InventoryItemState } from '../character/state';

/**
 * OPERACIONES DE INVENTARIO
 *
 * Funciones puras sobre la lista de objetos. Devuelven Result: quedarse sin
 * municion o intentar equipar dos objetos en el mismo slot no es excepcional,
 * es parte del juego, y el usuario merece una explicacion — no un stack trace.
 */

export type Inventory = readonly InventoryItemState[];

export const findItem = (inv: Inventory, id: InventoryItemId): InventoryItemState | undefined =>
  inv.find((i) => i.id === id);

export const findByDefinition = (inv: Inventory, definitionId: DefinitionId): InventoryItemState | undefined =>
  inv.find((i) => i.definitionId === definitionId);

/** Objetos apilables se acumulan; el resto entra como instancia nueva. */
export function addItem(
  inv: Inventory,
  definitionId: DefinitionId,
  quantity = 1,
  content?: ContentIndex,
): Inventory {
  const def = content?.get(definitionId);
  const stackable = !def || def.type === 'gear';

  if (stackable) {
    const existing = inv.find((i) => i.definitionId === definitionId && !i.customName && !i.equippedSlot);
    if (existing) {
      return inv.map((i) => (i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i));
    }
  }

  return [
    ...inv,
    {
      id: newInventoryItemId(),
      definitionId,
      quantity,
      attuned: false,
      favorite: false,
    },
  ];
}

export function removeItem(inv: Inventory, id: InventoryItemId, quantity?: number): Result<Inventory> {
  const item = findItem(inv, id);
  if (!item) return errCode('item.notFound', { id: id as string });

  const toRemove = quantity ?? item.quantity;
  if (toRemove > item.quantity) {
    return errCode('item.insufficientQuantity', { have: item.quantity, need: toRemove, item: item.customName ?? '' });
  }

  if (toRemove === item.quantity) return ok(inv.filter((i) => i.id !== id));
  return ok(inv.map((i) => (i.id === id ? { ...i, quantity: i.quantity - toRemove } : i)));
}

// ── Municion (MASTER SPEC §16, CASOS 4 y 5) ──────────────────────────────────

export type AmmunitionOutcome = {
  readonly inventory: Inventory;
  readonly remaining: number;
  readonly consumed: number;
};

/**
 * Consume municion. Devuelve error si no hay: la UI decide entonces entre
 * cancelar, continuar sin descontar, o abrir el inventario (MASTER PROMPT §25).
 */
export function consumeAmmunition(
  inv: Inventory,
  ammunitionType: DefinitionId,
  amount = 1,
): Result<AmmunitionOutcome> {
  const item = findByDefinition(inv, ammunitionType);
  if (!item || item.quantity < amount) {
    return errCode('ammunition.depleted', {
      have: item?.quantity ?? 0,
      need: amount,
    });
  }

  const next = item.quantity - amount;
  const inventory =
    next === 0
      ? inv.filter((i) => i.id !== item.id)
      : inv.map((i) => (i.id === item.id ? { ...i, quantity: next } : i));

  return ok({ inventory, remaining: next, consumed: amount });
}

/** Recuperar flechas del campo de batalla tras el combate. */
export function recoverAmmunition(
  inv: Inventory,
  ammunitionType: DefinitionId,
  amount: number,
  content?: ContentIndex,
): Inventory {
  return addItem(inv, ammunitionType, amount, content);
}

// ── Consumibles (MASTER SPEC §17) ────────────────────────────────────────────

export function consumeItem(inv: Inventory, id: InventoryItemId, amount = 1): Result<Inventory> {
  const item = findItem(inv, id);
  if (!item) return errCode('item.notFound', { id: id as string });
  if (item.quantity < amount) {
    return errCode('item.insufficientQuantity', { have: item.quantity, need: amount });
  }
  return removeItem(inv, id, amount);
}

/** Gasta cargas de un objeto magico. Las cargas SON un recurso. */
export function spendCharges(
  inv: Inventory,
  id: InventoryItemId,
  amount: number,
  maximum: number,
): Result<Inventory> {
  const item = findItem(inv, id);
  if (!item) return errCode('item.notFound', { id: id as string });

  const current = item.charges ?? maximum;
  if (current < amount) {
    return errCode('resource.insufficient', { have: current, need: amount });
  }
  return ok(inv.map((i) => (i.id === id ? { ...i, charges: current - amount } : i)));
}

// ── Equipamiento (MASTER SPEC §15) ───────────────────────────────────────────

const SLOT_ACCEPTS: Record<EquipmentSlot, readonly string[]> = {
  mainHand: ['weapon'],
  offHand: ['weapon', 'armor'],
  twoHand: ['weapon'],
  armor: ['armor'],
  shield: ['armor'],
  head: ['magicItem', 'gear'],
  cloak: ['magicItem', 'gear'],
  boots: ['magicItem', 'gear'],
  gloves: ['magicItem', 'gear'],
  belt: ['magicItem', 'gear'],
  amulet: ['magicItem', 'gear'],
  ring1: ['magicItem'],
  ring2: ['magicItem'],
};

export const MAX_ATTUNEMENT = 3;

export type EquipOutcome = {
  readonly inventory: Inventory;
  /** Objeto que salio del slot, si hubo intercambio. */
  readonly displaced?: InventoryItemState;
};

/**
 * Equipar. Transaccional: o deja el inventario coherente, o falla con un
 * motivo. NUNCA sobrescribe en silencio (MASTER SPEC §15).
 *
 * Lo que 5e PROHIBE se bloquea; lo que 5e PENALIZA se permite y se advierte
 * en la ficha (falta de competencia, exceso de carga).
 */
export function equipItem(
  inv: Inventory,
  id: InventoryItemId,
  slot: EquipmentSlot,
  content: ContentIndex,
): Result<EquipOutcome> {
  const item = findItem(inv, id);
  if (!item) return errCode('item.notFound', { id: id as string });

  const def = content.get(item.definitionId);
  if (!def) return errCode('content.notFound', { id: item.definitionId as string });

  const accepted = SLOT_ACCEPTS[slot];
  if (!accepted.includes(def.type)) {
    return errCode('slot.incompatible', { slot, itemType: def.type, item: def.name });
  }

  if (slot === 'shield' && !(def.type === 'armor' && def.category === 'shield')) {
    return errCode('slot.incompatible', { slot, item: def.name });
  }
  if (slot === 'armor' && def.type === 'armor' && def.category === 'shield') {
    return errCode('slot.incompatible', { slot, item: def.name });
  }

  // Conflicto de dos manos: no se puede llevar un arma a dos manos y algo mas.
  const twoHanded = def.type === 'weapon' && (def as WeaponDefinition).properties.includes('two-handed');
  const occupiedHands = inv.filter(
    (i) => i.id !== id && (i.equippedSlot === 'mainHand' || i.equippedSlot === 'offHand' || i.equippedSlot === 'twoHand'),
  );

  if ((twoHanded || slot === 'twoHand') && occupiedHands.length > 0) {
    return errCode('slot.twoHandedConflict', {
      item: def.name,
      blocking: occupiedHands.length,
    });
  }
  if ((slot === 'mainHand' || slot === 'offHand') && occupiedHands.some((i) => i.equippedSlot === 'twoHand')) {
    return errCode('slot.twoHandedConflict', { item: def.name });
  }

  // Intercambio explicito: el objeto anterior vuelve a la mochila.
  const displaced = inv.find((i) => i.equippedSlot === slot && i.id !== id);

  const targetSlot = twoHanded && slot === 'mainHand' ? 'twoHand' : slot;

  const inventory = inv.map((i) => {
    if (i.id === id) return { ...i, equippedSlot: targetSlot };
    if (displaced && i.id === displaced.id) {
      const { equippedSlot: _unused, ...rest } = i;
      return rest;
    }
    return i;
  });

  return ok({ inventory, ...(displaced ? { displaced } : {}) });
}

export function unequipItem(inv: Inventory, id: InventoryItemId): Result<Inventory> {
  const item = findItem(inv, id);
  if (!item) return errCode('item.notFound', { id: id as string });
  return ok(
    inv.map((i) => {
      if (i.id !== id) return i;
      const { equippedSlot: _unused, ...rest } = i;
      return rest;
    }),
  );
}

/** Sintonizacion: maximo 3 objetos (regla dura de 5e, se bloquea). */
export function attuneItem(inv: Inventory, id: InventoryItemId, content: ContentIndex): Result<Inventory> {
  const item = findItem(inv, id);
  if (!item) return errCode('item.notFound', { id: id as string });

  const def = content.magicItem(item.definitionId);
  if (!def?.requiresAttunement) {
    return errCode('attunement.notAttunable', { item: def?.name ?? '' });
  }

  const attunedCount = inv.filter((i) => i.attuned && i.id !== id).length;
  if (attunedCount >= MAX_ATTUNEMENT) {
    return errCode('attunement.limitReached', { max: MAX_ATTUNEMENT });
  }

  return ok(inv.map((i) => (i.id === id ? { ...i, attuned: true } : i)));
}

export function unattuneItem(inv: Inventory, id: InventoryItemId): Inventory {
  return inv.map((i) => (i.id === id ? { ...i, attuned: false } : i));
}

export function toggleFavorite(inv: Inventory, id: InventoryItemId): Inventory {
  return inv.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i));
}

export function renameItem(inv: Inventory, id: InventoryItemId, customName: string): Inventory {
  return inv.map((i) => (i.id === id ? { ...i, customName: customName.trim() || undefined } : i));
}

export function moveToContainer(
  inv: Inventory,
  id: InventoryItemId,
  containerId: InventoryItemId | undefined,
): Inventory {
  return inv.map((i) => {
    if (i.id !== id) return i;
    if (!containerId) {
      const { containerId: _unused, ...rest } = i;
      return rest;
    }
    return { ...i, containerId };
  });
}
