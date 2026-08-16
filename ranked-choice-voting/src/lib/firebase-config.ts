/**
 * Firebase web-app config (Firebase console → Project settings → Your apps).
 * These values identify the project publicly and are safe to commit — access
 * control lives in firestore.rules, not here.
 *
 * Build modes:
 * - default            → real Firebase project (shared polls, live links)
 * - VITE_USE_EMULATOR  → local Auth/Firestore emulators (development/tests)
 * - VITE_DEMO          → no backend at all: local demo mode in the browser
 */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
}

export const firebaseConfig: FirebaseWebConfig | null = import.meta.env.VITE_USE_EMULATOR
  ? {
      apiKey: 'demo-api-key',
      authDomain: 'demo-ranked-choice.firebaseapp.com',
      projectId: 'demo-ranked-choice',
      appId: 'demo-app-id',
    }
  : import.meta.env.VITE_DEMO
    ? null
    : {
        apiKey: 'AIzaSyA8eQAWkt93IUtQocQzsZlEv5zsB5k9x2A',
        authDomain: 'rnkedchoice.firebaseapp.com',
        projectId: 'rnkedchoice',
        storageBucket: 'rnkedchoice.firebasestorage.app',
        messagingSenderId: '91365448927',
        appId: '1:91365448927:web:85a1863175bb41f7d9dd6a',
        measurementId: 'G-Q96XC217CW',
      };
