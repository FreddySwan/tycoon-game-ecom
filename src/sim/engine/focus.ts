import { FOCUS, FOCUS_ORDER, FOCUS_SLOTS, type FocusId } from '../data';
import { activeRivals, def, liveProducts, rivalScore } from '../economics';
import type { GameState } from '../types';
import { type ActionResult, notify } from './core';
import { addMod } from './events';

// The founder's week: a few focus cards per week, each a week-long effect. It's the main lever from stage 2 on,
// when founder hours stop being the constraint: what you personally pay attention to still matters.

export const weekOf = (day: number) => Math.floor((day - 1) / 7);

export function focusSlots(s: GameState): number {
  return FOCUS_SLOTS[s.stage];
}

export function availableFocus(s: GameState): FocusId[] {
  return FOCUS_ORDER.filter((id) => FOCUS[id].minStage <= s.stage && (FOCUS[id].maxStage ?? 5) >= s.stage);
}

function apply(s: GameState, picks: FocusId[]): void {
  const days = 7;
  for (const id of picks) {
    switch (id) {
      case 'ads':
        addMod(s, 'adCtr', 1.08, days, 'Focus: tune the ads');
        break;
      case 'pages':
        addMod(s, 'cvr', 1.05, days, 'Focus: polish the store');
        break;
      case 'suppliers':
        addMod(s, 'unitCost', 0.95, days, 'Focus: supplier calls');
        break;
      case 'freight':
        addMod(s, 'seaFreight', 0.85, days, 'Focus: freight shopping');
        addMod(s, 'airFreight', 0.85, days, 'Focus: freight shopping');
        break;
      case 'customers': {
        addMod(s, 'refunds', 0.8, days, 'Focus: answer every review');
        const pid = liveProducts(s)[0];
        if (pid) {
          const r = s.products[pid].reviews;
          r.count += 3;
          r.sum += 15;
          r.hist[4] += 3;
        }
        break;
      }
      case 'content':
        for (const b of s.brands) b.awareness += 250 * s.stage;
        break;
      case 'friends':
        s.story.bond.sam = Math.min(100, s.story.bond.sam + 6);
        s.story.bond.maya = Math.min(100, s.story.bond.maya + 6);
        s.story.bond.dad = Math.min(100, s.story.bond.dad + 3);
        break;
      case 'repeat':
        addMod(s, 'repeat', 1.15, days, 'Focus: win back customers');
        break;
      case 'ops':
        addMod(s, 'packRate', 1.15, days, 'Focus: fix the packing line');
        break;
      case 'team':
        for (const t of Object.values(s.team)) t.morale = Math.min(100, t.morale + 12);
        break;
      case 'investors':
        s.funding = { raised: s.funding?.raised ?? [], interest: Math.min(100, (s.funding?.interest ?? 0) + 25), board: s.funding?.board };
        break;
      case 'rivals': {
        const cats = [...new Set(liveProducts(s).map((p) => def(s, p).category))];
        const strongest = cats.flatMap((c) => activeRivals(s, c)).sort((a, b) => rivalScore(s, b) - rivalScore(s, a))[0];
        if (strongest) strongest.strength = Math.max(0.3, strongest.strength * 0.92);
        break;
      }
      case 'retail':
        s.counters.retailPitchUntil = s.day + 14;
        break;
    }
  }
}

/** Set this week's focus. Effects start right away and last 7 days; you can set it once per week. */
export function setFocus(s: GameState, picks: FocusId[]): ActionResult {
  const week = weekOf(s.day);
  if (s.focus?.week === week) return 'This week’s focus is set. You can change it next week.';
  const allowed = availableFocus(s);
  const unique = [...new Set(picks)].filter((p) => allowed.includes(p));
  if (!unique.length) return 'Pick at least one focus.';
  if (unique.length > focusSlots(s)) return `You can focus on ${focusSlots(s)} things a week.`;
  s.focus = { week, picks: unique };
  apply(s, unique);
  return null;
}

/** New week: last week's focus carries over unless you change it. */
export function focusWeek(s: GameState): void {
  if (!s.focus || weekOf(s.day) === s.focus.week) return;
  const allowed = availableFocus(s);
  const picks = (s.focus.picks as FocusId[]).filter((p) => allowed.includes(p)).slice(0, focusSlots(s));
  s.focus = { week: weekOf(s.day), picks };
  apply(s, picks);
  if (picks.length) notify(s, 'info', `New week: you’re focusing on ${picks.map((p) => FOCUS[p].name.toLowerCase()).join(', ')} again. Change it from the week planner.`);
}
