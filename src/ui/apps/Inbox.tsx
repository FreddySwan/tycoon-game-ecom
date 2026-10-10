import { HOURS } from '../../sim/data';
import { def } from '../../sim/economics';
import { cardChoices, resolveCard, resolveEvent } from '../../sim/engine';
import { useGame } from '../../state/store';
import { AppTitle } from '../bits';

export function Inbox() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const events = game.events.filter((e) => !e.blocking);
  return (
    <div>
      <AppTitle app="Inbox" title="Decisions & messages" sub="Warnings come early. Every problem has more than one answer." />
      {!events.length && !game.cards.length && <p className="muted">Inbox zero. Enjoy it while it lasts.</p>}
      {events.map((ev) => (
        <div key={ev.id} className="inbox-card" style={{ borderColor: '#f2d48a', background: '#fffaf0' }}>
          <div className="row between">
            <div className="who">
              <span className="av">⚠️</span> {ev.title}
            </div>
            {ev.expiresDay !== undefined && <span className="pill">decide by day {ev.expiresDay}</span>}
          </div>
          <p style={{ margin: '6px 0 0' }}>{ev.body}</p>
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
              <span className="av">{card.avatar}</span> {card.customer}
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
