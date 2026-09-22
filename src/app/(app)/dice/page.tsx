'use client';

import { DiceRoller } from '@ui/features/dice/DiceRoller';

export default function DicePage() {
  return (
    <div className="mx-auto max-w-lg space-y-5 animate-fade-in">
      <header>
        <h1 className="font-display text-2xl">Tirar dados</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Aleatoriedad criptográfica. Cada tirada queda en tu historial.
        </p>
      </header>
      <DiceRoller />
    </div>
  );
}
