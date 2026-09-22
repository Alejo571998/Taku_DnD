'use client';

import { use } from 'react';
import Link from 'next/link';
import { Backpack, Coins, Info, Scroll, Shield, Shirt, Sparkles, StickyNote, TrendingUp } from 'lucide-react';
import { ABILITIES, ABILITY_ABBR_ES, formatModifier } from '@domain/character/ability';
import { SKILLS, SKILL_NAME_ES } from '@domain/character/skill';
import { MAX_CHARACTER_LEVEL, experienceProgress } from '@domain/character/progression';
import type { CharacterSheet, ResolvedFeature } from '@domain/character/sheet';
import { formatCurrency } from '@domain/currency/currency';
import { formatWeight } from '@domain/shared/units';
import { asCharacterId } from '@domain/shared/ids';
import { cn } from '@ui/design-system/cn';
import { Card, Chip, EmptyState, LoadingState, ProgressBar, SectionTitle } from '@ui/design-system/primitives';
import { CharacterHeader } from '@ui/components/CharacterHeader';
import { HeaderBoxes, ProficienciesBlock } from '@ui/features/character/SheetBoxes';
import { IdentityBlock } from '@ui/features/character/IdentityBlock';
import { TIPS } from '@ui/features/taku/lines';
import { useTakuCue } from '@ui/features/taku/TakuProvider';
import { useCharacter, useCharacterSheet, useDispatch } from '@ui/hooks/useAppData';
import { useCampaignOf } from '@ui/hooks/useCampaigns';

/**
 * MODO GESTIÓN (MASTER SPEC §21 de UX)
 *
 * Aquí manda la profundidad: todas las estadísticas, todas las habilidades,
 * todo el inventario. Es lo contrario del Modo Juego, y esa diferencia es
 * deliberada.
 */
export default function ManageModePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const character = useCharacter(asCharacterId(id));
  const sheet = useCharacterSheet(character);
  const dispatch = useDispatch(character);

  /*
    Solo si este personaje tiene de dónde le venga una ventaja o una
    desventaja. Al enano le sale la «Ventaja» en Constitución y la pregunta
    aparece sola; a quien no tenga ninguna, contarle que se anulan entre sí es
    resolverle una duda que no tiene.

    Va antes de los retornos tempranos porque un hook no puede ir detrás de
    uno; con la ficha a medio cargar la condición es falsa y no ofrece nada.
  */
  useTakuCue(
    (sheet?.savingThrows
      ? Object.values(sheet.savingThrows).some(
          (save) => save.advantage.advantage.length > 0 || save.advantage.disadvantage.length > 0,
        )
      : false),
    TIPS.advantageCancels,
  );

  if (character === null) {
    return (
      <EmptyState
        title="No encontramos este personaje"
        description="Puede que lo hayas borrado en otro dispositivo."
        action={
          <Link href="/characters" className="text-sm font-medium text-[var(--accent-text)] underline underline-offset-4">
            Volver a personajes
          </Link>
        }
      />
    );
  }

  if (!character || !sheet) return <LoadingState label="Cargando personaje…" />;

  return (
    <div className="animate-fade-in">
      <CharacterHeader sheet={sheet} />

      {sheet.warnings.length > 0 && <WarningsPanel sheet={sheet} />}

      <div className="space-y-6">
        <HeaderBoxes sheet={sheet} />
        <AbilitiesGrid sheet={sheet} />

        <div className="grid gap-6 lg:grid-cols-2">
          <SavingThrows sheet={sheet} />
          <SkillsList sheet={sheet} />
        </div>

        <ProficienciesBlock sheet={sheet} />
        <IdentityBlock sheet={sheet} dispatch={dispatch} />
        <SectionLinks sheet={sheet} />
        <FeaturesList sheet={sheet} />
      </div>
    </div>
  );
}

/**
 * Avisos de la ficha. Lo que 5e PENALIZA se advierte y se permite; lo que
 * PROHÍBE se bloquea antes de llegar aquí.
 */
function WarningsPanel({ sheet }: { sheet: CharacterSheet }) {
  const messages: Record<string, (p?: Record<string, string | number>) => string> = {
    'weapon.notProficient': (p) => `No tenés competencia con ${p?.item ?? 'esa arma'}: no sumás el bonificador.`,
    'armor.notProficient': (p) => `No tenés competencia con ${p?.item ?? 'esa armadura'}.`,
    'armor.strengthRequirement': (p) => `${p?.item ?? 'La armadura'} pide Fuerza ${p?.required ?? ''}: tu velocidad baja 10 pies.`,
    'stealth.disadvantage': (p) => `${p?.item ?? 'La armadura'} te da desventaja en Sigilo.`,
    'carrying.exceeded': () => 'Superaste tu capacidad de carga.',
    'carrying.encumbered': () => 'Estás sobrecargado: tu velocidad baja.',
    'attunement.overLimit': (p) => `Tenés ${p?.count ?? 0} objetos sintonizados y el máximo es 3.`,
    'spells.overPrepared': (p) => `Tenés ${p?.count ?? 0} hechizos preparados y el límite es ${p?.limit ?? 0}.`,
    'subclass.pending': (p) => `Te toca elegir subclase de ${p?.className ?? 'tu clase'} (nivel ${p?.level ?? ''}).`,
  };

  return (
    <div className="mb-6 space-y-2">
      {sheet.warnings.map((w, i) => (
        <div
          key={i}
          className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--warning-text)]/30 bg-[var(--warning-muted)] px-3.5 py-2.5"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--warning-text)]" strokeWidth={2} />
          <p className="text-sm text-[var(--text-secondary)]">
            {messages[w.code]?.(w.params) ?? w.code}
          </p>
        </div>
      ))}
    </div>
  );
}

function AbilitiesGrid({ sheet }: { sheet: CharacterSheet }) {
  return (
    <section>
      <SectionTitle>Características</SectionTitle>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {ABILITIES.map((ability) => {
          const block = sheet.abilities[ability];
          return (
            <div
              key={ability}
              className="surface-card px-2 py-3 text-center"
              title={block.score.contributions.map((c) => `${c.source.label} ${c.amount >= 0 ? '+' : ''}${c.amount}`).join(' · ')}
            >
              <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                {ABILITY_ABBR_ES[ability]}
              </p>
              <p className="text-numeric mt-1 font-display text-2xl font-bold leading-none">
                {formatModifier(block.modifier)}
              </p>
              <p className="text-numeric mt-1 text-xs text-[var(--text-tertiary)]">{block.score.value}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SavingThrows({ sheet }: { sheet: CharacterSheet }) {
  return (
    <section>
      <SectionTitle>Tiradas de salvación</SectionTitle>
      <Card className="divide-y divide-[var(--border-subtle)]">
        {ABILITIES.map((ability) => {
          const save = sheet.savingThrows[ability];
          const hasAdv = save.advantage.advantage.length > 0;
          return (
            <div key={ability} className="flex items-center gap-3 px-3.5 py-2.5">
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  save.proficient ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]',
                )}
                aria-hidden="true"
              />
              <span className="flex-1 text-sm">{ABILITY_ABBR_ES[ability]}</span>
              {hasAdv && (
                <Chip tone="success" className="shrink-0">
                  Ventaja
                </Chip>
              )}
              <span className="text-numeric text-sm font-semibold">
                {formatModifier(save.modifier.value)}
              </span>
            </div>
          );
        })}
      </Card>
    </section>
  );
}

function SkillsList({ sheet }: { sheet: CharacterSheet }) {
  return (
    <section>
      <SectionTitle>Habilidades</SectionTitle>
      <Card className="divide-y divide-[var(--border-subtle)]">
        {SKILLS.map((skill) => {
          const block = sheet.skills[skill];
          const dot =
            block.proficiency === 'expertise'
              ? 'bg-[var(--legendary)]'
              : block.proficiency === 'proficient'
                ? 'bg-[var(--accent)]'
                : block.proficiency === 'half'
                  ? 'bg-[var(--accent)]/45'
                  : 'bg-[var(--border-strong)]';

          return (
            <div key={skill} className="flex items-center gap-3 px-3.5 py-2">
              <span className={cn('size-2 shrink-0 rounded-full', dot)} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm">{SKILL_NAME_ES[skill]}</span>
              <span className="shrink-0 text-2xs uppercase text-[var(--text-tertiary)]">
                {ABILITY_ABBR_ES[block.ability]}
              </span>
              <span className="text-numeric w-9 shrink-0 text-right text-sm font-semibold">
                {formatModifier(block.modifier.value)}
              </span>
            </div>
          );
        })}
      </Card>
      <p className="mt-2 text-xs text-[var(--text-tertiary)]">
        Percepción pasiva: <span className="text-numeric font-medium">{sheet.passivePerception}</span>
      </p>
    </section>
  );
}

function SectionLinks({ sheet }: { sheet: CharacterSheet }) {
  const id = sheet.state.id;
  const campaign = useCampaignOf(sheet.state.id);
  const xp = experienceProgress(sheet.state.experience);
  const atMaxLevel = sheet.level >= MAX_CHARACTER_LEVEL;

  const items = [
    {
      href: `/characters/${id}/manage/level-up`,
      icon: TrendingUp,
      label: 'Subir de nivel',
      detail: atMaxLevel
        ? 'Nivel 20: el máximo'
        : xp.level > sheet.level
          ? `Ya tenés PX para el nivel ${xp.level}`
          : `Nivel ${sheet.level} · faltan ${xp.remaining.toLocaleString('es-419')} PX`,
      disabled: atMaxLevel,
    },
    {
      href: `/characters/${id}/manage/inventory`,
      icon: Backpack,
      label: 'Inventario',
      detail: `${sheet.state.inventory.length} objetos · ${formatWeight(sheet.carrying.carried)}`,
    },
    {
      href: `/characters/${id}/manage/equipment`,
      icon: Shirt,
      label: 'Equipamiento',
      detail: `CA ${sheet.armorClass.value}`,
    },
    {
      href: `/characters/${id}/manage/spells`,
      icon: Sparkles,
      label: 'Hechizos',
      detail:
        sheet.spellcasting.length > 0
          ? `${sheet.state.spells.known.length} conocidos · CD ${sheet.spellcasting[0]!.saveDc.value}`
          : 'No lanza hechizos',
      disabled: sheet.spellcasting.length === 0,
    },
    {
      href: `/characters/${id}/manage/money`,
      icon: Coins,
      label: 'Dinero',
      detail: formatCurrency(sheet.state.currency),
    },
    {
      href: `/characters/${id}/manage/conditions`,
      icon: Scroll,
      label: 'Condiciones',
      detail: `${sheet.activeConditions.length} activas`,
    },
    {
      href: `/characters/${id}/manage/notes`,
      icon: StickyNote,
      label: 'Notas',
      detail: `${sheet.state.notes.length} notas`,
    },
    // La campaña solo aparece si el personaje juega en una: un enlace a una
    // pantalla vacía es ruido, no una funcionalidad.
    ...(campaign
      ? [
          {
            href: `/campaigns/${campaign.id}`,
            icon: Shield,
            label: campaign.name,
            detail: `${campaign.sessions.length} ${campaign.sessions.length === 1 ? 'sesión' : 'sesiones'}`,
          },
        ]
      : []),
  ];

  return (
    <section>
      <SectionTitle>Gestión</SectionTitle>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-muted)] text-[var(--accent-text)]">
                <Icon className="size-4.5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="block truncate text-xs text-[var(--text-tertiary)]">{item.detail}</span>
              </span>
            </>
          );

          const shell = cn(
            'flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)]',
            'bg-[var(--surface-raised)] p-3 transition-[border-color,transform] duration-150',
            item.disabled
              ? 'pointer-events-none opacity-45'
              : 'hover:border-[var(--border-accent)] active:scale-[0.99]',
          );

          return item.disabled ? (
            <div key={item.href} className={shell}>
              {content}
            </div>
          ) : (
            <Link key={item.href} href={item.href} className={shell}>
              {content}
            </Link>
          );
        })}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
          <span>Carga</span>
          <span className="text-numeric">
            {formatWeight(sheet.carrying.carried)} / {formatWeight(sheet.carrying.capacity)}
          </span>
        </div>
        <ProgressBar
          className="mt-1.5"
          value={sheet.carrying.carried}
          max={sheet.carrying.capacity}
          tone={
            sheet.carrying.status === 'exceeded'
              ? 'danger'
              : sheet.carrying.status === 'normal'
                ? 'accent'
                : 'warning'
          }
          label="Capacidad de carga"
        />
      </div>
    </section>
  );
}

function FeaturesList({ sheet }: { sheet: CharacterSheet }) {
  if (sheet.features.length === 0) return null;

  const grouped = sheet.features.reduce<Record<string, ResolvedFeature[]>>((acc, f) => {
    (acc[f.kind] ??= []).push(f);
    return acc;
  }, {});

  const labels: Record<string, string> = {
    class: 'Rasgos de clase',
    subclass: 'Rasgos de subclase',
    species: 'Rasgos de especie',
    background: 'Trasfondo',
    feat: 'Dotes',
  };

  return (
    <section>
      <SectionTitle>Rasgos y aptitudes</SectionTitle>
      <div className="space-y-4">
        {Object.entries(grouped).map(([kind, features]) => (
          <div key={kind}>
            <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{labels[kind] ?? kind}</p>
            <div className="space-y-2">
              {features.map((f) => (
                <details
                  key={f.definitionId}
                  className="group rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)]"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
                    <span className="shrink-0 text-2xs text-[var(--text-tertiary)]">Nivel {f.level}</span>
                  </summary>
                  <div className="space-y-2 px-3.5 pb-3.5 text-sm text-[var(--text-secondary)]">
                    {f.description.length > 0 ? (
                      f.description.map((p, i) => <p key={i}>{p}</p>)
                    ) : (
                      <p className="text-[var(--text-tertiary)]">Sin descripción disponible.</p>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
