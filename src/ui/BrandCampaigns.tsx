import { BRAND_CAMPAIGNS, type CampaignKind } from '../sim/data';
import { campaignEfficiency, launchCampaign } from '../sim/engine';
import { useGame } from '../state/store';
import { money } from './format';
import { Icon } from './icons';

/** Ads app, stage 3+: big brand campaigns that build awareness for months. */
export function BrandCampaigns() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const running = (game.campaigns ?? []).filter((c) => game.day >= c.start && game.day < c.start + c.days);
  const eff = campaignEfficiency(game);
  const awareness = game.brands.reduce((a, b) => a + b.awareness, 0);
  return (
    <div>
      <p className="tiny muted">
        Performance ads buy orders today. Brand campaigns buy awareness: more shoppers find your store on their own for months, and billboards and TV lift marketplace rank too. They’re expensive and overlap: campaigns running at the same time share an audience
        ({Math.round(eff * 100)}% effective right now).
      </p>
      <div className="kpis">
        <div className="kpi">
          <div className="k">Brand awareness</div>
          <div className="v">{Math.round(awareness).toLocaleString()}</div>
          <div className="s">people who know your name</div>
        </div>
        <div className="kpi">
          <div className="k">Running now</div>
          <div className="v">{running.length}</div>
          <div className="s">{running.map((c) => BRAND_CAMPAIGNS[c.kind as CampaignKind].name).join(', ') || 'none'}</div>
        </div>
      </div>
      <div className="cards" style={{ marginTop: 10 }}>
        {(Object.keys(BRAND_CAMPAIGNS) as CampaignKind[]).map((k) => {
          const c = BRAND_CAMPAIGNS[k];
          const locked = game.stage < c.minStage;
          return (
            <div key={k} className="card">
              <b>
                <Icon name={k === 'tv' ? 'tv' : k === 'podcast' ? 'headset' : 'image'} /> {c.name}
              </b>
              <span className="tiny">{c.desc}</span>
              <span className="tiny muted">
                {money(c.cost)} · {c.days} days · ~{Math.round(c.awareness * eff).toLocaleString()} awareness
              </span>
              <button className="small primary" disabled={locked || game.cash < c.cost} onClick={() => confirm(`Spend ${money(c.cost)} on ${c.name.toLowerCase()}?`) && act(launchCampaign, k)}>
                {locked ? `Stage ${c.minStage}` : `Launch · ${money(c.cost)}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
