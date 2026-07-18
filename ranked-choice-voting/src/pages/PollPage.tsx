import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getBackend } from '../lib';
import { useBackendInfo, useBallotsWatch, useMyBallotWatch, usePollWatch } from '../lib/hooks';
import { getRememberedVoterName, recordHistory, rememberVoterName } from '../lib/history';
import { shuffle } from '../utils/shuffle';
import { RankingList } from '../components/RankingList';
import { ShareBar } from '../components/ShareBar';
import type { Poll, PollOption } from '../types';

type BallotMode = 'first' | 'editing' | 'extra' | 'done';

function orderFromRanking(poll: Poll, ranking: string[] | undefined): PollOption[] {
  if (!ranking || ranking.length === 0) return poll.options;
  const byId = new Map(poll.options.map((o) => [o.id, o]));
  const ranked = ranking.map((id) => byId.get(id)).filter((o): o is PollOption => Boolean(o));
  const missing = poll.options.filter((o) => !ranking.includes(o.id));
  return [...ranked, ...missing];
}

export function PollPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const justCreated = searchParams.get('new') === '1';

  const { deviceId } = useBackendInfo();
  const { poll, loading } = usePollWatch(pollId);
  const { myBallot, loading: myBallotLoading } = useMyBallotWatch(pollId);
  const { ballots, hidden } = useBallotsWatch(pollId, poll);

  const [mode, setMode] = useState<BallotMode | null>(null);
  const [order, setOrder] = useState<PollOption[]>([]);
  const [voterName, setVoterName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraSubmitted, setExtraSubmitted] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const isCreator = poll !== null && deviceId !== null && poll.creatorUid === deviceId;
  const resultsReadable = poll !== null && (poll.status === 'closed' || poll.resultsVisibility === 'live');

  // Settle the initial ballot mode once both the poll and my ballot are known.
  useEffect(() => {
    if (!poll || myBallotLoading || mode !== null) return;
    if (myBallot) {
      setMode('done');
    } else {
      setMode('first');
      // Fresh ballots start in a random order so the sequence the creator
      // typed the options in doesn't bias everyone's rankings.
      setOrder(shuffle(poll.options));
      setVoterName(getRememberedVoterName());
    }
  }, [poll, myBallot, myBallotLoading, mode]);

  if (loading || !pollId) {
    return <p className="py-16 text-center text-sm text-slate-400">Loading poll…</p>;
  }

  if (!poll) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white/80 p-8 text-center shadow-lg ring-1 ring-slate-900/5 dark:bg-slate-900/70 dark:ring-white/10">
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Poll not found</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Double-check the link — or the poll may have been created on another server.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Create your own poll
        </Link>
      </div>
    );
  }

  const isOpen = poll.status === 'open';

  async function submit(slot: 'primary' | 'extra') {
    if (!poll) return;
    setSubmitting(true);
    setError(null);
    try {
      const backend = await getBackend();
      await backend.submitBallot(poll.id, order.map((o) => o.id), voterName.trim() || null, slot);
      recordHistory(poll.id, poll.name || 'Untitled Poll', 'voted');
      if (slot === 'primary') {
        rememberVoterName(voterName);
        setMode('done');
      } else {
        setExtraSubmitted(true);
        setMode('done');
      }
    } catch (e) {
      // Raw Firestore errors ("Missing or insufficient permissions") read as
      // scary and unactionable — translate to something a voter can act on.
      const code = (e as { code?: string })?.code ?? '';
      if (code === 'permission-denied') {
        setError(
          poll.status === 'open'
            ? "Couldn't submit your vote — please tap Submit again."
            : 'This poll has closed — votes can no longer be submitted.',
        );
      } else {
        setError("Couldn't submit your vote — check your connection and try again.");
      }
      // eslint-disable-next-line no-console
      console.error('submitBallot failed', e);
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(status: 'open' | 'closed') {
    if (!poll) return;
    setStatusBusy(true);
    setError(null);
    try {
      const backend = await getBackend();
      await backend.setPollStatus(poll.id, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the poll.');
    } finally {
      setStatusBusy(false);
    }
  }

  function startEdit() {
    if (!poll) return;
    setOrder(orderFromRanking(poll, myBallot?.ranking));
    setVoterName(myBallot?.voterName ?? getRememberedVoterName());
    setMode('editing');
  }

  function startExtra() {
    if (!poll) return;
    setOrder(shuffle(poll.options));
    setVoterName('');
    setExtraSubmitted(false);
    setMode('extra');
  }

  const showRanking = isOpen && (mode === 'first' || mode === 'editing' || mode === 'extra');

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <ShareBar
        pollName={poll.name}
        highlight={justCreated}
      />

      <div className="rounded-2xl bg-white/80 p-6 shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/5 backdrop-blur sm:p-8 dark:bg-slate-900/70 dark:shadow-black/30 dark:ring-white/10">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {poll.name.trim() || 'Untitled Poll'}
          </h1>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
              isOpen
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {isOpen ? '● Open' : 'Closed'}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {hidden
            ? 'Results are hidden until the poll closes.'
            : `${ballots.length} vote${ballots.length === 1 ? '' : 's'} so far`}
        </p>

        <AnimatePresence mode="wait">
          {showRanking ? (
            <motion.div key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {mode === 'extra' && (
                <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                  Passing the phone — this is a fresh ballot for the next person.
                </p>
              )}
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Drag the ⠿ handle or use the arrows — top is your 1st choice.
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Options are shown in random order to keep the vote fair.
              </p>
              <div className="mt-3">
                <RankingList order={order} onReorder={setOrder} />
              </div>
              <div className="mt-4">
                <label htmlFor="voter-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Your name <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
                </label>
                <input
                  id="voter-name"
                  type="text"
                  value={voterName}
                  maxLength={60}
                  onChange={(e) => setVoterName(e.target.value)}
                  placeholder="Shown next to your vote in results"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="button"
                disabled={submitting}
                onClick={() => submit(mode === 'extra' ? 'extra' : 'primary')}
                className="mt-6 w-full rounded-lg bg-brand-600 py-3 text-base font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : mode === 'editing' ? 'Update Vote' : 'Submit Vote'}
              </button>
              {mode !== 'first' && (
                <button
                  type="button"
                  onClick={() => setMode('done')}
                  className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
              )}
            </motion.div>
          ) : isOpen && mode === 'done' ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-6"
            >
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                  ✓ {extraSubmitted ? 'Ballot added!' : 'Your vote is in'}
                </p>
                {myBallot && !extraSubmitted && (
                  <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-400/80">
                    {myBallot.voterName ? `Voting as ${myBallot.voterName} — ` : ''}your 1st choice:{' '}
                    <span className="font-medium">
                      {poll.options.find((o) => o.id === myBallot.ranking[0])?.name ?? '—'}
                    </span>
                  </p>
                )}
              </div>
              {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Change my vote
                </button>
                <button
                  type="button"
                  onClick={startExtra}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Hand phone to next voter
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
              <p className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                Voting has ended{myBallot ? ' — your ballot was counted' : ''}.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
          {resultsReadable ? (
            <Link
              to={`/poll/${poll.id}/results`}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
            >
              See results →
            </Link>
          ) : (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500">
              🔒 Results will be revealed when the poll closes.
            </p>
          )}
        </div>

        {isCreator && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You created this poll{isOpen ? ' — close it to finalize results.' : '.'}
            </p>
            <button
              type="button"
              disabled={statusBusy}
              onClick={() => {
                if (isOpen && !window.confirm('Close voting? Voters will no longer be able to submit or change ballots.')) return;
                setStatus(isOpen ? 'closed' : 'open');
                if (justCreated) setSearchParams({}, { replace: true });
              }}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 ${
                isOpen
                  ? 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {statusBusy ? '…' : isOpen ? 'Close voting' : 'Reopen voting'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
