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
