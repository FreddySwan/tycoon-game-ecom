import type { Difficulty, SkillDef, SkillId } from '../types';

/** SkillUp: courses take founder hours to finish, software bills monthly, gear is a one-off. */
export const SKILLS: Record<SkillId, SkillDef> = {
  researchTool: {
    id: 'researchTool',
    name: 'TrendHound Pro',
    kind: 'software',
    icon: '📈',
    cost: 39,
    monthly: 39,
    desc: 'Search volumes, sales estimates and review counts for any product.',
    effect: 'Needed to investigate products and run deep dives.',
  },
  adsBasics: {
    id: 'adsBasics',
    name: 'Ad Metrics 101',
    kind: 'course',
    icon: '📣',
    cost: 149,
    hours: 4,
    desc: 'CTR, CPC, CPA, ROAS and break-even. Without it you see what you spend, not which ads make money.',
    effect: 'Unlocks daily ad performance reviews.',
  },
  economics: {
    id: 'economics',
    name: 'Unit Economics for E-commerce',
    kind: 'course',
    icon: '🧾',
    cost: 149,
    hours: 3,
    desc: 'Landed cost, contribution, margins and the most important number: your break-even ad cost.',
    effect: 'Shows what you really keep per order, your margins and break-even.',
  },
  analytics: {
    id: 'analytics',
    name: 'Lens Analytics',
    kind: 'software',
    icon: '📊',
    cost: 49,
    monthly: 49,
    requires: ['adsBasics'],
    desc: 'Your ad report builds itself every morning.',
    effect: 'Daily ad reviews take no founder time.',
  },
  adSpy: {
    id: 'adSpy',
    name: 'AdSpy Library',
    kind: 'software',
    icon: '🔎',
    cost: 29,
    monthly: 29,
    desc: 'See which competitor ads have been running for months (the ones that make money).',
    effect: 'Needed for competitor creative research, which raises ad quality.',
  },
  copywriting: {
    id: 'copywriting',
    name: 'Scroll-Stopping Creatives',
    kind: 'course',
    icon: '✏️',
    cost: 199,
    hours: 3,
    requires: ['adsBasics'],
    desc: 'Hooks, first lines and offers that make people stop scrolling.',
    effect: '+10% ad clicks; creative research scores higher.',
  },
  adsAdvanced: {
    id: 'adsAdvanced',
    name: 'Scrollr Ads Mastery',
    kind: 'course',
    icon: '🎯',
    cost: 449,
    hours: 6,
    requires: ['adsBasics'],
    desc: 'Bidding, lookalikes, scaling without breaking your cost per order.',
    effect: '+12% ad clicks and 8% cheaper impressions.',
  },
  searchAds: {
    id: 'searchAds',
    name: 'Search Ads Bootcamp',
    kind: 'course',
    icon: '🔍',
    cost: 249,
    hours: 4,
    requires: ['adsBasics'],
    desc: 'Keywords, match types and negative keywords on Seekly.',
    effect: 'Unlocks Seekly search ads; +10% search conversion.',
  },
  storeCourse: {
    id: 'storeCourse',
    name: 'Store Pages That Convert',
    kind: 'course',
    icon: '🛍️',
    cost: 249,
    hours: 4,
    desc: 'What shoppers look for above the fold, on mobile, and right before checkout.',
    effect: 'Store builder scores +10% quality and shows hints.',
  },
  photography: {
    id: 'photography',
    name: 'Phone Photography 101',
    kind: 'course',
    icon: '📷',
    cost: 99,
    hours: 2,
    desc: 'Light, angles and props for product shots on a phone.',
    effect: '+1★ on every photo shoot.',
  },
  tapeGun: {
    id: 'tapeGun',
    name: 'Tape gun',
    kind: 'gear',
    icon: '📦',
    cost: 25,
    desc: 'One pull, one sealed box.',
    effect: 'Packing 20% faster.',
  },
  scale: {
    id: 'scale',
    name: 'Shipping scale',
    kind: 'gear',
    icon: '⚖️',
    cost: 45,
    desc: 'No more guessing postage at the counter.',
    effect: 'Packing 10% faster.',
  },
  labelPrinter: {
    id: 'labelPrinter',
    name: 'Thermal label printer',
    kind: 'gear',
    icon: '🧾',
    cost: 179,
    desc: 'Print shipping labels in one click instead of copying addresses.',
    effect: 'Packing 30% faster.',
  },
  packBench: {
    id: 'packBench',
    name: 'Packing bench & shelves',
    kind: 'gear',
    icon: '🧰',
    cost: 120,
    desc: 'Boxes, tape and filler within arm’s reach.',
    effect: 'Packing 15% faster.',
  },
};

export const SKILL_ORDER: SkillId[] = ['researchTool', 'adSpy', 'analytics', 'economics', 'adsBasics', 'tapeGun', 'scale', 'labelPrinter', 'packBench', 'photography', 'storeCourse', 'copywriting', 'searchAds', 'adsAdvanced'];

/** Each piece of gear multiplies the time it takes to pack one order. */
export const PACK_SPEED: Partial<Record<SkillId, number>> = { tapeGun: 0.8, scale: 0.9, labelPrinter: 0.7, packBench: 0.85 };

/** Founder hours a course study session uses at most. */
export const STUDY_SESSION = 2;

export interface DifficultyDef {
  name: string;
  blurb: string;
  /** Daily upward drift of each product's ad costs and unit costs. */
  adDrift: number;
  costDrift: number;
  /** Daily random wobble. */
  volatility: number;
  /** Daily chance of a sudden jump per product. */
  shockChance: number;
  /** How much your own ad spend on a product pushes its costs up. */
  saturation: number;
  /** Daily erosion of a product's share of demand as competitors copy it. */
  shareDrift: number;
  /** How often rivals copy you, enter your categories and start ad wars. */
  rivalAggression: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  relaxed: {
    name: 'Relaxed',
    blurb: 'Steady markets. Ad and product costs barely move, so one good product can carry you a long way.',
    adDrift: 0.00015,
    costDrift: 0.00005,
    volatility: 0.003,
    shockChance: 0.001,
    saturation: 0.4,
    shareDrift: 0.0001,
    rivalAggression: 0.5,
  },
  normal: {
    name: 'Normal',
    blurb: 'Markets drift. A product’s ads get pricier as you and copycats scale it, suppliers raise prices now and then.',
    adDrift: 0.0004,
    costDrift: 0.00015,
    volatility: 0.006,
    shockChance: 0.003,
    saturation: 1,
    shareDrift: 0.0002,
    rivalAggression: 1,
  },
  hard: {
    name: 'Hard',
    blurb: 'Volatile markets. Ad costs climb fast, suppliers spring price hikes, and no product stays profitable forever.',
    adDrift: 0.0013,
    costDrift: 0.0005,
    volatility: 0.012,
    shockChance: 0.007,
    saturation: 1.8,
    shareDrift: 0.0008,
    rivalAggression: 1.6,
  },
};
