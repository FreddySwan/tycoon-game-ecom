import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { storageCapacity, storageUsed } from '../sim/economics';
import type { GameState, SpaceId, TileId } from '../sim/types';

/** Half tile size of the isometric grid, in world pixels. */
const A = 30;
const B = 21;
const WALL_H = 78;
const SPRITE = 0.4;
const BASE = '/assets/furniture/';
const OFFICE_COLS = 4;

const iso = (i: number, j: number) => ({ x: (i - j) * A, y: (i + j) * B });

interface Style {
  floor: number;
  floorEdge: number;
  wallLeft: number;
  wallRight: number;
  trim: number;
  office: boolean;
  label: string;
}

const STYLES: Record<Exclude<SpaceId, 'apartment'>, Style> = {
  garage: { floor: 0xcfc8bd, floorEdge: 0x9c958a, wallLeft: 0xe6e9ee, wallRight: 0xd8dde4, trim: 0x8aa0b8, office: false, label: '' },
  warehouse: { floor: 0xd9d6cf, floorEdge: 0x8f8a80, wallLeft: 0xeef0f2, wallRight: 0xe1e5ea, trim: 0xf0a860, office: false, label: '' },
  hq: { floor: 0xdedbd4, floorEdge: 0x8f8a80, wallLeft: 0xf4f1ec, wallRight: 0xe7e3dc, trim: 0xf0a860, office: true, label: '' },
  campus: { floor: 0xe2e0da, floorEdge: 0x8f8a80, wallLeft: 0xf7f5f1, wallRight: 0xebe8e2, trim: 0x2b2d42, office: true, label: '' },
};

/** The garage has a fixed layout: shelving along the back, three packing tables. */
function garageLayout(): { w: number; h: number; cells: (TileId | null)[] } {
  const w = 7;
  const h = 6;
  const cells: (TileId | null)[] = Array(w * h).fill(null);
  for (let x = 0; x < 5; x++) cells[x] = 'rack';
  cells[1 * w + 0] = 'rack';
  cells[2 * w + 0] = 'rack';
  for (let x = 2; x < 5; x++) cells[3 * w + x] = 'station';
  return { w, h, cells };
}

interface Walker {
  body: Container;
  from: { x: number; y: number };
  to: { x: number; y: number };
  t: number;
  speed: number;
  home: { x: number; y: number };
  targets: { x: number; y: number }[];
}

interface Flyer {
  sprite: Graphics;
  t: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

function person(shirt: number, hair = 0x4a2f1b, skin = 0xf1c27d): Container {
  const c = new Container();
  const g = new Graphics();
  g.roundRect(-4, -20, 8, 12, 3).fill(shirt);
  g.rect(-3.5, -9, 3, 8).fill(0x34495e);
  g.rect(0.5, -9, 3, 8).fill(0x34495e);
  g.circle(0, -25, 4.8).fill(skin);
  g.ellipse(0, -28, 5, 2.8).fill(hair);
  c.addChild(g);
  return c;
}

const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const HAIRS = [0x4a2f1b, 0x1c1c1c, 0x9c6b3c, 0xd9a441, 0x6b3e26];

export class LayoutScene {
  app = new Application();
  world = new Container();
  private staticLayer = new Container();
  private dynamic = new Container();
  private fx = new Container();
  private tex: Record<string, Texture> = {};
  private key = '';
  private conveyors: Graphics[] = [];
  private robots: { g: Graphics; cx: number; cy: number; phase: number }[] = [];
  private walkers: Walker[] = [];
  private packers: Container[] = [];
  private flyers: Flyer[] = [];
  private popups: { text: Text; t: number }[] = [];
  private rackBoxes: Graphics[] = [];
  private cat = new Container();
  private catTail = new Graphics();
  private lastShipped = -1;
  private lastDay = -1;
  private pending: number[] = [];
  private perPopup = 1;
  private time = 0;
  private dims = { w: 1, h: 1, minI: 0 };
  private dock = { x: 0, y: 0 };
  private stations: { x: number; y: number; z: number }[] = [];
  private rackSpots: { x: number; y: number }[] = [];
  private screenPos = { x: 0, y: 0 };
  private ready = false;
  private destroyed = false;
  /** Set when the GPU context is lost; the host remounts the scene. */
  lost = false;

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({ backgroundAlpha: 0, antialias: true, resizeTo: host, autoDensity: true, resolution: window.devicePixelRatio || 1 });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    host.appendChild(this.app.canvas);
    this.app.canvas.addEventListener('webglcontextlost', () => (this.lost = true));
    const names = ['table_SE', 'desk_SE', 'computerScreen_SE', 'chairDesk_SW', 'laptop_SE', 'radio_SE', 'pottedPlant_SE', 'cardboardBoxClosed_SE', 'kitchenCoffeeMachine_SE', 'loungeSofa_SW', 'plantSmall1_SE'];
    await Promise.all(
      names.map(async (n) => {
        this.tex[n] = await Assets.load(`${BASE}${n}.png`);
      }),
    );
    // Replaced while loading: shut this renderer down and take its canvas with it.
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    this.world.sortableChildren = true;
    this.staticLayer.sortableChildren = true;
    this.dynamic.sortableChildren = true;
    this.world.addChild(this.staticLayer, this.dynamic, this.fx);
    this.staticLayer.zIndex = 0;
    this.dynamic.zIndex = 0;
    this.fx.zIndex = 1e7;
    this.app.stage.addChild(this.world);
    this.buildCat();
    this.ready = true;
  }

  private sprite(name: string, i: number, j: number, scale = SPRITE, dy = 0): Sprite {
    const s = new Sprite(this.tex[name]);
    s.anchor.set(0.5, 1);
    s.scale.set(scale);
    const p = iso(i + 0.5, j + 0.5);
    s.position.set(p.x, p.y + B * 0.55 + dy);
    s.zIndex = (i + j + 1) * 100 + 10;
    return s;
  }

  private box(g: Graphics, i: number, j: number, w: number, d: number, h: number, top: number, left: number, right: number, lift = 0): void {
    const p = (a: number, b: number, z: number) => {
      const v = iso(a, b);
      return [v.x, v.y - z - lift];
    };
    g.poly([...p(i, j + d, 0), ...p(i + w, j + d, 0), ...p(i + w, j + d, h), ...p(i, j + d, h)]).fill(left);
    g.poly([...p(i + w, j, 0), ...p(i + w, j + d, 0), ...p(i + w, j + d, h), ...p(i + w, j, h)]).fill(right);
    g.poly([...p(i, j, h), ...p(i + w, j, h), ...p(i + w, j + d, h), ...p(i, j + d, h)]).fill(top);
  }

  private keyFor(game: GameState): string {
    const cells = game.space === 'garage' ? 'garage' : game.layout.cells.map((c) => (c ? c[0] : '.')).join('');
    const office = ['support', 'marketer', 'buyer', 'designer', 'brandmgr'].reduce((a, r) => a + game.team[r as 'support'].count, 0);
    return `${game.space}|${cells}|${Math.min(office, 32)}|${game.brands[0].name}|${Object.keys(game.regions).length}`;
  }

  private rebuild(game: GameState): void {
    const space = game.space as Exclude<SpaceId, 'apartment'>;
    const st = STYLES[space];
    const layout = space === 'garage' ? garageLayout() : game.layout;
    const { w, h, cells } = layout;
    const minI = st.office ? -OFFICE_COLS : 0;
    this.dims = { w, h, minI };
    for (const c of [...this.staticLayer.children]) c.destroy({ children: true });
    this.staticLayer.removeChildren();
    this.conveyors = [];
    this.robots = [];
    this.rackBoxes = [];
    this.stations = [];
    this.rackSpots = [];

    // Floor, walls
    const shell = new Graphics();
    const p = (i: number, j: number, z = 0) => {
      const v = iso(i, j);
      return [v.x, v.y - z];
    };
    shell.poly([...p(w, 0), ...p(w, h), ...p(minI, h), ...p(minI, h, -10), ...p(w, h, -10), ...p(w, 0, -10)]).fill(st.floorEdge);
    shell.poly([...p(minI, 0), ...p(w, 0), ...p(w, h), ...p(minI, h)]).fill(st.floor);
    if (st.office) shell.poly([...p(minI, 0), ...p(0, 0), ...p(0, h), ...p(minI, h)]).fill(0xb7c7d8);
    // Safety lines around the working floor
    if (space !== 'garage') {
      shell.poly([...p(0.05, 0.05), ...p(w - 0.05, 0.05), ...p(w - 0.05, h - 0.05), ...p(0.05, h - 0.05)]).stroke({ width: 2, color: 0xf2c94c, alpha: 0.8 });
      for (let k = 1; k < w; k++) shell.moveTo(...(p(k, 0) as [number, number])).lineTo(...(p(k, h) as [number, number]));
      for (let k = 1; k < h; k++) shell.moveTo(...(p(0, k) as [number, number])).lineTo(...(p(w, k) as [number, number]));
      shell.stroke({ width: 1, color: 0xc9c4ba, alpha: 0.5 });
    }
    shell.poly([...p(minI, 0), ...p(minI, h), ...p(minI, h, WALL_H), ...p(minI, 0, WALL_H)]).fill(st.wallLeft);
    shell.poly([...p(minI, 0), ...p(w, 0), ...p(w, 0, WALL_H), ...p(minI, 0, WALL_H)]).fill(st.wallRight);
    shell.poly([...p(minI, h, WALL_H), ...p(minI, 0, WALL_H), ...p(w, 0, WALL_H), ...p(w, 0, WALL_H + 4), ...p(minI, 0, WALL_H + 4), ...p(minI, h, WALL_H + 4)]).fill(st.trim);
    // High windows along the back
    for (let k = minI + 1; k < w - 1; k += 2) {
      shell.poly([...p(k, 0, WALL_H - 26), ...p(k + 1.2, 0, WALL_H - 26), ...p(k + 1.2, 0, WALL_H - 10), ...p(k, 0, WALL_H - 10)]).fill(0xbfe3ff).stroke({ width: 2, color: 0xffffff });
    }
    if (space === 'garage') {
      // Roll-up door
      const d0 = w - 2.2;
      shell.poly([...p(d0, 0, 0), ...p(d0 + 1.8, 0, 0), ...p(d0 + 1.8, 0, 50), ...p(d0, 0, 50)]).fill(0xaab4c0);
      for (let z = 5; z < 50; z += 6) shell.moveTo(...(p(d0, 0, z) as [number, number])).lineTo(...(p(d0 + 1.8, 0, z) as [number, number]));
      shell.stroke({ width: 1, color: 0x8794a3 });
    }
    shell.zIndex = -1e6;
    this.staticLayer.addChild(shell);

    // Brand banner / war room screens
    if (st.office) {
      const screens = new Graphics();
      for (let k = 0; k < 3; k++) {
        const j0 = 0.6 + k * 1.2;
        screens.poly([...p(minI, j0, 34), ...p(minI, j0 + 1, 34), ...p(minI, j0 + 1, 60), ...p(minI, j0, 60)]).fill(0x1f2033);
        const pts: number[] = [];
        for (let t = 0; t <= 6; t++) {
          const jj = j0 + 0.08 + (t / 6) * 0.84;
          const z = 38 + ((t * 37 + k * 11) % 17) + t * 1.5;
          pts.push(...p(minI, jj, z));
        }
        screens.poly(pts, false).stroke({ width: 1.5, color: [0x7fd1ae, 0xf0a860, 0x7fb3ff][k] });
      }
      screens.zIndex = -9e5;
      this.staticLayer.addChild(screens);
    }
    if (game.brands[0].name && space !== 'garage') {
      const label = new Text({ text: game.brands[0].name.toUpperCase(), style: { fontFamily: 'Nunito', fontSize: 16, fontWeight: '800', fill: space === 'campus' ? 0xf0a860 : 0x2b2d42, letterSpacing: 2 } });
      const v = iso((w + minI) / 2 + 1.5, 0);
      label.anchor.set(0.5);
      label.position.set(v.x, v.y - WALL_H + 34);
      label.skew.set(0, Math.atan2(B, A));
      label.zIndex = -8e5;
      this.staticLayer.addChild(label);
    }

    // Tiles
    cells.forEach((c, idx) => {
      const i = idx % w;
      const j = Math.floor(idx / w);
      const g = new Graphics();
      g.zIndex = (i + j + 1) * 100;
      if (c === 'rack') {
        // Uprights + three shelves; boxes are drawn dynamically from stock levels.
        this.box(g, i + 0.1, j + 0.15, 0.8, 0.7, 2, 0xe0782d, 0xc75f1a, 0xd96c22);
        for (const z of [0, 18, 36]) this.box(g, i + 0.08, j + 0.13, 0.84, 0.74, 3, 0x9aa4ae, 0x7d8790, 0x8b959e, z);
        this.box(g, i + 0.1, j + 0.15, 0.06, 0.06, 54, 0xe0782d, 0xc75f1a, 0xd96c22);
        this.box(g, i + 0.84, j + 0.15, 0.06, 0.06, 54, 0xe0782d, 0xc75f1a, 0xd96c22);
        this.box(g, i + 0.1, j + 0.79, 0.06, 0.06, 54, 0xe0782d, 0xc75f1a, 0xd96c22);
        this.box(g, i + 0.84, j + 0.79, 0.06, 0.06, 54, 0xe0782d, 0xc75f1a, 0xd96c22);
        const boxes = new Graphics();
        boxes.zIndex = g.zIndex + 1;
        (boxes as Graphics & { cell?: [number, number] }).cell = [i, j];
        this.rackBoxes.push(boxes);
        this.staticLayer.addChild(g, boxes);
        const spot = iso(i + 0.5, j + 1.1);
        this.rackSpots.push({ x: spot.x, y: spot.y });
        return;
      }
      if (c === 'station') {
        const t = this.sprite('table_SE', i, j, SPRITE * 0.85);
        this.staticLayer.addChild(t);
        const lap = this.sprite('laptop_SE', i, j, SPRITE * 0.8, -20);
        lap.zIndex = t.zIndex + 2;
        this.staticLayer.addChild(lap);
        const front = iso(i + 0.5, j + 1.05);
        this.stations.push({ x: front.x, y: front.y, z: (i + j + 2) * 100 + 5 });
        return;
      }
      if (c === 'conveyor') {
        this.box(g, i, j + 0.25, 1, 0.5, 8, 0x3b3f4a, 0x2b2e36, 0x33363f);
        const belt = new Graphics();
        belt.zIndex = g.zIndex + 1;
        (belt as Graphics & { cell?: [number, number] }).cell = [i, j];
        this.conveyors.push(belt);
        this.staticLayer.addChild(g, belt);
        return;
      }
      if (c === 'robot') {
        this.box(g, i + 0.15, j + 0.15, 0.7, 0.7, 1, 0x7fd1ae, 0x5fb08e, 0x6cc09e);
        this.staticLayer.addChild(g);
        const bot = new Graphics();
        const center = iso(i + 0.5, j + 0.5);
        this.robots.push({ g: bot, cx: center.x, cy: center.y, phase: Math.random() * 6 });
        bot.zIndex = g.zIndex + 50;
        this.staticLayer.addChild(bot);
      }
    });

    // Dock + truck at the front
    const dockI = space === 'garage' ? w - 1.5 : Math.floor(w / 2);
    const truck = new Graphics();
    this.box(truck, dockI - 0.1, h + 0.25, 1.4, 2.4, 34, 0xffffff, 0xdfe3e8, 0xeef1f4);
    this.box(truck, dockI + 0.1, h + 2.65, 1.0, 0.8, 24, 0xf0a860, 0xd48a43, 0xe39a52);
    truck.zIndex = (dockI + h + 4) * 100;
    this.staticLayer.addChild(truck);
    const dv = iso(dockI + 0.6, h + 0.6);
    this.dock = { x: dv.x, y: dv.y - 30 };

    // Office desks (HQ & campus), garage desk
    const officeStaff = ['support', 'marketer', 'buyer', 'designer', 'brandmgr'].reduce((a, r) => a + game.team[r as 'support'].count, 0);
    if (st.office) {
      const desks = Math.max(6, Math.min(32, officeStaff + 2));
      let k = 0;
      for (let j = 0; j < h - 1 && k < desks; j += 1) {
        for (let i = minI + 0.3; i < -0.6 && k < desks; i += 1.3) {
          const d = this.sprite('desk_SE', i, j, SPRITE * 0.8);
          const scr = this.sprite('computerScreen_SE', i, j, SPRITE * 0.75, -18);
          scr.zIndex = d.zIndex + 2;
          this.staticLayer.addChild(d, scr);
          if (k < officeStaff) {
            const who = person([0x3a7bd5, 0xc2477a, 0x7b5cd6, 0x2f8f83][k % 4], HAIRS[k % 5], SKINS[k % 5]);
            const pos = iso(i + 0.5, j + 1.0);
            who.position.set(pos.x, pos.y);
            who.zIndex = d.zIndex + 30;
            who.scale.set(0.95);
            this.staticLayer.addChild(who);
          }
          k++;
        }
      }
      const plant = this.sprite('pottedPlant_SE', minI, h - 1, SPRITE * 1.2);
      const coffee = this.sprite('kitchenCoffeeMachine_SE', minI + 0.1, 0, SPRITE);
      this.staticLayer.addChild(plant, coffee);
      if (space === 'campus') this.staticLayer.addChild(this.sprite('loungeSofa_SW', minI + 1.5, h - 1, SPRITE * 0.9));
      const sv = iso(minI, 2);
      this.screenPos = { x: sv.x, y: sv.y - 70 };
    } else {
      const desk = this.sprite('desk_SE', w - 3.2, 0, SPRITE);
      const lap = this.sprite('laptop_SE', w - 3.2, 0, SPRITE * 0.9, -26);
      lap.zIndex = desk.zIndex + 2;
      const radio = this.sprite('radio_SE', 4.1, 0.1, SPRITE, -56);
      radio.zIndex = 1e4;
      this.staticLayer.addChild(desk, lap, radio, this.sprite('pottedPlant_SE', w - 1, h - 1, SPRITE * 1.2));
      const sv = iso(w - 2.7, 0.5);
      this.screenPos = { x: sv.x, y: sv.y - 50 };
    }

    this.layout();
  }

  private buildCat(): void {
    const g = new Graphics();
    g.ellipse(0, -5, 7, 5).fill(0xe8944a);
    g.circle(6, -10, 4.2).fill(0xe8944a);
    g.poly([2.5, -13, 4, -18, 6, -13.5]).fill(0xe8944a);
    g.poly([6.5, -13.5, 9, -18, 9.5, -12]).fill(0xe8944a);
    g.circle(7.3, -10.5, 0.8).fill(0x2b2b2b);
    g.circle(4.8, -10.5, 0.8).fill(0x2b2b2b);
    this.catTail.roundRect(-1.5, -10, 2.2, 10, 1).fill(0xe8944a);
    this.catTail.position.set(-6, -3);
    this.cat.addChild(this.catTail, g);
    this.dynamic.addChild(this.cat);
  }

  layout(): void {
    if (!this.ready) return;
    const { width, height } = this.app.screen;
    const { w, h, minI } = this.dims;
    const left = iso(minI, h).x;
    const right = iso(w, 0).x;
    const top = iso(minI, 0).y - WALL_H - 10;
    const bottom = iso(w + 1.5, h + 4).y + 10;
    const s = Math.min(width / (right - left + 40), height / (bottom - top));
    this.world.scale.set(s);
    this.world.position.set(width / 2 - ((left + right) / 2) * s, (height - (bottom - top) * s) / 2 - top * s);
  }

  update(game: GameState, dayProgress: number, dt: number): void {
    if (!this.ready || game.space === 'apartment') return;
    this.time += dt;
    const key = this.keyFor(game);
    if (key !== this.key) {
      this.key = key;
      this.rebuild(game);
      this.syncWorkers(game, true);
    } else this.syncWorkers(game, false);

    // Rack fill follows storage use.
    const cap = storageCapacity(game);
    const fill = cap === Infinity ? 0.3 : Math.min(1, storageUsed(game) / Math.max(1, cap));
    const slotsPerRack = 6;
    const filled = Math.round(fill * this.rackBoxes.length * slotsPerRack);
    this.rackBoxes.forEach((g, r) => {
      const n = Math.max(0, Math.min(slotsPerRack, filled - r * slotsPerRack));
      if ((g as Graphics & { n?: number }).n === n) return;
      (g as Graphics & { n?: number }).n = n;
      g.clear();
      const [i, j] = (g as Graphics & { cell?: [number, number] }).cell!;
      for (let k = 0; k < n; k++) {
        const shelf = Math.floor(k / 2);
        const side = k % 2;
        this.box(g, i + 0.16 + side * 0.36, j + 0.25, 0.3, 0.45, 12, 0xd9a066, 0xb98149, 0xc98f55, 3 + shelf * 18);
      }
    });

    // Conveyor stripes and robots
    for (const belt of this.conveyors) {
      belt.clear();
      const [i, j] = (belt as Graphics & { cell?: [number, number] }).cell!;
      const off = ((this.time / 600) % 1) * 0.25;
      for (let k = 0; k < 4; k++) {
        const a = i + off + k * 0.25;
        if (a > i + 0.95) continue;
        const p1 = iso(a, j + 0.3);
        const p2 = iso(a, j + 0.7);
        belt.moveTo(p1.x, p1.y - 8).lineTo(p2.x, p2.y - 8);
      }
      belt.stroke({ width: 1.5, color: 0x6b707c });
    }
    for (const r of this.robots) {
      r.g.clear();
      const a = this.time / 700 + r.phase;
      r.g.ellipse(0, 0, 7, 4.5).fill(0x2b2d42);
      r.g.roundRect(-5, -9, 10, 7, 3).fill(0x7fd1ae);
      r.g.circle(0, -11, 1.6).fill(0xf0a860);
      r.g.position.set(r.cx + Math.cos(a) * 12, r.cy + Math.sin(a) * 7);
    }

    // Packers bob at their stations; pickers walk between racks and stations.
    this.packers.forEach((p, k) => (p.position.y = this.stations[k % Math.max(1, this.stations.length)].y + Math.sin(this.time / 170 + k) * 1));
    for (const wk of this.walkers) {
      wk.t += (dt / 1000) * wk.speed;
      if (wk.t >= 1) {
        wk.t = 0;
        wk.from = wk.to;
        wk.to = wk.targets[Math.floor(Math.random() * wk.targets.length)] ?? wk.home;
      }
      const k = wk.t;
      wk.body.position.set(wk.from.x + (wk.to.x - wk.from.x) * k, wk.from.y + (wk.to.y - wk.from.y) * k + Math.abs(Math.sin(k * Math.PI * 6)) * -1.2);
      wk.body.zIndex = Math.round((wk.body.position.y / B) * 50) + 60;
    }

    // Parcels go out to the truck when orders ship.
    if (this.lastShipped >= 0 && game.shipped > this.lastShipped && this.stations.length) {
      const n = Math.min(8, game.shipped - this.lastShipped);
      for (let k = 0; k < n; k++) this.spawnFlyer(k * 140);
    }
    this.lastShipped = game.shipped;

    if (game.day !== this.lastDay) {
      if (this.lastDay >= 0 && game.lastDayOrders > 0) {
        const n = Math.min(10, Math.ceil(game.lastDayOrders / Math.max(1, Math.ceil(game.lastDayOrders / 10))));
        this.perPopup = Math.ceil(game.lastDayOrders / n);
        this.pending = Array.from({ length: n }, () => Math.random() * 0.85).sort();
      }
      this.lastDay = game.day;
    }
    while (this.pending.length && this.pending[0] <= dayProgress) {
      this.pending.shift();
      this.spawnPopup(this.perPopup > 1 ? `+${this.perPopup} orders` : '+1 order');
    }
    this.updateFx(dt);

    // The cat naps on the fullest rack (or the desk).
    const spot = this.rackSpots[0] ?? this.screenPos;
    this.cat.position.set(spot.x + 6, spot.y - (this.rackSpots.length ? 62 : 10));
    this.cat.zIndex = 1e6;
    this.catTail.rotation = Math.sin(this.time / 450) * 0.35 - 0.6;
  }

  private syncWorkers(game: GameState, force: boolean): void {
    // In the garage the founder still packs at a free table when orders are waiting.
    const founderPacks = game.space === 'garage' && !game.thirdParty && game.backlog.length > 0 && game.team.packer.count < this.stations.length;
    const packerCount = game.thirdParty ? 0 : Math.min(game.team.packer.count + (founderPacks ? 1 : 0), this.stations.length);
    const pickers = game.thirdParty ? 0 : Math.min(18, Math.max(0, game.team.packer.count - packerCount) + game.team.lead.count + (game.space === 'garage' && !founderPacks ? 1 : 0));
    if (!force && this.packers.length === packerCount && this.walkers.length === pickers) return;
    for (const p of this.packers) p.destroy({ children: true });
    for (const wk of this.walkers) wk.body.destroy({ children: true });
    this.packers = [];
    this.walkers = [];
    for (let k = 0; k < packerCount; k++) {
      const st = this.stations[k];
      const isFounder = founderPacks && k === packerCount - 1;
      const who = person(isFounder ? 0x2f8f83 : 0xf0a860, HAIRS[k % 5], SKINS[(k + 2) % 5]);
      who.position.set(st.x, st.y);
      who.zIndex = st.z + 40;
      this.dynamic.addChild(who);
      this.packers.push(who);
    }
    const targets = [...this.rackSpots, ...this.stations.map((s) => ({ x: s.x, y: s.y }))];
    for (let k = 0; k < pickers; k++) {
      const lead = k < game.team.lead.count;
      const founder = game.space === 'garage' && k === pickers - 1;
      const who = person(lead ? 0xf2c94c : founder ? 0x2f8f83 : 0xf0a860, HAIRS[(k + 1) % 5], SKINS[(k + 3) % 5]);
      const home = targets[k % Math.max(1, targets.length)] ?? { x: 0, y: 0 };
      this.dynamic.addChild(who);
      this.walkers.push({ body: who, from: home, to: targets[(k + 3) % Math.max(1, targets.length)] ?? home, t: Math.random(), speed: 0.25 + Math.random() * 0.2, home, targets });
    }
  }

  private spawnFlyer(delay: number): void {
    const st = this.stations[Math.floor(Math.random() * this.stations.length)];
    const g = new Graphics();
    g.rect(-4, -4, 8, 7).fill(0xd9a066).stroke({ width: 1, color: 0xb98149 });
    g.visible = false;
    this.fx.addChild(g);
    this.flyers.push({ sprite: g, t: -delay, from: { x: st.x, y: st.y - 22 }, to: this.dock });
  }

  private spawnPopup(label: string): void {
    const t = new Text({ text: label, style: { fontFamily: 'Nunito', fontSize: 13, fontWeight: '800', fill: 0x1f9d55, stroke: { color: 0xffffff, width: 4 } } });
    t.anchor.set(0.5);
    t.position.set(this.screenPos.x + (Math.random() - 0.5) * 40, this.screenPos.y);
    this.fx.addChild(t);
    this.popups.push({ text: t, t: 0 });
  }

  private updateFx(dt: number): void {
    for (const f of [...this.flyers]) {
      f.t += dt;
      if (f.t < 0) continue;
      const k = Math.min(1, f.t / 1100);
      f.sprite.visible = true;
      f.sprite.position.set(f.from.x + (f.to.x - f.from.x) * k, f.from.y + (f.to.y - f.from.y) * k - Math.sin(k * Math.PI) * 40);
      f.sprite.alpha = k > 0.85 ? (1 - k) / 0.15 : 1;
      if (k >= 1) {
        f.sprite.destroy();
        this.flyers = this.flyers.filter((x) => x !== f);
      }
    }
    for (const p of [...this.popups]) {
      p.t += dt;
      const k = p.t / 1400;
      p.text.position.y -= dt * 0.025;
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
