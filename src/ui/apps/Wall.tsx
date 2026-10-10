import { MILESTONE_LABELS } from '../../sim/engine';
import type { MilestoneId } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle } from '../bits';

export const PICS: Record<MilestoneId, string> = {
  first_sample: '📦',
  store_launched: '🚀',
  first_sale: '🔔',
  first_profitable_campaign: '🏆',
  first_five_star: '⭐',
  first_repeat: '💌',
  batch_packing: '🧰',
  first_profitable_reorder: '🎉',
};

export function Wall() {
  const game = useGame((s) => s.game);
  return (
    <div>
      <AppTitle app="Corkboard" title="Milestones" sub="Every polaroid moves with you when the business grows." />
      <div className="cork">
        {(Object.keys(MILESTONE_LABELS) as MilestoneId[]).map((id) => {
          const day = game.milestones[id];
          return (
            <div key={id} className={`polaroid ${day ? '' : 'empty'}`} style={{ transform: `rotate(${((id.length * 7) % 9) - 4}deg)` }}>
              <div className="pic">{day ? PICS[id] : '?'}</div>
              {MILESTONE_LABELS[id]}
              <div className="tiny muted">{day ? `Day ${day}` : 'Not yet'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
