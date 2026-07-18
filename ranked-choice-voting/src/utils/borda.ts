import type { Ballot, BordaResult, BordaScore, PollOption } from '../types';

/**
 * Classic Borda count: with N candidates, a ballot awards N-1 points to the
 * voter's 1st choice, N-2 to their 2nd, down to 0 for last. Points are
 * summed across all ballots; the highest total wins. Unlike IRV there's no
 * elimination — every ranked position on every ballot contributes, which is
 * what makes Borda reward broad, consensus support rather than first-choice
 * majorities.
 */
export function computeBorda(options: PollOption[], ballots: Ballot[]): BordaResult {
  const optionOrder = options.map((o) => o.id);
  const n = optionOrder.length;
  const maxRankPoints = Math.max(0, n - 1);

  const byRank = new Map<string, number[]>(optionOrder.map((id) => [id, new Array(n).fill(0)]));

  for (const ballot of ballots) {
    ballot.ranking.forEach((optionId, rankIndex) => {
      const points = maxRankPoints - rankIndex;
      const ranks = byRank.get(optionId);
      if (ranks && rankIndex < n) ranks[rankIndex] += points;
    });
  }

  const scores: BordaScore[] = optionOrder.map((optionId) => {
    const ranks = byRank.get(optionId) ?? new Array(n).fill(0);
    return { optionId, byRank: ranks, total: ranks.reduce((a, b) => a + b, 0) };
  });

  scores.sort((a, b) => b.total - a.total);

  const winner = scores.length > 0 ? scores[0].optionId : null;
  const maxPossible = maxRankPoints * ballots.length;

  return { scores, winner, maxPossible, totalBallots: ballots.length };
}
