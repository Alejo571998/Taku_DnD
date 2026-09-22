import { describe, expect, it } from 'vitest';
import { loadContent, srd14 } from '../fixtures/content';
import {
  buildHomebrewPack,
  homebrewId,
  homebrewNamespace,
  isReservedId,
  parseHomebrewPack,
  slugify,
  HOMEBREW_FORMAT_VERSION,
} from '@domain/content/homebrew';
import type { AnyDefinition } from '@domain/content/schemas';

/**
 * HOMEBREW E IMPORTACION (MASTER SPEC §33)
 *
 * Un paquete importado es DATO NO CONFIABLE. Lo que se prueba aqui no es que
 * la importacion funcione: es que un archivo hostil no pueda suplantar al SRD
 * ni colar nada que el esquema no acepte.
 */

const WORKSPACE = '00000000-0000-7000-8000-000000000001';
const NAMESPACE = homebrewNamespace(WORKSPACE);

const weapon = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'algun-pack:weapon:hacha-rara',
  name: 'Hacha rara',
  type: 'weapon',
  rulesets: ['2014'],
  sourceId: 'homebrew:test',
  version: '1.0.0',
  language: 'es-419',
  description: ['Un hacha.'],
  category: 'martial',
  rangeType: 'melee',
  damage: { dice: '1d12', damageType: 'slashing' },
  properties: [],
  weight: 700,
  ...over,
});

const pack = (definitions: unknown[], over: Record<string, unknown> = {}) => ({
  formatVersion: HOMEBREW_FORMAT_VERSION,
  id: 'pack-de-prueba',
  name: 'Paquete de prueba',
  description: '',
  author: 'Mesa de los martes',
  version: '1.0.0',
  ruleset: '2014',
  createdAt: '2026-01-01T00:00:00.000Z',
  definitions,
  ...over,
});

describe('Espacio de nombres', () => {
  it('el namespace nunca choca con el del SRD', () => {
    expect(NAMESPACE.startsWith('hb-')).toBe(true);
    expect(isReservedId(`${NAMESPACE}:weapon:x`)).toBe(false);
  });

  it('reconoce los ids reservados del SRD', () => {
    expect(isReservedId('srd-2014:spell:fireball')).toBe(true);
    expect(isReservedId('srd-2024:spell:fireball')).toBe(true);
    expect(isReservedId('hb-abc:spell:fireball')).toBe(false);
  });

  it('el slug aguanta acentos, mayusculas y simbolos', () => {
    expect(slugify('Espada Ígnea del Dragón')).toBe('espada-ignea-del-dragon');
    expect(slugify('  ¡¿?!  ')).toBe('sin-nombre');
  });

  it('el id se deriva del nombre, no lo escribe el usuario', () => {
    expect(homebrewId(WORKSPACE, 'weapon', 'Hacha Rara')).toBe(`${NAMESPACE}:weapon:hacha-rara`);
  });
});

describe('Importacion', () => {
  it('lee un paquete valido y cuenta lo que trae', () => {
    const result = parseHomebrewPack(pack([weapon()]), WORKSPACE, new Set());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.preview.definitions).toHaveLength(1);
    expect(result.preview.countsByType['weapon']).toBe(1);
    expect(result.preview.pack.author).toBe('Mesa de los martes');
  });

  it('REESCRIBE los ids al espacio de quien importa', () => {
    const result = parseHomebrewPack(pack([weapon()]), WORKSPACE, new Set());
    if (!result.ok) throw new Error('fallo');
    expect(result.preview.definitions[0]!.id).toBe(`${NAMESPACE}:weapon:hacha-rara`);
  });

  it('un paquete que intenta suplantar al SRD no lo consigue, y se avisa', () => {
    // El ataque: redefinir Fireball para cambiar las reglas por debajo.
    const hostile = pack([
      weapon({ id: 'srd-2014:weapon:longsword', name: 'Longsword' }),
    ]);
    const result = parseHomebrewPack(hostile, WORKSPACE, new Set());
    if (!result.ok) throw new Error('fallo');

    const rewritten = result.preview.definitions[0]!.id;
    expect(rewritten.startsWith('srd-')).toBe(false);
    expect(rewritten).toBe(`${NAMESPACE}:weapon:longsword`);
    expect(result.preview.issues.map((i) => i.code)).toContain('definition.reservedId');

    // Y el SRD de verdad sigue intacto.
    const srd = loadContent('2014');
    expect(srd.get(srd14('weapon', 'longsword'))!.name).toBe('Longsword');
  });

  it('rechaza un archivo con una definicion invalida', () => {
    const broken = pack([weapon({ category: 'imaginaria' })]);
    const result = parseHomebrewPack(broken, WORKSPACE, new Set());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]!.code).toBe('format.unreadable');
  });

  it('rechaza un formato mas nuevo en vez de adivinar', () => {
    const future = pack([weapon()], { formatVersion: HOMEBREW_FORMAT_VERSION + 1 });
    const result = parseHomebrewPack(future, WORKSPACE, new Set());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]!.code).toBe('format.tooNew');
  });

  it('rechaza cualquier cosa que no sea un paquete', () => {
    for (const raw of [null, 42, 'hola', {}, { definitions: [] }]) {
      expect(parseHomebrewPack(raw, WORKSPACE, new Set()).ok).toBe(false);
    }
  });

  it('detecta conflictos con lo que ya existe, sin pisarlo', () => {
    const existing = new Set([`${NAMESPACE}:weapon:hacha-rara`]);
    const names = new Map([[`${NAMESPACE}:weapon:hacha-rara`, 'Mi hacha de siempre']]);
    const result = parseHomebrewPack(pack([weapon()]), WORKSPACE, existing, names);
    if (!result.ok) throw new Error('fallo');

    expect(result.preview.conflicts).toHaveLength(1);
    expect(result.preview.conflicts[0]!.existingName).toBe('Mi hacha de siempre');
  });

  it('avisa cuando una entrada no declara las reglas del paquete', () => {
    const mixed = pack([weapon({ rulesets: ['2024'] })]);
    const result = parseHomebrewPack(mixed, WORKSPACE, new Set());
    if (!result.ok) throw new Error('fallo');
    expect(result.preview.issues.map((i) => i.code)).toContain('ruleset.mismatch');
  });

  it('acota el tamaño: un archivo enorme no es un paquete', () => {
    const huge = pack(Array.from({ length: 5001 }, () => weapon()));
    expect(parseHomebrewPack(huge, WORKSPACE, new Set()).ok).toBe(false);
  });
});

describe('Exportacion', () => {
  it('produce un paquete versionado que se puede volver a importar', () => {
    const source = parseHomebrewPack(pack([weapon()]), WORKSPACE, new Set());
    if (!source.ok) throw new Error('fallo');

    const exported = buildHomebrewPack({
      id: NAMESPACE,
      name: 'Mi contenido',
      version: '2.1.0',
      ruleset: '2014',
      definitions: source.preview.definitions as AnyDefinition[],
    });

    expect(exported.formatVersion).toBe(HOMEBREW_FORMAT_VERSION);
    expect(exported.version).toBe('2.1.0');

    // El viaje de ida y vuelta: exportar e importar no pierde nada.
    const round = parseHomebrewPack(JSON.parse(JSON.stringify(exported)), WORKSPACE, new Set());
    expect(round.ok).toBe(true);
    if (!round.ok) return;
    expect(round.preview.definitions[0]!.name).toBe('Hacha rara');
    expect(round.preview.definitions[0]!.id).toBe(`${NAMESPACE}:weapon:hacha-rara`);
  });

  it('un paquete de otro workspace se reimporta al espacio propio', () => {
    const otherWorkspace = '99999999-9999-7999-8999-999999999999';
    const theirs = buildHomebrewPack({
      id: homebrewNamespace(otherWorkspace),
      name: 'Contenido ajeno',
      version: '1.0.0',
      ruleset: '2014',
      definitions: [
        weapon({ id: `${homebrewNamespace(otherWorkspace)}:weapon:hacha-rara` }) as AnyDefinition,
      ],
    });

    const result = parseHomebrewPack(JSON.parse(JSON.stringify(theirs)), WORKSPACE, new Set());
    if (!result.ok) throw new Error('fallo');
    expect(result.preview.definitions[0]!.id.startsWith(NAMESPACE)).toBe(true);
  });
});
