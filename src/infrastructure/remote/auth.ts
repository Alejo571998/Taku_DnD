import type { AuthError as SupabaseAuthError, Session, SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthError,
  AuthErrorCode,
  AuthGateway,
  AuthSession,
} from '@application/auth/gateway';
import { asWorkspaceId, type WorkspaceId } from '@domain/shared/ids';
import { err, ok, type Result } from '@domain/shared/result';
import { getBrowserClient, isSupabaseConfigured } from './supabase';

/**
 * AUTENTICACIÓN CON SUPABASE
 *
 * Implementa el puerto `AuthGateway`. Nada de esto sube a `application/`:
 * cambiar de proveedor sería reescribir este archivo y nada más.
 *
 * `handle_new_user()` crea el workspace personal en el mismo momento del alta,
 * así que aquí solo hay que leerlo — no crearlo desde el cliente, que sería
 * una condición de carrera con el disparador.
 */

/**
 * Traducción de errores.
 *
 * Los mensajes de Supabase son en inglés y a veces filtran detalle de más.
 * La interfaz muestra SIEMPRE nuestro texto (MASTER PROMPT §81).
 */
function translate(error: SupabaseAuthError | null): AuthError {
  const message = (error?.message ?? '').toLowerCase();
  let code: AuthErrorCode = 'auth.unknown';

  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    code = 'auth.invalidCredentials';
  } else if (message.includes('already registered') || message.includes('already been registered')) {
    code = 'auth.emailInUse';
  } else if (message.includes('password') && message.includes('least')) {
    code = 'auth.weakPassword';
  } else if (message.includes('email') && message.includes('invalid')) {
    code = 'auth.invalidEmail';
  } else if (message.includes('not confirmed')) {
    code = 'auth.emailNotConfirmed';
  } else if (message.includes('rate limit') || error?.status === 429) {
    code = 'auth.rateLimited';
  } else if (message.includes('fetch') || message.includes('network')) {
    code = 'auth.network';
  }

  return { code, ...(error?.message ? { detail: error.message } : {}) };
}

export class SupabaseAuthGateway implements AuthGateway {
  private workspaceCache = new Map<string, WorkspaceId>();

  isEnabled(): boolean {
    return isSupabaseConfigured();
  }

  private client(): SupabaseClient | null {
    return getBrowserClient();
  }

  private async toSession(session: Session | null): Promise<AuthSession | null> {
    if (!session?.user) return null;
    const workspaceId = await this.workspaceFor(session.user.id);
    if (!workspaceId) return null;

    const metadata = session.user.user_metadata as { display_name?: string } | undefined;
    return {
      user: {
        id: session.user.id,
        email: session.user.email ?? '',
        ...(metadata?.display_name ? { displayName: metadata.display_name } : {}),
      },
      workspaceId,
    };
  }

  /**
   * Workspace personal del usuario. Lo crea el disparador del alta; si todavía
   * no existe (replicación, alta recién hecha) devolvemos null y la interfaz
   * reintenta, en vez de inventar uno y acabar con dos.
   */
  private async workspaceFor(userId: string): Promise<WorkspaceId | null> {
    const cached = this.workspaceCache.get(userId);
    if (cached) return cached;

    const client = this.client();
    if (!client) return null;

    const { data } = await client
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const id = (data as { workspace_id?: string } | null)?.workspace_id;
    if (!id) return null;

    const workspaceId = asWorkspaceId(id);
    this.workspaceCache.set(userId, workspaceId);
    return workspaceId;
  }

  async current(): Promise<AuthSession | null> {
    const client = this.client();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return this.toSession(data.session);
  }

  onChange(listener: (session: AuthSession | null) => void): () => void {
    const client = this.client();
    if (!client) return () => {};

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      void this.toSession(session).then(listener);
    });
    return () => data.subscription.unsubscribe();
  }

  async signUp(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<Result<AuthSession | null, AuthError>> {
    const client = this.client();
    if (!client) return err({ code: 'auth.notConfigured' });

    const { data, error } = await client.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: input.displayName ? { display_name: input.displayName } : {},
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) return err(translate(error));

    // Con confirmación por correo activada NO hay sesión todavía. Devolvemos
    // null en vez de fingir que entró: la pantalla dice que revise su correo.
    return ok(await this.toSession(data.session));
  }

  async signIn(input: { email: string; password: string }): Promise<Result<AuthSession, AuthError>> {
    const client = this.client();
    if (!client) return err({ code: 'auth.notConfigured' });

    const { data, error } = await client.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });
    if (error) return err(translate(error));

    const session = await this.toSession(data.session);
    if (!session) return err({ code: 'auth.unknown', detail: 'sin workspace asignado' });
    return ok(session);
  }

  async signOut(): Promise<void> {
    this.workspaceCache.clear();
    await this.client()?.auth.signOut();
  }

  async sendRecovery(email: string, redirectTo: string): Promise<Result<void, AuthError>> {
    const client = this.client();
    if (!client) return err({ code: 'auth.notConfigured' });

    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) return err(translate(error));
    return ok(undefined);
  }

  async updatePassword(password: string): Promise<Result<void, AuthError>> {
    const client = this.client();
    if (!client) return err({ code: 'auth.notConfigured' });

    const { error } = await client.auth.updateUser({ password });
    if (error) return err(translate(error));
    return ok(undefined);
  }
}
