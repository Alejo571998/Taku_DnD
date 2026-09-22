import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SyncEngine, type CursorStore, type SyncTransport } from '@application/sync/engine';
import { CharacterService } from '@application/services/character-service';
import type { CommandEnvelope } from '@application/commands/types';
import { RulesEngine } from '@domain/rules/engine';
import { SRD_RULES } from '@domain/rules/srd-rules';
import { asWorkspaceId, type WorkspaceId } from '@domain/shared/ids';
import { createTestDb, type CompanionDatabase } from '@infrastructure/local/db';
import {
  DexieCharacterRepository,
  DexieConflictRepository,
  DexieHistoryRepository,
  DexieOutboxRepository,
} from '@infrastructure/local/repositories';
import { character } from '../fixtures/characters';
import { loadContent } from '../fixtures/content';

/**
 * CASO CRÍTICO 15 (MASTER PROMPT §59)
 *
 *   offline → outbox → sync → servidor, SIN duplicaciones.
 *
 * Es la garantía que hace viable el offline multi-dispositivo. Se prueba con
 * una base local real (fake-indexeddb) y un transporte falso que se comporta
 * como el servidor: deduplica por `clientOpId`.
 */

const WORKSPACE = asWorkspaceId('00000000-0000-7000-8000-000000000001');

/** Servidor de mentira que replica la garantía real: clave primaria única. */
class FakeServer implements SyncTransport {
  readonly applied = new Map<string, CommandEnvelope>();
  readonly characters = new Map<string, { version: number; state: unknown }>();
  available = true;
  pushCalls = 0;
  /** Fuerza un fallo de red en la siguiente subida. */
  failNextPush = false;
  /** Simula que otro dispositivo ya escribio una version mas nueva. */
  conflictNextPush = false;

  private seq = 0;
  private readonly log: { entityId: string; version: number }[] = [];

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async push(
    _workspaceId: WorkspaceId,
    operations: readonly CommandEnvelope[],
    snapshots: readonly { characterId: string; version: number; state: unknown }[],
  ) {
    this.pushCalls++;

    if (this.failNextPush) {
      this.failNextPush = false;
      throw new Error('Red caída');
    }

    const results = operations.map((op) => {
      // ESTA es la garantía: la clave ya existe → duplicado, no se reaplica.
      if (this.applied.has(op.clientOpId as string)) {
        return { clientOpId: op.clientOpId as string, status: 'duplicate' as const };
      }
      this.applied.set(op.clientOpId as string, op);
      return { clientOpId: op.clientOpId as string, status: 'applied' as const };
    });

    if (this.conflictNextPush) {
      this.conflictNextPush = false;
      for (const snapshot of snapshots) {
        const existing = this.characters.get(snapshot.characterId);
        const serverVersion = (existing?.version ?? snapshot.version) + 5;
        this.characters.set(snapshot.characterId, {
          version: serverVersion,
          state: { ...(snapshot.state as Record<string, unknown>), name: 'Nombre del servidor', version: serverVersion },
        });
        for (const result of results) {
          if (operations.find((o) => o.clientOpId === result.clientOpId)?.characterId !== snapshot.characterId) continue;
          (result as { status: string; serverVersion?: number }).status = 'conflict';
          (result as { status: string; serverVersion?: number }).serverVersion = serverVersion;
        }
      }
      return { results, cursor: this.seq };
    }

    for (const snapshot of snapshots) {
      const existing = this.characters.get(snapshot.characterId);
      if (!existing || snapshot.version > existing.version) {
        this.characters.set(snapshot.characterId, {
          version: snapshot.version,
          state: snapshot.state,
        });
        this.seq++;
        this.log.push({ entityId: snapshot.characterId, version: snapshot.version });
        continue;
      }

      /*
        CONCURRENCIA OPTIMISTA, IGUAL QUE EL SERVIDOR DE VERDAD.

        `src/app/api/sync/push/route.ts` hace `.lt('version', snapshot.version)`
        y, si no actualiza ninguna fila, devuelve `conflict`. Este doble se
        limitaba a no escribir y respondía `applied`: con dos dispositivos
        editando a la vez —el caso que vino a probar— el segundo se iba tan
        contento y su cambio no estaba en ninguna parte.

        Un doble más blando que el original no prueba el original.
      */
      for (const result of results) {
        const operation = operations.find((o) => o.clientOpId === result.clientOpId);
        if (operation?.characterId !== snapshot.characterId) continue;
        (result as { status: string; serverVersion?: number }).status = 'conflict';
        (result as { status: string; serverVersion?: number }).serverVersion = existing.version;
      }
    }

    return { results, cursor: this.seq };
  }

  async pull(_workspaceId: WorkspaceId, cursor: number) {
    const slice = this.log.slice(cursor);
    return {
      changes: slice.map((entry) => ({
        entityId: entry.entityId,
        operation: 'upsert' as const,
        state: this.characters.get(entry.entityId)?.state ?? null,
        version: this.characters.get(entry.entityId)?.version ?? null,
      })),
      cursor: this.log.length,
      hasMore: false,
    };
  }

  async fetchEntity(_workspaceId: WorkspaceId, entityId: string) {
    return this.characters.get(entityId) ?? null;
  }

  /** El inventario NO se construye desde el log: es el estado real. */
  async fetchManifest(_workspaceId: WorkspaceId) {
    const entities = [...this.characters].map(([entityId, record]) => ({
      entityId,
      version: record.version,
      deleted: false,
    }));
    for (const entityId of this.deleted) {
      entities.push({ entityId, version: Number.MAX_SAFE_INTEGER, deleted: true });
    }
    return entities;
  }

  // ── Simulación de la carrera del cursor ──────────────────────
  //
  // La carrera real necesita dos conexiones a Postgres: `seq` se reserva al
  // insertar y no al confirmar, así que el lector puede adelantar el cursor
  // por encima de un `seq` que confirma un instante después.
  //
  // Provocarla no se puede acá. Pero lo que hay que comprobar NO es la
  // carrera: es que el sistema se CURE cuando pasa. Y su consecuencia sí se
  // reproduce exactamente — el servidor tiene un cambio que el log no ofrece.

  readonly deleted = new Set<string>();

  /** Escribe en el servidor SIN dejar rastro en el log: el cambio perdido. */
  writeBehindTheCursor(entityId: string, state: unknown, version: number): void {
    this.characters.set(entityId, { version, state });
    // El `seq` se consume igual: por eso queda el hueco.
    this.seq++;
  }

  /** Borra en el servidor sin anunciarlo, que es la otra mitad del problema. */
  deleteBehindTheCursor(entityId: string): void {
    this.characters.delete(entityId);
    this.deleted.add(entityId);
    this.seq++;
  }
}

class MemoryCursor implements CursorStore {
  private value = 0;
  async get() {
    return this.value;
  }
  async set(cursor: number) {
    this.value = cursor;
  }
}

let db: CompanionDatabase;
let service: CharacterService;
let outbox: DexieOutboxRepository;
let characters: DexieCharacterRepository;
let conflicts: DexieConflictRepository;

const content = () => loadContent('2014');
const engine = () => new RulesEngine(SRD_RULES, '2014');

beforeEach(async () => {
  db = createTestDb(`taku-test-${Math.random().toString(36).slice(2)}`);
  await db.open();

  characters = new DexieCharacterRepository(db);
  outbox = new DexieOutboxRepository(db);
  conflicts = new DexieConflictRepository(db);
  service = new CharacterService(characters, outbox, new DexieHistoryRepository(db), conflicts);
});

async function seedCharacter() {
  const state = character('2014')
    .withClass('fighter', 5)
    .abilities({ str: 16, con: 14 })
    .withHitPoints(44)
    .build();
  await characters.save(state);
  return state;
}

describe('CASO 15 · offline → outbox → sync', () => {
  it('encola cada acción hecha sin conexión', async () => {
    const state = await seedCharacter();

    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 7 }, content(), engine());
    await service.dispatch(state.id, { type: 'HealCharacter', amount: 3 }, content(), engine());

    expect(await outbox.count()).toBe(2);
  });

  it('sube lo pendiente y vacía la cola', async () => {
    const state = await seedCharacter();
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 7 }, content(), engine());

    const server = new FakeServer();
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor());

    const outcome = await sync.sync(WORKSPACE);

    expect(outcome?.pushed).toBe(1);
    expect(await outbox.count()).toBe(0);
    expect(server.applied.size).toBe(1);
  });

  it('un reintento NO duplica la operación', async () => {
    const state = await seedCharacter();
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 7 }, content(), engine());

    const server = new FakeServer();
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor());

    // Primer intento: la red se cae DESPUÉS de que el servidor recibiera.
    // Es el caso peligroso: el servidor aplicó, el cliente no se enteró.
    const envelopes = await outbox.pending();
    await server.push(WORKSPACE, envelopes, []);
    expect(server.applied.size).toBe(1);

    // El cliente, que cree que falló, reintenta.
    await sync.sync(WORKSPACE);

    // El servidor la reconoce como duplicada: sigue habiendo UNA sola.
    expect(server.applied.size).toBe(1);
    expect(await outbox.count()).toBe(0);
  });

  it('un fallo de red deja la operación en la cola con backoff', async () => {
    const state = await seedCharacter();
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 7 }, content(), engine());

    const server = new FakeServer();
    server.failNextPush = true;
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor());

    await sync.sync(WORKSPACE);

    // Nada se perdió: sigue pendiente, esperando su turno.
    expect(await outbox.count()).toBe(1);

    const entry = await db.outbox.toCollection().first();
    expect(entry?.status).toBe('failed');
    expect(entry?.attempts).toBe(1);
    expect(entry?.nextAttemptAt).toBeGreaterThan(Date.now());
  });

  it('sin conexión no intenta nada y no rompe', async () => {
    const state = await seedCharacter();
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 7 }, content(), engine());

    const server = new FakeServer();
    server.available = false;
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor());

    expect(await sync.sync(WORKSPACE)).toBeNull();
    expect(server.pushCalls).toBe(0);
    // Lo importante: el cambio local SIGUE aplicado. Offline no es degradado.
    expect((await characters.get(state.id))?.hitPoints.current).toBe(37);
  });

  it('los deltas conmutativos convergen entre dos dispositivos', async () => {
    const state = await seedCharacter();
    const server = new FakeServer();

    // Dispositivo A: −7 PG
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 7 }, content(), engine());
    const syncA = new SyncEngine(server, outbox, characters, new MemoryCursor());
    await syncA.sync(WORKSPACE);
    expect((await characters.get(state.id))?.hitPoints.current).toBe(37);

    // Dispositivo B: base independiente que arranca desde el servidor
    const dbB = createTestDb(`taku-test-b-${Math.random().toString(36).slice(2)}`);
    await dbB.open();
    const charactersB = new DexieCharacterRepository(dbB);
    const outboxB = new DexieOutboxRepository(dbB);
    const syncB = new SyncEngine(server, outboxB, charactersB, new MemoryCursor());

    await syncB.sync(WORKSPACE);

    const onB = await charactersB.get(state.id);
    expect(onB?.hitPoints.current).toBe(37);
    expect(onB?.version).toBe(state.version + 1);
  });

  it('gana la versión más alta al bajar cambios', async () => {
    const state = await seedCharacter();
    const server = new FakeServer();
    const cursor = new MemoryCursor();
    const sync = new SyncEngine(server, outbox, characters, cursor);

    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 10 }, content(), engine());
    await sync.sync(WORKSPACE);

    // El servidor recibe una versión más nueva desde otro dispositivo.
    const newer = { ...state, hitPoints: { ...state.hitPoints, current: 12 }, version: 99 };
    server.characters.set(state.id as string, { version: 99, state: newer });
    (server as unknown as { log: { entityId: string; version: number }[] }).log.push({
      entityId: state.id as string,
      version: 99,
    });

    await sync.sync(WORKSPACE);

    expect((await characters.get(state.id))?.hitPoints.current).toBe(12);
    expect((await characters.get(state.id))?.version).toBe(99);
  });
});

describe('Historial y Deshacer', () => {
  it('registra cada comando y permite revertirlo', async () => {
    const state = await seedCharacter();

    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 12 }, content(), engine());
    expect((await characters.get(state.id))?.hitPoints.current).toBe(32);

    const entry = await service.lastUndoable(state.id);
    expect(entry).toBeDefined();

    await service.undo(state.id, entry!.id, content(), engine());
    expect((await characters.get(state.id))?.hitPoints.current).toBe(44);
  });

  it('no deshace dos veces la misma acción', async () => {
    const state = await seedCharacter();
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 12 }, content(), engine());

    const entry = await service.lastUndoable(state.id);
    await service.undo(state.id, entry!.id, content(), engine());

    const second = await service.undo(state.id, entry!.id, content(), engine());
    expect(second.ok).toBe(false);
  });

  it('deshacer viaja por el mismo camino: también se encola', async () => {
    const state = await seedCharacter();
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 12 }, content(), engine());

    const before = await outbox.count();
    const entry = await service.lastUndoable(state.id);
    await service.undo(state.id, entry!.id, content(), engine());

    // El deshacer es un comando más, no un mecanismo paralelo que pueda
    // divergir de la sincronización.
    expect(await outbox.count()).toBe(before + 1);
  });
});

describe('Persistencia local', () => {
  it('los personajes sobreviven a reabrir la base', async () => {
    const state = await seedCharacter();
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 7 }, content(), engine());

    const name = db.name;
    db.close();

    const reopened = createTestDb(name);
    await reopened.open();
    const repo = new DexieCharacterRepository(reopened);

    expect((await repo.get(state.id))?.hitPoints.current).toBe(37);
  });

  it('borrar deja un tombstone, no elimina la fila', async () => {
    const state = await seedCharacter();
    await characters.delete(state.id);

    // Invisible para la aplicación…
    expect(await characters.get(state.id)).toBeUndefined();
    // …pero la fila sigue ahí para poder propagar la baja a otros dispositivos.
    expect(await db.characters.get(state.id as string)).toBeDefined();
  });
});

/**
 * CONFLICTOS
 *
 * Un conflicto no es un error: son dos dispositivos que cambiaron lo mismo
 * estando separados. Lo que se prueba aqui es que el trabajo del usuario NUNCA
 * desaparece sin que el usuario lo haya decidido.
 */
describe('Resolucion de conflictos', () => {
  it('guarda la foto local cuando el servidor rechaza la subida', async () => {
    const state = await seedCharacter();
    await service.dispatch(state.id, { type: 'UpdateIdentity', patch: { name: 'Nombre local' } }, content(), engine());

    const server = new FakeServer();
    server.conflictNextPush = true;
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor(), conflicts);
    await sync.sync(WORKSPACE);

    const pending = await conflicts.pending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.localState.name).toBe('Nombre local');
    expect(pending[0]!.serverVersion).toBeGreaterThan(pending[0]!.localVersion);
  });

  it('no apila un conflicto por cada comando rechazado', async () => {
    const state = await seedCharacter();
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 3 }, content(), engine());
    await service.dispatch(state.id, { type: 'HealCharacter', amount: 2 }, content(), engine());

    const server = new FakeServer();
    server.conflictNextPush = true;
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor(), conflicts);
    await sync.sync(WORKSPACE);

    expect(await conflicts.count()).toBe(1);
  });

  it('la cola se vacia: reenviar chocaria otra vez', async () => {
    const state = await seedCharacter();
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 3 }, content(), engine());

    const server = new FakeServer();
    server.conflictNextPush = true;
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor(), conflicts);
    await sync.sync(WORKSPACE);

    expect(await outbox.count()).toBe(0);
  });

  it('elegir "lo mio" sube la version por ENCIMA de la del servidor', async () => {
    const state = await seedCharacter();
    await service.dispatch(state.id, { type: 'UpdateIdentity', patch: { name: 'Nombre local' } }, content(), engine());

    const server = new FakeServer();
    server.conflictNextPush = true;
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor(), conflicts);
    await sync.sync(WORKSPACE);

    const conflict = (await conflicts.pending())[0]!;
    await service.resolveConflict(state.id, 'local', content(), engine(), () =>
      sync.adoptServerVersion(WORKSPACE, state.id as string),
    );

    const local = await characters.get(state.id);
    expect(local!.name).toBe('Nombre local');
    // Si empatara, la concurrencia optimista lo rechazaria de nuevo.
    expect(local!.version).toBeGreaterThan(conflict.serverVersion);
    expect(await conflicts.count()).toBe(0);

    // Y el siguiente ciclo la sube sin pelea.
    await sync.sync(WORKSPACE);
    expect(server.characters.get(state.id as string)!.state).toMatchObject({ name: 'Nombre local' });
  });

  it('elegir "lo del servidor" trae la version remota de verdad', async () => {
    const state = await seedCharacter();
    await service.dispatch(state.id, { type: 'UpdateIdentity', patch: { name: 'Nombre local' } }, content(), engine());

    const server = new FakeServer();
    server.conflictNextPush = true;
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor(), conflicts);
    await sync.sync(WORKSPACE);

    await service.resolveConflict(state.id, 'server', content(), engine(), () =>
      sync.adoptServerVersion(WORKSPACE, state.id as string),
    );

    const local = await characters.get(state.id);
    expect(local!.name).toBe('Nombre del servidor');
    expect(await conflicts.count()).toBe(0);
  });

  it('sin repositorio de conflictos el motor sigue convergiendo', async () => {
    const state = await seedCharacter();
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 3 }, content(), engine());

    const server = new FakeServer();
    server.conflictNextPush = true;
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor());

    await expect(sync.sync(WORKSPACE)).resolves.not.toBeNull();
  });
});

/**
 * LA RED DE SEGURIDAD DEL CURSOR
 *
 * El cursor incremental tiene un agujero que no depende del código: Postgres
 * reserva `change_log.seq` al INSERTAR, no al confirmar. Dos dispositivos que
 * escriben a la vez pueden confirmar en orden inverso, y entonces un lector
 * adelanta el cursor por encima de un `seq` que todavía no existía para él.
 * Ese cambio queda fuera de alcance para siempre, porque la consulta es
 * `seq > cursor`.
 *
 * Provocar la carrera hace falta dos conexiones, y no se puede acá. Pero la
 * carrera NO es lo que hay que comprobar: lo que hay que comprobar es que el
 * sistema se cure cuando ocurre. Y eso sí se reproduce exacto, porque su
 * consecuencia es simple de describir: el servidor tiene algo que el log no
 * ofrece.
 */
describe('Reconciliación · el cambio que el cursor perdió', () => {
  it('el ciclo normal NO lo ve: es el agujero, y hay que verlo abierto', async () => {
    const state = await seedCharacter();
    const server = new FakeServer();
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor());

    // El personaje llega al servidor por el camino normal.
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 5 }, content(), engine());
    await sync.sync(WORKSPACE);

    // Otro dispositivo escribe la versión 99 y su entrada del log se pierde.
    server.writeBehindTheCursor(
      state.id as string,
      { ...state, version: 99, name: 'Arkan el Recuperado' },
      99,
    );

    // Sin reconciliación, el ciclo incremental no trae nada: para él no pasó.
    const normal = await sync.sync(WORKSPACE);
    expect(normal?.pulled).toBe(0);
    expect((await characters.get(state.id))!.name).not.toBe('Arkan el Recuperado');
  });

  it('la reconciliación lo trae, y eso es todo lo que se le pide', async () => {
    const state = await seedCharacter();
    const server = new FakeServer();
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor());

    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 5 }, content(), engine());
    await sync.sync(WORKSPACE);

    server.writeBehindTheCursor(
      state.id as string,
      { ...state, version: 99, name: 'Arkan el Recuperado' },
      99,
    );

    const healed = await sync.sync(WORKSPACE, { reconcile: true });

    expect(healed?.healed).toBe(1);
    expect((await characters.get(state.id))!.name).toBe('Arkan el Recuperado');
  });

  it('también cura un borrado que se perdió', async () => {
    const state = await seedCharacter();
    const server = new FakeServer();
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor());

    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 5 }, content(), engine());
    await sync.sync(WORKSPACE);
    expect(await characters.get(state.id)).toBeDefined();

    // Alguien lo borró desde otro dispositivo y el aviso no llegó. Un personaje
    // fantasma es peor que uno desactualizado: el usuario lo abre y juega con él.
    server.deleteBehindTheCursor(state.id as string);

    const outcome = await sync.sync(WORKSPACE, { reconcile: true });

    expect(outcome?.healed).toBe(1);
    expect(await characters.get(state.id)).toBeUndefined();
  });

  it('NO pisa lo local cuando lo local es más nuevo', async () => {
    const state = await seedCharacter();
    const server = new FakeServer();
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor());

    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 5 }, content(), engine());
    await sync.sync(WORKSPACE);

    // Daño hecho sin conexión: lo local va por delante y todavía no se subió.
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 3 }, content(), engine());
    const localBefore = await characters.get(state.id);

    // Si la reconciliación bajara la versión del servidor, ese daño
    // desaparecería. Perder trabajo del usuario por "sincronizar" es
    // exactamente lo que no puede pasar.
    const outcome = await sync.sync(WORKSPACE, { reconcile: true });

    const localAfter = await characters.get(state.id);
    expect(localAfter!.version).toBeGreaterThanOrEqual(localBefore!.version);
    expect(outcome?.healed).toBe(0);
  });

  it('cuando no hay nada que curar no toca nada', async () => {
    const state = await seedCharacter();
    const server = new FakeServer();
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor());

    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 5 }, content(), engine());
    await sync.sync(WORKSPACE, { reconcile: true });

    // El caso normal, que es el que corre siempre: cero trabajo extra.
    const second = await sync.sync(WORKSPACE, { reconcile: true });
    expect(second?.healed).toBe(0);
  });

  it('el ciclo normal no pide el inventario: sería un viaje por latido', async () => {
    const state = await seedCharacter();
    const server = new FakeServer();
    const sync = new SyncEngine(server, outbox, characters, new MemoryCursor());
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 5 }, content(), engine());

    let manifestCalls = 0;
    const original = server.fetchManifest.bind(server);
    server.fetchManifest = async (ws) => {
      manifestCalls++;
      return original(ws);
    };

    await sync.sync(WORKSPACE);
    expect(manifestCalls).toBe(0);

    await sync.sync(WORKSPACE, { reconcile: true });
    expect(manifestCalls).toBe(1);
  });
});

/**
 * DOS DISPOSITIVOS DE VERDAD
 *
 * Lo que había probado era media historia: un dispositivo subía y otro bajaba.
 * Lo que de verdad da miedo de una ficha compartida entre el teléfono y la
 * computadora es lo otro —los dos escriben, los dos suben— y eso no estaba.
 *
 * Acá cada dispositivo es una pila entera: su propia base IndexedDB, su propio
 * repositorio, su propia cola y su propio cursor. Solo comparten el servidor,
 * igual que dos aparatos comparten una cuenta. Ningún objeto cruza de uno a
 * otro: si algo llega, llegó sincronizando.
 *
 * NO es un teléfono real contra un navegador real. Es el mismo código de
 * cliente ejecutado dos veces contra un servidor que responde como el de
 * producción, incluida la concurrencia optimista.
 */
type Device = {
  service: CharacterService;
  characters: DexieCharacterRepository;
  conflicts: DexieConflictRepository;
  sync: SyncEngine;
};

async function newDevice(server: FakeServer, label: string): Promise<Device> {
  const deviceDb = createTestDb(`taku-${label}-${Math.random().toString(36).slice(2)}`);
  await deviceDb.open();

  const deviceCharacters = new DexieCharacterRepository(deviceDb);
  const deviceOutbox = new DexieOutboxRepository(deviceDb);
  const deviceConflicts = new DexieConflictRepository(deviceDb);

  return {
    characters: deviceCharacters,
    conflicts: deviceConflicts,
    service: new CharacterService(
      deviceCharacters,
      deviceOutbox,
      new DexieHistoryRepository(deviceDb),
      deviceConflicts,
    ),
    sync: new SyncEngine(server, deviceOutbox, deviceCharacters, new MemoryCursor(), deviceConflicts),
  };
}

describe('Dos dispositivos, una cuenta', () => {
  it('por turnos convergen, y el segundo ve lo del primero', async () => {
    const state = await seedCharacter();
    const server = new FakeServer();
    const phone = await newDevice(server, 'phone');

    // La computadora es el dispositivo del `beforeEach`, que ya tiene la ficha.
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 7 }, content(), engine());
    const desktop = new SyncEngine(server, outbox, characters, new MemoryCursor(), conflicts);
    await desktop.sync(WORKSPACE);

    // El teléfono arranca vacío: todo lo que tenga, lo trajo del servidor.
    expect(await phone.characters.get(state.id)).toBeUndefined();
    await phone.sync.sync(WORKSPACE);
    expect((await phone.characters.get(state.id))?.hitPoints.current).toBe(37);

    // Ahora escribe el teléfono y mira la computadora.
    await phone.service.dispatch(state.id, { type: 'HealCharacter', amount: 3 }, content(), engine());
    await phone.sync.sync(WORKSPACE);
    await desktop.sync(WORKSPACE);

    expect((await characters.get(state.id))?.hitPoints.current).toBe(40);
    expect((await phone.characters.get(state.id))?.hitPoints.current).toBe(40);
  });

  it('los dos sin conexión: el segundo NO se pierde en silencio', async () => {
    const state = await seedCharacter();
    const server = new FakeServer();
    const phone = await newDevice(server, 'phone');

    // La ficha llega al servidor cuando la computadora sube ALGO: un ciclo
    // sin nada que subir no publica nada, y el teléfono se quedaría vacío.
    const desktop = new SyncEngine(server, outbox, characters, new MemoryCursor(), conflicts);
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 1 }, content(), engine());
    await desktop.sync(WORKSPACE);
    await phone.sync.sync(WORKSPACE);

    // Misma base de partida, y a partir de acá cada uno por su lado.
    const base = (await characters.get(state.id))!.version;
    expect((await phone.characters.get(state.id))!.version).toBe(base);

    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 7 }, content(), engine());
    await phone.service.dispatch(state.id, { type: 'DamageCharacter', amount: 4 }, content(), engine());

    await desktop.sync(WORKSPACE);
    await phone.sync.sync(WORKSPACE);

    /*
      El teléfono sube la MISMA versión que ya está en el servidor, así que la
      concurrencia optimista lo rechaza. Lo que importa no es que gane uno u
      otro: es que el que pierde se entere. Un "listo" con el cambio tirado a
      la basura es el peor resultado posible de una sincronización.
    */
    expect(await phone.conflicts.count()).toBe(1);
    const pending = (await phone.conflicts.pending())[0]!;
    // 44 − 1 (lo que ya estaba) − 4 (lo suyo). Su cambio sigue entero en su
    // lado, esperando a que alguien decida.
    expect(pending.localState.hitPoints.current).toBe(39);
  });

  it('resolver el conflicto a favor del teléfono llega a la computadora', async () => {
    const state = await seedCharacter();
    const server = new FakeServer();
    const phone = await newDevice(server, 'phone');

    const desktop = new SyncEngine(server, outbox, characters, new MemoryCursor(), conflicts);
    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 1 }, content(), engine());
    await desktop.sync(WORKSPACE);
    await phone.sync.sync(WORKSPACE);

    await service.dispatch(state.id, { type: 'UpdateIdentity', patch: { name: 'Nombre de escritorio' } }, content(), engine());
    await phone.service.dispatch(state.id, { type: 'UpdateIdentity', patch: { name: 'Nombre del teléfono' } }, content(), engine());

    await desktop.sync(WORKSPACE);
    await phone.sync.sync(WORKSPACE);
    expect(await phone.conflicts.count()).toBe(1);

    // La persona mira los dos y se queda con el del teléfono.
    await phone.service.resolveConflict(state.id, 'local', content(), engine(), () =>
      phone.sync.adoptServerVersion(WORKSPACE, state.id as string),
    );
    await phone.sync.sync(WORKSPACE);

    await desktop.sync(WORKSPACE);
    expect((await characters.get(state.id))?.name).toBe('Nombre del teléfono');
    expect((await phone.characters.get(state.id))?.name).toBe('Nombre del teléfono');
    expect(await phone.conflicts.count()).toBe(0);
  });

  it('un tercer dispositivo que llega tarde recibe el estado final, no la historia', async () => {
    const state = await seedCharacter();
    const server = new FakeServer();

    await service.dispatch(state.id, { type: 'DamageCharacter', amount: 7 }, content(), engine());
    const desktop = new SyncEngine(server, outbox, characters, new MemoryCursor(), conflicts);
    await desktop.sync(WORKSPACE);
    await service.dispatch(state.id, { type: 'HealCharacter', amount: 2 }, content(), engine());
    await desktop.sync(WORKSPACE);

    // Una tableta que se estrena hoy. Su cursor arranca en cero, así que el
    // log le ofrece las dos entradas — pero las dos apuntan al MISMO estado
    // actual. Aplicar la primera y luego la segunda no puede dejarla en 37.
    const tablet = await newDevice(server, 'tablet');
    await tablet.sync.sync(WORKSPACE);

    expect((await tablet.characters.get(state.id))?.hitPoints.current).toBe(39);
  });
});
