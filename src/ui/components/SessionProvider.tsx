'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AuthError, AuthSession, SessionState } from '@application/auth/gateway';
import { adoptLocalWorkspace, type AdoptionReport } from '@application/auth/migration';
import { asWorkspaceId, type WorkspaceId } from '@domain/shared/ids';
import type { Result } from '@domain/shared/result';
import { authGateway } from '@infrastructure/composition';
import {
  DexieCharacterRepository,
  DexieOutboxRepository,
} from '@infrastructure/local/repositories';

/**
 * SESIÓN
 *
 * TAKU funciona sin cuenta. Este proveedor responde a una sola pregunta —¿en
 * qué espacio de trabajo estoy?— y esa respuesta es válida desde el primer
 * arranque, haya cuenta o no.
 *
 * Mientras no hay sesión se usa el workspace local. Al entrar por primera vez,
 * lo local se ADOPTA: nadie pierde tres sesiones de juego por registrarse.
 */

/**
 * Workspace mientras no hay cuenta. El modelo es multi-tenant desde el primer
 * día justo para que este momento sea cambiar un identificador y no un
 * rediseño.
 */
export const LOCAL_WORKSPACE = asWorkspaceId('00000000-0000-7000-8000-000000000001');

const ADOPTED_KEY = 'taku-adopted-workspace';

type SessionContextValue = {
  readonly state: SessionState;
  readonly workspaceId: WorkspaceId;
  readonly isCloudEnabled: boolean;
  readonly adoption: AdoptionReport | null;
  signIn(input: { email: string; password: string }): Promise<Result<AuthSession, AuthError>>;
  signUp(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<Result<AuthSession | null, AuthError>>;
  signOut(): Promise<void>;
  sendRecovery(email: string): Promise<Result<void, AuthError>>;
  updatePassword(password: string): Promise<Result<void, AuthError>>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const gateway = useMemo(() => authGateway(), []);
  const [state, setState] = useState<SessionState>(() =>
    gateway.isEnabled() ? { status: 'loading' } : { status: 'disabled' },
  );
  const [adoption, setAdoption] = useState<AdoptionReport | null>(null);
  const adopting = useRef(false);

  useEffect(() => {
    if (!gateway.isEnabled()) return;

    let cancelled = false;
    const apply = (session: AuthSession | null) => {
      if (cancelled) return;
      setState(session ? { status: 'authenticated', session } : { status: 'anonymous' });
    };

    void gateway.current().then(apply);
    const unsubscribe = gateway.onChange(apply);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [gateway]);

  /**
   * Adopción del trabajo local. Se hace UNA vez por workspace y se recuerda:
   * repetirla duplicaría los personajes en cada arranque.
   */
  useEffect(() => {
    if (state.status !== 'authenticated' || adopting.current) return;
    const target = state.session.workspaceId;

    let done: string[] = [];
    try {
      done = JSON.parse(localStorage.getItem(ADOPTED_KEY) ?? '[]') as string[];
    } catch {
      done = [];
    }
    if (done.includes(target as string)) return;

    adopting.current = true;
    void adoptLocalWorkspace(
      LOCAL_WORKSPACE,
      target,
      new DexieCharacterRepository(),
      new DexieOutboxRepository(),
    )
      .then((report) => {
        setAdoption(report);
        try {
          localStorage.setItem(ADOPTED_KEY, JSON.stringify([...done, target as string]));
        } catch {
          // Sin almacenamiento la adopción se repetiría, pero `list()` ya no
          // devolvería nada local: el segundo intento no hace daño.
        }
      })
      .finally(() => {
        adopting.current = false;
      });
  }, [state]);

  const workspaceId =
    state.status === 'authenticated' ? state.session.workspaceId : LOCAL_WORKSPACE;

  const signOut = useCallback(async () => {
    await gateway.signOut();
    setAdoption(null);
  }, [gateway]);

  const sendRecovery = useCallback(
    (email: string) =>
      gateway.sendRecovery(
        email,
        typeof window !== 'undefined' ? `${window.location.origin}/auth/recover` : '/auth/recover',
      ),
    [gateway],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      workspaceId,
      isCloudEnabled: gateway.isEnabled(),
      adoption,
      signIn: (input) => gateway.signIn(input),
      signUp: (input) => gateway.signUp(input),
      signOut,
      sendRecovery,
      updatePassword: (password) => gateway.updatePassword(password),
    }),
    [state, workspaceId, gateway, adoption, signOut, sendRecovery],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession() fuera de <SessionProvider>');
  return ctx;
}
