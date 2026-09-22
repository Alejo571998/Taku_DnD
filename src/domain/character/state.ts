import type {
  CharacterId,
  ConditionInstanceId,
  DefinitionId,
  InventoryItemId,
  ResourceInstanceId,
  WorkspaceId,
} from '../shared/ids';
import type { Ruleset, CompatibilityOverride } from '../rules/ruleset';
import type { AbilityId, AbilityGenerationMethod, AbilityScores } from './ability';
import type { ProficiencyLevel, SkillId } from './skill';

/**
 * ESTADO DEL PERSONAJE — LA UNICA FUENTE
 *
 * Esto es lo unico que se guarda y se sincroniza. Todo lo derivado
 * (modificadores, CA, salvaciones, ataques) se RECALCULA con el motor.
 * Asi es IMPOSIBLE que un derivado se desincronice: no existe almacenado.
 */
export type CharacterState = {
  readonly id: CharacterId;
  readonly workspaceId: WorkspaceId;
  readonly ruleset: Ruleset;

  // Identidad
  readonly name: string;
  readonly playerName?: string;
  readonly alignment?: string;
  readonly experience: number;
  /**
   * Inspiración heroica (2024): se tiene o no se tiene, no se acumula.
   *
   * Opcional porque los personajes guardados antes de que existiera el campo
   * no lo traen, y `undefined` se lee igual que «no la tiene».
   */
  readonly heroicInspiration?: boolean;
  readonly avatarUrl?: string;

  // Origen
  readonly speciesId?: DefinitionId;
  readonly subspeciesId?: DefinitionId;
  readonly backgroundId?: DefinitionId;

  /**
   * MULTICLASE: es una COLECCION, nunca un campo unico.
   * Es lo que hace posible el multiclase sin rediseño (MASTER SPEC §28).
   */
  readonly classes: readonly CharacterClassEntry[];

  // Caracteristicas
  readonly abilityScores: AbilityScores;
  readonly abilityMethod: AbilityGenerationMethod;
  /** Mejoras aplicadas manualmente (ASI, dotes, objetos permanentes). */
  readonly abilityIncreases: readonly AbilityIncrease[];

  // Competencias elegidas por el jugador (las automaticas las da el motor)
  readonly skillProficiencies: Readonly<Partial<Record<SkillId, ProficiencyLevel>>>;
  readonly savingThrowProficiencies: readonly AbilityId[];
  readonly otherProficiencies: readonly string[];
  readonly languages: readonly string[];

  readonly featIds: readonly DefinitionId[];

  // Puntos de golpe — se guarda la FUENTE, no el maximo calculado
  readonly hitPoints: HitPointsState;

  readonly inventory: readonly InventoryItemState[];
  readonly currency: CurrencyState;
  readonly spells: SpellbookState;
  readonly resources: readonly ResourceState[];
  readonly conditions: readonly ConditionState[];

  // Personal
  readonly personality: PersonalityState;
  readonly appearance: AppearanceState;
  readonly backstory: string;
  readonly notes: readonly CharacterNote[];

  // Configuracion por personaje
  readonly settings: CharacterSettings;

  /** Contenido incompatible que el usuario forzo. Forzar es legitimo; ocultarlo no. */
  readonly compatibilityOverrides: readonly CompatibilityOverride[];

  readonly createdAt: string;
  readonly updatedAt: string;
  /** Version para concurrencia optimista en la sincronizacion. */
  readonly version: number;
};

export type CharacterClassEntry = {
  readonly classId: DefinitionId;
  readonly subclassId?: DefinitionId;
  readonly level: number;
  /** La clase con la que empezo: determina competencias iniciales completas. */
  readonly isPrimary: boolean;
  /** Dados de golpe gastados de esta clase (descanso corto). */
  readonly hitDiceSpent: number;
};

export type AbilityIncrease = {
  readonly ability: AbilityId;
  readonly amount: number;
  readonly sourceLabel: string;
  readonly sourceId?: DefinitionId;
};

/**
 * HP: se guardan las FUENTES.
 * El maximo se deriva (dado de golpe + CON + nivel), salvo override explicito
 * para mesas con reglas caseras.
 */
export type HitPointsState = {
  readonly current: number;
  readonly temporary: number;
  /** Modo de calculo del maximo. */
  readonly mode: 'fixed' | 'rolled' | 'manual';
  /** Tiradas concretas por nivel cuando mode === 'rolled'. */
  readonly rolls: readonly number[];
  /** Fuerza un maximo concreto cuando mode === 'manual'. */
  readonly maxOverride?: number;
  /** Bonificador plano al maximo (Enano de las colinas, Tosco). */
  readonly bonusPerLevel: number;
  readonly deathSaves: DeathSaves;
};

export type DeathSaves = {
  readonly successes: number;
  readonly failures: number;
};

export const emptyDeathSaves = (): DeathSaves => ({ successes: 0, failures: 0 });

export type EquipmentSlot =
  | 'mainHand' | 'offHand' | 'twoHand'
  | 'armor' | 'shield'
  | 'head' | 'cloak' | 'boots' | 'gloves' | 'belt'
  | 'amulet' | 'ring1' | 'ring2';

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'mainHand', 'offHand', 'twoHand', 'armor', 'shield',
  'head', 'cloak', 'boots', 'gloves', 'belt', 'amulet', 'ring1', 'ring2',
];

/**
 * INSTANCIA de inventario: referencia a la definicion, nunca una copia.
 * Aprender un conjuro o equipar un arma JAMAS modifica su definicion.
 */
export type InventoryItemState = {
  readonly id: InventoryItemId;
  readonly definitionId: DefinitionId;
  readonly quantity: number;
  readonly customName?: string;
  readonly notes?: string;
  readonly equippedSlot?: EquipmentSlot;
  readonly attuned: boolean;
  readonly favorite: boolean;
  /** Contenedor padre; ausente = mochila principal. */
  readonly containerId?: InventoryItemId;
  /** Cargas actuales de objetos magicos. */
  readonly charges?: number;
  /** Peso propio en centesimas de libra; ausente = el de la definicion. */
  readonly weightOverride?: number;
};

/**
 * DINERO: cinco contadores enteros independientes.
 * Nunca un total convertido (MASTER PROMPT §28).
 */
export type CurrencyState = {
  readonly gp: number;
  readonly pp: number;
  readonly ep: number;
  readonly sp: number;
  readonly cp: number;
};

export const emptyCurrency = (): CurrencyState => ({ gp: 0, pp: 0, ep: 0, sp: 0, cp: 0 });

export type SpellbookState = {
  readonly known: readonly CharacterSpellState[];
  /** Espacios gastados por nivel (indice 0 = nivel 1). */
  readonly slotsUsed: readonly number[];
  /** Espacios de Pacto del Brujo, que se recuperan con descanso corto. */
  readonly pactSlotsUsed: number;
  readonly concentratingOn?: DefinitionId;
};

export const emptySpellbook = (): SpellbookState => ({
  known: [],
  slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  pactSlotsUsed: 0,
});

export type CharacterSpellState = {
  readonly definitionId: DefinitionId;
  readonly prepared: boolean;
  readonly favorite: boolean;
  /** De donde viene: determina la caracteristica de lanzamiento. */
  readonly sourceClassId?: DefinitionId;
  /** Siempre preparado sin contar para el limite (dominio, juramento). */
  readonly alwaysPrepared: boolean;
};

export type ResourceRecovery = 'shortRest' | 'longRest' | 'dawn' | 'manual' | 'never';

export type ResourceState = {
  readonly id: ResourceInstanceId;
  readonly key: string;
  readonly label: string;
  readonly current: number;
  readonly maximum: number;
  readonly recovery: ResourceRecovery;
  readonly sourceLabel: string;
  readonly sourceId?: DefinitionId;
  /** Derivado de la progresion de clase: el motor lo recalcula al subir nivel. */
  readonly managed: boolean;
};

export type ConditionState = {
  readonly id: ConditionInstanceId;
  readonly definitionId: DefinitionId;
  /** Nivel de agotamiento (1-6); el resto de condiciones no lo usan. */
  readonly level?: number;
  readonly sourceLabel?: string;
  readonly notes?: string;
  readonly roundsRemaining?: number;
  readonly appliedAt: string;
};

export type PersonalityState = {
  readonly traits: readonly string[];
  readonly ideals: readonly string[];
  readonly bonds: readonly string[];
  readonly flaws: readonly string[];
};

export const emptyPersonality = (): PersonalityState => ({ traits: [], ideals: [], bonds: [], flaws: [] });

export type AppearanceState = {
  readonly age?: string;
  readonly height?: string;
  readonly weight?: string;
  readonly eyes?: string;
  readonly skin?: string;
  readonly hair?: string;
  readonly description?: string;
};

export type CharacterNote = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly category: 'general' | 'session' | 'quest' | 'relationship' | 'secret';
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CharacterSettings = {
  /** Consumo automatico de municion (MASTER PROMPT §25). */
  readonly autoConsumeAmmunition: boolean;
  /** Descontar el espacio al lanzar sin preguntar. */
  readonly autoConsumeSpellSlots: boolean;
  /** Tirar el daño junto al ataque en una sola accion. */
  readonly rollDamageWithAttack: boolean;
  /** Variante de carga: la velocidad baja antes del maximo. */
  readonly encumbranceVariant: boolean;
  readonly beginnerMode: boolean;
};

export const defaultSettings = (): CharacterSettings => ({
  autoConsumeAmmunition: true,
  autoConsumeSpellSlots: true,
  rollDamageWithAttack: false,
  encumbranceVariant: false,
  beginnerMode: true,
});

// ── Utilidades de lectura ────────────────────────────────────────────────────

export const totalLevel = (c: Pick<CharacterState, 'classes'>): number =>
  c.classes.reduce((sum, e) => sum + e.level, 0);

export const primaryClass = (c: Pick<CharacterState, 'classes'>): CharacterClassEntry | undefined =>
  c.classes.find((e) => e.isPrimary) ?? c.classes[0];

export const isMulticlass = (c: Pick<CharacterState, 'classes'>): boolean => c.classes.length > 1;

/**
 * Bonificador de competencia por nivel TOTAL de personaje.
 * En multiclase no se suman los bonificadores de cada clase: se usa el total.
 */
export const proficiencyBonusForLevel = (level: number): number =>
  Math.max(2, 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4));
