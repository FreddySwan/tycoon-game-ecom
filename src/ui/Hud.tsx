import { type ReactNode, useState } from 'react';
import { clockLabel, dateLabel } from '../sim/calendar';
import { STAGES } from '../sim/data';
import { averageRating, founderMaxHours, hoursLeft, incomingUnits } from '../sim/economics';
import * as E from '../sim/engine';
import { isBlocked } from '../sim/engine';
import { type Speed, useGame } from '../state/store';
import { money } from './format';
import { RollingMoney } from './Rolling';
import { Icon } from './icons';

const SPEEDS: { v: Speed; label: ReactNode; title: string }[] = [
  { v: 0, label: <Icon name="pause" />, title: 'Pause (space)' },
  { v: 1, label: <Icon name="play" />, title: 'Play (1)' },
  { v: 2, label: <><Icon name="play" />2×</>, title: '2× speed (2)' },
  { v: 4, label: <><Icon name="play" />4×</>, title: '4× speed (3)' },
  { v: 8, label: <Icon name="forward" />, title: '8× speed (4)' },
];

export function Hud() {
  const game = useGame((s) => s.game);
  const speed = useGame((s) => s.speed);
  const progress = useGame((s) => s.dayProgress);
  const setSpeed = useGame((s) => s.setSpeed);
  const skip = useGame((s) => s.skip);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const newGame = useGame((s) => s.newGame);
  const admin = useGame((s) => s.admin);
  const pauses = useGame((s) => s.pauses);
  const setPause = useGame((s) => s.setPause);
  const toggleAdmin = useGame((s) => s.toggleAdmin);
  const [menu, setMenu] = useState(false);
  const hours = hoursLeft(game);
  const maxHours = founderMaxHours(game) + game.extraHours;
  const routine = E.routineHours(game);
  const rating = averageRating(game);
  const blocked = isBlocked(game);
  const stock = Object.values(game.products).reduce((a, p) => a + p.inventory.onHand, 0);

  return (
    <header className="hud">
      <div className="brand">
        <span className="logo"><Icon name="archive" /></span> Unboxed
      </div>
      <div className="stat">
        <span className="label">Stage {game.stage}</span>
        <span className="value small">{STAGES[game.stage].name}</span>
      </div>
      <div className="stat">
        <span className="label">Day {game.day}</span>
        <span className="value">
          {dateLabel(game.day)} <small>{clockLabel(progress)}</small>
        </span>
      </div>
      <div className={`stat ${game.cash < 300 ? 'warn' : ''}`}>
        <span className="label">Cash</span>
        <span className="value">
          <RollingMoney value={game.cash} />
        </span>
        {game.credit.balance > 0 && <span className="value small">credit −{money(game.credit.balance)}</span>}
      </div>
      {game.stage <= 2 && (
        <div className="stat hours" title={`Founder hours left today. Your routine takes ${routine.total.toFixed(1)}h a day (admin ${routine.admin}h${routine.ads ? `, keeping ads running ${routine.ads.toFixed(1)}h` : ""}); packing, reviews, ad changes, research and support use the rest.`}>
          <span className="label">Founder hours</span>
          <span className="bar">
            <span style={{ width: `${(hours / maxHours) * 100}%` }} />
          </span>
          <span className="value small">
            {hours.toFixed(1)}/{maxHours}h
          </span>
        </div>
      )}
      <div className="stat">
        <span className="label">Stock</span>
        <span className="value">
          {stock.toLocaleString()}
          {incomingUnits(game) > 0 && <small> +{incomingUnits(game).toLocaleString()}</small>}
        </span>
      </div>
      <div className="stat">
        <span className="label">Rating</span>
        <span className="value">{rating ? `${rating.toFixed(1)}★` : '—'}</span>
      </div>
      <div className="spacer" />
      <div className="speed">
        {SPEEDS.map((s) => (
          <button key={s.v} className={speed === s.v ? 'on' : ''} title={s.title} disabled={blocked && s.v !== 0} onClick={() => setSpeed(s.v)}>
            {s.label}
          </button>
        ))}
        <button className="skip" disabled={blocked} onClick={skip} title="Jump ahead to the next thing that needs you (S)">
          Skip <Icon name="next" />
        </button>
        <button className="mute" onClick={toggleMute} title="Sound">
          <Icon name={muted ? 'volumeX' : 'volume'} />
        </button>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenu(!menu)} title="Menu">
            <Icon name="menu" />
          </button>
          {menu && (
            <div className="menu">
              <button
                onClick={() => {
                  setMenu(false);
                  if (confirm('Start a new game in this save slot? To keep this business, first save it to another slot (Saved games).')) newGame();
                }}
              >
                New game
              </button>
              <button
                onClick={() => {
                  setMenu(false);
                  useGame.getState().setModal({ kind: 'saves' });
                }}
              >
                Saved games…
              </button>
              <div className="menu-sec">Auto-pause when…</div>
              <label className="menu-check">
                <input type="checkbox" checked disabled /> A decision needs you
              </label>
              {(Object.keys(E.PAUSE_LABELS) as (keyof E.PauseSettings)[]).map((k) => (
                <label key={k} className="menu-check">
                  <input type="checkbox" checked={pauses[k]} onChange={(e) => setPause(k, e.target.checked)} /> {E.PAUSE_LABELS[k]}
                </label>
              ))}
              <button
                onClick={() => {
                  setMenu(false);
                  toggleAdmin();
                }}
              >
                <Icon name="debug" /> {admin ? 'Hide admin mode' : 'Admin mode (testing)'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
