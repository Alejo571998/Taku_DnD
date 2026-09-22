import fs from 'node:fs';
import path from 'node:path';
import { ContentIndex } from '@domain/content';
import type { AnyDefinition, ContentSource } from '@domain/content/schemas';
import type { Ruleset } from '@domain/rules/ruleset';

/**
 * Los tests usan el CONTENIDO REAL del SRD, no maquetas.
 *
 * Un motor de reglas probado solo contra datos inventados no demuestra nada:
 * los bugs de 5e viven en los casos concretos (la cota de malla que no suma
 * Destreza, el arco largo que consume flechas, el mago que prepara por nivel).
 */

const CONTENT_DIR = path.resolve(process.cwd(), 'public', 'content');

const TYPES = [
  'spell', 'weapon', 'armor', 'gear', 'magicItem', 'class', 'subclass',
  'species', 'subspecies', 'trait', 'background', 'feat', 'feature',
  'condition', 'skill', 'language', 'rule', 'monster',
] as const;

const cache = new Map<string, ContentIndex>();

export function loadContent(ruleset: Ruleset = '2014'): ContentIndex {
  const packId = ruleset === '2014' ? 'srd-2014' : 'srd-2024';
  const cached = cache.get(packId);
  if (cached) return cached;

  const dir = path.join(CONTENT_DIR, packId);
  if (!fs.existsSync(dir)) {
    throw new Error(
      `Falta el contenido en ${dir}. Ejecuta: node scripts/build-content.mjs`,
    );
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as {
    sources: Record<string, ContentSource>;
  };

  const defs: AnyDefinition[] = [];
  for (const type of TYPES) {
    const file = path.join(dir, `${type}.json`);
    if (!fs.existsSync(file)) continue;
    const items = JSON.parse(fs.readFileSync(file, 'utf8')) as AnyDefinition[];
    for (const item of items) defs.push({ ...item, description: item.description ?? [] });
  }

  const index = new ContentIndex(defs, Object.values(manifest.sources ?? {}));
  cache.set(packId, index);
  return index;
}

/** Atajo para construir IDs del SRD en los tests. */
export const srd = (ruleset: Ruleset, type: string, slug: string) =>
  `srd-${ruleset}:${type}:${slug}`;

export const srd14 = (type: string, slug: string) => srd('2014', type, slug);
export const srd24 = (type: string, slug: string) => srd('2024', type, slug);
