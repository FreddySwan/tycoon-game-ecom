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
  | 'interest';
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
}

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
  copycat: number;
  reviews: { count: number; sum: number; hist: [number, number, number, number, number] };
  sold: number;
  returns: number;
  stockoutDays: number;
  /** Recent daily orders, newest last (14 days). */
  daily: number[];
  creatorBoost: number[];
}

export interface Brand {
  id: number;
  name: string;
  color: string;
  createdDay: number;
  store: { launched: boolean; launchedDay: number | null; modules: Record<ModuleId, number> };
  packaging: Packaging;
  thankYouCard: boolean;
  freeShipping: boolean;
  awareness: number;
  customers: number;
  email: { list: number; flows: { welcome: boolean; postPurchase: boolean; winback: boolean }; lastCampaign: number; fatigue: number; pending: number[] };
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

export interface Person {
  role: RoleId;
  name: string;
  hiredDay: number;
  morale: number;
  promoted: boolean;
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
  support: { autoRefundUnder: number; tone: 'template' | 'personal' };
  events: GameEvent[];
  eventCooldowns: Record<string, number>;
  bills: Bill[];
  receivables: Receivable[];
  history: DailyRecord[];
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
  ambition: AmbitionId | null;
  ambitionsDone: AmbitionId[];
  stageOffer: StageId | null;
  discountFatigue: number;
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  seq: number;
  lastDayOrders: number;
}
