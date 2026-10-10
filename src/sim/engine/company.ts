import { BRAND_SETUP_COST, CATALOG, LOAN, REGIONS, SPACES, STAGES, STAGE_SPACE } from '../data';
import { def, mod, round2, trailing } from '../economics';
import { ambitionDone, stageReady } from '../progress';
import type { AmbitionId, GameState, ProductDef, RegionId, StageId } from '../types';
import { type ActionResult, book, milestone, newBrand, nextId, notify, spendCash, spendOn } from './core';
import { initLayout } from './ops';
import { revealDue } from './sourcing';

// ───────────────────────────── stages ─────────────────────────────

const MOVE_MILESTONE = { 2: 'moved_garage', 3: 'moved_warehouse', 4: 'moved_hq', 5: 'moved_campus' } as const;

export function moveCost(stage: StageId): number {
  return SPACES[STAGE_SPACE[stage]].deposit;
}

export function advanceStage(s: GameState): ActionResult {
  const next = (s.stage + 1) as StageId;
  if (s.stage >= 5) return 'You’re already an established company.';
  if (!stageReady(s, next)) return 'Not ready yet. Check the requirements in the Company app.';
  const space = SPACES[STAGE_SPACE[next]];
  const err = spendCash(s, space.deposit);
  if (err) return err;
  s.stage = next;
  s.space = space.id;
  s.flags[`stage${next}`] = true;
  s.stageOffer = null;
  const rent = s.bills.find((b) => b.label === 'Rent' || b.label.startsWith('Rent'));
  if (rent) {
    rent.amount = space.rent;
    rent.label = `Rent: ${space.name}`;
  }
  if (next >= 2) s.credit.unlocked = true;
  initLayout(s);
  revealDue(s);
  // Moving day lifts everyone's spirits.
  for (const t of Object.values(s.team)) t.morale = Math.min(100, t.morale + 10);
  milestone(s, MOVE_MILESTONE[next as 2 | 3 | 4 | 5]);
  notify(s, 'info', `🎉 Welcome to stage ${next}: ${STAGES[next].name}. New: ${STAGES[next].unlocks.join(', ')}.`, true);
  return null;
}

export function checkStageOffer(s: GameState): void {
  if (s.stage >= 5) return;
  const next = (s.stage + 1) as StageId;
  if (s.stageOffer !== next && stageReady(s, next)) {
    s.stageOffer = next;
    const space = SPACES[STAGE_SPACE[next]];
    notify(s, 'event', `🏗️ You’re ready to grow: a ${space.name.toLowerCase()} is available (${'$'}${space.deposit.toLocaleString()} deposit, ${'$'}${space.rent.toLocaleString()}/month). Staying small is a valid choice too. See the Company app.`, true);
  }
}

// ───────────────────────────── ambitions ─────────────────────────────

export function chooseAmbition(s: GameState, id: AmbitionId): ActionResult {
  if (s.stage < 2) return 'Ambitions open up once you’re a growing brand.';
  s.ambition = id;
  return null;
}

export function checkAmbitions(s: GameState): void {
  if (!s.ambition || s.ambitionsDone.includes(s.ambition)) return;
  if (s.day % 5 !== 0) return;
  if (ambitionDone(s, s.ambition)) {
    s.ambitionsDone.push(s.ambition);
    s.milestones.ambition = s.day;
    notify(s, 'milestone', `Ambition achieved!`, true);
  }
}

// ───────────────────────────── international ─────────────────────────────

export function enterRegion(s: GameState, id: RegionId): ActionResult {
  if (s.stage < 5) return 'International expansion unlocks at the Established stage.';
  if (s.regions[id]?.entered) return null;
  const err = spendOn(s, 'other', REGIONS[id].setupCost, undefined, 'Market entry');
  if (err) return err;
  s.regions[id] = { entered: true, warehouse: false, day: s.day };
  notify(s, 'info', `${REGIONS[id].flag} You now sell in ${REGIONS[id].name}. Shipping from home is slow; a local warehouse converts much better.`);
  return null;
}

export function openRegionalWarehouse(s: GameState, id: RegionId): ActionResult {
  const r = s.regions[id];
  if (!r?.entered) return 'Enter the market first.';
  if (r.warehouse) return null;
  const reg = REGIONS[id];
  const err = spendOn(s, 'rent', reg.warehouseRent, undefined, `${reg.name} warehouse`);
  if (err) return err;
  r.warehouse = true;
  s.bills.push({ id: nextId(s), dueDay: s.day + 30, label: `${reg.name} warehouse`, amount: reg.warehouseRent, everyDays: 30, category: 'rent' });
  return null;
}

// ───────────────────────────── brands ─────────────────────────────

export function createBrand(s: GameState, name: string): ActionResult {
  if (s.stage < 5) return 'Multiple brands unlock at the Established stage.';
  if (!name.trim()) return 'Name the brand.';
  const err = spendOn(s, 'other', BRAND_SETUP_COST, undefined, 'Brand launches');
  if (err) return err;
  const id = Math.max(...s.brands.map((b) => b.id)) + 1;
  const b = newBrand(id, name.trim().slice(0, 28), s.day);
  b.store.modules = { ...s.brands[0].store.modules };
  b.store.launched = true;
  b.store.launchedDay = s.day;
  s.brands.push(b);
  if (s.brands.length >= 2) milestone(s, 'second_brand');
  notify(s, 'info', `🎨 ${b.name} is born, with its own store. Move products to it from the product page.`);
  return null;
}

export function assignBrand(s: GameState, pid: string, brandId: number): ActionResult {
  if (!s.brands.some((b) => b.id === brandId)) return 'Unknown brand.';
  s.products[pid].brandId = brandId;
  return null;
}

/** Brands beyond the first need a brand manager each, or they grow at half speed. */
export function brandManaged(s: GameState, brandId: number): boolean {
  if (brandId === s.brands[0].id) return true;
  const idx = s.brands.findIndex((b) => b.id === brandId);
  return idx <= s.team.brandmgr.count;
}

// ───────────────────────────── product lab ─────────────────────────────

export function labCost(levels: { materials: number; design: number; features: number }): number {
  const total = levels.materials + levels.design + levels.features;
  return 15000 + total * 10000;
}

export function labDays(s: GameState, levels: { materials: number; design: number; features: number }): number {
  const total = levels.materials + levels.design + levels.features;
  return Math.max(10, Math.round((20 + total * 10) / (1 + 0.5 * s.team.designer.count)));
}

export function startLab(s: GameState, baseId: string, levels: { materials: number; design: number; features: number }, name: string): ActionResult {
  if (s.stage < 4) return 'The Product Lab opens at the Multichannel stage.';
  if (s.lab.some((l) => !l.done)) return 'One project at a time.';
  if (!name.trim()) return 'Name your product.';
  const cost = labCost(levels);
  const err = spendOn(s, 'other', cost, undefined, 'Product Lab');
  if (err) return err;
  const days = labDays(s, levels);
  s.lab.push({ id: nextId(s), baseId, name: name.trim().slice(0, 32), levels, startDay: s.day, doneDay: s.day + days, cost, done: false });
  notify(s, 'info', `✏️ Product Lab started “${name}”. Ready in ${days} days.`);
  return null;
}

export function runLab(s: GameState): void {
  for (const l of s.lab) {
    if (l.done || s.day < l.doneDay) continue;
    l.done = true;
    const base = def(s, l.baseId) ?? CATALOG[l.baseId];
    const { materials, design, features } = l.levels;
    const id = `x${l.id}`;
    const d: ProductDef = {
      ...base,
      id,
      name: l.name,
      emoji: base.emoji,
      tagline: `Your own design. Nobody else can sell this.`,
      exclusive: true,
      baseId: base.baseId ?? base.id,
      refPrice: Math.round(base.refPrice * (1 + 0.1 * design + 0.08 * features)),
      baseCVR: base.baseCVR * (1 + 0.04 * design),
      baseUnitCost: round2(base.baseUnitCost * (1 + 0.12 * materials + 0.05 * features)),
      bars: {
        demand: Math.min(5, base.bars.demand + (features >= 3 ? 1 : 0)),
        competition: Math.max(1, base.bars.competition - 2),
        margin: Math.min(5, base.bars.margin + 1),
        lifespan: Math.max(base.bars.lifespan, 4),
      },
      trend: base.trend.kind === 'fad' ? { kind: 'evergreen' } : base.trend,
      lifespanNote: 'Exclusive, evergreen',
      appearsDay: s.day,
      unlockStage: s.stage,
      searchVolume: Math.round(base.searchVolume * (1 + 0.1 * features)),
      qualityBonus: materials * 0.04,
    };
    s.customDefs[id] = d;
    s.revealed.push(id);
    milestone(s, 'first_exclusive');
    notify(s, 'info', `✨ “${l.name}” is ready! Add it from the Trend Scanner and source it like any product.`, true);
  }
}

// ───────────────────────────── credit ─────────────────────────────

export function updateCredit(s: GameState): void {
  if (!s.credit.unlocked) return;
  s.credit.limit = Math.round((Math.max(5000, trailing(s, 30).revenue * 1.0) * mod(s, 'creditLimit')) / 1000) * 1000;
}

export function drawCredit(s: GameState, amount: number): ActionResult {
  if (!s.credit.unlocked) return 'A credit line opens up in the Growing Brand stage.';
  amount = Math.min(amount, s.credit.limit - s.credit.balance);
  if (amount <= 0) return 'Credit line maxed out.';
  s.credit.balance += amount;
  s.cash = round2(s.cash + amount);
  return null;
}

export function repayCredit(s: GameState, amount: number): ActionResult {
  amount = Math.min(amount, s.credit.balance);
  if (amount <= 0) return 'Nothing to repay.';
  const err = spendCash(s, amount);
  if (err) return err;
  s.credit.balance -= amount;
  return null;
}

export function chargeInterest(s: GameState): void {
  if (s.credit.balance > 0 && s.day % 30 === 0) {
    const i = round2(s.credit.balance * 0.015 * mod(s, 'creditRate'));
    book(s, 'interest', i, { sub: 'Credit line' });
    notify(s, 'cash', `Credit line interest: −$${i.toLocaleString()}.`);
  }
}

export function bridgeAmount(s: GameState): number {
  return Math.max(10000, Math.round((trailing(s, 30).revenue * 0.25) / 1000) * 1000);
}

/** Cash went negative: draw on credit if possible, otherwise the founder must choose how to survive. */
export function cashCrisis(s: GameState): void {
  if (s.cash >= 0) return;
  if (s.credit.unlocked && s.credit.balance < s.credit.limit) {
    const need = Math.min(s.credit.limit - s.credit.balance, Math.ceil(-s.cash + 500));
    s.credit.balance += need;
    s.cash = round2(s.cash + need);
    notify(s, 'cash', `💳 Cash ran short. Drew $${need.toLocaleString()} from your credit line automatically.`, true);
    if (s.cash >= 0) return;
  }
  if (s.events.some((e) => e.kind === 'cash-crisis')) return;
  const stock = Object.values(s.products).reduce((a, p) => a + p.inventory.costTotal, 0);
  const choices = [];
  if (!s.flags.loanUsed && s.stage <= 2 && !s.loan) choices.push({ id: 'loan', label: 'Take the family loan', hint: `+$${LOAN.amount.toLocaleString()}, repay $${LOAN.repay.toLocaleString()} in 30 days` });
  if (!s.flags.bridgeUsed && s.stage >= 2 && !s.loan) {
    const amt = bridgeAmount(s);
    choices.push({ id: 'bridge', label: 'Bridge loan from Harbor Capital', hint: `+$${amt.toLocaleString()}, repay $${Math.round(amt * 1.2).toLocaleString()} in 60 days` });
  }
  if (stock > 500) choices.push({ id: 'liquidate', label: 'Sell 30% of stock to a liquidator', hint: `+$${Math.round(stock * 0.3 * 0.4).toLocaleString()} (40% of cost)` });
  choices.push({ id: 'quit', label: 'Close the business', hint: 'See your recap' });
  if (choices.length === 1 && s.cash > -Math.max(2000, trailing(s, 30).revenue * 0.05)) return;
  s.events.push({
    id: nextId(s),
    kind: 'cash-crisis',
    day: s.day,
    title: 'You’re out of cash',
    body: `Your bank balance is $${Math.round(s.cash).toLocaleString()}${s.credit.unlocked ? ' and your credit line is maxed out' : ''}. Bills and suppliers won’t wait. How do you keep the lights on?`,
    blocking: true,
    choices,
  });
  notify(s, 'event', 'You’re out of cash', true);
}

export function resolveCashCrisis(s: GameState, choiceId: string): void {
  if (choiceId === 'loan') {
    s.cash = round2(s.cash + LOAN.amount);
    s.loan = { amount: LOAN.repay, dueDay: s.day + LOAN.days, principal: LOAN.amount, label: 'family loan' };
    s.flags.loanUsed = true;
    notify(s, 'cash', `Family loan: +$${LOAN.amount}. Repay $${LOAN.repay} on day ${s.day + LOAN.days}. Awkward dinner pending.`);
  } else if (choiceId === 'bridge') {
    const amt = bridgeAmount(s);
    s.cash = round2(s.cash + amt);
    s.loan = { amount: Math.round(amt * 1.2), dueDay: s.day + 60, principal: amt, label: 'Harbor Capital bridge loan' };
    s.flags.bridgeUsed = true;
    notify(s, 'cash', `Harbor Capital wired $${amt.toLocaleString()}. Repay $${Math.round(amt * 1.2).toLocaleString()} on day ${s.day + 60}.`);
  } else if (choiceId === 'liquidate') {
    let raised = 0;
    for (const p of Object.values(s.products)) {
      const units = Math.floor(p.inventory.onHand * 0.3);
      if (!units) continue;
      const avg = p.inventory.costTotal / p.inventory.onHand;
      const q = p.inventory.qualityTotal / p.inventory.onHand;
      p.inventory.onHand -= units;
      p.inventory.costTotal = round2(p.inventory.costTotal - avg * units);
      p.inventory.qualityTotal -= q * units;
      raised += avg * units * 0.4;
      book(s, 'cogs', avg * units * 0.6, { cash: false, sub: 'Liquidation losses' });
    }
    s.cash = round2(s.cash + raised);
    notify(s, 'cash', `A liquidator hauled away 30% of your stock for $${Math.round(raised).toLocaleString()}.`);
  } else {
    s.status = 'lost';
  }
}

// ───────────────────────────── wholesale ─────────────────────────────

export function wholesaleUnitsDue(s: GameState, pid: string): number {
  return s.wholesale.filter((w) => !w.shipped && w.productId === pid).reduce((a, w) => a + w.qty, 0);
}


export { intlFactor as intlFactorSafe } from '../economics';
