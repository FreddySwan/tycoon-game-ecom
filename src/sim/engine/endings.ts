import { CATEGORIES } from '../data';
import { averageRating, categoryShares, def, liveProducts, trailing } from '../economics';
import type { CategoryId, EndingId, GameState } from '../types';
import { type ActionResult, notify } from './core';
import { ownership } from './growth';
import { goodwill } from './story';

// How the story ends depends on the kind of founder you became: the money, the market, and the people.

export const ENDINGS: Record<EndingId, { title: string; text: string[] }> = {
  sold: {
    title: 'Sold',
    text: ['You signed the papers in a glass office downtown. The buyer kept the name, the team and the cat.', 'Dad asked to see the wire transfer. Then he asked if you’d teach him how ads work.'],
  },
  unicorn: {
    title: 'Unicorn',
    text: ['Your investors are talking about an IPO. Analysts call you “the dropout who scaled”.', 'You own less of it than you used to. It’s worth more than you ever imagined.'],
  },
  king: {
    title: 'Category King',
    text: ['When people search for what you sell, they find you first. The copycats come and go; you stay.', 'Brett Lawson sends a LinkedIn request. You accept. You’re generous like that.'],
  },
  beloved: {
    title: 'Beloved Brand',
    text: ['Not the biggest company in the world. Maybe the best-loved one. Customers write you letters.', 'Sam runs the warehouse, Maya runs design, and Sunday dinners at Mom’s are loud again.'],
  },
  burnout: {
    title: 'The Price of It',
    text: ['The business works. The numbers are real. But you can’t remember the last time you saw Sam or Maya, and Dad stopped calling again.', 'You proved you could make money. Next, maybe, you prove you can have a life.'],
  },
  builder: {
    title: 'A Real Company',
    text: ['You built a real company from a studio apartment and $4,000 that wasn’t yours.', 'Dad keeps a printout of your first sale on the fridge. He pretends it isn’t his.'],
  },
};

/** The company's value: a multiple of yearly sales that rises with how profitable it is. */
export function valuation(s: GameState): number {
  const y = trailing(s, 360);
  const margin = y.revenue ? Math.max(0, y.profit / y.revenue) : 0;
  return Math.round((y.revenue * (0.8 + margin * 6)) / 10000) * 10000;
}

function topShare(s: GameState): { cat: CategoryId; share: number } | null {
  const cats = [...new Set(liveProducts(s).map((id) => def(s, id).category))];
  return cats.map((cat) => ({ cat, share: categoryShares(s, cat).mine })).sort((a, b) => b.share - a.share)[0] ?? null;
}

/** Which ending fits this founder. */
export function endingFor(s: GameState): EndingId {
  const raised = s.funding?.raised ?? [];
  const yearRevenue = trailing(s, 360).revenue;
  const friendsOnTeam = s.people.filter((p) => p.friend).length;
  const top = topShare(s);
  if (goodwill(s) < 30 && s.story.bond.dad < 40) return 'burnout';
  if (raised.includes('seriesB') && yearRevenue >= 40_000_000) return 'unicorn';
  if (!raised.length && friendsOnTeam >= 1 && averageRating(s) >= 4.5) return 'beloved';
  if (s.milestones.rival_acquired || (top && top.share >= 0.7)) return 'king';
  return 'builder';
}

/** Story finale: reaching the last chapter settles the ending (you can keep playing). */
export function checkEnding(s: GameState): void {
  if (s.ending || s.story.chapter !== 'epilogue') return;
  s.ending = { id: endingFor(s), day: s.day };
  notify(s, 'milestone', `🎓 Ending: ${ENDINGS[s.ending.id].title}`, true);
}

/** Sell the company (stage 4+). You get your share of its value; the game ends. */
export function sellCompany(s: GameState): ActionResult {
  if (s.stage < 4) return 'Buyers only look at companies at stage 4 and up.';
  if (s.ending?.id === 'sold') return 'Already sold.';
  const value = valuation(s);
  if (value < 1_000_000) return 'Nobody will pay much for this yet: grow sales and margins first.';
  const payout = Math.round(value * ownership(s));
  s.ending = { id: 'sold', day: s.day, payout };
  notify(s, 'milestone', `🎓 You sold the company for $${value.toLocaleString()}. Your share: $${payout.toLocaleString()}.`, true);
  return null;
}

export function dismissEnding(s: GameState): ActionResult {
  if (s.ending) s.ending.seen = true;
  return null;
}

export { CATEGORIES };
