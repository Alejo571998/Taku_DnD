import { NextResponse, type NextRequest } from 'next/server';
import { getUserScopedClient } from '@infrastructure/remote/supabase';
import { API_ERROR_MESSAGES, type ApiError } from '@infrastructure/api/sync-contract';

/**
 * INVENTARIO DEL WORKSPACE
 *
 * Qué tiene el servidor y en qué versión. Sin estados: ids, números y una
 * marca de borrado, que para un workspace con cien personajes son unos pocos
 * kilobytes.
 *
 * Es la red de seguridad del cursor incremental. `change_log.seq` se reserva
 * al insertar y no al confirmar, así que dos escrituras simultáneas pueden
 * dejar un hueco que `seq > cursor` nunca vuelve a mirar. Con esto el cliente
 * compara contra lo que tiene y se trae lo que le falta.
 *
 * Deliberadamente NO devuelve el estado: si lo hiciera, cada arranque bajaría
 * el workspace entero. Lo que falta se pide de a una entidad por
 * `/api/sync/entity`.
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

  const workspaceId = new URL(request.url).searchParams.get('workspaceId');
  if (!workspaceId) return fail('invalidPayload', 400);

  // Pertenencia explícita. La RLS lo protege igual, pero un 403 es mejor
  // diagnóstico que una lista vacía que parece "no tenés nada".
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!membership) return fail('workspaceForbidden', 403);

  const { data: rows, error } = await supabase
    .from('characters')
    .select('id, version, deleted_at')
    .eq('workspace_id', workspaceId);

  if (error) return fail('serverError', 500, error.message);

  return NextResponse.json({
    entities: (rows ?? []).map((row) => ({
      entityId: row.id,
      version: row.version,
      deleted: row.deleted_at != null,
    })),
  });
}
