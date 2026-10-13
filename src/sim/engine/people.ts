import { ROLES } from '../data';
import { pick } from '../rng';
import type { GameState, ModKey, Person, RoleId, Trait } from '../types';
import { notify } from './core';

// Key people have a trait that changes how their department performs. Friends who join (Sam, Maya) are loyal.

export const TRAITS: Record<Trait, { label: string; desc: string }> = {
  frugal: { label: 'Frugal', desc: 'Watches every dollar' },
  creative: { label: 'Creative', desc: 'Fresh ideas, better work' },
  steady: { label: 'Steady', desc: 'Calm, keeps the team together' },
  ambitious: { label: 'Ambitious', desc: 'Pushes hard, expects to grow' },
  loyal: { label: 'Loyal', desc: 'Here because of you, not the paycheck' },
};

/** What each trait does in each role, as multipliers on the game's modifier keys. */
const EFFECTS: Partial<Record<RoleId, Partial<Record<Trait, Partial<Record<ModKey, number>>>>>> = {
  marketer: { creative: { adCtr: 1.06 }, frugal: { adCost: 0.95 }, ambitious: { adCtr: 1.04, cvr: 1.02 } },
  buyer: { frugal: { unitCost: 0.97 }, steady: { quality: 1.03 } },
  lead: { steady: { refunds: 0.95 }, ambitious: { packRate: 1.08 }, loyal: { packRate: 1.05 } },
  packer: { loyal: { packRate: 1.05 }, ambitious: { packRate: 1.04 } },
  support: { steady: { refunds: 0.93 }, creative: { repeat: 1.05 } },
  designer: { creative: { cvr: 1.04 }, loyal: { cvr: 1.03 } },
};

export function traitMult(s: GameState, key: ModKey): number {
  let m = 1;
  for (const p of s.people ?? []) if (p.trait) m *= EFFECTS[p.role]?.[p.trait]?.[key] ?? 1;
  return m;
}

export function traitEffect(p: Person): string {
  const e = p.trait ? EFFECTS[p.role]?.[p.trait] : undefined;
  if (!e) return p.trait ? TRAITS[p.trait].desc : '';
  const names: Partial<Record<ModKey, string>> = { adCtr: 'ad clicks', adCost: 'ad costs', unitCost: 'unit costs', quality: 'stock quality', refunds: 'refunds', packRate: 'packing speed', repeat: 'repeat orders', cvr: 'conversion' };
  return Object.entries(e)
    .map(([k, v]) => `${names[k as ModKey]} ${(v as number) > 1 ? '+' : '−'}${Math.round(Math.abs((v as number) - 1) * 100)}%`)
    .join(', ');
}

export function rollTrait(s: GameState): Trait {
  return pick(s, ['frugal', 'creative', 'steady', 'ambitious'] as Trait[]);
}

/** A friend joins the company (from a story choice). */
export function hireFriend(s: GameState, who: 'sam' | 'maya'): void {
  const role: RoleId = who === 'sam' ? 'packer' : 'designer';
  s.team[role].count += 1;
  s.team[role].morale = Math.max(s.team[role].morale, 85);
  s.people.push({ role, name: who === 'sam' ? 'Sam' : 'Maya', hiredDay: s.day, morale: 95, promoted: false, trait: 'loyal', friend: who });
  notify(s, 'team', `${who === 'sam' ? 'Sam' : 'Maya'} joined the company as your ${ROLES[role].name.toLowerCase()}.`, true);
}

/** Loyal friends keep morale up; ambitious people get restless without raises. */
export function peopleDay(s: GameState): void {
  for (const p of s.people ?? []) {
    if (p.trait === 'loyal') p.morale = Math.max(60, p.morale);
    if (p.trait === 'ambitious' && s.day - p.hiredDay > 0 && (s.day - p.hiredDay) % 120 === 0 && (s.counters[`raise-${p.role}`] ?? -999) < s.day - 120) {
      p.morale = Math.max(0, p.morale - 15);
      notify(s, 'team', `${p.name} (${ROLES[p.role].name.toLowerCase()}) wants a raise or a bigger role. Morale is slipping.`);
    }
  }
}
