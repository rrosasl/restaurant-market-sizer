export type PollStatus = 'setup' | 'voting';

export interface PollOption {
  id: string;
  name: string;
}

export interface Ballot {
  id: string;
  /** Ordered list of option ids, index 0 = 1st choice. Always a full ranking of the poll's options. */
  ranking: string[];
  submittedAt: number;
}

export interface Poll {
  id: string;
  name: string;
  options: PollOption[];
  status: PollStatus;
  ballots: Ballot[];
}

export interface RoundTransfer {
  from: string;
  to: string | 'EXHAUSTED';
  count: number;
}

export interface RoundResult {
  round: number;
  /** First-choice tally among still-active candidates for this round, keyed by option id. */
  tally: Record<string, number>;
  /** Candidates still in the running as of this round. */
  activeCandidates: string[];
  totalActiveVotes: number;
  exhaustedVotes: number;
  majorityThreshold: number;
  winner?: string;
  eliminated?: string;
  /** How the eliminated candidate's votes were redistributed into the next round. */
  transfers: RoundTransfer[];
}

export interface SankeyNode {
  id: string;
  round: number;
  optionId: string | 'EXHAUSTED';
  name: string;
  value: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  /** True if this link represents votes moving away from an eliminated candidate. */
  isTransfer: boolean;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export interface IRVResult {
  rounds: RoundResult[];
  winner: string | null;
  sankey: SankeyData;
  totalBallots: number;
}

export type CountingMethod = 'irv' | 'borda';

export interface BordaScore {
  optionId: string;
  /** Points earned per rank position, index 0 = points from being ranked 1st. */
  byRank: number[];
  total: number;
}

export interface BordaResult {
  /** Descending by total points. */
  scores: BordaScore[];
  winner: string | null;
  maxPossible: number;
  totalBallots: number;
}
