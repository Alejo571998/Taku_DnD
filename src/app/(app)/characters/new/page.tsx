'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import {
  CREATION_STEPS,
  createCharacter,
  emptyDraft,
  validateStep,
  type CharacterDraft,
  type CreationStep,
} from '@application/services/character-factory';
import { cn } from '@ui/design-system/cn';
import { Button } from '@ui/design-system/Button';
import { LoadingState } from '@ui/design-system/primitives';
import {
  AbilitiesStep,
  BackgroundStep,
  ClassStep,
  ConceptStep,
  EquipmentStep,
  PersonalityStep,
  ProficienciesStep,
  ReviewStep,
  RulesStep,
  SpeciesStep,
  SpellsStep,
  SubclassStep,
} from '@ui/features/creator/steps';
import { characterService, useContentIndex, useRulesEngine, useWorkspaceId } from '@ui/hooks/useAppData';

/**
 * CREADOR DE PERSONAJE (MASTER SPEC §8)
 *
 * Asistente guiado con validación en tiempo real, explicaciones y vuelta
 * atrás libre. La recomendación NUNCA se convierte en decisión automática
 * irreversible: el sistema propone, el jugador elige.
 */

const STEP_LABELS: Record<CreationStep, string> = {
  rules: 'Reglas',
  concept: 'Concepto',
  species: 'Especie',
  class: 'Clase',
  subclass: 'Subclase',
  background: 'Trasfondo',
  abilities: 'Características',
  proficiencies: 'Competencias',
  equipment: 'Equipo',
  spells: 'Hechizos',
  personality: 'Personalidad',
  appearance: 'Apariencia',
  backstory: 'Historia',
  review: 'Revisión',
};

/** Lo que le falta al paso. El botón «Siguiente» lo apunta con `aria-describedby`. */
const MOTIVO_ID = 'creador-motivo';

export default function CreateCharacterPage() {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const [draft, setDraft] = useState<CharacterDraft>(() => emptyDraft('2014'));
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const content = useContentIndex(draft.ruleset);
  const engine = useRulesEngine(draft.ruleset);

  // Pasos que no aplican a este personaje se saltan: un mago no ve "Subclase"
  // a nivel 1, y un guerrero no ve "Hechizos".
  const steps = useMemo<CreationStep[]>(() => {
    if (!content) return [...CREATION_STEPS];
    const cls = content.class(draft.classId);
    return CREATION_STEPS.filter((step) => {
      if (step === 'subclass') return Boolean(cls) && draft.level >= (cls?.subclassLevel ?? 3);
      if (step === 'spells') return Boolean(cls?.spellcasting);
      return true;
    });
  }, [content, draft.classId, draft.level]);

  const step = steps[Math.min(stepIndex, steps.length - 1)] ?? 'rules';
  const validation = content ? validateStep(draft, step, content) : { complete: false, issues: [], step };

  if (!content) return <LoadingState label="Preparando el creador…" />;

  const isLast = stepIndex >= steps.length - 1;

  const next = () => {
    if (isLast) return;
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  };
  const back = () => setStepIndex((i) => Math.max(0, i - 1));

  const finish = async () => {
    setSaving(true);
    try {
      const character = createCharacter(draft, workspaceId, content, engine);
      await characterService().save(character);
      router.push(`/characters/${character.id}/play`);
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<CharacterDraft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <header className="mb-5 flex items-center gap-3">
        <button
          onClick={back}
          disabled={stepIndex === 0}
          aria-label="Paso anterior"
          className="flex size-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-interactive)] disabled:opacity-30"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="flex-1 font-display text-lg">Crear personaje</h1>
        <Link
          href="/characters"
          aria-label="Salir del creador"
          className="flex size-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-interactive)]"
        >
          <X className="size-5" />
        </Link>
      </header>

      <StepProgress steps={steps} current={stepIndex} labels={STEP_LABELS} onJump={setStepIndex} />

      <div className="mt-6 min-h-[22rem]">
        {step === 'rules' && <RulesStep draft={draft} update={update} />}
        {step === 'concept' && <ConceptStep draft={draft} update={update} />}
        {step === 'species' && <SpeciesStep draft={draft} update={update} content={content} />}
        {step === 'class' && <ClassStep draft={draft} update={update} content={content} />}
        {step === 'subclass' && <SubclassStep draft={draft} update={update} content={content} />}
        {step === 'background' && <BackgroundStep draft={draft} update={update} content={content} />}
        {step === 'abilities' && <AbilitiesStep draft={draft} update={update} content={content} />}
        {step === 'proficiencies' && <ProficienciesStep draft={draft} update={update} content={content} />}
        {step === 'equipment' && <EquipmentStep draft={draft} update={update} content={content} />}
        {step === 'spells' && <SpellsStep draft={draft} update={update} content={content} />}
        {step === 'personality' && <PersonalityStep draft={draft} update={update} content={content} />}
        {step === 'appearance' && <PersonalityStep draft={draft} update={update} content={content} appearance />}
        {step === 'backstory' && <PersonalityStep draft={draft} update={update} content={content} backstory />}
        {step === 'review' && <ReviewStep draft={draft} content={content} engine={engine} />}
      </div>

      {/*
        Validación en tiempo real: se explica qué falta ANTES de bloquear.

        `role="status"` para que el motivo se oiga cuando cambia —elegís una de
        las dos habilidades y pasa a «te falta 1»— y no solo cuando alguien
        tropieza con el texto. El id es el que apunta el botón de abajo.
      */}
      {!validation.complete && validation.issues.length > 0 && (
        <p
          id={MOTIVO_ID}
          role="status"
          aria-live="polite"
          className="mt-4 text-sm text-[var(--warning-text)]"
        >
          {validation.issues.map((i) => describeIssue(i.code, i.params)).join(' · ')}
        </p>
      )}

      <div className="sticky bottom-0 mt-6 flex gap-2.5 bg-gradient-to-t from-[var(--surface-base)] via-[var(--surface-base)] to-transparent pb-2 pt-4">
        {stepIndex > 0 && (
          <Button variant="secondary" size="lg" onClick={back} className="flex-1">
            Atrás
          </Button>
        )}
        {isLast ? (
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            loading={saving}
            onClick={() => void finish()}
            leading={<Check className="size-4" />}
          >
            Crear personaje
          </Button>
        ) : (
          /*
            `aria-disabled` y NO `disabled`.

            Un botón con `disabled` de verdad sale del recorrido por tabulador:
            quien no ve la pantalla llega al final del paso, no encuentra
            «Siguiente» por ningún lado y no tiene forma de saber que existe ni
            por qué no avanza. Con `aria-disabled` el botón sigue ahí, se
            escucha «Siguiente, no disponible», y `aria-describedby` lleva al
            motivo concreto —«Elegí una especie»— que está escrito arriba.

            El clic se corta acá porque `aria-disabled` no lo impide solo: es
            una promesa al lector de pantalla, no un candado del navegador.
          */
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            onClick={() => validation.complete && next()}
            aria-disabled={!validation.complete}
            aria-describedby={validation.complete ? undefined : MOTIVO_ID}
            trailing={<ArrowRight className="size-4" />}
          >
            Siguiente
          </Button>
        )}
      </div>
    </div>
  );
}

function StepProgress({
  steps,
  current,
  labels,
  onJump,
}: {
  steps: CreationStep[];
  current: number;
  labels: Record<CreationStep, string>;
  onJump: (i: number) => void;
}) {
  return (
    <div>
      {/*
        EN QUÉ PASO ESTÁS, DICHO EN VOZ ALTA

        El rótulo y el «3 de 12» son dos párrafos sueltos: al avanzar, el paso
        cambiaba sin que se anunciara nada, y quien no ve la pantalla se
        quedaba sin saber si el botón había hecho algo.

        Va en una región aparte y como UNA frase. Envolver los dos párrafos
        visibles daría «Especie 3 de 12», que leído en voz alta no se entiende.
      */}
      <p className="sr-only" role="status" aria-live="polite">
        {`Paso ${current + 1} de ${steps.length}: ${labels[steps[current] ?? 'rules']}`}
      </p>

      <div aria-hidden className="mb-2 flex items-baseline justify-between">
        <p className="font-display text-sm">{labels[steps[current] ?? 'rules']}</p>
        <p className="text-numeric text-2xs text-[var(--text-tertiary)]">
          {current + 1} de {steps.length}
        </p>
      </div>
      <div className="flex gap-1">
        {steps.map((s, i) => (
          <button
            key={s}
            onClick={() => i <= current && onJump(i)}
            disabled={i > current}
            aria-label={`Ir a ${labels[s]}`}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-200',
              i < current
                ? 'bg-[var(--accent)]'
                : i === current
                  ? 'bg-crimson-gradient'
                  : 'bg-[var(--surface-interactive)]',
              i <= current && 'cursor-pointer',
            )}
          />
        ))}
      </div>
    </div>
  );
}

const ISSUE_MESSAGES: Record<string, (p?: Record<string, string | number>) => string> = {
  'creator.name.required': () => 'Poné un nombre para continuar',
  'creator.species.required': () => 'Elegí una especie',
  'creator.subspecies.required': () => 'Esta especie tiene linajes: elegí uno',
  'creator.class.required': () => 'Elegí una clase',
  'creator.subclass.required': (p) => `A nivel ${p?.level ?? 3} te toca elegir subclase`,
  'creator.background.required': () => 'Elegí un trasfondo',
  'creator.abilities.unassigned': () => 'Asigná tus características',
  'creator.skills.remaining': (p) => `Te faltan ${p?.remaining ?? 0} habilidades por elegir`,
  'creator.cantrips.remaining': (p) => `Te faltan ${p?.remaining ?? 0} trucos por elegir`,
};

const describeIssue = (code: string, params?: Record<string, string | number>): string =>
  ISSUE_MESSAGES[code]?.(params) ?? 'Falta completar este paso';
