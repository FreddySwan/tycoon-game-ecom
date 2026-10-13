import { HOURS } from '../../sim/data';
import { def } from '../../sim/economics';
import { cardChoices, resolveCard, resolveEvent, setOutsource, setTemplate, templatesUnlocked } from '../../sim/engine';
import type { CardKind, ModKey } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle, Toggle } from '../bits';
import { Icon, withIcons } from '../icons';

const KIND_LABEL: Record<CardKind, string> = { damaged: '📦 Arrived damaged', defect: '🤨 Quality complaint', late: '⏰ Late delivery' };

export function Inbox() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const events = game.events.filter((e) => !e.blocking);

  function deals() {
    const active = (game.modifiers ?? []).filter((m) => m.until >= game.day && !m.label.startsWith('Focus:'));
    if (!active.length) return null;
    const effect: Record<ModKey, string> = { adCost: 'ad costs', adCtr: 'ad clicks', seaFreight: 'sea freight', airFreight: 'air freight', unitCost: 'unit cost', packaging: 'packaging', cvr: 'conversion', creditRate: 'credit interest', creditLimit: 'credit limit', shipping: 'shipping', quality: 'quality', packRate: 'packing speed', refunds: 'refunds', repeat: 'repeat orders' };
    return (
      <div className="chat" style={{ marginBottom: 14 }}>
        <b><Icon name="briefcaseCheck" /> Active deals</b>
        {active.map((m) => (
          <div key={m.id} className="row between tiny" style={{ marginTop: 4 }}>
            <span>
              {m.label}
              {m.scope && game.products[m.scope] ? ` (${game.products[m.scope] ? def(game, m.scope).name : m.scope})` : ''}: {effect[m.key]} {m.mult > 1 ? '+' : '−'}
              {Math.round(Math.abs(m.mult - 1) * 100)}%
            </span>
            <span className="muted">{m.until - game.day} days left</span>
          </div>
        ))}
      </div>
    );
  }

  function templatesPanel() {
    if (game.team.support.count > 0)
      return <p className="tiny muted"><Icon name="headset" /> Your support team answers customer issues using the policy in Ops. Only business decisions land here.</p>;
    const unlocked = templatesUnlocked(game);
    return (
      <div className="chat" style={{ marginBottom: 14 }}>
        <div className="row between">
          <b><Icon name="zap" /> Standard replies</b>
          {unlocked && <Toggle on={!!game.support.outsource} onChange={(v) => act(setOutsource, v)} label={<>Outsource to a support service <span className="tiny muted">($2.50/message, no founder time)</span></>} />}
        </div>
        {!unlocked ? (
          <p className="tiny muted">Answer the first customers yourself. After your first profitable reorder you can set standard replies and stop clicking every message.</p>
        ) : (
          <>
            <p className="tiny muted" style={{ margin: '4px 0 8px' }}>
              Pick a default reply per issue. Matching messages get answered automatically{game.support.outsource ? ' by the service' : ' (6 minutes of your time each)'}; anything without a template still lands here.
            </p>
            <div style={{ display: 'grid', gap: 6 }}>
              {(Object.keys(KIND_LABEL) as CardKind[]).map((kind) => (
                <div key={kind} className="row between">
                  <span>{withIcons(KIND_LABEL[kind])}</span>
                  <select value={game.support.templates?.[kind] ?? ''} onChange={(e) => act(setTemplate, kind, e.target.value || null)}>
                    <option value="">Ask me every time</option>
                    {cardChoices(kind).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} ({c.hint.toLowerCase()})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }
  return (
    <div>
      <AppTitle app="Inbox" title="Decisions & messages" sub="Warnings come early. Every problem has more than one answer." />
      {templatesPanel()}
      {deals()}
      {!events.length && !game.cards.length && <p className="muted">Inbox zero. Enjoy it while it lasts.</p>}
      {events.map((ev) => (
        <div key={ev.id} className="inbox-card" style={{ borderColor: '#f2d48a', background: '#fffaf0' }}>
          <div className="row between">
            <div className="who">
              <span className="av"><Icon name="warning" /></span> {withIcons(ev.title)}
            </div>
            {ev.expiresDay !== undefined && <span className="pill">decide by day {ev.expiresDay}</span>}
          </div>
          <p style={{ margin: '6px 0 0' }}>{withIcons(ev.body)}</p>
          <div className="choices">
            {ev.choices.map((c) => (
              <button key={c.id} onClick={() => act(resolveEvent, ev.id, c.id)}>
                {c.label}
                <small>{c.hint}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
      {game.cards.length > 0 && <h3>Customer messages ({game.cards.length})</h3>}
      {game.cards.map((card) => (
        <div key={card.id} className="inbox-card">
          <div className="row between">
            <div className="who">
              <span className="av">{withIcons(card.avatar)}</span> {card.customer}
              <span className="tiny muted"> · {def(game, card.productId).name}</span>
            </div>
            <span className={`pill ${card.expiresDay - game.day <= 1 ? 'bad' : ''}`}>{card.expiresDay - game.day <= 0 ? 'Reply today!' : `${card.expiresDay - game.day + 1} days to reply`}</span>
          </div>
          <p style={{ margin: '6px 0 0' }}>“{card.message}”</p>
          <div className="choices">
            {cardChoices(card.kind).map((c) => (
              <button key={c.id} onClick={() => act(resolveCard, card.id, c.id)}>
                {c.label}
                <small>{c.hint}</small>
              </button>
            ))}
          </div>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            Each reply takes {HOURS.card * 60} minutes of founder time.
          </div>
        </div>
      ))}
    </div>
  );
}
