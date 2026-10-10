import type { ReactNode } from 'react';

export function Pips({ n, max = 5, bad = false }: { n: number; max?: number; bad?: boolean }) {
  return (
    <span className={`pips ${bad ? 'bad' : ''}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < n ? 'on' : ''} />
      ))}
    </span>
  );
}

export function AppTitle({ app, title, sub }: { app: string; title: string; sub?: ReactNode }) {
  return (
    <>
      <div className="app-title">
        <h2>{title}</h2>
        <span className="appname">{app}</span>
      </div>
      {sub && <p className="sub">{sub}</p>}
    </>
  );
}

export function Meter({ value, max = 1 }: { value: number; max?: number }) {
  return (
    <div className="meter">
      <span style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%` }} />
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="row" style={{ cursor: 'pointer', gap: 8 }}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Options<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="options">
      {options.map((o) => (
        <button key={String(o.v)} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Lock({ stage, what }: { stage: number; what: string }) {
  return (
    <div className="callout" style={{ textAlign: 'center', padding: 30 }}>
      <div style={{ fontSize: 34 }}>🔒</div>
      <b>{what}</b>
      <div className="muted tiny">Unlocks at stage {stage}. See the Company app for what it takes.</div>
    </div>
  );
}

/** A number field with − / + steppers. Commits on blur or Enter so typing isn't interrupted. */
export function NumberInput({ value, onChange, step = 5, min = 0, prefix = '', width = 70 }: { value: number; onChange: (v: number) => void; step?: number; min?: number; prefix?: string; width?: number }) {
  return (
    <span className="numinput">
      <button className="small ghost" onClick={() => onChange(Math.max(min, value - step))}>
        −
      </button>
      {prefix && <span className="tiny muted">{prefix}</span>}
      <input
        key={value}
        type="number"
        defaultValue={value}
        min={min}
        step={step}
        style={{ width }}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v !== value) onChange(Math.max(min, v));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <button className="small ghost" onClick={() => onChange(value + step)}>
        +
      </button>
    </span>
  );
}

export function SubTabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="subtabs">
      {tabs.map((t) => (
        <button key={t.id} className={t.id === value ? 'on' : ''} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Sparkline({ values, width = 120, height = 28, color = '#f0a860' }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const y = (v: number) => height - 3 - ((v - min) / Math.max(1e-9, max - min)) * (height - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}
