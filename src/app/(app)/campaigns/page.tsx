'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Shield, Users } from 'lucide-react';
import { summarize, type CampaignState } from '@domain/campaign/campaign';
import { RULESET_LABEL, RULESETS, type Ruleset } from '@domain/rules/ruleset';
import { cn } from '@ui/design-system/cn';
import { Button } from '@ui/design-system/Button';
import { Card, Chip, EmptyState } from '@ui/design-system/primitives';
import { Sheet } from '@ui/design-system/Sheet';
import { useCampaignActions, useCampaigns } from '@ui/hooks/useCampaigns';

/**
 * CAMPAÑAS (MASTER SPEC §30)
 *
 * Responde a algo que un jugador ya tiene en la cabeza y la aplicación no
 * sabía: qué personajes son de qué mesa. Funciona sin cuenta y sin conexión;
 * el modelo remoto ya contempla compartirlas cuando haya con quién.
 */
export default function CampaignsPage() {
  const campaigns = useCampaigns();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Campañas</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Tus mesas, con sus personajes y su historia.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Nueva campaña
        </Button>
      </header>

      {campaigns === undefined ? null : campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Shield className="size-6" strokeWidth={1.8} />}
            mascot
            title="Todavía no tenés campañas"
            description="Una campaña agrupa a los personajes de una misma mesa, fija la edición de reglas y guarda lo que pasó en cada sesión."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                Crear la primera
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <CampaignCard campaign={campaign} />
            </li>
          ))}
        </ul>
      )}

      <CreateSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignState }) {
  const { characterCount, sessionCount, lastSession } = summarize(campaign);

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 transition-[border-color,transform] hover:border-[var(--border-accent)] active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-muted)] text-[var(--accent-text)]">
          <Shield className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base leading-tight">{campaign.name}</p>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
            {RULESET_LABEL[campaign.ruleset]}
          </p>
        </div>
      </div>

      {campaign.description && (
        <p className="mt-3 line-clamp-2 text-sm text-[var(--text-secondary)]">
          {campaign.description}
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
        <Chip tone="neutral">
          <Users className="mr-1 inline size-3" />
          {characterCount} {characterCount === 1 ? 'personaje' : 'personajes'}
        </Chip>
        <Chip tone="neutral">
          {sessionCount} {sessionCount === 1 ? 'sesión' : 'sesiones'}
        </Chip>
      </div>

      {lastSession && (
        <p className="mt-2 truncate text-xs text-[var(--text-tertiary)]">
          Última: {lastSession.title}
        </p>
      )}
    </Link>
  );
}

function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useCampaignActions();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ruleset, setRuleset] = useState<Ruleset>('2014');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    await create({ name, description, ruleset });
    setBusy(false);
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()} title="Nueva campaña" size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="campaign-name" className="block text-xs font-medium text-[var(--text-secondary)]">
            Nombre
          </label>
          <input
            id="campaign-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="La mesa de los martes"
            className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-[var(--text-secondary)]">Edición de reglas</p>
          {/*
            La campaña fija la edición. Es lo que impide el error más caro de
            una mesa: meter un personaje de otra edición sin que nadie lo note.
          */}
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {RULESETS.map((r) => (
              <button
                key={r}
                onClick={() => setRuleset(r)}
                aria-pressed={ruleset === r}
                className={cn(
                  'rounded-[var(--radius-md)] border px-3 py-2.5 text-sm font-medium transition-colors',
                  ruleset === r
                    ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent-text)]'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)]',
                )}
              >
                {RULESET_LABEL[r]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
            Los personajes de otra edición se pueden sumar igual, pero la aplicación lo va a avisar.
          </p>
        </div>

        <div>
          <label htmlFor="campaign-desc" className="block text-xs font-medium text-[var(--text-secondary)]">
            De qué va (opcional)
          </label>
          <textarea
            id="campaign-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1.5 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>

        <Button
          variant="primary"
          className="w-full"
          disabled={name.trim().length === 0}
          loading={busy}
          onClick={() => void submit()}
        >
          Crear campaña
        </Button>
      </div>
    </Sheet>
  );
}
