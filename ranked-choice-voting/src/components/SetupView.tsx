import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePoll } from '../state/PollContext';

export function SetupView({ onStarted }: { onStarted: () => void }) {
  const { poll, setName, addOption, removeOption, renameOption, startVoting, resetPoll } = usePoll();
  const [draftOption, setDraftOption] = useState('');
  const isLocked = poll.status === 'voting';

  function handleAdd() {
    if (!draftOption.trim()) return;
    addOption(draftOption);
    setDraftOption('');
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl bg-white/80 p-8 shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/5 backdrop-blur dark:bg-slate-900/70 dark:shadow-black/30 dark:ring-white/10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Create a Ranked-Choice Poll
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Add at least two options, then start voting. Naming the poll is optional.
        </p>

        <div className="mt-6">
          <label htmlFor="poll-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Poll name <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
          </label>
          <input
            id="poll-name"
            type="text"
            value={poll.name}
            disabled={isLocked}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Best Team Lunch Spot"
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/50"
          />
        </div>

        <div className="mt-6">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">Options</span>

          <ul className="mt-2 space-y-2">
            <AnimatePresence initial={false}>
              {poll.options.map((option, index) => (
                <motion.li
                  key={option.id}
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
                    disabled={isLocked}
                    onChange={(e) => renameOption(option.id, e.target.value)}
                    className="min-w-0 flex-1 rounded-md border-none bg-transparent px-1 py-1 text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/30 disabled:text-slate-400 dark:text-slate-100"
                  />
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => removeOption(option.id)}
                      aria-label={`Remove ${option.name}`}
                      className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    >
                      ✕
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          {!isLocked && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={draftOption}
                onChange={(e) => setDraftOption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder="Add an option…"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleAdd}
                className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]"
              >
                Add Option
              </button>
            </div>
          )}

          {poll.options.length < 2 && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">Add at least two options to start voting.</p>
          )}
        </div>

        <div className="mt-8 flex items-center gap-3">
          {!isLocked ? (
            <button
              type="button"
              disabled={poll.options.length < 2}
              onClick={() => {
                startVoting();
                onStarted();
              }}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700"
            >
              Start Voting →
            </button>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                ● Voting is open
              </span>
              <button
                type="button"
                onClick={resetPoll}
                className="ml-auto rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Reset Poll
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
