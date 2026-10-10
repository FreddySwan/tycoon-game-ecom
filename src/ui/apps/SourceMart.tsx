import { useState } from 'react';
import { AIR_DAYS, INSPECTION_COST, SAMPLE_COST, SEA_DAYS, STARTING_CASH, SUPPLIERS, SUPPLIER_ORDER, WIN_REORDER_QTY } from '../../sim/data';
import { activeContract, avgDailyOrders, def, freightPerUnit, listPrice, stockDays, unitsPerOrder } from '../../sim/economics';
import {
  acceptCounter,
  canSignContract,
  cancelNegotiation,
  contractTerms,
  coverDays,
  hasPaymentTerms,
  leadTime,
  orderCost,
  orderSample,
  placeOrder,
  proposePrice,
  quantityOptions,
  sampleNote,
  setReorderRule,
  signContract,
  startNegotiation,
} from '../../sim/engine';
import type { Freight, SupplierId } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle, Meter, Options, Pips, Toggle } from '../bits';
import { money } from '../format';
import { ProductPicker, useProduct } from '../ProductPicker';

export function SourceMart() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const pid = useProduct();
  const neg = game.negotiation;
  const suppliers = SUPPLIER_ORDER.filter((id) => SUPPLIERS[id].unlockStage <= game.stage);

  return (
    <div>
      <AppTitle app="SourceMart" title="Suppliers" sub={`Factories that can make your products. Samples cost ${money(SAMPLE_COST)} and take 3 days.`} />
      <ProductPicker />
      {pid && (
        <>
          <div className="cards">
            {suppliers.map((id) => {
              const sup = SUPPLIERS[id];
              const sample = game.samples.find((x) => x.supplierId === id && x.productId === pid);
              const contract = activeContract(game, id);
              return (
                <div key={id} className={`card ${neg?.supplierId === id && neg.productId === pid ? 'selected' : ''}`}>
                  <div className="row between">
                    <span className="big-emoji">{sup.avatar}</span>
                    <span className="tiny muted">{sup.city}</span>
                  </div>
                  <h4>{sup.company}</h4>
                  <p>
                    <b>{sup.contact}</b>: {sup.blurb}
                  </p>
                  <div className="bars">
                    <span>Price</span>
                    <b>{money(listPrice(game, pid, id, sup.moq), true)}/unit</b>
                    <span>Min. order</span>
                    <b>{sup.moq.toLocaleString()}</b>
                    <span>Claimed quality</span>
                    <Pips n={sup.qualityStars} />
                    <span>Reliability</span>
                    <Pips n={sup.reliabilityStars} />
                    <span>Production</span>
                    <b>{sup.productionDays} days</b>
                    <span>Relationship</span>
                    <Meter value={game.relationship[id]} max={100} />
                  </div>
                  {contract && <span className="pill good">🤝 Contract: −{Math.round(contract.discount * 100)}%, {contract.orderedUnits.toLocaleString()}/{contract.commitUnits.toLocaleString()} units</span>}
                  {hasPaymentTerms(game, id) && !contract && <span className="pill good">30/70 payment terms</span>}
                  {game.stage <= 2 && !sample && (
                    <button onClick={() => act(orderSample, pid, id)} disabled={game.cash < SAMPLE_COST}>
                      Order sample ({money(SAMPLE_COST)})
                    </button>
                  )}
                  {sample && !sample.arrived && <span className="pill">Sample arrives day {sample.arrivesDay}</span>}
                  {sample?.arrived && !sample.inspected && (
                    <button className="primary" onClick={() => setModal({ kind: 'unbox', productId: pid, supplierId: id })}>
                      📦 Unbox sample
                    </button>
                  )}
                  {sample?.inspected && <p className="tiny">📝 Your notes: {sampleNote(game, pid, id)}</p>}
                  {(!neg || neg.supplierId !== id || neg.productId !== pid) && (
                    <button className={sample?.inspected ? 'primary' : ''} onClick={() => act(startNegotiation, pid, id, quantityOptions(id)[0])}>
                      Negotiate an order
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {neg && neg.productId === pid && <Negotiation key={neg.supplierId + neg.productId} />}
          {game.stage >= 2 && <ReorderRule pid={pid} />}
        </>
      )}

      {game.stage >= 4 && <Contracts />}

      {game.pos.some((p) => p.status !== 'arrived') && <POTable />}
    </div>
  );
}

function POTable() {
  const game = useGame((s) => s.game);
  const open = game.pos.filter((p) => p.status !== 'arrived');
  return (
    <>
      <h3>Purchase orders on the way</h3>
      <table className="data">
        <thead>
          <tr>
            <th>Product</th>
            <th>Supplier</th>
            <th className="num">Units</th>
            <th className="num">Cost</th>
            <th>Status</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          {[...open].reverse().map((po) => {
            const total = po.arrivesDay - po.placedDay;
            const done = Math.min(1, (game.day - po.placedDay) / Math.max(1, total));
            return (
              <tr key={po.id}>
                <td>
                  {def(game, po.productId).emoji} {def(game, po.productId).name}
                  {po.auto && <span className="tiny muted"> · auto</span>}
                </td>
                <td>
                  {SUPPLIERS[po.supplierId].company} <span className="tiny muted">({po.freight})</span>
                </td>
                <td className="num">{po.qty.toLocaleString()}</td>
                <td className="num">
                  {money(po.totalCost)}
                  {po.balanceDue > 0 && <div className="tiny muted">{money(po.balanceDue)} due at shipping</div>}
                </td>
                <td>
                  {po.status === 'transit' ? (
                    <span className={`pill ${po.delayDays ? 'warn' : ''}`}>
                      {po.freight === 'air' ? '✈️' : '🚢'} day {po.arrivesDay}
                    </span>
                  ) : (
                    <span className="pill">🏭 day {po.arrivesDay}</span>
                  )}
                </td>
                <td style={{ width: 100 }}>
                  <Meter value={done} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function Negotiation() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const n = game.negotiation!;
  const sup = SUPPLIERS[n.supplierId as SupplierId];
  const list = listPrice(game, n.productId, n.supplierId, n.qty);
  const [offer, setOffer] = useState(Math.round(list * 0.9 * 100) / 100);
  const [freight, setFreight] = useState<Freight>(game.stage >= 2 ? 'sea' : 'air');
  const [inspection, setInspection] = useState(false);
  const cost = orderCost(game, freight, inspection);
  const terms = hasPaymentTerms(game, n.supplierId);
  const upfront = terms ? cost * 0.3 + (inspection ? INSPECTION_COST * 0.7 : 0) : cost;
  const sd = stockDays(game, n.productId);
  const isReorder = game.pos.some((p) => p.productId === n.productId);
  const accrued = Object.values(game.channelAccrued).reduce((a, v) => a + (v ?? 0), 0);
  const winsAfter = game.cash + accrued - upfront;
  const eta = leadTime(n.supplierId, freight, game);

  return (
    <div className="chat" style={{ marginTop: 16 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>
          {sup.avatar} {sup.contact} · {def(game, n.productId).name}
        </h3>
        <button className="small ghost" onClick={() => act(cancelNegotiation)}>
          Close
        </button>
      </div>
      <p className="tiny muted">Quantity</p>
      <Options value={n.qty} options={quantityOptions(n.supplierId).map((q) => ({ v: q, label: `${q.toLocaleString()} units` }))} onChange={(q) => act(startNegotiation, n.productId, n.supplierId, q)} />
      <p>
        <span className="bubble">{n.lastMessage}</span>
      </p>
      {n.agreedPrice === null ? (
        <>
          <div className="row between">
            <span>
              Your offer: <b>{money(offer, true)}</b>/unit <span className="muted tiny">(list {money(list, true)})</span>
            </span>
            <span className="tiny muted">Lowballing hurts the relationship</span>
          </div>
          <input type="range" min={Math.round(list * 70)} max={Math.round(list * 100)} value={Math.round(offer * 100)} onChange={(e) => setOffer(+e.target.value / 100)} />
          <div className="row">
            <button className="primary" onClick={() => act(proposePrice, offer)} disabled={n.final}>
              Send offer
            </button>
            {n.counter !== null && <button onClick={() => act(acceptCounter)}>Accept {money(n.counter, true)}</button>}
          </div>
        </>
      ) : (
        <>
          <p className="tiny muted">Shipping</p>
          <Options
            value={freight}
            options={[
              { v: 'air', label: `✈️ Air: +${money(freightPerUnit(game, n.productId, 'air'), true)}/unit, ${AIR_DAYS} days` },
              { v: 'sea', label: `🚢 Sea: +${money(freightPerUnit(game, n.productId, 'sea'), true)}/unit, ${SEA_DAYS} days` },
            ]}
            onChange={setFreight}
          />
          <div style={{ margin: '10px 0' }}>
            <Toggle on={inspection} onChange={setInspection} label={`Pre-shipment quality inspection (+${money(INSPECTION_COST)})`} />
          </div>
          <div className="receipt">
            <div className="line">
              <span>
                {n.qty.toLocaleString()} × {money(n.agreedPrice, true)}
              </span>
              <span>{money(n.qty * n.agreedPrice, true)}</span>
            </div>
            <div className="line">
              <span>Freight ({freight})</span>
              <span>{money(n.qty * freightPerUnit(game, n.productId, freight), true)}</span>
            </div>
            {inspection && (
              <div className="line">
                <span>Inspection</span>
                <span>{money(INSPECTION_COST, true)}</span>
              </div>
            )}
            <div className="line total">
              <span>Total · arrives in ~{eta} days</span>
              <span>{money(cost, true)}</span>
            </div>
            {terms && (
              <div className="line tiny">
                <span>Payment terms: 30% now, 70% when it ships</span>
                <span>{money(upfront)} today</span>
              </div>
            )}
          </div>
          {sd !== null && (
            <p className={`callout ${sd < eta ? 'warn' : ''}`} style={{ marginTop: 10 }}>
              Current stock lasts about <b>{Math.floor(sd)} days</b>. This order arrives in <b>{eta} days</b>.{sd < eta && ' You may run out before it lands.'}
            </p>
          )}
          {isReorder && !game.milestones.first_profitable_reorder && (
            <p className={`callout ${winsAfter >= STARTING_CASH && n.qty >= WIN_REORDER_QTY ? 'good' : ''}`}>
              After paying: cash + payouts = <b>{money(winsAfter)}</b>.{' '}
              {winsAfter >= STARTING_CASH && n.qty >= WIN_REORDER_QTY ? '🎉 This counts as your first profitable reorder!' : `You need ${money(STARTING_CASH)}+ and ${WIN_REORDER_QTY}+ units for a profitable reorder.`}
            </p>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" disabled={game.cash < upfront} onClick={() => act(placeOrder, freight, inspection)}>
              Place order ({money(upfront)})
            </button>
            {game.cash < upfront && <span className="bad-text tiny">Not enough cash</span>}
          </div>
        </>
      )}
    </div>
  );
}

function ReorderRule({ pid }: { pid: string }) {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const r = game.products[pid].reorder;
  const buyer = game.team.buyer.count > 0;
  const cover = coverDays(game, pid);
  const daily = avgDailyOrders(game, pid, 7) * unitsPerOrder(game, pid);
  const suppliers = SUPPLIER_ORDER.filter((id) => SUPPLIERS[id].unlockStage <= game.stage);
  return (
    <div className="chat" style={{ marginTop: 16 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>🔁 Replenishment for {def(game, pid).name}</h3>
        <span className={`pill ${buyer ? 'good' : ''}`}>{buyer ? '🤖 Buyer places orders automatically' : 'Alerts only (hire a buyer to automate)'}</span>
      </div>
      <p className="tiny muted">
        Selling ~{daily.toFixed(1)} units/day. Stock + incoming covers {cover === null ? '—' : `${Math.floor(cover)} days`}. When cover drops below lead time + half your target, you get an alert{buyer ? ' and your buyer reorders' : ''}.
      </p>
      <div className="row" style={{ gap: 14 }}>
        <Toggle on={r.enabled} onChange={(v) => act(setReorderRule, pid, { enabled: v, supplierId: r.supplierId ?? 'brightway' })} label="Rule on" />
        <label className="row tiny" style={{ gap: 6 }}>
          Supplier
          <select value={r.supplierId ?? 'brightway'} onChange={(e) => act(setReorderRule, pid, { supplierId: e.target.value as SupplierId })}>
            {suppliers.map((id) => (
              <option key={id} value={id}>
                {SUPPLIERS[id].company}
              </option>
            ))}
          </select>
        </label>
        <label className="row tiny" style={{ gap: 6 }}>
          Qty
          <input type="number" style={{ width: 90 }} value={r.qty} step={100} min={100} onChange={(e) => act(setReorderRule, pid, { qty: Math.max(100, +e.target.value) })} />
        </label>
        <Options value={r.freight} options={[{ v: 'sea', label: '🚢 Sea' }, { v: 'air', label: '✈️ Air' }]} onChange={(v) => act(setReorderRule, pid, { freight: v })} />
        <label className="row tiny" style={{ gap: 6 }}>
          Target cover
          <input type="number" style={{ width: 60 }} value={r.coverDays} min={7} max={120} onChange={(e) => act(setReorderRule, pid, { coverDays: +e.target.value })} /> days
        </label>
      </div>
    </div>
  );
}

function Contracts() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  return (
    <>
      <h3>🤝 Manufacturing agreements</h3>
      <p className="tiny muted">Commit to a year of volume for lower prices, 30/70 payment terms and 2 days faster production. Falling short costs $0.40 per missing unit.</p>
      <table className="data">
        <tbody>
          {SUPPLIER_ORDER.filter((id) => SUPPLIERS[id].unlockStage <= game.stage).map((id) => {
            const c = activeContract(game, id);
            const t = contractTerms(game, id);
            const blocked = canSignContract(game, id);
            return (
              <tr key={id}>
                <td>
                  {SUPPLIERS[id].avatar} {SUPPLIERS[id].company}
                </td>
                <td className="tiny">
                  {c
                    ? `Active until day ${c.endDay}: ${c.orderedUnits.toLocaleString()} of ${c.commitUnits.toLocaleString()} units ordered`
                    : `Offer: ${Math.round(t.discount * 100)}% off for ${t.commitUnits.toLocaleString()} units/year · ${game.supplierUnits[id].toLocaleString()} ordered so far · relationship ${game.relationship[id]}`}
                </td>
                <td>
                  {!c && (
                    <button className="small" disabled={!!blocked} title={blocked ?? ''} onClick={() => act(signContract, id)}>
                      Sign
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
