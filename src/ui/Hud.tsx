import { FOUNDER_HOURS } from '../sim/data';
import { averageRating, hoursLeft, incomingUnits } from '../sim/economics';
import { isBlocked } from '../sim/engine';
import { useGame } from '../state/store';
import { money } from './format';

const SPEEDS = [
  { v: 0, label: '⏸', title: 'Pause' },
  { v: 1, label: '▶', title: 'Play' },
  { v: 2, label: '▶▶', title: '2× speed' },
  { v: 4, label: '▶▶▶', title: '4× speed' },
] as const;

export function Hud() {
  const game = useGame((s) => s.game);
  const speed = useGame((s) => s.speed);
  const progress = useGame((s) => s.dayProgress);
  const setSpeed = useGame((s) => s.setSpeed);
  const skip = useGame((s) => s.skip);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const hours = hoursLeft(game);
  const maxHours = FOUNDER_HOURS + game.extraHours;
  const rating = averageRating(game);
  const blocked = isBlocked(game);
  const clock = 8 + Math.floor(progress * 12);

  return (
    <header className="hud">
      <div className="brand">
        <span className="logo">📦</span> Unboxed
      </div>
      <div className="stat">
        <span className="label">Day</span>
        <span className="value">
          {game.day} <small>{clock}:00</small>
        </span>
      </div>
      <div className={`stat ${game.cash < 300 ? 'warn' : ''}`}>
        <span className="label">Cash</span>
        <span className="value">{money(game.cash)}</span>
      </div>
      <div className="stat hours" title="Founder hours left today. Packing, support and photo shoots use them.">
        <span className="label">Founder hours</span>
        <span className="bar">
          <span style={{ width: `${(hours / maxHours) * 100}%` }} />
        </span>
        <span className="value small">
          {hours.toFixed(1)}/{maxHours}h
        </span>
      </div>
      <div className="stat">
        <span className="label">Stock</span>
        <span className="value">
          {game.inventory.onHand}
          {incomingUnits(game) > 0 && <small> +{incomingUnits(game)} coming</small>}
        </span>
      </div>
      <div className="stat">
        <span className="label">Rating</span>
        <span className="value">{rating ? `${rating.toFixed(1)}★` : '—'}</span>
      </div>
      <div className="spacer" />
      <div className="speed">
        {SPEEDS.map((s) => (
          <button
            key={s.v}
            className={speed === s.v ? 'on' : ''}
            title={s.title}
            disabled={blocked && s.v !== 0}
            onClick={() => setSpeed(s.v)}
          >
            {s.label}
          </button>
        ))}
        <button className="skip" disabled={blocked} onClick={skip} title="Jump ahead to the next thing that needs you">
          Skip to next event ⏭
        </button>
        <button className="mute" onClick={toggleMute} title="Sound">
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </header>
  );
}
