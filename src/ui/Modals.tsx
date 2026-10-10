import { useEffect, useMemo, useState } from 'react';
import { AMBITIONS, STARTING_CASH, SUPPLIERS } from '../sim/data';
import { averageRating, brandOf, def, profitOf } from '../sim/economics';
import { handPack, inspectSample, MILESTONE_LABELS, MILESTONE_PICS, nextHandPack, resolveEvent, sampleNote, scorePhoto, setFlag, takePhoto } from '../sim/engine';
import type { MilestoneId, PhotoChoice, SupplierId } from '../sim/types';
import { sfx } from '../state/sound';
import { useGame } from '../state/store';
import { Options } from './bits';
import { money, stars } from './format';

export function Modals() {
  const modal = useGame((s) => s.modal);
  const game = useGame((s) => s.game);
  const crisis = game.events.find((e) => e.blocking);
  const ambition = game.ambitionsDone.find((id) => !game.flags[`amb-${id}`]);

  if (!game.flags.introSeen) return <Intro />;
  if (game.status === 'lost') return <Lost />;
  if (crisis) return <Crisis />;
  if (ambition && !modal) return <Ambition id={ambition} />;
  if (game.won && !game.flags.winSeen && !modal) return <Won />;
  if (!modal) return null;
  switch (modal.kind) {
    case 'unbox':
      return <Unbox productId={modal.productId} supplierId={modal.supplierId as SupplierId} />;
    case 'photo':
      return <Photo productId={modal.productId} />;
    case 'pack':
      return <Pack />;
    case 'milestone':
      return <Milestone text={modal.text} />;
    case 'report':
      return <Report />;
  }
}

function Shell({ children, center = false, onClose, wide = false }: { children: React.ReactNode; center?: boolean; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${center ? 'center' : ''}`} style={wide ? { width: 'min(680px, 100%)' } : undefined}>
        {children}
      </div>
    </div>
  );
}

function Intro() {
  const act = useGame((s) => s.act);
  return (
    <Shell center>
      <div className="huge">📦</div>
      <h2>Unboxed</h2>
      <p>
        You just quit a job you didn’t love. You have a laptop, <b>{money(STARTING_CASH)}</b> in savings, a corner of a studio apartment, and a cat called Invoice.
      </p>
      <p>
        First goal: launch one product and make your <b>first profitable reorder</b>. After that, the road runs from your kitchen table to a garage, a warehouse, an HQ, and maybe a global company. Or a small brand people love. Your call.
      </p>
      <p className="tiny muted">Rent is $900 every 30 days. Time only moves when you press ▶ or skip ahead.</p>
      <button className="primary" onClick={() => act(setFlag, 'introSeen')}>
        Open the laptop
      </button>
    </Shell>
  );
}

function Unbox({ productId, supplierId }: { productId: string; supplierId: SupplierId }) {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const [angle, setAngle] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const [inspected, setInspected] = useState(false);
  const d = def(game, productId);
  const sup = SUPPLIERS[supplierId];
  const realStars = sup.quality < 0.7 ? 2 : sup.quality < 0.9 ? 4 : 5;

  return (
    <Shell onClose={() => setModal(null)}>
      <h2>📦 {d.name} sample from {sup.company}</h2>
      <p className="muted">Drag to turn it around. Look closely before you trust the listing.</p>
      <div
        className="inspect"
        onPointerDown={(e) => setDrag(e.clientX)}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
        onPointerMove={(e) => {
          if (drag === null) return;
          setAngle((a) => a + (e.clientX - drag) * 1.5);
          setDrag(e.clientX);
        }}
      >
        <span style={{ display: 'inline-block', transform: `rotateY(${angle}deg) rotate(${angle / 8}deg)`, transition: drag === null ? 'transform 0.3s' : 'none' }}>{d.emoji}</span>
      </div>
      {!inspected ? (
        <button
          className="primary"
          onClick={() => {
            if (!act(inspectSample, productId, supplierId)) setInspected(true);
          }}
        >
          🔍 Inspect closely (30 min)
        </button>
      ) : (
        <>
          <div className="callout">
            <div className="row between">
              <span>Listing claims</span>
              <b>{stars(sup.qualityStars)}</b>
            </div>
            <div className="row between">
              <span>Your verdict</span>
              <b className={realStars < sup.qualityStars ? 'bad-text' : 'good-text'}>{stars(realStars)}</b>
            </div>
            <p style={{ margin: '8px 0 0' }}>📝 {sampleNote(game, productId, supplierId)}</p>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" onClick={() => setModal(null)}>
              Got it
            </button>
          </div>
        </>
      )}
    </Shell>
  );
}

const BACKDROPS = { countertop: '#e9e4dc', floor: '#d9a874', sheet: '#ffffff' } as const;
const LIGHT = { window: 'brightness(1.08) saturate(1.1)', lamp: 'brightness(0.8) sepia(0.35)', overhead: 'brightness(1.15) contrast(0.85)' } as const;

function Photo({ productId }: { productId: string }) {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const d = def(game, productId);
  const p = game.products[productId];
  const [c, setC] = useState<PhotoChoice>(p.photo ?? { backdrop: 'sheet', light: 'overhead', prop: 'none', angle: 'top' });
  const [result, setResult] = useState<number | null>(null);

  return (
    <Shell onClose={() => setModal(null)}>
      <h2>📸 Photo shoot: {d.name}</h2>
      <p className="muted tiny">💡 {d.photoTip}</p>
      <div
        className="pack-stage"
        style={{
          background: c.backdrop === 'floor' ? 'repeating-linear-gradient(90deg,#d9a874 0 40px,#cf9b66 40px 42px)' : BACKDROPS[c.backdrop],
          filter: LIGHT[c.light],
          transform: c.angle === 'top' ? 'perspective(400px) rotateX(25deg)' : c.angle === 'eye' ? 'none' : 'perspective(400px) rotateX(10deg)',
        }}
      >
        <span>{d.emoji}</span>
        {c.prop === 'cat' && <span style={{ fontSize: 50 }}>🐈</span>}
        {c.prop === 'accessory' && <span style={{ fontSize: 40 }}>✨</span>}
        {c.light === 'lamp' && <span style={{ position: 'absolute', top: 10, right: 16, fontSize: 28 }}>💡</span>}
        {c.light === 'window' && <span style={{ position: 'absolute', top: 10, left: 16, fontSize: 28 }}>🪟</span>}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <Options value={c.backdrop} options={[{ v: 'countertop', label: 'Countertop' }, { v: 'floor', label: 'Wooden floor' }, { v: 'sheet', label: 'White sheet' }]} onChange={(v) => setC((prev) => ({ ...prev, backdrop: v }))} />
        <Options value={c.light} options={[{ v: 'window', label: 'Window light' }, { v: 'lamp', label: 'Desk lamp' }, { v: 'overhead', label: 'Ceiling light' }]} onChange={(v) => setC((prev) => ({ ...prev, light: v }))} />
        <Options value={c.prop} options={[{ v: 'none', label: 'No prop' }, { v: 'cat', label: 'Invoice the cat' }, { v: 'accessory', label: d.accessoryName }]} onChange={(v) => setC((prev) => ({ ...prev, prop: v }))} />
        <Options value={c.angle} options={[{ v: 'top', label: 'Top-down' }, { v: 'angled', label: '45° angle' }, { v: 'eye', label: 'Eye level' }]} onChange={(v) => setC((prev) => ({ ...prev, angle: v }))} />
      </div>
      {result !== null && (
        <p className={`callout ${result >= 4 ? 'good' : result <= 2 ? 'bad' : ''}`} style={{ marginTop: 12 }}>
          Shot quality: <b>{stars(result)}</b>
          {result >= p.photoStars ? ' · Saved as the hero photo.' : ` · Your best is still ${stars(p.photoStars)}.`}
        </p>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="primary"
          onClick={() => {
            if (!act(takePhoto, productId, c)) {
              sfx.click();
              setResult(scorePhoto(game, productId, c));
            }
          }}
        >
          📷 Take photo (2h)
        </button>
        <button className="ghost" onClick={() => setModal(null)}>
          Done
        </button>
      </div>
    </Shell>
  );
}

function Pack() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const order = nextHandPack(game);
  const brand = order ? brandOf(game, order.productId) : null;
  const steps = useMemo(() => ['Fold box', 'Add product', ...(brand?.thankYouCard ? ['Thank-you card'] : []), 'Tape it', 'Label'], [brand?.thankYouCard]);
  const [step, setStep] = useState(0);
  const [packed, setPacked] = useState(0);
  if (!order) {
    return (
      <Shell center onClose={() => setModal(null)}>
        <div className="huge">✅</div>
        <h2>All packed!</h2>
        <p className="muted">{packed ? `You packed ${packed} order${packed === 1 ? '' : 's'}.` : 'Nothing waiting.'} Invoice the cat approves.</p>
        <button className="primary" onClick={() => setModal(null)}>
          Back to work
        </button>
      </Shell>
    );
  }
  const d = def(game, order.productId);
  const visual = step === 0 ? '🗞️' : step >= steps.length ? '📦✅' : steps[step - 1] === 'Add product' ? `📦${d.emoji}` : steps[step - 1] === 'Thank-you card' ? '📦💌' : steps[step - 1] === 'Tape it' ? '📦' : '📦';

  const advance = () => {
    if (step >= steps.length) return;
    if (steps[step] === 'Tape it') sfx.tape();
    else sfx.click();
    const next = step + 1;
    setStep(next);
    if (next === steps.length) {
      setTimeout(() => {
        if (act(handPack)) setModal(null);
        else {
          setPacked((n) => n + 1);
          setStep(0);
          if (useGame.getState().game.batchPacking) setModal(null);
        }
      }, 400);
    }
  };

  return (
    <Shell onClose={() => setModal(null)}>
      <h2>Packing for {order.customer ?? 'a customer'}</h2>
      <p className="muted tiny">
        {order.city ?? ''} · {d.name} · click the table for each step
      </p>
      <div className="pack-stage" onClick={advance} style={{ cursor: 'pointer' }}>
        {visual}
        {step >= steps.length - 1 && step > 0 && (
          <span style={{ position: 'absolute', bottom: 14, fontSize: 13, background: '#fff', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>
            To: {order.customer}, {order.city}
          </span>
        )}
      </div>
      <div className="pack-steps">
        {steps.map((s, i) => (
          <span key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>
            {s}
          </span>
        ))}
      </div>
    </Shell>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        color: ['#f0a860', '#1f9d55', '#3a7bd5', '#d64545', '#f6c945'][i % 5],
      })),
    [],
  );
  return (
    <div className="confetti">
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s` }} />
      ))}
    </div>
  );
}

function Milestone({ text }: { text: string }) {
  const setModal = useGame((s) => s.setModal);
  const setTab = useGame((s) => s.setTab);
  const id = (Object.keys(MILESTONE_LABELS) as MilestoneId[]).find((k) => MILESTONE_LABELS[k] === text);
  const moving = id?.startsWith('moved_');
  return (
    <>
      <Confetti />
      <Shell center onClose={() => setModal(null)}>
        <div className="huge">{id ? MILESTONE_PICS[id] : '📸'}</div>
        <p className="tiny muted">MILESTONE</p>
        <h2>{text}</h2>
        <p className="muted">{moving ? 'New space, new possibilities. Check the Company app for what just unlocked.' : 'A new polaroid for the corkboard.'}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="primary" onClick={() => setModal(null)}>
            Nice!
          </button>
          <button
            className="ghost"
            onClick={() => {
              setModal(null);
              setTab(moving ? 'company' : 'wall');
            }}
          >
            {moving ? 'What’s new?' : 'See the wall'}
          </button>
        </div>
      </Shell>
    </>
  );
}

function Report() {
  const game = useGame((s) => s.game);
  const setModal = useGame((s) => s.setModal);
  const r = game.reports[game.reports.length - 1];
  if (!r) return null;
  const prev = game.reports[game.reports.length - 2];
  const growth = prev && prev.pl.revenue ? (r.pl.revenue - prev.pl.revenue) / prev.pl.revenue : null;
  return (
    <Shell onClose={() => setModal(null)}>
      <h2>📊 Month {r.month} in review</h2>
      <div className="funnel">
        <div>
          <b>{money(r.pl.revenue)}</b>revenue{growth !== null && <div className={`tiny ${growth >= 0 ? 'good-text' : 'bad-text'}`}>{growth >= 0 ? '▲' : '▼'} {Math.abs(Math.round(growth * 100))}%</div>}
        </div>
        <div>
          <b className={r.profit >= 0 ? 'good-text' : 'bad-text'}>{money(profitOf(r.pl))}</b>profit
        </div>
        <div>
          <b>{r.orders.toLocaleString()}</b>orders
        </div>
      </div>
      <ul>
        {r.highlights.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      <p className="tiny muted">Biggest costs: {(['cogs', 'ads', 'fulfillment', 'payroll', 'fees'] as const).map((k) => `${k === 'cogs' ? 'product' : k} ${money(r.pl[k])}`).join(' · ')}</p>
      <button className="primary" onClick={() => setModal(null)}>
        Onward
      </button>
    </Shell>
  );
}

function Crisis() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const ev = game.events.find((e) => e.blocking)!;
  return (
    <Shell center>
      <div className="huge">😬</div>
      <h2>{ev.title}</h2>
      <p>{ev.body}</p>
      <div className="choices" style={{ justifyContent: 'center' }}>
        {ev.choices.map((c, i) => (
          <button key={c.id} className={i === 0 ? 'primary' : ''} onClick={() => act(resolveEvent, ev.id, c.id)}>
            {c.label}
            <small>{c.hint}</small>
          </button>
        ))}
      </div>
    </Shell>
  );
}

function Recap() {
  const game = useGame((s) => s.game);
  const revenue = game.counters.revenueLifetime ?? 0;
  return (
    <table className="data" style={{ margin: '10px 0' }}>
      <tbody>
        <tr>
          <td>Days in business</td>
          <td className="num">{game.day}</td>
        </tr>
        <tr>
          <td>Stage</td>
          <td className="num">{game.stage}</td>
        </tr>
        <tr>
          <td>Orders shipped</td>
          <td className="num">{game.shipped.toLocaleString()}</td>
        </tr>
        <tr>
          <td>Lifetime revenue</td>
          <td className="num">{money(revenue)}</td>
        </tr>
        <tr>
          <td>Rating</td>
          <td className="num">{averageRating(game) ? `${averageRating(game).toFixed(2)}★` : '—'}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Won() {
  const act = useGame((s) => s.act);
  return (
    <>
      <Confetti />
      <Shell center>
        <div className="huge">🎉</div>
        <h2>First profitable reorder!</h2>
        <p>You restocked from profit and still have your savings. The kitchen-table business works.</p>
        <p>
          Next: earn <b>$3,000 a month in profit</b> (or ship 1,000 orders) and a garage unit opens up, with room for your first employees.
        </p>
        <Recap />
        <button className="primary" onClick={() => act(setFlag, 'winSeen')}>
          Keep building
        </button>
      </Shell>
    </>
  );
}

function Ambition({ id }: { id: keyof typeof AMBITIONS }) {
  const act = useGame((s) => s.act);
  const newGame = useGame((s) => s.newGame);
  const a = AMBITIONS[id];
  return (
    <>
      <Confetti />
      <Shell center>
        <div className="huge">{a.emoji}</div>
        <p className="tiny muted">AMBITION ACHIEVED</p>
        <h2>{a.name}</h2>
        <p>{a.desc}</p>
        <p>From a laptop and a cat in a studio apartment to this. Invoice is very proud (and asleep in a box).</p>
        <Recap />
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="primary" onClick={() => act(setFlag, `amb-${id}`)}>
            Keep playing
          </button>
          <button className="ghost" onClick={newGame}>
            New game
          </button>
        </div>
      </Shell>
    </>
  );
}

function Lost() {
  const newGame = useGame((s) => s.newGame);
  const game = useGame((s) => s.game);
  const locked = Object.values(game.products).reduce((a, p) => a + p.inventory.costTotal, 0) + game.pos.filter((p) => p.status !== 'arrived').reduce((a, p) => a + p.totalCost, 0);
  return (
    <Shell center>
      <div className="huge">📉</div>
      <h2>The business ran out of cash</h2>
      <p>It happens to real founders all the time. Here’s what the numbers say:</p>
      <Recap />
      <div className="callout" style={{ textAlign: 'left' }}>
        {locked > 1000 && <p style={{ margin: '0 0 6px' }}>📦 {money(locked)} was locked up in stock when the cash ran out.</p>}
        <p style={{ margin: 0 }}>💡 Watch the Cash River projection in Finance. It warns you before the money runs out.</p>
      </div>
      <button className="primary" style={{ marginTop: 12 }} onClick={newGame}>
        Try again
      </button>
    </Shell>
  );
}

export function Toast() {
  const toast = useGame((s) => s.toast);
  const clear = useGame((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clear, 2800);
    return () => clearTimeout(t);
  }, [toast, clear]);
  return toast ? <div className="toast">{toast}</div> : null;
}
