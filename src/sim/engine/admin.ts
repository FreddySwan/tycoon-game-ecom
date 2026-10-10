import { CATALOG } from '../data';
import type { GameState, StageId } from '../types';
import { advanceStage } from './company';
import type { ActionResult } from './core';
import { advanceDay, isBlocked } from './tick';

// Admin mode: testing cheats. Cash added here is deliberately not booked, so the P&L still shows the real business.

export const ADMIN_CASH_FLOOR = 1_000_000;

export function adminTopUp(s: GameState): void {
  if (s.flags.adminCash && s.cash < ADMIN_CASH_FLOOR) s.cash = ADMIN_CASH_FLOOR;
}

export function adminAddCash(s: GameState, amount: number): ActionResult {
  s.cash += amount;
  return null;
}

export function adminToggle(s: GameState, flag: 'adminCash' | 'adminHours'): ActionResult {
  s.flags[flag] = !s.flags[flag];
  adminTopUp(s);
  return null;
}

export function adminSkipDays(s: GameState, days: number): ActionResult {
  for (let k = 0; k < days; k++) {
    if (isBlocked(s)) return k ? null : 'Something needs your decision first.';
    advanceDay(s);
  }
  return null;
}

export function adminRevealAll(s: GameState): ActionResult {
  for (const id of Object.keys(CATALOG)) if (!s.revealed.includes(id)) s.revealed.push(id);
  return null;
}

/** Unlock stages on the current save, skipping requirements and deposits. */
export function adminForceStage(s: GameState, stage: StageId): ActionResult {
  if (stage <= s.stage) return `Already at stage ${s.stage}.`;
  while (s.stage < stage) {
    const err = advanceStage(s, true);
    if (err) return err;
  }
  return null;
}
