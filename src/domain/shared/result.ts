/**
 * Result: errores como valores, no como excepciones.
 *
 * El dominio nunca lanza para casos esperados (no hay municion, el slot esta
 * ocupado, falta un recurso). Devuelve un fallo tipado que la UI convierte en
 * un mensaje util — nunca en "Error 500" (MASTER PROMPT §81).
 */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = DomainError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}
export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return !r.ok;
}

export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw new Error(`unwrap() sobre un Result fallido: ${JSON.stringify(r.error)}`);
}

export function mapResult<T, U, E>(r: Result<T, E>, fn: (v: T) => U): Result<U, E> {
  return r.ok ? ok(fn(r.value)) : r;
}

/**
 * Error de dominio.
 *
 * `code` es estable y sirve para traducir; `params` alimenta el mensaje.
 * La UI JAMAS muestra `code` crudo al usuario (MASTER SPEC §51).
 */
export type DomainError = {
  readonly code: DomainErrorCode;
  readonly params?: Readonly<Record<string, string | number>>;
  /** Pista tecnica para logs y debugging. No se muestra al usuario. */
  readonly detail?: string;
};

export type DomainErrorCode =
  // Recursos
  | 'resource.insufficient'
  | 'resource.notFound'
  | 'spellSlot.insufficient'
  | 'ammunition.depleted'
  // Inventario y equipo
  | 'item.notFound'
  | 'item.insufficientQuantity'
  | 'slot.incompatible'
  | 'slot.occupied'
  | 'slot.twoHandedConflict'
  | 'attunement.limitReached'
  | 'attunement.notAttunable'
  // Personaje
  | 'character.notFound'
  | 'ability.outOfRange'
  | 'pointBuy.insufficientPoints'
  | 'level.outOfRange'
  // Contenido
  | 'content.notFound'
  | 'content.incompatibleRuleset'
  | 'content.invalidShape'
  // Dados
  | 'dice.invalidExpression'
  // Generico
  | 'validation.failed';

export const domainError = (
  code: DomainErrorCode,
  params?: Record<string, string | number>,
  detail?: string,
): DomainError => ({ code, ...(params ? { params } : {}), ...(detail ? { detail } : {}) });

export const errCode = (
  code: DomainErrorCode,
  params?: Record<string, string | number>,
  detail?: string,
): Err<DomainError> => err(domainError(code, params, detail));
