import type { GameState } from '../sim/types';

/** Small deterministic RNG seeded by text: mini-game layouts stay put between renders but differ per game. */
export function seeded(game: GameState, key: string): () => number {
  let h = 2166136261;
  for (const c of `${key}#${game.counters.runSeed ?? 0}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function shuffleWith<T>(items: T[], rnd: () => number): T[] {
  return items
    .map((v) => ({ v, k: rnd() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.v);
}
