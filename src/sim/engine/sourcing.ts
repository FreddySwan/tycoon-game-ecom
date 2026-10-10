import {
  AIR_DAYS,
  MARKET_SCAN,
  CATALOG,
  CREATIVE_ORDER,
  GENERIC_SAMPLE_NOTES,
  HOURS,
  INSPECTION_COST,
  PRODUCT_SLOTS,
  SAMPLE_COST,
  SAMPLE_DAYS,
  SEA_DAYS,
  STARTING_CASH,
  SUPPLIERS,
  WIN_REORDER_QTY,
} from '../data';
import { activeContract, audiences, def, mod, freightPerUnit, incomingUnits, listPrice, liveProducts, round2, steadyDailyUnits } from '../economics';
import { chance, normal, pick } from '../rng';
import type { Freight, GameState, ReorderRule, SupplierId } from '../types';
import { type ActionResult, book, milestone, newProduct, nextId, notify, spendCash, spendOn, useHours } from './core';

// ───────────────────────────── products ─────────────────────────────

export function productSlots(s: GameState): number {
  return PRODUCT_SLOTS[s.stage];
}

export function addProduct(s: GameState, pid: string, brandId?: number): ActionResult {
  if (s.products[pid] && !s.products[pid].retired) return 'You already sell this.';
  if (!s.revealed.includes(pid) && !s.customDefs[pid]) return 'Not discovered yet.';
  if (liveProducts(s).length >= productSlots(s)) return `Your business can handle ${productSlots(s)} products at this stage. Grow to add more.`;
  const p = newProduct(s, pid, brandId ?? s.brands[0].id);
  const auds = audiences(s, pid);
  for (const a of auds) {
    for (const c of CREATIVE_ORDER) {
      const key = `${a.id}:${c}`;
      p.ads[key] = { key, audienceId: a.id, creative: c, active: false, budget: 10, daysActive: 0, totals: { spend: 0, impressions: 0, clicks: 0, orders: 0 }, history: [] };
    }
  }
  s.products[pid] = p;
  if (!s.productOrder.includes(pid)) s.productOrder.push(pid);
  notify(s, 'info', `Added ${def(s, pid).name}. Next: source it on SourceMart.`);
  return null;
}

/** Back-compat name used by the opening flow. */
export const chooseProduct = addProduct;

export function retireProduct(s: GameState, pid: string, liquidate: boolean): ActionResult {
  const p = s.products[pid];
  if (!p) return 'Unknown product.';
  if (liquidate && p.inventory.onHand > 0) {
    const value = round2(p.inventory.costTotal * 0.3);
    book(s, 'cogs', p.inventory.costTotal - value, { cash: false, sub: 'Liquidation losses' });
    s.cash = round2(s.cash + value);
    notify(s, 'cash', `Liquidated ${p.inventory.onHand} units of ${def(s, pid).name} for $${value.toFixed(0)}.`);
    p.inventory = { onHand: 0, costTotal: 0, qualityTotal: 0 };
  }
  p.retired = true;
  for (const c of Object.values(p.ads)) c.active = false;
  p.search.active = false;
  for (const l of Object.values(p.listings)) if (l) l.active = false;
  return null;
}

export function research(s: GameState): ActionResult {
  const hidden = Object.values(CATALOG).filter((d) => d.unlockStage <= s.stage && !s.revealed.includes(d.id));
  if (!hidden.length) return 'Nothing new to find right now. More products unlock as you grow.';
  const err = useHours(s, HOURS.research);
  if (err) return err;
  const found = pick(s, hidden);
  s.revealed.push(found.id);
  notify(s, 'info', `Research paid off: ${found.name} looks promising.`, true);
  return null;
}

/** How much you know about a product: 0 = just a name, 1 = quick scan, 2 = deep dive. */
export function researchLevel(s: GameState, pid: string): number {
  if (s.products[pid] || s.stage >= 3 || s.customDefs[pid]) return 2;
  return s.research[pid] ?? 0;
}

export const RESEARCH_HOURS = { 1: 1, 2: 2 } as const;

export function researchProduct(s: GameState, pid: string, depth: 1 | 2): ActionResult {
  const cur = researchLevel(s, pid);
  if (cur >= depth) return null;
  if (depth === 2 && cur < 1) return 'Do a quick scan first.';
  const err = useHours(s, RESEARCH_HOURS[depth]);
  if (err) return err;
  s.research[pid] = depth;
  return null;
}

/** Finish a market-scan deep dive. Finding the real complaint gives the product a positioning angle. */
export function completeScan(s: GameState, pid: string, foundComplaint: boolean): ActionResult {
  const cur = researchLevel(s, pid);
  if (cur < 1) return 'Do a quick scan first.';
  if (cur < 2) {
    const err = useHours(s, RESEARCH_HOURS[2]);
    if (err) return err;
    s.research[pid] = 2;
  }
  const scan = MARKET_SCAN[def(s, pid).baseId ?? pid];
  if (foundComplaint && scan) {
    s.positioning[pid] = scan.benefit;
    notify(s, 'info', `🎯 Positioning found for ${def(s, pid).name}: lead with “${def(s, pid).benefits.find((b) => b.id === scan.benefit)?.text}”.`);
  }
  return null;
}

export function toggleShortlist(s: GameState, pid: string): ActionResult {
  if (s.shortlist.includes(pid)) {
    s.shortlist = s.shortlist.filter((x) => x !== pid);
    return null;
  }
  if (s.shortlist.length >= 5) return 'Your shortlist holds 5 products. Drop one first.';
  s.shortlist.push(pid);
  return null;
}

export function revealDue(s: GameState): void {
  for (const d of Object.values(CATALOG)) {
    if (s.revealed.includes(d.id) || d.unlockStage > s.stage || d.appearsDay > s.day) continue;
    s.revealed.push(d.id);
    notify(s, 'info', `📈 New in the Trend Scanner: ${d.name}.`, d.trend.kind === 'fad');
  }
}

// ───────────────────────────── samples ─────────────────────────────

export function orderSample(s: GameState, pid: string, supplierId: SupplierId): ActionResult {
  if (!s.products[pid]) return 'Add the product first.';
  if (s.samples.some((x) => x.productId === pid && x.supplierId === supplierId)) return 'Sample already ordered.';
  const err = spendOn(s, 'other', SAMPLE_COST, undefined, 'Samples');
  if (err) return err;
  s.samples.push({ productId: pid, supplierId, arrivesDay: s.day + SAMPLE_DAYS, arrived: false, inspected: false });
  return null;
}

export function inspectSample(s: GameState, pid: string, supplierId: SupplierId): ActionResult {
  const sample = s.samples.find((x) => x.productId === pid && x.supplierId === supplierId);
  if (!sample?.arrived) return 'That sample hasn’t arrived yet.';
  if (sample.inspected) return null;
  const err = useHours(s, HOURS.inspectSample);
  if (err) return err;
  sample.inspected = true;
  milestone(s, 'first_sample');
  return null;
}

export function sampleNote(s: GameState, pid: string, supplierId: SupplierId): string {
  const d = def(s, pid);
  const custom = d.sampleNotes?.[supplierId] ?? (d.baseId ? CATALOG[d.baseId]?.sampleNotes?.[supplierId] : undefined);
  if (custom) return custom;
  const q = SUPPLIERS[supplierId].quality;
  return q < 0.7 ? GENERIC_SAMPLE_NOTES.low : q < 0.9 ? GENERIC_SAMPLE_NOTES.mid : GENERIC_SAMPLE_NOTES.high;
}

// ───────────────────────────── negotiation & orders ─────────────────────────────

export function quantityOptions(supplierId: SupplierId): number[] {
  const moq = SUPPLIERS[supplierId].moq;
  return [...new Set([moq, 500, 1000, 3000, 10000].filter((q) => q >= moq))];
}

export function startNegotiation(s: GameState, pid: string, supplierId: SupplierId, qty: number): ActionResult {
  if (!s.products[pid]) return 'Add the product first.';
  const sup = SUPPLIERS[supplierId];
  if (sup.unlockStage > s.stage) return `${sup.company} only works with bigger businesses.`;
  if (qty < sup.moq) return 'Below minimum order quantity.';
  const list = listPrice(s, pid, supplierId, qty);
  s.negotiation = {
    productId: pid,
    supplierId,
    qty,
    round: 0,
    counter: null,
    agreedPrice: null,
    final: false,
    lastMessage: `Hi! ${qty.toLocaleString()} units is $${list.toFixed(2)} each. ${
      sup.style === 'folds' ? 'Very good price, my friend!' : sup.style === 'fair' ? 'Happy to discuss.' : 'Our prices reflect our quality.'
    }`,
  };
  return null;
}

export function supplierFloor(s: GameState, pid: string, supplierId: SupplierId, qty: number): number {
  const sup = SUPPLIERS[supplierId];
  const rel = s.relationship[supplierId];
  const buyer = s.team.buyer.count > 0 ? 0.03 : 0;
  return round2(listPrice(s, pid, supplierId, qty) * (1 - sup.room * (0.6 + rel / 250) - buyer));
}

export function proposePrice(s: GameState, price: number): ActionResult {
  const n = s.negotiation;
  if (!n || n.agreedPrice !== null) return 'No open negotiation.';
  const sup = SUPPLIERS[n.supplierId];
  const list = listPrice(s, n.productId, n.supplierId, n.qty);
  const floor = supplierFloor(s, n.productId, n.supplierId, n.qty);
  price = round2(price);
  if (price >= floor) {
    n.agreedPrice = Math.min(price, list);
    if (price >= list) s.relationship[n.supplierId] = Math.min(100, s.relationship[n.supplierId] + 3);
    n.lastMessage =
      sup.style === 'folds'
        ? `Deal! $${n.agreedPrice.toFixed(2)}, you drive hard bargain!`
        : sup.style === 'fair'
          ? `That works for us. $${n.agreedPrice.toFixed(2)} it is. Thank you!`
          : `Agreed at $${n.agreedPrice.toFixed(2)}.`;
    return null;
  }
  const gap = (floor - price) / list;
  s.relationship[n.supplierId] = Math.max(0, s.relationship[n.supplierId] - (Math.round(gap * 40) + 1));
  n.round++;
  n.final = n.round >= 3;
  const counter = n.final ? floor : round2(floor + (list - floor) * (0.5 / n.round));
  n.counter = counter;
  const msgs = {
    folds: [`Ahh, too low! I can do $${counter.toFixed(2)}.`, `Very sorry, my friend. $${counter.toFixed(2)}?`],
    fair: [`That’s below our cost. I could do $${counter.toFixed(2)}.`, `I want to help, but $${counter.toFixed(2)} is my best.`],
    firm: [`We can’t go that low. $${counter.toFixed(2)}.`, `Quality has a price. $${counter.toFixed(2)}.`],
  };
  n.lastMessage = n.final ? `Final offer: $${counter.toFixed(2)}.` : pick(s, msgs[sup.style]);
  return null;
}

export function acceptCounter(s: GameState): ActionResult {
  const n = s.negotiation;
  if (!n || n.counter === null) return 'No counter-offer to accept.';
  n.agreedPrice = n.counter;
  n.lastMessage = 'Great, I’ll prepare the order.';
  return null;
}

export function cancelNegotiation(s: GameState): void {
  s.negotiation = null;
}

export function hasPaymentTerms(s: GameState, supplierId: SupplierId): boolean {
  return s.relationship[supplierId] >= 75 || !!activeContract(s, supplierId);
}

/** The best terms: 30% up front, the rest 30 days after the goods arrive. */
export function hasNet30(s: GameState, supplierId: SupplierId): boolean {
  return !!activeContract(s, supplierId) || (s.stage >= 3 && s.relationship[supplierId] >= 90);
}

export function termsLabel(s: GameState, supplierId: SupplierId): string {
  return hasNet30(s, supplierId) ? '30% now, 70% net 30 after delivery' : hasPaymentTerms(s, supplierId) ? '30% now, 70% when it ships' : 'Pay in full up front';
}

export function orderCost(s: GameState, freight: Freight, inspection: boolean): number {
  const n = s.negotiation;
  if (!n || n.agreedPrice === null) return 0;
  return round2(n.qty * (n.agreedPrice + freightPerUnit(s, n.productId, freight)) + (inspection ? INSPECTION_COST : 0));
}

export function leadTime(supplierId: SupplierId, freight: Freight, s?: GameState): number {
  const contract = s ? activeContract(s, supplierId) : undefined;
  return SUPPLIERS[supplierId].productionDays - (contract ? 2 : 0) + (freight === 'air' ? AIR_DAYS : SEA_DAYS);
}

/** Create a purchase order and pay for it (in full, or 30% now with payment terms). */
export function createPO(
  s: GameState,
  pid: string,
  supplierId: SupplierId,
  qty: number,
  unitPrice: number,
  freight: Freight,
  inspection: boolean,
  auto = false,
): ActionResult {
  const sup = SUPPLIERS[supplierId];
  const goods = round2(qty * (unitPrice + freightPerUnit(s, pid, freight)));
  const terms = hasPaymentTerms(s, supplierId);
  const upfront = round2(terms ? goods * 0.3 : goods);
  const total = upfront + (inspection ? INSPECTION_COST : 0);
  if (s.cash < total) return `Not enough cash. You need $${Math.ceil(total).toLocaleString()}.`;
  spendCash(s, upfront);
  if (inspection) book(s, 'other', INSPECTION_COST, { sub: 'Quality inspections' });
  const id = nextId(s);
  const isReorder = s.pos.some((p) => p.productId === pid);
  const priorFromSupplier = s.pos.filter((p) => p.supplierId === supplierId && p.productId === pid).length;
  let quality = Math.min(1, Math.max(0.2, (sup.quality + (def(s, pid).qualityBonus ?? 0)) * mod(s, 'quality', supplierId) + normal(s, 0, 0.04)));
  if (sup.style === 'folds' && priorFromSupplier > 0 && chance(s, 0.5)) {
    quality -= 0.15;
    s.flags[`drift-${id}`] = true;
  }
  const contract = activeContract(s, supplierId);
  const productionDoneDay = s.day + sup.productionDays - (contract ? 2 : 0);
  s.pos.push({
    id,
    productId: pid,
    supplierId,
    qty,
    unitPrice,
    freight,
    freightPerUnit: freightPerUnit(s, pid, freight),
    inspection,
    placedDay: s.day,
    productionDoneDay,
    arrivesDay: productionDoneDay + (freight === 'air' ? AIR_DAYS : SEA_DAYS),
    status: 'production',
    quality,
    isReorder,
    delayDays: 0,
    totalCost: goods,
    balanceDue: round2(goods - upfront),
    net30: terms && hasNet30(s, supplierId),
    auto,
  });
  s.relationship[supplierId] = Math.min(100, s.relationship[supplierId] + (qty >= 1000 ? 5 : 3));
  s.supplierUnits[supplierId] += qty;
  if (contract) contract.orderedUnits += qty;
  notify(s, 'po', `${auto ? '🤖 Auto-reorder: ' : 'Order placed: '}${qty.toLocaleString()} × ${def(s, pid).name} from ${sup.company}. ETA ${productionDoneDay + (freight === 'air' ? AIR_DAYS : SEA_DAYS) - s.day} days.`);

  if (isReorder && !s.milestones.first_profitable_reorder && qty >= WIN_REORDER_QTY) {
    const accrued = Object.values(s.channelAccrued).reduce((a, v) => a + (v ?? 0), 0);
    if (s.cash + accrued >= STARTING_CASH) {
      s.won = true;
      milestone(s, 'first_profitable_reorder');
    }
  }
  return null;
}

export function placeOrder(s: GameState, freight: Freight, inspection: boolean): ActionResult {
  const n = s.negotiation;
  if (!n || n.agreedPrice === null) return 'Agree on a price first.';
  const err = createPO(s, n.productId, n.supplierId, n.qty, n.agreedPrice, freight, inspection);
  if (err) return err;
  const p = s.products[n.productId];
  if (!p.reorder.supplierId) p.reorder.supplierId = n.supplierId;
  s.negotiation = null;
  return null;
}

// ───────────────────────────── reorder rules ─────────────────────────────

export function setReorderRule(s: GameState, pid: string, patch: Partial<ReorderRule>): ActionResult {
  if (s.stage < 2) return 'Reorder rules unlock in the Growing Brand stage.';
  Object.assign(s.products[pid].reorder, patch);
  return null;
}

/** Days of stock (on hand + incoming) left for a product at the current sales pace. */
export function coverDays(s: GameState, pid: string): number | null {
  const daily = steadyDailyUnits(s, pid);
  if (daily <= 0) return null;
  return (s.products[pid].inventory.onHand + incomingUnits(s, pid)) / daily;
}

export function runReorders(s: GameState): void {
  for (const pid of liveProducts(s)) {
    const p = s.products[pid];
    const r = p.reorder;
    if (!r.enabled || !r.supplierId) continue;
    const cover = coverDays(s, pid);
    if (cover === null) continue;
    const need = leadTime(r.supplierId, r.freight, s) + r.coverDays * 0.5;
    if (cover > need) continue;
    if (s.team.buyer.count > 0) {
      const sup = SUPPLIERS[r.supplierId];
      const qty = Math.max(sup.moq, r.qty);
      const price = supplierFloor(s, pid, r.supplierId, qty);
      const inspection = qty >= 1000 && sup.quality < 0.9;
      const err = createPO(s, pid, r.supplierId, qty, price, r.freight, inspection, true);
      if (err && !s.flags[`reorderCash-${pid}-${Math.floor(s.day / 7)}`]) {
        s.flags[`reorderCash-${pid}-${Math.floor(s.day / 7)}`] = true;
        notify(s, 'cash', `🤖 ${s.people.find((x) => x.role === 'buyer')?.name ?? 'Your buyer'} couldn’t reorder ${def(s, pid).name}: not enough cash.`, true);
      }
    } else if (!s.flags[`reorderAlert-${pid}-${Math.floor(s.day / 7)}`]) {
      s.flags[`reorderAlert-${pid}-${Math.floor(s.day / 7)}`] = true;
      notify(s, 'po', `⏰ Reorder alert: ${def(s, pid).name} has ~${Math.floor(cover)} days of stock incl. incoming. Lead time is ${leadTime(r.supplierId, r.freight, s)} days.`, true);
    }
  }
}

// ───────────────────────────── contracts ─────────────────────────────

export function contractTerms(s: GameState, supplierId: SupplierId) {
  const units = Math.max(10000, Math.round(s.supplierUnits[supplierId] * 1.2 / 1000) * 1000);
  return { commitUnits: units, discount: supplierId === 'atelier' ? 0.08 : 0.12 };
}

export function canSignContract(s: GameState, supplierId: SupplierId): string | null {
  if (s.stage < 4) return 'Supplier contracts unlock at the Multichannel stage.';
  if (activeContract(s, supplierId)) return 'You already have a contract with them.';
  if (s.relationship[supplierId] < 70) return 'Build the relationship to 70+ first.';
  if (s.supplierUnits[supplierId] < 5000) return 'Order at least 5,000 units from them first.';
  return null;
}

export function signContract(s: GameState, supplierId: SupplierId): ActionResult {
  const err = canSignContract(s, supplierId);
  if (err) return err;
  const t = contractTerms(s, supplierId);
  s.contracts.push({ supplierId, startDay: s.day, endDay: s.day + 360, commitUnits: t.commitUnits, orderedUnits: 0, discount: t.discount });
  milestone(s, 'first_supplier_agreement');
  notify(s, 'po', `🤝 Signed a 12-month agreement with ${SUPPLIERS[supplierId].company}: ${Math.round(t.discount * 100)}% off, 30/70 payment terms, priority production. Commit: ${t.commitUnits.toLocaleString()} units.`);
  return null;
}

export function settleContracts(s: GameState): void {
  for (const c of s.contracts) {
    if (c.endDay !== s.day) continue;
    const short = Math.max(0, c.commitUnits - c.orderedUnits);
    if (short > 0) {
      const penalty = round2(short * 0.4);
      book(s, 'other', penalty, { sub: 'Contract penalties' });
      notify(s, 'cash', `${SUPPLIERS[c.supplierId].company} contract ended ${short.toLocaleString()} units short. Penalty: $${penalty.toLocaleString()}.`, true);
    } else notify(s, 'po', `${SUPPLIERS[c.supplierId].company} contract completed in full. They’d love to renew.`);
  }
}

