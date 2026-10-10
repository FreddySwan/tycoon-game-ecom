import { describe, expect, it } from 'vitest';
import { fullBot, naiveBot } from './bots';

describe('balance', () => {
  it('a thoughtful player climbs the stages', () => {
    const lines: string[] = [];
    const first = fullBot(1000, 720, (l) => lines.push(l));
    if ((globalThis as { process?: { env: Record<string, string> } }).process?.env.BOT_LOG) console.log(lines.join('\n'));
    const results = [first, ...Array.from({ length: 5 }, (_, i) => fullBot(1001 + i, 720))];
    console.table(results.map((r) => ({ ...r, stageDays: JSON.stringify(r.stageDays) })));
    expect(results.filter((r) => r.winDay !== null).length).toBeGreaterThanOrEqual(5);
    expect(results.filter((r) => (r.stageDays[3] ?? 999) < 400).length).toBeGreaterThanOrEqual(4);
    expect(results.filter((r) => (r.stageDays[4] ?? 999) < 500).length).toBeGreaterThanOrEqual(3);
    expect(results.filter((r) => r.lost).length).toBeLessThanOrEqual(2);
  });

  it('a naive player loses money on ads', () => {
    const results = Array.from({ length: 6 }, (_, i) => naiveBot(2000 + i));
    console.table(results.map((r) => ({ lost: r.lost, cash: r.finalCash, shipped: r.shipped })));
    expect(results.filter((r) => r.lost || r.finalCash < 2500).length).toBeGreaterThanOrEqual(5);
  });
});

describe('determinism', () => {
  it('same seed, same game', () => {
    expect(JSON.stringify(fullBot(77, 200))).toBe(JSON.stringify(fullBot(77, 200)));
  });
});
