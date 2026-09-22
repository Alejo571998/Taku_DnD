'use client';

import Link from 'next/link';
import { Plus, UserPlus } from 'lucide-react';
import { Button } from '@ui/design-system/Button';
import { Card, EmptyState, Skeleton } from '@ui/design-system/primitives';
import { CharacterCard } from '@ui/components/CharacterCard';
import { useCharacters } from '@ui/hooks/useAppData';

export default function CharactersPage() {
  const characters = useCharacters();

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Personajes</h1>
        <Button asChild variant="primary" size="md" leading={<Plus className="size-4" />}>
          <Link href="/characters/new">Crear</Link>
        </Button>
      </header>

      {characters === undefined ? (
        <div className="space-y-2.5">
          <Skeleton className="h-[5.5rem]" />
          <Skeleton className="h-[5.5rem]" />
          <Skeleton className="h-[5.5rem]" />
        </div>
      ) : characters.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserPlus className="size-6" strokeWidth={1.8} />}
            mascot
            title="Todavía no tenés personajes"
            description="Un personaje es tu ficha viva: calcula sola los modificadores, los ataques y los hechizos mientras jugás."
            action={
              <Button asChild variant="primary" size="lg" leading={<Plus className="size-4" />}>
                <Link href="/characters/new">Crear personaje</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {characters.map((c) => (
            <CharacterCard key={c.id} character={c} href={`/characters/${c.id}/play`} />
          ))}
        </div>
      )}
    </div>
  );
}
