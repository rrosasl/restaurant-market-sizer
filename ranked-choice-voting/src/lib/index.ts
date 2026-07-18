import type { Backend } from './backend';
import { firebaseConfig } from './firebase-config';
import { LocalBackend } from './local-backend';

// Memoize the PROMISE, not the instance: several hooks call getBackend()
// concurrently on first render, and an instance-based check would let each of
// them construct its own backend — with Firebase that means concurrent
// signInAnonymously calls racing to replace currentUser, leaving earlier
// callers holding a uid whose token is no longer the active one (every write
// they make is then denied by the uid-keyed security rules).
let backendPromise: Promise<Backend> | null = null;

/** The app-wide backend: Firebase when configured, local demo mode otherwise. */
export function getBackend(): Promise<Backend> {
  if (!backendPromise) {
    backendPromise = (async () => {
      if (firebaseConfig) {
        // Dynamic import keeps the Firebase SDK out of the bundle's critical
        // path in demo mode.
        const { FirebaseBackend } = await import('./firebase-backend');
        const backend = new FirebaseBackend(firebaseConfig, Boolean(import.meta.env.VITE_USE_EMULATOR));
        await backend.init();
        return backend;
      }
      const backend = new LocalBackend();
      await backend.init();
      return backend;
    })();
  }
  return backendPromise;
}
