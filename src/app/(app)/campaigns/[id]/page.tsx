'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronLeft, Check, Plus, Shield, Trash2, Users } from 'lucide-react';
import { checkFit, summarize } from '@domain/campaign/campaign';
import { RULESET_LABEL } from '@domain/rules/ruleset';
import { asCampaignId, type CharacterId } from '@domain/shared/ids';
import { cn } from '@ui/design-system/cn';
import { Button } from '@ui/design-system/Button';
import { Card, Chip, EmptyState, LoadingState, SectionTitle } from '@ui/design-system/primitives';
import { Sheet } from '@ui/design-system/Sheet';
import { CharacterAvatar } from '@ui/components/CharacterCard';
import { useCharacters } from '@ui/hooks/useAppData';
import { useCampaign, useCampaignActions } from '@ui/hooks/useCampaigns';

/**
 * UNA CAMPAÑA (MASTER SPEC §30)
 *
 * Tres cosas y ninguna más: quién juega, qué pasó, y con qué reglas. El resto
 * de la gestión de mesa —iniciativa, encuentros, mapas— es otro producto.
 */
export default function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const campaign = useCampaign(asCampaignId(id));
  const characters = useCharacters();
  const { addSession, removeSession, archive, setCharacters } = useCampaignActions();

  const [addingSession, setAddingSession] = useState(false);
  const [editingRoster, setEditingRoster] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (campaign === null) {
    return (
      <EmptyState
        title="No encontramos esta campaña"
        description="Puede que la hayas archivado."
        action={
          <Link href="/campaigns" className="text-sm font-medium text-[var(--accent-text)] underline underline-offset-4">
            Volver a campañas
          </Link>
        }
      />
    );
  }

  if (!campaign || !characters) return <LoadingState label="Cargando campaña…" />;

  const { sessionCount } = summarize(campaign);
  const roster = characters.filter((c) => campaign.characterIds.includes(c.id));
  const sessions = [...campaign.sessions].sort((a, b) => b.number - a.number);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex items-start gap-3">
        <Link
          href="/campaigns"
          aria-label="Volver a campañas"
          className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-interactive)] hover:text-[var(--text-primary)]"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-muted)] text-[var(--accent-text)]">
          <Shield className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl leading-tight">{campaign.name}</h1>
          <p className="text-xs text-[var(--text-tertiary)]">{RULESET_LABEL[campaign.ruleset]}</p>
        </div>
      </header>

      {campaign.description && (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{campaign.description}</p>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle className="mb-0">Personajes ({roster.length})</SectionTitle>
          <Button variant="ghost" size="sm" onClick={() => setEditingRoster(true)}>
            <Users className="size-4" />
            Elegir
          </Button>
        </div>

        {roster.length === 0 ? (
          <Card>
            <EmptyState
              title="Nadie en la mesa todavía"
              description="Sumá los personajes que juegan esta campaña para tenerlos a mano."
            />
          </Card>
        ) : (
          <ul className="space-y-2">
            {roster.map((character) => {
              const fit = checkFit(campaign, character.ruleset);
              return (
                <li key={character.id}>
                  <Link
                    href={`/characters/${character.id}/play`}
                    className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 transition-[border-color,transform] hover:border-[var(--border-accent)] active:scale-[0.99]"
                  >
                    <CharacterAvatar name={character.name} className="size-10" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{character.name}</span>
                      <span className="block text-xs text-[var(--text-tertiary)]">
                        Reglas {character.ruleset}
                      </span>
                    </span>
                    {/*
                      Avisa, no bloquea. Mezclar ediciones es decisión de la
                      mesa; lo que no puede pasar es que ocurra sin que nadie
                      lo note (MASTER SPEC §4).
                    */}
                    {fit === 'differentRuleset' && (
                      <Chip tone="warning" className="shrink-0">
                        <AlertTriangle className="mr-1 inline size-3" />
                        Otra edición
                      </Chip>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle className="mb-0">Sesiones ({sessionCount})</SectionTitle>
          <Button variant="ghost" size="sm" onClick={() => setAddingSession(true)}>
            <Plus className="size-4" />
            Anotar
          </Button>
        </div>

        {sessions.length === 0 ? (
          <Card>
            <EmptyState
              title="Sin sesiones anotadas"
              description="Después de jugar, anotá qué pasó. En la sesión 12 vas a agradecerlo."
            />
          </Card>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3.5"
              >
                <div className="flex items-start gap-3">
                  <span className="text-numeric flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] text-xs font-semibold">
                    {session.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{session.title}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {new Date(session.playedOn).toLocaleDateString('es-419', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={`Borrar ${session.title}`}
                    onClick={() => void removeSession(campaign.id, session.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {session.summary && (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                    {session.summary}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Zona de riesgo</SectionTitle>
        <Card className="p-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Archivar la campaña la saca de la lista. Los personajes y sus fichas no se tocan.
          </p>
          {confirmArchive ? (
            <div className="mt-3 flex gap-2">
              <Button
                variant="danger"
                onClick={async () => {
                  await archive(campaign.id);
                  router.push('/campaigns');
                }}
              >
                Archivar de verdad
              </Button>
              <Button variant="ghost" onClick={() => setConfirmArchive(false)}>
                Mejor no
              </Button>
            </div>
          ) : (
            <Button variant="secondary" className="mt-3" onClick={() => setConfirmArchive(true)}>
              Archivar campaña
            </Button>
          )}
        </Card>
      </section>

      <RosterSheet
        open={editingRoster}
        onClose={() => setEditingRoster(false)}
        campaignRuleset={campaign.ruleset}
        characters={characters}
        selected={campaign.characterIds}
        onSave={async (ids) => {
          await setCharacters(campaign.id, ids);
          setEditingRoster(false);
        }}
      />

      <SessionSheet
        open={addingSession}
        onClose={() => setAddingSession(false)}
        onSave={async (input) => {
          await addSession(campaign.id, input);
          setAddingSession(false);
        }}
      />
    </div>
  );
}

function RosterSheet({
  open,
  onClose,
  campaignRuleset,
  characters,
  selected,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  campaignRuleset: string;
  characters: readonly { id: CharacterId; name: string; ruleset: string }[];
  selected: readonly CharacterId[];
  onSave: (ids: readonly CharacterId[]) => Promise<void>;
}) {
  const [picked, setPicked] = useState<CharacterId[]>([...selected]);
  const [busy, setBusy] = useState(false);
  const [openedWith, setOpenedWith] = useState<readonly CharacterId[] | null>(null);

  if (open && selected !== openedWith) {
    setOpenedWith(selected);
    setPicked([...selected]);
  }

  const toggle = (id: CharacterId) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()} title="¿Quién juega?" size="md">
      {characters.length === 0 ? (
        <EmptyState
          title="No tenés personajes"
          description="Creá uno y vas a poder sumarlo a esta campaña."
        />
      ) : (
        <div className="space-y-4">
          <ul className="space-y-2">
            {characters.map((character) => {
              const active = picked.includes(character.id);
              const mismatch = character.ruleset !== campaignRuleset;
              return (
                <li key={character.id}>
                  <button
                    onClick={() => toggle(character.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[var(--radius-lg)] border p-3 text-left transition-[border-color,transform] active:scale-[0.99]',
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent-muted)]'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-raised)]',
                    )}
                  >
                    <CharacterAvatar name={character.name} className="size-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{character.name}</span>
                      {mismatch && (
                        <span className="block text-xs text-[var(--warning-text)]">
                          Juega con {character.ruleset}, la campaña con {campaignRuleset}
                        </span>
                      )}
                    </span>
                    {active && <Check className="size-4 shrink-0 text-[var(--accent-text)]" strokeWidth={2.5} />}
                  </button>
                </li>
              );
            })}
          </ul>

          <Button
            variant="primary"
            className="w-full"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onSave(picked);
              setBusy(false);
            }}
          >
            Guardar
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function SessionSheet({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: { title: string; playedOn: string; summary: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [playedOn, setPlayedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()} title="Anotar una sesión" size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="session-title" className="block text-xs font-medium text-[var(--text-secondary)]">
            Título
          </label>
          <input
            id="session-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="La emboscada del puente"
            className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label htmlFor="session-date" className="block text-xs font-medium text-[var(--text-secondary)]">
            Cuándo jugaron
          </label>
          <input
            id="session-date"
            type="date"
            value={playedOn}
            onChange={(e) => setPlayedOn(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label htmlFor="session-summary" className="block text-xs font-medium text-[var(--text-secondary)]">
            Qué pasó
          </label>
          <textarea
            id="session-summary"
            rows={6}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Lo que hicieron, lo que quedó pendiente, a quién le deben un favor."
            className="mt-1.5 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm leading-relaxed outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
          />
        </div>

        <Button
          variant="primary"
          className="w-full"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await onSave({ title, playedOn, summary });
            setBusy(false);
            setTitle('');
            setSummary('');
          }}
        >
          Guardar sesión
        </Button>
      </div>
    </Sheet>
  );
}
