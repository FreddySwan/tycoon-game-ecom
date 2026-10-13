import { BATCH_UNLOCK_AFTER, FRIEND_HELP, HOURS, PACKAGING_COST, PACKER_RATE, ROLES, SPACES, THANK_YOU_COST, THIRD_PARTY, TILE_COST } from '../data';
import { brandOf, def, intlExtraCost, mod, packHours, round2, seatsUsed, stockQuality, storageCapacity, storageUsed } from '../economics';
import type { BacklogBucket, CardChoice, CustomerCard, GameState, RoleId, TileId } from '../types';
import { type ActionResult, book, milestone, notify, slice, spendOn, useHours } from './core';
import { rollTrait } from './people';
import { applyCardChoice } from './reviews';

// ───────────────────────────── shipping ─────────────────────────────

/** Ship `n` orders out of a backlog bucket: pay postage and packaging, schedule delivery. */
export function shipFromBucket(s: GameState, b: BacklogBucket, n: number): void {
  if (n <= 0) return;
  const d = def(s, b.productId);
  const brand = brandOf(s, b.productId);
  const share = n / b.orders;
  const units = b.units * share;
  const intl = b.intl * share;
  const perOrder = d.shipToCustomer * (units / n > 1.5 ? 1.25 : 1) * mod(s, 'shipping') + PACKAGING_COST[brand.packaging] * mod(s, 'packaging') + (brand.thankYouCard ? THANK_YOU_COST : 0);
  const tpl = s.thirdParty ? n * THIRD_PARTY.perOrder : 0;
  const cost = n * perOrder + tpl + intl * intlExtraCost(s, b.productId);
  book(s, 'fulfillment', cost - tpl, { brandId: brand.id, productId: b.productId, channel: b.channel });
  if (tpl) {
    book(s, 'fulfillment', tpl, { brandId: brand.id, productId: b.productId, channel: b.channel, sub: '3PL handling' });
    slice(s, b.productId, b.channel, 'thirdParty', tpl);
  }
  s.shipped += n;
  s.deliveries.push({
    dueDay: s.day + 4 + (intl > 0 ? 2 : 0),
    productId: b.productId,
    channel: b.channel,
    orders: n,
    revenue: b.revenue * share,
    quality: stockQuality(s, b.productId),
    delayDays: s.day - b.day,
    damageRate: s.thirdParty ? 0.02 : 0,
  });
  b.orders -= n;
  b.units -= units;
  b.revenue -= b.revenue * share;
  b.intl -= intl;
  if (s.shipped >= 1000) milestone(s, 'orders_1k');
  if (s.shipped >= 10000) milestone(s, 'orders_10k');
}

export function nextHandPack(s: GameState): BacklogBucket | undefined {
  return s.backlog.find((b) => b.orders > 0 && b.channel !== 'bazaarly');
}

export function handPack(s: GameState): ActionResult {
  const b = nextHandPack(s);
  if (!b) return 'Nothing to pack.';
  const err = useHours(s, packHours(s));
  if (err) return err;
  shipFromBucket(s, b, 1);
  s.backlog = s.backlog.filter((x) => x.orders > 0.001);
  s.handPacked++;
  if (!s.batchPacking && s.handPacked >= BATCH_UNLOCK_AFTER) {
    s.batchPacking = true;
    milestone(s, 'batch_packing');
  }
  return null;
}

export function callFriend(s: GameState): ActionResult {
  if (s.extraHours > 0) return 'Your friend is already helping today.';
  const err = spendOn(s, 'payroll', FRIEND_HELP.cost, undefined, 'Temp help');
  if (err) return err;
  s.extraHours = FRIEND_HELP.hours;
  return null;
}

// ───────────────────────────── team ─────────────────────────────

export const RECRUIT_FEE = 500;

export function seatLimit(s: GameState, seat: 'floor' | 'office'): number {
  const sp = SPACES[s.space];
  return seat === 'floor' ? sp.floorSeats : sp.officeSeats;
}

export function hire(s: GameState, role: RoleId, n = 1): ActionResult {
  const r = ROLES[role];
  if (s.stage < r.unlockStage) return `${r.name}s unlock at stage ${r.unlockStage}.`;
  if (role === 'lead' && s.space === 'garage') return 'A warehouse lead needs a warehouse.';
  if (seatsUsed(s, r.seat) + n > seatLimit(s, r.seat)) return `No ${r.seat === 'floor' ? 'floor space' : 'desks'} left. A bigger space fits more people.`;
  const err = spendOn(s, 'other', RECRUIT_FEE * n, undefined, 'Recruiting');
  if (err) return err;
  const t = s.team[role];
  if (t.count === 0 && !s.people.some((p) => p.role === role)) {
    const name = role === 'lead' && s.people.some((p) => p.name === 'Jordan') ? 'Priya Shah' : r.firstName;
    s.people.push({ role, name, hiredDay: s.day, morale: 75, promoted: false, trait: rollTrait(s) });
    notify(s, 'team', `${r.emoji} ${name} joined as your first ${r.name.toLowerCase()}${name === 'Jordan' ? ', with two coffees' : ''}.`, true);
  }
  t.morale = Math.round((t.morale * t.count + 75 * n) / (t.count + n));
  t.count += n;
  milestone(s, 'first_hire');
  return null;
}

export function fire(s: GameState, role: RoleId, n = 1): ActionResult {
  const t = s.team[role];
  if (t.count < n) return 'Not that many people in this team.';
  const severance = round2((ROLES[role].wage * t.wageMult * n) / 2);
  book(s, 'payroll', severance, { sub: 'Severance' });
  t.count -= n;
  t.morale = Math.max(0, t.morale - 8);
  if (t.count === 0) s.people = s.people.filter((p) => p.role !== role);
  if (role === 'lead' && t.count === 0) s.shifts = 1;
  return null;
}

export function giveRaise(s: GameState, role: RoleId): ActionResult {
  const t = s.team[role];
  if (!t.count) return 'Nobody to give a raise to.';
  const last = s.counters[`raise-${role}`];
  if (last !== undefined && s.day - last < 60) return `You gave ${ROLES[role].name.toLowerCase()}s a raise on day ${last}. Next one possible on day ${last + 60}.`;
  s.counters[`raise-${role}`] = s.day;
  t.wageMult = round2(t.wageMult * 1.1);
  t.morale = Math.min(100, t.morale + 20);
  for (const p of s.people) if (p.role === role) p.morale = Math.min(100, p.morale + 20);
  notify(s, 'team', `${ROLES[role].name}s got a 10% raise. Morale up.`);
  return null;
}

export function promoteToLead(s: GameState): ActionResult {
  const jordan = s.people.find((p) => p.role === 'packer');
  if (!jordan) return 'Hire a packer first.';
  if (s.stage < 3) return 'Leads make sense once you run a warehouse.';
  if (s.team.lead.count) return 'You already have a lead.';
  jordan.role = 'lead';
  jordan.promoted = true;
  jordan.morale = 100;
  s.team.packer.count -= 1;
  s.team.lead.count += 1;
  notify(s, 'team', `🦺 ${jordan.name} is now your warehouse lead. They remember packing boxes in your kitchen.`, true);
  return null;
}

export function setShifts(s: GameState, shifts: 1 | 2): ActionResult {
  if (shifts === 2 && !s.team.lead.count) return 'A second shift needs a warehouse lead.';
  if (shifts === 2 && s.stage < 3) return 'Shifts need a warehouse.';
  s.shifts = shifts;
  return null;
}

export function setThirdParty(s: GameState, on: boolean): ActionResult {
  if (on && s.stage < 2) return '3PL partners want a bit more volume first.';
  s.thirdParty = on;
  notify(s, 'info', on ? '🚚 A 3PL now stores and ships your orders: $3.40 an order, no packing limits.' : 'Fulfillment is back in-house.');
  return null;
}

export function setSupport(s: GameState, patch: Partial<GameState['support']>): void {
  Object.assign(s.support, patch);
}

// ───────────────────────────── warehouse layout ─────────────────────────────

export function dockIndex(s: GameState): number {
  return (s.layout.h - 1) * s.layout.w + Math.floor(s.layout.w / 2);
}

export function initLayout(s: GameState): void {
  const grid = SPACES[s.space].grid;
  if (!grid) return;
  const [w, h] = grid;
  const old = s.layout;
  const cells: (TileId | null)[] = Array(w * h).fill(null);
  // Carry the old layout over, top-left aligned.
  for (let y = 0; y < old.h; y++) for (let x = 0; x < old.w; x++) if (x < w && y < h) cells[y * w + x] = old.cells[y * old.w + x];
  s.layout = { w, h, cells };
  if (!old.w) {
    // A sensible starter layout: a row of racks and three stations near the dock.
    for (let x = 1; x < 5; x++) cells[1 * w + x] = 'rack';
    for (let x = 4; x < 7; x++) cells[(h - 3) * w + x] = 'station';
  }
}

export function placeTile(s: GameState, x: number, y: number, tile: TileId | null): ActionResult {
  const { w, h, cells } = s.layout;
  if (!w) return 'You need a warehouse to lay out.';
  if (x < 0 || y < 0 || x >= w || y >= h) return 'Outside the building.';
  const i = y * w + x;
  if (i === dockIndex(s)) return 'That’s the loading dock.';
  const current = cells[i];
  if (current === tile) return null;
  if (tile === 'robot' && s.stage < 5) return 'Robot pickers unlock at the Established stage.';
  if (tile) {
    const err = spendOn(s, 'other', TILE_COST[tile], undefined, 'Warehouse build-out');
    if (err) return err;
  }
  if (current) {
    const refund = TILE_COST[current] * 0.5;
    s.cash = round2(s.cash + refund);
    book(s, 'other', -refund, { cash: false, sub: 'Warehouse build-out' });
  }
  cells[i] = tile;
  return null;
}

export const AUTOMATION = {
  labelPrinter: { name: 'Thermal label printers', cost: 5000, stage: 3, desc: '+10% packing speed.' },
  scanners: { name: 'Barcode scanners & WMS', cost: 12000, stage: 4, desc: '+10% packing speed, fewer wrong items.' },
} as const;

export function buyAutomation(s: GameState, key: keyof typeof AUTOMATION): ActionResult {
  const a = AUTOMATION[key];
  if (s.automation[key]) return null;
  if (s.stage < a.stage) return `Unlocks at stage ${a.stage}.`;
  const err = spendOn(s, 'other', a.cost, undefined, 'Automation');
  if (err) return err;
  s.automation[key] = true;
  return null;
}

// ───────────────────────────── customer cards (hands-on support) ─────────────────────────────

const REFUND: CardChoice = { id: 'refund', label: 'Full refund', hint: 'Costs the sale, keeps them happy' };
const REPLACE: CardChoice = { id: 'replace', label: 'Send a replacement', hint: 'Costs a unit + shipping, wins loyalty' };

export function cardChoices(kind: CustomerCard['kind']): CardChoice[] {
  if (kind === 'damaged') return [REFUND, REPLACE, { id: 'photo', label: 'Ask for a photo first', hint: 'Free, but they may get annoyed' }];
  if (kind === 'defect') return [REFUND, REPLACE, { id: 'partial', label: 'Offer 50% back', hint: 'Cheaper, they keep it' }];
  return [
    { id: 'code', label: 'Apologize + 15% code', hint: 'Small cost, saves the review' },
    { id: 'template', label: 'Send a template reply', hint: 'Free, risky' },
  ];
}

export function refund(s: GameState, amount: number, brandId?: number, productId?: string): void {
  book(s, 'refunds', amount, { brandId, productId });
}

export function resolveCard(s: GameState, cardId: number, choiceId: string): ActionResult {
  const card = s.cards.find((c) => c.id === cardId);
  if (!card) return 'Card already handled.';
  const err = useHours(s, HOURS.card);
  if (err) return err;
  s.cards = s.cards.filter((c) => c.id !== cardId);
  applyCardChoice(s, card, choiceId);
  return null;
}

export function templatesUnlocked(s: GameState): boolean {
  return s.stage >= 2 || !!s.milestones.first_profitable_reorder;
}

export function setTemplate(s: GameState, kind: CustomerCard['kind'], choiceId: string | null): ActionResult {
  if (!templatesUnlocked(s)) return 'Reply templates unlock after your first profitable reorder.';
  const t = (s.support.templates ??= {});
  if (choiceId) t[kind] = choiceId;
  else delete t[kind];
  return null;
}

export function setOutsource(s: GameState, on: boolean): ActionResult {
  if (on && !templatesUnlocked(s)) return 'Outsourcing unlocks after your first profitable reorder.';
  s.support.outsource = on;
  return null;
}

// ───────────────────────────── warehouse lead autopilot ─────────────────────────────

export function setAutopilot(s: GameState, patch: Partial<GameState['autopilot']>): ActionResult {
  if ((patch.staffing || patch.buildout) && !s.team.lead.count) return 'Hire or promote a warehouse lead first. They run the floor.';
  Object.assign(s.autopilot, patch);
  return null;
}

/** Packers needed to cover recent own-shipped demand with a 25% buffer. */
export function packersNeeded(s: GameState): number {
  const recent = s.history.slice(-14);
  const pace = recent.length ? recent.reduce((a, r) => a + (r.ownOrders ?? r.orders), 0) / recent.length : 0;
  const robots = s.layout.cells.filter((c) => c === 'robot').length * 110;
  return Math.max(0, Math.ceil((pace * 1.25 - robots) / (PACKER_RATE * 1.1)));
}

function freeCells(s: GameState): number[] {
  const out: number[] = [];
  s.layout.cells.forEach((c, i) => !c && i !== dockIndex(s) && out.push(i));
  return out;
}

/** The warehouse lead keeps the floor sized to demand: hires and lets go, adds stations and racks, runs shifts. */
export function leadPass(s: GameState): void {
  if (!s.team.lead.count || s.thirdParty) return;
  const ap = s.autopilot;
  if (!ap.staffing && !ap.buildout) return;
  const lead = s.people.find((p) => p.role === 'lead')?.name ?? 'Your lead';
  const notes: string[] = [];
  const need = packersNeeded(s);
  const stations = s.layout.cells.filter((c) => c === 'station').length;
  const { w, h } = s.layout;
  if (ap.buildout && w) {
    const want = Math.ceil(need / (s.shifts === 2 ? 2 : 1)) - stations;
    let added = 0;
    for (let k = 0; k < Math.min(want, 4); k++) {
      const free = freeCells(s).filter((i) => Math.floor(i / w) >= Math.floor(h / 2));
      const best = free.sort((a, b) => Math.abs((a % w) - w / 2) + Math.abs(Math.floor(a / w) - h) - (Math.abs((b % w) - w / 2) + Math.abs(Math.floor(b / w) - h)))[0];
      if (best === undefined || s.cash < TILE_COST.station + 5000) break;
      if (!placeTile(s, best % w, Math.floor(best / w), 'station')) added++;
    }
    if (added) notes.push(`built ${added} packing station${added > 1 ? 's' : ''}`);
    if (storageUsed(s) > storageCapacity(s) * 0.85) {
      const free = freeCells(s).filter((i) => Math.floor(i / w) < Math.floor(h / 2));
      const spot = free[0];
      if (spot !== undefined && s.cash > TILE_COST.rack + 5000 && !placeTile(s, spot % w, Math.floor(spot / w), 'rack')) notes.push('added a storage rack');
    }
  }
  if (ap.staffing) {
    const slots = s.layout.cells.filter((c) => c === 'station').length * (s.shifts === 2 ? 2 : 1);
    if (need > slots && s.shifts === 1 && slots > 0) {
      s.shifts = 2;
      notes.push('started a second shift');
    }
    const maxUseful = s.layout.cells.filter((c) => c === 'station').length * s.shifts;
    const target = Math.min(need, maxUseful);
    const have = s.team.packer.count;
    if (target > have) {
      const n = target - have;
      if (!hire(s, 'packer', n)) notes.push(`hired ${n} packer${n > 1 ? 's' : ''}`);
    } else if (have > Math.max(1, Math.ceil(need * 1.4))) {
      const n = have - Math.max(1, Math.ceil(need * 1.15));
      if (n > 0 && !fire(s, 'packer', n)) notes.push(`let ${n} packer${n > 1 ? 's' : ''} go`);
    }
    if (s.team.lead.count * 15 < s.team.packer.count && !hire(s, 'lead')) notes.push('promoted a shift lead');
  }
  if (notes.length) notify(s, 'team', `🦺 ${lead}: ${notes.join(', ')}.`);
}
