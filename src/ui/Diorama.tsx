import { useEffect, useRef } from 'react';
import { ApartmentScene } from '../scene/Apartment';
import { LayoutScene } from '../scene/LayoutScene';
import { useGame } from '../state/store';

type Scene = ApartmentScene | LayoutScene;

export function Diorama() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    let scene: Scene | null = null;
    let kind = '';
    let raf = 0;
    let last = performance.now();

    const mount = (apartment: boolean) => {
      scene?.destroy();
      el.querySelectorAll('canvas').forEach((c) => c.remove());
      const next: Scene = apartment ? new ApartmentScene() : new LayoutScene();
      scene = next;
      kind = apartment ? 'apartment' : 'layout';
      void next.init(el);
      if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__scene = next;
    };

    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      useGame.getState().tick(dt);
      const { game, dayProgress } = useGame.getState();
      const want = game.space === 'apartment' ? 'apartment' : 'layout';
      if (want !== kind) mount(want === 'apartment');
      scene?.update(game, dayProgress, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => scene?.layout());
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene?.destroy();
    };
  }, []);

  return <div className="diorama" ref={host} />;
}
