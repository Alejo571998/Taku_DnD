import { z } from 'zod';
import type { Ruleset } from '../rules/ruleset';
import { definitionSchema, type AnyDefinition, type ContentPack } from './schemas';

/**
 * HOMEBREW Y PAQUETES IMPORTADOS (MASTER SPEC §33)
 *
 * El contenido propio no es una funcionalidad secundaria: es la respuesta
 * estructural al límite legal. Solo el SRD se puede redistribuir, así que todo
 * lo demás lo crea o lo trae el usuario.
 *
 * Dos reglas que no se negocian:
 *
 *   1. UN PAQUETE IMPORTADO ES DATO NO CONFIABLE. Atraviesa Zod entero antes
 *      de tocar nada. No hay intérprete ni `eval`: el vocabulario de reglas es
 *      cerrado, así que un pack malicioso puede como mucho traer un objeto
 *      absurdo, nunca ejecutar código (MASTER PROMPT §77).
 *
 *   2. NADIE PUEDE SUPLANTAR AL SRD. Los ids se reescriben SIEMPRE al espacio
 *      de nombres de quien importa. Sin esto, un pack podría redefinir
 *      `srd-2014:spell:fireball` y cambiar las reglas por debajo.
 */

export const HOMEBREW_PREFIX = 'hb';
const RESERVED_PREFIXES = ['srd-2014', 'srd-2024', 'srd'];

/** `hb-a1b2c3d4` — namespace estable y corto de un workspace. */
export function homebrewNamespace(workspaceId: string): string {
  return `${HOMEBREW_PREFIX}-${workspaceId.replace(/-/g, '').slice(0, 8)}`;
}

export function isHomebrewId(id: string): boolean {
  return id.startsWith(`${HOMEBREW_PREFIX}-`);
}

export function isReservedId(id: string): boolean {
  return RESERVED_PREFIXES.some((p) => id.startsWith(`${p}:`));
}

/** Texto libre → slug estable. Dos objetos distintos nunca comparten id. */
export function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'sin-nombre';
}

export function homebrewId(workspaceId: string, type: string, name: string): string {
  return `${homebrewNamespace(workspaceId)}:${type}:${slugify(name)}`;
}

/**
 * ¿Es un rasgo generado por una especie o una clase?
 *
 * Una definición propia tiene tres partes —`hb-a1b2c3d4:species:elfo-nocturno`—
 * y sus acompañantes cuelgan de ella añadiendo dos más:
 * `hb-a1b2c3d4:species:elfo-nocturno:trait:vision-nocturna`.
 *
 * La consecuencia útil es que un rasgo SIEMPRE sabe de quién es, sin tabla de
 * relaciones: basta con mirarle el id. Y la lista de contenido propio puede
 * mostrar la especie sin sus doce rasgos sueltos al lado.
 */
export function isCompanionId(id: string): boolean {
  return id.split(':').length > 3;
}

/** El id del padre de un acompañante, o `null` si no lo es. */
export function parentIdOf(id: string): string | null {
  const parts = id.split(':');
  return parts.length > 3 ? parts.slice(0, 3).join(':') : null;
}

// ── Paquetes ─────────────────────────────────────────────────────────────────

/**
 * Formato de intercambio. `formatVersion` va primero a propósito: sin él, un
 * cambio de formato dentro de dos años rompe todos los archivos exportados y
 * no hay forma de saber cuál es cuál.
 */
export const HOMEBREW_FORMAT_VERSION = 1;

export const homebrewPackSchema = z.object({
  formatVersion: z.number().int().min(1).max(HOMEBREW_FORMAT_VERSION),
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).default(''),
  author: z.string().max(120).default(''),
  version: z.string().min(1).max(40),
  ruleset: z.enum(['2014', '2024']),
  createdAt: z.string(),
  /** Lote acotado: un archivo de 50 MB no es un pack, es un accidente. */
  definitions: z.array(definitionSchema).min(1).max(5000),
});

export type HomebrewPack = z.infer<typeof homebrewPackSchema>;

export type ImportIssue = {
  readonly code:
    | 'format.unreadable'
    | 'format.tooNew'
    | 'definition.invalid'
    | 'definition.reservedId'
    | 'ruleset.mismatch';
  readonly detail?: string;
  readonly index?: number;
};

export type ImportConflict = {
  readonly definitionId: string;
  readonly name: string;
  readonly type: string;
  /** Ya existe con ese id en el workspace: hay que decidir. */
  readonly existingName: string;
};

export type ImportPreview = {
  readonly pack: HomebrewPack;
  /** Definiciones ya renombradas al espacio de quien importa. */
  readonly definitions: readonly AnyDefinition[];
  readonly conflicts: readonly ImportConflict[];
  readonly issues: readonly ImportIssue[];
  readonly countsByType: Readonly<Record<string, number>>;
};

export type ParseResult =
  | { readonly ok: true; readonly preview: ImportPreview }
  | { readonly ok: false; readonly issues: readonly ImportIssue[] };

/**
 * Analiza un archivo importado SIN escribir nada.
 *
 * Devuelve exactamente lo que la pantalla necesita para el paso de vista
 * previa: qué trae, qué choca y qué está mal. Importar a ciegas y arreglar
 * después es lo que convierte una biblioteca en un vertedero.
 */
export function parseHomebrewPack(
  raw: unknown,
  workspaceId: string,
  existingIds: ReadonlySet<string>,
  existingNames: ReadonlyMap<string, string> = new Map(),
): ParseResult {
  const parsed = homebrewPackSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const tooNew =
      typeof (raw as { formatVersion?: unknown })?.formatVersion === 'number' &&
      (raw as { formatVersion: number }).formatVersion > HOMEBREW_FORMAT_VERSION;

    return {
      ok: false,
      issues: [
        {
          code: tooNew ? 'format.tooNew' : 'format.unreadable',
          ...(first ? { detail: `${first.path.join('.')}: ${first.message}` } : {}),
        },
      ],
    };
  }

  const pack = parsed.data;
  const namespace = homebrewNamespace(workspaceId);
  const issues: ImportIssue[] = [];
  const conflicts: ImportConflict[] = [];
  const definitions: AnyDefinition[] = [];
  const countsByType: Record<string, number> = {};

  pack.definitions.forEach((definition, index) => {
    // El id del archivo NO se respeta nunca. Se conserva el slug para que un
    // pack reimportado caiga sobre sí mismo, pero el espacio es siempre el de
    // quien importa: así ningún pack puede hacerse pasar por el SRD.
    const slug = definition.id.split(':').pop() ?? slugify(definition.name);
    const rewritten = `${namespace}:${definition.type}:${slug}`;

    if (isReservedId(definition.id)) {
      issues.push({
        code: 'definition.reservedId',
        index,
        detail: `${definition.name} venía con un id del SRD (${definition.id}); se importa como contenido propio.`,
      });
    }

    if (!definition.rulesets.includes(pack.ruleset)) {
      issues.push({
        code: 'ruleset.mismatch',
        index,
        detail: `${definition.name} no declara las reglas ${pack.ruleset} del paquete.`,
      });
    }

    if (existingIds.has(rewritten)) {
      conflicts.push({
        definitionId: rewritten,
        name: definition.name,
        type: definition.type,
        existingName: existingNames.get(rewritten) ?? definition.name,
      });
    }

    definitions.push({ ...definition, id: rewritten } as AnyDefinition);
    countsByType[definition.type] = (countsByType[definition.type] ?? 0) + 1;
  });

  return {
    ok: true,
    preview: { pack, definitions, conflicts, issues, countsByType },
  };
}

/** Empaqueta para exportar. Versionado y con procedencia, no un volcado suelto. */
export function buildHomebrewPack(input: {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version: string;
  ruleset: Ruleset;
  definitions: readonly AnyDefinition[];
}): HomebrewPack {
  return {
    formatVersion: HOMEBREW_FORMAT_VERSION,
    id: input.id,
    name: input.name,
    description: input.description ?? '',
    author: input.author ?? '',
    version: input.version,
    ruleset: input.ruleset,
    createdAt: new Date().toISOString(),
    definitions: [...input.definitions],
  };
}

/**
 * Metadatos del pack local de Homebrew.
 *
 * Declara la licencia como `proprietary` a propósito: el contenido propio NO
 * se redistribuye con la aplicación, y la procedencia tiene que verse tan
 * claro como la del SRD.
 */
export function homebrewPackMeta(workspaceId: string, ruleset: Ruleset, count: number): ContentPack {
  const source = {
    id: `homebrew:${workspaceId}`,
    name: 'Contenido propio',
    license: 'proprietary' as const,
    attribution: 'Creado por vos en TAKU. No se distribuye con la aplicación.',
  };

  return {
    id: homebrewNamespace(workspaceId),
    name: 'Mi contenido',
    description: 'Contenido que creaste o importaste en este espacio de trabajo.',
    version: '1.0.0',
    ruleset,
    language: 'es-419',
    source,
    sources: { [source.id]: source },
    builtIn: false,
    counts: { homebrew: count },
  };
}
