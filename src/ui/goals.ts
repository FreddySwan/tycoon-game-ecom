import { BATCH_UNLOCK_AFTER, STAGES, STARTING_CASH, WIN_REORDER_QTY } from '../sim/data';
import { breakEvenCPA, fulfillmentCapacity, liveProducts, stockDays } from '../sim/economics';
import { launchProblems, onStore } from '../sim/engine';
import { stageChecks } from '../sim/progress';
import type { GameState, StageId } from '../sim/types';
import type { TabId } from '../state/store';
import { money } from './format';

export interface Goal {
  title: string;
  hint: string;
  tab?: TabId;
}

export function currentGoal(s: GameState): Goal {
  const ids = liveProducts(s);
  const pid = ids[0];
  if (!pid) {
    const researched = Object.keys(s.research).length;
    if (researched < 2) return { title: 'Research products', hint: 'Quick-scan a few products in different niches in the Trend Scanner (1 founder hour each).', tab: 'products' };
    if (s.shortlist.length < 2) return { title: 'Build a shortlist', hint: 'Deep-dive the promising ones and ☆ shortlist 2–5 to compare side by side.', tab: 'products' };
    return { title: 'Pick your first product', hint: 'Compare your shortlist and commit. Your first product is the big decision.', tab: 'products' };
  }
  if (!s.samples.length) return { title: 'Order samples', hint: 'Get samples from suppliers on SourceMart and compare them yourself.', tab: 'source' };
  if (s.samples.some((x) => x.arrived && !x.inspected)) return { title: 'Unbox your samples', hint: 'Your samples are here. Inspect them on SourceMart.', tab: 'source' };
  if (!s.samples.some((x) => x.arrived)) return { title: 'Samples are on the way', hint: 'Skip ahead, or name your brand in ShopBloc while you wait.', tab: 'store' };
  if (!s.pos.length) return { title: 'Place your first order', hint: 'Negotiate a price and quantity with a supplier, then pick air or sea freight.', tab: 'source' };
  const brand = s.brands[0];
  if (!brand.store.launched) {
    if (!s.products[pid].photo) return { title: 'Do a product photo shoot', hint: 'Use your sample to shoot the hero photo in ShopBloc.', tab: 'store' };
    const p = launchProblems(s, brand.id);
    return p.length ? { title: 'Finish your storefront', hint: `${p[0]}.`, tab: 'store' } : { title: 'Launch your store!', hint: 'Everything’s ready. Hit Launch in ShopBloc ($29/month).', tab: 'store' };
  }
  if (!s.shipped && !s.products[pid].inventory.onHand) return { title: 'Waiting for stock', hint: 'Set your price in Offer and plan ads while the boxes ship.', tab: 'offer' };
  if (s.backlog.length && !s.batchPacking && s.stage === 1) return { title: 'Pack your orders', hint: `Pack the first orders by hand (${s.handPacked}/${BATCH_UNLOCK_AFTER}) to unlock batch packing.`, tab: 'ops' };
  if (s.stage === 1 && !ids.some((id) => Object.values(s.products[id].ads).some((c) => c.totals.spend > 0))) return { title: 'Launch a test campaign', hint: 'In the Ads app, switch on a few audience × creative cells at $10/day.', tab: 'ads' };
  if (s.stage === 1 && !s.milestones.first_profitable_campaign) return { title: 'Find a winning ad', hint: `Keep ads whose cost per order is under ${money(breakEvenCPA(s, pid), true)}. Pause the rest.`, tab: 'ads' };
  if (s.stage === 1 && !s.milestones.first_profitable_reorder) {
    const sd = stockDays(s, pid);
    return {
      title: 'Make your first profitable reorder',
      hint: `Reorder ${WIN_REORDER_QTY}+ units while cash + payouts stay ≥ ${money(STARTING_CASH)} after paying.${sd !== null ? ` Stock lasts ~${Math.floor(sd)} days.` : ''}`,
      tab: 'source',
    };
  }
  // Operational warnings beat long-term goals.
  const backlog = s.backlog.reduce((a, b) => a + b.orders, 0);
  const cap = fulfillmentCapacity(s);
  if (backlog > Math.max(20, cap.total * 1.5)) return { title: 'Packing can’t keep up', hint: s.stage >= 2 ? 'Hire packers, add stations, or switch on a 3PL in Ops.' : 'Call a friend for a day, or grow into a garage with room for staff.', tab: s.stage >= 2 ? 'team' : 'ops' };
  if (s.events.some((e) => !e.blocking)) return { title: 'Decisions waiting', hint: `${s.events.length} item(s) in your inbox need a call.`, tab: 'inbox' };
  const unsold = ids.find((id) => !onStore(s, id) && s.products[id].inventory.onHand > 0);
  if (unsold) return { title: 'A product isn’t on sale', hint: 'It has stock but no photo or description yet. Finish its page in ShopBloc.', tab: 'store' };
  if (s.stage < 5) {
    const next = (s.stage + 1) as StageId;
    const checks = stageChecks(s, next);
    const todo = checks.find((c) => !c.done);
    if (!todo) return { title: `Ready for stage ${next}!`, hint: `${STAGES[next].name} is within reach. Move from the Company app, or stay small on purpose.`, tab: 'company' };
    return { title: `Grow toward: ${STAGES[next].name}`, hint: `${todo.label} (now ${todo.value}).`, tab: 'company' };
  }
  if (!s.ambition) return { title: 'Choose your ambition', hint: 'What kind of company do you want this to be? Pick in the Company app.', tab: 'company' };
  return { title: 'Chase your ambition', hint: 'Track progress in the Company app.', tab: 'company' };
}
