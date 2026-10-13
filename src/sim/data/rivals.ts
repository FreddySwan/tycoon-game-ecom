import type { CategoryId, RivalStyle } from '../types';

/** Brands already selling in each category when you start. */
export const INCUMBENTS: Record<CategoryId, { name: string; price: number; rating: number; reviews: number }[]> = {
  pets: [
    { name: 'Furbish', price: 1.05, rating: 4.3, reviews: 4800 },
    { name: 'PawPal', price: 0.85, rating: 4.0, reviews: 2100 },
  ],
  home: [
    { name: 'Nestwell', price: 1.1, rating: 4.4, reviews: 3600 },
    { name: 'HomeJoy', price: 0.9, rating: 4.0, reviews: 2600 },
  ],
  desk: [
    { name: 'Deskly', price: 1.1, rating: 4.3, reviews: 5200 },
    { name: 'Valuemax', price: 0.8, rating: 3.8, reviews: 3900 },
  ],
  kitchen: [
    { name: 'Hearth & Co', price: 1.15, rating: 4.5, reviews: 4100 },
    { name: 'Kitcheno', price: 0.9, rating: 4.0, reviews: 2800 },
  ],
  fitness: [
    { name: 'Forma', price: 1.1, rating: 4.4, reviews: 3300 },
    { name: 'GymLite', price: 0.85, rating: 3.9, reviews: 2200 },
  ],
};

export const COPIER_NAMES = ['Cheapora', 'DealDash', 'Lookalike Co', 'BudgetBox', 'Zippy Goods', 'Knockr', 'ValuePlus', 'SameButLess'];
export const ENTRANT_NAMES = ['Lumo', 'Kova', 'Nordly', 'Brightside', 'Tidy&Co', 'Haven', 'Oakline', 'Bloom & Bark', 'Corecraft', 'Mellow'];

export const STYLE_INFO: Record<RivalStyle, { label: string; blurb: string }> = {
  incumbent: { label: 'Established', blurb: 'Big catalog, steady ads, slow to react.' },
  copier: { label: 'Copycat', blurb: 'Copies what sells, undercuts on price, cuts corners on quality.' },
  premium: { label: 'Premium', blurb: 'Charges more, wins on quality and brand. Runs the odd big sale.' },
  blitzer: { label: 'VC-funded', blurb: 'Burns investor money on ads until the money runs out.' },
};

/** The classmate who started a competitor. */
export const RIVAL_FOUNDER = { name: 'Brett Lawson', company: 'Kinetik' };
