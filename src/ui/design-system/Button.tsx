'use client';

import { Slot, Slottable } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * Boton del sistema.
 *
 * Los tamaños respetan el objetivo tactil de 44px (WCAG AA / MASTER SPEC §49):
 * `sm` mide 36px de alto pero se usa solo en filas densas de escritorio.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'arcane';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  // El botón de marca: degradado carmesí con halo. Es el único con halo —
  // si todo brilla, nada destaca.
  primary:
    'bg-crimson-gradient text-[var(--accent-on)] font-semibold shadow-[var(--shadow-crimson)] hover:brightness-110 hover:shadow-[var(--shadow-crimson-lg)] active:brightness-95',
  secondary:
    'bg-[var(--surface-interactive)] text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-overlay)]',
  ghost:
    'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-interactive)]',
  danger:
    'bg-[var(--danger)] text-white font-semibold hover:brightness-110 active:brightness-95',
  success:
    'bg-[var(--success)] text-[var(--text-inverse)] font-semibold hover:brightness-110 active:brightness-95',
  arcane:
    'bg-[var(--arcane)] text-white font-semibold hover:brightness-110 active:brightness-95',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5 rounded-[var(--radius-sm)]',
  md: 'h-11 px-4 text-sm gap-2 rounded-[var(--radius-md)]',
  lg: 'h-13 px-6 text-base gap-2.5 rounded-[var(--radius-lg)]',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renderiza como el hijo (para envolver un Link sin anidar botones). */
  asChild?: boolean;
  loading?: boolean;
  iconOnly?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    asChild = false,
    loading = false,
    iconOnly = false,
    leading,
    trailing,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  const Component = asChild ? Slot : 'button';

  return (
    <Component
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center select-none',
        'transition-[background-color,border-color,filter,transform] duration-150',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
        /*
          `aria-disabled` se ve igual de apagado que `disabled`, pero SIGUE
          recibiendo foco: es lo que se usa cuando el motivo del bloqueo hay
          que poder escucharlo. Nada de `pointer-events-none` acá, que además
          taparía el cursor de «no se puede».
        */
        'aria-disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        iconOnly && (size === 'sm' ? 'w-9 px-0' : size === 'md' ? 'w-11 px-0' : 'w-13 px-0'),
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : leading}
      {/*
        `Slottable` marca cuál de los hijos es el que Slot debe fusionar con el
        elemento envuelto. Sin esto, un botón `asChild` con icono rompe en el
        renderizado: Slot solo acepta un hijo y aquí hay tres.
      */}
      <Slottable>{!iconOnly && children}</Slottable>
      {!loading && trailing}
    </Component>
  );
});

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
