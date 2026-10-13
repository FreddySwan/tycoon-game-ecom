# Unboxed — notes for Claude

- Design source of truth: `docs/GAME_CONCEPT.md`. README lists what's implemented per stage.
- Keep `src/sim/` free of React/Pixi imports. All rules and numbers live there; the UI only reads state and calls engine actions.
- Engine actions mutate a cloned draft and return `string | null` (shown as a toast). Never mutate store state directly.
- Every cash movement that is an expense or income goes through `book()` (engine/core.ts) so the P&L stays complete.
  Inventory purchases and loan principal use `spendCash()` instead (not expenses).
- After changing tuning (`src/sim/data/*`, `economics.ts`, `engine/tick.ts`), run `npm test`. The balance tests encode
  intended pacing: thoughtful bots reach the warehouse before day ~400 and rarely go bankrupt; naive bots lose money.
- Orders are aggregated per day/product/channel (`BacklogBucket`, `Delivery`). Only stage 1's hand-pack era keeps
  named single orders.
- `npm run report` prints the level-up targets (margins, pauses, save size, bankruptcies per difficulty) from bot runs.
- Daily history is bounded (`HISTORY_DAYS`, engine/history.ts); anything reading more than ~90 days must use
  `trailing()`/`periodPL()`, which include the monthly `archive`. Saves live in IndexedDB (state/persist.ts).
- New notifications: pass `pause = true` only for things that need a decision; `engine/notices.ts` decides what
  actually stops the clock.
- UI components: don't define child components inside a component that holds inputs (remounts lose focus);
  use plain render functions instead.
