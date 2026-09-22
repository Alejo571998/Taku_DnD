'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, Settings2 } from 'lucide-react';
import type { CharacterSheet } from '@domain/character/sheet';
import { RULESET_SHORT } from '@domain/rules/ruleset';
import { cn } from '@ui/design-system/cn';
import { Chip } from '@ui/design-system/primitives';
import { CharacterAvatar } from './CharacterCard';

/**
 * PRINCIPIO "NO PERDER CONTEXTO" (MASTER SPEC §56)
 *
 * Esta cabecera responde en todo momento a las cuatro preguntas: qué
 * personaje, de qué nivel y clase, con qué reglas, y en qué modo estoy.
 * Cambiar de contexto siempre requiere una acción explícita.
 */
export function CharacterHeader({ sheet }: { sheet: CharacterSheet }) {
  const pathname = usePathname();
  const id = sheet.state.id;
  const inPlay = pathname.includes('/play');

  const classLine = sheet.classes
    .map((c) => `${c.name}${c.subclassName ? ` (${c.subclassName})` : ''} ${c.level}`)
    .join(' · ');

  return (
    <div className="mb-5 space-y-3">
      <div className="flex items-center gap-3">
        <Link
          href="/characters"
          aria-label="Volver a personajes"
          className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-interactive)] hover:text-[var(--text-primary)]"
        >
          <ChevronLeft className="size-5" />
        </Link>

        <CharacterAvatar name={sheet.state.name} className="size-11" />

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg leading-tight">{sheet.state.name}</h1>
          <p className="truncate text-xs text-[var(--text-tertiary)]">
            {sheet.speciesName !== '—' && `${sheet.speciesName} · `}
            {classLine || 'Sin clase'}
          </p>
        </div>

        <Chip tone="neutral" className="shrink-0">
          {RULESET_SHORT[sheet.ruleset]}
        </Chip>

        <Link
          href={`/characters/${id}/manage/settings`}
          aria-label="Ajustes del personaje"
          className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-interactive)] hover:text-[var(--text-primary)]"
        >
          <Settings2 className="size-4.5" />
        </Link>
      </div>

      <ModeSwitch characterId={id} active={inPlay ? 'play' : 'manage'} />
    </div>
  );
}

/**
 * Modo Juego = velocidad. Modo Gestión = profundidad (MASTER SPEC §9).
 * No son dos aplicaciones: son dos modos del mismo sistema, y el conmutador
 * lo deja claro.
 */
function ModeSwitch({ characterId, active }: { characterId: string; active: 'play' | 'manage' }) {
  const items = [
    { key: 'play' as const, label: 'Juego', href: `/characters/${characterId}/play` },
    { key: 'manage' as const, label: 'Gestión', href: `/characters/${characterId}/manage` },
  ];

  return (
    <div
      role="tablist"
      aria-label="Modo del personaje"
      className="grid grid-cols-2 gap-1 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-1"
    >
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              'rounded-[var(--radius-md)] py-2 text-center text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-crimson-gradient text-[var(--accent-on)] shadow-[var(--shadow-crimson)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
