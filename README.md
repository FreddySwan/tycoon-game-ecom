# Unboxed

An e-commerce tycoon game: start with a laptop, $4,000 and a cat in a studio apartment, and grow into a warehouse,
a multichannel retailer and an international company. Or stay small and beloved. Design doc: [docs/GAME_CONCEPT.md](docs/GAME_CONCEPT.md).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # balance bots play full games; determinism check
npm run build      # typecheck + production build to dist/
```

## What's in the game

| Stage | Space | New decisions |
|---|---|---|
| 1. Apartment startup | Studio apartment | Pick products (up to 3), samples & negotiation, ShopBloc store, photo shoots, pricing, Scrollr ads, hand packing → batch packing, Seekly search ads. First goal: a profitable reorder. |
| 2. Growing brand | Garage unit | Hiring (packers, support, marketer), email list & flows & campaigns, LoopShop + creator collabs, branded packaging, reorder alerts, credit line, 3PL option. |
| 3. Warehouse | Small warehouse | Warehouse layout editor (racks, stations, conveyors), buyer + automatic reorders, warehouse lead and second shift, MegaFab volume factory, automation. |
| 4. Multichannel | Branded HQ | Bazaarly / Crafthaus / FlashCart listings, rank, Express fulfillment, lightning deals, sponsored listings, wholesale accounts, supplier contracts, Product Lab (exclusive products). |
| 5. Established | Campus | International markets with local warehouses, multiple brands, robot pickers. |

Moving up is always optional and costs a deposit plus higher rent. **Ambitions** (from stage 2): Beloved Brand,
Retail Giant, Category King, Portfolio Builder.

**Events** come with warning signs and choices: port delays, quality drift, viral spikes, the holiday ad-cost surge,
copycats, Bazaarly fee hikes, return waves, staff poaching, supplier price rises, payment reserves, wholesale
inquiries, creator DMs, Big Bazaarly Days. Running out of cash gives you options (family loan, bridge loan,
liquidation) before the business closes.

**Player tools added in the feedback round:**
- *Product research board:* investigations (1h) and deep dives (2h) reveal demand, competition, margins, a 60-day
  trend forecast and customer insights; shortlist up to 5 and compare side by side before picking.
- *Photo shoot:* drag to frame the product, zoom, pick backdrop, light, prop and angle. Composition counts.
- *Creative studio:* every ad format has a photo, hook and button; hooks land differently with each audience;
  phone-mockup previews. Creator posts show up as a feed with their results.
- *Ad manager rules:* your growth marketer scales ads that beat break-even by your margin target (+20%/day),
  pauses ads above break-even, launches tests, and keeps total spend under a % of revenue you set.
- *Warehouse lead autopilot:* hires/lets go of packers to match demand, starts a 2nd shift, builds stations and racks.
- *Analytics:* profit by product and by channel (incl. 3PL fees), ad performance by source and product,
  order pace by product and channel, a stock & restock table with days of cover, net-30 supplier terms.

**Round 3 additions:**
- *Startup mini-games:* market scan (find the opening, the real complaint and the price gap; the complaint unlocks a
  positioning benefit), ad-angle test (match hooks to audiences for a click boost), packaging designer, store page
  layout & theme. A graded launch checklist tracks them in stage 1.
- *Inbox offers:* bank credit, invoice financing, supplier volume deals (with commitments), premium materials,
  ad agencies, Scrollr partner program, freight and carrier deals, packaging and conversion tools, influencer
  bundles, and buy-outs of a product line. Accepted deals show under "Active deals".
- *Standard replies:* after the first profitable reorder, set a default reply per issue type or outsource the inbox.
- *Email:* promotion, replenishment, product launch, review request and brand story campaigns, sent to segments
  (everyone, recent buyers, lapsed, VIP), with per-campaign opens, clicks, orders, revenue and reviews, plus flow revenue.
- *P&L:* monthly / quarterly / yearly, every line expandable (products, channels, ad sources, teams, items).
- *Ad manager* now also runs marketplace sponsored listings and lightning deals.

**Round 4 additions:**
- *Dig for products:* a new game starts with an empty research board. Each dig (1h before your first product, 3h
  after) turns up one random lead; investigating it is a 3-question quiz (read a search-trend curve, a page of rival
  listings, and a cost sheet). A perfect read refunds the hour. New trends announce themselves but still need digging.
- *Founder routine:* the apartment day runs 7:00 to 1:00. The founder wakes up, has coffee, works at the desk or packs
  orders at the table depending on what the business needs, eats lunch, cooks dinner, unwinds on the sofa and goes to
  bed; the room darkens at night and the cat joins them.
- *Finance charts:* revenue, expenses and profit by day, week or month with axes and hover read-outs; a 30-day cash
  forecast that models each channel's payout day; a "Money on its way" table with each payout's date and amount.
- *Ads:* a checkbox (on by default) stops Scrollr and Seekly spend on out-of-stock products until stock arrives.

**Money model:** a daily P&L (revenue, refunds, product cost, shipping, fees, ads, payroll, rent, other, interest)
with monthly reports, separate from cash. Payouts arrive per channel on their own schedules, suppliers can offer
30/70 terms, wholesale pays net-30. The Cash River shows where money is locked up.

## Stack

- **TypeScript + Vite + React 18** for the laptop apps.
- **PixiJS 8** dioramas: `src/scene/Apartment.ts` (stage 1) and `src/scene/LayoutScene.ts` (garage → campus, drawn
  from the player's warehouse layout, staff counts and stock levels).
- **Zustand** store around a **pure TypeScript simulation** tested with **Vitest**.
- Art: [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) (CC0) plus shapes drawn in code.
- Product photos in `public/assets/products/` (slot 0 supplied by the developer; others via Openverse, CC0 / CC BY).

## Layout

```
src/sim/
  data/          catalog (11 products, 5 categories), suppliers, channels, regions, roles, spaces, stages, constants
  economics.ts   derived numbers: margins, break-even CPA, trust, conversion, capacity, P&L rollups, projections
  progress.ts    stage requirements and ambition checks
  calendar.ts    dates, holiday season, Big Bazaarly Days
  engine/        core (state, ledger), sourcing, storefront, marketing, ops, reviews, company, events, tick
  bots.ts        scripted players used by tests and the dev console
src/state/       Zustand store (game loop, autosave, modal queue) + WebAudio sfx
src/scene/       PixiJS dioramas
src/ui/          HUD, laptop apps (src/ui/apps), modals, goals
```

Orders are simulated as daily aggregates (buckets per product and channel), so the game stays fast with
thousands of orders a day. Every engine action takes a cloned `GameState` and returns an error string or `null`.

## Dev tools

In dev builds the console has `__store`, `__engine` and `__bots`. Jump to any point of a game:

```js
const { s } = __bots.runBot(1000, 300); __store.setState({ game: s, modal: null });
```

Run `BOT_LOG=1 npm test` to print the reference bot's month-by-month numbers.
