import { errCode, ok, type Result } from '../shared/result';
import type { CurrencyState } from '../character/state';

/**
 * DINERO (MASTER PROMPT §28, MASTER SPEC §20)
 *
 * Cinco contadores ENTEROS independientes. Nunca un total convertido: guardar
 * "37.5 po" pierde informacion y deriva. Las conversiones son explicitas,
 * confirmadas y registradas — jamas un efecto secundario.
 *
 * IDs internos estables (`gp/pp/ep/sp/cp`) que NUNCA se traducen.
 * Las etiquetas en español son solo presentacion.
 */

export const DENOMINATIONS = ['gp', 'pp', 'ep', 'sp', 'cp'] as const;
export type Denomination = (typeof DENOMINATIONS)[number];

/** Valor de cada moneda en cobre. Es la unidad base del sistema. */
export const VALUE_IN_COPPER: Record<Denomination, number> = {
  pp: 1000,
  gp: 100,
  ep: 50,
  sp: 10,
  cp: 1,
};

/**
 * Orden y etiquetas en español: PO → PC → PP → PE → PPT
 *
 * LAS SIGLAS son las de la hoja oficial de 2024. La especificacion original
 * fijaba `PP` para el platino y `PA` para la plata, y avisaba del riesgo en su
 * propio comentario: «`PP` se lee como plata para muchos jugadores». La hoja
 * lo resuelve al contrario —`PP` es plata y `PPT` platino—, asi que con las dos
 * delante la misma sigla significaba dos monedas distintas. Manda la hoja: es
 * la que el jugador tiene en la mesa.
 *
 * EL ORDEN no es el de la hoja del todo, y es a proposito. El oro va primero
 * porque es la moneda con la que se compra: el precio del SRD viene en `gp` y
 * es el numero que se mira noventa y nueve veces de cada cien. Detras van las
 * otras cuatro en la secuencia del papel, ascendente por valor.
 *
 * Cada etiqueta lleva su nombre completo, que la interfaz muestra como texto
 * accesible.
 */
export const DISPLAY_ORDER_ES: readonly Denomination[] = ['gp', 'cp', 'sp', 'ep', 'pp'];

export const DENOMINATION_ABBR_ES: Record<Denomination, string> = {
  gp: 'PO',
  pp: 'PPT',
  ep: 'PE',
  sp: 'PP',
  cp: 'PC',
};

export const DENOMINATION_NAME_ES: Record<Denomination, string> = {
  gp: 'Pieza de oro',
  pp: 'Pieza de platino',
  ep: 'Pieza de electro',
  sp: 'Pieza de plata',
  cp: 'Pieza de cobre',
};

/** Orden descendente por valor real. Para conversiones y "dar el cambio". */
const BY_VALUE_DESC: readonly Denomination[] = ['pp', 'gp', 'ep', 'sp', 'cp'];

export const emptyPurse = (): CurrencyState => ({ gp: 0, pp: 0, ep: 0, sp: 0, cp: 0 });

export const totalInCopper = (c: CurrencyState): number =>
  DENOMINATIONS.reduce((sum, d) => sum + c[d] * VALUE_IN_COPPER[d], 0);

/** Valor equivalente en oro, con decimales. Solo para MOSTRAR. */
export const totalInGold = (c: CurrencyState): number => totalInCopper(c) / VALUE_IN_COPPER.gp;

export const isEmpty = (c: CurrencyState): boolean => totalInCopper(c) === 0;

export type CurrencyDelta = Partial<Record<Denomination, number>>;

/** Suma monedas. Conmutativa: es lo que hace la sincronizacion sin conflictos. */
export function addCurrency(c: CurrencyState, delta: CurrencyDelta): CurrencyState {
  return {
    gp: c.gp + (delta.gp ?? 0),
    pp: c.pp + (delta.pp ?? 0),
    ep: c.ep + (delta.ep ?? 0),
    sp: c.sp + (delta.sp ?? 0),
    cp: c.cp + (delta.cp ?? 0),
  };
}

/**
 * Resta monedas SIN convertir automaticamente.
 * Si faltan monedas de una denominacion concreta, falla y el usuario decide.
 * Convertir el dinero de alguien a sus espaldas no es una comodidad: es un error.
 */
export function subtractCurrency(c: CurrencyState, delta: CurrencyDelta): Result<CurrencyState> {
  const next = { ...c };
  for (const d of DENOMINATIONS) {
    const amount = delta[d] ?? 0;
    if (amount === 0) continue;
    if (next[d] < amount) {
      return errCode('validation.failed', {
        denomination: DENOMINATION_ABBR_ES[d],
        have: next[d],
        need: amount,
      });
    }
    next[d] -= amount;
  }
  return ok(next);
}

/** ¿Alcanza el total, aunque haya que cambiar monedas? */
export const canAfford = (c: CurrencyState, costInCopper: number): boolean =>
  totalInCopper(c) >= costInCopper;

/**
 * Pago que SI convierte: usa las monedas de mayor valor y devuelve el cambio.
 * Solo se llama tras confirmacion explicita del usuario.
 */
export function payWithChange(c: CurrencyState, costInCopper: number): Result<CurrencyState> {
  if (!canAfford(c, costInCopper)) {
    return errCode('validation.failed', { have: totalInCopper(c), need: costInCopper });
  }

  const remaining = { ...c };
  let owed = costInCopper;

  // Paga primero con lo pequeño: evita romper monedas grandes sin necesidad.
  for (const d of [...BY_VALUE_DESC].reverse()) {
    if (owed <= 0) break;
    const unit = VALUE_IN_COPPER[d];
    const use = Math.min(remaining[d], Math.floor(owed / unit));
    remaining[d] -= use;
    owed -= use * unit;
  }

  // Si queda deuda, rompe una moneda grande y recibe el cambio.
  if (owed > 0) {
    for (const d of BY_VALUE_DESC) {
      if (owed <= 0) break;
      const unit = VALUE_IN_COPPER[d];
      if (unit < owed || remaining[d] === 0) continue;
      remaining[d] -= 1;
      let change = unit - owed;
      owed = 0;
      // Devuelve el cambio en las monedas mas grandes posibles.
      for (const cd of BY_VALUE_DESC) {
        const cu = VALUE_IN_COPPER[cd];
        const n = Math.floor(change / cu);
        if (n > 0) {
          remaining[cd] += n;
          change -= n * cu;
        }
      }
    }
  }

  if (owed > 0) {
    // Ninguna moneda individual cubria el resto: hay que consolidar primero.
    const consolidated = consolidate(c);
    if (totalInCopper(consolidated) !== totalInCopper(c)) {
      return errCode('validation.failed', {}, 'inconsistencia al consolidar');
    }
    return payWithChange(consolidated, costInCopper);
  }

  return ok(remaining);
}

/**
 * Convierte todo a la mayor denominacion posible.
 * NUNCA se ejecuta sola: requiere confirmacion explicita (MASTER PROMPT §28).
 */
export function consolidate(c: CurrencyState): CurrencyState {
  let copper = totalInCopper(c);
  const out: Record<Denomination, number> = { gp: 0, pp: 0, ep: 0, sp: 0, cp: 0 };
  for (const d of BY_VALUE_DESC) {
    const unit = VALUE_IN_COPPER[d];
    const n = Math.floor(copper / unit);
    out[d] = n;
    copper -= n * unit;
  }
  return out;
}

/** Convierte una cantidad concreta de una denominacion a otra. */
export function convert(
  c: CurrencyState,
  from: Denomination,
  to: Denomination,
  amount: number,
): Result<{ next: CurrencyState; received: number; remainderInCopper: number }> {
  if (amount <= 0 || !Number.isInteger(amount)) {
    return errCode('validation.failed', { amount }, 'la cantidad debe ser un entero positivo');
  }
  if (c[from] < amount) {
    return errCode('validation.failed', {
      denomination: DENOMINATION_ABBR_ES[from],
      have: c[from],
      need: amount,
    });
  }

  const copper = amount * VALUE_IN_COPPER[from];
  const received = Math.floor(copper / VALUE_IN_COPPER[to]);
  const remainder = copper - received * VALUE_IN_COPPER[to];

  if (received === 0) {
    return errCode('validation.failed', {}, 'la conversion no produce ni una moneda');
  }

  const next = { ...c, [from]: c[from] - amount, [to]: c[to] + received };
  return ok({ next, received, remainderInCopper: remainder });
}

/**
 * "12 PO · 3 PA" — omite las denominaciones en cero.
 *
 * El filtro descarta lo que no sea un número finito, no solo el cero. El cero
 * se omitía y el NaN pasaba —`NaN !== 0` es cierto—, así que un monedero con
 * basura se mostraba como **«NaN PO»** en la ficha. Pasó de verdad: el oro
 * inicial del trasfondo llegaba como `{quantity, unit}` en vez de número.
 * Mostrar una cifra falsa es peor que no mostrar la denominación.
 */
export function formatCurrency(c: CurrencyState, locale = 'es-419'): string {
  const nf = new Intl.NumberFormat(locale);
  const parts = DISPLAY_ORDER_ES.filter((d) => Number.isFinite(c[d]) && c[d] !== 0).map(
    (d) => `${nf.format(c[d])} ${DENOMINATION_ABBR_ES[d]}`,
  );
  return parts.length > 0 ? parts.join(' · ') : `0 ${DENOMINATION_ABBR_ES.gp}`;
}

/** Convierte un coste del contenido SRD a cobre. */
export const costToCopper = (cost: { quantity: number; unit: string }): number => {
  const unit = VALUE_IN_COPPER[cost.unit as Denomination] ?? 1;
  return Math.round(cost.quantity * unit);
};
