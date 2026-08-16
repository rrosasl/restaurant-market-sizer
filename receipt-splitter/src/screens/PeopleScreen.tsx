import { useState } from 'react';
import { Minus, Plus, UserPlus, X } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useUi } from '../state/uiContext';
import type { ScreenProps } from './types';

interface PeopleScreenProps extends ScreenProps {
  /** Names used on previous bills, offered as one-tap suggestions. */
  roster: string[];
}

export function PeopleScreen({ bill, dispatch, onBack, onSettings, go, roster }: PeopleScreenProps) {
  const { t } = useUi();
  const [draft, setDraft] = useState('');
  const [duplicate, setDuplicate] = useState(false);

  const namesOnBill = new Set(bill.people.map((p) => p.name.toLocaleLowerCase()));
  const suggestions = roster.filter((n) => !namesOnBill.has(n.toLocaleLowerCase())).slice(0, 12);

  const addName = (name: string) => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    if (namesOnBill.has(trimmed.toLocaleLowerCase())) {
      setDuplicate(true);
      return;
    }
    dispatch({ type: 'addPerson', name: trimmed });
    setDraft('');
    setDuplicate(false);
  };

  return (
    <AppShell
      title={t('peopleTitle')}
      subtitle={t('peopleSubtitle')}
      onBack={onBack}
      backLabel={t('back')}
      onSettings={onSettings}
      settingsLabel={t('settings')}
      footer={
        <button
          type="button"
          className="btn-primary w-full"
          disabled={bill.people.length === 0}
          onClick={() => go('items')}
        >
          {t('next')}
        </button>
      }
    >
      <div className="space-y-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addName(draft);
          }}
          className="flex gap-2"
        >
          <input
            className="field flex-1"
            value={draft}
            autoComplete="off"
            aria-label={t('personNamePlaceholder')}
            placeholder={t('personNamePlaceholder')}
            onChange={(e) => {
              setDraft(e.target.value);
              setDuplicate(false);
            }}
          />
          <button type="submit" className="btn-primary px-4" aria-label={t('add')}>
            <UserPlus size={20} aria-hidden />
          </button>
        </form>

        {duplicate && <p className="px-1 text-sm text-red-600">{t('peopleDuplicate')}</p>}

        {suggestions.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t('peopleSuggestions')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => addName(name)}
                  className="min-h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition active:scale-95 hover:border-accent-200 hover:bg-accent-50"
                >
                  + {name}
                </button>
              ))}
            </div>
          </section>
        )}

        {bill.people.length === 0 ? (
          <p className="card px-4 py-8 text-center text-sm text-slate-500">{t('peopleEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {bill.people.map((person) => (
              <li key={person.id} className="card p-3">
                <div className="flex items-center gap-2">
                  <input
                    className="field flex-1 font-medium"
                    value={person.name}
                    aria-label={t('personNamePlaceholder')}
                    onChange={(e) =>
                      dispatch({ type: 'renamePerson', personId: person.id, name: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    aria-label={`${t('peopleRemove')} ${person.name}`}
                    className="btn-ghost min-w-11 px-2 text-slate-400 hover:text-red-600"
                    onClick={() => dispatch({ type: 'removePerson', personId: person.id })}
                  >
                    <X size={20} aria-hidden />
                  </button>
                </div>

                {/*
                  Covers only matter once a per-head extra exists, so the
                  control stays out of the way at weight 1 and only explains
                  itself when someone is paying for more than one seat.
                */}
                <div className="mt-2 flex items-center gap-2 pl-1">
                  <span className="text-sm text-slate-500">{t('sharesLabel')}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`${t('sharesLabel')} −`}
                      className="btn-ghost min-w-9 rounded-lg px-2 disabled:opacity-30"
                      disabled={person.shares <= 1}
                      onClick={() =>
                        dispatch({
                          type: 'setPersonShares',
                          personId: person.id,
                          shares: person.shares - 1,
                        })
                      }
                    >
                      <Minus size={16} aria-hidden />
                    </button>
                    <span className="min-w-6 text-center font-semibold tabular-nums">
                      {person.shares}
                    </span>
                    <button
                      type="button"
                      aria-label={`${t('sharesLabel')} +`}
                      className="btn-ghost min-w-9 rounded-lg px-2"
                      onClick={() =>
                        dispatch({
                          type: 'setPersonShares',
                          personId: person.id,
                          shares: person.shares + 1,
                        })
                      }
                    >
                      <Plus size={16} aria-hidden />
                    </button>
                  </div>
                  {person.shares > 1 && (
                    <span className="text-xs text-slate-400">{t('sharesHint')}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
