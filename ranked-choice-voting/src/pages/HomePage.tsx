import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getBackend } from '../lib';
import { useI18n } from '../lib/i18n';
import { getHistory, recordHistory, type HistoryEntry } from '../lib/history';
import type { ResultsVisibility } from '../types';

interface DraftOption {
  key: number;
  name: string;
}

function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { icon: '📝', title: t('howStep1T'), desc: t('howStep1D') },
    { icon: '🔗', title: t('howStep2T'), desc: t('howStep2D') },
    { icon: '🥇', title: t('howStep3T'), desc: t('howStep3D') },
    { icon: '🏆', title: t('howStep4T'), desc: t('howStep4D') },
  ];
  return (
    <div className="rounded-2xl bg-white/80 p-6 shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/5 backdrop-blur sm:p-8 dark:bg-slate-900/70 dark:shadow-black/30 dark:ring-white/10">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('howTitle')}</h2>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t('howSubtitle')}</p>
      <ol className="mt-5 space-y-4">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30">
              {step.icon}
              <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                {i + 1}
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{step.title}</p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{step.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [options, setOptions] = useState<DraftOption[]>([]);
  const [draft, setDraft] = useState('');
  const [pollName, setPollName] = useState('');
  const [visibility, setVisibility] = useState<ResultsVisibility>('live');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  function addOption() {
    const name = draft.trim();
    if (!name) return;
    setOptions((prev) => [...prev, { key: Date.now() + Math.random(), name }]);
    setDraft('');
  }

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const backend = await getBackend();
      const poll = await backend.createPoll({
        name: pollName.trim(),
        options: options.map((o) => o.name.trim()).filter(Boolean),
        resultsVisibility: visibility,
      });
      recordHistory(poll.id, poll.name || t('untitledPoll'), 'created');
      navigate(`/poll/${poll.id}?new=1`);
    } catch {
      setError(t('createError'));
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl bg-white/80 p-8 shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/5 backdrop-blur dark:bg-slate-900/70 dark:shadow-black/30 dark:ring-white/10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {t('createTitle')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('createSubtitle')}</p>

        <div className="mt-6">
          <label htmlFor="poll-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('pollNameLabel')} <span className="font-normal text-slate-400 dark:text-slate-500">{t('optional')}</span>
          </label>
          <input
            id="poll-name"
            type="text"
            value={pollName}
            onChange={(e) => setPollName(e.target.value)}
            placeholder={t('pollNamePlaceholder')}
            maxLength={100}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="mt-6">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('optionsLabel')}</span>
          <ul className="mt-2 space-y-2">
            <AnimatePresence initial={false}>
              {options.map((option, index) => (
                <motion.li
                  key={option.key}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={option.name}
                    maxLength={100}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((o) => (o.key === option.key ? { ...o, name: e.target.value } : o)),
                      )
                    }
                    className="min-w-0 flex-1 rounded-md border-none bg-transparent px-1 py-1 text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/30 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setOptions((prev) => prev.filter((o) => o.key !== option.key))}
                    aria-label={t('removeOption', { name: option.name })}
                    className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  >
                    ✕
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addOption();
                }
              }}
              placeholder={t('addOptionPlaceholder')}
              maxLength={100}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={addOption}
              className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]"
            >
              {t('addOption')}
            </button>
          </div>
          {options.length < 2 && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{t('minTwoOptions')}</p>
          )}
        </div>

        <fieldset className="mt-6">
          <legend className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('visibilityLabel')}
          </legend>
          <div className="mt-2 space-y-2">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3 has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 dark:border-slate-700 dark:bg-slate-800/40 dark:has-[:checked]:border-brand-500/50 dark:has-[:checked]:bg-brand-500/10">
              <input
                type="radio"
                name="visibility"
                checked={visibility === 'live'}
                onChange={() => setVisibility('live')}
                className="mt-0.5 accent-brand-600"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                  {t('visLiveTitle')}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{t('visLiveDesc')}</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3 has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 dark:border-slate-700 dark:bg-slate-800/40 dark:has-[:checked]:border-brand-500/50 dark:has-[:checked]:bg-brand-500/10">
              <input
                type="radio"
                name="visibility"
                checked={visibility === 'after_close'}
                onChange={() => setVisibility('after_close')}
                className="mt-0.5 accent-brand-600"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                  {t('visHiddenTitle')}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{t('visHiddenDesc')}</span>
              </span>
            </label>
          </div>
        </fieldset>

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="button"
          disabled={options.filter((o) => o.name.trim()).length < 2 || creating}
          onClick={create}
          className="mt-8 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700"
        >
          {creating ? t('creating') : t('createBtn')}
        </button>
      </div>

      <HowItWorks />

      {history.length > 0 && (
        <div className="rounded-2xl bg-white/80 p-6 shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/5 backdrop-blur dark:bg-slate-900/70 dark:shadow-black/30 dark:ring-white/10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('yourPolls')}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t('yourPollsDesc')}</p>
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {history.map((entry) => (
              <li key={`${entry.pollId}-${entry.role}`}>
                <Link
                  to={`/poll/${entry.pollId}`}
                  className="flex items-center gap-3 py-3 transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      entry.role === 'created'
                        ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {entry.role === 'created' ? t('roleCreated') : t('roleVoted')}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {entry.name}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {new Date(entry.at).toLocaleDateString()}
                  </span>
                  <span className="shrink-0 text-slate-300 dark:text-slate-600">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
