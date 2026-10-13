import { ROUND_ORDER, ROUNDS } from '../sim/data';
import { trailing } from '../sim/economics';
import { nextRound, ownership, raiseRound, roundProblems, sellCompany, valuation } from '../sim/engine';
import { useGame } from '../state/store';
import { dateLabel } from '../sim/calendar';
import { money } from './format';
import { Icon } from './icons';

/** Company app section: bootstrap or raise money, and the board's target if you did. */
export function FundingSection() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  if (game.stage < 2) return null;
  const f = game.funding;
  const next = nextRound(game);
  const board = f?.board;
  const rev = trailing(game, 30).revenue;
  return (
    <>
      <h3>
        <Icon name="briefcase" /> Funding
      </h3>
      <p className="tiny muted" style={{ marginTop: 0 }}>
        You own <b>{Math.round(ownership(game) * 100)}%</b> of the company. Bootstrapping keeps it all; investors give you cash to grow faster and a board that expects results. Miss a target twice and they replace you.
      </p>
      {board && (
        <div className="callout warn">
          <b>Board target ({ROUNDS[board.round as keyof typeof ROUNDS].name}):</b> {money(board.target)} a month by {dateLabel(board.deadline)} ({board.deadline - game.day} days).
          <div className="meter" style={{ marginTop: 6 }}>
            <span style={{ width: `${Math.min(1, rev / board.target) * 100}%` }} />
          </div>
          <span className="tiny">Now {money(rev)} a month.{board.warned ? ' Final warning: there is no second extension.' : ''}</span>
        </div>
      )}
      <div className="cards">
        {ROUND_ORDER.map((id) => {
          const r = ROUNDS[id];
          const done = f?.raised.includes(id);
          const problems = id === next ? roundProblems(game, id) : [];
          return (
            <div key={id} className={`card ${done ? 'skill owned' : ''}`}>
              <div className="row between">
                <b>{r.name}</b>
                {done && <span className="pill good">raised</span>}
              </div>
              <span className="tiny">
                {money(r.raise)} for {Math.round(r.equity * 100)}% · board wants {r.growth}× monthly sales in {r.months} months
              </span>
              {!done && id === next && (
                <>
                  {problems.length > 0 ? (
                    <ul className="tiny" style={{ margin: '4px 0', paddingLeft: 16 }}>
                      {problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  ) : (
                    <button className="primary small" onClick={() => confirm(`Raise ${money(r.raise)} for ${Math.round(r.equity * 100)}% of your company? The board will expect ${r.growth}× monthly sales in ${r.months} months.`) && act(raiseRound, id)}>
                      Raise {money(r.raise)}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="tiny muted">Investor interest: {Math.round(f?.interest ?? 0)}/50. It grows when sales grow fast, and when you spend weeks on investor coffees.</p>
      {game.stage >= 4 && (
        <div className="card" style={{ marginTop: 8 }}>
          <b>
            <Icon name="briefcaseCheck" /> Sell the company
          </b>
          <span className="tiny">
            Buyers value you at about <b>{money(valuation(game))}</b> (a multiple of yearly sales that rises with profit margin). Your {Math.round(ownership(game) * 100)}% would be <b>{money(valuation(game) * ownership(game))}</b>. Selling ends the game.
          </span>
          <button className="small" disabled={valuation(game) < 1_000_000} onClick={() => confirm(`Sell the company for ${money(valuation(game))}? This ends the game.`) && act(sellCompany)}>
            Sell for {money(valuation(game))}
          </button>
        </div>
      )}
    </>
  );
}
