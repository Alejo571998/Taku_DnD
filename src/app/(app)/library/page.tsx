'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import type { AnyDefinition } from '@domain/content/schemas';
import { RULESETS, type Ruleset } from '@domain/rules/ruleset';
import {
  armorCategoryEs,
  creatureTypeEs,
  damageTypeEs,
  magicSchoolEs,
  rarityEs,
  sizeEs,
  weaponCategoryEs,
} from '@domain/content/labels';
import { cn } from '@ui/design-system/cn';
import { Card, Chip, EmptyState, LoadingState, Skeleton } from '@ui/design-system/primitives';
import { Sheet } from '@ui/design-system/Sheet';
import { useContentSearch } from '@ui/hooks/useAppData';
import { DefinitionDetail, TypeIcon, TYPE_LABEL } from '@ui/features/library/DefinitionDetail';
import { TIPS } from '@ui/features/taku/lines';
import { useTakuCue } from '@ui/features/taku/TakuProvider';

/**
 * BIBLIOTECA (MASTER SPEC §7)
 *
 * Principio: BUSCAR ANTES QUE NAVEGAR. El campo de búsqueda va primero y
 * enfocado; las categorías son un atajo, no el camino principal.
 */

const FILTERS: { key: string; label: string; types: string[] }[] = [
  { key: 'all', label: 'Todo', types: [] },
  { key: 'spell', label: 'Hechizos', types: ['spell'] },
  { key: 'class', label: 'Clases', types: ['class', 'subclass'] },
  { key: 'species', label: 'Especies', types: ['species', 'subspecies'] },
  { key: 'item', label: 'Objetos', types: ['weapon', 'armor', 'gear', 'magicItem'] },
  { key: 'monster', label: 'Monstruos', types: ['monster'] },
  { key: 'rule', label: 'Reglas', types: ['rule', 'condition'] },
  { key: 'feat', label: 'Dotes', types: ['feat', 'background'] },
];

function LibraryContent() {
  // Los atajos de la barra lateral llegan como ?type=spell|rule y deben
  // preseleccionar el filtro: si no, el enlace no hace nada visible.
  const initialFilter = useSearchParams().get('type') ?? 'all';

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(initialFilter);
  const [ruleset, setRuleset] = useState<Ruleset>('2014');
  const [selected, setSelected] = useState<AnyDefinition | null>(null);

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]!;
  const results = useContentSearch(query, ruleset, active.types);

  // Que se pueda buscar en los dos idiomas no se adivina mirando la pantalla.
  useTakuCue(true, TIPS.librarySearch);

  return (
    <div className="space-y-4 animate-fade-in">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Biblioteca</h1>
        <RulesetToggle value={ruleset} onChange={setRuleset} />
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          // type="search" añade su propio botón de limpiar: dos cruces juntas
          // confunden. Usamos uno solo, el nuestro.
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar hechizos, objetos, reglas, criaturas…"
          aria-label="Buscar en la biblioteca"
          className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--surface-interactive)]"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="scrollbar-slim -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all',
              filter === f.key
                ? 'border-transparent bg-crimson-gradient text-[var(--accent-on)] shadow-[var(--shadow-crimson)]'
                : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/*
        CUÁNTOS RESULTADOS HAY, DICHO EN VOZ ALTA

        El contador de abajo es un párrafo normal: quien ve la pantalla lo lee
        y ya está. Quien no la ve escribía «fuego» en el buscador y no se
        enteraba de nada —ni de cuántos resultados había, ni de que no había
        ninguno—, porque el número cambiaba en silencio.

        Va aparte y `sr-only` en vez de convertir el párrafo visible en región
        viva, porque el caso de cero resultados se pinta en otra rama y así
        quedaba fuera. La búsqueda está amortiguada 140 ms, así que esto habla
        una vez por búsqueda terminada y no una vez por tecla.
      */}
      <p className="sr-only" role="status" aria-live="polite">
        {results === undefined
          ? ''
          : results.length === 0
            ? query
              ? `Sin resultados para ${query}`
              : ''
            : `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}`}
      </p>

      {results === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="size-6" strokeWidth={1.8} />}
            title={query ? 'Sin resultados' : 'Empezá a buscar'}
            description={
              query
                ? `No encontramos nada para "${query}" en las reglas ${ruleset}. Probá con otro término o cambiá de edición.`
                : 'Buscá cualquier hechizo, objeto, regla o criatura. Todo funciona sin conexión.'
            }
          />
        </Card>
      ) : (
        <>
          {/* `aria-hidden`: lo mismo ya lo dice la región viva de arriba. */}
          <p aria-hidden className="text-xs text-[var(--text-tertiary)]">
            {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
          </p>
          <ul className="space-y-2">
            {results.map((def) => (
              <li key={def.id}>
                <button
                  onClick={() => setSelected(def)}
                  className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 text-left transition-[border-color,transform] hover:border-[var(--border-accent)] active:scale-[0.99]"
                >
                  <TypeIcon type={def.type} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{def.name}</span>
                    <span className="block truncate text-xs text-[var(--text-tertiary)]">
                      {describeDefinition(def)}
                    </span>
                  </span>
                  <Chip tone="neutral" className="shrink-0">
                    {TYPE_LABEL[def.type] ?? def.type}
                  </Chip>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet
        open={selected !== null}
        onOpenChange={(v) => !v && setSelected(null)}
        title={selected?.name ?? ''}
        size="lg"
      >
        {selected && <DefinitionDetail definition={selected} />}
      </Sheet>
    </div>
  );
}

/**
 * `useSearchParams` obliga a un límite de Suspense para que la página siga
 * prerenderizándose como estática en vez de pasar a dinámica.
 */
export default function LibraryPage() {
  return (
    <Suspense fallback={<LoadingState label="Abriendo la biblioteca…" />}>
      <LibraryContent />
    </Suspense>
  );
}

function RulesetToggle({ value, onChange }: { value: Ruleset; onChange: (r: Ruleset) => void }) {
  return (
    <div
      role="group"
      aria-label="Edición de reglas"
      className="flex gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-1"
    >
      {RULESETS.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          aria-pressed={value === r}
          className={cn(
            'rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors',
            value === r
              ? 'bg-[var(--surface-interactive)] text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)]',
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function describeDefinition(def: AnyDefinition): string {
  switch (def.type) {
    case 'spell':
      return `${def.level === 0 ? 'Truco' : `Nivel ${def.level}`} · ${magicSchoolEs(def.school)}${def.concentration ? ' · Concentración' : ''}`;
    case 'weapon':
      return `${weaponCategoryEs(def.category)} · ${def.damage?.dice ?? ''} ${damageTypeEs(def.damage?.damageType)}`;
    case 'armor':
      return `${armorCategoryEs(def.category)} · CA ${def.baseAc}${def.addsDexBonus ? ' + DES' : ''}`;
    case 'magicItem':
      return `${rarityEs(def.rarity)}${def.requiresAttunement ? ' · Requiere sintonización' : ''}`;
    case 'monster':
      return `${sizeEs(def.size)} ${creatureTypeEs(def.creatureType)} · VD ${def.challengeRating}`;
    case 'class':
      return `Dado de golpe d${def.hitDie}`;
    case 'species':
      return `${sizeEs(def.size)} · ${def.speed} pies`;
    default:
      return plainPreview(def.description[0]);
  }
}

/**
 * Primeras palabras legibles de una descripción en Markdown.
 *
 * Cortar `description[0]` en crudo hacía que la regla de Trampas se anunciara
 * en la lista como «## Traps Traps can be found…»: el encabezado repetido y la
 * almohadilla a la vista. En la ficha lo pinta `SrdText`; acá, donde solo caben
 * noventa caracteres, lo que hace falta es quitar las marcas.
 */
function plainPreview(paragraph: string | undefined): string {
  if (!paragraph) return '';
  const text = paragraph
    .split('\n')
    // Encabezados y filas de tabla no dicen nada en una línea de lista.
    .filter((line) => !/^\s*#{1,6}\s/.test(line) && !/^\s*\|/.test(line))
    .join(' ')
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 90);
}
