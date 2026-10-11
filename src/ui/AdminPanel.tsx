import { useState } from 'react';
import { STAGES } from '../sim/data';
import { ADMIN_CASH_FLOOR, adminAddCash, adminForceStage, adminRevealAll, adminSkipDays, adminToggle } from '../sim/engine';
import type { StageId } from '../sim/types';
import { useGame } from '../state/store';
import { money } from './format';
import { Icon } from './icons';

const STAGE_IDS: StageId[] = [1, 2, 3, 4, 5];

/** Testing cheats: money, hours, time skips and stage jumps. Toggle from the menu or open the game with ?admin. */
export function AdminPanel() {
  const admin = useGame((s) => s.admin);
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const replaceGame = useGame((s) => s.replaceGame);
  const toggleAdmin = useGame((s) => s.toggleAdmin);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!admin) return null;

  const simulate = (stage: StageId) => {
    if (!confirm(`Replace your current game with a simulated business at stage ${stage} (${STAGES[stage].name})?`)) return;
    setBusy(`Simulating a business up to stage ${stage}…`);
    setError(null);
    // Let the "simulating" note paint before the (sub-second) bot run blocks the thread.
    setTimeout(async () => {
      try {
        const { simulateToStage } = await import('../sim/admin');
        replaceGame(simulateToStage(stage));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      setBusy(null);
    }, 30);
  };

  if (!open)
    return (
      <button className="admin-fab" onClick={() => setOpen(true)} title="Admin mode">
        <Icon name="debug" />
      </button>
    );

  return (
    <div className="admin-panel">
      <div className="row between">
        <b><Icon name="debug" /> Admin mode</b>
        <span className="row" style={{ gap: 4 }}>
          <button className="small ghost" onClick={() => setOpen(false)} title="Minimize">
            –
          </button>
          <button className="small ghost" onClick={toggleAdmin} title="Turn admin mode off">
            <Icon name="close" />
          </button>
        </span>
      </div>

      <div className="admin-sec">Money · {money(game.cash)}</div>
      <label className="row" style={{ gap: 6 }}>
        <input type="checkbox" checked={!!game.flags.adminCash} onChange={() => act(adminToggle, 'adminCash')} />
        Unlimited cash <span className="muted">(never below {money(ADMIN_CASH_FLOOR)})</span>
      </label>
      <div className="row" style={{ gap: 4 }}>
        {[10_000, 100_000, 1_000_000].map((v) => (
          <button key={v} className="small" onClick={() => act(adminAddCash, v)}>
            +{money(v).replace(',000,000', 'M').replace(',000', 'k')}
          </button>
        ))}
      </div>
      <label className="row" style={{ gap: 6 }}>
        <input type="checkbox" checked={!!game.flags.adminHours} onChange={() => act(adminToggle, 'adminHours')} />
        Unlimited founder hours
      </label>

      <div className="admin-sec">Time · day {game.day}</div>
      <div className="row" style={{ gap: 4 }}>
        {[1, 7, 30, 90].map((d) => (
          <button key={d} className="small" onClick={() => act(adminSkipDays, d)}>
            +{d}d
          </button>
        ))}
        <button className="small" onClick={() => act(adminRevealAll)} title="Put every product on the research board">
          Reveal products
        </button>
      </div>

      <div className="admin-sec">Jump to a stage (simulated business)</div>
      <div className="row" style={{ gap: 4 }}>
        {STAGE_IDS.map((st) => (
          <button key={st} className="small" disabled={!!busy} onClick={() => simulate(st)} title={STAGES[st].name}>
            {st}
          </button>
        ))}
      </div>
      <p className="tiny muted" style={{ margin: '2px 0 0' }}>
        The test bot plays a fresh game until it reaches that stage: products, staff, channels and history included. Replaces your current game.
      </p>

      <div className="admin-sec">Unlock a stage on this save · now {game.stage}</div>
      <div className="row" style={{ gap: 4 }}>
        {STAGE_IDS.filter((st) => st > game.stage).map((st) => (
          <button key={st} className="small" onClick={() => act(adminForceStage, st)} title={`Move to ${STAGES[st].name} now, skipping requirements and the deposit`}>
            → {st}
          </button>
        ))}
        {game.stage >= 5 && <span className="tiny muted">Already at the top.</span>}
      </div>

      {busy && <p className="tiny">{busy}</p>}
      {error && <p className="tiny bad-text">{error}</p>}
    </div>
  );
}
