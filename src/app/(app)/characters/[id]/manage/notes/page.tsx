'use client';

import { use, useState } from 'react';
import { Plus, StickyNote } from 'lucide-react';
import { asCharacterId, newUuid } from '@domain/shared/ids';
import { Button } from '@ui/design-system/Button';
import { Card, EmptyState, LoadingState } from '@ui/design-system/primitives';
import { Sheet } from '@ui/design-system/Sheet';
import { CharacterHeader } from '@ui/components/CharacterHeader';
import { useCharacter, useCharacterSheet, useDispatch } from '@ui/hooks/useAppData';

const CATEGORIES = [
  { key: 'general', label: 'General' },
  { key: 'session', label: 'Sesión' },
  { key: 'quest', label: 'Misión' },
  { key: 'relationship', label: 'Relación' },
  { key: 'secret', label: 'Secreto' },
] as const;

export default function NotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const character = useCharacter(asCharacterId(id));
  const sheet = useCharacterSheet(character);
  const dispatch = useDispatch(character);

  const [editing, setEditing] = useState<{ id: string; title: string; body: string; category: string } | null>(null);

  if (!character || !sheet) return <LoadingState label="Cargando…" />;

  const startNew = () =>
    setEditing({ id: newUuid() as string, title: '', body: '', category: 'general' });

  return (
    <div className="animate-fade-in">
      <CharacterHeader sheet={sheet} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">Notas</h2>
        <Button variant="primary" size="sm" leading={<Plus className="size-4" />} onClick={startNew}>
          Nueva
        </Button>
      </div>

      {character.notes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<StickyNote className="size-6" strokeWidth={1.8} />}
            title="Sin notas todavía"
            description="Anotá lo que pase en la mesa: pistas, nombres, deudas, secretos. Todo queda guardado en tu dispositivo."
            action={
              <Button variant="primary" onClick={startNew}>
                Escribir una nota
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {character.notes.map((note) => (
            <li key={note.id}>
              <button
                onClick={() => setEditing({ ...note })}
                className="w-full rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3.5 text-left transition-colors hover:border-[var(--border-accent)]"
              >
                <p className="truncate font-medium">{note.title || 'Sin título'}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-tertiary)]">{note.body}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Sheet open onOpenChange={(v) => !v && setEditing(null)} title="Nota" size="md">
          <input
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            placeholder="Título"
            autoFocus
            aria-label="Título de la nota"
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3.5 text-sm outline-none focus:border-[var(--accent)]"
          />

          <div className="mt-3 flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setEditing({ ...editing, category: c.key })}
                aria-pressed={editing.category === c.key}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  editing.category === c.key
                    ? 'border-transparent bg-crimson-gradient text-[var(--accent-on)]'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <textarea
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            rows={10}
            placeholder="Escribí acá…"
            aria-label="Contenido de la nota"
            className="mt-3 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-sunken)] p-3.5 text-sm leading-relaxed outline-none focus:border-[var(--accent)]"
          />

          <div className="mt-4 flex gap-2.5">
            {character.notes.some((n) => n.id === editing.id) && (
              <Button
                variant="danger"
                onClick={() => {
                  void dispatch({ type: 'DeleteNote', noteId: editing.id });
                  setEditing(null);
                }}
              >
                Eliminar
              </Button>
            )}
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                const now = new Date().toISOString();
                const existing = character.notes.find((n) => n.id === editing.id);
                void dispatch({
                  type: 'UpsertNote',
                  note: {
                    ...editing,
                    createdAt: existing?.createdAt ?? now,
                    updatedAt: now,
                  },
                });
                setEditing(null);
              }}
            >
              Guardar
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
