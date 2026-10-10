import type { CSSProperties } from 'react';
import { def } from '../sim/economics';
import type { GameState, PhotoChoice } from '../sim/types';
import credits from './photo-credits.json';

export interface Photo {
  src: string;
  title: string;
  creator: string;
  license: string;
  url: string;
  w: number;
  h: number;
}

const CREDITS = credits as Record<string, Photo[]>;

/** Reference photos for a product (exclusive products reuse their base product's photos). */
export function photosFor(game: GameState, pid: string): Photo[] {
  const d = def(game, pid);
  return CREDITS[d.baseId ?? d.id] ?? CREDITS[pid] ?? [];
}

export function photoUrl(p: Photo): string {
  return `/assets/products/${p.src}`;
}

export function allCredits(): { pid: string; photo: Photo }[] {
  return Object.entries(CREDITS).flatMap(([pid, list]) => list.map((photo) => ({ pid, photo })));
}

export function ProductImage({ game, pid, index = 0, size = 64, round = 10, style }: { game: GameState; pid: string; index?: number; size?: number | string; round?: number; style?: CSSProperties }) {
  const list = photosFor(game, pid);
  const p = list[index % Math.max(1, list.length)];
  // Slot 0 is a clean product shot on white: show it whole. Other slots are lifestyle photos: fill the frame.
  const main = index % Math.max(1, list.length) === 0;
  const box: CSSProperties = { width: size, height: size, borderRadius: round, objectFit: main ? 'contain' : 'cover', flex: 'none', background: main ? '#fff' : '#f3e3cf', display: 'block', ...style };
  if (!p) return <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: typeof size === 'number' ? size * 0.5 : 28 }}>{def(game, pid).emoji}</div>;
  return <img src={photoUrl(p)} alt={def(game, pid).name} style={box} loading="lazy" />;
}

const BACKDROP: Record<PhotoChoice['backdrop'], string> = {
  countertop: 'linear-gradient(180deg,#f4f1ec 0 62%,#d9d2c7 62% 100%)',
  floor: 'linear-gradient(180deg,#efe6da 0 55%,#c99a6b 55% 100%)',
  sheet: 'radial-gradient(circle at 50% 40%,#ffffff,#ebe8e3)',
};
const LIGHT: Record<PhotoChoice['light'], string> = {
  window: 'brightness(1.06) saturate(1.1) contrast(1.02)',
  lamp: 'brightness(0.82) sepia(0.35) saturate(1.2)',
  overhead: 'brightness(1.12) contrast(0.82) saturate(0.85)',
};

/** The player's own product shot: reference photo framed on the chosen backdrop with their light and camera. */
export function ProductShot({ game, pid, choice, height = 160, children }: { game: GameState; pid: string; choice: PhotoChoice | null; height?: number; children?: React.ReactNode }) {
  const list = photosFor(game, pid);
  const p = list[0];
  const c: PhotoChoice = choice ?? { backdrop: 'sheet', light: 'overhead', prop: 'none', angle: 'top', x: 0.5, y: 0.5, zoom: 1 };
  const zoom = c.zoom ?? 1;
  const tilt = c.angle === 'top' ? 'perspective(500px) rotateX(18deg)' : c.angle === 'angled' ? 'perspective(500px) rotateX(8deg) rotateZ(-3deg)' : 'none';
  return (
    <div style={{ position: 'relative', height, borderRadius: 10, overflow: 'hidden', background: BACKDROP[c.backdrop] }}>
      <div
        style={{
          position: 'absolute',
          left: `${(c.x ?? 0.5) * 100}%`,
          top: `${(c.y ?? 0.5) * 100}%`,
          width: `${48 * zoom}%`,
          aspectRatio: '1',
          transform: `translate(-50%,-50%) ${tilt}`,
          filter: LIGHT[c.light],
          boxShadow: '0 10px 18px rgba(0,0,0,0.18)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {p ? <img src={photoUrl(p)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <span style={{ fontSize: 60 }}>{def(game, pid).emoji}</span>}
      </div>
      {c.prop === 'cat' && <span style={{ position: 'absolute', right: '8%', bottom: '6%', fontSize: height * 0.22 }}>🐈</span>}
      {c.prop === 'accessory' && <span style={{ position: 'absolute', left: '8%', bottom: '8%', fontSize: height * 0.16 }}>✨</span>}
      {c.light === 'lamp' && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 15%, rgba(255,200,120,0.35), transparent 60%)' }} />}
      {c.light === 'window' && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(110deg, rgba(255,255,255,0.35), transparent 45%)' }} />}
      {children}
    </div>
  );
}
