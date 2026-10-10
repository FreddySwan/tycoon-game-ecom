import { useEffect, useRef } from 'react';
import { ApartmentScene } from '../scene/Apartment';
import { LayoutScene } from '../scene/LayoutScene';
import { useGame } from '../state/store';

type Scene = ApartmentScene | LayoutScene;

/** Renders the current space. Game time is ticked separately (see useGameLoop), so a rendering problem never stops the game. */
export function Diorama() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    let scene: Scene | null = null;
    let kind = '';
    let raf = 0;
    let last = performance.now();
    let failures = 0;

    const mount = (want: string) => {
      scene?.destroy();
      el.querySelectorAll('canvas').forEach((c) => c.remove());
      const next: Scene = want === 'apartment' ? new ApartmentScene() : new LayoutScene();
      scene = next;
      kind = want;
      void next.init(el).catch((err) => {
        console.error('Scene failed to start', err);
        kind = '';
      });
      if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__scene = next;
    };

    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const { game, dayProgress } = useGame.getState();
      const want = game.space === 'apartment' ? 'apartment' : 'layout';
      if (want !== kind || scene?.lost) mount(want);
      // Only the newest canvas belongs on screen.
      const canvases = el.querySelectorAll('canvas');
      if (canvases.length > 1) canvases.forEach((c, i) => i < canvases.length - 1 && c.remove());
      try {
        scene?.update(game, dayProgress, dt);
        failures = 0;
      } catch (err) {
        if (failures++ === 0) console.error('Scene update failed, rebuilding', err);
        if (failures > 30) {
          kind = '';
          failures = 0;
        }
      }
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

/** Advances game time on animation frames, independent of the scene. */
export function useGameLoop(): void {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      try {
        useGame.getState().tick(dt);
      } catch (err) {
        console.error('Game tick failed', err);
        useGame.getState().setSpeed(0);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}
