'use client';

import { use } from 'react';
import Link from 'next/link';
import { asCharacterId } from '@domain/shared/ids';
import { EmptyState, LoadingState } from '@ui/design-system/primitives';
import { CharacterHeader } from '@ui/components/CharacterHeader';
import { LevelUpFlow } from '@ui/features/levelup/LevelUpFlow';
import { useCharacter, useCharacterSheet, useContentIndex, useDispatch } from '@ui/hooks/useAppData';

/**
 * SUBIDA DE NIVEL
 *
 * La pantalla no decide nada: carga el personaje, la ficha y el contenido, y
 * deja que el dominio diga qué cambia. Todo lo demás vive en
 * `@domain/character/progression`.
 */
export default function LevelUpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const character = useCharacter(asCharacterId(id));
  const sheet = useCharacterSheet(character);
  const content = useContentIndex(character?.ruleset ?? '2014');
  const dispatch = useDispatch(character);

  if (character === null) {
    return (
      <EmptyState
        title="No encontramos este personaje"
        description="Puede que lo hayas borrado en otro dispositivo."
        action={
          <Link
            href="/characters"
            className="text-sm font-medium text-[var(--accent-text)] underline underline-offset-4"
          >
            Volver a personajes
          </Link>
        }
      />
    );
  }

  if (!character || !sheet || !content || content.size === 0) {
    return <LoadingState label="Preparando la subida de nivel…" />;
  }

  return (
    <div className="animate-fade-in">
      <CharacterHeader sheet={sheet} />
      <LevelUpFlow sheet={sheet} content={content} dispatch={dispatch} />
    </div>
  );
}
