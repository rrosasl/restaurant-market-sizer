/**
 * Paste your Firebase web-app config object here (Firebase console → Project
 * settings → Your apps → SDK setup and configuration). These values identify
 * the project publicly and are safe to commit — access control lives in
 * firestore.rules, not here.
 *
 * While this is null the app runs in local demo mode: everything works, but
 * polls live only in this browser's storage and links can't be shared.
 */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export const firebaseConfig: FirebaseWebConfig | null = import.meta.env.VITE_USE_EMULATOR
  ? {
      apiKey: 'demo-api-key',
      authDomain: 'demo-ranked-choice.firebaseapp.com',
      projectId: 'demo-ranked-choice',
      appId: 'demo-app-id',
    }
  : null;
