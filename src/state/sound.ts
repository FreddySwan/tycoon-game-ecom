let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, vol = 0.12, type: OscillatorType = 'sine') {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Notes of a major pentatonic scale so stacked dings sound like a chord, not noise. */
const SCALE = [1046.5, 1174.7, 1318.5, 1568, 1760];

export const sfx = {
  ding() {
    tone(1318.5, 0, 0.35, 0.1);
    tone(1975.5, 0.05, 0.3, 0.05);
  },
  orders(n: number) {
    for (let i = 0; i < n; i++) tone(SCALE[i % SCALE.length], i * 0.12, 0.4, 0.08);
  },
  fanfare() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.1, 0.6, 0.1, 'triangle'));
  },
  click() {
    tone(660, 0, 0.06, 0.05, 'square');
  },
  tape() {
    tone(180, 0, 0.18, 0.06, 'sawtooth');
  },
};
