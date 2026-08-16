import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronUp, Minus, Plus, Trash2, Users } from 'lucide-react';
import type { Bill, Item, Person } from '../types';
import { AppShell } from '../components/AppShell';
import { useUi } from '../state/uiContext';
import { allocate } from '../lib/allocate';
import { computeTotals, equalShareHint, itemWeights } from '../lib/totals';
import type { ScreenProps } from './types';

interface AssignScreenProps extends ScreenProps {
  onTotals: () => void;
}

/**
 * The screen this app exists for: one card per line, a pill per person,
 * tap to toggle. Everything is sized for one thumb, standing at a table,
 * after a couple of drinks.
 *
 * The running totals panel is visible at the same time as the items — sticky
 * sidebar on desktop, fixed panel on mobile — because the whole point is
 * watching your own number move as you tap.
 */
export function AssignScreen({ bill, dispatch, onBack, onSettings, onTotals }: AssignScreenProps) {
  const { t, fmt } = useUi();
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const firstUnassignedRef = useRef<HTMLDivElement | null>(null);

  const totals = useMemo(() => computeTotals(bill), [bill]);
  const unassignedIds = new Set(totals.unassignedItemIds);
  const blocked = unassignedIds.size > 0;
  const visibleItems = onlyUnassigned
    ? bill.items.filter((i) => unassignedIds.has(i.id))
    : bill.items;

  const totalsById = new Map(totals.perPerson.map((p) => [p.personId, p.total]));

  const showUnassigned = () => {
    setOnlyUnassigned(false);
    // Let the (possibly re-filtered) list paint before scrolling to it.
    requestAnimationFrame(() => {
      firstUnassignedRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  if (bill.people.length === 0 || bill.items.length === 0) {
    return (
      <AppShell
        title={t('assignTitle')}
        onBack={onBack}
        backLabel={t('back')}
        onSettings={onSettings}
        settingsLabel={t('settings')}
      >
        <p className="card px-4 py-8 text-center text-sm text-slate-500">
          {bill.people.length === 0 ? t('assignNeedPeople') : t('assignNeedItems')}
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t('assignTitle')}
      subtitle={t('assignSubtitle')}
      onBack={onBack}
      backLabel={t('back')}
      onSettings={onSettings}
      settingsLabel={t('settings')}
      footer={
        <div className="lg:hidden">
          <RunningTotals
            bill={bill}
            totalsById={totalsById}
            unassigned={totals.unassignedTotal}
            expanded={panelOpen}
            onToggle={() => setPanelOpen((v) => !v)}
          />
          <BlockedNotice
            blocked={blocked}
            count={unassignedIds.size}
            onShow={showUnassigned}
            onTotals={onTotals}
          />
        </div>
      }
    >
      <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-6">
        <div className="space-y-3">
          {blocked && (
            <button
              type="button"
              onClick={() => setOnlyUnassigned((v) => !v)}
              aria-pressed={onlyUnassigned}
              className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                onlyUnassigned
                  ? 'border-amber-400 bg-amber-100 text-amber-900'
                  : 'border-amber-300 bg-amber-50 text-amber-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <AlertTriangle size={16} aria-hidden />
                {t(unassignedIds.size === 1 ? 'blockedTitle' : 'blockedTitlePlural', {
                  count: unassignedIds.size,
                })}
              </span>
            </button>
          )}

          {visibleItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              people={bill.people}
              weights={itemWeights(bill.assignments, item.id, bill.people)}
              cardRef={
                item.id === totals.unassignedItemIds[0] ? firstUnassignedRef : undefined
              }
              onToggle={(personId) =>
                dispatch({ type: 'toggleAssignment', itemId: item.id, personId })
              }
              onWeight={(personId, weight) =>
                dispatch({ type: 'setWeight', itemId: item.id, personId, weight })
              }
              onEveryone={() => dispatch({ type: 'assignEveryone', itemId: item.id })}
              onClear={() => dispatch({ type: 'clearItemAssignments', itemId: item.id })}
              onDelete={() => dispatch({ type: 'removeItem', itemId: item.id })}
            />
          ))}
        </div>

        <aside className="sticky top-20 hidden lg:block">
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t('perPersonPanel')}
            </h2>
            <PersonList bill={bill} totalsById={totalsById} />
            <UnassignedLine amount={totals.unassignedTotal} />
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="mb-3 flex justify-between text-sm font-semibold">
                <span className="text-slate-500">{t('totalsBillTotal')}</span>
                <span className="tabular-nums">{fmt(totals.grandTotal)}</span>
              </div>
              <button
                type="button"
                className="btn-primary w-full"
                disabled={blocked}
                onClick={onTotals}
              >
                {t('totals')}
              </button>
              {blocked && (
                <p className="mt-2 text-xs text-amber-700">{t('blockedBody')}</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function ItemCard({
  item,
  people,
  weights,
  cardRef,
  onToggle,
  onWeight,
  onEveryone,
  onClear,
  onDelete,
}: {
  item: Item;
  people: Person[];
  weights: number[];
  cardRef?: React.RefObject<HTMLDivElement | null>;
  onToggle: (personId: string) => void;
  onWeight: (personId: string, weight: number) => void;
  onEveryone: () => void;
  onClear: () => void;
  onDelete: () => void;
}) {
  const { t, fmt } = useUi();

  const assignedCount = weights.filter((w) => w > 0).length;
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const nobody = assignedCount === 0;
  const everyone = assignedCount === people.length && people.length > 0;
  const shares = weightSum > 0 ? allocate(item.lineTotal, weights) : [];
  const uneven = weights.some((w) => w > 1);

  return (
    <div
      ref={cardRef}
      className={`rounded-2xl p-4 shadow-[var(--shadow-card)] transition-colors ${
        nobody ? 'border-2 border-amber-400 bg-amber-50' : 'border-2 border-transparent bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight text-slate-900">
            {item.quantity > 1 && (
              <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold tabular-nums text-slate-600">
                {item.quantity}×
              </span>
            )}
            {item.name || t('itemName')}
          </h3>
          {nobody && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-amber-800">
              <AlertTriangle size={15} aria-hidden />
              {t('assignNobody')}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className="font-bold tabular-nums text-slate-900">{fmt(item.lineTotal)}</div>
          {/*
            The live per-person hint. Only meaningful while everyone on the
            line has an equal share — once weights diverge, the pills carry
            their own amounts and a single "each" figure would be a lie.
          */}
          {!nobody && !uneven && (
            <div className="text-sm font-medium tabular-nums text-accent-600">
              {t('assignEach', { amount: fmt(equalShareHint(item, weights)) })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {people.map((person, i) => {
          const weight = weights[i];
          const assigned = weight > 0;
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => onToggle(person.id)}
              aria-pressed={assigned}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold transition active:scale-95 ${
                assigned
                  ? 'bg-accent-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <span>{person.name}</span>
              {assigned && uneven && (
                <span className="ml-1.5 tabular-nums opacity-80">
                  ×{weight} · {fmt(shares[i])}
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={everyone ? onClear : onEveryone}
          className={`min-h-11 rounded-full border-2 border-dashed px-4 text-sm font-semibold transition active:scale-95 ${
            everyone
              ? 'border-slate-300 text-slate-500 hover:bg-slate-50'
              : 'border-accent-200 text-accent-700 hover:bg-accent-50'
          }`}
        >
          <Users size={15} className="mr-1.5 inline" aria-hidden />
          {t(everyone ? 'assignClearEveryone' : 'assignEveryone')}
        </button>

        {/*
          The escape hatch for the blocked-totals state. A line nobody
          ordered is usually a misread duplicate row, and the fix is to
          delete it — without this, the amber warning would be a dead end
          that forces a trip back to the items screen.
        */}
        {nobody && (
          <button
            type="button"
            onClick={onDelete}
            className="min-h-11 rounded-full px-3 text-sm font-semibold text-amber-800 transition active:scale-95"
          >
            <Trash2 size={15} className="mr-1.5 inline" aria-hidden />
            {t('delete')}
          </button>
        )}
      </div>

      {/*
        Uneven shares of a multi-unit line: `3 X BIBITE €13.50` two bottles to
        one person and one to another. Only appears where a line actually has
        multiple units, so the common single-unit case stays a single tap.
      */}
      {item.quantity > 1 && assignedCount > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{t('assignUnitsOf', { assigned: weightSum, quantity: item.quantity })}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {people.map((person, i) =>
              weights[i] > 0 ? (
                <div key={person.id} className="flex items-center gap-1">
                  <span className="mr-1 text-sm text-slate-600">{person.name}</span>
                  <button
                    type="button"
                    aria-label={`${t('assignWeightDown')} ${person.name}`}
                    className="btn-ghost min-w-9 rounded-lg px-2"
                    onClick={() => onWeight(person.id, weights[i] - 1)}
                  >
                    <Minus size={15} aria-hidden />
                  </button>
                  <span className="min-w-5 text-center text-sm font-bold tabular-nums">
                    {weights[i]}
                  </span>
                  <button
                    type="button"
                    aria-label={`${t('assignWeightUp')} ${person.name}`}
                    className="btn-ghost min-w-9 rounded-lg px-2"
                    onClick={() => onWeight(person.id, weights[i] + 1)}
                  >
                    <Plus size={15} aria-hidden />
                  </button>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PersonList({
  bill,
  totalsById,
}: {
  bill: Bill;
  totalsById: Map<string, number>;
}) {
  const { fmt } = useUi();
  return (
    <ul className="space-y-1.5">
      {bill.people.map((person) => (
        <li key={person.id} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="truncate text-slate-600">{person.name}</span>
          <span className="shrink-0 font-bold tabular-nums text-slate-900">
            {fmt(totalsById.get(person.id) ?? 0)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The line that makes a dropped item impossible to miss. It is the loudest
 * thing on the panel while money is unallocated, and turns green the moment
 * everything is accounted for.
 */
function UnassignedLine({ amount }: { amount: number }) {
  const { t, fmt } = useUi();
  const clear = amount === 0;
  return (
    <div
      className={`mt-3 flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm font-semibold ${
        clear ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-100 text-amber-900'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {clear ? <Check size={16} aria-hidden /> : <AlertTriangle size={16} aria-hidden />}
        {clear ? t('allAssigned') : t('unassignedLabel')}
      </span>
      {!clear && <span className="tabular-nums">{fmt(amount)}</span>}
    </div>
  );
}

/** Mobile version of the totals panel: a bar that expands into a sheet. */
function RunningTotals({
  bill,
  totalsById,
  unassigned,
  expanded,
  onToggle,
}: {
  bill: Bill;
  totalsById: Map<string, number>;
  unassigned: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useUi();
  return (
    <div className="mb-2">
      {expanded && (
        <div className="mb-2 max-h-[40dvh] overflow-y-auto rounded-xl bg-slate-50 p-3">
          <PersonList bill={bill} totalsById={totalsById} />
        </div>
      )}

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2"
      >
        <span className="flex-1">
          <UnassignedLine amount={unassigned} />
        </span>
        <ChevronUp
          size={20}
          aria-hidden
          className={`shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
        <span className="sr-only">{t('perPersonPanel')}</span>
      </button>
    </div>
  );
}

function BlockedNotice({
  blocked,
  count,
  onShow,
  onTotals,
}: {
  blocked: boolean;
  count: number;
  onShow: () => void;
  onTotals: () => void;
}) {
  const { t } = useUi();

  if (!blocked) {
    return (
      <button type="button" className="btn-primary w-full" onClick={onTotals}>
        {t('totals')}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-center text-xs font-medium text-amber-800">
        {t(count === 1 ? 'blockedTitle' : 'blockedTitlePlural', { count })} · {t('blockedBody')}
      </p>
      <button type="button" className="btn-secondary w-full" onClick={onShow}>
        {t('blockedGoFix')}
      </button>
    </div>
  );
}
