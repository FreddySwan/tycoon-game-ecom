import { useState } from 'react';
import { BATCH_UNLOCK_AFTER, FRIEND_HELP, SPACES, THIRD_PARTY, TILE_COST } from '../../sim/data';
import { def, fulfillmentCapacity, stationEfficiency, storageCapacity, storageUsed, supportCapacity } from '../../sim/economics';
import { AUTOMATION, buyAutomation, callFriend, dockIndex, placeTile, setSupport, setThirdParty } from '../../sim/engine';
import type { TileId } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle, Meter, Options, Toggle } from '../bits';
import { money } from '../format';

const TILE_ICON: Record<TileId, string> = { rack: '🗄️', station: '📦', conveyor: '➡️', robot: '🤖' };
const TILE_NAME: Record<TileId, string> = { rack: 'Storage rack (+2,000 units)', station: 'Packing station (1 packer per shift)', conveyor: 'Conveyor (+25% to adjacent stations)', robot: 'Robot picker (+110 orders/day)' };

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

  return (
    <div>
      <AppTitle app="Operations" title={SPACES[game.space].name} sub={SPACES[game.space].desc} />

      <div className="funnel">
        <div>
          <b>{Math.round(backlog).toLocaleString()}</b>orders waiting
          {oldest >= 2 && <div className="tiny bad-text">oldest: {oldest} days</div>}
        </div>
        <div>
          <b>{cap.thirdParty ? '∞' : Math.round(cap.total).toLocaleString()}</b>packing capacity/day
          <div className="tiny muted">{cap.thirdParty ? '3PL handles it' : [cap.founder && `you ${cap.founder}`, cap.team && `team ${cap.team}`, cap.robots && `robots ${cap.robots}`].filter(Boolean).join(' · ') || 'none yet'}</div>
        </div>
        <div className={used > storage ? 'leak' : ''}>
          <b>{Math.round(used).toLocaleString()}</b>of {storage === Infinity ? '∞' : storage.toLocaleString()} storage
          {used > storage && <div className="tiny bad-text">Overflow costs money</div>}
        </div>
        <div>
          <b>{game.shipped.toLocaleString()}</b>shipped all-time
        </div>
      </div>
      <p className="tiny muted">Orders that wait more than a week get cancelled, refunded and reviewed angrily.</p>

      {handEra ? (
        <div className="callout" style={{ marginTop: 10 }}>
          <b>Pack by hand.</b> The first {BATCH_UNLOCK_AFTER} orders are packed one at a time ({game.handPacked}/{BATCH_UNLOCK_AFTER}). Then batch packing uses your leftover founder hours every evening.
          <div className="row" style={{ marginTop: 8 }}>
            <button className="primary" disabled={!backlog} onClick={() => setModal({ kind: 'pack' })}>
              📦 Pack the next order
            </button>
          </div>
        </div>
      ) : (
        game.stage <= 2 && <p className="tiny">Batch packing: leftover founder hours pack up to {cap.founder} orders tonight.</p>
      )}

      <div className="row" style={{ marginTop: 10 }}>
        {game.stage <= 2 && (
          <button className="small" onClick={() => act(callFriend)} disabled={game.extraHours > 0}>
            📞 Call a friend (+{FRIEND_HELP.hours}h today, {money(FRIEND_HELP.cost)})
          </button>
        )}
        {game.stage >= 2 && <Toggle on={game.thirdParty} onChange={(v) => act(setThirdParty, v)} label={<>Use a 3PL <span className="tiny muted">({money(THIRD_PARTY.perOrder, true)}/order + {money(THIRD_PARTY.storagePerUnitMonth, true)}/unit/month storage, no limits)</span></>} />}
      </div>

      {game.backlog.length > 0 && (
        <>
          <h3>Waiting to ship</h3>
          <table className="data">
            <tbody>
              {game.backlog.slice(0, 8).map((b, i) => (
                <tr key={i}>
                  <td>
                    {def(game, b.productId).emoji} {b.customer ? `${b.customer} · ${b.city}` : def(game, b.productId).name}
                  </td>
                  <td className="num">{Math.round(b.orders)} order{Math.round(b.orders) === 1 ? '' : 's'}</td>
                  <td className={game.day - b.day >= 3 ? 'bad-text' : 'muted'}>day {b.day}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {game.layout.w > 0 && <Layout />}

      {game.stage >= 3 && (
        <>
          <h3>Automation</h3>
          <div className="row">
            {(Object.keys(AUTOMATION) as (keyof typeof AUTOMATION)[]).map((k) => (
              <button key={k} disabled={game.automation[k] || game.stage < AUTOMATION[k].stage} onClick={() => act(buyAutomation, k)}>
                {game.automation[k] ? '✅ ' : ''}
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
  return (
    <>
      <h3>🏗️ Warehouse layout</h3>
      <p className="tiny muted">
        Stations work best next to racks, close to the loading dock 🚛, and beside a conveyor. Removing a tile refunds half its cost. {cap.usedStations}/{cap.stations} stations staffed.
      </p>
      <Options
        value={tool}
        options={tools.map((t) => ({ v: t, label: t === 'erase' ? '🧽 Remove' : `${TILE_ICON[t]} ${money(TILE_COST[t])}` }))}
        onChange={setTool}
      />
      <p className="tiny">{tool === 'erase' ? 'Click a tile to remove it.' : TILE_NAME[tool]}</p>
      <div className="layout" style={{ gridTemplateColumns: `repeat(${w}, 1fr)` }}>
        {cells.map((c, i) => {
          const x = i % w;
          const y = Math.floor(i / w);
          const eff = c === 'station' ? stationEfficiency(x, y, w, racks, conveyors, [Math.floor(w / 2), h - 1]) : 0;
          return (
            <button
              key={i}
              className={`tile ${c ?? ''} ${i === dock ? 'dock' : ''}`}
              title={c === 'station' ? `Efficiency ${Math.round(eff * 100)}%` : c ?? ''}
              onClick={() => i !== dock && act(placeTile, x, y, tool === 'erase' ? null : tool)}
              style={c === 'station' ? { background: `hsl(${Math.round((eff - 0.6) * 200)}, 60%, 85%)` } : undefined}
            >
              {i === dock ? '🚛' : c ? TILE_ICON[c] : ''}
              {c === 'station' && <small>{Math.round(eff * 100)}</small>}
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
      <h3>🎧 Customer support policy</h3>
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
