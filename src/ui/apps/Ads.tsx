import { Fragment, useState } from 'react';
import { CREATIVES, CREATIVE_ORDER, CREATORS, CTA_FIT, HOOK_FIT, hooksFor } from '../../sim/data';
import { adTrailing, audiences, breakEvenCPA, creativeMult, creativeUnlocked, dailyAdBudget, def, liveProducts, recentCPA, searchForecast, trailing } from '../../sim/economics';
import { adCap, completeAngleTest, hireCreator, onStore, searchUnlocked, setAdCell, setAdPolicy, setCreative, setSearch } from '../../sim/engine';
import type { AdCell, AdDay, AdSource, CreativeType, Cta, GameState } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle, NumberInput, Options, SubTabs } from '../bits';
import { money, pct } from '../format';
import { ProductImage, ProductShot, photosFor, photoUrl } from '../photos';
import { ProductPicker, useProduct } from '../ProductPicker';

type View = 'overview' | 'campaigns' | 'studio' | 'creators' | 'manager';
const WINDOW = 5;
const SOURCES: { id: AdSource; label: string }[] = [
  { id: 'scrollr', label: '📣 Scrollr social' },
  { id: 'seekly', label: '🔎 Seekly search' },
  { id: 'creator', label: '🎬 Creators' },
  { id: 'sponsored', label: '🅱️ Marketplace sponsored' },
];

function verdict(cell: { history: { spend: number; orders: number }[] }, be: number): { cls: string; label: string } {
  const r = recentCPA(cell, WINDOW);
  if (r.orders < 4 && r.spend < be * 2.5) return { cls: 'amber', label: 'Learning…' };
  if (r.cpa === null) return { cls: 'red', label: 'No orders' };
  if (r.cpa < be * 0.75) return { cls: 'green', label: 'Winner' };
  if (r.cpa < be) return { cls: 'green', label: 'Profitable' };
  return { cls: 'red', label: 'Losing money' };
}

const ratio = (a: number, b: number) => (b ? a / b : 0);

export function Ads() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const [view, setView] = useState<View>('overview');
  const [days, setDays] = useState(7);
  const pid = useProduct();
  const marketer = game.people.find((p) => p.role === 'marketer');

  return (
    <div>
      <AppTitle
        app="Scrollr · Seekly · Creators"
        title="Advertising"
        sub={
          <>
            Daily budget set: <b>{money(dailyAdBudget(game))}</b>
            {marketer ? <> · 📈 {marketer.name} manages bids daily (cap {money(adCap(game))}/day)</> : ' · You manage every bid yourself'}
          </>
        }
      />
      <SubTabs
        value={view}
        onChange={setView}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'campaigns', label: 'Campaigns' },
          { id: 'studio', label: 'Creative studio' },
          ...(game.stage >= 2 ? [{ id: 'creators' as View, label: 'Creators' }] : []),
          { id: 'manager', label: 'Ad manager' },
        ]}
      />
      {view === 'overview' && overview()}
      {view === 'campaigns' && (
        <>
          <ProductPicker />
          {pid && campaigns(pid)}
        </>
      )}
      {view === 'studio' && (
        <>
          <ProductPicker />
          {pid && studio(pid)}
        </>
      )}
      {view === 'creators' && creators()}
      {view === 'manager' && manager()}
    </div>
  );

  // ───────────────────────────── overview ─────────────────────────────

  function overview() {
    const { byProduct, total } = adTrailing(game, days);
    const sum = Object.values(total).reduce((a, x) => ({ spend: a.spend + x.spend, impressions: a.impressions + x.impressions, clicks: a.clicks + x.clicks, orders: a.orders + x.orders, revenue: a.revenue + x.revenue }), { spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0 });
    const revenue = trailing(game, days).revenue;
    const ids = liveProducts(game);
    return (
      <>
        <div className="row between">
          <span className="tiny muted">Results attributed to each ad source. Revenue = what those orders brought in.</span>
          <Options value={days} options={[{ v: 7, label: 'Last 7 days' }, { v: 30, label: 'Last 30 days' }]} onChange={setDays} />
        </div>
        <div className="kpis" style={{ marginTop: 10 }}>
          <Kpi k="Ad spend" v={money(sum.spend)} s={`${pct(ratio(sum.spend, revenue))} of all revenue`} />
          <Kpi k="Ad orders" v={sum.orders.toLocaleString()} s={`${sum.clicks.toLocaleString()} clicks`} />
          <Kpi k="Cost per order" v={sum.orders ? money(sum.spend / sum.orders, true) : '—'} s="all sources" />
          <Kpi k="Ad revenue" v={money(sum.revenue)} s={`ROAS ${ratio(sum.revenue, sum.spend).toFixed(2)}×`} />
        </div>
        <h3>By source</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Source</th>
              <th className="num">Spend</th>
              <th className="num">Impr.</th>
              <th className="num">Clicks</th>
              <th className="num">CTR</th>
              <th className="num">Orders</th>
              <th className="num">CPA</th>
              <th className="num">Revenue</th>
              <th className="num">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((src) => adRow(src.label, total[src.id]))}
            {adRow('Total', sum, true)}
          </tbody>
        </table>

        <h3>By product</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Product</th>
                {SOURCES.map((s) => (
                  <th key={s.id} className="num">
                    {s.label.split(' ')[0]} spend / CPA
                  </th>
                ))}
                <th className="num">Total spend</th>
                <th className="num">Orders</th>
                <th className="num">CPA vs break-even</th>
                <th className="num">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                const row = byProduct[id] ?? {};
                const t = Object.values(row).reduce((a, x) => ({ spend: a.spend + (x?.spend ?? 0), orders: a.orders + (x?.orders ?? 0), revenue: a.revenue + (x?.revenue ?? 0) }), { spend: 0, orders: 0, revenue: 0 });
                const be = breakEvenCPA(game, id);
                const cpa = t.orders ? t.spend / t.orders : null;
                return (
                  <tr key={id}>
                    <td>
                      <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        <ProductImage game={game} pid={id} size={28} round={6} /> {def(game, id).name}
                      </span>
                    </td>
                    {SOURCES.map((s) => {
                      const x = row[s.id];
                      return (
                        <td key={s.id} className="num">
                          {x && x.spend ? (
                            <>
                              {money(x.spend)}
                              <div className={`tiny ${x.orders && x.spend / x.orders < be ? 'good-text' : 'bad-text'}`}>{x.orders ? money(x.spend / x.orders, true) : 'no orders'}</div>
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="num">{money(t.spend)}</td>
                    <td className="num">{t.orders}</td>
                    <td className={`num ${cpa !== null && cpa < be ? 'good-text' : cpa !== null ? 'bad-text' : ''}`}>
                      {cpa !== null ? money(cpa, true) : '—'} <span className="tiny muted">/ {money(be, true)}</span>
                    </td>
                    <td className="num">{ratio(t.revenue, t.spend).toFixed(2)}×</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  function adRow(label: string, x: AdDay, bold = false) {
    return (
      <tr key={label} style={bold ? { fontWeight: 800 } : undefined}>
        <td>{label}</td>
        <td className="num">{money(x.spend)}</td>
        <td className="num">{Math.round(x.impressions).toLocaleString()}</td>
        <td className="num">{Math.round(x.clicks).toLocaleString()}</td>
        <td className="num">{pct(ratio(x.clicks, x.impressions))}</td>
        <td className="num">{x.orders.toLocaleString()}</td>
        <td className="num">{x.orders ? money(x.spend / x.orders, true) : '—'}</td>
        <td className="num">{money(x.revenue)}</td>
        <td className="num">{ratio(x.revenue, x.spend).toFixed(2)}×</td>
      </tr>
    );
  }

  // ───────────────────────────── campaigns ─────────────────────────────

  function campaigns(pid: string) {
    const p = game.products[pid];
    const be = breakEvenCPA(game, pid);
    const auds = audiences(game, pid);
    return (
      <>
        <p className="callout good">
          Break-even for {def(game, pid).name}: <b>{money(be, true)}</b> per order. Keep ads that win orders for less. Edit the creatives in the Creative studio tab.
        </p>
        {!onStore(game, pid) && <p className="callout warn">This product isn’t live in your store yet. You can plan budgets now.</p>}
        <h3>📣 Scrollr social ads</h3>
        <div className="adgrid" style={{ gridTemplateColumns: `110px repeat(${CREATIVE_ORDER.length}, 1fr)` }}>
          <div />
          {CREATIVE_ORDER.map((c) => (
            <div key={c} className="tiny row" style={{ gap: 6, flexWrap: 'nowrap' }}>
              {thumb(pid, c)}
              <b>{c === 'video' ? def(game, pid).videoHook : CREATIVES[c].name}</b>
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
      </>
    );
  }

  function thumb(pid: string, c: CreativeType) {
    const cr = game.products[pid].creatives[c];
    const list = photosFor(game, pid);
    const src = cr.photo >= 0 ? list[cr.photo % Math.max(1, list.length)] : list[0];
    return src ? <img src={photoUrl(src)} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover' }} /> : null;
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
              <NumberInput value={cell.budget} prefix="$" step={cell.budget >= 50 ? 25 : 5} min={5} width={58} onChange={(v) => act(setAdCell, pid, cell.key, { budget: v })} />
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
    const clicks = p.search.history.slice(-7).reduce((a, h) => a + h.clicks, 0);
    return (
      <div className={`adcell ${p.search.history.length ? v.cls : ''}`} style={{ maxWidth: 520 }}>
        <div className="row between">
          <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={p.search.active} onChange={(e) => act(setSearch, pid, { active: e.target.checked })} />
            <b>Search ads {p.search.active ? 'on' : 'off'}</b>
          </label>
          <NumberInput value={p.search.budget} prefix="$" step={p.search.budget >= 50 ? 25 : 5} min={5} onChange={(v) => act(setSearch, pid, { budget: v })} />
        </div>
        <div className="tiny muted">
          ~{money(f.cpc, true)} per click · up to {Math.round(f.maxClicks)} searches a day for this product · high intent
        </div>
        {p.search.history.length > 0 && (
          <div className="row between">
            <span className="tiny">
              7d: {money(r.spend)} · {clicks} clicks → {r.orders} orders
            </span>
            <b className={r.cpa !== null && r.cpa < be ? 'good-text' : 'bad-text'}>{r.cpa !== null ? `${money(r.cpa, true)}/order` : 'no orders'}</b>
          </div>
        )}
      </div>
    );
  }

  // ───────────────────────────── creative studio ─────────────────────────────

  function studio(pid: string) {
    return (
      <>
        <p className="tiny muted">
          Each ad format uses one creative: a photo, a hook line and a button. Hooks land differently with each audience; your own photo shoot can beat stock photos when it’s good. Changing a creative restarts its learning.
        </p>
        <AngleTest key={pid} pid={pid} />
        {CREATIVE_ORDER.map((c) => creativeEditor(pid, c))}
      </>
    );
  }

  function creativeEditor(pid: string, type: CreativeType) {
    const p = game.products[pid];
    const d = def(game, pid);
    const cr = p.creatives[type];
    const hooks = hooksFor(d);
    const hook = hooks.find((h) => h.id === cr.hook) ?? hooks[0];
    const list = photosFor(game, pid);
    const auds = audiences(game, pid);
    const locked = !creativeUnlocked(game, pid, type);
    return (
      <div key={type} className="chat" style={{ marginBottom: 14, opacity: locked ? 0.7 : 1 }}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 18 }}>
          <Phone game={game} pid={pid} type={type} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <h3 style={{ marginTop: 0 }}>
              {type === 'video' ? d.videoHook : CREATIVES[type].name} {locked && <span className="pill">🔒 {type === 'ugc' ? 'needs a creator collab' : 'needs 3 reviews'}</span>}
            </h3>
            <p className="tiny muted" style={{ margin: '0 0 4px' }}>
              Photo
            </p>
            <div className="row" style={{ gap: 6 }}>
              {list.map((ph, i) => (
                <button key={ph.src} className={`photo-pick ${cr.photo === i ? 'on' : ''}`} onClick={() => act(setCreative, pid, type, { photo: i })} title={ph.title}>
                  <img src={photoUrl(ph)} alt="" />
                </button>
              ))}
              <button className={`photo-pick ${cr.photo < 0 ? 'on' : ''}`} disabled={!p.photo} onClick={() => act(setCreative, pid, type, { photo: -1 })} title="Your own photo shoot">
                <span style={{ fontSize: 11, fontWeight: 800 }}>
                  Your shot
                  <br />
                  {p.photoStars ? '★'.repeat(p.photoStars) : '—'}
                </span>
              </button>
            </div>
            <p className="tiny muted" style={{ margin: '10px 0 4px' }}>
              Hook
            </p>
            <select value={cr.hook} onChange={(e) => act(setCreative, pid, type, { hook: e.target.value })} style={{ width: '100%' }}>
              {hooks.map((h) => (
                <option key={h.id} value={h.id}>
                  [{HOOK_FIT[h.type].label}] {h.text}
                </option>
              ))}
            </select>
            <p className="tiny muted" style={{ margin: '4px 0 0' }}>
              {HOOK_FIT[hook.type].tip}
            </p>
            <p className="tiny muted" style={{ margin: '10px 0 4px' }}>
              Button
            </p>
            <Options value={cr.cta} options={(Object.keys(CTA_FIT) as Cta[]).map((k) => ({ v: k, label: CTA_FIT[k].label }))} onChange={(v) => act(setCreative, pid, type, { cta: v })} />
            <div style={{ marginTop: 10 }}>
              {game.angleTested[pid] === undefined && !Object.values(p.ads).some((c) => c.creative === type && c.daysActive >= 5) ? (
                <p className="tiny muted">🔒 Audience fit is unknown. Run the angle test above, or let this creative run for 5 days.</p>
              ) : auds.map((a, i) => {
                const m = creativeMult(game, pid, type, i);
                const score = m.ctr * m.cvr;
                return (
                  <div key={a.id} className="row between tiny">
                    <span>{a.name}</span>
                    <b className={score >= 1.15 ? 'good-text' : score < 0.95 ? 'bad-text' : ''}>{score >= 1.25 ? '★★★ strong' : score >= 1.08 ? '★★ good' : score >= 0.95 ? '★ okay' : 'weak'}</b>
                  </div>
                );
              })}
              {creativeMult(game, pid, type, 0).notes.map((n) => (
                <div key={n} className="tiny bad-text">
                  ⚠️ {n}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────── creators ─────────────────────────────

  function creators() {
    const pidSel = pid;
    const { byProduct } = adTrailing(game, 60);
    const posts = [...game.creatorPosts].reverse().slice(0, 12);
    return (
      <>
        <p className="tiny muted">Pay a creator to post. Their audience lands on LoopShop if you’re listed there, otherwise on your store. A collab unlocks Creator UGC ads for that product. Some posts go viral.</p>
        <ProductPicker />
        {pidSel && (
          <div className="row" style={{ marginBottom: 14 }}>
            {CREATORS.map((c) => (
              <button key={c.id} onClick={() => act(hireCreator, pidSel, c.id)} disabled={game.products[pidSel].creatorBoost.length > 0}>
                {c.name} · {c.followers}
                <small style={{ display: 'block', fontWeight: 600, opacity: 0.7 }}>
                  {money(c.cost)} · {Math.round(c.viral * 100)}% viral chance
                </small>
              </button>
            ))}
          </div>
        )}
        <h3>Results by product (60 days)</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">Spend</th>
              <th className="num">Visits</th>
              <th className="num">Orders</th>
              <th className="num">CPA</th>
              <th className="num">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {liveProducts(game)
              .filter((id) => byProduct[id]?.creator)
              .map((id) => {
                const x = byProduct[id].creator!;
                return (
                  <tr key={id}>
                    <td>{def(game, id).name}</td>
                    <td className="num">{money(x.spend)}</td>
                    <td className="num">{Math.round(x.clicks).toLocaleString()}</td>
                    <td className="num">{x.orders}</td>
                    <td className="num">{x.orders ? money(x.spend / x.orders, true) : '—'}</td>
                    <td className="num">{money(x.revenue)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        <h3>Posts</h3>
        {!posts.length && <p className="muted tiny">No creator posts yet.</p>}
        <div className="cards">
          {posts.map((post, i) => {
            const tier = CREATORS.find((c) => c.id === post.tier);
            return (
              <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ position: 'relative' }}>
                  <ProductImage game={game} pid={post.productId} index={1} size="100%" round={0} style={{ height: 150 }} />
                  <span style={{ position: 'absolute', left: 8, top: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 12, fontWeight: 800 }}>{post.handle}</span>
                  <span style={{ position: 'absolute', right: 8, bottom: 8, fontSize: 28 }}>▶️</span>
                </div>
                <div style={{ padding: 10 }}>
                  <b>{def(game, post.productId).name}</b>
                  <div className="tiny muted">
                    {tier?.name ?? 'Creator'} · {money(post.cost)} · day {post.day}
                  </div>
                  {post.viral && <span className="pill good">🔥 went viral</span>}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // ───────────────────────────── manager policy ─────────────────────────────

  function manager() {
    const pol = game.adPolicy;
    const t = trailing(game, 30);
    return (
      <>
        {!marketer && <p className="callout warn">No growth marketer yet. {game.stage >= 2 ? 'Hire one in Team and they will follow these rules every day.' : 'Marketers unlock in the Growing Brand stage. Until then you run every ad yourself.'}</p>}
        <div className="chat">
          <h3 style={{ marginTop: 0 }}>Rules for your marketer</h3>
          <ul className="tiny" style={{ marginTop: 0 }}>
            <li>An ad that wins orders for at least <b>{pol.marginPct}%</b> less than break-even gets <b>+20% budget every day</b>, as far as the cap allows.</li>
            <li>An ad that costs more than an order earns gets <b>paused</b> once there’s enough data (3+ orders or 2× break-even spent).</li>
            <li>New tests launch automatically when a product has no running ads.</li>
            <li>Marketplace sponsored listings follow the same rules, judged against each marketplace’s own margin (fees included). Lightning deals run when a listing’s rank sags and 20% off still leaves a profit.</li>
            <li>Total daily spend stays under your cap; the least efficient ads get trimmed first.</li>
          </ul>
          <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
            <div className="row between">
              <span>Max ad spend, % of revenue</span>
              <NumberInput value={pol.maxSharePct} step={1} min={1} width={50} onChange={(v) => act(setAdPolicy, { maxSharePct: v })} />
            </div>
            <div className="row between">
              <span>Minimum daily budget (for testing)</span>
              <NumberInput value={pol.floor} prefix="$" step={25} min={0} onChange={(v) => act(setAdPolicy, { floor: v })} />
            </div>
            <div className="row between">
              <span>Required margin before scaling</span>
              <NumberInput value={pol.marginPct} step={5} min={0} width={50} onChange={(v) => act(setAdPolicy, { marginPct: v })} />
            </div>
          </div>
          <p className="tiny muted">
            Last 30 days: revenue {money(t.revenue)}, ads {money(t.pl.ads)} ({pct(ratio(t.pl.ads, t.revenue))}). Today’s cap: <b>{money(adCap(game))}/day</b>. Budgets set: {money(dailyAdBudget(game))}/day.
          </p>
        </div>
      </>
    );
  }
}

function Kpi({ k, v, s }: { k: string; v: string; s?: string }) {
  return (
    <div className="kpi">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}

/** A Scrollr feed post showing exactly what the ad looks like. */
function Phone({ game, pid, type }: { game: GameState; pid: string; type: CreativeType }) {
  const p = game.products[pid];
  const d = def(game, pid);
  const brand = game.brands.find((b) => b.id === p.brandId) ?? game.brands[0];
  const cr = p.creatives[type];
  const hook = hooksFor(d).find((h) => h.id === cr.hook) ?? hooksFor(d)[0];
  const list = photosFor(game, pid);
  const image =
    cr.photo < 0 ? (
      <ProductShot game={game} pid={pid} choice={p.photo} height={200} />
    ) : list.length ? (
      <img src={photoUrl(list[cr.photo % list.length])} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
    ) : (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 70 }}>{d.emoji}</div>
    );
  return (
    <div className="phone">
      <div className="post-head">
        <span className="av" style={{ background: brand.color }}>
          {(brand.name || 'B')[0]}
        </span>
        <span>
          {brand.name || 'Your brand'}
          <div className="tiny muted" style={{ fontWeight: 600 }}>
            Sponsored
          </div>
        </span>
      </div>
      <div style={{ position: 'relative' }}>
        {image}
        {type === 'video' && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 46 }}>▶️</span>}
        {type === 'review' && (
          <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '6px 8px', fontSize: 11 }}>
            <span style={{ color: '#f0a020' }}>★★★★★</span> “{game.reviewsRecent.filter((r) => r.productId === pid && r.stars === 5).slice(-1)[0]?.text ?? 'Exactly as pictured. Love it!'}”
          </div>
        )}
        {type === 'ugc' && <span style={{ position: 'absolute', left: 8, top: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 12, padding: '2px 8px', fontWeight: 800 }}>{game.creatorPosts.filter((x) => x.productId === pid).slice(-1)[0]?.handle ?? '@creator'}</span>}
      </div>
      <div className="copy">
        <b>{hook.text}</b>
        <div className="muted">{d.name} · {money(p.price)}</div>
      </div>
      <div className="cta">{CTA_FIT[cr.cta].label}</div>
    </div>
  );
}

/** Mini-game: match hook styles to audiences before spending money. A good read earns a fresh-angle click boost. */
function AngleTest({ pid }: { pid: string }) {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const d = def(game, pid);
  const auds = audiences(game, pid);
  const hooks = hooksFor(d);
  const options = (['problem', 'benefit', 'emotional'] as const).map((t) => hooks.find((h) => h.type === t)!);
  const [answers, setAnswers] = useState<(string | null)[]>([null, null, null]);
  const [done, setDone] = useState<number | null>(game.angleTested[pid] ?? null);
  const best = (i: number) => options.reduce((a, b) => (HOOK_FIT[b.type].ctr[i] > HOOK_FIT[a.type].ctr[i] ? b : a)).id;
  const ctaBest: Cta = 'learn';
  const questions = [
    { q: `Which hook stops a ${auds[0].name.toLowerCase()} mid-scroll?`, opts: options.map((h) => ({ v: h.id, label: h.text })), right: best(0) },
    { q: `Which hook wins over ${auds[1].name.toLowerCase()}?`, opts: options.map((h) => ({ v: h.id, label: h.text })), right: best(1) },
    { q: 'Cold audiences have never heard of you. Which button gets more of them to click?', opts: (Object.keys(CTA_FIT) as Cta[]).map((k) => ({ v: k, label: CTA_FIT[k].label })), right: ctaBest },
  ];
  if (done !== null && answers.every((a) => a === null))
    return (
      <div className="callout good" style={{ marginBottom: 12 }}>
        🎯 Angle test done ({done}/3). {done > 0 ? `Fresh-angle boost: +${done * 7}% clicks for 3 weeks after the test.` : 'No boost this time, but you can see how each creative fits now.'}
      </div>
    );
  const score = questions.reduce((a, q, i) => a + (answers[i] === q.right ? 1 : 0), 0);
  return (
    <div className="chat" style={{ marginBottom: 14 }}>
      <b>🧭 Find your angle</b>
      <p className="tiny muted" style={{ margin: '4px 0 8px' }}>Before spending a cent, read your audiences. Each right answer is worth +7% clicks on this product for 3 weeks.</p>
      {questions.map((q, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div className="tiny" style={{ fontWeight: 700, marginBottom: 4 }}>
            {i + 1}. {q.q}
          </div>
          <div className="options">
            {q.opts.map((o) => {
              const picked = answers[i] === o.v;
              const reveal = done !== null;
              const cls = reveal ? (o.v === q.right ? 'on right' : picked ? 'wrong' : '') : picked ? 'on' : '';
              return (
                <button key={o.v} className={cls} disabled={reveal} onClick={() => setAnswers((a) => a.map((x, k) => (k === i ? o.v : x)))}>
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {done === null ? (
        <button
          className="primary"
          disabled={answers.some((a) => a === null)}
          onClick={() => {
            if (!act(completeAngleTest, pid, score)) setDone(score);
          }}
        >
          Lock in answers
        </button>
      ) : (
        <p className={`callout ${done >= 2 ? 'good' : ''}`}>
          {done}/3 right. {done > 0 ? `+${done * 7}% clicks on ${d.name} ads for the next 3 weeks.` : 'Tough crowd. The fit ratings are now visible below.'} Problem hooks land with everyone; emotional ones win warm, niche audiences; “Learn more” gets cold audiences to click (but fewer buy).
        </p>
      )}
    </div>
  );
}
