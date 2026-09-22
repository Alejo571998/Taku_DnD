import { NextResponse, type NextRequest } from 'next/server';
import { getUserScopedClient } from '@infrastructure/remote/supabase';
import {
  API_ERROR_MESSAGES,
  pullRequestSchema,
  type ApiError,
} from '@infrastructure/api/sync-contract';

/**
 * BAJADA DE CAMBIOS
 *
 * Incremental por SECUENCIA del servidor, nunca por timestamp: los relojes de
 * los clientes están sesgados y una sincronización basada en tiempo pierde
 * registros en silencio. Con `seq > cursor` la consulta es exacta.
 */

export const runtime = 'nodejs';

const fail = (error: ApiError['error'], status: number, detail?: string) =>
  NextResponse.json<ApiError>(
    { error, message: detail ?? API_ERROR_MESSAGES[error] },
    { status },
  );

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!accessToken) return fail('unauthorized', 401);

  const supabase = getUserScopedClient(accessToken);
  if (!supabase) return fail('notConfigured', 503);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return fail('unauthorized', 401);

  const url = new URL(request.url);
  const parsed = pullRequestSchema.safeParse({
    workspaceId: url.searchParams.get('workspaceId'),
    cursor: Number(url.searchParams.get('cursor') ?? 0),
    limit: Number(url.searchParams.get('limit') ?? 100),
  });

  if (!parsed.success) return fail('invalidPayload', 400);

  const { workspaceId, cursor, limit } = parsed.data;

  const { data: entries, error } = await supabase
    .from('change_log')
    .select('seq, entity_type, entity_id, operation')
    .eq('workspace_id', workspaceId)
    .gt('seq', cursor)
    .order('seq', { ascending: true })
    .limit(limit);

  if (error) return fail('serverError', 500, error.message);
  if (!entries || entries.length === 0) {
    return NextResponse.json({ changes: [], cursor, hasMore: false });
  }

  // Un personaje puede haber cambiado veinte veces: solo interesa su estado
  // FINAL. Se deduplica por entidad y se lee una vez.
  const characterIds = [
    ...new Set(entries.filter((e) => e.entity_type === 'character').map((e) => e.entity_id)),
  ];

  const stateById = new Map<string, { state: Record<string, unknown>; version: number }>();
  if (characterIds.length > 0) {
    const { data: characters } = await supabase
      .from('characters')
      .select('id, state, version, deleted_at')
      .in('id', characterIds);

    for (const c of characters ?? []) {
      if (c.deleted_at) continue;
      stateById.set(c.id, { state: c.state as Record<string, unknown>, version: c.version });
    }
  }

  const changes = entries.map((entry) => {
    const record = stateById.get(entry.entity_id);
    return {
      seq: entry.seq,
      entityType: entry.entity_type,
      entityId: entry.entity_id,
      operation: record ? entry.operation : ('delete' as const),
      state: record?.state ?? null,
      version: record?.version ?? null,
    };
  });

  const lastSeq = entries[entries.length - 1]?.seq ?? cursor;

  return NextResponse.json({
    changes,
    cursor: lastSeq,
    hasMore: entries.length === limit,
  });
}
