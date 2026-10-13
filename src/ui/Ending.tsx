import { ENDINGS, dismissEnding, ownership, valuation } from '../sim/engine';
import { trailing } from '../sim/economics';
import { useGame } from '../state/store';
import { money } from './format';
import { Icon } from './icons';

/** The story's ending: shown once when it's reached. Selling the company ends the game. */
export function EndingModal() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const newGame = useGame((s) => s.newGame);
  const e = game.ending!;
  const end = ENDINGS[e.id];
  const sold = e.id === 'sold';
  return (
    <div className="overlay">
      <div className="modal center" style={{ width: 'min(560px, 100%)' }}>
        <div className="huge">
          <Icon name={sold ? 'briefcaseCheck' : 'trophy'} />
        </div>
        <div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 800, color: '#c0712c' }}>
          Ending
        </div>
        <h2 style={{ marginTop: 2 }}>{end.title}</h2>
        {end.text.map((t) => (
          <p key={t} style={{ textAlign: 'left' }}>
            {t}
          </p>
        ))}
        <div className="kpis" style={{ margin: '10px 0' }}>
          <div className="kpi">
            <div className="k">Day</div>
            <div className="v">{e.day}</div>
          </div>
          <div className="kpi">
            <div className="k">{sold ? 'Your payout' : 'Company value'}</div>
            <div className="v">{money(sold ? (e.payout ?? 0) : valuation(game))}</div>
          </div>
          <div className="kpi">
            <div className="k">You own</div>
            <div className="v">{Math.round(ownership(game) * 100)}%</div>
          </div>
          <div className="kpi">
            <div className="k">Last 12 months</div>
            <div className="v">{money(trailing(game, 360).revenue)}</div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          {!sold && (
            <button className="primary" onClick={() => act(dismissEnding)}>
              Keep playing
            </button>
          )}
          <button className={sold ? 'primary' : 'ghost'} onClick={() => confirm('Start a new game in this save slot?') && newGame()}>
            New game
          </button>
        </div>
      </div>
    </div>
  );
}
