import { describe, expect, it } from 'vitest';
import type { Bill, Extra, Item, Person } from '../types';
import { computeTotals, equalShareHint, isAssigned, reconcile } from './totals';

const person = (id: string, shares = 1): Person => ({ id, name: id, shares });

const item = (id: string, lineTotal: number, quantity = 1): Item => ({
  id,
  name: id,
  quantity,
  unitPrice: quantity > 0 ? Math.round(lineTotal / quantity) : null,
  lineTotal,
});

const extra = (
  id: string,
  kind: Extra['kind'],
  amount: number,
  split: Extra['split'] = 'prorated',
  onReceipt = true,
): Extra => ({ id, kind, amount, split, onReceipt });

const bill = (over: Partial<Bill> = {}): Bill => ({
  id: 'b1',
  createdAt: 0,
  merchant: null,
  date: null,
  currency: 'EUR',
  people: [],
  items: [],
  extras: [],
  assignments: {},
  statedTotal: null,
  source: 'manual',
  ...over,
});

const sumTotals = (b: Bill) =>
  computeTotals(b).perPerson.reduce((s, p) => s + p.total, 0);

describe('computeTotals', () => {
  it('splits the €14.00 spritz line three ways and sums to the bill exactly', () => {
    const b = bill({
      people: [person('a'), person('b'), person('c')],
      items: [item('spritz', 1400, 2)],
      assignments: { spritz: { a: 1, b: 1, c: 1 } },
    });
    const t = computeTotals(b);
    expect(t.perPerson.map((p) => p.total)).toEqual([467, 467, 466]);
    expect(sumTotals(b)).toBe(1400);
    expect(t.unassignedTotal).toBe(0);
  });

  it('distributes remainders across several items without drift', () => {
    // Five lines that each leave a remainder over three people. Naive
    // per-person rounding would end up a few cents off the bill total.
    const items = [
      item('i1', 1000),
      item('i2', 1000),
      item('i3', 1000),
      item('i4', 1000),
      item('i5', 1000),
    ];
    const assignments = Object.fromEntries(
      items.map((i) => [i.id, { a: 1, b: 1, c: 1 }]),
    );
    const b = bill({ people: [person('a'), person('b'), person('c')], items, assignments });
    const t = computeTotals(b);
    // 10.00 over three is 3.34 / 3.33 / 3.33 per line, five times over.
    expect(t.perPerson.map((p) => p.total)).toEqual([1670, 1665, 1665]);
    expect(sumTotals(b)).toBe(5000);
  });

  it('applies integer weights for multi-quantity lines', () => {
    // 3 X BIBITE BOTTIGLIA €13.50, two bottles to Ana and one to Luis.
    const b = bill({
      people: [person('ana'), person('luis')],
      items: [item('bibite', 1350, 3)],
      assignments: { bibite: { ana: 2, luis: 1 } },
    });
    const t = computeTotals(b);
    expect(t.perPerson.map((p) => p.total)).toEqual([900, 450]);
    expect(sumTotals(b)).toBe(1350);
  });

  it('prorates tax and service by item spend, not equally', () => {
    const b = bill({
      people: [person('a'), person('b')],
      items: [item('steak', 3000), item('salad', 1000)],
      extras: [extra('tax', 'tax', 400)],
      assignments: { steak: { a: 1 }, salad: { b: 1 } },
    });
    const t = computeTotals(b);
    // 4.00 tax over a 30/10 spend split is 3.00 / 1.00, not 2.00 each.
    expect(t.perPerson[0].extrasSubtotal).toBe(300);
    expect(t.perPerson[1].extrasSubtotal).toBe(100);
    expect(t.perPerson.map((p) => p.total)).toEqual([3300, 1100]);
    expect(sumTotals(b)).toBe(4400);
  });

  it('splits cover charge per head, weighted by shares', () => {
    // Ana is paying for herself and a partner, so she covers two seats,
    // even though she ordered less than Luis.
    const b = bill({
      people: [person('ana', 2), person('luis', 1)],
      items: [item('pizza', 1000), item('pasta', 2000)],
      extras: [extra('coperto', 'cover', 750, 'perHead')],
      assignments: { pizza: { ana: 1 }, pasta: { luis: 1 } },
    });
    const t = computeTotals(b);
    expect(t.perPerson[0].extrasSubtotal).toBe(500);
    expect(t.perPerson[1].extrasSubtotal).toBe(250);
    expect(sumTotals(b)).toBe(3750);
  });

  it('keeps prorated extras exact when the split leaves remainders', () => {
    const b = bill({
      people: [person('a'), person('b'), person('c')],
      items: [item('shared', 1000)],
      extras: [extra('tip', 'tip', 101, 'prorated', false)],
      assignments: { shared: { a: 1, b: 1, c: 1 } },
    });
    const t = computeTotals(b);
    expect(t.perPerson.reduce((s, p) => s + p.extrasSubtotal, 0)).toBe(101);
    expect(sumTotals(b)).toBe(1101);
  });

  it('falls back to per-head for prorated extras when nothing is assigned yet', () => {
    const b = bill({
      people: [person('a'), person('b')],
      items: [item('pizza', 1000)],
      extras: [extra('tip', 'tip', 500)],
      assignments: {},
    });
    const t = computeTotals(b);
    expect(t.perPerson.map((p) => p.extrasSubtotal)).toEqual([250, 250]);
    expect(t.unassignedTotal).toBe(1000);
  });

  it('reports unassigned items instead of silently dropping them', () => {
    const b = bill({
      people: [person('a')],
      items: [item('pizza', 1000), item('orphan', 750)],
      assignments: { pizza: { a: 1 } },
    });
    const t = computeTotals(b);
    expect(t.unassignedTotal).toBe(750);
    expect(t.unassignedItemIds).toEqual(['orphan']);
    expect(sumTotals(b) + t.unassignedTotal).toBe(t.grandTotal);
  });

  it('ignores zero and negative weights', () => {
    const b = bill({
      people: [person('a'), person('b')],
      items: [item('pizza', 1000)],
      assignments: { pizza: { a: 1, b: 0 } },
    });
    const t = computeTotals(b);
    expect(t.perPerson.map((p) => p.total)).toEqual([1000, 0]);
  });

  it('handles a bill with no people at all', () => {
    const b = bill({ items: [item('pizza', 1000)] });
    const t = computeTotals(b);
    expect(t.perPerson).toEqual([]);
    expect(t.unassignedTotal).toBe(1000);
  });

  it('itemises each person so the breakdown is explainable at the table', () => {
    const b = bill({
      people: [person('a'), person('b')],
      items: [item('wine', 2400), item('coffee', 300)],
      extras: [extra('service', 'service', 200)],
      assignments: { wine: { a: 1, b: 1 }, coffee: { a: 1 } },
    });
    const t = computeTotals(b);
    expect(t.perPerson[0].itemShares).toEqual([
      { itemId: 'wine', weight: 1, amount: 1200 },
      { itemId: 'coffee', weight: 1, amount: 300 },
    ]);
    expect(t.perPerson[0].itemsSubtotal).toBe(1500);
    expect(t.perPerson[0].extraShares).toEqual([{ extraId: 'service', amount: 111 }]);
    expect(sumTotals(b)).toBe(2900);
  });

  it('holds the sum invariant across pseudo-random bills', () => {
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let trial = 0; trial < 1500; trial++) {
      const people = Array.from({ length: 1 + rand(6) }, (_, i) => person(`p${i}`, 1 + rand(3)));
      const items = Array.from({ length: 1 + rand(12) }, (_, i) => item(`i${i}`, rand(9000)));
      const extras: Extra[] = [];
      if (rand(2)) extras.push(extra('tax', 'tax', rand(2000)));
      if (rand(2)) extras.push(extra('cover', 'cover', rand(1000), 'perHead'));
      if (rand(2)) extras.push(extra('tip', 'tip', rand(3000), 'prorated', false));

      const assignments: Bill['assignments'] = {};
      for (const it of items) {
        const row: Record<string, number> = {};
        for (const p of people) {
          const w = rand(3);
          if (w > 0) row[p.id] = w;
        }
        if (Object.keys(row).length > 0) assignments[it.id] = row;
      }

      const b = bill({ people, items, extras, assignments });
      const t = computeTotals(b);
      const perPersonSum = t.perPerson.reduce((s, p) => s + p.total, 0);
      expect(perPersonSum + t.unassignedTotal).toBe(t.grandTotal);
      // No fractional cents anywhere.
      t.perPerson.forEach((p) => expect(Number.isInteger(p.total)).toBe(true));
    }
  });
});

describe('reconcile', () => {
  it('balances when lines plus receipt extras match the printed total', () => {
    const b = bill({
      items: [item('a', 1000), item('b', 500)],
      extras: [extra('cover', 'cover', 200, 'perHead')],
      statedTotal: 1700,
    });
    const r = reconcile(b);
    expect(r.computedTotal).toBe(1700);
    expect(r.delta).toBe(0);
    expect(r.balanced).toBe(true);
  });

  it('reports the delta to the cent when it does not match', () => {
    const b = bill({ items: [item('a', 1000)], statedTotal: 1050 });
    expect(reconcile(b).delta).toBe(-50);
  });

  it('excludes a tip added at the table from reconciliation', () => {
    // The tip is money people owe, but the restaurant never printed it, so
    // counting it would show a permanent phantom discrepancy.
    const b = bill({
      items: [item('a', 1000)],
      extras: [extra('tip', 'tip', 300, 'prorated', false)],
      statedTotal: 1000,
    });
    const r = reconcile(b);
    expect(r.balanced).toBe(true);
    expect(r.computedTotal).toBe(1000);
    // ...but it still reaches the people paying.
    expect(computeTotals({ ...b, people: [person('a')], assignments: { a: { a: 1 } } }).grandTotal).toBe(1300);
  });

  it('treats an unknown printed total as balanced', () => {
    expect(reconcile(bill({ items: [item('a', 1000)] })).balanced).toBe(true);
  });
});

describe('equalShareHint', () => {
  it('shows the larger side of an uneven cent split', () => {
    expect(equalShareHint(item('i', 1400), [1, 1, 1])).toBe(467);
    expect(equalShareHint(item('i', 1500), [1, 1, 1])).toBe(500);
  });

  it('is zero when nobody is on the item', () => {
    expect(equalShareHint(item('i', 1400), [0, 0])).toBe(0);
  });
});

describe('isAssigned', () => {
  it('detects empty, zeroed and populated rows', () => {
    expect(isAssigned({}, 'i')).toBe(false);
    expect(isAssigned({ i: {} }, 'i')).toBe(false);
    expect(isAssigned({ i: { a: 0 } }, 'i')).toBe(false);
    expect(isAssigned({ i: { a: 1 } }, 'i')).toBe(true);
  });
});
