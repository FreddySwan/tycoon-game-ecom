import { DAMAGE_RATE, PACKAGING_COST, REVIEW_TEXT } from '../data';
import { brandOf, def, hoursLeft, landedUnitCost, returnRate, supportCapacity } from '../economics';
import { binomial, chance, normal, pick } from '../rng';
import type { CardKind, Delivery, GameState } from '../types';
import { book, milestone, nextId, notify, randomCustomer } from './core';

const AVATAR: Record<CardKind, string> = { damaged: '😕', defect: '🤨', late: '⏰' };
const MESSAGE: Record<CardKind, string> = {
  damaged: 'My order arrived damaged.',
  defect: 'This doesn’t look like the photos. The finish is rough.',
  late: 'This took forever to arrive. Is this normal?',
};

export function addReview(s: GameState, pid: string, stars: number, author: string, text?: string): void {
  stars = Math.max(1, Math.min(5, Math.round(stars)));
  const r = s.products[pid].reviews;
  r.count++;
  r.sum += stars;
  r.hist[stars - 1]++;
  s.reviewsRecent.push({ day: s.day, productId: pid, stars, author, text: text ?? pick(s, REVIEW_TEXT[stars]) });
  if (s.reviewsRecent.length > 40) s.reviewsRecent.shift();
  if (stars === 5) milestone(s, 'first_five_star');
}

/** Add many reviews at once around a mean star rating; a few get written out for the feed. */
export function addReviews(s: GameState, pid: string, n: number, mean: number): void {
  if (n <= 0) return;
  const r = s.products[pid].reviews;
  const weights = [1, 2, 3, 4, 5].map((k) => Math.exp(-((k - mean) ** 2) / 1.1));
  const total = weights.reduce((a, w) => a + w, 0);
  let left = n;
  for (let k = 5; k >= 1; k--) {
    const c = k === 1 ? left : Math.min(left, Math.round((n * weights[k - 1]) / total));
    r.hist[k - 1] += c;
    r.count += c;
    r.sum += c * k;
    left -= c;
  }
  const written = Math.min(3, n);
  for (let i = 0; i < written; i++) {
    const stars = Math.max(1, Math.min(5, Math.round(mean + normal(s, 0, 0.7))));
    s.reviewsRecent.push({ day: s.day, productId: pid, stars, author: randomCustomer(s).name, text: pick(s, REVIEW_TEXT[stars]) });
  }
  while (s.reviewsRecent.length > 40) s.reviewsRecent.shift();
  if (r.hist[4] > 0) milestone(s, 'first_five_star');
}

function queueTickets(s: GameState, kind: CardKind, count: number, revenueEach: number, pid: string, d: Delivery): void {
  if (count <= 0) return;
  // Hands-on era: no support team yet, so problems arrive as individual cards (unless a template answers them).
  if (!s.team.support.count) {
    for (let i = 0; i < count; i++) {
      if (autoReply(s, kind, pid, revenueEach, randomCustomer(s).name)) continue;
      if (s.cards.length >= 6) {
        // Overflow: nobody answers, the customer files a chargeback.
        book(s, 'refunds', revenueEach, { productId: pid, channel: d.channel });
        addReview(s, pid, 1, randomCustomer(s).name, 'Nobody answered my message. Had to file a chargeback.');
        continue;
      }
      const dale = kind === 'damaged' && !s.flags.dale;
      if (dale) s.flags.dale = true;
      const who = randomCustomer(s);
      s.cards.push({
        id: nextId(s),
        kind,
        day: s.day,
        expiresDay: s.day + 3,
        productId: pid,
        customer: dale ? 'Dale' : who.name,
        avatar: dale ? '😤' : AVATAR[kind],
        message: dale ? 'The thing arrived CRACKED. What are you going to do about it?' : kind === 'late' ? `Took ${d.delayDays + 4} days to arrive. Is this normal?` : MESSAGE[kind],
        revenue: revenueEach,
        choices: [],
      });
      notify(s, 'card', `${dale ? 'Dale' : who.name}: “${dale ? 'The thing arrived CRACKED.' : MESSAGE[kind]}”`, s.cards.length === 1);
    }
    return;
  }
  s.tickets.queue.push({ day: s.day, count, kind, revenue: revenueEach * count, productId: pid });
}

export function processDeliveries(s: GameState): void {
  const due = s.deliveries.filter((d) => d.dueDay <= s.day);
  s.deliveries = s.deliveries.filter((d) => d.dueDay > s.day);
  for (const d of due) {
    const p = s.products[d.productId];
    if (!p) continue;
    const brand = brandOf(s, d.productId);
    const n = Math.round(d.orders);
    if (n <= 0) continue;
    const each = d.revenue / Math.max(1, d.orders);

    if (!s.flags.firstReview) {
      s.flags.firstReview = true;
      const crushed = brand.packaging === 'basic';
      addReview(s, d.productId, crushed ? 4 : 5, 'Priya S.', crushed ? 'Love it! Box was a bit crushed though.' : 'Love it! Beautifully packed too.');
      notify(s, 'info', crushed ? 'Priya’s review mentions a crushed box. Sturdier boxes are in the Offer app.' : 'Your first review is in!', true);
      if (n === 1) continue;
    }

    const program = d.channel !== 'store' && d.channel !== 'loopshop' && p.listings[d.channel]?.program;
    const damageP = program ? 0.008 : DAMAGE_RATE[brand.packaging] + d.damageRate;
    const damaged = binomial(s, n, damageP);
    const defect = binomial(s, n - damaged, (1 - d.quality) * 0.12);
    const late = d.delayDays > 2 ? binomial(s, n - damaged - defect, 0.3) : 0;
    const ok = n - damaged - defect - late;
    const returned = binomial(s, ok, returnRate(s, d.productId));
    p.returns += returned;
    if (returned) book(s, 'refunds', returned * each * 0.85, { productId: d.productId, channel: d.channel });
    queueTickets(s, 'damaged', damaged, each, d.productId, d);
    queueTickets(s, 'defect', defect, each, d.productId, d);
    queueTickets(s, 'late', late, each, d.productId, d);

    const reviewRate = 0.22 + (brand.thankYouCard ? 0.08 : 0) + (brand.packaging === 'branded' ? 0.04 : 0);
    const reviewers = binomial(s, ok - returned, reviewRate);
    let mean = 1.6 + 3.6 * d.quality + (brand.thankYouCard ? 0.25 : 0) + (brand.packaging === 'branded' ? 0.15 : 0) + 0.25 * (brand.packScore ?? 0);
    if (d.delayDays > 3) mean -= 0.8;
    else if (d.delayDays > 1) mean -= 0.4;
    if (reviewers === 1 && chance(s, 0.5)) addReview(s, d.productId, mean + normal(s, 0, 0.6), randomCustomer(s).name);
    else addReviews(s, d.productId, reviewers, Math.min(4.95, mean));
  }
}

/** Support team works the ticket queue oldest-first, following the refund policy. */
export function processTickets(s: GameState): void {
  if (!s.team.support.count) return;
  let capacity = supportCapacity(s);
  const personal = s.support.tone === 'personal';
  for (const t of s.tickets.queue) {
    if (capacity <= 0) break;
    const n = Math.min(t.count, capacity);
    capacity -= n;
    const each = t.revenue / t.count;
    const refund = t.kind !== 'late' && each <= s.support.autoRefundUnder;
    const cost = t.kind === 'late' ? each * 0.15 * n : refund ? each * n : each * 0.45 * n;
    book(s, 'refunds', cost, { productId: t.productId });
    t.count -= n;
    t.revenue -= each * n;
    s.tickets.handled += n;
  }
  // Tickets older than 3 days go unanswered: refunds forced, angry reviews.
  for (const t of s.tickets.queue) {
    if (t.count > 0 && s.day - t.day >= 3) {
      s.tickets.dropped += t.count;
      const dropped = t.count;
      book(s, 'refunds', t.revenue, { productId: t.productId });
      const pid = t.productId;
      const angry = Math.ceil(t.count * 0.5);
      for (let i = 0; i < Math.min(angry, 3); i++) addReview(s, pid, 1, randomCustomer(s).name, 'Nobody ever answered my email.');
      if (angry > 3) {
        const r = s.products[pid].reviews;
        r.count += angry - 3;
        r.sum += angry - 3;
        r.hist[0] += angry - 3;
      }
      t.count = 0;
      notify(s, 'card', `⚠️ ${dropped} support tickets went unanswered. Hire more support or loosen the refund policy.`, true);
    }
  }
  s.tickets.queue = s.tickets.queue.filter((t) => t.count > 0);
  if (personal) {
    // Personal replies make happy customers more likely to leave a good word.
    for (const pid of Object.keys(s.products)) {
      const r = s.products[pid].reviews;
      if (r.count > 20 && chance(s, 0.3)) addReview(s, pid, 5, randomCustomer(s).name, 'Customer service actually cared. Rare these days!');
    }
  }
}

export function expireCards(s: GameState): void {
  for (const card of [...s.cards]) {
    if (s.day <= card.expiresDay) continue;
    s.cards = s.cards.filter((c) => c.id !== card.id);
    if (card.kind === 'late') addReview(s, card.productId, 2, card.customer, 'Slow shipping and no reply to my message.');
    else {
      book(s, 'refunds', card.revenue, { productId: card.productId });
      addReview(s, card.productId, 1, card.customer, 'Arrived broken and nobody answered me. Had to file a chargeback.');
    }
    notify(s, 'card', `${card.customer} gave up waiting for a reply.`);
  }
}

const OUTSOURCE_PER_TICKET = 2.5;

/** What happens when a customer problem gets a given reply. Shared by hand replies, templates and outsourcing. */
export function applyCardChoice(s: GameState, card: { productId: string; customer: string; revenue: number }, choiceId: string): void {
  const pid = card.productId;
  const brandId = s.products[pid]?.brandId;
  const unit = landedUnitCost(s, pid) + def(s, pid).shipToCustomer + PACKAGING_COST[brandOf(s, pid).packaging];
  const refund = (amount: number) => book(s, 'refunds', amount, { brandId, productId: pid });
  switch (choiceId) {
    case 'refund':
      refund(card.revenue);
      if (chance(s, 0.3)) addReview(s, pid, 4, card.customer, 'Product had an issue but they refunded me right away.');
      break;
    case 'replace': {
      book(s, 'fulfillment', unit, { brandId, productId: pid, sub: 'Replacements' });
      const inv = s.products[pid].inventory;
      if (inv.onHand > 0) {
        const avg = inv.costTotal / inv.onHand;
        const q = inv.qualityTotal / inv.onHand;
        inv.onHand -= 1;
        inv.costTotal = Math.max(0, Math.round((inv.costTotal - avg) * 100) / 100);
        inv.qualityTotal -= q;
      }
      if (chance(s, 0.6)) addReview(s, pid, 5, card.customer, 'Had a problem, they sent a new one immediately. Great service!');
      break;
    }
    case 'photo':
      if (chance(s, 0.25)) addReview(s, pid, 1, card.customer, 'They wanted PROOF before helping. Unbelievable.');
      else refund(card.revenue * 0.5);
      break;
    case 'partial':
      refund(card.revenue * 0.5);
      if (chance(s, 0.25)) addReview(s, pid, 3, card.customer);
      break;
    case 'code':
      refund(card.revenue * 0.15);
      if (chance(s, 0.3)) addReview(s, pid, 4, card.customer, 'Slow shipping but the owner was lovely about it.');
      break;
    case 'template':
      if (chance(s, 0.4)) addReview(s, pid, 2, card.customer, 'Slow, and the reply felt like a robot wrote it.');
      break;
  }
}

/** Templates (and an outsourced inbox) answer standard problems before they ever reach you. */
function autoReply(s: GameState, kind: CardKind, pid: string, revenue: number, customer: string): boolean {
  const choice = s.support.templates?.[kind];
  if (!choice || !(s.stage >= 2 || s.milestones.first_profitable_reorder)) return false;
  if (s.support.outsource) {
    book(s, 'payroll', OUTSOURCE_PER_TICKET, { sub: 'Outsourced support' });
  } else {
    if (hoursLeft(s) < 0.1) return false;
    s.hoursUsed += 0.1;
  }
  applyCardChoice(s, { productId: pid, customer, revenue }, choice);
  s.tickets.handled++;
  return true;
}
