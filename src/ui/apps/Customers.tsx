import { averageRating, def, liveProducts, reviewCount, trailing } from '../../sim/economics';
import { FLOW_COST, sendCampaign, setFlow } from '../../sim/engine';
import { useGame } from '../../state/store';
import { AppTitle, Options, Toggle } from '../bits';
import { stars } from '../format';
import { useState } from 'react';

export function Customers() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const [discount, setDiscount] = useState(10);
  const t = trailing(game, 30);
  const repeat = t.orders ? t.repeat / t.orders : 0;

  return (
    <div>
      <AppTitle app="Customers" title="Reviews, loyalty & email" sub={`${averageRating(game).toFixed(2)}★ from ${reviewCount(game).toLocaleString()} reviews · ${Math.round(repeat * 100)}% of last month’s orders came from returning customers`} />

      <h3>Ratings by product</h3>
      <table className="data">
        <tbody>
          {liveProducts(game).map((pid) => {
            const r = game.products[pid].reviews;
            return (
              <tr key={pid}>
                <td>
                  {def(game, pid).emoji} {def(game, pid).name}
                </td>
                <td className="num">{r.count ? `${(r.sum / r.count).toFixed(2)}★` : '—'}</td>
                <td style={{ width: 200 }}>
                  <div className="hist">
                    {[...r.hist].reverse().map((n, i) => (
                      <span key={i} title={`${5 - i}★: ${n}`} style={{ width: `${r.count ? (n / r.count) * 100 : 0}%`, background: ['#1f9d55', '#7cc47f', '#f2d48a', '#f0a860', '#d64545'][i] }} />
                    ))}
                  </div>
                </td>
                <td className="num tiny muted">{r.count.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3>Latest reviews</h3>
      {[...game.reviewsRecent]
        .reverse()
        .slice(0, 6)
        .map((r, i) => (
          <div key={i} className="review">
            <span className="st">{stars(r.stars)}</span> <b>{r.author}</b> <span className="tiny muted">· {def(game, r.productId)?.name} · day {r.day}</span>
            <div>{r.text}</div>
          </div>
        ))}

      <h3>📧 Email</h3>
      {game.stage < 2 ? (
        <p className="tiny muted">Email unlocks in the Growing Brand stage. Until then, keep shipping happy orders.</p>
      ) : (
        game.brands.map((b) => (
          <div key={b.id} className="chat" style={{ marginBottom: 10 }}>
            <div className="row between">
              <b>
                <span style={{ color: b.color }}>●</span> {b.name || 'Your brand'}
              </b>
              <span>
                {b.email.list.toLocaleString()} subscribers · {Math.round(b.customers).toLocaleString()} active customers
              </span>
            </div>
            <div style={{ display: 'grid', gap: 6, margin: '10px 0' }}>
              <Toggle on={b.email.flows.welcome} onChange={(v) => act(setFlow, b.id, 'welcome', v)} label={<>Welcome flow <span className="tiny muted">(more first-time buyers join the list) · ${FLOW_COST} setup</span></>} />
              <Toggle on={b.email.flows.postPurchase} onChange={(v) => act(setFlow, b.id, 'postPurchase', v)} label={<>Post-purchase flow <span className="tiny muted">(+35% repeat buying) · ${FLOW_COST} setup</span></>} />
              <Toggle on={b.email.flows.winback} onChange={(v) => act(setFlow, b.id, 'winback', v)} label={<>Win-back flow <span className="tiny muted">(+15% repeat buying) · ${FLOW_COST} setup</span></>} />
            </div>
            <div className="row">
              <span className="tiny">Campaign discount:</span>
              <Options value={discount} options={[0, 10, 20].map((v) => ({ v, label: v ? `${v}%` : 'None' }))} onChange={setDiscount} />
              <button className="primary small" onClick={() => act(sendCampaign, b.id, discount)} disabled={game.day - b.email.lastCampaign < 7}>
                Send campaign
              </button>
            </div>
            <p className="tiny muted">
              List fatigue {Math.round(b.email.fatigue * 100)}%. Weekly at most. Discounts boost orders now but train people to wait.
            </p>
          </div>
        ))
      )}
    </div>
  );
}
