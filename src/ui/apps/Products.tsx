import { useState } from 'react';
import { CATEGORIES } from '../../sim/data';
import { averageRating, avgDailyOrders, def, hasSkill, liveProducts, marketOf, roughKeep, stockDays, trendMult } from '../../sim/economics';
import { addProduct, assignBrand, digHours, digPool, productSlots, research, researchLevel, retireProduct, toggleShortlist } from '../../sim/engine';
import type { CategoryId, GameState } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle, Pips, Sparkline } from '../bits';
import { money } from '../format';
import { ProductImage } from '../photos';
import { Icon, withIcons } from '../icons';

const estimate = roughKeep;

function forecast(game: GameState, pid: string): number[] {
  return Array.from({ length: 13 }, (_, k) => trendMult(game, pid, game.day + k * 5));
}

const Unknown = () => <span className="unknown">?</span>;

export function Products() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setTab = useGame((s) => s.setTab);
  const setProduct = useGame((s) => s.setProduct);
  const setModal = useGame((s) => s.setModal);
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const live = liveProducts(game);
  const candidates = game.revealed.filter((id) => (!game.products[id] || game.products[id].retired) && def(game, id));
  const slots = productSlots(game);
  const first = live.length === 0;
  const cats = [...new Set(candidates.map((id) => def(game, id).category))];
  const shown = candidates.filter((id) => cat === 'all' || def(game, id).category === cat);
  const shortlist = game.shortlist.filter((id) => candidates.includes(id));

  const pool = digPool(game).length;
  const dig = () => {
    if (act(research)) return;
    const found = useGame.getState().game.revealed.at(-1);
    if (found) setModal({ kind: 'dig', productId: found });
  };

  const sell = (id: string) => {
    if (!act(addProduct, id)) {
      setProduct(id);
      setTab('source');
    }
  };

  return (
    <div>
      <AppTitle
        app="Trend Scanner"
        title={first ? 'Find your first product' : 'Products'}
        sub={
          first
            ? 'Your first product is the big decision. Dig for leads (1h each), investigate the market, deep-dive the promising ones, shortlist, compare, then commit.'
            : `You sell ${live.length} of ${slots === 99 ? '∞' : slots} possible products at this stage.`
        }
      />

      {live.length > 0 && (
        <>
          <h3>Your products</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Price</th>
                <th className="num">Orders/day</th>
                <th className="num">Stock</th>
                <th className="num">Rating</th>
                <th title="How this product's market has moved since you started selling it">Market</th>
                {game.brands.length > 1 && <th>Brand</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {live.map((id) => {
                const p = game.products[id];
                const d = def(game, id);
                const sd = stockDays(game, id);
                return (
                  <tr key={id}>
                    <td>
                      <a
                        href="#"
                        className="row"
                        style={{ gap: 8, flexWrap: 'nowrap' }}
                        onClick={(e) => {
                          e.preventDefault();
                          setProduct(id);
                          setTab('source');
                        }}
                      >
                        <ProductImage game={game} pid={id} size={36} round={8} />
                        <span>
                          {d.name}
                          {d.exclusive && <span className="pill good" style={{ marginLeft: 6 }}>exclusive</span>}
                          {p.copycat > 0.05 && <span className="pill bad" style={{ marginLeft: 6 }}>copycats</span>}
                        </span>
                      </a>
                    </td>
                    <td className="num">{money(p.price)}</td>
                    <td className="num">{avgDailyOrders(game, id, 7).toFixed(1)}</td>
                    <td className="num">
                      {p.inventory.onHand.toLocaleString()}
                      {sd !== null && <span className={`tiny ${sd < 10 ? 'bad-text' : 'muted'}`}> · {Math.floor(sd)}d</span>}
                    </td>
                    <td className="num">{p.reviews.count ? `${averageRating(game, id).toFixed(1)}★ (${p.reviews.count})` : '—'}</td>
                    <td>{marketCell(id)}</td>
                    {game.brands.length > 1 && (
                      <td>
                        <select value={p.brandId} onChange={(e) => act(assignBrand, id, +e.target.value)}>
                          {game.brands.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td>
                      <button
                        className="small ghost"
                        title="Stop selling. Remaining stock goes to a liquidator at 30% of cost."
                        onClick={() => {
                          if (confirm(`Retire ${d.name}? Remaining stock is liquidated at 30% of cost.`)) act(retireProduct, id, true);
                        }}
                      >
                        Retire
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {shortlist.length > 0 && (
        <>
          <h3><Icon name="trophy" /> Shortlist: side by side</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="data compare">
              <thead>
                <tr>
                  <th />
                  {shortlist.map((id) => (
                    <th key={id} style={{ minWidth: 130 }}>
                      <ProductImage game={game} pid={id} size={56} />
                      <div style={{ marginTop: 4, textTransform: 'none', fontSize: 13, color: 'var(--ink)' }}>{def(game, id).name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row('Category', (id) => `${withIcons(CATEGORIES[def(game, id).category].emoji)} ${CATEGORIES[def(game, id).category].name}`, 0)}
                {row('Demand', (id) => <Pips n={def(game, id).bars.demand} />, 1)}
                {row('Competition', (id) => <Pips n={def(game, id).bars.competition} bad />, 1)}
                {row('Searches / day', (id) => def(game, id).searchVolume.toLocaleString(), 1)}
                {row('Lifespan', (id) => def(game, id).lifespanNote, 1)}
                {row('Sells for', (id) => money(def(game, id).refPrice), 0)}
                {row('Landed cost', (id) => money(estimate(game, id).landed, true), 2)}
                {row('Keep per order', (id) => <b className={estimate(game, id).keep > 12 ? 'good-text' : ''}>{money(estimate(game, id).keep, true)}</b>, 2)}
                {row('Next 60 days', (id) => <Sparkline values={forecast(game, id)} />, 2)}
                {row('Storage', (id) => (def(game, id).size >= 2 ? 'Bulky' : def(game, id).size <= 0.5 ? 'Tiny' : 'Shoebox'), 0)}
                <tr>
                  <td />
                  {shortlist.map((id) => (
                    <td key={id}>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <button className="primary small" disabled={live.length >= slots || def(game, id).unlockStage > game.stage} onClick={() => sell(id)}>
                          Sell this
                        </button>
                        <button className="small ghost" onClick={() => act(toggleShortlist, id)}>
                          Remove
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="row between" style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0 }}>Research board</h3>
        <span className="row" style={{ gap: 8 }}>
          <span className="tiny muted">{pool ? `${pool} lead${pool === 1 ? '' : 's'} out there` : 'No new leads right now'}</span>
          <button className={first && candidates.length < 3 ? 'primary' : 'small'} onClick={dig} disabled={!pool} title="Dig through marketplaces, forums and trends for one random product idea">
            <Icon name="lightbulbOn" /> Dig for products ({digHours(game)}h)
          </button>
        </span>
      </div>
      {!candidates.length && first && (
        <div className="callout" style={{ margin: '10px 0', textAlign: 'center' }}>
          <div className="huge" style={{ fontSize: 46 }}>
            <Icon name="lightbulbOn" />
          </div>
          <b>Your board is empty.</b> Nobody hands you a winning product. Dig through marketplaces, forums and trends: each dig turns up one random lead. Then investigate it and decide.
          <div style={{ marginTop: 10 }}>
            <button className="primary" onClick={dig}>
              <Icon name="lightbulbOn" /> Start digging ({digHours(game)}h)
            </button>
          </div>
        </div>
      )}
      {cats.length > 1 && (
        <div className="options" style={{ margin: '8px 0' }}>
          <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>
            All niches
          </button>
          {cats.map((c) => (
            <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
              {withIcons(CATEGORIES[c].emoji)} {CATEGORIES[c].name}
            </button>
          ))}
        </div>
      )}
      <div className="cards">
        {shown.map((id) => card(id))}
        {!shown.length && !first && <p className="muted">No leads on the board. Dig to find more; new trends turn up over time and as you grow.</p>}
      </div>
    </div>
  );

  function marketCell(id: string) {
    const m = marketOf(game, id);
    const pct = (v: number) => `${v >= 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)}%`;
    const bits: { label: string; bad: boolean }[] = [];
    if (Math.abs(m.ad - 1) >= 0.03) bits.push({ label: `ads ${pct(m.ad)}`, bad: m.ad > 1 });
    if (Math.abs(m.cost - 1) >= 0.03) bits.push({ label: `cost ${pct(m.cost)}`, bad: m.cost > 1 });
    if (m.share <= 0.97) bits.push({ label: `demand ${pct(m.share)}`, bad: true });
    const worn = m.ad > 1.6 || m.cost > 1.3 || m.share < 0.7;
    if (!bits.length) return <span className="tiny muted">Fresh</span>;
    return (
      <span className="tiny" title="Ad costs, unit costs and your share of demand drift the longer you sell a product. When the numbers stop working, it's time for a new product.">
        {bits.map((b, i) => (
          <span key={b.label} className={b.bad ? 'bad-text' : 'good-text'}>
            {i ? ' · ' : ''}
            {b.label}
          </span>
        ))}
        {worn && (
          <div>
            <span className="pill bad">Saturating</span>
          </div>
        )}
      </span>
    );
  }

  function row(label: string, cell: (id: string) => React.ReactNode, needs: number) {
    return (
      <tr>
        <td className="sub">{label}</td>
        {shortlist.map((id) => (
          <td key={id}>{researchLevel(game, id) >= needs ? cell(id) : <Unknown />}</td>
        ))}
      </tr>
    );
  }

  function card(id: string) {
    const d = def(game, id);
    const lvl = researchLevel(game, id);
    const est = estimate(game, id);
    const listed = game.shortlist.includes(id);
    const locked = d.unlockStage > game.stage;
    return (
      <div key={id} className="card research-card">
        <ProductImage game={game} pid={id} size="100%" round={10} style={{ height: 130 }} />
        <div className="row between">
          <h4 style={{ margin: 0 }}>{d.name}</h4>
          <span className="tiny muted">
            {withIcons(CATEGORIES[d.category].emoji)} {CATEGORIES[d.category].name}
          </span>
        </div>
        <p>{d.tagline}</p>
        <div className="bars">
          <span>Demand</span>
          {lvl >= 1 ? <Pips n={d.bars.demand} /> : <Unknown />}
          <span>Competition</span>
          {lvl >= 1 ? <Pips n={d.bars.competition} bad /> : <Unknown />}
          <span>Searches</span>
          {lvl >= 1 ? <b>{d.searchVolume}/day</b> : <Unknown />}
          <span>Keep/order</span>
          {lvl >= 2 ? <b>{money(est.keep, true)}</b> : <Unknown />}
          <span>Trend</span>
          {lvl >= 2 ? <Sparkline values={forecast(game, id)} width={100} height={22} /> : lvl >= 1 ? <span className="tiny muted">{d.lifespanNote}</span> : <Unknown />}
        </div>
        {lvl >= 2 && d.insights && (
          <ul className="tiny" style={{ margin: 0, paddingLeft: 16 }}>
            {d.insights.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
        <p className="tiny muted">Sells for ~{money(d.refPrice)}</p>
        {id === 'dogbowl' && first && lvl < 1 && <span className="pill good">Good first pick</span>}
        <div className="row" style={{ gap: 6 }}>
          {lvl < 1 && (
            <button className="small" onClick={() => (hasSkill(game, 'researchTool') ? setModal({ kind: 'quiz', productId: id }) : setTab('skills'))} title={hasSkill(game, 'researchTool') ? '' : 'Needs TrendHound Pro (SkillUp)'}>
              <Icon name={hasSkill(game, 'researchTool') ? 'search' : 'lock'} /> Investigate (1h)
            </button>
          )}
          {lvl === 1 && (
            <button className="small" onClick={() => (hasSkill(game, 'researchTool') ? setModal({ kind: 'scan', productId: id }) : setTab('skills'))}>
              <Icon name="zoomIn" /> Deep dive (2h)
            </button>
          )}
          <button className={`small ${listed ? 'primary' : 'ghost'}`} onClick={() => act(toggleShortlist, id)}>
            {listed ? '★ Shortlisted' : '☆ Shortlist'}
          </button>
        </div>
        <button className="primary" disabled={live.length >= slots || locked} title={locked ? `Needs stage ${d.unlockStage}` : ''} onClick={() => sell(id)}>
          {locked ? <><Icon name="lock" /> Stage {d.unlockStage}</> : 'Sell this'}
        </button>
      </div>
    );
  }
}
