import type {
  AmbitionId,
  ChannelDef,
  ChannelId,
  CreativeType,
  ModuleDef,
  ModuleId,
  RegionDef,
  RegionId,
  RoleDef,
  RoleId,
  SpaceDef,
  SpaceId,
  StageId,
  SupplierDef,
  SupplierId,
} from '../types';

export const SUPPLIERS: Record<SupplierId, SupplierDef> = {
  quickmake: {
    id: 'quickmake',
    company: 'QuickMake Supply',
    contact: 'Kevin Zhou',
    city: 'Shenzhen',
    avatar: '🧑🏻‍💼',
    priceMult: 0.69,
    moq: 500,
    quality: 0.55,
    qualityStars: 4,
    reliability: 0.6,
    reliabilityStars: 2,
    productionDays: 4,
    room: 0.15,
    style: 'folds',
    blurb: 'Fast replies, rock-bottom prices, quality that wobbles.',
    unlockStage: 1,
  },
  brightway: {
    id: 'brightway',
    company: 'Brightway Homewares',
    contact: 'Lin Wei',
    city: 'Ningbo',
    avatar: '👩🏻‍💼',
    priceMult: 1,
    moq: 300,
    quality: 0.85,
    qualityStars: 4,
    reliability: 0.9,
    reliabilityStars: 4,
    productionDays: 5,
    room: 0.06,
    style: 'fair',
    blurb: 'Reliable and fair. She remembers how you treat her.',
    unlockStage: 1,
  },
  atelier: {
    id: 'atelier',
    company: 'Atelier Yunhe',
    contact: 'Marta Ruiz',
    city: 'Hangzhou',
    avatar: '👩🏽‍🎨',
    priceMult: 1.67,
    moq: 1000,
    quality: 0.97,
    qualityStars: 5,
    reliability: 0.9,
    reliabilityStars: 4,
    productionDays: 10,
    room: 0.03,
    style: 'firm',
    blurb: 'Premium craftsmanship. High minimums, slow and worth it.',
    unlockStage: 1,
  },
  megafab: {
    id: 'megafab',
    company: 'MegaFab Industrial',
    contact: 'Wen Huang',
    city: 'Dongguan',
    avatar: '👨🏻‍🔧',
    priceMult: 0.74,
    moq: 3000,
    quality: 0.8,
    qualityStars: 4,
    reliability: 0.85,
    reliabilityStars: 4,
    productionDays: 12,
    room: 0.08,
    style: 'fair',
    blurb: 'A volume factory. Huge minimums, great prices, decent quality.',
    unlockStage: 3,
  },
};
export const SUPPLIER_ORDER: SupplierId[] = ['quickmake', 'brightway', 'atelier', 'megafab'];

export const CHANNELS: Record<ChannelId, ChannelDef> = {
  store: {
    id: 'store',
    name: 'Your store',
    emoji: '🛍️',
    desc: 'Your own ShopBloc store. You own the customer, but you buy every visitor.',
    unlockStage: 1,
    feePct: 0.03,
    feeFlat: 0.3,
    payoutEvery: 7,
    traffic: 0,
    cvrMult: 1,
    joinCost: 0,
    monthlyFee: 0,
    loyalty: 1,
  },
  loopshop: {
    id: 'loopshop',
    name: 'LoopShop',
    emoji: '🎬',
    desc: 'Social shopping. Traffic comes in viral spikes when creators post about you.',
    unlockStage: 2,
    feePct: 0.06,
    feeFlat: 0,
    payoutEvery: 14,
    traffic: 25,
    cvrMult: 1.1,
    joinCost: 0,
    monthlyFee: 0,
    loyalty: 0.6,
  },
  bazaarly: {
    id: 'bazaarly',
    name: 'Bazaarly',
    emoji: '🅱️',
    desc: 'The mega-marketplace. Enormous traffic, 15% fees, and ruthless about stock-outs.',
    unlockStage: 4,
    feePct: 0.15,
    feeFlat: 0.3,
    payoutEvery: 14,
    traffic: 300,
    cvrMult: 2.2,
    joinCost: 500,
    monthlyFee: 40,
    program: { name: 'Bazaarly Express (they ship it)', feePerUnit: 3.4, cvrBonus: 1.25 },
    loyalty: 0.2,
  },
  crafthaus: {
    id: 'crafthaus',
    name: 'Crafthaus',
    emoji: '🧵',
    desc: 'A smaller, loyal market for premium goods. Rejects cheap-looking products.',
    unlockStage: 4,
    feePct: 0.09,
    feeFlat: 0.2,
    payoutEvery: 14,
    traffic: 60,
    cvrMult: 2.1,
    joinCost: 300,
    monthlyFee: 25,
    minQuality: 0.8,
    minPriceRatio: 1,
    loyalty: 0.5,
  },
  flashcart: {
    id: 'flashcart',
    name: 'FlashCart',
    emoji: '⚡',
    desc: 'Discount marketplace. Massive volume on razor-thin margins, and price wars.',
    unlockStage: 4,
    feePct: 0.08,
    feeFlat: 0,
    payoutEvery: 21,
    traffic: 350,
    cvrMult: 1.9,
    joinCost: 0,
    monthlyFee: 0,
    maxPriceRatio: 0.85,
    loyalty: 0.1,
  },
};
export const CHANNEL_ORDER: ChannelId[] = ['store', 'loopshop', 'bazaarly', 'crafthaus', 'flashcart'];
export const MARKETPLACES: ChannelId[] = ['bazaarly', 'crafthaus', 'flashcart'];

export const CREATIVES: Record<CreativeType, { name: string; desc: string; ctr: number; fit: [number, number]; cvrBoost: number; needsReviews?: number; needsUgc?: boolean }> = {
  white: { name: 'Product on white', desc: 'Clean catalog shot. Safe, forgettable.', ctr: 0.009, fit: [1, 0.9], cvrBoost: 1 },
  video: { name: 'Demo video', desc: 'Shows the product doing its thing. Scroll-stopping.', ctr: 0.021, fit: [0.9, 1.25], cvrBoost: 1 },
  review: { name: 'Customer review quote', desc: 'A real 5★ review over a photo. Needs 3+ reviews.', ctr: 0.016, fit: [1.15, 1], cvrBoost: 1.12, needsReviews: 3 },
  ugc: { name: 'Creator UGC', desc: 'A creator using it for real. Needs a creator collab.', ctr: 0.026, fit: [1.05, 1.15], cvrBoost: 1.08, needsUgc: true },
};
export const CREATIVE_ORDER: CreativeType[] = ['white', 'video', 'review', 'ugc'];

export const REGIONS: Record<RegionId, RegionDef> = {
  eu: { id: 'eu', name: 'Europe', flag: '🇪🇺', demand: 0.7, setupCost: 30000, warehouseRent: 9000, duty: 0.06, shipMult: 2.4 },
  uk: { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', demand: 0.25, setupCost: 15000, warehouseRent: 4500, duty: 0.04, shipMult: 2.2 },
  jp: { id: 'jp', name: 'Japan', flag: '🇯🇵', demand: 0.3, setupCost: 25000, warehouseRent: 6000, duty: 0.05, shipMult: 2.6 },
  au: { id: 'au', name: 'Australia', flag: '🇦🇺', demand: 0.15, setupCost: 12000, warehouseRent: 3500, duty: 0.05, shipMult: 2.8 },
};
export const REGION_ORDER: RegionId[] = ['eu', 'uk', 'jp', 'au'];

export const ROLES: Record<RoleId, RoleDef> = {
  packer: { id: 'packer', name: 'Packer', emoji: '📦', wage: 2300, unlockStage: 2, seat: 'floor', desc: 'Packs ~35 orders a day at a packing station.', firstName: 'Jordan' },
  support: { id: 'support', name: 'Support agent', emoji: '🎧', wage: 2200, unlockStage: 2, seat: 'office', desc: 'Answers ~60 customer tickets a day following your policy.', firstName: 'Sam Rivera' },
  marketer: { id: 'marketer', name: 'Growth marketer', emoji: '📈', wage: 4200, unlockStage: 2, seat: 'office', desc: 'Runs your ad tests weekly: pauses losers, scales winners. +10% ad click rate.', firstName: 'Rosa Lind' },
  buyer: { id: 'buyer', name: 'Buyer', emoji: '🧾', wage: 3800, unlockStage: 3, seat: 'office', desc: 'Runs automatic reorder rules and negotiates a little harder.', firstName: 'Malik Osei' },
  lead: { id: 'lead', name: 'Warehouse lead', emoji: '🦺', wage: 3400, unlockStage: 3, seat: 'floor', desc: '+15% packing speed per 15 packers. Required for a second shift.', firstName: 'Jordan' },
  designer: { id: 'designer', name: 'Product designer', emoji: '✏️', wage: 5000, unlockStage: 4, seat: 'office', desc: 'Speeds up Product Lab projects by 50% each.', firstName: 'Ines Duarte' },
  brandmgr: { id: 'brandmgr', name: 'Brand manager', emoji: '🎨', wage: 4800, unlockStage: 5, seat: 'office', desc: 'Runs an extra brand. Brands without a manager grow at half speed.', firstName: 'Theo Park' },
};
/** Which team each role reports into, for the payroll breakdown. */
export const ROLE_TEAM: Record<RoleId, string> = {
  packer: 'Operations: packers',
  lead: 'Operations: leads',
  support: 'Customer success',
  marketer: 'Marketing',
  buyer: 'Buying & supply',
  designer: 'Product design',
  brandmgr: 'Brand management',
};
export const ROLE_ORDER: RoleId[] = ['packer', 'support', 'marketer', 'buyer', 'lead', 'designer', 'brandmgr'];

export const SPACES: Record<SpaceId, SpaceDef> = {
  apartment: { id: 'apartment', stage: 1, name: 'Studio apartment', desc: 'A corner of your apartment and the kitchen table.', rent: 900, deposit: 0, storage: 750, officeSeats: 1, floorSeats: 0 },
  garage: { id: 'garage', stage: 2, name: 'Garage unit', desc: 'A rented unit with shelving, three packing stations and a radio.', rent: 2400, deposit: 4800, storage: 5000, officeSeats: 3, floorSeats: 3 },
  warehouse: { id: 'warehouse', stage: 3, name: 'Small warehouse', desc: 'Racking, packing stations, a loading dock. Lay it out yourself.', rent: 6000, deposit: 12000, storage: 4000, officeSeats: 6, floorSeats: 99, grid: [12, 8] },
  hq: { id: 'hq', stage: 4, name: 'Branded HQ', desc: 'A bigger warehouse with an office and a wall of screens.', rent: 18000, deposit: 36000, storage: 8000, officeSeats: 25, floorSeats: 999, grid: [16, 10] },
  campus: { id: 'campus', stage: 5, name: 'Company campus', desc: 'A flagship fulfillment center and offices for a real company.', rent: 45000, deposit: 90000, storage: 20000, officeSeats: 80, floorSeats: 9999, grid: [20, 12] },
};
export const STAGE_SPACE: Record<StageId, SpaceId> = { 1: 'apartment', 2: 'garage', 3: 'warehouse', 4: 'hq', 5: 'campus' };

export const STAGES: Record<StageId, { name: string; desc: string; unlocks: string[]; requirement: string }> = {
  1: {
    name: 'Apartment startup',
    desc: 'Test a few products, launch your first store, and pack orders by hand.',
    unlocks: ['Up to 3 products', 'Batch packing', 'Seekly search ads', 'Packaging upgrades'],
    requirement: '',
  },
  2: {
    name: 'Growing brand',
    desc: 'Reorder on a cadence, hire your first people, and build repeat customers.',
    unlocks: ['Hiring: packers, support, marketer', 'Email list & flows', 'LoopShop & creators', 'Branded packaging', 'Credit line', '3PL option', 'Up to 5 products'],
    requirement: '$3,000 monthly profit, or 1,000 orders shipped',
  },
  3: {
    name: 'Warehouse operation',
    desc: 'Buy in bulk, lay out storage and packing stations, and run teams.',
    unlocks: ['Warehouse layout editor', 'Buyer & auto-reorders', 'Warehouse lead & 2nd shift', 'MegaFab volume factory', 'Up to 8 products'],
    requirement: '$15,000 monthly profit and 2+ products selling 5+ a day',
  },
  4: {
    name: 'Multichannel retailer',
    desc: 'Sell on marketplaces, take wholesale orders and negotiate supplier contracts.',
    unlocks: ['Bazaarly, Crafthaus, FlashCart', 'Wholesale accounts', 'Supplier contracts', 'Product designer & Lab', 'Up to 12 products'],
    requirement: '$60,000 monthly profit and 10,000 orders in 30 days',
  },
  5: {
    name: 'Established company',
    desc: 'Exclusive products, international expansion, and multiple brands.',
    unlocks: ['International markets', 'Multiple brands', 'Robot pickers', 'Unlimited products'],
    requirement: '$1.5M monthly revenue, 2+ channels with 20%+ each',
  },
};

export const AMBITIONS: Record<AmbitionId, { name: string; emoji: string; desc: string }> = {
  beloved: { name: 'Beloved Brand', emoji: '💛', desc: '4.8★ average (500+ reviews), 45% of orders from repeat customers, $1M profit over 12 months, 15 staff or fewer.' },
  giant: { name: 'Retail Giant', emoji: '🏬', desc: '$50M revenue over 12 months across 3+ channels (each 10%+).' },
  king: { name: 'Category King', emoji: '👑', desc: 'The #1 market share in a category, with an exclusive product in it.' },
  portfolio: { name: 'Portfolio Builder', emoji: '🗂️', desc: '4 brands at once, each with $20k+ monthly revenue and a profit.' },
};

export const MODULES: ModuleDef[] = [
  { id: 'header', name: 'Header & Logo', icon: '🏷️', desc: 'Your brand name up top. Looks legit.', tiers: [{ name: 'Text logo', cost: 0 }, { name: 'Custom logo', cost: 60 }] },
  { id: 'hero', name: 'Hero Image', icon: '🖼️', desc: 'The first thing shoppers see. Uses your photo shoot.', required: true, tiers: [{ name: 'Your photo', cost: 0 }, { name: 'Lifestyle video', cost: 200 }] },
  { id: 'gallery', name: 'Photo Gallery', icon: '📸', desc: 'More angles, fewer doubts.', tiers: [{ name: 'Phone shots', cost: 0 }, { name: 'Hired photographer', cost: 150 }] },
  { id: 'description', name: 'Description', icon: '📝', desc: 'Pick up to 3 benefits per product.', required: true, tiers: [{ name: 'Your words', cost: 0 }, { name: 'Pro copywriter', cost: 80 }] },
  { id: 'reviews', name: 'Reviews', icon: '⭐', desc: 'Shows real customer reviews. Empty ones hurt a little.', tiers: [{ name: 'Review widget', cost: 0 }] },
  { id: 'badges', name: 'Trust Badges', icon: '🛡️', desc: 'Secure checkout, money-back guarantee.', tiers: [{ name: 'Basic badges', cost: 0 }, { name: 'Verified badges', cost: 25 }] },
  { id: 'faq', name: 'FAQ', icon: '❓', desc: 'Answers questions before they kill a sale.', tiers: [{ name: 'FAQ block', cost: 0 }] },
  { id: 'shipping', name: 'Shipping Info', icon: '🚚', desc: '“Is this legit? When will it arrive?”', tiers: [{ name: 'Shipping times', cost: 0 }, { name: 'Free returns policy', cost: 0 }] },
  { id: 'checkout', name: 'Checkout', icon: '💳', desc: 'Where the money happens.', required: true, tiers: [{ name: 'Basic checkout', cost: 0 }, { name: 'Express pay', cost: 39 }] },
];
export const MODULE_IDS: ModuleId[] = MODULES.map((m) => m.id);

export const WHOLESALE_ACCOUNTS = ['Hearth & Home', 'Corner Goods Co.', 'Petropolis', 'Urban Nest', 'The Gift Loft', 'FitFuel Stores'];

export const FIRST_NAMES = [
  'Alex', 'Maya', 'Jordan', 'Chris', 'Sofia', 'Omar', 'Hannah', 'Leo', 'Grace', 'Noah', 'Aisha',
  'Ben', 'Lucia', 'Ravi', 'Emma', 'Tom', 'Zoe', 'Ken', 'Nina', 'Sam', 'Ivy', 'Mateo', 'Ruth',
  'Felix', 'Chloe', 'Yuki', 'Dev', 'Ana', 'Owen', 'Lea',
];
export const LAST_INITIALS = 'ABCDEFGHJKLMNOPRSTVW';
export const CITIES = [
  'Portland', 'Austin', 'Denver', 'Chicago', 'Boston', 'Atlanta', 'Seattle', 'Phoenix', 'Miami',
  'Nashville', 'Detroit', 'San Diego', 'Raleigh', 'Tucson', 'Madison', 'Boise', 'Omaha', 'Tampa',
];
export const REVIEW_TEXT: Record<number, string[]> = {
  5: ['Exactly as pictured. Already ordered another!', 'Fast shipping and great quality. Love it.', 'Honestly better than I expected.', 'Cute packaging, works perfectly. 10/10.'],
  4: ['Really good. Shipping took a little while.', 'Does the job well. Would buy again.', 'Nice quality for the price.'],
  3: ['It’s okay. Not quite as nice as the photos.', 'Fine, but took ages to arrive.', 'Average. Does what it says.'],
  2: ['Cheaper feeling than I expected.', 'Arrived late and a bit scuffed.', 'Meh. Probably returning it.'],
  1: ['Broke within a week. Disappointed.', 'Arrived damaged and nobody helped.', 'Not what was advertised at all.'],
};
export const GENERIC_SAMPLE_NOTES = {
  low: 'Feels flimsy and the finish is uneven. A seam is already coming apart.',
  mid: 'Solid build, clean finish, packed well.',
  high: 'Beautiful materials and finish. Feels genuinely premium.',
};
