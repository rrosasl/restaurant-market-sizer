# Ranked-Choice Voting

A shareable polling app for deciding things among friends: create a poll, send
the link, everyone ranks the options from their own phone — no accounts, no
login. Results show Instant Runoff Voting (with a Sankey diagram of vote
transfers) and Borda count side by side, and every finished poll keeps a
permanent results page.

## How it works for voters

- Open the shared link, drag options into your order of preference, optionally
  type your name, submit. That's it.
- One editable ballot per device: reopening the link shows your vote and lets
  you change it until the poll closes. A "hand phone to next voter" button adds
  extra ballots when people share a device.
- The poll creator (the device that made the poll) can close voting; polls can
  optionally hide results until they're closed.

## Architecture

- React + Vite + Tailwind frontend; all counting (IRV + Borda) runs client-side
  in `src/utils/`.
- Firestore holds `polls/{id}` and `polls/{id}/ballots/{ballotId}`. There are no
  user accounts — Firebase **Anonymous Auth** silently gives each browser a
  stable uid, and `firestore.rules` enforces everything on top of it:
  - ballots are keyed by uid, so a device can only write its own ballot(s);
  - only the creator's uid can open/close a poll;
  - polls are readable by id but **not listable** (links are the only way in);
  - "hidden until closed" denies ballot reads server-side while the poll is open;
  - nothing is ever deletable — past election results are permanent.
- With no Firebase config present the app runs in **demo mode**: identical UI,
  everything stored in the browser's localStorage.

## Develop

```bash
npm install
npm run dev            # demo mode (local-only polls)
```

Full-stack development against the Firestore emulator (needs Java):

```bash
npx firebase emulators:start --project demo-ranked-choice --only auth,firestore
VITE_USE_EMULATOR=1 npm run dev
```

## Going live (one-time Firebase setup, ~10 minutes)

1. Go to <https://console.firebase.google.com> → **Add project** (any name,
   Analytics not needed).
2. **Build → Firestore Database → Create database** → production mode, pick a
   region near you.
3. **Build → Authentication → Get started → Sign-in method → Anonymous →
   Enable.** (This is invisible to users — it's just how devices get stable ids.)
4. **Project settings → Your apps → Web (`</>`)** → register the app → copy the
   `firebaseConfig` object.
5. Paste that config into `src/lib/firebase-config.ts` (replacing the `null`
   branch) and put your project id in `.firebaserc`.

### Deploying

This repo ships a GitHub Actions workflow (`.github/workflows/deploy-voting.yml`)
that builds the app and deploys the site + Firestore rules to Firebase on every
push. It authenticates with a service-account key stored as the GitHub repo
secret **`FIREBASE_SERVICE_ACCOUNT`** — the key lives in GitHub, never in the
codebase.

One-time setup:

1. Firebase console → ⚙️ **Project settings → Service accounts → Generate new
   private key**. This downloads a JSON file.
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository
   secret**. Name it `FIREBASE_SERVICE_ACCOUNT`, paste the JSON file's contents
   as the value.
3. Push (or re-run the workflow). It deploys to `https://rnkedchoice.web.app`.

If the deploy fails on a permissions error, grant that service account the
**Editor** (or **Firebase Admin**) role in Google Cloud Console → IAM, then
re-run.

To deploy by hand instead (from a machine that can reach Firebase):

```bash
npm run build
npx firebase login
npx firebase deploy --only hosting,firestore:rules
```

## Honest limitations

- No login means duplicate-vote prevention is per-device best effort — someone
  determined can vote from two devices. Fine for friends, not for anything
  contentious.
- Anyone with a poll's link can see its ballots (names included) once results
  are visible.
- "Creator" means the browser that created the poll: clear that browser's site
  data and the close/reopen controls are orphaned (the poll keeps working).
