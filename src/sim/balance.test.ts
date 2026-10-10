import { describe, expect, it } from 'vitest';
import { goodBot, naiveBot } from './bots';

describe('balance', () => {
  it('a thoughtful player reaches a profitable reorder', () => {
    const results = Array.from({ length: 12 }, (_, i) => goodBot(1000 + i));
    console.table(results);
    const wins = results.filter((r) => r.winDay !== null);
    expect(wins.length).toBeGreaterThanOrEqual(9);
  });

  it('a naive player loses money on ads', () => {
    const results = Array.from({ length: 8 }, (_, i) => naiveBot(2000 + i));
    console.table(results);
    expect(results.filter((r) => r.lost || r.finalCash < 2500).length).toBeGreaterThanOrEqual(6);
  });
});
