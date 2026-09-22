'use client';

import { CloudOff, RefreshCw } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@ui/design-system/cn';
import { useConnection } from './AppProviders';
import { useSession } from './SessionProvider';
import { BottomNav, MobileHeader, Sidebar } from './navigation';
import { useContentBootstrap, usePendingSyncCount } from '@ui/hooks/useAppData';
import { LoadingState } from '@ui/design-system/primitives';
import { SyncCenter } from './SyncCenter';
import { TakuCompanion } from '@ui/features/taku/TakuCompanion';
import { TakuProvider } from '@ui/features/taku/TakuProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorState } from '@ui/design-system/primitives';

/**
 * Armazón de la aplicación.
 *
 * Móvil: cabecera + contenido + barra inferior.
 * Escritorio: barra lateral fija + contenido con más densidad.
 *
 * No son dos aplicaciones: es la misma jerarquía en dos densidades
 * (MASTER SPEC §46).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const content = useContentBootstrap();
  const router = useRouter();

  return (
    <TakuProvider>
    <div className="relative z-10 min-h-dvh">
      {/*
        La navegación lee la consulta para distinguir los atajos
        (`/library?type=spell`) de la sección base. `useSearchParams` obliga a
        un límite de Suspense para que las páginas sigan prerenderizándose
        como estáticas — sin esto, TODA la aplicación pasaría a dinámica.
      */}
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar footer={<SyncIndicator />} />
      </Suspense>

      <div className="lg:pl-[var(--sidebar-width)]">
        <MobileHeader right={<SyncBadge />} />

        <main
          id="contenido"
          className="mx-auto w-full max-w-6xl px-4 pb-[calc(var(--nav-offset)+1.5rem)] pt-4 lg:px-8 lg:pb-12 lg:pt-8"
        >
          {content.phase === 'seeding' ? (
            <ContentSeeding
              label={
                content.progress
                  ? `${content.progress.packName} · ${content.progress.loaded} de ${content.progress.total}`
                  : 'Preparando el contenido…'
              }
              value={content.progress ? content.progress.loaded : 0}
              max={content.progress ? content.progress.total : 1}
            />
          ) : content.phase === 'error' ? (
            <ErrorState
              title="No pudimos preparar el contenido"
              description="Hizo falta descargar las reglas y no lo logramos. Revisá tu conexión y volvé a intentar."
              hint={content.message}
              onRetry={() => window.location.reload()}
            />
          ) : (
            /*
              El limite va POR DENTRO del armazon: si una pantalla se rompe, la
              navegacion sigue viva y el jugador puede irse a otra seccion en
              vez de quedarse mirando una pagina en blanco.
            */
            <ErrorBoundary onGoHome={() => router.push('/')}>{children}</ErrorBoundary>
          )}
        </main>
      </div>

      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
      <OfflineBanner />
      {/* Arranca el ciclo de sincronizacion y avisa de conflictos. */}
      <SyncCenter />
      {/*
        Taku va al final del armazon, fuera de <main>: es un acompanante, no
        contenido de la pagina. Asi tampoco entra en el orden de lectura antes
        de lo que el usuario vino a hacer.
      */}
      <TakuCompanion />
    </div>
    </TakuProvider>
  );
}

/** Marco de la barra lateral mientras Suspense resuelve. Evita el salto. */
function SidebarSkeleton() {
  return (
    <aside
      aria-hidden="true"
      className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] border-r border-[var(--border-subtle)] bg-[var(--surface-raised)]/70 lg:block"
    />
  );
}

/**
 * Primera carga del contenido: ~3.000 definiciones a IndexedDB.
 * Se explica lo que está pasando en vez de mostrar un giro anónimo — el
 * usuario merece saber por qué espera (MASTER SPEC §55).
 */
function ContentSeeding({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-[var(--accent-muted)]">
        <RefreshCw className="size-7 animate-spin text-[var(--accent-text)]" strokeWidth={1.8} />
      </div>
      <h2 className="font-display text-xl">Preparando tu biblioteca</h2>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-tertiary)]">
        Estamos guardando las reglas en tu dispositivo para que funcionen sin conexión. Esto pasa una sola vez.
      </p>
      <div className="mt-6 w-full max-w-sm">
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
          <div
            className="h-full rounded-full bg-crimson-gradient transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">{label}</p>
      </div>
    </div>
  );
}

/**
 * Estado de conexión (MASTER SPEC §56, MASTER PROMPT §51).
 * "Sin conexión · Cambios guardados en este dispositivo" — nunca un error.
 * Trabajar sin red es el camino normal, no una avería.
 */
function OfflineBanner() {
  const { online } = useConnection();
  const pending = usePendingSyncCount();

  if (online) return null;

  return (
    <div
      role="status"
      className={cn(
        'fixed inset-x-0 z-40 mx-auto flex max-w-md items-center gap-2.5 px-4',
        'lg:left-[var(--sidebar-width)]',
      )}
      style={{ bottom: 'calc(var(--nav-offset) + 0.5rem)' }}
    >
      <div className="flex w-full items-center gap-2.5 rounded-full border border-[var(--warning-text)]/35 bg-[var(--surface-overlay)]/95 px-4 py-2.5 shadow-[var(--shadow-overlay)] backdrop-blur-xl">
        <CloudOff className="size-4 shrink-0 text-[var(--warning-text)]" strokeWidth={2} />
        <p className="min-w-0 flex-1 text-xs">
          <span className="font-medium">Sin conexión.</span>{' '}
          <span className="text-[var(--text-tertiary)]">
            {pending > 0
              ? `${pending} ${pending === 1 ? 'cambio guardado' : 'cambios guardados'} en este dispositivo.`
              : 'Tus cambios se guardan acá.'}
          </span>
        </p>
      </div>
    </div>
  );
}

function SyncBadge() {
  const { online } = useConnection();
  const pending = usePendingSyncCount();

  // Sin cuenta no hay nada que sincronizar, y el badge sobra: la cola local es
  // un detalle interno, no una alarma que el jugador tenga que atender.
  if (online && pending === 0) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium',
        online
          ? 'border-[var(--border-default)] text-[var(--text-tertiary)]'
          : 'border-[var(--warning-text)]/35 text-[var(--warning-text)]',
      )}
    >
      {online ? <RefreshCw className="size-3" /> : <CloudOff className="size-3" />}
      {pending > 0 ? pending : 'Offline'}
    </span>
  );
}

/**
 * Estado real de la sincronización.
 *
 * Decir "Sincronizando 1…" cuando no hay cuenta ni nube configurada es
 * exactamente el tipo de mentira que el producto no puede permitirse
 * (MASTER PROMPT §75). Sin cuenta, lo honesto es decir dónde están los datos.
 */
function SyncIndicator() {
  const { online } = useConnection();
  const { state, isCloudEnabled } = useSession();
  const pending = usePendingSyncCount();

  const signedIn = state.status === 'authenticated';
  const idle = !isCloudEnabled || !signedIn;

  const label = !online
    ? 'Sin conexión'
    : idle
      ? 'Guardado en este dispositivo'
      : pending > 0
        ? `Sincronizando ${pending}…`
        : 'Todo sincronizado';

  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-xs">
      <span
        className={cn(
          'size-2 shrink-0 rounded-full',
          !online
            ? 'bg-[var(--warning)] animate-ember'
            : idle
              ? 'bg-[var(--text-tertiary)]'
              : 'bg-[var(--success)]',
        )}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate text-[var(--text-tertiary)]">{label}</span>
    </div>
  );
}

export { LoadingState };
