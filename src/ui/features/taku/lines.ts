import type { TakuCue } from './cues';

/**
 * LO QUE DICE TAKU.
 *
 * Dos reglas de redacción:
 *
 *   1. Cada frase dice algo que el usuario no ve en la pantalla. "¡Bienvenido!"
 *      no aporta nada; "el nivel 3 es donde elegís subclase" sí.
 *   2. Nunca explica lo obvio ni felicita por respirar. Un acompañante que
 *      aplaude cada clic entrena a ignorarlo.
 *
 * El texto va acá en castellano, igual que el resto del copy de pantalla: las
 * claves del catálogo i18n cubren lo que emite el dominio, no la prosa de la
 * interfaz. Los rótulos de los controles de Taku SÍ están en el catálogo.
 */

const cue = (
  id: string,
  kind: TakuCue['kind'],
  mood: TakuCue['mood'],
  line: string,
  holdMs = 6000,
): TakuCue => ({ id, kind, mood, line, holdMs });

// ── Reacciones ───────────────────────────────────────────────────────────────
//
// Los momentos con carga emocional de una partida. Son los únicos que se
// permiten repetir, porque el segundo crítico de la noche también se festeja.

export const REACTIONS = {
  criticalHit: () =>
    cue('crit.hit', 'reaction', 'celebrate', pick([
      '¡Veinte natural! Contalo despacio para que todos lo escuchen.',
      '¡Crítico! El daño se tira dos veces.',
      'Veinte. La mesa se queda callada un segundo.',
    ])),

  criticalMiss: () =>
    cue('crit.miss', 'reaction', 'worry', pick([
      'Uno natural. Pase lo que pase, no fue culpa tuya.',
      'Un uno. Alguien va a tener que improvisar.',
    ])),

  droppedToZero: (name: string) =>
    cue(
      'hp.down',
      'reaction',
      'worry',
      `${name} cayó. Tirada de salvación contra muerte al empezar su turno.`,
      9000,
    ),

  backFromZero: (name: string) =>
    cue('hp.up', 'reaction', 'celebrate', `${name} está de pie otra vez.`),

  leveledUp: (name: string, level: number) =>
    cue('level.up', 'reaction', 'celebrate', `${name} llegó a nivel ${level}.`, 7000),

} as const;

// ── Consejos ─────────────────────────────────────────────────────────────────
//
// Una vez por sesión y solo si dicen algo útil. Todos tienen que pasar la
// prueba de "¿esto está escrito en la pantalla?". Si la respuesta es sí, no va.

export const TIPS = {
  playMode: () =>
    cue(
      'play.first',
      'tip',
      'think',
      'Todo acá se deshace. Tocá un número mal y no pasa nada: hay "Deshacer".',
      7000,
    ),

  librarySearch: () =>
    cue(
      'library.first',
      'tip',
      'think',
      'Buscá en español o en inglés: "Bola de fuego" y "Fireball" llevan al mismo lado.',
      7000,
    ),

  homebrewFirst: () =>
    cue(
      'homebrew.first',
      'tip',
      'think',
      'Lo que crees acá pasa por las mismas reglas que el SRD, y aparece en la biblioteca al instante.',
      8000,
    ),

  offlineFirst: () =>
    cue(
      'offline.first',
      'tip',
      'think',
      'Sin conexión funciona igual. Cuando vuelva la red, lo pendiente se sube solo.',
      7000,
    ),

} as const;

/**
 * Variedad sin repetir la anterior.
 *
 * Escuchar la misma frase dos veces seguidas es lo que delata que es un cartel
 * y no un personaje, así que se recuerda la última de cada grupo.
 */
const lastPicked = new Map<string, number>();

function pick(options: readonly string[]): string {
  if (options.length === 1) return options[0]!;
  const key = options[0]!;
  const previous = lastPicked.get(key);
  let index = Math.floor(Math.random() * options.length);
  if (index === previous) index = (index + 1) % options.length;
  lastPicked.set(key, index);
  return options[index]!;
}
