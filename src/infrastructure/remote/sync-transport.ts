import type { WorkspaceId } from '@domain/shared/ids';
import type { CommandEnvelope } from '@application/commands/types';
import type { CursorStore, SyncTransport } from '@application/sync/engine';
import { getDb } from '../local/db';
import { getBrowserClient, isSupabaseConfigured } from './supabase';

/**
 * Implementación HTTP del transporte de sincronización.
 *
 * Habla con `/api/sync/*`, nunca con Supabase directamente: un único camino de
 * escritura.
 */
export class HttpSyncTransport implements SyncTransport {
  async isAvailable(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    if (!isSupabaseConfigured()) return false;
    return (await this.accessToken()) !== null;
  }

  private async accessToken(): Promise<string | null> {
    const client = getBrowserClient();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async push(
    workspaceId: WorkspaceId,
    operations: readonly CommandEnvelope[],
    snapshots: readonly { characterId: string; version: number; state: unknown }[],
  ) {
    const token = await this.accessToken();
    if (!token) throw new Error('Sin sesión activa');

    const response = await fetch('/api/sync/push', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ workspaceId, operations, snapshots }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `El servidor respondió ${response.status}`);
    }

    return response.json();
  }

  async pull(workspaceId: WorkspaceId, cursor: number) {
    const token = await this.accessToken();
    if (!token) throw new Error('Sin sesión activa');

    const params = new URLSearchParams({
      workspaceId: workspaceId as string,
      cursor: String(cursor),
      limit: '100',
    });

    const response = await fetch(`/api/sync/pull?${params}`, {
      headers: { authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `El servidor respondió ${response.status}`);
    }

    return response.json();
  }

  async fetchEntity(workspaceId: WorkspaceId, entityId: string) {
    const token = await this.accessToken();
    if (!token) throw new Error('Sin sesión activa');

    const params = new URLSearchParams({ workspaceId: workspaceId as string, entityId });
    const response = await fetch(`/api/sync/entity?${params}`, {
      headers: { authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `El servidor respondió ${response.status}`);
    }

    const body = (await response.json()) as { entity: { state: unknown; version: number } | null };
    return body.entity;
  }

  async fetchManifest(workspaceId: WorkspaceId) {
    const token = await this.accessToken();
    if (!token) throw new Error('Sin sesión activa');

    const params = new URLSearchParams({ workspaceId: workspaceId as string });
    const response = await fetch(`/api/sync/manifest?${params}`, {
      headers: { authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `El servidor respondió ${response.status}`);
    }

    const body = (await response.json()) as {
      entities: { entityId: string; version: number; deleted: boolean }[];
    };
    return body.entities;
  }
}

/** El cursor vive en la base local: sobrevive a cerrar la aplicación. */
export class DexieCursorStore implements CursorStore {
  async get(): Promise<number> {
    const row = await getDb().meta.get('cursor');
    return row?.seq ?? 0;
  }

  async set(seq: number, at: string): Promise<void> {
    await getDb().meta.put({ key: 'cursor', seq, lastSyncAt: at });
  }
}
