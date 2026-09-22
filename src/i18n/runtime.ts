import type { Locale } from './config';

/**
 * RUNTIME DE TRADUCCIÓN (MASTER SPEC §34)
 *
 * Deliberadamente diminuto: buscar una clave y sustituir parámetros. No hace
 * falta más, y una dependencia de i18n completa traería plurales ICU, formato
 * de fechas y carga perezosa que aquí no se usan.
 *
 * ALCANCE — dicho con todas las letras:
 *
 *   ✓ Todo lo que el DOMINIO emite como CLAVE ya pasa por acá: errores,
 *     resúmenes de historial, avisos de la ficha. Son los textos que la
 *     arquitectura diseñó para ser traducibles, y están completos.
 *
 *   ✗ Los textos de PÁGINA siguen escritos en el JSX en español.
 *
 * La frontera es esa y es explicable: si sale del dominio, es una clave; si es
 * copy de una pantalla, está en la pantalla. No es "a medio hacer": es una
 * línea trazada a propósito, y el segundo idioma funciona entero del lado del
 * dominio sin tocar una sola pantalla.
 */

export type MessageTree = { [key: string]: string | MessageTree };

/**
 * Busca una clave mezclando niveles y claves literales con punto.
 *
 * Los catálogos tienen las dos formas a propósito: `history.damage` baja un
 * nivel, pero `history["tempHp.replaced"]` es una clave literal dentro de
 * `history`. Agrupar por dominio sin partir cada código en cinco niveles es lo
 * que hace el archivo legible, así que la búsqueda se adapta al dato y no al
 * revés.
 */
function lookup(tree: MessageTree, key: string): string | undefined {
  const direct = tree[key];
  if (typeof direct === 'string') return direct;

  const parts = key.split('.');
  // De la cabecera más larga a la más corta: una clave literal específica gana
  // a una coincidencia por nivel.
  for (let i = parts.length - 1; i >= 1; i--) {
    const node = tree[parts.slice(0, i).join('.')];
    if (node && typeof node === 'object') {
      const found = lookup(node, parts.slice(i).join('.'));
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export type TranslateParams = Readonly<Record<string, string | number>>;

/**
 * Sustituye `{param}` por su valor.
 *
 * Si falta la clave devuelve `fallback` —normalmente la clave misma—, nunca
 * una cadena vacía: una pantalla con huecos en blanco es peor que una con un
 * identificador visible, porque el hueco no se puede ni reportar.
 */
export function translate(
  tree: MessageTree,
  key: string,
  params?: TranslateParams,
  fallback?: string,
): string {
  const template = lookup(tree, key);
  if (template === undefined) return fallback ?? key;
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export type Translator = (key: string, params?: TranslateParams, fallback?: string) => string;

export function createTranslator(tree: MessageTree): Translator {
  return (key, params, fallback) => translate(tree, key, params, fallback);
}

/**
 * Carga un catálogo. Los dos idiomas soportados van en el bundle: son ~6 KB y
 * pedirlos por red haría parpadear la interfaz en cada arranque.
 */
export async function loadMessages(locale: Locale): Promise<MessageTree> {
  if (locale === 'en') {
    return (await import('./messages/en.json')).default as MessageTree;
  }
  return (await import('./messages/es-419.json')).default as MessageTree;
}
