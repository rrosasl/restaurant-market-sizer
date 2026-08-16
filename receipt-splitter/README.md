# Split the bill — Receipt Splitter

A mobile-first web app for splitting a restaurant bill among friends. Enter the
bill (by hand, or by photographing the receipt), tap each person onto the lines
they had, and get per-person totals that add up to the bill exactly.

English by default, with an English/Español switch right on the start screen.
Installs to the home screen and works offline for everything except reading a
receipt photo.

## Money, exactly

This is the part the app exists to get right. `2 X SPRITZ APEROL €14.00` split
three ways is €4.67, €4.67 and €4.66 — never three times €4.67, which sums to
€14.01 and compounds into a visible error over a 25-line dinner bill.

- Every amount is an **integer number of cents**. Floats never touch money.
  Parsing happens at the input edge (`src/lib/money.ts`), formatting at render.
- Splits use **largest remainder**, so per-person totals always sum to the bill
  total exactly, for any combination of people, weights and extras
  (`src/lib/allocate.ts`).
- Ties break toward the lowest index, so a bill never reshuffles between
  renders.

`npm test` covers this with 55 tests, including the €14.00-over-3 case,
remainders spread across several lines, and randomised bills asserting that
per-person totals plus unassigned always equal items plus extras.

## Run it locally

```bash
cd receipt-splitter
npm install
npm run dev      # http://localhost:5173
npm test         # money and allocation tests
npm run build    # production build into dist/
```

`vite dev` serves the front end only. Reading receipts needs the Cloud
Function, so to work on that path build and run the emulators instead:

```bash
npm run build
cd functions && npm install && npm run serve
```

## Reading a receipt

Photographing a receipt is the one thing that needs the network. The flow:

1. The photo is taken with a plain `<input type="file" capture="environment">` —
   camera or gallery through one control, no `getUserMedia` and no permission
   prompts.
2. It is downscaled client-side to 1568px on the long edge and re-encoded as
   JPEG at q0.8. Raw phone photos are 4–8 MB; this brings them to 150–400 KB,
   and the model reads no more detail above that resolution anyway.
3. It goes to `functions/src/parseReceipt.ts`, the only code that holds the API
   key. It calls Claude Sonnet with a JSON schema (structured outputs), so the
   response cannot come back as prose or markdown.
4. The client validates the response anyway, field by field, and shows a
   "couldn't read this" state with manual entry rather than crashing on
   anything unexpected.

The prompt does not assume English or any particular layout — receipts in
Italian, Spanish, German and French all read correctly, and item names come back
in their original language.

**Always check the lines afterwards.** OCR on faded thermal paper gets things
wrong, which is why the review screen makes every field editable and shows a
running comparison against the printed total.

Nothing about the image is stored or logged anywhere. The function holds it in
memory for one request and discards it; the error log records failure types
only, never request bodies.

### Abuse protection, honestly described

The endpoint is public by URL, so it is guarded by three things:

- **A shared access code**, checked server-side against `ACCESS_CODE` with a
  constant-time comparison. Users enter it once per device.
- **A request size cap** rejecting base64 payloads over 2 MB.
- **A per-IP rate limit** of 20 receipts/hour — **best-effort only.** It is an
  in-memory counter inside a stateless, horizontally-scaled function: it resets
  on cold start and one instance cannot see its siblings, so it bounds a single
  instance rather than a caller's true rate. It raises the cost of casual
  abuse; the access code is what actually keeps strangers out. Making it real
  means putting the counter in a shared store — Firestore is already available
  in the project. `hitRateLimit` in `functions/src/parseReceipt.ts` is the only
  function to replace.

Wrong code, rate limit hit, service down, no connection: each shows a specific
explanation and offers manual entry. The app never fails silently.

## Deploy to Firebase

Hosting serves the app at `https://<project-id>.web.app` — public, no sign-in,
usable by anyone with the link. A Cloud Function serves `/api/parse-receipt`
behind a Hosting rewrite, so the whole thing is one origin.

### Easiest path: push-to-deploy, no CLI

A GitHub Actions workflow
(`.github/workflows/deploy-receipt-splitter.yml`) builds, tests and deploys on
every push. One-time setup, entirely in the browser:

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add
   project** (Hosting is free; no billing account needed).
2. Project settings → **Service accounts** → **Generate new private key**.
3. On the GitHub repo: Settings → Secrets and variables → Actions →
   - new **secret** `FIREBASE_SERVICE_ACCOUNT` — paste the downloaded JSON
   - new **variable** `FIREBASE_PROJECT_ID` — the project id from step 1
4. Push, or run the workflow from the Actions tab. The app is live at
   `https://<project-id>.web.app`.

Until those two values exist the workflow still runs build and tests and skips
the deploy, so it doubles as CI from day one.

### Or from a terminal

```bash
npm i -g firebase-tools     # once
firebase login              # once
cd receipt-splitter
firebase use --add          # once, pick the project; writes .firebaserc

npm install && npm run build
firebase deploy --only hosting
```

Add the Cloud Function (receipt photos) later with
`cd functions && npm install && cd .. && firebase deploy --only functions` —
this is the one part that needs the Blaze plan.

### The billing bit, up front

**Hosting is free** on the Spark plan, and the whole manual splitter works
there — people, items, assignment, totals, history. Deploy today and it is
live.

**Cloud Functions requires the Blaze plan**, which means attaching a billing
account. Receipt parsing is the only thing that needs it. The free monthly
allowance covers this app comfortably — a few hundred receipts is far below the
2M invocation tier — so the realistic bill is the Anthropic API usage, not
Google's.

Until the function is deployed, the camera button reports that the reading
service is unavailable and offers manual entry. The app is fully usable in that
state; it just cannot read photos.

### The two secrets

Both live in Secret Manager, not in plain config, so they never appear in the
deployed source or in logs:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set ACCESS_CODE
```

| Secret              | What it is                                                        |
| ------------------- | ----------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Your Anthropic API key. Only the function ever sees it.            |
| `ACCESS_CODE`       | A shared password you invent. Users type it once per device.       |

Neither reaches the browser. They are read inside the function at runtime, and
there is no `VITE_`-prefixed variant of either — Vite only inlines `VITE_*` into
the bundle, so a secret cannot leak into the front end by accident.

Redeploy the function after changing a secret (`firebase deploy --only
functions`); running instances hold the value they booted with. To rotate the
access code, set it again and redeploy — every device then needs the new code
re-entered.

## Handing the app to a friend

1. Send them the URL — `https://<project-id>.web.app`.
2. Tell them to open it in their phone's browser and choose **Add to Home
   Screen** (iOS: Share → Add to Home Screen; Android: the install prompt or
   ⋮ → Install app). It then behaves like an app, full screen and offline.
3. Send them the access code separately. They enter it once, in **Settings →
   Access code**, and it stays on their device.

That is the whole handover. There are no accounts, and nothing they do reaches
you: their bills, their friend list and their settings live in their own
browser's `localStorage`. Two people using the app do not share anything.

The access code exists only to stop strangers from spending your API credits.
If you would rather not hand it out at all, the app is fully usable without it —
they just enter bills by hand instead of photographing them.

## What it does not do

By design: no settlement graph of who owes whom, no payment links, no share
links, no live multi-user editing of one bill, no login, no currency
conversion, no discounts.

## Layout

```
receipt-splitter/
├── functions/              Cloud Function, deployed separately
│   └── src/
│       ├── index.ts        entry point, declares region and secrets
│       └── parseReceipt.ts the only code that holds the API key
├── public/icons/           app icons for the home screen
├── src/
│   ├── lib/
│   │   ├── allocate.ts     largest-remainder splitting
│   │   ├── money.ts        cents <-> text, the only crossing point
│   │   ├── totals.ts       per-person totals, extras, reconciliation
│   │   ├── receiptParser.ts  the whole parsing capability, one interface
│   │   ├── imageResize.ts  downscale + JPEG encode before upload
│   │   ├── exportText.ts   plain-text export for the group chat
│   │   └── storage.ts      localStorage: bills, history, roster, settings
│   ├── screens/            start, capture, people, items, assign, totals, settings
│   ├── state/billReducer.ts  every mutation of the working bill
│   ├── strings.ts          all user-facing text, es + en
│   └── types.ts            Bill, Item, Person, Extra, Assignments
└── firebase.json           hosting, /api rewrite, caching and headers
```

## Screen flow

```
Start ─┬─ Capture ──┐
       │            ├─→ Items (review + reconcile) ─→ People ─┐
       └─ People ───┴─→ Items ─────────────────────────────────┴─→ Assign ─→ Totals
       │
       └─ History (open a past bill straight into Assign)
```

Both entry paths converge on Assign: entering by hand adds people first, a photo
produces the lines first. Whichever is missing is asked for next.
