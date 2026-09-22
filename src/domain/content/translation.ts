import type { AnyDefinition } from './schemas';

/**
 * TRADUCCIÓN DEL CONTENIDO (MASTER SPEC §37)
 *
 * El SRD está en inglés y su licencia CC-BY permite traducirlo con atribución.
 * Traducir cientos de conjuros y criaturas es trabajo de meses, así que el
 * sistema está pensado para una cobertura PARCIAL y creciente:
 *
 *   - se traduce campo a campo, no definición entera
 *   - lo que no está traducido se muestra en inglés, SIN ocultarlo
 *   - la interfaz puede decir exactamente qué está traducido y qué no
 *
 * Lo contrario —esperar a tenerlo todo— dejaría en inglés hasta las
 * condiciones, que son lo que más se consulta en mesa.
 */

/** Un apartado con título del bloque de estadísticas: «Multiattack», «Bite». */
export type TranslatedBlock = {
  readonly name: string;
  readonly desc: string;
};

export type TranslationEntry = {
  readonly name?: string;
  readonly description?: readonly string[];
  /** Campos propios del tipo que son una cadena suelta: `material`, `flavor`. */
  readonly fields?: Readonly<Record<string, string>>;
  /**
   * Los tres bloques del monstruo, en el MISMO orden que el original.
   *
   * Van aparte de `fields` porque no son cadenas sueltas sino pares con
   * título, y aparte de `description` porque el bloque de estadísticas se
   * pinta con su propia estructura, no como prosa corrida.
   */
  readonly specialAbilities?: readonly TranslatedBlock[];
  readonly actions?: readonly TranslatedBlock[];
  readonly legendaryActions?: readonly TranslatedBlock[];
};

/** Los campos con prosa que NO son `name` ni `description`. */
export const BLOCK_FIELDS = ['specialAbilities', 'actions', 'legendaryActions'] as const;
export type BlockField = (typeof BLOCK_FIELDS)[number];

export type TranslationOverlay = {
  readonly language: string;
  /**
   * Nombres comunes a las dos ediciones, por clave `tipo:slug`.
   *
   * SOLO nombres, y la forma del tipo lo impone. "Blinded" es "Cegado" en las
   * dos ediciones, pero el TEXTO de la condición cambia entre ellas: si esto
   * pudiera traer descripciones, estaríamos metiendo prosa de 2014 en un
   * personaje de 2024 — justo lo que el producto promete no hacer (SPEC §4).
   */
  readonly names: Readonly<Record<string, string>>;
  /** Traducciones completas, por id EXACTO de definición y por tanto de edición. */
  readonly entries: Readonly<Record<string, TranslationEntry>>;
};

export const emptyOverlay = (language = 'es-419'): TranslationOverlay => ({
  language,
  names: {},
  entries: {},
});

/** `srd-2014:condition:blinded` → `condition:blinded`. */
export function translationKey(definitionId: string): string {
  const parts = definitionId.split(':');
  return parts.length >= 3 ? parts.slice(1).join(':') : definitionId;
}

export function lookupTranslation(
  overlay: TranslationOverlay,
  definitionId: string,
): TranslationEntry | undefined {
  const sharedName = overlay.names[translationKey(definitionId)];
  const specific = overlay.entries[definitionId];
  if (!sharedName && !specific) return undefined;

  return {
    ...(sharedName ? { name: sharedName } : {}),
    ...specific,
  };
}

export type TranslationStatus = 'full' | 'partial' | 'none';

export type TranslatedDefinition<T extends AnyDefinition = AnyDefinition> = T & {
  /** Qué parte de esta definición está realmente en el idioma pedido. */
  readonly translation: TranslationStatus;
};

const blocksOf = (d: AnyDefinition, field: BlockField): readonly TranslatedBlock[] =>
  d.type === 'monster' ? d[field] : [];

/** El conjuro es el único que trae una cadena suelta de prosa fuera del texto. */
const materialOf = (d: AnyDefinition): string => (d.type === 'spell' ? (d.material ?? '') : '');

/**
 * Aplica la traducción CAMPO A CAMPO.
 *
 * Nunca inventa: un campo sin traducir se queda como está y el estado pasa a
 * `partial`, que es lo que permite a la interfaz ser honesta al respecto.
 *
 * Los bloques del monstruo se aplican SOLO si vienen con la misma cantidad de
 * apartados que el original. Una superposición vieja contra un volcado nuevo
 * dejaría al dragón sin una de sus acciones, y eso no es un texto en inglés:
 * es una regla que desaparece de la mesa sin que nadie lo note.
 */
export function applyTranslation<T extends AnyDefinition>(
  definition: T,
  overlay: TranslationOverlay,
): TranslatedDefinition<T> {
  const entry = lookupTranslation(overlay, definition.id);
  if (!entry) return { ...definition, translation: 'none' };

  const hasDescription = definition.description.length > 0;
  const translatedName = entry.name !== undefined;
  const translatedDescription = entry.description !== undefined && entry.description.length > 0;

  const bloques: Partial<Record<BlockField, readonly TranslatedBlock[]>> = {};
  let bloquesPendientes = false;
  for (const field of BLOCK_FIELDS) {
    const originales = blocksOf(definition, field);
    if (originales.length === 0) continue;
    const traducidos = entry[field];
    if (traducidos !== undefined && traducidos.length === originales.length) {
      bloques[field] = traducidos.map((b) => ({ ...b }));
    } else {
      bloquesPendientes = true;
    }
  }

  const material = materialOf(definition);
  const materialPendiente = material.length > 0 && entry.fields?.material === undefined;

  const completo =
    translatedName &&
    (translatedDescription || !hasDescription) &&
    !bloquesPendientes &&
    !materialPendiente;

  return {
    ...definition,
    ...(translatedName ? { name: entry.name! } : {}),
    ...(translatedDescription ? { description: [...entry.description!] } : {}),
    ...(entry.fields ?? {}),
    ...bloques,
    translation: completo ? 'full' : 'partial',
  } as TranslatedDefinition<T>;
}

export type TranslationCoverage = {
  readonly total: number;
  readonly full: number;
  readonly partial: number;
  readonly none: number;
  /**
   * Cobertura por tipo, para poder decir "las condiciones sí, los conjuros no".
   *
   * `translated` cuenta lo que tiene ALGO en español —hoy, el nombre de todo—
   * y `full` lo que no deja nada en inglés. Hacen falta los dos: con solo el
   * primero, la interfaz diría 100% con media biblioteca sin traducir.
   */
  readonly byType: Readonly<Record<string, { total: number; translated: number; full: number }>>;
};

/** Cuánto hay traducido de verdad. La interfaz lo muestra tal cual. */
export function measureCoverage(
  definitions: readonly AnyDefinition[],
  overlay: TranslationOverlay,
): TranslationCoverage {
  const byType: Record<string, { total: number; translated: number; full: number }> = {};
  let full = 0;
  let partial = 0;
  let none = 0;

  for (const definition of definitions) {
    const applied = applyTranslation(definition, overlay);
    const bucket = (byType[definition.type] ??= { total: 0, translated: 0, full: 0 });
    bucket.total++;

    if (applied.translation === 'full') {
      full++;
      bucket.translated++;
      bucket.full++;
    } else if (applied.translation === 'partial') {
      partial++;
      bucket.translated++;
    } else {
      none++;
    }
  }

  return { total: definitions.length, full, partial, none, byType };
}

/**
 * Claves cuyo nombre TRADUCIDO coincide con la busqueda.
 *
 * Hace falta porque las definiciones se guardan en ingles: sin esto, buscar
 * "Cegado" no encuentra "Blinded" aunque la ficha lo muestre traducido — que
 * es exactamente el bug que aparecio al probar la aplicacion de verdad.
 *
 * Recorre la superposicion entera en vez de mantener un indice invertido en
 * IndexedDB. Son 2.241 nombres —una comparacion de subcadena cada uno— contra
 * un indice que habria que reconstruir cada vez que se traduce algo. El coste
 * esta medido junto al resto de la busqueda en `tests/e2e/performance.spec.ts`.
 */
export function matchTranslatedNames(
  overlay: TranslationOverlay,
  query: string,
): { readonly keys: ReadonlySet<string>; readonly ids: ReadonlySet<string> } {
  const q = query.trim().toLowerCase();
  const keys = new Set<string>();
  const ids = new Set<string>();
  if (q.length === 0) return { keys, ids };

  for (const [key, name] of Object.entries(overlay.names)) {
    if (name.toLowerCase().includes(q)) keys.add(key);
  }
  for (const [id, entry] of Object.entries(overlay.entries)) {
    if (entry.name && entry.name.toLowerCase().includes(q)) ids.add(id);
  }
  return { keys, ids };
}
