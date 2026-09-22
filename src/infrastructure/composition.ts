import type { AuthGateway } from '@application/auth/gateway';
import type { CursorStore, SyncTransport } from '@application/sync/engine';
import { SupabaseAuthGateway } from './remote/auth';
import { DexieCursorStore, HttpSyncTransport } from './remote/sync-transport';

/**
 * RAÍZ DE COMPOSICIÓN
 *
 * El ÚNICO sitio donde las implementaciones remotas se atan a sus puertos.
 *
 * `ui/` tiene prohibido importar `@infrastructure/remote/*` (regla de ESLint):
 * un componente no instancia clientes de backend ni conoce a Supabase. Lo que
 * recibe de aquí son interfaces declaradas en `application/`, así que la
 * frontera sigue siendo real y no un acuerdo de caballeros.
 */

let auth: AuthGateway | null = null;
let transport: SyncTransport | null = null;
let cursor: CursorStore | null = null;

export function authGateway(): AuthGateway {
  auth ??= new SupabaseAuthGateway();
  return auth;
}

export function syncTransport(): SyncTransport {
  transport ??= new HttpSyncTransport();
  return transport;
}

export function syncCursorStore(): CursorStore {
  cursor ??= new DexieCursorStore();
  return cursor;
}

/** Solo para tests: descarta los singletons. */
export function resetComposition(): void {
  auth = null;
  transport = null;
  cursor = null;
}
