import { useEffect, useRef } from 'react';
import { ApartmentScene } from '../scene/Apartment';
import { useGame } from '../state/store';

export function Diorama() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const scene = new ApartmentScene();
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const store = useGame.getState();
      store.tick(dt);
      const { game, dayProgress } = useGame.getState();
      scene.update(game, dayProgress, dt);
      raf = requestAnimationFrame(loop);
    };
    void scene.init(el).then(() => {
      raf = requestAnimationFrame(loop);
    });
    const ro = new ResizeObserver(() => scene.layout());
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.destroy();
    };
  }, []);

  return <div className="diorama" ref={host} />;
}
