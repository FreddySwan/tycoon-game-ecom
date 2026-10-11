import { def, liveProducts, trust } from '../sim/economics';
import { researchLevel } from '../sim/engine';
import type { TabId } from '../state/store';
import { useGame } from '../state/store';
import { Icon } from './icons';

type Grade = 'A' | 'B' | 'C' | 'D' | null;
const G: Grade[] = ['D', 'C', 'B', 'A'];

/** The startup's to-do list with a grade for how well each step was done. */
export function LaunchChecklist() {
  const game = useGame((s) => s.game);
  const setTab = useGame((s) => s.setTab);
  if (game.stage > 1 || game.milestones.first_profitable_campaign) return null;
  const pid = liveProducts(game)[0];
  const brand = game.brands[0];
  const p = pid ? game.products[pid] : null;
  const steps: { label: string; grade: Grade; done: boolean; tab: TabId; hint: string }[] = [
    {
      label: 'Research & pick a product',
      done: !!pid,
      grade: !pid ? null : game.positioning[pid] ? 'A' : researchLevel(game, pid) >= 2 && (game.research[pid] ?? 0) >= 2 ? 'B' : (game.research[pid] ?? 0) >= 1 ? 'C' : 'D',
      tab: 'products',
      hint: 'Deep-dive with a market scan and find the complaint rivals ignore',
    },
    {
      label: 'Source it',
      done: !!pid && game.pos.some((x) => x.productId === pid),
      grade: !pid || !game.pos.some((x) => x.productId === pid) ? null : game.samples.some((x) => x.productId === pid && x.inspected) ? (game.pos.find((x) => x.productId === pid)!.unitPrice < def(game, pid).baseUnitCost ? 'A' : 'B') : 'C',
      tab: 'source',
      hint: 'Inspect samples and negotiate below list price',
    },
    {
      label: 'Shoot the product',
      done: !!p?.photo,
      grade: p?.photo ? G[Math.max(0, Math.min(3, p.photoStars - 2))] : null,
      tab: 'store',
      hint: 'Frame it on a thirds point, pick the light that fits',
    },
    {
      label: 'Build the store',
      done: brand.store.launched,
      grade: pid && Object.values(brand.store.modules).some((x) => x) ? (trust(game, pid) >= 1.05 ? 'A' : trust(game, pid) >= 0.9 ? 'B' : trust(game, pid) >= 0.75 ? 'C' : 'D') : null,
      tab: 'store',
      hint: 'Modules, page order and a theme that fits',
    },
    {
      label: 'Design the packaging',
      done: !!brand.packDesign,
      grade: brand.packScore === undefined ? null : brand.packScore >= 0.85 ? 'A' : brand.packScore >= 0.6 ? 'B' : brand.packScore >= 0.35 ? 'C' : 'D',
      tab: 'offer',
      hint: 'A box that matches your category’s vibe',
    },
    {
      label: 'Find your ad angle',
      done: !!pid && game.angleTested[pid] !== undefined,
      grade: pid && game.angleTested[pid] !== undefined ? G[game.angleTested[pid]] : null,
      tab: 'ads',
      hint: 'Creative studio: match hooks to audiences',
    },
  ];
  const graded = steps.filter((x) => x.grade);
  const avg = graded.length ? graded.reduce((a, x) => a + G.indexOf(x.grade), 0) / graded.length : 0;
  const overall = graded.length ? G[Math.round(avg)] : null;
  return (
    <div className="checklist">
      <div className="row between">
        <b><Icon name="checklist" /> Launch checklist</b>
        {overall && <span className={`grade g${overall}`}>{overall}</span>}
      </div>
      {steps.map((st) => (
        <button key={st.label} className="check" onClick={() => setTab(st.tab)} title={st.hint}>
          <span><Icon name={st.done ? 'checkboxOn' : 'checkbox'} color={st.done ? '#1f9d55' : undefined} /></span>
          <span className="grow">{st.label}</span>
          {st.grade && <span className={`grade g${st.grade}`}>{st.grade}</span>}
        </button>
      ))}
    </div>
  );
}
