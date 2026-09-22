import type { Metadata } from 'next';
import Link from 'next/link';
import { DragonMark } from '@ui/design-system/Logo';

export const metadata: Metadata = { title: 'Sin conexión' };

/**
 * Pantalla de reserva del service worker.
 *
 * Solo aparece si se pide una página que nunca se visitó Y no hay red. Explica
 * qué pasó y qué SÍ funciona — nunca un error técnico (MASTER PROMPT §81).
 */
export default function OfflinePage() {
  return (
    <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <DragonMark className="size-16 opacity-60" />
      <h1 className="mt-5 font-display text-2xl">Esta página no está guardada</h1>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
        Estás sin conexión y esta pantalla todavía no se descargó en tu dispositivo.
      </p>
      <p className="mt-4 max-w-sm text-sm text-[var(--text-tertiary)]">
        Tus personajes, la biblioteca y los dados sí funcionan sin conexión. Volvé a la pantalla
        anterior o abrí la aplicación desde el inicio.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center rounded-[var(--radius-lg)] bg-crimson-gradient px-6 font-semibold text-[var(--accent-on)]"
      >
        Ir al inicio
      </Link>
    </main>
  );
}
