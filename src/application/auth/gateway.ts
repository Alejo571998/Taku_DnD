import type { WorkspaceId } from '@domain/shared/ids';
import type { Result } from '@domain/shared/result';

/**
 * AUTENTICACIÓN — PUERTO
 *
 * La aplicación funciona SIN cuenta: crear personajes, jugar y guardar no
 * requieren registrarse (MASTER SPEC §40). La cuenta sirve para una cosa
 * concreta —tener los personajes en varios dispositivos— y el producto lo dice
 * así en vez de pedir el correo en la primera pantalla.
 *
 * Esto es una interfaz: `application/` no sabe que detrás hay Supabase.
 */

export type AuthUser = {
  readonly id: string;
  readonly email: string;
  readonly displayName?: string;
};

export type AuthSession = {
  readonly user: AuthUser;
  readonly workspaceId: WorkspaceId;
};

export type SessionState =
  /** Todavía no sabemos: no se decide nada hasta saberlo. */
  | { readonly status: 'loading' }
  /** Este despliegue no tiene nube configurada. Todo local, y se dice claro. */
  | { readonly status: 'disabled' }
  | { readonly status: 'anonymous' }
  | { readonly status: 'authenticated'; readonly session: AuthSession };

export type AuthErrorCode =
  | 'auth.invalidCredentials'
  | 'auth.emailInUse'
  | 'auth.weakPassword'
  | 'auth.invalidEmail'
  | 'auth.emailNotConfirmed'
  | 'auth.rateLimited'
  | 'auth.notConfigured'
  | 'auth.network'
  /**
   * La contraseña era correcta, pero no se pudo leer el espacio del usuario.
   *
   * Tiene código propio porque antes caía en `auth.unknown` y la pantalla
   * decía «algo falló y no sabemos qué». Lo sabíamos perfectamente: entrar son
   * DOS pasos —validar la contraseña y buscar el espacio— y quien lee el
   * mensaje tiene que poder distinguir cuál de los dos se rompió.
   */
  | 'auth.workspaceMissing'
  | 'auth.unknown';

export type AuthError = { readonly code: AuthErrorCode; readonly detail?: string };

export interface AuthGateway {
  /** false cuando el despliegue no tiene backend: la interfaz oculta la nube. */
  isEnabled(): boolean;
  current(): Promise<AuthSession | null>;
  /** Avisa de inicios y cierres de sesión, incluidos los de otra pestaña. */
  onChange(listener: (session: AuthSession | null) => void): () => void;

  signUp(input: { email: string; password: string; displayName?: string }): Promise<Result<AuthSession | null, AuthError>>;
  signIn(input: { email: string; password: string }): Promise<Result<AuthSession, AuthError>>;
  signOut(): Promise<void>;
  sendRecovery(email: string, redirectTo: string): Promise<Result<void, AuthError>>;
  updatePassword(password: string): Promise<Result<void, AuthError>>;
}

/** Requisitos mínimos de la contraseña. Se validan también en el servidor. */
export const MIN_PASSWORD_LENGTH = 8;

export type CredentialIssue = 'email.invalid' | 'password.tooShort' | 'password.mismatch';

/**
 * Validación del formulario ANTES de llamar a la red.
 * No sustituye a la del servidor: le ahorra al usuario un viaje de ida y
 * vuelta para que le digan que escribió mal el correo.
 */
export function validateCredentials(input: {
  email: string;
  password: string;
  confirm?: string;
}): readonly CredentialIssue[] {
  const issues: CredentialIssue[] = [];
  // Deliberadamente laxa: la única prueba real de que un correo existe es
  // enviarle algo. Una expresión estricta rechaza direcciones válidas.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) issues.push('email.invalid');
  if (input.password.length < MIN_PASSWORD_LENGTH) issues.push('password.tooShort');
  if (input.confirm !== undefined && input.confirm !== input.password) issues.push('password.mismatch');
  return issues;
}
