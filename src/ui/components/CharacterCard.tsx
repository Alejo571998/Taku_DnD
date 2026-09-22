'use client';

import Link from 'next/link';
import { ChevronRight, Heart } from 'lucide-react';
import type { CharacterState } from '@domain/character/state';
import { totalLevel } from '@domain/character/state';
import { cn } from '@ui/design-system/cn';
import { useCharacterSheet } from '@ui/hooks/useAppData';

/**
 * Tarjeta de personaje.
 *
 * Muestra lo que importa de un vistazo antes de una partida: quién es, de qué
 * nivel, y cuánta vida le queda. Nada más — una tarjeta que lo dice todo no
 * dice nada.
 */
export function CharacterCard({
  character,
  href,
  compact = false,
}: {
  character: CharacterState;
  href?: string;
  compact?: boolean;
}) {
  const sheet = useCharacterSheet(character);
  const level = totalLevel(character);

  const className = character.classes.length > 0 ? (sheet?.classes[0]?.name ?? '') : 'Sin clase';
  const species = sheet?.speciesName ?? '';
  const hp = sheet?.hitPoints;
  const pct = hp ? hp.percent : 100;

  const tone =
    !hp || hp.status === 'healthy'
      ? 'bg-[var(--success)]'
      : hp.status === 'down'
        ? 'bg-[var(--text-tertiary)]'
        : hp.status === 'critical'
          ? 'bg-[var(--danger)]'
          : 'bg-[var(--warning)]';

  const body = (
    <>
      <CharacterAvatar name={character.name} className={compact ? 'size-12' : 'size-14'} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base font-semibold">{character.name}</p>
        <p className="truncate text-xs text-[var(--text-tertiary)]">
          Nivel {level}
          {className && ` · ${className}`}
          {!compact && species && ` · ${species}`}
        </p>

        {hp && (
          <div className="mt-2 flex items-center gap-2">
            <Heart className="size-3 shrink-0 text-[var(--danger-text)]" strokeWidth={2.4} />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
              <div
                className={cn('h-full rounded-full transition-[width] duration-500', tone)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-numeric shrink-0 text-2xs text-[var(--text-tertiary)]">
              {hp.current}/{hp.max.value}
            </span>
          </div>
        )}
      </div>

      <ChevronRight className="size-4 shrink-0 text-[var(--text-tertiary)]" />
    </>
  );

  const shell = cn(
    'flex items-center gap-3.5 rounded-[var(--radius-lg)] border border-[var(--border-subtle)]',
    'bg-[var(--surface-raised)] p-3.5 transition-[border-color,transform] duration-150',
    'hover:border-[var(--border-accent)] active:scale-[0.99]',
  );

  if (!href) return <div className={shell}>{body}</div>;

  return (
    <Link href={href} className={shell}>
      {body}
    </Link>
  );
}

/**
 * Retrato por defecto: inicial sobre un degradado derivado del nombre.
 * Determinista, sin red, sin assets. Mejor que un icono gris igual para todos.
 */
export function CharacterAvatar({
  name,
  className,
  src,
}: {
  name: string;
  className?: string;
  src?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = hash % 360;

  if (src) {
    return (
      // `next/image` optimiza en el servidor, y estos retratos son archivos que
      // el usuario guarda en SU dispositivo: pasarlos por un optimizador remoto
      // rompería el funcionamiento sin conexión. `<img>` es lo correcto aquí.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn('shrink-0 rounded-[var(--radius-md)] object-cover', className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[var(--radius-md)]',
        'border border-[var(--border-default)] font-display text-lg font-semibold text-white',
        className,
      )}
      style={{
        background: `linear-gradient(140deg, oklch(0.45 0.14 ${hue}), oklch(0.24 0.10 ${(hue + 40) % 360}))`,
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
