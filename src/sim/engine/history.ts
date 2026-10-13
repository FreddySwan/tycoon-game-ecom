import { periodOf } from '../calendar';
import { emptyPL, zeroSlice } from '../economics';
import type { ArchiveMonth, ChannelId, DailyRecord, GameState, PLCategory, Slice } from '../types';

/** Days of full daily detail kept in the save; older days are rolled up into months. */
export const HISTORY_DAYS = 95;
const ARCHIVE_MONTHS = 72;

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Round every number in a closed day's record to cents: floats are most of the save's size. */
export function compactRecord(r: DailyRecord): void {
  const walk = (o: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number') o[k] = r2(v);
      else if (v && typeof v === 'object') walk(v as Record<string, unknown>);
    }
  };
  walk(r as unknown as Record<string, unknown>);
}

function addNum<K extends string | number>(into: Partial<Record<K, number>>, from: Partial<Record<K, number>> | undefined): void {
  for (const [k, v] of Object.entries(from ?? {}) as [K, number][]) into[k] = r2((into[k] ?? 0) + (v ?? 0));
}

function addSlices(into: Record<string, Slice>, from: Record<string, Slice | undefined> | undefined): void {
  for (const [k, x] of Object.entries(from ?? {})) {
    if (!x) continue;
    const t = (into[k] ??= zeroSlice());
    for (const f of Object.keys(t) as (keyof Slice)[]) t[f] = r2(t[f] + (x[f] ?? 0));
  }
}

/** Move days older than the window into monthly archive rows. */
export function rollupHistory(s: GameState): void {
  if (s.history.length <= HISTORY_DAYS) return;
  const archive = (s.archive ??= []);
  const old = s.history.splice(0, s.history.length - HISTORY_DAYS);
  for (const r of old) {
    const { key } = periodOf(r.day, 'month');
    let m = archive[archive.length - 1];
    if (!m || m.key !== key) {
      m = { key, fromDay: r.day, toDay: r.day, days: 0, cash: r.cash, orders: 0, repeatOrders: 0, pl: emptyPL(), plSub: {}, channelRevenue: {}, brandRevenue: {}, brandCost: {}, productPL: {}, channelPL: {} };
      archive.push(m);
    }
    m.toDay = r.day;
    m.days++;
    m.cash = r.cash;
    m.orders += r.orders;
    m.repeatOrders += r.repeatOrders;
    addNum(m.pl, r.pl);
    for (const [cat, lines] of Object.entries(r.plSub ?? {})) addNum((m.plSub[cat as PLCategory] ??= {}), lines);
    addNum(m.channelRevenue, r.channelRevenue);
    addNum(m.brandRevenue, r.brandRevenue);
    addNum(m.brandCost, r.brandCost);
    addSlices(m.productPL, r.productPL);
    addSlices(m.channelPL as Record<string, Slice>, r.channelPL as Record<string, Slice>);
  }
  if (archive.length > ARCHIVE_MONTHS) archive.splice(0, archive.length - ARCHIVE_MONTHS);
}

/** Archive months covering the `extra` days before the daily window, newest first. */
export function archiveSpan(s: GameState, extra: number): ArchiveMonth[] {
  const out: ArchiveMonth[] = [];
  const arch = s.archive ?? [];
  for (let k = arch.length - 1; k >= 0 && extra > 0; k--) {
    out.push(arch[k]);
    extra -= arch[k].days;
  }
  return out;
}

export type { ChannelId };
