import { Fragment } from 'react';
import { breakEvenCPA, creativeUnlocked, dailyAdBudget, product, recentCPA } from '../../sim/economics';
import { setAdCell } from '../../sim/engine';
import type { AdCell } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle } from '../bits';
import { money, pct } from '../format';

/** Days of results used to judge a cell. Short windows make noise look like winners. */
const WINDOW = 5;

function verdict(cell: AdCell, be: number): { cls: string; label: string } {
  const r = recentCPA(cell, WINDOW);
  if (r.orders < 4 && r.spend < be * 2.5) return { cls: 'amber', label: 'Not enough data yet' };
  if (r.cpa === null) return { cls: 'red', label: 'No orders: burning money' };
  if (r.cpa < be * 0.75) return { cls: 'green', label: 'Winner: scale it?' };
  if (r.cpa < be) return { cls: 'green', label: 'Profitable' };
  return { cls: 'red', label: 'Losing money' };
}

export function Scrollr() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const p = product(game);
  const be = breakEvenCPA(game);
  const cells = Object.values(game.ads);
  const yesterday = cells.reduce(
    (a, c) => {
      const h = c.history[c.history.length - 1];
      if (h && h.day === game.day) {
        a.spend += h.spend;
        a.impressions += h.impressions;
        a.clicks += h.clicks;
        a.orders += h.orders;
      }
      return a;
    },
    { spend: 0, impressions: 0, clicks: 0, orders: 0 },
  );
  const ctr = yesterday.impressions ? yesterday.clicks / yesterday.impressions : 0;
  const cvr = yesterday.clicks ? yesterday.orders / yesterday.clicks : 0;
  const leak = !yesterday.impressions ? null : ctr < 0.012 ? 'clicks' : cvr < 0.03 ? 'orders' : null;

  return (
    <div>
      <AppTitle
        app="Scrollr Ads"
        title="Campaigns"
        sub={
          <>
            Test audiences × creatives. Keep cells whose cost per order is under your break-even of <b>{money(be, true)}</b>.
          </>
        }
      />
      {!game.store.launched && <p className="callout warn">Launch your store before running ads. You can plan budgets now.</p>}

      <h3>Latest day’s funnel</h3>
      <div className="funnel">
        <div>
          <b>{yesterday.impressions.toLocaleString()}</b>Impressions
        </div>
        <div className={leak === 'clicks' ? 'leak' : ''}>
          <b>{yesterday.clicks}</b>Clicks · {pct(ctr)}
          {leak === 'clicks' && <div className="tiny bad-text">Creative isn’t stopping thumbs</div>}
        </div>
        <div className={leak === 'orders' ? 'leak' : ''}>
          <b>{yesterday.orders}</b>Orders · {pct(cvr)}
          {leak === 'orders' && <div className="tiny bad-text">Visitors don’t buy: check page, price, reviews</div>}
        </div>
        <div>
          <b>{money(yesterday.spend)}</b>Spent · {yesterday.orders ? money(yesterday.spend / yesterday.orders, true) : '—'}/order
        </div>
      </div>

      <h3>
        Test grid <span className="tiny muted">· daily budget {money(dailyAdBudget(game))}</span>
      </h3>
      <div className="adgrid" style={{ gridTemplateColumns: `120px repeat(${p.creatives.length}, 1fr)` }}>
        <div />
        {p.creatives.map((c) => (
          <div key={c.id} className="tiny">
            <b>{c.name}</b>
            <div className="muted">{c.desc}</div>
          </div>
        ))}
        {p.audiences.map((a) => row(a.id))}
      </div>
    </div>
  );

  function row(audId: string) {
    const a = p.audiences.find((x) => x.id === audId)!;
    return (
      <Fragment key={audId}>
        <div className="tiny">
          <b>{a.name}</b>
          <div className="muted">{a.desc}</div>
        </div>
        {p.creatives.map((c) => {
          const cell = game.ads[`${a.id}:${c.id}`];
          const locked = !creativeUnlocked(game, c.id);
          const v = verdict(cell, be);
          const r = recentCPA(cell, WINDOW);
          const ran = cell.totals.spend > 0;
          return (
            <div key={c.id} className={`adcell ${locked ? 'locked' : ran ? v.cls : ''}`}>
              {locked ? (
                <span className="tiny">🔒 Needs {c.requiresReviews} reviews</span>
              ) : (
                <>
                  <div className="row between">
                    <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={cell.active} onChange={(e) => act(setAdCell, cell.key, { active: e.target.checked })} />
                      <b>{cell.active ? 'On' : 'Off'}</b>
                    </label>
                    <span className="row" style={{ gap: 4 }}>
                      <button className="small ghost" onClick={() => act(setAdCell, cell.key, { budget: cell.budget - 5 })}>
                        −
                      </button>
                      <b>{money(cell.budget)}</b>
                      <button className="small ghost" onClick={() => act(setAdCell, cell.key, { budget: cell.budget + 5 })}>
                        +
                      </button>
                    </span>
                  </div>
                  {ran ? (
                    <>
                      <div className="tiny">
                        Last {WINDOW} days: {money(r.spend)} → {r.orders} orders
                      </div>
                      <div className="row between">
                        <b className={r.cpa !== null && r.cpa < be ? 'good-text' : 'bad-text'}>{r.cpa !== null ? `${money(r.cpa, true)}/order` : 'no orders'}</b>
                        <span className="tiny">{v.label}</span>
                      </div>
                      <div className="tiny muted">
                        All-time: {money(cell.totals.spend)} · {cell.totals.orders} orders
                      </div>
                    </>
                  ) : (
                    <span className="tiny muted">Not tested yet</span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </Fragment>
    );
  }
}
