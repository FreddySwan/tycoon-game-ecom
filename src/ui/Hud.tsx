import { type ReactNode, useState } from 'react';
import { clockLabel, dateLabel } from '../sim/calendar';
import { STAGES } from '../sim/data';
import { averageRating, founderMaxHours, hoursLeft, incomingUnits } from '../sim/economics';
import { isBlocked } from '../sim/engine';
import { type Speed, useGame } from '../state/store';
import { money } from './format';
import { Icon } from './icons';

const SPEEDS: { v: Speed; label: ReactNode; title: string }[] = [
  { v: 0, label: <Icon name="pause" />, title: 'Pause' },
  { v: 1, label: <Icon name="play" />, title: 'Play' },
  { v: 2, label: <><Icon name="play" />2×</>, title: '2× speed' },
  { v: 4, label: <><Icon name="play" />4×</>, title: '4× speed' },
  { v: 8, label: <Icon name="forward" />, title: '8× speed' },
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
  const toggleAdmin = useGame((s) => s.toggleAdmin);
  const [menu, setMenu] = useState(false);
  const hours = hoursLeft(game);
  const maxHours = founderMaxHours(game) + game.extraHours;
  const energy = Math.round(game.story?.energy ?? 100);
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
        <span className="value">{money(game.cash)}</span>
        {game.credit.balance > 0 && <span className="value small">credit −{money(game.credit.balance)}</span>}
      </div>
      {game.stage <= 2 && (
        <div className="stat hours" title="Founder hours left today. Packing, support and photo shoots use them.">
          <span className="label">Founder hours</span>
          <span className="bar">
            <span style={{ width: `${(hours / maxHours) * 100}%` }} />
          </span>
          <span className="value small">
            {hours.toFixed(1)}/{maxHours}h
          </span>
        </div>
      )}
      {game.stage <= 2 && (
        <div className={`stat ${energy < 35 ? 'warn' : ''}`} title="Founder energy. Full days drain it; easy days and friends restore it. Below 35% you lose founder hours.">
          <span className="label">Energy</span>
          <span className="value small">
            <Icon name="zap" /> {energy}%
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
        <button className="skip" disabled={blocked} onClick={skip} title="Jump ahead to the next thing that needs you">
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
                  if (confirm('Start a new game? Your current business will be lost.')) newGame();
                }}
              >
                New game
              </button>
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
