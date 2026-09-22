/**
 * Preparacion global de los tests.
 *
 * El dominio exige aleatoriedad criptografica. En Node 24
 * `globalThis.crypto` ya existe, pero lo verificamos explicitamente para que
 * un entorno sin ella falle con un mensaje claro en vez de a mitad de un test.
 */
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.getRandomValues) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
