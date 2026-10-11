import { useState } from 'react';
import { BATCH_UNLOCK_AFTER, CHANNELS, FRIEND_HELP, PACKAGING_COST, PACKER_RATE, RACK_STORAGE, ROLES, SPACES, THIRD_PARTY, TILE_COST } from '../../sim/data';
import { channelTrailing, def, fulfillmentCapacity, liveProducts, orderPace, payrollMonthly, productTrailing, stationEfficiency, storageCapacity, storageUsed, supportCapacity } from '../../sim/economics';
import { AUTOMATION, buyAutomation, callFriend, dockIndex, packersNeeded, placeTile, setAutopilot, setSupport, setThirdParty } from '../../sim/engine';
import type { ChannelId, TileId } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle, Meter, Options, Toggle } from '../bits';
import { money, pct } from '../format';
import { ProductImage } from '../photos';
import { Icon, withIcons } from '../icons';

const TILE: Record<TileId, { icon: string; label: string; color: string; what: string }> = {
  rack: { icon: '🗄️', label: 'RACK', color: '#f5d2b3', what: `Storage rack: holds ${RACK_STORAGE.toLocaleString()} units.` },
  station: { icon: '📦', label: 'PACK', color: '#d9f0e1', what: `Packing station: 1 packer per shift, ~${PACKER_RATE} orders/day at 100%.` },
  conveyor: { icon: '➡️', label: 'BELT', color: '#c9ccd3', what: 'Conveyor: +25% speed for every station touching it.' },
  robot: { icon: '🤖', label: 'ROBOT', color: '#c5ecd9', what: 'Robot picker: ships ~110 orders/day with no staff.' },
};

export function Ops() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const cap = fulfillmentCapacity(game);
  const backlog = game.backlog.reduce((a, b) => a + b.orders, 0);
  const oldest = game.backlog.length ? game.day - Math.min(...game.backlog.map((b) => b.day)) : 0;
  const used = storageUsed(game);
  const storage = storageCapacity(game);
  const handEra = game.stage === 1 && !game.batchPacking;
  const p7 = orderPace(game, 7);
  const p30 = orderPace(game, 30);
  const capNum = cap.thirdParty ? Infinity : cap.total;
  const util = capNum === Infinity ? 0 : p7.own / Math.max(1, capNum);
  const need = packersNeeded(game);
  const stations = cap.stations;
  const own30 = p30.own * 30;
  const inHouse = own30 > 0 ? (game.team.packer.count * ROLES.packer.wage * 1.15 * game.team.packer.wageMult) / own30 : 0;
  const lead = game.people.find((p) => p.role === 'lead');

  return (
    <div>
      <AppTitle app="Operations" title={SPACES[game.space].name} sub={SPACES[game.space].desc} />

      <div className="kpis">
        <Kpi k="Orders / day" v={p7.total.toFixed(1)} s={`7-day avg · 30-day ${p30.total.toFixed(1)}`} />
        <Kpi k="You ship / day" v={p7.own.toFixed(1)} s={p7.total - p7.own > 0.5 ? `${(p7.total - p7.own).toFixed(1)} shipped by marketplaces` : 'all orders'} />
        <Kpi k="Packing capacity" v={cap.thirdParty ? '∞ (3PL)' : Math.round(cap.total).toLocaleString()} s={cap.thirdParty ? 'outsourced' : [cap.founder && `you ${cap.founder}`, cap.team && `team ${cap.team}`, cap.robots && `robots ${cap.robots}`].filter(Boolean).join(' · ') || 'none'} />
        <Kpi k="Utilization" v={cap.thirdParty ? '—' : pct(util, 0)} s={util > 1 ? 'over capacity!' : util > 0.85 ? 'running hot' : 'healthy'} warn={util > 1} />
        <Kpi k="Waiting to ship" v={Math.round(backlog).toLocaleString()} s={oldest >= 2 ? `oldest ${oldest} days` : 'all fresh'} warn={oldest >= 3} />
        <Kpi k="Storage" v={storage === Infinity ? '3PL' : pct(used / storage, 0)} s={`${Math.round(used).toLocaleString()} of ${storage === Infinity ? '∞' : storage.toLocaleString()}`} warn={used > storage} />
      </div>

      {game.stage >= 2 && !game.thirdParty && (
        <p className={`callout ${need > game.team.packer.count ? 'warn' : 'good'}`}>
          To ship ~{Math.round(p7.own * 1.25)} orders/day (recent pace + 25% buffer) you need about <b>{need} packer{need === 1 ? '' : 's'}</b>
          {game.space !== 'garage' && stations > 0 && <> on <b>{Math.ceil(need / game.shifts)} station{need > 1 ? 's' : ''}</b></>}. You have {game.team.packer.count} packer{game.team.packer.count === 1 ? '' : 's'}
          {game.space !== 'garage' ? ` and ${stations} station${stations === 1 ? '' : 's'} (${game.shifts} shift${game.shifts > 1 ? 's' : ''})` : ' (3 stations in the garage)'}.
        </p>
      )}
      <p className="tiny muted">Orders that wait more than a week get cancelled, refunded and reviewed angrily.</p>

      {handEra ? (
        <div className="callout" style={{ marginTop: 10 }}>
          <b>Pack by hand.</b> The first {BATCH_UNLOCK_AFTER} orders are packed one at a time ({game.handPacked}/{BATCH_UNLOCK_AFTER}). Then batch packing uses your leftover founder hours every evening.
          <div className="row" style={{ marginTop: 8 }}>
            <button className="primary" disabled={!backlog} onClick={() => setModal({ kind: 'pack' })}>
              <Icon name="archive" /> Pack the next order
            </button>
          </div>
        </div>
      ) : (
        game.stage <= 2 && <p className="tiny">Batch packing: your leftover founder hours pack up to {cap.founder} orders tonight.</p>
      )}

      <div className="row" style={{ marginTop: 6 }}>
        {game.stage <= 2 && (
          <button className="small" onClick={() => act(callFriend)} disabled={game.extraHours > 0}>
            <Icon name="deskphone" /> Call a friend (+{FRIEND_HELP.hours}h today, {money(FRIEND_HELP.cost)})
          </button>
        )}
      </div>

      {game.stage >= 2 && (
        <div className="chat" style={{ marginTop: 12 }}>
          <div className="row between">
            <b><Icon name="truck" /> Fulfillment: in-house vs 3PL</b>
            <Toggle on={game.thirdParty} onChange={(v) => act(setThirdParty, v)} label="Use a 3PL" />
          </div>
          <table className="data" style={{ marginTop: 6 }}>
            <tbody>
              <tr>
                <td>In-house, per order</td>
                <td className="num">{inHouse ? money(inHouse + PACKAGING_COST[game.brands[0].packaging], true) : '—'}</td>
                <td className="tiny muted">packer wages ÷ orders shipped + packaging, plus rent and your stations</td>
              </tr>
              <tr>
                <td>3PL, per order</td>
                <td className="num">{money(THIRD_PARTY.perOrder + PACKAGING_COST[game.brands[0].packaging], true)}</td>
                <td className="tiny muted">
                  {money(THIRD_PARTY.perOrder, true)} handling + packaging + {money(THIRD_PARTY.storagePerUnitMonth, true)}/unit/month storage (~{money(used * THIRD_PARTY.storagePerUnitMonth)}/month now). No capacity limits.
                </td>
              </tr>
            </tbody>
          </table>
          <p className="tiny muted">The Offer app shows what the 3PL fee does to each product’s margin; Finance shows 3PL fees per product.</p>
        </div>
      )}

      {game.stage >= 3 && (
        <div className="chat" style={{ marginTop: 12 }}>
          <b><Icon name="humanUp" /> Warehouse lead autopilot</b>
          <p className="tiny muted" style={{ margin: '4px 0 8px' }}>
            {lead ? `${lead.name} reviews the floor every 3 days.` : 'Promote or hire a warehouse lead (Team app) to automate the floor.'}
          </p>
          <div style={{ display: 'grid', gap: 6 }}>
            <Toggle on={game.autopilot.staffing} onChange={(v) => act(setAutopilot, { staffing: v })} label={<>Staffing: hire and let go of packers to match demand, start a 2nd shift when stations are full</>} />
            <Toggle on={game.autopilot.buildout} onChange={(v) => act(setAutopilot, { buildout: v })} label={<>Build-out: add packing stations near the dock and racks when storage passes 85% (spends cash)</>} />
          </div>
          {game.notices.filter((n) => n.text.startsWith('🦺')).slice(-3).reverse().map((n) => (
            <div key={n.id} className="tiny muted">
              Day {n.day}: {withIcons(n.text.replace('🦺 ', ''))}
            </div>
          ))}
        </div>
      )}

      <h3>Orders by product and channel</h3>
      {pacing()}

      {game.layout.w > 0 && <Layout />}

      {game.backlog.length > 0 && (
        <>
          <h3>Waiting to ship</h3>
          <table className="data">
            <tbody>
              {game.backlog.slice(0, 6).map((b, i) => (
                <tr key={i}>
                  <td>
                    {def(game, b.productId).name} {b.customer && <span className="muted">· {b.customer}, {b.city}</span>}
                  </td>
                  <td className="tiny muted">{CHANNELS[b.channel].name}</td>
                  <td className="num">{Math.round(b.orders)} order{Math.round(b.orders) === 1 ? '' : 's'}</td>
                  <td className={game.day - b.day >= 3 ? 'bad-text' : 'muted'}>day {b.day}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {game.stage >= 3 && (
        <>
          <h3>Automation</h3>
          <div className="row">
            {(Object.keys(AUTOMATION) as (keyof typeof AUTOMATION)[]).map((k) => (
              <button key={k} disabled={game.automation[k] || game.stage < AUTOMATION[k].stage} onClick={() => act(buyAutomation, k)}>
                {game.automation[k] ? <><Icon name="check" color="#1f9d55" /> </> : ''}
                {AUTOMATION[k].name}
                <small style={{ display: 'block', fontWeight: 600, opacity: 0.7 }}>
                  {money(AUTOMATION[k].cost)} · {AUTOMATION[k].desc}
                </small>
              </button>
            ))}
          </div>
        </>
      )}

      {game.stage >= 2 && <Support />}
      <p className="tiny muted" style={{ marginTop: 12 }}>
        Payroll {money(payrollMonthly(game))}/month. In-house cost per order assumes packers only; rent and stations come on top.
      </p>
    </div>
  );

  function pacing() {
    const p7 = productTrailing(game, 7);
    const p30 = productTrailing(game, 30);
    const c7 = channelTrailing(game, 7);
    const c30 = channelTrailing(game, 30);
    const d7 = Math.max(1, Math.min(7, game.history.length));
    const d30 = Math.max(1, Math.min(30, game.history.length));
    return (
      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <table className="data" style={{ flex: 2, minWidth: 280 }}>
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">7d / day</th>
              <th className="num">30d / day</th>
              <th className="num">Stock</th>
            </tr>
          </thead>
          <tbody>
            {liveProducts(game).map((id) => (
              <tr key={id}>
                <td>
                  <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    <ProductImage game={game} pid={id} size={24} round={5} /> {def(game, id).name}
                  </span>
                </td>
                <td className="num">{((p7[id]?.orders ?? 0) / d7).toFixed(1)}</td>
                <td className="num">{((p30[id]?.orders ?? 0) / d30).toFixed(1)}</td>
                <td className="num">{game.products[id].inventory.onHand.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="data" style={{ flex: 1, minWidth: 200 }}>
          <thead>
            <tr>
              <th>Channel</th>
              <th className="num">7d / day</th>
              <th className="num">30d / day</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(c30) as ChannelId[]).map((ch) => (
              <tr key={ch}>
                <td>
                  {withIcons(CHANNELS[ch].emoji)} {CHANNELS[ch].name}
                </td>
                <td className="num">{((c7[ch]?.orders ?? 0) / d7).toFixed(1)}</td>
                <td className="num">{((c30[ch]?.orders ?? 0) / d30).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

function Kpi({ k, v, s, warn }: { k: string; v: string; s?: string; warn?: boolean }) {
  return (
    <div className="kpi" style={warn ? { borderColor: '#f0b0b0', background: '#fff5f5' } : undefined}>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}

function Layout() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const [tool, setTool] = useState<TileId | 'erase'>('station');
  const { w, h, cells } = game.layout;
  const dock = dockIndex(game);
  const racks: [number, number][] = [];
  const conveyors = new Set<number>();
  cells.forEach((c, i) => {
    if (c === 'rack') racks.push([i % w, Math.floor(i / w)]);
    if (c === 'conveyor') conveyors.add(i);
  });
  const tools: (TileId | 'erase')[] = ['rack', 'station', 'conveyor', ...(game.stage >= 5 ? (['robot'] as TileId[]) : []), 'erase'];
  const cap = fulfillmentCapacity(game);
  const count = (t: TileId) => cells.filter((c) => c === t).length;
  return (
    <>
      <h3><Icon name="buildings" /> Warehouse layout</h3>
      <div className="legend">
        {(Object.keys(TILE) as TileId[])
          .filter((t) => t !== 'robot' || game.stage >= 5)
          .map((t) => (
            <div key={t}>
              <span className="sw" style={{ background: TILE[t].color }}>
                {withIcons(TILE[t].icon)}
              </span>
              <span>
                <b>
                  {TILE[t].label} · {money(TILE_COST[t])}
                </b>{' '}
                <span className="muted">({count(t)} placed)</span>
                <br />
                {TILE[t].what}
              </span>
            </div>
          ))}
        <div>
          <span className="sw" style={{ background: '#ffe9a8' }}>
            <Icon name="truck" />
          </span>
          <span>
            <b>DOCK</b>
            <br />
            Where orders leave. Stations near it work faster.
          </span>
        </div>
      </div>
      <p className="tiny muted">
        A station’s number is its speed: next to a rack and close to the dock is best, a conveyor beside it adds 25%. {cap.usedStations}/{cap.stations} stations staffed. Removing a tile refunds half its cost.
      </p>
      <Options value={tool} options={tools.map((t) => ({ v: t, label: t === 'erase' ? <><Icon name="close" /> Remove</> : <>{withIcons(TILE[t].icon)} Place {TILE[t].label.toLowerCase()}</> }))} onChange={setTool} />
      <div className="layout" style={{ gridTemplateColumns: `repeat(${w}, 1fr)`, marginTop: 8 }}>
        {cells.map((c, i) => {
          const x = i % w;
          const y = Math.floor(i / w);
          const eff = c === 'station' ? stationEfficiency(x, y, w, racks, conveyors, [Math.floor(w / 2), h - 1]) : 0;
          return (
            <button
              key={i}
              className={`tile ${c ?? ''} ${i === dock ? 'dock' : ''}`}
              title={c ? `${TILE[c].what}${c === 'station' ? ` Speed ${Math.round(eff * 100)}%.` : ''}` : i === dock ? 'Loading dock' : 'Empty floor'}
              onClick={() => i !== dock && act(placeTile, x, y, tool === 'erase' ? null : tool)}
              style={c === 'station' ? { background: `hsl(${Math.round((eff - 0.6) * 200)}, 60%, 85%)` } : c ? { background: TILE[c].color } : undefined}
            >
              {i === dock ? <Icon name="truck" /> : c ? withIcons(TILE[c].icon) : ''}
              {c && <span className="lbl">{c === 'station' ? `${Math.round(eff * 100)}%` : TILE[c].label}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

function Support() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const queue = game.tickets.queue.reduce((a, t) => a + t.count, 0);
  const capacity = supportCapacity(game);
  return (
    <>
      <h3><Icon name="headset" /> Customer support policy</h3>
      {game.team.support.count === 0 ? (
        <p className="tiny muted">You answer every message yourself (see Inbox). Hire a support agent in Team to hand this off.</p>
      ) : (
        <>
          <div className="row between">
            <span>
              Tickets waiting: <b>{queue}</b> · team handles ~{capacity}/day
            </span>
            <span className="tiny muted">
              {game.tickets.handled.toLocaleString()} handled · {game.tickets.dropped.toLocaleString()} dropped
            </span>
          </div>
          <Meter value={capacity ? Math.min(1, queue / capacity) : 1} />
          <p className="tiny muted" style={{ margin: '10px 0 4px' }}>
            Refund automatically when the order is worth less than:
          </p>
          <Options value={game.support.autoRefundUnder} options={[0, 20, 30, 50, 100].map((v) => ({ v, label: v ? `$${v}` : 'Never' }))} onChange={(v) => act(setSupport, { autoRefundUnder: v })} />
          <p className="tiny muted" style={{ margin: '10px 0 4px' }}>
            Reply style
          </p>
          <Options
            value={game.support.tone}
            options={[
              { v: 'template', label: 'Fast templates' },
              { v: 'personal', label: 'Personal replies (−30% speed, happier customers)' },
            ]}
            onChange={(v) => act(setSupport, { tone: v })}
          />
        </>
      )}
    </>
  );
}
