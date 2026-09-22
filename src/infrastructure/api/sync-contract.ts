import { z } from 'zod';

/**
 * CONTRATO DEL API DE SINCRONIZACIÓN
 *
 * Validado con Zod en AMBOS extremos. El servidor no confía en el cliente
 * (MASTER PROMPT §79): todo lo que entra atraviesa este esquema antes de
 * tocar la base de datos.
 */

const uuid = z.string().uuid();

export const commandEnvelopeSchema = z.object({
  clientOpId: uuid,
  characterId: uuid,
  issuedAt: z.string().datetime(),
  baseVersion: z.number().int().min(0),
  command: z.object({ type: z.string().min(1) }).passthrough(),
});

export const pushRequestSchema = z.object({
  workspaceId: uuid,
  // Lotes acotados: un cliente que estuvo un mes sin conexión sube por tandas
  // en vez de intentar una petición de 40 MB que va a fallar entera.
  operations: z.array(commandEnvelopeSchema).min(1).max(200),
  /** Estado completo del personaje tras aplicar el lote, para converger. */
  snapshots: z
    .array(
      z.object({
        characterId: uuid,
        version: z.number().int().min(1),
        state: z.record(z.string(), z.unknown()),
      }),
    )
    .default([]),
});

export const operationOutcomeSchema = z.object({
  clientOpId: uuid,
  status: z.enum(['applied', 'duplicate', 'conflict', 'rejected']),
  reason: z.string().optional(),
  serverVersion: z.number().int().optional(),
});

export const pushResponseSchema = z.object({
  results: z.array(operationOutcomeSchema),
  cursor: z.number().int(),
});

export const pullRequestSchema = z.object({
  workspaceId: uuid,
  /** Secuencia del servidor, NO un timestamp. */
  cursor: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(500).default(100),
});

export const pullResponseSchema = z.object({
  changes: z.array(
    z.object({
      seq: z.number().int(),
      entityType: z.string(),
      entityId: uuid,
      operation: z.enum(['upsert', 'delete']),
      state: z.record(z.string(), z.unknown()).nullable(),
      version: z.number().int().nullable(),
    }),
  ),
  cursor: z.number().int(),
  hasMore: z.boolean(),
});

export type CommandEnvelopeDto = z.infer<typeof commandEnvelopeSchema>;
export type PushRequest = z.infer<typeof pushRequestSchema>;
export type PushResponse = z.infer<typeof pushResponseSchema>;
export type PullRequest = z.infer<typeof pullRequestSchema>;
export type PullResponse = z.infer<typeof pullResponseSchema>;
export type OperationOutcome = z.infer<typeof operationOutcomeSchema>;

/**
 * Errores del API en lenguaje humano.
 * La interfaz NUNCA muestra un código crudo (MASTER PROMPT §81).
 */
export const apiErrorSchema = z.object({
  error: z.enum([
    'unauthorized',
    'notConfigured',
    'invalidPayload',
    'workspaceForbidden',
    'serverError',
  ]),
  message: z.string(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const API_ERROR_MESSAGES: Record<ApiError['error'], string> = {
  unauthorized: 'Necesitás iniciar sesión para sincronizar.',
  notConfigured: 'La sincronización en la nube todavía no está configurada en este servidor.',
  invalidPayload: 'No pudimos leer los cambios que enviaste.',
  workspaceForbidden: 'No tenés acceso a ese espacio de trabajo.',
  serverError: 'Algo falló de nuestro lado. Tus cambios siguen guardados en tu dispositivo.',
};
