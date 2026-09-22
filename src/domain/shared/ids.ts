/**
 * Identificadores del dominio.
 *
 * Los tipos "branded" impiden pasar un CharacterId donde se espera un ItemId.
 * Cuesta cero en tiempo de ejecucion y elimina una clase entera de bugs.
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** UUIDv7: ordenable por tiempo, indexable, generable sin conexion. */
export type Uuid = Brand<string, 'Uuid'>;

export type CharacterId = Brand<string, 'CharacterId'>;
export type WorkspaceId = Brand<string, 'WorkspaceId'>;
export type CampaignId = Brand<string, 'CampaignId'>;
export type InventoryItemId = Brand<string, 'InventoryItemId'>;
export type ResourceInstanceId = Brand<string, 'ResourceInstanceId'>;
export type ConditionInstanceId = Brand<string, 'ConditionInstanceId'>;
export type ClientOpId = Brand<string, 'ClientOpId'>;
export type RuleId = Brand<string, 'RuleId'>;

/**
 * Identificador de contenido: `<fuente>:<tipo>:<slug>`
 *
 *   srd-2014:spell:fireball
 *   srd-2024:class:wizard
 *   hb:<workspaceId>:weapon:espada-de-arkan
 *
 * Nunca se reutiliza un ID entre ediciones: `srd-2014:class:ranger` y
 * `srd-2024:class:ranger` son contenidos distintos porque LO SON.
 */
export type DefinitionId = Brand<string, 'DefinitionId'>;

const DEFINITION_ID_RE = /^[a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)+$/;

export function isDefinitionId(value: string): value is DefinitionId {
  return DEFINITION_ID_RE.test(value);
}

export function definitionId(value: string): DefinitionId {
  if (!isDefinitionId(value)) {
    throw new Error(`Identificador de contenido invalido: "${value}"`);
  }
  return value as DefinitionId;
}

export function parseDefinitionId(id: DefinitionId): {
  source: string;
  type: string;
  slug: string;
} {
  const parts = id.split(':');
  // Homebrew lleva el workspace intercalado: hb:<ws>:weapon:slug
  if (parts.length >= 4) {
    return {
      source: `${parts[0]}:${parts[1]}`,
      type: parts[2] ?? '',
      slug: parts.slice(3).join(':'),
    };
  }
  return { source: parts[0] ?? '', type: parts[1] ?? '', slug: parts[2] ?? '' };
}

// ── Generacion de UUIDv7 ─────────────────────────────────────────────────────

/**
 * UUIDv7 propio: 48 bits de timestamp + aleatoriedad criptografica.
 *
 * Se implementa aqui en vez de depender de `uuid` en el dominio porque el
 * dominio debe permanecer sin dependencias externas (regla de
 * capas). Son 15 lineas y elimina un import de la capa mas interna.
 */
export function newUuid(): Uuid {
  const bytes = new Uint8Array(16);
  cryptoRandom(bytes);

  const ts = Date.now();
  bytes[0] = (ts / 2 ** 40) & 0xff;
  bytes[1] = (ts / 2 ** 32) & 0xff;
  bytes[2] = (ts / 2 ** 24) & 0xff;
  bytes[3] = (ts / 2 ** 16) & 0xff;
  bytes[4] = (ts / 2 ** 8) & 0xff;
  bytes[5] = ts & 0xff;

  // version 7
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  // variante RFC 4122
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push((bytes[i] ?? 0).toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-') as Uuid;
}

function cryptoRandom(bytes: Uint8Array): void {
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes);
    return;
  }
  throw new Error(
    'No hay una fuente de aleatoriedad criptografica disponible. ' +
      'Math.random() no es aceptable en una aplicacion cuyo producto son las tiradas.',
  );
}

export const asCharacterId = (v: string) => v as CharacterId;
export const asWorkspaceId = (v: string) => v as WorkspaceId;
export const asCampaignId = (v: string) => v as CampaignId;
export const asInventoryItemId = (v: string) => v as InventoryItemId;
export const asClientOpId = (v: string) => v as ClientOpId;
export const asRuleId = (v: string) => v as RuleId;

export const newCharacterId = () => newUuid() as string as CharacterId;
export const newInventoryItemId = () => newUuid() as string as InventoryItemId;
export const newClientOpId = () => newUuid() as string as ClientOpId;
export const newResourceInstanceId = () => newUuid() as string as ResourceInstanceId;
export const newConditionInstanceId = () => newUuid() as string as ConditionInstanceId;
export const newCampaignId = () => newUuid() as string as CampaignId;
