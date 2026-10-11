import { cpmSeason, demandSeason, dayOfYear, periodOf, type PeriodKind } from './calendar';
import {
  BENEFITS,
  CATEGORY_VIBE,
  INSERT_COST,
  layoutScore,
  CTA_FIT,
  HOOK_FIT,
  hooksFor,
  BUNDLE_SHARE,
  CATALOG,
  CATEGORIES,
  CHANNELS,
  CREATIVES,
  CUSTOMER_SHIPPING_CHARGE,
  FOUNDER_HOURS,
  HOURS,
  MODULES,
  OVERHEAD_RATE,
  PAYROLL_EVERY,
  PACK_SPEED,
  SKILLS,
  DIFFICULTY,
  PACKAGING_COST,
  PACKER_RATE,
  RACK_STORAGE,
  REGIONS,
  REGION_ORDER,
  ROLES,
  ROLE_ORDER,
  SPACES,
  SUPPLIERS,
  SUPPORT_RATE,
  THANK_YOU_COST,
  THIRD_PARTY,
} from './data';
import type {
  AdCell,
  AudienceDef,
  Brand,
  CategoryId,
  ChannelId,
  GameState,
  AdDay,
  AdSource,
  ModKey,
  PLCategory,
  ProductDef,
  Slice,
  ProductState,
  SkillId,
  SupplierId,
} from './types';

export const round2 = (n: number) => Math.round(n * 100) / 100;

// ───────────────────────────── lookups ─────────────────────────────

export function def(s: GameState, pid: string): ProductDef {
  return s.customDefs[pid] ?? CATALOG[pid];
}

export function prod(s: GameState, pid: string): ProductState {
  return s.products[pid];
}

export function brandOf(s: GameState, pid: string): Brand {
  const p = s.products[pid];
  return s.brands.find((b) => b.id === p?.brandId) ?? s.brands[0];
}

export function liveProducts(s: GameState): string[] {
  return s.productOrder.filter((id) => s.products[id] && !s.products[id].retired);
}

export function audiences(s: GameState, pid: string): [AudienceDef, AudienceDef] {
  return CATEGORIES[def(s, pid).category].audiences;
}

/** Product of all active modifiers for a key (optionally also those scoped to e.g. a supplier). */
export function mod(s: GameState, key: ModKey, scope?: string): number {
  let m = 1;
  for (const x of s.modifiers ?? []) if (x.key === key && x.until >= s.day && (!x.scope || x.scope === scope)) m *= x.mult;
  return m;
}

// ───────────────────────────── sourcing ─────────────────────────────

export function activeContract(s: GameState, supplierId: SupplierId) {
  return s.contracts.find((c) => c.supplierId === supplierId && c.endDay > s.day);
}

export function listPrice(s: GameState, pid: string, supplierId: SupplierId, qty: number): number {
  const tier = qty >= 10000 ? 0.8 : qty >= 3000 ? 0.83 : qty >= 1000 ? 0.855 : qty >= 500 ? 0.945 : 1;
  const contract = activeContract(s, supplierId);
  const priceUp = (1 + (s.counters[`priceUp-${supplierId}`] ?? 0)) * mod(s, 'unitCost', supplierId);
  return round2(def(s, pid).baseUnitCost * SUPPLIERS[supplierId].priceMult * tier * priceUp * marketOf(s, pid).cost * (contract ? 1 - contract.discount : 1));
}

export function freightPerUnit(s: GameState, pid: string, freight: 'air' | 'sea'): number {
  const d = def(s, pid);
  return round2(freight === 'air' ? d.airFreight * mod(s, 'airFreight') : d.seaFreight * mod(s, 'seaFreight'));
}

export function landedUnitCost(s: GameState, pid: string): number {
  const inv = s.products[pid].inventory;
  if (inv.onHand > 0) return inv.costTotal / inv.onHand;
  const last = [...s.pos].reverse().find((p) => p.productId === pid);
  if (last) return last.unitPrice + last.freightPerUnit;
  return listPrice(s, pid, 'brightway', 300) + def(s, pid).airFreight;
}

export function stockQuality(s: GameState, pid: string): number {
  const inv = s.products[pid].inventory;
  if (inv.onHand > 0) return inv.qualityTotal / inv.onHand;
  const last = [...s.pos].reverse().find((p) => p.productId === pid);
  return last ? last.quality : 0.8;
}

export function incomingUnits(s: GameState, pid?: string): number {
  return s.pos.filter((p) => p.status !== 'arrived' && (!pid || p.productId === pid)).reduce((a, p) => a + p.qty, 0);
}

// ───────────────────────────── offer ─────────────────────────────

export function effectivePrice(s: GameState, pid: string): number {
  const p = s.products[pid];
  return round2(p.price * (1 - p.discountPct / 100));
}

export function bundlePrice(s: GameState, pid: string): number {
  return Math.round(effectivePrice(s, pid) * 1.7) - 0.01;
}

export function bundleShare(s: GameState, pid: string): number {
  return s.products[pid].bundle ? BUNDLE_SHARE : 0;
}

/** Unit price a shopper sees on a channel. Marketplace lightning deals take 20% off. */
export function channelPrice(s: GameState, pid: string, ch: ChannelId): number {
  if (ch === 'store' || ch === 'loopshop') return effectivePrice(s, pid);
  const l = s.products[pid].listings[ch];
  const base = l?.price ?? s.products[pid].price;
  return round2(l && l.promoUntil >= s.day ? base * 0.8 : base);
}

export function channelFee(s: GameState, ch: ChannelId): number {
  return s.feeOverrides[ch] ?? CHANNELS[ch].feePct;
}

export interface OrderBreakdown {
  charged: number;
  fees: number;
  shipping: number;
  packaging: number;
  cogs: number;
  thirdParty: number;
  contribution: number;
}

export function orderBreakdown(s: GameState, pid: string, bundle: boolean, ch: ChannelId = 'store'): OrderBreakdown {
  const d = def(s, pid);
  const brand = brandOf(s, pid);
  const units = bundle ? 2 : 1;
  const own = ch === 'store' || ch === 'loopshop';
  const goods = own ? (bundle ? bundlePrice(s, pid) : effectivePrice(s, pid)) : channelPrice(s, pid, ch) * units;
  const charged = goods + (ch === 'store' && !brand.freeShipping ? CUSTOMER_SHIPPING_CHARGE : 0);
  const c = CHANNELS[ch];
  const program = !own && !!s.products[pid].listings[ch]?.program && !!c.program;
  const fees = charged * channelFee(s, ch) + c.feeFlat + (program ? c.program!.feePerUnit * units : 0);
  const shipping = program ? 0 : d.shipToCustomer * (bundle ? 1.25 : 1) * mod(s, 'shipping');
  const thirdParty = program || !s.thirdParty ? 0 : THIRD_PARTY.perOrder;
  const packaging = program ? 0 : PACKAGING_COST[brand.packaging] * mod(s, 'packaging') + (brand.thankYouCard ? THANK_YOU_COST : 0) + (brand.packDesign ? INSERT_COST[brand.packDesign.insert] : 0);
  const cogs = landedUnitCost(s, pid) * units;
  return {
    charged: round2(charged),
    fees: round2(fees),
    shipping: round2(shipping),
    packaging: round2(packaging),
    cogs: round2(cogs),
    thirdParty: round2(thirdParty),
    contribution: round2(charged - fees - shipping - thirdParty - packaging - cogs),
  };
}

/** What one average store order earns before advertising. */
export function breakEvenCPA(s: GameState, pid: string): number {
  const b = bundleShare(s, pid);
  return round2(orderBreakdown(s, pid, false).contribution * (1 - b) + orderBreakdown(s, pid, true).contribution * b);
}

export function averageOrderValue(s: GameState, pid: string): number {
  const b = bundleShare(s, pid);
  return round2(orderBreakdown(s, pid, false).charged * (1 - b) + orderBreakdown(s, pid, true).charged * b);
}

export function unitsPerOrder(s: GameState, pid: string): number {
  return 1 + bundleShare(s, pid);
}

// ───────────────────────────── reviews & trust ─────────────────────────────

export function averageRating(s: GameState, pid?: string): number {
  if (pid) {
    const r = s.products[pid].reviews;
    return r.count ? r.sum / r.count : 0;
  }
  let n = 0;
  let sum = 0;
  for (const p of Object.values(s.products)) {
    n += p.reviews.count;
    sum += p.reviews.sum;
  }
  return n ? sum / n : 0;
}

export function reviewCount(s: GameState, pid?: string): number {
  if (pid) return s.products[pid].reviews.count;
  return Object.values(s.products).reduce((a, p) => a + p.reviews.count, 0);
}

export function reviewFactor(s: GameState, pid: string): number {
  const n = s.products[pid].reviews.count;
  if (!n) return 0.85;
  return 0.85 + Math.min(1, n / 8) * ((averageRating(s, pid) - 3) * 0.14 + 0.1);
}

export interface TrustPart {
  label: string;
  value: number;
}

export function trustBreakdown(s: GameState, pid: string): { total: number; parts: TrustPart[] } {
  const brand = brandOf(s, pid);
  const p = s.products[pid];
  const d = def(s, pid);
  const m = brand.store.modules;
  const photo = p.photoStars;
  const parts: TrustPart[] = [{ label: 'Base', value: 0.45 }];
  const add = (label: string, value: number) => value && parts.push({ label, value });

  if (m.header) add('Header & logo', m.header === 2 ? 0.08 : 0.05);
  if (m.hero) add('Hero image', 0.03 * photo - 0.02 + (m.hero === 2 ? 0.06 : 0));
  if (m.gallery) add('Gallery', m.gallery === 2 ? 0.1 : 0.06 * (photo / 4));
  if (m.description) {
    const mult = m.description === 2 ? 1.3 : 1;
    const sum = p.benefits.reduce((a, id) => a + (d.benefits.find((b) => b.id === id)?.cvr ?? 0), 0);
    add('Description', sum * mult);
  }
  if (m.reviews) {
    const n = p.reviews.count;
    add('Reviews', n === 0 ? -0.02 : Math.min(0.14, n * 0.012) * ((averageRating(s, pid) - 2) / 3));
  }
  if (m.badges) add('Trust badges', m.badges === 2 ? 0.05 : 0.04);
  if (m.faq) add('FAQ', 0.04);
  if (m.shipping) add('Shipping info', m.shipping === 2 ? 0.09 : 0.07);
  if (m.checkout) add('Checkout', m.checkout === 2 ? 0.1 : 0.05);
  if (brand.packaging === 'branded') add('Branded unboxing', 0.03);
  if (brand.packScore) add('Packaging design', 0.03 * brand.packScore);
  const pos = s.positioning?.[pid];
  if (pos && p.benefits.includes(pos)) add('Answers the #1 complaint', 0.05);
  if (brand.store.order?.length) add('Page flow', 0.06 * layoutScore(brand.store.order.filter((x) => m[x] > 0)) - 0.02);
  if (brand.theme) add('Theme fit', brand.theme === CATEGORY_VIBE[d.category] ? 0.03 : -0.01);
  if (brand.store.quality != null) add('Store build quality', (brand.store.quality - 0.55) * 0.3);

  const count = MODULES.filter((x) => m[x.id] > 0).length;
  const heavy = (m.hero === 2 ? 1 : 0) + (m.gallery === 2 ? 1 : 0);
  const clutter = Math.max(0, count - 7) * 0.03 + heavy * 0.015;
  if (clutter) parts.push({ label: 'Page load & clutter', value: -clutter });

  const total = Math.min(1.3, Math.max(0.4, parts.reduce((a, x) => a + x.value, 0)));
  return { total, parts };
}

export function trust(s: GameState, pid: string): number {
  return trustBreakdown(s, pid).total;
}

export function returnRate(s: GameState, pid: string): number {
  const d = def(s, pid);
  const overPromise = s.products[pid].benefits.reduce((a, id) => a + (d.benefits.find((b) => b.id === id)?.returns ?? 0), 0);
  const ratio = effectivePrice(s, pid) / d.refPrice;
  const bargain = ratio < 0.8 ? 0.02 : ratio > 1.2 ? -0.01 : 0;
  return Math.max(0.01, 0.02 + (1 - stockQuality(s, pid)) * 0.1 + overPromise + bargain);
}

export function perception(s: GameState, pid: string): { label: string; ratio: number } {
  const ratio = effectivePrice(s, pid) / def(s, pid).refPrice;
  const label =
    ratio < 0.75 ? 'Bargain bin' : ratio < 0.92 ? 'Good deal' : ratio < 1.12 ? 'Fair price' : ratio < 1.35 ? 'Premium' : 'Luxury';
  return { label, ratio };
}

export function priceFactor(s: GameState, pid: string, elasticity: number, price = effectivePrice(s, pid), ch: ChannelId = 'store'): number {
  const d = def(s, pid);
  const brand = brandOf(s, pid);
  const shipPenalty = ch === 'store' && !brand.freeShipping ? CUSTOMER_SHIPPING_CHARGE * 1.3 : 0;
  const perceived = price + shipPenalty;
  const fatigue = s.products[pid].discountPct > 0 ? s.discountFatigue * 0.3 : s.discountFatigue;
  return Math.pow(d.refPrice / perceived, elasticity) * (1 - fatigue);
}

export function trendMult(s: GameState, pid: string, day = s.day): number {
  const t = def(s, pid).trend;
  const season = demandSeason(day);
  if (t.kind === 'evergreen') return (1 + 0.05 * Math.sin(day / 9)) * season;
  if (t.kind === 'seasonal') {
    const [a, b, mult] = t.season!;
    const doy = dayOfYear(day);
    return (doy >= a && doy <= b ? mult : 0.85) * season;
  }
  const peak = t.peakDay ?? 30;
  const x = (day - peak) / 9;
  return (day <= peak ? 0.7 + 1.3 * Math.exp(-x * x) : 0.25 + 1.75 * Math.exp(-x * x)) * season;
}

/** Copycat sellers steal a share of every shopper who would have bought. */
export function copycatMult(s: GameState, pid: string): number {
  return (1 - s.products[pid].copycat) * (s.products[pid].market?.share ?? 1);
}

export function siteCVR(s: GameState, pid: string, aud: AudienceDef | null, cvrBoost = 1): number {
  const d = def(s, pid);
  const elasticity = aud ? aud.elasticity : 1.35;
  const fit = aud ? aud.cvrFit : 0.95;
  const exclusive = d.exclusive ? 1.1 : 1;
  return d.baseCVR * trust(s, pid) * priceFactor(s, pid, elasticity) * reviewFactor(s, pid) * fit * cvrBoost * exclusive * copycatMult(s, pid) * mod(s, 'cvr');
}

export interface CellForecast {
  cpm: number;
  ctr: number;
  cpc: number;
  cvr: number;
  cpa: number;
}

export function cellForecast(s: GameState, pid: string, cell: AdCell): CellForecast {
  const d = def(s, pid);
  const auds = audiences(s, pid);
  const idx = Math.max(0, auds.findIndex((a) => a.id === cell.audienceId));
  const aud = auds[idx];
  const cre = CREATIVES[cell.creative];
  const reach = 1 + intlFactor(s);
  const competition = 0.55 + d.bars.competition * 0.15;
  const skill = hasSkill(s, 'adsAdvanced') ? 0.92 : 1;
  const cpm = aud.cpm * competition * cpmSeason(s.day) * (1 + Math.pow(cell.budget / (aud.scale * reach), 1.15) * 0.6) * mod(s, 'adCost') * marketOf(s, pid).ad * skill;
  const fatigue = Math.max(0.6, 1 - 0.012 * Math.max(0, cell.daysActive - 5));
  const marketer = s.team.marketer.count > 0 ? 1.1 : 1;
  const doy = dayOfYear(s.day);
  const resolution = cell.audienceId === 'fresh' && doy >= 300 && doy <= 345 ? 1.4 : 1;
  const cm = creativeMult(s, pid, cell.creative, idx);
  const craft = (hasSkill(s, 'copywriting') ? 1.1 : 1) * (hasSkill(s, 'adsAdvanced') ? 1.12 : 1);
  const ctr = cre.ctr * cre.fit[idx] * fatigue * marketer * Math.min(1.8, trendMult(s, pid)) * resolution * cm.ctr * craft * mod(s, 'adCtr', pid);
  const cpc = cpm / (1000 * ctr);
  const cvr = siteCVR(s, pid, aud, cre.cvrBoost) * cm.cvr;
  return { cpm, ctr, cpc, cvr, cpa: cpc / cvr };
}

/** How the chosen photo, hook and call-to-action of a creative land with an audience. */
export function creativeMult(s: GameState, pid: string, type: AdCell['creative'], audIdx: number): { ctr: number; cvr: number; notes: string[] } {
  const p = s.products[pid];
  const cr = p.creatives?.[type];
  if (!cr) return { ctr: 1, cvr: 1, notes: [] };
  const hooks = hooksFor(def(s, pid));
  const hook = hooks.find((h) => h.id === cr.hook) ?? hooks[0];
  const fit = HOOK_FIT[hook.type];
  const notes: string[] = [];
  let believable = 1;
  if (hook.needsReviews && p.reviews.count < hook.needsReviews) {
    believable = 0.7;
    notes.push('Social proof without reviews looks fake');
  }
  const photo = cr.photo < 0 ? 0.75 + p.photoStars * 0.08 : 1;
  if (cr.photo < 0 && p.photoStars >= 4) notes.push('Your own photo stands out');
  if (cr.photo < 0 && p.photoStars <= 2) notes.push('Weak photo hurts clicks');
  const q = p.creativeQuality ?? 0.45;
  if (q >= 0.75) notes.push('Researched against competitors');
  if (q < 0.45) notes.push('Unresearched creative');
  return { ctr: fit.ctr[audIdx] * CTA_FIT[cr.cta].ctr * photo * believable * (0.8 + 0.45 * q), cvr: fit.cvr * CTA_FIT[cr.cta].cvr * (0.92 + 0.18 * q), notes };
}

export function creativeUnlocked(s: GameState, pid: string, creative: AdCell['creative']): boolean {
  const c = CREATIVES[creative];
  if (c.needsReviews && s.products[pid].reviews.count < c.needsReviews) return false;
  if (c.needsUgc && !s.products[pid].ugc) return false;
  return true;
}

export function recentCPA(cell: { history: { spend: number; orders: number }[] }, days = 5): { spend: number; orders: number; cpa: number | null } {
  const recent = cell.history.slice(-days);
  const spend = recent.reduce((a, d) => a + d.spend, 0);
  const orders = recent.reduce((a, d) => a + d.orders, 0);
  return { spend, orders, cpa: orders ? spend / orders : null };
}

export function searchForecast(s: GameState, pid: string) {
  const d = def(s, pid);
  const cpc = (0.6 + 0.25 * d.bars.competition) * cpmSeason(s.day) * mod(s, 'adCost') * marketOf(s, pid).ad;
  const maxClicks = d.searchVolume * trendMult(s, pid) * (1 + intlFactor(s)) * copycatMult(s, pid);
  const cvr = siteCVR(s, pid, null) * 1.6 * (hasSkill(s, 'searchAds') ? 1.1 : 1);
  return { cpc, maxClicks, cvr, cpa: cpc / cvr };
}

// ───────────────────────────── international ─────────────────────────────

/** Extra demand from foreign markets. Without a local warehouse, slow shipping halves conversion. */
export function intlFactor(s: GameState): number {
  let f = 0;
  for (const id of REGION_ORDER) {
    const r = s.regions[id];
    if (r?.entered) f += REGIONS[id].demand * (r.warehouse ? 1 : 0.55);
  }
  return f;
}

export function intlShare(s: GameState): number {
  const f = intlFactor(s);
  return f / (1 + f);
}

/** Average extra cost (shipping, duty, local handling) of one international order. */
export function intlExtraCost(s: GameState, pid: string): number {
  const d = def(s, pid);
  let weighted = 0;
  let total = 0;
  for (const id of REGION_ORDER) {
    const r = s.regions[id];
    if (!r?.entered) continue;
    const reg = REGIONS[id];
    const w = reg.demand * (r.warehouse ? 1 : 0.55);
    const ship = r.warehouse ? d.shipToCustomer * 0.1 + 2.5 : d.shipToCustomer * (reg.shipMult - 1);
    weighted += w * (ship + landedUnitCost(s, pid) * reg.duty);
    total += w;
  }
  return total ? weighted / total : 0;
}

// ───────────────────────────── operations ─────────────────────────────

// ───────────────────────────── founder & skills ─────────────────────────────

/** Courses count once studied, software while subscribed, gear once bought. */
export function hasSkill(s: GameState, id: SkillId): boolean {
  const st = s.skills?.[id];
  if (!st) return false;
  const d = SKILLS[id];
  if (d.kind === 'course') return st.progress >= (d.hours ?? 0);
  if (d.kind === 'software') return !!st.active;
  return true;
}

export function founderMaxHours(_s: GameState): number {
  return FOUNDER_HOURS;
}

export function hoursLeft(s: GameState): number {
  if (s.flags.adminHours) return FOUNDER_HOURS + s.extraHours;
  return Math.max(0, founderMaxHours(s) + s.extraHours - s.hoursUsed);
}

/** Founder hours to pack one order: packing gear speeds it up. */
export function packHours(s: GameState): number {
  let h = HOURS.handPack;
  for (const [id, mult] of Object.entries(PACK_SPEED)) if (hasSkill(s, id as SkillId)) h *= mult ?? 1;
  return h;
}

/** How far a product's market has drifted (ad costs, unit costs) since you started selling it. */
export function marketOf(s: GameState, pid: string): { ad: number; cost: number; share: number } {
  const m = s.products[pid]?.market;
  return { ad: m?.ad ?? 1, cost: m?.cost ?? 1, share: m?.share ?? 1 };
}

export function difficultyOf(s: GameState) {
  return DIFFICULTY[s.difficulty ?? 'normal'];
}

export function moraleMult(m: number): number {
  return 0.7 + (0.5 * m) / 100;
}

export function storageCapacity(s: GameState): number {
  if (s.thirdParty) return Infinity;
  const racks = s.layout.cells.filter((c) => c === 'rack').length;
  return SPACES[s.space].storage + racks * RACK_STORAGE + (s.stage === 2 ? (s.counters.storageBonus ?? 0) : 0);
}

export function storageUsed(s: GameState): number {
  return Object.keys(s.products).reduce((a, id) => a + s.products[id].inventory.onHand * def(s, id).size, 0);
}

/** Per-station packing efficiency, best first. Close to racks, near the dock and on a conveyor is best. */
export function stationEfficiencies(s: GameState): number[] {
  if (s.space === 'apartment') return [];
  if (s.space === 'garage') return [1, 1, 1];
  const { w, h, cells } = s.layout;
  const racks: [number, number][] = [];
  const conveyors = new Set<number>();
  cells.forEach((c, i) => {
    if (c === 'rack') racks.push([i % w, Math.floor(i / w)]);
    if (c === 'conveyor') conveyors.add(i);
  });
  const dock = [Math.floor(w / 2), h - 1];
  const out: number[] = [];
  cells.forEach((c, i) => {
    if (c !== 'station') return;
    const x = i % w;
    const y = Math.floor(i / w);
    out.push(stationEfficiency(x, y, w, racks, conveyors, dock));
  });
  return out.sort((a, b) => b - a);
}

export function stationEfficiency(x: number, y: number, w: number, racks: [number, number][], conveyors: Set<number>, dock: number[]): number {
  const near = racks.length ? Math.min(...racks.map(([rx, ry]) => Math.abs(rx - x) + Math.abs(ry - y))) : 12;
  const toDock = Math.abs(dock[0] - x) + Math.abs(dock[1] - y);
  const i = y * w + x;
  const neighbors = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
  const conveyor = neighbors.some((n) => n >= 0 && conveyors.has(n));
  return Math.max(0.6, 1.15 - 0.05 * Math.max(0, near - 1) - 0.01 * toDock + (conveyor ? 0.25 : 0));
}

export interface Capacity {
  founder: number;
  team: number;
  robots: number;
  total: number;
  stations: number;
  usedStations: number;
  thirdParty: boolean;
}

export function fulfillmentCapacity(s: GameState): Capacity {
  const thirdParty = s.thirdParty;
  const founder = !thirdParty && s.stage <= 2 && s.batchPacking ? Math.floor(hoursLeft(s) / packHours(s)) : 0;
  const effs = stationEfficiencies(s);
  const packers = s.team.packer.count;
  const shifts = s.team.lead.count > 0 ? s.shifts : 1;
  const leadCover = packers ? Math.min(1, (s.team.lead.count * 15) / packers) : 0;
  const rate =
    PACKER_RATE *
    moraleMult(s.team.packer.morale) *
    (1 + 0.15 * leadCover) *
    (s.automation.labelPrinter ? 1.1 : 1) *
    (s.automation.scanners ? 1.1 : 1) *
    (storageUsed(s) > storageCapacity(s) ? 0.85 : 1);
  let remaining = packers;
  let team = 0;
  let used = 0;
  for (let sh = 0; sh < shifts; sh++) {
    for (const e of effs) {
      if (remaining <= 0) break;
      team += e * rate;
      remaining--;
      used++;
    }
  }
  const robots = s.layout.cells.filter((c) => c === 'robot').length * 110;
  const total = thirdParty ? Infinity : founder + team + robots;
  return { founder, team: Math.round(team), robots, total, stations: effs.length, usedStations: Math.min(used, effs.length), thirdParty };
}

export function supportCapacity(s: GameState): number {
  const t = s.team.support;
  return Math.round(t.count * SUPPORT_RATE * moraleMult(t.morale) * (s.support.tone === 'personal' ? 0.7 : 1));
}

export function headcount(s: GameState): number {
  return ROLE_ORDER.reduce((a, r) => a + s.team[r].count, 0);
}

export function seatsUsed(s: GameState, seat: 'floor' | 'office'): number {
  return ROLE_ORDER.filter((r) => ROLES[r].seat === seat).reduce((a, r) => a + s.team[r].count, 0);
}

export function payrollByRole(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of ROLE_ORDER) out[r] = s.team[r].count * ROLES[r].wage * BENEFITS * s.team[r].wageMult * (r === 'packer' && s.shifts === 2 ? 1.08 : 1);
  return out;
}

export function payrollMonthly(s: GameState): number {
  return ROLE_ORDER.reduce((a, r) => a + s.team[r].count * ROLES[r].wage * BENEFITS * s.team[r].wageMult * (r === 'packer' && s.shifts === 2 ? 1.08 : 1), 0);
}

// ───────────────────────────── sales stats ─────────────────────────────

export function avgDailyOrders(s: GameState, pid: string, days = 7): number {
  const d = s.products[pid].daily.slice(-days);
  return d.length ? d.reduce((a, x) => a + x, 0) / d.length : 0;
}

/** Sales pace that ignores short spikes: the 7-day average, capped at 1.3× the longer-run average. */
export function steadyDailyUnits(s: GameState, pid: string): number {
  const d7 = avgDailyOrders(s, pid, 7);
  const d30 = avgDailyOrders(s, pid, 30);
  const pace = s.products[pid].daily.length >= 14 ? Math.min(d7, Math.max(d30, 1) * 1.3) : d7;
  return pace * unitsPerOrder(s, pid);
}

export function stockDays(s: GameState, pid: string): number | null {
  const daily = avgDailyOrders(s, pid, 5) * unitsPerOrder(s, pid);
  if (daily <= 0) return null;
  return s.products[pid].inventory.onHand / daily;
}

export function emptyPL(): Record<PLCategory, number> {
  return { revenue: 0, refunds: 0, cogs: 0, fulfillment: 0, fees: 0, ads: 0, payroll: 0, rent: 0, other: 0, interest: 0 };
}

export function profitOf(pl: Record<PLCategory, number>): number {
  return pl.revenue - pl.refunds - pl.cogs - pl.fulfillment - pl.fees - pl.ads - pl.payroll - pl.rent - pl.other - pl.interest;
}

export function trailing(s: GameState, days: number) {
  const recent = s.history.slice(-days);
  const pl = emptyPL();
  let orders = 0;
  let repeat = 0;
  const channel: Partial<Record<ChannelId, number>> = {};
  for (const r of recent) {
    for (const k of Object.keys(pl) as PLCategory[]) pl[k] += r.pl[k];
    orders += r.orders;
    repeat += r.repeatOrders;
    for (const [ch, v] of Object.entries(r.channelRevenue)) channel[ch as ChannelId] = (channel[ch as ChannelId] ?? 0) + (v ?? 0);
  }
  return { pl, profit: profitOf(pl), revenue: pl.revenue, orders, repeat, channel, days: recent.length };
}

export function brandTrailing(s: GameState, brandId: number, days: number) {
  let revenue = 0;
  let cost = 0;
  for (const r of s.history.slice(-days)) {
    revenue += r.brandRevenue[brandId] ?? 0;
    cost += r.brandCost[brandId] ?? 0;
  }
  return { revenue, profit: revenue - cost };
}

export function marketShare(s: GameState, cat: CategoryId): number {
  const market = CATEGORIES[cat].marketSize * (1 + intlFactor(s));
  const mine = liveProducts(s)
    .filter((id) => def(s, id).category === cat)
    .reduce((a, id) => a + avgDailyOrders(s, id, 7), 0);
  return mine / market;
}

// ───────────────────────────── cash ─────────────────────────────

export interface CashPools {
  cash: number;
  production: number;
  transit: number;
  shelf: number;
  payouts: number;
  receivables: number;
  payables: number;
}

export function cashPools(s: GameState): CashPools {
  const sum = (status: string) => s.pos.filter((p) => p.status === status).reduce((a, p) => a + p.totalCost, 0);
  return {
    cash: s.cash,
    production: sum('production'),
    transit: sum('transit'),
    shelf: Object.values(s.products).reduce((a, p) => a + p.inventory.costTotal, 0),
    payouts: Object.values(s.channelAccrued).reduce((a, v) => a + (v ?? 0), 0),
    receivables: s.receivables.reduce((a, r) => a + r.amount, 0),
    payables: (s.payables ?? []).reduce((a, r) => a + r.amount, 0) + s.pos.reduce((a, p) => a + (p.status !== 'arrived' ? p.balanceDue : 0), 0),
  };
}

export function dailyAdBudget(s: GameState, pid?: string): number {
  const ids = pid ? [pid] : liveProducts(s);
  return ids.reduce((a, id) => {
    const p = s.products[id];
    return (
      a +
      Object.values(p.ads).reduce((x, c) => x + (c.active ? c.budget : 0), 0) +
      (p.search.active ? p.search.budget : 0) +
      Object.values(p.listings).reduce((x, l) => x + (l?.active ? l.sponsored : 0), 0)
    );
  }, 0);
}

/** Rough profit per order at the reference price, shipped by air from a mid-range supplier, before ads. */
export function roughKeep(s: GameState, pid: string) {
  const d = def(s, pid);
  const landed = d.baseUnitCost + d.airFreight;
  const fees = d.refPrice * 0.03 + 0.3;
  const keep = d.refPrice - landed - d.shipToCustomer - PACKAGING_COST.basic - fees;
  return { landed, fees, keep, margin: keep / d.refPrice };
}

/** The day a channel next pays out (payouts land on days divisible by its schedule). */
export function nextPayoutDay(s: GameState, ch: ChannelId): number {
  const every = CHANNELS[ch].payoutEvery;
  return (Math.floor(s.day / every) + 1) * every;
}

export interface UpcomingPayout {
  channel: ChannelId;
  day: number;
  /** Already earned and waiting. */
  held: number;
  /** Held plus what the last week's pace adds before the payout day. */
  estimate: number;
}

/** Each channel's next payout: when it lands and roughly how much. */
export function upcomingPayouts(s: GameState): UpcomingPayout[] {
  const pace = channelTrailing(s, 7);
  const days = Math.max(1, Math.min(7, s.history.length));
  const out: UpcomingPayout[] = [];
  for (const ch of Object.keys(CHANNELS) as ChannelId[]) {
    const held = s.channelAccrued[ch] ?? 0;
    const x = pace[ch];
    const daily = x ? (x.revenue - x.fees) / days : 0;
    if (held < 1 && daily < 1) continue;
    const day = nextPayoutDay(s, ch);
    out.push({ channel: ch, day, held, estimate: held + daily * (day - s.day) });
  }
  return out.sort((a, b) => a.day - b.day);
}

export interface ForecastDay {
  day: number;
  cash: number;
  inflows: { label: string; amount: number }[];
  outflows: { label: string; amount: number }[];
}

/**
 * Rough cash projection from the last week's averages. Sales build up in each channel and land on its payout
 * day; fulfillment, ads and refunds leave daily; payroll, bills, overhead and supplier balances on their dates.
 * Good enough to warn, not to audit.
 */
export function cashForecast(s: GameState, days = 30): ForecastDay[] {
  const t = trailing(s, 7);
  const n = Math.max(1, t.days);
  const pace = channelTrailing(s, 7);
  const accrual: Partial<Record<ChannelId, number>> = {};
  for (const [ch, x] of Object.entries(pace)) if (x) accrual[ch as ChannelId] = (x.revenue - x.fees) / n;
  const pending: Partial<Record<ChannelId, number>> = { ...s.channelAccrued };
  const refunds = t.pl.refunds / n;
  const variable = (t.pl.fulfillment + t.pl.ads) / n;
  const payroll = (payrollMonthly(s) * PAYROLL_EVERY) / 30;
  const overhead = trailing(s, 30).revenue * OVERHEAD_RATE[s.stage];
  let cash = s.cash;
  const out: ForecastDay[] = [];
  let stockUnits = Object.values(s.products).reduce((a, p) => a + p.inventory.onHand, 0);
  const dailyUnits = Object.keys(s.products).reduce((a, id) => a + avgDailyOrders(s, id, 7) * unitsPerOrder(s, id), 0);
  for (let d = 1; d <= days; d++) {
    const day = s.day + d;
    const inflows: ForecastDay['inflows'] = [];
    const outflows: ForecastDay['outflows'] = [];
    const pay = (label: string, amount: number) => {
      if (amount <= 0) return;
      cash -= amount;
      outflows.push({ label, amount });
    };
    for (const po of s.pos) {
      if (po.status === 'arrived') continue;
      if (po.arrivesDay === day) stockUnits += po.qty;
      const sup = SUPPLIERS[po.supplierId]?.company ?? 'Supplier';
      if (po.productionDoneDay === day && po.balanceDue && !po.net30) pay(`${sup} balance`, po.balanceDue);
      if (po.net30 && po.arrivesDay + 30 === day) pay(`${sup} invoice (net 30)`, po.balanceDue);
    }
    const selling = stockUnits > 0;
    stockUnits = Math.max(0, stockUnits - dailyUnits);
    if (selling) for (const [ch, v] of Object.entries(accrual)) pending[ch as ChannelId] = (pending[ch as ChannelId] ?? 0) + (v ?? 0);
    cash -= (selling ? refunds : 0) + variable * (selling ? 1 : 0.6);
    for (const [ch, v] of Object.entries(pending)) {
      if (!v || v < 1 || day % CHANNELS[ch as ChannelId].payoutEvery !== 0) continue;
      cash += v;
      inflows.push({ label: `${CHANNELS[ch as ChannelId].name} payout`, amount: v });
      pending[ch as ChannelId] = 0;
    }
    if (day % PAYROLL_EVERY === 0) pay('Payroll', payroll);
    if (day % 30 === 0) pay('Admin & overhead', overhead);
    for (const b of s.bills) {
      const due = b.dueDay === day || (!!b.everyDays && day > b.dueDay && (day - b.dueDay) % b.everyDays === 0);
      if (due && b.category !== 'payroll') pay(b.label, b.amount);
    }
    for (const r of s.receivables)
      if (r.dueDay === day) {
        cash += r.amount;
        inflows.push({ label: r.label, amount: r.amount });
      }
    for (const p of s.payables ?? []) if (p.dueDay === day) pay(p.label, p.amount);
    if (s.loan && s.loan.dueDay === day) pay(s.loan.label, s.loan.amount);
    out.push({ day, cash: Math.round(cash), inflows, outflows });
  }
  return out;
}

// ───────────────────────────── analytics ─────────────────────────────

export function zeroSlice(): Slice {
  return { orders: 0, units: 0, revenue: 0, refunds: 0, cogs: 0, fees: 0, fulfillment: 0, thirdParty: 0, ads: 0 };
}

export function sliceProfit(x: Slice): number {
  return x.revenue - x.refunds - x.cogs - x.fees - x.fulfillment - x.ads;
}

function addSlice(into: Slice, x: Slice | undefined): void {
  if (!x) return;
  for (const k of Object.keys(into) as (keyof Slice)[]) into[k] += x[k] ?? 0;
}

/** Per-product P&L over the last `days` days (contribution: before payroll, rent and overhead). */
export function productTrailing(s: GameState, days: number): Record<string, Slice> {
  const out: Record<string, Slice> = {};
  for (const r of s.history.slice(-days)) for (const [pid, x] of Object.entries(r.productPL ?? {})) addSlice((out[pid] ??= zeroSlice()), x);
  return out;
}

export function channelTrailing(s: GameState, days: number): Partial<Record<ChannelId, Slice>> {
  const out: Partial<Record<ChannelId, Slice>> = {};
  for (const r of s.history.slice(-days)) for (const [ch, x] of Object.entries(r.channelPL ?? {})) addSlice((out[ch as ChannelId] ??= zeroSlice()), x);
  return out;
}

export function zeroAd(): AdDay {
  return { spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0 };
}

/** Ad results per product and source over the last `days` days, plus totals per source. */
export function adTrailing(s: GameState, days: number): { byProduct: Record<string, Partial<Record<AdSource, AdDay>>>; total: Record<AdSource, AdDay> } {
  const byProduct: Record<string, Partial<Record<AdSource, AdDay>>> = {};
  const total: Record<AdSource, AdDay> = { scrollr: zeroAd(), seekly: zeroAd(), creator: zeroAd(), sponsored: zeroAd() };
  for (const r of s.history.slice(-days)) {
    for (const [pid, srcs] of Object.entries(r.adStats ?? {})) {
      for (const [src, x] of Object.entries(srcs)) {
        const row = ((byProduct[pid] ??= {})[src as AdSource] ??= zeroAd());
        for (const k of Object.keys(row) as (keyof AdDay)[]) {
          row[k] += x?.[k] ?? 0;
          total[src as AdSource][k] += x?.[k] ?? 0;
        }
      }
    }
  }
  return { byProduct, total };
}

/** Average orders a day that you ship yourself (not marketplace-fulfilled), and in total. */
export function orderPace(s: GameState, days: number): { total: number; own: number } {
  const recent = s.history.slice(-days);
  if (!recent.length) return { total: 0, own: 0 };
  const total = recent.reduce((a, r) => a + r.orders, 0) / recent.length;
  const own = recent.reduce((a, r) => a + (r.ownOrders ?? r.orders), 0) / recent.length;
  return { total, own };
}

export interface PeriodPL {
  label: string;
  days: number;
  partial: boolean;
  pl: Record<PLCategory, number>;
  sub: Partial<Record<PLCategory, Record<string, number>>>;
}

/** P&L grouped by calendar month, quarter or year (newest last), with one level of detail per line. */
export function periodPL(s: GameState, kind: PeriodKind, count: number): PeriodPL[] {
  const groups = new Map<number, PeriodPL>();
  const size = kind === 'month' ? 30 : kind === 'quarter' ? 90 : 360;
  for (const r of s.history) {
    const { key, label } = periodOf(r.day, kind);
    let g = groups.get(key);
    if (!g) {
      g = { label, days: 0, partial: false, pl: emptyPL(), sub: {} };
      groups.set(key, g);
    }
    g.days++;
    for (const k of Object.keys(g.pl) as PLCategory[]) g.pl[k] += r.pl[k];
    for (const [cat, lines] of Object.entries(r.plSub ?? {})) {
      const into = (g.sub[cat as PLCategory] ??= {});
      for (const [name, v] of Object.entries(lines ?? {})) into[name] = (into[name] ?? 0) + v;
    }
  }
  const out = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => ({ ...g, partial: g.days < size }));
  return out.slice(-count);
}
