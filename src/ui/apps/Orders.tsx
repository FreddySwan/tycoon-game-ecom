import { BATCH_UNLOCK_AFTER, FRIEND_HELP, HOURS } from '../../sim/data';
import { averageRating, hoursLeft } from '../../sim/economics';
import { callFriend, resolveCard, resolveEvent } from '../../sim/engine';
import { useGame } from '../../state/store';
import { AppTitle } from '../bits';
import { money, stars } from '../format';

export function Orders() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const capacity = Math.floor(hoursLeft(game) / HOURS.batchPack);
  const events = game.events.filter((e) => !e.blocking);

  return (
    <div>
      <AppTitle app="Orders" title="Packing table & inbox" sub="Every order is a real person. Ship fast, answer kindly, and the reviews follow." />

      {events.map((ev) => (
        <div key={ev.id} className="inbox-card" style={{ borderColor: '#f2d48a', background: '#fffaf0' }}>
          <div className="who">
            <span className="av">⚠️</span> {ev.title}
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
            </div>
            <span className={`pill ${card.expiresDay - game.day <= 1 ? 'bad' : ''}`}>
              {card.expiresDay - game.day <= 0 ? 'Reply today!' : `${card.expiresDay - game.day + 1} days to reply`}
            </span>
          </div>
          <p style={{ margin: '6px 0 0' }}>“{card.message}”</p>
          <div className="choices">
            {card.choices.map((c) => (
              <button key={c.id} onClick={() => act(resolveCard, card.id, c.id)}>
                {c.label}
                <small>{c.hint}</small>
              </button>
            ))}
          </div>
          <div className="tiny muted" style={{ marginTop: 6 }}>Each reply takes {HOURS.card * 60} minutes of founder time.</div>
        </div>
      ))}

      <div className="row between" style={{ marginTop: 10 }}>
        <h3 style={{ margin: 0 }}>Orders to pack ({game.backlog.length})</h3>
        <button className="small" onClick={() => act(callFriend)} disabled={game.extraHours > 0} title="A friend helps pack today">
          📞 Call a friend (+{FRIEND_HELP.hours}h today, {money(FRIEND_HELP.cost)})
        </button>
      </div>
      <p className="tiny muted">
        {game.batchPacking
          ? `Batch packing is on: at the end of each day your leftover founder hours pack up to ${capacity} more orders automatically.`
          : `Pack ${BATCH_UNLOCK_AFTER - game.handPacked} more orders by hand to learn the ropes. Then batch packing unlocks.`}
      </p>
      {game.backlog.length === 0 && <p className="muted">All caught up. Invoice the cat is disappointed: no boxes to sit in.</p>}
      {game.backlog.slice(0, 8).map((o) => (
        <div key={o.id} className="order">
          <span style={{ fontSize: 22 }}>{o.bundle ? '📦📦' : '📦'}</span>
          <div className="grow">
            <b>{o.customer}</b> <span className="muted">· {o.city}</span>
            <div className="tiny muted">
              {o.bundle ? '2-pack bundle' : '1 unit'} · {money(o.revenue, true)} · ordered day {o.day}
              {game.day - o.day >= 2 && <span className="bad-text"> · waiting {game.day - o.day} days</span>}
            </div>
          </div>
          <button className="small primary" onClick={() => setModal({ kind: 'pack', orderId: o.id })}>
            Pack it
          </button>
        </div>
      ))}
      {game.backlog.length > 8 && <p className="tiny muted">…and {game.backlog.length - 8} more.</p>}

      <h3>
        Reviews {game.reviews.length > 0 && <span className="tiny muted">· {averageRating(game).toFixed(1)}★ from {game.reviews.length}</span>}
      </h3>
      {game.reviews.length === 0 && <p className="muted tiny">No reviews yet. They arrive a few days after delivery.</p>}
      {[...game.reviews]
        .reverse()
        .slice(0, 8)
        .map((r, i) => (
          <div key={i} className="review">
            <span className="st">{stars(r.stars)}</span> <b>{r.author}</b> <span className="tiny muted">day {r.day}</span>
            <div>{r.text}</div>
          </div>
        ))}
      <p className="tiny muted" style={{ marginTop: 10 }}>
        Shipped {game.shipped} orders · {game.returns} returns
      </p>
    </div>
  );
}
