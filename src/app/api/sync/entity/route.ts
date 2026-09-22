import { NextResponse, type NextRequest } from 'next/server';
import { getUserScopedClient } from '@infrastructure/remote/supabase';
import { API_ERROR_MESSAGES, type ApiError } from '@infrastructure/api/sync-contract';

/**
 * ESTADO ACTUAL DE UNA ENTIDAD
 *
 * Solo lo usa la resolución de conflictos: cuando el usuario elige
 * "quedarme con la versión del servidor" hace falta traerla de verdad, no
 * esperar a que el ciclo de bajada la traiga por casualidad.
 *
 * Lectura pura. RLS decide qué se ve; esta ruta no amplía nada.
 */

export const runtime = 'nodejs';

const fail = (error: ApiError['error'], status: number) =>
  NextResponse.json<ApiError>({ error, message: API_ERROR_MESSAGES[error] }, { status });

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!accessToken) return fail('unauthorized', 401);

  const supabase = getUserScopedClient(accessToken);
  if (!supabase) return fail('notConfigured', 503);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return fail('unauthorized', 401);

  const params = request.nextUrl.searchParams;
  const workspaceId = params.get('workspaceId');
  const entityId = params.get('entityId');
  if (!workspaceId || !entityId) return fail('invalidPayload', 400);

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!membership) return fail('workspaceForbidden', 403);

  const { data, error } = await supabase
    .from('characters')
    .select('version, state')
    .eq('id', entityId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) return fail('serverError', 500);
  if (!data) return NextResponse.json({ entity: null });

  return NextResponse.json({ entity: { version: data.version, state: data.state } });
}
