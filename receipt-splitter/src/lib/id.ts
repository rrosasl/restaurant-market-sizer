/**
 * Short unique ids for people, items and extras.
 *
 * These only ever have to be unique within one bill on one device, so
 * `crypto.randomUUID` is more than enough — with a counter-based fallback for
 * the odd browser that exposes no crypto at all.
 */
let counter = 0;

export function newId(prefix = 'x'): string {
  counter += 1;
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return `${prefix}_${cryptoObj.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}
