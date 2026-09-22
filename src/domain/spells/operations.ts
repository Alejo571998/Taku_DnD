import { errCode, ok, type Result } from '../shared/result';
import type { DefinitionId } from '../shared/ids';
import type { ContentIndex } from '../content';
import type { SpellcastingBlock } from '../character/sheet';
import type { CharacterSpellState, SpellbookState } from '../character/state';

/**
 * CONJUROS (MASTER SPEC §21)
 *
 * Separacion obligatoria: `SpellDefinition` (contenido, inmutable) vs.
 * `CharacterSpellState` (relacion del personaje con ese conjuro). Aprender un
 * conjuro JAMAS modifica su definicion.
 */

export const knows = (book: SpellbookState, id: DefinitionId): boolean =>
  book.known.some((s) => s.definitionId === id);

export const isPrepared = (book: SpellbookState, id: DefinitionId): boolean =>
  book.known.some((s) => s.definitionId === id && (s.prepared || s.alwaysPrepared));

export function learnSpell(
  book: SpellbookState,
  definitionId: DefinitionId,
  options: { sourceClassId?: DefinitionId; alwaysPrepared?: boolean } = {},
): SpellbookState {
  if (knows(book, definitionId)) return book;
  const entry: CharacterSpellState = {
    definitionId,
    prepared: options.alwaysPrepared ?? false,
    favorite: false,
    alwaysPrepared: options.alwaysPrepared ?? false,
    ...(options.sourceClassId ? { sourceClassId: options.sourceClassId } : {}),
  };
  return { ...book, known: [...book.known, entry] };
}

export function forgetSpell(book: SpellbookState, definitionId: DefinitionId): SpellbookState {
  return { ...book, known: book.known.filter((s) => s.definitionId !== definitionId) };
}

/** Preparar respeta el limite de la clase: pasarse se bloquea con explicacion. */
export function prepareSpell(
  book: SpellbookState,
  definitionId: DefinitionId,
  prepared: boolean,
  limit: number | null,
): Result<SpellbookState> {
  const entry = book.known.find((s) => s.definitionId === definitionId);
  if (!entry) return errCode('content.notFound', { id: definitionId as string });
  if (entry.alwaysPrepared) return ok(book);

  if (prepared && limit != null) {
    const count = book.known.filter((s) => s.prepared && !s.alwaysPrepared).length;
    if (count >= limit) {
      return errCode('validation.failed', { limit, count }, 'limite de conjuros preparados alcanzado');
    }
  }

  return ok({
    ...book,
    known: book.known.map((s) => (s.definitionId === definitionId ? { ...s, prepared } : s)),
  });
}

export function toggleSpellFavorite(book: SpellbookState, definitionId: DefinitionId): SpellbookState {
  return {
    ...book,
    known: book.known.map((s) => (s.definitionId === definitionId ? { ...s, favorite: !s.favorite } : s)),
  };
}

// ── Lanzamiento ─────────────────────────────────────────────

export type CastOutcome = {
  readonly spells: SpellbookState;
  readonly slotLevel: number;
  readonly slotsRemaining: number;
  readonly consumedSlot: boolean;
  /** Concentracion que se rompio al lanzar este conjuro. */
  readonly brokeConcentration?: DefinitionId;
};

/**
 * Lanza un conjuro gastando un espacio del nivel indicado.
 *
 * Los trucos (nivel 0) no gastan espacio. Lanzar a nivel superior es legitimo
 * y esperado: el nivel del espacio lo elige quien lanza.
 */
export function castSpell(
  book: SpellbookState,
  content: ContentIndex,
  definitionId: DefinitionId,
  slotLevel: number,
  available: readonly SpellcastingBlock['slots'][number][],
): Result<CastOutcome> {
  const def = content.spell(definitionId);
  if (!def) return errCode('content.notFound', { id: definitionId as string });

  if (slotLevel < def.level) {
    return errCode('validation.failed', { spellLevel: def.level, slotLevel }, 'espacio de nivel insuficiente');
  }

  // Truco: sin coste de recurso.
  if (def.level === 0) {
    return ok({
      spells: applyConcentration(book, def.concentration ? definitionId : undefined),
      slotLevel: 0,
      slotsRemaining: 0,
      consumedSlot: false,
      ...(def.concentration && book.concentratingOn && book.concentratingOn !== definitionId
        ? { brokeConcentration: book.concentratingOn }
        : {}),
    });
  }

  const slot = available.find((s) => s.level === slotLevel);
  if (!slot || slot.available <= 0) {
    return errCode('spellSlot.insufficient', { level: slotLevel });
  }

  const slotsUsed = [...book.slotsUsed];
  slotsUsed[slotLevel - 1] = (slotsUsed[slotLevel - 1] ?? 0) + 1;

  const broke =
    def.concentration && book.concentratingOn && book.concentratingOn !== definitionId
      ? book.concentratingOn
      : undefined;

  return ok({
    spells: applyConcentration({ ...book, slotsUsed }, def.concentration ? definitionId : undefined),
    slotLevel,
    slotsRemaining: slot.available - 1,
    consumedSlot: true,
    ...(broke ? { brokeConcentration: broke } : {}),
  });
}

/**
 * Concentracion: solo un conjuro a la vez (MASTER SPEC §21).
 * Lanzar otro de concentracion rompe el anterior, y el sistema lo dice.
 */
function applyConcentration(book: SpellbookState, newConcentration?: DefinitionId): SpellbookState {
  if (newConcentration) return { ...book, concentratingOn: newConcentration };
  return book;
}

export function breakConcentration(book: SpellbookState): SpellbookState {
  const { concentratingOn: _unused, ...rest } = book;
  return rest;
}

/** Devuelve un espacio gastado. Es el `Deshacer` de lanzar un conjuro. */
export function restoreSlot(book: SpellbookState, slotLevel: number): SpellbookState {
  const slotsUsed = [...book.slotsUsed];
  const i = slotLevel - 1;
  slotsUsed[i] = Math.max(0, (slotsUsed[i] ?? 0) - 1);
  return { ...book, slotsUsed };
}

export const allSlotsRestored = (book: SpellbookState): SpellbookState => ({
  ...book,
  slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  pactSlotsUsed: 0,
});
