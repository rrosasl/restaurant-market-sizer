import type { Bill, Currency, Extra, Item } from '../types';
import { newId } from './id';
import { parseAmount } from './money';
import { newBill } from './storage';
import { prepareImage, ImagePrepError, type PreparedImage } from './imageResize';

/**
 * The entire receipt-reading capability, behind one narrow interface.
 *
 * Everything about how parsing works — the endpoint, the access code header,
 * the wire format, the defensive validation — lives here. The rest of the app
 * knows only `parseReceipt(file, code)` and the failure reasons it can return,
 * so the UI never has to reason about HTTP.
 */

const ENDPOINT = '/api/parse-receipt';

/** Matches the server's cap. Checked here too so a doomed upload never starts. */
const MAX_BASE64_BYTES = 2 * 1024 * 1024;

/** Long enough for a slow connection, short enough to fail before the meal ends. */
const TIMEOUT_MS = 60_000;

export type ParseFailure =
  | 'no_code'
  | 'bad_code'
  | 'rate_limited'
  | 'too_large'
  | 'unreadable'
  | 'offline'
  | 'server'
  | 'unknown';

export type ParseResult =
  | { ok: true; bill: Bill; preview: PreparedImage }
  | { ok: false; reason: ParseFailure };

/**
 * Photograph -> a Bill ready for the review screen.
 *
 * Never throws and never returns a partial bill: either the receipt parsed
 * into something reviewable, or a reason the caller can explain to the user
 * while offering manual entry.
 */
export async function parseReceipt(file: File, accessCode: string): Promise<ParseResult> {
  if (accessCode.trim() === '') return { ok: false, reason: 'no_code' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, reason: 'offline' };
  }

  let image: PreparedImage;
  try {
    image = await prepareImage(file);
  } catch (error) {
    return { ok: false, reason: error instanceof ImagePrepError ? 'unreadable' : 'unknown' };
  }

  if (image.bytes > MAX_BASE64_BYTES) {
    URL.revokeObjectURL(image.previewUrl);
    return { ok: false, reason: 'too_large' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Code': accessCode.trim(),
      },
      body: JSON.stringify({ image: image.base64, mediaType: image.mediaType }),
      signal: controller.signal,
    });
  } catch {
    URL.revokeObjectURL(image.previewUrl);
    // An aborted or failed fetch is indistinguishable from a dead network here,
    // and both mean the same thing to the person holding the phone.
    return { ok: false, reason: 'offline' };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    URL.revokeObjectURL(image.previewUrl);
    return { ok: false, reason: failureForStatus(response.status, await readCode(response)) };
  }

  let raw: string;
  try {
    raw = await response.text();
  } catch {
    URL.revokeObjectURL(image.previewUrl);
    return { ok: false, reason: 'unreadable' };
  }

  const parsed = parseReceiptJson(raw);
  if (!parsed) {
    URL.revokeObjectURL(image.previewUrl);
    return { ok: false, reason: 'unreadable' };
  }

  return { ok: true, bill: toBill(parsed), preview: image };
}

async function readCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { code?: unknown };
    return typeof body.code === 'string' ? body.code : null;
  } catch {
    return null;
  }
}

function failureForStatus(status: number, code: string | null): ParseFailure {
  if (code === 'bad_code') return 'bad_code';
  if (code === 'rate_limited') return 'rate_limited';
  if (code === 'too_large') return 'too_large';
  if (code === 'unreadable') return 'unreadable';
  if (code === 'misconfigured') return 'server';

  switch (status) {
    case 401:
    case 403:
      return 'bad_code';
    case 413:
      return 'too_large';
    case 422:
      return 'unreadable';
    case 429:
      return 'rate_limited';
    // A 404 here means the endpoint isn't there at all — hosting deployed
    // without the function. That is the service being unavailable, not a
    // mystery, so say so rather than falling through to "something went wrong".
    case 404:
    case 405:
      return 'server';
    default:
      return status >= 500 ? 'server' : 'unknown';
  }
}

interface RawReceipt {
  merchant: string | null;
  date: string | null;
  currency: string | null;
  items: { name: string; quantity: number; unitPrice: number | null; lineTotal: number | null }[];
  tax: number | null;
  tip: number | null;
  serviceCharge: number | null;
  total: number | null;
}

/**
 * Parse and validate the model's response.
 *
 * The endpoint constrains the model to a JSON schema, so this should always be
 * clean JSON — but a parser that assumes its input is well-formed is one model
 * change away from crashing the app mid-dinner. Markdown fences get stripped
 * anyway, every field is checked, and anything unrecognisable becomes null
 * rather than an exception.
 */
export function parseReceiptJson(raw: string): RawReceipt | null {
  const text = stripFences(raw).trim();
  if (text === '') return null;

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;

  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items = rawItems
    .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
    .map((i) => ({
      name: typeof i.name === 'string' ? i.name : '',
      quantity:
        typeof i.quantity === 'number' && Number.isFinite(i.quantity) && i.quantity >= 1
          ? Math.floor(i.quantity)
          : 1,
      unitPrice: asNumber(i.unitPrice),
      lineTotal: asNumber(i.lineTotal),
    }));

  return {
    merchant: asString(obj.merchant),
    date: asString(obj.date),
    currency: asString(obj.currency),
    items,
    tax: asNumber(obj.tax),
    tip: asNumber(obj.tip),
    serviceCharge: asNumber(obj.serviceCharge),
    total: asNumber(obj.total),
  };
}

/**
 * Strip markdown code fences.
 *
 * Structured outputs make these impossible today, and they were still worth
 * handling: a fenced response is otherwise a total parse failure, and the cost
 * of tolerating it is three lines.
 */
function stripFences(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  return fenced ? fenced[1] : raw;
}

const asString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;

const asNumber = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** EUR unless the receipt clearly says otherwise; there is no conversion. */
function toCurrency(code: string | null): Currency {
  return code?.toUpperCase() === 'CHF' ? 'CHF' : 'EUR';
}

/** ISO dates only; anything else is dropped rather than guessed at. */
function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[0]}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : match[0];
}

/** Convert the validated response into a Bill, with every amount in cents. */
function toBill(raw: RawReceipt): Bill {
  const bill = newBill(toCurrency(raw.currency), 'photo');

  const items: Item[] = raw.items
    .map((item) => {
      const lineTotal = parseAmount(item.lineTotal);
      const unitPrice = parseAmount(item.unitPrice);
      // A line with no legible amount is still worth keeping: the name is the
      // hard part to retype, and the review screen exists to fill in the rest.
      const resolved =
        lineTotal ?? (unitPrice !== null ? unitPrice * item.quantity : null) ?? 0;
      return {
        id: newId('i'),
        name: item.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal: resolved,
      };
    })
    .filter((item) => item.name !== '' || item.lineTotal !== 0);

  const extras: Extra[] = [];
  const addExtra = (kind: Extra['kind'], amount: number | null, split: Extra['split']) => {
    const cents = parseAmount(amount);
    if (cents !== null && cents !== 0) {
      extras.push({ id: newId('e'), kind, amount: cents, split, onReceipt: true });
    }
  };
  addExtra('tax', raw.tax, 'prorated');
  addExtra('service', raw.serviceCharge, 'prorated');
  addExtra('tip', raw.tip, 'prorated');

  return {
    ...bill,
    merchant: raw.merchant,
    date: toIsoDate(raw.date),
    items,
    extras,
    statedTotal: parseAmount(raw.total),
  };
}
