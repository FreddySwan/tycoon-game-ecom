import { useEffect, useState } from 'react';
import * as E from '../sim/engine';
import type { GameState } from '../sim/types';
import { activeSlot, deleteSlot, exportGame, listSlots, readSlot, type SaveMeta, setActiveSlot, SLOTS, type SlotId, writeSlot } from '../state/persist';
import { useGame } from '../state/store';
import { money } from './format';
import { Icon } from './icons';

type Slots = Awaited<ReturnType<typeof listSlots>>;

function when(t: number): string {
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return new Date(t).toLocaleDateString();
}

/** Save slots: load, save, restore a backup, delete, export and import. */
export function SavesModal() {
  const game = useGame((s) => s.game);
  const setModal = useGame((s) => s.setModal);
  const hydrate = useGame((s) => s.hydrate);
  const replaceGame = useGame((s) => s.replaceGame);
  const saveError = useGame((s) => s.saveError);
  const [slots, setSlots] = useState<Slots | null>(null);
  const [active, setActive] = useState<SlotId>(activeSlot());
  const [note, setNote] = useState<string | null>(null);
  const refresh = () => listSlots().then(setSlots);
  useEffect(() => {
    void refresh();
  }, []);

  const load = async (slot: SlotId, backup = false) => {
    const s = await readSlot(slot, backup);
    if (!s) return setNote('That save is empty.');
    setActiveSlot(slot);
    setActive(slot);
    hydrate(E.migrate(s));
    if (backup) await writeSlot(slot, s);
    setModal(null);
  };
  const saveHere = async (slot: SlotId) => {
    await writeSlot(slot, game);
    setActiveSlot(slot);
    setActive(slot);
    setNote(`Saved to ${slot.replace('slot', 'slot ')}. It’s now your active slot.`);
    void refresh();
  };
  const remove = async (slot: SlotId) => {
    if (!confirm('Delete this save and its backup?')) return;
    await deleteSlot(slot);
    void refresh();
  };
  const importFile = async (file: File) => {
    try {
      const s = JSON.parse(await file.text()) as GameState;
      if (s.version !== 2 || !s.brands) throw new Error('not an Unboxed save');
      replaceGame(E.migrate(s));
      setModal(null);
    } catch (err) {
      setNote(`Couldn’t import that file: ${err instanceof Error ? err.message : 'unknown error'}.`);
    }
  };

  const row = (m: SaveMeta) => (
    <span className="tiny muted">
      {m.brand} · {m.date} · stage {m.stage} · {money(m.cash)} · saved {when(m.savedAt)}
    </span>
  );

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
      <div className="modal" style={{ width: 'min(600px, 100%)' }}>
        <div className="row between">
          <h2 style={{ margin: 0 }} className="row">
            <Icon name="archive" /> Saved games
          </h2>
          <button className="small ghost" onClick={() => setModal(null)}>
            Close
          </button>
        </div>
        <p className="tiny muted">Your game autosaves to the active slot. Each slot also keeps last month’s save as a backup.</p>
        {saveError && <p className="callout bad">{saveError}</p>}
        {note && <p className="callout">{note}</p>}
        <div style={{ display: 'grid', gap: 8 }}>
          {SLOTS.map((slot, i) => {
            const s = slots?.[slot];
            return (
              <div key={slot} className={`card ${slot === active ? 'slot-active' : ''}`}>
                <div className="row between">
                  <b>
                    Slot {i + 1} {slot === active && <span className="pill good">playing</span>}
                  </b>
                  <span className="row" style={{ gap: 4 }}>
                    {s?.main && slot !== active && (
                      <button className="small primary" onClick={() => load(slot)}>
                        Load
                      </button>
                    )}
                    <button className="small" onClick={() => saveHere(slot)}>
                      {slot === active ? 'Save now' : 'Save here'}
                    </button>
                    {s?.main && slot !== active && (
                      <button className="small ghost" onClick={() => remove(slot)}>
                        <Icon name="close" />
                      </button>
                    )}
                  </span>
                </div>
                {s?.main ? row(s.main) : <span className="tiny muted">Empty</span>}
                {s?.backup && (
                  <div className="row between" style={{ marginTop: 4 }}>
                    <span className="tiny muted">Backup: {s.backup.date}, stage {s.backup.stage}</span>
                    <button className="small ghost" onClick={() => confirm('Go back to this backup? Progress since then in this slot is lost.') && load(slot, true)}>
                      Restore backup
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <button onClick={() => exportGame(game)}>
            <Icon name="arrowDown" /> Export this game (.json)
          </button>
          <label className="button-like">
            <Icon name="arrowUp" /> Import a save
            <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </label>
        </div>
      </div>
    </div>
  );
}
