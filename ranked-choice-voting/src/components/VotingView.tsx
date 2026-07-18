import { useEffect, useState } from 'react';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import { usePoll } from '../state/PollContext';
import type { PollOption } from '../types';

function RankBadge({ index }: { index: number }) {
  const labels = ['1st', '2nd', '3rd'];
  const label = labels[index] ?? `${index + 1}th`;
  return (
    <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold tracking-wide text-white shadow-sm">
      {label}
    </span>
  );
}

export function VotingView() {
  const { poll, submitBallot } = usePoll();
  const [order, setOrder] = useState<PollOption[]>(poll.options);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [voteCount, setVoteCount] = useState(0);

  useEffect(() => {
    setOrder(poll.options);
  }, [poll.options]);

  if (poll.status !== 'voting') {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white/80 p-8 text-center shadow-lg ring-1 ring-slate-900/5 dark:bg-slate-900/70 dark:ring-white/10">
        <p className="text-slate-600 dark:text-slate-300">
          Voting hasn't started yet. Finish setting up the poll and click{' '}
          <span className="font-semibold">Start Voting</span> first.
        </p>
      </div>
    );
  }

  function move(id: string, delta: number) {
    setOrder((prev) => {
      const index = prev.findIndex((o) => o.id === id);
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function handleSubmit() {
    submitBallot(order.map((o) => o.id));
    setVoteCount((c) => c + 1);
    setJustSubmitted(true);
  }

  function handleSubmitAnother() {
    setOrder(poll.options);
    setJustSubmitted(false);
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl bg-white/80 p-8 shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/5 backdrop-blur dark:bg-slate-900/70 dark:shadow-black/30 dark:ring-white/10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {poll.name.trim() || 'Untitled Poll'}
          </h1>
          <span className="text-sm text-slate-500 dark:text-slate-400">{poll.ballots.length} votes cast</span>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Drag to reorder, or use the arrows — top is your 1st choice.
        </p>

        <AnimatePresence mode="wait">
          {justSubmitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="mt-8 flex flex-col items-center gap-4 py-6 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl dark:bg-emerald-500/20">
                ✓
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Vote submitted!</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Ballot #{voteCount} recorded. Ready for the next voter.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSubmitAnother}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 active:scale-[0.98]"
              >
                Submit Another Vote
              </button>
            </motion.div>
          ) : (
            <motion.div key="ballot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Reorder.Group axis="y" values={order} onReorder={setOrder} className="mt-6 space-y-2">
                {order.map((option, index) => (
                  <Reorder.Item
                    key={option.id}
                    value={option}
                    className="flex cursor-grab items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800"
                    whileDrag={{ scale: 1.03, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
                  >
                    <RankBadge index={index} />
                    <span className="flex-1 select-none font-medium text-slate-800 dark:text-slate-100">
                      {option.name}
                    </span>
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <button
                        type="button"
                        aria-label={`Move ${option.name} up`}
                        disabled={index === 0}
                        onClick={() => move(option.id, -1)}
                        className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${option.name} down`}
                        disabled={index === order.length - 1}
                        onClick={() => move(option.id, 1)}
                        className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                      >
                        ▼
                      </button>
                    </div>
                    <span className="hidden shrink-0 text-lg text-slate-300 select-none sm:block dark:text-slate-600">
                      ⠿
                    </span>
                  </Reorder.Item>
                ))}
              </Reorder.Group>

              <button
                type="button"
                onClick={handleSubmit}
                className="mt-8 w-full rounded-lg bg-brand-600 py-3 text-base font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 active:scale-[0.98]"
              >
                Submit Vote
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
