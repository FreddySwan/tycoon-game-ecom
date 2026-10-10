import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { GameState } from '../sim/types';

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
  // Kitchen table = packing station
  { tex: 'table_SE', i: 2.2, j: 2.75, fi: 1.25, fj: 0.72 },
];

const RUG: Placement = { tex: 'rugRectangle_SE', i: 3.55, j: 1.65, fi: 2.0, fj: 1.7 };
const CHAIR: Placement = { tex: 'chairDesk_SW', i: 1.25, j: 0.85, fi: 0.43, fj: 0.43 };
const LAPTOP: Placement = { tex: 'laptop_SE', i: 1.15, j: 0.25, fi: 0.4, fj: 0.32, dy: -46 };
const TABLE_TOP = { i: 2.2, j: 2.75, h: 40 };
const WINDOW = { i0: 2.45, i1: 3.45, h0: 38, h1: 88 };

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
    this.drawSky(0.3);
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
    this.fx.zIndex = 100000;
    this.world.addChild(this.fx);
    this.world.sortableChildren = true;
  }

  private drawSky(progress: number): void {
    // morning blue → midday → golden → dusk
    const stops = [0x9fd3f5, 0xb9e3ff, 0xffc98a, 0x6b6fa8];
    const idx = Math.min(stops.length - 1, Math.floor(progress * stops.length));
    const p = (i: number, h: number) => {
      const v = iso(i, 0);
      return [v.x, v.y - h];
    };
    this.sky.clear();
    this.sky.poly([...p(WINDOW.i0, WINDOW.h0), ...p(WINDOW.i1, WINDOW.h0), ...p(WINDOW.i1, WINDOW.h1), ...p(WINDOW.i0, WINDOW.h1)]).fill(stops[idx]);
    this.lampGlow.clear();
    if (progress > 0.72) {
      const c = iso(2.15, 0.2);
      this.lampGlow.ellipse(c.x, c.y - 4, 80, 46).fill({ color: 0xffe2a8, alpha: 0.25 });
    }
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
    const g = new Graphics();
    g.roundRect(-6, -30, 12, 18, 4).fill(0x2f8f83); // shirt
    g.rect(-5, -13, 4, 12).fill(0x34495e);
    g.rect(1, -13, 4, 12).fill(0x34495e);
    g.circle(0, -37, 7).fill(0xf1c27d); // head
    g.ellipse(0, -41, 7.5, 4).fill(0x4a2f1b); // hair
    g.scale.set(1.35);
    this.founder.addChild(g);
    this.world.addChild(this.founder);
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
    this.drawSky(dayProgress);

    // Cat: sits in an open order box on the table if there is one, else naps on the rug
    const onStack = boxCount >= 9;
    const catSpot = waiting > 0 ? iso(TABLE_TOP.i + 0.35, TABLE_TOP.j + 0.1) : onStack ? iso(4.41, 2.99) : iso(3.4, 1.7);
    const lift = waiting > 0 ? TABLE_TOP.h : onStack ? 3 * BOX_STEP + 6 : 0;
    this.cat.position.set(catSpot.x, catSpot.y - lift);
    this.cat.zIndex = catSpot.y + (waiting > 0 ? 80 : onStack ? 120 : 5);
    this.catTail.rotation = Math.sin(this.time / 400) * 0.35 - 0.6;

    // Founder: at the packing table when orders wait, otherwise at the desk
    const atTable = game.backlog.length > 0;
    const spot = atTable ? iso(2.05, 3.5) : iso(1.95, 0.95);
    this.founder.position.set(spot.x, spot.y + (atTable ? Math.sin(this.time / 160) * 1.2 : 0));
    this.founder.zIndex = spot.y + (atTable ? 40 : 2);
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
