# Unboxed: evaluation and level-up plan

A design and engineering review of the game as of October 2026 (commit `9343244`), and a phased plan to take it from
"a deep prototype" to "a tycoon game people finish, replay and recommend".

How this review was done:

- **Simulated playthroughs.** The scripted bots played full games (seeds 1–6, 720 days) and I sampled the economy at
  days 30, 60, 120, 200, 300, 450, 600 and 720: revenue, margins, cost mix, channel mix, cash, headcount, save size,
  clone and tick time, notification and auto-pause counts.
- **Code review.** About 7,700 lines of simulation, 6,700 of UI and 1,300 of scenes.
- **Design lenses.** The standard tycoon ones: core loop, decision density, pacing, economy and sinks, progression,
  failure and recovery, readability, feel, onboarding, content and replayability, technical health.

> **Status (October 14, 2026).** First implementation pass done. Measured with `npm run report` (6 seeds × 720 days):
>
> | Metric | Before | Now | Target |
> |---|---|---|---|
> | Save size at day 720 | ~3.7 MB (would fail) | 0.7–1.1 MB, bounded | < 1 MB |
> | Auto-pauses per 5 game days | ~4.7 | ~1.4 | ≤ 1 |
> | Net margin, Normal, days 510–600 | 35–46% | 5–31% (median ~22%) | 8–20% |
> | Normal: thoughtful bots bankrupt | 0/6 | 0/6 | low |
> | Hard: non-adapting bots bankrupt | 100% | 4/6 | 60–80% |
> | Late-game monthly revenue | $7–17M | $1–8M | contested |
> | Tests | 3 balance | 14 (balance + engine + migration) | ~100 |
>
> Done: 0.1–0.5 (0.6 not needed: main chunk is 290 KB gzipped), 1.1–1.6, 2.1, 2.2, 2.5, 3.1, 3.4, 4.1, 4.2, 4.4 (payoff in
> numbers), 5.1 (traits), 5.2, 6.2 (Brett's Kinetik), 6.4 (endings + selling the company), 7.4 (cash counter), 8.1
> (grouped apps), 8.2 (mission panel), 8.4 (shortcuts).
> Not done yet: procedural products and trends (2.3, 2.4), delegation policies beyond ads (3.2), stage-specific verbs
> beyond the weekly focus (3.3), sample QA, packing puzzle, hiring interviews (4.3, 4.6, 4.7), merged ad studio (4.8),
> team moments and culture dial (5.3, 5.4), branching Dad's-deal outcomes and diorama scenes (6.1, 6.3), living later
> spaces, one art direction, music (7.1–7.3, 7.5), first-use guides, undo, responsive layout (8.3–8.5), meta and
> distribution (9.x, 10.x). Known balance gap: stage 3 (warehouse) is a cash wall where about half the scripted bots
> stall; net margins for the strongest runs still sit above the 20% target.

---

## 1. Verdict in one paragraph

Stage 1 is genuinely good: digging for a product, reading the market, ordering samples, negotiating, shooting photos,
building the store, testing ad cells and hand-packing the first orders is a rich, readable loop with real stakes
($4,000 that isn't yours). From stage 2 on the game turns into a spreadsheet. Systems pile up (15 laptop apps),
automation takes over the verbs, the economy gets far too generous (35–46% net margins and $8M of idle cash by the
late game), and almost every day pauses itself with a notification. Mini-games are one-shot quizzes with fixed
answers. The world has no rivals, only multipliers. Under the hood, the save file grows without limit and will hit
the browser's storage cap in long games. The foundations (deterministic sim, clean engine/UI split, a lot of systems
already written) are strong enough to fix all of this without a rewrite.

---

## 2. Scorecard

My judgement, 1–10, with what "10" would look like for this game.

| Pillar | Now | Why | A 10 looks like |
|---|---|---|---|
| Core loop (stage 1) | 7 | Rich, readable, tense. Some waiting. | Every day has one meaningful decision; no dead time. |
| Core loop (stages 2–5) | 3 | Decisions collapse into toggles and autopilots. | The founder's job changes each stage (doer → manager → CEO) with new verbs, not just bigger numbers. |
| Economy & balance | 4 | Late margins 35–46%, COGS 10–12%, ads 3–5% of revenue, cash piles up with nothing to spend it on. | Margins stay in a believable 8–20% band; cash is always contested between growth bets. |
| Challenge & failure | 3 | Thoughtful bots never lose on Normal; Hard kills bots that don't adapt. Bankruptcy is rare and binary. | Normal: real setbacks, recoverable. Hard: you must pivot products. Failure teaches. |
| Pacing | 5 | Stage 2 at ~day 113 (~40 min at 1×); late game drags; shipping waits. | Each stage takes 30–60 minutes and ends on a high; the late game is shorter and denser. |
| Interruptions | 2 | ~75 notifications and ~28 auto-pauses per 30 game days: almost one pause a day. | Pauses only for decisions; everything else goes into a calm daily digest. |
| Mini-games | 4 | Six quizzes with fixed answers; learnable in one play; the effects are invisible multipliers. | Procedural, replayable, with skill expression and visible consequences. |
| Content & replayability | 3 | 11 products, 5 categories, 25 events, one linear story. | Procedural products and trends, rival companies, multiple endings, scenarios, New Game+. |
| World & rivals | 2 | Competition is a number (copycat %, market drift). | Named rival brands that cut prices, copy you, outbid you and react to what you do. |
| People & management | 3 | Headcount 178 by stage 5 with no faces; roles are counters. | A handful of named characters (including Sam and Maya) whose traits matter. |
| Story | 5 | Chapters, phone, Dad's deal: a good start, but linear and text-only. | Branching outcomes, characters you hire, a rival, and scenes in the diorama. |
| UI & readability | 4 | Dense tables, 15 tabs, crowded left panel; cause and effect often hidden. | ~7 apps, one "Today" screen, every number explainable with one hover. |
| Presentation & feel | 5 | Charming apartment; later spaces are static boards; little juice; pixel icons and Kenney 3D don't fully match. | The diorama is the main interface; every sale, hire and move is felt. |
| Onboarding | 5 | Goal note, launch checklist, story card and phone all compete for attention. | One mission panel; systems unlock with the story and each gets a 30-second guided first use. |
| Technical health | 4 | Save hits ~3.7 MB at day 720 (browser cap ~5 MB, failures are swallowed); 28 ms full-state clone per action late; only balance tests; one save slot. | Saves under 1 MB at day 1,000, actions under 5 ms, tested engine, multiple slots, export and import. |

---

## 3. What works (keep and build on)

1. **The fantasy and tone.** "Laptop, $4,000, a cat called Invoice" is instantly relatable. The writing is warm and
   specific. Keep the voice.
2. **Stage 1's chain of meaningful steps.** Dig, investigate, sample, negotiate, unbox, shoot, build, launch, test
   ads, pack, reorder. Each step teaches one real e-commerce concept.
3. **Cash vs profit as two separate scores.** The Cash River, payouts on a schedule, net-30 terms and the cash forecast
   teach the #1 lesson of real e-commerce. This is the game's signature system.
4. **The ad grid** (audience × creative, CPA vs break-even). Readable, with real decisions about when to cut and when
   to scale.
5. **The apartment diorama.** The founder's routine, boxes spreading across the room, the cat in the box, night
   falling. It makes the business feel lived-in.
6. **The engine architecture.** Pure TypeScript sim, deterministic RNG, actions on drafts, `book()` for every P&L line,
   bots as balance tests. This is unusually solid for a prototype and makes everything below cheap to try.
7. **Market drift and difficulty.** The right idea (products wear out, so you must keep finding new ones), now
   needing rivals to make it visible.
8. **The story hook.** Dropout, borrowed money, Dad's deal with a deadline. Strong motivation; needs consequences
   and faces.

---

## 4. What doesn't work, and why

### 4.1 Decision density collapses after stage 1

- **Evidence.** In stage 1 the player makes 5–15 meaningful choices a day. By stage 3 the scripted bot (which mirrors
  a reasonable player) mostly toggles autopilots: the marketer runs ads, the buyer runs reorders, the warehouse lead
  hires, templates answer customers.
- **Cause.** Each new system arrives with its own automation, so the player's verbs get removed rather than
  transformed. Nothing replaces "I do it myself" with "I decide how it's done".
- **Effect.** Stages 3–5 are watching numbers grow. It's the most common tycoon failure mode.

### 4.2 The economy is too generous late and has no money sinks

- **Evidence.**

  | Point in the game | Revenue (last 30 days) | Net margin | Product cost | Ads | Cash on hand |
  |---|---|---|---|---|---|
  | Day 600, seed 1 | $828k | 44% | 18% | 5% | — |
  | Day 720, seed 2 | $7M | 35% | 10% | 4% | $8.3M |

  Real direct-to-consumer brands run 5–15% net with product cost at 25–40% and marketing at 15–30%.
- **Causes.**
  - Volume tiers, Megafab pricing and contract discounts stack on top of each other.
  - Marketplace organic traffic scales with rank, but nothing scales against it.
  - Ad spend is capped by the policy and never needs to grow.
  - Payroll is spread over huge revenue.
  - Nothing big costs money in the late game: no R&D lines, no brand campaigns, no acquisitions, no investors, no
    facilities beyond the next move.
- **Effect.** From stage 4 on, money stops being a resource. Every decision is "yes".

### 4.3 Not enough challenge on Normal, too binary on Hard

- **Evidence.** Six of six thoughtful bots win on Normal, with zero bankruptcies. On Hard, bots that never switch
  products go bankrupt in stage 3. The naive bot hovers near $0 but never goes bankrupt (it gets the family loan).
- **Cause.** Pressure comes from abstract drift, not from anything the player can see and counter. Bankruptcy is a
  cliff with a few bailouts, not a spiral you can claw back from.

### 4.4 Interruptions

- **Evidence.** About 75 notifications and about 28 auto-pauses per 30 game days, all stages. That's nearly one
  pause per game day.
- **Effect.** Speed controls are meaningless, the feed is noise, and important events drown.

### 4.5 Pacing

- **Stage 1.** It's front-loaded with waiting: samples take 3 days, air freight 6, sea 25.
- **Stage 2.** It arrives around day 100–140 (35–45 minutes at 1×), which is fine.
- **Stages 3–5.** They take another 300–400 days of mostly watching.
- **Calendar effects.** The calendar matters (holiday season, Big Bazaarly Days) but the player is rarely asked to
  prepare for it.

### 4.6 Mini-games are quizzes, not games

- **What exists.** Six mini-games: investigation quiz, market scan, ad-angle test, store builder, competitor ad
  research and the packaging designer. Plus the photo shoot, which is the best one because it has spatial skill.
- **Fixed answers.** Each has one correct answer per product. After one playthrough there is nothing left to learn,
  and players will quickly look it up.
- **Hidden payoff.** The effects are invisible multipliers ("creative quality 95%"), so the player never feels the
  payoff in the sales numbers.

### 4.7 Thin content and low replayability

- **Size.** 11 hand-made products in 5 categories, 25 event kinds and 4 ambitions.
- **Sameness.** Every run digs up the same 8 starting products. Stage 1 plays out the same way every time once
  learned.
- **Story.** It's linear: the same texts in the same order.

### 4.8 The market has no rivals

- **How competition works now.** Copycats are a percentage, market drift is three multipliers, and rival listings
  appear only inside quizzes.
- **What's missing.** There's no one to beat, no reaction to your moves, and no story of competition. A
  "Category King" ambition exists without a single named competitor.

### 4.9 People are counters

- **Scale.** 178 staff by stage 5 of seed 2, managed through +/− buttons and a raise button.
- **No characters.** Only one employee (Jordan, promoted to lead) has a name that matters. Sam and Maya, the
  emotional core of the story, never become part of the company.

### 4.10 UI overload and hidden causality

- **Apps.** 15 laptop apps, several with sub-tabs. The left panel stacks a goal note, the story card, the phone, the
  launch checklist, the diorama and a feed.
- **Hidden causality.** Many outcomes depend on multipliers the player never sees: trust parts, creative quality,
  market drift, audience fit.
- **Layout.** There is only one responsive breakpoint, so the game doesn't work on a phone.

### 4.11 Presentation drifts after stage 1

- **Later spaces are static.** The apartment is alive. The garage, warehouse, HQ and campus are tile boards with
  bobbing packers.
- **Nothing on screen shows the business.** The brand, products and trucks don't appear in the world.
- **Mixed art styles.** The pixel UI icons and Kenney's soft 3D furniture are two styles.
- **Little juice.** No cash counter roll, almost no sound design, and month reports are just tables.

### 4.12 Technical debt with player-facing risk

- **Save size.** About 42 KB on day 30, 700 KB on day 300, 1.9 MB on day 600 and 3.7 MB on day 720 (seed 2). The
  daily history keeps every per-product, per-channel and per-ad record forever.
  - Browsers cap localStorage at roughly 5 MB per site.
  - `save()` swallows the error, so **long games will silently stop saving**.
- **Speed.** Every action and every tick deep-clones the whole state: 28 ms at day 720, growing linearly. That's
  already a dropped frame on every click in the late game.
- **Tests.** The only tests are three balance runs. There are no tests for engine actions, save migration or the UI.
- **Saves.** One save slot, no export or import, no protection against a bad migration.
- **Bundle.** Over 500 KB in one chunk.

---

## 5. Vision: what "ten levels up" means

Five pillars to judge every change against:

1. **One real decision every day.** Pausing should be rare; every pause should be worth it. Automation should turn
   verbs into policies, never remove them.
2. **Readable cause and effect.** Every number explains itself on hover, and every mini-game's payoff shows up in a
   number you watch.
3. **The market pushes back.** Named rivals, trends that come and go, prices that move. You win by out-thinking
   someone, not by waiting.
4. **Your company is a place with people.** The diorama is the main screen; the people are characters; the brand is
   visible in the world.
5. **Your story, with consequences.** Choices branch, characters join you, and endings reflect the kind of founder
   you became.

---

## 6. The plan

Ordered so each phase makes the next one cheaper. Every task lists its acceptance check. Tags: **[sim]** engine and
data, **[ui]** React, **[scene]** Pixi, **[test]** tests.

### Phase 0: Foundations (do first; protects players' saves and every later change)

0.1 **Bounded history** [sim]

- Keep full daily records for the last 120 days only. Roll older days into monthly summaries that keep the P&L,
  `plSub`, per-product and per-channel slices.
- Trim `adStats` older than 30 days.
- Cap messages, notices, POs, deliveries and emails.
- Migrate existing saves.
- *Check:* the save is under 1 MB at day 1,000 on seed 2. The P&L tables, the charts and `periodPL` show the same
  totals as before (golden test).

0.2 **Storage that can't silently fail** [ui]

- Move saves to IndexedDB, with localStorage as a fallback.
- Add 3 save slots and an autosave rotation (keep the last 3 autosaves).
- Add JSON export and import.
- Show a visible warning if a save fails.
- *Check:* a 5 MB save round-trips. A forced failure shows a toast. Importing an old export migrates.

0.3 **Cheap actions and ticks** [sim]

- Replace whole-state `structuredClone` with Immer (structural sharing), or clone only on tick and mutate drafts of
  the touched branches.
- *Check:* an action takes under 5 ms and a tick under 10 ms at day 1,000.

0.4 **Notification triage** [sim] [ui]

- Classify notices as *decision* (pause), *important* (toast, no pause) or *ambient* (daily digest only).
- Add a "Yesterday" digest card that collapses things like "Payroll: −$X, 3 deliveries, 41 orders" into one line.
- Add a setting for what auto-pauses.
- *Check:* no more than 1 auto-pause per 5 game days on average (measured by bot). The feed shows no more than 10
  items a day.

0.5 **Test harness** [test]

- Engine action unit tests: buy, negotiate, ship, book, payout, story chapters.
- Save migration tests from fixture saves of each revision.
- A determinism snapshot.
- A Playwright smoke test: new game → intro → dig → first product → launch, through admin mode.
- CI on push.
- *Check:* CI is green; the tests cover every exported engine action.

0.6 **Code splitting** [ui]

- Lazy-load the late-game apps, the admin panel and the bots.
- *Check:* the first chunk is under 300 KB gzipped.

### Phase 1: Economy rebalance (make money matter at every stage)

1.1 **Realistic unit economics** [sim]

- Set the late-game targets: product cost 25–35% of revenue, marketing 12–25%, net margin 8–20%.
  - Reduce the stacked discounts: volume tiers, Megafab and contracts shouldn't multiply each other below about
    60% of base cost.
  - Make marketplace organic traffic decay with competition.
  - Make ad spend necessary to hold rank on marketplaces.
- *Check:* across the bots, net margin at day 600 sits between 8% and 20%. New balance tests assert those bands.

1.2 **Money sinks with returns** [sim] [ui] Late-game bets that compete for cash:

- **Brand campaigns:** TV, podcasts, out-of-home. A big spend that lifts brand awareness, decays over time, with
  diminishing returns.
- **R&D lines:** Product Lab becomes a pipeline with parallel projects and real failure odds.
- **Facilities:** automation tiers, regional hubs.
- **Acquisitions:** buy a small rival brand together with its product and its customers.
- **Retail expansion:** pop-up shops, then wholesale to chains with payment terms.
- *Check:* by stage 4, cash on hand rarely exceeds 3 months of expenses for a bot that invests sensibly.

1.3 **Fundraising** [sim] [ui]

- A seed round in stage 2, Series A in stage 3, B in stage 4, each with dilution and a board.
- Board KPIs create pressure with consequences: a missed target means a forced CEO-coach event, or eventually being
  replaced (a game over).
- *Check:* you can play bootstrapped or VC-funded, and both are viable with different curves.

1.4 **Dead and weak systems** [sim]

- Crafthaus is 1% of revenue: give it a niche (handmade or premium only; better margins, tiny volume) or remove it.
- Audit every system for impact: if switching it off changes profit by less than 1%, either deepen it or cut it.

1.5 **Failure as a spiral you can fight** [sim]

- Replace the bankruptcy cliff with distress states:
  - Late payments hurt supplier relationships.
  - Payroll cuts drop morale.
  - Inventory liquidation costs margin.
  - A turnaround mini-arc: the "Last 30 days" chapter, with emergency levers such as a fire sale, a bridge investor
    or selling a product line.
- *Check:* about 15% of naive bots hit distress on Normal and about half of those recover.

1.6 **Difficulty that bites on Normal** [sim]

- Rivals (Phase 2) provide the pressure. Tune so that on Normal a bot that never adds a product loses money by about
  day 400, while one that rotates products thrives.
- Add a test for each difficulty's intended outcome.

### Phase 2: Rivals and a living market

2.1 **Named rival brands** [sim]

- 2–4 per category, each with a personality: *cheap copier*, *premium brand*, *VC-funded blitzer*.
- They have products, prices, ratings, ad budgets and stock.
- Each week they act: undercut a price, copy your bestseller after N days, outbid your audience, run a sale, run out
  of stock (a chance for you).
- *Check:* the market screen shows a share chart per category, and rivals visibly react to your launches within
  2–4 weeks.

2.2 **Market share as the visible score** [ui]

- Per category: you vs rivals, plus price and rating positioning on a 2D map (price vs quality).
- Market drift becomes "rivals' pressure on this product", explainable on hover.

2.3 **Procedural trends** [sim]

- A trend generator: fads, seasonal rises, slow risers, collapses.
- Products appear with lifecycles drawn from distributions, so every run's market differs.
- Seeded, so runs stay reproducible.

2.4 **Procedural products** [sim] [data]

- Templates (category × form × material × feature) generate product variants with stats, benefits, complaints,
  hooks and photo slots.
- Keep the 11 hand-made "hero" products as anchors.
- *Check:* 60+ distinct products available in a run; two seeds share fewer than 50% of their starting leads.

2.5 **Price wars and promotions** [sim] [ui]

- Rival sales trigger "match or hold" decisions.
- Your price perception is relative to rivals, not to a fixed reference price.

### Phase 3: Core loop depth at every stage (verbs that evolve)

3.1 **The founder's week** [sim] [ui]

- Each Monday, plan founder focus with cards in slots (e.g. "Negotiate a supplier", "Shoot creatives", "Pitch a
  retailer", "Interview a hire", "Spend time with friends").
- The number of slots stays roughly constant across stages, but the cards change from doing to deciding.
- Founder hours become this budget instead of an invisible packing cap.
- *Check:* every stage has 4–8 meaningful choices per week; bots log their choices.

3.2 **Delegation as policies, not off-switches** [sim] [ui]

- Every automation (marketer, buyer, lead, support) is run by a policy the player tunes: targets, limits and
  priorities, plus a "manager style" from the hire.
- Bad policies have visible consequences: stockouts, wasted ad spend, angry customers.
- The ad policy already works this way; extend the pattern to the other roles.

3.3 **Stage verbs**

| Stage | The founder… | New core verbs |
|---|---|---|
| 1 Apartment | does everything | dig, sample, shoot, build, test ads, pack |
| 2 Garage | hires and teaches | interview, write playbooks (templates), negotiate terms, open channels |
| 3 Warehouse | builds systems | lay out the floor, set policies, plan inventory for seasons, fight rivals |
| 4 HQ | sets strategy | raise money, run brand campaigns, R&D pipeline, retail deals |
| 5 Established | allocates capital | acquisitions, portfolio, international, exit decisions |

3.4 **Seasonal planning** [sim] [ui]

- Two to three months before the holiday season and Big Bazaarly Days, a planning event asks you to commit:
  inventory depth, ad budget, promo calendar. Outcomes are judged against your plan.
- *Check:* the bots' holiday profit varies by more than 30% between good and bad plans.

3.5 **Shorter waits** [sim]

- Let samples overlap with research.
- Add a cheap express sample option.
- Batch "skip to next decision" smarter: show what's coming and how long until it arrives.

### Phase 4: Mini-games 2.0 (replayable skill, visible payoff)

Rules for every mini-game:

- **Procedural content.** Options come from data pools, never fixed answers.
- **Readable payoff.** Show the forecast before and after, in numbers ("CTR 1.9% → 2.3%").
- **Optional.** Every one can be skipped by paying money or delegating, at a worse expected result.
- **Short.** Under 60 seconds.

4.1 **Investigation and market scan.** Generate trend curves, rival listings and review text from product stats
and noise, so each read is a real judgement.

4.2 **Negotiation as a real mini-game.**

- Suppliers have hidden reservation prices and personalities; you see tells (reply speed, wording).
- Offers, counters and walkaways carry relationship stakes.
- Replaces the current "propose a price" form.

4.3 **Sample QA.** Spot defects on the rotating sample: scratches, wobble, smell notes. Missing them raises the
return rate later.

4.4 **Creative studio as an ad builder.**

- Assemble an ad from blocks: hook, visual, proof, offer, CTA.
- Rival ads come from a pool and change over time.
- Results come back as real CTR and CVR over the next days, not a quality percentage.

4.5 **Store builder as page layout.** Drag blocks onto a phone-sized page and run an instant "5-second test"
heatmap. Conversion changes visibly in the preview.

4.6 **Packing puzzle (optional speed bonus).** Fit products into the right box size and padding. Wrong boxes
cost shipping or cause damage. Speed matters only in stage 1–2.

4.7 **Hiring interviews.** Three short questions reveal candidates' traits (Phase 5).

4.8 **Remove or merge.** The ad-angle test and competitor ad research overlap: merge them into 4.4.

### Phase 5: People

5.1 **Named key people** [sim] [ui]

- Department heads are characters with portraits, traits (frugal, creative, steady, ambitious), skills that grow,
  salary expectations and loyalty.
- Rank-and-file staff stay counters.
- *Check:* the Team app shows 3–8 named people by stage 4, and their traits change outcomes measurably.

5.2 **Sam and Maya join the company** [sim] [story]

- Sam is the first hire (ops, loyal, a little chaotic). Maya can join as the designer or brand lead.
- Their choices and morale tie into the story.
- If friendship is neglected, they don't join, or they leave and later start a rival brand (feeding Phase 2).

5.3 **Team moments** [sim]

- Burnout, poaching (rivals hire your people), conflicts, promotions and celebrations.
- Each is a small choice with a visible effect.

5.4 **Culture dial** [sim]

- Hustle vs balance policy: output vs turnover and morale.
- Visible in the office scene: lights on late, empty desks.

### Phase 6: Story and characters 2.0

6.1 **Branching chapters** [sim] [data]

- Dad's deal outcomes branch:
  - **Win:** Dad becomes an advisor and unlocks his network.
  - **Lose:** night classes cost 1 founder slot a week until you prove yourself again.
- Payback order matters: pay Sam first and he invests, or he needs the car money back during a crisis.

6.2 **A rival founder** [sim] [story]

- A former classmate (VC-funded, smug, charming) launches into your category in stage 2–3. They're also one of the
  Phase 2 rivals.
- Their story arc runs parallel: they raise big, burn fast, then either crash or get acquired, possibly by you.

6.3 **Scenes in the diorama** [scene]

- Story beats play as short scenes in the world, with portraits and dialogue bubbles: Dad at the garage door, the
  graduation stage, Sam and Maya on the sofa.
- The phone stays the channel for quick texts.

6.4 **Multiple endings** [sim] [ui] The ending is shaped by ambition, relationships and how you ran the company:

- *Beloved brand* (small, profitable, friends on the team).
- *Category king* (beat the rival).
- *Unicorn* (VC path, IPO).
- *Sold* (acquisition exit).
- *Burnout* (won the money, lost the people).

Each ending gets an epilogue page and a corkboard photo.

### Phase 7: Presentation and feel

7.1 **The diorama becomes the main screen** [scene] [ui]

- Click the desk to open the laptop.
- Click boxes to see inventory, the truck or door for shipping, people for their card, the phone for messages.
- The laptop shrinks to an overlay you open, not a permanent half-screen.

7.2 **Living later spaces** [scene]

- Garage: Sam packing, Dad's shelves, the roll-up door with trucks.
- Warehouse: forklifts carrying pallets from the dock to the racks, packers at stations, a lead walking the floor.
- HQ: desks, meetings, a wall screen showing your live dashboard.
- Day and night in every space.
- Your brand color and logo show on boxes, the van and the building sign.

7.3 **One art direction** [ui] [scene] Pick one and apply it everywhere:

- **(a) Soft 3D iso**, matching Kenney: replace the pixel icons with a rounded flat icon set.
- **(b) Pixel/retro OS:** the laptop UI as a pixel operating system, matching the pixel icons. Recolor the Kenney
  furniture to a limited palette.

Recommendation: (b) for the laptop chrome, keeping Kenney in the world, with a palette shared across both.

7.4 **Juice** [ui] [scene]

- Cash counter rolls; coin sounds that scale with order size.
- A "cha-ching" stack that compresses 50 orders into one satisfying burst.
- The month report as an animated recap: biggest win, worst decision, best product, a quote from a customer.
- Music: lo-fi in the apartment, livelier per stage.

7.5 **Readability pass** [ui]

- Every derived number gets a "why?" hover showing its formula parts. `trustBreakdown` already does this for trust;
  generalize it to CPA, CVR, rank, drift and capacity.

### Phase 8: UX and onboarding

8.1 **Seven apps, not fifteen** [ui]

| App | Contents |
|---|---|
| Today | digest, decisions, mission |
| Products | research, catalog, lab |
| Marketing | ads, creators, email, creative studio |
| Sales | store, marketplaces, wholesale, pricing and offers |
| Operations | suppliers, inventory, warehouse, support |
| People | team, hiring, story phone |
| Money | finance, investors, company and stages |

SkillUp folds into the relevant apps as "learn" buttons.

8.2 **One mission panel** [ui] Merge the goal note, launch checklist and story card into one panel: the current
chapter, then the next 1–3 steps, then a "why".

8.3 **Progressive unlock with first-use guides** [ui]

- Systems unlock with the story.
- The first time a system opens, a 30-second interactive walk-through shows "the one thing to do here".

8.4 **Comfort** [ui]

- Undo the last action (within the same day).
- Keyboard shortcuts: space to pause, 1–4 for speed, D to skip, T for Today.
- Accessibility: a font-size setting, a high-contrast theme, reduced motion.

8.5 **Responsive layout** [ui] Tablet layout first (the diorama on top, apps as sheets), then phones.

### Phase 9: Meta and replayability

9.1 **Scenarios.** For example:

- *Shoestring* ($500, no family loan).
- *Fad hunter* (only fads appear).
- *Marketplace only* (no store).
- *Hard reset* (start in a warehouse with debt).
- A seeded *Daily challenge* with a leaderboard of profit at day 90 (optional, online later).

9.2 **New Game+ (legacy).** After an ending, start a new company with one legacy perk: Dad's network, a supplier
friend, a brand following, or Sam as co-founder.

9.3 **Achievements and the corkboard.** Fifty achievements across skill, story and playstyle, shown as polaroids.

### Phase 10: Distribution and learning from players

10.1 **PWA / offline**, then a desktop build (Tauri) for an itch.io and Steam demo.

10.2 **Opt-in local telemetry for playtests.** Time to first sale, pauses per day, where players quit, money at
each stage. Exported as JSON, so no backend is needed at first.

10.3 **In-game feedback button** that attaches the save and the last 30 days of state.

---

## 7. Order of work and milestones

Effort is in focused working sessions of mine; each milestone ends with tests green, a short changelog, and a
playtest build.

| Milestone | Content | Why first | Size |
|---|---|---|---|
| **M1: Solid ground** | 0.1–0.6 | Players losing saves is the worst bug; everything later needs fast actions and tests. | M |
| **M2: Calm and fair** | 0.4 (if not done), 1.1, 1.4, 1.5, 1.6 tuning, 3.5 | Fixes the two biggest feel problems (pause spam, runaway money) with existing systems. | M |
| **M3: Rivals** | 2.1, 2.2, 2.5, then 2.3 | The single biggest jump in "game-ness"; gives drift and difficulty a face. | L |
| **M4: Every stage plays** | 3.1–3.4, 1.2, 1.3 | Fixes the mid/late game collapse. | L |
| **M5: Mini-games 2.0** | 4.1, 4.2, 4.4, 4.5, 4.8 (then 4.3, 4.6, 4.7) | Replayability and skill. | M |
| **M6: People & story** | 5.1, 5.2, 6.1, 6.2, 6.4 | Emotional payoff; endings. | L |
| **M7: Place & feel** | 7.1–7.5 | Presentation leap; best done once systems settle. | L |
| **M8: Polish & reach** | 8.x, 2.4, 9.x, 10.x | Onboarding, content scale, meta, distribution. | L |

What to cut or postpone if time is short:

- Multiple brands (stage 5): fold them into acquisitions.
- International regions: keep as one "Go global" decision.
- Crafthaus, unless it gets a real niche.
- The daily leaderboard.

---

## 8. Targets to measure (bots plus playtests)

| Metric | Now | Target |
|---|---|---|
| Time to first sale (real minutes at 1×) | ~8–10 (estimate: bots sell on day ~16, plus setup time) | ≤ 8 |
| Auto-pauses per 5 game days | ~5 | ≤ 1 |
| Notifications per game day | ~2.5 | ≤ 1 shown, the rest in the digest |
| Net margin at day 600 (bots) | 35–46% | 8–20% |
| Cash / monthly expenses at stage 4 | 10–40× | 1–4× |
| Normal: naive bot in distress | 0% | ~15% (half recover) |
| Hard: non-adapting bot bankrupt | 100% | 60–80% |
| Hard: product-rotating bot wins | n/a | ≥ 70% |
| Meaningful choices per week (stage 3+) | ~1–2 | 4–8 |
| Distinct starting leads between two seeds | ~0% differ | ≥ 50% differ |
| Save size at day 1,000 | ~5+ MB (fails) | < 1 MB |
| Action latency at day 1,000 | ~30 ms | < 5 ms |
| Tests | 3 balance | balance + ~100 engine unit + migration + smoke |

---

## 9. Playtest plan

1. **Bot sweep per milestone:** 20 seeds × 3 difficulties, plus a margin, pause and save-size report. Automated as a
   script that writes a JSON summary.
2. **Five-player guerrilla test after M2 and M4.** First 30 minutes recorded. Ask "what would you do next?" every 5
   minutes. Note confusion points.
3. **Long-run test after M6:** two players play to an ending. Survey: which stage was boring, which decision felt
   best, would they play again?

---

## 10. First sprint (ready to start)

1. **History rollup (0.1)** with migration and a golden test comparing period P&L before and after.
2. **IndexedDB saves (0.2)**: slots, export and import, a save-failure toast.
3. **Immer (0.3)** in `store.act` and `tick`; measure.
4. **Notification triage (0.4)**: classify existing `notify()` calls, add a digest card, make pauses opt-in per
   category.
5. **Margin tuning (1.1)**: cap stacked discounts and add marketplace rank decay, with new balance assertions for
   margin bands.
6. **Bot report script (9.1)** to track every target in section 8 from now on.

Each of these is independently shippable.
