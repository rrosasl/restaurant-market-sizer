import type { Bill, Currency, Extra, Item, Person } from '../types';
import type { Lang } from '../strings';

/**
 * localStorage is the whole persistence story: each device has its own bill
 * history, its own roster of friends and its own settings, and no account
 * exists anywhere. Everything read back from storage is validated, because a
 * half-written or hand-edited key must degrade to "no data" rather than
 * crash the app on launch.
 */

const KEYS = {
  current: 'rs.bill.current',
  history: 'rs.history',
  roster: 'rs.roster',
  settings: 'rs.settings',
} as const;

const HISTORY_LIMIT = 20;
const ROSTER_LIMIT = 40;

export interface Settings {
  lang: Lang;
  accessCode: string;
}

const DEFAULT_SETTINGS: Settings = { lang: 'es', accessCode: '' };

function read<T>(key: string, fallback: T, validate: (raw: unknown) => T | null): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    const valid = validate(parsed);
    return valid === null ? fallback : valid;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or a full quota. Losing persistence is survivable;
    // the in-memory bill keeps working for the rest of the session.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore, same reasoning as write().
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const asCents = (v: unknown): number | null =>
  typeof v === 'number' && Number.isSafeInteger(v) ? v : null;

function validatePerson(raw: unknown): Person | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const shares = typeof raw.shares === 'number' && raw.shares > 0 ? Math.floor(raw.shares) : 1;
  return { id: raw.id, name: raw.name, shares };
}

function validateItem(raw: unknown): Item | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const lineTotal = asCents(raw.lineTotal);
  if (lineTotal === null) return null;
  const quantity =
    typeof raw.quantity === 'number' && raw.quantity >= 1 ? Math.floor(raw.quantity) : 1;
  return {
    id: raw.id,
    name: raw.name,
    quantity,
    unitPrice: asCents(raw.unitPrice),
    lineTotal,
  };
}

const EXTRA_KINDS = new Set(['tax', 'tip', 'service', 'cover']);

function validateExtra(raw: unknown): Extra | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string') return null;
  if (typeof raw.kind !== 'string' || !EXTRA_KINDS.has(raw.kind)) return null;
  const amount = asCents(raw.amount);
  if (amount === null) return null;
  return {
    id: raw.id,
    kind: raw.kind as Extra['kind'],
    amount,
    split: raw.split === 'perHead' ? 'perHead' : 'prorated',
    onReceipt: raw.onReceipt !== false,
  };
}

export function validateBill(raw: unknown): Bill | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string') return null;

  const people = Array.isArray(raw.people)
    ? raw.people.map(validatePerson).filter((p): p is Person => p !== null)
    : [];
  const items = Array.isArray(raw.items)
    ? raw.items.map(validateItem).filter((i): i is Item => i !== null)
    : [];
  const extras = Array.isArray(raw.extras)
    ? raw.extras.map(validateExtra).filter((e): e is Extra => e !== null)
    : [];

  // Drop assignment rows and cells that point at people or items which no
  // longer exist, so a stale weight can never resurrect a deleted person.
  const personIds = new Set(people.map((p) => p.id));
  const itemIds = new Set(items.map((i) => i.id));
  const assignments: Bill['assignments'] = {};
  if (isRecord(raw.assignments)) {
    for (const [itemId, row] of Object.entries(raw.assignments)) {
      if (!itemIds.has(itemId) || !isRecord(row)) continue;
      const clean: Record<string, number> = {};
      for (const [personId, weight] of Object.entries(row)) {
        if (personIds.has(personId) && typeof weight === 'number' && weight > 0) {
          clean[personId] = Math.floor(weight);
        }
      }
      if (Object.keys(clean).length > 0) assignments[itemId] = clean;
    }
  }

  return {
    id: raw.id,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    merchant: typeof raw.merchant === 'string' ? raw.merchant : null,
    date: typeof raw.date === 'string' ? raw.date : null,
    currency: raw.currency === 'CHF' ? 'CHF' : 'EUR',
    people,
    items,
    extras,
    assignments,
    statedTotal: asCents(raw.statedTotal),
    source: raw.source === 'photo' ? 'photo' : 'manual',
  };
}

export function loadCurrentBill(): Bill | null {
  return read<Bill | null>(KEYS.current, null, validateBill);
}

export function saveCurrentBill(bill: Bill | null): void {
  if (bill === null) remove(KEYS.current);
  else write(KEYS.current, bill);
}

export function loadHistory(): Bill[] {
  return read<Bill[]>(KEYS.history, [], (raw) =>
    Array.isArray(raw) ? raw.map(validateBill).filter((b): b is Bill => b !== null) : null,
  );
}

/**
 * Push a bill into history, replacing any earlier save of the same bill so
 * that editing an old bill updates its entry instead of duplicating it.
 */
export function saveToHistory(bill: Bill): Bill[] {
  const rest = loadHistory().filter((b) => b.id !== bill.id);
  const next = [bill, ...rest].slice(0, HISTORY_LIMIT);
  write(KEYS.history, next);
  return next;
}

export function deleteFromHistory(billId: string): Bill[] {
  const next = loadHistory().filter((b) => b.id !== billId);
  write(KEYS.history, next);
  return next;
}

export function loadRoster(): string[] {
  return read<string[]>(KEYS.roster, [], (raw) =>
    Array.isArray(raw) ? raw.filter((n): n is string => typeof n === 'string') : null,
  );
}

/**
 * Remember the names used on a bill, most recent first. The same friends
 * recur, so these come back as one-tap suggestions on the next bill.
 */
export function rememberNames(names: string[]): string[] {
  const existing = loadRoster();
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const name of [...names, ...existing]) {
    const trimmed = name.trim();
    if (trimmed === '') continue;
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(trimmed);
  }
  const next = merged.slice(0, ROSTER_LIMIT);
  write(KEYS.roster, next);
  return next;
}

export function clearRoster(): void {
  remove(KEYS.roster);
}

export function loadSettings(): Settings {
  return read<Settings>(KEYS.settings, DEFAULT_SETTINGS, (raw) => {
    if (!isRecord(raw)) return null;
    return {
      lang: raw.lang === 'en' ? 'en' : 'es',
      accessCode: typeof raw.accessCode === 'string' ? raw.accessCode : '',
    };
  });
}

export function saveSettings(settings: Settings): void {
  write(KEYS.settings, settings);
}

export function newBill(currency: Currency = 'EUR', source: Bill['source'] = 'manual'): Bill {
  return {
    id: `bill_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
    createdAt: Date.now(),
    merchant: null,
    date: null,
    currency,
    people: [],
    items: [],
    extras: [],
    assignments: {},
    statedTotal: null,
    source,
  };
}
