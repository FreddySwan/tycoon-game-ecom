import { ROLES, ROLE_ORDER } from '../../sim/data';
import { headcount, payrollMonthly, seatsUsed } from '../../sim/economics';
import { fire, giveRaise, hire, promoteToLead, RECRUIT_FEE, seatLimit, setShifts, traitEffect, TRAITS } from '../../sim/engine';
import { useGame } from '../../state/store';
import { AppTitle, Meter } from '../bits';
import { money } from '../format';
import { Icon, withIcons } from '../icons';

export function Team() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const roles = ROLE_ORDER.filter((r) => ROLES[r].unlockStage <= game.stage);
  const floor = seatLimit(game, 'floor');
  const office = seatLimit(game, 'office');

  return (
    <div>
      <AppTitle
        app="Team"
        title={`${headcount(game)} people`}
        sub={
          <>
            Payroll {money(payrollMonthly(game))}/month incl. taxes & benefits, paid every 14 days · floor {seatsUsed(game, 'floor')}/{floor > 900 ? '∞' : floor} · desks {seatsUsed(game, 'office')}/{office}
          </>
        }
      />
      {game.people.length > 0 && (
        <div className="cards" style={{ marginBottom: 14 }}>
          {game.people.map((p) => (
            <div key={p.name + p.role} className="card">
              <div className="row between">
                <span className="big-emoji">{withIcons(ROLES[p.role].emoji)}</span>
                {p.promoted && <span className="pill good">promoted</span>}
              </div>
              <h4>{p.name}</h4>
              <p>
                {ROLES[p.role].name} since day {p.hiredDay}
              </p>
              {p.trait && (
                <p className="tiny" style={{ margin: 0 }}>
                  <span className={`pill ${p.trait === 'loyal' ? 'good' : ''}`}>{TRAITS[p.trait].label}</span> {traitEffect(p) || TRAITS[p.trait].desc}
                  {p.friend && <span className="muted"> · your friend</span>}
                </p>
              )}
              <div className="tiny">Morale</div>
              <Meter value={p.morale} max={100} />
            </div>
          ))}
        </div>
      )}
      <table className="data">
        <thead>
          <tr>
            <th>Role</th>
            <th className="num">People</th>
            <th>Morale</th>
            <th className="num">Wage/mo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => {
            const d = ROLES[r];
            const t = game.team[r];
            return (
              <tr key={r}>
                <td>
                  <b>
                    {withIcons(d.emoji)} {d.name}
                  </b>
                  <div className="tiny muted">{d.desc}</div>
                </td>
                <td className="num">{t.count}</td>
                <td style={{ width: 90 }}>{t.count > 0 && <Meter value={t.morale} max={100} />}</td>
                <td className="num">{money(d.wage * t.wageMult)}</td>
                <td>
                  <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <button className="small" onClick={() => act(hire, r, 1)} title={`Recruiting fee ${money(RECRUIT_FEE)}`}>
                      Hire
                    </button>
                    {r === 'packer' && game.stage >= 3 && (
                      <button className="small" onClick={() => act(hire, r, 5)}>
                        +5
                      </button>
                    )}
                    <button className="small ghost" disabled={!t.count} onClick={() => act(fire, r, 1)} title="Severance: 2 weeks of pay">
                      −
                    </button>
                    <button className="small ghost" disabled={!t.count} onClick={() => act(giveRaise, r)} title="+10% wage, +20 morale (every 60 days)">
                      <Icon name="money" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {game.stage >= 3 && (
        <div className="row" style={{ marginTop: 12 }}>
          {game.people.some((p) => p.role === 'packer' && p.name === 'Jordan') && !game.team.lead.count && (
            <button onClick={() => act(promoteToLead)}><Icon name="humanUp" /> Promote Jordan to warehouse lead</button>
          )}
          <span>Shifts:</span>
          <button className={game.shifts === 1 ? 'primary small' : 'small'} onClick={() => act(setShifts, 1)}>
            1 shift
          </button>
          <button className={game.shifts === 2 ? 'primary small' : 'small'} onClick={() => act(setShifts, 2)} title="Doubles station use. Needs a lead. +8% packer wages.">
            2 shifts
          </button>
        </div>
      )}
      <p className="tiny muted" style={{ marginTop: 12 }}>
        Overworked teams lose morale. Below 35, people start quitting, and key people get poached. Raises and growth lift spirits.
      </p>
    </div>
  );
}
