import { useMemo, useState } from 'react';
import { MARKET_SCAN } from '../sim/data';
import { def } from '../sim/economics';
import { completeScan } from '../sim/engine';
import { useGame } from '../state/store';
import { money } from './format';
import { ProductImage } from './photos';
import { Icon } from './icons';

interface Rival {
  name: string;
  price: number;
  rating: number;
  reviews: number;
  snippet: string;
  real: boolean;
}

/** Deep-dive mini-game: read a page of rival listings, find the opportunity, the real complaint and the price gap. */
export function MarketScan({ productId }: { productId: string }) {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const d = def(game, productId);
  const scan = MARKET_SCAN[d.baseId ?? d.id];
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<{ gap?: number; complaint?: number; price?: number }>({});
  const [price, setPrice] = useState(d.refPrice);

  const rivals = useMemo<Rival[]>(() => {
    const names = ['ProGear', 'HomeJoy', 'Valuemax', 'Nordly', 'Brightside', 'Tidy&Co'];
    const base = d.refPrice;
    const snippets = scan ? [scan.complaint, scan.decoys[0], scan.complaint, scan.decoys[1], scan.complaint, 'Does the job.'] : ['Good', 'Fine', 'Okay', 'Nice', 'Meh', 'Great'];
    return names.map((name, i) => ({
      name: `${name} ${d.name.split(' ').slice(-1)[0]}`,
      price: Math.round(base * [0.72, 0.95, 0.65, 1.25, 1.05, 0.88][i]),
      rating: [3.6, 4.4, 3.3, 4.7, 3.9, 4.1][i],
      reviews: [4200, 860, 2900, 140, 1800, 520][i],
      snippet: snippets[i],
      real: snippets[i] === scan?.complaint,
    }));
  }, [d, scan]);

  // Opportunity: lots of reviews, weak rating (index 0 = 4,200 reviews at 3.6★).
  const gapAnswer = 0;
  const sweet = [d.refPrice * 0.9, d.refPrice * 1.15];
  const score = (picks.gap === gapAnswer ? 1 : 0) + (picks.complaint !== undefined && rivals[picks.complaint].real ? 1 : 0) + (picks.price !== undefined && picks.price >= sweet[0] && picks.price <= sweet[1] ? 1 : 0);
  const prompts = [
    'Which rival is big but weak? Lots of buyers, unhappy ones: that’s your opening.',
    'Read the reviews. Which complaint keeps coming up?',
    'Where do you price? Find the gap between the cheap junk and the premium brands.',
  ];

  const finish = () => {
    if (!act(completeScan, productId, picks.complaint !== undefined && rivals[picks.complaint].real)) setStep(3);
  };

  return (
    <div className="overlay">
      <div className="modal" style={{ width: 'min(760px, 100%)' }}>
        <div className="row between">
          <h2 style={{ margin: 0 }}><Icon name="zoomIn" /> Market scan: {d.name}</h2>
          <button className="small ghost" onClick={() => setModal(null)}>
            Close
          </button>
        </div>
        {step < 3 && (
          <>
            <p className="callout" style={{ margin: '10px 0' }}>
              <b>Step {step + 1} of 3.</b> {prompts[step]}
            </p>
            {step < 2 && (
              <div className="scan-grid">
                {rivals.map((r, i) => {
                  const chosen = step === 0 ? picks.gap === i : picks.complaint === i;
                  return (
                    <button key={i} className={`scan-item ${chosen ? 'on' : ''}`} onClick={() => setPicks((p) => (step === 0 ? { ...p, gap: i } : { ...p, complaint: i }))}>
                      <ProductImage game={game} pid={productId} index={i % 3} size={56} round={8} style={{ filter: `hue-rotate(${i * 40}deg) saturate(${0.7 + (i % 3) * 0.2})` }} />
                      <span style={{ textAlign: 'left', flex: 1 }}>
                        <b>{r.name}</b>
                        <div className="tiny">
                          {money(r.price)} · <span style={{ color: '#f0a020' }}>{'★'.repeat(Math.round(r.rating))}</span> {r.rating} ({r.reviews.toLocaleString()})
                        </div>
                        {step === 1 && <div className="tiny muted">“{r.snippet}”</div>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {step === 2 && (
              <div style={{ padding: '10px 0' }}>
                <div className="price-strip">
                  {rivals.map((r, i) => (
                    <span key={i} style={{ left: `${((r.price - d.refPrice * 0.5) / (d.refPrice * 1.0)) * 100}%` }} title={r.name}>
                      {money(r.price)}
                    </span>
                  ))}
                  <span className="you" style={{ left: `${((price - d.refPrice * 0.5) / (d.refPrice * 1.0)) * 100}%` }}>
                    You {money(price)}
                  </span>
                </div>
                <input type="range" min={Math.round(d.refPrice * 0.5)} max={Math.round(d.refPrice * 1.5)} value={price} onChange={(e) => setPrice(+e.target.value)} />
              </div>
            )}
            <div className="row" style={{ marginTop: 10 }}>
              {step > 0 && (
                <button className="ghost" onClick={() => setStep(step - 1)}>
                  Back
                </button>
              )}
              <button
                className="primary"
                disabled={(step === 0 && picks.gap === undefined) || (step === 1 && picks.complaint === undefined)}
                onClick={() => {
                  if (step === 2) {
                    setPicks((p) => ({ ...p, price }));
                    setTimeout(finish, 0);
                  } else setStep(step + 1);
                }}
              >
                {step === 2 ? 'Finish scan (2h)' : 'Next'}
              </button>
            </div>
          </>
        )}
        {step === 3 && (
          <div className="center" style={{ textAlign: 'center' }}>
            <div className="huge"><Icon name={score === 3 ? 'bullseye' : score === 2 ? 'happy' : 'neutral'} /></div>
            <h2>Scan complete: {score}/3</h2>
            <ul style={{ textAlign: 'left' }}>
              <li>{picks.gap === gapAnswer ? <Icon name="check" color="#1f9d55" /> : <Icon name="close" color="#d64545" />} The opening: {rivals[gapAnswer].name} has {rivals[gapAnswer].reviews.toLocaleString()} reviews at only {rivals[gapAnswer].rating}★.</li>
              <li>
                {picks.complaint !== undefined && rivals[picks.complaint].real ? <Icon name="check" color="#1f9d55" /> : <Icon name="close" color="#d64545" />} The real complaint: “{scan?.complaint}”.{' '}
                {picks.complaint !== undefined && rivals[picks.complaint].real && <b>Positioning unlocked: lead with “{d.benefits.find((b) => b.id === scan?.benefit)?.text}” for a trust bonus.</b>}
              </li>
              <li>
                {picks.price !== undefined && picks.price >= sweet[0] && picks.price <= sweet[1] ? <Icon name="check" color="#1f9d55" /> : <Icon name="close" color="#d64545" />} Price gap: {money(sweet[0])}–{money(sweet[1])} sits between the bargain bin and the premium brands.
              </li>
            </ul>
            <p className="tiny muted">Full research is now unlocked on this product’s card.</p>
            <button className="primary" onClick={() => setModal(null)}>
              Back to the board
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
