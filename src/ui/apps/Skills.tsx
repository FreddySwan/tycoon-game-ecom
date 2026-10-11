import { SKILL_ORDER, SKILLS, STUDY_SESSION } from '../../sim/data';
import { hasSkill, hoursLeft, packHours } from '../../sim/economics';
import { buySkill, cancelSkill, studySkill } from '../../sim/engine';
import type { SkillDef } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle } from '../bits';
import { money } from '../format';
import { Icon, withIcons } from '../icons';

const KINDS: { kind: SkillDef['kind']; title: string; sub: string }[] = [
  { kind: 'software', title: 'Software', sub: 'Billed monthly. Cancel any time.' },
  { kind: 'course', title: 'Courses', sub: 'Pay once, then study: each session uses up to 2 founder hours.' },
  { kind: 'gear', title: 'Packing gear', sub: 'Every order you pack yourself goes faster.' },
];

/** SkillUp: the courses, tools and gear a first-time founder has to buy before they know what they're doing. */
export function Skills() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const hours = hoursLeft(game);

  return (
    <div>
      <AppTitle
        app="SkillUp"
        title="Learn & equip"
        sub={
          <>
            Nobody is born knowing how to run ads. Courses take founder time to finish; software and gear work right away. Packing time now: <b>{Math.round(packHours(game) * 60)} min/order</b>.
          </>
        }
      />
      {KINDS.map((k) => (
        <section key={k.kind}>
          <h3 style={{ marginBottom: 2 }}>{k.title}</h3>
          <p className="tiny muted" style={{ marginTop: 0 }}>
            {k.sub}
          </p>
          <div className="cards">
            {SKILL_ORDER.filter((id) => SKILLS[id].kind === k.kind).map((id) => {
              const d = SKILLS[id];
              const st = game.skills[id];
              const done = hasSkill(game, id);
              const locked = (d.requires ?? []).find((r) => !hasSkill(game, r));
              const studying = d.kind === 'course' && st && !done;
              return (
                <div key={id} className={`card skill ${done ? 'owned' : ''}`}>
                  <div className="row between" style={{ flexWrap: 'nowrap' }}>
                    <span className="skill-icon">{withIcons(d.icon)}</span>
                    {done ? (
                      <span className="pill good">
                        <Icon name="check" /> {d.kind === 'software' ? 'Active' : d.kind === 'course' ? 'Completed' : 'Owned'}
                      </span>
                    ) : (
                      <span className="tiny muted">{d.monthly ? `${money(d.monthly)}/month` : money(d.cost)}</span>
                    )}
                  </div>
                  <h4 style={{ margin: '4px 0 0' }}>{d.name}</h4>
                  <p className="tiny" style={{ margin: 0 }}>
                    {d.desc}
                  </p>
                  <p className="tiny" style={{ margin: 0 }}>
                    <b>{d.effect}</b>
                  </p>
                  {d.kind === 'course' && (
                    <div className="tiny muted">
                      {d.hours}h of study{st ? ` · ${st.progress}/${d.hours}h done` : ''}
                      {st && (
                        <div className="meter" style={{ marginTop: 4 }}>
                          <span style={{ width: `${Math.min(1, st.progress / (d.hours ?? 1)) * 100}%` }} />
                        </div>
                      )}
                    </div>
                  )}
                  {locked && !st && (
                    <p className="tiny muted" style={{ margin: 0 }}>
                      <Icon name="lock" /> Needs {SKILLS[locked].name}
                    </p>
                  )}
                  <div style={{ marginTop: 'auto' }}>
                    {!st && (
                      <button className="primary small" disabled={!!locked} onClick={() => act(buySkill, id)}>
                        {d.kind === 'software' ? `Subscribe · ${money(d.monthly ?? d.cost)}/mo` : d.kind === 'course' ? `Enroll · ${money(d.cost)}` : `Buy · ${money(d.cost)}`}
                      </button>
                    )}
                    {studying && (
                      <button className="primary small" disabled={hours < 0.5} onClick={() => act(studySkill, id)} title={hours < 0.5 ? 'Out of founder hours today' : ''}>
                        <Icon name="book" /> Study ({Math.min(STUDY_SESSION, (d.hours ?? 0) - (st?.progress ?? 0), Math.floor(hours * 2) / 2)}h)
                      </button>
                    )}
                    {d.kind === 'software' && st && !st.active && (
                      <button className="small" onClick={() => act(buySkill, id)}>
                        Resubscribe · {money(d.monthly ?? d.cost)}/mo
                      </button>
                    )}
                    {d.kind === 'software' && st?.active && (
                      <button className="small ghost" onClick={() => act(cancelSkill, id)}>
                        Cancel subscription
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
