import { PRODUCTS, PRODUCT_ORDER } from '../../sim/data';
import { chooseProduct } from '../../sim/engine';
import { useGame } from '../../state/store';
import { AppTitle, Pips } from '../bits';
import { money } from '../format';

export function Trends() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setTab = useGame((s) => s.setTab);

  return (
    <div>
      <AppTitle
        app="Trend Scanner"
        title={game.productId ? 'Your product' : 'What should you sell?'}
        sub={
          game.productId
            ? 'You’ve committed to a product. More slots unlock as the business grows.'
            : 'Three promising products. There’s no wrong answer, but each one teaches something different.'
        }
      />
      <div className="cards">
        {PRODUCT_ORDER.map((id) => {
          const p = PRODUCTS[id];
          const chosen = game.productId === id;
          return (
            <div key={id} className={`card ${chosen ? 'selected' : ''}`} style={{ opacity: game.productId && !chosen ? 0.5 : 1 }}>
              <div className="big-emoji">{p.emoji}</div>
              <h4>{p.name}</h4>
              <p>{p.tagline}</p>
              <div className="bars">
                <span>Demand</span>
                <Pips n={p.bars.demand} />
                <span>Competition</span>
                <Pips n={p.bars.competition} bad />
                <span>Margin</span>
                <Pips n={p.bars.margin} />
                <span>Lifespan</span>
                <span className="row" style={{ gap: 6 }}>
                  <Pips n={p.bars.lifespan} />
                  <span className="tiny muted">{p.lifespanNote}</span>
                </span>
              </div>
              <p className="tiny">
                Sells for ~{money(p.refPrice)} · costs ~{money(p.baseUnitCost, true)} to make
              </p>
              {id === 'dogbowl' && !game.productId && <span className="pill good">Recommended first run</span>}
              {!game.productId && (
                <button
                  className="primary"
                  onClick={() => {
                    if (!act(chooseProduct, id)) setTab('source');
                  }}
                >
                  Sell this
                </button>
              )}
              {chosen && <span className="pill good">Your product</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
