import { describe, expect, it } from 'vitest';
import { allocate } from './allocate';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('allocate', () => {
  it('splits €14.00 three ways without losing or inventing a cent', () => {
    // The case this whole app exists to get right. 14.00/3 = 4.6666...;
    // rounding each to 4.67 sums to 14.01 and someone at the table notices.
    const parts = allocate(1400, [1, 1, 1]);
    expect(parts).toEqual([467, 467, 466]);
    expect(sum(parts)).toBe(1400);
  });

  it('splits evenly when the amount divides exactly', () => {
    expect(allocate(1500, [1, 1, 1])).toEqual([500, 500, 500]);
    expect(allocate(1000, [1, 1])).toEqual([500, 500]);
  });

  it('honours integer weights', () => {
    // 3 X BIBITE BOTTIGLIA €13.50 taken two bottles to one.
    const parts = allocate(1350, [2, 1]);
    expect(parts).toEqual([900, 450]);
    expect(sum(parts)).toBe(1350);
  });

  it('distributes remainders to the largest fractional shares first', () => {
    // 100 over weights 1,1,1,1,1,1,1 -> 14.28...; 100 - 7*14 = 2 cents spare,
    // and every remainder is equal, so the first two indices take them.
    const parts = allocate(100, [1, 1, 1, 1, 1, 1, 1]);
    expect(parts).toEqual([15, 15, 14, 14, 14, 14, 14]);
    expect(sum(parts)).toBe(100);
  });

  it('gives the spare cent to the larger weight when remainders differ', () => {
    // 1000 over [3, 2]: exact shares 600 and 400, no remainder.
    expect(allocate(1000, [3, 2])).toEqual([600, 400]);
    // 1001 over [3, 2]: 600.6 and 400.4 -> the .6 takes the cent.
    expect(allocate(1001, [3, 2])).toEqual([601, 400]);
  });

  it('is deterministic across calls for tied remainders', () => {
    const a = allocate(1400, [1, 1, 1]);
    const b = allocate(1400, [1, 1, 1]);
    expect(a).toEqual(b);
  });

  it('returns zeros when nobody is assigned', () => {
    expect(allocate(1400, [0, 0, 0])).toEqual([0, 0, 0]);
    expect(allocate(1400, [])).toEqual([]);
  });

  it('handles a single person taking the whole line', () => {
    expect(allocate(1799, [1])).toEqual([1799]);
    expect(allocate(1799, [0, 1, 0])).toEqual([0, 1799, 0]);
  });

  it('handles zero amounts', () => {
    expect(allocate(0, [1, 1, 1])).toEqual([0, 0, 0]);
  });

  it('preserves sign for negative amounts', () => {
    const parts = allocate(-1400, [1, 1, 1]);
    expect(parts).toEqual([-467, -467, -466]);
    expect(sum(parts)).toBe(-1400);
  });

  it('rejects non-integer amounts and weights', () => {
    expect(() => allocate(14.5, [1, 1])).toThrow(/integer/);
    expect(() => allocate(1400, [1.5, 1])).toThrow(/integer/);
    expect(() => allocate(1400, [-1, 2])).toThrow(/integer/);
  });

  it('sums exactly for every amount up to 500 cents across 2-8 equal ways', () => {
    for (let people = 2; people <= 8; people++) {
      const weights = new Array(people).fill(1);
      for (let cents = 0; cents <= 500; cents++) {
        expect(sum(allocate(cents, weights))).toBe(cents);
      }
    }
  });

  it('sums exactly for pseudo-random amounts and weights', () => {
    // Deterministic LCG so a failure is always reproducible.
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let trial = 0; trial < 3000; trial++) {
      const people = 1 + rand(9);
      const weights = Array.from({ length: people }, () => rand(4));
      const cents = rand(50000);
      const parts = allocate(cents, weights);
      const expected = weights.some((w) => w > 0) ? cents : 0;
      expect(sum(parts)).toBe(expected);
      // Nobody unassigned may receive money.
      parts.forEach((p, i) => {
        if (weights[i] === 0) expect(p).toBe(0);
      });
    }
  });

  it('never differs by more than one cent between equal weights', () => {
    const parts = allocate(9999, [1, 1, 1, 1, 1, 1, 1]);
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
    expect(sum(parts)).toBe(9999);
  });
});
