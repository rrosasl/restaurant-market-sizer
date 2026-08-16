import type {
  Ballot,
  IRVResult,
  PollOption,
  RoundResult,
  RoundTransfer,
  SankeyData,
  SankeyLink,
  SankeyNode,
} from '../types';

const EXHAUSTED = 'EXHAUSTED';

function nodeId(round: number, optionId: string): string {
  return `r${round}:${optionId}`;
}

function tallyFirstChoices(
  ballots: Ballot[],
  active: Set<string>,
): { tally: Record<string, number>; exhausted: number } {
  const tally: Record<string, number> = {};
  for (const id of active) tally[id] = 0;
  let exhausted = 0;
  for (const ballot of ballots) {
    const choice = ballot.ranking.find((id) => active.has(id));
    if (choice) {
      tally[choice] += 1;
    } else {
      exhausted += 1;
    }
  }
  return { tally, exhausted };
}

/**
 * Runs Instant Runoff Voting to completion and also produces a Sankey-ready
 * node/link graph of how votes flowed between rounds. Node values and link
 * values are constructed so that, for every node after round 1, the sum of
 * incoming link values always equals the node's own value (flow is
 * conserved) — this is validated below and logged so mismatches are easy to spot.
 */
export function computeIRV(options: PollOption[], ballots: Ballot[]): IRVResult {
  const optionOrder = options.map((o) => o.id);
  const optionName = new Map(options.map((o) => [o.id, o.name]));

  const rounds: RoundResult[] = [];
  let active = new Set(optionOrder);
  let winner: string | null = null;
  let roundNum = 1;

  while (active.size > 0 && !winner) {
    const { tally, exhausted } = tallyFirstChoices(ballots, active);
    const totalActiveVotes = ballots.length - exhausted;
    const majorityThreshold = totalActiveVotes / 2;

    let maxCandidate: string | null = null;
    let maxVotes = -1;
    let minCandidate: string | null = null;
    let minVotes = Infinity;
    for (const id of optionOrder) {
      if (!active.has(id)) continue;
      if (tally[id] > maxVotes) {
        maxVotes = tally[id];
        maxCandidate = id;
      }
      if (tally[id] < minVotes) {
        minVotes = tally[id];
        minCandidate = id;
      }
    }

    const round: RoundResult = {
      round: roundNum,
      tally,
      activeCandidates: optionOrder.filter((id) => active.has(id)),
      totalActiveVotes,
      exhaustedVotes: exhausted,
      majorityThreshold,
      transfers: [],
    };

    const hasMajority = maxCandidate !== null && totalActiveVotes > 0 && maxVotes > majorityThreshold;
    const isFinalTwo = active.size <= 2;

    if (hasMajority || isFinalTwo) {
      round.winner = maxCandidate ?? undefined;
      winner = maxCandidate;
      rounds.push(round);
      break;
    }

    round.eliminated = minCandidate ?? undefined;

    const nextActive = new Set(active);
    if (minCandidate) nextActive.delete(minCandidate);

    const transferCounts: Record<string, number> = {};
    for (const ballot of ballots) {
      const currentChoice = ballot.ranking.find((id) => active.has(id));
      if (currentChoice !== minCandidate) continue;
      const nextChoice = ballot.ranking.find((id) => nextActive.has(id));
      const key = nextChoice ?? EXHAUSTED;
      transferCounts[key] = (transferCounts[key] ?? 0) + 1;
    }
    const transfers: RoundTransfer[] = Object.entries(transferCounts).map(([to, count]) => ({
      from: minCandidate as string,
      to,
      count,
    }));
    round.transfers = transfers;

    rounds.push(round);
    active = nextActive;
    roundNum += 1;
  }

  const sankey = buildSankey(rounds, optionName);
  return { rounds, winner, sankey, totalBallots: ballots.length };
}

function buildSankey(rounds: RoundResult[], optionName: Map<string, string>): SankeyData {
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];

  for (const round of rounds) {
    for (const id of round.activeCandidates) {
      nodes.push({
        id: nodeId(round.round, id),
        round: round.round,
        optionId: id,
        name: optionName.get(id) ?? id,
        value: round.tally[id] ?? 0,
      });
    }
    if (round.exhaustedVotes > 0) {
      nodes.push({
        id: nodeId(round.round, EXHAUSTED),
        round: round.round,
        optionId: EXHAUSTED,
        name: 'Exhausted',
        value: round.exhaustedVotes,
      });
    }
  }

  for (let i = 0; i < rounds.length - 1; i++) {
    const current = rounds[i];
    const next = rounds[i + 1];

    for (const id of current.activeCandidates) {
      if (id === current.eliminated) continue;
      const value = current.tally[id] ?? 0;
      if (value <= 0) continue;
      links.push({
        source: nodeId(current.round, id),
        target: nodeId(next.round, id),
        value,
        isTransfer: false,
      });
    }

    for (const t of current.transfers) {
      if (t.count <= 0) continue;
      links.push({
        source: nodeId(current.round, t.from),
        target: nodeId(next.round, t.to),
        value: t.count,
        isTransfer: true,
      });
    }

    if (current.exhaustedVotes > 0) {
      links.push({
        source: nodeId(current.round, EXHAUSTED),
        target: nodeId(next.round, EXHAUSTED),
        value: current.exhaustedVotes,
        isTransfer: false,
      });
    }
  }

  validateFlowConservation(nodes, links);

  return { nodes, links };
}

/** Dev-time sanity check: every node past round 1 must receive exactly its own value in incoming links. */
function validateFlowConservation(nodes: SankeyNode[], links: SankeyLink[]): void {
  const incoming = new Map<string, number>();
  for (const link of links) {
    incoming.set(link.target, (incoming.get(link.target) ?? 0) + link.value);
  }
  const mismatches: { node: string; expected: number; got: number }[] = [];
  for (const node of nodes) {
    if (node.round === 1) continue;
    const got = incoming.get(node.id) ?? 0;
    if (got !== node.value) {
      mismatches.push({ node: node.id, expected: node.value, got });
    }
  }
  // eslint-disable-next-line no-console
  console.log('[IRV] Sankey data', { nodes, links });
  if (mismatches.length > 0) {
    // eslint-disable-next-line no-console
    console.warn('[IRV] Sankey flow conservation mismatch', mismatches);
  }
}
