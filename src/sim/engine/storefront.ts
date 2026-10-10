import { MODULES, STORE_SUBSCRIPTION } from '../data';
import { def, round2 } from '../economics';
import type { Brand, GameState, ModuleId, Packaging, PhotoChoice } from '../types';
import { HOURS } from '../data';
import { type ActionResult, milestone, nextId, spendOn, useHours } from './core';

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
    const err = spendOn(s, 'other', cost, b.id);
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

export function scorePhoto(s: GameState, pid: string, choice: PhotoChoice): number {
  const best = def(s, pid).bestPhoto;
  let score = 1;
  if (choice.backdrop === best.backdrop) score += 1;
  if (choice.light === best.light) score += 1;
  else if (choice.light !== 'overhead') score += 0.5;
  if (choice.prop === best.prop) score += 1;
  if (choice.angle === best.angle) score += 1;
  else if (choice.angle !== 'top') score += 0.25;
  return Math.max(1, Math.min(5, Math.round(score)));
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
  const err = spendOn(s, 'other', 400, s.products[pid].brandId);
  if (err) return err;
  const p = s.products[pid];
  p.photoStars = 5;
  p.photo = { ...def(s, pid).bestPhoto };
  return null;
}

export function launchProblems(s: GameState, brandId: number): string[] {
  const b = brand(s, brandId);
  const out: string[] = [];
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
  const err = spendOn(s, 'rent', STORE_SUBSCRIPTION, b.id);
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

export function setBrandOps(s: GameState, brandId: number, patch: Partial<{ packaging: Packaging; thankYouCard: boolean; freeShipping: boolean }>): ActionResult {
  if (patch.packaging === 'branded' && s.stage < 2) return 'Branded packaging unlocks in the Growing Brand stage.';
  Object.assign(brand(s, brandId), patch);
  return null;
}
