import { cpmSeason, isBigBazaarlyDays } from '../calendar';
import { CHANNELS, HOURS, MARKETPLACES, OVERHEAD_RATE, PAYROLL_EVERY, ROLE_TEAM, SUPPLIERS, THIRD_PARTY } from '../data';
import {
  averageRating,
  avgDailyOrders,
  brandOf,
  bundlePrice,
  bundleShare,
  cellForecast,
  channelFee,
  channelPrice,
  creativeUnlocked,
  def,
  effectivePrice,
  fulfillmentCapacity,
  intlFactor,
  intlShare,
  liveProducts,
  mod,
  payrollByRole,
  payrollMonthly,
  priceFactor,
  profitOf,
  reviewFactor,
  round2,
  searchForecast,
  siteCVR,
  stockQuality,
  storageCapacity,
  storageUsed,
  supportCapacity,
  trailing,
  trendMult,
  copycatMult,
} from '../economics';
import { binomial, chance, poisson, rand } from '../rng';
import type { BacklogBucket, ChannelId, DailyRecord, GameState, OrderSource, RoleId } from '../types';
import { adStat, book, countSource, milestone, MILESTONE_LABELS, notify, randomCustomer, slice, today } from './core';
import { brandManaged, cashCrisis, chargeInterest, checkAmbitions, checkStageOffer, runLab, updateCredit } from './company';
import { reorderDelayEvent, rollEvents, randomShipDelay } from './events';
import { marketerPass } from './marketing';
import { leadPass, shipFromBucket } from './ops';
import { expireCards, processDeliveries, processTickets } from './reviews';
import { revealDue, runReorders, settleContracts } from './sourcing';
import { adminTopUp } from './admin';
import { onStore } from './storefront';

export function isBlocked(s: GameState): boolean {
  return s.status !== 'playing' || s.events.some((e) => e.blocking);
}

// ───────────────────────────── fulfillment ─────────────────────────────

/** End of day: pack and ship as much of the backlog as capacity allows, oldest first. */
function endOfDayFulfillment(s: GameState): void {
  const cap = fulfillmentCapacity(s);
  let budget = cap.total;
  let founderLeft = cap.founder;
  // Wholesale pallets go first: 50 units count as one order of work.
  for (const w of s.wholesale) {
    if (w.shipped) continue;
    const inv = s.products[w.productId]?.inventory;
    if (!inv || inv.onHand < w.qty) continue;
    const work = w.qty / 50;
    if (work > budget) continue;
    budget -= work;
    shipWholesale(s, w.id);
  }
  for (const b of s.backlog) {
    if (budget <= 0) break;
    const n = Math.min(Math.round(b.orders), Math.floor(budget));
    if (n <= 0) continue;
    if (!cap.thirdParty) {
      const fromFounder = Math.min(n, founderLeft);
      founderLeft -= fromFounder;
      s.hoursUsed += fromFounder * HOURS.handPack;
    }
    budget -= n;
    shipFromBucket(s, b, n);
  }
  s.backlog = s.backlog.filter((b) => b.orders > 0.5);
  cancelStaleOrders(s);
}

/** Orders that wait more than a week get cancelled: refund, stock back on the shelf, angry reviews, worse marketplace rank. */
function cancelStaleOrders(s: GameState): void {
  let cancelled = 0;
  for (const b of s.backlog) {
    if (s.day - b.day < 7 || b.orders <= 0) continue;
    const p = s.products[b.productId];
    const n = Math.round(b.orders);
    book(s, 'refunds', b.revenue, { brandId: p.brandId, productId: b.productId, channel: b.channel });
    const unitCost = p.inventory.onHand > 0 ? p.inventory.costTotal / p.inventory.onHand : landedUnitCostSafe(s, b.productId);
    p.inventory.onHand += Math.round(b.units);
    p.inventory.costTotal = round2(p.inventory.costTotal + unitCost * b.units);
    p.inventory.qualityTotal += stockQuality(s, b.productId) * b.units;
    book(s, 'cogs', -unitCost * b.units, { cash: false, brandId: p.brandId, productId: b.productId, channel: b.channel });
    const angry = Math.ceil(n * 0.3);
    p.reviews.count += angry;
    p.reviews.sum += angry;
    p.reviews.hist[0] += angry;
    const l = p.listings[b.channel];
    if (l) l.rank *= 0.8;
    cancelled += n;
    b.orders = 0;
  }
  if (cancelled) {
    s.backlog = s.backlog.filter((b) => b.orders > 0.5);
    notify(s, 'info', `❌ ${cancelled.toLocaleString()} orders waited over a week and were cancelled. You need more packing capacity (staff, stations, or a 3PL).`, true);
  }
}

function landedUnitCostSafe(s: GameState, pid: string): number {
  const last = [...s.pos].reverse().find((p) => p.productId === pid);
  return last ? last.unitPrice + last.freightPerUnit : def(s, pid).baseUnitCost;
}

function shipWholesale(s: GameState, id: number): void {
  const w = s.wholesale.find((x) => x.id === id)!;
  const p = s.products[w.productId];
  const avg = p.inventory.costTotal / p.inventory.onHand;
  const q = p.inventory.qualityTotal / p.inventory.onHand;
  p.inventory.onHand -= w.qty;
  p.inventory.costTotal = round2(Math.max(0, p.inventory.costTotal - avg * w.qty));
  p.inventory.qualityTotal -= q * w.qty;
  const revenue = round2(w.qty * w.unitPrice);
  const brandId = p.brandId;
  book(s, 'revenue', revenue, { cash: false, brandId, productId: w.productId });
  book(s, 'cogs', avg * w.qty, { cash: false, brandId, productId: w.productId });
  book(s, 'fulfillment', w.qty * 0.6, { brandId, productId: w.productId });
  countSource(s, 'wholesale', 1);
  s.receivables.push({ dueDay: s.day + 30, amount: revenue, label: `${w.account} invoice` });
  w.shipped = true;
  const late = s.day > w.dueDay;
  milestone(s, 'first_wholesale');
  notify(s, 'sale', `🏪 Shipped ${w.qty.toLocaleString()} units to ${w.account}${late ? ' (late!)' : ''}. Invoice: $${revenue.toLocaleString()}, due in 30 days.`);
  // Happy accounts come back.
  if (!late && w.recurring < 6) {
    s.wholesale.push({ ...w, id: s.seq + 1, shipped: false, dueDay: s.day + 40, recurring: w.recurring + 1 });
    s.seq++;
  }
}

// ───────────────────────────── arrivals ─────────────────────────────

function arrivals(s: GameState): void {
  for (const sample of s.samples) {
    if (!sample.arrived && s.day >= sample.arrivesDay) {
      sample.arrived = true;
      notify(s, 'sample', `Sample of ${def(s, sample.productId).name} from ${SUPPLIERS[sample.supplierId].company} arrived! Unbox it on SourceMart.`, true);
    }
  }
  for (const po of s.pos) {
    const sup = SUPPLIERS[po.supplierId];
    if (po.status === 'production' && s.day >= po.productionDoneDay) {
      po.status = 'transit';
      if (po.balanceDue > 0 && !po.net30) {
        s.cash = round2(s.cash - po.balanceDue);
        notify(s, 'cash', `Paid ${sup.company} the 70% balance: −$${Math.round(po.balanceDue).toLocaleString()}.`);
        po.balanceDue = 0;
      }
      if (po.inspection && po.quality < sup.quality - 0.1) {
        po.quality = sup.quality;
        po.arrivesDay += 4;
        po.delayDays += 4;
        notify(s, 'po', `Inspection caught defects in ${sup.company}’s batch. They’re reworking it (+4 days).`, true);
      } else if (s.flags[`drift-${po.id}`]) {
        notify(s, 'po', `${sup.contact}: “Shipped early! Same as before, my friend!” (Hmm…)`);
      }
      if (po.isReorder && !s.flags.reorderDelay && s.stage === 1) {
        s.flags.reorderDelay = true;
        reorderDelayEvent(s, po.id);
      } else {
        const delay = po.freight === 'sea' ? randomShipDelay(s, po.supplierId) : chance(s, (1 - sup.reliability) / 2) ? 2 : 0;
        if (delay) {
          po.arrivesDay += delay;
          po.delayDays += delay;
          notify(s, 'po', `BlueLane: ${def(s, po.productId).name} shipment delayed ${delay} days (now day ${po.arrivesDay}).`, po.qty >= 300);
        }
      }
    }
    if (po.status === 'transit' && s.day >= po.arrivesDay) {
      po.status = 'arrived';
      const inv = s.products[po.productId].inventory;
      inv.onHand += po.qty;
      inv.costTotal = round2(inv.costTotal + po.totalCost);
      inv.qualityTotal += po.quality * po.qty;
      notify(s, 'po', `📦 ${po.qty.toLocaleString()} × ${def(s, po.productId).name} delivered!`, !po.auto);
      if (po.net30 && po.balanceDue > 0) {
        s.payables.push({ dueDay: s.day + 30, amount: po.balanceDue, label: `${sup.company} invoice (net 30)` });
        po.balanceDue = 0;
      }
    }
  }
  // Keep the PO list manageable.
  if (s.pos.length > 60) s.pos = s.pos.filter((p, i) => p.status !== 'arrived' || i >= s.pos.length - 40);
}

// ───────────────────────────── money in & out ─────────────────────────────

function billsAndPayouts(s: GameState): void {
  for (const bill of [...s.bills]) {
    if (bill.dueDay !== s.day) continue;
    book(s, bill.category, bill.amount, { sub: bill.label.startsWith('Rent') ? 'Rent' : bill.label });
    if (bill.amount >= 500) notify(s, 'cash', `Paid ${bill.label}: −$${bill.amount.toLocaleString()}.`);
    if (bill.everyDays) bill.dueDay += bill.everyDays;
    else s.bills = s.bills.filter((b) => b.id !== bill.id);
  }
  if (s.day % PAYROLL_EVERY === 0) {
    const pay = round2((payrollMonthly(s) * PAYROLL_EVERY) / 30);
    if (pay > 0) {
      for (const [role, amount] of Object.entries(payrollByRole(s))) if (amount > 0) book(s, 'payroll', round2((amount * PAYROLL_EVERY) / 30), { sub: ROLE_TEAM[role as RoleId] });
      notify(s, 'cash', `Payroll: −$${Math.round(pay).toLocaleString()}.`);
    }
  }
  if (s.day % 30 === 0 && OVERHEAD_RATE[s.stage] > 0) {
    const overhead = round2(trailing(s, 30).revenue * OVERHEAD_RATE[s.stage]);
    if (overhead > 0) {
      book(s, 'other', overhead, { sub: 'Admin & overhead' });
      notify(s, 'cash', `Admin & overhead (software, insurance, accounting, legal): −$${Math.round(overhead).toLocaleString()}.`);
    }
  }
  if (s.thirdParty && s.day % 30 === 0) {
    const units = Object.keys(s.products).reduce((a, id) => a + s.products[id].inventory.onHand * def(s, id).size, 0);
    book(s, 'rent', round2(units * THIRD_PARTY.storagePerUnitMonth), { sub: '3PL storage' });
  }
  const over = storageUsed(s) - storageCapacity(s);
  if (over > 0) {
    book(s, 'rent', round2(over * 0.05), { sub: 'Overflow storage' });
    if (s.day % 7 === 0) notify(s, 'info', `📦 You’re ${Math.round(over).toLocaleString()} units over storage capacity. Overflow storage costs money and slows packing.`, s.day % 28 === 0);
  }
  if (s.loan && s.loan.dueDay === s.day) {
    s.cash = round2(s.cash - s.loan.amount);
    book(s, 'interest', s.loan.amount - s.loan.principal, { cash: false, sub: 'Loans' });
    notify(s, 'cash', `Repaid the ${s.loan.label}: −$${s.loan.amount.toLocaleString()}.`);
    s.loan = null;
  }
  chargeInterest(s);
  for (const [ch, amt] of Object.entries(s.channelAccrued)) {
    const c = CHANNELS[ch as ChannelId];
    if (!amt || s.day % c.payoutEvery !== 0) continue;
    s.cash = round2(s.cash + amt);
    s.channelAccrued[ch as ChannelId] = 0;
    if (amt >= 200) notify(s, 'cash', `${c.name} payout: +$${Math.round(amt).toLocaleString()}.`);
  }
  for (const r of [...s.receivables]) {
    if (r.dueDay !== s.day) continue;
    s.cash = round2(s.cash + r.amount);
    notify(s, 'cash', `${r.label}: +$${Math.round(r.amount).toLocaleString()}.`);
  }
  s.receivables = s.receivables.filter((r) => r.dueDay > s.day);
  for (const p of s.payables) {
    if (p.dueDay !== s.day) continue;
    s.cash = round2(s.cash - p.amount);
    notify(s, 'cash', `Paid ${p.label}: −$${Math.round(p.amount).toLocaleString()}.`);
  }
  s.payables = s.payables.filter((p) => p.dueDay > s.day);
}

// ───────────────────────────── demand ─────────────────────────────

interface Demand {
  channel: ChannelId;
  source: OrderSource;
  campaignId?: number;
  only?: string;
  orders: number;
  repeat?: boolean;
  discount?: number;
  customer?: string;
  city?: string;
}

function productDemand(s: GameState, pid: string, rec: DailyRecord): Demand[] {
  const p = s.products[pid];
  const d = def(s, pid);
  const brand = brandOf(s, pid);
  const out: Demand[] = [];
  const hasStock = p.inventory.onHand > 0;
  const trend = trendMult(s, pid);
  const intl = 1 + intlFactor(s);
  const live = onStore(s, pid);

  // Your store: Scrollr ads
  if (live) {
    let adOrders = 0;
    const stockPause = !hasStock && !!s.adPolicy.pauseOOS;
    for (const cell of Object.values(p.ads)) {
      if (!cell.active) continue;
      if (!creativeUnlocked(s, pid, cell.creative)) {
        cell.active = false;
        continue;
      }
      if (stockPause) continue;
      if (s.cash < cell.budget && !s.credit.unlocked) {
        cell.active = false;
        s.flags.adsPausedCash = true;
        continue;
      }
      const f = cellForecast(s, pid, cell);
      const spent = round2(cell.budget * (0.92 + rand(s) * 0.08));
      const impressions = Math.round((spent / f.cpm) * 1000);
      const clicks = poisson(s, impressions * f.ctr);
      const orders = hasStock ? poisson(s, clicks * f.cvr) : 0;
      book(s, 'ads', spent, { brandId: brand.id, productId: pid, channel: 'store', sub: 'Scrollr social ads' });
      adStat(s, pid, 'scrollr', { spend: spent, impressions, clicks });
      rec.visits += clicks;
      rec.impressions += impressions;
      brand.awareness += impressions * 0.0004;
      cell.daysActive++;
      cell.totals.spend += spent;
      cell.totals.impressions += impressions;
      cell.totals.clicks += clicks;
      cell.totals.orders += orders;
      cell.history.push({ day: s.day, spend: spent, impressions, clicks, orders });
      if (cell.history.length > 14) cell.history.shift();
      adOrders += orders;
    }
    if (adOrders) out.push({ channel: 'store', source: 'scrollr', orders: adOrders });

    // Seekly search ads
    if (p.search.active && !stockPause) {
      const f = searchForecast(s, pid);
      const clicks = Math.min(poisson(s, p.search.budget / f.cpc), Math.round(f.maxClicks));
      const spent = round2(clicks * f.cpc);
      const orders = hasStock ? poisson(s, clicks * f.cvr) : 0;
      book(s, 'ads', spent, { brandId: brand.id, productId: pid, channel: 'store', sub: 'Seekly search ads' });
      adStat(s, pid, 'seekly', { spend: spent, impressions: Math.round(clicks / 0.045), clicks });
      rec.visits += clicks;
      p.search.history.push({ day: s.day, spend: spent, clicks, orders });
      if (p.search.history.length > 14) p.search.history.shift();
      if (orders) out.push({ channel: 'store', source: 'seekly', orders });
    }

    // Organic store traffic: reviews, word of mouth and brand awareness
    const siblings = Object.keys(s.products).filter((id) => s.products[id].brandId === brand.id && onStore(s, id)).length || 1;
    const awareness = (brand.awareness * 0.01 * (brandManaged(s, brand.id) ? 1 : 0.5)) / siblings;
    const visits = ((5 + 2 * Math.min(p.reviews.count, 80) * (averageRating(s, pid) >= 4 ? 1 : 0.6)) * trend * copycatMult(s, pid) + awareness) * intl;
    rec.visits += Math.round(visits);
    const organic = hasStock ? poisson(s, visits * siteCVR(s, pid, null) * 0.9) : 0;
    if (organic) out.push({ channel: 'store', source: 'organic', orders: organic });
  }

  // Creator & viral spikes land on LoopShop if listed, otherwise on your store
  if (p.creatorBoost.length) {
    const visits = p.creatorBoost.shift()!;
    brand.awareness += visits * 0.3;
    const loop = p.listings.loopshop?.active && s.channels.loopshop?.joined;
    if (loop || live) {
      rec.visits += visits;
      adStat(s, pid, 'creator', { impressions: visits * 12, clicks: visits });
      const cvr = siteCVR(s, pid, null) * (loop ? CHANNELS.loopshop.cvrMult : 1);
      const orders = hasStock ? poisson(s, visits * cvr) : 0;
      if (orders) out.push({ channel: loop ? 'loopshop' : 'store', source: 'creator', orders });
    }
  }

  // Marketplaces (and LoopShop's small organic feed)
  for (const ch of ['loopshop', ...MARKETPLACES] as ChannelId[]) {
    const l = p.listings[ch];
    if (!l?.active || !s.channels[ch]?.joined) continue;
    const c = CHANNELS[ch];
    const promo = l.promoUntil >= s.day;
    const bbd = ch === 'bazaarly' && isBigBazaarlyDays(s.day) && promo;
    const visits = c.traffic * d.bars.demand * trend * Math.pow(l.rank, 1.4) * intl * copycatMult(s, pid) * (promo ? 2 : 1) * (bbd ? 2.5 : 1);
    let sponsoredClicks = 0;
    if (l.sponsored > 0 && hasStock) {
      const cpc = (0.5 + 0.18 * d.bars.competition) * cpmSeason(s.day) * mod(s, 'adCost');
      // Sponsored slots only get so many shoppers: about a quarter of the product's search traffic there.
      sponsoredClicks = Math.round(Math.min(l.sponsored / cpc, c.traffic * d.bars.demand * 0.25 * trend * intl));
      const spent = round2(sponsoredClicks * cpc);
      book(s, 'ads', spent, { brandId: brand.id, productId: pid, channel: ch, sub: `Sponsored · ${CHANNELS[ch].name}` });
      adStat(s, pid, 'sponsored', { spend: spent, impressions: sponsoredClicks * 30, clicks: sponsoredClicks });
    }
    rec.visits += Math.round(visits + sponsoredClicks);
    const price = channelPrice(s, pid, ch);
    const premium = ch === 'crafthaus' ? 0.8 + stockQuality(s, pid) * 0.3 : 1;
    const cvr = d.baseCVR * c.cvrMult * priceFactor(s, pid, ch === 'flashcart' ? 2 : 1.4, price, ch) * reviewFactor(s, pid) * (l.program && c.program ? c.program.cvrBonus : 1) * premium * (d.exclusive ? 1.1 : 1);
    const organicOrders = hasStock ? poisson(s, visits * cvr) : 0;
    const sponsoredOrders = hasStock ? poisson(s, sponsoredClicks * cvr) : 0;
    if (l.sponsored > 0) {
      (l.adHistory ??= []).push({ day: s.day, spend: round2(sponsoredClicks * (0.5 + 0.18 * d.bars.competition) * cpmSeason(s.day) * mod(s, 'adCost')), orders: sponsoredOrders });
      if (l.adHistory.length > 14) l.adHistory.shift();
    }
    const orders = organicOrders + sponsoredOrders;
    l.recent.push(orders);
    if (l.recent.length > 7) l.recent.shift();
    // Ranking: sales velocity, rating and stock. Bazaarly punishes stock-outs hard.
    const velocity = l.recent.reduce((a, x) => a + x, 0) / Math.max(1, l.recent.length);
    const target = Math.min(1, 0.06 + velocity / (d.bars.demand * 35)) * (averageRating(s, pid) >= 4.3 || p.reviews.count < 5 ? 1 : 0.7) * (l.sponsored > 0 ? 1.15 : 1);
    l.rank = hasStock ? Math.max(0.02, Math.min(1, l.rank + (target - l.rank) * 0.08 + (promo ? 0.01 : 0))) : l.rank * (ch === 'bazaarly' ? 0.85 : 0.95);
    if (organicOrders) out.push({ channel: ch, source: ch === 'loopshop' ? 'organic' : 'marketplace', orders: organicOrders });
    if (sponsoredOrders) out.push({ channel: ch, source: 'sponsored', orders: sponsoredOrders });
  }
  return out;
}

/** Repeat customers and email campaigns, per brand, spread over the brand's products by sales mix. */
function brandRepeatDemand(s: GameState): Map<string, Demand[]> {
  const out = new Map<string, Demand[]>();
  for (const brand of s.brands) {
    const pids = Object.keys(s.products).filter((id) => s.products[id].brandId === brand.id && onStore(s, id) && s.products[id].inventory.onHand > 0);
    if (!pids.length) continue;
    const weights = pids.map((id) => avgDailyOrders(s, id, 7) + 0.2);
    const total = weights.reduce((a, w) => a + w, 0);
    const repeatability = pids.reduce((a, id, i) => a + def(s, id).repeatability * weights[i], 0) / total;
    const rating = averageRating(s);
    const flows = brand.email.flows;
    const rate =
      0.0011 *
      repeatability *
      (rating >= 4.5 ? 1.2 : rating >= 4 ? 1 : 0.5) *
      (flows.postPurchase ? 1.35 : 1) *
      (flows.winback ? 1.15 : 1) *
      (brand.packaging === 'branded' ? 1.15 : 1) *
      (brand.thankYouCard ? 1.05 : 1) *
      (1 + 0.12 * (brand.packScore ?? 0));
    let repeat = poisson(s, brand.customers * rate);
    if (!s.flags.priya && s.shipped >= 15 && (rating >= 3.8 || s.shipped < 40)) {
      s.flags.priya = true;
      repeat = Math.max(1, repeat);
    }
    const allocate = (n: number, extra: Partial<Demand>) => {
      for (let k = 0; k < n; k++) {
        let i = 0;
        if (extra.only && pids.includes(extra.only)) i = pids.indexOf(extra.only);
        else {
          let r = rand(s) * total;
          while (r > weights[i] && i < weights.length - 1) r -= weights[i++];
        }
        const list = out.get(pids[i]) ?? [];
        list.push({ channel: 'store', source: 'repeat', orders: 1, repeat: true, ...extra });
        out.set(pids[i], list);
      }
    };
    // Part of repeat buying only happens because email flows nudged people: credit the flows.
    const flowMult = (flows.postPurchase ? 1.35 : 1) * (flows.winback ? 1.15 : 1);
    const fromFlows = binomial(s, repeat, 1 - 1 / flowMult);
    allocate(Math.min(repeat - fromFlows, 5000), {});
    allocate(Math.min(fromFlows, 5000), { source: 'flow' });
    let campaignOrders = 0;
    for (const q of brand.email.queue ?? []) {
      const n = poisson(s, q.days.shift() ?? 0);
      campaignOrders += n;
      allocate(Math.min(n, 5000), { discount: q.discount, source: 'email', campaignId: q.id, only: q.productId });
    }
    brand.email.queue = (brand.email.queue ?? []).filter((q) => q.days.length);
    if (repeat + campaignOrders > 0) milestone(s, 'first_repeat');
  }
  return out;
}

// ───────────────────────────── selling ─────────────────────────────

function sell(s: GameState, pid: string, demand: Demand[], rec: DailyRecord): { orders: number; lost: number } {
  const p = s.products[pid];
  const brand = brandOf(s, pid);
  let sold = 0;
  let lost = 0;
  const share = intlShare(s);
  // Merge demand by channel (+ repeat flag) so big days stay cheap to simulate.
  for (const dem of demand) {
    const own = dem.channel === 'store' || dem.channel === 'loopshop';
    const bundles = own ? binomial(s, dem.orders, bundleShare(s, pid)) : 0;
    let orders = dem.orders;
    let units = orders + bundles;
    if (units > p.inventory.onHand) {
      const fit = Math.floor(p.inventory.onHand / (units / orders));
      lost += orders - fit;
      orders = fit;
      units = Math.min(p.inventory.onHand, Math.round(orders * (1 + bundles / Math.max(1, dem.orders))));
    }
    if (orders <= 0) continue;
    const bundleOrders = Math.min(orders, Math.round((bundles * orders) / dem.orders));
    const singleOrders = orders - bundleOrders;
    const unitPrice = own ? effectivePrice(s, pid) * (1 - (dem.discount ?? 0) / 100) : channelPrice(s, pid, dem.channel);
    const goods = own ? singleOrders * unitPrice + bundleOrders * (bundlePrice(s, pid) * (1 - (dem.discount ?? 0) / 100)) : orders * unitPrice;
    const shipCharge = dem.channel === 'store' && !brand.freeShipping ? orders * 4.99 : 0;
    const revenue = round2(goods + shipCharge);
    const c = CHANNELS[dem.channel];
    const program = !own && !!p.listings[dem.channel]?.program && !!c.program;
    const fees = round2(revenue * channelFee(s, dem.channel) + orders * c.feeFlat + (program ? c.program!.feePerUnit * units : 0));
    // Stock out
    const inv = p.inventory;
    const avg = inv.costTotal / inv.onHand;
    const q = inv.qualityTotal / inv.onHand;
    inv.onHand -= units;
    inv.costTotal = inv.onHand ? round2(inv.costTotal - avg * units) : 0;
    inv.qualityTotal = inv.onHand ? inv.qualityTotal - q * units : 0;
    // Books: revenue and fees accrue to the channel's next payout; COGS leaves inventory.
    const tag = { cash: false, brandId: brand.id, productId: pid, channel: dem.channel };
    book(s, 'revenue', revenue, tag);
    book(s, 'fees', fees, tag);
    book(s, 'cogs', avg * units, tag);
    slice(s, pid, dem.channel, 'orders', orders);
    slice(s, pid, dem.channel, 'units', units);
    countSource(s, dem.source, orders);
    (rec.sourceRevenue ??= {})[dem.source] = (rec.sourceRevenue[dem.source] ?? 0) + revenue;
    if (dem.campaignId) {
      const camp = s.emails.find((e) => e.id === dem.campaignId);
      if (camp) {
        camp.orders += orders;
        camp.revenue += revenue;
      }
    }
    if (dem.source === 'scrollr' || dem.source === 'seekly' || dem.source === 'creator' || dem.source === 'sponsored') adStat(s, pid, dem.source, { orders, revenue });
    s.channelAccrued[dem.channel] = round2((s.channelAccrued[dem.channel] ?? 0) + revenue - fees);
    rec.channelRevenue[dem.channel] = (rec.channelRevenue[dem.channel] ?? 0) + revenue;
    rec.orders += orders;
    rec.units += units;
    if (dem.repeat) rec.repeatOrders += orders;
    s.counters.revenueLifetime += revenue;
    sold += orders;
    p.sold += orders;
    // Customers
    brand.customers += orders * c.loyalty * (dem.repeat ? 0 : 1);
    if (own && !dem.repeat) brand.email.list += Math.round(orders * (brand.email.flows.welcome ? 0.45 : 0.3) * (s.stage >= 2 ? 1 : 0));
    brand.awareness += orders;
    const intl = dem.repeat ? 0 : binomial(s, orders, share);
    rec.intlOrders += intl;
    if (intl) milestone(s, 'first_international_sale');
    if (!own) milestone(s, 'first_marketplace_sale');
    if (!s.milestones.first_sale) milestone(s, 'first_sale');

    if (!program) rec.ownOrders = (rec.ownOrders ?? 0) + orders;
    if (program) {
      // Marketplace ships it for you.
      s.deliveries.push({ dueDay: s.day + 3, productId: pid, channel: dem.channel, orders, revenue, quality: stockQuality(s, pid) || q, delayDays: 0, damageRate: 0 });
      s.shipped += orders;
      continue;
    }
    const handEra = !s.batchPacking && !s.thirdParty && s.stage === 1;
    if (handEra) {
      for (let i = 0; i < orders; i++) {
        const who = dem.customer ? { name: dem.customer, city: dem.city! } : randomCustomer(s);
        s.backlog.push({ day: s.day, productId: pid, channel: dem.channel, orders: 1, units: units / orders, revenue: revenue / orders, intl: i < intl ? 1 : 0, customer: who.name, city: who.city });
      }
    } else {
      const existing = s.backlog.find((b) => b.day === s.day && b.productId === pid && b.channel === dem.channel && !b.customer);
      if (existing) {
        existing.orders += orders;
        existing.units += units;
        existing.revenue += revenue;
        existing.intl += intl;
      } else s.backlog.push({ day: s.day, productId: pid, channel: dem.channel, orders, units, revenue, intl } as BacklogBucket);
    }
  }
  return { orders: sold, lost };
}

// ───────────────────────────── people ─────────────────────────────

function updateMorale(s: GameState): void {
  const cap = fulfillmentCapacity(s);
  const backlog = s.backlog.reduce((a, b) => a + b.orders, 0);
  const overloaded = !cap.thirdParty && s.team.packer.count > 0 && backlog > Math.max(10, cap.team * 0.5);
  const supportOver = s.tickets.queue.reduce((a, t) => a + t.count, 0) > supportCapacity(s);
  for (const [role, t] of Object.entries(s.team)) {
    if (!t.count) continue;
    const pressure = (role === 'packer' && overloaded) || (role === 'support' && supportOver);
    const base = 65 + (t.wageMult - 1) * 60;
    t.morale = Math.max(0, Math.min(100, pressure ? t.morale - 1.5 : t.morale + (base - t.morale) * 0.03));
    if (t.morale < 35 && t.count > 1 && chance(s, 0.02 * t.count)) {
      t.count -= 1;
      notify(s, 'team', `😞 A ${role} quit. Morale was ${Math.round(t.morale)}. Overwork and low pay drive people out.`, true);
    }
  }
  for (const person of s.people) person.morale = Math.round((person.morale * 4 + s.team[person.role].morale) / 5);
}

// ───────────────────────────── month report ─────────────────────────────

function monthReport(s: GameState): void {
  if (s.day % 30 !== 0 || s.history.length < 10) return;
  const t = trailing(s, 30);
  const month = s.day / 30;
  const best = liveProducts(s).sort((a, b) => avgDailyOrders(s, b, 30) - avgDailyOrders(s, a, 30))[0];
  const highlights: string[] = [];
  if (best) highlights.push(`Best seller: ${def(s, best).name} (${Math.round(avgDailyOrders(s, best, 14))}/day)`);
  const channels = Object.entries(t.channel).filter(([, v]) => (v ?? 0) > 0);
  if (channels.length > 1) highlights.push(`Channels: ${channels.map(([k, v]) => `${CHANNELS[k as ChannelId].name} ${Math.round(((v ?? 0) / t.revenue) * 100)}%`).join(' · ')}`);
  const ms = Object.entries(s.milestones).filter(([, d]) => (d ?? 0) > s.day - 30).map(([k]) => MILESTONE_LABELS[k as keyof typeof MILESTONE_LABELS]);
  if (ms.length) highlights.push(`Milestones: ${ms.join(', ')}`);
  if (t.orders) highlights.push(`${Math.round((t.repeat / t.orders) * 100)}% of orders came from repeat customers`);
  s.reports.push({ month, fromDay: s.day - 29, toDay: s.day, pl: t.pl, profit: profitOf(t.pl), orders: t.orders, highlights });
  if (s.reports.length > 36) s.reports.shift();
  if (t.revenue >= 10000) milestone(s, 'first_10k_month');
  notify(s, 'info', `📊 Month ${month} report: revenue $${Math.round(t.revenue).toLocaleString()}, profit $${Math.round(t.profit).toLocaleString()}.`, s.stage <= 3);
}

// ───────────────────────────── the day ─────────────────────────────

export function advanceDay(s: GameState): void {
  adminTopUp(s);
  if (isBlocked(s)) return;

  endOfDayFulfillment(s);
  const closing = today(s);
  closing.cash = s.cash;
  s.hoursUsed = 0;
  s.extraHours = 0;

  s.day++;
  const rec = today(s);

  revealDue(s);
  arrivals(s);
  billsAndPayouts(s);
  settleContracts(s);
  rollEvents(s);

  // Stage 1's first viral moment, once the founder has their feet under them.
  const firstPid = liveProducts(s)[0];
  if (s.stage === 1 && firstPid && !s.flags.viral && s.shipped >= 10 && s.day >= 16 && s.products[firstPid].inventory.onHand > 0 && (chance(s, 0.25) || s.day >= 24)) {
    s.flags.viral = true;
    s.products[firstPid].creatorBoost = [240, 170, 90];
    notify(s, 'event', `A LoopShop creator just posted about ${def(s, firstPid).name}! Expect a wave of visitors for 3 days. Watch your stock.`, true);
  }

  // Mom always buys first.
  const momPid = liveProducts(s).find((id) => onStore(s, id) && s.products[id].inventory.onHand > 0);
  const repeat = brandRepeatDemand(s);
  let lostTotal = 0;
  for (const pid of liveProducts(s)) {
    const p = s.products[pid];
    const demand = productDemand(s, pid, rec);
    if (!s.flags.mom && pid === momPid) {
      s.flags.mom = true;
      demand.unshift({ channel: 'store', source: 'organic', orders: 1, customer: 'Mom', city: 'Hometown' });
    }
    demand.push(...(repeat.get(pid) ?? []));
    const hadStock = p.inventory.onHand > 0;
    const { orders, lost } = sell(s, pid, demand, rec);
    lostTotal += lost;
    p.daily.push(orders);
    if (p.daily.length > 30) p.daily.shift();
    rec.productOrders[pid] = orders;
    const everStocked = s.pos.some((po) => po.productId === pid && po.status === 'arrived');
    if (everStocked && p.inventory.onHand <= 0 && (onStore(s, pid) || Object.values(p.listings).some((l) => l?.active))) {
      p.stockoutDays++;
      if (p.stockoutDays % 5 === 1 || (hadStock && lost > 0)) notify(s, 'info', `Out of stock: ${def(s, pid).name}! ${lost ? `${lost} sales lost today.` : 'Shoppers leave empty-handed.'}`, true);
    }
  }
  if (s.flags.adsPausedCash) {
    s.flags.adsPausedCash = false;
    notify(s, 'cash', 'Some ads paused: not enough cash to cover their daily budget.', true);
  }
  s.lastDayOrders = rec.orders;

  processDeliveries(s);
  processTickets(s);
  expireCards(s);
  updateMorale(s);

  marketerPass(s);
  if (s.day % 3 === 0) leadPass(s);
  runReorders(s);
  runLab(s);
  updateCredit(s);
  checkStageOffer(s);
  checkAmbitions(s);
  if (s.counters.revenueLifetime >= 1e6) milestone(s, 'revenue_1m');

  // Slow drifts
  s.discountFatigue = liveProducts(s).some((id) => s.products[id].discountPct > 0) ? Math.min(0.3, s.discountFatigue + 0.02) : Math.max(0, s.discountFatigue - 0.01);
  for (const p of Object.values(s.products)) p.copycat = Math.max(0, p.copycat - 0.0015);
  for (const b of s.brands) {
    b.awareness *= 0.996;
    b.customers *= 0.996;
    b.email.fatigue = Math.max(0, b.email.fatigue - 0.012);
    b.email.list = Math.round(b.email.list * 0.999);
  }

  monthReport(s);
  if (s.history.length > 800) s.history.splice(0, s.history.length - 800);
  rec.cash = s.cash;
  cashCrisis(s);
}

/** Run days until something worth the player's attention happens (or `max` days pass). */
export function skipToNextEvent(s: GameState, max = 30): number {
  const before = s.notices.length ? s.notices[s.notices.length - 1].id : 0;
  let n = 0;
  while (n < max && !isBlocked(s)) {
    advanceDay(s);
    n++;
    if (s.notices.some((x) => x.id > before && x.pause)) break;
    if (s.stage === 1 && !s.batchPacking && s.backlog.length) break;
  }
  return n;
}

