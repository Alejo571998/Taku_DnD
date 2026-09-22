import type { CharacterState } from '@domain/character/state';
import { newClientOpId, type WorkspaceId } from '@domain/shared/ids';
import type { CharacterRepository, OutboxRepository } from '../ports/repositories';

/**
 * ADOPCIÓN DEL TRABAJO LOCAL AL CREAR UNA CUENTA
 *
 * Quien jugó tres sesiones sin cuenta y luego se registra NO puede perder sus
 * personajes, ni encontrarse una aplicación vacía y otra copia escondida.
 *
 * El modelo es multi-tenant desde el primer día, así que esto es
 * cambiar un `workspaceId` — no una migración de datos. Ese fue exactamente el
 * motivo de hacerlo así antes de que hubiera cuentas.
 */

export type AdoptionReport = {
  readonly adopted: number;
  readonly skipped: number;
};

export async function adoptLocalWorkspace(
  localWorkspaceId: WorkspaceId,
  targetWorkspaceId: WorkspaceId,
  characters: CharacterRepository,
  outbox: OutboxRepository,
): Promise<AdoptionReport> {
  if (localWorkspaceId === targetWorkspaceId) return { adopted: 0, skipped: 0 };

  const locals = await characters.list(localWorkspaceId);
  let adopted = 0;

  for (const character of locals) {
    const moved: CharacterState = {
      ...character,
      workspaceId: targetWorkspaceId,
      updatedAt: new Date().toISOString(),
      version: character.version + 1,
    };
    await characters.save(moved);

    // Se encola para que la primera sincronización los suba. Sin esto los
    // personajes quedarían solo en este dispositivo y la cuenta no serviría
    // para lo único que el usuario quería de ella.
    await outbox.enqueue({
      clientOpId: newClientOpId(),
      characterId: character.id,
      command: { type: 'ClaimWorkspace', workspaceId: targetWorkspaceId as string },
      issuedAt: moved.updatedAt,
      baseVersion: character.version,
    });

    adopted++;
  }

  return { adopted, skipped: 0 };
}
