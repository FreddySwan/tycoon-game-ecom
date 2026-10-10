import { MONTH, MONTH_NAMES, START_MONTH, YEAR } from './data';

/** Day 1 is March 1st of year 1. A year is 12 months of 30 days. */
export function dayOfYear(day: number): number {
  return ((day - 1 + START_MONTH * MONTH) % YEAR) + 1;
}

export function dateLabel(day: number): string {
  const total = day - 1 + START_MONTH * MONTH;
  const year = Math.floor(total / YEAR) + 1;
  const month = Math.floor((total % YEAR) / MONTH);
  const dom = (total % MONTH) + 1;
  return `${MONTH_NAMES[month]} ${dom}, Y${year}`;
}

function bump(doy: number, start: number, end: number): number {
  if (doy < start || doy > end) return 0;
  const mid = (start + end) / 2;
  const half = (end - start) / 2;
  return 1 - Math.abs(doy - mid) / (half * 1.4);
}

/** Holiday shopping season: mid-November to Christmas. */
export function holiday(day: number): number {
  return Math.max(0, bump(dayOfYear(day), 315, 358));
}

export function demandSeason(day: number): number {
  return 1 + 0.55 * holiday(day);
}

export function cpmSeason(day: number): number {
  return 1 + 0.75 * holiday(day);
}

/** Big Bazaarly Days: a three-day marketplace sale in mid-July. */
export function isBigBazaarlyDays(day: number): boolean {
  const d = dayOfYear(day);
  return d >= 192 && d <= 194;
}
