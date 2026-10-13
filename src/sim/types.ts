export type CategoryId = 'pets' | 'home' | 'desk' | 'kitchen' | 'fitness';
export type SupplierId = 'quickmake' | 'brightway' | 'atelier' | 'megafab';
export type ChannelId = 'store' | 'loopshop' | 'bazaarly' | 'crafthaus' | 'flashcart';
export type RegionId = 'eu' | 'uk' | 'jp' | 'au';
export type StageId = 1 | 2 | 3 | 4 | 5;
export type SpaceId = 'apartment' | 'garage' | 'warehouse' | 'hq' | 'campus';
export type RoleId = 'packer' | 'support' | 'marketer' | 'buyer' | 'lead' | 'designer' | 'brandmgr';
export type AmbitionId = 'beloved' | 'giant' | 'king' | 'portfolio';
export type Freight = 'air' | 'sea';
export type Packaging = 'basic' | 'sturdy' | 'branded';
export type CreativeType = 'white' | 'video' | 'review' | 'ugc';
export type TileId = 'rack' | 'station' | 'conveyor' | 'robot';
export type AdSource = 'scrollr' | 'seekly' | 'creator' | 'sponsored';
export type OrderSource = AdSource | 'organic' | 'marketplace' | 'repeat' | 'email' | 'flow' | 'wholesale';
export type CampaignType = 'promo' | 'review' | 'replenish' | 'launch' | 'story';
export type Segment = 'all' | 'recent' | 'lapsed' | 'vip';

export interface EmailCampaign {
  id: number;
  day: number;
  brandId: number;
  type: CampaignType;
  segment: Segment;
  discount: number;
  productId?: string;
  sent: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
  orders: number;
  revenue: number;
  reviews: number;
  cost: number;
}
export type HookType = 'problem' | 'benefit' | 'emotional' | 'social' | 'urgency';
export type Cta = 'shop' | 'learn' | 'get';
export type PLCategory =
  | 'revenue'
  | 'refunds'
  | 'cogs'
  | 'fulfillment'
  | 'fees'
  | 'ads'
  | 'payroll'
  | 'rent'
  | 'other'
  | 'interest'
  | 'tax';
export type ModuleId =
  | 'header'
  | 'hero'
  | 'gallery'
  | 'description'
  | 'reviews'
  | 'badges'
  | 'faq'
  | 'shipping'
  | 'checkout';

export type MilestoneId =
  | 'first_sample'
  | 'store_launched'
  | 'first_sale'
  | 'first_profitable_campaign'
  | 'first_five_star'
  | 'first_repeat'
  | 'batch_packing'
  | 'first_profitable_reorder'
  | 'first_hire'
  | 'moved_garage'
  | 'first_10k_month'
  | 'first_creator'
  | 'orders_1k'
  | 'moved_warehouse'
  | 'orders_10k'
  | 'first_supplier_agreement'
  | 'moved_hq'
  | 'first_marketplace_sale'
  | 'first_wholesale'
  | 'revenue_1m'
  | 'moved_campus'
  | 'first_exclusive'
  | 'first_international_sale'
  | 'second_brand'
  | 'board_happy'
  | 'rival_acquired'
  | 'ambition';

// ───────────────────────────── static definitions ─────────────────────────────

export interface AudienceDef {
  id: string;
  name: string;
  desc: string;
  cpm: number;
  elasticity: number;
  cvrFit: number;
  /** Daily budget at which the audience starts saturating and CPM climbs. */
  scale: number;
}

export interface CategoryDef {
  id: CategoryId;
  name: string;
  emoji: string;
  audiences: [AudienceDef, AudienceDef];
  /** Orders per day across all sellers in the home market. */
  marketSize: number;
  topCompetitor: { name: string; share: number };
}

export interface BenefitDef {
  id: string;
  text: string;
  cvr: number;
  returns: number;
}

export interface PhotoChoice {
  backdrop: 'countertop' | 'floor' | 'sheet';
  light: 'window' | 'lamp' | 'overhead';
  prop: 'none' | 'cat' | 'accessory';
  angle: 'top' | 'angled' | 'eye';
  /** Framing: product position in the frame (0..1) and camera zoom. */
  x?: number;
  y?: number;
  zoom?: number;
}

export type ModKey = 'adCost' | 'adCtr' | 'seaFreight' | 'airFreight' | 'unitCost' | 'packaging' | 'cvr' | 'creditRate' | 'creditLimit' | 'shipping' | 'quality' | 'packRate' | 'refunds' | 'repeat';

export interface Modifier {
  id: number;
  key: ModKey;
  /** Optional scope, e.g. a supplier id for unitCost. */
  scope?: string;
  mult: number;
  until: number;
  label: string;
}

export interface Creative {
  photo: number;
  hook: string;
  cta: Cta;
}

/** One slice of the P&L, used per product and per channel. */
export interface Slice {
  orders: number;
  units: number;
  revenue: number;
  refunds: number;
  cogs: number;
  fees: number;
  fulfillment: number;
  thirdParty: number;
  ads: number;
}

export interface AdDay {
  spend: number;
  impressions: number;
  clicks: number;
  orders: number;
  revenue: number;
}

export interface TrendDef {
  kind: 'evergreen' | 'fad' | 'seasonal';
  /** Fads: absolute game day of peak popularity. */
  peakDay?: number;
  /** Seasonal: day-of-year window [start, end] and multiplier inside it. */
  season?: [number, number, number];
}

export interface ProductDef {
  id: string;
  name: string;
  emoji: string;
  category: CategoryId;
  tagline: string;
  bars: { demand: number; competition: number; margin: number; lifespan: number };
  lifespanNote: string;
  refPrice: number;
  baseCVR: number;
  baseUnitCost: number;
  airFreight: number;
  seaFreight: number;
  shipToCustomer: number;
  /** Storage footprint per unit (1 = a shoebox). */
  size: number;
  /** How often customers come back for more (filters, refills…). */
  repeatability: number;
  trend: TrendDef;
  unlockStage: StageId;
  /** Game day this product first shows up in the Trend Scanner. */
  appearsDay: number;
  videoHook: string;
  searchVolume: number;
  benefits: BenefitDef[];
  bestPhoto: PhotoChoice;
  photoTip: string;
  accessoryName: string;
  sampleNotes?: Partial<Record<SupplierId, string>>;
  exclusive?: boolean;
  baseId?: string;
  qualityBonus?: number;
  /** What a deep-dive research turns up: complaints about rivals, audience hints, pricing. */
  insights?: string[];
}

export interface SupplierDef {
  id: SupplierId;
  company: string;
  contact: string;
  city: string;
  avatar: string;
  priceMult: number;
  moq: number;
  quality: number;
  qualityStars: number;
  reliability: number;
  reliabilityStars: number;
  productionDays: number;
  room: number;
  style: 'folds' | 'fair' | 'firm';
  blurb: string;
  unlockStage: StageId;
}

export interface ModuleDef {
  id: ModuleId;
  name: string;
  icon: string;
  desc: string;
  tiers: { name: string; cost: number }[];
  required?: boolean;
}

export interface ChannelDef {
  id: ChannelId;
  name: string;
  emoji: string;
  desc: string;
  unlockStage: StageId;
  feePct: number;
  feeFlat: number;
  payoutEvery: number;
  /** Visits/day per demand bar for a listing at rank 1.0. */
  traffic: number;
  cvrMult: number;
  joinCost: number;
  monthlyFee: number;
  minQuality?: number;
  minPriceRatio?: number;
  maxPriceRatio?: number;
  program?: { name: string; feePerUnit: number; cvrBonus: number };
  /** Share of buyers who become your brand's own customers. */
  loyalty: number;
}

export interface RegionDef {
  id: RegionId;
  name: string;
  flag: string;
  demand: number;
  setupCost: number;
  warehouseRent: number;
  duty: number;
  shipMult: number;
}

export interface RoleDef {
  id: RoleId;
  name: string;
  emoji: string;
  wage: number;
  unlockStage: StageId;
  seat: 'floor' | 'office';
  desc: string;
  firstName: string;
}

export interface SpaceDef {
  id: SpaceId;
  stage: StageId;
  name: string;
  desc: string;
  rent: number;
  deposit: number;
  storage: number;
  officeSeats: number;
  floorSeats: number;
  grid?: [number, number];
}

// ───────────────────────────── dynamic state ─────────────────────────────

export interface Sample {
  productId: string;
  supplierId: SupplierId;
  arrivesDay: number;
  arrived: boolean;
  inspected: boolean;
}

export interface Negotiation {
  productId: string;
  supplierId: SupplierId;
  qty: number;
  round: number;
  counter: number | null;
  agreedPrice: number | null;
  final: boolean;
  lastMessage: string;
  /** Lowballs left before the supplier ends the call. */
  patience?: number;
  /** Non-price levers you've offered (each lowers their floor). */
  levers?: NegotiationLever[];
  closed?: boolean;
}

export type NegotiationLever = 'flexible' | 'repeat' | 'upfront';

export type POStatus = 'production' | 'transit' | 'arrived';

export interface PurchaseOrder {
  id: number;
  productId: string;
  supplierId: SupplierId;
  qty: number;
  unitPrice: number;
  freight: Freight;
  freightPerUnit: number;
  inspection: boolean;
  placedDay: number;
  productionDoneDay: number;
  arrivesDay: number;
  status: POStatus;
  quality: number;
  isReorder: boolean;
  delayDays: number;
  totalCost: number;
  /** Amount still owed to the supplier (payment terms). */
  balanceDue: number;
  /** Net-30 terms: the balance is paid 30 days after delivery instead of at shipping. */
  net30?: boolean;
  auto: boolean;
}

export interface AdCell {
  key: string;
  audienceId: string;
  creative: CreativeType;
  active: boolean;
  budget: number;
  daysActive: number;
  totals: { spend: number; impressions: number; clicks: number; orders: number };
  history: { day: number; spend: number; impressions: number; clicks: number; orders: number }[];
}

export interface Listing {
  active: boolean;
  price: number;
  rank: number;
  program: boolean;
  promoUntil: number;
  promoCooldown: number;
  sponsored: number;
  recent: number[];
  /** Sponsored-listing results, newest last (14 days). */
  adHistory?: { day: number; spend: number; orders: number }[];
}

export interface ReorderRule {
  enabled: boolean;
  coverDays: number;
  qty: number;
  freight: Freight;
  supplierId: SupplierId | null;
}

export interface ProductState {
  id: string;
  brandId: number;
  live: boolean;
  retired: boolean;
  addedDay: number;
  price: number;
  bundle: boolean;
  discountPct: number;
  photoStars: number;
  photo: PhotoChoice | null;
  benefits: string[];
  inventory: { onHand: number; costTotal: number; qualityTotal: number };
  ads: Record<string, AdCell>;
  search: { active: boolean; budget: number; history: { day: number; spend: number; clicks: number; orders: number }[] };
  listings: Partial<Record<ChannelId, Listing>>;
  reorder: ReorderRule;
  ugc: boolean;
  creatives: Record<CreativeType, Creative>;
  copycat: number;
  reviews: { count: number; sum: number; hist: [number, number, number, number, number] };
  sold: number;
  returns: number;
  stockoutDays: number;
  /** Recent daily orders, newest last (14 days). */
  daily: number[];
  creatorBoost: number[];
  /** How this product's market has drifted since you started selling it (1 = launch level). */
  market?: { ad: number; cost: number; /** Share of demand left as competitors pile in (1 = all of it). */ share?: number };
  /** 0..1 from competitor creative research: better-researched ads click and convert better. */
  creativeQuality?: number;
}

export type Vibe = 'playful' | 'clean' | 'cozy' | 'bold' | 'minimal';

export interface PackDesign {
  color: Vibe;
  print: 'plain' | 'logo' | 'pattern';
  insert: 'none' | 'tissue' | 'sticker';
}

export interface Brand {
  id: number;
  packDesign?: PackDesign;
  /** 0..1, how well the packaging fits the brand's category. */
  packScore?: number;
  theme?: Vibe;
  name: string;
  color: string;
  createdDay: number;
  store: { launched: boolean; launchedDay: number | null; modules: Record<ModuleId, number>; order?: ModuleId[]; /** 0..1 from the store builder; null until built. */ quality?: number | null; /** Day the build finishes and the store can launch. */ readyDay?: number };
  packaging: Packaging;
  thankYouCard: boolean;
  freeShipping: boolean;
  awareness: number;
  customers: number;
  email: { list: number; flows: { welcome: boolean; postPurchase: boolean; winback: boolean }; lastCampaign: number; fatigue: number; pending: number[]; queue?: { id: number; days: number[]; productId?: string; discount: number }[] };
}

export interface BacklogBucket {
  day: number;
  productId: string;
  channel: ChannelId;
  orders: number;
  units: number;
  revenue: number;
  intl: number;
  /** Named customer for the first hand-packed orders. */
  customer?: string;
  city?: string;
}

export interface Delivery {
  dueDay: number;
  productId: string;
  channel: ChannelId;
  orders: number;
  revenue: number;
  quality: number;
  delayDays: number;
  damageRate: number;
}

export interface Review {
  day: number;
  productId: string;
  stars: number;
  author: string;
  text: string;
}

export type CardKind = 'damaged' | 'defect' | 'late';

export interface CardChoice {
  id: string;
  label: string;
  hint: string;
}

export interface CustomerCard {
  id: number;
  kind: CardKind;
  day: number;
  expiresDay: number;
  productId: string;
  customer: string;
  avatar: string;
  message: string;
  revenue: number;
  choices: CardChoice[];
}

export interface GameEvent {
  id: number;
  kind: string;
  day: number;
  title: string;
  body: string;
  choices: CardChoice[];
  blocking: boolean;
  expiresDay?: number;
  data?: Record<string, number | string>;
}

export interface Bill {
  id: number;
  dueDay: number;
  label: string;
  amount: number;
  everyDays?: number;
  category: PLCategory;
}

export interface Receivable {
  dueDay: number;
  amount: number;
  label: string;
}

/** A calendar month of history, rolled up once its days are older than the daily window. */
export interface ArchiveMonth {
  key: number;
  fromDay: number;
  toDay: number;
  days: number;
  cash: number;
  orders: number;
  repeatOrders: number;
  pl: Record<PLCategory, number>;
  plSub: Partial<Record<PLCategory, Record<string, number>>>;
  channelRevenue: Partial<Record<ChannelId, number>>;
  brandRevenue: Record<number, number>;
  brandCost: Record<number, number>;
  productPL: Record<string, Slice>;
  channelPL: Partial<Record<ChannelId, Slice>>;
}

export interface DailyRecord {
  day: number;
  cash: number;
  orders: number;
  units: number;
  repeatOrders: number;
  intlOrders: number;
  visits: number;
  impressions: number;
  pl: Record<PLCategory, number>;
  channelRevenue: Partial<Record<ChannelId, number>>;
  productOrders: Record<string, number>;
  brandRevenue: Record<number, number>;
  brandCost: Record<number, number>;
  productPL: Record<string, Slice>;
  channelPL: Partial<Record<ChannelId, Slice>>;
  adStats: Record<string, Partial<Record<AdSource, AdDay>>>;
  sources: Partial<Record<OrderSource, number>>;
  /** Orders you pack and ship yourself (excludes marketplace-fulfilled). */
  ownOrders?: number;
  sourceRevenue?: Partial<Record<OrderSource, number>>;
  /** P&L lines broken down one level (product, channel, ad source, team, item). */
  plSub?: Partial<Record<PLCategory, Record<string, number>>>;
}

export interface MonthReport {
  month: number;
  fromDay: number;
  toDay: number;
  pl: Record<PLCategory, number>;
  profit: number;
  orders: number;
  highlights: string[];
}

export type NoticeKind = 'sample' | 'po' | 'card' | 'event' | 'milestone' | 'cash' | 'info' | 'sale' | 'team';

export interface Notice {
  id: number;
  day: number;
  kind: NoticeKind;
  text: string;
  pause: boolean;
}

export interface Team {
  count: number;
  morale: number;
  wageMult: number;
}

export type Trait = 'frugal' | 'creative' | 'steady' | 'ambitious' | 'loyal';

export interface Person {
  role: RoleId;
  name: string;
  hiredDay: number;
  morale: number;
  promoted: boolean;
  trait?: Trait;
  /** Sam or Maya. */
  friend?: CharacterId;
}

export interface Contract {
  supplierId: SupplierId;
  startDay: number;
  endDay: number;
  commitUnits: number;
  orderedUnits: number;
  discount: number;
}

export interface WholesaleOrder {
  id: number;
  account: string;
  productId: string;
  qty: number;
  unitPrice: number;
  dueDay: number;
  shipped: boolean;
  recurring: number;
}

export interface LabProject {
  id: number;
  baseId: string;
  name: string;
  levels: { materials: number; design: number; features: number };
  startDay: number;
  doneDay: number;
  cost: number;
  done: boolean;
}

export interface GameState {
  version: 2;
  /** Schema revision inside v2, for migrating saves. */
  rev?: number;
  rng: number;
  day: number;
  cash: number;
  status: 'playing' | 'lost';
  won: boolean;
  stage: StageId;
  space: SpaceId;
  products: Record<string, ProductState>;
  productOrder: string[];
  customDefs: Record<string, ProductDef>;
  revealed: string[];
  brands: Brand[];
  samples: Sample[];
  relationship: Record<SupplierId, number>;
  supplierUnits: Record<SupplierId, number>;
  contracts: Contract[];
  negotiation: Negotiation | null;
  pos: PurchaseOrder[];
  channels: Partial<Record<ChannelId, { joined: boolean; joinedDay: number }>>;
  channelAccrued: Partial<Record<ChannelId, number>>;
  feeOverrides: Partial<Record<ChannelId, number>>;
  backlog: BacklogBucket[];
  deliveries: Delivery[];
  handPacked: number;
  batchPacking: boolean;
  shipped: number;
  reviewsRecent: Review[];
  cards: CustomerCard[];
  tickets: { queue: { day: number; count: number; kind: CardKind; revenue: number; productId: string }[]; handled: number; dropped: number };
  support: { autoRefundUnder: number; tone: 'template' | 'personal'; templates?: Partial<Record<CardKind, string>>; outsource?: boolean };
  events: GameEvent[];
  eventCooldowns: Record<string, number>;
  bills: Bill[];
  receivables: Receivable[];
  /** Money owed to suppliers on net terms (not an expense: it's inventory). */
  payables: Receivable[];
  /** Full daily records for the most recent days only (see HISTORY_DAYS). */
  history: DailyRecord[];
  /** Older days rolled up by calendar month, oldest first. */
  archive?: ArchiveMonth[];
  reports: MonthReport[];
  milestones: Partial<Record<MilestoneId, number>>;
  notices: Notice[];
  hoursUsed: number;
  extraHours: number;
  team: Record<RoleId, Team>;
  people: Person[];
  shifts: 1 | 2;
  thirdParty: boolean;
  layout: { w: number; h: number; cells: (TileId | null)[] };
  automation: { labelPrinter: boolean; scanners: boolean };
  credit: { unlocked: boolean; balance: number; limit: number };
  loan: { amount: number; dueDay: number; principal: number; label: string } | null;
  regions: Partial<Record<RegionId, { entered: boolean; warehouse: boolean; day: number }>>;
  wholesale: WholesaleOrder[];
  lab: LabProject[];
  adPolicy: { maxSharePct: number; floor: number; marginPct: number; /** Skip ad spend on products with no stock; resumes when stock arrives. */ pauseOOS?: boolean };
  /** Temporary deals and effects from offers, e.g. { key: 'seaFreight', mult: 0.75, until: 120 }. */
  modifiers: Modifier[];
  autopilot: { staffing: boolean; buildout: boolean };
  research: Record<string, number>;
  /** Benefit that answers the top complaint about rivals, found in a market scan. */
  positioning: Record<string, string>;
  /** Score (0-3) of the ad-angle test per product. */
  angleTested: Record<string, number>;
  emails: EmailCampaign[];
  creatorPosts: { day: number; productId: string; tier: string; cost: number; viral: boolean; handle: string }[];
  shortlist: string[];
  ambition: AmbitionId | null;
  ambitionsDone: AmbitionId[];
  stageOffer: StageId | null;
  discountFatigue: number;
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  /** This week's founder focus (FOCUS ids) and the week it was set for. */
  focus?: { week: number; picks: string[] };
  /** Big brand campaigns running (podcasts, billboards, TV). */
  campaigns?: { kind: string; start: number; days: number; perDay: number }[];
  /** Venture funding: rounds raised and the board's current target. */
  funding?: { raised: string[]; interest: number; board?: { round: string; target: number; deadline: number; warned?: boolean } };
  /** How the story ended, once it has. */
  ending?: { id: EndingId; day: number; payout?: number; seen?: boolean };
  /** Named rival brands competing in each category. */
  rivals: Rival[];
  rivalLog: { day: number; rivalId: number; text: string }[];
  /** Courses, software and gear bought in SkillUp. */
  skills: Partial<Record<SkillId, SkillState>>;
  difficulty: Difficulty;
  story: StoryState;
  seq: number;
  lastDayOrders: number;
}

// ───────────────────────────── skills, difficulty, story ─────────────────────────────

export type SkillId =
  | 'adsBasics'
  | 'adsAdvanced'
  | 'searchAds'
  | 'copywriting'
  | 'photography'
  | 'storeCourse'
  | 'researchTool'
  | 'adSpy'
  | 'tapeGun'
  | 'scale'
  | 'labelPrinter'
  | 'packBench';

export interface SkillDef {
  id: SkillId;
  name: string;
  kind: 'course' | 'software' | 'gear';
  /** Emoji key, drawn as a pixel icon by the UI. */
  icon: string;
  cost: number;
  /** Software is billed monthly. */
  monthly?: number;
  /** Founder hours to finish a course. */
  hours?: number;
  requires?: SkillId[];
  desc: string;
  effect: string;
}

export interface SkillState {
  /** Hours studied (courses). */
  progress: number;
  /** Software subscription running. */
  active?: boolean;
}

export type Difficulty = 'relaxed' | 'normal' | 'hard';

export type CharacterId = 'mom' | 'dad' | 'sam' | 'maya';

export interface StoryMessage {
  id: number;
  day: number;
  from: CharacterId;
  text: string;
  choices?: { id: string; label: string; hint?: string }[];
  /** Choice made (or 'expired'). */
  answer?: string;
  /** Unanswered choices fall back to the last option on this day. */
  expires?: number;
  read?: boolean;
  /** Which beat produced it, so choices can be resolved. */
  beat: string;
}

export type ChapterId = 'dropout' | 'deal' | 'secondChance' | 'payback' | 'garage' | 'firstHire' | 'fifty' | 'warehouse' | 'million' | 'graduation' | 'epilogue';

export interface StoryState {
  chapter: ChapterId;
  chapterStart: number;
  /** Best 30-day sales so far (for Dad's deal). */
  best30: number;
  /** Story scenes waiting to be shown, oldest first. */
  scenes: { done?: ChapterId; failed?: ChapterId; next: ChapterId }[];
  /** What the founder still owes the people who lent the starting $4,000. */
  debt: Record<'mom' | 'sam' | 'maya', number>;
  /** 0..100 per person. */
  bond: Record<CharacterId, number>;
  messages: StoryMessage[];
  /** Beats already played. */
  beats: Record<string, number>;
  /** Day friends are over (shown in the apartment). */
  guestsDay?: number;
  /** Day friends come to help (extra hours). */
  helpDay?: number;
  /** Day you're out (graduation, family dinner): fewer founder hours. */
  awayDay?: number;
}

// ───────────────────────────── rivals ─────────────────────────────

export type RivalStyle = 'incumbent' | 'copier' | 'premium' | 'blitzer';

export interface Rival {
  id: number;
  name: string;
  category: CategoryId;
  style: RivalStyle;
  /** Price relative to the category's typical price (1 = same as the reference). */
  price: number;
  rating: number;
  reviews: number;
  /** Ad pressure, 0..3: bids up auctions for everyone in the category. */
  ads: number;
  /** Brand and distribution strength, ~0.3..3. */
  strength: number;
  /** Product of yours they copied. */
  targets?: string;
  saleUntil?: number;
  outUntil?: number;
  pushUntil?: number;
  enteredDay: number;
  exitedDay?: number;
  /** Days of funding left (blitzers). */
  runway?: number;
  /** Your old classmate's company. */
  founder?: boolean;
}

export type EndingId = 'sold' | 'unicorn' | 'king' | 'beloved' | 'burnout' | 'builder';
