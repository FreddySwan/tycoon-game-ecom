import { MILESTONE_LABELS, MILESTONE_PICS } from '../../sim/engine';
import { withIcons } from '../icons';
import type { MilestoneId } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle } from '../bits';

export function Wall() {
  const game = useGame((s) => s.game);
  const ids = Object.keys(MILESTONE_LABELS) as MilestoneId[];
  const done = ids.filter((id) => game.milestones[id]).length;
  return (
    <div>
      <AppTitle app="Corkboard" title="Milestones" sub={`${done} of ${ids.length} polaroids. They move with you every time the business grows.`} />
      <div className="cork">
        {ids.map((id) => {
          const day = game.milestones[id];
          return (
            <div key={id} className={`polaroid ${day ? '' : 'empty'}`} style={{ transform: `rotate(${((id.length * 7) % 9) - 4}deg)` }}>
              <div className="pic">{day ? withIcons(MILESTONE_PICS[id]) : '?'}</div>
              {MILESTONE_LABELS[id]}
              <div className="tiny muted">{day ? `Day ${day}` : 'Not yet'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
