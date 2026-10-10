import { AMBITIONS, CATEGORIES, CHANNEL_ORDER } from './data';
import { averageRating, avgDailyOrders, brandTrailing, def, headcount, liveProducts, marketShare, reviewCount, trailing } from './economics';
import type { AmbitionId, CategoryId, GameState, StageId } from './types';

export interface Check {
  label: string;
  value: string;
  done: boolean;
  progress: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function stageChecks(s: GameState, stage: StageId): Check[] {
  const m = trailing(s, 30);
  if (stage === 2) {
    const a = { label: 'Monthly profit ≥ $3,000', value: money(m.profit), done: m.profit >= 3000, progress: m.profit / 3000 };
    const b = { label: 'or 1,000 orders shipped', value: s.shipped.toLocaleString(), done: s.shipped >= 1000, progress: s.shipped / 1000 };
    return a.done || b.done ? [{ ...a, done: true, progress: 1 }, { ...b, done: true, progress: 1 }] : [a, b];
  }
  if (stage === 3) {
    const steady = liveProducts(s).filter((id) => avgDailyOrders(s, id, 14) >= 5).length;
    return [
      { label: 'Monthly profit ≥ $15,000', value: money(m.profit), done: m.profit >= 15000, progress: m.profit / 15000 },
      { label: '2+ products selling 5+ a day', value: `${steady}`, done: steady >= 2, progress: steady / 2 },
    ];
  }
  if (stage === 4) {
    return [
      { label: 'Monthly profit ≥ $60,000', value: money(m.profit), done: m.profit >= 60000, progress: m.profit / 60000 },
      { label: '10,000 orders in 30 days', value: m.orders.toLocaleString(), done: m.orders >= 10000, progress: m.orders / 10000 },
    ];
  }
  if (stage === 5) {
    const big = CHANNEL_ORDER.filter((c) => (m.channel[c] ?? 0) >= m.revenue * 0.2).length;
    return [
      { label: 'Monthly revenue ≥ $1.5M', value: money(m.revenue), done: m.revenue >= 1500000, progress: m.revenue / 1500000 },
      { label: '2+ channels with 20%+ of revenue', value: `${big}`, done: big >= 2, progress: big / 2 },
    ];
  }
  return [];
}

export function stageReady(s: GameState, stage: StageId): boolean {
  const checks = stageChecks(s, stage);
  return checks.length > 0 && checks.every((c) => c.done);
}

export function ambitionChecks(s: GameState, id: AmbitionId): Check[] {
  const y = trailing(s, 360);
  const m = trailing(s, 30);
  if (id === 'beloved') {
    const rating = averageRating(s);
    const n = reviewCount(s);
    const repeat = m.orders ? m.repeat / m.orders : 0;
    const staff = headcount(s);
    return [
      { label: '4.8★ average, 500+ reviews', value: `${rating.toFixed(2)}★ · ${n}`, done: rating >= 4.8 && n >= 500, progress: Math.min(rating / 4.8, n / 500) },
      { label: '45% of orders from repeat customers', value: `${Math.round(repeat * 100)}%`, done: repeat >= 0.45, progress: repeat / 0.45 },
      { label: '$1M profit over 12 months', value: money(y.profit), done: y.profit >= 1e6, progress: y.profit / 1e6 },
      { label: '15 staff or fewer', value: `${staff}`, done: staff <= 15, progress: staff <= 15 ? 1 : 15 / staff },
    ];
  }
  if (id === 'giant') {
    const big = CHANNEL_ORDER.filter((c) => (y.channel[c] ?? 0) >= y.revenue * 0.1).length;
    return [
      { label: '$50M revenue over 12 months', value: money(y.revenue), done: y.revenue >= 5e7, progress: y.revenue / 5e7 },
      { label: '3+ channels with 10%+ of revenue', value: `${big}`, done: big >= 3, progress: big / 3 },
    ];
  }
  if (id === 'king') {
    const best = bestCategory(s);
    const cat = CATEGORIES[best.cat];
    const exclusive = liveProducts(s).some((pid) => def(s, pid).exclusive && def(s, pid).category === best.cat);
    return [
      { label: `#1 share in ${cat.name} (beat ${cat.topCompetitor.name} at ${Math.round(cat.topCompetitor.share * 100)}%)`, value: `${(best.share * 100).toFixed(1)}%`, done: best.share > cat.topCompetitor.share, progress: best.share / cat.topCompetitor.share },
      { label: `An exclusive product in ${cat.name}`, value: exclusive ? 'Yes' : 'No', done: exclusive, progress: exclusive ? 1 : 0 },
    ];
  }
  const qualifying = s.brands.filter((b) => {
    const t = brandTrailing(s, b.id, 30);
    return t.revenue >= 20000 && t.profit > 0;
  }).length;
  return [{ label: '4 brands with $20k+ monthly revenue and a profit', value: `${qualifying} of ${s.brands.length}`, done: qualifying >= 4, progress: qualifying / 4 }];
}

export function bestCategory(s: GameState): { cat: CategoryId; share: number } {
  let best: { cat: CategoryId; share: number } = { cat: 'pets', share: 0 };
  for (const cat of Object.keys(CATEGORIES) as CategoryId[]) {
    const share = marketShare(s, cat);
    if (share > best.share) best = { cat, share };
  }
  return best;
}

export function ambitionDone(s: GameState, id: AmbitionId): boolean {
  return ambitionChecks(s, id).every((c) => c.done);
}

export { AMBITIONS };
