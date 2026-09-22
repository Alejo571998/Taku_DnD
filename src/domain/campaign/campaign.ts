import type { CampaignId, CharacterId, WorkspaceId } from '../shared/ids';
import type { Ruleset } from '../rules/ruleset';

/**
 * CAMPAÑAS (MASTER SPEC §30)
 *
 * Una campaña es lo que un jugador tiene en la cabeza y la aplicación no
 * sabía: "estos tres personajes son de la mesa de los martes; ese otro es de
 * la partida de mi hermano".
 *
 * Funciona SIN cuenta, en local. El modelo ya es multi-tenant y compartible,
 * así que compartirla más adelante es enlazar identidades, no rediseñar nada.
 *
 * Una campaña fija el RULESET. Es la regla que impide el error más caro de la
 * mesa: meter un personaje de 2024 en una partida de 2014 sin que nadie lo
 * note (MASTER SPEC §4).
 */

export type CampaignRole = 'OWNER' | 'DM' | 'PLAYER';

export type CampaignState = {
  readonly id: CampaignId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly description: string;
  readonly ruleset: Ruleset;
  /** Personajes de este workspace que juegan en la campaña. */
  readonly characterIds: readonly CharacterId[];
  readonly sessions: readonly SessionEntry[];
  readonly role: CampaignRole;
  readonly archivedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
};

/**
 * Una sesión jugada. Es la memoria de la mesa: quién estuvo, qué pasó y qué
 * quedó pendiente para la próxima.
 */
export type SessionEntry = {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly playedOn: string;
  readonly summary: string;
  readonly createdAt: string;
};

export type CampaignSummary = {
  readonly campaign: CampaignState;
  readonly characterCount: number;
  readonly sessionCount: number;
  readonly lastSession?: SessionEntry;
};

export function summarize(campaign: CampaignState): CampaignSummary {
  const sorted = [...campaign.sessions].sort((a, b) => b.number - a.number);
  const last = sorted[0];
  return {
    campaign,
    characterCount: campaign.characterIds.length,
    sessionCount: campaign.sessions.length,
    ...(last ? { lastSession: last } : {}),
  };
}

export const nextSessionNumber = (campaign: CampaignState): number =>
  campaign.sessions.reduce((max, s) => Math.max(max, s.number), 0) + 1;

/**
 * Compatibilidad de un personaje con la campaña.
 *
 * No bloquea: avisa. Forzar es decisión de la mesa, pero tiene que ser una
 * decisión y no un descuido.
 */
export type CampaignFit = 'fits' | 'differentRuleset';

export function checkFit(campaign: CampaignState, characterRuleset: Ruleset): CampaignFit {
  return campaign.ruleset === characterRuleset ? 'fits' : 'differentRuleset';
}
