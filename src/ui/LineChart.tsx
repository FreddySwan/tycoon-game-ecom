import { type ReactNode, useEffect, useRef, useState } from 'react';
import { money } from './format';

export interface Series {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
  /** Shade the area between the line and zero. */
  area?: boolean;
}

export interface Marker {
  index: number;
  color: string;
}

interface Props {
  series: Series[];
  /** One label per point (shown on the x-axis and in the tooltip). */
  xLabels: string[];
  /** Longer per-point titles for the tooltip (defaults to the x label). */
  titles?: string[];
  height?: number;
  format?: (v: number) => string;
  /** Extra tooltip lines for the hovered point. */
  extra?: (i: number) => ReactNode;
  markers?: Marker[];
  /** Dashed red line for a floor such as $0 cash. */
  danger?: number;
  axisFormat?: (v: number) => string;
  /** Hide the y-axis numbers (shape matters, not values). */
  hideY?: boolean;
}

/** Compact axis money: $950, $12k, $1.4M. */
export function shortMoney(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return `${sign}$${Math.round(a)}`;
}

function niceStep(range: number): number {
  const raw = range / 4 || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

const PAD = { left: 52, right: 14, top: 10, bottom: 24 };

/** Multi-line chart with axes, a legend and a hover crosshair that reads out every series. */
export function LineChart({ series, xLabels, titles, height = 200, format = money, extra, markers = [], danger, axisFormat = shortMoney, hideY = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 600));
    ro.observe(el);
    setWidth(el.clientWidth || 600);
    return () => ro.disconnect();
  }, []);

  const n = xLabels.length;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (danger !== undefined) all.push(danger);
  const step = niceStep(Math.max(1, Math.max(0, ...all) - Math.min(0, ...all)));
  const lo = Math.floor(Math.min(0, ...all) / step) * step;
  const hi = Math.max(lo + step, Math.ceil(Math.max(1, ...all) / step) * step);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);

  const plotW = Math.max(10, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH;

  const pathOf = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  const areaOf = (vals: (number | null)[]) => {
    const pts = vals.map((v, i) => (v === null ? null : [x(i), y(v)])).filter((p): p is number[] => !!p);
    if (pts.length < 2) return '';
    return `M${pts[0][0]},${y(0)} ${pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} L${pts[pts.length - 1][0]},${y(0)} Z`;
  };

  const tickEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 90))));
  const xTicks = xLabels.map((_, i) => i).filter((i) => i % tickEvery === 0 || i === n - 1).filter((i, k, arr) => i === n - 1 || arr[k + 1] === undefined || arr[k + 1] - i >= tickEvery * 0.6);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const i = n <= 1 ? 0 : Math.round(((mx - PAD.left) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const tipLeft = hover !== null ? x(hover) : 0;
  const flip = tipLeft > width * 0.6;

  return (
    <div className="chart" ref={ref}>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color, opacity: s.dashed ? 0.6 : 1 }} /> {s.label}
          </span>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block' }}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#b9b0a3' : '#ece4d8'} strokeWidth={v === 0 ? 1.2 : 1} />
              {!hideY && (
                <text x={PAD.left - 6} y={y(v) + 4} fontSize={11} fill="#8a8290" textAnchor="end">
                  {axisFormat(v)}
                </text>
              )}
            </g>
          ))}
          {danger !== undefined && <line x1={PAD.left} x2={width - PAD.right} y1={y(danger)} y2={y(danger)} stroke="#d64545" strokeDasharray="4 4" />}
          {xTicks.map((i) => (
            <g key={i}>
              <line x1={x(i)} x2={x(i)} y1={PAD.top + plotH} y2={PAD.top + plotH + 4} stroke="#b9b0a3" />
              <text x={x(i)} y={height - 6} fontSize={11} fill="#8a8290" textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}>
                {xLabels[i]}
              </text>
            </g>
          ))}
          {series.map((s) => s.area && <path key={`${s.key}-a`} d={areaOf(s.values)} fill={s.color} opacity={0.1} />)}
          {series.map((s) => (
            <path key={s.key} d={pathOf(s.values)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '6 5' : undefined} />
          ))}
          {markers.map((m, k) => {
            const v = series[0]?.values[m.index];
            return v === null || v === undefined ? null : <circle key={k} cx={x(m.index)} cy={y(v)} r={4} fill="#fff" stroke={m.color} strokeWidth={2.5} />;
          })}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="#6b6570" strokeDasharray="3 3" />
              {series.map((s) => {
                const v = s.values[hover];
                return v === null || v === undefined ? null : <circle key={s.key} cx={x(hover)} cy={y(v)} r={4} fill={s.color} stroke="#fff" strokeWidth={1.5} />;
              })}
            </g>
          )}
          <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="transparent" />
        </svg>
        {hover !== null && (
          <div className="chart-tip" style={flip ? { right: width - tipLeft + 10 } : { left: tipLeft + 10 }}>
            <b>{titles?.[hover] ?? xLabels[hover]}</b>
            {series.map((s) => {
              const v = s.values[hover];
              if (v === null || v === undefined) return null;
              return (
                <div key={s.key} className="row between" style={{ gap: 10, flexWrap: 'nowrap' }}>
                  <span>
                    <i style={{ background: s.color }} /> {s.label}
                  </span>
                  <b style={{ color: v < 0 ? '#d64545' : undefined }}>{format(v)}</b>
                </div>
              );
            })}
            {extra?.(hover)}
          </div>
        )}
      </div>
    </div>
  );
}
