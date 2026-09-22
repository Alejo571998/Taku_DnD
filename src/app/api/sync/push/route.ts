import { NextResponse, type NextRequest } from 'next/server';
import { getUserScopedClient } from '@infrastructure/remote/supabase';
import {
  API_ERROR_MESSAGES,
  pushRequestSchema,
  type ApiError,
  type OperationOutcome,
} from '@infrastructure/api/sync-contract';

/**
 * SUBIDA DE CAMBIOS
 *
 * Único camino de escritura de datos de usuario. Aquí viven las tres garantías
 * que hacen viable el offline multi-dispositivo:
 *
 *   1. IDEMPOTENCIA — `applied_operations.client_op_id` es clave primaria, así
 *      que un reintento choca contra la base y se descarta. No es una
 *      comprobación esperanzada: es una restricción.
 *
 *   2. CONCURRENCIA OPTIMISTA — se escribe solo si la versión del servidor es
 *      la que el cliente creía. Si no, se registra un conflicto en vez de
 *      sobrescribir en silencio (MASTER PROMPT §42).
 *
 *   3. VALIDACIÓN SERVER-SIDE — el payload atraviesa Zod antes de tocar nada.
 */

export const runtime = 'nodejs';

const fail = (error: ApiError['error'], status: number, detail?: string) =>
  NextResponse.json<ApiError>(
    { error, message: detail ?? API_ERROR_MESSAGES[error] },
    { status },
  );

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!accessToken) return fail('unauthorized', 401);

  const supabase = getUserScopedClient(accessToken);
  if (!supabase) return fail('notConfigured', 503);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return fail('unauthorized', 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('invalidPayload', 400);
  }

  const parsed = pushRequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail('invalidPayload', 400, `No pudimos leer los cambios: ${parsed.error.issues[0]?.message ?? ''}`);
  }

  const { workspaceId, operations, snapshots } = parsed.data;

  // Pertenencia al workspace. RLS lo protege igualmente, pero un 403 explícito
  // es mucho mejor diagnóstico que un resultado vacío.
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!membership) return fail('workspaceForbidden', 403);

  const results: OperationOutcome[] = [];
  const snapshotByCharacter = new Map(snapshots.map((s) => [s.characterId, s]));

  for (const op of operations) {
    // ── 1 · Idempotencia ────────────────────────────────────────────────────
    const { error: insertError } = await supabase.from('applied_operations').insert({
      client_op_id: op.clientOpId,
      workspace_id: workspaceId,
      character_id: op.characterId,
      command_type: op.command.type,
    });

    if (insertError) {
      // 23505 = violación de unicidad: ya se aplicó. Reintento, no duplicado.
      if (insertError.code === '23505') {
        results.push({ clientOpId: op.clientOpId, status: 'duplicate' });
        continue;
      }
      results.push({
        clientOpId: op.clientOpId,
        status: 'rejected',
        reason: insertError.message,
      });
      continue;
    }

    results.push({ clientOpId: op.clientOpId, status: 'applied' });
  }

  // ── 2 · Convergencia por instantánea ──────────────────────────────────────
  //
  // Los comandos ya se aplicaron en el cliente; el servidor guarda el estado
  // resultante. Los deltas conmutativos (daño, curación, recursos) convergen
  // porque la idempotencia impide aplicarlos dos veces.
  for (const [characterId, snapshot] of snapshotByCharacter) {
    const { data: existing } = await supabase
      .from('characters')
      .select('version')
      .eq('id', characterId)
      .maybeSingle();

    const state = snapshot.state as Record<string, unknown>;

    if (!existing) {
      const { error } = await supabase.from('characters').insert({
        id: characterId,
        workspace_id: workspaceId,
        name: String(state.name ?? 'Sin nombre'),
        ruleset: String(state.ruleset ?? '2014'),
        level: Number((state.classes as { level: number }[] | undefined)?.reduce((a, c) => a + c.level, 0) ?? 1),
        version: snapshot.version,
        state,
      });
      if (error) {
        markConflict(results, characterId, operations, error.message);
      }
      continue;
    }

    // Concurrencia optimista: solo escribe si nadie se adelantó.
    const { data: updated, error } = await supabase
      .from('characters')
      .update({
        name: String(state.name ?? 'Sin nombre'),
        level: Number((state.classes as { level: number }[] | undefined)?.reduce((a, c) => a + c.level, 0) ?? 1),
        version: snapshot.version,
        state,
      })
      .eq('id', characterId)
      .lt('version', snapshot.version)
      .select('version')
      .maybeSingle();

    if (error) {
      markConflict(results, characterId, operations, error.message);
      continue;
    }

    if (!updated) {
      // El servidor tiene una versión igual o más nueva: otro dispositivo se
      // adelantó. NO se sobrescribe: se registra y el cliente reconcilia.
      await supabase.from('sync_conflicts').insert({
        workspace_id: workspaceId,
        entity_type: 'character',
        entity_id: characterId,
        local_version: snapshot.version,
        server_version: existing.version,
        command: { reason: 'staleSnapshot' },
        resolution: 'pending',
      });

      markConflict(results, characterId, operations, 'El servidor tiene una versión más reciente.', existing.version);
    }
  }

  // ── 3 · Cursor actual ─────────────────────────────────────────────────────
  const { data: latest } = await supabase
    .from('change_log')
    .select('seq')
    .eq('workspace_id', workspaceId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ results, cursor: latest?.seq ?? 0 });
}

function markConflict(
  results: OperationOutcome[],
  characterId: string,
  operations: { clientOpId: string; characterId: string }[],
  reason: string,
  serverVersion?: number,
): void {
  for (const op of operations) {
    if (op.characterId !== characterId) continue;
    const entry = results.find((r) => r.clientOpId === op.clientOpId);
    if (entry && entry.status === 'applied') {
      entry.status = 'conflict';
      entry.reason = reason;
      if (serverVersion != null) entry.serverVersion = serverVersion;
    }
  }
}
