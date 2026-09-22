'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { TakuSprite } from '@ui/features/taku/TakuSprite';

/** Primitivos compartidos: tarjetas, chips, estados y separadores. */

export function Card({
  className,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'surface-card relative',
        interactive &&
          'transition-[border-color,transform] duration-150 hover:border-[var(--border-strong)] active:scale-[0.995]',
        className,
      )}
      {...props}
    />
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 mb-3', className)}>
      <h2 className="font-display text-sm uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
        {children}
      </h2>
      {action}
    </div>
  );
}

/**
 * El título que va DENTRO de una tarjeta-panel.
 *
 * Es un `h2`, igual que `SectionTitle`, y por el mismo motivo: si parece un
 * título tiene que serlo en el marcado (WCAG 1.3.1). Existe como primitivo
 * porque los cuatro paneles del modo Juego lo tenían cada uno escrito a mano
 * con un `span`, y así la mitad de la pantalla se podía recorrer saltando de
 * encabezado en encabezado —la columna de Ataques y Recursos, que sí usaba
 * `SectionTitle`— y la otra mitad no.
 *
 * Se diferencia de `SectionTitle` en el tamaño y en que no lleva margen: va
 * pegado al borde de la tarjeta, normalmente con un icono al lado.
 */
export function PanelTitle({
  children,
  level = 2,
  className,
}: {
  children: ReactNode;
  /** `3` cuando el panel ya cuelga de un `SectionTitle`: los niveles no se saltan. */
  level?: 2 | 3;
  className?: string;
}) {
  const Tag = level === 3 ? 'h3' : 'h2';
  return (
    <Tag
      className={cn(
        'text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export type ChipTone = 'neutral' | 'accent' | 'danger' | 'success' | 'arcane' | 'warning';

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: 'bg-[var(--surface-interactive)] text-[var(--text-secondary)] border-[var(--border-default)]',
  accent: 'bg-[var(--accent-muted)] text-[var(--accent-text)] border-[var(--accent-text)]/30',
  danger: 'bg-[var(--danger-muted)] text-[var(--danger-text)] border-[var(--danger-text)]/30',
  success: 'bg-[var(--success-muted)] text-[var(--success-text)] border-[var(--success-text)]/30',
  arcane: 'bg-[var(--arcane-muted)] text-[var(--arcane-text)] border-[var(--arcane-text)]/30',
  warning: 'bg-[var(--warning-muted)] text-[var(--warning-text)] border-[var(--warning-text)]/30',
};

export function Chip({
  tone = 'neutral',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: ChipTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium',
        CHIP_TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Estado vacio (MASTER SPEC §52).
 * Debe explicar QUE falta, POR QUE y QUE hacer. Un icono con "Sin datos"
 * no es un estado vacio: es una rendicion.
 *
 * `mascot` cambia el icono por Taku, y se reserva para los estados vacíos de
 * PRIMERA VEZ —no tenés personajes, no tenés campañas—, no para cualquier
 * lista sin resultados. La diferencia importa: un vacío inicial es el momento
 * en que alguien puede no saber qué hace la aplicación, y no hay contenido que
 * tapar. Ponerlo también en "nada en esta categoría" lo volvería papel pintado.
 */
export function EmptyState({
  icon,
  mascot = false,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  mascot?: boolean;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center text-center px-6 py-12', className)}>
      {mascot ? (
        <div className="mb-4">
          <TakuSprite mood="greet" size={112} />
        </div>
      ) : (
        icon && (
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--surface-interactive)] text-[var(--text-tertiary)]">
            {icon}
          </div>
        )
      )}
      <h3 className="font-display text-lg text-[var(--text-primary)]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-[var(--text-tertiary)]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Esqueleto de carga. Refleja la FORMA del contenido, no un rectangulo generico. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-interactive)]', className)}
      aria-hidden="true"
    />
  );
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12" role="status" aria-live="polite">
      <svg className="size-6 animate-spin text-[var(--accent-text)]" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p className="text-sm text-[var(--text-tertiary)]">{label}</p>
    </div>
  );
}

/**
 * Estado de error (MASTER SPEC §51, MASTER PROMPT §81).
 * Nunca muestra codigos crudos: dice que paso, por que y que puede hacerse.
 */
export function ErrorState({
  title = 'No pudimos completar esta acción',
  description,
  hint,
  onRetry,
  className,
}: {
  title?: string;
  description: string;
  hint?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('rounded-[var(--radius-lg)] border border-[var(--danger-text)]/25 bg-[var(--danger-muted)] p-4', className)} role="alert">
      <p className="font-medium text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
      {hint && <p className="mt-2 text-xs text-[var(--text-tertiary)]">{hint}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-sm font-medium text-[var(--accent-text)] underline underline-offset-4"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Divider({ className, label }: { className?: string; label?: string }) {
  if (!label) {
    return <hr className={cn('border-0 border-t border-[var(--border-subtle)]', className)} />;
  }
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <hr className="flex-1 border-0 border-t border-[var(--border-subtle)]" />
      <span className="text-2xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</span>
      <hr className="flex-1 border-0 border-t border-[var(--border-subtle)]" />
    </div>
  );
}

/** Barra de progreso semantica. El color nunca es el unico indicador. */
export function ProgressBar({
  value,
  max,
  tone = 'accent',
  className,
  label,
}: {
  value: number;
  max: number;
  tone?: ChipTone;
  className?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fill: Record<ChipTone, string> = {
    neutral: 'bg-[var(--text-tertiary)]',
    accent: 'bg-[var(--accent)]',
    danger: 'bg-[var(--danger)]',
    success: 'bg-[var(--success)]',
    arcane: 'bg-[var(--arcane)]',
    warning: 'bg-[var(--warning)]',
  };
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]', className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', fill[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
