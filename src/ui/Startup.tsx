import { CATEGORY_VIBE, IDEAL_ORDER, INSERT_COST, layoutScore, MODULES, packScore, VIBES } from '../sim/data';
import { def } from '../sim/economics';
import { setPackDesign, setStoreLayout } from '../sim/engine';
import type { Brand, CategoryId, ModuleId, PackDesign, Vibe } from '../sim/types';
import { useGame } from '../state/store';
import { Meter, Options } from './bits';
import { money } from './format';
import { Icon, withIcons } from './icons';

function categoryOf(brand: Brand): CategoryId {
  const game = useGame.getState().game;
  const pid = Object.keys(game.products).find((id) => game.products[id].brandId === brand.id);
  return pid ? def(game, pid).category : 'pets';
}

const REACTIONS: [number, string][] = [
  [0.85, '“OMG the unboxing! Posting this right now.”'],
  [0.6, '“Cute box, feels like a real brand.”'],
  [0.35, '“It’s… a box. Product looks fine though.”'],
  [0, '“Plain brown box. Did I order from a warehouse?”'],
];

/** Mini-game: design the box. Matching your category's vibe makes unboxings memorable. */
export function PackagingDesigner({ brand }: { brand: Brand }) {
  const act = useGame((s) => s.act);
  const cat = categoryOf(brand);
  const design: PackDesign = brand.packDesign ?? { color: 'minimal', print: 'plain', insert: 'none' };
  const score = packScore(design, cat);
  const v = VIBES[design.color];
  const set = (patch: Partial<PackDesign>) => act(setPackDesign, brand.id, { ...design, ...patch });
  const reaction = REACTIONS.find(([min]) => score >= min)![1];
  return (
    <div className="chat" style={{ marginTop: 12 }}>
      <b><Icon name="gift" /> Design your box</b>
      <p className="tiny muted" style={{ margin: '4px 0 10px' }}>
        Unboxing is your first real touch with a customer. A box that fits the vibe of your category lifts reviews, repeat buying and trust.
      </p>
      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div className="box-preview" style={{ background: v.color }}>
          <div className="lid" style={{ background: v.color, borderColor: v.accent }} />
          {design.print === 'logo' && <span className="logo" style={{ color: v.accent, fontFamily: v.font }}>{brand.name || 'Your brand'}</span>}
          {design.print === 'pattern' && <span className="pattern" style={{ color: v.accent }}>✦ ✦ ✦ ✦<br />✦ ✦ ✦ ✦</span>}
          {design.insert === 'tissue' && <span className="tissue" />}
          {design.insert === 'sticker' && <span className="sticker" style={{ background: v.accent }}><Icon name="heart" /></span>}
        </div>
        <div style={{ flex: 1, minWidth: 220, display: 'grid', gap: 8 }}>
          <div>
            <div className="tiny muted">Colorway</div>
            <Options value={design.color} options={(Object.keys(VIBES) as Vibe[]).map((k) => ({ v: k, label: VIBES[k].name }))} onChange={(c) => set({ color: c })} />
          </div>
          <div>
            <div className="tiny muted">Print</div>
            <Options value={design.print} options={[{ v: 'plain', label: 'Plain' }, { v: 'logo', label: 'Big logo' }, { v: 'pattern', label: 'Pattern' }]} onChange={(p) => set({ print: p })} />
          </div>
          <div>
            <div className="tiny muted">Inside</div>
            <Options
              value={design.insert}
              options={(['none', 'tissue', 'sticker'] as const).map((k) => ({ v: k, label: k === 'none' ? 'Nothing' : `${k === 'tissue' ? 'Tissue paper' : 'Sticker'} +${money(INSERT_COST[k], true)}` }))}
              onChange={(i) => set({ insert: i })}
            />
          </div>
          <div className="row between tiny">
            <span>Unboxing score</span>
            <b>{Math.round(score * 100)}</b>
          </div>
          <Meter value={score} />
          <div className="tiny">Test customer: {reaction}</div>
          {score < 0.6 && design.color !== CATEGORY_VIBE[cat] && <div className="tiny muted"><Icon name="lightbulb" /> Think about who buys {cat} products. What style would they expect?</div>}
        </div>
      </div>
    </div>
  );
}

/** Mini-game: arrange the product page top to bottom and pick a theme. Shoppers read in a predictable order. */
export function LayoutBuilder({ brand }: { brand: Brand }) {
  const act = useGame((s) => s.act);
  const cat = categoryOf(brand);
  const active = MODULES.filter((m) => brand.store.modules[m.id] > 0).map((m) => m.id);
  const saved = (brand.store.order ?? []).filter((m) => active.includes(m));
  const order: ModuleId[] = [...saved, ...active.filter((m) => !saved.includes(m))];
  const score = layoutScore(order);
  const move = (i: number, dir: -1 | 1) => {
    const next = [...order];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    act(setStoreLayout, brand.id, next);
  };
  const theme = brand.theme ?? 'minimal';
  const issues: string[] = [];
  const idx = (m: ModuleId) => order.indexOf(m);
  if (idx('checkout') >= 0 && idx('checkout') < order.length - 1) issues.push('Shoppers reach checkout before they’re convinced.');
  if (idx('hero') > 1) issues.push('The hero image should be the first thing they see.');
  if (idx('reviews') >= 0 && idx('description') >= 0 && idx('reviews') < idx('description')) issues.push('Reviews make more sense after they know what it is.');
  if (idx('faq') >= 0 && idx('faq') < idx('description')) issues.push('An FAQ up top feels like you’re hiding something.');
  return (
    <div className="chat" style={{ marginTop: 12 }}>
      <b><Icon name="layout" /> Page layout & theme</b>
      <p className="tiny muted" style={{ margin: '4px 0 10px' }}>Order your sections top to bottom like a shopper scrolls: hook them, explain, prove it, reassure, then ask for the sale.</p>
      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <ol className="layout-list">
          {order.map((m, i) => {
            const meta = MODULES.find((x) => x.id === m)!;
            return (
              <li key={m}>
                <span>
                  {withIcons(meta.icon)} {meta.name}
                </span>
                <span>
                  <button className="small ghost" disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button className="small ghost" disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
        <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 8 }}>
          <div className="row between tiny">
            <span>Page flow</span>
            <b>{Math.round(score * 100)}</b>
          </div>
          <Meter value={score} />
          {issues.map((x) => (
            <div key={x} className="tiny bad-text">
              <Icon name="warning" /> {x}
            </div>
          ))}
          {!issues.length && score > 0.9 && <div className="tiny good-text"><Icon name="check" /> Reads like a great product page.</div>}
          <div className="tiny muted">Theme</div>
          <Options value={theme} options={(Object.keys(VIBES) as Vibe[]).map((k) => ({ v: k, label: VIBES[k].name }))} onChange={(t) => act(setStoreLayout, brand.id, order, t)} />
          <div className="theme-swatch" style={{ background: VIBES[theme].color, color: VIBES[theme].accent, fontFamily: VIBES[theme].font }}>
            {brand.name || 'Your brand'} · Aa
          </div>
          <div className="tiny muted">{theme === CATEGORY_VIBE[cat] ? <><Icon name="check" color="#1f9d55" /> Feels right for this category.</> : 'Does this look feel right for your customers?'}</div>
        </div>
      </div>
    </div>
  );
}

export { IDEAL_ORDER };
