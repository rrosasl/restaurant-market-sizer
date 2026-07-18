# Ranked-Choice Voting

A single-page app for running Instant Runoff Voting (IRV) polls, with a Sankey
diagram that visualizes how votes transfer between elimination rounds.

## Run it

```bash
npm install
npm run dev
```

## How it works

- **Setup** — name a poll and add options. State is kept in a `PollProvider`
  React context (`src/state/PollContext.tsx`) that mocks a backing store.
- **Vote** — rank the options by dragging (via `framer-motion`'s `Reorder`) or
  with the up/down buttons. Submitting resets the form immediately so the
  next voter can go right away.
- **Results** — `src/utils/irv.ts` runs Instant Runoff Voting to completion:
  each round tallies first-choice votes among still-active candidates: a
  candidate with a majority wins outright, otherwise the last-place candidate
  is eliminated and their ballots transfer to each voter's next active
  choice (or to "exhausted" if they ranked no one else). The same function
  builds a node/link graph for the Sankey diagram, and validates that every
  node's incoming links sum to its own vote count before rendering (logged to
  the console as `[IRV] Sankey data`, with a `console.warn` if that
  conservation check ever fails).

## Notable implementation detail

`d3-sankey` derives a node's value from the sum of its link weights, and
divides layout spacing by `(numColumns - 1)`. Both are naturally zero for a
poll that resolves in a single round (an outright first-round majority, or
just two options) — that node/column count of 1 produces `NaN` positions.
`SankeyChart.tsx` works around this by passing `fixedValue` so d3-sankey
trusts our own tally instead of deriving it from links, and by laying out a
single-column result by hand instead of calling d3-sankey at all.

## Stack

React + TypeScript + Vite, Tailwind CSS v4, `framer-motion` (ranking +
transitions), `recharts` (bar/pie charts), `d3-sankey` (Sankey layout).
