/**
 * UNIDADES CON ARITMETICA EXACTA
 *
 * El peso se guarda en CENTESIMAS DE LIBRA como entero. Sumar 0.1 lb
 * doscientas veces en coma flotante produce deriva visible, y en una
 * aplicacion cuyo valor es la exactitud (MASTER SPEC §3.9) eso es
 * inaceptable. El formateo a "0,5 lb" ocurre solo en presentacion.
 */

declare const weightBrand: unique symbol;
export type Weight = number & { readonly [weightBrand]: 'Weight' };

/** Desde libras: `lb(0.5)` → 50 centesimas. */
export function lb(pounds: number): Weight {
  return Math.round(pounds * 100) as Weight;
}

/** Desde centesimas ya calculadas (deserializacion). */
export const weightFromHundredths = (h: number): Weight => Math.round(h) as Weight;

export const ZERO_WEIGHT = 0 as Weight;

export const addWeight = (a: Weight, b: Weight): Weight => (a + b) as Weight;
export const subWeight = (a: Weight, b: Weight): Weight => Math.max(0, a - b) as Weight;
export const scaleWeight = (w: Weight, n: number): Weight => Math.round(w * n) as Weight;
export const sumWeights = (ws: readonly Weight[]): Weight =>
  ws.reduce((acc, w) => (acc + w) as Weight, ZERO_WEIGHT);

export const weightToPounds = (w: Weight): number => w / 100;

/** "0,5 lb" / "12 lb". Coma decimal: el producto es espanol primero. */
export function formatWeight(w: Weight, locale = 'es-419'): string {
  const pounds = weightToPounds(w);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(pounds);
  return `${formatted} lb`;
}

/** Velocidad y distancias: enteros en pies. No necesitan fraccion en 5e. */
declare const feetBrand: unique symbol;
export type Feet = number & { readonly [feetBrand]: 'Feet' };
export const feet = (n: number): Feet => Math.round(n) as Feet;
export const ZERO_FEET = 0 as Feet;
