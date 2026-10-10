import { dateLabel } from '../../sim/calendar';
import { useState } from 'react';
import { CHANNELS } from '../../sim/data';
import { cashPools, channelTrailing, def, payrollMonthly, productTrailing, profitOf, runwayProjection, trailing } from '../../sim/economics';
import type { ChannelId } from '../../sim/types';
import { Options } from '../bits';
import { ProductImage } from '../photos';
import { SliceTable } from '../SliceTable';
import { drawCredit, repayCredit } from '../../sim/engine';
import type { PLCategory } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle } from '../bits';
import { money } from '../format';

const ROWS: { k: PLCategory; label: string }[] = [
  { k: 'revenue', label: 'Revenue' },
  { k: 'refunds', label: 'Refunds & returns' },
  { k: 'cogs', label: 'Product cost' },
  { k: 'fulfillment', label: 'Shipping & packing' },
  { k: 'fees', label: 'Payment & marketplace fees' },
  { k: 'ads', label: 'Advertising' },
  { k: 'payroll', label: 'Payroll' },
  { k: 'rent', label: 'Rent & storage' },
  { k: 'other', label: 'Other (samples, setup, overhead)' },
  { k: 'interest', label: 'Interest' },
];

function Spark({ values, startDay }: { values: number[]; startDay: number }) {
  const w = 600;
  const h = 120;
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const x = (i: number) => (i / (values.length - 1)) * (w - 20) + 10;
  const y = (v: number) => h - 14 - ((v - min) / (max - min)) * (h - 28);
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const low = Math.min(...values);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="#d64545" strokeDasharray="4 4" strokeWidth={1} />
      <path d={path} fill="none" stroke={low < 0 ? '#d64545' : '#1f9d55'} strokeWidth={3} strokeLinejoin="round" />
      <text x={10} y={12} fontSize={11} fill="#6b6570">
        {dateLabel(startDay)}
      </text>
      <text x={w - 10} y={12} fontSize={11} fill="#6b6570" textAnchor="end">
        {dateLabel(startDay + values.length - 1)}
      </text>
    </svg>
  );
}

export function Finance() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const pools = cashPools(game);
  const proj = runwayProjection(game);
  const low = Math.min(...proj);
  const lowDay = game.day + 1 + proj.indexOf(low);
  const rolling = trailing(game, 30);
  const reports = game.reports.slice(-4);
  const credit = game.credit;
  const [days, setDays] = useState(30);
  const byProduct = productTrailing(game, days);
  const byChannel = channelTrailing(game, days);
  const anyThirdParty = Object.values(byProduct).some((x) => x.thirdParty > 0);

  return (
    <div>
      <AppTitle app="Bank" title="Cash River" sub="Profit is the score. Cash is what keeps you alive. Follow where your money is right now." />
      <div className="river">
        <div className="pool cash">
          💵 Bank
          <b>{money(pools.cash)}</b>
          spendable
        </div>
        <span className="arrow">→</span>
        <div className={`pool ${pools.production ? 'locked' : ''}`}>
          🏭 In production
          <b>{money(pools.production)}</b>
        </div>
        <span className="arrow">→</span>
        <div className={`pool ${pools.transit ? 'locked' : ''}`}>
          🚢 In transit
          <b>{money(pools.transit)}</b>
        </div>
        <span className="arrow">→</span>
        <div className={`pool ${pools.shelf ? 'locked' : ''}`}>
          📦 On the shelf
          <b>{money(pools.shelf)}</b>
          at cost
        </div>
        <span className="arrow">→</span>
        <div className="pool">
          ⏳ Payouts coming
          <b>{money(pools.payouts + pools.receivables)}</b>
          {pools.receivables > 0 ? `incl. ${money(pools.receivables)} invoices` : 'from channels'}
        </div>
        {pools.payables > 0 && (
          <>
            <span className="arrow">·</span>
            <div className="pool locked">
              🧾 Owed to suppliers
              <b>{money(pools.payables)}</b>
              balances & net-30
            </div>
          </>
        )}
      </div>
      <p className="tiny muted">Only the green pool pays for ads, payroll, rent and reorders. Money in orange pools is real, but it’s locked up in stock.</p>

      <h3>Next 30 days (if nothing changes)</h3>
      <Spark values={[Math.round(game.cash), ...proj]} startDay={game.day} />
      {low < 0 ? (
        <p className="callout bad">
          ⚠️ Cash is projected to hit <b>{money(low)}</b> around {dateLabel(lowDay)}. Options: pause losing ads, order smaller or by sea, run a sale on slow stock{credit.unlocked ? ', or draw on your credit line' : ''}.
        </p>
      ) : (
        <p className="callout good">
          Lowest projected balance: {money(low)} around {dateLabel(lowDay)}. Payroll runs {money(payrollMonthly(game))}/month.
        </p>
      )}

      {credit.unlocked && (
        <>
          <h3>💳 Credit line</h3>
          <div className="row between">
            <span>
              Owed <b>{money(credit.balance)}</b> of {money(credit.limit)} limit · 1.5% interest a month
            </span>
            <span className="row">
              <button className="small" onClick={() => act(drawCredit, 5000)} disabled={credit.balance >= credit.limit}>
                Draw $5k
              </button>
              <button className="small" onClick={() => act(drawCredit, 25000)} disabled={credit.balance >= credit.limit}>
                Draw $25k
              </button>
              <button className="small" onClick={() => act(repayCredit, credit.balance)} disabled={!credit.balance}>
                Repay all
              </button>
            </span>
          </div>
          <p className="tiny muted">The limit tracks your monthly revenue. If cash goes negative, the line is drawn automatically.</p>
        </>
      )}
      {game.loan && (
        <p className="callout warn">
          You owe {money(game.loan.amount)} on the {game.loan.label}, due {dateLabel(game.loan.dueDay)}.
        </p>
      )}

      <h3>Profit & loss</h3>
      <table className="data">
        <thead>
          <tr>
            <th />
            {reports.map((r) => (
              <th key={r.month} className="num">
                Month {r.month}
              </th>
            ))}
            <th className="num">Last 30 days</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.k}>
              <td>{row.label}</td>
              {reports.map((r) => (
                <td key={r.month} className="num">
                  {row.k === 'revenue' ? money(r.pl[row.k]) : r.pl[row.k] ? `−${money(r.pl[row.k]).replace('$', '$')}` : '—'}
                </td>
              ))}
              <td className="num">{row.k === 'revenue' ? money(rolling.pl[row.k]) : rolling.pl[row.k] ? `−${money(rolling.pl[row.k])}` : '—'}</td>
            </tr>
          ))}
          <tr>
            <td>
              <b>Profit</b>
            </td>
            {reports.map((r) => (
              <td key={r.month} className={`num ${r.profit >= 0 ? 'good-text' : 'bad-text'}`}>
                <b>{money(r.profit)}</b>
              </td>
            ))}
            <td className={`num ${profitOf(rolling.pl) >= 0 ? 'good-text' : 'bad-text'}`}>
              <b>{money(profitOf(rolling.pl))}</b>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="tiny muted">Profit counts product cost when an item sells, not when you pay the factory. That’s why profit and cash rarely match.</p>

      <div className="row between" style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0 }}>Profit by product</h3>
        <Options value={days} options={[{ v: 7, label: '7 days' }, { v: 30, label: '30 days' }, { v: 90, label: '90 days' }]} onChange={setDays} />
      </div>
      <SliceTable
        showThirdParty={anyThirdParty}
        rows={Object.entries(byProduct)
          .filter(([pid]) => game.products[pid])
          .sort((a, b) => b[1].revenue - a[1].revenue)
          .map(([pid, x]) => ({ key: pid, label: <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><ProductImage game={game} pid={pid} size={26} round={6} /> {def(game, pid).name}</span>, x }))}
      />
      <h3>Profit by channel</h3>
      <SliceTable
        showThirdParty={anyThirdParty}
        rows={(Object.entries(byChannel) as [ChannelId, NonNullable<(typeof byChannel)[ChannelId]>][]).sort((a, b) => b[1].revenue - a[1].revenue).map(([ch, x]) => ({ key: ch, label: `${CHANNELS[ch].emoji} ${CHANNELS[ch].name}`, x }))}
      />
      <p className="tiny muted">Profit here is contribution: revenue minus product cost, shipping & packing (incl. 3PL fees), payment/marketplace fees, ads and refunds. Payroll, rent and overhead are shared costs and not split by product.</p>

      <h3>Upcoming bills</h3>
      <table className="data">
        <tbody>
          {[...game.bills]
            .sort((a, b) => a.dueDay - b.dueDay)
            .map((b) => (
              <tr key={b.id}>
                <td>{b.label}</td>
                <td className="muted">{dateLabel(b.dueDay)}</td>
                <td className="num">{money(b.amount)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
