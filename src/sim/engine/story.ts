import { CHARACTERS } from '../data';
import { def, founderMaxHours, hasSkill, hoursLeft, liveProducts, round2 } from '../economics';
import { chance, pick } from '../rng';
import type { CharacterId, GameState, StoryMessage } from '../types';
import { type ActionResult, nextId, notify, spendCash } from './core';

// The founder's story: a college dropout who borrowed $4,000 from Mom, Sam and Maya to prove dropping out
// wasn't a mistake. Texts arrive as the business grows; some ask you to choose, and choices cost or earn
// founder hours, energy and goodwill.

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
const energy = (s: GameState, d: number) => {
  s.story.energy = Math.max(0, Math.min(100, s.story.energy + d));
};

/** Day-one texts. */
export function startStory(s: GameState): void {
  s.story.beats.intro = s.day;
  text(s, 'mom', 'Proud of you, whatever your father says. The $2,000 is a loan, not a gift, so make it count. And eat something green today.', 'intro');
  text(s, 'sam', 'Bro. My car fund is officially in your hands What are you even going to sell?', 'intro');
}

const VISITS = [
  'Pizza at yours tonight? Maya’s bringing that terrible board game.',
  'We’re coming over to watch the game. You in or are you “working”?',
  'Maya got tickets to a show tonight, one spare. Come out for once?',
  'Taco night at mine. You haven’t left that apartment in a week, man.',
];

/** Daily story step: energy, help days, expired choices and new beats. */
export function storyDay(s: GameState, worked: number): void {
  const st = s.story;
  // Long days wear you down; short ones let you recover.
  const max = founderMaxHours(s);
  if (worked >= max - 0.5) energy(s, -7);
  else if (worked >= 6) energy(s, -2);
  else energy(s, 6);
  if (st.helpDay === s.day) {
    s.extraHours += 6;
    notify(s, 'info', 'Sam and Maya showed up with coffee to help pack: +6 founder hours today.');
  }
  // Unanswered choices fall back to the last option.
  for (const m of st.messages) if (m.choices && !m.answer && m.expires !== undefined && m.expires <= s.day) answer(s, m, m.choices[m.choices.length - 1].id, true);

  const live = liveProducts(s);
  const store = s.brands[0].store;
  once(s, 'tools', s.day >= 2 && !hasSkill(s, 'researchTool'), () =>
    text(s, 'sam', 'Everyone on the e-com forums says the same thing: don’t pick a product blind, get a research tool first. TrendHound is like $39. It’s in SkillUp.', 'tools'),
  );
  once(s, 'firstProduct', live.length > 0, () => text(s, 'maya', `A ${def(s, live[0]).name.toLowerCase()}?? Honestly… I’d buy that. Founder discount for your old roommate?`, 'firstProduct'));
  once(s, 'adsCourse', !!store.quality && !hasSkill(s, 'adsBasics'), () =>
    text(s, 'maya', 'My cousin runs Scrollr ads for a living. She says do NOT touch ads before you’ve done a course, people burn their savings in a week.', 'adsCourse'),
  );
  once(s, 'launch', store.launched, () => text(s, 'mom', 'I shared your store in the family group chat!! Aunt Rosa wants to know if you ship to Florida.', 'launch'));
  once(s, 'firstSale', s.shipped > 0, () => {
    bond(s, 'dad', 5);
    text(s, 'dad', 'Your mother showed me the order. One sale isn’t a business.', 'firstSale');
  });
  once(s, 'momMoney', s.stage === 1 && s.cash < 500 && s.day > 10, () =>
    text(s, 'mom', 'Your aunt says things look slow. Do you need money? Don’t tell your father.', 'momMoney', [
      { id: 'take', label: 'Take $500', hint: 'Cash now, owe Mom more' },
      { id: 'decline', label: 'I’ve got this', hint: 'Mom will be proud' },
    ]),
  );
  once(s, 'burnout', st.energy < 35, () =>
    text(s, 'sam', 'Dude, you look wrecked on video calls. Take a night off before you break.', 'burnout', [
      { id: 'rest', label: 'Take the night off', hint: '−4h today, big energy boost' },
      { id: 'push', label: 'Keep pushing', hint: 'Stay tired, fewer hours each day' },
    ]),
  );
  once(s, 'profit', !!s.milestones.first_profitable_reorder, () =>
    text(s, 'sam', 'Wait. You’re actually making MONEY?? Maybe I get my car after all', 'profit'),
  );
  once(s, 'garage', s.stage >= 2, () =>
    text(s, 'dad', 'Heard you’re renting a garage now. I have steel shelving in the basement. Do you want it or not?', 'garage', [
      { id: 'yes', label: 'Yes, thanks Dad', hint: 'He drives it over himself' },
      { id: 'no', label: 'I’m fine', hint: 'Pride is free' },
    ], 3),
  );
  once(s, 'class', s.stage >= 3, () =>
    text(s, 'maya', 'My old business professor wants you to speak to her class about dropping out and building a company. Seriously.', 'class', [
      { id: 'go', label: 'Give the talk', hint: 'A day out, students follow your brand' },
      { id: 'skip', label: 'Too busy', hint: '' },
    ], 4),
  );
  once(s, 'dadWrong', s.stage >= 4, () => {
    bond(s, 'dad', 15);
    text(s, 'dad', 'I was wrong about the dropping-out thing. Don’t make me say it twice.', 'dadWrong');
  });
  once(s, 'finale', s.stage >= 5, () => {
    bond(s, 'dad', 20);
    text(s, 'dad', 'Sunday dinner. Bring your team. Your mother is making the lasagna. I’m proud of you, kid.', 'finale');
    notify(s, 'milestone', '🎓 Story complete: you proved it. (The business doesn’t stop here.)', true);
  });

  // Friends drop by every few weeks while you're still small.
  const lastVisit = Math.max(0, ...Object.entries(st.beats).filter(([k]) => k.startsWith('visit')).map(([, d]) => d));
  if (s.stage <= 2 && s.day >= 6 && s.day - lastVisit >= 16 && chance(s, 0.2)) {
    const beat = `visit${s.day}`;
    st.beats[beat] = s.day;
    text(s, chance(s, 0.5) ? 'sam' : 'maya', pick(s, VISITS), beat, [
      { id: 'hang', label: 'Hang out tonight', hint: '−3h today, +energy, friends happy' },
      { id: 'help', label: 'Come help me pack instead', hint: '+6h tomorrow; don’t ask every time' },
      { id: 'decline', label: 'Can’t, too busy', hint: 'Keep working, −energy, they’re hurt' },
    ], 1);
  }
  // Mom checks in when you're running on empty.
  if (st.energy < 25 && s.day % 9 === 0) text(s, 'mom', 'You sound exhausted on the phone. Sleep. The orders will still be there tomorrow.', `tired${s.day}`);
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
      energy(s, 22);
      friends(6);
      st.guestsDay = s.day;
    } else if (choiceId === 'help') {
      const asked = Object.values(st.messages).filter((x) => x.beat.startsWith('visit') && x.answer === 'help').length;
      st.helpDay = s.day + 1;
      friends(asked > 2 ? -6 : -1);
    } else {
      energy(s, -4);
      friends(expired ? -6 : -4);
    }
    return;
  }
  switch (m.beat) {
    case 'momMoney':
      if (choiceId === 'take') {
        s.cash = round2(s.cash + 500); // a family loan, not income: it goes on the debt, not the P&L
        st.debt.mom += 500;
      } else bond(s, 'mom', 5);
      break;
    case 'burnout':
      if (choiceId === 'rest') {
        s.hoursUsed += Math.min(4, hoursLeft(s));
        energy(s, 35);
        bond(s, 'sam', 3);
      }
      break;
    case 'garage':
      if (choiceId === 'yes') {
        bond(s, 'dad', 12);
        energy(s, 8);
        s.counters.storageBonus = (s.counters.storageBonus ?? 0) + 400;
        text(s, 'dad', 'Shelves are in. Don’t stack them crooked.', 'garageDone');
      }
      break;
    case 'class':
      if (choiceId === 'go') {
        for (const b of s.brands) b.awareness += 1500;
        energy(s, 10);
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

const THANKS: Record<'mom' | 'sam' | 'maya', string[]> = {
  mom: ['You didn’t have to pay me back yet! …But I’m keeping it. I’m buying your father a new drill and telling him it’s from you.'],
  sam: ['THE CAR FUND LIVES. You absolute legend.'],
  maya: ['Paid back with interest-free vibes. I’m telling everyone I was your first investor.'],
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
    text(s, who, THANKS[who][0], `repaid-${who}`);
  }
  const d = s.story.debt;
  once(s, 'allRepaid', d.mom + d.sam + d.maya === 0, () => {
    bond(s, 'dad', 15);
    text(s, 'dad', 'Your mother says you paid everyone back. That’s more than I managed at your age.', 'allRepaid');
    notify(s, 'milestone', '🎓 Paid back everyone who believed in you.', true);
  });
  return null;
}
