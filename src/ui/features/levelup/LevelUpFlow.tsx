'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Dices, Minus, Plus, Sparkles, TrendingUp } from 'lucide-react';
import {
  ABILITIES,
  ABILITY_ABBR_ES,
  ABILITY_NAME_ES,
  DEFAULT_ABILITY_CAP,
  type AbilityId,
  type AbilityScores,
} from '@domain/character/ability';
import type { CharacterSheet } from '@domain/character/sheet';
import {
  checkMulticlassPrerequisites,
  experienceProgress,
  planLevelUp,
  validateLevelUp,
  type AbilityImprovement,
  type HitPointMethod,
  type LevelUpChoice,
  type LevelUpPlan,
} from '@domain/character/progression';
import type { ClassDefinition, ContentIndex, SpellDefinition } from '@domain/content';
import { rollDie } from '@domain/dice/roller';
import type { DefinitionId } from '@domain/shared/ids';
import { isErr, isOk } from '@domain/shared/result';
import { cn } from '@ui/design-system/cn';
import { Button } from '@ui/design-system/Button';
import { Card, Chip, SectionTitle } from '@ui/design-system/primitives';
import type { DispatchFn } from '@ui/hooks/useAppData';
import { REACTIONS } from '@ui/features/taku/lines';
import { useTaku } from '@ui/features/taku/TakuProvider';

/**
 * SUBIDA DE NIVEL (MASTER SPEC §29)
 *
 * El dominio dice QUÉ cambia; esta pantalla solo lo muestra y recoge las
 * decisiones. No hay una sola regla de D&D escrita aquí — si la hubiera,
 * acabaría contradiciendo al motor.
 *
 * Las secciones que no requieren decisión no se muestran. Un guerrero de
 * nivel 2 a 3 sin subclase pendiente sube con un solo toque.
 */

type Props = {
  sheet: CharacterSheet;
  content: ContentIndex;
  dispatch: DispatchFn;
};

export function LevelUpFlow({ sheet, content, dispatch }: Props) {
  const router = useRouter();
  const state = sheet.state;

  const effectiveScores = useMemo<AbilityScores>(() => {
    const out = {} as { -readonly [K in keyof AbilityScores]: number };
    for (const id of ABILITIES) out[id] = sheet.abilities[id].score.value;
    return out;
  }, [sheet]);

  // ── Clase a subir ─────────────────────────────────────────────────────────
  const ownClasses = state.classes;
  const [classId, setClassId] = useState<DefinitionId>(
    (ownClasses.find((c) => c.isPrimary) ?? ownClasses[0])?.classId ?? ('' as DefinitionId),
  );

  const planned = useMemo(
    () => (classId ? planLevelUp(state, classId, content, effectiveScores) : null),
    [state, classId, content, effectiveScores],
  );

  // ── Decisiones ────────────────────────────────────────────────────────────
  const [hitPointMethod, setHitPointMethod] = useState<HitPointMethod>(
    state.hitPoints.mode === 'manual' ? 'manual' : state.hitPoints.mode === 'rolled' ? 'roll' : 'average',
  );
  const [rolled, setRolled] = useState<number | null>(null);
  const [manualMax, setManualMax] = useState<number>(sheet.hitPoints.max.value);
  const [subclassId, setSubclassId] = useState<DefinitionId | undefined>(undefined);
  const [improvementKind, setImprovementKind] = useState<'abilities' | 'feat'>('abilities');
  const [increases, setIncreases] = useState<Partial<Record<AbilityId, number>>>({});
  const [featId, setFeatId] = useState<DefinitionId | undefined>(undefined);
  const [cantrips, setCantrips] = useState<DefinitionId[]>([]);
  const [spells, setSpells] = useState<DefinitionId[]>([]);
  const [saving, setSaving] = useState(false);
  const { offer } = useTaku();

  const plan = planned && isOk(planned) ? planned.value : null;

  const improvement = useMemo<AbilityImprovement | undefined>(() => {
    if (!plan?.grantsAbilityScoreImprovement) return undefined;
    if (improvementKind === 'feat') return featId ? { kind: 'feat', featId } : undefined;
    const entries = ABILITIES.map((ability) => ({ ability, amount: increases[ability] ?? 0 })).filter(
      (e) => e.amount > 0,
    );
    return { kind: 'abilities', increases: entries };
  }, [plan, improvementKind, featId, increases]);

  const choice = useMemo<LevelUpChoice>(
    () => ({
      hitPointMethod,
      ...(hitPointMethod === 'roll' && rolled !== null
        ? { hitPointValue: rolled }
        : hitPointMethod === 'manual'
          ? { hitPointValue: manualMax }
          : {}),
      ...(subclassId ? { subclassId } : {}),
      ...(improvement ? { improvement } : {}),
      cantrips,
      spells,
    }),
    [hitPointMethod, rolled, manualMax, subclassId, improvement, cantrips, spells],
  );

  const issues = useMemo(
    () => (plan ? validateLevelUp(plan, choice, effectiveScores, content) : []),
    [plan, choice, effectiveScores, content],
  );

  if (planned && isErr(planned)) {
    return (
      <Card>
        <p className="text-sm text-[var(--text-secondary)]">
          {planned.error.code === 'level.outOfRange'
            ? 'Este personaje ya está en el nivel 20. No hay más que subir.'
            : 'No podemos subir de nivel con esta clase todavía.'}
        </p>
      </Card>
    );
  }

  if (!plan) return null;

  const spentPoints = ABILITIES.reduce((sum, a) => sum + (increases[a] ?? 0), 0);
  const blocked = issues.length > 0;

  const confirm = async () => {
    setSaving(true);
    const okDone = await dispatch({
      type: 'ApplyLevelUp',
      classId: plan.classId,
      hitPointMethod,
      ...(choice.hitPointValue !== undefined ? { hitPointValue: choice.hitPointValue } : {}),
      ...(subclassId ? { subclassId } : {}),
      ...(improvement ? { improvement } : {}),
      cantrips,
      spells,
    });
    setSaving(false);
    if (!okDone) return;

    // Se ofrece ANTES de navegar: el proveedor vive por encima de la ruta, así
    // que la frase aparece ya en Gestión, junto al nivel nuevo.
    offer(REACTIONS.leveledUp(state.name, plan.toTotalLevel));
    router.push(`/characters/${state.id}/manage`);
  };

  return (
    <div className="space-y-6 pb-28">
      <Summary sheet={sheet} plan={plan} />

      <ClassPicker
        sheet={sheet}
        content={content}
        effectiveScores={effectiveScores}
        selected={classId}
        onSelect={(id) => {
          setClassId(id);
          setSubclassId(undefined);
          setCantrips([]);
          setSpells([]);
        }}
      />

      <Gains plan={plan} />

      <HitPointsChoice
        plan={plan}
        method={hitPointMethod}
        onMethod={(m) => {
          setHitPointMethod(m);
          if (m !== 'roll') setRolled(null);
        }}
        rolled={rolled}
        onRoll={() => setRolled(rollDie(plan.hitDie))}
        manualMax={manualMax}
        onManualMax={setManualMax}
        currentMax={sheet.hitPoints.max.value}
      />

      {plan.requiresSubclass && (
        <SubclassChoice plan={plan} selected={subclassId} onSelect={setSubclassId} />
      )}

      {plan.grantsAbilityScoreImprovement && (
        <ImprovementChoice
          content={content}
          kind={improvementKind}
          onKind={setImprovementKind}
          increases={increases}
          spent={spentPoints}
          onIncrease={(ability, delta) =>
            setIncreases((prev) => {
              const next = Math.max(0, Math.min(2, (prev[ability] ?? 0) + delta));
              return { ...prev, [ability]: next };
            })
          }
          effectiveScores={effectiveScores}
          featId={featId}
          onFeat={setFeatId}
        />
      )}

      {plan.spellcasting && (plan.spellcasting.cantripsToLearn > 0 || plan.spellcasting.spellsToLearn > 0) && (
        <SpellChoice
          plan={plan}
          content={content}
          known={new Set(state.spells.known.map((k) => k.definitionId as string))}
          cantrips={cantrips}
          spells={spells}
          onToggleCantrip={(id) =>
            setCantrips((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
          onToggleSpell={(id) =>
            setSpells((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
        />
      )}

      <ConfirmBar
        plan={plan}
        issues={issues}
        blocked={blocked}
        saving={saving}
        onConfirm={() => void confirm()}
      />
    </div>
  );
}

// ── Resumen ──────────────────────────────────────────────────────────────────

function Summary({ sheet, plan }: { sheet: CharacterSheet; plan: LevelUpPlan }) {
  const xp = experienceProgress(sheet.state.experience);
  const earned = xp.level >= plan.toTotalLevel;

  return (
    <Card>
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-crimson-gradient shadow-[var(--shadow-crimson)]">
          <TrendingUp className="size-6 text-[var(--accent-on)]" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl leading-tight">Subir a nivel {plan.toTotalLevel}</h1>
          <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">
            {plan.isNewClass
              ? `Empezás ${plan.className} como segunda clase`
              : `${plan.className} ${plan.fromClassLevel} → ${plan.toClassLevel}`}
          </p>
        </div>
      </div>

      {/*
        La experiencia INFORMA, nunca bloquea: la mayoría de las mesas sube
        por hitos y el sistema no tiene por qué discutirlo (MASTER SPEC §29).
      */}
      <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-3.5 py-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-[var(--text-tertiary)]">Experiencia</span>
          <span className="text-numeric text-[var(--text-secondary)]">
            {xp.current.toLocaleString('es-419')}
            {xp.nextLevelAt != null && ` / ${xp.nextLevelAt.toLocaleString('es-419')}`}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
          {earned
            ? 'Ya tenés la experiencia para este nivel.'
            : `Te faltan ${xp.remaining.toLocaleString('es-419')} PX, pero podés subir igual si tu mesa juega por hitos.`}
        </p>
      </div>
    </Card>
  );
}

// ── Clase ────────────────────────────────────────────────────────────────────

function ClassPicker({
  sheet,
  content,
  effectiveScores,
  selected,
  onSelect,
}: {
  sheet: CharacterSheet;
  content: ContentIndex;
  effectiveScores: AbilityScores;
  selected: DefinitionId;
  onSelect: (id: DefinitionId) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const own = sheet.state.classes;

  const others = useMemo(
    () =>
      content
        .classes()
        .filter((c) => !own.some((o) => o.classId === c.id))
        .map((c) => ({ def: c, check: checkMulticlassPrerequisites(c, effectiveScores) }))
        .sort((a, b) => Number(b.check.allowed) - Number(a.check.allowed) || a.def.name.localeCompare(b.def.name)),
    [content, own, effectiveScores],
  );

  // Con una sola clase y sin intención de multiclasear, esto no es una
  // decisión: es ruido. Se muestra plegado.
  if (own.length === 1 && !showAll) {
    return (
      <section>
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-[var(--text-tertiary)] underline underline-offset-4 hover:text-[var(--text-secondary)]"
        >
          Subir en otra clase (multiclase)
        </button>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle>¿En qué clase subís?</SectionTitle>
      <div className="space-y-2">
        {own.map((entry) => {
          const def = content.class(entry.classId);
          return (
            <ClassRow
              key={entry.classId}
              name={def?.name ?? 'Clase'}
              detail={`Nivel ${entry.level} → ${entry.level + 1} · d${def?.hitDie ?? 8}`}
              active={selected === entry.classId}
              onClick={() => onSelect(entry.classId)}
            />
          );
        })}

        {others.length > 0 && (
          <p className="pt-2 text-2xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Multiclase</p>
        )}
        {others.map(({ def, check }) => (
          <ClassRow
            key={def.id}
            name={def.name}
            detail={
              check.allowed
                ? `Nivel 1 · d${def.hitDie}`
                : check.missing
                    .map((m) => `Necesita ${ABILITY_ABBR_ES[m.ability]} ${m.minimum} (tenés ${m.actual})`)
                    .join(' · ')
            }
            active={selected === def.id}
            disabled={!check.allowed}
            onClick={() => onSelect(def.id as DefinitionId)}
          />
        ))}
      </div>
    </section>
  );
}

function ClassRow({
  name,
  detail,
  active,
  disabled,
  onClick,
}: {
  name: string;
  detail: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center gap-3 rounded-[var(--radius-lg)] border p-3 text-left transition-[border-color,transform]',
        disabled
          ? 'cursor-not-allowed border-[var(--border-subtle)] opacity-45'
          : active
            ? 'border-[var(--accent)] bg-[var(--accent-muted)]'
            : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-accent)] active:scale-[0.99]',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{name}</span>
        <span className="block text-xs text-[var(--text-tertiary)]">{detail}</span>
      </span>
      {active && <Check className="size-4 shrink-0 text-[var(--accent-text)]" strokeWidth={2.5} />}
    </button>
  );
}

// ── Lo que ganás ─────────────────────────────────────────────────────────────

function Gains({ plan }: { plan: LevelUpPlan }) {
  const slotsChanged =
    plan.spellcasting &&
    JSON.stringify(plan.spellcasting.slotsBefore) !== JSON.stringify(plan.spellcasting.slotsAfter);

  return (
    <section>
      <SectionTitle>Lo que ganás</SectionTitle>
      <div className="space-y-2.5">
        {plan.proficiencyBonusAfter !== plan.proficiencyBonusBefore && (
          <GainRow
            label="Bonificador de competencia"
            value={`+${plan.proficiencyBonusBefore} → +${plan.proficiencyBonusAfter}`}
            tone="accent"
          />
        )}

        {plan.newFeatures.map((f) => (
          <Card key={f.id} className="p-3.5">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--accent-text)]" strokeWidth={2} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{f.name}</p>
                {f.description[0] && (
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">
                    {f.description[0]}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}

        {plan.resourceChanges.map((r) => (
          <GainRow
            key={r.key}
            label={r.key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
            value={r.before === 0 ? `${r.after}` : `${r.before} → ${r.after}`}
          />
        ))}

        {slotsChanged && plan.spellcasting && (
          <GainRow
            label="Espacios de conjuro"
            value={plan.spellcasting.slotsAfter
              .map((count, i) => (count > 0 ? `N${i + 1}:${count}` : null))
              .filter(Boolean)
              .join('  ')}
            tone="arcane"
          />
        )}

        {plan.newFeatures.length === 0 &&
          plan.resourceChanges.length === 0 &&
          plan.proficiencyBonusAfter === plan.proficiencyBonusBefore &&
          !slotsChanged && (
            <p className="text-sm text-[var(--text-tertiary)]">
              Este nivel no trae rasgos nuevos: solo puntos de golpe y dados de golpe.
            </p>
          )}
      </div>
    </section>
  );
}

function GainRow({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'accent' | 'arcane' }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-2.5">
      <span className="min-w-0 truncate text-sm text-[var(--text-secondary)]">{label}</span>
      <Chip tone={tone} className="shrink-0">
        {value}
      </Chip>
    </div>
  );
}

// ── Puntos de golpe ──────────────────────────────────────────────────────────

function HitPointsChoice({
  plan,
  method,
  onMethod,
  rolled,
  onRoll,
  manualMax,
  onManualMax,
  currentMax,
}: {
  plan: LevelUpPlan;
  method: HitPointMethod;
  onMethod: (m: HitPointMethod) => void;
  rolled: number | null;
  onRoll: () => void;
  manualMax: number;
  onManualMax: (v: number) => void;
  currentMax: number;
}) {
  const conLabel = plan.constitutionModifier >= 0 ? `+${plan.constitutionModifier}` : `${plan.constitutionModifier}`;

  return (
    <section>
      <SectionTitle>Puntos de golpe</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-3">
        <MethodButton
          active={method === 'average'}
          onClick={() => onMethod('average')}
          title="Promedio fijo"
          detail={`+${plan.averageHitPointGain} PG`}
        />
        <MethodButton
          active={method === 'roll'}
          onClick={() => onMethod('roll')}
          title={`Tirar d${plan.hitDie}`}
          detail={rolled !== null ? `+${Math.max(1, rolled + plan.constitutionModifier)} PG` : 'Sin tirar'}
        />
        <MethodButton
          active={method === 'manual'}
          onClick={() => onMethod('manual')}
          title="Máximo manual"
          detail="Lo fijás vos"
        />
      </div>

      <p className="mt-2 text-xs text-[var(--text-tertiary)]">
        Dado d{plan.hitDie} · Constitución {conLabel} · mínimo 1 PG por nivel.
      </p>

      {method === 'roll' && (
        <div className="mt-3 flex items-center gap-3">
          <Button variant="secondary" onClick={onRoll}>
            <Dices className="size-4" />
            {rolled === null ? 'Tirar' : 'Volver a tirar'}
          </Button>
          {rolled !== null && (
            <p className="text-sm">
              <span className="text-numeric font-display text-2xl font-bold">{rolled}</span>
              <span className="ml-2 text-[var(--text-tertiary)]">
                {conLabel} = +{Math.max(1, rolled + plan.constitutionModifier)} PG
              </span>
            </p>
          )}
        </div>
      )}

      {method === 'manual' && (
        <div className="mt-3">
          <label className="block text-xs text-[var(--text-tertiary)]" htmlFor="manual-max">
            Máximo total de PG al llegar al nivel {plan.toTotalLevel}
          </label>
          <input
            id="manual-max"
            type="number"
            inputMode="numeric"
            min={1}
            value={manualMax}
            onChange={(e) => onManualMax(Number(e.target.value))}
            className="text-numeric mt-1.5 h-11 w-32 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 text-sm outline-none focus:border-[var(--accent)]"
          />
          <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">Ahora tenés {currentMax}.</p>
        </div>
      )}
    </section>
  );
}

function MethodButton({
  active,
  onClick,
  title,
  detail,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-[var(--radius-lg)] border p-3 text-left transition-[border-color,transform] active:scale-[0.99]',
        active
          ? 'border-[var(--accent)] bg-[var(--accent-muted)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-accent)]',
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="block text-xs text-[var(--text-tertiary)]">{detail}</span>
    </button>
  );
}

// ── Subclase ─────────────────────────────────────────────────────────────────

function SubclassChoice({
  plan,
  selected,
  onSelect,
}: {
  plan: LevelUpPlan;
  selected: DefinitionId | undefined;
  onSelect: (id: DefinitionId) => void;
}) {
  return (
    <section>
      <SectionTitle>Elegí tu subclase</SectionTitle>
      <p className="mb-3 text-xs text-[var(--text-tertiary)]">
        Esta decisión define el resto de la carrera de tu {plan.className}. Se puede cambiar después desde
        Gestión, pero no en mitad de una sesión.
      </p>
      <div className="space-y-2">
        {plan.subclassOptions.map((sub) => (
          <button
            key={sub.id}
            onClick={() => onSelect(sub.id as DefinitionId)}
            aria-pressed={selected === sub.id}
            className={cn(
              'block w-full rounded-[var(--radius-lg)] border p-3.5 text-left transition-[border-color,transform] active:scale-[0.99]',
              selected === sub.id
                ? 'border-[var(--accent)] bg-[var(--accent-muted)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-accent)]',
            )}
          >
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium">{sub.name}</span>
              {selected === sub.id && <Check className="size-4 text-[var(--accent-text)]" strokeWidth={2.5} />}
            </span>
            {sub.description[0] && (
              <span className="mt-1 block text-xs leading-relaxed text-[var(--text-tertiary)]">
                {sub.description[0]}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

// ── Mejora de característica o dote ──────────────────────────────────────────

function ImprovementChoice({
  content,
  kind,
  onKind,
  increases,
  spent,
  onIncrease,
  effectiveScores,
  featId,
  onFeat,
}: {
  content: ContentIndex;
  kind: 'abilities' | 'feat';
  onKind: (k: 'abilities' | 'feat') => void;
  increases: Partial<Record<AbilityId, number>>;
  spent: number;
  onIncrease: (ability: AbilityId, delta: number) => void;
  effectiveScores: AbilityScores;
  featId: DefinitionId | undefined;
  onFeat: (id: DefinitionId) => void;
}) {
  const feats = useMemo(
    () => [...content.all('feat')].sort((a, b) => a.name.localeCompare(b.name)),
    [content],
  );

  return (
    <section>
      <SectionTitle>Mejora de característica</SectionTitle>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-1">
        {(['abilities', 'feat'] as const).map((k) => (
          <button
            key={k}
            onClick={() => onKind(k)}
            aria-pressed={kind === k}
            className={cn(
              'rounded-[var(--radius-md)] py-2 text-center text-sm font-medium transition-all',
              kind === k
                ? 'bg-crimson-gradient text-[var(--accent-on)] shadow-[var(--shadow-crimson)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
            )}
          >
            {k === 'abilities' ? '+2 en características' : 'Una dote'}
          </button>
        ))}
      </div>

      {kind === 'abilities' ? (
        <>
          <p className="mb-2 text-xs text-[var(--text-tertiary)]">
            Repartí 2 puntos: +2 en una característica o +1 en dos. El tope es {DEFAULT_ABILITY_CAP}.
            {spent < 2 && ` Te quedan ${2 - spent}.`}
          </p>
          <div className="space-y-2">
            {ABILITIES.map((ability) => {
              const added = increases[ability] ?? 0;
              const base = effectiveScores[ability];
              const atCap = base + added >= DEFAULT_ABILITY_CAP;
              return (
                <div
                  key={ability}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{ABILITY_NAME_ES[ability]}</span>
                    <span className="text-numeric block text-xs text-[var(--text-tertiary)]">
                      {base}
                      {added > 0 && ` → ${base + added}`}
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      aria-label={`Quitar punto de ${ABILITY_NAME_ES[ability]}`}
                      disabled={added === 0}
                      onClick={() => onIncrease(ability, -1)}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="text-numeric w-6 text-center text-sm font-medium">+{added}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      aria-label={`Sumar punto a ${ABILITY_NAME_ES[ability]}`}
                      disabled={spent >= 2 || added >= 2 || atCap}
                      onClick={() => onIncrease(ability, 1)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto scrollbar-slim pr-1">
          {feats.map((feat) => (
            <button
              key={feat.id}
              onClick={() => onFeat(feat.id as DefinitionId)}
              aria-pressed={featId === feat.id}
              className={cn(
                'block w-full rounded-[var(--radius-md)] border p-3 text-left transition-colors',
                featId === feat.id
                  ? 'border-[var(--accent)] bg-[var(--accent-muted)]'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-accent)]',
              )}
            >
              <span className="text-sm font-medium">{feat.name}</span>
              {feat.description[0] && (
                <span className="mt-1 line-clamp-2 block text-xs text-[var(--text-tertiary)]">
                  {feat.description[0]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Conjuros ─────────────────────────────────────────────────────────────────

function SpellChoice({
  plan,
  content,
  known,
  cantrips,
  spells,
  onToggleCantrip,
  onToggleSpell,
}: {
  plan: LevelUpPlan;
  content: ContentIndex;
  known: Set<string>;
  cantrips: DefinitionId[];
  spells: DefinitionId[];
  onToggleCantrip: (id: DefinitionId) => void;
  onToggleSpell: (id: DefinitionId) => void;
}) {
  const sc = plan.spellcasting!;
  const available = useMemo(
    () => content.spellsForClass(sc.classSlug).filter((s) => !known.has(s.id)),
    [content, sc.classSlug, known],
  );

  const cantripPool = available.filter((s) => s.level === 0);
  const spellPool = available.filter((s) => s.level > 0 && s.level <= sc.maxSpellLevel);

  return (
    <section>
      <SectionTitle>Conjuros nuevos</SectionTitle>
      {sc.cantripsToLearn > 0 && (
        <SpellList
          label={`Trucos (${cantrips.length}/${sc.cantripsToLearn})`}
          pool={cantripPool}
          chosen={cantrips}
          limit={sc.cantripsToLearn}
          onToggle={onToggleCantrip}
        />
      )}
      {sc.spellsToLearn > 0 && (
        <SpellList
          label={`Conjuros (${spells.length}/${sc.spellsToLearn})`}
          pool={spellPool}
          chosen={spells}
          limit={sc.spellsToLearn}
          onToggle={onToggleSpell}
        />
      )}
      {sc.preparesSpells && (
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">
          Tu clase prepara conjuros de la lista completa: no hace falta elegirlos acá. Los preparás antes de
          cada aventura desde Gestión · Hechizos.
        </p>
      )}
    </section>
  );
}

function SpellList({
  label,
  pool,
  chosen,
  limit,
  onToggle,
}: {
  label: string;
  pool: readonly SpellDefinition[];
  chosen: readonly DefinitionId[];
  limit: number;
  onToggle: (id: DefinitionId) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? pool.filter((s) => s.name.toLowerCase().includes(q)) : pool;
    return [...base].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)).slice(0, 80);
  }, [pool, query]);

  return (
    <div className="mb-4">
      <p className="mb-2 text-sm font-medium">{label}</p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar…"
        aria-label={`Buscar en ${label}`}
        className="mb-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
      />
      <div className="max-h-72 space-y-1.5 overflow-y-auto scrollbar-slim pr-1">
        {filtered.map((spell) => {
          const active = chosen.includes(spell.id as DefinitionId);
          const full = chosen.length >= limit && !active;
          return (
            <button
              key={spell.id}
              onClick={() => onToggle(spell.id as DefinitionId)}
              disabled={full}
              aria-pressed={active}
              className={cn(
                'flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors',
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-muted)]'
                  : full
                    ? 'cursor-not-allowed border-[var(--border-subtle)] opacity-40'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-accent)]',
              )}
            >
              <span className="min-w-0 flex-1 truncate text-sm">{spell.name}</span>
              <Chip tone="neutral" className="shrink-0">
                {spell.level === 0 ? 'Truco' : `N${spell.level}`}
              </Chip>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">Nada que elegir acá.</p>
        )}
      </div>
    </div>
  );
}

// ── Confirmación ─────────────────────────────────────────────────────────────

const ISSUE_TEXT: Record<string, (p?: Record<string, string | number>) => string> = {
  'levelUp.roll.outOfRange': (p) => `Tirá el d${p?.die ?? 8} para saber cuántos PG ganás.`,
  'levelUp.manual.invalid': () => 'Escribí un máximo de PG válido.',
  'levelUp.subclass.required': () => 'Te falta elegir subclase.',
  'levelUp.improvement.required': () => 'Elegí entre subir características o tomar una dote.',
  'levelUp.improvement.mustSpendTwo': (p) => `Repartiste ${p?.total ?? 0} de 2 puntos.`,
  'levelUp.improvement.overCap': (p) => `${ABILITY_NAME_ES[p?.ability as AbilityId] ?? 'Esa característica'} pasaría de ${p?.cap ?? 20}.`,
  'levelUp.feat.unknown': () => 'Elegí una dote.',
  'levelUp.cantrips.count': (p) => `Elegí ${p?.expected ?? 0} trucos (llevás ${p?.chosen ?? 0}).`,
  'levelUp.spells.count': (p) => `Elegí ${p?.expected ?? 0} conjuros (llevás ${p?.chosen ?? 0}).`,
  'levelUp.spell.tooHigh': (p) => `${p?.name ?? 'Ese conjuro'} es de nivel ${p?.level ?? '?'} y llegás a ${p?.max ?? 0}.`,
};

function ConfirmBar({
  plan,
  issues,
  blocked,
  saving,
  onConfirm,
}: {
  plan: LevelUpPlan;
  issues: readonly { code: string; params?: Record<string, string | number> }[];
  blocked: boolean;
  saving: boolean;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-x-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--surface-overlay)]/95 px-4 py-3 backdrop-blur-xl lg:left-[var(--sidebar-width)]"
      style={{ bottom: 'var(--nav-offset)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 lg:px-4">
        <div className="min-w-0 flex-1">
          {blocked ? (
            <p className="truncate text-xs text-[var(--warning-text)]">
              {ISSUE_TEXT[issues[0]!.code]?.(issues[0]!.params) ?? 'Faltan decisiones.'}
              {issues.length > 1 && ` (+${issues.length - 1})`}
            </p>
          ) : (
            <p className="truncate text-xs text-[var(--text-tertiary)]">
              {plan.className} {plan.toClassLevel} · nivel {plan.toTotalLevel} · +{plan.averageHitPointGain} PG
            </p>
          )}
        </div>
        <Button variant="primary" disabled={blocked} loading={saving} onClick={onConfirm}>
          Subir de nivel
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** Reexportado para que la página no tenga que conocer el tipo de contenido. */
export type { ClassDefinition };
