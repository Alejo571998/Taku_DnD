'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Plus, Search } from 'lucide-react';
import type { AnyDefinition } from '@domain/content/schemas';
import { isItemDefinition } from '@domain/content/schemas';
import { decideCompatibility } from '@domain/rules/compatibility';
import { RULESET_LABEL, type CompatibilityOption } from '@domain/rules/ruleset';
import type { CharacterState } from '@domain/character/state';
import type { DefinitionId } from '@domain/shared/ids';
import { cn } from '@ui/design-system/cn';
import { Button } from '@ui/design-system/Button';
import { Chip, EmptyState } from '@ui/design-system/primitives';
import { Sheet } from '@ui/design-system/Sheet';
import { useCharacters, useContentIndex, useDispatch } from '@ui/hooks/useAppData';

/**
 * AÑADIR CONTENIDO DE LA BIBLIOTECA A UN PERSONAJE
 *
 * Es también el único sitio donde dos ediciones pueden cruzarse, así que es
 * donde vive la decisión de compatibilidad. La regla no es "nunca mezclar":
 * es "nunca mezclar EN SILENCIO" (MASTER SPEC §4).
 *
 * El dominio ya calculaba el veredicto y las opciones; acá solo se muestran.
 */

const ADDABLE = new Set(['weapon', 'armor', 'gear', 'magicItem', 'spell']);

export function AddToCharacterButton({ definition }: { definition: AnyDefinition }) {
  const [open, setOpen] = useState(false);
  const characters = useCharacters();

  if (!ADDABLE.has(definition.type)) return null;
  if (!characters || characters.length === 0) return null;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Añadir a un personaje
      </Button>
      <AddSheet definition={definition} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

type Step =
  | { kind: 'pick' }
  | { kind: 'compatibility'; character: CharacterState }
  | { kind: 'done'; characterName: string };

function AddSheet({
  definition,
  open,
  onClose,
}: {
  definition: AnyDefinition;
  open: boolean;
  onClose: () => void;
}) {
  const characters = useCharacters() ?? [];
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [target, setTarget] = useState<CharacterState | null>(null);

  const close = () => {
    setStep({ kind: 'pick' });
    setTarget(null);
    onClose();
  };

  /**
   * Elegir personaje es tambien el momento de comprobar la edicion: si no
   * encaja, la decision aparece AHI, no despues de haberlo añadido.
   */
  const choose = (character: CharacterState) => {
    setTarget(character);
    if (!definition.rulesets.includes(character.ruleset)) {
      setStep({ kind: 'compatibility', character });
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && close()} title={`Añadir ${definition.name}`} size="md">
      {step.kind === 'done' ? (
        <div className="py-6 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--success-muted)]">
            <Check className="size-5 text-[var(--success-text)]" strokeWidth={2.4} />
          </span>
          <p className="text-sm">
            {definition.name} está ahora en la ficha de{' '}
            <strong className="font-medium">{step.characterName}</strong>.
          </p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={close}>
            Cerrar
          </Button>
        </div>
      ) : step.kind === 'compatibility' ? (
        <CompatibilityStep
          definition={definition}
          character={step.character}
          onCancel={() => setStep({ kind: 'pick' })}
          onDone={(name) => setStep({ kind: 'done', characterName: name })}
        />
      ) : (
        <CharacterPicker
          characters={characters}
          definition={definition}
          selected={target}
          onChoose={choose}
          onDone={(name) => setStep({ kind: 'done', characterName: name })}
        />
      )}
    </Sheet>
  );
}

function CharacterPicker({
  characters,
  definition,
  selected,
  onChoose,
  onDone,
}: {
  characters: readonly CharacterState[];
  definition: AnyDefinition;
  selected: CharacterState | null;
  onChoose: (c: CharacterState) => void;
  onDone: (name: string) => void;
}) {
  const dispatch = useDispatch(selected);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!selected) return;
    setBusy(true);
    const ok = await dispatch(commandFor(definition));
    setBusy(false);
    if (ok) onDone(selected.name);
  };

  if (characters.length === 0) {
    return (
      <EmptyState
        icon={<Search className="size-6" strokeWidth={1.8} />}
        title="Todavía no tenés personajes"
        description="Creá uno y vas a poder añadirle objetos y conjuros desde acá."
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">¿A quién se lo damos?</p>

      <ul className="space-y-2">
        {characters.map((character) => {
          const compatible = definition.rulesets.includes(character.ruleset);
          const active = selected?.id === character.id;
          return (
            <li key={character.id}>
              <button
                onClick={() => onChoose(character)}
                aria-pressed={active}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[var(--radius-lg)] border p-3 text-left transition-[border-color,transform] active:scale-[0.99]',
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-muted)]'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-accent)]',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{character.name}</span>
                  <span className="block text-xs text-[var(--text-tertiary)]">
                    Reglas {character.ruleset}
                  </span>
                </span>
                {!compatible && (
                  <Chip tone="warning" className="shrink-0">
                    Otra edición
                  </Chip>
                )}
                {active && <Check className="size-4 shrink-0 text-[var(--accent-text)]" strokeWidth={2.5} />}
              </button>
            </li>
          );
        })}
      </ul>

      <Button
        variant="primary"
        className="w-full"
        disabled={!selected}
        loading={busy}
        onClick={() => void add()}
      >
        Añadir
      </Button>
    </div>
  );
}

/**
 * LA DECISIÓN (MASTER SPEC §4)
 *
 * Tres opciones, siempre las mismas, en el mismo orden:
 *   1. buscar el equivalente en su edición  ← lo correcto casi siempre
 *   2. usarlo igual                          ← legítimo, y queda registrado
 *   3. cancelar
 */
function CompatibilityStep({
  definition,
  character,
  onCancel,
  onDone,
}: {
  definition: AnyDefinition;
  character: CharacterState;
  onCancel: () => void;
  onDone: (name: string) => void;
}) {
  const content = useContentIndex(character.ruleset);
  const dispatch = useDispatch(character);
  const [busy, setBusy] = useState<CompatibilityOption | null>(null);

  const decision = useMemo(
    () => (content ? decideCompatibility(definition, character.ruleset, content) : null),
    [definition, character.ruleset, content],
  );

  if (!decision) return null;
  const alternative = decision.alternative;

  const applyAlternative = async () => {
    if (!alternative) return;
    setBusy('findAlternative');
    const ok = await dispatch(commandFor(alternative));
    setBusy(null);
    if (ok) onDone(character.name);
  };

  const forceAnyway = async () => {
    setBusy('useAnyway');
    // Primero queda constancia, después se añade. Si algo falla en el medio,
    // es preferible un registro de más que contenido forzado sin rastro.
    await dispatch(
      {
        type: 'AcceptIncompatibleContent',
        definitionId: definition.id as DefinitionId,
        declared: definition.rulesets,
      },
      { silent: true },
    );
    const ok = await dispatch(commandFor(definition));
    setBusy(null);
    if (ok) onDone(character.name);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--warning-text)]/30 bg-[var(--warning-muted)] px-3.5 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warning-text)]" strokeWidth={2} />
        <div className="text-sm leading-relaxed text-[var(--text-secondary)]">
          <p className="font-medium text-[var(--text-primary)]">
            {definition.name} es de {definition.rulesets.map((r) => RULESET_LABEL[r]).join(' y ')}.
          </p>
          <p className="mt-1">
            {character.name} juega con {RULESET_LABEL[character.ruleset]}. Las dos ediciones cambian
            números y reglas, así que mezclarlas puede desbalancear la mesa.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {alternative && (
          <OptionButton
            title={`Usar «${alternative.name}» de ${RULESET_LABEL[character.ruleset]}`}
            detail="Es el equivalente en la edición de tu personaje. Lo recomendado."
            recommended
            loading={busy === 'findAlternative'}
            disabled={busy !== null}
            onClick={() => void applyAlternative()}
          />
        )}

        <OptionButton
          title="Usarlo igual"
          detail="Queda anotado en la ficha, con la fecha y la edición de la que vino."
          loading={busy === 'useAnyway'}
          disabled={busy !== null}
          onClick={() => void forceAnyway()}
        />

        <OptionButton
          title="Cancelar"
          detail="No se añade nada."
          loading={false}
          disabled={busy !== null}
          onClick={onCancel}
        />
      </div>
    </div>
  );
}

function OptionButton({
  title,
  detail,
  recommended,
  loading,
  disabled,
  onClick,
}: {
  title: string;
  detail: string;
  recommended?: boolean;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-[var(--radius-lg)] border p-3.5 text-left transition-[border-color,transform]',
        recommended
          ? 'border-[var(--accent)] bg-[var(--accent-muted)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface-raised)]',
        disabled ? 'opacity-60' : 'hover:border-[var(--border-accent)] active:scale-[0.99]',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-[var(--text-tertiary)]">{detail}</span>
      </span>
      {loading ? (
        <span className="size-4 shrink-0 animate-pulse rounded-full bg-[var(--accent)]" />
      ) : (
        <ArrowRight className="size-4 shrink-0 text-[var(--text-tertiary)]" />
      )}
    </button>
  );
}

/** Un conjuro se aprende; todo lo demás va al inventario. */
function commandFor(definition: AnyDefinition) {
  if (definition.type === 'spell') {
    return { type: 'LearnSpell' as const, definitionId: definition.id as DefinitionId };
  }
  if (isItemDefinition(definition)) {
    return {
      type: 'AddInventoryItem' as const,
      definitionId: definition.id as DefinitionId,
      quantity: 1,
    };
  }
  return { type: 'AddInventoryItem' as const, definitionId: definition.id as DefinitionId, quantity: 1 };
}
