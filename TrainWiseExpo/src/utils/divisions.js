/**
 * #149 — Seasonal divisions. Bronze → Diamond tiers derived on-read from a
 * user's rank within the current (weekly) leaderboard. No backend: the "season"
 * is the rolling 7-day leaderboard window the Ranks screen already computes, so
 * standings — and therefore divisions — naturally promote/relegate each week.
 *
 * Tiers by percentile of rank within the ranked field (rank 1 = best):
 *   Diamond  top 5%
 *   Platinum top 15%
 *   Gold     top 35%
 *   Silver   top 65%
 *   Bronze   remainder
 */
export const DIVISIONS = [
  { key: 'diamond', name: 'Diamond', emoji: '💎', color: '#4dd0e1', maxPct: 0.05 },
  { key: 'platinum', name: 'Platinum', emoji: '🔷', color: '#90a4ae', maxPct: 0.15 },
  { key: 'gold', name: 'Gold', emoji: '🥇', color: '#ffd54f', maxPct: 0.35 },
  { key: 'silver', name: 'Silver', emoji: '🥈', color: '#cfd8dc', maxPct: 0.65 },
  { key: 'bronze', name: 'Bronze', emoji: '🥉', color: '#bcaaa4', maxPct: 1.01 },
];

// rank is 1-based; total is the size of the ranked field.
export const divisionForRank = (rank, total) => {
  if (!rank || !total || total < 1) return DIVISIONS[DIVISIONS.length - 1];
  const pct = rank / total;
  return DIVISIONS.find((d) => pct <= d.maxPct) || DIVISIONS[DIVISIONS.length - 1];
};
