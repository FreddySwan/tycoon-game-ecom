import { Fragment } from 'react';
import { MODULES, STORE_SUBSCRIPTION, VIBES } from '../../sim/data';
import type { ModuleId } from '../../sim/types';
import { averageRating, def, hasSkill, trustBreakdown } from '../../sim/economics';
import { canShoot, hirePhotographer, launchProblems, launchStore, onStore, setBrandName, setModule, toggleBenefit } from '../../sim/engine';
import { useGame } from '../../state/store';
import { AppTitle, Meter } from '../bits';
import { money, stars } from '../format';
import { ProductPicker, useProduct } from '../ProductPicker';
import { ProductImage, ProductShot } from '../photos';
import { LayoutBuilder } from '../Startup';
import { Icon, withIcons } from '../icons';

export function ShopBloc() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const brandId = useGame((s) => s.brand);
  const setBrand = useGame((s) => s.setBrand);
  const brand = game.brands.find((b) => b.id === brandId) ?? game.brands[0];
  const pid = useProduct();
  const problems = launchProblems(game, brand.id);

  return (
    <div>
      <AppTitle app="ShopBloc" title={brand.store.launched ? `${brand.name} is live` : 'Build your store'} sub="Switch modules on, upgrade them, and give every product a great page." />
      {game.brands.length > 1 && (
        <div className="picker">
          {game.brands.map((b) => (
            <button key={b.id} className={b.id === brand.id ? 'on' : ''} onClick={() => setBrand(b.id)}>
              <span style={{ color: b.color }}>●</span> {b.name}
            </button>
          ))}
        </div>
      )}
      <div className="builder">
        <div>
          {storeCard()}
          <p className="tiny muted">Brand name</p>
          <input type="text" value={brand.name} placeholder="e.g. Pawsitive Pace" onChange={(e) => act(setBrandName, brand.id, e.target.value)} />
          <h3>Store modules</h3>
          {MODULES.map((m) => {
            const tier = brand.store.modules[m.id];
            return (
              <div key={m.id} className={`module ${tier ? 'on' : ''}`}>
                <span className="icon">{withIcons(m.icon)}</span>
                <div className="grow">
                  <b>
                    {m.name}
                    {m.required && <span className="tiny muted"> · required</span>}
                  </b>
                  <div className="tiny muted">{tier ? m.tiers[tier - 1].name : m.desc}</div>
                </div>
                {tier === 0 && (
                  <button className="small" onClick={() => act(setModule, brand.id, m.id, 1)}>
                    Add
                  </button>
                )}
                {tier > 0 && tier < m.tiers.length && (
                  <button className="small" onClick={() => act(setModule, brand.id, m.id, tier + 1)} title={m.tiers[tier].name}>
                    <Icon name="arrowUp" /> {m.tiers[tier].cost && !game.flags[`bought-${brand.id}-${m.id}-${tier + 1}`] ? money(m.tiers[tier].cost) : 'Upgrade'}
                  </button>
                )}
                {tier > 0 && (
                  <button className="small ghost" onClick={() => act(setModule, brand.id, m.id, 0)} title="Remove">
                    <Icon name="close" />
                  </button>
                )}
              </div>
            );
          })}
          {Object.values(brand.store.modules).some((t) => t > 0) && <LayoutBuilder brand={brand} />}
          {!brand.store.launched && (
            <div style={{ marginTop: 12 }}>
              {problems.length > 0 && <p className="tiny muted">To launch: {problems.join(' · ')}</p>}
              <button className="primary" disabled={problems.length > 0} onClick={() => act(launchStore, brand.id)}>
                <Icon name="checklist" /> Launch store ({money(STORE_SUBSCRIPTION)}/month)
              </button>
            </div>
          )}
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Product pages</h3>
          <ProductPicker />
          {pid && productPage(pid)}
        </div>
      </div>
    </div>
  );

  function storeCard() {
    const q = brand.store.quality;
    const ready = brand.store.readyDay ?? 0;
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between">
          <b>
            <Icon name="layout" /> Store builder
          </b>
          {q != null && <span className={`pill ${q >= 0.75 ? 'good' : q >= 0.5 ? '' : 'warn'}`}>Quality {Math.round(q * 100)}%</span>}
        </div>
        {q == null ? (
          <p className="tiny" style={{ margin: '6px 0' }}>
            Design your product page: headline, hero image, what goes above the fold, trust, and how it looks on a phone. Your calls set the store’s quality, and quality sets conversion.
          </p>
        ) : !brand.store.launched && ready > game.day ? (
          <p className="tiny" style={{ margin: '6px 0' }}>
            <Icon name="hourglass" /> Your developer is setting it up: ready in {ready - game.day} day{ready - game.day === 1 ? '' : 's'}.
          </p>
        ) : (
          <div style={{ margin: '6px 0' }}>
            <Meter value={q} />
            <p className="tiny muted" style={{ margin: '4px 0 0' }}>
              Higher quality lifts conversion on every visit. {hasSkill(game, 'storeCourse') ? '' : 'The “Store Pages That Convert” course in SkillUp adds +10% and hints.'}
            </p>
          </div>
        )}
        <button className={q == null ? 'primary small' : 'small'} onClick={() => setModal({ kind: 'build', brandId: brand.id })}>
          {q == null ? 'Open the store builder (4h)' : 'Rebuild pages (4h)'}
        </button>
      </div>
    );
  }

  function productPage(pid: string) {
    const p = game.products[pid];
    const d = def(game, pid);
    const trust = trustBreakdown(game, pid);
    return (
      <>
        <div className="row between" style={{ marginBottom: 6 }}>
          <b><Icon name="camera" /> Photo</b>
          <span>{p.photo ? <span className="pill good">{stars(p.photoStars)}</span> : <span className="pill warn">None yet</span>}</span>
        </div>
        <div className="row">
          <button className="small" onClick={() => setModal({ kind: 'photo', productId: pid })} disabled={!canShoot(game, pid)}>
            {p.photo ? 'Reshoot (2h)' : 'Photo shoot (2h)'}
          </button>
          {game.stage >= 2 && p.photoStars < 5 && (
            <button className="small" onClick={() => act(hirePhotographer, pid)}>
              Hire a pro ($400, 5★)
            </button>
          )}
          {!canShoot(game, pid) && <span className="tiny muted">Needs a sample or stock</span>}
        </div>
        <p className="tiny muted" style={{ margin: '12px 0 4px' }}>
          Benefits in the description ({p.benefits.length}/3)
        </p>
        <div className="options">
          {d.benefits.map((b) => (
            <button key={b.id} className={p.benefits.includes(b.id) ? 'on' : ''} onClick={() => act(toggleBenefit, pid, b.id)} title={game.positioning[pid] === b.id ? 'Answers the #1 complaint about rivals' : ''}>
              {b.text}
              {game.positioning[pid] === b.id && <> <Icon name="bullseye" /></>}
            </button>
          ))}
        </div>
        <p className="tiny muted">Bold claims sell, but a promise the product can’t keep comes back as returns.</p>
        <div className="row between" style={{ marginTop: 10 }}>
          <b>Shopper trust</b>
          <b>{Math.round(trust.total * 100)}</b>
        </div>
        <Meter value={trust.total - 0.4} max={0.9} />
        <div className="tiny muted" style={{ margin: '6px 0 10px' }}>
          {trust.parts.map((x) => (
            <span key={x.label} style={{ marginRight: 10 }} className={x.value < 0 ? 'bad-text' : ''}>
              {x.label} {x.value > 0 ? '+' : ''}
              {Math.round(x.value * 100)}
            </span>
          ))}
        </div>
        {preview(pid)}
        {brand.store.launched && !onStore(game, pid) && <p className="callout warn tiny">Not on sale yet: needs a photo and at least one benefit.</p>}
      </>
    );
  }

  function preview(pid: string) {
    const p = game.products[pid];
    const d = def(game, pid);
    const m = brand.store.modules;
    const theme = VIBES[brand.theme ?? 'minimal'];
    const doubts: string[] = [];
    if (!m.shipping) doubts.push('“When will it arrive?”');
    if (!m.badges) doubts.push('“Is checkout safe?”');
    if (!m.reviews || !p.reviews.count) doubts.push('“Has anyone bought this?”');
    if (p.photoStars && p.photoStars < 3) doubts.push('“The photo looks cheap.”');
    const blocks: Partial<Record<ModuleId, React.ReactNode>> = {
      header: (
        <div className="blk" style={{ fontWeight: 800, background: brand.theme ? theme.color : m.header === 2 ? '#2b2d42' : undefined, color: brand.theme ? theme.accent : m.header === 2 ? '#fff' : undefined, fontFamily: brand.theme ? theme.font : undefined }}>
          {m.header === 2 ? '✦ ' : ''}
          {brand.name || 'Your Brand'}
        </div>
      ),
      hero: (
        <div className="blk" style={{ padding: 0, overflow: 'hidden' }}>
          {p.photo ? (
            <ProductShot game={game} pid={pid} choice={p.photo} height={150}>
              {m.hero === 2 && <span style={{ position: 'absolute', right: 8, bottom: 6, fontSize: 22 }}>▶️</span>}
            </ProductShot>
          ) : (
            <div className="hero">No photo yet</div>
          )}
        </div>
      ),
      gallery: (
        <div className="blk row" style={{ gap: 4 }}>
          {[0, 1, 2].map((i) => (
            <ProductImage key={i} game={game} pid={pid} index={i} size={48} round={6} style={m.gallery === 2 ? undefined : { filter: 'saturate(0.8) brightness(0.95)' }} />
          ))}
          {m.gallery === 2 && <span className="tiny muted">pro shots</span>}
        </div>
      ),
      description: (
        <div className="blk">
          <b>{d.name}</b> · ${p.price}
          <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
            {p.benefits.map((id) => (
              <li key={id}>
                {d.benefits.find((b) => b.id === id)?.text}
                {game.positioning[pid] === id && <> <Icon name="bullseye" /></>}
              </li>
            ))}
          </ul>
        </div>
      ),
      reviews: <div className="blk">{p.reviews.count ? `${'★'.repeat(Math.round(averageRating(game, pid)))} ${p.reviews.count} reviews` : 'No reviews yet'}</div>,
      badges: <div className="blk"><Icon name="shield" /> Secure checkout · 30-day money back</div>,
      faq: <div className="blk"><Icon name="infoBox" /> FAQ</div>,
      shipping: <div className="blk"><Icon name="truck" /> Ships in 1–2 days{m.shipping === 2 ? ' · Free returns' : ''}</div>,
      checkout: <div className="blk" style={{ background: brand.theme ? theme.accent : '#f0a860', color: '#fff', fontWeight: 800, textAlign: 'center' }}>{m.checkout === 2 ? ' Pay · Buy now' : 'Add to cart'}</div>,
    };
    const active = MODULES.filter((x) => m[x.id] > 0).map((x) => x.id);
    const saved = (brand.store.order ?? []).filter((x) => active.includes(x));
    const order = [...saved, ...active.filter((x) => !saved.includes(x))];
    return (
      <div className="preview">
        <div className="bar"><Icon name="lock" /> {(brand.name || 'yourbrand').toLowerCase().replace(/\s+/g, '')}.shopbloc.com</div>
        {order.map((id) => (
          <Fragment key={id}>{blocks[id]}</Fragment>
        ))}
        {doubts.length > 0 && <div className="blk tiny" style={{ background: '#fff4d6' }}><Icon name="neutral" /> Shopper doubts: {doubts.join(' ')}</div>}
      </div>
    );
  }
}
