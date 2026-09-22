'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { asCharacterId } from '@domain/shared/ids';
import { cn } from '@ui/design-system/cn';
import { Button } from '@ui/design-system/Button';
import { Card, LoadingState, SectionTitle } from '@ui/design-system/primitives';
import { ConfirmDialog } from '@ui/design-system/Sheet';
import { CharacterHeader } from '@ui/components/CharacterHeader';
import { CompatibilityLog } from '@ui/features/library/CompatibilityLog';
import { characterService, useCharacter, useCharacterSheet, useDispatch } from '@ui/hooks/useAppData';

/**
 * AJUSTES DEL PERSONAJE (MASTER SPEC §54 de personalización)
 *
 * Personalización progresiva, no un panel de configuración infinito: solo lo
 * que cambia de verdad cómo se juega.
 */
export default function CharacterSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const character = useCharacter(asCharacterId(id));
  const sheet = useCharacterSheet(character);
  const dispatch = useDispatch(character);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!character || !sheet) return <LoadingState label="Cargando…" />;

  const toggles: { key: keyof typeof character.settings; label: string; hint: string }[] = [
    {
      key: 'autoConsumeAmmunition',
      label: 'Descontar munición automáticamente',
      hint: 'Al atacar con un arco, se resta una flecha. Si lo apagás, la controlás vos.',
    },
    {
      key: 'autoConsumeSpellSlots',
      label: 'Gastar espacios de conjuro al lanzar',
      hint: 'Descuenta el espacio sin preguntar. Siempre podés deshacerlo.',
    },
    {
      key: 'encumbranceVariant',
      label: 'Regla variante de carga',
      hint: 'Tu velocidad baja antes de llegar al peso máximo. Más realista, más estricta.',
    },
    {
      key: 'beginnerMode',
      label: 'Modo principiante',
      hint: 'Muestra explicaciones y recomendaciones en cada pantalla.',
    },
  ];

  return (
    <div className="animate-fade-in">
      <CharacterHeader sheet={sheet} />

      <h2 className="mb-4 font-display text-lg">Ajustes</h2>

      <SectionTitle>Automatización</SectionTitle>
      <Card className="divide-y divide-[var(--border-subtle)]">
        {toggles.map((t) => {
          const value = Boolean(character.settings[t.key]);
          return (
            <button
              key={String(t.key)}
              role="switch"
              aria-checked={value}
              onClick={() => void dispatch({ type: 'UpdateSettings', patch: { [t.key]: !value } }, { silent: true })}
              className="flex w-full items-start gap-3 p-4 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{t.label}</span>
                <span className="mt-0.5 block text-xs text-[var(--text-tertiary)]">{t.hint}</span>
              </span>
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors',
                  value ? 'bg-[var(--accent)]' : 'bg-[var(--surface-interactive)]',
                )}
                aria-hidden="true"
              >
                <span
                  className={cn(
                    'size-5 rounded-full bg-white transition-transform',
                    value && 'translate-x-4',
                  )}
                />
              </span>
            </button>
          );
        })}
      </Card>

      <CompatibilityLog character={character} dispatch={dispatch} />

      <div className="mt-6">
        <SectionTitle>Zona de riesgo</SectionTitle>
        <Card className="p-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Borrar el personaje lo quita de todos tus dispositivos. No se puede deshacer.
          </p>
          <Button variant="danger" className="mt-3 w-full" onClick={() => setConfirmDelete(true)}>
            Borrar personaje
          </Button>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Borrar a ${character.name}?`}
        description="Se va a borrar de este dispositivo y de los demás cuando se sincronice. Esta acción no se puede deshacer."
        confirmLabel="Borrar"
        onConfirm={() => {
          void characterService()
            .delete(character.id)
            .then(() => router.push('/characters'));
        }}
      />
    </div>
  );
}
