import { MODULES, STORE_SUBSCRIPTION } from '../../sim/data';
import { averageRating, product, trustBreakdown } from '../../sim/economics';
import { launchProblems, launchStore, setBrandName, setModule, toggleBenefit } from '../../sim/engine';
import { useGame } from '../../state/store';
import { AppTitle, Meter } from '../bits';
import { money, stars } from '../format';

export function ShopBloc() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const p = product(game);
  const st = game.store;
  const trust = trustBreakdown(game);
  const problems = launchProblems(game);
  const hasSample = game.samples.some((x) => x.arrived);

  return (
    <div>
      <AppTitle
        app="ShopBloc"
        title={st.launched ? `${st.brandName} is live` : 'Build your store'}
        sub="Drag-free store building: switch modules on, upgrade them, and watch shopper trust change."
      />
      <div className="builder">
        <div>
          <p className="tiny muted">Brand name</p>
          <input type="text" value={st.brandName} placeholder={p.id === 'dogbowl' ? 'e.g. Pawsitive Pace' : 'Your brand'} onChange={(e) => act(setBrandName, e.target.value)} />

          <div className="row between" style={{ margin: '14px 0 6px' }}>
            <b>📸 Product photo</b>
            <span>{st.photo ? <span className="pill good">{stars(st.photoStars)}</span> : <span className="pill warn">None yet</span>}</span>
          </div>
          <button onClick={() => setModal({ kind: 'photo' })} disabled={!hasSample}>
            {st.photo ? 'Reshoot (2h)' : 'Photo shoot (2h)'}
          </button>
          {!hasSample && <span className="tiny muted"> Needs a sample</span>}

          <h3>Modules</h3>
          {MODULES.map((m) => {
            const tier = st.modules[m.id];
            return (
              <div key={m.id} className={`module ${tier ? 'on' : ''}`}>
                <span className="icon">{m.icon}</span>
                <div className="grow">
                  <b>
                    {m.name}
                    {m.required && <span className="tiny muted"> · required</span>}
                  </b>
                  <div className="tiny muted">{tier ? m.tiers[tier - 1].name : m.desc}</div>
                </div>
                {tier === 0 && (
                  <button className="small" onClick={() => act(setModule, m.id, 1)}>
                    Add
                  </button>
                )}
                {tier > 0 && tier < m.tiers.length && (
                  <button className="small" onClick={() => act(setModule, m.id, tier + 1)} title={m.tiers[tier].name}>
                    ⬆ {m.tiers[tier].name}
                    {m.tiers[tier].cost && !game.flags[`bought-${m.id}-${tier + 1}`] ? ` ${money(m.tiers[tier].cost)}` : ''}
                  </button>
                )}
                {tier > 0 && (
                  <button className="small ghost" onClick={() => act(setModule, m.id, 0)} title="Remove">
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {st.modules.description > 0 && (
            <>
              <h3>Description benefits ({st.benefits.length}/3)</h3>
              <div className="options">
                {p.benefits.map((b) => (
                  <button key={b.id} className={st.benefits.includes(b.id) ? 'on' : ''} onClick={() => act(toggleBenefit, b.id)}>
                    {b.text}
                  </button>
                ))}
              </div>
              <p className="tiny muted">Bold claims sell, but a promise the product can’t keep comes back as returns.</p>
            </>
          )}
        </div>

        <div>
          <div className="row between">
            <b>Shopper trust</b>
            <b>{Math.round(trust.total * 100)}</b>
          </div>
          <Meter value={trust.total - 0.4} max={0.9} />
          <div className="tiny muted" style={{ margin: '6px 0 12px' }}>
            {trust.parts.map((x) => (
              <span key={x.label} style={{ marginRight: 10 }} className={x.value < 0 ? 'bad-text' : ''}>
                {x.label} {x.value > 0 ? '+' : ''}
                {Math.round(x.value * 100)}
              </span>
            ))}
          </div>
          <StorePreview />
          {!st.launched && (
            <div style={{ marginTop: 12 }}>
              {problems.length > 0 && <p className="tiny muted">To launch: {problems.join(' · ')}</p>}
              <button className="primary" disabled={problems.length > 0} onClick={() => act(launchStore)}>
                🚀 Launch store ({money(STORE_SUBSCRIPTION)}/month)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StorePreview() {
  const game = useGame((s) => s.game);
  const p = product(game);
  const st = game.store;
  const m = st.modules;
  const doubts: string[] = [];
  if (!m.shipping) doubts.push('“When will it arrive?”');
  if (!m.badges) doubts.push('“Is checkout safe?”');
  if (!m.reviews || !game.reviews.length) doubts.push('“Has anyone bought this?”');
  if (st.photoStars && st.photoStars < 3) doubts.push('“The photo looks cheap.”');

  return (
    <div className="preview">
      <div className="bar">🔒 {(st.brandName || 'yourbrand').toLowerCase().replace(/\s+/g, '')}.shopbloc.com</div>
      {m.header > 0 && (
        <div className="blk" style={{ fontWeight: 800, background: m.header === 2 ? '#2b2d42' : undefined, color: m.header === 2 ? '#fff' : undefined }}>
          {m.header === 2 ? '✦ ' : ''}
          {st.brandName || 'Your Brand'}
        </div>
      )}
      {m.hero > 0 && (
        <div className="blk hero" style={{ filter: `saturate(${0.4 + st.photoStars * 0.15})` }}>
          {p.emoji}
          {st.photo?.prop === 'cat' ? '🐈' : ''}
          {m.hero === 2 && <span style={{ fontSize: 14 }}> ▶︎</span>}
        </div>
      )}
      {m.gallery > 0 && <div className="blk">🖼 🖼 🖼 {m.gallery === 2 ? '(pro shots)' : ''}</div>}
      <div className="blk">
        <b>{p.name}</b> · ${game.offer.price}
        {m.description > 0 && (
          <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
            {st.benefits.map((id) => (
              <li key={id}>{p.benefits.find((b) => b.id === id)?.text}</li>
            ))}
          </ul>
        )}
      </div>
      {m.reviews > 0 && (
        <div className="blk">
          {game.reviews.length ? `${'★'.repeat(Math.round(averageRating(game)))} ${game.reviews.length} reviews` : 'No reviews yet'}
        </div>
      )}
      {m.badges > 0 && <div className="blk">🛡 Secure checkout · 30-day money back</div>}
      {m.faq > 0 && <div className="blk">❓ FAQ</div>}
      {m.shipping > 0 && <div className="blk">🚚 Ships in 1–2 days{m.shipping === 2 ? ' · Free returns' : ''}</div>}
      {m.checkout > 0 && (
        <div className="blk" style={{ background: '#f0a860', color: '#fff', fontWeight: 800, textAlign: 'center' }}>
          {m.checkout === 2 ? ' Pay · Buy now' : 'Add to cart'}
        </div>
      )}
      {doubts.length > 0 && <div className="blk tiny" style={{ background: '#fff4d6' }}>🤔 Shopper doubts: {doubts.join(' ')}</div>}
    </div>
  );
}
