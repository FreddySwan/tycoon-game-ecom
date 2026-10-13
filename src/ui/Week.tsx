import { useState } from 'react';
import { FOCUS, type FocusId } from '../sim/data';
import { availableFocus, focusSlots, setFocus, weekOf } from '../sim/engine';
import { useGame } from '../state/store';
import { Icon, withIcons } from './icons';

/** Left-panel card: what the founder is focusing on this week. */
export function WeekCard() {
  const game = useGame((s) => s.game);
  const setModal = useGame((s) => s.setModal);
  if (!game.productOrder.length) return null;
  const set = game.focus?.week === weekOf(game.day);
  const picks = (game.focus?.picks ?? []) as FocusId[];
  return (
    <div className={`week-card ${set ? '' : 'unset'}`} onClick={() => setModal({ kind: 'week' })}>
      <div className="row between">
        <b>
          <Icon name="calendar" /> Week {weekOf(game.day) + 1} focus
        </b>
        <span className="tiny">{set ? 'set' : 'plan it'}</span>
      </div>
      {picks.length ? (
        <div className="week-chips">
          {picks.map((p) => (
            <span key={p} className="chip">
              {withIcons(FOCUS[p].icon)} {FOCUS[p].name}
            </span>
          ))}
        </div>
      ) : (
        <span className="tiny">Pick {focusSlots(game)} things to focus on this week.</span>
      )}
    </div>
  );
}

/** Week planner: pick this week's focus cards. */
export function WeekPlanner() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const locked = game.focus?.week === weekOf(game.day);
  const [picks, setPicks] = useState<FocusId[]>((game.focus?.picks ?? []) as FocusId[]);
  const slots = focusSlots(game);
  const toggle = (id: FocusId) => setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < slots ? [...p, id] : p));
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
      <div className="modal" style={{ width: 'min(720px, 100%)' }}>
        <div className="row between">
          <h2 style={{ margin: 0 }} className="row">
            <Icon name="calendar" /> Plan week {weekOf(game.day) + 1}
          </h2>
          <button className="small ghost" onClick={() => setModal(null)}>
            Close
          </button>
        </div>
        <p className="tiny muted">
          Your attention is the one thing you can’t hire. Pick {slots} focus cards: each works for 7 days. If you don’t change them, next week repeats this plan.
          {locked && ' This week is already set; you can plan again next week.'}
        </p>
        <div className="focus-grid">
          {availableFocus(game).map((id) => {
            const f = FOCUS[id];
            const on = picks.includes(id);
            return (
              <button key={id} className={`focus-card ${on ? 'on' : ''}`} disabled={locked} onClick={() => toggle(id)}>
                <span className="fc-icon">{withIcons(f.icon)}</span>
                <b>{f.name}</b>
                <span className="tiny">{f.effect}</span>
              </button>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="primary"
            disabled={locked || !picks.length}
            onClick={() => {
              if (!act(setFocus, picks)) setModal(null);
            }}
          >
            Commit to this week ({picks.length}/{slots})
          </button>
        </div>
      </div>
    </div>
  );
}
