'use client';

import Image from 'next/image';
import { cn } from '@ui/design-system/cn';
import type { TakuMood } from './cues';

/**
 * EL RETRATO DE TAKU.
 *
 * El dibujo es UNO y no se modifica: es la identidad del personaje. Todo lo
 * que parece expresión sale del movimiento del conjunto —respirar, inclinarse,
 * dar un saltito— nunca de repintar la cara ni de recortar partes.
 *
 * Eso es una restricción y también una ventaja: un solo archivo que se cachea
 * una vez, en vez de un pliego de sprites por estado.
 *
 * Las animaciones quedan desactivadas solas con `prefers-reduced-motion`, por
 * la regla global de `globals.css`. Ahí Taku se queda quieto y las frases
 * siguen apareciendo: la información no depende del movimiento.
 */

const MOOD_MOTION: Record<TakuMood, string> = {
  idle: 'animate-taku-idle',
  greet: 'animate-taku-greet',
  celebrate: 'animate-taku-celebrate',
  worry: 'animate-taku-worry',
  think: 'animate-taku-think',
};

export function TakuSprite({
  mood = 'idle',
  size = 56,
  className,
  priority = false,
}: {
  mood?: TakuMood;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      // `taku-384` cubre hasta 128 px a 3x. El original de 500 px pesa seis
      // veces más y no se ve mejor a estos tamaños.
      src={size > 96 ? '/taku/taku-384.png' : '/taku/taku-192.png'}
      alt=""
      width={size}
      height={size}
      priority={priority}
      // Decorativo: el mensaje va en la burbuja, que sí se anuncia. Un lector
      // de pantalla que lea "Taku, la mascota" en cada pantalla es ruido.
      aria-hidden="true"
      draggable={false}
      className={cn('select-none', MOOD_MOTION[mood], className)}
      style={{ width: size, height: size }}
    />
  );
}
