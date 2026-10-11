import type { ChapterId, CharacterId } from '../types';

export const CHARACTERS: Record<CharacterId, { name: string; icon: string; role: string }> = {
  mom: { name: 'Mom', icon: '❤️', role: 'Lent you $2,000 from her savings. Believes in you, worries anyway.' },
  dad: { name: 'Dad', icon: '👨', role: 'Thinks dropping out was the biggest mistake of your life. Hasn’t called since.' },
  sam: { name: 'Sam', icon: '🧑', role: 'Best friend since middle school. Lent you $1,000 of his car fund.' },
  maya: { name: 'Maya', icon: '👩', role: 'Your old college roommate. Lent you $1,000 and wants a “founder discount”.' },
};

/** Who lent the starting $4,000. */
export const STARTING_DEBT = { mom: 2000, sam: 1000, maya: 1000 } as const;

/** Dad's deal: $10k of sales in a month before fall semester (Sep 1, Y1), or a second chance by New Year. */
export const DEAL = { target: 10000, deadline: 181, secondDeadline: 301 };

export interface ChapterDef {
  title: string;
  goal: string;
  /** Shown when the chapter starts. */
  intro: string[];
  /** Shown when it's done. */
  outro: string[];
  who?: CharacterId;
}

/** The dropout's story, one chapter at a time. Goals are checked by the engine (story.ts). */
export const CHAPTERS: Record<ChapterId, ChapterDef> = {
  dropout: {
    title: 'The Dropout',
    goal: 'Make your first sale.',
    intro: ['Everyone you know is in a lecture hall right now. You’re on a mattress in a studio apartment with $4,000 that isn’t yours.', 'Step one: sell one thing to one stranger.'],
    outro: ['Ding. Someone you’ve never met paid you money for a thing you picked, photographed and shipped. You read the order email four times.'],
  },
  deal: {
    title: 'Dad’s Deal',
    goal: 'Make $10,000 in sales within 30 days, before Sep 1, Y1.',
    who: 'dad',
    intro: [
      'Your phone lights up: Dad. First call in weeks.',
      '“Your mother says you sold a dog bowl. Fine. Here’s the deal. Ten thousand dollars in sales in one month, before fall semester starts on September 1st. Do that, and I stop asking about school. Don’t, and you re-enroll.”',
      'He hangs up before you can answer.',
    ],
    outro: ['You screenshot the dashboard: over $10,000 in thirty days. You send it to Dad without a caption.', 'Three hours later: “Fine. I’ll stop asking.” From Dad, that’s a parade.'],
  },
  secondChance: {
    title: 'Second Chance',
    goal: 'Make $10,000 in sales within 30 days, before Jan 1, Y2.',
    who: 'mom',
    intro: [
      'September 1st comes and goes. Dad doesn’t say “I told you so.” He doesn’t have to.',
      'Mom does the talking: “Give the kid until New Year’s. One semester.” Dad grumbles yes. This time there’s no third chance.',
    ],
    outro: ['New Year’s Eve, and the number is there: $10,000 in a month. Dad raises his glass in your direction at dinner. He doesn’t say anything. He doesn’t have to.'],
  },
  payback: {
    title: 'Paying It Back',
    goal: 'Pay back Mom, Sam and Maya (open your phone).',
    intro: ['The business pays for itself now. But $4,000 of it still belongs to three people who believed you before anyone else did.'],
    outro: ['Every dollar paid back. Sam is test-driving cars. Mom bought Dad a drill “from you”. Maya tells everyone she was your first investor.'],
  },
  garage: {
    title: 'Out of the Apartment',
    goal: 'Grow into a garage (see the Company app).',
    intro: ['Boxes on the bed. Boxes on the sofa. The cat lives in a box now. It’s time for a real space.'],
    outro: ['A garage with a roll-up door and a bad light. It’s the best room you’ve ever had.'],
  },
  firstHire: {
    title: 'Not Alone Anymore',
    goal: 'Hire your first employee (Team app).',
    intro: ['You can’t pack, answer emails and run ads 12 hours a day forever. A year ago you were the one applying for jobs.'],
    outro: ['Someone now has a paycheck because you dropped out. You sign your first payroll with a hand that shakes a little.'],
  },
  fifty: {
    title: 'The $50k Month',
    goal: 'Make $50,000 in sales within 30 days.',
    intro: ['Your old classmates are starting internships at $20 an hour. You want a month that would have paid for your whole degree.'],
    outro: ['$50,000 in a month. More than your college tuition for a year. You don’t tell anyone. You just order better coffee.'],
  },
  warehouse: {
    title: 'The Warehouse',
    goal: 'Move into a warehouse.',
    intro: ['The garage door won’t close over the pallets anymore. The landlord has opinions.'],
    outro: ['Forklifts. Racking. A loading dock with your brand on the door. Dad drives past it twice before he comes in.'],
  },
  million: {
    title: 'Seven Figures',
    goal: 'Reach $1,000,000 in lifetime sales.',
    intro: ['Your old econ professor posted that 9 out of 10 startups fail. You printed it and pinned it to the corkboard.'],
    outro: ['One million dollars in sales. The corkboard post comes down. In its place: a photo of the whole team, and the cat.'],
  },
  graduation: {
    title: 'Graduation Day',
    goal: 'Become an established company.',
    intro: ['Your old university emails: would you speak at this year’s commencement, about “unconventional paths”?'],
    outro: [
      'You stand at the podium in a borrowed gown. Front row: Mom crying, Sam and Maya cheering way too loud, and Dad, sitting very straight.',
      '“I dropped out of this place,” you start. Everyone laughs. Dad laughs loudest.',
    ],
  },
  epilogue: {
    title: 'What’s Next',
    goal: 'Keep building. The story’s yours now.',
    intro: [],
    outro: [],
  },
};

export const CHAPTER_ORDER: ChapterId[] = ['dropout', 'deal', 'payback', 'garage', 'firstHire', 'fifty', 'warehouse', 'million', 'graduation', 'epilogue'];
