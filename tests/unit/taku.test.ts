import { describe, expect, it } from 'vitest';
import {
  COOLDOWN_MS,
  dismissCue,
  expireCue,
  initialTakuState,
  moodOf,
  offerCue,
  takuReducer,
  type TakuCue,
  type TakuState,
} from '@ui/features/taku/cues';

/**
 * LO QUE SE PRUEBA ACÁ ES EL SILENCIO.
 *
 * Que un acompañante hable es trivial. Que se calle en el momento correcto es
 * lo que decide si alguien lo deja activado o lo apaga el primer día, y es
 * justo la parte que no se ve mirando la pantalla: hay que provocar la
 * situación y comprobar que NO pasa nada.
 */

const reaction = (id: string, hold = 5000): TakuCue => ({
  id,
  kind: 'reaction',
  mood: 'celebrate',
  line: `reacción ${id}`,
  holdMs: hold,
});

const tip = (id: string, hold = 5000): TakuCue => ({
  id,
  kind: 'tip',
  mood: 'think',
  line: `consejo ${id}`,
  holdMs: hold,
});

const loud = { muted: false };
const quiet = { muted: true };

/** Un estado en el que acaba de hablar, para probar el tiempo de gracia. */
const justSpoke = (at: number): TakuState => ({
  ...initialTakuState,
  lastAt: at,
});

describe('Taku habla', () => {
  it('acepta la primera intervención', () => {
    const decision = offerCue(initialTakuState, tip('primera'), 1000, loud);
    expect(decision.accepted).toBe(true);
    if (!decision.accepted) return;
    expect(decision.state.current?.line).toBe('consejo primera');
  });

  it('el ánimo sale de la frase en curso, y vuelve a reposo al terminar', () => {
    const shown = offerCue(initialTakuState, reaction('crit'), 1000, loud);
    if (!shown.accepted) throw new Error('debería haber entrado');
    expect(moodOf(shown.state)).toBe('celebrate');

    const later = expireCue(shown.state, 1000 + 5001);
    expect(moodOf(later)).toBe('idle');
  });
});

describe('Taku se calla', () => {
  it('silenciado no dice nada, ni reacciones', () => {
    for (const cue of [tip('t'), reaction('r')]) {
      const decision = offerCue(initialTakuState, cue, 1000, quiet);
      expect(decision.accepted).toBe(false);
      if (decision.accepted) continue;
      expect(decision.reason).toBe('muted');
    }
  });

  it('un consejo ya visto no vuelve en la misma sesión', () => {
    const first = offerCue(initialTakuState, tip('biblioteca'), 1000, loud);
    if (!first.accepted) throw new Error('debería haber entrado');

    // Bastante después, con el tiempo de gracia cumplido de sobra.
    const second = offerCue(first.state, tip('biblioteca'), 1000 + COOLDOWN_MS * 5, loud);
    expect(second.accepted).toBe(false);
    if (second.accepted) return;
    expect(second.reason).toBe('alreadySpent');
  });

  it('respeta el tiempo de gracia entre intervenciones', () => {
    const state = justSpoke(1000);

    const tooSoon = offerCue(state, tip('otro'), 1000 + COOLDOWN_MS - 1, loud);
    expect(tooSoon.accepted).toBe(false);
    if (!tooSoon.accepted) expect(tooSoon.reason).toBe('cooldown');

    const onTime = offerCue(state, tip('otro'), 1000 + COOLDOWN_MS, loud);
    expect(onTime.accepted).toBe(true);
  });

  it('un consejo NO interrumpe a otro que está en pantalla', () => {
    const first = offerCue(initialTakuState, tip('uno', 8000), 1000, loud);
    if (!first.accepted) throw new Error('debería haber entrado');

    const second = offerCue(first.state, tip('dos'), 2000, loud);
    expect(second.accepted).toBe(false);
    if (second.accepted) return;
    expect(second.reason).toBe('lowerPriority');
  });

  it('cerrar a mano cuenta como que habló: no reaparece de inmediato', () => {
    const shown = offerCue(initialTakuState, tip('molesto'), 1000, loud);
    if (!shown.accepted) throw new Error('debería haber entrado');

    const closed = dismissCue(shown.state, 2000);
    expect(closed.current).toBeNull();

    // Quien cierra una burbuja no quiere ver otra un segundo después.
    const next = offerCue(closed, reaction('crit'), 2500, loud);
    expect(next.accepted).toBe(false);
    if (next.accepted) return;
    expect(next.reason).toBe('cooldown');
  });
});

describe('Prioridades', () => {
  it('una reacción SÍ interrumpe un consejo', () => {
    const boring = offerCue(initialTakuState, tip('largo', 20_000), 1000, loud);
    if (!boring.accepted) throw new Error('debería haber entrado');

    // Un 20 natural no espera veinte segundos a que termine un consejo.
    const crit = offerCue(boring.state, reaction('crit'), 2000, loud);
    expect(crit.accepted).toBe(true);
    if (!crit.accepted) return;
    expect(crit.state.current?.kind).toBe('reaction');
  });

  it('una reacción no interrumpe a otra reacción', () => {
    const first = offerCue(initialTakuState, reaction('uno', 9000), 1000, loud);
    if (!first.accepted) throw new Error('debería haber entrado');

    const second = offerCue(first.state, reaction('dos'), 2000, loud);
    expect(second.accepted).toBe(false);
    if (second.accepted) return;
    expect(second.reason).toBe('lowerPriority');
  });

  it('las reacciones SÍ se repiten: el segundo crítico también se festeja', () => {
    const first = offerCue(initialTakuState, reaction('crit'), 1000, loud);
    if (!first.accepted) throw new Error('debería haber entrado');

    const expired = expireCue(first.state, 1000 + 5001);
    const again = offerCue(expired, reaction('crit'), 1000 + COOLDOWN_MS + 1, loud);
    expect(again.accepted).toBe(true);
  });
});

describe('Expiración', () => {
  it('la frase se va, Taku se queda', () => {
    const shown = offerCue(initialTakuState, tip('x', 3000), 1000, loud);
    if (!shown.accepted) throw new Error('debería haber entrado');

    expect(expireCue(shown.state, 3999).current).not.toBeNull();
    expect(expireCue(shown.state, 4000).current).toBeNull();
  });

  it('expirar conserva la memoria de lo ya dicho', () => {
    const shown = offerCue(initialTakuState, tip('visto'), 1000, loud);
    if (!shown.accepted) throw new Error('debería haber entrado');

    const expired = expireCue(shown.state, 99_999);
    expect(expired.spent.has('visto')).toBe(true);
  });
});

describe('El reducer', () => {
  it('rechazar una intervención deja el estado intacto', () => {
    const before = takuReducer(initialTakuState, {
      type: 'offer',
      cue: tip('a'),
      now: 1000,
      muted: true,
    });
    expect(before).toBe(initialTakuState);
  });

  it('la secuencia completa de una intervención', () => {
    let state = takuReducer(initialTakuState, {
      type: 'offer',
      cue: reaction('crit', 4000),
      now: 1000,
      muted: false,
    });
    expect(state.current).not.toBeNull();

    state = takuReducer(state, { type: 'expire', now: 5001 });
    expect(state.current).toBeNull();
    expect(state.lastAt).toBe(1000);
  });
});
