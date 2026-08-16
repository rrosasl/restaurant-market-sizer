import { useMemo, useState } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';
import type { ExtraKind } from '../types';
import { AppShell } from '../components/AppShell';
import { useUi } from '../state/uiContext';
import { computeTotals } from '../lib/totals';
import { billToText, copyToClipboard } from '../lib/exportText';
import type { ScreenProps } from './types';
import type { StringKey } from '../strings';

const EXTRA_LABELS: Record<ExtraKind, StringKey> = {
  tax: 'extraTax',
  service: 'extraService',
  cover: 'extraCover',
  tip: 'extraTip',
};

export function TotalsScreen({ bill, onBack, onSettings }: ScreenProps) {
  const { t, fmt, lang } = useUi();
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle');

  const totals = useMemo(() => computeTotals(bill), [bill]);
  const itemById = new Map(bill.items.map((i) => [i.id, i]));
  const extraById = new Map(bill.extras.map((e) => [e.id, e]));
  const personById = new Map(bill.people.map((p) => [p.id, p]));

  const sumOfPeople = totals.perPerson.reduce((s, p) => s + p.total, 0);

  const onCopy = async () => {
    const ok = await copyToClipboard(billToText(bill, lang));
    setCopied(ok ? 'ok' : 'failed');
    if (ok) setTimeout(() => setCopied('idle'), 2000);
  };

  return (
    <AppShell
      title={t('totalsTitle')}
      subtitle={bill.merchant ?? undefined}
      onBack={onBack}
      backLabel={t('back')}
      onSettings={onSettings}
      settingsLabel={t('settings')}
      footer={
        <button type="button" className="btn-primary w-full" onClick={onCopy}>
          {copied === 'ok' ? <Check size={18} aria-hidden /> : <ClipboardCopy size={18} aria-hidden />}
          {copied === 'ok' ? t('totalsCopied') : t('totalsCopy')}
        </button>
      }
    >
      <div className="space-y-3">
        {copied === 'failed' && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            {t('totalsCopyFailed')}
          </p>
        )}

        {bill.people.length === 0 && (
          <p className="card px-4 py-8 text-center text-sm text-slate-500">{t('totalsNobody')}</p>
        )}

        {totals.perPerson.map((share) => {
          const person = personById.get(share.personId);
          if (!person) return null;
          return (
            <section key={share.personId} className="card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="truncate text-lg font-bold text-slate-900">{person.name}</h2>
                <span className="shrink-0 text-lg font-bold tabular-nums text-accent-700">
                  {fmt(share.total)}
                </span>
              </div>

              <ul className="mt-3 space-y-1 text-sm">
                {share.itemShares.map((itemShare) => {
                  const item = itemById.get(itemShare.itemId);
                  return (
                    <li
                      key={itemShare.itemId}
                      className="flex items-baseline justify-between gap-3 text-slate-600"
                    >
                      <span className="truncate">
                        {item?.name || t('itemName')}
                        {itemShare.weight > 1 && (
                          <span className="ml-1 text-xs font-semibold text-slate-400">
                            ×{itemShare.weight}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums">{fmt(itemShare.amount)}</span>
                    </li>
                  );
                })}
              </ul>

              {/*
                Extras get their own lines rather than being folded into the
                total, because "why do I owe 3,95 more than my food" is the
                question this screen has to answer at the table.
              */}
              {share.extraShares.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-sm">
                  {share.extraShares.map((extraShare) => {
                    const extra = extraById.get(extraShare.extraId);
                    if (!extra) return null;
                    return (
                      <li
                        key={extraShare.extraId}
                        className="flex items-baseline justify-between gap-3 text-slate-500"
                      >
                        <span className="truncate">
                          {t(EXTRA_LABELS[extra.kind])}
                          <span className="ml-1.5 text-xs text-slate-400">
                            {t(extra.split === 'prorated' ? 'splitProrated' : 'splitPerHead')}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums">{fmt(extraShare.amount)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}

        <section className="card space-y-2 p-4">
          <div className="flex justify-between text-sm text-slate-500">
            <span>{t('totalsItems')}</span>
            <span className="tabular-nums">{fmt(totals.itemsTotal)}</span>
          </div>
          {totals.extrasTotal !== 0 && (
            <div className="flex justify-between text-sm text-slate-500">
              <span>{t('totalsExtras')}</span>
              <span className="tabular-nums">{fmt(totals.extrasTotal)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-2 font-bold">
            <span>{t('totalsBillTotal')}</span>
            <span className="tabular-nums">{fmt(totals.grandTotal)}</span>
          </div>

          {/*
            The guarantee, stated on screen: what everyone pays adds up to the
            bill, to the cent. If this ever failed it would be the single most
            important bug in the app, so it is asserted in the UI too.
          */}
          {sumOfPeople === totals.grandTotal && bill.people.length > 0 && (
            <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-2 text-sm font-medium text-emerald-800">
              <Check size={16} className="shrink-0" aria-hidden />
              {t('totalsCheck')}
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
