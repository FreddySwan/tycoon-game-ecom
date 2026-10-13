import { useState } from 'react';
import { CATEGORIES, STYLE_INFO } from '../../sim/data';
import { activeRivals, categoryShares, def, liveProducts, marketOf, rivalAdMult, rivalDemandMult } from '../../sim/economics';
import { acquireRival, acquisitionPrice } from '../../sim/engine';
import type { CategoryId, Rival } from '../../sim/types';
import { useGame } from '../../state/store';
import { Options } from '../bits';
import { money } from '../format';
import { Icon, withIcons } from '../icons';
import { ProductImage } from '../photos';

const SHARE_COLORS = ['#e0803a', '#5a6b8c', '#b26ad6', '#2f7fd8', '#c0a040', '#8a8290'];

/** Market & rivals: who you're up against in each category, what they're doing, and what it costs you. */
export function Market() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const mine = [...new Set(liveProducts(game).map((id) => def(game, id).category))];
  const [cat, setCat] = useState<CategoryId>(mine[0] ?? 'pets');
  const active = mine.includes(cat) ? cat : (mine[0] ?? cat);
  const sh = categoryShares(game, active);
  const rivals = activeRivals(game, active);
  const products = liveProducts(game).filter((id) => def(game, id).category === active);
  const log = (game.rivalLog ?? []).filter((l) => game.rivals.find((r) => r.id === l.rivalId)?.category === active).slice(-8).reverse();
  const ref = products.length ? def(game, products[0]).refPrice : 30;

  const status = (r: Rival) => {
    const bits: string[] = [];
    if ((r.saleUntil ?? -1) >= game.day) bits.push(`on sale until ${r.saleUntil! - game.day}d`);
    if ((r.outUntil ?? -1) >= game.day) bits.push('out of stock');
    if ((r.pushUntil ?? -1) >= game.day) bits.push('ad blitz');
    if (r.runway !== undefined) bits.push(`~${Math.max(0, Math.round(r.runway))}d of funding left`);
    return bits;
  };

  if (!mine.length) return <p className="muted">Start selling a product to see who you’re up against.</p>;

  return (
    <div>
      <p className="tiny muted" style={{ marginTop: 0 }}>
        Every category has rivals. Their prices, ratings and ad budgets decide how many shoppers are left for you, and how much ads cost. Copycats show up when something of yours sells well; new brands arrive where margins are fat.
      </p>
      {mine.length > 1 && <Options value={active} options={mine.map((c) => ({ v: c, label: <>{withIcons(CATEGORIES[c].emoji)} {CATEGORIES[c].name}</> }))} onChange={setCat} />}

      <h3>Market share: {CATEGORIES[active].name}</h3>
      <div className="share-bar">
        <span style={{ width: `${sh.mine * 100}%`, background: '#1f9d55' }} title={`You ${Math.round(sh.mine * 100)}%`}>
          {sh.mine > 0.08 ? `You ${Math.round(sh.mine * 100)}%` : ''}
        </span>
        {sh.rivals.map(({ rival, share }, i) => (
          <span key={rival.id} style={{ width: `${share * 100}%`, background: SHARE_COLORS[i % SHARE_COLORS.length] }} title={`${rival.name} ${Math.round(share * 100)}%`}>
            {share > 0.1 ? rival.name : ''}
          </span>
        ))}
      </div>

      <div className="kpis" style={{ marginTop: 10 }}>
        {products.map((id) => {
          const dm = rivalDemandMult(game, id);
          const m = marketOf(game, id);
          return (
            <div key={id} className="kpi">
              <div className="k row" style={{ gap: 6 }}>
                <ProductImage game={game} pid={id} size={20} round={4} /> {def(game, id).name}
              </div>
              <div className={`v ${dm < 0.95 ? 'bad-text' : dm > 1.05 ? 'good-text' : ''}`}>{dm >= 1 ? '+' : '−'}{Math.round(Math.abs(dm - 1) * 100)}% demand</div>
              <div className="s">
                from rivals{m.share < 0.97 ? ` · market worn ${Math.round((1 - m.share) * 100)}%` : ''}
              </div>
            </div>
          );
        })}
        <div className="kpi">
          <div className="k">Ad auction</div>
          <div className={`v ${rivalAdMult(game, active) > 1.05 ? 'bad-text' : ''}`}>{rivalAdMult(game, active) >= 1 ? '+' : '−'}{Math.round(Math.abs(rivalAdMult(game, active) - 1) * 100)}% cost</div>
          <div className="s">rivals bidding on the same shoppers</div>
        </div>
      </div>

      <h3>Rivals</h3>
      <table className="data">
        <thead>
          <tr>
            <th>Brand</th>
            <th className="num">Price</th>
            <th className="num">Rating</th>
            <th>Ads</th>
            <th className="num">Share</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rivals.map((r) => {
            const share = sh.rivals.find((x) => x.rival.id === r.id)?.share ?? 0;
            return (
              <tr key={r.id}>
                <td>
                  <b>{r.name}</b> <span className={`pill ${r.style === 'copier' ? 'bad' : r.style === 'blitzer' ? 'warn' : ''}`}>{STYLE_INFO[r.style].label}</span>
                  {r.targets && <div className="tiny bad-text">Copying your {def(game, r.targets).name}</div>}
                  {r.founder && <div className="tiny muted">{"Brett Lawson's startup, from your old econ class"}</div>}
                  {status(r).length > 0 && <div className="tiny warn-text">{status(r).join(' · ')}</div>}
                </td>
                <td className="num">
                  ~{money(ref * r.price)}
                  <div className="tiny muted">{r.price < 0.97 ? 'cheaper' : r.price > 1.03 ? 'pricier' : 'about the same'}</div>
                </td>
                <td className="num">
                  {r.rating.toFixed(1)}★<div className="tiny muted">{r.reviews.toLocaleString()} reviews</div>
                </td>
                <td>
                  <span className="pips">{'■'.repeat(Math.max(1, Math.round(r.ads)))}</span>
                </td>
                <td className="num">{Math.round(share * 100)}%</td>
                <td>
                  {game.stage >= 4 && r.style !== 'copier' && (
                    <button className="small" title={STYLE_INFO[r.style].blurb} onClick={() => confirm(`Buy ${r.name} for ${money(acquisitionPrice(game, r))}? They leave the market and their customers become yours.`) && act(acquireRival, r.id)}>
                      Acquire {money(acquisitionPrice(game, r))}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="tiny muted">
        How to fight back: better ratings and photos beat copycats, sales and lightning deals answer price drops, rivals running out of stock are your moment to push ads, and a fresh product in a calmer category beats a price war.
        {game.stage < 4 ? ' From stage 4 you can buy struggling rivals.' : ''}
      </p>

      {log.length > 0 && (
        <>
          <h3>Recent moves</h3>
          <div className="feed light">
            {log.map((l, i) => (
              <div key={i}>
                <span className="day">D{l.day}</span>
                <Icon name="flag" /> {l.text}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
