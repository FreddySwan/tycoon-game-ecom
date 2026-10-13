import { CHAPTER_ORDER, CHAPTERS, CHARACTERS } from '../sim/data';
import { answerMessage, chapterProgress, dismissScene, goodwill, readMessages, repayDebt } from '../sim/engine';
import type { ChapterId, CharacterId, StoryMessage } from '../sim/types';
import { useGame } from '../state/store';
import { money } from './format';
import { Icon, type IconName } from './icons';

const AVATAR: Record<CharacterId, { icon: IconName; color: string }> = {
  mom: { icon: 'heart', color: '#e0607e' },
  dad: { icon: 'user', color: '#5a6b8c' },
  sam: { icon: 'happy', color: '#2f8f83' },
  maya: { icon: 'user', color: '#b26ad6' },
};

function Avatar({ who, size = 30 }: { who: CharacterId; size?: number }) {
  const a = AVATAR[who];
  return (
    <span className="ph-av" style={{ background: a.color, width: size, height: size }}>
      <Icon name={a.icon} size={size * 0.6} color="#fff" />
    </span>
  );
}

function Bubble({ m, compact = false }: { m: StoryMessage; compact?: boolean }) {
  const act = useGame((s) => s.act);
  const day = useGame((s) => s.game.day);
  const open = m.choices && !m.answer;
  const answered = m.answer ? m.choices?.find((c) => m.answer?.startsWith(c.id)) : null;
  return (
    <div className={`ph-msg ${open ? 'open' : ''}`}>
      <Avatar who={m.from} size={compact ? 26 : 30} />
      <div className="grow">
        <div className="tiny muted">
          <b style={{ color: '#3a3340' }}>{CHARACTERS[m.from].name}</b> · day {m.day}
        </div>
        <div className="ph-text">{m.text}</div>
        {open && (
          <div className="ph-choices">
            {m.choices!.map((c) => (
              <button key={c.id} className="small" onClick={() => act(answerMessage, m.id, c.id)} title={c.hint}>
                {c.label}
                {c.hint && !compact && <span className="tiny muted"> · {c.hint}</span>}
              </button>
            ))}
            {m.expires !== undefined && <span className="tiny muted">{m.expires - day <= 0 ? 'answer today' : `answer within ${m.expires - day}d`}</span>}
          </div>
        )}
        {answered && (
          <div className="tiny muted">
            You: {answered.label}
            {m.answer?.endsWith(':expired') ? ' (no reply, so they assumed)' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

/** Left-panel card: the latest text, with choices inline when someone's waiting on you. */
export function PhoneCard() {
  const game = useGame((s) => s.game);
  const setModal = useGame((s) => s.setModal);
  const msgs = game.story?.messages ?? [];
  if (!msgs.length) return null;
  const waiting = msgs.filter((m) => m.choices && !m.answer);
  const unread = msgs.filter((m) => !m.read && !m.choices).length;
  const show = waiting[0] ?? msgs[msgs.length - 1];
  return (
    <div className="phone-card">
      <div className="row between">
        <b>
          <Icon name="phone" /> Phone
        </b>
        <button className="small ghost" onClick={() => setModal({ kind: 'phone' })}>
          {unread + waiting.length > 0 ? `${unread + waiting.length} new · ` : ''}Open
        </button>
      </div>
      {(waiting.length > 0 || unread > 0) && <Bubble m={show} compact />}
    </div>
  );
}

/** Full phone: every text, the money you owe the people who backed you, and how you're holding up. */
export function Phone() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const st = game.story;
  const owed = st.debt.mom + st.debt.sam + st.debt.maya;
  const close = () => {
    act(readMessages);
    setModal(null);
  };
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal phone-modal">
        <div className="row between">
          <h2 style={{ margin: 0 }} className="row">
            <Icon name="phone" /> Messages
          </h2>
          <button className="small ghost" onClick={close}>
            Close
          </button>
        </div>
        <div className="ph-status">
          <span>
            <Icon name="users" /> Friends’ goodwill <b>{Math.round(goodwill(game))}%</b>
          </span>
          <span className="tiny muted">{goodwill(game) >= 45 ? 'Sam & Maya will come help pack if you ask' : 'Hang out with them before asking for help'}</span>
        </div>
        <div className="ph-debt">
          <b>Paying back the people who believed in you</b>
          {owed === 0 ? (
            <p className="tiny" style={{ margin: '4px 0 0' }}>
              <Icon name="check" color="#1f9d55" /> All paid back.
            </p>
          ) : (
            (['mom', 'sam', 'maya'] as const).map((who) => (
              <div key={who} className="row between" style={{ marginTop: 6 }}>
                <span className="row" style={{ gap: 6 }}>
                  <Avatar who={who} size={22} /> {CHARACTERS[who].name}: {st.debt[who] ? <b>{money(st.debt[who])}</b> : <span className="good-text">paid</span>}
                </span>
                {st.debt[who] > 0 && (
                  <span className="row" style={{ gap: 4 }}>
                    {st.debt[who] > 250 && (
                      <button className="small" onClick={() => act(repayDebt, who, 250)} disabled={game.cash < 250}>
                        Pay $250
                      </button>
                    )}
                    <button className="small primary" onClick={() => act(repayDebt, who, st.debt[who])} disabled={game.cash < st.debt[who]}>
                      Pay all
                    </button>
                  </span>
                )}
              </div>
            ))
          )}
          <p className="tiny muted" style={{ margin: '6px 0 0' }}>
            No interest, no deadline. It’s paying off a loan, not an expense, so it doesn’t touch your profit.
          </p>
        </div>
        <div className="ph-list">
          {[...st.messages].reverse().map((m) => (
            <Bubble key={m.id} m={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

const chapterNo = (id: ChapterId) => CHAPTER_ORDER.indexOf(id === 'secondChance' ? 'deal' : id) + 1;

/** Left-panel card: the story chapter you're on and how close you are. */
export function StoryCard() {
  const game = useGame((s) => s.game);
  const st = game.story;
  if (!st?.chapter) return null;
  const ch = CHAPTERS[st.chapter];
  const p = chapterProgress(game);
  const left = p.deadline !== undefined ? p.deadline - game.day : null;
  return (
    <div className="story-card">
      <div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 800, color: '#c0712c' }}>
        <Icon name="book" /> {st.chapter === 'epilogue' ? 'Epilogue' : `Chapter ${chapterNo(st.chapter)}`}
      </div>
      <b>{ch.title}</b>
      <div className="tiny">{ch.goal}</div>
      {st.chapter !== 'epilogue' && (
        <>
          <div className="meter" style={{ margin: '4px 0 2px' }}>
            <span style={{ width: `${Math.min(1, p.value / p.target) * 100}%` }} />
          </div>
          <div className="tiny muted">
            {p.label}
            {left !== null && <b className={left < 20 ? 'bad-text' : ''}> · {left > 0 ? `${left} days left` : 'last day!'}</b>}
          </div>
        </>
      )}
    </div>
  );
}

/** Between chapters: how the last one ended and what's next. */
export function StoryScene() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const scene = game.story.scenes[0];
  if (!scene) return null;
  const done = scene.done ? CHAPTERS[scene.done] : null;
  const next = CHAPTERS[scene.next];
  return (
    <div className="overlay">
      <div className="modal story-scene">
        {done && (
          <>
            <div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 800, color: '#1f9d55' }}>
              <Icon name="check" /> Chapter complete
            </div>
            <h2 style={{ margin: '2px 0 6px' }}>{done.title}</h2>
            {done.outro.map((t) => (
              <p key={t}>{t}</p>
            ))}
            <hr />
          </>
        )}
        {scene.next !== 'epilogue' ? (
          <>
            <div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 800, color: '#c0712c' }}>
              <Icon name="book" /> Chapter {chapterNo(scene.next)}
            </div>
            <h2 style={{ margin: '2px 0 6px' }} className="row">
              {next.who && <Avatar who={next.who} size={28} />} {next.title}
            </h2>
            {next.intro.map((t) => (
              <p key={t}>{t}</p>
            ))}
            <p className="callout">
              <b>Goal:</b> {next.goal}
            </p>
          </>
        ) : (
          <p className="callout">The story you set out to tell is done. The business, and the game, keep going.</p>
        )}
        <button className="primary" onClick={() => act(dismissScene)}>
          Continue
        </button>
      </div>
    </div>
  );
}
