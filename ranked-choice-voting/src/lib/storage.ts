/**
 * localStorage is not always usable, and the failure modes are hostile:
 * Safari private browsing can throw on write, some privacy settings throw on
 * *read* (which would crash the app during startup if left unguarded), and
 * in-app browsers (WhatsApp, Instagram) may hand out a storage jar that is
 * discarded when they close.
 *
 * Every access goes through here, so unavailable storage degrades to
 * "preferences last only for this session" instead of breaking the UI.
 */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable — in-memory state still applies for this session.
  }
}

export function readStoredJson<T>(key: string, fallback: T): T {
  const raw = readStored(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key: string, value: unknown): void {
  try {
    writeStored(key, JSON.stringify(value));
  } catch {
    // Value not serializable — nothing useful to persist.
  }
}
