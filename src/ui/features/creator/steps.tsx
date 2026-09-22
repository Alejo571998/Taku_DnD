'use client';

import { useState } from 'react';
import { Check, Info, Shuffle } from 'lucide-react';
import {
  ABILITIES,
  ABILITY_ABBR_ES,
  abilityModifier,
  formatModifier,
  POINT_BUY_BUDGET,
  pointBuyCost,
  pointBuyRemaining,
  STANDARD_ARRAY,
  type AbilityId,
  type AbilityScores,
} from '@domain/character/ability';
import { resolveCharacter } from '@domain/character/engine';
import { SKILL_NAME_ES, skillFromSrdIndex, type SkillId } from '@domain/character/skill';
import type { ContentIndex } from '@domain/content';
import { rollExpression } from '@domain/dice/roller';
import { parseDiceExpression } from '@domain/dice/expression';
import type { RulesEngine } from '@domain/rules/engine';
import { RULESETS, type Ruleset } from '@domain/rules/ruleset';
import { isErr } from '@domain/shared/result';
import { asWorkspaceId, type DefinitionId } from '@domain/shared/ids';
import { createCharacter, type CharacterDraft } from '@application/services/character-factory';
import { cn } from '@ui/design-system/cn';
import { Card, Chip } from '@ui/design-system/primitives';

/**
 * PASOS DEL CREADOR.
 *
 * Modo principiante (MASTER SPEC §50): cada opción compleja explica QUÉ es y
 * POR QUÉ podría interesar. Sin esa explicación, alguien que nunca jugó no
 * puede decidir — y la aplicación existe justamente para esa persona.
 */

type StepProps = {
  draft: CharacterDraft;
  update: (patch: Partial<CharacterDraft>) => void;
  content: ContentIndex;
};

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3.5 py-3">
      <Info className="mt-0.5 size-4 shrink-0 text-[var(--accent-text)]" strokeWidth={2} />
      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{children}</p>
    </div>
  );
}

/** Tarjeta de elección (MASTER SPEC §41). Explica, no solo etiqueta. */
function ChoiceCard({
  selected,
  title,
  subtitle,
  description,
  onClick,
  badge,
}: {
  selected: boolean;
  title: string;
  subtitle?: string;
  description?: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'w-full rounded-[var(--radius-lg)] border p-4 text-left transition-all duration-150',
        selected
          ? 'border-[var(--border-accent)] bg-[var(--accent-muted)] shadow-[var(--shadow-crimson)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-strong)]',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-display text-base font-semibold">{title}</p>
            {badge && <Chip tone="neutral">{badge}</Chip>}
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--accent-text)]">{subtitle}</p>}
          {description && (
            <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
              {description}
            </p>
          )}
        </div>
        <span
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2',
            selected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-strong)]',
          )}
          aria-hidden="true"
        >
          {selected && <Check className="size-3 text-[var(--accent-on)]" strokeWidth={3} />}
        </span>
      </div>
    </button>
  );
}

// ── 1 · Reglas ───────────────────────────────────────────────────────────────

export function RulesStep({
  draft,
  update,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
}) {
  const options: Record<Ruleset, { title: string; description: string }> = {
    '2014': {
      title: 'D&D 5e (2014)',
      description: 'La edición clásica. Es la que usa la mayoría de las mesas y la que encontrás en más manuales.',
    },
    '2024': {
      title: 'D&D (2024)',
      description: 'La revisión más reciente. Especies y trasfondos funcionan distinto, y las armas tienen maestrías.',
    },
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">
        Elegí la edición de reglas de tu personaje. Determina qué contenido podés usar.
      </p>

      {RULESETS.map((r) => (
        <ChoiceCard
          key={r}
          selected={draft.ruleset === r}
          title={options[r].title}
          description={options[r].description}
          onClick={() => update({ ruleset: r, classId: undefined, speciesId: undefined, backgroundId: undefined })}
        />
      ))}

      <Hint>
        Las dos ediciones conviven en la aplicación, pero un personaje usa una sola. Nunca mezclamos
        contenido de ediciones distintas sin avisarte.
      </Hint>
    </div>
  );
}

// ── 2 · Concepto ─────────────────────────────────────────────────────────────

export function ConceptStep({
  draft,
  update,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="char-name" className="mb-1.5 block text-sm font-medium">
          Nombre del personaje
        </label>
        <input
          id="char-name"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Aragorn, Thalia, Boruk…"
          autoFocus
          className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-4 outline-none transition-colors focus:border-[var(--accent)]"
        />
      </div>

      <div>
        <label htmlFor="player-name" className="mb-1.5 block text-sm font-medium">
          Tu nombre <span className="font-normal text-[var(--text-tertiary)]">(opcional)</span>
        </label>
        <input
          id="player-name"
          value={draft.playerName ?? ''}
          onChange={(e) => update({ playerName: e.target.value })}
          placeholder="Quién lo juega"
          className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-4 outline-none transition-colors focus:border-[var(--accent)]"
        />
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium">Nivel inicial</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              onClick={() => update({ level })}
              aria-pressed={draft.level === level}
              className={cn(
                'size-11 rounded-[var(--radius-md)] border text-sm font-semibold transition-all',
                draft.level === level
                  ? 'border-transparent bg-crimson-gradient text-[var(--accent-on)]'
                  : 'border-[var(--border-default)] text-[var(--text-secondary)]',
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <Hint>
        Si es tu primera partida, empezá en nivel 1: vas a aprender las reglas de a poco, a medida que
        tu personaje crece.
      </Hint>
    </div>
  );
}

// ── 3 · Especie ──────────────────────────────────────────────────────────────

export function SpeciesStep({ draft, update, content }: StepProps) {
  const species = content.speciesList();
  const subspecies = draft.speciesId ? content.subspeciesOf(draft.speciesId) : [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">
        Tu especie define rasgos innatos: velocidad, visión, resistencias e idiomas.
      </p>

      {species.map((s) => (
        <ChoiceCard
          key={s.id}
          selected={draft.speciesId === s.id}
          title={s.name}
          subtitle={
            s.abilityBonuses.length > 0
              ? s.abilityBonuses.map((b) => `${ABILITY_ABBR_ES[b.ability]} +${b.bonus}`).join(' · ')
              : `${s.speed} pies · ${s.size}`
          }
          description={s.description[0]}
          onClick={() => update({ speciesId: s.id as DefinitionId, subspeciesId: undefined })}
        />
      ))}

      {subspecies.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="font-display text-sm">Elegí un linaje</p>
          {subspecies.map((s) => (
            <ChoiceCard
              key={s.id}
              selected={draft.subspeciesId === s.id}
              title={s.name}
              subtitle={s.abilityBonuses.map((b) => `${ABILITY_ABBR_ES[b.ability]} +${b.bonus}`).join(' · ')}
              description={s.description[0]}
              onClick={() => update({ subspeciesId: s.id as DefinitionId })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 4 · Clase ────────────────────────────────────────────────────────────────

const CLASS_HINTS: Record<string, string> = {
  fighter: 'Sencilla y resistente. La mejor opción si es tu primera vez.',
  barbarian: 'Aguanta muchísimo daño y pega fuerte. Fácil de jugar.',
  rogue: 'Ágil y astuto. Mucho daño de un golpe si atacás con ventaja.',
  wizard: 'El arsenal mágico más amplio, pero frágil. Pide leer bastante.',
  cleric: 'Cura, protege y también pelea. Muy útil en cualquier grupo.',
  ranger: 'Combate a distancia y exploración. Equilibrado.',
  paladin: 'Guerrero sagrado: aguanta, pega y cura un poco.',
  bard: 'Apoya al grupo, habla con todos y tiene magia versátil.',
  druid: 'Se transforma en animales y controla la naturaleza.',
  monk: 'Rápido y móvil, pelea sin armas ni armadura.',
  sorcerer: 'Magia innata y potente, con menos hechizos para elegir.',
  warlock: 'Pocos hechizos pero muy fuertes, y se recargan rápido.',
};

export function ClassStep({ draft, update, content }: StepProps) {
  const classes = content.classes();

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">
        La clase define cómo pelea tu personaje, qué sabe hacer y si usa magia.
      </p>

      {classes.map((c) => {
        const slug = (c.id as string).split(':').pop() ?? '';
        return (
          <ChoiceCard
            key={c.id}
            selected={draft.classId === c.id}
            title={c.name}
            subtitle={`Dado de golpe d${c.hitDie}${c.spellcasting ? ` · Magia por ${ABILITY_ABBR_ES[c.spellcasting.ability]}` : ''}`}
            description={CLASS_HINTS[slug]}
            badge={slug === 'fighter' ? 'Recomendada' : undefined}
            onClick={() => update({ classId: c.id as DefinitionId, subclassId: undefined })}
          />
        );
      })}
    </div>
  );
}

export function SubclassStep({ draft, update, content }: StepProps) {
  const subclasses = draft.classId ? content.subclassesOf(draft.classId) : [];
  const cls = content.class(draft.classId);

  if (subclasses.length === 0) {
    return (
      <Hint>
        El SRD solo incluye una subclase por clase. Podés crear más desde Homebrew o importarlas si
        tenés derecho a usarlas.
      </Hint>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">
        A nivel {cls?.subclassLevel ?? 3}, {cls?.name} elige una especialización.
      </p>
      {subclasses.map((s) => (
        <ChoiceCard
          key={s.id}
          selected={draft.subclassId === s.id}
          title={s.name}
          subtitle={s.flavor}
          description={s.description[0]}
          onClick={() => update({ subclassId: s.id as DefinitionId })}
        />
      ))}
    </div>
  );
}

// ── 5 · Trasfondo ────────────────────────────────────────────────────────────

export function BackgroundStep({ draft, update, content }: StepProps) {
  const backgrounds = content.backgrounds();

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">
        El trasfondo cuenta qué hacía tu personaje antes de aventurarse, y le da competencias y equipo.
      </p>
      {backgrounds.map((b) => (
        <ChoiceCard
          key={b.id}
          selected={draft.backgroundId === b.id}
          title={b.name}
          subtitle={b.skillProficiencies
            .map((s) => SKILL_NAME_ES[skillFromSrdIndex(s) as SkillId] ?? s)
            .join(' · ')}
          description={b.feature?.description[0]}
          onClick={() => update({ backgroundId: b.id as DefinitionId })}
        />
      ))}
    </div>
  );
}

// ── 6 · Características ──────────────────────────────────────────────────────

export function AbilitiesStep({ draft, update }: StepProps) {
  const method = draft.abilityMethod;
  const scores = draft.abilityScores;

  const setScore = (ability: AbilityId, value: number) =>
    update({ abilityScores: { ...scores, [ability]: value } });

  const applyStandardArray = () => {
    // Se asigna en orden y el jugador reordena: nunca decidimos por él.
    const next: AbilityScores = { ...scores };
    ABILITIES.forEach((a, i) => {
      next[a] = STANDARD_ARRAY[i] ?? 10;
    });
    update({ abilityScores: next, abilityMethod: 'standardArray' });
  };

  const rollScores = () => {
    const expr = parseDiceExpression('4d6kh3');
    if (isErr(expr)) return;
    const next: AbilityScores = { ...scores };
    for (const a of ABILITIES) next[a] = rollExpression(expr.value).total;
    update({ abilityScores: next, abilityMethod: 'roll' });
  };

  const remaining = pointBuyRemaining(scores);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            { key: 'standardArray', label: 'Estándar' },
            { key: 'pointBuy', label: 'Compra' },
            { key: 'roll', label: 'Tirada' },
            { key: 'manual', label: 'Manual' },
          ] as const
        ).map((m) => (
          <button
            key={m.key}
            onClick={() => {
              if (m.key === 'standardArray') applyStandardArray();
              else if (m.key === 'roll') rollScores();
              else update({ abilityMethod: m.key });
            }}
            aria-pressed={method === m.key}
            className={cn(
              'h-11 rounded-[var(--radius-md)] border text-sm font-medium transition-all',
              method === m.key
                ? 'border-transparent bg-crimson-gradient text-[var(--accent-on)]'
                : 'border-[var(--border-default)] text-[var(--text-secondary)]',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {method === 'pointBuy' && (
        <div
          className={cn(
            'rounded-[var(--radius-md)] border px-3.5 py-2.5 text-sm',
            remaining < 0
              ? 'border-[var(--danger-text)]/40 bg-[var(--danger-muted)] text-[var(--danger-text)]'
              : 'border-[var(--border-subtle)] bg-[var(--surface-sunken)]',
          )}
        >
          Puntos restantes: <span className="text-numeric font-semibold">{remaining}</span> de{' '}
          {POINT_BUY_BUDGET}
        </div>
      )}

      {method === 'roll' && (
        <button
          onClick={rollScores}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] text-sm font-medium hover:bg-[var(--surface-interactive)]"
        >
          <Shuffle className="size-4" />
          Volver a tirar (4d6, descartando el menor)
        </button>
      )}

      <div className="space-y-2">
        {ABILITIES.map((ability) => {
          const score = scores[ability];
          const cost = method === 'pointBuy' ? pointBuyCost(score) : null;
          return (
            <div
              key={ability}
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3"
            >
              <span className="w-12 shrink-0 text-sm font-semibold">{ABILITY_ABBR_ES[ability]}</span>

              <div className="flex flex-1 items-center gap-1.5">
                <button
                  onClick={() => setScore(ability, Math.max(1, score - 1))}
                  aria-label={`Bajar ${ABILITY_ABBR_ES[ability]}`}
                  className="flex size-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] hover:bg-[var(--surface-interactive)]"
                >
                  −
                </button>
                <span className="text-numeric w-10 text-center text-lg font-semibold">{score}</span>
                <button
                  onClick={() => setScore(ability, Math.min(20, score + 1))}
                  aria-label={`Subir ${ABILITY_ABBR_ES[ability]}`}
                  className="flex size-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] hover:bg-[var(--surface-interactive)]"
                >
                  +
                </button>
              </div>

              <span className="text-numeric w-10 shrink-0 text-right text-sm font-semibold text-[var(--accent-text)]">
                {formatModifier(abilityModifier(score))}
              </span>

              {cost != null && (
                <span className="text-numeric w-8 shrink-0 text-right text-2xs text-[var(--text-tertiary)]">
                  {cost}p
                </span>
              )}
            </div>
          );
        })}
      </div>

      <Hint>
        El modificador es lo que suma de verdad en las tiradas. Una puntuación de 16 da +3; una de 10,
        +0. Nosotros lo calculamos siempre por vos.
      </Hint>
    </div>
  );
}

// ── 7 · Competencias ─────────────────────────────────────────────────────────

export function ProficienciesStep({ draft, update, content }: StepProps) {
  const cls = content.class(draft.classId);
  const choose = cls?.skillChoices?.choose ?? 0;
  const options = cls?.skillChoices?.from ?? [];

  const selected = Object.entries(draft.skillProficiencies)
    .filter(([, v]) => v && v !== 'none')
    .map(([k]) => k as SkillId);

  const toggle = (skill: SkillId) => {
    const next = { ...draft.skillProficiencies };
    if (next[skill] && next[skill] !== 'none') delete next[skill];
    else if (selected.length < choose) next[skill] = 'proficient';
    update({ skillProficiencies: next });
  };

  if (options.length === 0) {
    return <Hint>Esta clase no ofrece elección de habilidades en el SRD.</Hint>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">
        Elegí {choose} {choose === 1 ? 'habilidad' : 'habilidades'}. Sumás tu bonificador de competencia
        en esas tiradas.
      </p>
      <p className="text-xs text-[var(--text-tertiary)]">
        Seleccionadas: {selected.length} de {choose}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((index) => {
          const skill = skillFromSrdIndex(index);
          if (!skill) return null;
          const isSelected = selected.includes(skill);
          const disabled = !isSelected && selected.length >= choose;
          return (
            <button
              key={index}
              onClick={() => toggle(skill)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={cn(
                'flex items-center gap-2.5 rounded-[var(--radius-md)] border px-3.5 py-3 text-left text-sm transition-all',
                isSelected
                  ? 'border-[var(--border-accent)] bg-[var(--accent-muted)]'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-raised)]',
                disabled && 'opacity-40',
              )}
            >
              <span
                className={cn(
                  'flex size-4.5 shrink-0 items-center justify-center rounded border-2',
                  isSelected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-strong)]',
                )}
                aria-hidden="true"
              >
                {isSelected && <Check className="size-3 text-[var(--accent-on)]" strokeWidth={3} />}
              </span>
              {SKILL_NAME_ES[skill]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── 8 · Equipo ───────────────────────────────────────────────────────────────

export function EquipmentStep({ draft, update, content }: StepProps) {
  const cls = content.class(draft.classId);
  const groups = cls?.startingEquipmentOptions ?? [];

  if (groups.length === 0) {
    return <Hint>Tu clase y tu trasfondo ya te dan su equipo inicial. Podés ajustarlo después.</Hint>;
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--text-secondary)]">
        Elegí con qué empieza tu personaje. Todo esto se puede cambiar más adelante.
      </p>

      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="space-y-2">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            {group.label || `Opción ${groupIndex + 1}`}
          </p>
          {group.options.map((option, optionIndex) => (
            <ChoiceCard
              key={optionIndex}
              selected={draft.equipmentChoices[String(groupIndex)] === optionIndex}
              title={option.label}
              subtitle={option.items
                .map((i) => {
                  const def = content.get(i.definitionId);
                  return def ? `${def.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}` : '';
                })
                .filter(Boolean)
                .join(' · ')}
              onClick={() =>
                update({
                  equipmentChoices: { ...draft.equipmentChoices, [String(groupIndex)]: optionIndex },
                })
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── 9 · Hechizos ─────────────────────────────────────────────────────────────

export function SpellsStep({ draft, update, content }: StepProps) {
  const cls = content.class(draft.classId);
  const slug = (draft.classId as string | undefined)?.split(':').pop() ?? '';
  const row = cls?.progression[String(draft.level)];
  const cantripsNeeded = row?.spellcasting?.cantripsKnown ?? 0;
  const spellsNeeded = row?.spellcasting?.spellsKnown ?? 0;

  const available = content.spellsForClass(slug);
  const cantrips = available.filter((s) => s.level === 0);
  const leveled = available.filter((s) => s.level > 0 && s.level <= 1);

  const toggle = (id: DefinitionId, isCantrip: boolean) => {
    const list = isCantrip ? draft.cantrips : draft.spells;
    const limit = isCantrip ? cantripsNeeded : spellsNeeded || 6;
    const next = list.includes(id)
      ? list.filter((x) => x !== id)
      : list.length < limit
        ? [...list, id]
        : list;
    update(isCantrip ? { cantrips: next } : { spells: next });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--text-secondary)]">
        Los trucos se lanzan sin gastar nada. Los hechizos de nivel 1 consumen un espacio.
      </p>

      {cantripsNeeded > 0 && (
        <SpellPicker
          title={`Trucos (${draft.cantrips.length} de ${cantripsNeeded})`}
          spells={cantrips}
          selected={draft.cantrips}
          onToggle={(id) => toggle(id, true)}
        />
      )}

      <SpellPicker
        title={`Hechizos de nivel 1${spellsNeeded > 0 ? ` (${draft.spells.length} de ${spellsNeeded})` : ''}`}
        spells={leveled}
        selected={draft.spells}
        onToggle={(id) => toggle(id, false)}
      />
    </div>
  );
}

function SpellPicker({
  title,
  spells,
  selected,
  onToggle,
}: {
  title: string;
  spells: readonly { id: string; name: string; school: string; concentration: boolean }[];
  selected: readonly DefinitionId[];
  onToggle: (id: DefinitionId) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = query
    ? spells.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : spells;

  return (
    <div className="space-y-2">
      <p className="font-display text-sm">{title}</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar…"
        aria-label={`Buscar en ${title}`}
        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 text-sm outline-none focus:border-[var(--accent)]"
      />
      <div className="scrollbar-slim max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {filtered.map((spell) => {
          const isSelected = selected.includes(spell.id as DefinitionId);
          return (
            <button
              key={spell.id}
              onClick={() => onToggle(spell.id as DefinitionId)}
              aria-pressed={isSelected}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 text-left text-sm transition-all',
                isSelected
                  ? 'border-[var(--border-accent)] bg-[var(--accent-muted)]'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-raised)]',
              )}
            >
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded border-2',
                  isSelected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-strong)]',
                )}
                aria-hidden="true"
              >
                {isSelected && <Check className="size-2.5 text-[var(--accent-on)]" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1 truncate">{spell.name}</span>
              <span className="shrink-0 text-2xs text-[var(--text-tertiary)]">{spell.school}</span>
              {spell.concentration && <Chip tone="arcane">Conc.</Chip>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── 10-12 · Personalidad, apariencia, historia ───────────────────────────────

export function PersonalityStep({
  draft,
  update,
  content,
  appearance = false,
  backstory = false,
}: StepProps & { appearance?: boolean; backstory?: boolean }) {
  const background = content.background(draft.backgroundId);

  if (backstory) {
    return (
      <div className="space-y-3">
        <label htmlFor="backstory" className="block text-sm font-medium">
          Historia de tu personaje
        </label>
        <textarea
          id="backstory"
          value={draft.backstory}
          onChange={(e) => update({ backstory: e.target.value })}
          rows={10}
          placeholder="¿De dónde viene? ¿Qué lo llevó a aventurarse? Podés dejarlo en blanco y escribirlo después."
          className="w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] p-4 text-sm leading-relaxed outline-none focus:border-[var(--accent)]"
        />
      </div>
    );
  }

  if (appearance) {
    const fields: { key: string; label: string; placeholder: string }[] = [
      { key: 'age', label: 'Edad', placeholder: '27' },
      { key: 'height', label: 'Altura', placeholder: '1,80 m' },
      { key: 'weight', label: 'Peso', placeholder: '80 kg' },
      { key: 'eyes', label: 'Ojos', placeholder: 'Verdes' },
      { key: 'hair', label: 'Cabello', placeholder: 'Castaño' },
      { key: 'skin', label: 'Piel', placeholder: 'Clara' },
    ];
    return (
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label htmlFor={f.key} className="mb-1.5 block text-xs font-medium">
              {f.label}
            </label>
            <input
              id={f.key}
              value={draft.appearance[f.key] ?? ''}
              onChange={(e) => update({ appearance: { ...draft.appearance, [f.key]: e.target.value } })}
              placeholder={f.placeholder}
              className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
        ))}
      </div>
    );
  }

  const sections: { key: keyof CharacterDraft['personality']; label: string; options: readonly string[] }[] = [
    { key: 'traits', label: 'Rasgos de personalidad', options: background?.personalityTraits ?? [] },
    { key: 'ideals', label: 'Ideales', options: background?.ideals ?? [] },
    { key: 'bonds', label: 'Vínculos', options: background?.bonds ?? [] },
    { key: 'flaws', label: 'Defectos', options: background?.flaws ?? [] },
  ];

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--text-secondary)]">
        Elegí lo que define a tu personaje, o escribí lo tuyo. Todo es opcional.
      </p>

      {sections.map((section) => (
        <div key={section.key} className="space-y-2">
          <p className="font-display text-sm">{section.label}</p>
          {section.options.length > 0 ? (
            <div className="space-y-1.5">
              {section.options.slice(0, 6).map((option, i) => {
                const list = draft.personality[section.key];
                const isSelected = list.includes(option);
                return (
                  <button
                    key={i}
                    onClick={() =>
                      update({
                        personality: {
                          ...draft.personality,
                          [section.key]: isSelected
                            ? list.filter((x) => x !== option)
                            : [...list, option],
                        },
                      })
                    }
                    aria-pressed={isSelected}
                    className={cn(
                      'w-full rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left text-xs leading-relaxed transition-all',
                      isSelected
                        ? 'border-[var(--border-accent)] bg-[var(--accent-muted)]'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-raised)]',
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-tertiary)]">
              Elegí un trasfondo para ver sugerencias.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 13 · Revisión ────────────────────────────────────────────────────────────

export function ReviewStep({
  draft,
  content,
  engine,
}: {
  draft: CharacterDraft;
  content: ContentIndex;
  engine: RulesEngine;
}) {
  // Se resuelve el personaje REAL para la previsualización: lo que ve aquí es
  // exactamente lo que tendrá. Nada de estimaciones.
  const preview = (() => {
    try {
      const state = createCharacter(
        draft,
        asWorkspaceId('00000000-0000-7000-8000-000000000001'),
        content,
        engine,
      );
      return resolveCharacter(state, content, engine);
    } catch {
      return null;
    }
  })();

  if (!preview) {
    return <Hint>Faltan datos para previsualizar. Volvé atrás y completá los pasos pendientes.</Hint>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="font-display text-xl">{preview.state.name}</h2>
        <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">
          {preview.speciesName} · {preview.classes.map((c) => `${c.name} ${c.level}`).join(' / ')} ·{' '}
          {preview.backgroundName}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Stat label="PG" value={String(preview.hitPoints.max.value)} />
          <Stat label="CA" value={String(preview.armorClass.value)} />
          <Stat label="Iniciativa" value={formatModifier(preview.initiative.value)} />
        </div>

        <div className="mt-2.5 grid grid-cols-6 gap-1.5">
          {ABILITIES.map((a) => (
            <div key={a} className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] py-2 text-center">
              <p className="text-2xs uppercase text-[var(--text-tertiary)]">{ABILITY_ABBR_ES[a]}</p>
              <p className="text-numeric text-sm font-semibold">
                {formatModifier(preview.abilities[a].modifier)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {preview.attacks.length > 1 && (
        <Card className="p-4">
          <p className="mb-2 font-display text-sm">Ataques</p>
          <ul className="space-y-1.5">
            {preview.attacks.slice(0, 4).map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{a.name}</span>
                <span className="text-numeric shrink-0 text-[var(--text-tertiary)]">
                  {formatModifier(a.attackBonus.value)} · {a.damageExpression}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {preview.spellcasting.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 font-display text-sm">Magia</p>
          <div className="flex gap-4 text-sm">
            <span>
              CD de salvación{' '}
              <span className="text-numeric font-semibold">{preview.spellcasting[0]!.saveDc.value}</span>
            </span>
            <span>
              Ataque{' '}
              <span className="text-numeric font-semibold">
                {formatModifier(preview.spellcasting[0]!.spellAttackBonus.value)}
              </span>
            </span>
          </div>
        </Card>
      )}

      <Hint>
        Todo esto se calcula solo y se mantiene al día. Si cambiás de equipo o subís de nivel, la
        ficha se recalcula sin que tengas que tocar nada.
      </Hint>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] py-3 text-center">
      <p className="text-numeric font-display text-xl font-bold">{value}</p>
      <p className="mt-0.5 text-2xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">{label}</p>
    </div>
  );
}
