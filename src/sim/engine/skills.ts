import { SKILLS, STUDY_SESSION } from '../data';
import { hasSkill, hoursLeft } from '../economics';
import type { GameState, SkillId } from '../types';
import { type ActionResult, nextId, notify, spendOn } from './core';

/** Buy a course, start a software subscription or buy gear. Courses still need studying (founder hours). */
export function buySkill(s: GameState, id: SkillId): ActionResult {
  const d = SKILLS[id];
  const cur = s.skills[id];
  if (cur && (d.kind !== 'software' || cur.active)) return d.kind === 'course' && !hasSkill(s, id) ? 'Already bought: study it to finish.' : 'You already have this.';
  const missing = (d.requires ?? []).find((r) => !hasSkill(s, r));
  if (missing) return `Finish ${SKILLS[missing].name} first.`;
  const err = spendOn(s, 'other', d.cost, undefined, d.kind === 'software' ? 'Software' : d.kind === 'course' ? 'Courses' : 'Equipment');
  if (err) return err;
  s.skills[id] = { progress: cur?.progress ?? 0, active: d.kind === 'software' ? true : undefined };
  if (d.kind === 'software' && d.monthly) {
    s.bills.push({ id: nextId(s), dueDay: s.day + 30, label: d.name, amount: d.monthly, everyDays: 30, category: 'other' });
  }
  if (d.kind === 'course') notify(s, 'info', `Enrolled in ${d.name}. Study it in SkillUp (${d.hours}h total).`);
  return null;
}

/** Spend up to one study session of founder hours on a course. */
export function studySkill(s: GameState, id: SkillId): ActionResult {
  const d = SKILLS[id];
  const cur = s.skills[id];
  if (d.kind !== 'course' || !cur) return 'Buy the course first.';
  const left = (d.hours ?? 0) - cur.progress;
  if (left <= 0) return 'Already finished.';
  const h = Math.min(STUDY_SESSION, left, Math.floor(hoursLeft(s) * 2) / 2);
  if (h <= 0) return 'You’re out of founder hours today. Study tomorrow.';
  s.hoursUsed += h;
  cur.progress += h;
  if (cur.progress >= (d.hours ?? 0)) notify(s, 'milestone', `🎓 Finished ${d.name}: ${d.effect}`);
  return null;
}

export function cancelSkill(s: GameState, id: SkillId): ActionResult {
  const d = SKILLS[id];
  const cur = s.skills[id];
  if (d.kind !== 'software' || !cur?.active) return null;
  cur.active = false;
  s.bills = s.bills.filter((b) => b.label !== d.name);
  return null;
}
