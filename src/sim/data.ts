import type { ModuleDef, ModuleId, ProductDef, ProductId, SupplierDef, SupplierId } from './types';

export const STARTING_CASH = 4000;
export const FOUNDER_HOURS = 10;
export const SAMPLE_COST = 35;
export const SAMPLE_DAYS = 3;
export const INSPECTION_COST = 150;
export const AIR_DAYS = 6;
export const SEA_DAYS = 25;
export const PAYOUT_EVERY = 7;
export const PAYMENT_FEE_PCT = 0.03;
export const PAYMENT_FEE_FLAT = 0.3;
export const PACKAGING_COST = { basic: 0.6, sturdy: 0.95 } as const;
export const THANK_YOU_COST = 0.1;
export const CUSTOMER_SHIPPING_CHARGE = 4.99;
export const STORE_SUBSCRIPTION = 29;
export const RENT = 900;
export const HOURS = {
  handPack: 0.15,
  batchPack: 0.15,
  inspectSample: 0.5,
  photoShoot: 2,
  card: 0.25,
} as const;
export const FRIEND_HELP = { cost: 100, hours: 8 };
export const WIN_REORDER_QTY = 300;
export const BATCH_UNLOCK_AFTER = 5;
export const BUNDLE_SHARE = 0.3;
export const LOAN = { amount: 1500, repay: 1650, days: 30 };

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
  },
};

export const SUPPLIER_ORDER: SupplierId[] = ['quickmake', 'brightway', 'atelier'];

export const PRODUCTS: Record<ProductId, ProductDef> = {
  dogbowl: {
    id: 'dogbowl',
    name: 'Slow-Feeder Dog Bowl',
    emoji: '🥣',
    tagline: 'A maze-shaped bowl that stops dogs from gulping their dinner.',
    bars: { demand: 3, competition: 3, margin: 4, lifespan: 4 },
    lifespanNote: 'Evergreen',
    refPrice: 29,
    baseCVR: 0.045,
    baseUnitCost: 2.75,
    airFreight: 1.2,
    seaFreight: 0.4,
    shipToCustomer: 5,
    cpmMult: 1,
    organicBase: 6,
    trend: { kind: 'evergreen', peakDay: 0 },
    audiences: [
      {
        id: 'owners',
        name: 'Dog owners 25–45',
        desc: 'Big audience, price-sensitive, seen a lot of bowls already.',
        cpm: 11,
        elasticity: 1.6,
        cvrFit: 0.9,
      },
      {
        id: 'puppy',
        name: 'New puppy parents',
        desc: 'Smaller audience, buying everything for the new arrival.',
        cpm: 13,
        elasticity: 1.1,
        cvrFit: 1.15,
      },
    ],
    creatives: [
      {
        id: 'white',
        name: 'Product on white',
        desc: 'Clean catalog shot. Safe, forgettable.',
        ctr: 0.009,
        fit: { owners: 1, puppy: 0.9 },
        cvrBoost: 1,
      },
      {
        id: 'video',
        name: '“Dog eating slowly” video',
        desc: 'A happy pup working through the maze. Very scroll-stopping.',
        ctr: 0.022,
        fit: { owners: 0.9, puppy: 1.25 },
        cvrBoost: 1,
      },
      {
        id: 'review',
        name: 'Customer review quote',
        desc: 'A real 5★ review over a photo. Needs 3+ reviews.',
        ctr: 0.016,
        fit: { owners: 1.15, puppy: 1 },
        cvrBoost: 1.12,
        requiresReviews: 3,
      },
    ],
    benefits: [
      { id: 'slows', text: 'Slows eating up to 10×', cvr: 0.06, returns: 0 },
      { id: 'bloat', text: 'Reduces bloating & vomiting', cvr: 0.05, returns: 0 },
      { id: 'nonslip', text: 'Non-slip rubber base', cvr: 0.03, returns: 0 },
      { id: 'dishwasher', text: 'Dishwasher safe', cvr: 0.03, returns: 0 },
      { id: 'bpa', text: 'BPA-free, food-grade material', cvr: 0.04, returns: 0 },
      { id: 'puzzle', text: 'A fun puzzle for smart pups', cvr: 0.04, returns: 0 },
      { id: 'allbreeds', text: 'Fits every breed, Chihuahua to Great Dane', cvr: 0.06, returns: 0.05 },
    ],
    bestPhoto: { backdrop: 'floor', light: 'window', prop: 'cat', angle: 'angled' },
    photoTip: 'Pet products sell best with a pet in the shot, in soft natural light.',
    accessoryName: 'Leash',
    sampleNotes: {
      quickmake: 'Rough mold seam along the rim and a faint chemical smell.',
      brightway: 'Clean edges, sturdy, rubber base grips well.',
      atelier: 'Beautiful matte finish with a weighted base. Feels premium.',
    },
  },
  glowplanter: {
    id: 'glowplanter',
    name: 'Glow Planters',
    emoji: '🪴',
    tagline: 'Glow-in-the-dark plant pots. Huge on LoopShop right now.',
    bars: { demand: 4, competition: 2, margin: 3, lifespan: 1 },
    lifespanNote: 'Fad, ~6 weeks',
    refPrice: 24,
    baseCVR: 0.05,
    baseUnitCost: 3.1,
    airFreight: 1,
    seaFreight: 0.35,
    shipToCustomer: 4.6,
    cpmMult: 0.85,
    organicBase: 10,
    trend: { kind: 'fad', peakDay: 22 },
    audiences: [
      {
        id: 'plants',
        name: 'Plant lovers',
        desc: 'Loyal hobbyists who care about drainage holes.',
        cpm: 9,
        elasticity: 1.3,
        cvrFit: 1,
      },
      {
        id: 'gifts',
        name: 'Quirky gift shoppers',
        desc: 'Impulse buyers looking for something fun.',
        cpm: 10,
        elasticity: 1.5,
        cvrFit: 1.1,
      },
    ],
    creatives: [
      {
        id: 'white',
        name: 'Product on white',
        desc: 'You can’t even see the glow.',
        ctr: 0.007,
        fit: { plants: 1, gifts: 1 },
        cvrBoost: 1,
      },
      {
        id: 'video',
        name: '“Lights off” reveal video',
        desc: 'Room goes dark, pots light up. Made for LoopShop.',
        ctr: 0.024,
        fit: { plants: 0.9, gifts: 1.25 },
        cvrBoost: 1,
      },
      {
        id: 'review',
        name: 'Customer review quote',
        desc: 'A real 5★ review over a photo. Needs 3+ reviews.',
        ctr: 0.014,
        fit: { plants: 1.15, gifts: 1 },
        cvrBoost: 1.12,
        requiresReviews: 3,
      },
    ],
    benefits: [
      { id: 'glow', text: 'Glows for 8 hours after daylight', cvr: 0.06, returns: 0 },
      { id: 'drain', text: 'Drainage hole + saucer included', cvr: 0.05, returns: 0 },
      { id: 'gift', text: 'Arrives gift-ready', cvr: 0.04, returns: 0 },
      { id: 'nontoxic', text: 'Non-toxic, pet-safe glow', cvr: 0.04, returns: 0 },
      { id: 'sizes', text: 'Three sizes that nest', cvr: 0.03, returns: 0 },
      { id: 'allnight', text: 'Glows all night long', cvr: 0.06, returns: 0.05 },
    ],
    bestPhoto: { backdrop: 'countertop', light: 'lamp', prop: 'none', angle: 'eye' },
    photoTip: 'Glow products need low light, and the plant is already your prop.',
    accessoryName: 'Fairy lights',
    sampleNotes: {
      quickmake: 'Glow fades after 20 minutes. One pot arrived cracked.',
      brightway: 'Even glow for hours. Solid ceramic.',
      atelier: 'Hand-glazed, gorgeous glow gradient.',
    },
  },
  laptopstand: {
    id: 'laptopstand',
    name: 'Aluminum Laptop Stand',
    emoji: '💻',
    tagline: 'Ergonomic, foldable, and on every “desk setup” list.',
    bars: { demand: 4, competition: 5, margin: 2, lifespan: 5 },
    lifespanNote: 'Evergreen',
    refPrice: 39,
    baseCVR: 0.033,
    baseUnitCost: 8.5,
    airFreight: 3.1,
    seaFreight: 0.95,
    shipToCustomer: 6.5,
    cpmMult: 1.7,
    organicBase: 8,
    trend: { kind: 'evergreen', peakDay: 0 },
    audiences: [
      {
        id: 'remote',
        name: 'Remote workers',
        desc: 'Huge audience, every competitor is bidding here.',
        cpm: 14,
        elasticity: 1.7,
        cvrFit: 1,
      },
      {
        id: 'students',
        name: 'Students',
        desc: 'Cheaper clicks, tighter wallets.',
        cpm: 10,
        elasticity: 2,
        cvrFit: 0.85,
      },
    ],
    creatives: [
      {
        id: 'white',
        name: 'Product on white',
        desc: 'Looks exactly like the 400 others.',
        ctr: 0.008,
        fit: { remote: 1, students: 1 },
        cvrBoost: 1,
      },
      {
        id: 'video',
        name: '“Desk glow-up” video',
        desc: 'Messy desk to clean setup in 8 seconds.',
        ctr: 0.017,
        fit: { remote: 1.2, students: 1 },
        cvrBoost: 1,
      },
      {
        id: 'review',
        name: 'Customer review quote',
        desc: 'A real 5★ review over a photo. Needs 3+ reviews.',
        ctr: 0.013,
        fit: { remote: 1.1, students: 1 },
        cvrBoost: 1.12,
        requiresReviews: 3,
      },
    ],
    benefits: [
      { id: 'posture', text: 'Raises screen to eye level', cvr: 0.06, returns: 0 },
      { id: 'fold', text: 'Folds flat for travel', cvr: 0.04, returns: 0 },
      { id: 'cool', text: 'Keeps your laptop cool', cvr: 0.04, returns: 0 },
      { id: 'alu', text: 'Solid aluminum, 10 kg load', cvr: 0.05, returns: 0 },
      { id: 'angles', text: '6 height settings', cvr: 0.03, returns: 0 },
      { id: 'allsizes', text: 'Fits every laptop ever made', cvr: 0.06, returns: 0.05 },
    ],
    bestPhoto: { backdrop: 'countertop', light: 'window', prop: 'none', angle: 'angled' },
    photoTip: 'Show it in a clean workspace with natural light.',
    accessoryName: 'Coffee mug',
    sampleNotes: {
      quickmake: 'Wobbles on its hinge. Sharp edge on one leg.',
      brightway: 'Sturdy, smooth hinge, good finish.',
      atelier: 'Machined perfection. Silent hinge.',
    },
  },
};

export const PRODUCT_ORDER: ProductId[] = ['glowplanter', 'dogbowl', 'laptopstand'];

export const MODULES: ModuleDef[] = [
  {
    id: 'header',
    name: 'Header & Logo',
    icon: '🏷️',
    desc: 'Your brand name up top. Looks legit.',
    tiers: [
      { name: 'Text logo', cost: 0 },
      { name: 'Custom logo', cost: 60 },
    ],
  },
  {
    id: 'hero',
    name: 'Hero Image',
    icon: '🖼️',
    desc: 'The first thing shoppers see. Uses your photo shoot.',
    required: true,
    tiers: [
      { name: 'Your photo', cost: 0 },
      { name: 'Lifestyle video', cost: 200 },
    ],
  },
  {
    id: 'gallery',
    name: 'Photo Gallery',
    icon: '📸',
    desc: 'More angles, fewer doubts.',
    tiers: [
      { name: 'Phone shots', cost: 0 },
      { name: 'Hired photographer', cost: 150 },
    ],
  },
  {
    id: 'description',
    name: 'Description',
    icon: '📝',
    desc: 'Pick up to 3 benefits that sell it.',
    required: true,
    tiers: [
      { name: 'Your words', cost: 0 },
      { name: 'Pro copywriter', cost: 80 },
    ],
  },
  {
    id: 'reviews',
    name: 'Reviews',
    icon: '⭐',
    desc: 'Shows real customer reviews. Empty ones hurt a little.',
    tiers: [{ name: 'Review widget', cost: 0 }],
  },
  {
    id: 'badges',
    name: 'Trust Badges',
    icon: '🛡️',
    desc: 'Secure checkout, money-back guarantee.',
    tiers: [
      { name: 'Basic badges', cost: 0 },
      { name: 'Verified badges', cost: 25 },
    ],
  },
  {
    id: 'faq',
    name: 'FAQ',
    icon: '❓',
    desc: 'Answers questions before they kill a sale.',
    tiers: [{ name: 'FAQ block', cost: 0 }],
  },
  {
    id: 'shipping',
    name: 'Shipping Info',
    icon: '🚚',
    desc: '“Is this legit? When will it arrive?”',
    tiers: [
      { name: 'Shipping times', cost: 0 },
      { name: 'Free returns policy', cost: 0 },
    ],
  },
  {
    id: 'checkout',
    name: 'Checkout',
    icon: '💳',
    desc: 'Where the money happens.',
    required: true,
    tiers: [
      { name: 'Basic checkout', cost: 0 },
      { name: 'Express pay', cost: 39 },
    ],
  },
];

export const MODULE_IDS: ModuleId[] = MODULES.map((m) => m.id);

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
  5: [
    'Exactly as pictured. Already ordered another!',
    'Fast shipping and great quality. Love it.',
    'Honestly better than I expected.',
    'Cute packaging, works perfectly. 10/10.',
  ],
  4: [
    'Really good. Shipping took a little while.',
    'Does the job well. Would buy again.',
    'Nice quality for the price.',
  ],
  3: [
    'It’s okay. Not quite as nice as the photos.',
    'Fine, but took ages to arrive.',
    'Average. Does what it says.',
  ],
  2: [
    'Cheaper feeling than I expected.',
    'Arrived late and a bit scuffed.',
    'Meh. Probably returning it.',
  ],
  1: [
    'Broke within a week. Disappointed.',
    'Arrived damaged and nobody helped.',
    'Not what was advertised at all.',
  ],
};
