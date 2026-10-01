/**
 * Record identifiers.
 *
 * Time plus randomness is enough for local records and avoids pulling in a UUID
 * dependency. It is deliberately not a cryptographic identifier and must not be
 * used for anything that needs to resist guessing.
 */
export function newId(prefix: 'doc' | 'page'): string {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${time}${random}`;
}
