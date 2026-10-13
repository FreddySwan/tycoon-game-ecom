import type { StageId } from '../types';

export type CampaignKind = 'podcast' | 'billboards' | 'tv';

/** Big brand campaigns: expensive, slow-burning awareness that lifts organic sales for months. */
export const BRAND_CAMPAIGNS: Record<CampaignKind, { name: string; cost: number; days: number; awareness: number; minStage: StageId; rank: number; desc: string }> = {
  podcast: { name: 'Podcast sponsorships', cost: 20000, days: 30, awareness: 40000, minStage: 3, rank: 0, desc: 'Host-read ads on 6 shows your customers love. Trusted, targeted.' },
  billboards: { name: 'Billboards in 3 cities', cost: 80000, days: 45, awareness: 170000, minStage: 4, rank: 0.04, desc: 'Big, visible, and great for marketplace search lift.' },
  tv: { name: 'National TV spot', cost: 300000, days: 60, awareness: 750000, minStage: 5, rank: 0.08, desc: 'Prime-time reach. Everyone’s mom will have heard of you.' },
};

export type RoundId = 'seed' | 'seriesA' | 'seriesB';

/** Venture rounds: cash for a slice of the company, and a board that expects growth. */
export const ROUNDS: Record<RoundId, { name: string; minStage: StageId; raise: number; equity: number; growth: number; months: number; needRevenue: number }> = {
  seed: { name: 'Seed round', minStage: 2, raise: 250000, equity: 0.15, growth: 2, months: 6, needRevenue: 30000 },
  seriesA: { name: 'Series A', minStage: 3, raise: 2000000, equity: 0.2, growth: 2, months: 6, needRevenue: 200000 },
  seriesB: { name: 'Series B', minStage: 4, raise: 10000000, equity: 0.2, growth: 1.8, months: 6, needRevenue: 1000000 },
};
export const ROUND_ORDER: RoundId[] = ['seed', 'seriesA', 'seriesB'];
