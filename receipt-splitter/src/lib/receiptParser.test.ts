import { describe, expect, it } from 'vitest';
import { parseReceiptJson } from './receiptParser';

const VALID = JSON.stringify({
  merchant: 'Trattoria da Enzo',
  date: '2026-08-14',
  currency: 'EUR',
  items: [
    { name: '2 X SPRITZ APEROL', quantity: 2, unitPrice: 7, lineTotal: 14 },
    { name: 'PIZZA MARGHERITA', quantity: 1, unitPrice: null, lineTotal: 8.5 },
  ],
  subtotal: 22.5,
  tax: 2.03,
  tip: null,
  serviceCharge: null,
  total: 24.53,
});

describe('parseReceiptJson', () => {
  it('parses a well-formed response', () => {
    const result = parseReceiptJson(VALID);
    expect(result).not.toBeNull();
    expect(result!.merchant).toBe('Trattoria da Enzo');
    expect(result!.items).toHaveLength(2);
    expect(result!.items[0]).toEqual({
      name: '2 X SPRITZ APEROL',
      quantity: 2,
      unitPrice: 7,
      lineTotal: 14,
    });
    expect(result!.total).toBe(24.53);
  });

  it('strips markdown fences even though the schema forbids them', () => {
    expect(parseReceiptJson('```json\n' + VALID + '\n```')!.merchant).toBe('Trattoria da Enzo');
    expect(parseReceiptJson('```\n' + VALID + '\n```')!.merchant).toBe('Trattoria da Enzo');
  });

  it('returns null rather than throwing on unparseable input', () => {
    expect(parseReceiptJson('')).toBeNull();
    expect(parseReceiptJson('   ')).toBeNull();
    expect(parseReceiptJson('Sorry, I could not read this receipt.')).toBeNull();
    expect(parseReceiptJson('{"merchant": ')).toBeNull();
    expect(parseReceiptJson('[1, 2, 3]')).toBeNull();
    expect(parseReceiptJson('null')).toBeNull();
    expect(parseReceiptJson('"a string"')).toBeNull();
  });

  it('survives a response missing every field', () => {
    const result = parseReceiptJson('{}');
    expect(result).toEqual({
      merchant: null,
      date: null,
      currency: null,
      items: [],
      tax: null,
      tip: null,
      serviceCharge: null,
      total: null,
    });
  });

  it('drops fields of the wrong type instead of trusting them', () => {
    const result = parseReceiptJson(
      JSON.stringify({
        merchant: 42,
        date: { year: 2026 },
        currency: [],
        items: 'not an array',
        tax: '2.03',
        total: Number.NaN,
      }),
    );
    expect(result!.merchant).toBeNull();
    expect(result!.date).toBeNull();
    expect(result!.currency).toBeNull();
    expect(result!.items).toEqual([]);
    expect(result!.tax).toBeNull();
    expect(result!.total).toBeNull();
  });

  it('discards junk entries inside the items array', () => {
    const result = parseReceiptJson(
      JSON.stringify({ items: [null, 'text', 42, { name: 'Vino', quantity: 1, lineTotal: 6 }] }),
    );
    expect(result!.items).toEqual([
      { name: 'Vino', quantity: 1, unitPrice: null, lineTotal: 6 },
    ]);
  });

  it('normalises implausible quantities to 1', () => {
    const result = parseReceiptJson(
      JSON.stringify({
        items: [
          { name: 'a', quantity: 0, lineTotal: 1 },
          { name: 'b', quantity: -3, lineTotal: 1 },
          { name: 'c', quantity: 2.7, lineTotal: 1 },
          { name: 'd', quantity: 'two', lineTotal: 1 },
        ],
      }),
    );
    expect(result!.items.map((i) => i.quantity)).toEqual([1, 1, 2, 1]);
  });

  it('trims whitespace and treats blank strings as absent', () => {
    const result = parseReceiptJson(
      JSON.stringify({ merchant: '  Bar Roma  ', date: '   ', currency: '' }),
    );
    expect(result!.merchant).toBe('Bar Roma');
    expect(result!.date).toBeNull();
    expect(result!.currency).toBeNull();
  });
});
