import { CATEGORIES } from '../../sim/data';
import { averageRating, avgDailyOrders, def, liveProducts, stockDays, trendMult } from '../../sim/economics';
import { addProduct, assignBrand, productSlots, research, retireProduct } from '../../sim/engine';
import { useGame } from '../../state/store';
import { AppTitle, Pips } from '../bits';
import { money } from '../format';

export function Products() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setTab = useGame((s) => s.setTab);
  const setProduct = useGame((s) => s.setProduct);
  const live = liveProducts(game);
  const candidates = game.revealed.filter((id) => !game.products[id] || game.products[id].retired);
  const slots = productSlots(game);
  const first = live.length === 0;

  return (
    <div>
      <AppTitle
        app="Trend Scanner"
        title={first ? 'What should you sell?' : 'Products'}
        sub={first ? 'Three promising products. There’s no wrong answer, but each one teaches something different.' : `You sell ${live.length} of ${slots === 99 ? '∞' : slots} possible products at this stage.`}
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
                        onClick={(e) => {
                          e.preventDefault();
                          setProduct(id);
                          setTab('source');
                        }}
                      >
                        {d.emoji} {d.name}
                      </a>
                      {d.exclusive && <span className="pill good" style={{ marginLeft: 6 }}>exclusive</span>}
                      {p.copycat > 0.05 && <span className="pill bad" style={{ marginLeft: 6 }}>copycats</span>}
                    </td>
                    <td className="num">{money(p.price)}</td>
                    <td className="num">{avgDailyOrders(game, id, 7).toFixed(1)}</td>
                    <td className="num">
                      {p.inventory.onHand.toLocaleString()}
                      {sd !== null && <span className={`tiny ${sd < 10 ? 'bad-text' : 'muted'}`}> · {Math.floor(sd)}d</span>}
                    </td>
                    <td className="num">{p.reviews.count ? `${averageRating(game, id).toFixed(1)}★ (${p.reviews.count})` : '—'}</td>
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

      <div className="row between" style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0 }}>{first ? '' : 'Trend Scanner'}</h3>
        {!first && (
          <button className="small" onClick={() => act(research)} title="Spend 3 founder hours digging for a new product">
            🔎 Research (3h)
          </button>
        )}
      </div>
      <div className="cards" style={{ marginTop: 10 }}>
        {candidates.map((id) => {
          const d = def(game, id);
          const trend = trendMult(game, id);
          return (
            <div key={id} className="card">
              <div className="row between">
                <span className="big-emoji">{d.emoji}</span>
                <span className="tiny muted">
                  {CATEGORIES[d.category].emoji} {CATEGORIES[d.category].name}
                </span>
              </div>
              <h4>
                {d.name} {d.exclusive && <span className="pill good">exclusive</span>}
              </h4>
              <p>{d.tagline}</p>
              <div className="bars">
                <span>Demand</span>
                <Pips n={d.bars.demand} />
                <span>Competition</span>
                <Pips n={d.bars.competition} bad />
                <span>Margin</span>
                <Pips n={d.bars.margin} />
                <span>Lifespan</span>
                <span className="row" style={{ gap: 6 }}>
                  <Pips n={d.bars.lifespan} />
                  <span className="tiny muted">{d.lifespanNote}</span>
                </span>
              </div>
              <p className="tiny">
                Sells for ~{money(d.refPrice)} · costs ~{money(d.baseUnitCost, true)} · {d.size >= 2 ? 'bulky' : d.size <= 0.5 ? 'tiny' : 'shoebox'}
                {d.trend.kind !== 'evergreen' && ` · trend now ${trend > 1.2 ? '🔥 hot' : trend < 0.6 ? '🧊 cooling' : 'steady'}`}
              </p>
              {id === 'dogbowl' && first && <span className="pill good">Recommended first run</span>}
              <button
                className="primary"
                disabled={live.length >= slots}
                onClick={() => {
                  if (!act(addProduct, id)) {
                    setProduct(id);
                    setTab('source');
                  }
                }}
              >
                Sell this
              </button>
            </div>
          );
        })}
        {!candidates.length && <p className="muted">Nothing new right now. New products appear over time and as you grow.</p>}
      </div>
    </div>
  );
}
