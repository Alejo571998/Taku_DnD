'use client';

import Link from 'next/link';
import { CloudOff, LogOut, RefreshCw, UserRound } from 'lucide-react';
import { Button } from '@ui/design-system/Button';
import { Card, Chip, SectionTitle } from '@ui/design-system/primitives';
import { useSession } from '@ui/components/SessionProvider';
import { useSyncRunner } from '@ui/hooks/useSync';
import { usePendingSyncCount } from '@ui/hooks/useAppData';

/**
 * CUENTA Y SINCRONIZACIÓN
 *
 * Un solo bloque que responde: ¿dónde vive lo mío y está a salvo?
 *
 * Sin cuenta NO se muestra una advertencia: no tener cuenta es un estado
 * legítimo del producto, no un problema pendiente de arreglar.
 */
export function AccountSection() {
  const { state, isCloudEnabled, signOut, adoption } = useSession();
  const { state: sync, syncNow } = useSyncRunner();
  const pending = usePendingSyncCount();

  if (!isCloudEnabled) {
    return (
      <section>
        <SectionTitle>Cuenta</SectionTitle>
        <Card className="p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CloudOff className="size-4 text-[var(--text-tertiary)]" strokeWidth={2} />
            Todo vive en este dispositivo
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-tertiary)]">
            Esta copia de TAKU no tiene la nube configurada. Funciona entera, pero no sincroniza
            entre dispositivos.
          </p>
        </Card>
      </section>
    );
  }

  if (state.status === 'authenticated') {
    const user = state.session.user;
    return (
      <section>
        <SectionTitle>Cuenta</SectionTitle>
        <Card className="divide-y divide-[var(--border-subtle)]">
          <div className="flex items-center gap-3 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[var(--accent-text)]">
              <UserRound className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.displayName ?? user.email}</p>
              {user.displayName && (
                <p className="truncate text-xs text-[var(--text-tertiary)]">{user.email}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3">
            <RefreshCw
              className={`size-4 text-[var(--text-tertiary)] ${sync.phase === 'syncing' ? 'animate-spin' : ''}`}
            />
            <span className="flex-1 text-sm">Sincronización</span>
            <Chip tone={sync.phase === 'error' ? 'warning' : pending > 0 ? 'neutral' : 'success'}>
              {sync.phase === 'syncing'
                ? 'En curso'
                : sync.phase === 'error'
                  ? 'Reintentando'
                  : pending > 0
                    ? `${pending} pendientes`
                    : 'Al día'}
            </Chip>
          </div>

          {adoption && adoption.adopted > 0 && (
            <p className="px-4 py-3 text-xs text-[var(--text-tertiary)]">
              Se pasaron {adoption.adopted}{' '}
              {adoption.adopted === 1 ? 'personaje' : 'personajes'} de este dispositivo a tu cuenta.
            </p>
          )}

          <div className="flex items-center gap-2 p-3">
            <Button variant="secondary" size="sm" loading={sync.phase === 'syncing'} onClick={syncNow}>
              Sincronizar ahora
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="size-4" />
              Cerrar sesión
            </Button>
          </div>
        </Card>

        {sync.phase === 'error' && (
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">
            No pudimos sincronizar: {sync.message}. Tus cambios siguen guardados en este dispositivo
            y lo reintentamos solos.
          </p>
        )}
      </section>
    );
  }

  return (
    <section>
      <SectionTitle>Cuenta</SectionTitle>
      <Card className="p-4">
        <p className="text-sm font-medium">Jugando sin cuenta</p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-tertiary)]">
          Tus personajes están guardados en este dispositivo y funcionan sin conexión. Una cuenta
          sirve para una sola cosa: tenerlos también en el teléfono o en la tablet.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="primary" size="sm" asChild>
            <Link href="/auth/sign-up">Crear cuenta</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/auth/sign-in">Ya tengo una</Link>
          </Button>
        </div>
      </Card>
    </section>
  );
}
