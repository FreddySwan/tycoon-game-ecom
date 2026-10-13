import { useEffect, useMemo, useState } from 'react';
import { dayOfYear } from '../sim/calendar';
import { CATEGORIES, MONTH, MONTH_NAMES, PACKAGING_COST } from '../sim/data';
import { def, hasSkill, roughKeep } from '../sim/economics';
import { completeInvestigation, digHours, digPool, research } from '../sim/engine';
import type { GameState, ProductDef } from '../sim/types';
import { useGame } from '../state/store';
import { money } from './format';
import { LineChart } from './LineChart';
import { ProductImage } from './photos';
import { seeded } from './seeded';
import { Icon, withIcons } from './icons';

const DIG_LINES = ['Scrolling Bazaarly bestseller lists…', 'Reading Reddit threads about annoying problems…', 'Watching what’s trending on Scrollr…', 'Checking Seekly search trends…'];

/** Dig and reveal: a short "searching" beat, then the product you turned up. */
export function DigReveal({ productId }: { productId: string }) {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const [found, setFound] = useState(false);
  const [line, setLine] = useState(0);
  const d = def(game, productId);
  const cat = CATEGORIES[d.category];

  useEffect(() => {
    const tick = setInterval(() => setLine((l) => l + 1), 380);
    const done = setTimeout(() => setFound(true), 1500);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [productId]);

  const again = () => {
    if (act(research)) return;
    const next = useGame.getState().game.revealed.at(-1);
    if (next) setModal({ kind: 'dig', productId: next });
  };

  return (
    <div className="overlay">
      <div className="modal center" style={{ width: 'min(460px, 100%)' }}>
        {!found ? (
          <div className="dig">
            <div className="dig-emojis">
              {(['search', 'trendingUp', 'cart', 'chat'] as const).map((e, i) => (
                <span key={e} style={{ animationDelay: `${i * 0.12}s` }}>
                  <Icon name={e} />
                </span>
              ))}
            </div>
            <h2>Digging…</h2>
            <p className="muted">{DIG_LINES[line % DIG_LINES.length]}</p>
          </div>
        ) : (
          <div className="dig-found">
            <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 800 }}>
              You found a lead
            </div>
            <ProductImage game={game} pid={productId} size={180} round={14} style={{ margin: '10px auto' }} />
            <h2 style={{ margin: '4px 0' }}>{d.name}</h2>
            <div className="tiny muted">
              {withIcons(cat.emoji)} {cat.name} · sells for ~{money(d.refPrice)}
            </div>
            <p>{d.tagline}</p>
            <p className="tiny muted">Is it any good? You don’t know yet. Investigate the market before you bet your savings on it.</p>
            <div style={{ display: 'grid', gap: 6 }}>
              {hasSkill(game, 'researchTool') ? (
                <button className="primary" onClick={() => setModal({ kind: 'quiz', productId })}>
                  <Icon name="search" /> Investigate the market (1h)
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={() => {
                    setModal(null);
                    useGame.getState().setTab('skills');
                  }}
                >
                  <Icon name="lock" /> Investigating needs a research tool: open SkillUp
                </button>
              )}
              <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
                <button className="small" onClick={again} disabled={!digPool(game).length}>
                  <Icon name="lightbulbOn" /> Dig again ({digHours(game)}h)
                </button>
                <button className="small ghost" onClick={() => setModal(null)}>
                  Back to the board
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── investigation quiz ─────────────────────────────

type TrendKind = ProductDef['trend']['kind'];

/** Search interest without the general holiday lift, so the product's own shape shows. */
function interest(d: ProductDef, day: number): number {
  const t = d.trend;
  if (t.kind === 'evergreen') return 1 + 0.06 * Math.sin(day / 9) + 0.03 * Math.sin(day / 3.7);
  if (t.kind === 'seasonal') {
    const [a, b, mult] = t.season!;
    const doy = dayOfYear(day);
    const ramp = doy >= a - 15 && doy < a ? (doy - (a - 15)) / 15 : 0;
    return doy >= a && doy <= b ? mult : 0.85 + ramp * (mult - 0.85) * 0.5 + 0.03 * Math.sin(day / 5);
  }
  const peak = t.peakDay ?? 30;
  const x = (day - peak) / 9;
  return day <= peak ? 0.7 + 1.3 * Math.exp(-x * x) : 0.25 + 1.75 * Math.exp(-x * x);
}

const TREND_OPTS: { v: TrendKind; label: string; why: string }[] = [
  { v: 'evergreen', label: 'Evergreen: steady all year', why: 'sells all year. Safe to stock deeper and build a brand on.' },
  { v: 'seasonal', label: 'Seasonal: spikes at one time of year', why: 'sells in one season. Stock up before the peak and don’t get stuck with boxes after it.' },
  { v: 'fad', label: 'Fad: shooting up fast, likely to crash', why: 'is a fad. Get in early, order small, and get out before it crashes.' },
];
const CROWD_OPTS = [
  { v: 'open', label: 'Wide open: few sellers, thin reviews' },
  { v: 'some', label: 'Some competition: room for a better product' },
  { v: 'crowded', label: 'Crowded: big brands with thousands of reviews' },
];

function crowdOf(n: number): string {
  return n <= 2 ? 'open' : n === 3 ? 'some' : 'crowded';
}

function buildQuiz(game: GameState, pid: string) {
  const d = def(game, pid);
  const rnd = seeded(game, pid);
  // Trend: 11 months back, 6 weeks ahead from Seekly's forecast
  const days: number[] = [];
  for (let k = -330; k <= 45; k += 5) days.push(game.day + k);
  const todayIdx = days.findIndex((x) => x >= game.day);
  const curve = days.map((x) => Math.round(interest(d, x) * 100 * (0.97 + rnd() * 0.06)));
  // Competition: page one of Bazaarly
  const comp = d.bars.competition;
  const baseReviews = [40, 180, 900, 3500, 12000][comp - 1];
  const sellers = comp * 14 + Math.round(rnd() * 8);
  const brands = ['Nordly', 'ProGear', 'HomeJoy', 'Valuemax', 'Brightside', 'Tidy&Co', 'Kova', 'Lumo'];
  const offset = Math.floor(rnd() * brands.length);
  const rivals = Array.from({ length: 5 }, (_, i) => ({
    name: `${brands[(offset + i * 3) % brands.length]} ${d.name.split(' ').slice(-1)[0]}`,
    price: Math.round(d.refPrice * (0.7 + rnd() * 0.6)),
    rating: Math.round((3.6 + rnd() * 1.1) * 10) / 10,
    reviews: Math.round(baseReviews * (1.6 - i * 0.3) * (0.7 + rnd() * 0.6)),
  }));
  // Unit economics
  const est = roughKeep(game, pid);
  const keep = est.keep;
  const wrong = [d.refPrice - d.baseUnitCost, keep * 0.45, keep + d.shipToCustomer + d.airFreight * 0.5];
  const options = [keep, ...wrong].map((v) => Math.round(v * 2) / 2);
  const order = options.map((v, i) => ({ v, i, r: rnd() })).sort((a, b) => a.r - b.r);
  return { d, days, todayIdx, curve, comp, sellers, rivals, est, keepOptions: order, answerIdx: 0 };
}

/** Investigation: read three bits of market data and call what they mean. Answers are explained afterwards. */
export function Investigate({ productId }: { productId: string }) {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const q = useMemo(() => buildQuiz(game, productId), [productId]); // eslint-disable-line react-hooks/exhaustive-deps
  const { d } = q;
  const [step, setStep] = useState(0);
  const [trend, setTrend] = useState<TrendKind | null>(null);
  const [crowd, setCrowd] = useState<string | null>(null);
  const [keep, setKeep] = useState<number | null>(null);

  const right = [trend === d.trend.kind, crowd === crowdOf(q.comp), keep === q.answerIdx];
  const score = right.filter(Boolean).length;
  const picked = [trend, crowd, keep][step];

  const finish = () => {
    if (!act(completeInvestigation, productId, score)) setStep(3);
  };

  const monthTick = (day: number) => MONTH_NAMES[Math.floor((dayOfYear(day) - 1) / MONTH) % 12];

  return (
    <div className="overlay">
      <div className="modal" style={{ width: 'min(720px, 100%)' }}>
        <div className="row between">
          <h2 style={{ margin: 0 }} className="row">
            <ProductImage game={game} pid={productId} size={34} round={8} /> Investigating: {d.name}
          </h2>
          <button className="small ghost" onClick={() => setModal(null)}>
            Close
          </button>
        </div>

        {step < 3 && (
          <>
            <div className="quiz-steps">
              {['Demand trend', 'Competition', 'Money per order'].map((label, i) => (
                <span key={label} className={i === step ? 'on' : i < step ? 'done' : ''}>
                  {i + 1}. {label}
                </span>
              ))}
            </div>

            {step === 0 && (
              <>
                <p className="callout">
                  <b>Seekly Trends</b> shows how many people searched for “{d.name.toLowerCase()}” over the past year, plus Seekly’s 6-week forecast. <b>What kind of product is this?</b>
                </p>
                <LineChart
                  height={170}
                  hideY
                  format={(v) => `${v} (index)`}
                  xLabels={q.days.map((x, i) => (i === q.todayIdx ? 'Today' : monthTick(x)))}
                  series={[
                    { key: 'past', label: 'Search interest', color: '#2f7fd8', values: q.curve.map((v, i) => (i <= q.todayIdx ? v : null)), area: true },
                    { key: 'fc', label: 'Forecast', color: '#2f7fd8', dashed: true, values: q.curve.map((v, i) => (i >= q.todayIdx ? v : null)) },
                  ]}
                  markers={[{ index: q.todayIdx, color: '#6b6570' }]}
                />
                {choices(TREND_OPTS, trend, (v) => setTrend(v as TrendKind))}
              </>
            )}

            {step === 1 && (
              <>
                <p className="callout">
                  <b>Bazaarly, page one</b> for “{d.name.toLowerCase()}”: <b>{q.sellers} sellers</b>. Here are the top five. <b>How crowded is this market?</b>
                </p>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Listing</th>
                      <th className="num">Price</th>
                      <th className="num">Rating</th>
                      <th className="num">Reviews</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.rivals.map((r, i) => (
                      <tr key={i}>
                        <td className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                          <ProductImage game={game} pid={productId} index={i % 3} size={30} round={6} style={{ filter: `hue-rotate(${i * 50}deg)` }} />
                          {r.name}
                        </td>
                        <td className="num">{money(r.price)}</td>
                        <td className="num">
                          <span style={{ color: '#f0a020' }}>★</span> {r.rating}
                        </td>
                        <td className="num">{r.reviews.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {choices(CROWD_OPTS, crowd, setCrowd)}
              </>
            )}

            {step === 2 && (
              <>
                <p className="callout">
                  <b>The numbers.</b> A factory quote and a shipping estimate. <b>Roughly how much do you keep from each order, before ads?</b>
                </p>
                <table className="data" style={{ maxWidth: 420 }}>
                  <tbody>
                    <tr>
                      <td>Customers pay</td>
                      <td className="num">{money(d.refPrice, true)}</td>
                    </tr>
                    <tr>
                      <td>Factory price per unit</td>
                      <td className="num">{money(d.baseUnitCost, true)}</td>
                    </tr>
                    <tr>
                      <td>Air freight to you, per unit</td>
                      <td className="num">{money(d.airFreight, true)}</td>
                    </tr>
                    <tr>
                      <td>Shipping it to the customer</td>
                      <td className="num">{money(d.shipToCustomer, true)}</td>
                    </tr>
                    <tr>
                      <td>Box & tape</td>
                      <td className="num">{money(PACKAGING_COST.basic, true)}</td>
                    </tr>
                    <tr>
                      <td>Payment fees</td>
                      <td className="num">3% + $0.30</td>
                    </tr>
                  </tbody>
                </table>
                {choices(
                  q.keepOptions.map((o) => ({ v: o.i, label: `About ${money(o.v, true)} per order` })),
                  keep,
                  (v) => setKeep(v as number),
                )}
              </>
            )}

            <div className="row" style={{ marginTop: 12 }}>
              {step > 0 && (
                <button className="ghost" onClick={() => setStep(step - 1)}>
                  Back
                </button>
              )}
              <button className="primary" disabled={picked === null} onClick={() => (step === 2 ? finish() : setStep(step + 1))}>
                {step === 2 ? 'Finish investigation (1h)' : 'Next'}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <div>
            <div className="center" style={{ textAlign: 'center' }}>
              <div className="huge"><Icon name={score === 3 ? 'bullseye' : score === 2 ? 'happy' : 'neutral'} /></div>
              <h2 style={{ marginTop: 0 }}>Market read: {score}/3</h2>
              {score === 3 && <p className="callout good">Sharp read. That investigation was quick: the founder hour is on the house.</p>}
            </div>
            <ul>
              <li>
                {right[0] ? <Icon name="check" color="#1f9d55" /> : <Icon name="close" color="#d64545" />} <b>{d.name}</b> {TREND_OPTS.find((o) => o.v === d.trend.kind)?.why}
              </li>
              <li>
                {right[1] ? <Icon name="check" color="#1f9d55" /> : <Icon name="close" color="#d64545" />} {q.sellers} sellers, top listings with up to {Math.max(...q.rivals.map((r) => r.reviews)).toLocaleString()} reviews: <b>{CROWD_OPTS.find((o) => o.v === crowdOf(q.comp))?.label.split(':')[0].toLowerCase()}</b>.{' '}
                {q.comp >= 4 ? 'You’ll need a sharper angle and more ad money to stand out.' : q.comp <= 2 ? 'Easy to get noticed, but check that people actually want it.' : 'Beat them on photos, reviews and a clear benefit.'}
              </li>
              <li>
                {right[2] ? <Icon name="check" color="#1f9d55" /> : <Icon name="close" color="#d64545" />} You keep about <b>{money(q.est.keep, true)}</b>: {money(d.refPrice, true)} − {money(q.est.landed, true)} landed − {money(d.shipToCustomer, true)} shipping − {money(PACKAGING_COST.basic, true)} box − {money(q.est.fees, true)} fees.{' '}
                {q.est.keep < 10 ? 'Thin: ads will eat most of that.' : q.est.keep > 15 ? 'Healthy room for ads.' : 'Workable if ads are efficient.'}
              </li>
            </ul>
            <p className="tiny muted">Demand, competition and search volume are now on the product’s card. A deep dive reads the reviews and finds your angle.</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="primary" onClick={() => setModal({ kind: 'scan', productId })}>
                <Icon name="zoomIn" /> Deep dive (2h)
              </button>
              <button className="ghost" onClick={() => setModal(null)}>
                Back to the board
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function choices<T extends string | number>(opts: { v: T; label: string }[], value: T | null, set: (v: T) => void) {
    return (
      <div className="quiz-choices">
        {opts.map((o) => (
          <button key={String(o.v)} className={value === o.v ? 'on' : ''} onClick={() => set(o.v)}>
            {o.label}
          </button>
        ))}
      </div>
    );
  }
}
