import type { ReactNode } from 'react';
import { hasSkill } from '../sim/economics';
import type { GameState, SkillId } from '../sim/types';
import { type TabId, useGame } from '../state/store';
import { ErrorBoundary } from './ErrorBoundary';
import { Ads } from './apps/Ads';
import { Channels } from './apps/Channels';
import { Company } from './apps/Company';
import { Customers } from './apps/Customers';
import { Finance } from './apps/Finance';
import { Inbox } from './apps/Inbox';
import { OfferApp } from './apps/Offer';
import { Ops } from './apps/Ops';
import { Products } from './apps/Products';
import { ShopBloc } from './apps/ShopBloc';
import { SourceMart } from './apps/SourceMart';
import { Team } from './apps/Team';
import { Wall } from './apps/Wall';
import { Skills } from './apps/Skills';
import { withIcons } from './icons';

interface Tab {
  id: TabId;
  label: string;
  show: (s: GameState) => boolean;
  render: () => ReactNode;
}

const hasProduct = (s: GameState) => s.productOrder.length > 0;

const TABS: Tab[] = [
  { id: 'products', label: '📈 Products', show: () => true, render: () => <Products /> },
  { id: 'skills', label: '🎓 SkillUp', show: () => true, render: () => <Skills /> },
  { id: 'source', label: '🏭 SourceMart', show: hasProduct, render: () => <SourceMart /> },
  { id: 'store', label: '🛍️ ShopBloc', show: hasProduct, render: () => <ShopBloc /> },
  { id: 'offer', label: '🏷️ Offer', show: hasProduct, render: () => <OfferApp /> },
  { id: 'ads', label: '📣 Ads', show: hasProduct, render: () => <Ads /> },
  { id: 'channels', label: '🛒 Channels', show: (s) => s.stage >= 2, render: () => <Channels /> },
  { id: 'ops', label: '📦 Ops', show: hasProduct, render: () => <Ops /> },
  { id: 'team', label: '👥 Team', show: (s) => s.stage >= 2, render: () => <Team /> },
  { id: 'inbox', label: '📬 Inbox', show: hasProduct, render: () => <Inbox /> },
  { id: 'customers', label: '💌 Customers', show: (s) => s.shipped > 0, render: () => <Customers /> },
  { id: 'finance', label: '💵 Finance', show: () => true, render: () => <Finance /> },
  { id: 'company', label: '🏢 Company', show: () => true, render: () => <Company /> },
  { id: 'wall', label: '📌 Wall', show: () => true, render: () => <Wall /> },
];

export function Laptop() {
  const game = useGame((s) => s.game);
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  const backlog = game.backlog.reduce((a, b) => a + b.orders, 0);
  const badges: Partial<Record<TabId, number | string>> = {
    source: game.samples.filter((x) => x.arrived && !x.inspected).length,
    ops: game.stage === 1 && !game.batchPacking ? Math.round(backlog) : 0,
    inbox: game.cards.length + game.events.filter((e) => !e.blocking).length,
    company: game.stageOffer ? '!' : 0,
    skills: Object.entries(game.skills).filter(([id, st]) => st && !hasSkill(game, id as SkillId)).length,
  };
  const visible = TABS.filter((t) => t.show(game));
  const active = visible.find((t) => t.id === tab) ?? visible[0];

  return (
    <div className="laptop">
      <nav className="tabs">
        {visible.map((t) => (
          <button key={t.id} className={t.id === active.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {withIcons(t.label)}
            {!!badges[t.id] && <span className="badge">{badges[t.id]}</span>}
          </button>
        ))}
      </nav>
      <div className="screen">
        <ErrorBoundary resetKey={active.id}>{active.render()}</ErrorBoundary>
      </div>
    </div>
  );
}
