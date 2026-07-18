import { useEffect, useState } from 'react';
import { getBackend } from './index';
import { ResultsHiddenError, type Unsubscribe } from './backend';
import type { Ballot, Poll } from '../types';

const WATCH_RETRIES = 4;

/** This device's stable id (anonymous-auth uid or local id), plus backend mode. */
export function useBackendInfo(): { deviceId: string | null; mode: 'firebase' | 'local' | null } {
  const [info, setInfo] = useState<{ deviceId: string | null; mode: 'firebase' | 'local' | null }>({
    deviceId: null,
    mode: null,
  });
  useEffect(() => {
    let cancelled = false;
    getBackend()
      .then(async (b) => {
        const deviceId = await b.init();
        if (!cancelled) setInfo({ deviceId, mode: b.mode });
      })
      .catch(() => {
        // Backend init failed (offline?) — leave info empty; pages still render.
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);

    const subscribe = (attempt: number) => {
      getBackend()
        .then((b) => {
          if (cancelled) return;
          unsub = b.watchPoll(
            pollId,
            (p) => {
              setPoll(p);
              setLoading(false);
            },
            () => {
              // A Firestore listener dies for good on error — resubscribe with backoff.
              if (!cancelled && attempt < WATCH_RETRIES) {
                timer = setTimeout(() => subscribe(attempt + 1), 1000 * (attempt + 1));
              } else if (!cancelled) {
                setLoading(false);
              }
            },
          );
        })
        .catch(() => {
          if (!cancelled && attempt < WATCH_RETRIES) {
            timer = setTimeout(() => subscribe(attempt + 1), 1000 * (attempt + 1));
          } else if (!cancelled) {
            setLoading(false);
          }
        });
    };
    subscribe(0);

    return () => {
      cancelled = true;
      unsub?.();
      if (timer) clearTimeout(timer);
    };
  }, [pollId]);
  return { poll, loading };
}

/**
 * All ballots for a poll. A permission error only means "results hidden" when
 * the poll is actually configured that way — any other denial is treated as a
 * transient startup race (fresh anonymous token on a slow connection) and the
 * watch re-establishes itself with backoff, because a Firestore listener
 * terminates permanently on its first error.
 */
export function useBallotsWatch(
  pollId: string | undefined,
  poll: Poll | null,
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
  const expectHidden = poll !== null && poll.status === 'open' && poll.resultsVisibility === 'after_close';
  const resubscribeKey = poll ? `${poll.status}-${poll.resultsVisibility}` : '';

  useEffect(() => {
    if (!pollId) return;
    let cancelled = false;
    let unsub: Unsubscribe | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState((s) => ({ ...s, loading: true }));

    const subscribe = (attempt: number) => {
      getBackend()
        .then((b) => {
          if (cancelled) return;
          unsub = b.watchBallots(
            pollId,
            (ballots) => setState({ ballots, hidden: false, loading: false }),
            (e) => {
              if (cancelled) return;
              if (e instanceof ResultsHiddenError && expectHidden) {
                setState({ ballots: [], hidden: true, loading: false });
              } else if (attempt < WATCH_RETRIES) {
                timer = setTimeout(() => subscribe(attempt + 1), 1000 * (attempt + 1));
              } else {
                // Give up quietly: show whatever we last had rather than an error.
                setState((s) => ({ ...s, loading: false }));
              }
            },
          );
        })
        .catch(() => {
          if (!cancelled && attempt < WATCH_RETRIES) {
            timer = setTimeout(() => subscribe(attempt + 1), 1000 * (attempt + 1));
          } else if (!cancelled) {
            setState((s) => ({ ...s, loading: false }));
          }
        });
    };
    subscribe(0);

    return () => {
      cancelled = true;
      unsub?.();
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollId, resubscribeKey, expectHidden]);
  return state;
}

export function useMyBallotWatch(pollId: string | undefined): { myBallot: Ballot | null; loading: boolean } {
  const [myBallot, setMyBallot] = useState<Ballot | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!pollId) return;
    let cancelled = false;
    let unsub: Unsubscribe | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const subscribe = (attempt: number) => {
      getBackend()
        .then((b) => {
          if (cancelled) return;
          unsub = b.watchMyBallot(
            pollId,
            (ballot) => {
              setMyBallot(ballot);
              setLoading(false);
            },
            () => {
              if (!cancelled && attempt < WATCH_RETRIES) {
                timer = setTimeout(() => subscribe(attempt + 1), 1000 * (attempt + 1));
              } else if (!cancelled) {
                // Treat persistent failure as "no ballot yet" rather than hanging the page.
                setMyBallot(null);
                setLoading(false);
              }
            },
          );
        })
        .catch(() => {
          if (!cancelled && attempt < WATCH_RETRIES) {
            timer = setTimeout(() => subscribe(attempt + 1), 1000 * (attempt + 1));
          } else if (!cancelled) {
            setMyBallot(null);
            setLoading(false);
          }
        });
    };
    subscribe(0);

    return () => {
      cancelled = true;
      unsub?.();
      if (timer) clearTimeout(timer);
    };
  }, [pollId]);
  return { myBallot, loading };
}
