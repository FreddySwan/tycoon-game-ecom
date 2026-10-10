import { runBot } from './bots';
import type { GameState, StageId } from './types';

/**
 * Admin mode: a ready-made business at the given stage, played by the scripted bot so it has realistic products,
 * staff, channels and history. Stage 1 stops once the store is live and the first orders shipped.
 */
export function simulateToStage(stage: StageId, seed = Date.now() % 100000): GameState {
  const done = (s: GameState) => (stage === 1 ? s.shipped > 0 : s.stage >= stage);
  const { s } = runBot(seed, 1200, undefined, undefined, done);
  if (!done(s)) throw new Error(`The simulated run didn’t reach stage ${stage} (ended at stage ${s.stage}, day ${s.day}).`);
  return s;
}
