import { AlertTriangle, Check, Minus, Plus, Trash2 } from 'lucide-react';
import type { Cents, Extra, ExtraKind } from '../types';
import { AppShell } from '../components/AppShell';
import { MoneyInput } from '../components/MoneyInput';
import { useUi } from '../state/uiContext';
import { defaultSplitFor } from '../state/billReducer';
import { reconcile } from '../lib/totals';
import type { ScreenProps } from './types';
import type { StringKey } from '../strings';

const EXTRA_LABELS: Record<ExtraKind, StringKey> = {
  tax: 'extraTax',
  service: 'extraService',
  cover: 'extraCover',
  tip: 'extraTip',
};

/** Order matters: it mirrors how these appear at the foot of a real receipt. */
const EXTRA_ORDER: ExtraKind[] = ['tax', 'service', 'cover', 'tip'];

export function ItemsScreen({ bill, dispatch, onBack, onSettings, go }: ScreenProps) {
  const { t, fmt } = useUi();
  const rec = reconcile(bill);

  return (
    <AppShell
      title={t('itemsTitle')}
      subtitle={t('itemsSubtitle')}
      onBack={onBack}
      backLabel={t('back')}
      onSettings={onSettings}
      settingsLabel={t('settings')}
      footer={
        <button
          type="button"
          className="btn-primary w-full"
          disabled={bill.items.length === 0}
          // The two entry paths converge here. Entering by hand means people
          // were added first and assignment is next; arriving from a photo
          // means the lines exist but nobody does yet.
          onClick={() => go(bill.people.length === 0 ? 'people' : 'assign')}
        >
          {t('next')}
        </button>
      }
    >
      <div className="space-y-5 pb-2">
        <section className="card space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600">
                {t('merchantLabel')}
              </span>
              <input
                className="field"
                value={bill.merchant ?? ''}
                placeholder={t('merchantPlaceholder')}
                onChange={(e) => dispatch({ type: 'setMerchant', merchant: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">
                  {t('dateLabel')}
                </span>
                <input
                  type="date"
                  className="field"
                  value={bill.date ?? ''}
                  onChange={(e) => dispatch({ type: 'setDate', date: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">
                  {t('currencyLabel')}
                </span>
                <select
                  className="field"
                  value={bill.currency}
                  onChange={(e) =>
                    dispatch({ type: 'setCurrency', currency: e.target.value as 'EUR' | 'CHF' })
                  }
                >
                  <option value="EUR">EUR €</option>
                  <option value="CHF">CHF</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          {bill.items.length === 0 && (
            <p className="card px-4 py-8 text-center text-sm text-slate-500">{t('itemsEmpty')}</p>
          )}

          {bill.items.map((item) => (
            <div key={item.id} className="card p-3">
              <div className="flex items-start gap-2">
                <input
                  className="field flex-1 font-medium"
                  value={item.name}
                  aria-label={t('itemName')}
                  placeholder={t('itemNamePlaceholder')}
                  onChange={(e) =>
                    dispatch({ type: 'updateItem', itemId: item.id, patch: { name: e.target.value } })
                  }
                />
                <button
                  type="button"
                  aria-label={t('itemRemove')}
                  className="btn-ghost min-w-11 px-2 text-slate-400 hover:text-red-600"
                  onClick={() => dispatch({ type: 'removeItem', itemId: item.id })}
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </div>

              <div className="mt-2 flex items-end gap-3">
                <div>
                  <span className="mb-1 block text-xs font-medium text-slate-500">
                    {t('itemQuantity')}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`${t('itemQuantity')} −`}
                      className="btn-ghost min-w-9 rounded-lg px-2 disabled:opacity-30"
                      disabled={item.quantity <= 1}
                      onClick={() =>
                        dispatch({
                          type: 'updateItem',
                          itemId: item.id,
                          patch: { quantity: item.quantity - 1 },
                        })
                      }
                    >
                      <Minus size={16} aria-hidden />
                    </button>
                    <span className="min-w-6 text-center font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`${t('itemQuantity')} +`}
                      className="btn-ghost min-w-9 rounded-lg px-2"
                      onClick={() =>
                        dispatch({
                          type: 'updateItem',
                          itemId: item.id,
                          patch: { quantity: item.quantity + 1 },
                        })
                      }
                    >
                      <Plus size={16} aria-hidden />
                    </button>
                  </div>
                </div>

                <label className="flex-1">
                  <span className="mb-1 block text-xs font-medium text-slate-500">
                    {t('itemLineTotal')}
                  </span>
                  <MoneyInput
                    ariaLabel={`${t('itemLineTotal')} ${item.name}`}
                    value={item.lineTotal}
                    onChange={(cents) =>
                      dispatch({
                        type: 'updateItem',
                        itemId: item.id,
                        patch: { lineTotal: cents ?? 0 },
                      })
                    }
                  />
                </label>
              </div>

              {item.quantity > 1 && item.lineTotal !== 0 && (
                <p className="mt-1.5 text-right text-xs text-slate-400">
                  {fmt(Math.round(item.lineTotal / item.quantity))} × {item.quantity}
                </p>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => dispatch({ type: 'addItem' })}
            className="btn-secondary w-full border-dashed"
          >
            <Plus size={18} aria-hidden />
            {t('itemAdd')}
          </button>
        </section>

        <Extras bill={bill} dispatch={dispatch} />

        <section className="card space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">
              {t('statedTotalLabel')}
            </span>
            <MoneyInput
              ariaLabel={t('statedTotalLabel')}
              value={bill.statedTotal}
              onChange={(cents) => dispatch({ type: 'setStatedTotal', cents })}
            />
            <span className="mt-1 block text-xs text-slate-400">{t('statedTotalHint')}</span>
          </label>

          <ReconcileBanner
            balanced={rec.balanced}
            hasStatedTotal={rec.statedTotal !== null}
            computed={rec.computedTotal}
            delta={rec.delta}
          />
        </section>
      </div>
    </AppShell>
  );
}

/**
 * Live reconciliation: the lines we hold against the total the restaurant
 * printed. Thermal receipts get misread and fingers mistype, and a
 * discrepancy found here is trivial to fix — one found at the table after
 * everyone has paid is not.
 */
function ReconcileBanner({
  balanced,
  hasStatedTotal,
  computed,
  delta,
}: {
  balanced: boolean;
  hasStatedTotal: boolean;
  computed: Cents;
  delta: Cents;
}) {
  const { t, fmt } = useUi();

  if (!hasStatedTotal) {
    return (
      <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
        <div className="flex justify-between gap-3">
          <span>{t('reconcileComputed')}</span>
          <span className="font-semibold tabular-nums">{fmt(computed)}</span>
        </div>
        <p className="mt-1 text-xs">{t('reconcileNoTotal')}</p>
      </div>
    );
  }

  if (balanced) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800">
        <Check size={18} className="shrink-0" aria-hidden />
        {t('reconcileOk')}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">
          {t(delta > 0 ? 'reconcileOffOver' : 'reconcileOffUnder', {
            delta: fmt(Math.abs(delta)),
          })}
        </p>
        <p className="mt-0.5 tabular-nums opacity-80">
          {t('reconcileComputed')} {fmt(computed)}
        </p>
      </div>
    </div>
  );
}

function Extras({ bill, dispatch }: Pick<ScreenProps, 'bill' | 'dispatch'>) {
  const { t } = useUi();

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t('extrasTitle')}
      </h2>
      <div className="space-y-3">
        {EXTRA_ORDER.map((kind) => {
          const extra = bill.extras.find((e) => e.kind === kind);
          return (
            <ExtraRow
              key={kind}
              kind={kind}
              extra={extra}
              onAmount={(cents) => dispatch({ type: 'setExtra', kind, amount: cents })}
              onSplit={(split) =>
                extra && dispatch({ type: 'setExtraSplit', extraId: extra.id, split })
              }
              onReceiptToggle={() =>
                extra &&
                dispatch({
                  type: 'setExtra',
                  kind,
                  amount: extra.amount,
                  onReceipt: !extra.onReceipt,
                })
              }
            />
          );
        })}
      </div>
    </section>
  );
}

function ExtraRow({
  kind,
  extra,
  onAmount,
  onSplit,
  onReceiptToggle,
}: {
  kind: ExtraKind;
  extra: Extra | undefined;
  onAmount: (cents: Cents | null) => void;
  onSplit: (split: Extra['split']) => void;
  onReceiptToggle: () => void;
}) {
  const { t } = useUi();
  const split = extra?.split ?? defaultSplitFor(kind);

  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="flex items-center gap-3">
        <span className="flex-1 font-medium text-slate-700">{t(EXTRA_LABELS[kind])}</span>
        <div className="w-28">
          <MoneyInput
            ariaLabel={t(EXTRA_LABELS[kind])}
            value={extra?.amount ?? null}
            onChange={onAmount}
          />
        </div>
      </div>

      {extra && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
            {(['prorated', 'perHead'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onSplit(option)}
                aria-pressed={split === option}
                className={`min-h-9 rounded-md px-3 text-xs font-semibold transition ${
                  split === option ? 'bg-white text-accent-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                {t(option === 'prorated' ? 'splitProrated' : 'splitPerHead')}
              </button>
            ))}
          </div>

          {/*
            A tip agreed at the table is real money but was never printed, so
            it must not show up as a reconciliation error. This toggle is what
            keeps those two ideas apart.
          */}
          <button
            type="button"
            onClick={onReceiptToggle}
            aria-pressed={!extra.onReceipt}
            className={`min-h-9 rounded-lg border px-3 text-xs font-semibold transition ${
              extra.onReceipt
                ? 'border-slate-200 bg-white text-slate-500'
                : 'border-accent-200 bg-accent-50 text-accent-700'
            }`}
          >
            {t(extra.onReceipt ? 'extraOnReceipt' : 'extraOffReceipt')}
          </button>

          <span className="text-xs text-slate-400">
            {t(split === 'prorated' ? 'splitProratedHint' : 'splitPerHeadHint')}
          </span>
        </div>
      )}
    </div>
  );
}
