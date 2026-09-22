'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, Dices, Plus, Sparkles, Swords, UserPlus } from 'lucide-react';
import { totalLevel } from '@domain/character/state';
import { Button } from '@ui/design-system/Button';
import { Card, EmptyState, SectionTitle, Skeleton } from '@ui/design-system/primitives';
import { DragonMark } from '@ui/design-system/Logo';
import { CharacterCard } from '@ui/components/CharacterCard';
import { useCharacters } from '@ui/hooks/useAppData';

/**
 * INICIO (MASTER SPEC §44)
 *
 * Lo primero que se ve debe responder a "¿qué hago ahora?". Por eso lo
 * primero de todo es continuar con el último personaje: durante una campaña,
 * es lo que el usuario quiere el 90 % de las veces.
 */
export default function HomePage() {
  const characters = useCharacters();
  const loading = characters === undefined;
  const latest = characters?.[0];


  return (
    <div className="space-y-8 animate-fade-in">
      <HeroPanel hasCharacter={Boolean(latest)} />

      {latest && (
        <section>
          <SectionTitle
            action={
              <Link href="/characters" className="text-xs text-[var(--accent-text)] hover:underline">
                Ver todos
              </Link>
            }
          >
            Continuar
          </SectionTitle>
          <ContinueCard
            name={latest.name}
            level={totalLevel(latest)}
            href={`/characters/${latest.id}/play`}
          />
        </section>
      )}

      <section>
        <SectionTitle
          action={
            characters && characters.length > 0 ? (
              <Link href="/characters" className="text-xs text-[var(--accent-text)] hover:underline">
                Ver todos
              </Link>
            ) : undefined
          }
        >
          Tus personajes
        </SectionTitle>

        {loading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-[5.5rem]" />
            <Skeleton className="h-[5.5rem]" />
          </div>
        ) : characters.length === 0 ? (
          <Card>
            <EmptyState
              mascot
              title="Todavía no tenés personajes"
              description="Soy Taku y te acompaño. Creá tu primer aventurero: calculamos todo por vos —modificadores, ataques, CA, hechizos— y se guarda en este dispositivo, sin cuenta y sin conexión."
              action={
                <Button asChild variant="primary" size="lg" leading={<Plus className="size-4" />}>
                  <Link href="/characters/new">Crear personaje</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {characters.slice(0, 4).map((c) => (
              <CharacterCard key={c.id} character={c} href={`/characters/${c.id}/play`} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Accesos rápidos</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <QuickAction href="/characters/new" icon={<UserPlus className="size-5" />} label="Crear personaje" />
          <QuickAction href="/dice" icon={<Dices className="size-5" />} label="Tirar dados" />
          <QuickAction href="/library" icon={<BookOpen className="size-5" />} label="Biblioteca" />
          <QuickAction href="/homebrew" icon={<Sparkles className="size-5" />} label="Homebrew" />
        </div>
      </section>
    </div>
  );
}

/**
 * Portada. Atmósfera procedural: brasas y un dragón vectorial, sin imágenes
 * externas. Funciona sin conexión y pesa cero.
 */
function HeroPanel({ hasCharacter }: { hasCharacter: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-accent)]">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 90% at 82% 25%, oklch(0.585 0.222 22 / 0.42), transparent 62%),' +
            'radial-gradient(ellipse 90% 70% at 15% 95%, oklch(0.425 0.175 22 / 0.30), transparent 60%),' +
            'linear-gradient(160deg, oklch(0.160 0.020 18), oklch(0.095 0.012 18))',
        }}
      />
      <DragonMark
        silhouette
        className="pointer-events-none absolute -right-8 top-1/2 size-56 -translate-y-1/2 text-[var(--color-crimson-300)] opacity-[0.16] sm:size-72"
      />

      <div className="relative px-5 py-7 sm:px-8 sm:py-10">
        <p className="text-2xs font-semibold uppercase tracking-[0.20em] text-[var(--accent-text)]">
          D&amp;D en tu bolsillo
        </p>
        <h1 className="mt-2 max-w-md font-display text-2xl leading-tight sm:text-3xl">
          {hasCharacter ? 'Tu aventura continúa' : '¡Bienvenido, aventurero!'}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
          {hasCharacter
            ? 'Retomá donde dejaste, o creá un personaje nuevo para tu próxima mesa.'
            : 'Creá, gestioná y jugá tus personajes de Dungeons & Dragons. Sin calculadora y sin conexión.'}
        </p>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Button asChild variant="primary" size="lg" trailing={<ArrowRight className="size-4" />}>
            <Link href="/characters/new">Crear personaje</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/library">Explorar contenido</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function ContinueCard({ name, level, href }: { name: string; level: number; href: string }) {
  return (
    <Link
      href={href}
      className="surface-card-accent flex items-center gap-4 p-4 transition-transform duration-150 active:scale-[0.99]"
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-muted)]">
        <Swords className="size-5 text-[var(--accent-text)]" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base font-semibold">{name}</p>
        <p className="text-xs text-[var(--text-tertiary)]">Nivel {level} · Modo Juego</p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-[var(--accent-text)]" />
    </Link>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2.5 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-4 text-center transition-[border-color,transform] duration-150 hover:border-[var(--border-accent)] active:scale-[0.98]"
    >
      <span className="flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-muted)] text-[var(--accent-text)]">
        {icon}
      </span>
      <span className="text-xs font-medium leading-tight">{label}</span>
    </Link>
  );
}
