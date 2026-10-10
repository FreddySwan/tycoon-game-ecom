import { create } from 'zustand';
import * as E from '../sim/engine';
import type { GameState } from '../sim/types';
import { sfx } from './sound';

export type TabId = 'trends' | 'source' | 'store' | 'offer' | 'ads' | 'orders' | 'cash' | 'wall';
export type Modal =
  | { kind: 'unbox'; supplierId: string }
  | { kind: 'photo' }
  | { kind: 'pack'; orderId: number }
  | { kind: 'milestone'; text: string }
  | null;

export const DAY_MS = 20000;
const SAVE_KEY = 'unboxed-save-v1';

interface UIState {
  game: GameState;
  speed: 0 | 1 | 2 | 4;
  /** Progress through the current day, 0..1, for clocks and animations. */
  dayProgress: number;
  tab: TabId;
  modal: Modal;
  toast: string | null;
  muted: boolean;
  seenNotice: number;
  /** Milestones waiting for the current modal to close. */
  queued: string[];
  act: <A extends unknown[]>(fn: (s: GameState, ...args: A) => E.ActionResult | void, ...args: A) => E.ActionResult;
  tick: (ms: number) => void;
  setSpeed: (speed: 0 | 1 | 2 | 4) => void;
  skip: () => void;
  setTab: (tab: TabId) => void;
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
    return s.version === 1 ? s : null;
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

/** Apply day-advance side effects shared by ticking and skipping. */
function afterAdvance(prev: GameState, next: GameState, get: () => UIState, set: (p: Partial<UIState>) => void) {
  const fresh = next.notices.filter((n) => n.id > get().seenNotice);
  const pause = fresh.some((n) => n.pause) || E.isBlocked(next);
  const milestones = fresh.filter((n) => n.kind === 'milestone').map((n) => n.text);
  if (!get().muted) {
    if (milestones.length) sfx.fanfare();
    else if (next.lastDayOrders > 0) sfx.orders(Math.min(next.lastDayOrders, 8));
  }
  set({
    game: next,
    seenNotice: next.notices.length ? next.notices[next.notices.length - 1].id : get().seenNotice,
    speed: pause ? 0 : get().speed,
    ...showMilestones(get(), milestones),
  });
  if (next.day !== prev.day) save(next);
}

/** Show the first new milestone now if nothing else is open; queue the rest. */
function showMilestones(state: UIState, texts: string[]): Partial<UIState> {
  // The win gets its own end-of-run screen instead of a polaroid popup.
  texts = texts.filter((t) => t !== E.MILESTONE_LABELS.first_profitable_reorder);
  if (!texts.length) return {};
  const queue = [...state.queued, ...texts];
  if (state.modal) return { queued: queue };
  const [first, ...rest] = queue;
  return { modal: { kind: 'milestone', text: first }, queued: rest };
}

const initial = load() ?? E.createGame();

export const useGame = create<UIState>((set, get) => ({
  game: initial,
  speed: 0,
  dayProgress: 0,
  tab: 'trends',
  modal: null,
  toast: null,
  muted: false,
  seenNotice: initial.notices.length ? initial.notices[initial.notices.length - 1].id : 0,
  queued: [],

  act: (fn, ...args) => {
    const prev = get().game;
    const s = structuredClone(prev);
    const res = fn(s, ...args) ?? null;
    if (res) {
      set({ toast: res });
      return res;
    }
    const fresh = s.notices.filter((n) => n.id > get().seenNotice);
    const milestones = fresh.filter((n) => n.kind === 'milestone').map((n) => n.text);
    if (milestones.length && !get().muted) sfx.fanfare();
    set({
      game: s,
      seenNotice: s.notices.length ? s.notices[s.notices.length - 1].id : get().seenNotice,
      ...showMilestones(get(), milestones),
    });
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
    set({ dayProgress: 0 });
    afterAdvance(game, next, get, set);
  },

  setSpeed: (speed) => set({ speed }),

  skip: () => {
    const game = get().game;
    const next = structuredClone(game);
    E.skipToNextEvent(next);
    set({ dayProgress: 0 });
    afterAdvance(game, next, get, set);
  },

  setTab: (tab) => set({ tab }),
  setModal: (modal) => {
    const { queued } = get();
    if (!modal && queued.length) {
      const [first, ...rest] = queued;
      set({ modal: { kind: 'milestone', text: first }, queued: rest });
    } else set({ modal });
  },
  clearToast: () => set({ toast: null }),
  toggleMute: () => set({ muted: !get().muted }),
  newGame: () => {
    const g = E.createGame();
    save(g);
    set({ game: g, speed: 0, dayProgress: 0, tab: 'trends', modal: null, seenNotice: 0, queued: [] });
  },
}));
