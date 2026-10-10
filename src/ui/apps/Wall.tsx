import { MILESTONE_LABELS, MILESTONE_PICS } from '../../sim/engine';
import type { MilestoneId } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle } from '../bits';
import { allCredits } from '../photos';

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
              <div className="pic">{day ? MILESTONE_PICS[id] : '?'}</div>
              {MILESTONE_LABELS[id]}
              <div className="tiny muted">{day ? `Day ${day}` : 'Not yet'}</div>
            </div>
          );
        })}
      </div>
      <h3>Photo credits</h3>
      <p className="tiny muted">Main product photos were supplied by the developer. Other product photos are used under Creative Commons licenses, found via Openverse. Furniture art: Kenney (CC0).</p>
      <ul className="tiny" style={{ columns: 2, paddingLeft: 16 }}>
        {allCredits().map(({ pid, photo }) => (
          <li key={photo.src}>
            {photo.url ? (
              <a href={photo.url} target="_blank" rel="noreferrer">
                “{photo.title}”
              </a>
            ) : (
              `“${photo.title}”`
            )}{' '}
            by {photo.creator || 'unknown'} ({photo.license}) · {pid}
          </li>
        ))}
      </ul>
    </div>
  );
}
