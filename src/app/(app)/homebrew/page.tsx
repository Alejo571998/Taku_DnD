'use client';

import { useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileJson,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type { AnyDefinition } from '@domain/content/schemas';
import type { ImportPreview } from '@domain/content/homebrew';
import { RULESETS, type Ruleset } from '@domain/rules/ruleset';
import { cn } from '@ui/design-system/cn';
import { Button } from '@ui/design-system/Button';
import { Card, Chip, EmptyState, SectionTitle } from '@ui/design-system/primitives';
import { Sheet } from '@ui/design-system/Sheet';
import { useToast } from '@ui/components/AppProviders';
import { useWorkspaceId } from '@ui/hooks/useAppData';
import { downloadJson, useHomebrewActions, useHomebrewDefinitions } from '@ui/hooks/useHomebrew';
import { TYPE_LABEL, TypeIcon } from '@ui/features/library/DefinitionDetail';
import {
  DraftPreview,
  HomebrewForm,
  buildDefinition,
  draftWithCompanions,
  emptyDraft,
  type EditorDraft,
} from '@ui/features/homebrew/HomebrewEditor';
import { isCompanionId, parentIdOf } from '@domain/content/homebrew';
import { TIPS } from '@ui/features/taku/lines';
import { useTakuCue } from '@ui/features/taku/TakuProvider';

/**
 * HOMEBREW (MASTER SPEC §33)
 *
 * No es una funcionalidad secundaria: es la respuesta estructural al límite
 * legal. Solo el SRD se puede redistribuir, así que todo lo demás lo crea el
 * usuario o lo trae de donde tenga derecho a traerlo.
 *
 * Lo que se crea acá entra por la misma puerta que el SRD —el esquema Zod— y
 * aparece solo en la biblioteca, el buscador y el motor de reglas.
 */
export default function HomebrewPage() {
  const all = useHomebrewDefinitions();
  // Los rasgos de una especie o una clase NO son entradas de la lista: se
  // editan desde su padre. Mostrarlos sueltos convierte una clase en trece
  // filas y esconde lo que el usuario vino a buscar.
  const definitions = all?.filter((d) => !isCompanionId(d.id));
  const [editing, setEditing] = useState<{ draft: EditorDraft; id?: string } | null>(null);
  const [importing, setImporting] = useState(false);

  const count = definitions?.length ?? 0;

  // Lo que sorprende de esta pantalla no es que se pueda crear contenido, sino
  // que lo creado entre por la misma puerta que el SRD.
  useTakuCue(definitions !== undefined, TIPS.homebrewFirst);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Homebrew</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Tu propio contenido, sin escribir una línea de código.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
            <Upload className="size-4" />
            Importar
          </Button>
          <Button variant="primary" size="sm" onClick={() => setEditing({ draft: emptyDraft() })}>
            <Plus className="size-4" />
            Crear
          </Button>
        </div>
      </header>

      {count === 0 ? (
        <Card>
          <EmptyState
            icon={<Sparkles className="size-6" strokeWidth={1.8} />}
            mascot
            title="Todavía no creaste nada"
            description="Un arma, un conjuro, una dote, un trasfondo, o una especie y una clase enteras. Aparece al instante en la biblioteca y podés usarlo en cualquier personaje."
            action={
              <Button variant="primary" onClick={() => setEditing({ draft: emptyDraft() })}>
                <Plus className="size-4" />
                Crear lo primero
              </Button>
            }
          />
        </Card>
      ) : (
        <HomebrewList
          definitions={definitions ?? []}
          onEdit={(d) => setEditing({ draft: draftWithCompanions(d, all ?? []), id: d.id })}
          companionsOf={(id) => (all ?? []).filter((d) => parentIdOf(d.id) === id)}
        />
      )}

      <ExportSection disabled={count === 0} />

      <EditorSheet
        state={editing}
        onClose={() => setEditing(null)}
        onSaved={() => setEditing(null)}
      />
      <ImportSheet open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}

/** «· 2 subclases · 6 rasgos», o nada si la definición va sola. */
function companionSummary(companions: readonly AnyDefinition[]): string {
  const subclasses = companions.filter((d) => d.type === 'subclass').length;
  const rest = companions.length - subclasses;
  const parts: string[] = [];
  if (subclasses > 0) parts.push(`${subclasses} ${subclasses === 1 ? 'subclase' : 'subclases'}`);
  if (rest > 0) parts.push(`${rest} ${rest === 1 ? 'rasgo' : 'rasgos'}`);
  return parts.length > 0 ? ` · ${parts.join(' · ')}` : '';
}

function HomebrewList({
  definitions,
  onEdit,
  companionsOf,
}: {
  definitions: readonly AnyDefinition[];
  onEdit: (d: AnyDefinition) => void;
  companionsOf: (id: string) => readonly AnyDefinition[];
}) {
  const { remove } = useHomebrewActions();
  const { notify } = useToast();
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <section>
      <SectionTitle>Tu contenido ({definitions.length})</SectionTitle>
      <ul className="space-y-2">
        {definitions.map((definition) => (
          <li
            key={definition.id}
            className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3"
          >
            <TypeIcon type={definition.type} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{definition.name}</span>
              <span className="block truncate text-xs text-[var(--text-tertiary)]">
                {TYPE_LABEL[definition.type] ?? definition.type} · reglas{' '}
                {definition.rulesets.join(', ')}
                {/*
                  Se cuentan por tipo y no en bloque: "8 rasgos" en una clase
                  con dos subclases es falso, y ese número es lo último que se
                  lee antes de pulsar Borrar, que se lleva todo por delante.
                */}
                {companionSummary(companionsOf(definition.id))}
              </span>
            </span>

            {confirming === definition.id ? (
              <div className="flex shrink-0 gap-1.5">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    // Los rasgos se van con su padre. Dejarlos sueltos llenaría
                    // la biblioteca de "Oleada de acción" sin clase a la que
                    // pertenecer.
                    let done = true;
                    for (const companion of companionsOf(definition.id)) {
                      done = (await remove(companion.id)) && done;
                    }
                    done = (await remove(definition.id)) && done;
                    setConfirming(null);
                    notify({
                      message: done ? `${definition.name} borrado` : 'No pudimos borrarlo',
                      tone: done ? 'neutral' : 'danger',
                    });
                  }}
                >
                  Borrar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                  No
                </Button>
              </div>
            ) : (
              <div className="flex shrink-0 gap-0.5">
                <Button variant="ghost" size="sm" iconOnly aria-label={`Editar ${definition.name}`} onClick={() => onEdit(definition)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={`Borrar ${definition.name}`}
                  onClick={() => setConfirming(definition.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EditorSheet({
  state,
  onClose,
  onSaved,
}: {
  state: { draft: EditorDraft; id?: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const { save } = useHomebrewActions();
  const { notify } = useToast();
  const [draft, setDraft] = useState<EditorDraft>(state?.draft ?? emptyDraft());
  const [issues, setIssues] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<EditorDraft | null>(null);

  // Al abrir con otro borrador hay que cargarlo. Se compara por identidad, que
  // es estable mientras la hoja está abierta.
  if (state && state.draft !== openedFor) {
    setOpenedFor(state.draft);
    setDraft(state.draft);
    setIssues([]);
  }

  const submit = async () => {
    const built = buildDefinition(draft, workspaceId as string, state?.id);
    if (!built.ok) {
      setIssues(built.issues);
      return;
    }

    setBusy(true);
    // Los rasgos primero: si algo falla a mitad, es mejor quedarse con rasgos
    // huérfanos —invisibles salvo en la biblioteca— que con una especie que
    // enlaza ids que no existen y deja al motor sin poder resolverla.
    let done = true;
    for (const companion of built.companions) {
      done = (await save(companion, { keepId: true })) && done;
    }
    if (done) done = await save(built.definition, state?.id ? { keepId: true } : {});
    setBusy(false);

    if (!done) {
      setIssues(['No pudimos guardarlo. Probá de nuevo.']);
      return;
    }
    notify({ message: `${built.definition.name} guardado`, tone: 'success' });
    onSaved();
  };

  return (
    <Sheet
      open={state !== null}
      onOpenChange={(v) => !v && onClose()}
      title={state?.id ? 'Editar contenido' : 'Crear contenido'}
      size="lg"
    >
      <div className="space-y-5">
        <HomebrewForm draft={draft} onChange={setDraft} issues={issues} />
        <DraftPreview draft={draft} workspaceId={workspaceId as string} />
        <Button variant="primary" className="w-full" loading={busy} onClick={() => void submit()}>
          Guardar
        </Button>
      </div>
    </Sheet>
  );
}

// ── Importación ──────────────────────────────────────────────────────────────

type ImportStage =
  | { kind: 'choose' }
  | { kind: 'preview'; preview: ImportPreview }
  | { kind: 'error'; messages: readonly string[] }
  | { kind: 'done'; imported: number; skipped: number; replaced: number };

const ISSUE_TEXT: Record<string, string> = {
  'format.unreadable': 'El archivo no tiene el formato que esperamos.',
  'format.tooNew': 'El archivo viene de una versión más nueva de TAKU.',
  'definition.invalid': 'Una de las entradas no es válida.',
  'definition.reservedId': 'Traía identificadores del SRD y se importan como contenido propio.',
  'ruleset.mismatch': 'Alguna entrada no declara las mismas reglas que el paquete.',
};

/**
 * PIPELINE DE IMPORTACIÓN (MASTER SPEC §33)
 *
 *   elegir → analizar → previsualizar → conflictos → importar → resultado
 *
 * Importar a ciegas y arreglar después es lo que convierte una biblioteca en
 * un vertedero. El paso de vista previa no es un lujo.
 */
function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { preview, commit } = useHomebrewActions();

  // Al abrir el diálogo, no al entrar a Homebrew: es el momento en que alguien
  // duda de si importar un archivo ajeno le va a pisar lo suyo.
  useTakuCue(open, TIPS.homebrewImport);

  const [stage, setStage] = useState<ImportStage>({ kind: 'choose' });
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const close = () => {
    setStage({ kind: 'choose' });
    onClose();
  };

  const pick = async (file: File) => {
    setBusy(true);
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const parsed = await preview(raw);
      setStage(
        parsed.ok
          ? { kind: 'preview', preview: parsed.preview }
          : {
              kind: 'error',
              messages: parsed.issues.map(
                (i) => i.detail ?? ISSUE_TEXT[i.code] ?? 'No pudimos leer el archivo.',
              ),
            },
      );
    } catch {
      setStage({ kind: 'error', messages: ['El archivo no es un JSON válido.'] });
    } finally {
      setBusy(false);
    }
  };

  const run = async (mode: 'skip' | 'replace') => {
    if (stage.kind !== 'preview') return;
    setBusy(true);
    const result = await commit(stage.preview, mode);
    setBusy(false);
    setStage({ kind: 'done', ...result });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && close()} title="Importar contenido" size="lg">
      {stage.kind === 'choose' && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Elegí un paquete exportado desde TAKU. Vas a ver qué trae antes de que se importe nada.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void pick(file);
            }}
          />
          <Button
            variant="secondary"
            className="w-full"
            loading={busy}
            onClick={() => fileInput.current?.click()}
          >
            <FileJson className="size-4" />
            Elegir archivo
          </Button>
          <p className="rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-3.5 py-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
            Lo que importes se guarda como contenido TUYO, con identificadores propios. Nunca puede
            reemplazar ni modificar el SRD, ni aunque el archivo lo intente.
          </p>
        </div>
      )}

      {stage.kind === 'error' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--danger-text)]/35 bg-[var(--danger-muted)] px-3.5 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--danger-text)]" />
            <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
              {stage.messages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => setStage({ kind: 'choose' })}>
            Probar con otro archivo
          </Button>
        </div>
      )}

      {stage.kind === 'preview' && (
        <div className="space-y-5">
          <div>
            <p className="font-display text-lg">{stage.preview.pack.name}</p>
            <p className="text-xs text-[var(--text-tertiary)]">
              versión {stage.preview.pack.version} · reglas {stage.preview.pack.ruleset}
              {stage.preview.pack.author && ` · ${stage.preview.pack.author}`}
            </p>
            {stage.preview.pack.description && (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {stage.preview.pack.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stage.preview.countsByType).map(([type, n]) => (
              <Chip key={type} tone="neutral">
                {n} {TYPE_LABEL[type] ?? type}
              </Chip>
            ))}
          </div>

          {stage.preview.issues.length > 0 && (
            <ul className="space-y-1.5 rounded-[var(--radius-md)] border border-[var(--warning-text)]/30 bg-[var(--warning-muted)] px-3.5 py-3 text-xs leading-relaxed text-[var(--text-secondary)]">
              {stage.preview.issues.slice(0, 6).map((issue, i) => (
                <li key={i}>{issue.detail ?? ISSUE_TEXT[issue.code]}</li>
              ))}
              {stage.preview.issues.length > 6 && (
                <li className="text-[var(--text-tertiary)]">
                  …y {stage.preview.issues.length - 6} avisos más.
                </li>
              )}
            </ul>
          )}

          {stage.preview.conflicts.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm">
                <strong className="font-medium">{stage.preview.conflicts.length}</strong>{' '}
                {stage.preview.conflicts.length === 1 ? 'entrada ya existe' : 'entradas ya existen'}{' '}
                en tu contenido. ¿Qué hacemos con ellas?
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto scrollbar-slim text-xs text-[var(--text-tertiary)]">
                {stage.preview.conflicts.map((c) => (
                  <li key={c.definitionId}>{c.name}</li>
                ))}
              </ul>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="secondary" loading={busy} onClick={() => void run('skip')}>
                  Conservar las mías
                </Button>
                <Button variant="primary" loading={busy} onClick={() => void run('replace')}>
                  Reemplazar con las nuevas
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="primary" className="w-full" loading={busy} onClick={() => void run('skip')}>
              Importar {stage.preview.definitions.length}{' '}
              {stage.preview.definitions.length === 1 ? 'entrada' : 'entradas'}
            </Button>
          )}
        </div>
      )}

      {stage.kind === 'done' && (
        <div className="space-y-4 py-4 text-center">
          <p className="font-display text-lg">Listo</p>
          <p className="text-sm text-[var(--text-secondary)]">
            Se importaron {stage.imported} {stage.imported === 1 ? 'entrada' : 'entradas'}.
            {stage.skipped > 0 && ` Se conservaron ${stage.skipped} tuyas.`}
            {stage.replaced > 0 && ` Se reemplazaron ${stage.replaced}.`}
          </p>
          <Button variant="secondary" onClick={close}>
            Cerrar
          </Button>
        </div>
      )}
    </Sheet>
  );
}

// ── Exportación ──────────────────────────────────────────────────────────────

function ExportSection({ disabled }: { disabled: boolean }) {
  const { exportPack } = useHomebrewActions();
  const { notify } = useToast();
  const [ruleset, setRuleset] = useState<Ruleset>('2014');
  const [name, setName] = useState('Mi contenido');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const contents = await exportPack({ name: name.trim() || 'Mi contenido', ruleset });
    setBusy(false);

    if (!contents) {
      notify({
        message: 'No hay nada que exportar',
        detail: `Todavía no creaste contenido con las reglas ${ruleset}.`,
        tone: 'danger',
      });
      return;
    }

    downloadJson(`taku-${ruleset}-${Date.now()}.json`, contents);
    notify({ message: 'Paquete descargado', tone: 'success' });
  };

  return (
    <section>
      <SectionTitle>Exportar</SectionTitle>
      <Card className="space-y-3 p-4">
        <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">
          Descargá tu contenido como un archivo versionado. Podés compartirlo con tu mesa o
          guardarlo de respaldo: es tuyo y te lo llevás cuando quieras.
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="export-name" className="block text-xs font-medium text-[var(--text-secondary)]">
              Nombre del paquete
            </label>
            <input
              id="export-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)]">Reglas</p>
            <div className="mt-1.5 flex gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-1">
              {RULESETS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRuleset(r)}
                  aria-pressed={ruleset === r}
                  className={cn(
                    // 44px de alto: es el minimo que la guia de Apple y WCAG 2.5.5 piden
            // para algo que se toca con el pulgar. Medido antes: 30px.
            'min-h-11 rounded-[var(--radius-sm)] px-3.5 text-xs font-medium transition-colors',
                    ruleset === r
                      ? 'bg-[var(--surface-interactive)] text-[var(--text-primary)]'
                      : 'text-[var(--text-tertiary)]',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button variant="secondary" disabled={disabled} loading={busy} onClick={() => void run()}>
          <Download className="size-4" />
          Descargar paquete
        </Button>
      </Card>
    </section>
  );
}
