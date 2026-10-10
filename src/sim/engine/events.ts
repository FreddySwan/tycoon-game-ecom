import { dayOfYear } from '../calendar';
import { CREATORS, ROLES, SUPPLIERS, SUPPLIER_ORDER, WHOLESALE_ACCOUNTS } from '../data';
import { activeContract, avgDailyOrders, def, effectivePrice, freightPerUnit, liveProducts, listPrice, round2, trailing } from '../economics';
import { chance, pick, randInt } from '../rng';
import type { CardChoice, GameEvent, GameState, RoleId, SupplierId } from '../types';
import { type ActionResult, adStat, book, milestone, nextId, notify, spendCash } from './core';
import { creatorHandle } from './marketing';
import { giveRaise } from './ops';
import { resolveCashCrisis } from './company';
import { createPO, signContract } from './sourcing';

type NewEvent = Omit<GameEvent, 'id' | 'day'>;

export function pushEvent(s: GameState, ev: NewEvent): void {
  s.events.push({ ...ev, id: nextId(s), day: s.day });
  notify(s, 'event', ev.title, true);
}

const c = (id: string, label: string, hint: string): CardChoice => ({ id, label, hint });

function cooled(s: GameState, key: string, days: number): boolean {
  const last = s.eventCooldowns[key];
  if (last !== undefined && s.day - last < days) return false;
  return true;
}

function cool(s: GameState, key: string): void {
  s.eventCooldowns[key] = s.day;
}

function open(s: GameState, kind: string): boolean {
  return s.events.some((e) => e.kind === kind);
}

// ───────────────────────────── daily triggers ─────────────────────────────

export function rollEvents(s: GameState): void {
  const live = liveProducts(s).filter((id) => s.products[id].sold > 0);
  const doy = dayOfYear(s.day);

  // Holiday warning: ad costs and demand are about to jump.
  if (doy === 300 && s.stage >= 1 && live.length) {
    pushEvent(s, {
      kind: 'holiday',
      title: 'Holiday season is coming',
      body: 'From mid-November to Christmas, shoppers buy ~55% more, but ad costs jump ~75%. Stock up now (sea freight takes ~4 weeks), and consider bundles to raise order value.',
      blocking: false,
      expiresDay: s.day + 10,
      choices: [c('bundles', 'Turn on bundles everywhere', 'Bigger orders absorb pricier ads'), c('ok', 'Got it', 'I’ll plan my stock')],
    });
  }

  // Viral moments beyond the first.
  if (s.stage >= 2 && live.length && cooled(s, 'viral', 60) && chance(s, 0.012)) {
    const pid = pick(s, live);
    cool(s, 'viral');
    s.products[pid].creatorBoost = [500, 900, 700, 400, 200].map((x) => Math.round(x * (1 + s.stage * 0.6)));
    pushEvent(s, {
      kind: 'viral',
      title: `${def(s, pid).name} is going viral`,
      body: `A creator you’ve never heard of posted about ${def(s, pid).name}. Traffic is about to spike for ~5 days. You have ${s.products[pid].inventory.onHand.toLocaleString()} units.`,
      blocking: false,
      expiresDay: s.day + 3,
      choices: [c('raise', 'Raise price 15%', 'Fewer, more profitable sales'), c('rush', 'Rush an air reorder', '3 weeks of demand by air'), c('ride', 'Ride the wave', 'Sell what you have')],
      data: { pid },
    });
  }

  // Copycats on successful, non-exclusive products.
  for (const pid of live) {
    const p = s.products[pid];
    if (def(s, pid).exclusive || p.copycat > 0.05 || s.day - p.addedDay < 45 || avgDailyOrders(s, pid, 7) < 15) continue;
    if (!cooled(s, `copycat-${pid}`, 120) || !chance(s, 0.015)) continue;
    cool(s, `copycat-${pid}`);
    p.copycat = 0.2;
    pushEvent(s, {
      kind: 'copycat',
      title: `Copycats are selling ${def(s, pid).name} for $${Math.round(def(s, pid).refPrice * 0.65)}`,
      body: 'Lookalike listings appeared everywhere, stealing ~20% of your shoppers. You can fight on price, on brand, or on product.',
      blocking: false,
      expiresDay: s.day + 7,
      choices: [
        c('match', 'Cut price 15%', 'Win shoppers back, lose margin'),
        c('brand', `Invest in brand content ($${(2000 * s.stage).toLocaleString()})`, 'Reviews and story beat lookalikes'),
        c('ignore', 'Ignore them', 'They fade slowly on their own'),
      ],
      data: { pid },
    });
    break;
  }

  // Bazaarly fee hike, announced 30 days ahead.
  const bz = s.channels.bazaarly;
  if (bz?.joined && !s.flags.bzFee && s.day - bz.joinedDay > 60 && chance(s, 0.03)) {
    s.flags.bzFee = true;
    s.counters.bzFeeDay = s.day + 30;
    pushEvent(s, {
      kind: 'bz-fee',
      title: 'Bazaarly is raising fees to 18%',
      body: 'Starting in 30 days, Bazaarly takes 18% of every sale instead of 15%. Your Bazaarly margins will shrink unless you act.',
      blocking: false,
      expiresDay: s.day + 14,
      choices: [
        c('raise', 'Raise Bazaarly prices 4%', 'Pass it on to shoppers'),
        c('negotiate', 'Negotiate a volume tier', 'Needs $100k+/month there'),
        c('accept', 'Accept it', 'Shift effort to other channels'),
      ],
    });
  }
  if (s.counters.bzFeeDay && s.day === s.counters.bzFeeDay) {
    if (s.feeOverrides.bazaarly === undefined) s.feeOverrides.bazaarly = 0.18;
    notify(s, 'info', `Bazaarly fees are now ${Math.round((s.feeOverrides.bazaarly ?? 0.18) * 100)}%.`);
  }

  // Return waves from over-promising descriptions.
  for (const pid of live) {
    const p = s.products[pid];
    const d = def(s, pid);
    const promise = p.benefits.find((id) => (d.benefits.find((b) => b.id === id)?.returns ?? 0) > 0);
    if (!promise || p.returns < 15 || p.returns / Math.max(1, p.sold) < 0.07 || !cooled(s, `returns-${pid}`, 90)) continue;
    cool(s, `returns-${pid}`);
    const text = d.benefits.find((b) => b.id === promise)!.text;
    pushEvent(s, {
      kind: 'returns',
      title: `Returns are piling up on ${d.name}`,
      body: `Customers keep returning it, quoting your description: “${text}”. ${(100 * p.returns / p.sold).toFixed(0)}% of orders have come back.`,
      blocking: false,
      expiresDay: s.day + 7,
      choices: [c('fix', 'Remove the claim', 'Fewer sales, far fewer returns'), c('accept', 'Keep it', 'The claim sells')],
      data: { pid, benefit: promise },
    });
    break;
  }

  // Key people get poached when morale is low.
  for (const person of s.people) {
    const t = s.team[person.role];
    if (t.morale > 45 || !cooled(s, `poach-${person.name}`, 60) || !chance(s, 0.04)) continue;
    cool(s, `poach-${person.name}`);
    pushEvent(s, {
      kind: 'poach',
      title: `${person.name} has another offer`,
      body: `${person.name}, your ${ROLES[person.role].name.toLowerCase()}, mentions a competitor offered 20% more. Team morale is ${Math.round(t.morale)}.`,
      blocking: false,
      expiresDay: s.day + 5,
      choices: [c('raise', 'Raise for the team (+10%)', 'Morale up for everyone in the role'), c('promote', 'Promote them (+15%)', 'Keeps them, loyal for good'), c('letgo', 'Let them go', 'Wish them well')],
      data: { name: person.name, role: person.role },
    });
    break;
  }

  // Supplier price increases.
  if (s.stage >= 2 && cooled(s, 'priceUp', 150) && chance(s, 0.008)) {
    const used = SUPPLIER_ORDER.filter((id) => s.supplierUnits[id] > 0);
    if (used.length) {
      const sup = pick(s, used);
      cool(s, 'priceUp');
      s.counters[`priceUp-${sup}`] = (s.counters[`priceUp-${sup}`] ?? 0) + 0.06;
      pushEvent(s, {
        kind: 'price-up',
        title: `${SUPPLIERS[sup].company} raises prices 6%`,
        body: `${SUPPLIERS[sup].contact}: “Raw materials went up. All new orders are 6% higher, sorry.”`,
        blocking: false,
        expiresDay: s.day + 7,
        choices: [c('negotiate', 'Push back', 'Needs a 70+ relationship'), c('accept', 'Accept', 'Shop around next time')],
        data: { sup },
      });
    }
  }

  // Rolling reserve on fast growth.
  const m = trailing(s, 30);
  const prev = s.history.slice(-60, -30).reduce((a, r) => a + r.pl.revenue, 0);
  if (m.revenue > 20000 && prev > 0 && m.revenue > prev * 2.2 && cooled(s, 'reserve', 180) && !open(s, 'reserve')) {
    cool(s, 'reserve');
    const held = round2((s.channelAccrued.store ?? 0) * 0.5);
    s.channelAccrued.store = round2((s.channelAccrued.store ?? 0) - held);
    s.receivables.push({ dueDay: s.day + 30, amount: held, label: 'Payment reserve release' });
    pushEvent(s, {
      kind: 'reserve',
      title: 'Your payment processor froze some money',
      body: `Sales doubled so fast that ShopBloc Payments is holding $${held.toLocaleString()} for 30 days as a “rolling reserve”. Growth eats cash.`,
      blocking: false,
      expiresDay: s.day + 5,
      choices: [c('ok', 'Ugh, fine', 'Released on day ' + (s.day + 30))],
    });
  }

  // Wholesale inquiries.
  if (s.stage >= 4 && live.length && !open(s, 'wholesale') && cooled(s, 'wholesale', 25) && chance(s, 0.05)) {
    const pid = live.reduce((a, b) => (avgDailyOrders(s, a) > avgDailyOrders(s, b) ? a : b));
    cool(s, 'wholesale');
    const qty = Math.max(500, Math.round((avgDailyOrders(s, pid, 14) * 25) / 100) * 100);
    const price = round2(effectivePrice(s, pid) * 0.52);
    const account = pick(s, WHOLESALE_ACCOUNTS);
    pushEvent(s, {
      kind: 'wholesale',
      title: `${account} wants to stock ${def(s, pid).name}`,
      body: `A retail chain offers to buy ${qty.toLocaleString()} units at $${price.toFixed(2)} each (52% of retail), shipped within 21 days, paid 30 days after delivery. Big volume, thin margin, slow cash.`,
      blocking: false,
      expiresDay: s.day + 5,
      choices: [c('accept', 'Accept the order', `$${Math.round(qty * price).toLocaleString()} revenue`), c('decline', 'Decline', 'Protect your stock')],
      data: { pid, qty, price, account },
    });
  }

  // Supplier agreements offered by suppliers who like you.
  if (s.stage >= 4 && cooled(s, 'contractOffer', 90)) {
    const sup = SUPPLIER_ORDER.find((id) => s.relationship[id] >= 75 && s.supplierUnits[id] >= 5000 && !activeContract(s, id));
    if (sup && chance(s, 0.05)) {
      cool(s, 'contractOffer');
      pushEvent(s, {
        kind: 'contract-offer',
        title: `${SUPPLIERS[sup].contact} proposes a manufacturing agreement`,
        body: `${SUPPLIERS[sup].company} offers a 12-month agreement: lower prices, 30/70 payment terms and priority production, in return for a volume commitment.`,
        blocking: false,
        expiresDay: s.day + 10,
        choices: [c('sign', 'Sign it', 'See terms in SourceMart'), c('later', 'Not now', 'Keep it flexible')],
        data: { sup },
      });
    }
  }

  // Creators reaching out.
  if (s.stage >= 2 && live.length && cooled(s, 'creatorDM', 45) && chance(s, 0.02)) {
    const pid = pick(s, live);
    cool(s, 'creatorDM');
    const handle = creatorHandle(s, def(s, pid).category);
    pushEvent(s, {
      kind: 'creator-dm',
      title: 'A creator slid into your DMs',
      body: `${handle} loves ${def(s, pid).name} and offers a post for $800 (normally $1,500).`,
      blocking: false,
      expiresDay: s.day + 4,
      choices: [c('accept', 'Book it ($800)', 'Mid-size creator, discounted'), c('decline', 'Pass', 'Not now')],
      data: { pid, handle },
    });
  }

  // Big Bazaarly Days warning.
  if (bz?.joined && doy === 185) {
    pushEvent(s, {
      kind: 'bbd',
      title: 'Big Bazaarly Days in one week',
      body: 'Bazaarly’s three-day sale sends huge traffic to listings running a lightning deal. Join with 20% off on all your Bazaarly listings?',
      blocking: false,
      expiresDay: s.day + 6,
      choices: [c('join', 'Join the sale', 'Deals run July 12–14'), c('skip', 'Skip it', 'Keep full price')],
    });
  }

  // Auto-resolve expired events with their last (default) choice.
  for (const ev of [...s.events]) {
    if (ev.expiresDay !== undefined && s.day > ev.expiresDay) resolveEvent(s, ev.id, ev.choices[ev.choices.length - 1].id);
  }
}

// ───────────────────────────── resolution ─────────────────────────────

export function resolveEvent(s: GameState, eventId: number, choiceId: string): ActionResult {
  const ev = s.events.find((e) => e.id === eventId);
  if (!ev) return 'Already handled.';
  const d = ev.data ?? {};
  const pid = d.pid as string | undefined;
  switch (ev.kind) {
    case 'cash-crisis':
      resolveCashCrisis(s, choiceId);
      break;
    case 'reorder-delay':
      if (choiceId === 'topup') {
        const po = s.pos.find((p) => p.id === d.poId);
        if (!po) break;
        const qty = d.qty as number;
        const cost = d.cost as number;
        const err = spendCash(s, cost);
        if (err) return err;
        const goodsShare = round2((po.totalCost * qty) / po.qty);
        s.pos.push({
          ...po,
          id: nextId(s),
          qty,
          freight: 'air',
          freightPerUnit: freightPerUnit(s, po.productId, 'air') * 2,
          placedDay: s.day,
          productionDoneDay: s.day,
          arrivesDay: s.day + 5,
          status: 'transit',
          delayDays: 0,
          totalCost: goodsShare + cost,
          balanceDue: 0,
        });
        po.qty -= qty;
        po.totalCost = round2(po.totalCost - goodsShare);
        notify(s, 'po', `Express top-up of ${qty} units arrives day ${s.day + 5}.`);
      }
      break;
    case 'holiday':
      if (choiceId === 'bundles') for (const id of liveProducts(s)) s.products[id].bundle = true;
      break;
    case 'viral':
      if (!pid || !s.products[pid]) break;
      if (choiceId === 'raise') s.products[pid].price = round2(s.products[pid].price * 1.15);
      if (choiceId === 'rush') {
        const p = s.products[pid];
        const sup = (p.reorder.supplierId ?? [...s.pos].reverse().find((x) => x.productId === pid)?.supplierId ?? 'brightway') as SupplierId;
        const qty = Math.max(SUPPLIERS[sup].moq, Math.round((avgDailyOrders(s, pid, 7) * 3 * 21) / 100) * 100);
        const err = createPO(s, pid, sup, qty, listPrice(s, pid, sup, qty), 'air', false);
        if (err) return err;
      }
      break;
    case 'copycat':
      if (!pid || !s.products[pid]) break;
      if (choiceId === 'match') {
        s.products[pid].price = round2(s.products[pid].price * 0.85);
        s.products[pid].copycat = 0.08;
      } else if (choiceId === 'brand') {
        if (s.cash < 2000 * s.stage) return `Not enough cash. You need $${(2000 * s.stage).toLocaleString()}.`;
        book(s, 'ads', 2000 * s.stage, { brandId: s.products[pid].brandId, productId: pid });
        s.products[pid].copycat = 0.07;
      }
      break;
    case 'bz-fee':
      if (choiceId === 'raise') {
        for (const id of liveProducts(s)) {
          const l = s.products[id].listings.bazaarly;
          if (l) l.price = round2(l.price * 1.04);
        }
      } else if (choiceId === 'negotiate') {
        const bzRevenue = trailing(s, 30).channel.bazaarly ?? 0;
        if (bzRevenue >= 100000) {
          s.feeOverrides.bazaarly = 0.16;
          notify(s, 'info', 'Bazaarly agreed to a 16% volume tier for you.', true);
        } else notify(s, 'info', `Bazaarly declined: you need $100k+/month there (you’re at $${Math.round(bzRevenue).toLocaleString()}).`, true);
      }
      break;
    case 'returns':
      if (choiceId === 'fix' && pid && s.products[pid]) {
        s.products[pid].benefits = s.products[pid].benefits.filter((b) => b !== d.benefit);
        s.products[pid].returns = Math.round(s.products[pid].returns / 3);
      }
      break;
    case 'poach': {
      const role = d.role as RoleId;
      const person = s.people.find((p) => p.name === d.name);
      if (choiceId === 'raise') giveRaise(s, role);
      else if (choiceId === 'promote' && person) {
        person.morale = 95;
        person.promoted = true;
        s.team[role].wageMult = round2(s.team[role].wageMult + 0.15 / Math.max(1, s.team[role].count));
        s.team[role].morale = Math.min(100, s.team[role].morale + 10);
      } else if (choiceId === 'letgo' && person) {
        s.people = s.people.filter((p) => p !== person);
        s.team[role].count = Math.max(0, s.team[role].count - 1);
        s.team[role].morale = Math.max(0, s.team[role].morale - 10);
        notify(s, 'team', `${person.name} left for the competitor. The team is shaken.`);
      }
      break;
    }
    case 'price-up': {
      const sup = d.sup as SupplierId;
      if (choiceId === 'negotiate') {
        if (s.relationship[sup] >= 70) {
          s.counters[`priceUp-${sup}`] -= 0.03;
          s.relationship[sup] -= 5;
          notify(s, 'po', `${SUPPLIERS[sup].contact} met you halfway: +3% instead of +6%.`);
        } else notify(s, 'po', `${SUPPLIERS[sup].contact}: “Sorry, the price is the price.”`);
      }
      break;
    }
    case 'wholesale':
      if (choiceId === 'accept' && pid) {
        s.wholesale.push({ id: nextId(s), account: d.account as string, productId: pid, qty: d.qty as number, unitPrice: d.price as number, dueDay: s.day + 21, shipped: false, recurring: 0 });
        notify(s, 'info', `🏪 Wholesale order from ${d.account}: ship ${(d.qty as number).toLocaleString()} units by day ${s.day + 21}.`);
      }
      break;
    case 'contract-offer':
      if (choiceId === 'sign') {
        const err = signContract(s, d.sup as SupplierId);
        if (err) return err;
      }
      break;
    case 'creator-dm':
      if (choiceId === 'accept' && pid && s.products[pid]) {
        if (s.cash < 800) return 'Not enough cash. You need $800.';
        book(s, 'ads', 800, { brandId: s.products[pid].brandId, productId: pid, channel: 'store' });
        adStat(s, pid, 'creator', { spend: 800 });
        const tier = CREATORS[1];
        const viral = chance(s, tier.viral);
        s.products[pid].creatorBoost = [0.5, 1, 0.6, 0.3, 0.15].map((x) => Math.round(tier.reach * x * (viral ? 5 : 1)));
        s.products[pid].ugc = true;
        s.creatorPosts.push({ day: s.day, productId: pid, tier: 'mid', cost: 800, viral, handle: String(d.handle ?? '@creator') });
        milestone(s, 'first_creator');
        if (viral) notify(s, 'info', `🔥 The post blew up! ${def(s, pid).name} is everywhere.`, true);
      }
      break;
    case 'bbd':
      if (choiceId === 'join') {
        for (const id of liveProducts(s)) {
          const l = s.products[id].listings.bazaarly;
          if (l?.active) {
            l.promoUntil = s.day + 9;
            l.promoCooldown = s.day + 30;
          }
        }
      }
      break;
  }
  s.events = s.events.filter((e) => e.id !== eventId);
  return null;
}

/** First reorder in transit always hits port congestion: the cash-and-lead-time lesson. */
export function reorderDelayEvent(s: GameState, poId: number): void {
  const po = s.pos.find((p) => p.id === poId)!;
  const delay = 5;
  const topQty = Math.min(100, Math.floor(po.qty / 3));
  const topCost = round2(topQty * freightPerUnit(s, po.productId, 'air') * 2);
  po.arrivesDay += delay;
  po.delayDays += delay;
  pushEvent(s, {
    kind: 'reorder-delay',
    title: 'BlueLane: port congestion in Ningbo',
    body: `Your reorder of ${po.qty} units is delayed ${delay} days (now day ${po.arrivesDay}). You can split off ${topQty} units and fly them express for $${topCost}, arriving in 5 days.`,
    blocking: false,
    expiresDay: s.day + 3,
    choices: [c('topup', `Express top-up ($${topCost})`, `${topQty} units arrive day ${s.day + 5}`), c('accept', 'Accept the delay', 'Free. Watch your stock.')],
    data: { poId: po.id, qty: topQty, cost: topCost },
  });
}

export function randomShipDelay(s: GameState, supplierId: SupplierId): number {
  return chance(s, 1 - SUPPLIERS[supplierId].reliability) ? randInt(s, 2, 5) : 0;
}

