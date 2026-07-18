import { useMemo, type ReactNode } from 'react';
import { usePoll } from '../state/PollContext';
import { computeIRV } from '../utils/irv';
import { SankeyChart } from './SankeyChart';
import { FirstChoiceBarChart } from './FirstChoiceBarChart';
import { FinalRoundPieChart } from './FinalRoundPieChart';
import { RoundSummary } from './RoundSummary';

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/80 p-6 shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/5 backdrop-blur dark:bg-slate-900/70 dark:shadow-black/30 dark:ring-white/10">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function ResultsView() {
  const { poll } = usePoll();
  const optionName = useMemo(() => new Map(poll.options.map((o) => [o.id, o.name])), [poll.options]);
  const optionOrder = useMemo(() => poll.options.map((o) => o.id), [poll.options]);

  const result = useMemo(() => {
    if (poll.options.length < 2 || poll.ballots.length === 0) return null;
    return computeIRV(poll.options, poll.ballots);
  }, [poll.options, poll.ballots]);

  if (poll.options.length < 2) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white/80 p-8 text-center shadow-lg ring-1 ring-slate-900/5 dark:bg-slate-900/70 dark:ring-white/10">
        <p className="text-slate-600 dark:text-slate-300">Set up a poll with at least two options to see results.</p>
      </div>
    );
  }

  if (!result || poll.ballots.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white/80 p-8 text-center shadow-lg ring-1 ring-slate-900/5 dark:bg-slate-900/70 dark:ring-white/10">
        <p className="text-slate-600 dark:text-slate-300">No votes yet — head to the Vote tab to cast the first ballot.</p>
      </div>
    );
  }

  const firstRound = result.rounds[0];
  const barData = optionOrder.map((id) => ({ name: optionName.get(id) ?? id, votes: firstRound.tally[id] ?? 0 }));

  const finalRound = result.rounds[result.rounds.length - 1];
  const pieData = finalRound.activeCandidates.map((id) => ({
    name: optionName.get(id) ?? id,
    votes: finalRound.tally[id] ?? 0,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-6 text-white shadow-lg shadow-brand-600/20">
        <p className="text-sm font-medium text-brand-100">{poll.name.trim() || 'Untitled Poll'}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {result.winner ? optionName.get(result.winner) : 'No winner yet'} wins
        </h1>
        <p className="mt-1 text-sm text-brand-100">
          {result.totalBallots} ballot{result.totalBallots === 1 ? '' : 's'} cast · resolved in {result.rounds.length}{' '}
          round{result.rounds.length === 1 ? '' : 's'}
        </p>
      </div>

      <Card title="Round-by-Round Elimination" subtitle="How votes moved as candidates were eliminated">
        <SankeyChart data={result.sankey} optionOrder={optionOrder} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="1st-Choice Votes" subtitle="Initial preference distribution before any elimination">
          <FirstChoiceBarChart data={barData} />
        </Card>
        <Card title="Final Round" subtitle="Vote share among the last candidates standing">
          <FinalRoundPieChart data={pieData} />
        </Card>
      </div>

      <Card title="Round Summary" subtitle="Step-by-step breakdown of every elimination round">
        <RoundSummary result={result} optionName={optionName} />
      </Card>
    </div>
  );
}
