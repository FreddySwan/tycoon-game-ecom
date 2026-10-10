import { CHANNELS, CHANNEL_ORDER } from '../../sim/data';
import { channelFee, def, liveProducts, trailing } from '../../sim/economics';
import { joinChannel, listingProblem, runPromo, setListing } from '../../sim/engine';
import type { ChannelId } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle } from '../bits';
import { money, pct } from '../format';

export function Channels() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const t = trailing(game, 30);
  const chans = CHANNEL_ORDER.filter((c) => c !== 'store');

  return (
    <div>
      <AppTitle app="Channels" title="Where you sell" sub="Each channel has its own shoppers, fees and rules. Revenue split over the last 30 days is shown on each card." />
      <div className="cards">
        <div className="card selected">
          <h4>🛍️ Your store</h4>
          <p>You own the customer and their email. You pay for every visitor.</p>
          <b>{money(t.channel.store ?? 0)} · 30d</b>
        </div>
        {chans.map((ch) => {
          const c = CHANNELS[ch];
          const joined = game.channels[ch]?.joined;
          const locked = game.stage < c.unlockStage;
          return (
            <div key={ch} className="card" style={{ opacity: locked ? 0.55 : 1 }}>
              <h4>
                {c.emoji} {c.name}
              </h4>
              <p>{c.desc}</p>
              <div className="tiny">
                Fee {pct(channelFee(game, ch), 0)}
                {c.program && ` · ${c.program.name}: $${c.program.feePerUnit}/unit`}
                {c.minQuality && ' · premium quality only'}
                {c.maxPriceRatio && ` · prices ≤ ${Math.round(c.maxPriceRatio * 100)}% of normal`}
                {` · pays every ${c.payoutEvery} days`}
              </div>
              {locked ? (
                <span className="pill">🔒 Stage {c.unlockStage}</span>
              ) : joined ? (
                <b>{money(t.channel[ch] ?? 0)} · 30d</b>
              ) : (
                <button className="primary" onClick={() => act(joinChannel, ch)}>
                  Join{c.joinCost ? ` (${money(c.joinCost)})` : ''}
                  {c.monthlyFee ? ` · ${money(c.monthlyFee)}/mo` : ''}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {chans.some((ch) => game.channels[ch]?.joined) && (
        <>
          <h3>Listings</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Product</th>
                {chans.filter((ch) => game.channels[ch]?.joined).map((ch) => (
                  <th key={ch}>
                    {CHANNELS[ch].emoji} {CHANNELS[ch].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liveProducts(game).map((pid) => (
                <tr key={pid}>
                  <td>
                    {def(game, pid).emoji} {def(game, pid).name}
                  </td>
                  {chans.filter((ch) => game.channels[ch]?.joined).map((ch) => listing(pid, ch))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tiny muted">Marketplace rank rises with sales, good ratings and sponsored listings, and drops fast when you run out of stock.</p>
        </>
      )}

      {game.wholesale.some((w) => !w.shipped) && (
        <>
          <h3>🏪 Wholesale orders</h3>
          <table className="data">
            <tbody>
              {game.wholesale.filter((w) => !w.shipped).map((w) => (
                <tr key={w.id}>
                  <td>{w.account}</td>
                  <td>
                    {w.qty.toLocaleString()} × {def(game, w.productId).name} at {money(w.unitPrice, true)}
                  </td>
                  <td className={game.day > w.dueDay ? 'bad-text' : ''}>ship by day {w.dueDay}</td>
                  <td className="tiny muted">{game.products[w.productId].inventory.onHand >= w.qty ? 'Ships with the next packing run' : 'Waiting for stock'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );

  function listing(pid: string, ch: ChannelId) {
    const l = game.products[pid].listings[ch];
    const c = CHANNELS[ch];
    const problem = listingProblem(game, pid, ch);
    return (
      <td key={ch} style={{ minWidth: 150 }}>
        <label className="row tiny" style={{ gap: 6 }}>
          <input type="checkbox" checked={!!l?.active} onChange={(e) => act(setListing, pid, ch, { active: e.target.checked })} />
          {l?.active ? (
            <>
              $
              <input type="number" style={{ width: 64 }} value={l.price} step={1} onChange={(e) => act(setListing, pid, ch, { price: +e.target.value })} />
            </>
          ) : (
            <span className="muted">{problem ?? 'Not listed'}</span>
          )}
        </label>
        {l?.active && ch !== 'loopshop' && (
          <div className="tiny" style={{ marginTop: 4 }}>
            Rank <b>{Math.round(l.rank * 100)}</b>
            {c.program && (
              <label style={{ marginLeft: 6 }}>
                <input type="checkbox" checked={l.program} onChange={(e) => act(setListing, pid, ch, { program: e.target.checked })} /> {ch === 'bazaarly' ? 'Express' : 'Program'}
              </label>
            )}
            <div className="row" style={{ gap: 4, marginTop: 2 }}>
              Ads $
              <input type="number" style={{ width: 56 }} value={l.sponsored} step={10} min={0} onChange={(e) => act(setListing, pid, ch, { sponsored: +e.target.value })} />
              <button className="small ghost" disabled={l.promoCooldown > game.day} onClick={() => act(runPromo, pid, ch)} title="20% off for 3 days, big traffic boost">
                {l.promoUntil >= game.day ? '⚡ live' : '⚡ Deal'}
              </button>
            </div>
          </div>
        )}
      </td>
    );
  }
}
