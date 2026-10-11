import { MODULES, packScore, STORE_SUBSCRIPTION } from '../data';
import { def, hasSkill, round2 } from '../economics';
import type { Brand, GameState, ModuleId, PackDesign, Packaging, PhotoChoice, Vibe } from '../types';
import { HOURS } from '../data';
import { type ActionResult, milestone, nextId, notify, spendOn, useHours } from './core';

function brand(s: GameState, brandId: number): Brand {
  return s.brands.find((b) => b.id === brandId) ?? s.brands[0];
}

export function setModule(s: GameState, brandId: number, id: ModuleId, tier: number): ActionResult {
  const b = brand(s, brandId);
  const d = MODULES.find((m) => m.id === id)!;
  if (tier < 0 || tier > d.tiers.length) return 'Invalid tier.';
  const current = b.store.modules[id];
  if (tier === 0 && d.required && b.store.launched) return `Your live store needs a ${d.name}.`;
  if (tier > current) {
    let cost = 0;
    for (let t = current + 1; t <= tier; t++) if (!s.flags[`bought-${b.id}-${id}-${t}`]) cost += d.tiers[t - 1].cost;
    const err = spendOn(s, 'other', cost, b.id, 'Store upgrades');
    if (err) return err;
    for (let t = current + 1; t <= tier; t++) s.flags[`bought-${b.id}-${id}-${t}`] = true;
  }
  b.store.modules[id] = tier;
  return null;
}

export function toggleBenefit(s: GameState, pid: string, id: string): ActionResult {
  const p = s.products[pid];
  if (p.benefits.includes(id)) {
    p.benefits = p.benefits.filter((x) => x !== id);
    return null;
  }
  if (p.benefits.length >= 3) return 'Pick at most 3 benefits. Focus sells.';
  p.benefits.push(id);
  return null;
}

export function setBrandName(s: GameState, brandId: number, name: string): void {
  brand(s, brandId).name = name.slice(0, 28);
}

/** Composition 0..1: product on a rule-of-thirds point (or dead centre) and filling the frame nicely. */
export function compositionScore(choice: PhotoChoice): number {
  const x = choice.x ?? 0.5;
  const y = choice.y ?? 0.5;
  const zoom = choice.zoom ?? 1;
  const points = [
    [1 / 3, 1 / 3],
    [2 / 3, 1 / 3],
    [1 / 3, 2 / 3],
    [2 / 3, 2 / 3],
  ];
  const thirds = Math.min(...points.map(([px, py]) => Math.hypot(px - x, py - y)));
  const centre = Math.hypot(0.5 - x, 0.5 - y) + 0.06;
  const placement = Math.max(0, 1 - Math.min(thirds, centre) / 0.22);
  const fill = Math.max(0, 1 - Math.abs(zoom - 1.3) / 0.7);
  return placement * 0.6 + fill * 0.4;
}

export function scorePhoto(s: GameState, pid: string, choice: PhotoChoice): number {
  const best = def(s, pid).bestPhoto;
  let raw = 1;
  if (choice.backdrop === best.backdrop) raw += 1;
  if (choice.light === best.light) raw += 1;
  else if (choice.light !== 'overhead') raw += 0.5;
  if (choice.prop === best.prop) raw += 1;
  if (choice.angle === best.angle) raw += 1;
  else if (choice.angle !== 'top') raw += 0.25;
  const course = hasSkill(s, 'photography') ? 1 : 0;
  return Math.max(1, Math.min(5, Math.round(1 + (raw - 1) * 0.8 + compositionScore(choice) * 1.1) + course));
}

export function canShoot(s: GameState, pid: string): boolean {
  return s.samples.some((x) => x.productId === pid && x.arrived) || s.products[pid].inventory.onHand > 0;
}

export function takePhoto(s: GameState, pid: string, choice: PhotoChoice): ActionResult {
  if (!canShoot(s, pid)) return 'You need a sample or stock to photograph.';
  const err = useHours(s, HOURS.photoShoot);
  if (err) return err;
  const p = s.products[pid];
  const stars = scorePhoto(s, pid, choice);
  if (stars >= p.photoStars) {
    p.photoStars = stars;
    p.photo = choice;
  }
  return null;
}

/** Pay a pro photographer instead of spending founder hours (always 5★). */
export function hirePhotographer(s: GameState, pid: string): ActionResult {
  if (s.stage < 2) return 'Pro photographers book bigger clients. Grow first.';
  const err = spendOn(s, 'other', 400, s.products[pid].brandId, 'Photography');
  if (err) return err;
  const p = s.products[pid];
  p.photoStars = 5;
  p.photo = { ...def(s, pid).bestPhoto };
  return null;
}

export const STORE_BUILD_DAYS = 2;

/** Quality from the store-builder mini-game (0..5 right calls), plus the store course. */
export function storeQualityFrom(s: GameState, score: number): number {
  return Math.min(1, 0.3 + 0.14 * score + (hasSkill(s, 'storeCourse') ? 0.1 : 0));
}

/** Finish building the store pages. They take a couple of days to set up before you can launch. */
export function completeStoreBuild(s: GameState, brandId: number, score: number): ActionResult {
  const b = brand(s, brandId);
  const err = useHours(s, HOURS.storeBuild);
  if (err) return err;
  const quality = storeQualityFrom(s, score);
  const first = b.store.quality == null;
  b.store.quality = first ? quality : Math.max(b.store.quality ?? 0, quality);
  if (!b.store.launched) b.store.readyDay = s.day + STORE_BUILD_DAYS;
  notify(s, 'info', b.store.launched ? `🛍️ Store pages rebuilt: quality ${Math.round((b.store.quality ?? 0) * 100)}%.` : `🛍️ Store pages designed (quality ${Math.round(quality * 100)}%). Setup takes ${STORE_BUILD_DAYS} days.`);
  return null;
}

export function launchProblems(s: GameState, brandId: number): string[] {
  const b = brand(s, brandId);
  const out: string[] = [];
  if (b.store.quality == null) out.push('Build your store pages in the Store builder');
  else if ((b.store.readyDay ?? 0) > s.day) out.push(`Your store is still being set up (ready in ${(b.store.readyDay ?? 0) - s.day} day${(b.store.readyDay ?? 0) - s.day === 1 ? '' : 's'})`);
  const pids = Object.keys(s.products).filter((id) => s.products[id].brandId === b.id);
  if (!pids.length) out.push('Pick a product');
  if (!pids.some((id) => s.products[id].photo)) out.push('Take a product photo');
  for (const m of MODULES) if (m.required && !b.store.modules[m.id]) out.push(`Add ${m.name}`);
  if (!pids.some((id) => s.products[id].benefits.length)) out.push('Choose at least one benefit for the description');
  if (!b.name.trim()) out.push('Name your brand');
  return out;
}

export function launchStore(s: GameState, brandId: number): ActionResult {
  const b = brand(s, brandId);
  if (b.store.launched) return null;
  const problems = launchProblems(s, brandId);
  if (problems.length) return problems[0];
  const err = spendOn(s, 'rent', STORE_SUBSCRIPTION, b.id, 'ShopBloc plan');
  if (err) return err;
  b.store.launched = true;
  b.store.launchedDay = s.day;
  s.bills.push({ id: nextId(s), dueDay: s.day + 30, label: `ShopBloc plan (${b.name})`, amount: STORE_SUBSCRIPTION, everyDays: 30, category: 'rent' });
  milestone(s, 'store_launched');
  return null;
}

/** A product is for sale in its brand's store once the store is live and its page has a photo and copy. */
export function onStore(s: GameState, pid: string): boolean {
  const p = s.products[pid];
  const b = brand(s, p.brandId);
  return b.store.launched && !!p.photo && p.benefits.length > 0 && !p.retired;
}

export function setOffer(s: GameState, pid: string, patch: Partial<{ price: number; bundle: boolean; discountPct: number }>): void {
  const p = s.products[pid];
  Object.assign(p, patch);
  p.price = Math.max(3, Math.min(499, round2(p.price)));
}

export function setPackDesign(s: GameState, brandId: number, design: PackDesign): ActionResult {
  const b = brand(s, brandId);
  const pids = Object.keys(s.products).filter((id) => s.products[id].brandId === b.id);
  const cat = pids.length ? def(s, pids[0]).category : 'pets';
  b.packDesign = design;
  b.packScore = packScore(design, cat);
  return null;
}

export function setStoreLayout(s: GameState, brandId: number, order: ModuleId[], theme?: Vibe): ActionResult {
  const b = brand(s, brandId);
  b.store.order = order;
  if (theme) b.theme = theme;
  return null;
}

export function setBrandOps(s: GameState, brandId: number, patch: Partial<{ packaging: Packaging; thankYouCard: boolean; freeShipping: boolean }>): ActionResult {
  if (patch.packaging === 'branded' && s.stage < 2) return 'Branded packaging unlocks in the Growing Brand stage.';
  Object.assign(brand(s, brandId), patch);
  return null;
}
