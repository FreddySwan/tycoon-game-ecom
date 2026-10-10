import { useGame } from '../state/store';
import { currentGoal } from './goals';

export function GoalNote() {
  const game = useGame((s) => s.game);
  const setTab = useGame((s) => s.setTab);
  const goal = currentGoal(game);
  return (
    <div className="goal" onClick={() => goal.tab && setTab(goal.tab)} style={{ cursor: goal.tab ? 'pointer' : 'default' }}>
      <b>📌 {goal.title}</b>
      {goal.hint}
    </div>
  );
}

export function Feed() {
  const notices = useGame((s) => s.game.notices);
  if (!notices.length) return null;
  return (
    <div className="feed">
      {[...notices]
        .reverse()
        .slice(0, 12)
        .map((n) => (
          <div key={n.id}>
            <span className="day">D{n.day}</span>
            {n.text}
          </div>
        ))}
    </div>
  );
}
