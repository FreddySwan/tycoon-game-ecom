// Bot report: plays seeded games and prints the targets from docs/LEVEL_UP_PLAN.md §8.
// Run with: npm run report  (or REPORT_SEEDS=10 npm run report)
import { naiveBot, runBot } from '../src/sim/bots';
import { trailing } from '../src/sim/economics';
import * as E from '../src/sim/engine';
import type { Difficulty, GameState } from '../src/sim/types';

const SEEDS = Number(process.env.REPORT_SEEDS ?? 6);
const DAYS = Number(process.env.REPORT_DAYS ?? 720);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

function play(seed: number, difficulty: Difficulty) {
  let seen = 0;
  let pauses = 0;
  let notices = 0;
  let margin600 = NaN;
  let cashRatio4 = NaN;
  let stage4Day = 0;
  const onDay = (s: GameState) => {
    const fresh = s.notices.filter((n) => n.id > seen);
    if (s.notices.length) seen = s.notices[s.notices.length - 1].id;
    notices += fresh.length;
    pauses += fresh.filter((n) => E.pausesFor(n)).length;
    if (s.day === 600) {
      const t = trailing(s, 90);
      margin600 = t.revenue ? t.profit / t.revenue : NaN;
    }
    if (s.stage >= 4 && !stage4Day) stage4Day = s.day;
    if (stage4Day && s.day === stage4Day + 60) {
      const t = trailing(s, 30);
      cashRatio4 = s.cash / Math.max(1, t.revenue - t.profit);
    }
  };
  const t0 = performance.now();
  const { s, result } = runBot(seed, DAYS, undefined, undefined, undefined, difficulty, onDay);
  const ms = performance.now() - t0;
  const c0 = performance.now();
  structuredClone(s);
  return { result, s, pauses, notices, margin600, cashRatio4, save: JSON.stringify(s).length, clone: performance.now() - c0, msPerDay: ms / s.day };
}

for (const d of ['relaxed', 'normal', 'hard'] as Difficulty[]) {
  const runs = Array.from({ length: SEEDS }, (_, i) => play(500 + i, d));
  const days = runs.map((r) => r.s.day);
  console.log(`\n=== ${d.toUpperCase()} (${SEEDS} seeds, ${DAYS} days) ===`);
  console.log(`bankrupt:              ${runs.filter((r) => r.result.lost).length}/${SEEDS}`);
  console.log(`won (first reorder):   ${runs.filter((r) => r.result.winDay !== null).length}/${SEEDS}`);
  console.log(`stage reached:         ${runs.map((r) => Math.max(...Object.keys(r.result.stageDays).map(Number))).join(' ')}`);
  console.log(`stage 2/3/4 day (avg): ${[2, 3, 4].map((st) => Math.round(avg(runs.map((r) => r.result.stageDays[st as 2]).filter((x): x is number => !!x)))).join(' / ')}`);
  console.log(`auto-pauses / 5 days:  ${(avg(runs.map((r, i) => (r.pauses / days[i]) * 5))).toFixed(2)}  (target ≤ 1)`);
  console.log(`notices / day:         ${avg(runs.map((r, i) => r.notices / days[i])).toFixed(2)}`);
  console.log(`net margin d510-600:  ${runs.map((r) => (isNaN(r.margin600) ? '—' : pct(r.margin600))).join(' ')}  (target 8–20%)`);
  console.log(`cash / monthly costs @ stage 4 + 60d: ${runs.map((r) => (isNaN(r.cashRatio4) ? '—' : r.cashRatio4.toFixed(1))).join(' ')}  (target 1–4)`);
  console.log(`save size (KB):        ${runs.map((r) => Math.round(r.save / 1024)).join(' ')}  (target < 1000)`);
  console.log(`state clone (ms):      ${avg(runs.map((r) => r.clone)).toFixed(1)}  ·  sim ms/day: ${avg(runs.map((r) => r.msPerDay)).toFixed(2)}`);
}

const naive = Array.from({ length: SEEDS }, (_, i) => naiveBot(900 + i, 120));
console.log(`\n=== NAIVE (120 days) ===\ndistress (lost or cash < $1k): ${naive.filter((r) => r.lost || r.finalCash < 1000).length}/${SEEDS}`);
