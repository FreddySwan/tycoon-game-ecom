import { dateLabel, periodOf } from '../../sim/calendar';
import { Fragment, useState } from 'react';
import { CHANNELS } from '../../sim/data';
import { cashForecast, cashPools, channelTrailing, def, emptyPL, payrollMonthly, periodPL, productTrailing, profitOf, upcomingPayouts } from '../../sim/economics';
import type { PeriodKind } from '../../sim/calendar';
import type { ChannelId, DailyRecord, GameState } from '../../sim/types';
import { Options } from '../bits';
import { ProductImage } from '../photos';
import { SliceTable } from '../SliceTable';
import { drawCredit, repayCredit } from '../../sim/engine';
import type { PLCategory } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle } from '../bits';
import { money } from '../format';
import { LineChart, type Marker } from '../LineChart';

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

const shortDate = (day: number) => dateLabel(day).replace(/, Y\d+$/, '');

type Range = 'days' | 'weeks' | 'months';

interface Bucket {
  axis: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  cash: number;
}

/** History grouped into days (last 30), weeks (last 13) or months (last 12). */
function buckets(history: DailyRecord[], range: Range): Bucket[] {
  const groups: { first: number; last: number; recs: DailyRecord[]; label?: string }[] = [];
  if (range === 'days') for (const r of history.slice(-30)) groups.push({ first: r.day, last: r.day, recs: [r] });
  else if (range === 'weeks') {
    const recent = history.slice(-91);
    for (let end = recent.length; end > 0; end -= 7) {
      const recs = recent.slice(Math.max(0, end - 7), end);
      groups.unshift({ first: recs[0].day, last: recs[recs.length - 1].day, recs });
    }
  } else {
    const byMonth = new Map<number, (typeof groups)[number]>();
    for (const r of history) {
      const { key, label } = periodOf(r.day, 'month');
      const g = byMonth.get(key) ?? { first: r.day, last: r.day, recs: [], label };
      g.last = r.day;
      g.recs.push(r);
      byMonth.set(key, g);
    }
    groups.push(...[...byMonth.values()].slice(-12));
  }
  return groups.map((g) => {
    const pl = emptyPL();
    for (const r of g.recs) for (const k of Object.keys(pl) as PLCategory[]) pl[k] += r.pl[k];
    const profit = profitOf(pl);
    const label = g.label ?? (g.first === g.last ? dateLabel(g.first) : `${shortDate(g.first)} – ${dateLabel(g.last)}`);
    return { axis: g.label ?? shortDate(g.first), label, revenue: pl.revenue, expenses: pl.revenue - profit, profit, cash: g.recs[g.recs.length - 1].cash };
  });
}

/** Revenue, expenses and profit over time. */
function TrendChart({ game }: { game: GameState }) {
  const [range, setRange] = useState<Range>('days');
  const data = buckets(game.history, range);
  return (
    <>
      <div className="row between" style={{ marginTop: 14 }}>
        <h3 style={{ margin: 0 }}>Revenue, expenses & profit</h3>
        <Options
          value={range}
          options={[
            { v: 'days', label: 'Daily · 30 days' },
            { v: 'weeks', label: 'Weekly · 13 weeks' },
            { v: 'months', label: 'Monthly · 12 months' },
          ]}
          onChange={setRange}
        />
      </div>
      {data.length < 2 ? (
        <p className="muted tiny">Play a few days and your sales history shows up here.</p>
      ) : (
        <LineChart
          xLabels={data.map((b) => b.axis)}
          titles={data.map((b) => b.label)}
          series={[
            { key: 'rev', label: 'Revenue', color: '#2f7fd8', values: data.map((b) => b.revenue) },
            { key: 'exp', label: 'Expenses', color: '#e0803a', values: data.map((b) => b.expenses) },
            { key: 'profit', label: 'Profit', color: '#1f9d55', values: data.map((b) => b.profit), area: true },
          ]}
          extra={(i) => (
            <>
              <div className="tiny muted" style={{ marginTop: 4 }}>
                {data[i].revenue ? `${Math.round((data[i].profit / data[i].revenue) * 100)}% margin · ` : ''}cash after: {money(data[i].cash)}
              </div>
            </>
          )}
        />
      )}
      <p className="tiny muted">Expenses = everything in the P&L below: product cost, shipping & packing, fees, ads, refunds, payroll, rent, overhead and interest. Hover the chart for exact numbers.</p>
    </>
  );
}

export function Finance() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const pools = cashPools(game);
  const forecast = cashForecast(game);
  const proj = forecast.map((d) => d.cash);
  const low = Math.min(...proj);
  const lowDay = game.day + 1 + proj.indexOf(low);
  const payouts = upcomingPayouts(game);
  const nextIn = [...payouts.map((p) => p.day), ...game.receivables.map((r) => r.dueDay)].sort((a, b) => a - b)[0];
  const markers: Marker[] = forecast.flatMap((d, i) => [
    ...(d.inflows.length ? [{ index: i + 1, color: '#1f9d55' }] : []),
    ...(!d.inflows.length && d.outflows.some((o) => o.amount >= 200) ? [{ index: i + 1, color: '#d64545' }] : []),
  ]);
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
          {nextIn ? `next on ${shortDate(nextIn)}` : 'from channels'}
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

      <TrendChart game={game} />

      <h3>Cash forecast: next 30 days (if nothing changes)</h3>
      <LineChart
        height={170}
        xLabels={[`Today`, ...forecast.map((d) => shortDate(d.day))]}
        titles={[`Today · ${dateLabel(game.day)}`, ...forecast.map((d) => dateLabel(d.day))]}
        series={[{ key: 'cash', label: 'Bank balance', color: low < 0 ? '#d64545' : '#1f9d55', values: [Math.round(game.cash), ...proj], area: true }]}
        markers={markers}
        danger={0}
        extra={(i) => {
          const d = forecast[i - 1];
          if (!d) return <div className="tiny muted">Where you are now</div>;
          return (
            <>
              {d.inflows.map((f, k) => (
                <div key={`i${k}`} className="tiny good-text">
                  + {money(f.amount)} {f.label}
                </div>
              ))}
              {d.outflows
                .filter((o) => o.amount >= 50)
                .map((o, k) => (
                  <div key={`o${k}`} className="tiny bad-text">
                    − {money(o.amount)} {o.label}
                  </div>
                ))}
              {!d.inflows.length && !d.outflows.some((o) => o.amount >= 50) && <div className="tiny muted">Daily costs only (ads, shipping, refunds)</div>}
            </>
          );
        }}
      />
      <p className="tiny muted">
        <span className="good-text">●</span> payout lands · <span className="bad-text">●</span> big bill. Sales don’t hit your bank right away: each channel holds the money and pays out on a schedule.
      </p>
      {low < 0 ? (
        <p className="callout bad">
          ⚠️ Cash is projected to hit <b>{money(low)}</b> around {dateLabel(lowDay)}. Options: pause losing ads, order smaller or by sea, run a sale on slow stock{credit.unlocked ? ', or draw on your credit line' : ''}.
        </p>
      ) : (
        <p className="callout good">
          Lowest projected balance: {money(low)} around {dateLabel(lowDay)}. Payroll runs {money(payrollMonthly(game))}/month.
        </p>
      )}

      <h3>⏳ Money on its way</h3>
      {payouts.length || game.receivables.length ? (
        <table className="data">
          <thead>
            <tr>
              <th>From</th>
              <th>Lands on</th>
              <th className="num">Waiting now</th>
              <th className="num">Expected</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.channel}>
                <td>
                  {CHANNELS[p.channel].emoji} {CHANNELS[p.channel].name} <span className="tiny muted">pays every {CHANNELS[p.channel].payoutEvery} days</span>
                </td>
                <td>
                  {dateLabel(p.day)} <span className="tiny muted">({p.day - game.day === 1 ? 'tomorrow' : `in ${p.day - game.day} days`})</span>
                </td>
                <td className="num">{money(p.held)}</td>
                <td className="num">
                  <b>~{money(p.estimate)}</b>
                </td>
              </tr>
            ))}
            {[...game.receivables]
              .sort((a, b) => a.dueDay - b.dueDay)
              .map((r, k) => (
                <tr key={`r${k}`}>
                  <td>🧾 {r.label}</td>
                  <td>
                    {dateLabel(r.dueDay)} <span className="tiny muted">(in {r.dueDay - game.day} days)</span>
                  </td>
                  <td className="num">{money(r.amount)}</td>
                  <td className="num">
                    <b>{money(r.amount)}</b>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <p className="tiny muted">Nothing pending. Once you make sales, each channel’s next payout shows up here.</p>
      )}
      <p className="tiny muted">“Expected” adds what you’ll likely sell before payout day at last week’s pace, after channel fees.</p>

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

      <PLTable />
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

/** Profit & loss by month, quarter or year. Click a line to see what it’s made of. */
function PLTable() {
  const game = useGame((s) => s.game);
  const [kind, setKind] = useState<PeriodKind>('month');
  const [open, setOpen] = useState<Set<PLCategory>>(new Set());
  const periods = periodPL(game, kind, kind === 'year' ? 3 : 4);
  const toggle = (k: PLCategory) => {
    const next = new Set(open);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setOpen(next);
  };
  const cell = (k: PLCategory, v: number) => (k === 'revenue' ? money(v) : v ? `−${money(v)}` : '—');
  return (
    <>
      <div className="row between" style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0 }}>Profit & loss</h3>
        <Options value={kind} options={[{ v: 'month', label: 'Monthly' }, { v: 'quarter', label: 'Quarterly' }, { v: 'year', label: 'Yearly' }]} onChange={setKind} />
      </div>
      <p className="tiny muted">Click a line to break it down (by product, channel, ad source, team or item).</p>
      <div style={{ overflowX: 'auto' }}>
        <table className="data pl">
          <thead>
            <tr>
              <th />
              {periods.map((p) => (
                <th key={p.label} className="num">
                  {p.label}
                  {p.partial && <div className="tiny muted" style={{ textTransform: 'none' }}>so far</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const subs = new Map<string, number>();
              for (const p of periods) for (const [name, v] of Object.entries(p.sub[row.k] ?? {})) subs.set(name, (subs.get(name) ?? 0) + Math.abs(v));
              const names = [...subs.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
              const isOpen = open.has(row.k);
              const any = periods.some((p) => p.pl[row.k]);
              if (!any) return null;
              return (
                <Fragment key={row.k}>
                  <tr className="pl-row" onClick={() => toggle(row.k)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span className="caret">{isOpen ? '▾' : '▸'}</span> {row.label}
                    </td>
                    {periods.map((p) => (
                      <td key={p.label} className="num">
                        {cell(row.k, p.pl[row.k])}
                      </td>
                    ))}
                  </tr>
                  {isOpen &&
                    names.map((name) => (
                      <tr key={name} className="pl-sub">
                        <td>{name}</td>
                        {periods.map((p) => (
                          <td key={p.label} className="num">
                            {cell(row.k, p.sub[row.k]?.[name] ?? 0)}
                          </td>
                        ))}
                      </tr>
                    ))}
                </Fragment>
              );
            })}
            <tr>
              <td>
                <b>Profit</b>
              </td>
              {periods.map((p) => {
                const v = profitOf(p.pl);
                return (
                  <td key={p.label} className={`num ${v >= 0 ? 'good-text' : 'bad-text'}`}>
                    <b>{money(v)}</b>
                    <div className="tiny muted">{p.pl.revenue ? `${Math.round((v / p.pl.revenue) * 100)}% margin` : ''}</div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
