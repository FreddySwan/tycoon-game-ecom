import {
  BUNDLE_SHARE,
  CUSTOMER_SHIPPING_CHARGE,
  FOUNDER_HOURS,
  MODULES,
  PACKAGING_COST,
  PAYMENT_FEE_FLAT,
  PAYMENT_FEE_PCT,
  PAYOUT_EVERY,
  PRODUCTS,
  SUPPLIERS,
  THANK_YOU_COST,
} from './data';
import type { AdCell, AudienceDef, GameState, ProductDef, SupplierId } from './types';

export function product(s: GameState): ProductDef {
  return PRODUCTS[s.productId ?? 'dogbowl'];
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function listPrice(s: GameState, supplierId: SupplierId, qty: number): number {
  const tier = qty >= 1000 ? 0.855 : qty >= 500 ? 0.945 : 1;
  return round2(product(s).baseUnitCost * SUPPLIERS[supplierId].priceMult * tier);
}

export function freightPerUnit(s: GameState, freight: 'air' | 'sea'): number {
  const p = product(s);
  return freight === 'air' ? p.airFreight : p.seaFreight;
}

/** Average landed cost of stock on hand, or a quote-based estimate before any stock exists. */
export function landedUnitCost(s: GameState): number {
  if (s.inventory.onHand > 0) return s.inventory.costTotal / s.inventory.onHand;
  const last = s.pos[s.pos.length - 1];
  if (last) return last.unitPrice + last.freightPerUnit;
  return listPrice(s, 'brightway', 300) + product(s).airFreight;
}

export function stockQuality(s: GameState): number {
  if (s.inventory.onHand > 0) return s.inventory.qualityTotal / s.inventory.onHand;
  const last = s.pos[s.pos.length - 1];
  return last ? last.quality : 0.8;
}

export function effectivePrice(s: GameState): number {
  return round2(s.offer.price * (1 - s.offer.discountPct / 100));
}

export function bundlePrice(s: GameState): number {
  return Math.round(effectivePrice(s) * 1.7) - 0.01;
}

export interface OrderBreakdown {
  charged: number;
  fees: number;
  shipping: number;
  packaging: number;
  cogs: number;
  contribution: number;
}

export function orderBreakdown(s: GameState, bundle: boolean): OrderBreakdown {
  const p = product(s);
  const units = bundle ? 2 : 1;
  const goods = bundle ? bundlePrice(s) : effectivePrice(s);
  const charged = goods + (s.offer.freeShipping ? 0 : CUSTOMER_SHIPPING_CHARGE);
  const fees = charged * PAYMENT_FEE_PCT + PAYMENT_FEE_FLAT;
  const shipping = p.shipToCustomer * (bundle ? 1.25 : 1);
  const packaging = PACKAGING_COST[s.offer.packaging] + (s.offer.thankYouCard ? THANK_YOU_COST : 0);
  const cogs = landedUnitCost(s) * units;
  return {
    charged: round2(charged),
    fees: round2(fees),
    shipping: round2(shipping),
    packaging: round2(packaging),
    cogs: round2(cogs),
    contribution: round2(charged - fees - shipping - packaging - cogs),
  };
}

export function bundleShare(s: GameState): number {
  return s.offer.bundle ? BUNDLE_SHARE : 0;
}

/** What one average order earns before advertising. Ads costing more than this per order lose money. */
export function breakEvenCPA(s: GameState): number {
  const b = bundleShare(s);
  return round2(orderBreakdown(s, false).contribution * (1 - b) + orderBreakdown(s, true).contribution * b);
}

export function averageOrderValue(s: GameState): number {
  const b = bundleShare(s);
  return round2(orderBreakdown(s, false).charged * (1 - b) + orderBreakdown(s, true).charged * b);
}

export function unitsPerOrder(s: GameState): number {
  return 1 + bundleShare(s);
}

export function averageRating(s: GameState): number {
  if (!s.reviews.length) return 0;
  return s.reviews.reduce((a, r) => a + r.stars, 0) / s.reviews.length;
}

export function reviewFactor(s: GameState): number {
  const n = s.reviews.length;
  if (!n) return 0.85;
  return 0.85 + Math.min(1, n / 8) * ((averageRating(s) - 3) * 0.14 + 0.1);
}

export interface TrustPart {
  label: string;
  value: number;
}

export function trustBreakdown(s: GameState): { total: number; parts: TrustPart[] } {
  const m = s.store.modules;
  const photo = s.store.photoStars;
  const parts: TrustPart[] = [{ label: 'Base', value: 0.45 }];
  const add = (label: string, value: number) => value && parts.push({ label, value });

  if (m.header) add('Header & logo', m.header === 2 ? 0.08 : 0.05);
  if (m.hero) add('Hero image', 0.03 * photo - 0.02 + (m.hero === 2 ? 0.06 : 0));
  if (m.gallery) add('Gallery', m.gallery === 2 ? 0.1 : 0.06 * (photo / 4));
  if (m.description) {
    const mult = m.description === 2 ? 1.3 : 1;
    const sum = s.store.benefits.reduce((a, id) => a + (product(s).benefits.find((b) => b.id === id)?.cvr ?? 0), 0);
    add('Description', sum * mult);
  }
  if (m.reviews) {
    const n = s.reviews.length;
    add('Reviews', n === 0 ? -0.02 : Math.min(0.14, n * 0.012) * ((averageRating(s) - 2) / 3));
  }
  if (m.badges) add('Trust badges', m.badges === 2 ? 0.05 : 0.04);
  if (m.faq) add('FAQ', 0.04);
  if (m.shipping) add('Shipping info', m.shipping === 2 ? 0.09 : 0.07);
  if (m.checkout) add('Checkout', m.checkout === 2 ? 0.1 : 0.05);

  const count = MODULES.filter((d) => m[d.id] > 0).length;
  const heavy = (m.hero === 2 ? 1 : 0) + (m.gallery === 2 ? 1 : 0);
  const clutter = Math.max(0, count - 7) * 0.03 + heavy * 0.015;
  if (clutter) parts.push({ label: 'Page load & clutter', value: -clutter });

  const total = Math.min(1.3, Math.max(0.4, parts.reduce((a, p) => a + p.value, 0)));
  return { total, parts };
}

export function trust(s: GameState): number {
  return trustBreakdown(s).total;
}

export function returnRate(s: GameState): number {
  const overPromise = s.store.benefits.reduce(
    (a, id) => a + (product(s).benefits.find((b) => b.id === id)?.returns ?? 0),
    0,
  );
  const ratio = effectivePrice(s) / product(s).refPrice;
  const bargain = ratio < 0.8 ? 0.02 : ratio > 1.2 ? -0.01 : 0;
  return Math.max(0.01, 0.02 + (1 - stockQuality(s)) * 0.1 + overPromise + bargain);
}

export function perception(s: GameState): { label: string; ratio: number } {
  const ratio = effectivePrice(s) / product(s).refPrice;
  const label =
    ratio < 0.75 ? 'Bargain bin' : ratio < 0.92 ? 'Good deal' : ratio < 1.12 ? 'Fair price' : ratio < 1.35 ? 'Premium' : 'Luxury';
  return { label, ratio };
}

export function priceFactor(s: GameState, elasticity: number): number {
  const p = product(s);
  const shipPenalty = s.offer.freeShipping ? 0 : CUSTOMER_SHIPPING_CHARGE * 1.3;
  const perceived = effectivePrice(s) + shipPenalty;
  const fatigue = s.offer.discountPct > 0 ? s.discountFatigue * 0.3 : s.discountFatigue;
  return Math.pow(p.refPrice / perceived, elasticity) * (1 - fatigue);
}

export function trendMult(s: GameState, day = s.day): number {
  const t = product(s).trend;
  if (t.kind === 'evergreen') return 1 + 0.05 * Math.sin(day / 9);
  const x = (day - t.peakDay) / 9;
  return day <= t.peakDay ? 0.7 + 1.3 * Math.exp(-x * x) : 0.3 + 1.7 * Math.exp(-x * x);
}

export function siteCVR(s: GameState, aud: AudienceDef | null, cvrBoost = 1): number {
  const p = product(s);
  const elasticity = aud ? aud.elasticity : 1.35;
  const fit = aud ? aud.cvrFit : 0.95;
  return p.baseCVR * trust(s) * priceFactor(s, elasticity) * reviewFactor(s) * fit * cvrBoost;
}

export interface CellForecast {
  cpm: number;
  ctr: number;
  cpc: number;
  cvr: number;
  cpa: number;
}

export function cellForecast(s: GameState, cell: AdCell): CellForecast {
  const p = product(s);
  const aud = p.audiences.find((a) => a.id === cell.audienceId)!;
  const cre = p.creatives.find((c) => c.id === cell.creativeId)!;
  const cpm = aud.cpm * p.cpmMult * Math.sqrt(1 + cell.budget / 300);
  const fatigue = Math.max(0.6, 1 - 0.012 * Math.max(0, cell.daysActive - 5));
  const ctr = cre.ctr * (cre.fit[aud.id] ?? 1) * fatigue * Math.min(1.6, trendMult(s));
  const cpc = cpm / (1000 * ctr);
  const cvr = siteCVR(s, aud, cre.cvrBoost);
  return { cpm, ctr, cpc, cvr, cpa: cpc / cvr };
}

export function creativeUnlocked(s: GameState, creativeId: string): boolean {
  const cre = product(s).creatives.find((c) => c.id === creativeId);
  return !cre?.requiresReviews || s.reviews.length >= cre.requiresReviews;
}

/** Recent CPA for a cell using the last `days` days of results. */
export function recentCPA(cell: AdCell, days = 3): { spend: number; orders: number; cpa: number | null } {
  const recent = cell.history.slice(-days);
  const spend = recent.reduce((a, d) => a + d.spend, 0);
  const orders = recent.reduce((a, d) => a + d.orders, 0);
  return { spend, orders, cpa: orders ? spend / orders : null };
}

export function hoursLeft(s: GameState): number {
  return Math.max(0, FOUNDER_HOURS + s.extraHours - s.hoursUsed);
}

export function avgDailyUnits(s: GameState, days = 5): number {
  const recent = s.history.slice(-days);
  if (!recent.length) return 0;
  return (recent.reduce((a, d) => a + d.orders, 0) / recent.length) * unitsPerOrder(s);
}

export function stockDays(s: GameState): number | null {
  const daily = avgDailyUnits(s);
  if (daily <= 0) return null;
  return s.inventory.onHand / daily;
}

export function incomingUnits(s: GameState): number {
  return s.pos.filter((p) => p.status !== 'arrived').reduce((a, p) => a + p.qty, 0);
}

export function nextPayoutDay(s: GameState): number {
  return Math.ceil((s.day + 1) / PAYOUT_EVERY) * PAYOUT_EVERY;
}

export function dailyAdBudget(s: GameState): number {
  return Object.values(s.ads).reduce((a, c) => a + (c.active ? c.budget : 0), 0);
}

export interface CashPools {
  cash: number;
  production: number;
  transit: number;
  shelf: number;
  payouts: number;
}

export function cashPools(s: GameState): CashPools {
  const sum = (status: string) =>
    s.pos.filter((p) => p.status === status).reduce((a, p) => a + p.totalCost, 0);
  return {
    cash: s.cash,
    production: sum('production'),
    transit: sum('transit'),
    shelf: s.inventory.costTotal,
    payouts: s.payoutAccrued,
  };
}

/**
 * Rough 30-day cash projection: today's cash, plus payouts from recent sales while
 * stock lasts, minus fulfillment, ads and known bills. Good enough to warn, not to audit.
 */
export function runwayProjection(s: GameState, days = 30): number[] {
  const recent = s.history.slice(-5);
  const avgOrders = recent.length ? recent.reduce((a, d) => a + d.orders, 0) / recent.length : 0;
  const ads = dailyAdBudget(s);
  let stock = s.inventory.onHand;
  let cash = s.cash;
  let accrued = s.payoutAccrued;
  const out: number[] = [];
  for (let d = 1; d <= days; d++) {
    const day = s.day + d;
    for (const po of s.pos) if (po.status !== 'arrived' && po.arrivesDay === day) stock += po.qty;
    const units = Math.min(stock, avgOrders * unitsPerOrder(s));
    stock -= units;
    const orders = units / unitsPerOrder(s);
    const fulfil = orders * (product(s).shipToCustomer + PACKAGING_COST[s.offer.packaging]);
    accrued += orders * averageOrderValue(s) * (1 - PAYMENT_FEE_PCT);
    cash -= fulfil + (orders > 0 || stock > 0 ? ads : 0);
    if (day % PAYOUT_EVERY === 0) {
      cash += accrued;
      accrued = 0;
    }
    for (const b of s.bills) if (b.dueDay === day) cash -= b.amount;
    if (s.loan && s.loan.dueDay === day) cash -= s.loan.amount;
    out.push(Math.round(cash));
  }
  return out;
}
