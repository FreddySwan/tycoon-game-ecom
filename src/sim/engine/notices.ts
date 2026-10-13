import type { Notice } from '../types';

// Notification triage: only decisions stop the clock by default. Everything else lands in the feed and the
// daily digest, unless the player opts in to pausing on it.

export type NoticeCategory = 'decision' | 'milestone' | 'report' | 'stock' | 'delivery' | 'ambient';

export type PauseSettings = Record<Exclude<NoticeCategory, 'ambient' | 'decision'>, boolean>;

export const DEFAULT_PAUSES: PauseSettings = { milestone: true, report: true, stock: true, delivery: false };

export const PAUSE_LABELS: Record<keyof PauseSettings, string> = {
  milestone: 'Milestones and story chapters',
  report: 'Monthly reports',
  stock: 'Running out of stock',
  delivery: 'Deliveries arriving',
};

export function noticeCategory(n: Notice): NoticeCategory {
  if (n.kind === 'milestone') return 'milestone';
  if (n.text.startsWith('📊 Month')) return 'report';
  if (n.text.startsWith('Out of stock')) return 'stock';
  if (n.kind === 'po') return 'delivery';
  // Things that wait for an answer: inbox events, texts with choices, unboxing a sample.
  if (n.kind === 'event' || n.kind === 'sample' || (n.text.startsWith('📱') && n.pause)) return 'decision';
  return 'ambient';
}

/** Should this fresh notice stop the clock? */
export function pausesFor(n: Notice, settings: PauseSettings = DEFAULT_PAUSES): boolean {
  if (!n.pause) return false;
  const c = noticeCategory(n);
  if (c === 'decision') return true;
  if (c === 'ambient') return false;
  return settings[c];
}
