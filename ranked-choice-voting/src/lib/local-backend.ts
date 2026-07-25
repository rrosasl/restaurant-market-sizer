import { readStored, writeStored } from './storage';
import type { Backend, CreatePollInput, Unsubscribe } from './backend';
import { ResultsHiddenError } from './backend';
import type { Ballot, Poll } from '../types';

const DEVICE_KEY = 'rcv-device-id';
const POLLS_KEY = 'rcv-local-polls';
const ballotsKey = (pollId: string) => `rcv-local-ballots-${pollId}`;

function randomId(len = 20): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function readJson<T>(key: string, fallback: T): T {
  const raw = readStored(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Demo-mode backend: same contract as Firebase, but everything lives in this
 * browser's localStorage. Cross-tab updates ride the native 'storage' event;
 * same-tab updates go through an EventTarget since 'storage' doesn't fire in
 * the writing tab.
 */
export class LocalBackend implements Backend {
  readonly mode = 'local' as const;
  private events = new EventTarget();
  private uid: string;

  constructor() {
    let uid = readStored(DEVICE_KEY);
    if (!uid) {
      uid = `local-${randomId(12)}`;
      writeStored(DEVICE_KEY, uid);
    }
    this.uid = uid;
    window.addEventListener('storage', (e) => {
      if (e.key) this.events.dispatchEvent(new CustomEvent('change', { detail: e.key }));
    });
  }

  private emit(key: string) {
    this.events.dispatchEvent(new CustomEvent('change', { detail: key }));
  }

  private onKey(key: string, fn: () => void): Unsubscribe {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === key) fn();
    };
    this.events.addEventListener('change', handler);
    return () => this.events.removeEventListener('change', handler);
  }

  async init(): Promise<string> {
    return this.uid;
  }

  async createPoll(input: CreatePollInput): Promise<Poll> {
    const poll: Poll = {
      id: randomId(),
      name: input.name,
      options: input.options.map((name, i) => ({ id: `opt${i + 1}`, name })),
      status: 'open',
      resultsVisibility: input.resultsVisibility,
      creatorUid: this.uid,
      createdAt: Date.now(),
    };
    const polls = readJson<Record<string, Poll>>(POLLS_KEY, {});
    polls[poll.id] = poll;
    writeStored(POLLS_KEY, JSON.stringify(polls));
    this.emit(POLLS_KEY);
    return poll;
  }

  async getPoll(id: string): Promise<Poll | null> {
    return readJson<Record<string, Poll>>(POLLS_KEY, {})[id] ?? null;
  }

  watchPoll(id: string, cb: (poll: Poll | null) => void): Unsubscribe {
    const push = () => cb(readJson<Record<string, Poll>>(POLLS_KEY, {})[id] ?? null);
    push();
    return this.onKey(POLLS_KEY, push);
  }

  watchBallots(pollId: string, cb: (ballots: Ballot[]) => void, onError?: (e: Error) => void): Unsubscribe {
    const push = () => {
      const poll = readJson<Record<string, Poll>>(POLLS_KEY, {})[pollId];
      // Mirror the server-enforced rule so demo mode behaves like the real thing.
      if (poll && poll.status === 'open' && poll.resultsVisibility === 'after_close') {
        onError?.(new ResultsHiddenError());
        return;
      }
      cb(readJson<Ballot[]>(ballotsKey(pollId), []));
    };
    push();
    const offBallots = this.onKey(ballotsKey(pollId), push);
    const offPolls = this.onKey(POLLS_KEY, push);
    return () => {
      offBallots();
      offPolls();
    };
  }

  watchMyBallot(pollId: string, cb: (ballot: Ballot | null) => void): Unsubscribe {
    const push = () => {
      const ballots = readJson<Ballot[]>(ballotsKey(pollId), []);
      cb(ballots.find((b) => b.id === this.uid) ?? null);
    };
    push();
    return this.onKey(ballotsKey(pollId), push);
  }

  async submitBallot(
    pollId: string,
    ranking: string[],
    voterName: string | null,
    slot: 'primary' | 'extra',
  ): Promise<void> {
    const poll = await this.getPoll(pollId);
    if (!poll || poll.status !== 'open') throw new Error('This poll is not open for voting.');
    const id = slot === 'primary' ? this.uid : `${this.uid}-${randomId(8)}`;
    const ballots = readJson<Ballot[]>(ballotsKey(pollId), []).filter((b) => b.id !== id);
    ballots.push({ id, ranking, voterName: voterName || null, submittedAt: Date.now() });
    writeStored(ballotsKey(pollId), JSON.stringify(ballots));
    this.emit(ballotsKey(pollId));
  }

  async setPollStatus(pollId: string, status: 'open' | 'closed'): Promise<void> {
    const polls = readJson<Record<string, Poll>>(POLLS_KEY, {});
    const poll = polls[pollId];
    if (!poll) throw new Error('Poll not found.');
    if (poll.creatorUid !== this.uid) throw new Error('Only the poll creator can do that.');
    polls[pollId] = { ...poll, status };
    writeStored(POLLS_KEY, JSON.stringify(polls));
    this.emit(POLLS_KEY);
  }
}
