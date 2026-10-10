import { useEffect, useMemo, useState } from 'react';
import { STARTING_CASH, SUPPLIERS } from '../sim/data';
import { averageRating, product } from '../sim/economics';
import { handPack, inspectSample, MILESTONE_LABELS, resolveEvent, scorePhoto, setFlag, takePhoto } from '../sim/engine';
import { PICS } from './apps/Wall';
import type { PhotoChoice, SupplierId } from '../sim/types';
import { sfx } from '../state/sound';
import { useGame } from '../state/store';
import { Options } from './bits';
import { money, stars } from './format';

export function Modals() {
  const modal = useGame((s) => s.modal);
  const game = useGame((s) => s.game);
  const crisis = game.events.find((e) => e.blocking);

  if (!game.flags.introSeen) return <Intro />;
  if (game.status === 'lost') return <Lost />;
  if (crisis) return <Crisis />;
  if (game.won && !game.flags.winSeen && !modal) return <Won />;
  if (!modal) return null;
  switch (modal.kind) {
    case 'unbox':
      return <Unbox supplierId={modal.supplierId as SupplierId} />;
    case 'photo':
      return <Photo />;
    case 'pack':
      return <Pack orderId={modal.orderId} />;
    case 'milestone':
      return <Milestone text={modal.text} />;
  }
}

function Shell({ children, center = false, onClose }: { children: React.ReactNode; center?: boolean; onClose?: () => void }) {
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${center ? 'center' : ''}`}>{children}</div>
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
        You just quit a job you didn’t love. You have a laptop, <b>{money(STARTING_CASH)}</b> in savings, a corner of a studio apartment, and a cat called
        Invoice.
      </p>
      <p>
        Your goal: launch one product and make your <b>first profitable reorder</b>. That means restocking at least 300 units while keeping your
        savings intact.
      </p>
      <p className="tiny muted">Rent is $900 every 30 days. Time only moves when you press ▶ or skip ahead.</p>
      <button className="primary" onClick={() => act(setFlag, 'introSeen')}>
        Open the laptop
      </button>
    </Shell>
  );
}

function Unbox({ supplierId }: { supplierId: SupplierId }) {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const [angle, setAngle] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const [inspected, setInspected] = useState(false);
  const p = product(game);
  const sup = SUPPLIERS[supplierId];
  const realStars = sup.quality < 0.7 ? 2 : sup.quality < 0.9 ? 4 : 5;

  return (
    <Shell onClose={() => setModal(null)}>
      <h2>📦 Sample from {sup.company}</h2>
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
        <span style={{ display: 'inline-block', transform: `rotateY(${angle}deg) rotate(${angle / 8}deg)`, transition: drag === null ? 'transform 0.3s' : 'none' }}>{p.emoji}</span>
      </div>
      {!inspected ? (
        <button
          className="primary"
          onClick={() => {
            if (!act(inspectSample, supplierId)) setInspected(true);
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
            <p style={{ margin: '8px 0 0' }}>📝 {p.sampleNotes[supplierId]}</p>
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

function Photo() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const p = product(game);
  const [c, setC] = useState<PhotoChoice>(game.store.photo ?? { backdrop: 'sheet', light: 'overhead', prop: 'none', angle: 'top' });
  const [result, setResult] = useState<number | null>(null);

  return (
    <Shell onClose={() => setModal(null)}>
      <h2>📸 Kitchen-table photo shoot</h2>
      <p className="muted tiny">💡 {p.photoTip}</p>
      <div
        className="pack-stage"
        style={{
          background: c.backdrop === 'floor' ? 'repeating-linear-gradient(90deg,#d9a874 0 40px,#cf9b66 40px 42px)' : BACKDROPS[c.backdrop],
          filter: LIGHT[c.light],
          transform: c.angle === 'top' ? 'perspective(400px) rotateX(25deg)' : c.angle === 'eye' ? 'none' : 'perspective(400px) rotateX(10deg)',
        }}
      >
        <span>{p.emoji}</span>
        {c.prop === 'cat' && <span style={{ fontSize: 50 }}>🐈</span>}
        {c.prop === 'accessory' && <span style={{ fontSize: 40 }}>✨</span>}
        {c.light === 'lamp' && <span style={{ position: 'absolute', top: 10, right: 16, fontSize: 28 }}>💡</span>}
        {c.light === 'window' && <span style={{ position: 'absolute', top: 10, left: 16, fontSize: 28 }}>🪟</span>}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <Options value={c.backdrop} options={[{ v: 'countertop', label: 'Countertop' }, { v: 'floor', label: 'Wooden floor' }, { v: 'sheet', label: 'White sheet' }]} onChange={(v) => setC((prev) => ({ ...prev, backdrop: v }))} />
        <Options value={c.light} options={[{ v: 'window', label: 'Window light' }, { v: 'lamp', label: 'Desk lamp' }, { v: 'overhead', label: 'Ceiling light' }]} onChange={(v) => setC((prev) => ({ ...prev, light: v }))} />
        <Options value={c.prop} options={[{ v: 'none', label: 'No prop' }, { v: 'cat', label: 'Invoice the cat' }, { v: 'accessory', label: p.accessoryName }]} onChange={(v) => setC((prev) => ({ ...prev, prop: v }))} />
        <Options value={c.angle} options={[{ v: 'top', label: 'Top-down' }, { v: 'angled', label: '45° angle' }, { v: 'eye', label: 'Eye level' }]} onChange={(v) => setC((prev) => ({ ...prev, angle: v }))} />
      </div>
      {result !== null && (
        <p className={`callout ${result >= 4 ? 'good' : result <= 2 ? 'bad' : ''}`} style={{ marginTop: 12 }}>
          Shot quality: <b>{stars(result)}</b>
          {result >= game.store.photoStars ? ' · Saved as your hero photo.' : ` · Your best is still ${stars(game.store.photoStars)}.`}
        </p>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="primary"
          onClick={() => {
            if (!act(takePhoto, c)) {
              sfx.click();
              setResult(scorePhoto(game, c));
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

function Pack({ orderId }: { orderId: number }) {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const order = game.backlog.find((o) => o.id === orderId);
  const steps = useMemo(
    () => ['Fold box', 'Add product', ...(game.offer.thankYouCard ? ['Thank-you card'] : []), 'Tape it', 'Label'],
    [game.offer.thankYouCard],
  );
  const [step, setStep] = useState(0);
  const p = product(game);
  if (!order) return null;
  const visuals = ['📄', '📦', p.emoji, '💌', '📦', '🏷️'];
  const visual = step === 0 ? '🗞️' : step >= steps.length ? '📦✅' : steps[step - 1] === 'Add product' ? `📦${p.emoji}` : visuals[Math.min(step + 1, 5)];

  const advance = () => {
    if (step >= steps.length) return;
    const name = steps[step];
    if (name === 'Tape it') sfx.tape();
    else sfx.click();
    const next = step + 1;
    setStep(next);
    if (next === steps.length) {
      setTimeout(() => {
        if (!act(handPack, orderId)) {
          const nextOrder = useGame.getState().game.backlog[0];
          setModal(nextOrder && !useGame.getState().game.batchPacking ? { kind: 'pack', orderId: nextOrder.id } : null);
        } else setModal(null);
      }, 450);
    }
  };

  return (
    <Shell onClose={() => setModal(null)}>
      <h2>Packing for {order.customer}</h2>
      <p className="muted tiny">
        {order.city} · {order.bundle ? '2-pack bundle' : '1 unit'} · click the table to do each step
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
  return (
    <>
      <Confetti />
      <Shell center onClose={() => setModal(null)}>
        <div className="huge">{PICS[(Object.keys(MILESTONE_LABELS) as (keyof typeof MILESTONE_LABELS)[]).find((k) => MILESTONE_LABELS[k] === text) ?? 'first_sale'] ?? '📸'}</div>
        <p className="tiny muted">MILESTONE</p>
        <h2>{text}</h2>
        <p className="muted">A new polaroid for the corkboard.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="primary" onClick={() => setModal(null)}>
            Nice!
          </button>
          <button
            className="ghost"
            onClick={() => {
              setModal(null);
              setTab('wall');
            }}
          >
            See the wall
          </button>
        </div>
      </Shell>
    </>
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
        {ev.choices.map((c) => (
          <button key={c.id} className={c.id === 'loan' ? 'primary' : ''} onClick={() => act(resolveEvent, ev.id, c.id)}>
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
  const revenue = game.history.reduce((a, d) => a + d.revenue, 0);
  const ads = game.history.reduce((a, d) => a + d.adSpend, 0);
  return (
    <table className="data" style={{ margin: '10px 0' }}>
      <tbody>
        <tr>
          <td>Days in business</td>
          <td className="num">{game.day}</td>
        </tr>
        <tr>
          <td>Orders shipped</td>
          <td className="num">{game.shipped}</td>
        </tr>
        <tr>
          <td>Revenue</td>
          <td className="num">{money(revenue)}</td>
        </tr>
        <tr>
          <td>Ad spend</td>
          <td className="num">{money(ads)}</td>
        </tr>
        <tr>
          <td>Rating</td>
          <td className="num">{game.reviews.length ? `${averageRating(game).toFixed(1)}★ (${game.reviews.length})` : '—'}</td>
        </tr>
        <tr>
          <td>Days out of stock</td>
          <td className="num">{game.stockoutDays}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Won() {
  const act = useGame((s) => s.act);
  const newGame = useGame((s) => s.newGame);
  const game = useGame((s) => s.game);
  return (
    <>
      <Confetti />
      <Shell center>
        <div className="huge">🎉</div>
        <h2>First profitable reorder!</h2>
        <p>
          You restocked from profit and still have your savings. The kitchen-table business works. {game.stockoutDays <= 3 ? 'And you barely ran out of stock. Impressive.' : `You ran out of stock for ${game.stockoutDays} days. Next time, reorder earlier.`}
        </p>
        <Recap />
        <p className="tiny muted">Stage 2 (a real workspace and your first hire) is next on the roadmap.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="primary" onClick={() => act(setFlag, 'winSeen')}>
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
  const ads = game.history.reduce((a, d) => a + d.adSpend, 0);
  const lockedInStock = game.inventory.costTotal + game.pos.filter((p) => p.status !== 'arrived').reduce((a, p) => a + p.totalCost, 0);
  return (
    <Shell center>
      <div className="huge">📉</div>
      <h2>The business ran out of cash</h2>
      <p>It happens to real founders all the time. Here’s what the numbers say:</p>
      <Recap />
      <div className="callout" style={{ textAlign: 'left' }}>
        {lockedInStock > game.cash + 500 && <p style={{ margin: '0 0 6px' }}>📦 {money(lockedInStock)} was locked up in stock when the cash ran out.</p>}
        {ads > 0 && <p style={{ margin: '0 0 6px' }}>📣 You spent {money(ads)} on ads. Did every campaign beat your break-even cost per order?</p>}
        <p style={{ margin: 0 }}>💡 Watch the Cash River projection. It warns you before the money runs out.</p>
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
    const t = setTimeout(clear, 2600);
    return () => clearTimeout(t);
  }, [toast, clear]);
  return toast ? <div className="toast">{toast}</div> : null;
}
