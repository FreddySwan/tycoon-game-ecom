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

/** Apps grouped by what you're doing, so the laptop shows 4 groups instead of 15 tabs. */
const GROUPS: { id: string; label: string; tabs: TabId[] }[] = [
  { id: 'make', label: '📈 Products', tabs: ['products', 'skills', 'source'] },
  { id: 'sell', label: '🛍️ Sell', tabs: ['store', 'offer', 'ads', 'channels', 'customers'] },
  { id: 'run', label: '📦 Run', tabs: ['ops', 'team', 'inbox'] },
  { id: 'money', label: '💵 Money', tabs: ['finance', 'company', 'wall'] },
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
  const groups = GROUPS.map((g) => ({ ...g, tabs: g.tabs.filter((id) => visible.some((t) => t.id === id)) })).filter((g) => g.tabs.length);
  const group = groups.find((g) => g.tabs.includes(active.id)) ?? groups[0];
  const groupBadge = (tabs: TabId[]) => tabs.reduce((a, id) => a + (typeof badges[id] === 'number' ? (badges[id] as number) : badges[id] ? 1 : 0), 0);

  return (
    <div className="laptop">
      <nav className="tabs groups">
        {groups.map((g) => (
          <button key={g.id} className={g.id === group.id ? 'on' : ''} onClick={() => setTab(g.tabs.includes(tab) ? tab : g.tabs[0])}>
            {withIcons(g.label)}
            {groupBadge(g.tabs) > 0 && g.id !== group.id && <span className="badge">{groupBadge(g.tabs)}</span>}
          </button>
        ))}
      </nav>
      <nav className="tabs subnav">
        {group.tabs.map((id) => {
          const t = TABS.find((x) => x.id === id)!;
          return (
            <button key={id} className={id === active.id ? 'on' : ''} onClick={() => setTab(id)}>
              {withIcons(t.label)}
              {!!badges[id] && <span className="badge">{badges[id]}</span>}
            </button>
          );
        })}
      </nav>
      <div className="screen">
        <ErrorBoundary resetKey={active.id}>{active.render()}</ErrorBoundary>
      </div>
    </div>
  );
}
