/**
 * Core domain types.
 *
 * Every monetary value in this app is an integer number of minor units
 * (cents / centimes). Floats never touch money. Parsing happens at the input
 * edge, formatting happens at render time, and nothing in between deals in
 * decimals.
 */

/** An integer amount in minor units. Never a float. */
export type Cents = number;

export type Currency = 'EUR' | 'CHF';

export interface Person {
  id: string;
  name: string;
  /**
   * How many heads this person counts as for per-head extras (cover charge).
   * Someone paying for a partner who isn't splitting separately counts as 2.
   * Defaults to 1. Does not affect item splits, which use item weights.
   */
  shares: number;
}

export interface Item {
  id: string;
  name: string;
  /** Integer unit count as printed. `3 X BIBITE` is quantity 3. */
  quantity: number;
  /** Price of one unit, when legible. Informational; lineTotal is what splits. */
  unitPrice: Cents | null;
  /** Authoritative amount for this line. This is the number that gets split. */
  lineTotal: Cents;
}

export type ExtraKind = 'tax' | 'tip' | 'service' | 'cover';

/**
 * How an extra is spread across people.
 * - `prorated`: by each person's share of the assigned item subtotal.
 * - `perHead`: equally per person, weighted by `Person.shares`.
 */
export type ExtraSplit = 'prorated' | 'perHead';

export interface Extra {
  id: string;
  kind: ExtraKind;
  amount: Cents;
  split: ExtraSplit;
  /**
   * True when the amount is printed on the receipt and therefore counts
   * toward reconciliation against the stated total. False for amounts added
   * at the table (a tip on top of the bill), which are shared by everyone but
   * must not make the receipt look unbalanced.
   */
  onReceipt: boolean;
}

/**
 * itemId -> personId -> integer weight.
 *
 * A missing or zero weight means the person is not on that item. Tapping a
 * pill sets weight 1, so an equal split is simply the all-ones case. Weights
 * above 1 express uneven shares of a multi-unit line: `3 X BIBITE €13.50`
 * taken two-to-one is `{ana: 2, luis: 1}`.
 */
export type Assignments = Record<string, Record<string, number>>;

export interface Bill {
  id: string;
  createdAt: number;
  merchant: string | null;
  /** Date as printed on the receipt, ISO `yyyy-mm-dd` when parseable. */
  date: string | null;
  currency: Currency;
  people: Person[];
  items: Item[];
  extras: Extra[];
  assignments: Assignments;
  /** Total as printed, kept verbatim so reconciliation can flag OCR errors. */
  statedTotal: Cents | null;
  source: 'manual' | 'photo';
}
