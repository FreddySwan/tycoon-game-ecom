import { CUSTOMER_SHIPPING_CHARGE, DAMAGE_RATE, PACKAGING_COST } from '../../sim/data';
import { brandOf, breakEvenCPA, bundlePrice, def, orderBreakdown, perception, returnRate, siteCVR } from '../../sim/economics';
import { setBrandOps, setOffer } from '../../sim/engine';
import type { Packaging } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle, Options, Toggle } from '../bits';
import { money, pct } from '../format';
import { ProductPicker, useProduct } from '../ProductPicker';

export function OfferApp() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const pid = useProduct();
  return (
    <div>
      <AppTitle app="Offer" title="Price & offer" sub="Every dollar of price changes who buys, how many buy, and what you keep." />
      <ProductPicker />
      {pid && body(pid)}
    </div>
  );

  function body(pid: string) {
    const p = game.products[pid];
    const d = def(game, pid);
    const brand = brandOf(game, pid);
    const single = orderBreakdown(game, pid, false);
    const per = perception(game, pid);
    const be = breakEvenCPA(game, pid);
    const cvr = siteCVR(game, pid, null);
    const packs: Packaging[] = game.stage >= 2 ? ['basic', 'sturdy', 'branded'] : ['basic', 'sturdy'];
    return (
      <div className="builder">
        <div>
          <div className="row between">
            <b>Price</b>
            <b style={{ fontSize: 22 }}>{money(p.price)}</b>
          </div>
          <input type="range" min={Math.round(d.refPrice * 0.5)} max={Math.round(d.refPrice * 2)} value={p.price} onChange={(e) => act(setOffer, pid, { price: +e.target.value })} />
          <div className="row between tiny muted">
            <span>Bargain</span>
            <span className="pill">{per.label}</span>
            <span>Luxury</span>
          </div>
          <h3>Extras</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <Toggle on={p.bundle} onChange={(v) => act(setOffer, pid, { bundle: v })} label={<>2-pack bundle at <b>{money(bundlePrice(game, pid), true)}</b> <span className="tiny muted">(~30% of buyers pick it)</span></>} />
          </div>
          <h3>Discount code</h3>
          <Options value={p.discountPct} options={[0, 10, 20].map((v) => ({ v, label: v ? `${v}% off` : 'None' }))} onChange={(v) => act(setOffer, pid, { discountPct: v })} />
          {game.discountFatigue > 0.05 && <p className="tiny bad-text">Discount fatigue {Math.round(game.discountFatigue * 100)}%: shoppers are learning to wait for sales.</p>}

          <h3>Brand-wide: {brand.name || 'your brand'}</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <Toggle on={brand.freeShipping} onChange={(v) => act(setBrandOps, brand.id, { freeShipping: v })} label={<>Free shipping <span className="tiny muted">(off = charge {money(CUSTOMER_SHIPPING_CHARGE, true)}, which scares buyers more than a higher price)</span></>} />
            <Toggle on={brand.thankYouCard} onChange={(v) => act(setBrandOps, brand.id, { thankYouCard: v })} label={<>Handwritten thank-you card <span className="tiny muted">(+$0.10, more and better reviews)</span></>} />
          </div>
          <p className="tiny muted" style={{ margin: '10px 0 4px' }}>
            Packaging
          </p>
          <Options
            value={brand.packaging}
            options={packs.map((v) => ({ v, label: `${v[0].toUpperCase()}${v.slice(1)} ${money(PACKAGING_COST[v], true)}` }))}
            onChange={(v) => act(setBrandOps, brand.id, { packaging: v })}
          />
          <p className="tiny muted">
            Damage in transit: basic {pct(DAMAGE_RATE.basic, 0)}, sturdy {pct(DAMAGE_RATE.sturdy, 1)}, branded {pct(DAMAGE_RATE.branded, 1)}. Branded unboxing also lifts trust, reviews and repeat buying.
          </p>
        </div>
        <div>
          <b>One order, where the money goes</b>
          <div className="receipt" style={{ marginTop: 8 }}>
            <div className="line">
              <span>Customer pays</span>
              <span>{money(single.charged, true)}</span>
            </div>
            <div className="line">
              <span>Product + freight</span>
              <span>−{money(single.cogs, true)}</span>
            </div>
            <div className="line">
              <span>Shipping{game.thirdParty ? ' + 3PL fee' : ''}</span>
              <span>−{money(single.shipping, true)}</span>
            </div>
            <div className="line">
              <span>Packaging</span>
              <span>−{money(single.packaging, true)}</span>
            </div>
            <div className="line">
              <span>Payment fees</span>
              <span>−{money(single.fees, true)}</span>
            </div>
            <div className="line total">
              <span>You keep per order</span>
              <span className={single.contribution > 0 ? 'good-text' : 'bad-text'}>{money(single.contribution, true)}</span>
            </div>
          </div>
          <div className="callout good" style={{ marginTop: 12 }}>
            <b>Break-even ad cost: {money(be, true)} per order</b>
            <div className="tiny">{p.bundle ? 'Blended with bundles. ' : ''}If ads cost more than this to win one order, you lose money on it.</div>
          </div>
          <div className="callout" style={{ marginTop: 10 }}>
            <div className="row between">
              <span>Store conversion</span>
              <b>{pct(cvr)}</b>
            </div>
            <div className="row between">
              <span>Expected returns</span>
              <b>{pct(returnRate(game, pid))}</b>
            </div>
            <div className="tiny muted">Conversion = how many visitors buy. Driven by price, trust, reviews and shipping cost.</div>
          </div>
        </div>
      </div>
    );
  }
}
