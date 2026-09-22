/**
 * CUÁNDO TAKU HABLA, Y SOBRE TODO CUÁNDO SE CALLA.
 *
 * Un acompañante que comenta todo se vuelve ruido, y el ruido se aprende a
 * ignorar: a la semana nadie lo lee y encima ocupa una esquina. Así que las
 * reglas de silencio son la parte importante de este archivo, no las frases.
 *
 * Son funciones puras a propósito: la decisión de abrir la boca se puede
 * probar sin montar un navegador.
 */

export const TAKU_MOODS = ['idle', 'greet', 'celebrate', 'worry', 'think'] as const;
export type TakuMood = (typeof TAKU_MOODS)[number];

/**
 * Qué puede decir Taku.
 *
 *   reaction — responde a algo que acaba de pasar (un 20 natural, caer a 0).
 *              Puede repetirse: tirar dos críticos merece dos festejos.
 *   tip      — ayuda contextual la PRIMERA vez que aparece un lugar o estado.
 *              Una sola vez por sesión, o deja de ser ayuda y es insistencia.
 */
export type TakuCueKind = 'reaction' | 'tip';

export type TakuCue = {
  readonly id: string;
  readonly kind: TakuCueKind;
  readonly mood: TakuMood;
  readonly line: string;
  /** Cuánto se queda la burbuja en pantalla. */
  readonly holdMs: number;
};

export type TakuState = {
  readonly current: TakuCue | null;
  /** Momento en el que la burbuja actual debe irse. */
  readonly until: number;
  /** Ids de consejos ya mostrados: no se repiten en la misma sesión. */
  readonly spent: ReadonlySet<string>;
  /**
   * Cuándo habló por última vez, para el tiempo de gracia.
   *
   * Arranca en `-Infinity` y no en 0: cero significaría "habló en 1970", y el
   * tiempo de gracia se mediría desde ahí. Con relojes reales da lo mismo
   * porque la diferencia es gigante, pero la intención era "nunca habló" y
   * conviene que el valor lo diga.
   */
  readonly lastAt: number;
};

export const initialTakuState: TakuState = {
  current: null,
  until: 0,
  spent: new Set(),
  lastAt: Number.NEGATIVE_INFINITY,
};

/**
 * Tiempo de gracia entre intervenciones.
 *
 * Doce segundos parece mucho y es justo el punto: en una sesión de juego pasan
 * cosas todo el tiempo —daño, curación, tiradas— y sin esto Taku estaría
 * hablando encima de sí mismo. Las reacciones lo respetan igual que los
 * consejos; lo único que lo salta es una reacción mientras NO hay nada en
 * pantalla, porque ahí no interrumpe a nadie.
 */
export const COOLDOWN_MS = 12_000;

/** Prioridad: una reacción puede tapar un consejo, nunca al revés. */
const weight: Record<TakuCueKind, number> = { reaction: 2, tip: 1 };

export type CueDecision =
  | { readonly accepted: true; readonly state: TakuState }
  | { readonly accepted: false; readonly reason: CueRejection; readonly state: TakuState };

export type CueRejection = 'muted' | 'alreadySpent' | 'cooldown' | 'lowerPriority';

/**
 * ¿Entra esta intervención?
 *
 * `now` se pasa por parámetro en vez de leer el reloj acá dentro: así los
 * tests pueden mover el tiempo a mano en vez de esperar doce segundos.
 */
export function offerCue(
  state: TakuState,
  cue: TakuCue,
  now: number,
  options: { readonly muted: boolean },
): CueDecision {
  if (options.muted) return { accepted: false, reason: 'muted', state };

  // Un consejo ya visto no vuelve. Esta es la regla que evita que Taku
  // explique lo mismo cada vez que entrás a una pantalla.
  if (cue.kind === 'tip' && state.spent.has(cue.id)) {
    return { accepted: false, reason: 'alreadySpent', state };
  }

  const speaking = state.current !== null && now < state.until;

  if (speaking && weight[cue.kind] <= weight[state.current!.kind]) {
    return { accepted: false, reason: 'lowerPriority', state };
  }

  // Con algo en pantalla, una reacción puede interrumpir sin esperar: lo que
  // no puede es aparecer sobre el silencio antes del tiempo de gracia.
  const respectsCooldown = speaking || now - state.lastAt >= COOLDOWN_MS;
  if (!respectsCooldown) return { accepted: false, reason: 'cooldown', state };

  const spent = cue.kind === 'tip' ? new Set([...state.spent, cue.id]) : state.spent;

  return {
    accepted: true,
    state: { current: cue, until: now + cue.holdMs, spent, lastAt: now },
  };
}

/** Quita la burbuja si ya pasó su tiempo. Taku se queda, la frase no. */
export function expireCue(state: TakuState, now: number): TakuState {
  if (state.current === null || now < state.until) return state;
  return { ...state, current: null };
}

/** Cerrar a mano cuenta como que habló: no reaparece de inmediato. */
export function dismissCue(state: TakuState, now: number): TakuState {
  return { ...state, current: null, until: 0, lastAt: now };
}

/**
 * Reducer, para que la capa de React no necesite leer el estado anterior.
 *
 * Con `useState` había que guardar una copia en una ref para que la función de
 * ofrecer no cambiara de identidad en cada frase — y leer una ref durante el
 * render es justo lo que React no permite. Un reducer recibe el estado
 * anterior como argumento y el problema desaparece.
 */
export type TakuAction =
  | { readonly type: 'offer'; readonly cue: TakuCue; readonly now: number; readonly muted: boolean }
  | { readonly type: 'expire'; readonly now: number }
  | { readonly type: 'dismiss'; readonly now: number };

export function takuReducer(state: TakuState, action: TakuAction): TakuState {
  switch (action.type) {
    case 'offer':
      return offerCue(state, action.cue, action.now, { muted: action.muted }).state;
    case 'expire':
      return expireCue(state, action.now);
    case 'dismiss':
      return dismissCue(state, action.now);
  }
}

/** El ánimo con el que se dibuja: el de la frase actual, o reposo. */
export function moodOf(state: TakuState): TakuMood {
  return state.current?.mood ?? 'idle';
}
