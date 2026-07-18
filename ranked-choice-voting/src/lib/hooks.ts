import { useEffect, useState } from 'react';
import { getBackend } from './index';
import { ResultsHiddenError, type Unsubscribe } from './backend';
import type { Ballot, Poll } from '../types';

/** This device's stable id (anonymous-auth uid or local id), plus backend mode. */
export function useBackendInfo(): { deviceId: string | null; mode: 'firebase' | 'local' | null } {
  const [info, setInfo] = useState<{ deviceId: string | null; mode: 'firebase' | 'local' | null }>({
    deviceId: null,
    mode: null,
  });
  useEffect(() => {
    let cancelled = false;
    getBackend().then(async (b) => {
      const deviceId = await b.init();
      if (!cancelled) setInfo({ deviceId, mode: b.mode });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return info;
}

export function usePollWatch(pollId: string | undefined): { poll: Poll | null; loading: boolean } {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!pollId) return;
    let cancelled = false;
    let unsub: Unsubscribe | undefined;
    setLoading(true);
    getBackend().then((b) => {
      if (cancelled) return;
      unsub = b.watchPoll(pollId, (p) => {
        setPoll(p);
        setLoading(false);
      });
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [pollId]);
  return { poll, loading };
}

/**
 * `resubscribeKey` matters: a Firestore snapshot listener terminates for good
 * on a permission error, which is exactly what a hidden-until-close poll
 * produces while open. Pass the poll's status so the watch is re-established
 * the moment the poll closes and the results become readable.
 */
export function useBallotsWatch(
  pollId: string | undefined,
  resubscribeKey: string,
): {
  ballots: Ballot[];
  hidden: boolean;
  loading: boolean;
} {
  const [state, setState] = useState<{ ballots: Ballot[]; hidden: boolean; loading: boolean }>({
    ballots: [],
    hidden: false,
    loading: true,
  });
  useEffect(() => {
    if (!pollId) return;
    let cancelled = false;
    let unsub: Unsubscribe | undefined;
    setState((s) => ({ ...s, loading: true }));
    getBackend().then((b) => {
      if (cancelled) return;
      unsub = b.watchBallots(
        pollId,
        (ballots) => setState({ ballots, hidden: false, loading: false }),
        (e) => {
          if (e instanceof ResultsHiddenError) setState({ ballots: [], hidden: true, loading: false });
        },
      );
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [pollId, resubscribeKey]);
  return state;
}

export function useMyBallotWatch(pollId: string | undefined): { myBallot: Ballot | null; loading: boolean } {
  const [myBallot, setMyBallot] = useState<Ballot | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!pollId) return;
    let cancelled = false;
    let unsub: Unsubscribe | undefined;
    getBackend().then((b) => {
      if (cancelled) return;
      unsub = b.watchMyBallot(
        pollId,
        (ballot) => {
          setMyBallot(ballot);
          setLoading(false);
        },
        () => {
          // Treat a read failure as "no ballot yet" rather than hanging the page.
          setMyBallot(null);
          setLoading(false);
        },
      );
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [pollId]);
  return { myBallot, loading };
}
