import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { clockHour } from '../sim/calendar';
import type { GameState } from '../sim/types';
import { DAY_MS } from '../state/store';

/** Iso tile half-width / half-height in world pixels (Kenney renders at 0.5 scale). */
const A = 52;
const B = 36.25;
const N = 5;
const WALL_H = 100;
const SCALE = 0.75;
const UNITS_PER_BOX = 25;
const BOX_STEP = 20;
const BASE = '/assets/furniture/';

const iso = (i: number, j: number) => ({ x: (i - j) * A, y: (i + j) * B });

interface Placement {
  tex: string;
  i: number;
  j: number;
  fi: number;
  fj: number;
  dy?: number;
  dx?: number;
}

const FURNITURE: Placement[] = [
  // Kitchen along the left wall
  { tex: 'kitchenFridgeSmall_SE', i: 0.3, j: 0.3, fi: 0.55, fj: 0.55 },
  { tex: 'kitchenSink_SE', i: 0.34, j: 0.92, fi: 0.68, fj: 0.68 },
  { tex: 'kitchenStove_SE', i: 0.34, j: 1.6, fi: 0.68, fj: 0.68 },
  { tex: 'kitchenCabinet_SE', i: 0.34, j: 2.28, fi: 0.68, fj: 0.68 },
  { tex: 'bedSingle_SE', i: 0.85, j: 4.5, fi: 1.7, fj: 0.9 },
  // Desk, lamp and sofa along the right wall
  { tex: 'desk_SE', i: 1.25, j: 0.3, fi: 1.1, fj: 0.58 },
  { tex: 'lampRoundFloor_SE', i: 2.15, j: 0.2, fi: 0.3, fj: 0.3 },
  { tex: 'loungeSofa_SW', i: 3.85, j: 0.36, fi: 1.4, fj: 0.7 },
  { tex: 'pottedPlant_SE', i: 4.75, j: 0.22, fi: 0.3, fj: 0.3 },
  // Kitchen table = packing station, long side facing the desk so the founder works behind it
  { tex: 'table_SW', i: 2.15, j: 2.7, fi: 1.25, fj: 0.72 },
];

const RUG: Placement = { tex: 'rugRectangle_SE', i: 3.55, j: 1.65, fi: 2.0, fj: 1.7 };
const CHAIR: Placement = { tex: 'chairDesk_SW', i: 1.25, j: 0.85, fi: 0.43, fj: 0.43 };
const LAPTOP: Placement = { tex: 'laptop_SE', i: 1.15, j: 0.25, fi: 0.4, fj: 0.32, dy: -46 };
const TABLE_TOP = { i: 2.15, j: 2.7, h: 40 };
const WINDOW = { i0: 2.45, i1: 3.45, h0: 38, h1: 88 };

// ───────────────────────────── founder routine ─────────────────────────────

type Pose = 'stand' | 'work' | 'sit' | 'lie';

interface Spot {
  i: number;
  j: number;
  /** Where to walk to before stepping onto furniture (bed, sofa). */
  via?: { i: number; j: number };
  lift?: number;
  pose: Pose;
  /** Draw just in front of this furniture's depth. */
  over?: number;
}

const SOFA_Z = iso(3.85 + 0.7, 0.36 + 0.35).y;
const BED_Z = iso(0.85 + 0.85, 4.5 + 0.45).y;

type SpotId = 'bed' | 'sink' | 'stove' | 'desk' | 'table' | 'sofa';

const SPOTS: Record<SpotId, Spot> = {
  bed: { i: 0.72, j: 4.52, via: { i: 1.0, j: 3.8 }, lift: 16, pose: 'lie', over: BED_Z },
  sink: { i: 0.98, j: 0.98, pose: 'work' },
  stove: { i: 0.98, j: 1.62, pose: 'work' },
  desk: { i: 1.85, j: 0.95, pose: 'work' },
  table: { i: 1.98, j: 1.98, pose: 'work' },
  sofa: { i: 3.85, j: 0.5, via: { i: 3.85, j: 1.1 }, lift: 13, pose: 'sit', over: SOFA_Z },
};

/** Floor areas the founder walks around (i0, i1, j0, j1). */
const OBSTACLES = [
  [1.48, 2.83, 2.3, 3.1], // packing table
  [0, 1.75, 4.0, 5], // bed
  [0, 0.72, 0.15, 2.65], // kitchen
  [0.68, 1.82, 0, 0.62], // desk
  [3.1, 4.6, 0, 0.75], // sofa
];
const HUBS = [
  { i: 1.25, j: 1.95 },
  { i: 1.2, j: 3.45 },
  { i: 2.6, j: 1.75 },
  { i: 3.25, j: 2.3 },
  { i: 3.1, j: 3.4 },
];

function blocked(a: { i: number; j: number }, b: { i: number; j: number }): boolean {
  const steps = Math.ceil(Math.hypot(b.i - a.i, b.j - a.j) / 0.05);
  for (let k = 1; k < steps; k++) {
    const i = a.i + ((b.i - a.i) * k) / steps;
    const j = a.j + ((b.j - a.j) * k) / steps;
    if (OBSTACLES.some(([i0, i1, j0, j1]) => i > i0 && i < i1 && j > j0 && j < j1)) return true;
  }
  return false;
}

/** Shortest walk through the hub points that avoids furniture. */
function route(from: { i: number; j: number }, to: { i: number; j: number }): { i: number; j: number }[] {
  const nodes = [from, ...HUBS, to];
  const goal = nodes.length - 1;
  const dist = nodes.map(() => Infinity);
  const prev = nodes.map(() => -1);
  const done = new Set<number>();
  dist[0] = 0;
  while (done.size < nodes.length) {
    let u = -1;
    for (let k = 0; k < nodes.length; k++) if (!done.has(k) && (u < 0 || dist[k] < dist[u])) u = k;
    if (u < 0 || dist[u] === Infinity) break;
    done.add(u);
    if (u === goal) break;
    for (let v = 0; v < nodes.length; v++) {
      if (done.has(v) || blocked(nodes[u], nodes[v])) continue;
      const d = dist[u] + Math.hypot(nodes[v].i - nodes[u].i, nodes[v].j - nodes[u].j);
      if (d < dist[v]) {
        dist[v] = d;
        prev[v] = u;
      }
    }
  }
  if (prev[goal] < 0) return [to];
  const path: { i: number; j: number }[] = [];
  for (let k = goal; k > 0; k = prev[k]) path.unshift(nodes[k]);
  return path;
}

interface Activity {
  spot: SpotId;
  label: string;
}

/** What the founder is up to at this hour (7 = morning … 25 = 1am). Work adapts to what the business needs. */
function activityAt(h: number, game: GameState): Activity {
  const orders = game.backlog.length > 0;
  const live = Object.values(game.products).filter((p) => !p.retired);
  const adsOn = live.some((p) => p.search.active || Object.values(p.ads).some((c) => c.active));
  const tickets = game.tickets.queue.length > 0;
  const work = (): Activity => {
    if (orders && Math.floor(h * 2) % 3 !== 0) return { spot: 'table', label: '📦 Packing orders' };
    const desk: string[] = [];
    if (adsOn) desk.push('📣 Tuning ads');
    if (tickets) desk.push('💬 Answering customers');
    if (!live.length) desk.push('🔎 Researching products');
    desk.push('📧 Emails', '📊 Checking numbers');
    return { spot: 'desk', label: desk[Math.floor(h) % desk.length] };
  };
  if (h < 7.4) return { spot: 'bed', label: '😴 Snooze…' };
  if (h < 8.3) return { spot: 'sink', label: '☕ Coffee' };
  if (h < 12.5) return work();
  if (h < 13.2) return { spot: 'sink', label: '🥪 Lunch' };
  if (h < 18.5) return work();
  if (h < 19.5) return { spot: 'stove', label: '🍳 Cooking dinner' };
  if (h < 21.5) return orders && game.backlog.length > 3 ? { spot: 'table', label: '📦 Late packing' } : { spot: 'sofa', label: '📺 Downtime' };
  if (h < 22.8) return { spot: 'desk', label: '📊 Day review' };
  return { spot: 'bed', label: '💤 Zzz' };
}

const SKY: [number, number][] = [
  [7, 0xffd2a1],
  [9, 0xa8dcff],
  [16, 0xb9e3ff],
  [18.5, 0xffc98a],
  [20, 0x7a6fa8],
  [21.5, 0x2a2f5c],
  [25, 0x1a1f45],
];

function lerpColor(a: number, b: number, t: number): number {
  const ch = (c: number, sh: number) => (c >> sh) & 255;
  const mix = (sh: number) => Math.round(ch(a, sh) + (ch(b, sh) - ch(a, sh)) * t) << sh;
  return mix(16) | mix(8) | mix(0);
}

function skyAt(h: number): number {
  for (let k = 1; k < SKY.length; k++) if (h <= SKY[k][0]) return lerpColor(SKY[k - 1][1], SKY[k][1], (h - SKY[k - 1][0]) / (SKY[k][0] - SKY[k - 1][0]));
  return SKY[SKY.length - 1][1];
}

/** 0 by day, up to 1 deep at night. */
function nightAt(h: number): number {
  if (h < 8) return Math.max(0, (8 - h) * 0.5);
  if (h < 20) return 0;
  return Math.min(1, (h - 20) / 2.5);
}

interface Slot {
  i: number;
  j: number;
  lift: number;
  maxStack: number;
  group: number;
}

/** Where stock boxes go, in fill order: the "stock corner" first, then spilling across the apartment. */
function stockSlots(): Slot[] {
  const slots: Slot[] = [];
  const step = 0.34;
  const add = (group: number, i: number, j: number, lift: number, maxStack: number) => slots.push({ i, j, lift, maxStack, group });
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) add(0, 4.75 - a * step, 2.65 + b * step, 0, 3);
  for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) add(1, 3.7 - a * step, 3.85 + b * step, 0, 2);
  for (let a = 0; a < 3; a++) add(2, 3.45 + a * step, 0.42, 20, 1); // on the sofa
  for (let a = 0; a < 3; a++) add(3, 0.55 + a * step, 4.45, 18, 1); // on the bed
  for (let a = 0; a < 4; a++) add(4, 4.75, 3.7 + a * step, 0, 2);
  for (let a = 0; a < 3; a++) add(5, 2.0 + a * step, 4.7, 0, 2);
  // Fill order: each group stacks up fully before boxes spill into the next one.
  const order: Slot[] = [];
  for (let g = 0; g <= 5; g++) {
    const inGroup = slots.filter((sl) => sl.group === g);
    const levels = Math.max(...inGroup.map((sl) => sl.maxStack));
    for (let level = 0; level < levels; level++) for (const sl of inGroup) if (level < sl.maxStack) order.push({ ...sl, level } as Slot & { level: number });
  }
  return order;
}
const SLOTS = stockSlots();
const BOX_CAPACITY = SLOTS.length;

interface Flyer {
  sprite: Sprite;
  t: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface Popup {
  text: Text;
  t: number;
}

export class ApartmentScene {
  app = new Application();
  world = new Container();
  private tex: Record<string, Texture> = {};
  private orderBoxes = new Container();
  private fx = new Container();
  private sky = new Graphics();
  private lampGlow = new Graphics();
  private cat = new Container();
  private catTail = new Graphics();
  private founder = new Container();
  private poses: Record<Pose, Container> = {} as Record<Pose, Container>;
  private bubble = new Container();
  private bubbleText!: Text;
  private bubbleBg = new Graphics();
  private zzz!: Text;
  private night = new Graphics();
  private nightGlow = new Graphics();
  private pos = { i: SPOTS.bed.i, j: SPOTS.bed.j };
  private path: { i: number; j: number }[] = [];
  private spotId: SpotId | null = null;
  private walking = false;
  private label = '';
  private lastProgress = 0;
  private pace = 1;
  private flyers: Flyer[] = [];
  private popups: Popup[] = [];
  private shownBoxes = 0;
  private lastShipped = -1;
  private lastDay = -1;
  private pendingPopups: number[] = [];
  private time = 0;
  private destroyed = false;
  /** Set when the GPU context is lost; the host remounts the scene. */
  lost = false;
  private ready = false;

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({ backgroundAlpha: 0, antialias: true, resizeTo: host, autoDensity: true, resolution: window.devicePixelRatio || 1 });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    host.appendChild(this.app.canvas);
    this.app.canvas.addEventListener('webglcontextlost', () => (this.lost = true));
    const names = new Set([...FURNITURE, RUG, CHAIR, LAPTOP].map((p) => p.tex));
    names.add('cardboardBoxClosed_SE');
    names.add('cardboardBoxOpen_SE');
    await Promise.all(
      [...names].map(async (n) => {
        this.tex[n] = await Assets.load(`${BASE}${n}.png`);
      }),
    );
    // Replaced while loading: shut this renderer down and take its canvas with it.
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    this.build();
    this.ready = true;
    this.app.stage.addChild(this.world);
    this.layout();
  }

  private sprite(p: Placement, z?: number): Sprite {
    const s = new Sprite(this.tex[p.tex]);
    s.anchor.set(0.5, 1);
    s.scale.set(SCALE);
    const c = iso(p.i, p.j);
    const front = iso(p.i + p.fi / 2, p.j + p.fj / 2);
    s.position.set(c.x + (p.dx ?? 0), front.y + (p.dy ?? 0));
    s.zIndex = z ?? front.y;
    return s;
  }

  private build(): void {
    const shell = new Graphics();
    const p = (i: number, j: number, h = 0) => {
      const v = iso(i, j);
      return [v.x, v.y - h];
    };
    // Floor slab edge (cutaway look)
    shell.poly([...p(N, 0), ...p(N, N), ...p(0, N), ...p(0, N, -12), ...p(N, N, -12), ...p(N, 0, -12)]).fill(0xc98a5a);
    shell.poly([...p(0, 0), ...p(N, 0), ...p(N, N), ...p(0, N)]).fill(0xf3c08e);
    for (let k = 1; k < N; k++) {
      shell.moveTo(...(p(k, 0) as [number, number])).lineTo(...(p(k, N) as [number, number]));
      shell.moveTo(...(p(0, k) as [number, number])).lineTo(...(p(N, k) as [number, number]));
    }
    shell.stroke({ width: 1, color: 0xe2a974, alpha: 0.6 });
    // Walls
    shell.poly([...p(0, 0), ...p(0, N), ...p(0, N, WALL_H), ...p(0, 0, WALL_H)]).fill(0xf7f1e8);
    shell.poly([...p(0, 0), ...p(N, 0), ...p(N, 0, WALL_H), ...p(0, 0, WALL_H)]).fill(0xece2d4);
    shell.poly([...p(0, N, WALL_H), ...p(0, 0, WALL_H), ...p(N, 0, WALL_H), ...p(N, 0, WALL_H + 5), ...p(0, 0, WALL_H + 5), ...p(0, N, WALL_H + 5)]).fill(0xf0a860);
    // Skirting
    shell.poly([...p(0, 0), ...p(0, N), ...p(0, N, 5), ...p(0, 0, 5)]).fill(0xe8d9c4);
    shell.poly([...p(0, 0), ...p(N, 0), ...p(N, 0, 5), ...p(0, 0, 5)]).fill(0xdccbb3);
    shell.zIndex = -10000;
    this.world.addChild(shell);

    // Window on the right wall with a sky that follows the time of day
    const { i0: w0, i1: w1, h0, h1 } = WINDOW;
    this.sky.zIndex = -9999;
    this.world.addChild(this.sky);
    this.drawSky(10, false);
    const frame = new Graphics();
    frame.poly([...p(w0, 0, h0), ...p(w1, 0, h0), ...p(w1, 0, h1), ...p(w0, 0, h1)]).stroke({ width: 4, color: 0xffffff });
    frame.moveTo(...(p((w0 + w1) / 2, 0, h0) as [number, number])).lineTo(...(p((w0 + w1) / 2, 0, h1) as [number, number])).stroke({ width: 3, color: 0xffffff });
    frame.poly([...p(w0 - 0.05, 0, h0 - 4), ...p(w1 + 0.05, 0, h0 - 4), ...p(w1 + 0.05, 0, h0), ...p(w0 - 0.05, 0, h0)]).fill(0xffffff);
    frame.zIndex = -9998;
    this.world.addChild(frame);

    // Corkboard on the left wall
    const cork = new Graphics();
    cork.poly([...p(0, 3.95, 50), ...p(0, 4.85, 50), ...p(0, 4.85, 88), ...p(0, 3.95, 88)]).fill(0xc79a6b).stroke({ width: 3, color: 0x9a6b40 });
    cork.zIndex = -9997;
    this.world.addChild(cork);

    this.lampGlow.zIndex = -9996;
    this.world.addChild(this.lampGlow);

    const rug = this.sprite(RUG, -5000);
    this.world.addChild(rug);

    for (const f of FURNITURE) this.world.addChild(this.sprite(f));
    this.world.addChild(this.sprite(CHAIR));
    const laptop = this.sprite(LAPTOP);
    laptop.zIndex += 40;
    this.world.addChild(laptop);

    this.orderBoxes.zIndex = iso(TABLE_TOP.i + 0.7, TABLE_TOP.j + 0.4).y + 5;
    this.world.addChild(this.orderBoxes);

    this.buildCat();
    this.buildFounder();
    this.buildNight();
    this.fx.zIndex = 100000;
    this.world.addChild(this.fx);
    this.world.sortableChildren = true;
  }

  private drawSky(h: number, lampOn: boolean): void {
    const p = (i: number, hh: number) => {
      const v = iso(i, 0);
      return [v.x, v.y - hh];
    };
    this.sky.clear();
    this.sky.poly([...p(WINDOW.i0, WINDOW.h0), ...p(WINDOW.i1, WINDOW.h0), ...p(WINDOW.i1, WINDOW.h1), ...p(WINDOW.i0, WINDOW.h1)]).fill(skyAt(h));
    const n = nightAt(h);
    this.night.alpha = n * 0.42;
    this.lampGlow.clear();
    this.nightGlow.clear();
    if (lampOn) {
      const c = iso(2.15, 0.2);
      this.lampGlow.ellipse(c.x, c.y - 4, 80, 46).fill({ color: 0xffe2a8, alpha: 0.25 });
      this.nightGlow.ellipse(c.x, c.y - 30, 120, 80).fill({ color: 0xffd98a, alpha: 0.12 * n });
    }
    if (this.spotId === 'desk' && !this.walking && n > 0) {
      const c = iso(LAPTOP.i, LAPTOP.j);
      this.nightGlow.ellipse(c.x + 6, c.y - 40, 46, 30).fill({ color: 0xbfe3ff, alpha: 0.18 * n });
    }
  }

  private buildNight(): void {
    const p = (i: number, j: number, h = 0) => {
      const v = iso(i, j);
      return [v.x, v.y - h];
    };
    this.night
      .poly([...p(0, N, WALL_H + 5), ...p(0, 0, WALL_H + 5), ...p(N, 0, WALL_H + 5), ...p(N, 0), ...p(N, N), ...p(N, N, -12), ...p(0, N, -12), ...p(0, N)])
      .fill(0x141a3a);
    this.night.alpha = 0;
    this.night.zIndex = 90000;
    this.nightGlow.zIndex = 90001;
    this.nightGlow.blendMode = 'add';
    this.world.addChild(this.night, this.nightGlow);
  }

  private buildCat(): void {
    const g = new Graphics();
    g.ellipse(0, -7, 10, 7).fill(0xe8944a); // body
    g.circle(8, -14, 6).fill(0xe8944a); // head
    g.poly([3, -18, 5, -25, 8, -19]).fill(0xe8944a);
    g.poly([9, -19, 12, -25, 13, -17]).fill(0xe8944a);
    g.circle(10, -15, 1.1).fill(0x2b2b2b);
    g.circle(6.5, -15, 1.1).fill(0x2b2b2b);
    g.ellipse(-2, -9, 3, 1.5).fill(0xf6b878); // stripe
    this.catTail.roundRect(-2, -14, 3, 14, 1.5).fill(0xe8944a);
    this.catTail.position.set(-9, -4);
    this.cat.addChild(this.catTail, g);
    this.cat.scale.set(1.3);
    const label = new Text({ text: 'Invoice', style: { fontFamily: 'Nunito', fontSize: 9, fill: 0x8a5a2b, fontWeight: '700' } });
    label.anchor.set(0.5, 1);
    label.position.set(2, -28);
    label.alpha = 0;
    this.cat.addChild(label);
    this.cat.eventMode = 'static';
    this.cat.cursor = 'pointer';
    this.cat.on('pointerover', () => (label.alpha = 1));
    this.cat.on('pointerout', () => (label.alpha = 0));
    this.world.addChild(this.cat);
  }

  private buildFounder(): void {
    const body = (g: Graphics, legs: 'stand' | 'sit') => {
      if (legs === 'stand') {
        g.rect(-5, -13, 4, 12).fill(0x34495e);
        g.rect(1, -13, 4, 12).fill(0x34495e);
      } else {
        g.roundRect(-9, -9, 10, 4, 2).fill(0x34495e); // thighs forward
        g.roundRect(-10, -9, 4, 9, 2).fill(0x34495e); // shins down
      }
      const top = legs === 'stand' ? 0 : 5;
      g.roundRect(-6, -30 + top, 12, 18, 4).fill(0x2f8f83); // shirt
      g.circle(0, -37 + top, 7).fill(0xf1c27d); // head
      g.ellipse(0, -41 + top, 7.5, 4).fill(0x4a2f1b); // hair
    };
    const stand = new Graphics();
    body(stand, 'stand');
    const work = new Graphics();
    body(work, 'stand');
    work.roundRect(-11, -26, 6, 4, 2).fill(0xf1c27d); // hands out in front
    work.roundRect(5, -26, 6, 4, 2).fill(0xf1c27d);
    const sit = new Graphics();
    body(sit, 'sit');
    const lie = new Graphics();
    body(lie, 'stand');
    lie.rotation = -0.96; // along the bed, head on the pillow
    const blanket = new Graphics();
    blanket.roundRect(-8, -24, 16, 24, 5).fill(0xfbe7c6).stroke({ width: 1, color: 0xe2cdb0 });
    blanket.rotation = -0.96;
    const lying = new Container();
    lying.addChild(lie, blanket);
    for (const [k, g] of [['stand', stand], ['work', work], ['sit', sit], ['lie', lying]] as [Pose, Container][]) {
      g.scale.set(1.35);
      g.visible = k === 'stand';
      this.poses[k] = g;
      this.founder.addChild(g);
    }
    this.bubbleText = new Text({ text: '', style: { fontFamily: 'Nunito', fontSize: 11, fontWeight: '800', fill: 0x3a3340 } });
    this.bubbleText.anchor.set(0.5);
    this.bubble.addChild(this.bubbleBg, this.bubbleText);
    this.bubble.position.set(0, -78);
    this.founder.addChild(this.bubble);
    this.zzz = new Text({ text: 'z Z', style: { fontFamily: 'Nunito', fontSize: 14, fontWeight: '800', fill: 0xffffff, stroke: { color: 0x6b6fa8, width: 3 } } });
    this.zzz.anchor.set(0.5);
    this.zzz.visible = false;
    this.founder.addChild(this.zzz);
    this.world.addChild(this.founder);
  }

  private setBubble(text: string): void {
    if (text === this.label) return;
    this.label = text;
    this.bubbleText.text = text;
    const w = this.bubbleText.width + 14;
    this.bubbleBg.clear();
    this.bubbleBg.roundRect(-w / 2, -10, w, 20, 10).fill({ color: 0xffffff, alpha: 0.95 }).stroke({ width: 1.5, color: 0xe2cdb0 });
    this.bubbleBg.poly([-4, 9, 4, 9, 0, 15]).fill(0xffffff);
  }

  /** Walks the founder through the day: coffee, desk work or packing, lunch, dinner, sofa, bed. */
  private updateFounder(game: GameState, h: number, dt: number): void {
    const act = activityAt(h, game);
    const spot: Spot = SPOTS[act.spot];
    const first = this.spotId === null;
    if (act.spot !== this.spotId) {
      const leaving = this.spotId ? SPOTS[this.spotId] : null;
      this.spotId = act.spot;
      if (first) {
        this.pos = { i: spot.i, j: spot.j };
        this.path = [];
      } else {
        const start = leaving?.via ? [leaving.via] : [];
        const from = start[0] ?? this.pos;
        const goal = spot.via ?? spot;
        this.path = [...start, ...route(from, goal), ...(spot.via ? [{ i: spot.i, j: spot.j }] : [])];
      }
    }
    // Walk faster when the clock runs faster, so the founder keeps up with the schedule.
    const speed = 0.0024 * Math.min(6, Math.max(1, this.pace));
    let budget = dt * speed;
    while (this.path.length && budget > 0) {
      const next = this.path[0];
      const d = Math.hypot(next.i - this.pos.i, next.j - this.pos.j);
      if (d <= budget) {
        this.pos = { ...next };
        this.path.shift();
        budget -= d;
      } else {
        this.pos.i += ((next.i - this.pos.i) / d) * budget;
        this.pos.j += ((next.j - this.pos.j) / d) * budget;
        budget = 0;
      }
    }
    this.walking = this.path.length > 0;
    const arrived = !this.walking;
    const pose: Pose = arrived ? spot.pose : 'stand';
    for (const k of Object.keys(this.poses) as Pose[]) this.poses[k].visible = k === pose;
    const c = iso(this.pos.i, this.pos.j);
    const lift = arrived ? (spot.lift ?? 0) : 0;
    const bob = this.walking ? -Math.abs(Math.sin(this.time / 90)) * 3 : pose === 'work' ? Math.sin(this.time / 160) * 1.2 : 0;
    this.founder.position.set(c.x, c.y - lift + bob);
    this.founder.zIndex = arrived && spot.over ? spot.over + 2 : c.y + 2;
    const facing = this.path[0] ? Math.sign(iso(this.path[0].i, this.path[0].j).x - c.x) || 1 : 1;
    for (const k of ['stand', 'work'] as Pose[]) this.poses[k].scale.x = 1.35 * (this.walking ? facing : 1);
    this.setBubble(this.walking ? `🚶 ${act.label.replace(/^\S+\s/, '')}` : act.label);
    const sleeping = arrived && pose === 'lie';
    this.bubble.visible = !sleeping;
    this.bubble.position.set(sleeping ? -30 : 0, pose === 'sit' ? -72 : -78);
    this.zzz.visible = sleeping;
    if (sleeping) {
      this.zzz.position.set(-40 + Math.sin(this.time / 500) * 3, -48 - ((this.time / 25) % 14));
      this.zzz.alpha = 0.6 + Math.sin(this.time / 300) * 0.3;
    }
  }

  layout(): void {
    if (!this.ready) return;
    const { width, height } = this.app.screen;
    const worldW = 2 * N * A + 40;
    const worldH = 2 * N * B + WALL_H + 50;
    const s = Math.min(width / worldW, height / worldH);
    this.world.scale.set(s);
    this.world.position.set(width / 2, (height - worldH * s) / 2 + (WALL_H + 20) * s);
  }

  private boxSprites: Sprite[] = [];

  private clearBoxes(): void {
    for (const b of this.boxSprites) b.destroy();
    this.boxSprites = [];
  }

  update(game: GameState, dayProgress: number, dt: number): void {
    if (!this.ready) return;
    this.time += dt;

    // Stock boxes
    const boxCount = Math.min(Math.ceil(Object.values(game.products).reduce((a, p) => a + p.inventory.onHand, 0) / UNITS_PER_BOX), BOX_CAPACITY);
    if (boxCount !== this.shownBoxes) {
      // Growing stock drops new boxes in from above; shrinking just removes them.
      const keep = Math.min(boxCount, this.shownBoxes);
      this.clearBoxes();
      this.placeBoxesFrom(boxCount, keep);
    }
    for (const b of this.boxSprites) {
      const t = (b as Sprite & { dropTo?: number }).dropTo;
      if (t !== undefined) {
        b.position.y = Math.min(t, b.position.y + dt * 0.5);
        if (b.position.y >= t) (b as Sprite & { dropTo?: number }).dropTo = undefined;
      }
    }

    // Orders waiting on the packing table
    const waiting = Math.min(game.backlog.length, 5);
    if (this.orderBoxes.children.length !== waiting) {
      this.orderBoxes.removeChildren();
      const top = iso(TABLE_TOP.i, TABLE_TOP.j);
      for (let k = 0; k < waiting; k++) {
        const sp = new Sprite(this.tex['cardboardBoxOpen_SE']);
        sp.anchor.set(0.5, 1);
        sp.scale.set(SCALE * 0.55);
        sp.position.set(top.x - 26 + k * 13, top.y - TABLE_TOP.h + 10 + (k % 2) * 7);
        this.orderBoxes.addChild(sp);
      }
    }

    // Parcels fly out the window when orders ship
    if (this.lastShipped >= 0 && game.shipped > this.lastShipped) {
      const n = Math.min(6, game.shipped - this.lastShipped);
      for (let k = 0; k < n; k++) this.spawnFlyer(k * 180);
    }
    this.lastShipped = game.shipped;

    // New orders pop up over the laptop through the day
    if (game.day !== this.lastDay) {
      if (this.lastDay >= 0 && game.lastDayOrders > 0) {
        const n = Math.min(game.lastDayOrders, 12);
        this.pendingPopups = Array.from({ length: n }, () => Math.random() * 0.85).sort();
      }
      this.lastDay = game.day;
    }
    while (this.pendingPopups.length && this.pendingPopups[0] <= dayProgress) {
      this.pendingPopups.shift();
      this.spawnPopup('+1 order');
    }

    this.updateFx(dt);
    // Estimate game speed from how fast the clock moves (dayProgress resets each day).
    const dp = dayProgress - this.lastProgress;
    if (dt > 0 && dp >= 0) this.pace = this.pace * 0.9 + ((dp * DAY_MS) / dt) * 0.1;
    this.lastProgress = dayProgress;
    const h = clockHour(dayProgress);
    this.updateFounder(game, h, dt);
    const asleep = this.spotId === 'bed' && !this.walking;
    this.drawSky(h, h > 18.8 && !asleep);

    // Cat: curls up on the bed at night, sits in an open order box if there is one, else naps on the rug
    const onStack = boxCount >= 9;
    const bedtime = asleep || h < 7.4;
    const catSpot = bedtime ? iso(1.4, 4.42) : waiting > 0 ? iso(TABLE_TOP.i + 0.35, TABLE_TOP.j + 0.1) : onStack ? iso(4.41, 2.99) : iso(3.4, 1.7);
    const lift = bedtime ? 18 : waiting > 0 ? TABLE_TOP.h : onStack ? 3 * BOX_STEP + 6 : 0;
    this.cat.position.set(catSpot.x, catSpot.y - lift);
    this.cat.zIndex = bedtime ? BED_Z + 1 : catSpot.y + (waiting > 0 ? 80 : onStack ? 120 : 5);
    this.catTail.rotation = Math.sin(this.time / (bedtime ? 1200 : 400)) * 0.35 - 0.6;
  }

  private placeBoxesFrom(count: number, keep: number): void {
    for (let n = 0; n < count; n++) {
      const sl = SLOTS[n] as Slot & { level: number };
      const sp = new Sprite(this.tex['cardboardBoxClosed_SE']);
      sp.anchor.set(0.5, 1);
      sp.scale.set(SCALE * 0.95);
      const c = iso(sl.i, sl.j);
      const baseY = c.y + 0.32 * B - sl.lift - sl.level * BOX_STEP;
      sp.position.set(c.x, baseY);
      sp.zIndex = c.y + 0.32 * B + sl.level * 0.1 + sl.lift;
      if (n >= keep) {
        sp.position.y = baseY - 140 - (n - keep) * 10;
        (sp as Sprite & { dropTo?: number }).dropTo = baseY;
      }
      this.world.addChild(sp);
      this.boxSprites.push(sp);
    }
    this.shownBoxes = count;
  }

  private spawnFlyer(delay: number): void {
    const sp = new Sprite(this.tex['cardboardBoxClosed_SE']);
    sp.anchor.set(0.5, 0.5);
    sp.scale.set(SCALE * 0.45);
    const from = iso(TABLE_TOP.i, TABLE_TOP.j);
    const to = iso((WINDOW.i0 + WINDOW.i1) / 2, 0);
    sp.visible = false;
    this.fx.addChild(sp);
    this.flyers.push({ sprite: sp, t: -delay, from: { x: from.x, y: from.y - TABLE_TOP.h }, to: { x: to.x, y: to.y - (WINDOW.h0 + WINDOW.h1) / 2 } });
  }

  private spawnPopup(label: string): void {
    const t = new Text({ text: label, style: { fontFamily: 'Nunito', fontSize: 14, fontWeight: '800', fill: 0x1f9d55, stroke: { color: 0xffffff, width: 4 } } });
    t.anchor.set(0.5);
    const c = iso(LAPTOP.i, LAPTOP.j);
    t.position.set(c.x + (Math.random() - 0.5) * 30, c.y - 80);
    this.fx.addChild(t);
    this.popups.push({ text: t, t: 0 });
  }

  private updateFx(dt: number): void {
    for (const f of [...this.flyers]) {
      f.t += dt;
      if (f.t < 0) continue;
      const k = Math.min(1, f.t / 900);
      f.sprite.visible = true;
      f.sprite.position.set(f.from.x + (f.to.x - f.from.x) * k, f.from.y + (f.to.y - f.from.y) * k - Math.sin(k * Math.PI) * 60);
      f.sprite.rotation = k * 4;
      f.sprite.alpha = k > 0.85 ? (1 - k) / 0.15 : 1;
      if (k >= 1) {
        f.sprite.destroy();
        this.flyers = this.flyers.filter((x) => x !== f);
      }
    }
    for (const p of [...this.popups]) {
      p.t += dt;
      const k = p.t / 1400;
      p.text.position.y -= dt * 0.03;
      p.text.alpha = 1 - k;
      if (k >= 1) {
        p.text.destroy();
        this.popups = this.popups.filter((x) => x !== p);
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.ready) this.app.destroy(true, { children: true });
  }
}
