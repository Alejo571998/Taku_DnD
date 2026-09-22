'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { initialTakuState, moodOf, takuReducer, type TakuCue, type TakuMood } from './cues';

/**
 * ESTADO DE TAKU.
 *
 * Una sola instancia para toda la aplicación: si cada pantalla tuviera la suya,
 * dos reacciones simultáneas se pisarían y el tiempo de gracia no serviría de
 * nada. La lógica de qué entra y qué no está en `cues.ts`, sin React.
 */

const MUTED_KEY = 'taku-muted';
const MUTED_EVENT = 'taku:muted-change';

function subscribeToMuted(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(MUTED_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(MUTED_EVENT, onChange);
  };
}

const readMuted = (): boolean => localStorage.getItem(MUTED_KEY) === '1';
const serverMuted = (): boolean => false;

/**
 * EL CONTEXTO ESTÁ PARTIDO EN DOS, Y NO ES UN CAPRICHO.
 *
 * Toda pantalla que quiera ofrecer una frase llama a `useTakuCue`, y eso la
 * convierte en consumidora del contexto. Con un contexto único, cada vez que
 * Taku abre la boca React vuelve a renderizar TODAS esas pantallas — incluida
 * la biblioteca con sus sesenta resultados en la mano, justo mientras alguien
 * escribe en el buscador.
 *
 * Así que lo que cambia a menudo —la frase en curso y el ánimo— vive en su
 * propio contexto, y solo lo lee quien dibuja a Taku. Lo que las pantallas
 * necesitan son las ACCIONES, que no cambian nunca.
 */
type TakuActions = {
  readonly muted: boolean;
  readonly setMuted: (muted: boolean) => void;
  /** Ofrece una intervención. Puede rechazarse, y eso es normal. */
  readonly offer: (cue: TakuCue) => void;
  readonly dismiss: () => void;
};

type TakuPresence = {
  readonly cue: TakuCue | null;
  readonly mood: TakuMood;
};

const TakuActionsContext = createContext<TakuActions | null>(null);
const TakuPresenceContext = createContext<TakuPresence | null>(null);

export function TakuProvider({ children }: { children: ReactNode }) {
  const muted = useSyncExternalStore(subscribeToMuted, readMuted, serverMuted);
  const [state, dispatch] = useReducer(takuReducer, initialTakuState);

  const setMuted = useCallback((next: boolean) => {
    localStorage.setItem(MUTED_KEY, next ? '1' : '0');
    window.dispatchEvent(new Event(MUTED_EVENT));
  }, []);

  // `mutedRef` en lugar de cerrar sobre `muted`: así `offer` conserva su
  // identidad al silenciar. Si cambiara, cada `useTakuCue` de la aplicación
  // volvería a dispararse en ese momento.
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const offer = useCallback((cue: TakuCue) => {
    dispatch({ type: 'offer', cue, now: Date.now(), muted: mutedRef.current });
  }, []);

  const dismiss = useCallback(() => {
    dispatch({ type: 'dismiss', now: Date.now() });
  }, []);

  // Un temporizador por burbuja, no un intervalo permanente: Taku callado no
  // debe costar un tick por segundo durante toda la sesión.
  useEffect(() => {
    if (state.current === null) return;
    const timer = setTimeout(
      () => dispatch({ type: 'expire', now: Date.now() }),
      Math.max(0, state.until - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [state]);

  // Solo cambia al silenciar, que pasa una vez cada mucho.
  const actions = useMemo<TakuActions>(
    () => ({ muted, setMuted, offer, dismiss }),
    [muted, setMuted, offer, dismiss],
  );

  // Cambia con cada frase. Lo lee únicamente quien dibuja a Taku.
  const presence = useMemo<TakuPresence>(
    () => ({
      // Silenciado se filtra al derivar, no borrando el estado: así al volver
      // a activarlo no hace falta reconstruir nada, y lo que estaba en curso
      // simplemente no se dibuja.
      cue: muted ? null : state.current,
      mood: muted ? 'idle' : moodOf(state),
    }),
    [muted, state],
  );

  return (
    <TakuActionsContext.Provider value={actions}>
      <TakuPresenceContext.Provider value={presence}>{children}</TakuPresenceContext.Provider>
    </TakuActionsContext.Provider>
  );
}

/** Para ofrecer frases y para el interruptor. No se re-renderiza por hablar. */
export function useTaku(): TakuActions {
  const ctx = useContext(TakuActionsContext);
  if (!ctx) throw new Error('useTaku debe usarse dentro de TakuProvider');
  return ctx;
}

/** Para DIBUJAR a Taku. Solo el acompañante debería necesitarlo. */
export function useTakuPresence(): TakuPresence {
  const ctx = useContext(TakuPresenceContext);
  if (!ctx) throw new Error('useTakuPresence debe usarse dentro de TakuProvider');
  return ctx;
}

/**
 * Dispara una intervención cuando `when` pasa a ser verdadero.
 *
 * Existe porque el patrón manual —un efecto con la condición y el `offer` en
 * las dependencias— se escribe mal con facilidad y acaba disparando en cada
 * renderizado. Acá el flanco se detecta una vez y se olvida.
 */
export function useTakuCue(when: boolean, build: () => TakuCue): void {
  const { offer } = useTaku();
  const fired = useRef(false);

  useEffect(() => {
    if (!when) {
      fired.current = false;
      return;
    }
    if (fired.current) return;
    fired.current = true;
    offer(build());
    // `build` se deja fuera a propósito: es una lambda nueva en cada
    // renderizado y meterla dispararía el efecto sin parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when, offer]);
}

/**
 * Dispara cuando un valor pasa de `from` a `to`.
 *
 * `useTakuCue` detecta que algo empezó a ser verdad; esto detecta que dejó de
 * ser otra cosa, y no es lo mismo. Levantarse solo tiene sentido si antes
 * estabas caído: con `useTakuCue(!down)` se anunciaría la recuperación de
 * cualquier personaje sano al abrir su ficha.
 *
 * La comparación con el valor anterior vive DENTRO del efecto. Leer una ref
 * durante el render funciona por accidente y React lo prohíbe: con
 * renderizado concurrente, ese render puede descartarse y la ref queda con un
 * valor que nunca llegó a la pantalla.
 */
export function useTakuTransition<T>(
  value: T,
  from: T,
  to: T,
  build: () => TakuCue,
): void {
  const { offer } = useTaku();
  const previous = useRef(value);

  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    if (before === from && value === to) offer(build());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, from, to, offer]);
}
