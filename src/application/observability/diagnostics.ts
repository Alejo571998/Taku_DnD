/**
 * OBSERVABILIDAD (MASTER PROMPT §80)
 *
 * Sin telemetría remota. TAKU no manda nada a ningún lado: los diagnósticos se
 * guardan EN EL DISPOSITIVO y el usuario decide si los comparte.
 *
 * Eso no es una limitación, es la postura correcta para una aplicación que
 * guarda notas privadas de partida. Un informe de error que el usuario exporta
 * a mano sirve igual para arreglar el bug y no obliga a nadie a confiar en un
 * tercero.
 *
 * REGLA QUE NO SE NEGOCIA: acá nunca entra contenido del usuario. Ni nombres de
 * personaje, ni notas, ni correos. Solo qué falló y dónde.
 */

export type DiagnosticLevel = 'error' | 'warning' | 'info';

export type DiagnosticArea = 'sync' | 'content' | 'command' | 'render' | 'storage' | 'auth';

export type DiagnosticEvent = {
  readonly id: string;
  readonly at: string;
  readonly level: DiagnosticLevel;
  readonly area: DiagnosticArea;
  /** Código estable, no una frase. Sirve para agrupar. */
  readonly code: string;
  /** Detalle técnico. Nunca datos del usuario. */
  readonly detail?: string;
  readonly context?: Readonly<Record<string, string | number | boolean>>;
};

export interface DiagnosticsSink {
  record(event: DiagnosticEvent): Promise<void>;
  recent(limit?: number): Promise<DiagnosticEvent[]>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

/**
 * Cosas que parecen técnicas pero son del usuario.
 *
 * Un mensaje de error puede traer el nombre de un personaje dentro. Antes de
 * guardarlo se recorta y se limpia lo que se reconoce como identificador.
 */
const MAX_DETAIL = 400;

export function sanitizeDetail(detail: string): string {
  return detail
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\b(?:eyJ|sk-|Bearer\s+)[\w.\-]+/gi, '[token]')
    .slice(0, MAX_DETAIL);
}

export function diagnosticEvent(input: {
  level: DiagnosticLevel;
  area: DiagnosticArea;
  code: string;
  detail?: string;
  context?: Record<string, string | number | boolean>;
  id?: string;
  at?: string;
}): DiagnosticEvent {
  return {
    id: input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    at: input.at ?? new Date().toISOString(),
    level: input.level,
    area: input.area,
    code: input.code,
    ...(input.detail ? { detail: sanitizeDetail(input.detail) } : {}),
    ...(input.context ? { context: input.context } : {}),
  };
}

export function fromError(
  error: unknown,
  area: DiagnosticArea,
  code: string,
  context?: Record<string, string | number | boolean>,
): DiagnosticEvent {
  const detail =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : 'Error desconocido';

  return diagnosticEvent({ level: 'error', area, code, detail, ...(context ? { context } : {}) });
}

/** Resumen para la pantalla de diagnóstico. */
export type DiagnosticsSummary = {
  readonly total: number;
  readonly errors: number;
  readonly byArea: Readonly<Record<string, number>>;
  readonly since?: string;
};

export function summarizeDiagnostics(events: readonly DiagnosticEvent[]): DiagnosticsSummary {
  const byArea: Record<string, number> = {};
  let errors = 0;

  for (const event of events) {
    byArea[event.area] = (byArea[event.area] ?? 0) + 1;
    if (event.level === 'error') errors++;
  }

  const oldest = events.reduce<string | undefined>(
    (min, e) => (min === undefined || e.at < min ? e.at : min),
    undefined,
  );

  return { total: events.length, errors, byArea, ...(oldest ? { since: oldest } : {}) };
}

/**
 * Informe exportable.
 *
 * Es lo que el usuario adjunta al reportar un problema. Lleva la versión y el
 * entorno porque sin eso la mitad de los informes no sirven — y nada más.
 */
export function buildReport(
  events: readonly DiagnosticEvent[],
  environment: Record<string, string | number | boolean>,
): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      environment,
      summary: summarizeDiagnostics(events),
      events,
    },
    null,
    2,
  );
}
