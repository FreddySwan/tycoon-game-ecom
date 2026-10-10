import * as E from './engine';
import { breakEvenCPA, recentCPA, stockDays, listPrice, incomingUnits } from './economics';
import type { GameState, ModuleId } from './types';

/** Scripted players used for balance testing. */
export interface BotResult {
  winDay: number | null;
  lost: boolean;
  finalCash: number;
  stockoutDays: number;
  shipped: number;
  rating: number;
}

function packAll(s: GameState) {
  while (s.backlog.length && !s.batchPacking) {
    if (E.handPack(s, s.backlog[0].id)) break;
  }
}

function resolveAll(s: GameState) {
  for (const c of [...s.cards]) E.resolveCard(s, c.id, c.kind === 'late' ? 'code' : 'replace');
  for (const ev of [...s.events]) E.resolveEvent(s, ev.id, ev.kind === 'cash-crisis' ? 'loan' : 'accept');
}

function setupSourcing(s: GameState) {
  E.chooseProduct(s, 'dogbowl');
  E.orderSample(s, 'brightway');
  for (let i = 0; i < 4; i++) E.advanceDay(s);
  E.inspectSample(s, 'brightway');
  E.startNegotiation(s, 'brightway', 300);
  E.proposePrice(s, listPrice(s, 'brightway', 300) * 0.95);
  if (s.negotiation?.agreedPrice === null) E.acceptCounter(s);
  E.placeOrder(s, 'air', false);
}

export function goodBot(seed: number, days = 70): BotResult {
  const s = E.createGame(seed);
  setupSourcing(s);
  E.advanceDay(s);
  E.takePhoto(s, { backdrop: 'floor', light: 'window', prop: 'cat', angle: 'angled' });
  const mods: ModuleId[] = ['header', 'hero', 'gallery', 'description', 'reviews', 'shipping', 'checkout'];
  for (const m of mods) E.setModule(s, m, 1);
  for (const b of ['slows', 'bloat', 'bpa']) E.toggleBenefit(s, b);
  E.setBrandName(s, 'Pawsitive Pace');
  E.setOffer(s, { bundle: true });
  let winDay: number | null = null;
  let tested = false;
  while (s.day < days && s.status === 'playing') {
    if (!s.store.launched && s.inventory.onHand > 0) {
      E.launchStore(s);
      for (const k of Object.keys(s.ads)) if (!k.endsWith('review')) E.setAdCell(s, k, { active: true, budget: 10 });
    }
    if (s.reviews.length && s.offer.packaging === 'basic') E.setOffer(s, { packaging: 'sturdy' });
    if (s.store.launched && !tested && s.store.launchedDay! + 4 <= s.day) {
      tested = true;
      const be = breakEvenCPA(s);
      for (const c of Object.values(s.ads)) {
        const r = recentCPA(c, 4);
        E.setAdCell(s, c.key, { active: r.cpa !== null && r.cpa < be, budget: 30 });
      }
      if (!Object.values(s.ads).some((c) => c.active)) E.setAdCell(s, 'puppy:video', { active: true, budget: 30 });
    }
    if (tested && E.creativeUnlockedSafe(s, 'owners:review') && !s.flags.botReview) {
      s.flags.botReview = true;
      E.setAdCell(s, 'owners:review', { active: true, budget: 20 });
    }
    if (tested && s.day % 3 === 0) {
      const be = breakEvenCPA(s);
      for (const c of Object.values(s.ads)) {
        if (!c.active) continue;
        const r = recentCPA(c, 4);
        if (r.cpa !== null && r.cpa < be * 0.65) E.setAdCell(s, c.key, { budget: Math.min(150, c.budget * 1.3) });
        else if (r.cpa === null || r.cpa > be) E.setAdCell(s, c.key, { budget: Math.max(10, c.budget * 0.7) });
      }
    }
    if (tested && s.cash > 400 && !Object.values(s.ads).some((c) => c.active)) E.setAdCell(s, 'puppy:video', { active: true });
    const sd = stockDays(s);
    const cost300 = 300 * (listPrice(s, 'brightway', 300) * 0.95 + 1.2);
    const canWin = s.cash + s.payoutAccrued - cost300 >= 4000;
    const needStock = sd !== null && sd < 12 && s.cash - cost300 > 400;
    if (s.pos.length && incomingUnits(s) === 0 && (canWin || needStock)) {
      E.startNegotiation(s, 'brightway', 300);
      E.proposePrice(s, listPrice(s, 'brightway', 300) * 0.96);
      if (s.negotiation?.agreedPrice === null) E.acceptCounter(s);
      if (E.placeOrder(s, 'air', false)) E.cancelNegotiation(s);
    }
    if (s.won && winDay === null) winDay = s.day;
    packAll(s);
    resolveAll(s);
    E.advanceDay(s);
  }
  return summarize(s, winDay);
}

export function naiveBot(seed: number, days = 50): BotResult {
  const s = E.createGame(seed);
  setupSourcing(s);
  E.advanceDay(s);
  E.takePhoto(s, { backdrop: 'sheet', light: 'overhead', prop: 'none', angle: 'top' });
  for (const m of ['hero', 'description', 'checkout'] as ModuleId[]) E.setModule(s, m, 1);
  E.toggleBenefit(s, 'dishwasher');
  E.setBrandName(s, 'Bowl Co');
  while (s.day < days && s.status === 'playing') {
    if (!s.store.launched && s.inventory.onHand > 0) {
      E.launchStore(s);
      for (const k of Object.keys(s.ads)) if (!k.endsWith('review')) E.setAdCell(s, k, { active: true, budget: 25 });
    }
    packAll(s);
    resolveAll(s);
    E.advanceDay(s);
  }
  return summarize(s, null);
}

function summarize(s: GameState, winDay: number | null): BotResult {
  const rating = s.reviews.length ? s.reviews.reduce((a, r) => a + r.stars, 0) / s.reviews.length : 0;
  return {
    winDay,
    lost: s.status === 'lost' || !!s.flags.loanUsed,
    finalCash: Math.round(s.cash),
    stockoutDays: s.stockoutDays,
    shipped: s.shipped,
    rating: Math.round(rating * 10) / 10,
  };
}
