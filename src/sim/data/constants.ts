export const STARTING_CASH = 4000;
export const FOUNDER_HOURS = 10;
export const SAMPLE_COST = 35;
export const SAMPLE_DAYS = 3;
export const INSPECTION_COST = 150;
export const AIR_DAYS = 6;
export const SEA_DAYS = 25;
export const PAYMENT_FEE_PCT = 0.03;
export const PAYMENT_FEE_FLAT = 0.3;
export const PACKAGING_COST = { basic: 0.6, sturdy: 0.95, branded: 1.4 } as const;
export const DAMAGE_RATE = { basic: 0.06, sturdy: 0.015, branded: 0.012 } as const;
export const THANK_YOU_COST = 0.1;
export const CUSTOMER_SHIPPING_CHARGE = 4.99;
export const STORE_SUBSCRIPTION = 29;
export const HOURS = {
  handPack: 0.15,
  inspectSample: 0.5,
  photoShoot: 2,
  card: 0.25,
  research: 3,
} as const;
export const FRIEND_HELP = { cost: 100, hours: 8 };
export const WIN_REORDER_QTY = 300;
export const BATCH_UNLOCK_AFTER = 5;
export const BUNDLE_SHARE = 0.3;
export const LOAN = { amount: 1500, repay: 1650, days: 30 };
export const MONTH = 30;
export const YEAR = 360;
export const PAYROLL_EVERY = 14;
export const PACKER_RATE = 35;
export const SUPPORT_RATE = 60;
export const FOUNDER_TICKETS_PER_HOUR = 4;
export const THIRD_PARTY = { perOrder: 3.4, storagePerUnitMonth: 0.25 };
export const CREDIT_INTEREST_MONTHLY = 0.015;
export const PRODUCT_SLOTS: Record<number, number> = { 1: 3, 2: 5, 3: 8, 4: 12, 5: 99 };
export const CREATORS = [
  { id: 'micro', name: 'Micro creator', followers: '40k', cost: 300, reach: 600, viral: 0.12 },
  { id: 'mid', name: 'Mid-size creator', followers: '350k', cost: 1500, reach: 2500, viral: 0.3 },
  { id: 'star', name: 'Star creator', followers: '3M', cost: 6000, reach: 9000, viral: 0.55 },
] as const;
export const TILE_COST = { rack: 1500, station: 2500, conveyor: 800, robot: 60000 } as const;
export const RACK_STORAGE = 2000;
export const BRAND_SETUP_COST = 25000;
export const BRAND_COLORS = ['#f0a860', '#3a7bd5', '#1f9d55', '#c2477a', '#7b5cd6', '#2b2d42'];
export const START_MONTH = 2; // March
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const OVERHEAD_RATE: Record<number, number> = { 1: 0, 2: 0.01, 3: 0.025, 4: 0.04, 5: 0.06 };
/** Payroll taxes and benefits on top of base wages. */
export const BENEFITS = 1.2;
