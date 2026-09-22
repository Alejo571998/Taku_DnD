import { ABILITIES, abilityModifier, type AbilityScores } from '@domain/character/ability';
import { resolveCharacter } from '@domain/character/engine';
import {
  applyLevelUp,
  planLevelUp,
  revertLevelUp,
  validateLevelUp,
  type LevelUpChoice,
} from '@domain/character/progression';
import {
  applyDamage,
  applyHealing,
  applyTemporaryHitPoints,
  recordDeathSave,
  setCurrentHitPoints,
} from '@domain/character/hitpoints';
import type { CharacterState, ConditionState } from '@domain/character/state';
import type { CharacterSheet } from '@domain/character/sheet';
import type { ContentIndex } from '@domain/content';
import {
  addCurrency,
  consolidate,
  convert,
  subtractCurrency,
} from '@domain/currency/currency';
import {
  addItem,
  attuneItem,
  consumeAmmunition,
  consumeItem,
  equipItem,
  removeItem,
  renameItem,
  toggleFavorite,
  unattuneItem,
  unequipItem,
  spendCharges,
} from '@domain/inventory/operations';
import { applyRest, restoreResource, spendResource } from '@domain/resources/operations';
import type { RulesEngine } from '@domain/rules/engine';
import type { Ruleset } from '@domain/rules/ruleset';
import { errCode, isErr, ok, type Result } from '@domain/shared/result';
import { newConditionInstanceId, type ConditionInstanceId } from '@domain/shared/ids';
import {
  breakConcentration,
  castSpell,
  forgetSpell,
  learnSpell,
  prepareSpell,
  restoreSlot,
  toggleSpellFavorite,
} from '@domain/spells/operations';
import type { Command, CommandResult } from './types';

/**
 * EJECUTOR DE COMANDOS
 *
 * Funcion pura: (estado, comando) → (estado nuevo, resultado con Deshacer).
 * No toca la base de datos ni la red — de eso se encarga quien la llama.
 *
 * Esto es lo que permite que el MISMO codigo valide en el servidor y aplique
 * en el cliente sin mantener dos implementaciones que se desvian.
 */
export type ExecutionOutput = {
  readonly state: CharacterState;
  readonly result: CommandResult;
};

export function executeCommand(
  state: CharacterState,
  command: Command,
  content: ContentIndex,
  engine: RulesEngine,
): Result<ExecutionOutput> {
  const sheet = () => resolveCharacter(state, content, engine);
  const touch = (patch: Partial<CharacterState>): CharacterState => ({
    ...state,
    ...patch,
    updatedAt: new Date().toISOString(),
    version: state.version + 1,
  });

  const done = (next: CharacterState, result: Omit<CommandResult, 'characterId'>): Result<ExecutionOutput> =>
    ok({ state: next, result: { characterId: state.id, ...result } });

  switch (command.type) {
    // ── Puntos de golpe ────────────────────────────────────────────────────
    case 'DamageCharacter': {
      const maxHp = sheet().hitPoints.max.value;
      const out = applyDamage(state.hitPoints, command.amount, maxHp);
      return done(touch({ hitPoints: out.hitPoints }), {
        summaryKey: 'history.damage',
        summaryParams: { amount: out.appliedToCurrent + out.absorbedByTemp },
        // Deshacer devuelve exactamente lo que se quito, incluidos los temporales.
        undo:
          out.absorbedByTemp > 0
            ? { type: 'SetHitPoints', value: state.hitPoints.current }
            : { type: 'HealCharacter', amount: out.appliedToCurrent },
      });
    }

    case 'HealCharacter': {
      const maxHp = sheet().hitPoints.max.value;
      const out = applyHealing(state.hitPoints, command.amount, maxHp);
      return done(touch({ hitPoints: out.hitPoints }), {
        summaryKey: 'history.heal',
        summaryParams: { amount: out.healed },
        undo: { type: 'DamageCharacter', amount: out.healed },
      });
    }

    case 'AddTemporaryHitPoints': {
      const previous = state.hitPoints.temporary;
      const out = applyTemporaryHitPoints(state.hitPoints, command.amount);
      return done(touch({ hitPoints: out.hitPoints }), {
        summaryKey: out.replaced ? 'history.tempHp.replaced' : 'history.tempHp.kept',
        summaryParams: { amount: out.kept },
        undo: { type: 'AddTemporaryHitPoints', amount: previous },
      });
    }

    case 'SetHitPoints': {
      const maxHp = sheet().hitPoints.max.value;
      const previous = state.hitPoints.current;
      return done(touch({ hitPoints: setCurrentHitPoints(state.hitPoints, command.value, maxHp) }), {
        summaryKey: 'history.setHp',
        summaryParams: { value: command.value },
        undo: { type: 'SetHitPoints', value: previous },
      });
    }

    case 'RecordDeathSave': {
      const out = recordDeathSave(state.hitPoints, command.roll);
      return done(touch({ hitPoints: out.hitPoints }), {
        summaryKey: `history.deathSave.${out.outcome}`,
        summaryParams: { roll: command.roll },
      });
    }

    case 'ResetDeathSaves':
      return done(
        touch({ hitPoints: { ...state.hitPoints, deathSaves: { successes: 0, failures: 0 } } }),
        { summaryKey: 'history.deathSaves.reset' },
      );

    /*
      La inspiración heroica se tiene o no: por eso `has` y no un delta. El
      deshacer devuelve el valor ANTERIOR y no el opuesto, que no es lo mismo
      cuando dos dispositivos la tocan en el mismo turno.
    */
    case 'SetHeroicInspiration': {
      const previous = state.heroicInspiration === true;
      if (previous === command.has) return done(state, { summaryKey: 'history.heroicInspiration.unchanged' });
      return done(touch({ heroicInspiration: command.has }), {
        summaryKey: command.has
          ? 'history.heroicInspiration.gained'
          : 'history.heroicInspiration.spent',
        undo: { type: 'SetHeroicInspiration', has: previous } as Command,
      });
    }

    // ── Recursos ───────────────────────────────────────────────────────────
    case 'SpendResource': {
      const current = sheet().resources;
      const next = spendResource(current, command.key, command.amount);
      if (isErr(next)) return next;
      return done(touch({ resources: next.value }), {
        summaryKey: 'history.resource.spend',
        summaryParams: { key: command.key, amount: command.amount },
        undo: { type: 'RestoreResource', key: command.key, amount: command.amount },
      });
    }

    case 'RestoreResource': {
      const current = sheet().resources;
      return done(touch({ resources: restoreResource(current, command.key, command.amount) }), {
        summaryKey: 'history.resource.restore',
        summaryParams: { key: command.key, amount: command.amount },
        undo: { type: 'SpendResource', key: command.key, amount: command.amount },
      });
    }

    case 'TakeRest': {
      const s = sheet();
      const rest = applyRest(s.resources, command.kind);
      const patch: { -readonly [K in keyof CharacterState]?: CharacterState[K] } = {
        resources: rest.resources,
      };

      if (command.kind === 'long') {
        // Descanso largo: PG al maximo, espacios al maximo, mitad de dados de golpe.
        patch.hitPoints = {
          ...state.hitPoints,
          current: s.hitPoints.max.value,
          temporary: 0,
          deathSaves: { successes: 0, failures: 0 },
        };
        patch.spells = { ...state.spells, slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0], pactSlotsUsed: 0 };
        patch.classes = state.classes.map((c) => ({
          ...c,
          hitDiceSpent: Math.max(0, c.hitDiceSpent - Math.max(1, Math.floor(s.level / 2))),
        }));
      } else {
        // Descanso corto: solo se recupera lo que la clase permite.
        patch.spells = { ...state.spells, pactSlotsUsed: 0 };
        if (command.hitDiceSpent && command.hitPointsRecovered) {
          const healed = applyHealing(state.hitPoints, command.hitPointsRecovered, s.hitPoints.max.value);
          patch.hitPoints = healed.hitPoints;
          let remaining = command.hitDiceSpent;
          patch.classes = state.classes.map((c) => {
            const available = c.level - c.hitDiceSpent;
            const use = Math.min(available, remaining);
            remaining -= use;
            return { ...c, hitDiceSpent: c.hitDiceSpent + use };
          });
        }
      }

      return done(touch(patch), {
        summaryKey: command.kind === 'long' ? 'history.rest.long' : 'history.rest.short',
        summaryParams: { recovered: rest.recovered.length },
      });
    }

    // ── Conjuros ───────────────────────────────────────────────────────────
    case 'CastSpell': {
      const s = sheet();
      const casting = s.spellcasting[0];
      if (!casting) return errCode('validation.failed', {}, 'el personaje no lanza conjuros');

      const out = castSpell(state.spells, content, command.definitionId, command.slotLevel, casting.slots);
      if (isErr(out)) return out;

      const spellName = content.spell(command.definitionId)?.name ?? 'Conjuro';
      return done(touch({ spells: out.value.spells }), {
        summaryKey: 'history.spell.cast',
        summaryParams: { spell: spellName, level: command.slotLevel },
        ...(out.value.consumedSlot
          ? { undo: { type: 'RestoreSpellSlot', slotLevel: command.slotLevel } as Command }
          : {}),
      });
    }

    case 'RestoreSpellSlot':
      return done(touch({ spells: restoreSlot(state.spells, command.slotLevel) }), {
        summaryKey: 'history.spell.restoreSlot',
        summaryParams: { level: command.slotLevel },
      });

    case 'PrepareSpell': {
      const casting = sheet().spellcasting[0];
      const out = prepareSpell(state.spells, command.definitionId, command.prepared, casting?.preparedLimit ?? null);
      if (isErr(out)) return out;
      return done(touch({ spells: out.value }), {
        summaryKey: command.prepared ? 'history.spell.prepared' : 'history.spell.unprepared',
        summaryParams: { spell: content.spell(command.definitionId)?.name ?? '' },
        undo: { type: 'PrepareSpell', definitionId: command.definitionId, prepared: !command.prepared },
      });
    }

    case 'LearnSpell':
      return done(
        touch({
          spells: learnSpell(state.spells, command.definitionId, {
            ...(command.sourceClassId ? { sourceClassId: command.sourceClassId } : {}),
          }),
        }),
        {
          summaryKey: 'history.spell.learned',
          summaryParams: { spell: content.spell(command.definitionId)?.name ?? '' },
          undo: { type: 'ForgetSpell', definitionId: command.definitionId },
        },
      );

    case 'ForgetSpell':
      return done(touch({ spells: forgetSpell(state.spells, command.definitionId) }), {
        summaryKey: 'history.spell.forgotten',
        summaryParams: { spell: content.spell(command.definitionId)?.name ?? '' },
      });

    case 'ToggleSpellFavorite':
      return done(touch({ spells: toggleSpellFavorite(state.spells, command.definitionId) }), {
        summaryKey: 'history.spell.favorite',
        undo: { type: 'ToggleSpellFavorite', definitionId: command.definitionId },
      });

    case 'BreakConcentration':
      return done(touch({ spells: breakConcentration(state.spells) }), {
        summaryKey: 'history.spell.concentrationBroken',
      });

    // ── Inventario ─────────────────────────────────────────────────────────
    case 'AddInventoryItem': {
      const inventory = addItem(state.inventory, command.definitionId, command.quantity, content);
      const added = inventory[inventory.length - 1];
      return done(touch({ inventory }), {
        summaryKey: 'history.item.added',
        summaryParams: { item: content.get(command.definitionId)?.name ?? '', quantity: command.quantity },
        ...(added ? { undo: { type: 'RemoveInventoryItem', itemId: added.id, quantity: command.quantity } as Command } : {}),
      });
    }

    case 'RemoveInventoryItem': {
      const item = state.inventory.find((i) => i.id === command.itemId);
      const out = removeItem(state.inventory, command.itemId, command.quantity);
      if (isErr(out)) return out;
      return done(touch({ inventory: out.value }), {
        summaryKey: 'history.item.removed',
        summaryParams: { item: content.get(item?.definitionId)?.name ?? '' },
        ...(item
          ? { undo: { type: 'AddInventoryItem', definitionId: item.definitionId, quantity: command.quantity ?? item.quantity } as Command }
          : {}),
      });
    }

    case 'ConsumeItem': {
      const item = state.inventory.find((i) => i.id === command.itemId);
      const out = consumeItem(state.inventory, command.itemId, command.amount);
      if (isErr(out)) return out;
      return done(touch({ inventory: out.value }), {
        summaryKey: 'history.item.consumed',
        summaryParams: { item: content.get(item?.definitionId)?.name ?? '', amount: command.amount },
        ...(item
          ? { undo: { type: 'AddInventoryItem', definitionId: item.definitionId, quantity: command.amount } as Command }
          : {}),
      });
    }

    case 'ConsumeAmmunition': {
      const out = consumeAmmunition(state.inventory, command.ammunitionType, command.amount);
      if (isErr(out)) return out;
      return done(touch({ inventory: out.value.inventory }), {
        summaryKey: 'history.ammunition.consumed',
        summaryParams: {
          item: content.get(command.ammunitionType)?.name ?? '',
          remaining: out.value.remaining,
        },
        undo: { type: 'AddInventoryItem', definitionId: command.ammunitionType, quantity: command.amount },
      });
    }

    case 'EquipItem': {
      const previous = state.inventory.find((i) => i.id === command.itemId)?.equippedSlot;
      const out = equipItem(state.inventory, command.itemId, command.slot, content);
      if (isErr(out)) return out;
      return done(touch({ inventory: out.value.inventory }), {
        summaryKey: 'history.item.equipped',
        summaryParams: { slot: command.slot },
        undo: previous
          ? { type: 'EquipItem', itemId: command.itemId, slot: previous }
          : { type: 'UnequipItem', itemId: command.itemId },
      });
    }

    case 'UnequipItem': {
      const previous = state.inventory.find((i) => i.id === command.itemId)?.equippedSlot;
      const out = unequipItem(state.inventory, command.itemId);
      if (isErr(out)) return out;
      return done(touch({ inventory: out.value }), {
        summaryKey: 'history.item.unequipped',
        ...(previous ? { undo: { type: 'EquipItem', itemId: command.itemId, slot: previous } as Command } : {}),
      });
    }

    case 'AttuneItem': {
      const out = attuneItem(state.inventory, command.itemId, content);
      if (isErr(out)) return out;
      return done(touch({ inventory: out.value }), {
        summaryKey: 'history.item.attuned',
        undo: { type: 'UnattuneItem', itemId: command.itemId },
      });
    }

    case 'UnattuneItem':
      return done(touch({ inventory: unattuneItem(state.inventory, command.itemId) }), {
        summaryKey: 'history.item.unattuned',
        undo: { type: 'AttuneItem', itemId: command.itemId },
      });

    case 'ToggleItemFavorite':
      return done(touch({ inventory: toggleFavorite(state.inventory, command.itemId) }), {
        summaryKey: 'history.item.favorite',
        undo: { type: 'ToggleItemFavorite', itemId: command.itemId },
      });

    case 'RenameItem': {
      const previous = state.inventory.find((i) => i.id === command.itemId)?.customName ?? '';
      return done(touch({ inventory: renameItem(state.inventory, command.itemId, command.customName) }), {
        summaryKey: 'history.item.renamed',
        summaryParams: { name: command.customName },
        undo: { type: 'RenameItem', itemId: command.itemId, customName: previous },
      });
    }

    case 'UseCharges': {
      const out = spendCharges(state.inventory, command.itemId, command.amount, command.maximum);
      if (isErr(out)) return out;
      return done(touch({ inventory: out.value }), {
        summaryKey: 'history.item.charges',
        summaryParams: { amount: command.amount },
      });
    }

    // ── Dinero ─────────────────────────────────────────────────────────────
    case 'AddCurrency':
      return done(touch({ currency: addCurrency(state.currency, command.delta) }), {
        summaryKey: 'history.currency.added',
        undo: { type: 'RemoveCurrency', delta: command.delta },
      });

    case 'RemoveCurrency': {
      const out = subtractCurrency(state.currency, command.delta);
      if (isErr(out)) return out;
      return done(touch({ currency: out.value }), {
        summaryKey: 'history.currency.removed',
        undo: { type: 'AddCurrency', delta: command.delta },
      });
    }

    case 'ConvertCurrency': {
      const out = convert(state.currency, command.from, command.to, command.amount);
      if (isErr(out)) return out;
      return done(touch({ currency: out.value.next }), {
        summaryKey: 'history.currency.converted',
        summaryParams: { from: command.from, to: command.to, received: out.value.received },
      });
    }

    case 'ConsolidateCurrency': {
      const previous = state.currency;
      return done(touch({ currency: consolidate(state.currency) }), {
        summaryKey: 'history.currency.consolidated',
        // Deshacer restaura las monedas exactas que habia antes.
        undo: {
          type: 'UpdateIdentity',
          patch: { currency: previous },
        },
      });
    }

    // ── Condiciones ────────────────────────────────────────────────────────
    case 'ApplyCondition': {
      const instance: ConditionState = {
        id: newConditionInstanceId(),
        definitionId: command.definitionId,
        appliedAt: new Date().toISOString(),
        ...(command.level != null ? { level: command.level } : {}),
        ...(command.sourceLabel ? { sourceLabel: command.sourceLabel } : {}),
        ...(command.roundsRemaining != null ? { roundsRemaining: command.roundsRemaining } : {}),
      };
      // Una misma condicion no se apila: se actualiza la existente.
      const existing = state.conditions.find((c) => c.definitionId === command.definitionId);
      const conditions = existing
        ? state.conditions.map((c) => (c.id === existing.id ? { ...c, ...instance, id: c.id } : c))
        : [...state.conditions, instance];

      return done(touch({ conditions }), {
        summaryKey: 'history.condition.applied',
        summaryParams: { condition: content.condition(command.definitionId)?.name ?? '' },
        ...(existing ? {} : { undo: { type: 'RemoveCondition', instanceId: instance.id as string } as Command }),
      });
    }

    case 'RemoveCondition': {
      const removed = state.conditions.find((c) => c.id === command.instanceId);
      return done(
        touch({ conditions: state.conditions.filter((c) => c.id !== command.instanceId) }),
        {
          summaryKey: 'history.condition.removed',
          summaryParams: { condition: content.condition(removed?.definitionId)?.name ?? '' },
          ...(removed
            ? {
                undo: {
                  type: 'ApplyCondition',
                  definitionId: removed.definitionId,
                  ...(removed.level != null ? { level: removed.level } : {}),
                } as Command,
              }
            : {}),
        },
      );
    }

    case 'SetConditionLevel': {
      const previous = state.conditions.find((c) => c.id === command.instanceId)?.level ?? 1;
      return done(
        touch({
          conditions: state.conditions.map((c) =>
            c.id === (command.instanceId as ConditionInstanceId) ? { ...c, level: command.level } : c,
          ),
        }),
        {
          summaryKey: 'history.condition.level',
          summaryParams: { level: command.level },
          undo: { type: 'SetConditionLevel', instanceId: command.instanceId, level: previous },
        },
      );
    }

    // ── Progresion ─────────────────────────────────────────────────────────
    case 'ApplyLevelUp': {
      const scores = effectiveScores(sheet());
      const planned = planLevelUp(state, command.classId, content, scores);
      if (isErr(planned)) return planned;
      const plan = planned.value;

      const choice: LevelUpChoice = {
        hitPointMethod: command.hitPointMethod,
        ...(command.hitPointValue !== undefined ? { hitPointValue: command.hitPointValue } : {}),
        ...(command.subclassId ? { subclassId: command.subclassId } : {}),
        ...(command.improvement ? { improvement: command.improvement } : {}),
        cantrips: command.cantrips ?? [],
        spells: command.spells ?? [],
      };

      // La validacion se repite AQUI aunque la interfaz ya la haya hecho: el
      // mismo ejecutor corre en el servidor, donde no hay interfaz que confiar.
      const issues = validateLevelUp(plan, choice, scores, content);
      if (issues.length > 0) {
        const first = issues[0]!;
        return errCode('validation.failed', first.params ?? {}, 'subida de nivel invalida: ' + first.code);
      }

      const applied = applyLevelUp(state, plan, choice, content);
      if (isErr(applied)) return applied;

      return done(touch(applied.value.patch), {
        summaryKey: 'history.levelUp',
        summaryParams: {
          className: plan.className,
          level: plan.toClassLevel,
          totalLevel: plan.toTotalLevel,
          hitPoints: applied.value.hitPointGain,
        },
        undo: { type: 'RevertLevelUp', revert: applied.value.revert },
      });
    }

    case 'RevertLevelUp': {
      const entry = state.classes.find((c) => c.classId === command.revert.classId);
      if (!entry) return errCode('validation.failed', {}, 'la clase ya no existe');
      return done(touch(revertLevelUp(state, command.revert)), {
        summaryKey: 'history.levelUp.reverted',
        summaryParams: { level: entry.level },
      });
    }

    case 'AwardExperience': {
      const next = Math.max(0, state.experience + command.amount);
      const applied = next - state.experience;
      return done(touch({ experience: next }), {
        summaryKey: command.amount >= 0 ? 'history.xp.gained' : 'history.xp.lost',
        summaryParams: { amount: Math.abs(applied), total: next },
        undo: { type: 'AwardExperience', amount: -applied },
      });
    }

    case 'SetExperience': {
      const previous = state.experience;
      return done(touch({ experience: Math.max(0, command.value) }), {
        summaryKey: 'history.xp.set',
        summaryParams: { value: command.value },
        undo: { type: 'SetExperience', value: previous },
      });
    }

    // ── Sincronizacion ─────────────────────────────────────────────────────
    case 'ResolveSyncConflict': {
      if (command.keep === 'server') {
        // El estado del servidor ya se adopto en la base local. El comando no
        // cambia nada: existe para dejar constancia de la decision.
        return done(state, { summaryKey: 'history.conflict.server' });
      }
      // Para que la version local gane hay que ponerla por ENCIMA de la del
      // servidor: si empatara, la concurrencia optimista la rechazaria otra vez.
      const version = Math.max(state.version, command.serverVersion) + 1;
      return done(
        { ...state, updatedAt: new Date().toISOString(), version },
        { summaryKey: 'history.conflict.local', summaryParams: { version } },
      );
    }

    case 'ClaimWorkspace': {
      const previous = state.workspaceId;
      return done(touch({ workspaceId: command.workspaceId as CharacterState['workspaceId'] }), {
        summaryKey: 'history.workspace.claimed',
        undo: { type: 'ClaimWorkspace', workspaceId: previous as string },
      });
    }

    // ── Compatibilidad entre ediciones ─────────────────────────────────────
    case 'AcceptIncompatibleContent': {
      const already = state.compatibilityOverrides.some((o) => o.definitionId === command.definitionId);
      if (already) return done(state, { summaryKey: 'history.compatibility.alreadyAccepted' });
      const name = content.get(command.definitionId)?.name ?? command.definitionId;
      return done(
        touch({
          compatibilityOverrides: [
            ...state.compatibilityOverrides,
            {
              definitionId: command.definitionId as string,
              acceptedAt: new Date().toISOString(),
              declared: command.declared as Ruleset[],
            },
          ],
        }),
        {
          summaryKey: 'history.compatibility.accepted',
          summaryParams: { name },
          undo: { type: 'RevokeIncompatibleContent', definitionId: command.definitionId },
        },
      );
    }

    case 'RevokeIncompatibleContent': {
      const removed = state.compatibilityOverrides.find((o) => o.definitionId === command.definitionId);
      if (!removed) return errCode('validation.failed', {}, 'ese contenido no estaba forzado');
      return done(
        touch({
          compatibilityOverrides: state.compatibilityOverrides.filter(
            (o) => o.definitionId !== command.definitionId,
          ),
        }),
        {
          summaryKey: 'history.compatibility.revoked',
          undo: {
            type: 'AcceptIncompatibleContent',
            definitionId: command.definitionId,
            declared: removed.declared,
          },
        },
      );
    }

    // ── Personaje ──────────────────────────────────────────────────────────
    case 'UpdateIdentity':
      return done(touch(command.patch as Partial<CharacterState>), { summaryKey: 'history.identity.updated' });

    case 'SetSkillProficiency': {
      const previous = state.skillProficiencies[command.skill as keyof typeof state.skillProficiencies] ?? 'none';
      return done(
        touch({
          skillProficiencies: { ...state.skillProficiencies, [command.skill]: command.level },
        } as Partial<CharacterState>),
        {
          summaryKey: 'history.skill.updated',
          summaryParams: { skill: command.skill, level: command.level },
          undo: { type: 'SetSkillProficiency', skill: command.skill, level: previous },
        },
      );
    }

    case 'UpdateSettings':
      return done(touch({ settings: { ...state.settings, ...command.patch } } as Partial<CharacterState>), {
        summaryKey: 'history.settings.updated',
      });

    case 'UpsertNote': {
      const note = command.note as CharacterState['notes'][number];
      const exists = state.notes.some((n) => n.id === note.id);
      return done(
        touch({ notes: exists ? state.notes.map((n) => (n.id === note.id ? note : n)) : [...state.notes, note] }),
        { summaryKey: 'history.note.saved' },
      );
    }

    case 'DeleteNote':
      return done(touch({ notes: state.notes.filter((n) => n.id !== command.noteId) }), {
        summaryKey: 'history.note.deleted',
      });

    default: {
      // Exhaustividad: añadir un comando sin manejarlo rompe la compilacion.
      const _never: never = command;
      void _never;
      return errCode('validation.failed', {}, 'comando desconocido');
    }
  }
}

/**
 * Caracteristicas EFECTIVAS de la ficha (base + especie + mejoras + objetos).
 * La subida de nivel valida el tope de 20 contra ESTAS: comprobarlo sobre las
 * puntuaciones base dejaria pasar mejoras que rompen el tope real.
 */
function effectiveScores(sheet: CharacterSheet): AbilityScores {
  const out = {} as { -readonly [K in keyof AbilityScores]: number };
  for (const id of ABILITIES) out[id] = sheet.abilities[id].score.value;
  return out;
}

/** Modificador de una caracteristica, expuesto para la capa de aplicacion. */
export { abilityModifier };
