import type { IRVResult } from '../types';

export function RoundSummary({ result, optionName }: { result: IRVResult; optionName: Map<string, string> }) {
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
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Round {round.round}</span>
              <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
                {round.totalActiveVotes} active vote{round.totalActiveVotes === 1 ? '' : 's'}
                {round.exhaustedVotes > 0 ? ` · ${round.exhaustedVotes} exhausted` : ''}
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
                <>
                  🏆 <span className="font-semibold">{optionName.get(round.winner!)}</span> wins with{' '}
                  {round.tally[round.winner!]} of {round.totalActiveVotes} votes
                  {round.totalActiveVotes > 0
                    ? ` (${((round.tally[round.winner!] / round.totalActiveVotes) * 100).toFixed(1)}%)`
                    : ''}
                  .
                </>
              ) : (
                <>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {optionName.get(round.eliminated ?? '') ?? 'No one'}
                  </span>{' '}
                  is eliminated with the fewest votes ({round.tally[round.eliminated ?? '']}).{' '}
                  {round.transfers.length > 0 && (
                    <>
                      Votes transfer:{' '}
                      {round.transfers
                        .map((t) => {
                          const target = t.to === 'EXHAUSTED' ? 'no further preference (exhausted)' : optionName.get(t.to) ?? t.to;
                          return `${t.count} → ${target}`;
                        })
                        .join(', ')}
                      .
                    </>
                  )}
                  {leaderId && (
                    <>
                      {' '}
                      Current leader: <span className="font-medium">{optionName.get(leaderId)}</span>.
                    </>
                  )}
                </>
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
