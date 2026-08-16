import type { Ballot, Poll, ResultsVisibility } from '../types';

export interface CreatePollInput {
  name: string;
  /** Option names in display order. */
  options: string[];
  resultsVisibility: ResultsVisibility;
}

export type Unsubscribe = () => void;

/**
 * Everything the UI needs from storage, implemented twice: FirebaseBackend
 * (shared polls, real links) and LocalBackend (this-device-only demo mode when
 * no Firebase config is present). Pages talk only to this interface.
 */
export interface Backend {
  readonly mode: 'firebase' | 'local';
  /** Resolves this device's stable id (Firebase anonymous-auth uid, or a generated local id). */
  init(): Promise<string>;
  createPoll(input: CreatePollInput): Promise<Poll>;
  getPoll(id: string): Promise<Poll | null>;
  watchPoll(id: string, cb: (poll: Poll | null) => void, onError?: (e: Error) => void): Unsubscribe;
  /**
   * All ballots for a poll. When the poll hides results until close, the
   * server denies this read while the poll is open — that surfaces through
   * onError, which the UI treats as "results hidden", not a failure.
   */
  watchBallots(pollId: string, cb: (ballots: Ballot[]) => void, onError?: (e: Error) => void): Unsubscribe;
  /** This device's own primary ballot — readable even when overall results are hidden. */
  watchMyBallot(pollId: string, cb: (ballot: Ballot | null) => void, onError?: (e: Error) => void): Unsubscribe;
  /**
   * slot 'primary' writes/overwrites this device's own ballot;
   * 'extra' adds a one-off ballot for pass-the-phone voting.
   */
  submitBallot(
    pollId: string,
    ranking: string[],
    voterName: string | null,
    slot: 'primary' | 'extra',
  ): Promise<void>;
  setPollStatus(pollId: string, status: 'open' | 'closed'): Promise<void>;
}

export class ResultsHiddenError extends Error {
  constructor() {
    super('Results are hidden until this poll closes.');
    this.name = 'ResultsHiddenError';
  }
}
