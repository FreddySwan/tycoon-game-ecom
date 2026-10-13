import { useState } from 'react';
import { AMBITIONS, CATEGORIES, REGIONS, REGION_ORDER, SPACES, STAGES, STAGE_SPACE } from '../../sim/data';
import { brandTrailing, def, intlFactor, liveProducts, marketShare, trailing } from '../../sim/economics';
import { advanceStage, chooseAmbition, createBrand, enterRegion, labCost, labDays, openRegionalWarehouse, startLab } from '../../sim/engine';
import { ambitionChecks, stageChecks } from '../../sim/progress';
import type { AmbitionId, CategoryId, StageId } from '../../sim/types';
import { useGame } from '../../state/store';
import { AppTitle, Meter, Options } from '../bits';
import { money } from '../format';
import { Icon, withIcons } from '../icons';
import { FundingSection } from '../Funding';

export function Company() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const next = (game.stage + 1) as StageId;
  const checks = game.stage < 5 ? stageChecks(game, next) : [];
  const ready = checks.length > 0 && checks.every((c) => c.done);
  const space = game.stage < 5 ? SPACES[STAGE_SPACE[next]] : null;

  return (
    <div>
      <AppTitle app="Company" title={`Stage ${game.stage}: ${STAGES[game.stage].name}`} sub={STAGES[game.stage].desc} />

      <div className="stages">
        {([1, 2, 3, 4, 5] as StageId[]).map((st) => (
          <div key={st} className={`stage ${st === game.stage ? 'now' : st < game.stage ? 'done' : ''}`}>
            <b>{st}</b>
            <span>{STAGES[st].name}</span>
          </div>
        ))}
      </div>

      {game.stage < 5 && space && (
        <div className="chat" style={{ marginTop: 14 }}>
          <div className="row between">
            <h3 style={{ margin: 0 }}>Next: {STAGES[next].name}</h3>
            <span className="tiny muted">
              {space.name}: {money(space.deposit)} deposit · {money(space.rent)}/month
            </span>
          </div>
          {checks.map((c) => (
            <div key={c.label} style={{ margin: '8px 0' }}>
              <div className="row between tiny">
                <span>
                  <Icon name={c.done ? 'checkboxOn' : 'checkbox'} color={c.done ? '#1f9d55' : undefined} /> {c.label}
                </span>
                <b>{c.value}</b>
              </div>
              <Meter value={Math.min(1, c.progress)} />
            </div>
          ))}
          <p className="tiny">Unlocks: {STAGES[next].unlocks.join(' · ')}</p>
          {(() => {
            const cur = SPACES[game.space];
            const after = game.cash - space.deposit;
            const monthly = trailing(game, 30);
            const fixedNow = monthly.pl.payroll + monthly.pl.rent;
            return (
              <p className={`callout ${after < (space.rent + fixedNow) ? 'warn' : ''}`}>
                After the deposit you’d have <b>{money(after)}</b> in the bank. Rent goes from {money(cur.rent)} to <b>{money(space.rent)}/month</b> (payroll + rent now {money(fixedNow)}/month).
                {after < space.rent + fixedNow && ' That’s less than a month of fixed costs: consider waiting, or have your credit line ready.'}
              </p>
            );
          })()}
          <button className="primary" disabled={!ready} onClick={() => act(advanceStage)}>
            <Icon name="truck" /> Move to the {space.name.toLowerCase()} ({money(space.deposit)})
          </button>
          <p className="tiny muted">Growing is a choice. A small premium brand with loyal customers is a real strategy too.</p>
        </div>
      )}

      <FundingSection />

      <h3><Icon name="bullseye" /> Ambition</h3>
      {game.stage < 2 ? (
        <p className="tiny muted">Once you’re a growing brand, choose what kind of company you want to build.</p>
      ) : (
        <div className="cards">
          {(Object.keys(AMBITIONS) as AmbitionId[]).map((id) => {
            const a = AMBITIONS[id];
            const chosen = game.ambition === id;
            const done = game.ambitionsDone.includes(id);
            return (
              <div key={id} className={`card ${chosen ? 'selected' : ''}`}>
                <h4>
                  {withIcons(a.emoji)} {a.name} {done && <span className="pill good">achieved</span>}
                </h4>
                <p>{a.desc}</p>
                {chosen ? (
                  ambitionChecks(game, id).map((c) => (
                    <div key={c.label}>
                      <div className="row between tiny">
                        <span><Icon name={c.done ? 'checkboxOn' : 'checkbox'} color={c.done ? '#1f9d55' : undefined} /> {c.label}</span>
                        <b>{c.value}</b>
                      </div>
                      <Meter value={Math.min(1, c.progress)} />
                    </div>
                  ))
                ) : (
                  <button className="small" onClick={() => act(chooseAmbition, id)}>
                    Choose this
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <h3><Icon name="chartBar" /> Market share</h3>
      <table className="data">
        <tbody>
          {(Object.keys(CATEGORIES) as CategoryId[]).map((cat) => {
            const c = CATEGORIES[cat];
            const share = marketShare(game, cat);
            if (!liveProducts(game).some((pid) => def(game, pid).category === cat)) return null;
            return (
              <tr key={cat}>
                <td>
                  {withIcons(c.emoji)} {c.name}
                </td>
                <td style={{ width: 200 }}>
                  <Meter value={share / c.topCompetitor.share} />
                </td>
                <td className="num">{(share * 100).toFixed(2)}%</td>
                <td className="tiny muted">
                  {c.topCompetitor.name} leads with {Math.round(c.topCompetitor.share * 100)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {game.stage >= 4 && <Lab />}
      {game.stage >= 5 && <Brands />}
      {game.stage >= 5 && <World />}
    </div>
  );
}

function Lab() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const bases = liveProducts(game).filter((pid) => !def(game, pid).exclusive);
  const [base, setBase] = useState(bases[0] ?? '');
  const [levels, setLevels] = useState({ materials: 1, design: 1, features: 1 });
  const [name, setName] = useState('');
  const running = game.lab.find((l) => !l.done);
  return (
    <>
      <h3><Icon name="edit" /> Product Lab</h3>
      <p className="tiny muted">Design an exclusive product nobody can copy: fewer competitors, higher prices, immune to copycats. {game.team.designer.count ? `${game.team.designer.count} designer(s) speed things up.` : 'Hire a product designer to speed it up.'}</p>
      {running ? (
        <div className="callout">
          Working on <b>{running.name}</b>: ready on day {running.doneDay}.
          <Meter value={(game.day - running.startDay) / (running.doneDay - running.startDay)} />
        </div>
      ) : bases.length ? (
        <div className="chat">
          <div className="row">
            <span className="tiny">Start from</span>
            <select value={base} onChange={(e) => setBase(e.target.value)}>
              {bases.map((pid) => (
                <option key={pid} value={pid}>
                  {def(game, pid).name}
                </option>
              ))}
            </select>
            <input type="text" style={{ maxWidth: 240 }} placeholder="Name it (e.g. Pace Pro Bowl)" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {(['materials', 'design', 'features'] as const).map((k) => (
            <div key={k} className="row" style={{ marginTop: 6 }}>
              <span className="tiny" style={{ width: 80, textTransform: 'capitalize' }}>
                {k}
              </span>
              <Options value={levels[k]} options={[0, 1, 2, 3].map((v) => ({ v, label: ['None', 'Better', 'Great', 'Best'][v] }))} onChange={(v) => setLevels({ ...levels, [k]: v })} />
            </div>
          ))}
          <p className="tiny muted">Materials raise quality (and unit cost). Design raises price and conversion. Features raise price and, at max, demand.</p>
          <button className="primary" onClick={() => act(startLab, base, levels, name)}>
            Start project ({money(labCost(levels))}, {labDays(game, levels)} days)
          </button>
        </div>
      ) : (
        <p className="muted tiny">Sell a product first.</p>
      )}
    </>
  );
}

function Brands() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const [name, setName] = useState('');
  return (
    <>
      <h3><Icon name="colors" /> Brands</h3>
      <table className="data">
        <tbody>
          {game.brands.map((b, i) => {
            const t = brandTrailing(game, b.id, 30);
            return (
              <tr key={b.id}>
                <td>
                  <span style={{ color: b.color }}>●</span> <b>{b.name || 'Your brand'}</b>
                </td>
                <td className="tiny">{Object.values(game.products).filter((p) => p.brandId === b.id && !p.retired).length} products</td>
                <td className="num">{money(t.revenue)} rev</td>
                <td className={`num ${t.profit >= 0 ? 'good-text' : 'bad-text'}`}>{money(t.profit)}</td>
                <td className="tiny muted">{i === 0 || i <= game.team.brandmgr.count ? 'managed' : 'needs a brand manager'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 8 }}>
        <input type="text" style={{ maxWidth: 240 }} placeholder="New brand name" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          onClick={() => {
            if (!act(createBrand, name)) setName('');
          }}
        >
          Launch a brand ($25,000)
        </button>
      </div>
      <p className="tiny muted">Each brand gets its own store, customers and email list. Assign products in the Products app.</p>
    </>
  );
}

function World() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  return (
    <>
      <h3><Icon name="map" /> International</h3>
      <p className="tiny muted">Foreign markets add demand across all channels. Shipping from home is slow and converts at ~55%; a local warehouse fixes that but costs rent. Current foreign demand: +{Math.round(intlFactor(game) * 100)}%.</p>
      <table className="data">
        <tbody>
          {REGION_ORDER.map((id) => {
            const r = REGIONS[id];
            const st = game.regions[id];
            return (
              <tr key={id}>
                <td>
                  {r.flag} {r.name}
                </td>
                <td className="tiny">
                  +{Math.round(r.demand * 100)}% demand · duty {Math.round(r.duty * 100)}%
                </td>
                <td>
                  {!st?.entered ? (
                    <button className="small" onClick={() => act(enterRegion, id)}>
                      Enter ({money(r.setupCost)})
                    </button>
                  ) : st.warehouse ? (
                    <span className="pill good">Local warehouse</span>
                  ) : (
                    <button className="small" onClick={() => act(openRegionalWarehouse, id)}>
                      Open warehouse ({money(r.warehouseRent)}/mo)
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
