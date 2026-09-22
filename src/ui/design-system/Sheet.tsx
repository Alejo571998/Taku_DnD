'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * Hoja inferior / diálogo.
 *
 * En móvil sube desde abajo, que es donde llega el pulgar. En escritorio se
 * centra como un diálogo. Mismo componente, dos densidades — no dos
 * implementaciones que se desincronizan.
 *
 * Radix aporta el foco atrapado, el cierre con Escape y los roles ARIA:
 * accesibilidad resuelta sin heredar un aspecto genérico.
 *
 * DEVOLVER EL FOCO AL CERRAR
 *
 * Radix lo hace solo… si el diálogo se abre desde un `Dialog.Trigger`. Acá no:
 * se abren cambiando estado desde cualquier botón, que es lo que permite abrir
 * el mismo editor desde la cabecera o desde la lista. Sin trigger, Radix no
 * tiene a dónde volver y el foco termina en `<body>`.
 *
 * Para quien usa el teclado o un lector de pantalla, eso significa volver al
 * principio de la página en CADA interacción. Se cierra un diálogo y hay que
 * recorrer el menú entero otra vez para seguir donde se estaba.
 *
 * Por eso se recuerda quién tenía el foco y se lo devuelve a mano.
 */

/**
 * El último elemento que tuvo el foco FUERA de un diálogo.
 *
 * La versión anterior guardaba `document.activeElement` dentro de
 * `onOpenAutoFocus`, y funcionaba EN ALGUNOS SITIOS: el diálogo de Homebrew
 * devolvía el foco —hay un test que lo comprueba y pasa— y el de puntos de
 * golpe no. Medido en la ficha: se abría el ajuste de PG, se cerraba con
 * Escape y el foco acababa en `<body>`.
 *
 * No se persiguió por qué una pantalla sí y la otra no. Depender de CUÁNDO
 * llega un evento y de qué tiene el foco en ese instante es frágil por
 * construcción, y esto no lo necesita: el registro ya tiene el dato cuando
 * hace falta. Es de módulo y no por instancia porque algunas hojas se montan
 * A LA VEZ que se abren —`{editando && <EditarSheet/>}`— y un efecto dentro
 * del componente llegaría tarde para ver quién las abrió.
 *
 * Se ignora lo que ya está dentro de un diálogo: por eso sigue valiendo al
 * cerrar, y con dos hojas encadenadas se vuelve al botón de la primera y no al
 * que quedó a medias.
 */
let ultimoFocoFuera: HTMLElement | null = null;

if (typeof document !== 'undefined') {
  document.addEventListener(
    'focusin',
    (event) => {
      const destino = event.target as HTMLElement | null;
      if (!destino || typeof destino.closest !== 'function') return;
      if (destino.closest('[role="dialog"]')) return;
      ultimoFocoFuera = destino;
    },
    true,
  );
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const maxWidth = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[size];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            /*
              Se lee el registro global AQUÍ y no al abrir: así no hace falta
              que llegue ningún evento de apertura ni acertar con el instante.

              Da el mismo elemento, porque mientras el diálogo está abierto
              todo lo que recibe el foco está dentro de él, y el registro
              ignora lo que esté dentro de un diálogo.
            */
            const target = ultimoFocoFuera;
            // Si el elemento ya no existe —la lista se reordenó, la fila se
            // borró— se deja que Radix haga lo que pueda. Enfocar un nodo
            // desconectado no hace nada y deja el foco perdido igual.
            if (!target || !document.contains(target)) return;
            event.preventDefault();
            /*
              El foco se pide en el cuadro SIGUIENTE, para que la llamada caiga
              después de que React desmonte el diálogo. Al quitar el elemento
              que tenía el foco, el navegador lo manda a `<body>`: hacerlo
              antes es arriesgarse a que ese reseteo lo deshaga.
            */
            requestAnimationFrame(() => {
              if (document.contains(target)) target.focus();
            });
          }}
          className={cn(
            'fixed z-50 flex flex-col bg-[var(--surface-overlay)] shadow-[var(--shadow-overlay)]',
            // Móvil: hoja inferior
            'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[var(--radius-2xl)] border-t border-[var(--border-default)] animate-sheet-in',
            // Escritorio: diálogo centrado
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85dvh] sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2',
            'sm:rounded-[var(--radius-xl)] sm:border sm:animate-slide-up',
            maxWidth,
          )}
          style={{ paddingBottom: 'var(--safe-bottom)' }}
        >
          {/* Asa de arrastre: señal visual de que esto se desliza */}
          <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true">
            <div className="h-1 w-10 rounded-full bg-[var(--border-strong)]" />
          </div>

          <header className="flex items-start gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-lg leading-tight">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-[var(--text-tertiary)]">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Cerrar"
              className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-interactive)] hover:text-[var(--text-primary)]"
            >
              <X className="size-4.5" />
            </Dialog.Close>
          </header>

          <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>

          {footer && (
            <footer className="border-t border-[var(--border-subtle)] px-5 py-3.5">{footer}</footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Confirmación para acciones que no se pueden deshacer con seguridad.
 * Todo lo reversible NO pasa por aquí: se hace y se ofrece "Deshacer"
 * (MASTER SPEC §54). Preguntar por todo entrena a decir que sí sin leer.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} size="sm">
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
      <div className="mt-5 flex gap-2.5">
        <button
          onClick={() => onOpenChange(false)}
          className="h-11 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] text-sm font-medium transition-colors hover:bg-[var(--surface-interactive)]"
        >
          {cancelLabel}
        </button>
        <button
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
          className={cn(
            'h-11 flex-1 rounded-[var(--radius-md)] text-sm font-semibold text-white transition-[filter]',
            tone === 'danger' ? 'bg-[var(--danger)]' : 'bg-crimson-gradient',
            'hover:brightness-110',
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
