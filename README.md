# Unboxed

An e-commerce tycoon game: launch one product from a tiny apartment and reach your first profitable reorder.
Design doc: [docs/GAME_CONCEPT.md](docs/GAME_CONCEPT.md). This build is the §9 prototype.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # balance tests (scripted bot players)
npm run build      # typecheck + production build to dist/
```

## Stack

- **TypeScript + Vite + React 18** for the laptop-style app panels (most of the gameplay).
- **PixiJS 8** for the isometric apartment diorama.
- **Zustand** for UI state, wrapping a **pure TypeScript simulation** (no UI imports) tested with **Vitest**.
- Art: [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) isometric renders (CC0) in `public/assets/furniture/`.
  Room shell, cat and founder are drawn in code.

## Layout

```
src/sim/        Simulation: data, economics formulas, daily tick, player actions, bots
  data.ts         Products, suppliers, store modules, tuning constants
  economics.ts    Derived numbers: margins, break-even CPA, trust, conversion, cash pools
  engine.ts       createGame, advanceDay, and every player action (mutates a draft state)
  bots.ts         Scripted good/naive players for balance tests
src/state/      Zustand store (game loop, autosave to localStorage, milestone queue) + WebAudio sfx
src/scene/      PixiJS apartment diorama (boxes stack with stock, parcels fly out, cat, day/night window)
src/ui/         React: HUD, laptop apps (Trends, SourceMart, ShopBloc, Offer, Scrollr, Orders, Cash, Wall), modals
```

Every engine action takes a `GameState` draft and returns an error string or `null`. The store clones the state,
runs the action, and shows any error as a toast. Saves are plain JSON of `GameState`.

## Balancing

`npm test` runs 12 "thoughtful" and 8 "naive" bot players. The thoughtful bot should reach a profitable reorder;
the naive bot (all ads on, weak store) should bleed cash. Tuning lives in `src/sim/data.ts`.

In dev, `window.__store` and `window.__engine` are exposed for console playtesting.
