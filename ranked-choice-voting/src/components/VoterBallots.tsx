import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../lib/i18n';
import type { Ballot, PollOption } from '../types';

/**
 * Every ballot cast, expandable to reveal that voter's full ranking.
 *
 * Rows open independently (not an accordion) so two ballots can be compared
 * side by side, which is the usual reason to open one in the first place.
 * Unnamed ballots are listed individually rather than lumped into a count:
 * their rankings are already part of the public result data, and hiding them
 * would make the tally impossible to check against the ballots.
 */
export function VoterBallots({ ballots, options }: { ballots: Ballot[]; options: PollOption[] }) {
  const { t, rank } = useI18n();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const optionName = useMemo(() => new Map(options.map((o) => [o.id, o.name])), [options]);
  const ordered = useMemo(() => [...ballots].sort((a, b) => a.submittedAt - b.submittedAt), [ballots]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {ordered.map((ballot) => {
        const isOpen = openIds.has(ballot.id);
        const named = Boolean(ballot.voterName?.trim());
        const label = named ? ballot.voterName!.trim() : t('anonymousVoter');
        const topChoice = optionName.get(ballot.ranking[0]);

        return (
          <li key={ballot.id}>
            <button
              type="button"
              onClick={() => toggle(ballot.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-2 rounded-lg py-2.5 text-left transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
            >
              <span
                className={`min-w-0 max-w-[45%] truncate text-sm font-medium ${
                  named ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 italic dark:text-slate-500'
                }`}
              >
                {label}
              </span>
              {topChoice && (
                <span className="min-w-0 flex-1 truncate text-right text-xs text-slate-400 dark:text-slate-500">
                  {rank(0)}: {topChoice}
                </span>
              )}
              <span
                aria-hidden
                className={`shrink-0 text-slate-300 transition-transform duration-200 dark:text-slate-600 ${
                  isOpen ? 'rotate-90' : ''
                }`}
              >
                ›
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <ol className="space-y-1.5 pb-3 pl-1">
                    {ballot.ranking.map((optionId, i) => (
                      <li key={optionId} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-5 w-9 shrink-0 items-center justify-center rounded bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                          {rank(i)}
                        </span>
                        <span className="min-w-0 flex-1 text-sm break-words text-slate-700 dark:text-slate-200">
                          {optionName.get(optionId) ?? optionId}
                        </span>
                      </li>
                    ))}
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
