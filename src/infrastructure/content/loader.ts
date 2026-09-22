import { ContentIndex } from '@domain/content';
import type { AnyDefinition, ContentPack, ContentSource } from '@domain/content/schemas';
import type { Ruleset } from '@domain/rules/ruleset';
import {
  applyTranslation,
  emptyOverlay,
  type TranslationOverlay,
} from '@domain/content/translation';
import { getDb, type StoredDefinition } from '../local/db';

/**
 * CARGA DE CONTENIDO
 *
 * Los packs se sirven como archivos estaticos desde /content, el service
 * worker los precachea, y en el primer arranque se vuelcan a IndexedDB.
 *
 * El contenido NO viaja en el bundle de JavaScript: son datos, se sirven como
 * datos. Son ~2,7 MB entre las dos ediciones; meterlos en el bundle
 * multiplicaria el tiempo de primera carga por nada.
 */

const CONTENT_TYPES = [
  'spell', 'weapon', 'armor', 'gear', 'magicItem', 'class', 'subclass',
  'species', 'subspecies', 'trait', 'background', 'feat', 'feature',
  'condition', 'skill', 'language', 'rule', 'monster',
] as const;

export type PackManifest = ContentPack & { sources: Record<string, ContentSource> };

export type SeedProgress = {
  readonly packId: string;
  readonly packName: string;
  readonly loaded: number;
  readonly total: number;
  readonly phase: 'downloading' | 'storing' | 'done';
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return (await res.json()) as T;
}

export async function fetchPackIndex(baseUrl = '/content'): Promise<PackManifest[]> {
  return fetchJson<PackManifest[]>(`${baseUrl}/index.json`);
}

/**
 * Vuelca los packs incorporados a IndexedDB. Idempotente: si ya estan en la
 * version correcta, no hace nada.
 */
export async function seedBuiltInContent(
  onProgress?: (p: SeedProgress) => void,
  baseUrl = '/content',
): Promise<{ seeded: boolean; definitions: number }> {
  const db = getDb();
  const manifests = await fetchPackIndex(baseUrl);
  let totalDefinitions = 0;
  let seeded = false;

  for (const manifest of manifests) {
    const existing = await db.packs.get(manifest.id);
    if (existing && existing.version === manifest.version) {
      totalDefinitions += Object.values(manifest.counts).reduce((a, b) => a + b, 0);
      continue;
    }

    seeded = true;
    const expected = Object.values(manifest.counts).reduce((a, b) => a + b, 0);
    let loaded = 0;

    onProgress?.({
      packId: manifest.id,
      packName: manifest.name,
      loaded: 0,
      total: expected,
      phase: 'downloading',
    });

    const batches: StoredDefinition[][] = [];
    for (const type of CONTENT_TYPES) {
      if (!manifest.counts[type]) continue;
      const items = await fetchJson<AnyDefinition[]>(`${baseUrl}/${manifest.id}/${type}.json`);
      const withPack = items.map((d) => ({
        ...d,
        description: d.description ?? [],
        packId: manifest.id,
      })) as StoredDefinition[];
      batches.push(withPack);
      loaded += items.length;
      onProgress?.({
        packId: manifest.id,
        packName: manifest.name,
        loaded,
        total: expected,
        phase: 'downloading',
      });
    }

    onProgress?.({
      packId: manifest.id,
      packName: manifest.name,
      loaded,
      total: expected,
      phase: 'storing',
    });

    // Una transaccion por pack: o entra entero, o no entra. Un pack a medias
    // es peor que ningun pack.
    await db.transaction('rw', db.definitions, db.packs, async () => {
      await db.definitions.where('packId').equals(manifest.id).delete();
      for (const batch of batches) await db.definitions.bulkPut(batch);
      await db.packs.put(manifest);
    });

    totalDefinitions += loaded;
    onProgress?.({
      packId: manifest.id,
      packName: manifest.name,
      loaded,
      total: expected,
      phase: 'done',
    });
  }

  return { seeded, definitions: totalDefinitions };
}

// ── Traducciones ─────────────────────────────────────────────────────────────

/**
 * Superposicion de traduccion del contenido (MASTER SPEC §37).
 *
 * Se aplica al CONSTRUIR el indice, no al pintar: asi el motor de reglas, la
 * busqueda y la ficha ven los mismos nombres. Traducir solo en la interfaz
 * haria que buscar "Cegado" no encontrara nada.
 */
let overlay: TranslationOverlay = emptyOverlay();
let overlayLanguage: string | null = null;

export function getTranslationOverlay(): TranslationOverlay {
  return overlay;
}

export async function loadTranslationOverlay(
  language = 'es-419',
  baseUrl = '/content',
): Promise<TranslationOverlay> {
  if (overlayLanguage === language) return overlay;

  try {
    const loaded = await fetchJson<TranslationOverlay>(
      `${baseUrl}/translations/${language}.json`,
    );
    overlay = { language, names: loaded.names ?? {}, entries: loaded.entries ?? {} };
  } catch {
    // Sin archivo de traduccion la aplicacion funciona en ingles. Es una
    // degradacion aceptable; fallar aqui dejaria la biblioteca vacia.
    overlay = emptyOverlay(language);
  }

  overlayLanguage = language;
  return overlay;
}

/** Construye el indice en memoria que consume el motor de personaje. */
export async function buildContentIndex(ruleset: Ruleset): Promise<ContentIndex> {
  const db = getDb();
  const [definitions, packs] = await Promise.all([
    db.definitions.where('rulesets').equals(ruleset).toArray(),
    db.packs.toArray(),
  ]);

  const sources: ContentSource[] = [];
  for (const pack of packs as PackManifest[]) {
    for (const s of Object.values(pack.sources ?? {})) sources.push(s);
    if (pack.source) sources.push(pack.source);
  }

  // Campo a campo: lo que no este traducido se queda en ingles y la interfaz
  // lo dice, en vez de esconderlo (MASTER SPEC §37).
  return new ContentIndex(
    definitions.map((d) => applyTranslation(d, overlay)),
    sources,
  );
}

/**
 * Cache del indice por ruleset.
 *
 * Resolver un personaje es barato, pero reconstruir el indice desde IndexedDB
 * en cada render no lo es. Se invalida al importar o editar Homebrew.
 */
const indexCache = new Map<Ruleset, ContentIndex>();

/**
 * Version del contenido. Cambia cuando se carga un pack nuevo o se edita
 * Homebrew, y sirve de señal para que la interfaz reconstruya su indice.
 */
let contentVersion = 0;
const versionListeners = new Set<() => void>();

export const getContentVersion = (): number => contentVersion;

export function subscribeToContent(listener: () => void): () => void {
  versionListeners.add(listener);
  return () => versionListeners.delete(listener);
}

export async function getContentIndex(ruleset: Ruleset): Promise<ContentIndex> {
  const cached = indexCache.get(ruleset);
  if (cached) return cached;

  const index = await buildContentIndex(ruleset);

  /**
   * NUNCA cachear un indice vacio.
   *
   * Si una pantalla lo pide mientras el volcado inicial sigue en curso, el
   * resultado es un indice sin nada — y cachearlo dejaba la aplicacion con el
   * contenido vacio para siempre: el creador mostraba cero especies aunque la
   * base ya tuviera 3.000 definiciones.
   */
  if (index.size > 0) indexCache.set(ruleset, index);

  return index;
}

export function invalidateContentIndex(ruleset?: Ruleset): void {
  if (ruleset) indexCache.delete(ruleset);
  else indexCache.clear();
  contentVersion++;
  for (const listener of versionListeners) listener();
}
