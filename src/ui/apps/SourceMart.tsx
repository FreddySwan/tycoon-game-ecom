import { useState } from 'react';
import { INSPECTION_COST, SAMPLE_COST, SUPPLIERS, SUPPLIER_ORDER, AIR_DAYS, SEA_DAYS, STARTING_CASH, WIN_REORDER_QTY } from '../../sim/data';
import { freightPerUnit, listPrice, product, stockDays } from '../../sim/economics';
import {
  acceptCounter,
  cancelNegotiation,
  orderCost,
  orderSample,
  placeOrder,
  proposePrice,
  quantityOptions,
  startNegotiation,
} from '../../sim/engine';
import type { Freight, SupplierId } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle, Meter, Options, Pips, Toggle } from '../bits';
import { money } from '../format';

export function SourceMart() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const p = product(game);
  const neg = game.negotiation;

  return (
    <div>
      <AppTitle app="SourceMart" title="Suppliers" sub={`Factories that can make your ${p.name.toLowerCase()}. Samples cost ${money(SAMPLE_COST)} and take 3 days.`} />
      <div className="cards">
        {SUPPLIER_ORDER.map((id) => {
          const sup = SUPPLIERS[id];
          const sample = game.samples.find((x) => x.supplierId === id);
          return (
            <div key={id} className={`card ${neg?.supplierId === id ? 'selected' : ''}`}>
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
                <b>{money(listPrice(game, id, sup.moq), true)}/unit</b>
                <span>Min. order</span>
                <b>{sup.moq} units</b>
                <span>Claimed quality</span>
                <Pips n={sup.qualityStars} />
                <span>Reliability</span>
                <Pips n={sup.reliabilityStars} />
                <span>Production</span>
                <b>{sup.productionDays} days</b>
                <span>Relationship</span>
                <Meter value={game.relationship[id]} max={100} />
              </div>
              {!sample && (
                <button onClick={() => act(orderSample, id)} disabled={game.cash < SAMPLE_COST}>
                  Order sample ({money(SAMPLE_COST)})
                </button>
              )}
              {sample && !sample.arrived && <span className="pill">Sample arrives day {sample.arrivesDay}</span>}
              {sample?.arrived && !sample.inspected && (
                <button className="primary" onClick={() => setModal({ kind: 'unbox', supplierId: id })}>
                  📦 Unbox sample
                </button>
              )}
              {sample?.inspected && <p className="tiny">📝 Your notes: {p.sampleNotes[id]}</p>}
              {(!neg || neg.supplierId !== id) && (
                <button className={sample?.inspected ? 'primary' : ''} onClick={() => act(startNegotiation, id, quantityOptions(id)[0])}>
                  Negotiate an order
                </button>
              )}
            </div>
          );
        })}
      </div>

      {neg && <Negotiation key={neg.supplierId} />}

      {game.pos.length > 0 && (
        <>
          <h3>Purchase orders</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Supplier</th>
                <th className="num">Units</th>
                <th className="num">Cost</th>
                <th>Status</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {[...game.pos].reverse().map((po) => {
                const total = po.arrivesDay - po.placedDay;
                const done = Math.min(1, (game.day - po.placedDay) / total);
                return (
                  <tr key={po.id}>
                    <td>
                      {SUPPLIERS[po.supplierId].company} <span className="tiny muted">({po.freight})</span>
                    </td>
                    <td className="num">{po.qty}</td>
                    <td className="num">{money(po.totalCost)}</td>
                    <td>
                      {po.status === 'arrived' ? (
                        <span className="pill good">Delivered</span>
                      ) : po.status === 'transit' ? (
                        <span className={`pill ${po.delayDays ? 'warn' : ''}`}>
                          {po.freight === 'air' ? '✈️' : '🚢'} In transit · day {po.arrivesDay}
                        </span>
                      ) : (
                        <span className="pill">🏭 In production · day {po.arrivesDay}</span>
                      )}
                    </td>
                    <td style={{ width: 120 }}>
                      <Meter value={done} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );

}

function Negotiation() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const n = game.negotiation!;
  const sup = SUPPLIERS[n.supplierId as SupplierId];
  const list = listPrice(game, n.supplierId, n.qty);
  const [offer, setOffer] = useState(Math.round(list * 0.9 * 100) / 100);
  const [freight, setFreight] = useState<Freight>('air');
  const [inspection, setInspection] = useState(false);
  const cost = orderCost(game, freight, inspection);
  const sd = stockDays(game);
  const isReorder = game.pos.length > 0;
  const winsAfter = game.cash + game.payoutAccrued - cost;
  const eta = game.day + sup.productionDays + (freight === 'air' ? AIR_DAYS : SEA_DAYS);

  return (
    <div className="chat" style={{ marginTop: 16 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>
          {sup.avatar} Negotiating with {sup.contact}
        </h3>
        <button className="small ghost" onClick={() => act(cancelNegotiation)}>
          Close
        </button>
      </div>
      <p className="tiny muted">Quantity</p>
      <Options
        value={n.qty}
        options={quantityOptions(n.supplierId).map((q) => ({ v: q, label: `${q} units` }))}
        onChange={(q) => act(startNegotiation, n.supplierId, q)}
      />
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
              { v: 'air', label: `✈️ Air: +${money(freightPerUnit(game, 'air'), true)}/unit, ${AIR_DAYS} days` },
              { v: 'sea', label: `🚢 Sea: +${money(freightPerUnit(game, 'sea'), true)}/unit, ${SEA_DAYS} days` },
            ]}
            onChange={setFreight}
          />
          <div style={{ margin: '10px 0' }}>
            <Toggle on={inspection} onChange={setInspection} label={`Pre-shipment quality inspection (+${money(INSPECTION_COST)})`} />
          </div>
          <div className="receipt">
            <div className="line">
              <span>
                {n.qty} × {money(n.agreedPrice, true)}
              </span>
              <span>{money(n.qty * n.agreedPrice, true)}</span>
            </div>
            <div className="line">
              <span>Freight ({freight})</span>
              <span>{money(n.qty * freightPerUnit(game, freight), true)}</span>
            </div>
            {inspection && (
              <div className="line">
                <span>Inspection</span>
                <span>{money(INSPECTION_COST, true)}</span>
              </div>
            )}
            <div className="line total">
              <span>Total · arrives ~day {eta}</span>
              <span>{money(cost, true)}</span>
            </div>
          </div>
          {sd !== null && (
            <p className={`callout ${sd < eta - game.day ? 'warn' : ''}`} style={{ marginTop: 10 }}>
              Current stock lasts about <b>{Math.floor(sd)} days</b>. This order arrives in <b>{eta - game.day} days</b>.
              {sd < eta - game.day && ' You may run out before it lands.'}
            </p>
          )}
          {isReorder && !game.won && (
            <p className={`callout ${winsAfter >= STARTING_CASH && n.qty >= WIN_REORDER_QTY ? 'good' : ''}`}>
              After paying: cash + payouts = <b>{money(winsAfter)}</b>.{' '}
              {winsAfter >= STARTING_CASH && n.qty >= WIN_REORDER_QTY
                ? '🎉 This counts as your first profitable reorder!'
                : `You need ${money(STARTING_CASH)}+ and ${WIN_REORDER_QTY}+ units for a profitable reorder.`}
            </p>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" disabled={game.cash < cost} onClick={() => act(placeOrder, freight, inspection)}>
              Place order ({money(cost)})
            </button>
            {game.cash < cost && <span className="bad-text tiny">Not enough cash</span>}
          </div>
        </>
      )}
    </div>
  );
}
