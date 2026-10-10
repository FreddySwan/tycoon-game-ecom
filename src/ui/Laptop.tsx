import type { ReactNode } from 'react';
import { useGame, type TabId } from '../state/store';
import { CashRiver } from './apps/CashRiver';
import { OfferApp } from './apps/Offer';
import { Orders } from './apps/Orders';
import { Scrollr } from './apps/Scrollr';
import { ShopBloc } from './apps/ShopBloc';
import { SourceMart } from './apps/SourceMart';
import { Trends } from './apps/Trends';
import { Wall } from './apps/Wall';

const TABS: { id: TabId; label: string; needsProduct?: boolean; render: () => ReactNode }[] = [
  { id: 'trends', label: '📈 Trends', render: () => <Trends /> },
  { id: 'source', label: '🏭 SourceMart', needsProduct: true, render: () => <SourceMart /> },
  { id: 'store', label: '🛍️ ShopBloc', needsProduct: true, render: () => <ShopBloc /> },
  { id: 'offer', label: '🏷️ Offer', needsProduct: true, render: () => <OfferApp /> },
  { id: 'ads', label: '📣 Scrollr', needsProduct: true, render: () => <Scrollr /> },
  { id: 'orders', label: '📦 Orders', needsProduct: true, render: () => <Orders /> },
  { id: 'cash', label: '💵 Cash', render: () => <CashRiver /> },
  { id: 'wall', label: '📌 Wall', render: () => <Wall /> },
];

export function Laptop() {
  const game = useGame((s) => s.game);
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  const badges: Partial<Record<TabId, number>> = {
    source: game.samples.filter((x) => x.arrived && !x.inspected).length,
    orders: game.backlog.length + game.cards.length + game.events.filter((e) => !e.blocking).length,
  };
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="laptop">
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'on' : ''} disabled={t.needsProduct && !game.productId} onClick={() => setTab(t.id)}>
            {t.label}
            {!!badges[t.id] && <span className="badge">{badges[t.id]}</span>}
          </button>
        ))}
      </nav>
      <div className="screen">{active.render()}</div>
    </div>
  );
}
