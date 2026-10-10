import { CHANNELS, CREATORS, MARKETPLACES } from '../data';
import { breakEvenCPA, creativeUnlocked, def, liveProducts, recentCPA, round2, stockQuality } from '../economics';
import { chance, pick } from '../rng';
import type { CategoryId, ChannelId, Creative, CreativeType, GameState, Listing } from '../types';
import { type ActionResult, adStat, book, milestone, nextId, notify, spendOn } from './core';
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

const HANDLES: Record<CategoryId, string[]> = {
  pets: ['thatdogmom', 'pawsandplay', 'catsofmaple', 'goodboyreviews'],
  home: ['cozyhomewithmia', 'smallspace.big.style', 'plantdad.nyc', 'nestnotes'],
  desk: ['deskgoals', 'setupwars', 'remote.ronan', 'minimal.desk'],
  kitchen: ['brewnerd', 'twentyminutemeals', 'kitchen.hacks.kat', 'pourover.pete'],
  fitness: ['fitwithfinn', 'livingroomlifts', 'yogawithana', 'tenminutestrong'],
};

export function creatorHandle(s: GameState, cat: CategoryId): string {
  return '@' + pick(s, HANDLES[cat]);
}

export function hireCreator(s: GameState, pid: string, tierId: string): ActionResult {
  if (s.stage < 2) return 'Creators unlock in the Growing Brand stage.';
  const tier = CREATORS.find((c) => c.id === tierId);
  if (!tier) return 'Unknown creator.';
  const p = s.products[pid];
  if (!p.inventory.onHand) return 'Have stock before a creator sends people your way.';
  if (p.creatorBoost.length) return 'A creator campaign is already running for this product.';
  if (s.cash < tier.cost) return `Not enough cash. You need $${tier.cost.toLocaleString()}.`;
  book(s, 'ads', tier.cost, { brandId: p.brandId, productId: pid, channel: p.listings.loopshop?.active ? 'loopshop' : 'store' });
  adStat(s, pid, 'creator', { spend: tier.cost });
  s.creatorPosts.push({ day: s.day, productId: pid, tier: tier.id, cost: tier.cost, viral: false, handle: creatorHandle(s, def(s, pid).category) });
  const viral = chance(s, tier.viral);
  const k = viral ? 5 : 1;
  p.creatorBoost = [0.5, 1, 0.6, 0.3, 0.15].map((x) => Math.round(tier.reach * x * k));
  s.creatorPosts[s.creatorPosts.length - 1].viral = viral;
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

export function setCreative(s: GameState, pid: string, type: CreativeType, patch: Partial<Creative>): ActionResult {
  const p = s.products[pid];
  if (!p) return 'Unknown product.';
  Object.assign(p.creatives[type], patch);
  // A new creative restarts learning: fatigue resets.
  for (const c of Object.values(p.ads)) if (c.creative === type) c.daysActive = 0;
  return null;
}

export function setAdPolicy(s: GameState, patch: Partial<GameState['adPolicy']>): ActionResult {
  Object.assign(s.adPolicy, patch);
  s.adPolicy.maxSharePct = Math.max(1, Math.min(60, Math.round(s.adPolicy.maxSharePct)));
  s.adPolicy.floor = Math.max(0, Math.round(s.adPolicy.floor));
  s.adPolicy.marginPct = Math.max(0, Math.min(80, Math.round(s.adPolicy.marginPct)));
  return null;
}

/** Daily ad budget the marketer may spend: a share of recent revenue, never below the floor. */
export function adCap(s: GameState): number {
  const revenue = s.history.slice(-30).reduce((a, r) => a + r.pl.revenue, 0) / Math.max(1, Math.min(30, s.history.length));
  return Math.max(s.adPolicy.floor, (s.adPolicy.maxSharePct / 100) * revenue);
}

/**
 * The growth marketer's daily pass. Profitable ads get more budget every day until they stop
 * beating break-even; ads that cost more than an order earns get paused. Total spend is held
 * under the cap you set (a % of revenue).
 */
export function marketerPass(s: GameState): void {
  if (!s.team.marketer.count) return;
  let paused = 0;
  let scaled = 0;
  let launched = 0;
  type Knob = { get: () => number; set: (v: number) => void; cpa: number | null };
  const knobs: Knob[] = [];
  for (const pid of liveProducts(s)) {
    const p = s.products[pid];
    if (!onStore(s, pid) || !p.inventory.onHand) continue;
    const be = breakEvenCPA(s, pid);
    // Scale only ads that leave a real margin after their cost; pause anything above break-even.
    const target = be * (1 - s.adPolicy.marginPct / 100);
    const judge = (h: { history: { spend: number; orders: number }[] }) => {
      const r = recentCPA(h, 5);
      return { r, enough: r.orders >= 3 || r.spend >= be * 2 };
    };
    let anyActive = false;
    for (const c of Object.values(p.ads)) {
      if (!c.active) continue;
      const { r, enough } = judge(c);
      if (enough && (r.cpa === null || r.cpa > be)) {
        c.active = false;
        paused++;
        continue;
      }
      anyActive = true;
      if (enough && r.cpa !== null && r.cpa < target) {
        c.budget = Math.min(5000, Math.round(c.budget * 1.2 + 2));
        scaled++;
      }
      knobs.push({ get: () => c.budget, set: (v) => (c.budget = v), cpa: r.cpa });
    }
    if (!anyActive) {
      const untested = Object.values(p.ads).filter((c) => !c.totals.spend && creativeUnlocked(s, pid, c.creative));
      for (const c of untested.slice(0, 2)) {
        c.active = true;
        c.budget = 20;
        launched++;
        knobs.push({ get: () => c.budget, set: (v) => (c.budget = v), cpa: null });
      }
    }
    if (searchUnlocked(s)) {
      if (!p.search.active && !p.search.history.length) {
        p.search.active = true;
        p.search.budget = 20;
        launched++;
      } else if (p.search.active) {
        const { r, enough } = judge(p.search);
        if (enough && (r.cpa === null || r.cpa > be)) {
          p.search.active = false;
          paused++;
        } else if (enough && r.cpa !== null && r.cpa < target) {
          p.search.budget = Math.min(5000, Math.round(p.search.budget * 1.2 + 2));
          scaled++;
        }
      }
      if (p.search.active) knobs.push({ get: () => p.search.budget, set: (v) => (p.search.budget = v), cpa: recentCPA(p.search, 5).cpa });
    }
  }
  // Keep total spend under the cap, trimming the least efficient budgets first.
  const cap = adCap(s);
  let total = knobs.reduce((a, k) => a + k.get(), 0);
  if (total > cap) {
    const worstFirst = [...knobs].sort((a, b) => (b.cpa ?? 1e9) - (a.cpa ?? 1e9));
    for (const k of worstFirst) {
      if (total <= cap) break;
      const cut = Math.min(k.get() - 5, total - cap);
      if (cut > 0) {
        k.set(Math.round(k.get() - cut));
        total -= cut;
      }
    }
  }
  if (s.day % 7 === 0 && (paused || scaled || launched)) {
    notify(s, 'team', `📈 ${s.people.find((x) => x.role === 'marketer')?.name ?? 'Your marketer'} this week: scaled ${scaled} winners, paused ${paused} losers, launched ${launched} tests. Spend cap $${Math.round(cap).toLocaleString()}/day.`);
  }
}
