import { averageRating, def, liveProducts, reviewCount, trailing } from '../../sim/economics';
import { CAMPAIGNS, FLOW_COST, forecastCampaign, SEGMENTS, segmentSize, sendCampaign, setFlow } from '../../sim/engine';
import type { CampaignType, Segment } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle, Options, Toggle } from '../bits';
import { money, pct, stars } from '../format';
import { useState } from 'react';
import { Icon, withIcons } from '../icons';

export function Customers() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const [discount, setDiscount] = useState(10);
  const [type, setType] = useState<CampaignType>('promo');
  const [segment, setSegment] = useState<Segment>('vip');
  const [brandId, setBrandId] = useState(game.brands[0].id);
  const [launchPid, setLaunchPid] = useState<string>('');

  function email() {
    if (game.stage < 2) return (
      <>
        <h3><Icon name="mail" /> Email</h3>
        <p className="tiny muted">Email unlocks in the Growing Brand stage. Until then, keep shipping happy orders. Every customer who opts in becomes a subscriber.</p>
      </>
    );
    const b = game.brands.find((x) => x.id === brandId) ?? game.brands[0];
    const pids = liveProducts(game).filter((id) => game.products[id].brandId === b.id);
    const plan = { type, segment, discount, productId: type === 'launch' ? launchPid || pids[0] : undefined };
    const f = forecastCampaign(game, b.id, plan);
    const t30 = game.history.slice(-30);
    const flowOrders = t30.reduce((a, r) => a + (r.sources?.flow ?? 0), 0);
    const flowRevenue = t30.reduce((a, r) => a + (r.sourceRevenue?.flow ?? 0), 0);
    const campOrders = t30.reduce((a, r) => a + (r.sources?.email ?? 0), 0);
    const campRevenue = t30.reduce((a, r) => a + (r.sourceRevenue?.email ?? 0), 0);
    const ready = game.day - b.email.lastCampaign >= 7;
    const camps = [...game.emails].reverse();
    return (
      <>
        <h3><Icon name="mail" /> Email</h3>
        {game.brands.length > 1 && (
          <div className="picker">
            {game.brands.map((x) => (
              <button key={x.id} className={x.id === b.id ? 'on' : ''} onClick={() => setBrandId(x.id)}>
                <span style={{ color: x.color }}>●</span> {x.name}
              </button>
            ))}
          </div>
        )}
        <div className="kpis">
          <div className="kpi"><div className="k">Subscribers</div><div className="v">{b.email.list.toLocaleString()}</div><div className="s">{Math.round(b.customers).toLocaleString()} active customers</div></div>
          <div className="kpi"><div className="k">List fatigue</div><div className="v">{Math.round(b.email.fatigue * 100)}%</div><div className="s">{b.email.fatigue > 0.3 ? 'send something useful, not salesy' : 'healthy'}</div></div>
          <div className="kpi"><div className="k">Flows · 30 days</div><div className="v">{money(flowRevenue)}</div><div className="s">{flowOrders} orders from automated emails</div></div>
          <div className="kpi"><div className="k">Campaigns · 30 days</div><div className="v">{money(campRevenue)}</div><div className="s">{campOrders} orders</div></div>
        </div>

        <div className="chat" style={{ marginBottom: 12 }}>
          <b>Automated flows</b>
          <div style={{ display: 'grid', gap: 6, margin: '8px 0 0' }}>
            <Toggle on={b.email.flows.welcome} onChange={(v) => act(setFlow, b.id, 'welcome', v)} label={<>Welcome flow <span className="tiny muted">(more first-time buyers join the list) · ${FLOW_COST} setup</span></>} />
            <Toggle on={b.email.flows.postPurchase} onChange={(v) => act(setFlow, b.id, 'postPurchase', v)} label={<>Post-purchase flow <span className="tiny muted">(+35% repeat buying) · ${FLOW_COST} setup</span></>} />
            <Toggle on={b.email.flows.winback} onChange={(v) => act(setFlow, b.id, 'winback', v)} label={<>Win-back flow <span className="tiny muted">(+15% repeat buying) · ${FLOW_COST} setup</span></>} />
          </div>
        </div>

        <div className="chat">
          <b>New campaign</b>
          <div className="cards" style={{ margin: '8px 0', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {(Object.keys(CAMPAIGNS) as CampaignType[]).map((k) => (
              <button key={k} className={`card ${type === k ? 'selected' : ''}`} style={{ textAlign: 'left', fontWeight: 600 }} onClick={() => { setType(k); setSegment(CAMPAIGNS[k].best); }}>
                <span style={{ fontSize: 22 }}>{withIcons(CAMPAIGNS[k].emoji)}</span>
                <b>{CAMPAIGNS[k].name}</b>
                <span className="tiny muted">{CAMPAIGNS[k].desc}</span>
              </button>
            ))}
          </div>
          <p className="tiny muted" style={{ margin: '6px 0 4px' }}>Send to</p>
          <Options value={segment} options={(Object.keys(SEGMENTS) as Segment[]).map((k) => ({ v: k, label: `${SEGMENTS[k].name} · ${segmentSize(game, b.id, k).toLocaleString()}` }))} onChange={setSegment} />
          {type === 'promo' && (
            <div className="row" style={{ marginTop: 8 }}>
              <span className="tiny">Discount</span>
              <Options value={discount} options={[0, 10, 20, 30].map((v) => ({ v, label: v ? `${v}%` : 'None' }))} onChange={setDiscount} />
            </div>
          )}
          {type === 'launch' && (
            <div className="row" style={{ marginTop: 8 }}>
              <span className="tiny">Product</span>
              <select value={plan.productId} onChange={(e) => setLaunchPid(e.target.value)}>
                {pids.map((id) => (
                  <option key={id} value={id}>
                    {def(game, id).name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="callout" style={{ marginTop: 10 }}>
            Reaches <b>{f.sent.toLocaleString()}</b> people · expected <b>{type === 'review' ? `~${Math.round(f.reviews)} new reviews` : `~${Math.round(f.orders)} orders`}</b> · cost {money(f.sent * 0.003, true)}
            {segment === 'all' && type !== 'story' && <span className="tiny muted"> · broad sends tire your list 50% faster</span>}
          </p>
          <button className="primary" disabled={!ready} onClick={() => act(sendCampaign, b.id, plan)}>
            {ready ? 'Send campaign' : `Next send on day ${b.email.lastCampaign + 7}`}
          </button>
        </div>

        {camps.length > 0 && (
          <>
            <h3>Campaign results</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th className="num">Sent</th>
                    <th className="num">Opened</th>
                    <th className="num">Clicked</th>
                    <th className="num">Orders</th>
                    <th className="num">Revenue</th>
                    <th className="num">Reviews</th>
                    <th className="num">Unsubs</th>
                    <th className="num">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {camps.slice(0, 12).map((c) => (
                    <tr key={c.id}>
                      <td>
                        {withIcons(CAMPAIGNS[c.type].emoji)} {CAMPAIGNS[c.type].name}
                        {c.discount ? ` · ${c.discount}% off` : ''}
                        {c.productId ? ` · ${def(game, c.productId).name}` : ''}
                        <div className="tiny muted">
                          {SEGMENTS[c.segment].name} · day {c.day}
                        </div>
                      </td>
                      <td className="num">{c.sent.toLocaleString()}</td>
                      <td className="num">{c.sent ? pct(c.opens / c.sent, 0) : '—'}</td>
                      <td className="num">{c.sent ? pct(c.clicks / c.sent, 1) : '—'}</td>
                      <td className="num">{c.orders}</td>
                      <td className="num">{money(c.revenue)}</td>
                      <td className="num">{c.reviews || '—'}</td>
                      <td className="num">{c.unsubscribes}</td>
                      <td className="num">{c.cost ? `${Math.round(c.revenue / c.cost)}×` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny muted">Orders keep coming in for 3 days after a send. Return = revenue ÷ sending cost (discounts are already in the revenue).</p>
          </>
        )}
      </>
    );
  }
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
                  {withIcons(def(game, pid).emoji)} {def(game, pid).name}
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
            <div>{withIcons(r.text)}</div>
          </div>
        ))}

      {email()}
    </div>
  );
}
