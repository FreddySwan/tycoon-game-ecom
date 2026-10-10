export type ProductId = 'dogbowl' | 'glowplanter' | 'laptopstand';
export type SupplierId = 'quickmake' | 'brightway' | 'atelier';
export type Freight = 'air' | 'sea';
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
  | 'first_profitable_reorder';

export interface AudienceDef {
  id: string;
  name: string;
  desc: string;
  cpm: number;
  /** How strongly price changes affect this audience's conversion. */
  elasticity: number;
  cvrFit: number;
}

export interface CreativeDef {
  id: string;
  name: string;
  desc: string;
  ctr: number;
  fit: Record<string, number>;
  cvrBoost: number;
  requiresReviews?: number;
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
  kind: 'evergreen' | 'fad';
  peakDay: number;
}

export interface ProductDef {
  id: ProductId;
  name: string;
  emoji: string;
  tagline: string;
  bars: { demand: number; competition: number; margin: number; lifespan: number };
  lifespanNote: string;
  refPrice: number;
  baseCVR: number;
  baseUnitCost: number;
  airFreight: number;
  seaFreight: number;
  shipToCustomer: number;
  cpmMult: number;
  organicBase: number;
  trend: TrendDef;
  audiences: AudienceDef[];
  creatives: CreativeDef[];
  benefits: BenefitDef[];
  bestPhoto: PhotoChoice;
  photoTip: string;
  accessoryName: string;
  sampleNotes: Record<SupplierId, string>;
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
  /** Fraction of list price the supplier will concede at most. */
  room: number;
  style: 'folds' | 'fair' | 'firm';
  blurb: string;
}

export interface ModuleDef {
  id: ModuleId;
  name: string;
  icon: string;
  desc: string;
  tiers: { name: string; cost: number }[];
  required?: boolean;
}

export interface Sample {
  supplierId: SupplierId;
  orderedDay: number;
  arrivesDay: number;
  arrived: boolean;
  inspected: boolean;
}

export interface Negotiation {
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
}

export interface Store {
  launched: boolean;
  launchedDay: number | null;
  brandName: string;
  modules: Record<ModuleId, number>;
  benefits: string[];
  photoStars: number;
  photo: PhotoChoice | null;
}

export interface Offer {
  price: number;
  bundle: boolean;
  freeShipping: boolean;
  discountPct: number;
  packaging: 'basic' | 'sturdy';
  thankYouCard: boolean;
}

export interface DayStat {
  day: number;
  spend: number;
  impressions: number;
  clicks: number;
  orders: number;
}

export interface AdCell {
  key: string;
  audienceId: string;
  creativeId: string;
  active: boolean;
  budget: number;
  daysActive: number;
  totals: { spend: number; impressions: number; clicks: number; orders: number };
  history: DayStat[];
}

export interface QueuedOrder {
  id: number;
  day: number;
  customer: string;
  city: string;
  units: number;
  revenue: number;
  bundle: boolean;
  source: string;
}

export interface PendingReview {
  dueDay: number;
  orderId: number;
  customer: string;
  quality: number;
  delayDays: number;
  revenue: number;
}

export interface Review {
  day: number;
  stars: number;
  author: string;
  text: string;
}

export type CardKind = 'damaged' | 'defect' | 'late' | 'info';

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
  customer: string;
  avatar: string;
  message: string;
  revenue: number;
  choices: CardChoice[];
}

export interface GameEvent {
  id: number;
  kind: 'reorder-delay' | 'viral' | 'cash-crisis' | 'supplier-delay' | 'quality-issue';
  day: number;
  title: string;
  body: string;
  choices: CardChoice[];
  blocking: boolean;
  data?: Record<string, number>;
}

export interface Bill {
  id: number;
  dueDay: number;
  label: string;
  amount: number;
  everyDays?: number;
}

export interface DailyRecord {
  day: number;
  cash: number;
  revenue: number;
  adSpend: number;
  fulfillmentCost: number;
  cogs: number;
  orders: number;
  visits: number;
  profit: number;
}

export type NoticeKind = 'sample' | 'po' | 'card' | 'event' | 'milestone' | 'cash' | 'info' | 'sale';

export interface Notice {
  id: number;
  day: number;
  kind: NoticeKind;
  text: string;
  pause: boolean;
}

export interface GameState {
  version: 1;
  rng: number;
  day: number;
  cash: number;
  status: 'playing' | 'lost';
  won: boolean;
  productId: ProductId | null;
  samples: Sample[];
  relationship: Record<SupplierId, number>;
  negotiation: Negotiation | null;
  pos: PurchaseOrder[];
  inventory: { onHand: number; costTotal: number; qualityTotal: number };
  store: Store;
  offer: Offer;
  ads: Record<string, AdCell>;
  backlog: QueuedOrder[];
  handPacked: number;
  batchPacking: boolean;
  shipped: number;
  returns: number;
  pendingReviews: PendingReview[];
  reviews: Review[];
  cards: CustomerCard[];
  events: GameEvent[];
  payoutAccrued: number;
  bills: Bill[];
  history: DailyRecord[];
  milestones: Partial<Record<MilestoneId, number>>;
  notices: Notice[];
  hoursUsed: number;
  extraHours: number;
  stockoutDays: number;
  discountFatigue: number;
  viralBoost: number[];
  flags: Record<string, boolean>;
  loan: { amount: number; dueDay: number } | null;
  seq: number;
  /** Orders placed during the most recent tick, for UI animation. */
  lastDayOrders: number;
}
