import type { Cents } from '../types';

/**
 * Split `total` cents across `weights` so that the parts sum to exactly
 * `total`, always, with no rounding drift.
 *
 * Uses the largest-remainder (Hamilton) method: everyone gets the floor of
 * their exact share, then the leftover cents go one each to the largest
 * fractional remainders. Ties break toward the lowest index, so the same bill
 * always produces the same split — a total that reshuffles between renders
 * would be worse than one that is slightly unfair.
 *
 * The canonical case: 1400 cents over three equal weights yields
 * [467, 467, 466], which sums to 1400. Naive rounding gives 4.67 three times
 * and loses a cent on every line of the bill.
 *
 * @param total   Amount to distribute. May be negative; the sign is preserved.
 * @param weights Non-negative integers. All-zero (or empty) yields all zeros.
 */
export function allocate(total: Cents, weights: number[]): Cents[] {
  if (!Number.isInteger(total)) {
    throw new Error(`allocate: total must be an integer number of cents, got ${total}`);
  }
  if (weights.some((w) => !Number.isInteger(w) || w < 0)) {
    throw new Error('allocate: weights must be non-negative integers');
  }

  const result = new Array<number>(weights.length).fill(0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0 || weights.length === 0) return result;

  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);

  // Remainders are kept as integer numerators over totalWeight, so the
  // comparison below is exact rather than a float ordering.
  const remainderNumerators = new Array<number>(weights.length).fill(0);
  let distributed = 0;

  for (let i = 0; i < weights.length; i++) {
    const exact = abs * weights[i];
    const base = Math.floor(exact / totalWeight);
    result[i] = base;
    remainderNumerators[i] = exact - base * totalWeight;
    distributed += base;
  }

  let leftover = abs - distributed;
  const order = result
    .map((_, i) => i)
    .sort((a, b) => remainderNumerators[b] - remainderNumerators[a] || a - b);

  for (let k = 0; k < order.length && leftover > 0; k++) {
    result[order[k]] += 1;
    leftover -= 1;
  }

  return sign === -1 ? result.map((c) => -c) : result;
}
