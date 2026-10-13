import { CATEGORIES, COPIER_NAMES, ENTRANT_NAMES, INCUMBENTS, RIVAL_FOUNDER, STYLE_INFO } from '../data';
import { activeRivals, avgDailyOrders, categoryShares, def, difficultyOf, liveProducts, productTrailing, round2, sliceProfit } from '../economics';
import { chance, pick, randInt } from '../rng';
import type { CardChoice, CategoryId, GameEvent, GameState, Rival, RivalStyle } from '../types';
import { type ActionResult, book, milestone, nextId, notify } from './core';
import { pushEvent } from './events';

// Rival brands: every category starts with two established sellers. Copycats appear when one of your products
// sells well, new brands enter categories where margins are fat, a VC-funded classmate starts an ad war, and
// everyone runs sales and runs out of stock now and then. Their moves change your demand and ad costs through
// economics (rivalDemandMult, rivalAdMult), so every reaction shows up in the numbers.

const c = (id: string, label: string, hint: string): CardChoice => ({ id, label, hint });
const CATS = Object.keys(CATEGORIES) as CategoryId[];

function log(s: GameState, r: Rival, text: string, pause = false, kind: 'info' | 'event' = 'info'): void {
  s.rivalLog.push({ day: s.day, rivalId: r.id, text });
  if (s.rivalLog.length > 50) s.rivalLog.splice(0, s.rivalLog.length - 50);
  notify(s, kind, `⚔️ ${text}`, pause);
}

function spawn(s: GameState, cat: CategoryId, style: RivalStyle, fields: Partial<Rival> & { name: string }): Rival {
  const r: Rival = { id: nextId(s), category: cat, style, price: 1, rating: 4.1, reviews: 300, ads: 1, strength: 1, enteredDay: s.day, ...fields };
  s.rivals.push(r);
  return r;
}

export function initRivals(s: GameState): void {
  s.rivals = [];
  s.rivalLog = [];
  for (const cat of CATS) for (const inc of INCUMBENTS[cat]) spawn(s, cat, 'incumbent', { ...inc, ads: 1, strength: 1 });
}

const usedNames = (s: GameState) => new Set(s.rivals.map((r) => r.name));
function freshName(s: GameState, pool: string[]): string {
  const used = usedNames(s);
  return pool.find((n) => !used.has(n)) ?? `${pick(s, pool)} ${randInt(s, 2, 9)}`;
}

function myCategories(s: GameState): CategoryId[] {
  return [...new Set(liveProducts(s).map((id) => def(s, id).category))];
}

/** Weekly rival moves. */
export function rivalWeek(s: GameState): void {
  if (s.day % 7 !== 0 || !s.rivals) return;
  const A = difficultyOf(s).rivalAggression;
  const mine = myCategories(s);
  const byProduct = productTrailing(s, 30);

  for (const r of s.rivals) {
    if (r.exitedDay !== undefined) continue;
    // Reviews pile up; copycats' cheap products slowly show in their ratings.
    r.reviews += Math.round(r.strength * 25);
    if (r.style === 'copier') r.rating = Math.max(3.2, r.rating - 0.015);
    // VC money runs out.
    if (r.runway !== undefined) {
      r.runway -= 7;
      if (r.runway <= 0) {
        r.ads = 0.6;
        r.strength *= 0.6;
        if (r.founder) {
          s.flags.brettBroke = true;
          log(s, r, `${r.name} ran out of money. The ads stopped overnight.`, true);
        } else log(s, r, `${r.name} burned through its funding and pulled its ads.`);
        delete r.runway;
      }
    }
  }

  for (const cat of mine) {
    const rivals = activeRivals(s, cat);
    // Sales: a rival discounts for a week. Your shoppers notice.
    for (const r of rivals) {
      if (r.style !== 'copier' && (r.saleUntil ?? -1) < s.day && chance(s, 0.05 * A)) {
        r.saleUntil = s.day + 7;
        const pid = liveProducts(s).find((id) => def(s, id).category === cat);
        if (pid && (s.counters.lastRivalSaleEvent ?? -99) < s.day - 21) {
          s.counters.lastRivalSaleEvent = s.day;
          pushEvent(s, {
            kind: 'rival-sale',
            title: `${r.name} is running 25% off on ${CATEGORIES[cat].name.toLowerCase()} this week`,
            body: `Shoppers comparing prices will see ${r.name} at a discount for 7 days. Your ${CATEGORIES[cat].name.toLowerCase()} sales will dip unless you answer.`,
            blocking: false,
            expiresDay: s.day + 2,
            choices: [c('match', 'Run a matching 15% promo for a week', 'Keep your share, give up some margin'), c('hold', 'Hold your price', 'Lose some sales for a week, keep margin')],
            data: { rival: r.id, cat },
          });
        }
        s.rivalLog.push({ day: s.day, rivalId: r.id, text: `${r.name} started a 25% sale.` });
      }
      // Stockouts: their shoppers come looking for you.
      if ((r.outUntil ?? -1) < s.day && chance(s, 0.025)) {
        r.outUntil = s.day + randInt(s, 5, 10);
        log(s, r, `${r.name} is out of stock for about a week. Their shoppers are looking elsewhere: a good moment to push ads.`);
      }
    }
    // New entrants: fat margins attract competition.
    const catRev = liveProducts(s)
      .filter((id) => def(s, id).category === cat)
      .reduce((a, id) => a + (byProduct[id]?.revenue ?? 0), 0);
    const catProfit = liveProducts(s)
      .filter((id) => def(s, id).category === cat)
      .reduce((a, id) => a + (byProduct[id] ? sliceProfit(byProduct[id]!) : 0), 0);
    const margin = catRev > 3000 ? catProfit / catRev : 0;
    if (rivals.length < 4 && margin > 0.35 && s.stage >= 2 && chance(s, 0.025 * A * (margin / 0.35))) {
      const premium = chance(s, 0.5);
      const r = spawn(s, cat, premium ? 'premium' : 'incumbent', {
        name: freshName(s, ENTRANT_NAMES),
        price: premium ? 1.25 : 0.95,
        rating: premium ? 4.6 : 4.1,
        reviews: 60,
        ads: 1.2,
        strength: 0.5,
      });
      log(s, r, `${r.name} launched in ${CATEGORIES[cat].name}: ${Math.round(margin * 100)}% margins attract competition.`);
    }
    // Newcomers grow into their strength.
    for (const r of rivals) if (r.style !== 'copier' && r.strength < 0.85 && s.day - r.enteredDay < 180) r.strength = Math.min(0.85, r.strength + 0.03);
    // Not every newcomer makes it: after six months, some fade away.
    for (const r of rivals) if (r.style !== 'incumbent' && !r.founder && s.day - r.enteredDay > 180 && chance(s, 0.01)) r.strength *= 0.8;
  }

  // Copycats: a product that sells well for a while gets copied.
  for (const pid of liveProducts(s)) {
    const d = def(s, pid);
    if (d.exclusive || s.day - s.products[pid].addedDay < 30 || avgDailyOrders(s, pid, 14) < 8) continue;
    if (s.rivals.some((r) => r.targets === pid && r.exitedDay === undefined)) continue;
    if (!chance(s, 0.04 * A)) continue;
    const yourRatio = s.products[pid].price / d.refPrice;
    const r = spawn(s, d.category, 'copier', {
      name: freshName(s, COPIER_NAMES),
      price: round2(yourRatio * 0.78),
      rating: 3.9,
      reviews: 40,
      ads: 0.8,
      strength: 0.75,
      targets: pid,
    });
    s.rivalLog.push({ day: s.day, rivalId: r.id, text: `${r.name} copied your ${d.name}.` });
    pushEvent(s, {
      kind: 'rival-copy',
      title: `${r.name} is selling a copy of your ${d.name} for $${Math.round(d.refPrice * r.price)}`,
      body: `Same photos, similar listing, ${Math.round((1 - r.price / yourRatio) * 100)}% cheaper. Shoppers comparing will drift to them unless you give them a reason not to.`,
      blocking: false,
      expiresDay: s.day + 5,
      choices: [
        c('match', 'Cut your price 10%', 'Narrow the gap, thinner margin'),
        c('brand', `Brand push: reviews & content ($${(1500 * s.stage).toLocaleString()})`, 'Weakens the copy for good'),
        c('ignore', 'Ignore them', 'Their cheap quality will show eventually'),
      ],
      data: { rival: r.id, pid },
    });
    break;
  }

  // Your old classmate's VC-funded competitor.
  const catRevenue = (cat: CategoryId) => liveProducts(s).filter((id) => def(s, id).category === cat).reduce((a, id) => a + (byProduct[id]?.revenue ?? 0), 0);
  const top = [...mine].sort((a, b) => catRevenue(b) - catRevenue(a))[0];
  if (s.stage >= 2 && top && !s.flags.brettLaunched && s.day > 140 && chance(s, 0.12)) {
    s.flags.brettLaunched = true;
    const r = spawn(s, top, 'blitzer', { name: RIVAL_FOUNDER.company, price: 0.9, rating: 4.2, reviews: 0, ads: 2.5, strength: 0.9, runway: 150 + randInt(s, 0, 60), founder: true });
    r.pushUntil = s.day + 45;
    log(s, r, `${RIVAL_FOUNDER.company} launched in ${CATEGORIES[top].name} with a $2M seed round and ads everywhere.`, true, 'event');
    pushEvent(s, {
      kind: 'rival-war',
      title: `${RIVAL_FOUNDER.company} is outbidding everyone in ${CATEGORIES[top].name}`,
      body: `${RIVAL_FOUNDER.name}, from your old econ class, raised $2M and is spending it on ads. Your ad costs in ${CATEGORIES[top].name} will jump for the next weeks.`,
      blocking: false,
      expiresDay: s.day + 4,
      choices: [
        c('outbid', 'Outbid them: +40% ad budgets in this category for 2 weeks', 'Hold your ground, pay more per order'),
        c('shift', 'Shift focus to email, repeat buyers and marketplaces', 'Spend less on ads until the storm passes'),
        c('wait', 'Wait them out', 'VC money runs out eventually'),
      ],
      data: { rival: r.id, cat: top },
    });
  }

  // Weak rivals leave; struggling ones can be bought (stage 4+).
  for (const cat of mine) {
    const sh = categoryShares(s, cat);
    if (sh.mine > 0.45) for (const { rival } of sh.rivals) if (rival.style !== 'incumbent') rival.strength *= 0.97;
    for (const { rival, share } of sh.rivals) {
      if (rival.strength < 0.35 || (rival.style === 'copier' && rival.rating < 3.4 && share < 0.05)) {
        rival.exitedDay = s.day;
        log(s, rival, `${rival.name} gave up on ${CATEGORIES[cat].name}.`);
      } else if (s.stage >= 4 && rival.style !== 'copier' && rival.strength < 0.8 && !s.events.some((e) => e.kind === 'rival-buyout') && chance(s, 0.02)) {
        const price = acquisitionPrice(s, rival);
        pushEvent(s, {
          kind: 'rival-buyout',
          title: `${rival.name} is open to being acquired`,
          body: `Their growth stalled and their investors want out. For $${price.toLocaleString()} you get their customers and they leave ${CATEGORIES[cat].name}.`,
          blocking: false,
          expiresDay: s.day + 14,
          choices: [c('buy', `Buy them ($${price.toLocaleString()})`, 'One fewer rival, their customers become yours'), c('pass', 'Pass', '')],
          data: { rival: rival.id },
        });
      }
    }
  }
}

export function acquisitionPrice(_s: GameState, r: Rival): number {
  return Math.round((CATEGORIES[r.category].marketSize * 18 * r.strength * Math.pow(r.rating / 4, 2)) / 1000) * 1000;
}

/** Buy a rival outright (Market app, stage 4+). */
export function acquireRival(s: GameState, rivalId: number): ActionResult {
  const r = s.rivals.find((x) => x.id === rivalId && x.exitedDay === undefined);
  if (!r) return 'They’re gone already.';
  if (s.stage < 4) return 'Acquisitions need a bigger company (stage 4).';
  if (r.style === 'copier') return 'There’s nothing worth buying in a knockoff seller.';
  const price = acquisitionPrice(s, r);
  if (s.cash < price) return `You need $${price.toLocaleString()} in cash.`;
  book(s, 'other', price, { sub: `Acquisitions (${r.name})` });
  r.exitedDay = s.day;
  const brand = s.brands[0];
  brand.customers += Math.round(r.reviews * 1.5);
  brand.awareness += r.reviews * 2;
  milestone(s, 'rival_acquired');
  log(s, r, `You acquired ${r.name}. Their customers are now yours.`, true, 'event');
  return null;
}

/** Answers to rival events (called from resolveEvent). */
export function resolveRivalEvent(s: GameState, ev: GameEvent, choiceId: string): ActionResult {
  const r = s.rivals.find((x) => x.id === Number(ev.data?.rival));
  const pid = ev.data?.pid as string | undefined;
  switch (ev.kind) {
    case 'rival-copy':
      if (!r || !pid || !s.products[pid]) return null;
      if (choiceId === 'match') {
        s.products[pid].price = round2(s.products[pid].price * 0.9);
      } else if (choiceId === 'brand') {
        const cost = 1500 * s.stage;
        if (s.cash < cost) return `Not enough cash. You need $${cost.toLocaleString()}.`;
        book(s, 'ads', cost, { brandId: s.products[pid].brandId, productId: pid, sub: 'Brand content' });
        r.strength *= 0.6;
        s.products[pid].reviews.count += 15;
        s.products[pid].reviews.sum += 15 * 4.8;
        s.products[pid].reviews.hist[4] += 15;
      }
      break;
    case 'rival-sale':
      if (choiceId === 'match') {
        const cat = ev.data?.cat as CategoryId;
        for (const id of liveProducts(s)) if (def(s, id).category === cat) s.products[id].discountPct = Math.max(s.products[id].discountPct, 15);
        s.counters.promoEndDay = s.day + 7;
        s.counters.promoCat = CATS.indexOf(cat);
      }
      break;
    case 'rival-war':
      if (choiceId === 'outbid') {
        const cat = ev.data?.cat as CategoryId;
        for (const id of liveProducts(s)) {
          if (def(s, id).category !== cat) continue;
          for (const cell of Object.values(s.products[id].ads)) if (cell.active) cell.budget = Math.round(cell.budget * 1.4);
          if (s.products[id].search.active) s.products[id].search.budget = Math.round(s.products[id].search.budget * 1.4);
        }
        if (r) r.pushUntil = Math.min(r.pushUntil ?? s.day, s.day + 14);
      } else if (choiceId === 'shift') {
        for (const b of s.brands) b.email.fatigue = Math.max(0, b.email.fatigue - 0.2);
      }
      break;
    case 'rival-buyout':
      if (choiceId === 'buy' && r) return acquireRival(s, r.id);
      break;
  }
  return null;
}

/** End a matched promo when its week is over. */
export function rivalPromoTick(s: GameState): void {
  if (s.counters.promoEndDay !== undefined && s.day >= s.counters.promoEndDay) {
    const cat = CATS[s.counters.promoCat ?? 0];
    for (const id of liveProducts(s)) if (def(s, id).category === cat && s.products[id].discountPct === 15) s.products[id].discountPct = 0;
    delete s.counters.promoEndDay;
    delete s.counters.promoCat;
  }
}

export { STYLE_INFO };
