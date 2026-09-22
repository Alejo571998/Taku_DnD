'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  Backpack,
  Dices,
  Gauge,
  Shield,
  Sparkles,
  Swords,
  Wind,
  Zap,
} from 'lucide-react';
import type { Attack, CharacterSheet } from '@domain/character/sheet';
import { damageTypeEs } from '@domain/content/labels';
import { formatModifier } from '@domain/character/ability';
import { parseDiceExpression } from '@domain/dice/expression';
import { criticalDamage, rollExpression, type RollResult } from '@domain/dice/roller';
import { isErr } from '@domain/shared/result';

import { asCharacterId } from '@domain/shared/ids';
import { cn } from '@ui/design-system/cn';
import { Card, Chip, EmptyState, LoadingState, SectionTitle } from '@ui/design-system/primitives';
import { Sheet } from '@ui/design-system/Sheet';
import { CharacterHeader } from '@ui/components/CharacterHeader';
import { HitPointsPanel } from '@ui/features/play/HitPointsPanel';
import { DeathSavesPanel } from '@ui/features/play/DeathSavesPanel';
import { HitDicePanel } from '@ui/features/play/HitDicePanel';
import { HeroicInspiration } from '@ui/features/play/HeroicInspiration';
import { DiceRoller, RollDisplay, persistRoll } from '@ui/features/dice/DiceRoller';
import { useCharacter, useCharacterSheet, useDispatch, type DispatchFn } from '@ui/hooks/useAppData';
import { TIPS } from '@ui/features/taku/lines';
import { useTakuCue } from '@ui/features/taku/TakuProvider';

/**
 * MODO JUEGO (MASTER SPEC §10)
 *
 * Optimizado para la mesa: lo que se usa durante una partida, arriba y a un
 * toque. HP, CA, iniciativa, ataques, hechizos, recursos, condiciones, dados.
 *
 * Todo lo que no se usa mientras se juega vive en Modo Gestión.
 */
export default function PlayModePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const character = useCharacter(asCharacterId(id));
  const sheet = useCharacterSheet(character);

  // Que TODO se pueda deshacer es lo que nadie descubre solo: se prueba un
  // botón con miedo, o no se prueba.
  useTakuCue(sheet !== undefined, TIPS.playMode);
  const dispatch = useDispatch(character);

  if (character === null) {
    return (
      <EmptyState
        title="No encontramos este personaje"
        description="Puede que lo hayas borrado en otro dispositivo, o que el enlace esté mal."
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

      <div className="space-y-4 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-5 lg:space-y-0">
        <div className="space-y-4">
          <HitPointsPanel sheet={sheet} dispatch={dispatch} />
          {/*
            Las salvaciones contra muerte solo aparecen a 0 PG: fuera de ese
            momento son ruido, y dentro son la regla que mas se olvida.
          */}
          {sheet.hitPoints.status === 'down' && <DeathSavesPanel sheet={sheet} dispatch={dispatch} />}
          <HitDicePanel sheet={sheet} />
          <HeroicInspiration sheet={sheet} dispatch={dispatch} />
          <CoreStats sheet={sheet} />
          <QuickActions sheet={sheet} dispatch={dispatch} />
        </div>

        <div className="space-y-4">
          <AttacksSection sheet={sheet} dispatch={dispatch} />
          {sheet.resources.length > 0 && <ResourcesSection sheet={sheet} dispatch={dispatch} />}
          <ConditionsSection sheet={sheet} />
        </div>
      </div>
    </div>
  );
}

/** CA · Iniciativa · Velocidad — las tres cifras que se consultan sin parar. */
function CoreStats({ sheet }: { sheet: CharacterSheet }) {
  const stats = [
    {
      label: 'CA',
      value: String(sheet.armorClass.value),
      icon: Shield,
      detail: sheet.armorClass.contributions
        .filter((c) => c.amount !== 0 || c.op === 'base' || c.op === 'set')
        .map((c) => `${c.source.label} ${c.op === 'add' && c.amount > 0 ? '+' : ''}${c.amount}`)
        .join(' · '),
    },
    {
      label: 'Iniciativa',
      value: formatModifier(sheet.initiative.value),
      icon: Zap,
      detail: 'Destreza',
    },
    {
      label: 'Velocidad',
      value: `${sheet.speed.value} pies`,
      icon: Wind,
      detail: sheet.carrying.speedPenalty > 0 ? `−${sheet.carrying.speedPenalty} por carga` : '',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="surface-card px-3 py-3.5 text-center" title={stat.detail}>
            <Icon className="mx-auto size-4 text-[var(--text-tertiary)]" strokeWidth={2} />
            <p className="text-numeric mt-1.5 font-display text-2xl font-bold leading-none">{stat.value}</p>
            <p className="mt-1 text-2xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">{stat.label}</p>
          </div>
        );
      })}
    </div>
  );
}

function QuickActions({ sheet, dispatch }: { sheet: CharacterSheet; dispatch: DispatchFn }) {
  const [openDice, setOpenDice] = useState(false);
  const [openRest, setOpenRest] = useState(false);
  const id = sheet.state.id;

  return (
    <>
      <div className="grid grid-cols-4 gap-2.5">
        <ActionTile icon={<Dices className="size-5" />} label="Dados" onClick={() => setOpenDice(true)} />
        <ActionTile
          icon={<Sparkles className="size-5" />}
          label="Hechizos"
          href={`/characters/${id}/manage/spells`}
          disabled={sheet.spellcasting.length === 0}
        />
        <ActionTile icon={<Backpack className="size-5" />} label="Mochila" href={`/characters/${id}/manage/inventory`} />
        <ActionTile icon={<Gauge className="size-5" />} label="Descansar" onClick={() => setOpenRest(true)} />
      </div>

      <Sheet open={openDice} onOpenChange={setOpenDice} title="Tirar dados" size="md">
        <DiceRoller characterId={sheet.state.id as string} compact />
      </Sheet>

      <Sheet
        open={openRest}
        onOpenChange={setOpenRest}
        title="Descansar"
        description="Recuperá recursos según las reglas de tu edición."
        size="sm"
      >
        <div className="space-y-2.5">
          <RestOption
            title="Descanso corto"
            description="1 hora. Recuperás lo que se restaura con descanso corto y podés gastar dados de golpe."
            onClick={() => {
              void dispatch({ type: 'TakeRest', kind: 'short' });
              setOpenRest(false);
            }}
          />
          <RestOption
            title="Descanso largo"
            description="8 horas. PG al máximo, espacios de conjuro completos y la mitad de tus dados de golpe."
            emphasis
            onClick={() => {
              void dispatch({ type: 'TakeRest', kind: 'long' });
              setOpenRest(false);
            }}
          />
        </div>
      </Sheet>
    </>
  );
}

function RestOption({
  title,
  description,
  onClick,
  emphasis = false,
}: {
  title: string;
  description: string;
  onClick: () => void;
  emphasis?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-[var(--radius-lg)] border p-4 text-left transition-colors',
        emphasis
          ? 'border-[var(--border-accent)] bg-[var(--accent-muted)] hover:brightness-110'
          : 'border-[var(--border-default)] hover:bg-[var(--surface-interactive)]',
      )}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{description}</p>
    </button>
  );
}

function ActionTile({
  icon,
  label,
  onClick,
  href,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const className = cn(
    'flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-subtle)]',
    'bg-[var(--surface-raised)] px-2 py-3.5 transition-[border-color,transform] duration-150',
    disabled
      ? 'pointer-events-none opacity-40'
      : 'hover:border-[var(--border-accent)] active:scale-[0.97]',
  );

  const body = (
    <>
      <span className="text-[var(--accent-text)]">{icon}</span>
      <span className="text-2xs font-medium">{label}</span>
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} className={className}>
      {body}
    </button>
  );
}

/**
 * ATAQUES (MASTER SPEC §12)
 *
 * Un ataque no guarda su bonificador: lo deriva del arma, la característica,
 * la competencia y los modificadores activos. Por eso siempre está al día.
 */
function AttacksSection({ sheet, dispatch }: { sheet: CharacterSheet; dispatch: DispatchFn }) {
  const [active, setActive] = useState<Attack | null>(null);
  const attacks = [...sheet.attacks].sort((a, b) => Number(b.favorite) - Number(a.favorite));

  return (
    <>
      <section>
        <SectionTitle>Ataques</SectionTitle>
        <div className="space-y-2">
          {attacks.map((attack) => (
            <button
              key={attack.id}
              onClick={() => setActive(attack)}
              className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 text-left transition-[border-color,transform] hover:border-[var(--border-accent)] active:scale-[0.99]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-muted)]">
                <Swords className="size-4.5 text-[var(--accent-text)]" strokeWidth={2} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{attack.name}</span>
                  {!attack.proficient && (
                    <Chip tone="warning" className="shrink-0">
                      Sin competencia
                    </Chip>
                  )}
                </span>
                <span className="text-numeric mt-0.5 block text-xs text-[var(--text-tertiary)]">
                  {formatModifier(attack.attackBonus.value)} al ataque · {attack.damageExpression} {damageTypeEs(attack.damageType)}
                  {attack.ammunition && ` · ${attack.ammunition.remaining} restantes`}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {active && (
        <AttackSheet
          attack={active}
          sheet={sheet}
          dispatch={dispatch}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}

/**
 * Resolución de un ataque (MASTER PROMPT §21).
 * Tirar → ver → decidir. El daño y el consumo de munición son pasos
 * separados y cancelables: la aplicación nunca decide por el jugador.
 */
function AttackSheet({
  attack,
  sheet,
  dispatch,
  onClose,
}: {
  attack: Attack;
  sheet: CharacterSheet;
  dispatch: DispatchFn;
  onClose: () => void;
}) {
  const [attackRoll, setAttackRoll] = useState<RollResult | null>(null);
  const [damageRoll, setDamageRoll] = useState<RollResult | null>(null);
  const [mode, setMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');

  const autoAmmo = sheet.state.settings.autoConsumeAmmunition;
  const outOfAmmo = Boolean(attack.ammunition && attack.ammunition.remaining <= 0);

  const doAttack = () => {
    const expr = parseDiceExpression(`1d20${attack.attackBonus.value >= 0 ? '+' : ''}${attack.attackBonus.value}`);
    if (isErr(expr)) return;

    const result = rollExpression(expr.value, { mode, detectCritical: true });
    setAttackRoll(result);
    setDamageRoll(null);
    void persistRoll(result, sheet.state.id as string, `Ataque: ${attack.name}`);

    if (attack.ammunition && autoAmmo && !outOfAmmo) {
      void dispatch(
        { type: 'ConsumeAmmunition', ammunitionType: attack.ammunition.definitionId, amount: 1 },
        { silent: true },
      );
    }
  };

  const doDamage = (critical: boolean) => {
    const parsed = parseDiceExpression(attack.damageExpression);
    if (isErr(parsed)) return;

    // Crítico: se duplican los DADOS, no el total ni los modificadores.
    const expr = critical ? criticalDamage(parsed.value) : parsed.value;
    const result = rollExpression(expr);
    setDamageRoll(result);
    void persistRoll(result, sheet.state.id as string, `Daño: ${attack.name}`);
  };

  return (
    <Sheet
      open
      onOpenChange={(v) => !v && onClose()}
      title={attack.name}
      description={`${formatModifier(attack.attackBonus.value)} al ataque · ${attack.damageExpression} ${damageTypeEs(attack.damageType)} · ${attack.range}`}
      size="md"
    >
      {outOfAmmo && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--warning-text)]/35 bg-[var(--warning-muted)] p-3">
          <p className="text-sm font-medium">Te quedaste sin munición</p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Podés atacar igual —no descontaremos nada— o recargar desde el inventario.
          </p>
        </div>
      )}

      {/* Trazabilidad: de dónde sale el bonificador (MASTER SPEC §27) */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {attack.attackBonus.contributions.map((c, i) => (
          <Chip key={i} tone="neutral">
            {c.source.label} {c.amount >= 0 ? '+' : ''}
            {c.amount}
          </Chip>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] p-1">
        {(['disadvantage', 'normal', 'advantage'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'rounded-[var(--radius-sm)] py-2 text-xs font-medium transition-colors',
              mode === m
                ? 'bg-[var(--surface-interactive)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)]',
            )}
          >
            {m === 'disadvantage' ? 'Desventaja' : m === 'normal' ? 'Normal' : 'Ventaja'}
          </button>
        ))}
      </div>

      <button
        onClick={doAttack}
        className="h-12 w-full rounded-[var(--radius-lg)] bg-crimson-gradient font-semibold text-[var(--accent-on)] shadow-[var(--shadow-crimson)] transition-[filter] hover:brightness-110"
      >
        Tirar ataque
      </button>

      {attackRoll && (
        <div className="mt-4 space-y-3">
          <RollDisplay result={attackRoll} rolling={false} />

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => doDamage(false)}
              className="h-11 rounded-[var(--radius-md)] border border-[var(--border-default)] text-sm font-medium transition-colors hover:bg-[var(--surface-interactive)]"
            >
              Tirar daño
            </button>
            <button
              onClick={() => doDamage(true)}
              className={cn(
                'h-11 rounded-[var(--radius-md)] text-sm font-medium transition-colors',
                attackRoll.critical === 'hit'
                  ? 'border border-[var(--legendary-text)]/50 bg-[var(--legendary-muted)] text-[var(--legendary-text)]'
                  : 'border border-[var(--border-default)] hover:bg-[var(--surface-interactive)]',
              )}
            >
              Daño crítico
            </button>
          </div>

          {damageRoll && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--danger-text)]/30 bg-[var(--danger-muted)] p-4 text-center">
              <p className="text-2xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Daño {damageTypeEs(attack.damageType)}
              </p>
              <p className="text-numeric mt-1 font-display text-4xl font-bold">{damageRoll.total}</p>
            </div>
          )}
        </div>
      )}

      {attack.ammunition && (
        <p className="mt-4 text-center text-xs text-[var(--text-tertiary)]">
          {autoAmmo
            ? `Se descuenta 1 de munición por ataque · quedan ${attack.ammunition.remaining}`
            : 'El consumo automático de munición está desactivado'}
        </p>
      )}
    </Sheet>
  );
}

/** RECURSOS (MASTER SPEC §22) — un solo modelo `current/maximum` para todo. */
function ResourcesSection({ sheet, dispatch }: { sheet: CharacterSheet; dispatch: DispatchFn }) {
  const usable = sheet.resources.filter((r) => r.maximum > 0);
  if (usable.length === 0) return null;

  return (
    <section>
      <SectionTitle>Recursos</SectionTitle>
      <div className="space-y-2">
        {usable.map((resource) => (
          <div
            key={resource.key}
            className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{resource.label}</p>
              <p className="truncate text-2xs text-[var(--text-tertiary)]">
                {resource.sourceLabel} ·{' '}
                {resource.recovery === 'shortRest' ? 'Descanso corto' : 'Descanso largo'}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => void dispatch({ type: 'SpendResource', key: resource.key, amount: 1 })}
                disabled={resource.current <= 0}
                aria-label={`Gastar ${resource.label}`}
                className="flex size-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-interactive)] disabled:opacity-35"
              >
                −
              </button>
              <span className="text-numeric w-12 text-center text-sm font-semibold">
                {resource.current}/{resource.maximum}
              </span>
              <button
                onClick={() => void dispatch({ type: 'RestoreResource', key: resource.key, amount: 1 })}
                disabled={resource.current >= resource.maximum}
                aria-label={`Recuperar ${resource.label}`}
                className="flex size-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-interactive)] disabled:opacity-35"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ConditionsSection({ sheet }: { sheet: CharacterSheet }) {
  return (
    <section>
      <SectionTitle
        action={
          <Link
            href={`/characters/${sheet.state.id}/manage/conditions`}
            className="text-xs text-[var(--accent-text)] hover:underline"
          >
            Gestionar
          </Link>
        }
      >
        Condiciones
      </SectionTitle>

      {sheet.activeConditions.length === 0 ? (
        <Card className="px-4 py-3">
          <p className="text-sm text-[var(--text-tertiary)]">Sin condiciones activas.</p>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {sheet.activeConditions.map((c) => (
            <Chip key={c.instanceId} tone="danger" className="px-3 py-1.5 text-xs">
              {c.name}
              {c.level != null && ` ${c.level}`}
            </Chip>
          ))}
        </div>
      )}
    </section>
  );
}
