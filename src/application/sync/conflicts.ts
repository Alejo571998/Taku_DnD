import type { CharacterState } from '@domain/character/state';

/**
 * CONFLICTOS DE SINCRONIZACIÓN (MASTER PROMPT §42)
 *
 * Un conflicto NO es un error: es que dos dispositivos cambiaron lo mismo
 * mientras estaban separados. Las mutaciones de juego son deltas conmutativos
 * y nunca llegan aquí; lo que llega son ASIGNACIONES —renombrar, equipar,
 * cambiar ajustes— donde "sumar las dos" no significa nada.
 *
 * La regla es que el sistema NUNCA elige por el usuario ni descarta trabajo en
 * silencio: guarda la versión local intacta y pregunta.
 */
export type SyncConflict = {
  /** Un conflicto pendiente por entidad: el último gana como representante. */
  readonly id: string;
  readonly characterId: string;
  readonly workspaceId: string;
  readonly characterName: string;
  readonly localVersion: number;
  readonly serverVersion: number;
  /**
   * Foto del estado local en el momento del choque.
   * Sin esto, el ciclo siguiente traería el del servidor y el trabajo del
   * usuario desaparecería sin dejar rastro.
   */
  readonly localState: CharacterState;
  readonly detectedAt: string;
  readonly reason: string;
  readonly status: 'pending' | 'resolved';
  readonly resolvedAs?: ConflictResolution;
};

export type ConflictResolution = 'local' | 'server';

export interface ConflictRepository {
  record(conflict: SyncConflict): Promise<void>;
  pending(): Promise<SyncConflict[]>;
  get(characterId: string): Promise<SyncConflict | undefined>;
  resolve(characterId: string, as: ConflictResolution): Promise<void>;
  count(): Promise<number>;
}

/** Diferencias legibles entre dos versiones, para que el usuario pueda elegir. */
export type ConflictField = {
  readonly label: string;
  readonly local: string;
  readonly server: string;
};

const describeClasses = (state: CharacterState): string =>
  state.classes.map((c) => `${c.classId.split(':').pop()} ${c.level}`).join(' · ') || '—';

/**
 * Compara solo lo que un jugador reconoce de un vistazo.
 * Un diff campo a campo del estado completo sería exacto e inútil.
 */
export function describeConflict(local: CharacterState, server: CharacterState): ConflictField[] {
  const fields: ConflictField[] = [];

  const add = (label: string, l: string, s: string) => {
    if (l !== s) fields.push({ label, local: l, server: s });
  };

  add('Nombre', local.name, server.name);
  add('Clases y nivel', describeClasses(local), describeClasses(server));
  add('Puntos de golpe', String(local.hitPoints.current), String(server.hitPoints.current));
  add('Objetos', `${local.inventory.length}`, `${server.inventory.length}`);
  add('Conjuros conocidos', `${local.spells.known.length}`, `${server.spells.known.length}`);
  add('Experiencia', local.experience.toLocaleString('es-419'), server.experience.toLocaleString('es-419'));
  add('Notas', `${local.notes.length}`, `${server.notes.length}`);

  const money = (s: CharacterState) => `${s.currency.gp} po · ${s.currency.sp} pp · ${s.currency.cp} pc`;
  add('Dinero', money(local), money(server));

  return fields;
}
