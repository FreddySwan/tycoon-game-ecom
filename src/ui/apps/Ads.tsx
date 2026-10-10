import { Fragment } from 'react';
import { CREATIVES, CREATIVE_ORDER, CREATORS } from '../../sim/data';
import { audiences, breakEvenCPA, creativeUnlocked, dailyAdBudget, def, recentCPA, searchForecast } from '../../sim/economics';
import { hireCreator, onStore, searchUnlocked, setAdCell, setSearch } from '../../sim/engine';
import type { AdCell } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle } from '../bits';
import { money, pct } from '../format';
import { ProductPicker, useProduct } from '../ProductPicker';

const WINDOW = 5;

function verdict(cell: { history: { spend: number; orders: number }[] }, be: number): { cls: string; label: string } {
  const r = recentCPA(cell, WINDOW);
  if (r.orders < 4 && r.spend < be * 2.5) return { cls: 'amber', label: 'Not enough data yet' };
  if (r.cpa === null) return { cls: 'red', label: 'No orders: burning money' };
  if (r.cpa < be * 0.75) return { cls: 'green', label: 'Winner: scale it?' };
  if (r.cpa < be) return { cls: 'green', label: 'Profitable' };
  return { cls: 'red', label: 'Losing money' };
}

export function Ads() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const pid = useProduct();
  const marketer = game.people.find((p) => p.role === 'marketer');

  return (
    <div>
      <AppTitle app="Scrollr · Seekly" title="Advertising" sub={<>Total daily ad budget: <b>{money(dailyAdBudget(game))}</b>{marketer && <> · 📈 {marketer.name} reviews every ad weekly</>}</>} />
      <ProductPicker />
      {pid && body(pid)}
    </div>
  );

  function body(pid: string) {
    const p = game.products[pid];
    const be = breakEvenCPA(game, pid);
    const auds = audiences(game, pid);
    const cells = Object.values(p.ads);
    const last = cells.reduce(
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
    const ctr = last.impressions ? last.clicks / last.impressions : 0;
    const cvr = last.clicks ? last.orders / last.clicks : 0;
    const leak = !last.impressions ? null : ctr < 0.012 ? 'clicks' : cvr < 0.03 ? 'orders' : null;
    return (
      <>
        <p className="callout good">
          Break-even for {def(game, pid).name}: <b>{money(be, true)}</b> per order. Keep ads that win orders for less.
        </p>
        {!onStore(game, pid) && <p className="callout warn">This product isn’t live in your store yet. You can plan budgets now.</p>}

        <h3>📣 Scrollr social ads</h3>
        <div className="funnel">
          <div>
            <b>{last.impressions.toLocaleString()}</b>Impressions
          </div>
          <div className={leak === 'clicks' ? 'leak' : ''}>
            <b>{last.clicks.toLocaleString()}</b>Clicks · {pct(ctr)}
            {leak === 'clicks' && <div className="tiny bad-text">Creative isn’t stopping thumbs</div>}
          </div>
          <div className={leak === 'orders' ? 'leak' : ''}>
            <b>{last.orders}</b>Orders · {pct(cvr)}
            {leak === 'orders' && <div className="tiny bad-text">Visitors don’t buy: check page, price, reviews</div>}
          </div>
          <div>
            <b>{money(last.spend)}</b>Spent · {last.orders ? money(last.spend / last.orders, true) : '—'}/order
          </div>
        </div>
        <div className="adgrid" style={{ gridTemplateColumns: `110px repeat(${CREATIVE_ORDER.length}, 1fr)`, marginTop: 10 }}>
          <div />
          {CREATIVE_ORDER.map((c) => (
            <div key={c} className="tiny">
              <b>{c === 'video' ? def(game, pid).videoHook : CREATIVES[c].name}</b>
              <div className="muted">{CREATIVES[c].desc}</div>
            </div>
          ))}
          {auds.map((a) => (
            <Fragment key={a.id}>
              <div className="tiny">
                <b>{a.name}</b>
                <div className="muted">{a.desc}</div>
              </div>
              {CREATIVE_ORDER.map((c) => cellView(pid, p.ads[`${a.id}:${c}`], be))}
            </Fragment>
          ))}
        </div>

        <h3>🔎 Seekly search ads</h3>
        {searchUnlocked(game) ? searchView(pid, be) : <p className="muted tiny">Unlocks after your first profitable Scrollr campaign. Search shoppers already want what you sell.</p>}

        {game.stage >= 2 && (
          <>
            <h3>🎬 Creator collabs</h3>
            <p className="tiny muted">Pay a creator to post. Their audience lands on LoopShop if you’re listed there, otherwise your store. Unlocks Creator UGC ads for this product. Some posts go viral.</p>
            <div className="row">
              {CREATORS.map((c) => (
                <button key={c.id} onClick={() => act(hireCreator, pid, c.id)} disabled={p.creatorBoost.length > 0}>
                  {c.name} · {c.followers}
                  <small style={{ display: 'block', fontWeight: 600, opacity: 0.7 }}>
                    {money(c.cost)} · {Math.round(c.viral * 100)}% viral chance
                  </small>
                </button>
              ))}
            </div>
            {p.creatorBoost.length > 0 && <p className="tiny good-text">A creator campaign is live for {p.creatorBoost.length} more days.</p>}
          </>
        )}
      </>
    );
  }

  function cellView(pid: string, cell: AdCell, be: number) {
    const locked = !creativeUnlocked(game, pid, cell.creative);
    const v = verdict(cell, be);
    const r = recentCPA(cell, WINDOW);
    const ran = cell.totals.spend > 0;
    return (
      <div key={cell.key} className={`adcell ${locked ? 'locked' : ran ? v.cls : ''}`}>
        {locked ? (
          <span className="tiny">🔒 {cell.creative === 'ugc' ? 'Needs a creator collab' : 'Needs 3 reviews'}</span>
        ) : (
          <>
            <div className="row between">
              <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={cell.active} onChange={(e) => act(setAdCell, pid, cell.key, { active: e.target.checked })} />
                <b>{cell.active ? 'On' : 'Off'}</b>
              </label>
              <span className="row" style={{ gap: 2 }}>
                <button className="small ghost" onClick={() => act(setAdCell, pid, cell.key, { budget: cell.budget - (cell.budget > 50 ? 25 : 5) })}>
                  −
                </button>
                <b>{money(cell.budget)}</b>
                <button className="small ghost" onClick={() => act(setAdCell, pid, cell.key, { budget: cell.budget + (cell.budget >= 50 ? 25 : 5) })}>
                  +
                </button>
              </span>
            </div>
            {ran ? (
              <>
                <div className="tiny">
                  {WINDOW}d: {money(r.spend)} → {r.orders} orders
                </div>
                <div className="row between">
                  <b className={r.cpa !== null && r.cpa < be ? 'good-text' : 'bad-text'}>{r.cpa !== null ? `${money(r.cpa, true)}/order` : 'no orders'}</b>
                  <span className="tiny">{v.label}</span>
                </div>
              </>
            ) : (
              <span className="tiny muted">Not tested yet</span>
            )}
          </>
        )}
      </div>
    );
  }

  function searchView(pid: string, be: number) {
    const p = game.products[pid];
    const f = searchForecast(game, pid);
    const r = recentCPA(p.search, 7);
    const v = verdict(p.search, be);
    return (
      <div className={`adcell ${p.search.history.length ? v.cls : ''}`} style={{ maxWidth: 480 }}>
        <div className="row between">
          <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={p.search.active} onChange={(e) => act(setSearch, pid, { active: e.target.checked })} />
            <b>Search ads {p.search.active ? 'on' : 'off'}</b>
          </label>
          <span className="row" style={{ gap: 2 }}>
            <button className="small ghost" onClick={() => act(setSearch, pid, { budget: p.search.budget - (p.search.budget > 50 ? 25 : 5) })}>
              −
            </button>
            <b>{money(p.search.budget)}/day</b>
            <button className="small ghost" onClick={() => act(setSearch, pid, { budget: p.search.budget + (p.search.budget >= 50 ? 25 : 5) })}>
              +
            </button>
          </span>
        </div>
        <div className="tiny muted">
          ~{money(f.cpc, true)} per click · up to {Math.round(f.maxClicks)} searches/day for this product · high intent
        </div>
        {p.search.history.length > 0 && (
          <div className="row between">
            <span className="tiny">
              7d: {money(r.spend)} → {r.orders} orders
            </span>
            <b className={r.cpa !== null && r.cpa < be ? 'good-text' : 'bad-text'}>{r.cpa !== null ? `${money(r.cpa, true)}/order` : 'no orders'}</b>
          </div>
        )}
      </div>
    );
  }
}
