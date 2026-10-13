import { CHANNELS, CREATORS, HOURS, MARKETPLACE_AD_SHARE, MARKETPLACES } from '../data';
import { adsReviewed, breakEvenCPA, creativeUnlocked, def, hasSkill, knowsAdMetrics, listingVisibility, liveProducts, orderBreakdown, recentCPA, round2, stockQuality } from '../economics';
import { chance, pick } from '../rng';
import type { CampaignType, CategoryId, ChannelId, Creative, CreativeType, EmailCampaign, GameState, Listing, Segment } from '../types';
import { addReviews } from './reviews';
import { type ActionResult, adStat, book, milestone, nextId, notify, spendOn, useHours, workTime } from './core';
import { onStore } from './storefront';

// ───────────────────────────── Scrollr ─────────────────────────────

export function setAdCell(s: GameState, pid: string, key: string, patch: { active?: boolean; budget?: number }): ActionResult {
  const p = s.products[pid];
  const cell = p?.ads[key];
  if (!cell) return 'Unknown ad.';
  if (patch.active && !s.flags.adAccount) return 'Open your Scrollr ad account first (Ads app).';
  const tweak = workTime(s, HOURS.adTweak);
  if (tweak) return tweak;
  if (patch.active && !creativeUnlocked(s, pid, cell.creative)) return cell.creative === 'ugc' ? 'Hire a creator for this product first.' : 'This creative needs 3+ reviews first.';
  if (patch.active && !onStore(s, pid)) return 'This product isn’t live in your store yet (store launched, photo and description).';
  if (patch.active && !p.inventory.onHand && !p.sold) return 'Wait until stock arrives. Ads to an empty store waste money.';
  if (patch.budget !== undefined) cell.budget = Math.max(5, Math.min(5000, Math.round(patch.budget)));
  if (patch.active !== undefined) cell.active = patch.active;
  return null;
}

// ───────────────────────────── Seekly ─────────────────────────────

export function searchUnlocked(s: GameState): boolean {
  return hasSkill(s, 'searchAds');
}

export function setSearch(s: GameState, pid: string, patch: { active?: boolean; budget?: number }): ActionResult {
  if (!searchUnlocked(s)) return 'Finish the Search Ads Bootcamp in SkillUp to run Seekly ads.';
  const p = s.products[pid];
  if (patch.active && !onStore(s, pid)) return 'This product isn’t live in your store yet.';
  const t = workTime(s, HOURS.adTweak);
  if (t) return t;
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
  book(s, 'ads', tier.cost, { brandId: p.brandId, productId: pid, channel: p.listings.loopshop?.active ? 'loopshop' : 'store', sub: 'Creator collabs' });
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
  const err = spendOn(s, 'other', c.joinCost, undefined, 'Channel setup');
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
  const t = workTime(s, patch.active && !l.active ? HOURS.listingSetup : HOURS.adTweak);
  if (t) return t;
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
    const err = spendOn(s, 'other', FLOW_COST, brandId, 'Email & CRM');
    if (err) return err;
    s.flags[`flow-${brandId}-${flow}`] = true;
  }
  b.email.flows[flow] = on;
  return null;
}

export const CAMPAIGNS: Record<CampaignType, { name: string; emoji: string; desc: string; best: Segment; fatigue: number; clickRate: number }> = {
  promo: { name: 'Promotion', emoji: '🏷️', desc: 'A discount or offer. Sells now, but trains people to wait for sales.', best: 'vip', fatigue: 0.12, clickRate: 0.12 },
  replenish: { name: 'Replenishment reminder', emoji: '🔁', desc: 'Time to restock? Works best for consumables and lapsed buyers.', best: 'lapsed', fatigue: 0.06, clickRate: 0.1 },
  launch: { name: 'Product launch', emoji: '🚀', desc: 'Introduce one product to people who already trust you.', best: 'vip', fatigue: 0.08, clickRate: 0.14 },
  review: { name: 'Review request', emoji: '⭐', desc: 'Ask recent buyers for a review. More reviews, no direct sales.', best: 'recent', fatigue: 0.04, clickRate: 0.2 },
  story: { name: 'Brand story', emoji: '📖', desc: 'Behind the scenes, tips, no hard sell. Keeps customers warm and the list healthy.', best: 'all', fatigue: -0.04, clickRate: 0.06 },
};

export const SEGMENTS: Record<Segment, { name: string; desc: string; share: number; engage: number }> = {
  all: { name: 'Everyone', desc: 'Your whole list', share: 1, engage: 1 },
  recent: { name: 'Recent buyers', desc: 'Bought in the last 30 days', share: 0.25, engage: 1.2 },
  lapsed: { name: 'Lapsed customers', desc: 'Haven’t bought in 90+ days', share: 0.45, engage: 0.6 },
  vip: { name: 'VIP repeat buyers', desc: 'Bought 2+ times', share: 0.08, engage: 1.5 },
};

const RESPONSE: Record<CampaignType, Record<Segment, number>> = {
  promo: { all: 0.012, recent: 0.008, lapsed: 0.01, vip: 0.03 },
  replenish: { all: 0.008, recent: 0.006, lapsed: 0.02, vip: 0.024 },
  launch: { all: 0.009, recent: 0.011, lapsed: 0.005, vip: 0.018 },
  review: { all: 0, recent: 0, lapsed: 0, vip: 0 },
  story: { all: 0.003, recent: 0.003, lapsed: 0.002, vip: 0.005 },
};

export interface CampaignPlan {
  type: CampaignType;
  segment: Segment;
  discount: number;
  productId?: string;
}

export function segmentSize(s: GameState, brandId: number, seg: Segment): number {
  const b = s.brands.find((x) => x.id === brandId)!;
  return Math.round(b.email.list * SEGMENTS[seg].share);
}

/** Expected orders (or reviews) from a plan, for the composer preview. */
export function forecastCampaign(s: GameState, brandId: number, plan: CampaignPlan): { sent: number; orders: number; reviews: number } {
  const b = s.brands.find((x) => x.id === brandId)!;
  const sent = segmentSize(s, brandId, plan.segment);
  const pids = Object.keys(s.products).filter((id) => s.products[id].brandId === brandId && !s.products[id].retired);
  const repeatability = pids.length ? pids.reduce((a, id) => a + def(s, id).repeatability, 0) / pids.length : 0.5;
  let rate = RESPONSE[plan.type][plan.segment] * (1 - b.email.fatigue);
  if (plan.type === 'promo') rate *= 1 + plan.discount / 25;
  if (plan.type === 'replenish') rate *= repeatability;
  const reviewRate = { all: 0.02, recent: 0.06, lapsed: 0.008, vip: 0.05 }[plan.segment];
  return { sent, orders: sent * rate, reviews: plan.type === 'review' ? sent * reviewRate * (1 - b.email.fatigue) : 0 };
}

export function sendCampaign(s: GameState, brandId: number, plan: CampaignPlan): ActionResult {
  if (s.stage < 2) return 'Email unlocks in the Growing Brand stage.';
  const b = s.brands.find((x) => x.id === brandId)!;
  if (b.email.list < 100) return 'Build your list to 100+ subscribers first.';
  if (s.day - b.email.lastCampaign < 7) return 'One campaign a week, or people unsubscribe.';
  if (plan.type === 'launch' && (!plan.productId || !s.products[plan.productId])) return 'Pick the product to launch.';
  const t = workTime(s, HOURS.emailCampaign);
  if (t) return t;
  const meta = CAMPAIGNS[plan.type];
  const f = forecastCampaign(s, brandId, plan);
  if (f.sent < 20) return 'That segment is too small to email yet.';
  const id = nextId(s);
  const engage = SEGMENTS[plan.segment].engage;
  const opens = Math.round(f.sent * Math.max(0.05, 0.35 - b.email.fatigue * 0.3) * engage);
  const clicks = Math.round(opens * meta.clickRate);
  const broad = plan.segment === 'all' ? 1.5 : 1;
  const unsub = Math.round(f.sent * (0.002 + Math.max(0, b.email.fatigue) * 0.01) * broad);
  const cost = round2(f.sent * 0.003);
  book(s, 'other', cost, { brandId, sub: 'Email & CRM' });
  const camp: EmailCampaign = { id, day: s.day, brandId, type: plan.type, segment: plan.segment, discount: plan.type === 'promo' ? plan.discount : 0, productId: plan.productId, sent: f.sent, opens, clicks, unsubscribes: unsub, orders: 0, revenue: 0, reviews: 0, cost };
  s.emails.push(camp);
  if (s.emails.length > 40) s.emails.shift();
  if (f.orders > 0) (b.email.queue ??= []).push({ id, days: [f.orders * 0.5, f.orders * 0.3, f.orders * 0.2], productId: plan.type === 'launch' ? plan.productId : undefined, discount: camp.discount });
  if (plan.type === 'review') {
    const pids = Object.keys(s.products).filter((pid) => s.products[pid].brandId === brandId && s.products[pid].sold > 0);
    let total = 0;
    for (const pid of pids) {
      const n = Math.round((f.reviews * s.products[pid].sold) / Math.max(1, pids.reduce((a, x) => a + s.products[x].sold, 0)));
      const q = stockQuality(s, pid);
      addReviews(s, pid, n, Math.min(4.9, 1.6 + 3.6 * q + (b.thankYouCard ? 0.25 : 0) + (b.packaging === 'branded' ? 0.15 : 0)));
      total += n;
    }
    camp.reviews = total;
  }
  if (plan.type === 'story') {
    b.customers *= 1.02;
    b.awareness += f.sent * 0.05;
  }
  if (plan.type === 'launch' && plan.productId) b.awareness += f.sent * 0.03;
  b.email.lastCampaign = s.day;
  b.email.fatigue = Math.max(0, Math.min(0.6, b.email.fatigue + (meta.fatigue + (plan.type === 'promo' ? plan.discount / 200 : 0)) * broad));
  b.email.list = Math.max(0, b.email.list - unsub);
  notify(s, 'info', `📧 ${meta.name} sent to ${f.sent.toLocaleString()} ${SEGMENTS[plan.segment].name.toLowerCase()}.`);
  return null;
}

// ───────────────────────────── automation ─────────────────────────────

export function setCreative(s: GameState, pid: string, type: CreativeType, patch: Partial<Creative>): ActionResult {
  const p = s.products[pid];
  if (!p) return 'Unknown product.';
  const t = workTime(s, HOURS.creativeEdit);
  if (t) return t;
  Object.assign(p.creatives[type], patch);
  // A new creative restarts learning: fatigue resets.
  for (const c of Object.values(p.ads)) if (c.creative === type) c.daysActive = 0;
  return null;
}

/** Finish the ad-angle test: matching hooks to audiences gives a fresh-angle click boost for three weeks. */
export function completeAngleTest(s: GameState, pid: string, score: number): ActionResult {
  if (!s.products[pid]) return 'Unknown product.';
  s.angleTested[pid] = Math.max(s.angleTested[pid] ?? 0, score);
  if (score > 0) {
    s.modifiers = (s.modifiers ?? []).filter((m) => !(m.key === 'adCtr' && m.scope === pid && m.label === 'Fresh angle'));
    s.modifiers.push({ id: nextId(s), key: 'adCtr', scope: pid, mult: 1 + 0.07 * score, until: s.day + 21, label: 'Fresh angle' });
  }
  return null;
}

/** Ad quality from competitor research (0..5 right calls), plus the creatives course. */
export function creativeQualityFrom(s: GameState, score: number): number {
  return Math.min(1, 0.3 + 0.13 * score + (hasSkill(s, 'copywriting') ? 0.08 : 0));
}

/** Finish a competitor creative research session for a product. Keeps the best result. */
export function completeCreativeResearch(s: GameState, pid: string, score: number, hook?: string): ActionResult {
  const p = s.products[pid];
  if (!p) return 'Unknown product.';
  if (!hasSkill(s, 'adSpy')) return 'You need the AdSpy Library (SkillUp) to see competitor ads.';
  const err = useHours(s, HOURS.creativeResearch);
  if (err) return err;
  p.creativeQuality = Math.max(p.creativeQuality ?? 0, creativeQualityFrom(s, score));
  if (hook) for (const c of Object.values(p.creatives)) c.hook = hook;
  return null;
}

/** Open the Scrollr ad account: verification, payment method, tracking pixel. */
export function openAdAccount(s: GameState): ActionResult {
  if (s.flags.adAccount) return null;
  if (s.cash < 100) return 'You need $100 for the account setup and first verification charge.';
  const t = useHours(s, HOURS.adAccount);
  if (t) return t;
  book(s, 'ads', 100, { sub: 'Ad account setup' });
  s.flags.adAccount = true;
  notify(s, 'info', 'Your Scrollr ad account is verified and the tracking pixel is live.');
  return null;
}

/** Work out today's ad numbers: which ads win, which lose. Needs the course; takes an hour unless automated. */
export function reviewAds(s: GameState): ActionResult {
  if (!knowsAdMetrics(s)) return 'You don’t know how to read these numbers yet. Take Ad Metrics 101 in SkillUp.';
  if (adsReviewed(s)) return null;
  const t = useHours(s, HOURS.adReview);
  if (t) return t;
  s.counters.adReviewDay = s.day;
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
  // Marketplaces: sponsored listings and lightning deals, judged against each marketplace's own margin.
  let deals = 0;
  for (const pid of liveProducts(s)) {
    const p = s.products[pid];
    if (!p.inventory.onHand) continue;
    for (const ch of MARKETPLACES) {
      const l = p.listings[ch];
      if (!l?.active || !s.channels[ch]?.joined) continue;
      const be = orderBreakdown(s, pid, false, ch).contribution;
      if (be <= 0) {
        if (l.sponsored) {
          l.sponsored = 0;
          paused++;
        }
        continue;
      }
      const target = be * (1 - s.adPolicy.marginPct / 100);
      const r = recentCPA({ history: l.adHistory ?? [] }, 5);
      const enough = r.orders >= 3 || r.spend >= be * 2;
      if (!l.sponsored) {
        const neverTried = !l.adHistory?.length;
        if (neverTried || (s.day % 14 === 0 && l.rank < 0.6)) {
          l.sponsored = 20;
          launched++;
        }
      } else if (enough && (r.cpa === null || r.cpa > be)) {
        // Losing on the click, but the listing still needs visibility: drop to the spend that holds rank.
        const floor = Math.round(listingVisibility(s, pid, ch).dailyRevenue * MARKETPLACE_AD_SHARE);
        l.sponsored = floor >= 5 ? Math.min(l.sponsored, floor) : 0;
        paused++;
      } else if (enough && r.cpa !== null && r.cpa < target) {
        l.sponsored = Math.min(3000, Math.round(l.sponsored * 1.2 + 2));
        scaled++;
      }
      if (l.sponsored && l.sponsored < listingVisibility(s, pid, ch).dailyRevenue * MARKETPLACE_AD_SHARE * 0.8) l.sponsored = Math.round(listingVisibility(s, pid, ch).dailyRevenue * MARKETPLACE_AD_SHARE);
      if (l.sponsored) knobs.push({ get: () => l.sponsored, set: (v) => (l.sponsored = v), cpa: r.cpa });
      // Lightning deal when rank is sagging and 20% off still leaves a profit.
      const price = l.price;
      if (l.promoCooldown <= s.day && l.promoUntil < s.day && l.rank < 0.6 && be - price * 0.2 > 0) {
        l.promoUntil = s.day + 2;
        l.promoCooldown = s.day + 30;
        deals++;
      }
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
    notify(s, 'team', `📈 ${s.people.find((x) => x.role === 'marketer')?.name ?? 'Your marketer'} this week: scaled ${scaled} winners, paused ${paused} losers, launched ${launched} tests${deals ? `, ran ${deals} lightning deals` : ''}. Spend cap $${Math.round(cap).toLocaleString()}/day.`);
  }
}
