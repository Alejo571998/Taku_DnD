'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Home,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { cn } from '@ui/design-system/cn';
import { Logo, DragonMark } from '@ui/design-system/Logo';

/**
 * NAVEGACIÓN GLOBAL (MASTER SPEC §43)
 *
 * Móvil: cinco destinos en la barra inferior, ni uno más.
 * Escritorio: la misma jerarquía en una barra lateral, con un segundo grupo
 * para lo que en móvil vive dentro del personaje.
 *
 * El indicador activo es carmesí con halo, como en la dirección artística.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/characters', label: 'Personajes', icon: Users },
  { href: '/library', label: 'Biblioteca', icon: BookOpen },
  { href: '/campaigns', label: 'Campañas', icon: Shield },
  { href: '/profile', label: 'Perfil', icon: Settings },
];

const SECONDARY_NAV: NavItem[] = [
  { href: '/library?type=rule', label: 'Reglas', icon: ScrollText },
  { href: '/library?type=spell', label: 'Hechizos', icon: Sparkles },
  { href: '/homebrew', label: 'Homebrew', icon: Swords },
];

function isActive(pathname: string, href: string, search: string): boolean {
  const [base, query] = href.split('?');
  if (!base) return false;

  /**
   * Los atajos que solo cambian la consulta (`/library?type=spell`) NO deben
   * marcarse activos por estar en `/library`: si no, "Reglas" y "Hechizos" se
   * encienden los dos a la vez y el indicador deja de significar nada.
   */
  if (query) return pathname === base && search === `?${query}`;

  if (base === '/') return pathname === '/';
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Barra inferior — solo móvil y tablet. */
export function BottomNav() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 lg:hidden',
        'border-t border-[var(--border-subtle)]',
        'bg-[var(--surface-raised)]/92 backdrop-blur-xl',
      )}
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="mx-auto flex max-w-2xl items-stretch">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(pathname, item.href, search ? '?' + search : '');
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-[var(--nav-height)] flex-col items-center justify-center gap-1',
                  'transition-colors duration-150',
                  active ? 'text-[var(--accent-text)]' : 'text-[var(--text-tertiary)]',
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-5 top-0 h-px bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]"
                  />
                )}
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.9} />
                <span className="text-2xs font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Barra lateral — solo escritorio. */
export function Sidebar({ footer }: { footer?: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  const renderItem = (item: NavItem) => {
    const active = isActive(pathname, item.href, search ? '?' + search : '');
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'group relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors duration-150',
            active
              ? 'bg-[var(--accent-muted)] font-medium text-[var(--accent-text)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-interactive)] hover:text-[var(--text-primary)]',
          )}
        >
          {active && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]"
            />
          )}
          <Icon className="size-[1.15rem] shrink-0" strokeWidth={active ? 2.3 : 1.9} />
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <aside
      className={cn(
        'hidden lg:flex lg:flex-col',
        'fixed inset-y-0 left-0 z-40 w-[var(--sidebar-width)]',
        'border-r border-[var(--border-subtle)] bg-[var(--surface-raised)]/70 backdrop-blur-xl',
      )}
    >
      <div className="px-5 py-6">
        <Link href="/" className="inline-flex min-h-11 items-center" aria-label="TAKU D&D — Inicio">
          <Logo size="md" />
        </Link>
      </div>

      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto scrollbar-slim px-3">
        <ul className="space-y-0.5">{PRIMARY_NAV.map(renderItem)}</ul>

        <div className="my-4 px-3">
          <div className="h-px bg-[var(--border-subtle)]" />
        </div>

        <p className="px-3 pb-2 text-2xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          Contenido
        </p>
        <ul className="space-y-0.5">{SECONDARY_NAV.map(renderItem)}</ul>
      </nav>

      {footer && <div className="border-t border-[var(--border-subtle)] p-3">{footer}</div>}
    </aside>
  );
}

/** Cabecera móvil con la marca. Se oculta en escritorio: allí está la sidebar. */
export function MobileHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-base)]/85 px-4 py-3 backdrop-blur-xl lg:hidden"
      style={{ paddingTop: 'calc(0.75rem + var(--safe-top))' }}
    >
      {/* `min-h-11`: el logo mide 28px de alto y tambien es el enlace a Inicio. */}
      <Link
        href="/"
        className="flex min-h-11 items-center gap-2"
        aria-label="TAKU D&D — Inicio"
      >
        <DragonMark className="size-7" />
        <span className="font-display text-base font-bold tracking-[0.16em]">TAKU</span>
        <span className="text-2xs font-semibold tracking-[0.28em] text-[var(--accent-text)]">D&amp;D</span>
      </Link>
      {right}
    </header>
  );
}
