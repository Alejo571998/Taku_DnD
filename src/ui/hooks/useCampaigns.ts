'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import {
  nextSessionNumber,
  type CampaignState,
  type SessionEntry,
} from '@domain/campaign/campaign';
import type { Ruleset } from '@domain/rules/ruleset';
import { newCampaignId, newUuid, type CampaignId, type CharacterId } from '@domain/shared/ids';
import { getDb } from '@infrastructure/local/db';
import { useWorkspaceId } from './useAppData';

/**
 * CAMPAÑAS EN LA INTERFAZ (MASTER SPEC §30)
 *
 * Viven en la base local igual que los personajes, así que funcionan sin
 * cuenta y sin conexión. El esquema remoto ya las contempla: compartir una
 * campaña más adelante es enlazar identidades, no rediseñar el modelo.
 */

export function useCampaigns(): CampaignState[] | undefined {
  const workspaceId = useWorkspaceId();
  return useLiveQuery(async () => {
    const rows = await getDb()
      .campaigns.where('workspaceId')
      .equals(workspaceId as string)
      .toArray();
    return rows
      .filter((c) => !c.archivedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [workspaceId]);
}

export function useCampaign(id: CampaignId | undefined): CampaignState | undefined | null {
  return useLiveQuery(async () => {
    if (!id) return null;
    return (await getDb().campaigns.get(id as string)) ?? null;
  }, [id]);
}

/** Campaña a la que pertenece un personaje, si pertenece a alguna. */
export function useCampaignOf(characterId: CharacterId | undefined): CampaignState | null {
  return (
    useLiveQuery(async () => {
      if (!characterId) return null;
      const rows = await getDb().campaigns.toArray();
      return rows.find((c) => c.characterIds.includes(characterId)) ?? null;
    }, [characterId]) ?? null
  );
}

export type CampaignActions = {
  create: (input: { name: string; description?: string; ruleset: Ruleset }) => Promise<CampaignId>;
  update: (id: CampaignId, patch: Partial<CampaignState>) => Promise<void>;
  archive: (id: CampaignId) => Promise<void>;
  setCharacters: (id: CampaignId, characterIds: readonly CharacterId[]) => Promise<void>;
  addSession: (id: CampaignId, input: { title: string; playedOn: string; summary: string }) => Promise<void>;
  removeSession: (id: CampaignId, sessionId: string) => Promise<void>;
};

export function useCampaignActions(): CampaignActions {
  const workspaceId = useWorkspaceId();

  const touch = useCallback(
    async (id: CampaignId, mutate: (current: CampaignState) => CampaignState) => {
      const db = getDb();
      const current = await db.campaigns.get(id as string);
      if (!current) return;
      await db.campaigns.put({
        ...mutate(current),
        updatedAt: new Date().toISOString(),
        version: current.version + 1,
      });
    },
    [],
  );

  const create = useCallback<CampaignActions['create']>(
    async (input) => {
      const now = new Date().toISOString();
      const id = newCampaignId();
      await getDb().campaigns.put({
        id,
        workspaceId,
        name: input.name.trim() || 'Campaña sin nombre',
        description: input.description?.trim() ?? '',
        ruleset: input.ruleset,
        characterIds: [],
        sessions: [],
        role: 'OWNER',
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
      return id;
    },
    [workspaceId],
  );

  const update = useCallback<CampaignActions['update']>(
    (id, patch) => touch(id, (c) => ({ ...c, ...patch })),
    [touch],
  );

  const archive = useCallback<CampaignActions['archive']>(
    (id) => touch(id, (c) => ({ ...c, archivedAt: new Date().toISOString() })),
    [touch],
  );

  const setCharacters = useCallback<CampaignActions['setCharacters']>(
    (id, characterIds) => touch(id, (c) => ({ ...c, characterIds: [...characterIds] })),
    [touch],
  );

  const addSession = useCallback<CampaignActions['addSession']>(
    (id, input) =>
      touch(id, (c) => {
        const entry: SessionEntry = {
          id: newUuid() as string,
          number: nextSessionNumber(c),
          title: input.title.trim() || `Sesión ${nextSessionNumber(c)}`,
          playedOn: input.playedOn,
          summary: input.summary.trim(),
          createdAt: new Date().toISOString(),
        };
        return { ...c, sessions: [...c.sessions, entry] };
      }),
    [touch],
  );

  const removeSession = useCallback<CampaignActions['removeSession']>(
    (id, sessionId) =>
      touch(id, (c) => ({ ...c, sessions: c.sessions.filter((s) => s.id !== sessionId) })),
    [touch],
  );

  return { create, update, archive, setCharacters, addSession, removeSession };
}
