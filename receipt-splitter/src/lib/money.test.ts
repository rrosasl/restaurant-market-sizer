import { describe, expect, it } from 'vitest';
import { centsToInput, formatAmount, formatAmountPlain, parseAmount } from './money';

describe('parseAmount', () => {
  it('parses plain decimal input in both separator conventions', () => {
    expect(parseAmount('14.00')).toBe(1400);
    expect(parseAmount('14,00')).toBe(1400);
    expect(parseAmount('14')).toBe(1400);
    expect(parseAmount('0,50')).toBe(50);
    expect(parseAmount(',50')).toBe(50);
  });

  it('strips currency symbols and whitespace', () => {
    expect(parseAmount('€14,00')).toBe(1400);
    expect(parseAmount('14,00 €')).toBe(1400);
    expect(parseAmount('CHF 14.00')).toBe(1400);
    expect(parseAmount('  14,00  ')).toBe(1400);
  });

  it('resolves mixed separators by taking the last one as the decimal', () => {
    expect(parseAmount('1.234,56')).toBe(123456);
    expect(parseAmount('1,234.56')).toBe(123456);
    expect(parseAmount("1'234.56")).toBe(123456);
    expect(parseAmount("1'234,56")).toBe(123456);
  });

  it('treats a lone separator with exactly three trailing digits as thousands', () => {
    // Genuinely ambiguous — "1.234" is 1234 euros in Italy — so it follows
    // the usual convention rather than inventing a third decimal.
    expect(parseAmount('1.234')).toBe(123400);
    expect(parseAmount('1,234')).toBe(123400);
    expect(parseAmount('1.234.567')).toBe(123456700);
  });

  it('rounds extra decimals half-up', () => {
    expect(parseAmount('14,0050')).toBe(1401);
    expect(parseAmount('14,0049')).toBe(1400);
    expect(parseAmount('1.234,005')).toBe(123401);
  });

  it('handles one-digit fractions', () => {
    expect(parseAmount('14,5')).toBe(1450);
  });

  it('parses JSON numbers from the receipt parser as major units', () => {
    expect(parseAmount(14)).toBe(1400);
    expect(parseAmount(14.5)).toBe(1450);
    expect(parseAmount(0.05)).toBe(5);
    // 8.29 * 100 is 828.9999... in floating point; rounding must save it.
    expect(parseAmount(8.29)).toBe(829);
    expect(parseAmount(1.005)).toBe(101);
  });

  it('returns null for empty or digitless input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('   ')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('€')).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount(Number.NaN)).toBeNull();
  });

  it('parses negatives, including accounting parentheses', () => {
    expect(parseAmount('-14,00')).toBe(-1400);
    expect(parseAmount('(14,00)')).toBe(-1400);
  });
});

describe('formatAmount', () => {
  it('formats EUR for both locales', () => {
    // Non-breaking spaces vary by ICU build, so compare on digits only.
    expect(formatAmount(1400, 'EUR', 'es').replace(/\s/g, '')).toBe('14,00€');
    expect(formatAmount(466, 'EUR', 'en')).toContain('4.66');
  });

  it('always shows two fraction digits', () => {
    expect(formatAmount(1400, 'EUR', 'es')).toMatch(/14,00/);
    expect(formatAmount(5, 'EUR', 'es')).toMatch(/0,05/);
  });
});

describe('formatAmountPlain', () => {
  it('formats for chat export', () => {
    expect(formatAmountPlain(1400, 'EUR')).toBe('14,00 €');
    expect(formatAmountPlain(466, 'EUR')).toBe('4,66 €');
    expect(formatAmountPlain(5, 'EUR')).toBe('0,05 €');
    expect(formatAmountPlain(1400, 'CHF')).toBe('CHF 14,00');
    expect(formatAmountPlain(-250, 'EUR')).toBe('-2,50 €');
  });
});

describe('centsToInput', () => {
  it('round-trips through parseAmount', () => {
    for (const cents of [0, 5, 99, 100, 1400, 123456]) {
      expect(parseAmount(centsToInput(cents))).toBe(cents);
    }
  });

  it('renders null as an empty field', () => {
    expect(centsToInput(null)).toBe('');
  });
});
