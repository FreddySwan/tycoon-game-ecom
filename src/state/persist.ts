import { dateLabel } from '../sim/calendar';
import type { GameState } from '../sim/types';

// Saves live in IndexedDB (no 5 MB localStorage cap), with localStorage as a fallback when IndexedDB is unavailable.
// Three slots; the active one autosaves, and each slot keeps the previous autosave as a backup.

export const SLOTS = ['slot1', 'slot2', 'slot3'] as const;
export type SlotId = (typeof SLOTS)[number];

export interface SaveMeta {
  slot: SlotId;
  brand: string;
  day: number;
  date: string;
  stage: number;
  cash: number;
  savedAt: number;
}

interface Record_ {
  meta: SaveMeta;
  json: string;
}

const DB = 'unboxed';
const STORE = 'saves';
const LEGACY_KEY = 'unboxed-save-v2';
const ACTIVE_KEY = 'unboxed-active-slot';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function db(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function put(key: string, value: Record_): Promise<void> {
  const d = await db();
  if (!d) {
    localStorage.setItem(`unboxed-${key}`, JSON.stringify(value));
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function get(key: string): Promise<Record_ | null> {
  const d = await db();
  if (!d) {
    const raw = localStorage.getItem(`unboxed-${key}`);
    return raw ? (JSON.parse(raw) as Record_) : null;
  }
  return new Promise((resolve) => {
    const req = d.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as Record_) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function del(key: string): Promise<void> {
  const d = await db();
  if (!d) {
    localStorage.removeItem(`unboxed-${key}`);
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function metaOf(slot: SlotId, s: GameState): SaveMeta {
  return { slot, brand: s.brands[0]?.name || 'Unnamed brand', day: s.day, date: dateLabel(s.day), stage: s.stage, cash: Math.round(s.cash), savedAt: Date.now() };
}

export function activeSlot(): SlotId {
  try {
    const v = localStorage.getItem(ACTIVE_KEY);
    return (SLOTS as readonly string[]).includes(v ?? '') ? (v as SlotId) : 'slot1';
  } catch {
    return 'slot1';
  }
}

export function setActiveSlot(slot: SlotId): void {
  try {
    localStorage.setItem(ACTIVE_KEY, slot);
  } catch {
    /* fine: defaults to slot 1 */
  }
}

/** Write a game to a slot. The previous save of that slot is kept as its backup once per game month. */
export async function writeSlot(slot: SlotId, s: GameState): Promise<void> {
  const prev = await get(slot);
  if (prev && Math.floor(prev.meta.day / 30) !== Math.floor(s.day / 30)) await put(`${slot}-backup`, prev);
  await put(slot, { meta: metaOf(slot, s), json: JSON.stringify(s) });
}

export async function readSlot(slot: SlotId, backup = false): Promise<GameState | null> {
  const r = await get(backup ? `${slot}-backup` : slot);
  return r ? (JSON.parse(r.json) as GameState) : null;
}

export async function deleteSlot(slot: SlotId): Promise<void> {
  await del(slot);
  await del(`${slot}-backup`);
}

export async function listSlots(): Promise<Record<SlotId, { main: SaveMeta | null; backup: SaveMeta | null }>> {
  const out = {} as Record<SlotId, { main: SaveMeta | null; backup: SaveMeta | null }>;
  for (const slot of SLOTS) out[slot] = { main: (await get(slot))?.meta ?? null, backup: (await get(`${slot}-backup`))?.meta ?? null };
  return out;
}

/** One-time move of the old localStorage save into slot 1 (it was close to the browser's size cap). */
export async function migrateLegacy(): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    if (!(await get('slot1'))) {
      const s = JSON.parse(raw) as GameState;
      await put('slot1', { meta: metaOf('slot1', s), json: raw });
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* keep the legacy save where it is */
  }
}

// ───────────────────────────── autosave ─────────────────────────────

let pending: GameState | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let onError: ((msg: string) => void) | null = null;

export function onSaveError(fn: (msg: string) => void): void {
  onError = fn;
}

/** Debounced autosave of the active slot. */
export function autosave(s: GameState): void {
  pending = s;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const g = pending;
    pending = null;
    if (!g) return;
    writeSlot(activeSlot(), g).catch((err) => onError?.(`Couldn’t save your game (${err instanceof Error ? err.message : 'storage error'}). Export a backup from the menu.`));
  }, 600);
}

/** Export as a downloadable .json file. */
export function exportGame(s: GameState): void {
  const blob = new Blob([JSON.stringify(s)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `unboxed-${(s.brands[0]?.name || 'save').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-day${s.day}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
