import type { Assignments, Bill, Cents, Extra, Item, Person } from '../types';
import { allocate } from './allocate';

export interface ItemShare {
  itemId: string;
  weight: number;
  /** This person's share of the line, in cents. */
  amount: Cents;
}

export interface ExtraShare {
  extraId: string;
  amount: Cents;
}

export interface PersonTotal {
  personId: string;
  itemShares: ItemShare[];
  itemsSubtotal: Cents;
  extraShares: ExtraShare[];
  extrasSubtotal: Cents;
  total: Cents;
}

export interface BillTotals {
  perPerson: PersonTotal[];
  /** Sum of every line total on the bill, assigned or not. */
  itemsTotal: Cents;
  extrasTotal: Cents;
  /** Line totals with nobody on them. Must reach zero before totals are valid. */
  unassignedTotal: Cents;
  unassignedItemIds: string[];
  /** itemsTotal + extrasTotal. Equals sum(perPerson) + unassignedTotal. */
  grandTotal: Cents;
}

export function itemWeights(assignments: Assignments, itemId: string, people: Person[]): number[] {
  const row = assignments[itemId] ?? {};
  return people.map((p) => {
    const w = row[p.id];
    return Number.isInteger(w) && w > 0 ? w : 0;
  });
}

export function isAssigned(assignments: Assignments, itemId: string): boolean {
  const row = assignments[itemId];
  if (!row) return false;
  return Object.values(row).some((w) => Number.isInteger(w) && w > 0);
}

/**
 * Per-person totals for a bill.
 *
 * Three passes, each one an `allocate` call so the cent-exactness holds at
 * every level:
 *   1. each item's line total across the weights of the people on it;
 *   2. each prorated extra across everyone's item subtotal (so the person who
 *      ordered more pays more tax);
 *   3. each per-head extra across everyone's `shares` (cover charge is per
 *      seat, not per euro spent).
 *
 * Invariant, enforced by tests: sum of person totals plus the unassigned
 * remainder equals items plus extras, exactly, for any input.
 */
export function computeTotals(bill: Bill): BillTotals {
  const { people, items, extras, assignments } = bill;

  const itemShares = new Map<string, ItemShare[]>();
  people.forEach((p) => itemShares.set(p.id, []));

  let itemsTotal = 0;
  let unassignedTotal = 0;
  const unassignedItemIds: string[] = [];

  for (const item of items) {
    itemsTotal += item.lineTotal;
    const weights = itemWeights(assignments, item.id, people);
    const weightSum = weights.reduce((s, w) => s + w, 0);

    if (weightSum === 0) {
      unassignedTotal += item.lineTotal;
      unassignedItemIds.push(item.id);
      continue;
    }

    const parts = allocate(item.lineTotal, weights);
    people.forEach((p, i) => {
      if (weights[i] > 0) {
        itemShares.get(p.id)!.push({ itemId: item.id, weight: weights[i], amount: parts[i] });
      }
    });
  }

  const itemsSubtotals = people.map((p) =>
    itemShares.get(p.id)!.reduce((sum, s) => sum + s.amount, 0),
  );

  const extraShares = new Map<string, ExtraShare[]>();
  people.forEach((p) => extraShares.set(p.id, []));

  let extrasTotal = 0;
  for (const extra of extras) {
    if (extra.amount === 0) continue;
    extrasTotal += extra.amount;
    const weights = extraWeights(extra, people, itemsSubtotals);
    const parts = allocate(extra.amount, weights);
    people.forEach((p, i) => {
      if (parts[i] !== 0) {
        extraShares.get(p.id)!.push({ extraId: extra.id, amount: parts[i] });
      }
    });
  }

  const perPerson: PersonTotal[] = people.map((p, i) => {
    const shares = itemShares.get(p.id)!;
    const eShares = extraShares.get(p.id)!;
    const extrasSubtotal = eShares.reduce((sum, s) => sum + s.amount, 0);
    return {
      personId: p.id,
      itemShares: shares,
      itemsSubtotal: itemsSubtotals[i],
      extraShares: eShares,
      extrasSubtotal,
      total: itemsSubtotals[i] + extrasSubtotal,
    };
  });

  return {
    perPerson,
    itemsTotal,
    extrasTotal,
    unassignedTotal,
    unassignedItemIds,
    grandTotal: itemsTotal + extrasTotal,
  };
}

/**
 * Weights for spreading one extra.
 *
 * Prorated extras weight by item spend, but that collapses when nobody has
 * been assigned anything yet (or every item is free), so it falls back to
 * per-head rather than silently dropping the amount.
 */
function extraWeights(extra: Extra, people: Person[], itemsSubtotals: Cents[]): number[] {
  const headWeights = people.map((p) => (Number.isInteger(p.shares) && p.shares > 0 ? p.shares : 1));
  if (extra.split === 'perHead') return headWeights;

  const spendWeights = itemsSubtotals.map((c) => (c > 0 ? c : 0));
  const spendSum = spendWeights.reduce((s, w) => s + w, 0);
  return spendSum > 0 ? spendWeights : headWeights;
}

export interface Reconciliation {
  /** Sum of line totals. */
  itemsSum: Cents;
  /** Sum of extras that are printed on the receipt. */
  receiptExtrasSum: Cents;
  /** itemsSum + receiptExtrasSum — what the receipt should add up to. */
  computedTotal: Cents;
  statedTotal: Cents | null;
  /** computedTotal - statedTotal. Zero means the receipt reconciles. */
  delta: Cents;
  balanced: boolean;
}

/**
 * Compare the lines we hold against the total printed on the receipt.
 *
 * Only extras marked `onReceipt` count here. A tip added at the table is real
 * money that people owe, but it is not part of what the restaurant printed, so
 * including it would show a permanent phantom discrepancy.
 */
export function reconcile(bill: Bill): Reconciliation {
  const itemsSum = bill.items.reduce((sum, i) => sum + i.lineTotal, 0);
  const receiptExtrasSum = bill.extras
    .filter((e) => e.onReceipt)
    .reduce((sum, e) => sum + e.amount, 0);
  const computedTotal = itemsSum + receiptExtrasSum;
  const delta = bill.statedTotal === null ? 0 : computedTotal - bill.statedTotal;
  return {
    itemsSum,
    receiptExtrasSum,
    computedTotal,
    statedTotal: bill.statedTotal,
    delta,
    balanced: bill.statedTotal === null || delta === 0,
  };
}

/**
 * The "€X each" hint on an item card.
 *
 * With largest-remainder splitting, three people on a €14.00 line pay 4,67,
 * 4,67 and 4,66. The hint shows the largest of those: it is a real amount
 * somebody actually pays, and rounding the hint down would understate the
 * bill. Only meaningful when every weight is 1 — the assign screen shows
 * per-person amounts instead once weights diverge.
 */
export function equalShareHint(item: Item, weights: number[]): Cents {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum === 0) return 0;
  return Math.max(...allocate(item.lineTotal, weights).filter((_, i) => weights[i] > 0));
}
