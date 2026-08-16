import type { Cents, Currency } from '../types';

/**
 * Money lives as integer minor units everywhere in this app. These are the
 * only two functions allowed to cross between cents and human text, and they
 * sit at the very edge: `parseAmount` on input, `formatAmount` on render.
 */

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  CHF: 'CHF',
};

/**
 * Parse a human-typed or OCR'd amount into cents.
 *
 * Handles the separator conventions that show up on Italian, Spanish, German,
 * French and Swiss receipts: `14,00`, `14.00`, `1.234,56`, `1,234.56`,
 * `1'234.56`, with or without a currency symbol. Returns null when the input
 * has no digits at all, so callers can distinguish "empty" from "zero".
 */
export function parseAmount(input: string | number | null | undefined): Cents | null {
  if (input === null || input === undefined) return null;
  // A JSON number from the receipt parser is a major-unit decimal, e.g. 14.5.
  // Multiplying by 100 would inherit binary rounding error (1.005 * 100 is
  // 100.49999...), so it goes through a fixed-decimal string instead.
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    if (Math.abs(input) >= 1e15) return null;
    return parseAmount(input.toFixed(4));
  }

  const raw = input.trim();
  if (raw === '') return null;

  const negative = /^-|^\(.*\)$/.test(raw);
  // Keep digits and separators only; drop symbols, spaces, letters, minus.
  const cleaned = raw.replace(/[^\d.,']/g, '');
  if (!/\d/.test(cleaned)) return null;

  // Apostrophes are always thousands separators (Swiss style).
  const noApostrophes = cleaned.replace(/'/g, '');

  const lastComma = noApostrophes.lastIndexOf(',');
  const lastDot = noApostrophes.lastIndexOf('.');
  let decimalSepIndex = -1;

  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: whichever comes last is the decimal separator.
    decimalSepIndex = Math.max(lastComma, lastDot);
  } else if (lastComma >= 0 || lastDot >= 0) {
    const idx = Math.max(lastComma, lastDot);
    const trailingDigits = noApostrophes.length - idx - 1;
    const occurrences = noApostrophes.split(noApostrophes[idx]).length - 1;
    // One separator with exactly three digits after it is genuinely ambiguous
    // ("1.234" is 1234 in Italy and 1.23 rounded nowhere), so it follows the
    // usual convention and reads as a thousands separator. Any other trailing
    // length — 1, 2, or 4+ — can only be a decimal separator, since no
    // thousands group has that many digits. Repeated separators are thousands.
    if (occurrences === 1 && trailingDigits > 0 && trailingDigits !== 3) {
      decimalSepIndex = idx;
    }
  }

  let integerPart: string;
  let fractionPart: string;
  if (decimalSepIndex >= 0) {
    integerPart = noApostrophes.slice(0, decimalSepIndex).replace(/[.,]/g, '');
    fractionPart = noApostrophes.slice(decimalSepIndex + 1).replace(/[.,]/g, '');
  } else {
    integerPart = noApostrophes.replace(/[.,]/g, '');
    fractionPart = '';
  }

  if (integerPart === '' && fractionPart === '') return null;

  const units = integerPart === '' ? 0 : Number.parseInt(integerPart, 10);
  if (!Number.isFinite(units)) return null;

  // Build cents from digit strings so no float ever holds the value.
  let cents: number;
  if (fractionPart.length === 0) {
    cents = units * 100;
  } else if (fractionPart.length === 1) {
    cents = units * 100 + Number.parseInt(fractionPart[0], 10) * 10;
  } else {
    const twoDigits = Number.parseInt(fractionPart.slice(0, 2), 10);
    const nextDigit = fractionPart.length > 2 ? Number.parseInt(fractionPart[2], 10) : 0;
    cents = units * 100 + twoDigits + (nextDigit >= 5 ? 1 : 0);
  }

  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/** Format cents for display, e.g. `1450` in EUR/es -> `14,50 €`. */
export function formatAmount(cents: Cents, currency: Currency, lang: 'es' | 'en'): string {
  const locale = lang === 'es' ? 'es-ES' : 'en-IE';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Format for plain-text export (group chat paste). Deliberately not locale
 * aware beyond the decimal comma, so the output is compact and predictable.
 */
export function formatAmountPlain(cents: Cents, currency: Currency): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const units = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const symbol = CURRENCY_SYMBOLS[currency];
  const body = `${units},${frac}`;
  const withSymbol = currency === 'EUR' ? `${body} ${symbol}` : `${symbol} ${body}`;
  return negative ? `-${withSymbol}` : withSymbol;
}

/** Value for an `<input>` being edited, e.g. `1450` -> `14,50`. */
export function centsToInput(cents: Cents | null): string {
  if (cents === null) return '';
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const body = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
  return negative ? `-${body}` : body;
}
