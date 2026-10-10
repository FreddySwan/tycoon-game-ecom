import { CUSTOMER_SHIPPING_CHARGE } from '../../sim/data';
import { breakEvenCPA, bundlePrice, orderBreakdown, perception, product, returnRate, siteCVR } from '../../sim/economics';
import { setOffer } from '../../sim/engine';
import { useGame } from '../../state/store';
import { AppTitle, Options, Toggle } from '../bits';
import { money, pct } from '../format';

export function OfferApp() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const o = game.offer;
  const p = product(game);
  const single = orderBreakdown(game, false);
  const per = perception(game);
  const be = breakEvenCPA(game);
  const cvr = siteCVR(game, null);

  return (
    <div>
      <AppTitle app="Offer" title="Price & offer" sub="Every dollar of price changes who buys, how many buy, and what you keep." />
      <div className="builder">
        <div>
          <div className="row between">
            <b>Price</b>
            <b style={{ fontSize: 22 }}>{money(o.price)}</b>
          </div>
          <input type="range" min={Math.round(p.refPrice * 0.5)} max={Math.round(p.refPrice * 2)} value={o.price} onChange={(e) => act(setOffer, { price: +e.target.value })} />
          <div className="row between tiny muted">
            <span>Bargain</span>
            <span className="pill">{per.label}</span>
            <span>Luxury</span>
          </div>

          <h3>Extras</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <Toggle on={o.bundle} onChange={(v) => act(setOffer, { bundle: v })} label={<>2-pack bundle at <b>{money(bundlePrice(game), true)}</b> <span className="tiny muted">(~30% of buyers pick it)</span></>} />
            <Toggle on={o.freeShipping} onChange={(v) => act(setOffer, { freeShipping: v })} label={<>Free shipping <span className="tiny muted">(off = charge {money(CUSTOMER_SHIPPING_CHARGE, true)}, which scares buyers more than a higher price)</span></>} />
            <Toggle on={o.thankYouCard} onChange={(v) => act(setOffer, { thankYouCard: v })} label={<>Handwritten thank-you card <span className="tiny muted">(+$0.10, more and better reviews)</span></>} />
          </div>
          <h3>Discount code</h3>
          <Options value={o.discountPct} options={[0, 10, 20].map((v) => ({ v, label: v ? `${v}% off` : 'None' }))} onChange={(v) => act(setOffer, { discountPct: v })} />
          {game.discountFatigue > 0.05 && <p className="tiny bad-text">Discount fatigue {Math.round(game.discountFatigue * 100)}%: shoppers are learning to wait for sales.</p>}
          <h3>Packaging</h3>
          <Options
            value={o.packaging}
            options={[
              { v: 'basic', label: 'Basic mailer $0.60' },
              { v: 'sturdy', label: 'Sturdy box $0.95' },
            ]}
            onChange={(v) => act(setOffer, { packaging: v })}
          />
          <p className="tiny muted">Basic mailers get crushed about 6% of the time. Sturdy boxes: 1.5%.</p>
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
              <span>Shipping to customer</span>
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
            <div className="tiny">
              {o.bundle ? 'Blended with bundles. ' : ''}If ads cost more than this to win one order, you lose money on it.
            </div>
          </div>
          <div className="callout" style={{ marginTop: 10 }}>
            <div className="row between">
              <span>Store conversion</span>
              <b>{pct(cvr)}</b>
            </div>
            <div className="row between">
              <span>Expected returns</span>
              <b>{pct(returnRate(game))}</b>
            </div>
            <div className="tiny muted">Conversion = how many visitors buy. Driven by price, trust, reviews and shipping cost.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
