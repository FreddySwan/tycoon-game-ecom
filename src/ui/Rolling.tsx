import { useEffect, useRef, useState } from 'react';
import { money } from './format';

/** Money that rolls to its new value, flashing green when it goes up and red when it goes down. */
export function RollingMoney({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  const from = useRef(value);
  useEffect(() => {
    const start = shown;
    if (Math.abs(value - start) < 0.5) return;
    from.current = start;
    setDir(value > start ? 'up' : 'down');
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 450);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(from.current + (value - from.current) * eased);
      if (k < 1) raf = requestAnimationFrame(step);
      else setTimeout(() => setDir(null), 250);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span className={`rolling ${dir ?? ''}`}>{money(shown)}</span>;
}
