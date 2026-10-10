import { create } from 'zustand';
import * as E from '../sim/engine';
import type { GameState } from '../sim/types';
import { sfx } from './sound';

export type TabId =
  | 'products'
  | 'source'
  | 'store'
  | 'offer'
  | 'ads'
  | 'channels'
  | 'ops'
  | 'team'
  | 'inbox'
  | 'customers'
  | 'finance'
  | 'company'
  | 'wall';

export type Modal =
  | { kind: 'unbox'; productId: string; supplierId: string }
  | { kind: 'photo'; productId: string }
  | { kind: 'scan'; productId: string }
  | { kind: 'dig'; productId: string }
  | { kind: 'quiz'; productId: string }
  | { kind: 'pack' }
  | { kind: 'milestone'; text: string }
  | { kind: 'report' }
  | null;

export type Speed = 0 | 1 | 2 | 4 | 8;

export const DAY_MS = 20000;
const SAVE_KEY = 'unboxed-save-v2';

interface UIState {
  game: GameState;
  speed: Speed;
  dayProgress: number;
  tab: TabId;
  product: string | null;
  brand: number;
  modal: Modal;
  toast: string | null;
  muted: boolean;
  seenNotice: number;
  queued: Modal[];
  act: <A extends unknown[]>(fn: (s: GameState, ...args: A) => E.ActionResult | void, ...args: A) => E.ActionResult;
  tick: (ms: number) => void;
  setSpeed: (speed: Speed) => void;
  skip: () => void;
  setTab: (tab: TabId) => void;
  setProduct: (pid: string) => void;
  setBrand: (id: number) => void;
  setModal: (m: Modal) => void;
  clearToast: () => void;
  toggleMute: () => void;
  newGame: () => void;
}

function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s.version === 2 ? E.migrate(s) : null;
  } catch {
    return null;
  }
}

function save(s: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: play on without saving */
  }
}

/** Turn fresh notices into modals (milestones, month reports), queueing them if something is open. */
function modalsFor(state: UIState, next: GameState): Partial<UIState> {
  const fresh = next.notices.filter((n) => n.id > state.seenNotice);
  const wanted: Modal[] = [];
  for (const n of fresh) {
    const quiet = n.text === E.MILESTONE_LABELS.first_profitable_reorder || n.text === 'Ambition achieved!';
    if (n.kind === 'milestone' && !quiet) wanted.push({ kind: 'milestone', text: n.text });
    if (n.text.startsWith('📊 Month') && n.pause) wanted.push({ kind: 'report' });
  }
  const seen = next.notices.length ? next.notices[next.notices.length - 1].id : state.seenNotice;
  if (!wanted.length) return { seenNotice: seen };
  if (!state.muted && wanted.some((m) => m?.kind === 'milestone')) sfx.fanfare();
  const queue = [...state.queued, ...wanted];
  if (state.modal) return { queued: queue, seenNotice: seen };
  const [first, ...rest] = queue;
  return { modal: first, queued: rest, seenNotice: seen };
}

function firstLive(s: GameState): string | null {
  return s.productOrder.find((id) => s.products[id] && !s.products[id].retired) ?? null;
}

const initial = load() ?? E.createGame();

export const useGame = create<UIState>((set, get) => ({
  game: initial,
  speed: 0,
  dayProgress: 0,
  tab: 'products',
  product: firstLive(initial),
  brand: initial.brands[0].id,
  modal: null,
  toast: null,
  muted: false,
  seenNotice: initial.notices.length ? initial.notices[initial.notices.length - 1].id : 0,
  queued: [],

  act: (fn, ...args) => {
    const s = structuredClone(get().game);
    const res = fn(s, ...args) ?? null;
    if (res) {
      set({ toast: res });
      return res;
    }
    const current = get().product;
    const product = current && s.products[current] && !s.products[current].retired ? current : firstLive(s);
    set({ game: s, product, ...modalsFor(get(), s) });
    save(s);
    return null;
  },

  tick: (ms) => {
    const { speed, dayProgress, game } = get();
    if (!speed || E.isBlocked(game) || get().modal) return;
    const p = dayProgress + (ms * speed) / DAY_MS;
    if (p < 1) {
      set({ dayProgress: p });
      return;
    }
    const next = structuredClone(game);
    E.advanceDay(next);
    advanced(game, next);
  },

  setSpeed: (speed) => set({ speed }),

  skip: () => {
    const game = get().game;
    const next = structuredClone(game);
    E.skipToNextEvent(next);
    advanced(game, next);
  },

  setTab: (tab) => set({ tab }),
  setProduct: (product) => set({ product }),
  setBrand: (brand) => set({ brand }),
  setModal: (modal) => {
    const { queued } = get();
    if (!modal && queued.length) {
      const [first, ...rest] = queued;
      set({ modal: first, queued: rest });
    } else set({ modal });
  },
  clearToast: () => set({ toast: null }),
  toggleMute: () => set({ muted: !get().muted }),
  newGame: () => {
    const g = E.createGame();
    save(g);
    set({ game: g, speed: 0, dayProgress: 0, tab: 'products', modal: null, seenNotice: 0, queued: [], product: null, brand: g.brands[0].id });
  },
}));

function advanced(prev: GameState, next: GameState) {
  const state = useGame.getState();
  const fresh = next.notices.filter((n) => n.id > state.seenNotice);
  const pause = fresh.some((n) => n.pause) || E.isBlocked(next);
  if (!state.muted && next.lastDayOrders > 0 && !fresh.some((n) => n.kind === 'milestone')) sfx.orders(Math.min(next.lastDayOrders, 8));
  const product = state.product && next.products[state.product] && !next.products[state.product].retired ? state.product : firstLive(next);
  useGame.setState({ game: next, product, dayProgress: 0, speed: pause ? 0 : state.speed, ...modalsFor(state, next) });
  if (next.day !== prev.day) save(next);
}
