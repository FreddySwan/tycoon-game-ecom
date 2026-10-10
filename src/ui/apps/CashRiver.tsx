import { cashPools, nextPayoutDay, runwayProjection } from '../../sim/economics';
import { useGame } from '../../state/store';
import { AppTitle } from '../bits';
import { money } from '../format';

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
        Day {startDay}
      </text>
      <text x={w - 10} y={12} fontSize={11} fill="#6b6570" textAnchor="end">
        Day {startDay + values.length - 1}
      </text>
    </svg>
  );
}

export function CashRiver() {
  const game = useGame((s) => s.game);
  const pools = cashPools(game);
  const proj = runwayProjection(game);
  const low = Math.min(...proj);
  const lowDay = game.day + 1 + proj.indexOf(low);
  const recent = game.history.slice(-7);
  const total = recent.reduce(
    (a, d) => ({ revenue: a.revenue + d.revenue, ads: a.ads + d.adSpend, profit: a.profit + d.profit, orders: a.orders + d.orders }),
    { revenue: 0, ads: 0, profit: 0, orders: 0 },
  );
  const bills = [...game.bills].sort((a, b) => a.dueDay - b.dueDay);

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
          {game.inventory.onHand} units at cost
        </div>
        <span className="arrow">→</span>
        <div className="pool">
          ⏳ Payout pending
          <b>{money(pools.payouts)}</b>
          arrives day {nextPayoutDay(game)}
        </div>
      </div>
      <p className="tiny muted">
        Only the green pool can pay for ads, rent or a reorder. Money in orange pools is real, but it’s locked up in stock.
      </p>

      <h3>Next 30 days (if nothing changes)</h3>
      <Spark values={[Math.round(game.cash), ...proj]} startDay={game.day} />
      {low < 0 ? (
        <p className="callout bad">
          ⚠️ Cash is projected to hit <b>{money(low)}</b> around day {lowDay}. Options: pause losing ads, run a sale on slow stock, order smaller, or ship by sea next time.
        </p>
      ) : (
        <p className="callout good">Lowest projected balance: {money(low)} around day {lowDay}. You’re safe for now.</p>
      )}

      <h3>Upcoming bills</h3>
      <table className="data">
        <tbody>
          {bills.map((b) => (
            <tr key={b.id}>
              <td>{b.label}</td>
              <td className="muted">day {b.dueDay}</td>
              <td className="num">{money(b.amount)}</td>
            </tr>
          ))}
          {game.loan && (
            <tr>
              <td>Family loan repayment</td>
              <td className="muted">day {game.loan.dueDay}</td>
              <td className="num">{money(game.loan.amount)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {recent.length > 0 && (
        <>
          <h3>Last {recent.length} days</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Day</th>
                <th className="num">Orders</th>
                <th className="num">Revenue</th>
                <th className="num">Ad spend</th>
                <th className="num">Profit</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((d) => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td className="num">{d.orders}</td>
                  <td className="num">{money(d.revenue)}</td>
                  <td className="num">{money(d.adSpend)}</td>
                  <td className={`num ${d.profit >= 0 ? 'good-text' : 'bad-text'}`}>{money(d.profit)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <b>Total</b>
                </td>
                <td className="num">
                  <b>{total.orders}</b>
                </td>
                <td className="num">
                  <b>{money(total.revenue)}</b>
                </td>
                <td className="num">
                  <b>{money(total.ads)}</b>
                </td>
                <td className={`num ${total.profit >= 0 ? 'good-text' : 'bad-text'}`}>
                  <b>{money(total.profit)}</b>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="tiny muted">Profit here = revenue − product cost − shipping − packaging − fees − ads. Rent and one-off purchases are not included.</p>
        </>
      )}
    </div>
  );
}
