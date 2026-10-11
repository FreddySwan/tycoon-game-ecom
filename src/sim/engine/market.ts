import { dailyAdBudget, def, difficultyOf, liveProducts } from '../economics';
import { chance, normal, pick } from '../rng';
import type { Difficulty, GameState } from '../types';
import { type ActionResult, notify } from './core';

const AD_SHOCKS = ['A well-funded brand just entered the ad auction for', 'Copycats are bidding on the same audiences as', 'Scrollr changed its algorithm: reach got pricier for'];
const COST_SHOCKS = ['Raw material prices jumped for', 'Your factory passed on a wage increase for', 'New import tariffs hit'];

/**
 * Markets don't stand still. Each product you sell drifts: ads get pricier as you (and copycats) scale it,
 * suppliers creep prices up, and now and then something jumps. Harder difficulties drift faster, which is what
 * pushes you to keep finding new products instead of riding one forever.
 */
export function marketDrift(s: GameState): void {
  const D = difficultyOf(s);
  for (const pid of liveProducts(s)) {
    const p = s.products[pid];
    if (!p.sold) continue;
    const m = (p.market ??= { ad: 1, cost: 1 });
    const spend = dailyAdBudget(s, pid);
    const pressure = 1 + D.saturation * Math.min(2, Math.log10(1 + spend / 50));
    m.ad *= Math.exp(D.adDrift * pressure + D.volatility * normal(s));
    m.cost *= Math.exp(D.costDrift + D.volatility * 0.4 * normal(s));
    m.share = Math.max(0.3, (m.share ?? 1) * Math.exp(-D.shareDrift * pressure));
    if (chance(s, D.shockChance)) {
      if (chance(s, 0.6)) {
        const jump = 1.12 + Math.abs(normal(s)) * 0.1;
        m.ad *= jump;
        notify(s, 'event', `${pick(s, AD_SHOCKS)} ${def(s, pid).name}. Ad costs +${Math.round((jump - 1) * 100)}%.`, true);
      } else {
        const jump = 1.08 + Math.abs(normal(s)) * 0.06;
        m.cost *= jump;
        notify(s, 'event', `${pick(s, COST_SHOCKS)} ${def(s, pid).name}. Unit cost +${Math.round((jump - 1) * 100)}% on new orders.`, true);
      }
    }
    m.ad = Math.min(4, Math.max(0.75, m.ad));
    m.cost = Math.min(2.5, Math.max(0.85, m.cost));
  }
}

/** Difficulty is picked when the game starts. */
export function setDifficulty(s: GameState, d: Difficulty): ActionResult {
  if (s.day > 1 && s.flags.introSeen) return 'Difficulty is set when the game starts.';
  s.difficulty = d;
  return null;
}
