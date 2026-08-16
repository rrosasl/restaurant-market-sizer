import { Camera, ChevronRight, PencilLine, Receipt, Trash2 } from 'lucide-react';
import type { Bill } from '../types';
import { useUi } from '../state/uiContext';
import { AppShell } from '../components/AppShell';
import { deleteFromHistory } from '../lib/storage';
import { formatAmount } from '../lib/money';
import { computeTotals } from '../lib/totals';

interface StartScreenProps {
  bill: Bill;
  history: Bill[];
  onStart: (source: Bill['source']) => void;
  onResume: () => void;
  onOpen: (bill: Bill) => void;
  onHistoryChange: (history: Bill[]) => void;
  onSettings: () => void;
}

export function StartScreen({
  bill,
  history,
  onStart,
  onResume,
  onOpen,
  onHistoryChange,
  onSettings,
}: StartScreenProps) {
  const { t, lang } = useUi();

  // A bill worth resuming has something in it. A pristine empty bill is just
  // the blank slate a new one would give you.
  const hasWorkInProgress = bill.items.length > 0 || bill.people.length > 0;

  return (
    <AppShell
      title={t('startTitle')}
      subtitle={t('startSubtitle')}
      backLabel={t('back')}
      onSettings={onSettings}
      settingsLabel={t('settings')}
    >
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onStart('photo')}
            className="btn-primary h-auto flex-col gap-2 py-6 text-center"
          >
            <Camera size={28} aria-hidden />
            {t('newBillPhoto')}
          </button>
          <button
            type="button"
            onClick={() => onStart('manual')}
            className="btn-secondary h-auto flex-col gap-2 py-6 text-center"
          >
            <PencilLine size={28} aria-hidden />
            {t('newBillManual')}
          </button>
        </div>

        {hasWorkInProgress && (
          <button
            type="button"
            onClick={onResume}
            className="card flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50"
          >
            <Receipt size={22} className="shrink-0 text-accent-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{t('resumeBill')}</div>
              <div className="truncate text-sm text-slate-500">
                <BillSummary bill={bill} />
              </div>
            </div>
            <ChevronRight size={20} className="shrink-0 text-slate-400" aria-hidden />
          </button>
        )}

        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t('historyTitle')}
          </h2>

          {history.length === 0 ? (
            <p className="card px-4 py-6 text-center text-sm text-slate-500">{t('historyEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {history.map((saved) => (
                <li key={saved.id} className="card flex items-center gap-1 p-2">
                  <button
                    type="button"
                    onClick={() => onOpen(saved)}
                    className="min-w-0 flex-1 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-semibold">
                        {saved.merchant ?? t('unnamedMerchant')}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-accent-700">
                        {formatAmount(computeTotals(saved).grandTotal, saved.currency, lang)}
                      </span>
                    </div>
                    <div className="truncate text-sm text-slate-500">
                      <BillSummary bill={saved} />
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={t('historyDelete')}
                    className="btn-ghost min-w-11 px-2 text-slate-400 hover:text-red-600"
                    onClick={() => {
                      if (confirm(t('historyDeleteConfirm'))) {
                        onHistoryChange(deleteFromHistory(saved.id));
                      }
                    }}
                  >
                    <Trash2 size={18} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="px-1 pb-4 text-center text-xs text-slate-400">{t('settingsAbout')}</p>
      </div>
    </AppShell>
  );
}

function BillSummary({ bill }: { bill: Bill }) {
  const { t, lang } = useUi();
  const when = new Date(bill.date ?? bill.createdAt);
  const dateLabel = Number.isNaN(when.getTime())
    ? ''
    : when.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-IE', {
        day: 'numeric',
        month: 'short',
      });
  const parts = [
    dateLabel,
    `${bill.people.length} ${t('people').toLocaleLowerCase()}`,
    `${bill.items.length} ${t('items').toLocaleLowerCase()}`,
  ].filter(Boolean);
  return <>{parts.join(' · ')}</>;
}
