import type { Assignments, Bill, Cents, Currency, Extra, ExtraKind, Item } from '../types';
import { newId } from '../lib/id';

/**
 * Every mutation of the working bill goes through here. Keeping it in one
 * reducer means the assignment map can never drift out of step with the
 * people and items it references — removing a person also removes their
 * weights, in the same transition.
 */
export type BillAction =
  | { type: 'replace'; bill: Bill }
  | { type: 'setMerchant'; merchant: string }
  | { type: 'setDate'; date: string }
  | { type: 'setCurrency'; currency: Currency }
  | { type: 'setStatedTotal'; cents: Cents | null }
  | { type: 'addPerson'; name: string }
  | { type: 'renamePerson'; personId: string; name: string }
  | { type: 'setPersonShares'; personId: string; shares: number }
  | { type: 'removePerson'; personId: string }
  | { type: 'addItem'; item?: Partial<Item> }
  | { type: 'updateItem'; itemId: string; patch: Partial<Omit<Item, 'id'>> }
  | { type: 'removeItem'; itemId: string }
  | { type: 'setExtra'; kind: ExtraKind; amount: Cents | null; onReceipt?: boolean }
  | { type: 'setExtraSplit'; extraId: string; split: Extra['split'] }
  | { type: 'removeExtra'; extraId: string }
  | { type: 'toggleAssignment'; itemId: string; personId: string }
  | { type: 'setWeight'; itemId: string; personId: string; weight: number }
  | { type: 'assignEveryone'; itemId: string }
  | { type: 'clearItemAssignments'; itemId: string };

export function billReducer(bill: Bill, action: BillAction): Bill {
  switch (action.type) {
    case 'replace':
      return action.bill;

    case 'setMerchant':
      return { ...bill, merchant: action.merchant.trim() === '' ? null : action.merchant };

    case 'setDate':
      return { ...bill, date: action.date.trim() === '' ? null : action.date };

    case 'setCurrency':
      return { ...bill, currency: action.currency };

    case 'setStatedTotal':
      return { ...bill, statedTotal: action.cents };

    case 'addPerson': {
      const name = action.name.trim();
      if (name === '') return bill;
      // Names are the only handle people have on each other here, so a
      // duplicate would make the assign pills ambiguous.
      const exists = bill.people.some(
        (p) => p.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      );
      if (exists) return bill;
      return { ...bill, people: [...bill.people, { id: newId('p'), name, shares: 1 }] };
    }

    case 'renamePerson':
      return {
        ...bill,
        people: bill.people.map((p) =>
          p.id === action.personId ? { ...p, name: action.name } : p,
        ),
      };

    case 'setPersonShares': {
      const shares = Math.max(1, Math.floor(action.shares));
      return {
        ...bill,
        people: bill.people.map((p) => (p.id === action.personId ? { ...p, shares } : p)),
      };
    }

    case 'removePerson': {
      const people = bill.people.filter((p) => p.id !== action.personId);
      const assignments: Assignments = {};
      for (const [itemId, row] of Object.entries(bill.assignments)) {
        const { [action.personId]: _removed, ...rest } = row;
        if (Object.keys(rest).length > 0) assignments[itemId] = rest;
      }
      return { ...bill, people, assignments };
    }

    case 'addItem': {
      const item: Item = {
        id: newId('i'),
        name: '',
        quantity: 1,
        unitPrice: null,
        lineTotal: 0,
        ...action.item,
      };
      return { ...bill, items: [...bill.items, item] };
    }

    case 'updateItem':
      return {
        ...bill,
        items: bill.items.map((i) => (i.id === action.itemId ? { ...i, ...action.patch } : i)),
      };

    case 'removeItem': {
      const { [action.itemId]: _removed, ...assignments } = bill.assignments;
      return {
        ...bill,
        items: bill.items.filter((i) => i.id !== action.itemId),
        assignments,
      };
    }

    case 'setExtra': {
      const existing = bill.extras.find((e) => e.kind === action.kind);
      // A null or zero amount means the extra isn't on this bill at all;
      // carrying an empty line would clutter every breakdown.
      if (action.amount === null || action.amount === 0) {
        return { ...bill, extras: bill.extras.filter((e) => e.kind !== action.kind) };
      }
      const amount = action.amount;
      if (existing) {
        return {
          ...bill,
          extras: bill.extras.map((e) =>
            e.kind === action.kind
              ? { ...e, amount, onReceipt: action.onReceipt ?? e.onReceipt }
              : e,
          ),
        };
      }
      return {
        ...bill,
        extras: [
          ...bill.extras,
          {
            id: newId('e'),
            kind: action.kind,
            amount,
            split: defaultSplitFor(action.kind),
            onReceipt: action.onReceipt ?? true,
          },
        ],
      };
    }

    case 'setExtraSplit':
      return {
        ...bill,
        extras: bill.extras.map((e) =>
          e.id === action.extraId ? { ...e, split: action.split } : e,
        ),
      };

    case 'removeExtra':
      return { ...bill, extras: bill.extras.filter((e) => e.id !== action.extraId) };

    case 'toggleAssignment': {
      const row = { ...(bill.assignments[action.itemId] ?? {}) };
      if (row[action.personId] > 0) delete row[action.personId];
      else row[action.personId] = 1;
      return withRow(bill, action.itemId, row);
    }

    case 'setWeight': {
      const row = { ...(bill.assignments[action.itemId] ?? {}) };
      const weight = Math.floor(action.weight);
      if (weight <= 0) delete row[action.personId];
      else row[action.personId] = weight;
      return withRow(bill, action.itemId, row);
    }

    case 'assignEveryone': {
      const row: Record<string, number> = {};
      for (const p of bill.people) row[p.id] = 1;
      return withRow(bill, action.itemId, row);
    }

    case 'clearItemAssignments':
      return withRow(bill, action.itemId, {});
  }
}

/** Replace one item's assignment row, dropping it entirely when empty. */
function withRow(bill: Bill, itemId: string, row: Record<string, number>): Bill {
  const assignments = { ...bill.assignments };
  if (Object.keys(row).length === 0) delete assignments[itemId];
  else assignments[itemId] = row;
  return { ...bill, assignments };
}

/**
 * A cover charge (coperto) is a per-seat fee — it does not scale with what
 * you ordered, and prorating it would charge the person who had the steak
 * more for their chair. Tax, service and tip do scale, so they prorate.
 */
export function defaultSplitFor(kind: ExtraKind): Extra['split'] {
  return kind === 'cover' ? 'perHead' : 'prorated';
}
