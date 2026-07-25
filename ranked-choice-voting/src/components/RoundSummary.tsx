import { useI18n } from '../lib/i18n';
import type { IRVResult } from '../types';

export function RoundSummary({ result, optionName }: { result: IRVResult; optionName: Map<string, string> }) {
  const { t, tn } = useI18n();
  return (
    <ol className="space-y-3">
      {result.rounds.map((round) => {
        const isFinal = round.winner !== undefined;
        const leaderId = Object.entries(round.tally).sort((a, b) => b[1] - a[1])[0]?.[0];

        return (
          <li
            key={round.round}
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {round.round}
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t('roundN', { n: round.round })}
              </span>
              <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
                {tn('activeVotes', round.totalActiveVotes)}
                {round.exhaustedVotes > 0 ? t('exhaustedCount', { n: round.exhaustedVotes }) : ''}
              </span>
            </div>

            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              {round.activeCandidates
                .slice()
                .sort((a, b) => round.tally[b] - round.tally[a])
                .map((id) => (
                  <li key={id} className="flex items-center gap-2">
                    <span className="w-40 truncate">{optionName.get(id) ?? id}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{
                          width: `${round.totalActiveVotes > 0 ? (round.tally[id] / round.totalActiveVotes) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right tabular-nums">{round.tally[id]}</span>
                  </li>
                ))}
            </ul>

            <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
              {isFinal ? (
                t('winsWith', {
                  name: optionName.get(round.winner!) ?? round.winner!,
                  v: round.tally[round.winner!],
                  t: round.totalActiveVotes,
                  pct:
                    round.totalActiveVotes > 0
                      ? ((round.tally[round.winner!] / round.totalActiveVotes) * 100).toFixed(1)
                      : '0',
                })
              ) : (
                <>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {optionName.get(round.eliminated ?? '') ?? t('noOne')}
                  </span>{' '}
                  {t('eliminatedWith', { v: round.tally[round.eliminated ?? ''] })}
                  {round.transfers.length > 0 &&
                    t('votesTransfer', {
                      list: round.transfers
                        .map((tr) => {
                          const target = tr.to === 'EXHAUSTED' ? t('noFurtherPref') : (optionName.get(tr.to) ?? tr.to);
                          return `${tr.count} → ${target}`;
                        })
                        .join(', '),
                    })}
                  {leaderId && ' ' + t('currentLeader', { name: optionName.get(leaderId) ?? leaderId })}
                </>
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
