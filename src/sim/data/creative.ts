import type { CategoryId, Cta, HookType, ProductDef } from '../types';

export interface Hook {
  id: string;
  text: string;
  type: HookType;
  needsReviews?: number;
}

/** How each hook style lands with the two audiences of a category (cold/broad, then warm/niche). */
export const HOOK_FIT: Record<HookType, { label: string; ctr: [number, number]; cvr: number; tip: string }> = {
  problem: { label: 'Problem', ctr: [1.15, 1.1], cvr: 1, tip: 'Names a pain the shopper already has. Works on everyone.' },
  benefit: { label: 'Benefit', ctr: [1.05, 1], cvr: 1.05, tip: 'States what it does. Clear, converts well, a bit dry.' },
  emotional: { label: 'Emotional', ctr: [0.92, 1.22], cvr: 1, tip: 'Speaks to feelings. Great with warm, niche audiences.' },
  social: { label: 'Social proof', ctr: [1.2, 1.05], cvr: 1.08, tip: 'Leans on your reviews. Needs 10+ reviews to be believable.' },
  urgency: { label: 'Urgency', ctr: [1, 1], cvr: 1.1, tip: 'Pushes people to buy now. Converts, but feels salesy.' },
};

export const CTA_FIT: Record<Cta, { label: string; ctr: number; cvr: number }> = {
  shop: { label: 'Shop now', ctr: 1, cvr: 1.05 },
  learn: { label: 'Learn more', ctr: 1.1, cvr: 0.92 },
  get: { label: 'Get yours', ctr: 1.04, cvr: 1 },
};

const PROBLEM: Record<string, string> = {
  dogbowl: 'Does your dog inhale dinner in 30 seconds?',
  glowplanter: 'Plants that disappear when the lights go off?',
  laptopstand: 'Neck sore after another day hunched over your laptop?',
  catfountain: 'Is your cat secretly dehydrated?',
  siliconelids: 'Still fighting with cling film?',
  coffeescale: 'Why does your pour-over taste different every morning?',
  bands: 'No time (or space) for the gym?',
  sunsetlamp: 'Winter evenings feeling grey?',
  cables: 'Is your desk a cable jungle?',
  blanket: 'Lying awake at 2am again?',
  yogamat: 'Slipping in downward dog?',
};

const EMOTIONAL: Record<CategoryId, string> = {
  pets: 'Because they’re family.',
  home: 'Make your place feel like home.',
  desk: 'A desk you actually want to sit at.',
  kitchen: 'Little upgrades, better mornings.',
  fitness: 'Feel strong in your own living room.',
};

export function hooksFor(d: ProductDef): Hook[] {
  const base = d.baseId ?? d.id;
  const benefits = d.benefits.filter((b) => !b.returns).slice(0, 3);
  return [
    { id: 'problem', text: PROBLEM[base] ?? `Tired of the old way?`, type: 'problem' },
    ...benefits.map((b) => ({ id: `b-${b.id}`, text: `${b.text}.`, type: 'benefit' as const })),
    { id: 'emotional', text: EMOTIONAL[d.category], type: 'emotional' },
    { id: 'social', text: `Rated ★★★★★ by happy customers. See why.`, type: 'social', needsReviews: 10 },
    { id: 'urgency', text: 'Free shipping ends tonight. Don’t miss it.', type: 'urgency' },
  ];
}
