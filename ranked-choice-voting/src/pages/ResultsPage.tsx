import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useBallotsWatch, usePollWatch } from '../lib/hooks';
import { computeIRV } from '../utils/irv';
import { computeBorda } from '../utils/borda';
import type { CountingMethod } from '../types';
import { SankeyChart } from '../components/SankeyChart';
import { FirstChoiceBarChart } from '../components/FirstChoiceBarChart';
import { FinalRoundPieChart } from '../components/FinalRoundPieChart';
import { RoundSummary } from '../components/RoundSummary';
import { BordaChart } from '../components/BordaChart';
import { BordaSummary } from '../components/BordaSummary';

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/80 p-6 shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/5 backdrop-blur dark:bg-slate-900/70 dark:shadow-black/30 dark:ring-white/10">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

const METHODS: { id: CountingMethod; label: string; blurb: string; bestFor: string }[] = [
  {
    id: 'irv',
    label: 'Ranked Choice (IRV)',
    blurb: 'Eliminates the weakest candidate round by round until one has a majority of active votes.',
    bestFor:
      'Best for single-winner decisions where majority support matters most — it prevents vote-splitting between similar options and guarantees the winner is acceptable to over half of voters, but it can ignore a candidate\'s broad appeal if they rarely get 1st-place votes.',
  },
  {
    id: 'borda',
    label: 'Borda Count',
    blurb: 'Every ranked position earns points (1st choice earns the most); highest total wins.',
    bestFor:
      'Best for consensus decisions — a candidate nobody loves but nobody hates can beat one a slim majority ranks 1st but everyone else ranks last. Good for group picks and prioritization, but easier to game by strategically burying rivals.',
  },
];

export function ResultsPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const { poll, loading } = usePollWatch(pollId);
  const { ballots, hidden, loading: ballotsLoading } = useBallotsWatch(
    pollId,
    poll ? `${poll.status}-${poll.resultsVisibility}` : '',
  );
  const [method, setMethod] = useState<CountingMethod>('irv');

  const optionName = useMemo(() => new Map((poll?.options ?? []).map((o) => [o.id, o.name])), [poll]);
  const optionOrder = useMemo(() => (poll?.options ?? []).map((o) => o.id), [poll]);

  const irvResult = useMemo(() => {
    if (!poll || ballots.length === 0) return null;
    return computeIRV(poll.options, ballots);
  }, [poll, ballots]);

  const bordaResult = useMemo(() => {
    if (!poll || ballots.length === 0) return null;
    return computeBorda(poll.options, ballots);
  }, [poll, ballots]);

  if (loading || !pollId) {
    return <p className="py-16 text-center text-sm text-slate-400">Loading results…</p>;
  }

  if (!poll) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white/80 p-8 text-center shadow-lg ring-1 ring-slate-900/5 dark:bg-slate-900/70 dark:ring-white/10">
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Poll not found</p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
          ← Back home
        </Link>
      </div>
    );
  }

  const isOpen = poll.status === 'open';
  const backLink = (
    <Link
      to={`/poll/${poll.id}`}
      className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
    >
      ← Back to poll
    </Link>
  );

  if (hidden) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        {backLink}
        <div className="rounded-2xl bg-white/80 p-8 text-center shadow-lg ring-1 ring-slate-900/5 dark:bg-slate-900/70 dark:ring-white/10">
          <p className="text-3xl">🔒</p>
          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Results are sealed</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The poll creator chose to hide results until voting closes. Check back once the poll is closed.
          </p>
        </div>
      </div>
    );
  }

  if (ballotsLoading) {
    return <p className="py-16 text-center text-sm text-slate-400">Loading results…</p>;
  }

  if (!irvResult || !bordaResult || ballots.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        {backLink}
        <div className="rounded-2xl bg-white/80 p-8 text-center shadow-lg ring-1 ring-slate-900/5 dark:bg-slate-900/70 dark:ring-white/10">
          <p className="text-slate-600 dark:text-slate-300">No votes yet — share the poll link to collect ballots.</p>
        </div>
      </div>
    );
  }

  const firstRound = irvResult.rounds[0];
  const barData = optionOrder.map((id) => ({ name: optionName.get(id) ?? id, votes: firstRound.tally[id] ?? 0 }));

  const finalRound = irvResult.rounds[irvResult.rounds.length - 1];
  const pieData = finalRound.activeCandidates.map((id) => ({
    name: optionName.get(id) ?? id,
    votes: finalRound.tally[id] ?? 0,
  }));

  const activeMethod = METHODS.find((m) => m.id === method)!;
  const winnerId = method === 'irv' ? irvResult.winner : bordaResult.winner;
  const winnerName = winnerId ? optionName.get(winnerId) : 'No winner yet';

  // Call out exact ties instead of pretending the first-sorted candidate leads.
  const tiedWith: string[] = [];
  if (method === 'borda' && bordaResult.scores.length > 1) {
    for (const s of bordaResult.scores.slice(1)) {
      if (s.total === bordaResult.scores[0].total) tiedWith.push(optionName.get(s.optionId) ?? s.optionId);
    }
  } else if (method === 'irv' && winnerId) {
    const final = irvResult.rounds[irvResult.rounds.length - 1];
    for (const id of final.activeCandidates) {
      if (id !== winnerId && final.tally[id] === final.tally[winnerId]) tiedWith.push(optionName.get(id) ?? id);
    }
  }
  const namedVoters = ballots.filter((b) => b.voterName).map((b) => b.voterName as string);
  const anonymousCount = ballots.length - namedVoters.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {backLink}

      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-6 text-white shadow-lg shadow-brand-600/20">
        <p className="text-sm font-medium text-brand-100">
          {poll.name.trim() || 'Untitled Poll'}
          {isOpen && ' · voting still open'}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {tiedWith.length > 0
            ? `${winnerName} and ${tiedWith.join(' and ')} are tied`
            : `${winnerName} ${isOpen ? 'is leading' : 'wins'}`}
        </h1>
        <p className="mt-1 text-sm text-brand-100">
          {method === 'irv'
            ? `${irvResult.totalBallots} ballot${irvResult.totalBallots === 1 ? '' : 's'} · resolved in ${irvResult.rounds.length} round${irvResult.rounds.length === 1 ? '' : 's'}`
            : `${bordaResult.totalBallots} ballot${bordaResult.totalBallots === 1 ? '' : 's'} · ${bordaResult.scores[0]?.total ?? 0} of ${bordaResult.maxPossible} possible points`}
        </p>
      </div>

      <div className="rounded-2xl bg-white/80 p-4 shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/5 backdrop-blur dark:bg-slate-900/70 dark:shadow-black/30 dark:ring-white/10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Counting method:</span>
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800/70">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  method === m.id
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{activeMethod.blurb}</p>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-600 dark:text-slate-300">Best for: </span>
          {activeMethod.bestFor}
        </p>
      </div>

      {method === 'irv' ? (
        <>
          <Card title="Round-by-Round Elimination" subtitle="How votes moved as candidates were eliminated">
            <SankeyChart data={irvResult.sankey} optionOrder={optionOrder} />
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
            <RoundSummary result={irvResult} optionName={optionName} />
          </Card>
        </>
      ) : (
        <>
          <Card title="Points by Rank" subtitle="Each candidate's total, broken down by which ranked position earned it">
            <BordaChart result={bordaResult} options={poll.options} />
          </Card>

          <Card title="Final Standings" subtitle="Every candidate, ranked by total points">
            <BordaSummary result={bordaResult} options={poll.options} />
          </Card>
        </>
      )}

      <Card title="Who voted" subtitle="Names are optional — voters chose whether to share theirs">
        <div className="flex flex-wrap gap-1.5">
          {namedVoters.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {name}
            </span>
          ))}
          {anonymousCount > 0 && (
            <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800/40 dark:text-slate-500 dark:ring-slate-700">
              +{anonymousCount} anonymous
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
