import { STARTING_DEBT, BRAND_COLORS, CITIES, FIRST_NAMES, FOUNDER_HOURS, LAST_INITIALS, MODULE_IDS, STARTING_CASH } from '../data';
import { def, emptyPL, hoursLeft, round2 } from '../economics';
import { pick } from '../rng';
import { startStory } from './story';
import { initRivals } from './rivals';
import { compactRecord, rollupHistory } from './history';
import { CHANNELS, hooksFor } from '../data';
import type { AdDay, AdSource, Brand, ChannelId, Creative, CreativeType, DailyRecord, Difficulty, GameState, MilestoneId, ModuleId, NoticeKind, OrderSource, PLCategory, ProductDef, ProductState, RoleId, Slice, StoryState } from '../types';

export type ActionResult = string | null;

export const MILESTONE_LABELS: Record<MilestoneId, string> = {
  first_sample: 'First samples unboxed',
  store_launched: 'Store is live',
  first_sale: 'First sale!',
  first_profitable_campaign: 'First profitable campaign',
  first_five_star: 'First 5★ review',
  first_repeat: 'First repeat customer',
  batch_packing: 'Batch packing unlocked',
  first_profitable_reorder: 'First profitable reorder',
  first_hire: 'First employee',
  moved_garage: 'Moving day: the garage',
  first_10k_month: 'First $10k month',
  first_creator: 'First creator collab',
  orders_1k: '1,000 orders shipped',
  moved_warehouse: 'Moving day: the warehouse',
  orders_10k: '10,000 orders shipped',
  first_supplier_agreement: 'First major supplier agreement',
  moved_hq: 'Moving day: the HQ',
  first_marketplace_sale: 'First marketplace sale',
  first_wholesale: 'First wholesale account',
  revenue_1m: '$1M lifetime revenue',
  moved_campus: 'Moving day: the campus',
  board_happy: 'The board is happy',
  rival_acquired: 'Bought a rival',
  first_exclusive: 'First exclusive product',
  first_international_sale: 'First international sale',
  second_brand: 'A second brand',
  ambition: 'Ambition achieved',
};

export const MILESTONE_PICS: Record<MilestoneId, string> = {
  first_sample: '📦',
  store_launched: '🚀',
  first_sale: '🔔',
  first_profitable_campaign: '🏆',
  first_five_star: '⭐',
  first_repeat: '💌',
  batch_packing: '🧰',
  first_profitable_reorder: '🎉',
  first_hire: '☕',
  moved_garage: '🚚',
  first_10k_month: '💰',
  first_creator: '🎬',
  orders_1k: '📮',
  moved_warehouse: '🏭',
  orders_10k: '🚛',
  first_supplier_agreement: '🤝',
  moved_hq: '🏢',
  first_marketplace_sale: '🅱️',
  first_wholesale: '🏪',
  revenue_1m: '💎',
  moved_campus: '🌆',
  board_happy: '💼',
  rival_acquired: '🏆',
  first_exclusive: '✨',
  first_international_sale: '🌍',
  second_brand: '🎨',
  ambition: '👑',
};

export function emptyModules(): Record<ModuleId, number> {
  return Object.fromEntries(MODULE_IDS.map((m) => [m, 0])) as Record<ModuleId, number>;
}

export function newBrand(id: number, name: string, day: number): Brand {
  return {
    id,
    name,
    color: BRAND_COLORS[id % BRAND_COLORS.length],
    createdDay: day,
    store: { launched: false, launchedDay: null, modules: emptyModules() },
    packaging: 'basic',
    thankYouCard: false,
    freeShipping: true,
    awareness: 0,
    customers: 0,
    email: { list: 0, flows: { welcome: false, postPurchase: false, winback: false }, lastCampaign: -99, fatigue: 0, pending: [] },
  };
}

export function defaultCreatives(d: ProductDef): Record<CreativeType, Creative> {
  const hooks = hooksFor(d);
  const benefit = hooks.find((h) => h.type === 'benefit')?.id ?? 'problem';
  return {
    white: { photo: 0, hook: benefit, cta: 'shop' },
    video: { photo: 0, hook: 'problem', cta: 'shop' },
    review: { photo: 0, hook: 'social', cta: 'shop' },
    ugc: { photo: 0, hook: 'emotional', cta: 'get' },
  };
}

export function newProduct(s: GameState, pid: string, brandId: number): ProductState {
  const d = def(s, pid);
  const p: ProductState = {
    id: pid,
    brandId,
    live: false,
    retired: false,
    addedDay: s.day,
    price: d.refPrice,
    bundle: false,
    discountPct: 0,
    photoStars: 0,
    photo: null,
    benefits: [],
    inventory: { onHand: 0, costTotal: 0, qualityTotal: 0 },
    ads: {},
    search: { active: false, budget: 20, history: [] },
    listings: {},
    reorder: { enabled: false, coverDays: 30, qty: 500, freight: 'sea', supplierId: null },
    ugc: false,
    creatives: defaultCreatives(d),
    copycat: 0,
    reviews: { count: 0, sum: 0, hist: [0, 0, 0, 0, 0] },
    sold: 0,
    returns: 0,
    stockoutDays: 0,
    daily: [],
    creatorBoost: [],
  };
  return p;
}

function team(): Record<RoleId, { count: number; morale: number; wageMult: number }> {
  const t = () => ({ count: 0, morale: 70, wageMult: 1 });
  return { packer: t(), support: t(), marketer: t(), buyer: t(), lead: t(), designer: t(), brandmgr: t() };
}

export function createGame(seed = Date.now(), difficulty: Difficulty = 'normal'): GameState {
  const s: GameState = {
    version: 2,
    skills: {},
    rivals: [],
    rivalLog: [],
    difficulty,
    story: newStory(),
    rng: seed | 0,
    day: 1,
    cash: STARTING_CASH,
    status: 'playing',
    won: false,
    stage: 1,
    space: 'apartment',
    products: {},
    productOrder: [],
    customDefs: {},
    revealed: [],
    brands: [newBrand(1, '', 1)],
    samples: [],
    relationship: { quickmake: 50, brightway: 50, atelier: 50, megafab: 45 },
    supplierUnits: { quickmake: 0, brightway: 0, atelier: 0, megafab: 0 },
    contracts: [],
    negotiation: null,
    pos: [],
    channels: { store: { joined: true, joinedDay: 1 } },
    channelAccrued: {},
    feeOverrides: {},
    backlog: [],
    deliveries: [],
    handPacked: 0,
    batchPacking: false,
    shipped: 0,
    reviewsRecent: [],
    cards: [],
    tickets: { queue: [], handled: 0, dropped: 0 },
    support: { autoRefundUnder: 30, tone: 'template' },
    events: [],
    eventCooldowns: {},
    bills: [{ id: 1, dueDay: 30, label: 'Rent', amount: 900, everyDays: 30, category: 'rent' }],
    receivables: [],
    payables: [],
    history: [],
    reports: [],
    milestones: {},
    notices: [],
    hoursUsed: 0,
    extraHours: 0,
    team: team(),
    people: [],
    shifts: 1,
    thirdParty: false,
    layout: { w: 0, h: 0, cells: [] },
    automation: { labelPrinter: false, scanners: false },
    credit: { unlocked: false, balance: 0, limit: 0 },
    loan: null,
    regions: {},
    wholesale: [],
    lab: [],
    adPolicy: { maxSharePct: 20, floor: 100, marginPct: 25, pauseOOS: true },
    autopilot: { staffing: false, buildout: false },
    research: {},
    positioning: {},
    angleTested: {},
    modifiers: [],
    emails: [],
    creatorPosts: [],
    shortlist: [],
    ambition: null,
    ambitionsDone: [],
    stageOffer: null,
    discountFatigue: 0,
    flags: { timeCosts: true },
    counters: { revenueLifetime: 0, runSeed: (seed >>> 0) % 1_000_000 },
    seq: 100,
    lastDayOrders: 0,
  };
  initRivals(s);
  startStory(s);
  return s;
}

// ───────────────────────────── helpers ─────────────────────────────

export function nextId(s: GameState): number {
  return ++s.seq;
}

export function notify(s: GameState, kind: NoticeKind, text: string, pause = false): void {
  s.notices.push({ id: nextId(s), day: s.day, kind, text, pause });
  if (s.notices.length > 80) s.notices.splice(0, s.notices.length - 80);
}

export function milestone(s: GameState, id: MilestoneId, label?: string): void {
  if (s.milestones[id]) return;
  s.milestones[id] = s.day;
  notify(s, 'milestone', label ?? MILESTONE_LABELS[id], true);
}

/** Hands-on work: costs founder hours while the founder still does everything (stages 1–2); free after that. */
export function workTime(s: GameState, hours: number): ActionResult {
  if (s.stage >= 3) return null;
  return useHours(s, hours);
}

export function useHours(s: GameState, hours: number): ActionResult {
  if (hoursLeft(s) + 1e-9 < hours) return 'You’re out of founder hours today. Wait for tomorrow (or call a friend).';
  s.hoursUsed += hours;
  return null;
}

export function newRecord(day: number): DailyRecord {
  return {
    day,
    cash: 0,
    orders: 0,
    units: 0,
    repeatOrders: 0,
    intlOrders: 0,
    visits: 0,
    impressions: 0,
    pl: emptyPL(),
    channelRevenue: {},
    productOrders: {},
    brandRevenue: {},
    brandCost: {},
    productPL: {},
    channelPL: {},
    adStats: {},
    sources: {},
  };
}

export function emptySlice(): Slice {
  return { orders: 0, units: 0, revenue: 0, refunds: 0, cogs: 0, fees: 0, fulfillment: 0, thirdParty: 0, ads: 0 };
}

const SLICE_KEYS: Partial<Record<PLCategory, keyof Slice>> = { revenue: 'revenue', refunds: 'refunds', cogs: 'cogs', fees: 'fees', fulfillment: 'fulfillment', ads: 'ads' };

/** Add to today's per-product / per-channel slices. */
export function slice(s: GameState, pid: string | undefined, ch: ChannelId | undefined, key: keyof Slice, amount: number): void {
  const r = today(s);
  if (pid) (r.productPL[pid] ??= emptySlice())[key] += amount;
  if (ch) (r.channelPL[ch] ??= emptySlice())[key] += amount;
}

/** Default breakdown line for a P&L entry: product for sales lines, channel for fees. */
function subLabel(s: GameState, cat: PLCategory, pid?: string, ch?: ChannelId): string {
  if ((cat === 'revenue' || cat === 'cogs' || cat === 'fulfillment' || cat === 'refunds') && pid && s.products[pid]) return def(s, pid).name;
  if (cat === 'fees' && ch) return `${CHANNELS[ch].name} fees`;
  return 'Other';
}

/** Record ad results for one product and source on today's row. */
export function adStat(s: GameState, pid: string, src: AdSource, patch: Partial<AdDay>): void {
  const r = today(s);
  const row = ((r.adStats[pid] ??= {})[src] ??= { spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0 });
  for (const [k, v] of Object.entries(patch)) row[k as keyof AdDay] += v ?? 0;
}

export function countSource(s: GameState, src: OrderSource, orders: number): void {
  const r = today(s);
  r.sources[src] = (r.sources[src] ?? 0) + orders;
}

/** Today's ledger row. Actions taken during a day book into it so the P&L sees every dollar. */
export function today(s: GameState): DailyRecord {
  let r = s.history[s.history.length - 1];
  if (!r || r.day !== s.day) {
    r = newRecord(s.day);
    s.history.push(r);
  }
  return r;
}

/** Record an expense or income in the P&L for today and move the cash. */
export function book(s: GameState, cat: PLCategory, amount: number, opts: { cash?: boolean; brandId?: number; productId?: string; channel?: ChannelId; sub?: string } = {}): void {
  const r = today(s);
  r.pl[cat] += amount;
  const sub = opts.sub ?? subLabel(s, cat, opts.productId, opts.channel);
  const lines = ((r.plSub ??= {})[cat] ??= {});
  lines[sub] = (lines[sub] ?? 0) + amount;
  const key = SLICE_KEYS[cat];
  if (key && (opts.productId || opts.channel)) slice(s, opts.productId, opts.channel, key, amount);
  if (opts.brandId !== undefined) {
    if (cat === 'revenue') r.brandRevenue[opts.brandId] = (r.brandRevenue[opts.brandId] ?? 0) + amount;
    else r.brandCost[opts.brandId] = (r.brandCost[opts.brandId] ?? 0) + amount;
  }
  if (opts.cash !== false) s.cash = round2(s.cash + (cat === 'revenue' ? amount : -amount));
}

/** Spend cash on something that is an expense right now (P&L category given). */
export function spendOn(s: GameState, cat: PLCategory, amount: number, brandId?: number, sub?: string): ActionResult {
  if (s.cash < amount) return `Not enough cash. You need $${Math.ceil(amount).toLocaleString()}.`;
  book(s, cat, amount, { brandId, sub });
  return null;
}

/** Spend cash that buys an asset (inventory, deposits, loan repayment): not an expense. */
export function spendCash(s: GameState, amount: number): ActionResult {
  if (s.cash < amount) return `Not enough cash. You need $${Math.ceil(amount).toLocaleString()}.`;
  s.cash = round2(s.cash - amount);
  return null;
}

export function randomCustomer(s: GameState): { name: string; city: string } {
  return { name: `${pick(s, FIRST_NAMES)} ${pick(s, LAST_INITIALS.split(''))}.`, city: pick(s, CITIES) };
}

export function setFlag(s: GameState, key: string): void {
  s.flags[key] = true;
}

export function founderHours(): number {
  return FOUNDER_HOURS;
}

/** Bring older saves up to the current shape. */
/** The founder's personal story: the chapter they're on, who they owe, and the people around them. */
export function newStory(): StoryState {
  return { chapter: 'dropout', chapterStart: 1, best30: 0, scenes: [], debt: { ...STARTING_DEBT }, bond: { mom: 70, dad: 15, sam: 70, maya: 60 }, messages: [], beats: {} };
}

export function migrate(s: GameState): GameState {
  if (!s.skills) {
    // Saves from before SkillUp: you already know how to do what you've been doing.
    s.skills = { adsBasics: { progress: 4 }, searchAds: { progress: 4 }, researchTool: { progress: 0, active: true }, adSpy: { progress: 0, active: true } };
  }
  if (!s.flags.timeCosts) {
    // Saves from before ad accounts and the economics course: keep what already worked.
    s.flags.timeCosts = true;
    if (s.skills.adsBasics || s.history.some((r) => r.pl.ads > 0)) s.flags.adAccount = true;
    if (s.skills.adsBasics) s.skills.economics ??= { progress: 3 };
  }
  s.difficulty ??= 'normal';
  if (!s.rivals) initRivals(s);
  if (!s.story) {
    s.story = newStory();
    s.story.beats = { intro: 1, older: 1 };
  }
  if (!s.story.chapter) {
    // Saves from before chapters: start the arc where the business is.
    Object.assign(s.story, { chapter: s.shipped ? 'deal' : 'dropout', chapterStart: s.day, best30: 0, scenes: [] });
    delete (s.story as unknown as Record<string, unknown>).energy;
  }
  for (const b of s.brands) if (b.store.quality === undefined) b.store.quality = b.store.launched ? 0.6 : null;
  s.adPolicy ??= { maxSharePct: 20, floor: 100, marginPct: 25 };
  s.adPolicy.marginPct ??= 25;
  s.adPolicy.pauseOOS ??= true;
  s.autopilot ??= { staffing: false, buildout: false };
  s.research ??= {};
  s.shortlist ??= [];
  s.creatorPosts ??= [];
  s.payables ??= [];
  s.modifiers ??= [];
  s.emails ??= [];
  s.positioning ??= {};
  s.angleTested ??= {};
  for (const b of s.brands) b.email.queue ??= [];
  for (const id of Object.keys(s.products)) s.products[id].creatives ??= defaultCreatives(def(s, id));
  for (const r of s.history) {
    r.productPL ??= {};
    r.channelPL ??= {};
    r.adStats ??= {};
    r.sources ??= {};
  }
  for (const r of s.history) {
    r.pl.tax ??= 0;
    compactRecord(r);
  }
  for (const m of s.archive ?? []) m.pl.tax ??= 0;
  rollupHistory(s);
  s.rev = 1;
  return s;
}
