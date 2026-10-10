import { BATCH_UNLOCK_AFTER, STARTING_CASH, WIN_REORDER_QTY } from '../sim/data';
import { breakEvenCPA, stockDays } from '../sim/economics';
import { launchProblems } from '../sim/engine';
import type { GameState } from '../sim/types';
import type { TabId } from '../state/store';
import { money } from './format';

export interface Goal {
  title: string;
  hint: string;
  tab?: TabId;
}

export function currentGoal(s: GameState): Goal {
  if (!s.productId) return { title: 'Find a product to sell', hint: 'Open the Trend Scanner and pick one of three products.', tab: 'trends' };
  if (!s.samples.length) return { title: 'Order samples', hint: 'Get samples from suppliers on SourceMart and compare them yourself.', tab: 'source' };
  const unopened = s.samples.find((x) => x.arrived && !x.inspected);
  if (unopened) return { title: 'Unbox your samples', hint: 'Your samples are here. Inspect them on SourceMart.', tab: 'source' };
  if (!s.samples.some((x) => x.arrived)) return { title: 'Samples are on the way', hint: 'Skip ahead, or start naming your brand in ShopBloc while you wait.', tab: 'store' };
  if (!s.pos.length) return { title: 'Place your first order', hint: 'Negotiate a price and quantity with a supplier, then pick air or sea freight.', tab: 'source' };
  if (!s.store.photo) return { title: 'Do a product photo shoot', hint: 'Use your sample to shoot the hero photo in ShopBloc.', tab: 'store' };
  if (!s.store.launched) {
    const p = launchProblems(s);
    return p.length
      ? { title: 'Finish your storefront', hint: `${p[0]}.`, tab: 'store' }
      : { title: 'Launch your store!', hint: 'Everything’s ready. Hit Launch in ShopBloc ($29/month).', tab: 'store' };
  }
  if (!s.inventory.onHand && !s.shipped) return { title: 'Waiting for stock', hint: 'Set your price in Offer and plan ads on Scrollr while the boxes ship.', tab: 'offer' };
  if (s.backlog.length && !s.batchPacking) return { title: 'Pack your orders', hint: `Pack the first orders by hand (${s.handPacked}/${BATCH_UNLOCK_AFTER}) to unlock batch packing.`, tab: 'orders' };
  if (!Object.values(s.ads).some((c) => c.active || c.totals.spend > 0))
    return { title: 'Launch a test campaign', hint: 'On Scrollr, switch on a few audience × creative cells at $10/day.', tab: 'ads' };
  if (!s.milestones.first_profitable_campaign)
    return { title: 'Find a winning ad', hint: `Keep ads whose cost per order is under ${money(breakEvenCPA(s), true)}. Pause the rest.`, tab: 'ads' };
  if (!s.won) {
    const sd = stockDays(s);
    return {
      title: 'Make your first profitable reorder',
      hint: `Reorder ${WIN_REORDER_QTY}+ units while cash + payouts stay ≥ ${money(STARTING_CASH)} after paying.${sd !== null ? ` Stock lasts ~${Math.floor(sd)} days.` : ''}`,
      tab: 'source',
    };
  }
  return { title: 'You did it! Keep growing', hint: 'Stage 2 (a real workspace, first hire) is coming in a future build.', tab: 'cash' };
}
