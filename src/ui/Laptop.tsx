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
import { Icon, type IconName } from './icons';

interface Tab {
  id: TabId;
  label: string;
  /** Tab title when tabs get narrow. */
  short: string;
  icon: IconName;
  /** Where this "website" lives; {brand} becomes your brand's slug. */
  url: string;
  show: (s: GameState) => boolean;
  render: () => ReactNode;
}

const hasProduct = (s: GameState) => s.productOrder.length > 0;

const TABS: Tab[] = [
  { id: 'products', label: 'Trend Scanner', short: 'Trends', icon: 'trendingUp', url: 'trendscanner.io/board', show: () => true, render: () => <Products /> },
  { id: 'skills', label: 'SkillUp', short: 'Skills', icon: 'teach', url: 'skillup.com/my-learning', show: () => true, render: () => <Skills /> },
  { id: 'source', label: 'SourceMart', short: 'Suppliers', icon: 'buildings', url: 'sourcemart.com/suppliers', show: hasProduct, render: () => <SourceMart /> },
  { id: 'store', label: 'ShopBloc', short: 'Store', icon: 'shoppingBag', url: 'admin.shopbloc.com/{brand}/store', show: hasProduct, render: () => <ShopBloc /> },
  { id: 'offer', label: 'Pricing', short: 'Pricing', icon: 'label', url: 'admin.shopbloc.com/{brand}/pricing', show: hasProduct, render: () => <OfferApp /> },
  { id: 'ads', label: 'Scrollr Ads', short: 'Ads', icon: 'radioSignal', url: 'ads.scrollr.com/manager', show: hasProduct, render: () => <Ads /> },
  { id: 'channels', label: 'Channels', short: 'Channels', icon: 'cart', url: 'sellers.bazaarly.com/hub', show: (s) => s.stage >= 2, render: () => <Channels /> },
  { id: 'ops', label: 'Orders', short: 'Orders', icon: 'archive', url: '{brand}.app/orders', show: hasProduct, render: () => <Ops /> },
  { id: 'team', label: 'Team', short: 'Team', icon: 'users', url: '{brand}.app/team', show: (s) => s.stage >= 2, render: () => <Team /> },
  { id: 'inbox', label: 'Inbox', short: 'Inbox', icon: 'inbox', url: 'mail.{brand}.co/inbox', show: hasProduct, render: () => <Inbox /> },
  { id: 'customers', label: 'Customers', short: 'CRM', icon: 'mailHeart', url: 'crm.shopbloc.com/{brand}', show: (s) => s.shipped > 0, render: () => <Customers /> },
  { id: 'finance', label: 'Bank', short: 'Bank', icon: 'money', url: 'online.harborbank.com/business', show: () => true, render: () => <Finance /> },
  { id: 'company', label: 'Company', short: 'Company', icon: 'building', url: '{brand}.co/company', show: () => true, render: () => <Company /> },
  { id: 'wall', label: 'Wall', short: 'Wall', icon: 'pin', url: 'photos.{brand}.co/wall', show: () => true, render: () => <Wall /> },
];

/** The laptop: a browser with one tab per app, an address bar, and the app's page. */
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
  const slug = (game.brands[0]?.name || 'mybrand').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'mybrand';
  const url = active.url.replace('{brand}', slug);

  return (
    <div className="laptop">
      <div className="browser">
        <nav className="tabstrip">
          {visible.map((t) => (
            <button key={t.id} className={`btab ${t.id === active.id ? 'on' : ''}`} onClick={() => setTab(t.id)} title={t.label}>
              <Icon name={t.icon} size={15} />
              <span className="btab-label">{t.id === active.id ? t.label : t.short}</span>
              {!!badges[t.id] && <span className="badge">{badges[t.id]}</span>}
            </button>
          ))}
        </nav>
        <div className="toolbar">
          <span className="nav-btns" aria-hidden>
            <Icon name="arrowRight" size={14} style={{ transform: 'scaleX(-1)' }} />
            <Icon name="arrowRight" size={14} />
            <Icon name="repeat" size={14} />
          </span>
          <div className="omnibox">
            <Icon name="lock" size={12} /> <span className="muted">https://</span>
            {url}
          </div>
        </div>
        <div className="screen">
          <ErrorBoundary resetKey={active.id}>{active.render()}</ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
