/**
 * INTERNACIONALIZACIÓN (MASTER SPEC §34)
 *
 * Español latinoamericano primero, inglés segundo, arquitectura preparada para
 * portugués, francés, italiano y alemán.
 *
 * SEPARACIÓN OBLIGATORIA — son dos problemas distintos:
 *
 *   UI STRINGS       — textos de la aplicación. Van en `messages/<locale>.json`.
 *   CONTENT STRINGS  — nombres y descripciones del SRD y del Homebrew. Viven
 *                      como entidades `ContentTranslation` aparte, porque
 *                      dependen del pack y de su licencia, no de la interfaz.
 *
 * ESTADO ACTUAL — honestidad por delante:
 *   ✓ catálogos creados con los diccionarios que YA estaban centralizados
 *     (errores, habilidades, características, monedas, condiciones)
 *   ✗ los textos dentro del JSX todavía están en español directo
 *
 * Extraerlos es mecánico pero extenso, y hacerlo a medias deja la aplicación
 * peor que no empezarla: mitad traducible, mitad no, sin forma de saber cuál
 * es cuál. Está anotado como trabajo pendiente en el plan de implementación.
 */

export const LOCALES = ['es-419', 'en', 'pt-BR', 'fr', 'it', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'es-419';

/** Idiomas con traducción completa de interfaz. El resto degrada al inglés. */
export const SUPPORTED_LOCALES: readonly Locale[] = ['es-419', 'en'];

export const LOCALE_LABELS: Record<Locale, string> = {
  'es-419': 'Español (Latinoamérica)',
  en: 'English',
  'pt-BR': 'Português (Brasil)',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
};

export const isSupportedLocale = (value: string): value is Locale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(value);

/**
 * Traducción de CONTENIDO, separada de la interfaz.
 *
 * Degradación POR CAMPO, no por documento: si el nombre está traducido y la
 * descripción no, se muestra el nombre en español y la descripción en inglés
 * con un indicador. Nunca se oculta contenido por falta de traducción.
 */
export type ContentTranslation = {
  readonly definitionId: string;
  readonly locale: Locale;
  readonly field: 'name' | 'description' | 'flavor';
  readonly value: string | string[];
  readonly status: 'machine' | 'reviewed' | 'official';
};

export function resolveContentField<T extends string | string[]>(
  original: T,
  translations: readonly ContentTranslation[],
  field: ContentTranslation['field'],
  locale: Locale,
): { value: T; translated: boolean; status?: ContentTranslation['status'] } {
  const match = translations.find((t) => t.locale === locale && t.field === field);
  if (!match) return { value: original, translated: false };
  return { value: match.value as T, translated: true, status: match.status };
}
