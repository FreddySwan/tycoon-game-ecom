import { CHAPTER_ORDER, CHAPTERS } from '../sim/data';
import { profitOf } from '../sim/economics';
import { chapterProgress } from '../sim/engine';
import { useGame } from '../state/store';
import { money } from './format';
import { currentGoal } from './goals';
import { Icon, withIcons } from './icons';

/** One mission panel: the story chapter you're on, and the next concrete step. */
export function GoalNote() {
  const game = useGame((s) => s.game);
  const setTab = useGame((s) => s.setTab);
  const goal = currentGoal(game);
  const st = game.story;
  const ch = st?.chapter ? CHAPTERS[st.chapter] : null;
  const p = st?.chapter && st.chapter !== 'epilogue' ? chapterProgress(game) : null;
  const left = p?.deadline !== undefined ? p.deadline - game.day : null;
  return (
    <div className="mission">
      {ch && (
        <div className="mission-chapter">
          <div className="row between" style={{ flexWrap: 'nowrap' }}>
            <span className="tiny" style={{ fontWeight: 800, color: '#c0712c' }}>
              <Icon name="book" /> {st.chapter === 'epilogue' ? 'Epilogue' : `Chapter ${CHAPTER_ORDER.indexOf(st.chapter === 'secondChance' ? 'deal' : st.chapter) + 1}`}: {ch.title}
            </span>
            {left !== null && <b className={`tiny ${left < 20 ? 'bad-text' : ''}`}>{left > 0 ? `${left}d left` : 'last day'}</b>}
          </div>
          <div className="tiny">{ch.goal}</div>
          {p && (
            <div className="meter" style={{ marginTop: 3 }} title={p.label}>
              <span style={{ width: `${Math.min(1, p.value / p.target) * 100}%` }} />
            </div>
          )}
        </div>
      )}
      <div className="goal" onClick={() => goal.tab && setTab(goal.tab)} style={{ cursor: goal.tab ? 'pointer' : 'default' }}>
        <b>
          <Icon name="pin" /> Next: {goal.title}
        </b>
        {goal.hint}
      </div>
    </div>
  );
}

/** One line about yesterday, so the feed below can stay quiet. */
function Digest() {
  const game = useGame((s) => s.game);
  const y = game.history[game.history.length - 2];
  if (!y || game.day < 2) return null;
  const profit = profitOf(y.pl);
  const decisions = game.events.filter((e) => !e.blocking).length + game.cards.length + (game.story?.messages ?? []).filter((m) => m.choices && !m.answer).length;
  return (
    <div className="digest">
      <b>Yesterday</b> {y.orders.toLocaleString()} orders · {money(y.pl.revenue)} sales · <span className={profit >= 0 ? 'good-text' : 'bad-text'}>{money(profit)} profit</span>
      {decisions > 0 && <span className="pill warn">{decisions} waiting on you</span>}
    </div>
  );
}

export function Feed() {
  const notices = useGame((s) => s.game.notices);
  if (!notices.length) return null;
  return (
    <div className="feed">
      <Digest />
      {[...notices]
        .reverse()
        .slice(0, 14)
        .map((n) => (
          <div key={n.id}>
            <span className="day">D{n.day}</span>
            {withIcons(n.text)}
          </div>
        ))}
    </div>
  );
}
