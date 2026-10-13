import { BRAND_CAMPAIGNS, type CampaignKind, ROUND_ORDER, ROUNDS, type RoundId } from '../data';
import { liveProducts, round2, trailing } from '../economics';
import type { GameState } from '../types';
import { type ActionResult, book, milestone, notify } from './core';

// Late-game bets that compete for cash: brand campaigns (slow-burning awareness) and venture rounds (cash now,
// a board with growth targets later). Equity raised never touches the P&L.

export function ownership(s: GameState): number {
  return 1 - (s.counters.equitySold ?? 0);
}

/** Diminishing returns: campaigns running at the same time share the same audience. */
export function campaignEfficiency(s: GameState): number {
  const recent = (s.campaigns ?? []).filter((c) => c.start > s.day - 90).length;
  return 1 / (1 + 0.5 * recent);
}

export function launchCampaign(s: GameState, kind: CampaignKind): ActionResult {
  const c = BRAND_CAMPAIGNS[kind];
  if (s.stage < c.minStage) return `${c.name} make sense from stage ${c.minStage}.`;
  if (s.cash < c.cost) return `You need $${c.cost.toLocaleString()} in cash.`;
  const eff = campaignEfficiency(s);
  book(s, 'ads', c.cost, { sub: `Brand campaigns (${c.name})` });
  (s.campaigns ??= []).push({ kind, start: s.day, days: c.days, perDay: (c.awareness * eff) / c.days });
  notify(s, 'info', `📣 ${c.name} launched: ${c.days} days of brand building${eff < 1 ? ` (${Math.round(eff * 100)}% effective: you already have campaigns running)` : ''}.`);
  return null;
}

/** Daily: running campaigns build awareness; billboards and TV also lift marketplace rank. */
export function campaignDay(s: GameState): void {
  if (!s.campaigns?.length) return;
  for (const c of s.campaigns) {
    if (s.day < c.start || s.day >= c.start + c.days) continue;
    for (const b of s.brands) b.awareness += c.perDay / s.brands.length;
    const rank = BRAND_CAMPAIGNS[c.kind as CampaignKind]?.rank ?? 0;
    if (rank) for (const pid of liveProducts(s)) for (const l of Object.values(s.products[pid].listings)) if (l?.active) l.rank = Math.min(1, l.rank + rank / c.days);
  }
  s.campaigns = s.campaigns.filter((c) => c.start + c.days > s.day - 120);
}

// ───────────────────────────── funding ─────────────────────────────

export function nextRound(s: GameState): RoundId | null {
  const raised = s.funding?.raised ?? [];
  return ROUND_ORDER.find((r) => !raised.includes(r)) ?? null;
}

export function roundProblems(s: GameState, id: RoundId): string[] {
  const r = ROUNDS[id];
  const out: string[] = [];
  if (s.stage < r.minStage) out.push(`Reach stage ${r.minStage}`);
  const rev = trailing(s, 30).revenue;
  if (rev < r.needRevenue) out.push(`$${r.needRevenue.toLocaleString()}+ monthly sales (now $${Math.round(rev).toLocaleString()})`);
  if ((s.funding?.interest ?? 0) < 50) out.push(`Investor interest ${Math.round(s.funding?.interest ?? 0)}/50 (spend weeks on investor coffees)`);
  if (s.funding?.board) out.push('Hit your current board target first');
  return out;
}

export function raiseRound(s: GameState, id: RoundId): ActionResult {
  if (nextRound(s) !== id) return 'Raise your rounds in order.';
  const problems = roundProblems(s, id);
  if (problems.length) return problems[0];
  const r = ROUNDS[id];
  const rev = trailing(s, 30).revenue;
  s.cash = round2(s.cash + r.raise); // equity, not income
  s.counters.equitySold = (s.counters.equitySold ?? 0) + r.equity * ownership(s);
  s.funding = { raised: [...(s.funding?.raised ?? []), id], interest: 0, board: { round: id, target: Math.round(rev * r.growth), deadline: s.day + r.months * 30 } };
  notify(s, 'milestone', `💰 ${r.name} closed: +$${r.raise.toLocaleString()}. You own ${Math.round(ownership(s) * 100)}%. The board expects $${Math.round(rev * r.growth).toLocaleString()} a month within ${r.months} months.`, true);
  return null;
}

/** Daily: investor interest grows with momentum; the board checks its target on the deadline. */
export function fundingDay(s: GameState): void {
  if (s.stage < 2) return;
  const f = (s.funding ??= { raised: [], interest: 0 });
  if (s.day % 30 === 0) {
    const now = trailing(s, 30).revenue;
    const before = s.history.length > 60 ? s.history.slice(-60, -30).reduce((a, r) => a + r.pl.revenue, 0) : 0;
    if (before > 0 && now > before * 1.15) f.interest = Math.min(100, f.interest + 10);
  }
  const b = f.board;
  if (!b || s.day < b.deadline) return;
  const rev = trailing(s, 30).revenue;
  if (rev >= b.target) {
    delete f.board;
    milestone(s, 'board_happy');
    notify(s, 'milestone', `The board is happy: you hit $${Math.round(rev).toLocaleString()} a month (target $${b.target.toLocaleString()}).`, true);
  } else if (!b.warned) {
    b.warned = true;
    b.deadline = s.day + 90;
    b.target = Math.round(b.target * 1.1);
    notify(s, 'event', `Board meeting: you missed the target ($${Math.round(rev).toLocaleString()} vs $${(b.target / 1.1).toLocaleString(undefined, { maximumFractionDigits: 0 })}). They give you 90 more days to reach $${b.target.toLocaleString()} a month. There won’t be another extension.`, true);
  } else {
    s.flags.ousted = true;
    s.status = 'lost';
    notify(s, 'event', 'The board voted to replace you as CEO.', true);
  }
}

export { ROUNDS, ROUND_ORDER };
export type { RoundId, CampaignKind };
