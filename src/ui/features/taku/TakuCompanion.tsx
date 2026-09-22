'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, MessageCircleOff, VolumeX, X } from 'lucide-react';
import { cn } from '@ui/design-system/cn';
import { Sheet } from '@ui/design-system/Sheet';
import { useConnection } from '@ui/components/AppProviders';
import { getTakuAssistant, shortcutsFor, type TakuContext } from './assistant';
import { TIPS } from './lines';
import { TakuSprite } from './TakuSprite';
import { useTaku, useTakuCue, useTakuPresence } from './TakuProvider';

/**
 * TAKU EN LA ESQUINA.
 *
 * Presencia permanente y puerta del asistente. Tres decisiones de colocación
 * que importan más que el personaje en sí:
 *
 *   1. NO TAPA CONTENIDO. En móvil se apoya sobre `--nav-offset`, que es el
 *      alto de la barra inferior; en escritorio arranca después de la barra
 *      lateral, igual que el aviso de "sin conexión". Se sigue esa misma
 *      convención a propósito: dos elementos flotantes con reglas distintas
 *      terminan solapándose en algún tamaño de pantalla.
 *
 *   2. SE APARTA. Cuando aparece el aviso de sin conexión, Taku sube. El aviso
 *      es información que el usuario necesita; Taku es compañía.
 *
 *   3. NO SE PONE DELANTE DE UN DIÁLOGO. Vive en z-30, debajo de la barra
 *      lateral (z-40) y de los diálogos (z-50).
 */
export function TakuCompanion() {
  const { cue, mood } = useTakuPresence();
  const { muted, setMuted, dismiss } = useTaku();
  const { online } = useConnection();
  const pathname = usePathname();
  const [panelOpen, setPanelOpen] = useState(false);

  // En el asistente de creación Taku no entra: son doce pasos con la decisión
  // siempre abajo, y una burbuja ahí es competencia directa por la atención.
  const hidden = pathname?.startsWith('/characters/new') || pathname?.startsWith('/auth');

  // Quedarse sin red da miedo la primera vez. El aviso de arriba dice QUE pasó;
  // esto dice que no pasa nada, que es la otra mitad de la información.
  //
  // El hook va ANTES del `return null`: llamarlo después sería condicional, y
  // React exige el mismo orden en cada renderizado. Por eso la condición de
  // ocultarse entra en el argumento en vez de saltarse la llamada.
  useTakuCue(!hidden && !online, TIPS.offlineFirst);

  if (hidden) return null;

  const context: TakuContext = {
    route: pathname ?? '/',
    activity: activityOf(pathname ?? '/'),
    online,
  };

  return (
    <>
      <div
        className={cn(
          'pointer-events-none fixed left-4 z-30 flex flex-col items-start gap-2',
          'lg:left-[calc(var(--sidebar-width)+1.5rem)]',
        )}
        style={{
          // El aviso de sin conexión ocupa esa franja: Taku se corre arriba.
          bottom: online
            ? 'calc(var(--nav-offset) + 0.75rem)'
            : 'calc(var(--nav-offset) + 4.25rem)',
        }}
      >
        {/* La burbuja va ARRIBA del sprite, no al lado: ocupa el ancho de una
            columna de lectura en vez de meterse en la del contenido. */}
        {cue && <TakuBubble text={cue.line} onDismiss={dismiss} />}

        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Abrir la ayuda de Taku"
          className={cn(
            'pointer-events-auto grid shrink-0 place-items-center rounded-full',
            // Fondo opaco y sin : el desenfoque se recalcula en
            // cada fotograma del sprite que tiene encima, y este botón no se va
            // nunca de la pantalla.
            'size-14 border border-[var(--border-subtle)] bg-[var(--surface-overlay)]',
            'shadow-[var(--shadow-overlay)]',
            'transition-transform duration-150 hover:scale-105 active:scale-95',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
          )}
        >
          <TakuSprite mood={mood} size={46} priority />
        </button>
      </div>

      <Sheet
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title="Taku"
        description="Atajos a lo que más se busca en mitad de una partida."
      >
        <TakuPanel context={context} muted={muted} onMute={() => setMuted(true)} />
      </Sheet>
    </>
  );
}

/**
 * La burbuja.
 *
 * NO INTERCEPTA TOQUES. El cuerpo queda en `pointer-events-none` y solo la
 * cruz de cerrar es pulsable. Es la diferencia entre "a veces me tapa un
 * texto durante seis segundos" y "me robó el botón que quería pulsar": lo
 * primero se aguanta, lo segundo es un fallo. Sobre un botón, el toque pasa
 * de largo y llega a donde iba.
 *
 * `role="status"` con `aria-live` polite: lo que Taku dice se anuncia, pero
 * sin interrumpir. Con `assertive` cortaría el anuncio de los puntos de golpe,
 * que importa mucho más que un comentario.
 */
function TakuBubble({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none flex max-w-[min(20rem,calc(100vw-3rem))] items-start gap-2',
        'rounded-[var(--radius-lg)] rounded-bl-sm border border-[var(--border-subtle)]',
        'bg-[var(--surface-overlay)] px-3.5 py-2.5 shadow-[var(--shadow-overlay)]',
        'animate-slide-up',
      )}
    >
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--text-secondary)]">{text}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar el mensaje de Taku"
        className="pointer-events-auto -mr-1 -mt-0.5 shrink-0 rounded p-1 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function TakuPanel({
  context,
  muted,
  onMute,
}: {
  context: TakuContext;
  muted: boolean;
  onMute: () => void;
}) {
  const assistant = getTakuAssistant();
  const canChat = assistant?.isAvailable(context) ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3.5">
        <TakuSprite mood="greet" size={64} />
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--text-tertiary)]">
          {/*
            Honestidad antes que efecto: todavía no hay conversación, y un campo
            de texto que no contesta es peor que no tenerlo (MASTER PROMPT §75).
            Cuando se registre un asistente, esto se reemplaza por el chat solo.
          */}
          {canChat
            ? 'Preguntame lo que quieras sobre las reglas.'
            : 'Todavía no sé conversar. Por ahora te llevo rápido a donde está la respuesta.'}
        </p>
      </div>

      <ul className="space-y-2">
        {shortcutsFor(context).map((shortcut) => (
          <li key={shortcut.href + shortcut.label}>
            <Link
              href={shortcut.href}
              className={cn(
                'flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)]',
                'bg-[var(--surface-raised)] p-3 transition-colors hover:border-[var(--border-default)]',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{shortcut.label}</span>
                <span className="block text-xs text-[var(--text-tertiary)]">{shortcut.detail}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-[var(--text-tertiary)]" />
            </Link>
          </li>
        ))}
      </ul>

      {!muted && (
        <button
          type="button"
          onClick={onMute}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)]',
            'border border-[var(--border-subtle)] py-2.5 text-xs text-[var(--text-tertiary)]',
            'transition-colors hover:text-[var(--text-secondary)]',
          )}
        >
          <VolumeX className="size-3.5" />
          Que no me hable durante la partida
        </button>
      )}

      {muted && (
        <p className="flex items-center justify-center gap-2 py-1 text-xs text-[var(--text-tertiary)]">
          <MessageCircleOff className="size-3.5" />
          Silenciado. Se cambia en Perfil.
        </p>
      )}
    </div>
  );
}

/** La ruta, traducida a lo que el usuario está haciendo. */
function activityOf(pathname: string): string {
  if (pathname.includes('/play')) return 'play';
  if (pathname.includes('/characters/new')) return 'create';
  if (pathname.startsWith('/library')) return 'library';
  if (pathname.startsWith('/homebrew')) return 'homebrew';
  if (pathname.startsWith('/campaigns')) return 'campaigns';
  if (pathname.startsWith('/dice')) return 'dice';
  return 'home';
}
