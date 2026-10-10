import { def, liveProducts, stockDays } from '../sim/economics';
import { useGame } from '../state/store';

export function ProductPicker({ note }: { note?: string }) {
  const game = useGame((s) => s.game);
  const product = useGame((s) => s.product);
  const setProduct = useGame((s) => s.setProduct);
  const setTab = useGame((s) => s.setTab);
  const ids = liveProducts(game);
  if (!ids.length)
    return (
      <div className="callout warn" style={{ marginBottom: 12 }}>
        No products yet. <button className="small" onClick={() => setTab('products')}>Open the Trend Scanner</button>
      </div>
    );
  return (
    <div className="picker">
      {ids.map((id) => {
        const p = game.products[id];
        const d = def(game, id);
        const sd = stockDays(game, id);
        const warn = p.sold > 0 && (p.inventory.onHand === 0 || (sd !== null && sd < 7));
        return (
          <button key={id} className={id === product ? 'on' : ''} onClick={() => setProduct(id)} title={d.name}>
            <span>{d.emoji}</span> {d.name.length > 18 ? d.name.slice(0, 17) + '…' : d.name}
            {warn && <span className="dot" title="Low stock" />}
          </button>
        );
      })}
      {note && <span className="tiny muted">{note}</span>}
    </div>
  );
}

/** The selected product id, guaranteed to exist (or null). */
export function useProduct(): string | null {
  const game = useGame((s) => s.game);
  const product = useGame((s) => s.product);
  return product && game.products[product] && !game.products[product].retired ? product : (liveProducts(game)[0] ?? null);
}
