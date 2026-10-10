import { CHANNELS, CREATORS, MARKETPLACES } from '../data';
import { breakEvenCPA, creativeUnlocked, def, liveProducts, recentCPA, round2, stockQuality } from '../economics';
import { chance } from '../rng';
import type { ChannelId, GameState, Listing } from '../types';
import { type ActionResult, milestone, nextId, notify, spendOn } from './core';
import { onStore } from './storefront';

// ───────────────────────────── Scrollr ─────────────────────────────

export function setAdCell(s: GameState, pid: string, key: string, patch: { active?: boolean; budget?: number }): ActionResult {
  const p = s.products[pid];
  const cell = p?.ads[key];
  if (!cell) return 'Unknown ad.';
  if (patch.active && !creativeUnlocked(s, pid, cell.creative)) return cell.creative === 'ugc' ? 'Hire a creator for this product first.' : 'This creative needs 3+ reviews first.';
  if (patch.active && !onStore(s, pid)) return 'This product isn’t live in your store yet (store launched, photo and description).';
  if (patch.active && !p.inventory.onHand && !p.sold) return 'Wait until stock arrives. Ads to an empty store waste money.';
  if (patch.budget !== undefined) cell.budget = Math.max(5, Math.min(5000, Math.round(patch.budget)));
  if (patch.active !== undefined) cell.active = patch.active;
  return null;
}

// ───────────────────────────── Seekly ─────────────────────────────

export function searchUnlocked(s: GameState): boolean {
  return s.stage >= 2 || !!s.milestones.first_profitable_campaign;
}

export function setSearch(s: GameState, pid: string, patch: { active?: boolean; budget?: number }): ActionResult {
  if (!searchUnlocked(s)) return 'Seekly search ads unlock after your first profitable campaign.';
  const p = s.products[pid];
  if (patch.active && !onStore(s, pid)) return 'This product isn’t live in your store yet.';
  if (patch.budget !== undefined) p.search.budget = Math.max(5, Math.min(5000, Math.round(patch.budget)));
  if (patch.active !== undefined) p.search.active = patch.active;
  return null;
}

// ───────────────────────────── creators ─────────────────────────────

export function hireCreator(s: GameState, pid: string, tierId: string): ActionResult {
  if (s.stage < 2) return 'Creators unlock in the Growing Brand stage.';
  const tier = CREATORS.find((c) => c.id === tierId);
  if (!tier) return 'Unknown creator.';
  const p = s.products[pid];
  if (!p.inventory.onHand) return 'Have stock before a creator sends people your way.';
  if (p.creatorBoost.length) return 'A creator campaign is already running for this product.';
  const err = spendOn(s, 'ads', tier.cost, p.brandId);
  if (err) return err;
  const viral = chance(s, tier.viral);
  const k = viral ? 5 : 1;
  p.creatorBoost = [0.5, 1, 0.6, 0.3, 0.15].map((x) => Math.round(tier.reach * x * k));
  p.ugc = true;
  milestone(s, 'first_creator');
  notify(s, 'info', viral ? `🔥 The ${tier.name.toLowerCase()} video about ${def(s, pid).name} is going viral! Watch your stock.` : `🎬 A ${tier.name.toLowerCase()} posted about ${def(s, pid).name}. Creator UGC ads unlocked for it.`, viral);
  return null;
}

// ───────────────────────────── channels ─────────────────────────────

export function joinChannel(s: GameState, ch: ChannelId): ActionResult {
  const c = CHANNELS[ch];
  if (s.channels[ch]?.joined) return null;
  if (s.stage < c.unlockStage) return `${c.name} opens up at stage ${c.unlockStage}.`;
  const err = spendOn(s, 'other', c.joinCost);
  if (err) return err;
  s.channels[ch] = { joined: true, joinedDay: s.day };
  if (c.monthlyFee) s.bills.push({ id: nextId(s), dueDay: s.day + 30, label: `${c.name} seller plan`, amount: c.monthlyFee, everyDays: 30, category: 'rent' });
  notify(s, 'info', `Joined ${c.name}. List products on it from the Channels app.`);
  return null;
}

export function listingProblem(s: GameState, pid: string, ch: ChannelId, price?: number): string | null {
  const c = CHANNELS[ch];
  const d = def(s, pid);
  const p = s.products[pid];
  const pr = price ?? p.listings[ch]?.price ?? p.price;
  if (!p.photo) return 'Needs a product photo.';
  if (c.minQuality && stockQuality(s, pid) < c.minQuality) return `${c.name} rejects products below premium quality.`;
  if (c.minPriceRatio && pr < d.refPrice * c.minPriceRatio) return `${c.name} buyers expect at least $${(d.refPrice * c.minPriceRatio).toFixed(0)}.`;
  if (c.maxPriceRatio && pr > d.refPrice * c.maxPriceRatio) return `${c.name} requires a price of $${(d.refPrice * c.maxPriceRatio).toFixed(2)} or less.`;
  return null;
}

export function setListing(s: GameState, pid: string, ch: ChannelId, patch: Partial<Pick<Listing, 'active' | 'price' | 'program' | 'sponsored'>>): ActionResult {
  if (!s.channels[ch]?.joined) return `Join ${CHANNELS[ch].name} first.`;
  const p = s.products[pid];
  const l: Listing = p.listings[ch] ?? { active: false, price: p.price, rank: 0.05, program: false, promoUntil: -1, promoCooldown: -1, sponsored: 0, recent: [] };
  const next = { ...l, ...patch };
  if (next.price) next.price = round2(Math.max(3, next.price));
  if (patch.active || (next.active && patch.price !== undefined)) {
    const problem = listingProblem(s, pid, ch, next.price);
    if (problem) return problem;
  }
  if (patch.program && !CHANNELS[ch].program) return 'No fulfillment program on this channel.';
  if (next.sponsored) next.sponsored = Math.max(0, Math.min(3000, Math.round(next.sponsored)));
  p.listings[ch] = next;
  return null;
}

export function runPromo(s: GameState, pid: string, ch: ChannelId): ActionResult {
  const l = s.products[pid].listings[ch];
  if (!l?.active) return 'List it first.';
  if (!MARKETPLACES.includes(ch)) return 'Lightning deals are a marketplace feature.';
  if (l.promoCooldown > s.day) return `Next lightning deal available on day ${l.promoCooldown}.`;
  l.promoUntil = s.day + 2;
  l.promoCooldown = s.day + 30;
  notify(s, 'info', `⚡ Lightning deal live on ${CHANNELS[ch].name} for ${def(s, pid).name}: 20% off for 3 days.`);
  return null;
}

// ───────────────────────────── email ─────────────────────────────

export const FLOW_COST = 200;

export function setFlow(s: GameState, brandId: number, flow: 'welcome' | 'postPurchase' | 'winback', on: boolean): ActionResult {
  if (s.stage < 2) return 'Email unlocks in the Growing Brand stage.';
  const b = s.brands.find((x) => x.id === brandId)!;
  if (on && !s.flags[`flow-${brandId}-${flow}`]) {
    const err = spendOn(s, 'other', FLOW_COST, brandId);
    if (err) return err;
    s.flags[`flow-${brandId}-${flow}`] = true;
  }
  b.email.flows[flow] = on;
  return null;
}

export function sendCampaign(s: GameState, brandId: number, discountPct: number): ActionResult {
  if (s.stage < 2) return 'Email unlocks in the Growing Brand stage.';
  const b = s.brands.find((x) => x.id === brandId)!;
  if (b.email.list < 100) return 'Build your list to 100+ subscribers first.';
  if (s.day - b.email.lastCampaign < 7) return 'One campaign a week, or people unsubscribe.';
  const orders = b.email.list * 0.012 * (discountPct ? 1 + discountPct / 25 : 1) * (1 - b.email.fatigue);
  b.email.pending = [orders * 0.5, orders * 0.3, orders * 0.2];
  b.email.lastCampaign = s.day;
  b.email.fatigue = Math.min(0.6, b.email.fatigue + 0.12 + discountPct / 200);
  s.counters[`campaignDiscount-${brandId}`] = discountPct;
  b.email.list = Math.round(b.email.list * 0.997);
  notify(s, 'info', `📧 Campaign sent to ${b.email.list.toLocaleString()} subscribers${discountPct ? ` with ${discountPct}% off` : ''}.`);
  return null;
}

// ───────────────────────────── automation ─────────────────────────────

/** The growth marketer's weekly pass over every ad: pause losers, scale winners, switch tests on. */
export function marketerPass(s: GameState): void {
  if (!s.team.marketer.count) return;
  let paused = 0;
  let scaled = 0;
  for (const pid of liveProducts(s)) {
    const p = s.products[pid];
    if (!onStore(s, pid) || !p.inventory.onHand) continue;
    const be = breakEvenCPA(s, pid);
    let anyActive = false;
    for (const c of Object.values(p.ads)) {
      if (!c.active) continue;
      const r = recentCPA(c, 7);
      const enough = r.orders >= 4 || r.spend >= be * 2.5;
      if (!enough) {
        anyActive = true;
        continue;
      }
      if (r.cpa === null || r.cpa > be * 0.95) {
        c.active = false;
        paused++;
      } else {
        anyActive = true;
        if (r.cpa < be * 0.7) {
          c.budget = Math.min(2500, Math.round(c.budget * 1.25));
          scaled++;
        }
      }
    }
    if (!anyActive) {
      const untested = Object.values(p.ads).filter((c) => !c.totals.spend && creativeUnlocked(s, pid, c.creative));
      for (const c of untested.slice(0, 2)) {
        c.active = true;
        c.budget = 20;
      }
    }
    if (p.search.active) {
      const r = recentCPA(p.search, 7);
      if (r.orders >= 4 && r.cpa !== null) p.search.budget = r.cpa < be * 0.7 ? Math.min(3000, Math.round(p.search.budget * 1.2)) : r.cpa > be ? Math.max(5, Math.round(p.search.budget * 0.7)) : p.search.budget;
    } else if (searchUnlocked(s)) {
      p.search.active = true;
      p.search.budget = 20;
    }
  }
  if (paused || scaled) notify(s, 'team', `📈 ${s.people.find((x) => x.role === 'marketer')?.name ?? 'Your marketer'}: paused ${paused} losing ads, scaled ${scaled} winners.`);
}
