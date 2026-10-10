import {
  BATCH_UNLOCK_AFTER,
  CITIES,
  FIRST_NAMES,
  FRIEND_HELP,
  HOURS,
  INSPECTION_COST,
  LAST_INITIALS,
  LOAN,
  MODULES,
  PACKAGING_COST,
  PAYMENT_FEE_FLAT,
  PAYMENT_FEE_PCT,
  PAYOUT_EVERY,
  PRODUCTS,
  RENT,
  REVIEW_TEXT,
  SAMPLE_COST,
  SAMPLE_DAYS,
  STARTING_CASH,
  STORE_SUBSCRIPTION,
  SUPPLIERS,
  SUPPLIER_ORDER,
  THANK_YOU_COST,
  WIN_REORDER_QTY,
  AIR_DAYS,
  SEA_DAYS,
} from './data';
import {
  breakEvenCPA,
  bundlePrice,
  bundleShare,
  cellForecast,
  creativeUnlocked,
  effectivePrice,
  freightPerUnit,
  hoursLeft,
  landedUnitCost,
  listPrice,
  averageRating,
  product,
  recentCPA,
  returnRate,
  round2,
  siteCVR,
  stockQuality,
  trendMult,
} from './economics';
import { chance, normal, pick, poisson, rand, randInt } from './rng';
import type {
  CustomerCard,
  DailyRecord,
  Freight,
  GameEvent,
  GameState,
  MilestoneId,
  ModuleId,
  NoticeKind,
  Offer,
  PhotoChoice,
  ProductId,
  QueuedOrder,
  SupplierId,
} from './types';

export type ActionResult = string | null;

export const MILESTONE_LABELS: Record<MilestoneId, string> = {
  first_sample: 'First samples unboxed',
  store_launched: 'Store is live',
  first_sale: 'First sale!',
  first_profitable_campaign: 'First profitable campaign',
  first_five_star: 'First 5★ review',
  first_repeat: 'First repeat customer',
  batch_packing: 'Batch packing unlocked',
  first_profitable_reorder: 'First profitable reorder',
};

export function createGame(seed = Date.now()): GameState {
  return {
    version: 1,
    rng: seed | 0,
    day: 1,
    cash: STARTING_CASH,
    status: 'playing',
    won: false,
    productId: null,
    samples: [],
    relationship: { quickmake: 50, brightway: 50, atelier: 50 },
    negotiation: null,
    pos: [],
    inventory: { onHand: 0, costTotal: 0, qualityTotal: 0 },
    store: {
      launched: false,
      launchedDay: null,
      brandName: '',
      modules: {
        header: 0,
        hero: 0,
        gallery: 0,
        description: 0,
        reviews: 0,
        badges: 0,
        faq: 0,
        shipping: 0,
        checkout: 0,
      },
      benefits: [],
      photoStars: 0,
      photo: null,
    },
    offer: {
      price: 29,
      bundle: false,
      freeShipping: true,
      discountPct: 0,
      packaging: 'basic',
      thankYouCard: false,
    },
    ads: {},
    backlog: [],
    handPacked: 0,
    batchPacking: false,
    shipped: 0,
    returns: 0,
    pendingReviews: [],
    reviews: [],
    cards: [],
    events: [],
    payoutAccrued: 0,
    bills: [{ id: 1, dueDay: 30, label: 'Rent', amount: RENT, everyDays: 30 }],
    history: [],
    milestones: {},
    notices: [],
    hoursUsed: 0,
    extraHours: 0,
    stockoutDays: 0,
    discountFatigue: 0,
    viralBoost: [],
    flags: {},
    loan: null,
    seq: 100,
    lastDayOrders: 0,
  };
}

// ───────────────────────────── helpers ─────────────────────────────

function nextId(s: GameState): number {
  return ++s.seq;
}

export function notify(s: GameState, kind: NoticeKind, text: string, pause = false): void {
  s.notices.push({ id: nextId(s), day: s.day, kind, text, pause });
  if (s.notices.length > 60) s.notices.splice(0, s.notices.length - 60);
}

function milestone(s: GameState, id: MilestoneId): void {
  if (s.milestones[id]) return;
  s.milestones[id] = s.day;
  notify(s, 'milestone', MILESTONE_LABELS[id], true);
}

function useHours(s: GameState, hours: number): ActionResult {
  if (hoursLeft(s) + 1e-9 < hours) return 'You’re out of founder hours today. Wait for tomorrow (or call a friend).';
  s.hoursUsed += hours;
  return null;
}

function spend(s: GameState, amount: number): ActionResult {
  if (s.cash < amount) return `Not enough cash. You need $${amount.toFixed(0)}.`;
  s.cash = round2(s.cash - amount);
  return null;
}

function randomCustomer(s: GameState): { name: string; city: string } {
  return { name: `${pick(s, FIRST_NAMES)} ${pick(s, LAST_INITIALS.split(''))}.`, city: pick(s, CITIES) };
}

// ───────────────────────────── product & sourcing ─────────────────────────────

export function chooseProduct(s: GameState, id: ProductId): ActionResult {
  if (s.productId) return 'You’ve already picked a product.';
  const p = PRODUCTS[id];
  s.productId = id;
  s.offer.price = p.refPrice;
  s.ads = {};
  for (const a of p.audiences) {
    for (const c of p.creatives) {
      const key = `${a.id}:${c.id}`;
      s.ads[key] = {
        key,
        audienceId: a.id,
        creativeId: c.id,
        active: false,
        budget: 10,
        daysActive: 0,
        totals: { spend: 0, impressions: 0, clicks: 0, orders: 0 },
        history: [],
      };
    }
  }
  notify(s, 'info', `You picked ${p.name}. Next: find a supplier on SourceMart.`);
  return null;
}

export function orderSample(s: GameState, supplierId: SupplierId): ActionResult {
  if (!s.productId) return 'Pick a product first.';
  if (s.samples.some((x) => x.supplierId === supplierId)) return 'Sample already ordered.';
  const err = spend(s, SAMPLE_COST);
  if (err) return err;
  s.samples.push({
    supplierId,
    orderedDay: s.day,
    arrivesDay: s.day + SAMPLE_DAYS,
    arrived: false,
    inspected: false,
  });
  return null;
}

export function inspectSample(s: GameState, supplierId: SupplierId): ActionResult {
  const sample = s.samples.find((x) => x.supplierId === supplierId);
  if (!sample?.arrived) return 'That sample hasn’t arrived yet.';
  if (sample.inspected) return null;
  const err = useHours(s, HOURS.inspectSample);
  if (err) return err;
  sample.inspected = true;
  milestone(s, 'first_sample');
  return null;
}

export function quantityOptions(supplierId: SupplierId): number[] {
  const moq = SUPPLIERS[supplierId].moq;
  return [...new Set([moq, 500, 1000, 2000].filter((q) => q >= moq))];
}

export function startNegotiation(s: GameState, supplierId: SupplierId, qty: number): ActionResult {
  if (!s.productId) return 'Pick a product first.';
  if (qty < SUPPLIERS[supplierId].moq) return 'Below minimum order quantity.';
  const sup = SUPPLIERS[supplierId];
  s.negotiation = {
    supplierId,
    qty,
    round: 0,
    counter: null,
    agreedPrice: null,
    final: false,
    lastMessage: `Hi! ${qty} units is $${listPrice(s, supplierId, qty).toFixed(2)} each. ${
      sup.style === 'folds' ? 'Very good price, my friend!' : sup.style === 'fair' ? 'Happy to discuss.' : 'Our prices reflect our quality.'
    }`,
  };
  return null;
}

/** Lowest price the supplier will accept right now. */
export function supplierFloor(s: GameState, supplierId: SupplierId, qty: number): number {
  const sup = SUPPLIERS[supplierId];
  const rel = s.relationship[supplierId];
  return round2(listPrice(s, supplierId, qty) * (1 - sup.room * (0.6 + rel / 250)));
}

export function proposePrice(s: GameState, price: number): ActionResult {
  const n = s.negotiation;
  if (!n || n.agreedPrice !== null) return 'No open negotiation.';
  const sup = SUPPLIERS[n.supplierId];
  const list = listPrice(s, n.supplierId, n.qty);
  const floor = supplierFloor(s, n.supplierId, n.qty);
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

export function orderCost(s: GameState, freight: Freight, inspection: boolean): number {
  const n = s.negotiation;
  if (!n || n.agreedPrice === null) return 0;
  return round2(n.qty * (n.agreedPrice + freightPerUnit(s, freight)) + (inspection ? INSPECTION_COST : 0));
}

export function placeOrder(s: GameState, freight: Freight, inspection: boolean): ActionResult {
  const n = s.negotiation;
  if (!n || n.agreedPrice === null) return 'Agree on a price first.';
  const sup = SUPPLIERS[n.supplierId];
  const cost = orderCost(s, freight, inspection);
  const err = spend(s, cost);
  if (err) return err;
  const isReorder = s.pos.length > 0;
  const priorFromSupplier = s.pos.filter((p) => p.supplierId === n.supplierId).length;
  const id = nextId(s);
  let quality = Math.min(1, Math.max(0.2, sup.quality + normal(s, 0, 0.04)));
  if (sup.style === 'folds' && priorFromSupplier > 0 && chance(s, 0.5)) {
    quality -= 0.15;
    s.flags[`drift-${id}`] = true;
  }
  const productionDoneDay = s.day + sup.productionDays;
  const po = {
    id,
    supplierId: n.supplierId,
    qty: n.qty,
    unitPrice: n.agreedPrice,
    freight,
    freightPerUnit: freightPerUnit(s, freight),
    inspection,
    placedDay: s.day,
    productionDoneDay,
    arrivesDay: productionDoneDay + (freight === 'air' ? AIR_DAYS : SEA_DAYS),
    status: 'production' as const,
    quality,
    isReorder,
    delayDays: 0,
    totalCost: cost - (inspection ? INSPECTION_COST : 0),
  };
  s.pos.push(po);
  s.relationship[n.supplierId] = Math.min(100, s.relationship[n.supplierId] + 4);
  s.negotiation = null;
  notify(s, 'po', `Order placed: ${po.qty} units from ${sup.company}. ETA day ${po.arrivesDay}.`);

  if (isReorder && !s.won && po.qty >= WIN_REORDER_QTY && s.cash + s.payoutAccrued >= STARTING_CASH) {
    s.won = true;
    milestone(s, 'first_profitable_reorder');
  }
  return null;
}

// ───────────────────────────── storefront ─────────────────────────────

export function setModule(s: GameState, id: ModuleId, tier: number): ActionResult {
  const def = MODULES.find((m) => m.id === id)!;
  if (tier < 0 || tier > def.tiers.length) return 'Invalid tier.';
  const current = s.store.modules[id];
  if (tier > current) {
    // Pay for every paid tier crossed that hasn't been bought before.
    let cost = 0;
    for (let t = current + 1; t <= tier; t++) {
      if (!s.flags[`bought-${id}-${t}`]) cost += def.tiers[t - 1].cost;
    }
    const err = spend(s, cost);
    if (err) return err;
    for (let t = current + 1; t <= tier; t++) s.flags[`bought-${id}-${t}`] = true;
  }
  if (tier === 0 && def.required && s.store.launched) return `Your live store needs a ${def.name}.`;
  s.store.modules[id] = tier;
  return null;
}

export function toggleBenefit(s: GameState, id: string): ActionResult {
  const b = s.store.benefits;
  if (b.includes(id)) {
    s.store.benefits = b.filter((x) => x !== id);
    return null;
  }
  if (b.length >= 3) return 'Pick at most 3 benefits. Focus sells.';
  b.push(id);
  return null;
}

export function setBrandName(s: GameState, name: string): void {
  s.store.brandName = name.slice(0, 28);
}

export function scorePhoto(s: GameState, choice: PhotoChoice): number {
  const best = product(s).bestPhoto;
  let score = 1;
  if (choice.backdrop === best.backdrop) score += 1;
  if (choice.light === best.light) score += 1;
  else if (choice.light !== 'overhead') score += 0.5;
  if (choice.prop === best.prop) score += 1;
  if (choice.angle === best.angle) score += 1;
  else if (choice.angle !== 'top') score += 0.25;
  return Math.max(1, Math.min(5, Math.round(score)));
}

export function takePhoto(s: GameState, choice: PhotoChoice): ActionResult {
  if (!s.samples.some((x) => x.arrived)) return 'You need a sample to photograph.';
  const err = useHours(s, HOURS.photoShoot);
  if (err) return err;
  const stars = scorePhoto(s, choice);
  if (stars >= s.store.photoStars) {
    s.store.photoStars = stars;
    s.store.photo = choice;
  }
  return null;
}

export function launchProblems(s: GameState): string[] {
  const out: string[] = [];
  if (!s.productId) out.push('Pick a product');
  if (!s.store.photo) out.push('Take a product photo');
  for (const m of MODULES) if (m.required && !s.store.modules[m.id]) out.push(`Add ${m.name}`);
  if (!s.store.benefits.length) out.push('Choose at least one benefit for the description');
  if (!s.store.brandName.trim()) out.push('Name your brand');
  return out;
}

export function launchStore(s: GameState): ActionResult {
  if (s.store.launched) return null;
  const problems = launchProblems(s);
  if (problems.length) return problems[0];
  const err = spend(s, STORE_SUBSCRIPTION);
  if (err) return err;
  s.store.launched = true;
  s.store.launchedDay = s.day;
  s.bills.push({ id: nextId(s), dueDay: s.day + 30, label: 'ShopBloc plan', amount: STORE_SUBSCRIPTION, everyDays: 30 });
  milestone(s, 'store_launched');
  return null;
}

// ───────────────────────────── offer & ads ─────────────────────────────

export function setOffer(s: GameState, patch: Partial<Offer>): void {
  Object.assign(s.offer, patch);
  s.offer.price = Math.max(5, Math.min(199, round2(s.offer.price)));
}

export function setAdCell(s: GameState, key: string, patch: { active?: boolean; budget?: number }): ActionResult {
  const cell = s.ads[key];
  if (!cell) return 'Unknown ad.';
  if (patch.active && !creativeUnlocked(s, cell.creativeId)) return 'This creative needs more reviews first.';
  if (patch.active && !s.store.launched) return 'Launch your store before running ads.';
  if (patch.active && !s.inventory.onHand && !s.shipped) return 'Wait until your first stock arrives. Ads to an empty store waste money.';
  if (patch.budget !== undefined) cell.budget = Math.max(5, Math.min(500, Math.round(patch.budget)));
  if (patch.active !== undefined) cell.active = patch.active;
  return null;
}

// ───────────────────────────── fulfillment ─────────────────────────────

function shipOrder(s: GameState, order: QueuedOrder, rec?: DailyRecord): void {
  const p = product(s);
  const cost =
    p.shipToCustomer * (order.bundle ? 1.25 : 1) +
    PACKAGING_COST[s.offer.packaging] +
    (s.offer.thankYouCard ? THANK_YOU_COST : 0);
  s.cash = round2(s.cash - cost);
  if (rec) rec.fulfillmentCost += cost;
  s.shipped++;
  s.pendingReviews.push({
    dueDay: s.day + 4,
    orderId: order.id,
    customer: order.customer,
    quality: stockQuality(s),
    delayDays: s.day - order.day,
    revenue: order.revenue,
  });
}

export function handPack(s: GameState, orderId: number): ActionResult {
  const idx = s.backlog.findIndex((o) => o.id === orderId);
  if (idx < 0) return 'Order already packed.';
  const err = useHours(s, HOURS.handPack);
  if (err) return err;
  const [order] = s.backlog.splice(idx, 1);
  shipOrder(s, order);
  s.handPacked++;
  if (!s.batchPacking && s.handPacked >= BATCH_UNLOCK_AFTER) {
    s.batchPacking = true;
    milestone(s, 'batch_packing');
  }
  return null;
}

export function callFriend(s: GameState): ActionResult {
  if (s.extraHours > 0) return 'Your friend is already helping today.';
  const err = spend(s, FRIEND_HELP.cost);
  if (err) return err;
  s.extraHours = FRIEND_HELP.hours;
  return null;
}

// ───────────────────────────── customers & events ─────────────────────────────

function addReview(s: GameState, stars: number, author: string, text?: string): void {
  stars = Math.max(1, Math.min(5, Math.round(stars)));
  s.reviews.push({ day: s.day, stars, author, text: text ?? pick(s, REVIEW_TEXT[stars]) });
  if (stars === 5) milestone(s, 'first_five_star');
}

function pushCard(s: GameState, card: Omit<CustomerCard, 'id' | 'day' | 'expiresDay'>): boolean {
  if (s.cards.length >= 6) return false;
  s.cards.push({ ...card, id: nextId(s), day: s.day, expiresDay: s.day + 3 });
  notify(s, 'card', `${card.customer}: “${card.message}”`, s.cards.length === 1);
  return true;
}

const REFUND = { id: 'refund', label: 'Full refund', hint: 'Costs the sale, keeps them happy' };
const REPLACE = { id: 'replace', label: 'Send a replacement', hint: 'Costs a unit + shipping, wins loyalty' };

function deliver(s: GameState, pr: (typeof s.pendingReviews)[number]): void {
  const damageP = s.offer.packaging === 'sturdy' ? 0.015 : 0.06;
  if (!s.flags.firstReview) {
    s.flags.firstReview = true;
    const crushed = s.offer.packaging === 'basic';
    addReview(
      s,
      crushed ? 4 : 5,
      'Priya S.',
      crushed ? 'My pup loves it! Box was a bit crushed though.' : 'Love it! Beautifully packed too.',
    );
    notify(s, 'info', crushed ? 'Priya’s review mentions a crushed box. Sturdier mailers are in the Offer tab.' : 'Your first review is in!', true);
    return;
  }
  if (chance(s, damageP)) {
    const dale = !s.flags.dale;
    s.flags.dale = true;
    const made = pushCard(s, {
      kind: 'damaged',
      customer: dale ? 'Dale' : pr.customer,
      avatar: dale ? '😤' : '😕',
      message: dale ? 'The thing arrived CRACKED. What are you going to do about it?' : 'My order arrived damaged.',
      revenue: pr.revenue,
      choices: [REFUND, REPLACE, { id: 'photo', label: 'Ask for a photo first', hint: 'Free, but they may get annoyed' }],
    });
    if (!made) refund(s, pr.revenue);
    return;
  }
  if (chance(s, (1 - pr.quality) * 0.12)) {
    const made = pushCard(s, {
      kind: 'defect',
      customer: pr.customer,
      avatar: '🤨',
      message: 'This doesn’t look like the photos. The finish is rough.',
      revenue: pr.revenue,
      choices: [REFUND, REPLACE, { id: 'partial', label: 'Offer 50% back', hint: 'Cheaper, they keep it' }],
    });
    if (!made) refund(s, pr.revenue);
    return;
  }
  if (pr.delayDays > 2 && chance(s, 0.35)) {
    pushCard(s, {
      kind: 'late',
      customer: pr.customer,
      avatar: '⏰',
      message: `Took ${pr.delayDays + 4} days to arrive. Is this normal?`,
      revenue: pr.revenue,
      choices: [
        { id: 'code', label: 'Apologize + 15% code', hint: 'Small cost, saves the review' },
        { id: 'template', label: 'Send a template reply', hint: 'Free, risky' },
      ],
    });
    return;
  }
  if (chance(s, returnRate(s))) {
    refund(s, pr.revenue);
    s.returns++;
    return;
  }
  if (chance(s, 0.3 + (s.offer.thankYouCard ? 0.1 : 0))) {
    let stars = 1.6 + 3.6 * pr.quality + (s.offer.thankYouCard ? 0.3 : 0);
    if (pr.delayDays > 3) stars -= 0.8;
    else if (pr.delayDays > 1) stars -= 0.4;
    addReview(s, stars + normal(s, 0, 0.6), pr.customer);
  }
}

function refund(s: GameState, amount: number): void {
  s.cash = round2(s.cash - amount);
}

export function resolveCard(s: GameState, cardId: number, choiceId: string): ActionResult {
  const card = s.cards.find((c) => c.id === cardId);
  if (!card) return 'Card already handled.';
  const err = useHours(s, HOURS.card);
  if (err) return err;
  s.cards = s.cards.filter((c) => c.id !== cardId);
  const unit = landedUnitCost(s) + product(s).shipToCustomer + PACKAGING_COST[s.offer.packaging];
  switch (choiceId) {
    case 'refund':
      refund(s, card.revenue);
      if (chance(s, 0.3)) addReview(s, 4, card.customer, 'Product had an issue but they refunded me right away.');
      break;
    case 'replace':
      s.cash = round2(s.cash - unit);
      if (s.inventory.onHand > 0) removeStock(s, 1);
      if (chance(s, 0.6)) addReview(s, 5, card.customer, 'Had a problem, they sent a new one immediately. Great service!');
      break;
    case 'photo':
      if (chance(s, 0.25)) addReview(s, 1, card.customer, 'They wanted PROOF before helping. Unbelievable.');
      else refund(s, card.revenue * 0.5);
      break;
    case 'partial':
      refund(s, card.revenue * 0.5);
      if (chance(s, 0.25)) addReview(s, 3, card.customer);
      break;
    case 'code':
      s.cash = round2(s.cash - card.revenue * 0.15);
      if (chance(s, 0.3)) addReview(s, 4, card.customer, 'Slow shipping but the owner was lovely about it.');
      break;
    case 'template':
      if (chance(s, 0.4)) addReview(s, 2, card.customer, 'Slow, and the reply felt like a robot wrote it.');
      break;
  }
  return null;
}

function expireCards(s: GameState): void {
  for (const card of [...s.cards]) {
    if (s.day <= card.expiresDay) continue;
    s.cards = s.cards.filter((c) => c.id !== card.id);
    if (card.kind === 'late') addReview(s, 2, card.customer, 'Slow shipping and no reply to my message.');
    else if (card.kind !== 'info') {
      refund(s, card.revenue);
      addReview(s, 1, card.customer, 'Arrived broken and nobody answered me. Had to file a chargeback.');
    }
    notify(s, 'card', `${card.customer} gave up waiting for a reply.`);
  }
}

export function resolveEvent(s: GameState, eventId: number, choiceId: string): ActionResult {
  const ev = s.events.find((e) => e.id === eventId);
  if (!ev) return 'Already handled.';
  if (ev.kind === 'cash-crisis') {
    if (choiceId === 'loan') {
      s.cash = round2(s.cash + LOAN.amount);
      s.loan = { amount: LOAN.repay, dueDay: s.day + LOAN.days };
      s.flags.loanUsed = true;
      notify(s, 'cash', `Family loan: +$${LOAN.amount}. Repay $${LOAN.repay} on day ${s.day + LOAN.days}. Awkward dinner pending.`);
    } else {
      s.status = 'lost';
    }
  } else if (ev.kind === 'reorder-delay' && choiceId === 'topup') {
    const qty = ev.data!.qty;
    const cost = ev.data!.cost;
    const err = spend(s, cost);
    if (err) return err;
    const po = s.pos.find((p) => p.id === ev.data!.poId)!;
    const goodsShare = round2((po.totalCost * qty) / po.qty);
    s.pos.push({
      ...po,
      id: nextId(s),
      qty,
      freight: 'air',
      freightPerUnit: freightPerUnit(s, 'air') * 2,
      placedDay: s.day,
      productionDoneDay: s.day,
      arrivesDay: s.day + 5,
      status: 'transit',
      isReorder: true,
      delayDays: 0,
      totalCost: goodsShare + cost,
    });
    po.qty -= qty;
    po.totalCost = round2(po.totalCost - goodsShare);
    notify(s, 'po', `Express top-up of ${qty} units arrives day ${s.day + 5}.`);
  }
  s.events = s.events.filter((e) => e.id !== eventId);
  return null;
}

function pushEvent(s: GameState, ev: Omit<GameEvent, 'id' | 'day'>): void {
  s.events.push({ ...ev, id: nextId(s), day: s.day });
  notify(s, 'event', ev.title, true);
}

// ───────────────────────────── stock ─────────────────────────────

function removeStock(s: GameState, units: number): number {
  const inv = s.inventory;
  const avgCost = inv.costTotal / inv.onHand;
  const avgQ = inv.qualityTotal / inv.onHand;
  inv.onHand -= units;
  inv.costTotal = inv.onHand ? round2(inv.costTotal - avgCost * units) : 0;
  inv.qualityTotal = inv.onHand ? inv.qualityTotal - avgQ * units : 0;
  return avgCost * units;
}

// ───────────────────────────── the daily tick ─────────────────────────────

export function isBlocked(s: GameState): boolean {
  return s.status !== 'playing' || s.events.some((e) => e.blocking);
}

export function advanceDay(s: GameState): void {
  if (isBlocked(s)) return;

  // End of today: batch-pack whatever founder hours remain.
  const rec: DailyRecord = {
    day: s.day + 1,
    cash: 0,
    revenue: 0,
    adSpend: 0,
    fulfillmentCost: 0,
    cogs: 0,
    orders: 0,
    visits: 0,
    profit: 0,
  };
  if (s.batchPacking) {
    while (s.backlog.length && hoursLeft(s) >= HOURS.batchPack) {
      s.hoursUsed += HOURS.batchPack;
      shipOrder(s, s.backlog.shift()!, rec);
    }
  }
  s.hoursUsed = 0;
  s.extraHours = 0;

  s.day++;
  const day = s.day;
  const p = product(s);

  // Samples
  for (const sample of s.samples) {
    if (!sample.arrived && day >= sample.arrivesDay) {
      sample.arrived = true;
      notify(s, 'sample', `Sample from ${SUPPLIERS[sample.supplierId].company} arrived! Unbox it on SourceMart.`, true);
    }
  }

  // Purchase orders
  for (const po of s.pos) {
    const sup = SUPPLIERS[po.supplierId];
    if (po.status === 'production' && day >= po.productionDoneDay) {
      po.status = 'transit';
      if (po.inspection && po.quality < sup.quality - 0.1) {
        po.quality = sup.quality;
        po.arrivesDay += 4;
        po.delayDays += 4;
        notify(s, 'po', `Inspection caught defects in ${sup.company}’s batch. They’re reworking it (+4 days).`, true);
      } else if (s.flags[`drift-${po.id}`]) {
        notify(s, 'po', `${sup.contact}: “Shipped early! Same as before, my friend!” (Hmm…)`);
      }
      if (po.isReorder && !s.flags.reorderDelay) {
        s.flags.reorderDelay = true;
        const delay = 5;
        const topQty = Math.min(100, Math.floor(po.qty / 3));
        const topCost = round2(topQty * freightPerUnit(s, 'air') * 2);
        po.arrivesDay += delay;
        po.delayDays += delay;
        pushEvent(s, {
          kind: 'reorder-delay',
          title: 'BlueLane: port congestion in Ningbo',
          body: `Your reorder of ${po.qty} units is delayed ${delay} days (now day ${po.arrivesDay}). You can split off ${topQty} units and fly them express for $${topCost}, arriving in 5 days.`,
          blocking: false,
          choices: [
            { id: 'topup', label: `Express top-up ($${topCost})`, hint: `${topQty} units arrive day ${day + 5}` },
            { id: 'accept', label: 'Accept the delay', hint: 'Free. Watch your stock.' },
          ],
          data: { poId: po.id, qty: topQty, cost: topCost },
        });
      } else if (chance(s, 1 - sup.reliability)) {
        const delay = randInt(s, 2, 5);
        po.arrivesDay += delay;
        po.delayDays += delay;
        notify(s, 'po', `BlueLane: shipment from ${sup.company} delayed ${delay} days (now day ${po.arrivesDay}).`, true);
      }
    }
    if (po.status === 'transit' && day >= po.arrivesDay) {
      po.status = 'arrived';
      s.inventory.onHand += po.qty;
      s.inventory.costTotal = round2(s.inventory.costTotal + po.totalCost);
      s.inventory.qualityTotal += po.quality * po.qty;
      notify(s, 'po', `📦 ${po.qty} units delivered! Boxes everywhere.`, true);
    }
  }

  // Bills, loan, payouts
  for (const bill of [...s.bills]) {
    if (bill.dueDay !== day) continue;
    s.cash = round2(s.cash - bill.amount);
    notify(s, 'cash', `Paid ${bill.label}: −$${bill.amount}.`);
    if (bill.everyDays) bill.dueDay += bill.everyDays;
    else s.bills = s.bills.filter((b) => b.id !== bill.id);
  }
  if (s.loan && s.loan.dueDay === day) {
    s.cash = round2(s.cash - s.loan.amount);
    notify(s, 'cash', `Repaid the family loan: −$${s.loan.amount}.`);
    s.loan = null;
  }
  if (day % PAYOUT_EVERY === 0 && s.payoutAccrued > 0) {
    notify(s, 'cash', `ShopBloc payout: +$${s.payoutAccrued.toFixed(0)}.`);
    s.cash = round2(s.cash + s.payoutAccrued);
    s.payoutAccrued = 0;
  }

  // Viral moment
  if (
    s.store.launched &&
    !s.flags.viral &&
    s.inventory.onHand > 0 &&
    day >= 16 &&
    s.shipped >= 10 &&
    (chance(s, 0.25) || day >= 24)
  ) {
    s.flags.viral = true;
    s.viralBoost = [400, 260, 120];
    notify(s, 'event', 'A LoopShop creator just posted about your product! Expect a wave of visitors for 3 days. Watch your stock.', true);
  }

  // Sales
  const newOrders: { source: string; customer?: string; city?: string }[] = [];
  if (s.store.launched) {
    if (!s.flags.mom && s.inventory.onHand > 0) {
      s.flags.mom = true;
      newOrders.push({ source: 'Mom', customer: 'Mom', city: 'Hometown' });
    }

    let adsPausedForCash = false;
    for (const cell of Object.values(s.ads)) {
      if (!cell.active) continue;
      if (s.cash < cell.budget) {
        cell.active = false;
        adsPausedForCash = true;
        continue;
      }
      const f = cellForecast(s, cell);
      const spent = round2(cell.budget * (0.9 + rand(s) * 0.1));
      const impressions = Math.round((spent / f.cpm) * 1000);
      const clicks = poisson(s, impressions * f.ctr);
      const orders = s.inventory.onHand > 0 ? poisson(s, clicks * f.cvr) : 0;
      s.cash = round2(s.cash - spent);
      rec.adSpend += spent;
      rec.visits += clicks;
      cell.daysActive++;
      cell.totals.spend += spent;
      cell.totals.impressions += impressions;
      cell.totals.clicks += clicks;
      cell.history.push({ day, spend: spent, impressions, clicks, orders: 0 });
      if (cell.history.length > 14) cell.history.shift();
      for (let i = 0; i < orders; i++) newOrders.push({ source: cell.key });
    }
    if (adsPausedForCash) notify(s, 'cash', 'Some ads paused: not enough cash to cover their daily budget.', true);

    const n = s.reviews.length;
    const visits =
      (p.organicBase + 2 * Math.min(n, 60) * (averageRating(s) >= 4 ? 1 : 0.6)) * trendMult(s) +
      (s.viralBoost.shift() ?? 0);
    rec.visits += Math.round(visits);
    const organic = poisson(s, visits * siteCVR(s, null) * 0.9);
    for (let i = 0; i < organic; i++) newOrders.push({ source: 'organic' });

    const repeat = poisson(s, s.shipped * 0.004 * (averageRating(s) >= 4 ? 1 : 0.4));
    for (let i = 0; i < repeat; i++) newOrders.push({ source: 'repeat' });
    if (!s.flags.priya && s.shipped >= 15 && (averageRating(s) >= 3.8 || n < 3)) {
      s.flags.priya = true;
      newOrders.push({ source: 'repeat', customer: 'Priya S.', city: 'Portland' });
      milestone(s, 'first_repeat');
    } else if (repeat > 0 && s.flags.priya) milestone(s, 'first_repeat');
  }

  let lostSales = 0;
  for (const o of newOrders) {
    const bundle = o.source !== 'Mom' && chance(s, bundleShare(s));
    const units = bundle ? 2 : 1;
    if (s.inventory.onHand < units) {
      lostSales++;
      continue;
    }
    rec.cogs += removeStock(s, units);
    const goods = bundle ? bundlePrice(s) : effectivePrice(s);
    const charged = round2(goods + (s.offer.freeShipping ? 0 : 4.99));
    const fees = charged * PAYMENT_FEE_PCT + PAYMENT_FEE_FLAT;
    s.payoutAccrued = round2(s.payoutAccrued + charged - fees);
    rec.revenue += charged;
    rec.profit -= fees;
    rec.orders++;
    const who = o.customer ? { name: o.customer, city: o.city! } : randomCustomer(s);
    s.backlog.push({ id: nextId(s), day, customer: who.name, city: who.city, units, revenue: charged, bundle, source: o.source });
    if (s.ads[o.source]) {
      s.ads[o.source].totals.orders++;
      s.ads[o.source].history[s.ads[o.source].history.length - 1].orders++;
    }
    if (!s.milestones.first_sale) milestone(s, 'first_sale');
  }
  s.lastDayOrders = rec.orders;
  const hadStock = s.pos.some((p) => p.status === 'arrived');
  if (s.store.launched && s.inventory.onHand <= 0 && hadStock) {
    s.stockoutDays++;
    if (s.stockoutDays % 3 === 1) {
      const lost = lostSales ? `${lostSales} sales lost today` : 'Shoppers are leaving empty-handed';
      notify(s, 'info', `Out of stock! ${lost}${rec.adSpend ? ', and your ads point at a sold-out page' : ''}.`, true);
    }
  }

  // Deliveries → reviews, returns, customer cards
  const due = s.pendingReviews.filter((r) => r.dueDay <= day);
  s.pendingReviews = s.pendingReviews.filter((r) => r.dueDay > day);
  for (const pr of due) deliver(s, pr);
  expireCards(s);

  // Discount fatigue
  s.discountFatigue = s.offer.discountPct > 0 ? Math.min(0.3, s.discountFatigue + 0.02) : Math.max(0, s.discountFatigue - 0.01);

  // Campaign milestone
  const be = breakEvenCPA(s);
  for (const cell of Object.values(s.ads)) {
    const r = recentCPA(cell, 3);
    if (r.orders >= 3 && r.cpa !== null && r.cpa < be) milestone(s, 'first_profitable_campaign');
  }

  rec.profit += rec.revenue - rec.cogs - rec.adSpend - rec.fulfillmentCost;
  rec.profit = round2(rec.profit);
  rec.cash = s.cash;
  s.history.push(rec);

  if (s.cash < 0) {
    if (!s.flags.loanUsed) {
      pushEvent(s, {
        kind: 'cash-crisis',
        title: 'You’re out of cash',
        body: 'Your bank balance went negative. Your family offers a $1,500 loan, to be repaid with $150 extra in 30 days. Or you can call it here and review what happened.',
        blocking: true,
        choices: [
          { id: 'loan', label: 'Take the family loan', hint: `+$${LOAN.amount}, repay $${LOAN.repay}` },
          { id: 'quit', label: 'Close the business', hint: 'See your recap' },
        ],
      });
    } else {
      s.status = 'lost';
      notify(s, 'cash', 'Out of cash, and the family loan is already used. The business closes.', true);
    }
  }
}

/** Run days until something worth the player's attention happens (or `max` days pass). */
export function skipToNextEvent(s: GameState, max = 30): number {
  const before = s.notices.length;
  let n = 0;
  while (n < max && !isBlocked(s)) {
    advanceDay(s);
    n++;
    if (s.notices.slice(before).some((x) => x.pause)) break;
    if (s.backlog.length && !s.batchPacking) break;
  }
  return n;
}

export { SUPPLIER_ORDER };

export function creativeUnlockedSafe(s: GameState, key: string): boolean {
  const cell = s.ads[key];
  return !!cell && creativeUnlocked(s, cell.creativeId);
}

export function setFlag(s: GameState, key: string): void {
  s.flags[key] = true;
}
