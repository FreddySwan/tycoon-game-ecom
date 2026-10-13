import { CHAPTER_ORDER, CHAPTERS, CHARACTERS, DEAL } from '../data';
import { def, hasSkill, headcount, hoursLeft, liveProducts, round2, trailing } from '../economics';
import { chance, pick } from '../rng';
import type { ChapterId, CharacterId, GameState, StoryMessage } from '../types';
import { type ActionResult, nextId, notify, spendCash } from './core';
import { hireFriend } from './people';

// The founder's story: a college dropout who borrowed $4,000 from Mom, Sam and Maya to prove to Dad (and
// themselves) that they can build a real business. It runs in chapters, each with a goal; texts arrive on the
// phone along the way, and some ask you to choose. Choices cost or earn founder hours and goodwill.

type Choice = NonNullable<StoryMessage['choices']>[number];

function text(s: GameState, from: CharacterId, body: string, beat: string, choices?: Choice[], expiresIn = 2): StoryMessage {
  const m: StoryMessage = { id: nextId(s), day: s.day, from, text: body, beat, choices, expires: choices ? s.day + expiresIn : undefined };
  s.story.messages.push(m);
  if (s.story.messages.length > 60) s.story.messages.splice(0, s.story.messages.length - 60);
  notify(s, 'info', `📱 ${CHARACTERS[from].name}: ${body}`, !!choices);
  return m;
}

function once(s: GameState, beat: string, when: boolean, fire: () => void): void {
  if (!when || s.story.beats[beat]) return;
  s.story.beats[beat] = s.day;
  fire();
}

const bond = (s: GameState, who: CharacterId, d: number) => {
  s.story.bond[who] = Math.max(0, Math.min(100, s.story.bond[who] + d));
};

/** How much Sam and Maya are up for helping out (0..100). */
export function goodwill(s: GameState): number {
  return (s.story.bond.sam + s.story.bond.maya) / 2;
}

// ───────────────────────────── chapters ─────────────────────────────

export interface ChapterProgress {
  value: number;
  target: number;
  label: string;
  deadline?: number;
}

export function chapterProgress(s: GameState, id: ChapterId = s.story.chapter): ChapterProgress {
  const debt = s.story.debt.mom + s.story.debt.sam + s.story.debt.maya;
  const month = trailing(s, 30).revenue;
  switch (id) {
    case 'dropout':
      return { value: Math.min(1, s.shipped), target: 1, label: s.shipped ? 'First sale!' : 'No sales yet' };
    case 'deal':
    case 'secondChance':
      return { value: s.story.best30, target: DEAL.target, label: `Best 30 days: $${Math.round(s.story.best30).toLocaleString()} of $10,000`, deadline: id === 'deal' ? DEAL.deadline : DEAL.secondDeadline };
    case 'payback': {
      const total = 4000 + Math.max(0, debt - 4000);
      return { value: total - debt, target: total, label: `$${(total - debt).toLocaleString()} of $${total.toLocaleString()} paid back` };
    }
    case 'garage':
      return { value: s.stage >= 2 ? 1 : 0, target: 1, label: s.stage >= 2 ? 'Moved!' : 'Still in the apartment' };
    case 'firstHire':
      return { value: Math.min(1, headcount(s)), target: 1, label: `${headcount(s)} employees` };
    case 'fifty':
      return { value: month, target: 50000, label: `Last 30 days: $${Math.round(month).toLocaleString()} of $50,000` };
    case 'warehouse':
      return { value: s.stage >= 3 ? 1 : 0, target: 1, label: s.stage >= 3 ? 'Moved!' : 'Not yet' };
    case 'million': {
      const life = s.counters.revenueLifetime ?? 0;
      return { value: life, target: 1e6, label: `$${Math.round(life).toLocaleString()} of $1,000,000 lifetime sales` };
    }
    case 'graduation':
      return { value: s.stage >= 5 ? 1 : 0, target: 1, label: `Stage ${s.stage} of 5` };
    default:
      return { value: 1, target: 1, label: '' };
  }
}

function nextChapter(id: ChapterId): ChapterId {
  const from = id === 'secondChance' ? 'deal' : id;
  return CHAPTER_ORDER[Math.min(CHAPTER_ORDER.length - 1, CHAPTER_ORDER.indexOf(from) + 1)];
}

function advanceChapter(s: GameState, done: ChapterId, failed = false): void {
  const st = s.story;
  const next = failed && done === 'deal' ? 'secondChance' : nextChapter(done);
  st.scenes.push(failed ? { failed: done, next } : { done, next });
  st.chapter = next;
  st.chapterStart = s.day;
  notify(s, 'milestone', failed ? `Chapter missed: ${CHAPTERS[done].title}. Next: ${CHAPTERS[next].title}.` : `🎓 Chapter complete: ${CHAPTERS[done].title}. Next: ${CHAPTERS[next].title}.`, true);
  if (next === 'deal') st.best30 = trailing(s, 30).revenue;
}

/** Check the current chapter (and chain through any that are already done). */
function checkChapter(s: GameState): void {
  const st = s.story;
  st.best30 = Math.max(st.best30, trailing(s, 30).revenue);
  for (let guard = 0; guard < 4; guard++) {
    const id = st.chapter;
    if (id === 'epilogue') return;
    const p = chapterProgress(s, id);
    if (p.value >= p.target) {
      if (id === 'deal' || id === 'secondChance') bond(s, 'dad', 20);
      if (id === 'graduation') bond(s, 'dad', 25);
      advanceChapter(s, id);
      continue;
    }
    if (p.deadline !== undefined && s.day > p.deadline) {
      if (id === 'deal') {
        bond(s, 'dad', -10);
        advanceChapter(s, id, true);
        continue;
      }
      // Missed the second chance too: night classes to keep the peace, and the business carries on.
      bond(s, 'dad', -10);
      text(s, 'dad', 'You’re enrolled in night classes. Keep your little business if you want. Weekends.', 'nightClasses');
      advanceChapter(s, id, true);
      continue;
    }
    return;
  }
}

export function dismissScene(s: GameState): ActionResult {
  s.story.scenes.shift();
  return null;
}

// ───────────────────────────── daily texts ─────────────────────────────

/** Day-one texts. */
export function startStory(s: GameState): void {
  s.story.beats.intro = s.day;
  s.story.scenes.push({ next: 'dropout' });
  text(s, 'mom', 'Proud of you, whatever your father says. The $2,000 is a loan, not a gift, so make it count. And eat something green today.', 'intro');
  text(s, 'sam', 'Bro. My car fund is officially in your hands. What are you even going to sell?', 'intro');
}

const VISITS: Record<'sam' | 'maya', string[]> = {
  sam: ['Pizza at yours tonight? Maya’s bringing that terrible board game.', 'We’re coming over to watch the game. You in or are you “working”?', 'Taco night at mine. You haven’t left that apartment in a week, man.'],
  maya: ['I got tickets to a show tonight, one spare. Come out for once?', 'Movie night at yours? I’ll bring snacks, Sam’s bringing his opinions.', 'Karaoke tonight. Sam already said yes. Your turn.'],
};

/** Daily story step: help and away days, expired choices, chapter goals and new texts. */
export function storyDay(s: GameState): void {
  const st = s.story;
  if (st.helpDay === s.day) {
    s.extraHours += 6;
    notify(s, 'info', 'Sam and Maya showed up with coffee to help pack: +6 founder hours today.');
  }
  if (st.awayDay === s.day) {
    s.hoursUsed += Math.min(5, hoursLeft(s));
    notify(s, 'info', 'You’re out most of today: 5 fewer founder hours.');
  }
  // Unanswered choices fall back to the last option.
  for (const m of st.messages) if (m.choices && !m.answer && m.expires !== undefined && m.expires <= s.day) answer(s, m, m.choices[m.choices.length - 1].id, true);

  checkChapter(s);

  const live = liveProducts(s);
  const store = s.brands[0].store;
  once(s, 'tools', s.day >= 2 && !hasSkill(s, 'researchTool'), () =>
    text(s, 'sam', 'Everyone on the e-com forums says the same thing: don’t pick a product blind, get a research tool first. TrendHound is like $39. It’s in SkillUp.', 'tools'),
  );
  once(s, 'firstProduct', live.length > 0, () => text(s, 'maya', `A ${def(s, live[0]).name.toLowerCase()}?? Honestly… I’d buy that. Founder discount for your old roommate?`, 'firstProduct'));
  once(s, 'adsCourse', store.quality != null && !hasSkill(s, 'adsBasics'), () =>
    text(s, 'maya', 'My cousin runs Scrollr ads for a living. She says do NOT touch ads before you’ve done a course, people burn their savings in a week.', 'adsCourse'),
  );
  once(s, 'launch', store.launched, () => text(s, 'mom', 'I shared your store in the family group chat!! Aunt Rosa wants to know if you ship to Florida.', 'launch'));
  once(s, 'firstSale', s.shipped > 0, () => {
    bond(s, 'dad', 5);
    text(s, 'dad', 'Your mother showed me the order. One sale isn’t a business.', 'firstSale');
  });
  once(s, 'professor', s.day >= 40, () => text(s, 'dad', 'Your old economics professor says 9 out of 10 startups fail. Thought you should see this.', 'professor'));
  once(s, 'momMoney', s.stage === 1 && s.cash < 500 && s.day > 10, () =>
    text(s, 'mom', 'Your aunt says things look slow. Do you need money? Don’t tell your father.', 'momMoney', [
      { id: 'take', label: 'Take $500', hint: 'Cash now, owe Mom more' },
      { id: 'decline', label: 'I’ve got this', hint: 'Mom will be proud' },
    ]),
  );
  once(s, 'graduationMaya', s.day >= 76, () =>
    text(s, 'maya', 'My graduation is tomorrow. You’re coming, right? Everyone keeps asking where you disappeared to.', 'graduationMaya', [
      { id: 'go', label: 'I’ll be there', hint: '−5 founder hours tomorrow' },
      { id: 'skip', label: 'Can’t, orders to ship', hint: 'Maya will remember' },
    ], 1),
  );
  once(s, 'classmates', s.day >= 120, () =>
    text(s, 'sam', 'The old class group chat is nothing but internship offers. You good, man?', 'classmates', [
      { id: 'great', label: 'Never been better', hint: '' },
      { id: 'hard', label: 'Honestly? It’s hard', hint: '' },
    ], 3),
  );
  once(s, 'dadBirthday', s.day >= 150, () =>
    text(s, 'mom', 'It’s your father’s birthday on Sunday. Come for dinner? He won’t say it, but he wants you there.', 'dadBirthday', [
      { id: 'go', label: 'I’ll come', hint: '−5 founder hours tomorrow' },
      { id: 'skip', label: 'Too busy this week', hint: 'Dad notices' },
    ], 2),
  );
  once(s, 'profit', !!s.milestones.first_profitable_reorder, () => text(s, 'sam', 'Wait. You’re actually making MONEY?? Maybe I get my car after all.', 'profit'));
  once(s, 'garageShelves', s.stage >= 2, () =>
    text(s, 'dad', 'Heard you’re renting a garage now. I have steel shelving in the basement. Do you want it or not?', 'garage', [
      { id: 'yes', label: 'Yes, thanks Dad', hint: 'He drives it over himself' },
      { id: 'no', label: 'I’m fine', hint: 'Pride is free' },
    ], 3),
  );
  once(s, 'class', s.stage >= 3, () =>
    text(s, 'maya', 'My old business professor wants you to speak to her class about dropping out and building a company. Seriously.', 'class', [
      { id: 'go', label: 'Give the talk', hint: 'Students start following your brand' },
      { id: 'skip', label: 'Too busy', hint: '' },
    ], 4),
  );
  once(s, 'samJoins', s.stage >= 2 && s.day >= (st.beats.garageShelves ?? 9999) + 10, () => {
    if (goodwill(s) >= 45)
      text(s, 'sam', 'Okay. I quit the car wash. Hire me? I’ll pack, I’ll answer emails, I’ll sweep the garage. I believe in this thing.', 'samJoins', [
        { id: 'hire', label: 'Welcome aboard, Sam', hint: 'A loyal packer who never quits' },
        { id: 'no', label: 'I can’t afford you yet', hint: 'He’ll understand. Mostly.' },
      ], 4);
    else text(s, 'sam', 'Saw the garage pics on Maya’s story. Looks big. Good for you, man.', 'samDistant');
  });
  once(s, 'mayaJoins', s.stage >= 3 && s.day >= (st.beats.class ?? 9999) + 20, () => {
    if (goodwill(s) >= 45)
      text(s, 'maya', 'Hot take: your packaging and store could be SO much better. I just finished my design degree. Hire me as your designer?', 'mayaJoins', [
        { id: 'hire', label: 'You’re hired', hint: 'Designer salary; boosts conversion and packaging' },
        { id: 'no', label: 'Not right now', hint: '' },
      ], 4);
  });
  once(s, 'brett', !!s.flags.brettLaunched, () =>
    text(s, 'maya', 'Remember Brett Lawson from Econ 101? The guy who said dropping out was “for people who can’t hack it”? He just raised $2M to sell the exact same stuff as you. He’s everywhere on Scrollr.', 'brett'),
  );
  once(s, 'brettBroke', !!s.flags.brettBroke, () => {
    bond(s, 'dad', 5);
    text(s, 'sam', 'BRETT’S COMPANY RAN OUT OF MONEY. Two million dollars, gone in ads. You’re still here. I’m framing this.', 'brettBroke');
  });
  once(s, 'dadWrong', s.stage >= 4, () => {
    bond(s, 'dad', 15);
    text(s, 'dad', 'I was wrong about the dropping-out thing. Don’t make me say it twice.', 'dadWrong');
  });

  // Friends drop by every few weeks while you're still small.
  const lastVisit = Math.max(0, ...Object.entries(st.beats).filter(([k]) => k.startsWith('visit')).map(([, d]) => d));
  if (s.stage <= 2 && s.day >= 6 && s.day - lastVisit >= 16 && chance(s, 0.2)) {
    const beat = `visit${s.day}`;
    st.beats[beat] = s.day;
    const who = chance(s, 0.5) ? 'sam' : 'maya';
    text(s, who, pick(s, VISITS[who]), beat, [
      { id: 'hang', label: 'Hang out tonight', hint: '−3h today, builds goodwill' },
      { id: 'help', label: 'Come help me pack instead', hint: goodwill(s) >= 45 ? '+6h tomorrow, spends goodwill' : 'They’re not feeling it lately' },
      { id: 'decline', label: 'Can’t, too busy', hint: 'They’ll be hurt' },
    ], 1);
  }
}

function answer(s: GameState, m: StoryMessage, choiceId: string, expired = false): void {
  m.answer = expired ? `${choiceId}:expired` : choiceId;
  m.read = true;
  const st = s.story;
  const friends = (d: number) => {
    bond(s, 'sam', d);
    bond(s, 'maya', d);
  };
  if (m.beat.startsWith('visit')) {
    if (choiceId === 'hang') {
      s.hoursUsed += Math.min(3, hoursLeft(s));
      friends(8);
      st.guestsDay = s.day;
    } else if (choiceId === 'help') {
      if (goodwill(s) >= 45) {
        st.helpDay = s.day + 1;
        friends(-10);
      } else {
        friends(-2);
        text(s, m.from, 'Lol no. You never even hang out with us anymore.', 'helpRefused');
      }
    } else friends(expired ? -6 : -4);
    return;
  }
  switch (m.beat) {
    case 'momMoney':
      if (choiceId === 'take') {
        s.cash = round2(s.cash + 500); // a family loan, not income: it goes on the debt, not the P&L
        st.debt.mom += 500;
      } else bond(s, 'mom', 5);
      break;
    case 'graduationMaya':
      if (choiceId === 'go') {
        st.awayDay = s.day + 1;
        bond(s, 'maya', 15);
        text(s, 'maya', 'You came!! Everyone asked about your store. My dad wants to buy three.', 'graduationThanks');
      } else {
        bond(s, 'maya', -15);
        text(s, 'maya', 'Saw your story. Looked “busy”. Cool.', 'graduationHurt');
      }
      break;
    case 'classmates':
      bond(s, 'sam', choiceId === 'hard' ? 10 : 2);
      text(s, 'sam', choiceId === 'hard' ? 'Respect for saying it. For what it’s worth, I’d rather be doing what you’re doing.' : 'Knew it. Don’t forget us when you’re rich.', 'classmatesReply');
      break;
    case 'dadBirthday':
      if (choiceId === 'go') {
        st.awayDay = s.day + 1;
        bond(s, 'dad', 12);
        bond(s, 'mom', 8);
        if (trailing(s, 30).revenue > 5000) text(s, 'mom', 'After you left, your father asked me how “these Scrollr ads” work. He’s been reading about it all night.', 'birthdayAfter');
      } else bond(s, 'dad', -8);
      break;
    case 'garage':
      if (choiceId === 'yes') {
        bond(s, 'dad', 12);
        s.counters.storageBonus = (s.counters.storageBonus ?? 0) + 400;
        text(s, 'dad', 'Shelves are in. Don’t stack them crooked.', 'garageDone');
      }
      break;
    case 'samJoins':
      if (choiceId === 'hire') hireFriend(s, 'sam');
      else bond(s, 'sam', -8);
      break;
    case 'mayaJoins':
      if (choiceId === 'hire') {
        hireFriend(s, 'maya');
        for (const b of s.brands) b.packScore = Math.min(1, (b.packScore ?? 0.5) + 0.2);
      } else bond(s, 'maya', -8);
      break;
    case 'class':
      if (choiceId === 'go') {
        for (const b of s.brands) b.awareness += 1500;
        bond(s, 'maya', 8);
      }
      break;
  }
}

export function answerMessage(s: GameState, id: number, choiceId: string): ActionResult {
  const m = s.story.messages.find((x) => x.id === id);
  if (!m || !m.choices) return 'Nothing to answer.';
  if (m.answer) return 'Already answered.';
  if (!m.choices.some((c) => c.id === choiceId)) return 'Unknown choice.';
  answer(s, m, choiceId);
  return null;
}

export function readMessages(s: GameState): ActionResult {
  for (const m of s.story.messages) if (!m.choices) m.read = true;
  return null;
}

const THANKS: Record<'mom' | 'sam' | 'maya', string> = {
  mom: 'You didn’t have to pay me back yet! …But I’m keeping it. I’m buying your father a new drill and telling him it’s from you.',
  sam: 'THE CAR FUND LIVES. You absolute legend.',
  maya: 'Paid back in full. I’m telling everyone I was your first investor.',
};

/** Pay back the people who lent you the starting money. Not an expense: it's paying off a loan. */
export function repayDebt(s: GameState, who: 'mom' | 'sam' | 'maya', amount: number): ActionResult {
  const owed = s.story.debt[who];
  const pay = Math.min(owed, Math.round(amount));
  if (pay <= 0) return 'You don’t owe them anything.';
  const err = spendCash(s, pay);
  if (err) return err;
  s.story.debt[who] = owed - pay;
  bond(s, who, 4);
  if (s.story.debt[who] === 0) {
    bond(s, who, 10);
    text(s, who, THANKS[who], `repaid-${who}`);
  }
  const d = s.story.debt;
  once(s, 'allRepaid', d.mom + d.sam + d.maya === 0, () => {
    bond(s, 'dad', 15);
    text(s, 'dad', 'Your mother says you paid everyone back. That’s more than I managed at your age.', 'allRepaid');
  });
  checkChapter(s);
  return null;
}
