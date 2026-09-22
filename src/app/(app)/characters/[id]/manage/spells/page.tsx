'use client';

import { use, useState } from 'react';
import { Plus, Search, Sparkles, Star } from 'lucide-react';
import type { SpellDefinition } from '@domain/content/schemas';
import { formatModifier } from '@domain/character/ability';
import { magicSchoolEs } from '@domain/content/labels';
import { spellFieldEs } from '@domain/content/fields';
import { asCharacterId, type DefinitionId } from '@domain/shared/ids';
import { cn } from '@ui/design-system/cn';
import { Button } from '@ui/design-system/Button';
import { Card, EmptyState, LoadingState } from '@ui/design-system/primitives';
import { Sheet } from '@ui/design-system/Sheet';
import { CharacterHeader } from '@ui/components/CharacterHeader';
import { DefinitionDetail } from '@ui/features/library/DefinitionDetail';
import {
  useCharacter,
  useCharacterSheet,
  useContentIndex,
  useContentSearch,
  useDispatch,
  type DispatchFn,
} from '@ui/hooks/useAppData';

/**
 * HECHIZOS (MASTER SPEC §21)
 *
 * Conocidos · Preparados · Favoritos. Lanzar comprueba el recurso, descuenta
 * el espacio y deja "Deshacer" a mano.
 */
export default function SpellsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const character = useCharacter(asCharacterId(id));
  const sheet = useCharacterSheet(character);
  const dispatch = useDispatch(character);
  const content = useContentIndex(character?.ruleset ?? '2014');

  const [tab, setTab] = useState<'known' | 'prepared' | 'favorites'>('known');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<SpellDefinition | null>(null);

  if (!character || !sheet || !content) return <LoadingState label="Cargando hechizos…" />;

  const casting = sheet.spellcasting[0];

  if (!casting) {
    return (
      <div className="animate-fade-in">
        <CharacterHeader sheet={sheet} />
        <Card>
          <EmptyState
            icon={<Sparkles className="size-6" strokeWidth={1.8} />}
            title="Este personaje no lanza hechizos"
            description="Su clase no tiene magia. Si eso cambia al subir de nivel o al multiclasear, esta sección aparece sola."
          />
        </Card>
      </div>
    );
  }

  const entries = character.spells.known
    .map((s) => ({ state: s, def: content.spell(s.definitionId) }))
    .filter((e): e is { state: typeof e.state; def: SpellDefinition } => Boolean(e.def))
    .filter((e) => {
      if (tab === 'prepared') return e.state.prepared || e.state.alwaysPrepared;
      if (tab === 'favorites') return e.state.favorite;
      return true;
    })
    .sort((a, b) => a.def.level - b.def.level || a.def.name.localeCompare(b.def.name));

  return (
    <div className="animate-fade-in">
      <CharacterHeader sheet={sheet} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">Hechizos</h2>
        <Button variant="primary" size="sm" leading={<Plus className="size-4" />} onClick={() => setAdding(true)}>
          Aprender
        </Button>
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span>
            CD de salvación <span className="text-numeric font-semibold">{casting.saveDc.value}</span>
          </span>
          <span>
            Ataque mágico{' '}
            <span className="text-numeric font-semibold">
              {formatModifier(casting.spellAttackBonus.value)}
            </span>
          </span>
          {casting.preparedLimit != null && (
            <span className={cn(casting.preparedCount > casting.preparedLimit && 'text-[var(--warning-text)]')}>
              Preparados{' '}
              <span className="text-numeric font-semibold">
                {casting.preparedCount}/{casting.preparedLimit}
              </span>
            </span>
          )}
        </div>

        {/* Espacios de conjuro: el recurso que más se mira durante una partida */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {casting.slots
            .filter((s) => s.total > 0)
            .map((slot) => (
              <div
                key={slot.level}
                className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-2.5 py-1.5 text-center"
              >
                <p className="text-2xs text-[var(--text-tertiary)]">Nv {slot.level}</p>
                <p className="text-numeric text-sm font-semibold">
                  {slot.available}/{slot.total}
                </p>
              </div>
            ))}
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] p-1">
        {(
          [
            { key: 'known', label: 'Conocidos' },
            { key: 'prepared', label: 'Preparados' },
            { key: 'favorites', label: 'Favoritos' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={cn(
              'rounded-[var(--radius-sm)] py-2 text-xs font-medium transition-colors',
              tab === t.key
                ? 'bg-[var(--surface-interactive)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Sparkles className="size-6" strokeWidth={1.8} />}
            title={tab === 'known' ? 'Todavía no sabés hechizos' : 'Nada en esta lista'}
            description={
              tab === 'known'
                ? 'Agregá los hechizos de tu clase. Después podés prepararlos y lanzarlos desde el Modo Juego.'
                : 'Marcá hechizos como preparados o favoritos para verlos acá.'
            }
            action={
              <Button variant="primary" onClick={() => setAdding(true)}>
                Aprender hechizos
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {entries.map(({ state, def }) => (
            <li key={def.id}>
              <SpellRow
                def={def}
                prepared={state.prepared || state.alwaysPrepared}
                favorite={state.favorite}
                onOpen={() => setSelected(def)}
                onTogglePrepared={() =>
                  void dispatch({
                    type: 'PrepareSpell',
                    definitionId: def.id as DefinitionId,
                    prepared: !state.prepared,
                  })
                }
                onToggleFavorite={() =>
                  void dispatch({ type: 'ToggleSpellFavorite', definitionId: def.id as DefinitionId })
                }
              />
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <CastSheet
          spell={selected}
          slots={casting.slots}
          dispatch={dispatch}
          onClose={() => setSelected(null)}
        />
      )}

      <LearnSheet
        open={adding}
        onOpenChange={setAdding}
        ruleset={sheet.ruleset}
        classId={sheet.classes[0]?.classId}
        dispatch={dispatch}
      />
    </div>
  );
}

function SpellRow({
  def,
  prepared,
  favorite,
  onOpen,
  onTogglePrepared,
  onToggleFavorite,
}: {
  def: SpellDefinition;
  prepared: boolean;
  favorite: boolean;
  onOpen: () => void;
  onTogglePrepared: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[var(--radius-lg)] border p-3',
        prepared
          ? 'border-[var(--arcane-text)]/30 bg-[var(--arcane-muted)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface-raised)]',
      )}
    >
      <button
        onClick={onTogglePrepared}
        aria-pressed={prepared}
        aria-label={prepared ? 'Quitar de preparados' : 'Preparar'}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border',
          prepared
            ? 'border-[var(--arcane)] bg-[var(--arcane)] text-white'
            : 'border-[var(--border-default)] text-[var(--text-tertiary)]',
        )}
      >
        <Sparkles className="size-4" strokeWidth={2} />
      </button>

      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">{def.name}</span>
        <span className="block truncate text-xs text-[var(--text-tertiary)]">
          {def.level === 0 ? 'Truco' : `Nivel ${def.level}`} · {magicSchoolEs(def.school)}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-[var(--text-tertiary)]">
          <span className="truncate">{spellFieldEs(def.castingTime)}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{spellFieldEs(def.range)}</span>
          <SpellMarks def={def} />
        </span>
      </button>

      <button
        onClick={onToggleFavorite}
        aria-pressed={favorite}
        aria-label={favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
        className="shrink-0 p-1.5"
      >
        <Star
          className={cn(
            'size-4',
            favorite ? 'fill-[var(--legendary)] text-[var(--legendary)]' : 'text-[var(--text-tertiary)]',
          )}
        />
      </button>
    </div>
  );
}

function CastSheet({
  spell,
  slots,
  dispatch,
  onClose,
}: {
  spell: SpellDefinition;
  slots: readonly { level: number; total: number; used: number; available: number }[];
  dispatch: DispatchFn;
  onClose: () => void;
}) {
  const usable = slots.filter((s) => s.total > 0 && s.level >= spell.level);

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={spell.name} size="lg">
      <DefinitionDetail definition={spell} />

      <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
        <p className="mb-2.5 font-display text-sm">Lanzar</p>

        {spell.level === 0 ? (
          <Button
            variant="arcane"
            className="w-full"
            onClick={() => {
              void dispatch({ type: 'CastSpell', definitionId: spell.id as DefinitionId, slotLevel: 0 });
              onClose();
            }}
          >
            Lanzar truco (sin coste)
          </Button>
        ) : usable.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">
            No tenés espacios de nivel {spell.level} o superior. Descansá para recuperarlos.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {usable.map((slot) => (
              <button
                key={slot.level}
                disabled={slot.available <= 0}
                onClick={() => {
                  void dispatch({
                    type: 'CastSpell',
                    definitionId: spell.id as DefinitionId,
                    slotLevel: slot.level,
                  });
                  onClose();
                }}
                className={cn(
                  'rounded-[var(--radius-md)] border py-3 text-center transition-colors',
                  slot.available > 0
                    ? 'border-[var(--arcane-text)]/35 bg-[var(--arcane-muted)] hover:brightness-110'
                    : 'border-[var(--border-subtle)] opacity-35',
                )}
              >
                <p className="text-xs text-[var(--text-tertiary)]">Nivel {slot.level}</p>
                <p className="text-numeric text-sm font-semibold">
                  {slot.available}/{slot.total}
                </p>
              </button>
            ))}
          </div>
        )}

        {spell.level > 0 && usable.length > 1 && (
          <p className="mt-2.5 text-xs text-[var(--text-tertiary)]">
            Lanzarlo con un espacio de nivel superior suele hacerlo más potente. Mirá &quot;A niveles
            superiores&quot; arriba.
          </p>
        )}
      </div>
    </Sheet>
  );
}

function LearnSheet({
  open,
  onOpenChange,
  ruleset,
  classId,
  dispatch,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ruleset: '2014' | '2024';
  classId?: DefinitionId;
  dispatch: DispatchFn;
}) {
  const [query, setQuery] = useState('');
  const results = useContentSearch(query, ruleset, ['spell']);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Aprender hechizos" size="md">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar hechizos…"
          autoFocus
          aria-label="Buscar hechizo"
          className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-sunken)] pl-10 pr-3 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>

      <ul className="space-y-1.5">
        {((results ?? []) as SpellDefinition[]).slice(0, 40).map((def) => (
          <li key={def.id}>
            <button
              onClick={() => {
                void dispatch({
                  type: 'LearnSpell',
                  definitionId: def.id as DefinitionId,
                  ...(classId ? { sourceClassId: classId } : {}),
                });
                onOpenChange(false);
              }}
              className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2.5 text-left transition-colors hover:border-[var(--border-accent)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{def.name}</span>
                <span className="block truncate text-2xs text-[var(--text-tertiary)]">
                  {def.level === 0 ? 'Truco' : `Nivel ${def.level}`} · {magicSchoolEs(def.school)}
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

/** Las marcas C · R · M de la tabla de conjuros de la hoja oficial. */
function SpellMarks({ def }: { def: SpellDefinition }) {
  const marcas: { letra: string; titulo: string }[] = [
    ...(def.concentration ? [{ letra: 'C', titulo: 'Concentración' }] : []),
    ...(def.ritual ? [{ letra: 'R', titulo: 'Ritual' }] : []),
    ...(def.material ? [{ letra: 'M', titulo: `Material: ${def.material}` }] : []),
  ];
  if (marcas.length === 0) return null;

  return (
    <span className="flex gap-1">
      {marcas.map((m) => (
        <abbr
          key={m.letra}
          title={m.titulo}
          className="grid size-4 place-items-center rounded-[3px] border border-[var(--border-default)] text-[9px] font-semibold no-underline"
        >
          {m.letra}
        </abbr>
      ))}
    </span>
  );
}
