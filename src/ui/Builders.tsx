import { useMemo, useState } from 'react';
import { HOOK_FIT, hooksFor, MARKET_SCAN } from '../sim/data';
import { def, hasSkill, liveProducts } from '../sim/economics';
import { completeCreativeResearch, completeStoreBuild, creativeQualityFrom, STORE_BUILD_DAYS, storeQualityFrom } from '../sim/engine';
import type { CategoryId, GameState, HookType } from '../sim/types';
import { useGame } from '../state/store';
import { Icon } from './icons';
import { ProductImage } from './photos';

/** Deterministic shuffle so options don't move around between renders. */
function shuffled<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  return items
    .map((v) => ({ v, k: r() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.v);
}

interface Opt {
  id: string;
  label: string;
  points: number;
}

function Steps({ labels, step }: { labels: string[]; step: number }) {
  return (
    <div className="quiz-steps">
      {labels.map((l, i) => (
        <span key={l} className={i === step ? 'on' : i < step ? 'done' : ''}>
          {i + 1}. {l}
        </span>
      ))}
    </div>
  );
}

function Choices({ opts, value, onPick, multi }: { opts: Opt[]; value: string[]; onPick: (id: string) => void; multi?: boolean }) {
  return (
    <div className="quiz-choices">
      {opts.map((o) => (
        <button key={o.id} className={value.includes(o.id) ? 'on' : ''} onClick={() => onPick(o.id)}>
          {multi && <Icon name={value.includes(o.id) ? 'checkboxOn' : 'checkbox'} />} {o.label}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────────── store builder ─────────────────────────────

const ABOVE_FOLD: Opt[] = [
  { id: 'price', label: 'Price', points: 1 },
  { id: 'cart', label: 'Add-to-cart button', points: 1 },
  { id: 'rating', label: 'Star rating & review count', points: 1 },
  { id: 'shipping', label: 'Shipping promise', points: 1 },
  { id: 'popup', label: 'Newsletter popup', points: -1 },
  { id: 'video', label: 'Autoplay video with sound', points: -1 },
  { id: 'insta', label: 'Instagram feed', points: 0 },
  { id: 'story', label: 'About-us story', points: 0 },
];

function storeQuiz(game: GameState, pid: string, brandName: string) {
  const d = def(game, pid);
  const scan = MARKET_SCAN[d.baseId ?? d.id];
  const best = d.benefits.find((b) => b.id === game.positioning[pid]) ?? d.benefits.filter((b) => !b.returns).sort((a, b) => b.cvr - a.cvr)[0];
  return [
    {
      title: 'Headline',
      prompt: <>Your product page needs one headline at the top. <b>Which one sells?</b></>,
      tip: 'Lead with the one thing the shopper gets, ideally the fix for what annoys them about rivals.',
      opts: shuffled<Opt>(
        [
          { id: 'benefit', label: `“${best.text}”`, points: 1 },
          { id: 'welcome', label: `“Welcome to ${brandName || 'our store'}! Quality products for everyone.”`, points: 0 },
          { id: 'features', label: `“${d.benefits.map((b) => b.text).join(' · ')}”`, points: 0.3 },
          { id: 'hype', label: `“The #1 BEST ${d.name.toUpperCase()} EVER!!! LIMITED TIME!!!”`, points: 0 },
        ],
        pid + 'h',
      ),
    },
    {
      title: 'Hero image',
      prompt: <>The big picture at the top of the page. <b>What should it show?</b></>,
      tip: 'Show the product being used: shoppers picture themselves owning it. A clean shot belongs in the gallery.',
      opts: shuffled<Opt>(
        [
          { id: 'inuse', label: 'The product in use, in a real home', points: 1 },
          { id: 'clean', label: 'A clean product shot on white', points: 0.5 },
          { id: 'logo', label: 'Your logo on a color block', points: 0 },
          { id: 'stock', label: 'A stock photo of a smiling family', points: 0 },
        ],
        pid + 'i',
      ),
      image: true,
    },
    {
      title: 'Above the fold',
      prompt: <>Shoppers decide in seconds. <b>Pick the 3 things that must be visible without scrolling.</b></>,
      tip: 'Price, the buy button and proof (stars) answer “how much, how do I get it, is it any good?”',
      opts: ABOVE_FOLD,
      multi: 3,
    },
    {
      title: 'Trust',
      prompt: <>Nobody has heard of your brand. <b>What removes the most doubt?</b></>,
      tip: 'Take the risk off the shopper. Fake urgency and pushy popups make a new brand look shady.',
      opts: shuffled<Opt>(
        [
          { id: 'guarantee', label: '30-day money-back guarantee, shown near the button', points: 1 },
          { id: 'timer', label: 'A countdown timer: “Offer ends in 9:59”', points: 0 },
          { id: 'chat', label: 'A chat bubble that pops up after 3 seconds', points: 0.2 },
          { id: 'values', label: 'A long story about your brand values', points: 0.2 },
        ],
        pid + 't',
      ),
    },
    {
      title: 'Mobile check',
      prompt: <>7 in 10 shoppers are on a phone. Here’s your page on one. <b>What’s the biggest problem?</b></>,
      tip: 'On a phone, the buy button has to be reachable with a thumb, not under a wall of text.',
      opts: shuffled<Opt>(
        [
          { id: 'buried', label: 'The add-to-cart button is buried under a wall of text', points: 1 },
          { id: 'font', label: 'The font isn’t fancy enough', points: 0 },
          { id: 'logo', label: 'The logo is too small', points: 0 },
          { id: 'colors', label: 'It needs more colors', points: 0 },
        ],
        pid + 'm',
      ),
      mobile: true,
      complaint: scan?.complaint,
    },
  ];
}

/** Store builder: five calls about what makes a product page sell. The score sets store quality (conversion). */
export function StoreBuilder({ brandId }: { brandId: number }) {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const brand = game.brands.find((b) => b.id === brandId) ?? game.brands[0];
  const pid = Object.keys(game.products).find((id) => game.products[id].brandId === brand.id && !game.products[id].retired) ?? liveProducts(game)[0];
  const quiz = useMemo(() => (pid ? storeQuiz(game, pid, brand.name) : []), [pid]); // eslint-disable-line react-hooks/exhaustive-deps
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<string[][]>(quiz.map(() => []));
  const course = hasSkill(game, 'storeCourse');
  if (!pid) return null;

  const scoreOf = (i: number) => {
    const q = quiz[i];
    const pts = picks[i].reduce((a, id) => a + (q.opts.find((o) => o.id === id)?.points ?? 0), 0);
    return q.multi ? Math.max(0, Math.min(1, pts / q.multi)) : pts;
  };
  const score = quiz.reduce((a, _, i) => a + scoreOf(i), 0);
  const done = step >= quiz.length;
  const q = quiz[step];
  const pick = (id: string) =>
    setPicks((p) => {
      const next = [...p];
      const cur = next[step];
      if (q.multi) next[step] = cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < q.multi ? [...cur, id] : cur;
      else next[step] = [id];
      return next;
    });
  const finish = () => {
    if (!act(completeStoreBuild, brand.id, score)) setStep(quiz.length);
  };
  const d = def(game, pid);

  return (
    <div className="overlay">
      <div className="modal" style={{ width: 'min(720px, 100%)' }}>
        <div className="row between">
          <h2 style={{ margin: 0 }} className="row">
            <Icon name="layout" /> Store builder: {brand.name || 'your store'}
          </h2>
          <button className="small ghost" onClick={() => setModal(null)}>
            Close
          </button>
        </div>
        {!done && (
          <>
            <Steps labels={quiz.map((x) => x.title)} step={step} />
            <p className="callout">{q.prompt}</p>
            {course && (
              <p className="tiny" style={{ color: '#1f7a45' }}>
                <Icon name="teach" /> Course tip: {q.tip}
              </p>
            )}
            {'image' in q && q.image && (
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <ProductImage game={game} pid={pid} index={1} size={90} round={8} />
                <ProductImage game={game} pid={pid} index={0} size={90} round={8} />
              </div>
            )}
            {'mobile' in q && q.mobile && (
              <div className="phone-mock">
                <div className="pm-bar">{brand.name || 'Your store'}</div>
                <ProductImage game={game} pid={pid} index={1} size="100%" round={0} style={{ height: 90 }} />
                <b className="tiny">{d.name}</b>
                <div className="pm-text">
                  {d.tagline} {d.benefits.map((b) => b.text).join('. ')}. Our story began in a tiny apartment with a big dream and a cat named Invoice…
                </div>
                <div className="pm-text">Shipping & returns · Materials · Care instructions · FAQ · Our values</div>
                <div className="pm-btn">Add to cart</div>
              </div>
            )}
            <Choices opts={q.opts} value={picks[step]} onPick={pick} multi={!!q.multi} />
            <div className="row" style={{ marginTop: 12 }}>
              {step > 0 && (
                <button className="ghost" onClick={() => setStep(step - 1)}>
                  Back
                </button>
              )}
              <button className="primary" disabled={!picks[step].length || (!!q.multi && picks[step].length < q.multi)} onClick={() => (step === quiz.length - 1 ? finish() : setStep(step + 1))}>
                {step === quiz.length - 1 ? 'Build the store (4h)' : 'Next'}
              </button>
            </div>
          </>
        )}
        {done && (
          <div>
            <div style={{ textAlign: 'center' }}>
              <div className="huge">
                <Icon name={score >= 4 ? 'trophy' : score >= 2.5 ? 'happy' : 'neutral'} />
              </div>
              <h2 style={{ marginTop: 0 }}>Store quality: {Math.round(storeQualityFrom(game, score) * 100)}%</h2>
              <p className="muted">
                {score.toFixed(1)}/5 right calls{course ? ' + course bonus' : ''}. Better pages convert more of every visitor you pay for.
              </p>
            </div>
            <ul>
              {quiz.map((x, i) => (
                <li key={x.title}>
                  {scoreOf(i) >= 0.99 ? <Icon name="check" color="#1f9d55" /> : scoreOf(i) > 0 ? <Icon name="neutral" color="#c0712c" /> : <Icon name="close" color="#d64545" />} <b>{x.title}:</b> {x.tip}
                </li>
              ))}
            </ul>
            {!brand.store.launched && (
              <p className="callout">
                Your developer needs {STORE_BUILD_DAYS} days to set it all up. Then hit Launch in ShopBloc. You can rebuild later to raise the quality.
              </p>
            )}
            <button className="primary" onClick={() => setModal(null)}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── competitor creative research ─────────────────────────────

/** The hook style that's winning in each category right now. */
const WINNING: Record<CategoryId, HookType> = { pets: 'emotional', home: 'benefit', desk: 'problem', kitchen: 'benefit', fitness: 'problem' };
const BRANDS = ['Nordly', 'HomeJoy', 'Kova', 'Lumo', 'ProGear', 'Brightside'];

interface RivalAd {
  id: string;
  brand: string;
  format: string;
  hook: string;
  type: HookType;
  likes: string;
  days: number;
  comments: string[];
  winner: boolean;
}

function rivalAds(game: GameState, pid: string): RivalAd[] {
  const d = def(game, pid);
  const hooks = hooksFor(d);
  const win = WINNING[d.category];
  const of = (t: HookType) => hooks.find((h) => h.type === t)?.text ?? hooks[0].text;
  const other = (['problem', 'benefit', 'emotional'] as HookType[]).filter((t) => t !== win);
  const scan = MARKET_SCAN[d.baseId ?? d.id];
  const ads: RivalAd[] = [
    { id: 'w1', brand: BRANDS[0], format: 'Photo', hook: of(win), type: win, likes: '2.1k', days: 74, comments: ['Just ordered two!', 'Link?? Need this'], winner: true },
    { id: 'w2', brand: BRANDS[1], format: 'Video', hook: of(win), type: win, likes: '890', days: 51, comments: ['Where can I buy this?', 'Bought one last month, love it'], winner: true },
    { id: 'viral', brand: BRANDS[2], format: 'Video', hook: of(other[0]), type: other[0], likes: '48k', days: 3, comments: ['lmaooo', 'tag a friend who needs this'], winner: false },
    { id: 'angry', brand: BRANDS[3], format: 'Photo', hook: of(other[1]), type: other[1], likes: '1.4k', days: 58, comments: [scan ? `${scan.complaint}.` : 'Broke after a week.', 'Still waiting for my refund'], winner: false },
    { id: 'new', brand: BRANDS[4], format: 'UGC', hook: of('social'), type: 'social', likes: '120', days: 5, comments: ['Nice', 'Cute'], winner: false },
    { id: 'urgent', brand: BRANDS[5], format: 'Photo', hook: of('urgency'), type: 'urgency', likes: '310', days: 12, comments: ['Is this a scam?', 'Same ad every day lol'], winner: false },
  ];
  return shuffled(ads, pid + 'ads');
}

/** Competitor creative research: spot the ads that make money, see what they share, write yours. */
export function CreativeResearch({ productId }: { productId: string }) {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const d = def(game, productId);
  const ads = useMemo(() => rivalAds(game, productId), [productId]); // eslint-disable-line react-hooks/exhaustive-deps
  const win = WINNING[d.category];
  const hooks = hooksFor(d);
  const scan = MARKET_SCAN[d.baseId ?? d.id];
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [type, setType] = useState<HookType | null>(null);
  const [headline, setHeadline] = useState<string | null>(null);
  const [opener, setOpener] = useState<string | null>(null);

  const headlines = useMemo(() => shuffled(hooks.filter((h) => !h.needsReviews).filter((h, i, arr) => arr.findIndex((x) => x.type === h.type) === i).slice(0, 4), productId + 'hl'), [productId]); // eslint-disable-line react-hooks/exhaustive-deps
  const openers: Opt[] = useMemo(
    () =>
      shuffled(
        [
          { id: 'voice', label: scan ? `“I was so done with the old one: ${scan.complaint.toLowerCase()}. This one actually fixed it.”` : `“I didn’t think I needed this. Now I use it every day.”`, points: 1 },
          { id: 'corporate', label: '“We are proud to introduce our innovative new product.”', points: 0 },
          { id: 'shout', label: '“BUY NOW!!! 50% OFF!!! ONLY TODAY!!!”', points: 0 },
        ],
        productId + 'op',
      ),
    [productId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const s1 = chosen.filter((id) => ads.find((a) => a.id === id)?.winner).length;
  const s2 = type === win ? 1 : 0;
  const s3 = (hooks.find((h) => h.id === headline)?.type === win ? 1 : 0) + (openers.find((o) => o.id === opener)?.points ?? 0);
  const score = s1 + s2 + s3;
  const winHook = hooks.find((h) => h.id === headline && h.type === win)?.id;
  const finish = () => {
    if (!act(completeCreativeResearch, productId, score, winHook)) setStep(3);
  };

  return (
    <div className="overlay">
      <div className="modal" style={{ width: 'min(760px, 100%)' }}>
        <div className="row between">
          <h2 style={{ margin: 0 }} className="row">
            <ProductImage game={game} pid={productId} size={34} round={8} /> Ad research: {d.name}
          </h2>
          <button className="small ghost" onClick={() => setModal(null)}>
            Close
          </button>
        </div>
        {step < 3 && <Steps labels={['Spot the winners', 'Find the pattern', 'Write your ad']} step={step} />}
        {step === 0 && (
          <>
            <p className="callout">
              <b>AdSpy Library</b>: six competitor ads for {d.name.toLowerCase()}s. Likes are vanity. <b>Pick the 2 ads that are actually making money.</b>
            </p>
            {hasSkill(game, 'copywriting') && (
              <p className="tiny" style={{ color: '#1f7a45' }}>
                <Icon name="teach" /> Course tip: brands only keep paying for ads that sell. Look at how long it’s been running and whether comments ask where to buy.
              </p>
            )}
            <div className="ad-grid">
              {ads.map((a) => (
                <button key={a.id} className={`ad-card ${chosen.includes(a.id) ? 'on' : ''}`} onClick={() => setChosen((c) => (c.includes(a.id) ? c.filter((x) => x !== a.id) : c.length < 2 ? [...c, a.id] : c))}>
                  <div className="row between tiny">
                    <b>{a.brand}</b>
                    <span className="muted">{a.format}</span>
                  </div>
                  <ProductImage game={game} pid={productId} index={(a.brand.length + a.days) % 3} size="100%" round={6} style={{ height: 70, filter: `hue-rotate(${a.days * 7}deg)` }} />
                  <div className="ad-hook">{a.hook}</div>
                  <div className="tiny muted">
                    <Icon name="heart" /> {a.likes} · running {a.days} days
                  </div>
                  {a.comments.map((c) => (
                    <div key={c} className="ad-comment">
                      {c}
                    </div>
                  ))}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <p className="callout">
              <b>What do the money-makers have in common?</b> Look at how their hooks open.
            </p>
            <div className="ad-grid">
              {ads
                .filter((a) => chosen.includes(a.id))
                .map((a) => (
                  <div key={a.id} className="ad-card">
                    <b className="tiny">{a.brand}</b>
                    <div className="ad-hook">{a.hook}</div>
                  </div>
                ))}
            </div>
            <Choices opts={(Object.keys(HOOK_FIT) as HookType[]).filter((t) => t !== 'social').map((t) => ({ id: t, label: `${HOOK_FIT[t].label}: ${HOOK_FIT[t].tip}`, points: 0 }))} value={type ? [type] : []} onPick={(id) => setType(id as HookType)} />
          </>
        )}
        {step === 2 && (
          <>
            <p className="callout">
              <b>Write your ad.</b> Pick a headline and the first line of the caption.
            </p>
            <b className="tiny">Headline</b>
            <Choices opts={headlines.map((h) => ({ id: h.id, label: h.text, points: 0 }))} value={headline ? [headline] : []} onPick={setHeadline} />
            <b className="tiny" style={{ display: 'block', marginTop: 10 }}>
              First line of the caption
            </b>
            <Choices opts={openers} value={opener ? [opener] : []} onPick={setOpener} />
          </>
        )}
        {step < 3 && (
          <div className="row" style={{ marginTop: 12 }}>
            {step > 0 && (
              <button className="ghost" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            <button className="primary" disabled={(step === 0 && chosen.length < 2) || (step === 1 && !type) || (step === 2 && (!headline || !opener))} onClick={() => (step === 2 ? finish() : setStep(step + 1))}>
              {step === 2 ? 'Make the creative (2h)' : 'Next'}
            </button>
          </div>
        )}
        {step === 3 && (
          <div>
            <div style={{ textAlign: 'center' }}>
              <div className="huge">
                <Icon name={score >= 4 ? 'bullseye' : score >= 2.5 ? 'happy' : 'neutral'} />
              </div>
              <h2 style={{ marginTop: 0 }}>Creative quality: {Math.round(creativeQualityFrom(game, score) * 100)}%</h2>
            </div>
            <ul>
              <li>
                {s1 === 2 ? <Icon name="check" color="#1f9d55" /> : <Icon name="close" color="#d64545" />} The winners were the ads running for 50+ days with comments asking where to buy. The 48k-like ad is 3 days old: viral, not profitable.
              </li>
              <li>
                {s2 ? <Icon name="check" color="#1f9d55" /> : <Icon name="close" color="#d64545" />} Both open with {/^[aeiou]/i.test(HOOK_FIT[win].label) ? 'an' : 'a'} <b>{HOOK_FIT[win].label.toLowerCase()}</b> hook. {HOOK_FIT[win].tip}
              </li>
              <li>
                {s3 >= 2 ? <Icon name="check" color="#1f9d55" /> : <Icon name="neutral" color="#c0712c" />} The best ads sound like a customer, not a brand, and use the hook style that’s working.
              </li>
            </ul>
            <p className="tiny muted">Every ad for this product now uses this research: higher click-through and conversion.{winHook ? ' Your headline was set on all creatives.' : ''}</p>
            <button className="primary" onClick={() => setModal(null)}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
