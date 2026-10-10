import type { CategoryId, ModuleId, PackDesign, Vibe } from '../types';

/** The style each category's shoppers respond to, for packaging and store themes. */
export const CATEGORY_VIBE: Record<CategoryId, Vibe> = { pets: 'playful', home: 'cozy', desk: 'minimal', kitchen: 'clean', fitness: 'bold' };

export const VIBES: Record<Vibe, { name: string; color: string; accent: string; font: string }> = {
  playful: { name: 'Playful', color: '#f7b733', accent: '#4abdac', font: '"Comic Neue", Nunito, sans-serif' },
  cozy: { name: 'Cozy', color: '#c9a27e', accent: '#7a5c3e', font: 'Georgia, serif' },
  minimal: { name: 'Minimal', color: '#2b2d42', accent: '#8d99ae', font: 'Helvetica, Arial, sans-serif' },
  clean: { name: 'Clean', color: '#e8f1ee', accent: '#2a9d8f', font: 'Nunito, sans-serif' },
  bold: { name: 'Bold', color: '#e63946', accent: '#1d3557', font: 'Impact, "Arial Black", sans-serif' },
};

/** The order shoppers want to read a product page in (top to bottom). */
export const IDEAL_ORDER: ModuleId[] = ['header', 'hero', 'description', 'gallery', 'reviews', 'badges', 'shipping', 'faq', 'checkout'];

export function packScore(design: PackDesign, cat: CategoryId): number {
  const vibe = CATEGORY_VIBE[cat];
  let score = design.color === vibe ? 0.5 : 0.15;
  score += design.print === 'logo' ? 0.25 : design.print === 'pattern' ? (vibe === 'playful' || vibe === 'cozy' ? 0.3 : 0.15) : 0.05;
  score += design.insert === 'tissue' ? (vibe === 'cozy' || vibe === 'minimal' ? 0.2 : 0.12) : design.insert === 'sticker' ? (vibe === 'playful' || vibe === 'bold' ? 0.2 : 0.1) : 0;
  return Math.min(1, score);
}

export const INSERT_COST: Record<PackDesign['insert'], number> = { none: 0, tissue: 0.15, sticker: 0.08 };

/** Share of module pairs that sit in the right order (1 = perfect flow). */
export function layoutScore(order: ModuleId[]): number {
  const rank = (m: ModuleId) => IDEAL_ORDER.indexOf(m);
  let good = 0;
  let total = 0;
  for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) {
    total++;
    if (rank(order[i]) < rank(order[j])) good++;
  }
  return total ? good / total : 0;
}

/** What a market scan can turn up: the real complaint (which benefit answers it) and two red herrings. */
export const MARKET_SCAN: Record<string, { complaint: string; benefit: string; decoys: [string, string] }> = {
  dogbowl: { complaint: 'Slides all over the kitchen floor while he eats', benefit: 'nonslip', decoys: ['Wish it came in more colors', 'Box was a bit dented'] },
  glowplanter: { complaint: 'The glow fades after twenty minutes', benefit: 'glow', decoys: ['Arrived a day late', 'Smaller than I imagined'] },
  laptopstand: { complaint: 'Wobbles every time I type', benefit: 'alu', decoys: ['Not sure about the color', 'Instructions were in tiny print'] },
  catfountain: { complaint: 'The pump is so loud it wakes me up', benefit: 'quiet', decoys: ['Cat ignored it for a day', 'Cord could be longer'] },
  siliconelids: { complaint: 'Won’t stretch over my bigger bowls', benefit: 'stretch', decoys: ['Packaging was plain', 'Colors are boring'] },
  coffeescale: { complaint: 'No timer, so I need my phone too', benefit: 'timer', decoys: ['A bit heavy', 'Logo is ugly'] },
  bands: { complaint: 'No idea which exercises to do with them', benefit: 'guide', decoys: ['Bag is flimsy', 'Took a week to arrive'] },
  sunsetlamp: { complaint: 'Only one color and no remote', benefit: 'modes', decoys: ['Box was huge', 'Cable is white, not black'] },
  cables: { complaint: 'Clips fall off and leave sticky residue', benefit: 'adhesive', decoys: ['Only comes in black', 'Pack was smaller than expected'] },
  blanket: { complaint: 'Gets way too hot at night', benefit: 'cooling', decoys: ['Color slightly different from photos', 'Heavy to carry'] },
  yogamat: { complaint: 'Gets slippery as soon as I sweat', benefit: 'grip', decoys: ['Smells a little new', 'Strap is short'] },
};
