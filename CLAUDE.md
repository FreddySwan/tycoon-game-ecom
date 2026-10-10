# Unboxed — notes for Claude

- Game design source of truth: `docs/GAME_CONCEPT.md` (§9 = current prototype scope).
- Keep `src/sim/` free of React/Pixi imports. All rules and numbers live there; UI only reads and calls actions.
- After changing tuning (`src/sim/data.ts`, `economics.ts`, or the tick), run `npm test`. The balance tests encode the
  intended difficulty: thoughtful bots win, naive bots lose money.
- Engine actions mutate a cloned draft and return `string | null` (error shown as toast). Don't mutate store state directly.
- Kenney sprites anchor bottom-center; placements in `src/scene/Apartment.ts` use iso tile coords + footprint (fi, fj).
