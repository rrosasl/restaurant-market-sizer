import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type Timestamp,
} from 'firebase/firestore';
import type { Backend, CreatePollInput, Unsubscribe } from './backend';
import { ResultsHiddenError } from './backend';
import type { Ballot, Poll } from '../types';
import type { FirebaseWebConfig } from './firebase-config';

function millis(value: unknown): number {
  const ts = value as Timestamp | null | undefined;
  return typeof ts?.toMillis === 'function' ? ts.toMillis() : Date.now();
}

function snapToPoll(snap: DocumentSnapshot<DocumentData>): Poll | null {
  const data = snap.data();
  if (!data) return null;
  return {
    id: snap.id,
    name: data.name ?? '',
    options: data.options ?? [],
    status: data.status ?? 'open',
    resultsVisibility: data.resultsVisibility ?? 'live',
    creatorUid: data.creatorUid ?? '',
    createdAt: millis(data.createdAt),
  };
}

function snapToBallot(snap: DocumentSnapshot<DocumentData>): Ballot | null {
  const data = snap.data();
  if (!data) return null;
  return {
    id: snap.id,
    ranking: data.ranking ?? [],
    voterName: data.voterName ?? null,
    submittedAt: millis(data.submittedAt),
  };
}

function isPermissionDenied(e: unknown): boolean {
  return (e as { code?: string })?.code === 'permission-denied';
}

export class FirebaseBackend implements Backend {
  readonly mode = 'firebase' as const;
  private auth: Auth;
  private db: Firestore;
  private uid: string | null = null;
  private initPromise: Promise<string> | null = null;

  constructor(config: FirebaseWebConfig, useEmulator: boolean) {
    const app = initializeApp(config);
    this.auth = getAuth(app);
    this.db = getFirestore(app);
    if (useEmulator) {
      connectAuthEmulator(this.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(this.db, '127.0.0.1', 8080);
    }
  }

  init(): Promise<string> {
    // Single-flight: concurrent init() calls must never each run
    // signInAnonymously — a second sign-in replaces currentUser and orphans
    // the first caller's uid, which the uid-keyed rules then reject.
    if (!this.initPromise) {
      this.initPromise = (async () => {
        // Anonymous auth is invisible to the user: no login UI, just a stable
        // per-browser uid that the rules key ballots and admin rights on.
        const existing = await new Promise<string | null>((resolve) => {
          const stop = onAuthStateChanged(this.auth, (user) => {
            stop();
            resolve(user?.uid ?? null);
          });
        });
        const uid = existing ?? (await signInAnonymously(this.auth)).user.uid;
        this.uid = uid;
        return uid;
      })();
    }
    return this.initPromise;
  }

  private requireUid(): string {
    if (!this.uid) throw new Error('Backend not initialized');
    return this.uid;
  }

  async createPoll(input: CreatePollInput): Promise<Poll> {
    const uid = this.requireUid();
    const options = input.options.map((name, i) => ({ id: `opt${i + 1}`, name }));
    const ref = await addDoc(collection(this.db, 'polls'), {
      name: input.name,
      options,
      status: 'open',
      resultsVisibility: input.resultsVisibility,
      creatorUid: uid,
      createdAt: serverTimestamp(),
    });
    return {
      id: ref.id,
      name: input.name,
      options,
      status: 'open',
      resultsVisibility: input.resultsVisibility,
      creatorUid: uid,
      createdAt: Date.now(),
    };
  }

  async getPoll(id: string): Promise<Poll | null> {
    const snap = await getDoc(doc(this.db, 'polls', id));
    return snap.exists() ? snapToPoll(snap) : null;
  }

  watchPoll(id: string, cb: (poll: Poll | null) => void, onError?: (e: Error) => void): Unsubscribe {
    return onSnapshot(
      doc(this.db, 'polls', id),
      (snap) => cb(snap.exists() ? snapToPoll(snap) : null),
      (e) => onError?.(e),
    );
  }

  watchBallots(pollId: string, cb: (ballots: Ballot[]) => void, onError?: (e: Error) => void): Unsubscribe {
    return onSnapshot(
      collection(this.db, 'polls', pollId, 'ballots'),
      (snap) => cb(snap.docs.map((d) => snapToBallot(d)).filter((b): b is Ballot => b !== null)),
      (e) => onError?.(isPermissionDenied(e) ? new ResultsHiddenError() : e),
    );
  }

  watchMyBallot(pollId: string, cb: (ballot: Ballot | null) => void, onError?: (e: Error) => void): Unsubscribe {
    const uid = this.requireUid();
    return onSnapshot(
      doc(this.db, 'polls', pollId, 'ballots', uid),
      (snap) => cb(snap.exists() ? snapToBallot(snap) : null),
      (e) => onError?.(e),
    );
  }

  async submitBallot(
    pollId: string,
    ranking: string[],
    voterName: string | null,
    slot: 'primary' | 'extra',
  ): Promise<void> {
    const uid = this.requireUid();
    const ballotId = slot === 'primary' ? uid : `${uid}-${Math.random().toString(36).slice(2, 10)}`;
    await setDoc(doc(this.db, 'polls', pollId, 'ballots', ballotId), {
      ranking,
      voterName: voterName || null,
      submittedAt: serverTimestamp(),
    });
  }

  async setPollStatus(pollId: string, status: 'open' | 'closed'): Promise<void> {
    await updateDoc(doc(this.db, 'polls', pollId), { status });
  }
}
