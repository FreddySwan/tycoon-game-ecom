import type { ReactNode } from 'react';
import { sliceProfit } from '../sim/economics';
import type { Slice } from '../sim/types';
import { money, pct } from './format';

/** A compact P&L table: one row per product or channel, contribution before payroll, rent and overhead. */
export function SliceTable({ rows, showThirdParty }: { rows: { key: string; label: ReactNode; x: Slice }[]; showThirdParty: boolean }) {
  const total = rows.reduce(
    (a, r) => {
      for (const k of Object.keys(a) as (keyof Slice)[]) a[k] += r.x[k];
      return a;
    },
    { orders: 0, units: 0, revenue: 0, refunds: 0, cogs: 0, fees: 0, fulfillment: 0, thirdParty: 0, ads: 0 } as Slice,
  );
  const line = (key: string, label: ReactNode, x: Slice, bold = false) => {
    const profit = sliceProfit(x);
    return (
      <tr key={key} style={bold ? { fontWeight: 800 } : undefined}>
        <td>{label}</td>
        <td className="num">{Math.round(x.orders).toLocaleString()}</td>
        <td className="num">{money(x.revenue)}</td>
        <td className="num">{money(x.cogs)}</td>
        <td className="num">
          {money(x.fulfillment)}
          {showThirdParty && x.thirdParty > 0 && <div className="tiny muted">3PL {money(x.thirdParty)}</div>}
        </td>
        <td className="num">{money(x.fees)}</td>
        <td className="num">{money(x.ads)}</td>
        <td className="num">{money(x.refunds)}</td>
        <td className={`num ${profit >= 0 ? 'good-text' : 'bad-text'}`}>{money(profit)}</td>
        <td className="num">{x.revenue ? pct(profit / x.revenue, 0) : '—'}</td>
        <td className="num">{x.orders ? money(profit / x.orders, true) : '—'}</td>
      </tr>
    );
  };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data">
        <thead>
          <tr>
            <th />
            <th className="num">Orders</th>
            <th className="num">Revenue</th>
            <th className="num">Product cost</th>
            <th className="num">Ship & pack</th>
            <th className="num">Fees</th>
            <th className="num">Ads</th>
            <th className="num">Refunds</th>
            <th className="num">Profit</th>
            <th className="num">Margin</th>
            <th className="num">Per order</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => line(r.key, r.label, r.x))}
          {rows.length > 1 && line('total', 'Total', total, true)}
        </tbody>
      </table>
    </div>
  );
}
