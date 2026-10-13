import { describe, expect, it } from 'vitest';
import { runBot } from './bots';
import { CHANNELS } from './data';
import { cashForecast, hasSkill, hoursLeft, packHours, periodPL, trailing, upcomingPayouts } from './economics';
import * as E from './engine';
import type { GameState, Notice } from './types';

const fresh = (seed = 1): GameState => {
  const s = E.createGame(seed);
  s.flags.introSeen = true;
  return s;
};

describe('history', () => {
  it('keeps a bounded daily window and archives older days without losing totals', () => {
    const { s } = runBot(3, 300);
    expect(s.history.length).toBeLessThanOrEqual(E.HISTORY_DAYS);
    expect(s.archive?.length).toBeGreaterThan(0);
    const archived = (s.archive ?? []).reduce((a, m) => a + m.pl.revenue, 0);
    const daily = s.history.reduce((a, r) => a + r.pl.revenue, 0);
    const years = periodPL(s, 'year', 10).reduce((a, p) => a + p.pl.revenue, 0);
    expect(Math.abs(years - (archived + daily))).toBeLessThan(1);
    expect(trailing(s, 360).days).toBeGreaterThanOrEqual(299);
  });

  it('stays small enough to save', () => {
    const { s } = runBot(4, 720);
    expect(JSON.stringify(s).length).toBeLessThan(1_500_000);
  });
});

describe('saves', () => {
  it('round-trips and migrates', () => {
    const { s } = runBot(5, 60);
    const back = E.migrate(JSON.parse(JSON.stringify(s)) as GameState);
    expect(back.day).toBe(s.day);
    expect(back.story.chapter).toBe(s.story.chapter);
    expect(JSON.stringify(E.migrate(structuredClone(back)))).toBe(JSON.stringify(back));
    const g = E.migrate(JSON.parse(JSON.stringify(fresh())) as GameState);
    E.advanceDay(g);
    expect(g.day).toBe(2);
  });

  it('upgrades a save from before skills and the story', () => {
    const s = fresh() as Partial<GameState> & GameState;
    delete (s as Partial<GameState>).skills;
    delete (s as Partial<GameState>).story;
    delete (s as Partial<GameState>).difficulty;
    const m = E.migrate(s);
    expect(hasSkill(m, 'adsBasics')).toBe(true);
    expect(m.story.chapter).toBe('dropout');
    expect(m.difficulty).toBe('normal');
  });
});

describe('notification triage', () => {
  const n = (kind: Notice['kind'], text: string, pause = true): Notice => ({ id: 1, day: 1, kind, text, pause });
  it('only stops the clock for decisions by default', () => {
    expect(E.pausesFor(n('event', 'A supplier wants to talk'))).toBe(true);
    expect(E.pausesFor(n('info', '📱 Sam: hang out?'))).toBe(true);
    expect(E.pausesFor(n('po', 'delivered'))).toBe(false);
    expect(E.pausesFor(n('info', 'Payroll: −$1,200.'))).toBe(false);
    expect(E.pausesFor(n('info', 'Out of stock: Bowl!'))).toBe(true);
    expect(E.pausesFor(n('info', 'Out of stock: Bowl!'), { ...E.DEFAULT_PAUSES, stock: false })).toBe(false);
  });
});

describe('skills', () => {
  it('courses need study hours before they count', () => {
    const s = fresh();
    expect(E.buySkill(s, 'adsBasics')).toBeNull();
    expect(hasSkill(s, 'adsBasics')).toBe(false);
    E.studySkill(s, 'adsBasics');
    E.studySkill(s, 'adsBasics');
    expect(hasSkill(s, 'adsBasics')).toBe(true);
    expect(hoursLeft(s)).toBe(6);
  });

  it('software bills monthly and can be cancelled', () => {
    const s = fresh();
    E.buySkill(s, 'researchTool');
    expect(s.bills.some((b) => b.label === 'TrendHound Pro')).toBe(true);
    E.cancelSkill(s, 'researchTool');
    expect(s.bills.some((b) => b.label === 'TrendHound Pro')).toBe(false);
    expect(hasSkill(s, 'researchTool')).toBe(false);
  });

  it('packing gear speeds up packing', () => {
    const s = fresh();
    const before = packHours(s);
    E.buySkill(s, 'tapeGun');
    expect(packHours(s)).toBeCloseTo(before * 0.8);
  });
});

describe('story', () => {
  it('starts on chapter one and moves on after the first sale', () => {
    const { s } = runBot(6, 40);
    expect(['deal', 'secondChance', 'payback']).toContain(s.story.chapter);
  });

  it('paying everyone back is a loan repayment, not an expense', () => {
    const s = fresh();
    s.cash = 10000;
    const pl = trailing(s, 1).pl.other;
    for (const who of ['mom', 'sam', 'maya'] as const) E.repayDebt(s, who, s.story.debt[who]);
    expect(s.cash).toBe(6000);
    expect(trailing(s, 1).pl.other).toBe(pl);
    expect(s.story.beats.allRepaid).toBeDefined();
  });
});

describe('payouts', () => {
  it('forecast lands channel money on payout days', () => {
    const { s } = runBot(7, 80);
    const next = upcomingPayouts(s);
    for (const p of next) expect(p.day % CHANNELS[p.channel].payoutEvery).toBe(0);
    const f = cashForecast(s, 30);
    expect(f.length).toBe(30);
  });
});
