import { CATALOG, MARKETPLACES, REGION_ORDER, SPACES, STAGE_SPACE, SUPPLIERS } from './data';
import * as E from './engine';
import {
  averageRating,
  avgDailyOrders,
  breakEvenCPA,
  def,
  fulfillmentCapacity,
  incomingUnits,
  listPrice,
  liveProducts,
  recentCPA,
  storageCapacity,
  storageUsed,
  supportCapacity,
  trailing,
  unitsPerOrder,
} from './economics';
import { stageReady } from './progress';
import type { GameState, ModuleId, StageId, SupplierId } from './types';

/** Scripted players used for balance testing. */
export interface BotResult {
  stageDays: Partial<Record<StageId, number>>;
  winDay: number | null;
  lost: boolean;
  finalCash: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  products: number;
  headcount: number;
  shipped: number;
  rating: number;
}

const PHOTO = (s: GameState, pid: string) => def(s, pid).bestPhoto;

function resolveAll(s: GameState) {
  for (const c of [...s.cards]) E.resolveCard(s, c.id, c.kind === 'late' ? 'code' : 'replace');
  for (const ev of [...s.events]) {
    const pick: Record<string, string> = {
      'cash-crisis': 'bridge',
      'reorder-delay': 'accept',
      holiday: 'bundles',
      viral: 'ride',
      copycat: 'brand',
      'bz-fee': 'negotiate',
      returns: 'fix',
      poach: 'raise',
      'price-up': 'negotiate',
      wholesale: 'accept',
      'contract-offer': 'sign',
      'creator-dm': 'accept',
      bbd: 'join',
      reserve: 'ok',
    };
    const want = pick[ev.kind] ?? ev.choices[0].id;
    const choice = ev.choices.find((x) => x.id === want) ?? (ev.kind === 'cash-crisis' ? ev.choices[0] : ev.choices[ev.choices.length - 1]);
    if (E.resolveEvent(s, ev.id, choice.id)) E.resolveEvent(s, ev.id, ev.choices[ev.choices.length - 1].id);
  }
}

function bestSupplier(s: GameState, qty: number): SupplierId {
  if (s.stage >= 3 && qty >= SUPPLIERS.megafab.moq) return 'megafab';
  return 'brightway';
}

function order(s: GameState, pid: string, qty: number, freight: 'air' | 'sea'): boolean {
  const sup = bestSupplier(s, qty);
  qty = Math.max(SUPPLIERS[sup].moq, qty);
  E.startNegotiation(s, pid, sup, qty);
  E.proposePrice(s, listPrice(s, pid, sup, qty) * 0.95);
  if (s.negotiation?.agreedPrice === null) E.acceptCounter(s);
  const err = E.placeOrder(s, freight, false);
  if (err) E.cancelNegotiation(s);
  return !err;
}

function setupProduct(s: GameState, pid: string) {
  const p = s.products[pid];
  if (!p.photo && E.takePhoto(s, pid, PHOTO(s, pid)) && s.stage >= 2) E.hirePhotographer(s, pid);
  if (!p.benefits.length) {
    const good = def(s, pid).benefits.filter((b) => !b.returns).sort((a, b) => b.cvr - a.cvr).slice(0, 3);
    for (const b of good) E.toggleBenefit(s, pid, b.id);
  }
  p.bundle = true;
}

function supply(s: GameState, pid: string) {
  const p = s.products[pid];
  if (!s.pos.some((po) => po.productId === pid)) {
    if (s.cash > 1600) order(s, pid, 300, 'air');
    return;
  }
  const daily = Math.max(avgDailyOrders(s, pid, 7), 1) * unitsPerOrder(s, pid);
  const cover = (p.inventory.onHand + incomingUnits(s, pid)) / daily;
  const sup = bestSupplier(s, daily * 60);
  const seaLead = SUPPLIERS[sup].productionDays + 25;
  const airLead = SUPPLIERS[sup].productionDays + 6;
  if (cover < seaLead + 12) {
    const freight = cover < airLead + 8 ? 'air' : 'sea';
    const qty = Math.round((daily * (freight === 'air' ? 30 : 60)) / 100) * 100;
    const cost = qty * (listPrice(s, pid, sup, qty) + 1);
    const reserve = s.stage === 1 ? 300 : 2000 + trailing(s, 30).pl.payroll / 2;
    const room = s.credit.unlocked ? Math.min(s.credit.limit * 0.5, s.credit.limit - s.credit.balance) : 0;
    if (s.cash - cost > reserve || room > cost + reserve - s.cash) {
      if (s.cash < cost + reserve && s.credit.unlocked) E.drawCredit(s, cost + reserve - s.cash);
      order(s, pid, qty, freight);
    } else if (cover < airLead) {
      const small = Math.max(SUPPLIERS[sup].moq, Math.round((daily * 20) / 100) * 100);
      if (s.cash > small * (listPrice(s, pid, sup, small) + 2) + 200) order(s, pid, small, 'air');
    }
  }
}

function ads(s: GameState, pid: string) {
  const p = s.products[pid];
  if (!E.onStore(s, pid) || !p.inventory.onHand) return;
  if (s.team.marketer.count) return;
  const be = breakEvenCPA(s, pid);
  const cells = Object.values(p.ads);
  if (!cells.some((c) => c.totals.spend > 0)) {
    for (const c of cells) if (c.creative === 'white' || c.creative === 'video') E.setAdCell(s, pid, c.key, { active: true, budget: 10 });
    return;
  }
  if (s.day % 4 !== 0) return;
  for (const c of cells) {
    if (!c.active) {
      if (!c.totals.spend && E.setAdCell(s, pid, c.key, { active: true, budget: 15 }) === null) continue;
      continue;
    }
    const r = recentCPA(c, 6);
    if (r.orders < 4 && r.spend < be * 2.5) continue;
    if (r.cpa === null || r.cpa > be * 0.95) E.setAdCell(s, pid, c.key, { active: false });
    else if (r.cpa < be * 0.7) E.setAdCell(s, pid, c.key, { budget: Math.min(400 * s.stage, c.budget * 1.25) });
  }
  if (!cells.some((c) => c.active)) {
    const best = cells.filter((c) => c.totals.orders > 0).sort((a, b) => a.totals.spend / a.totals.orders - b.totals.spend / b.totals.orders)[0];
    if (best) E.setAdCell(s, pid, best.key, { active: true, budget: 15 });
  }
  if (E.searchUnlocked(s) && !p.search.active && s.cash > 500) E.setSearch(s, pid, { active: true, budget: 20 });
  if (p.search.active && s.day % 7 === 0) {
    const r = recentCPA(p.search, 7);
    if (r.orders >= 4 && r.cpa !== null) E.setSearch(s, pid, { budget: r.cpa < be * 0.7 ? p.search.budget * 1.2 : r.cpa > be ? p.search.budget * 0.7 : p.search.budget });
  }
}

function staff(s: GameState) {
  if (s.stage < 2) return;
  const cap = fulfillmentCapacity(s);
  const ownDaily = liveProducts(s).reduce((a, id) => a + avgDailyOrders(s, id, 14), 0) * (s.channels.bazaarly?.joined ? 0.6 : 1);
  const backlog = s.backlog.reduce((a, b) => a + b.orders, 0);
  const shifts = s.team.lead.count ? s.shifts : 1;
  const usefulPackers = (s.space === 'garage' ? 3 : Math.max(cap.stations, 1)) * shifts + (s.stage >= 3 ? 1 : 0);
  if (!s.thirdParty && (cap.total < ownDaily * 1.25 || backlog > cap.total)) {
    const want = Math.max(1, Math.ceil((ownDaily * 1.3 - cap.total) / 35));
    const n = Math.min(want, usefulPackers - s.team.packer.count);
    if (n > 0) E.hire(s, 'packer', n);
    else if (s.stage === 2) E.setThirdParty(s, true);
  } else if (!s.thirdParty && s.team.packer.count > 1 && cap.team > ownDaily * 2.2 && backlog < cap.total * 0.2) {
    E.fire(s, 'packer', Math.max(1, Math.floor((cap.team - ownDaily * 1.5) / 35)));
  }
  if (s.thirdParty && s.stage >= 3 && s.layout.w && cap.stations >= 4) E.setThirdParty(s, false);
  const tickets = s.tickets.queue.reduce((a, t) => a + t.count, 0);
  if (s.cards.length >= 3 || tickets > supportCapacity(s) * 0.8) E.hire(s, 'support');
  if (!s.team.marketer.count && trailing(s, 30).profit > 4000) E.hire(s, 'marketer');
  if (s.stage >= 3 && !s.team.buyer.count) E.hire(s, 'buyer');
  if (s.stage >= 3 && !s.team.lead.count && s.team.packer.count >= 3) E.promoteToLead(s) && E.hire(s, 'lead');
  if (s.team.lead.count && s.team.packer.count > cap.stations && s.shifts === 1) E.setShifts(s, 2);
  if (s.team.lead.count * 15 < s.team.packer.count) E.hire(s, 'lead');
  for (const [role, t] of Object.entries(s.team)) if (t.count && t.morale < 45) E.giveRaise(s, role as never);
  if (s.stage >= 4 && !s.team.designer.count) E.hire(s, 'designer');
}

function layout(s: GameState) {
  if (!s.layout.w || s.cash < 8000) return;
  const { w, h } = s.layout;
  const stations = s.layout.cells.filter((c) => c === 'station').length;
  const wantStations = Math.ceil(s.team.packer.count / s.shifts) + 1;
  const free: number[] = [];
  s.layout.cells.forEach((c, i) => {
    if (!c && i !== E.dockIndex(s)) free.push(i);
  });
  for (let k = 0; k < 3 && stations + k < wantStations && free.length; k++) {
    const pickI = free.filter((i) => Math.floor(i / w) >= h - 4 && !s.layout.cells[i]).sort((a, b) => Math.abs((a % w) - w / 2) - Math.abs((b % w) - w / 2))[0];
    if (pickI === undefined) break;
    E.placeTile(s, pickI % w, Math.floor(pickI / w), 'station');
  }
  if (stations < wantStations && free.length) {
    // Near the dock, next to racks.
    const pickI = free.filter((i) => Math.floor(i / w) >= h - 4).sort((a, b) => Math.abs((a % w) - w / 2) - Math.abs((b % w) - w / 2))[0] ?? free[0];
    E.placeTile(s, pickI % w, Math.floor(pickI / w), 'station');
  } else if (storageUsed(s) > storageCapacity(s) * 0.8 && free.length) {
    const pickI = free.filter((i) => Math.floor(i / w) <= h - 4)[0] ?? free[0];
    E.placeTile(s, pickI % w, Math.floor(pickI / w), 'rack');
  } else if (s.stage >= 3 && s.cash > 40000 && free.length) {
    const st = s.layout.cells.findIndex((c, i) => c === 'station' && ![i - 1, i + 1].some((n) => s.layout.cells[n] === 'conveyor'));
    if (st >= 0 && st % w < w - 1 && !s.layout.cells[st + 1] && st + 1 !== E.dockIndex(s)) E.placeTile(s, (st + 1) % w, Math.floor((st + 1) / w), 'conveyor');
  }
  if (s.stage >= 3 && s.cash > 20000) E.buyAutomation(s, 'labelPrinter');
  if (s.stage >= 4 && s.cash > 60000) E.buyAutomation(s, 'scanners');
}

function growth(s: GameState) {
  // More products
  const slots = E.productSlots(s);
  const t = trailing(s, 30);
  if (liveProducts(s).length < slots && s.stage >= 1 && (liveProducts(s).length === 0 || (t.profit > 1500 * liveProducts(s).length && s.cash > 2500))) {
    const next = s.revealed.find((id) => !s.products[id] && (CATALOG[id]?.trend.kind !== 'fad' || id === 'sunsetlamp') || (s.customDefs[id] && !s.products[id]));
    if (next) E.addProduct(s, next);
  }
  // Retire dead fads
  for (const pid of liveProducts(s)) {
    if (def(s, pid).trend.kind === 'fad' && s.day > (def(s, pid).trend.peakDay ?? 0) + 30 && s.products[pid].inventory.onHand < 50) E.retireProduct(s, pid, true);
  }
  if (s.stage >= 2) {
    const b = s.brands[0];
    if (b.packaging !== 'branded') E.setBrandOps(s, b.id, { packaging: 'branded', thankYouCard: true });
    for (const f of ['postPurchase', 'welcome', 'winback'] as const) if (!b.email.flows[f] && s.cash > 1000) E.setFlow(s, b.id, f, true);
    if (s.day - b.email.lastCampaign >= 14) E.sendCampaign(s, b.id, 10);
    if (!s.channels.loopshop?.joined) E.joinChannel(s, 'loopshop');
    for (const pid of liveProducts(s)) {
      if (s.channels.loopshop?.joined && !s.products[pid].listings.loopshop?.active) E.setListing(s, pid, 'loopshop', { active: true });
      if (s.day % 30 === 0 && s.cash > 5000 && s.products[pid].inventory.onHand > 300) E.hireCreator(s, pid, s.stage >= 3 ? 'mid' : 'micro');
      if (s.stage >= 2) E.setReorderRule(s, pid, { enabled: true, supplierId: s.products[pid].reorder.supplierId ?? 'brightway', freight: 'sea', qty: Math.max(500, Math.round(avgDailyOrders(s, pid, 14) * unitsPerOrder(s, pid) * 45 / 100) * 100), coverDays: 30 });
    }
  }
  if (s.stage >= 4) {
    for (const ch of MARKETPLACES) {
      if (!s.channels[ch]?.joined && s.cash > 2000) E.joinChannel(s, ch);
      for (const pid of liveProducts(s)) {
        const p = s.products[pid];
        if (!s.channels[ch]?.joined || p.listings[ch]?.active || !p.inventory.onHand) continue;
        const ref = def(s, pid).refPrice;
        const price = ch === 'flashcart' ? ref * 0.85 : ch === 'crafthaus' ? Math.max(p.price, ref) : p.price;
        E.setListing(s, pid, ch, { active: true, price, program: ch === 'bazaarly' });
      }
    }
    for (const pid of liveProducts(s)) {
      const l = s.products[pid].listings.bazaarly;
      if (l?.active && l.promoCooldown <= s.day && s.day % 31 === 0) E.runPromo(s, pid, 'bazaarly');
    }
    for (const sup of ['brightway', 'megafab'] as SupplierId[]) if (!E.canSignContract(s, sup)) E.signContract(s, sup);
    if (!s.lab.some((l) => !l.done) && s.cash > 80000 && s.lab.length < 3) {
      const base = liveProducts(s).sort((a, b) => avgDailyOrders(s, b) - avgDailyOrders(s, a))[0];
      if (base && !def(s, base).exclusive) E.startLab(s, base, { materials: 2, design: 2, features: 2 }, `${def(s, base).name} Pro`);
    }
  }
  if (s.stage >= 5) {
    for (const r of REGION_ORDER) {
      if (!s.regions[r]?.entered && s.cash > 150000) E.enterRegion(s, r);
      if (s.regions[r]?.entered && !s.regions[r]?.warehouse && s.cash > 80000) E.openRegionalWarehouse(s, r);
    }
  }
  // Stage moves
  const next = (s.stage + 1) as StageId;
  if (s.stage < 5 && stageReady(s, next) && s.cash > SPACES[STAGE_SPACE[next]].deposit * 1.5 + 3000) E.advanceStage(s);
  if (s.credit.balance > 0 && s.cash > s.credit.balance + 20000) E.repayCredit(s, s.credit.balance);
}

export function fullBot(seed: number, days = 720, log?: (line: string) => void): BotResult {
  return runBot(seed, days, log).result;
}

/** Play a whole game with the scripted player and hand back the final state (dev tool + tests). */
export function runBot(seed: number, days = 720, log?: (line: string) => void, start?: GameState): { s: GameState; result: BotResult } {
  const s = start ?? E.createGame(seed);
  const fresh = !start;
  const stageDays: Partial<Record<StageId, number>> = { 1: 1 };
  if (fresh) {
    E.addProduct(s, 'dogbowl');
    E.orderSample(s, 'dogbowl', 'brightway');
    E.setBrandName(s, 1, 'Pawsitive Pace');
    for (const m of ['header', 'hero', 'gallery', 'description', 'reviews', 'shipping', 'checkout'] as ModuleId[]) E.setModule(s, 1, m, 1);
    s.flags.introSeen = true;
    s.flags.winSeen = true;
  }
  let winDay: number | null = null;
  while (s.day < days && s.status === 'playing') {
    for (const smp of s.samples) if (smp.arrived && !smp.inspected) E.inspectSample(s, smp.productId, smp.supplierId);
    for (const pid of liveProducts(s)) {
      if (!s.samples.some((x) => x.productId === pid) && s.stage === 1) E.orderSample(s, pid, 'brightway');
      if (s.samples.some((x) => x.productId === pid && x.arrived) || s.stage >= 2 || s.products[pid].inventory.onHand) setupProduct(s, pid);
      if (s.samples.some((x) => x.productId === pid && x.arrived) || s.stage >= 2) supply(s, pid);
      ads(s, pid);
    }
    if (!s.brands[0].store.launched) E.launchStore(s, 1);
    if (s.stage === 1 && !s.batchPacking) while (s.backlog.length && !E.handPack(s));
    if (s.stage <= 2 && s.backlog.reduce((a, b) => a + b.orders, 0) > fulfillmentCapacity(s).total && s.cash > 300) E.callFriend(s);
    staff(s);
    layout(s);
    growth(s);
    resolveAll(s);
    if (s.won && winDay === null) winDay = s.day;
    E.advanceDay(s);
    if (!stageDays[s.stage]) stageDays[s.stage] = s.day;
    if (log && (s.day % 30 === 0)) {
      const t = trailing(s, 30);
      const ch = Object.entries(t.channel).map(([k, v]) => `${k}:${Math.round((v ?? 0) / 1000)}k`).join(' ');
      log(`   channels ${ch} | intl ${Math.round(E.intlFactorSafe(s) * 100)}% | top ${liveProducts(s).map((id) => `${id}:${Math.round(avgDailyOrders(s, id, 7))}`).join(',')} | bz rank ${liveProducts(s).map((id) => (s.products[id].listings.bazaarly?.rank ?? 0).toFixed(2)).join(',')}`);
      log(`d${s.day} st${s.stage} cash ${Math.round(s.cash)} rev ${Math.round(t.revenue)} profit ${Math.round(t.profit)} orders ${t.orders} prods ${liveProducts(s).length} staff ${Object.values(s.team).reduce((a, x) => a + x.count, 0)} credit ${s.credit.balance} cap ${Math.round(Math.min(99999, fulfillmentCapacity(s).total))} backlog ${Math.round(s.backlog.reduce((a, b) => a + b.orders, 0))} ads ${Math.round(t.pl.ads)} pay ${Math.round(t.pl.payroll)} rent ${Math.round(t.pl.rent)}`);
    }
  }
  const t = trailing(s, 30);
  const result: BotResult = {
    stageDays,
    winDay,
    lost: s.status === 'lost',
    finalCash: Math.round(s.cash),
    monthlyRevenue: Math.round(t.revenue),
    monthlyProfit: Math.round(t.profit),
    products: liveProducts(s).length,
    headcount: Object.values(s.team).reduce((a, x) => a + x.count, 0),
    shipped: s.shipped,
    rating: Math.round(averageRating(s) * 100) / 100,
  };
  return { s, result };
}

export function naiveBot(seed: number, days = 60): BotResult {
  const s = E.createGame(seed);
  E.addProduct(s, 'dogbowl');
  E.orderSample(s, 'dogbowl', 'brightway');
  for (let i = 0; i < 3; i++) E.advanceDay(s);
  E.inspectSample(s, 'dogbowl', 'brightway');
  order(s, 'dogbowl', 300, 'air');
  E.takePhoto(s, 'dogbowl', { backdrop: 'sheet', light: 'overhead', prop: 'none', angle: 'top' });
  for (const m of ['hero', 'description', 'checkout'] as ModuleId[]) E.setModule(s, 1, m, 1);
  E.toggleBenefit(s, 'dogbowl', 'dishwasher');
  E.setBrandName(s, 1, 'Bowl Co');
  E.launchStore(s, 1);
  while (s.day < days && s.status === 'playing') {
    const p = s.products.dogbowl;
    if (p.inventory.onHand && !Object.values(p.ads).some((c) => c.active)) for (const c of Object.values(p.ads)) E.setAdCell(s, 'dogbowl', c.key, { active: true, budget: 25 });
    while (s.backlog.length && !s.batchPacking && !E.handPack(s));
    resolveAll(s);
    E.advanceDay(s);
  }
  return { stageDays: {}, winDay: null, lost: s.status === 'lost' || !!s.flags.loanUsed, finalCash: Math.round(s.cash), monthlyRevenue: 0, monthlyProfit: 0, products: 1, headcount: 0, shipped: s.shipped, rating: 0 };
}
