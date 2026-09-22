import type { CharacterId, ClientOpId, DefinitionId, InventoryItemId } from '@domain/shared/ids';
import type { Denomination } from '@domain/currency/currency';
import type { EquipmentSlot } from '@domain/character/state';
import type { AbilityImprovement, HitPointMethod, LevelUpRevert } from '@domain/character/progression';

/**
 * COMANDOS (MASTER PROMPT §56)
 *
 * Toda mutacion del personaje es un comando. De aqui salen, gratis:
 * historial, Deshacer, sincronizacion, auditoria y depuracion.
 *
 * REGLA CLAVE: las mutaciones de juego se modelan como DELTAS CONMUTATIVOS,
 * no como asignaciones. `DamageCharacter{-7}` converge entre dispositivos;
 * `SetHitPoints{23}` genera conflicto. Es la decision que hace viable el
 * offline multi-dispositivo sin CRDTs.
 */

export type CommandEnvelope<T extends Command = Command> = {
  /** Idempotencia: el servidor deduplica por esta clave. Un reintento no repite el efecto. */
  readonly clientOpId: ClientOpId;
  readonly characterId: CharacterId;
  readonly command: T;
  readonly issuedAt: string;
  /** Version del personaje sobre la que se emitio, para concurrencia optimista. */
  readonly baseVersion: number;
};

export type Command =
  // ── Puntos de golpe (deltas) ───────────────────────────────────────────────
  | { readonly type: 'DamageCharacter'; readonly amount: number; readonly damageType?: string; readonly sourceLabel?: string }
  | { readonly type: 'HealCharacter'; readonly amount: number; readonly sourceLabel?: string }
  | { readonly type: 'AddTemporaryHitPoints'; readonly amount: number; readonly sourceLabel?: string }
  | { readonly type: 'SetHitPoints'; readonly value: number }
  | { readonly type: 'RecordDeathSave'; readonly roll: number }
  | { readonly type: 'ResetDeathSaves' }
  | { readonly type: 'SetHeroicInspiration'; readonly has: boolean }

  // ── Recursos y conjuros (deltas) ───────────────────────────────────────────
  | { readonly type: 'SpendResource'; readonly key: string; readonly amount: number }
  | { readonly type: 'RestoreResource'; readonly key: string; readonly amount: number }
  | { readonly type: 'CastSpell'; readonly definitionId: DefinitionId; readonly slotLevel: number }
  | { readonly type: 'RestoreSpellSlot'; readonly slotLevel: number }
  | { readonly type: 'PrepareSpell'; readonly definitionId: DefinitionId; readonly prepared: boolean }
  | { readonly type: 'LearnSpell'; readonly definitionId: DefinitionId; readonly sourceClassId?: DefinitionId }
  | { readonly type: 'ForgetSpell'; readonly definitionId: DefinitionId }
  | { readonly type: 'ToggleSpellFavorite'; readonly definitionId: DefinitionId }
  | { readonly type: 'BreakConcentration' }
  | { readonly type: 'TakeRest'; readonly kind: 'short' | 'long'; readonly hitDiceSpent?: number; readonly hitPointsRecovered?: number }

  // ── Inventario ─────────────────────────────────────────────────────────────
  | { readonly type: 'AddInventoryItem'; readonly definitionId: DefinitionId; readonly quantity: number }
  | { readonly type: 'RemoveInventoryItem'; readonly itemId: InventoryItemId; readonly quantity?: number }
  | { readonly type: 'ConsumeItem'; readonly itemId: InventoryItemId; readonly amount: number }
  | { readonly type: 'ConsumeAmmunition'; readonly ammunitionType: DefinitionId; readonly amount: number }
  | { readonly type: 'EquipItem'; readonly itemId: InventoryItemId; readonly slot: EquipmentSlot }
  | { readonly type: 'UnequipItem'; readonly itemId: InventoryItemId }
  | { readonly type: 'AttuneItem'; readonly itemId: InventoryItemId }
  | { readonly type: 'UnattuneItem'; readonly itemId: InventoryItemId }
  | { readonly type: 'ToggleItemFavorite'; readonly itemId: InventoryItemId }
  | { readonly type: 'RenameItem'; readonly itemId: InventoryItemId; readonly customName: string }
  | { readonly type: 'UseCharges'; readonly itemId: InventoryItemId; readonly amount: number; readonly maximum: number }

  // ── Dinero (deltas) ────────────────────────────────────────────────────────
  | { readonly type: 'AddCurrency'; readonly delta: Partial<Record<Denomination, number>>; readonly reason?: string }
  | { readonly type: 'RemoveCurrency'; readonly delta: Partial<Record<Denomination, number>>; readonly reason?: string }
  | { readonly type: 'ConvertCurrency'; readonly from: Denomination; readonly to: Denomination; readonly amount: number }
  | { readonly type: 'ConsolidateCurrency' }

  // ── Condiciones ────────────────────────────────────────────────────────────
  | { readonly type: 'ApplyCondition'; readonly definitionId: DefinitionId; readonly level?: number; readonly sourceLabel?: string; readonly roundsRemaining?: number }
  | { readonly type: 'RemoveCondition'; readonly instanceId: string }
  | { readonly type: 'SetConditionLevel'; readonly instanceId: string; readonly level: number }

  // ── Progresion ─────────────────────────────────────────────────────────────
  | {
      readonly type: 'ApplyLevelUp';
      readonly classId: DefinitionId;
      readonly hitPointMethod: HitPointMethod;
      readonly hitPointValue?: number;
      readonly subclassId?: DefinitionId;
      readonly improvement?: AbilityImprovement;
      readonly cantrips?: readonly DefinitionId[];
      readonly spells?: readonly DefinitionId[];
    }
  /** Inverso exacto de ApplyLevelUp. Viaja por el mismo camino de sincronizacion. */
  | { readonly type: 'RevertLevelUp'; readonly revert: LevelUpRevert }
  | { readonly type: 'AwardExperience'; readonly amount: number; readonly reason?: string }
  | { readonly type: 'SetExperience'; readonly value: number }

  // ── Sincronizacion ─────────────────────────────────────────────────────────
  /**
   * Resolucion explicita de un conflicto.
   * Existe como comando para que quede en el historial y en la auditoria del
   * servidor: descartar el trabajo de un dispositivo nunca debe ser invisible.
   */
  | {
      readonly type: 'ResolveSyncConflict';
      readonly keep: 'local' | 'server';
      readonly serverVersion: number;
    }
  /** El personaje pasa del workspace local al de la cuenta recien creada. */
  | { readonly type: 'ClaimWorkspace'; readonly workspaceId: string }

  // ── Compatibilidad entre ediciones ─────────────────────────────────────────
  /**
   * El usuario forzo contenido de otra edicion. Forzar es legitimo; que no
   * quede registrado, no (MASTER SPEC §4).
   */
  | {
      readonly type: 'AcceptIncompatibleContent';
      readonly definitionId: DefinitionId;
      readonly declared: readonly string[];
    }
  | { readonly type: 'RevokeIncompatibleContent'; readonly definitionId: DefinitionId }

  // ── Personaje ──────────────────────────────────────────────────────────────
  | { readonly type: 'UpdateIdentity'; readonly patch: Record<string, unknown> }
  | { readonly type: 'SetSkillProficiency'; readonly skill: string; readonly level: string }
  | { readonly type: 'UpdateSettings'; readonly patch: Record<string, unknown> }
  | { readonly type: 'UpsertNote'; readonly note: Record<string, unknown> }
  | { readonly type: 'DeleteNote'; readonly noteId: string };

export type CommandType = Command['type'];

/**
 * Clasificacion para la resolucion de conflictos.
 *
 *   delta       — conmutativo, nunca genera conflicto
 *   assignment  — ultimo escritor gana, se registra la divergencia
 *   structural  — alta/baja de entidades, converge por id
 */
export type ConflictClass = 'delta' | 'assignment' | 'structural';

export const CONFLICT_CLASS: Record<CommandType, ConflictClass> = {
  DamageCharacter: 'delta',
  HealCharacter: 'delta',
  AddTemporaryHitPoints: 'assignment',
  SetHitPoints: 'assignment',
  RecordDeathSave: 'delta',
  ResetDeathSaves: 'assignment',
  SetHeroicInspiration: 'assignment',
  SpendResource: 'delta',
  RestoreResource: 'delta',
  CastSpell: 'delta',
  RestoreSpellSlot: 'delta',
  PrepareSpell: 'assignment',
  LearnSpell: 'structural',
  ForgetSpell: 'structural',
  ToggleSpellFavorite: 'assignment',
  BreakConcentration: 'assignment',
  TakeRest: 'assignment',
  AddInventoryItem: 'structural',
  RemoveInventoryItem: 'structural',
  ConsumeItem: 'delta',
  ConsumeAmmunition: 'delta',
  EquipItem: 'assignment',
  UnequipItem: 'assignment',
  AttuneItem: 'assignment',
  UnattuneItem: 'assignment',
  ToggleItemFavorite: 'assignment',
  RenameItem: 'assignment',
  UseCharges: 'delta',
  AddCurrency: 'delta',
  RemoveCurrency: 'delta',
  ConvertCurrency: 'delta',
  ConsolidateCurrency: 'assignment',
  ApplyCondition: 'structural',
  RemoveCondition: 'structural',
  SetConditionLevel: 'assignment',
  ApplyLevelUp: 'structural',
  RevertLevelUp: 'structural',
  AwardExperience: 'delta',
  SetExperience: 'assignment',
  ResolveSyncConflict: 'assignment',
  ClaimWorkspace: 'assignment',
  AcceptIncompatibleContent: 'structural',
  RevokeIncompatibleContent: 'structural',
  UpdateIdentity: 'assignment',
  SetSkillProficiency: 'assignment',
  UpdateSettings: 'assignment',
  UpsertNote: 'assignment',
  DeleteNote: 'structural',
};

/**
 * Resultado de ejecutar un comando.
 * `undo` existe solo si la accion se puede revertir con seguridad
 * (MASTER SPEC §54). Si no, es `undefined` y la UI no ofrece Deshacer.
 */
export type CommandResult = {
  readonly characterId: CharacterId;
  /** Descripcion breve de lo ocurrido, para el historial. Clave de traduccion. */
  readonly summaryKey: string;
  readonly summaryParams?: Record<string, string | number>;
  readonly undo?: Command;
};

export type HistoryEntry = {
  readonly id: string;
  readonly characterId: CharacterId;
  readonly clientOpId: ClientOpId;
  readonly command: Command;
  readonly result: CommandResult;
  readonly at: string;
  readonly undone: boolean;
};
