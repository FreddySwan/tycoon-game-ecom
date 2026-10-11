import type { CharacterId } from '../types';

export const CHARACTERS: Record<CharacterId, { name: string; icon: string; role: string }> = {
  mom: { name: 'Mom', icon: '❤️', role: 'Lent you $2,000 from her savings. Believes in you, worries anyway.' },
  dad: { name: 'Dad', icon: '👨', role: 'Thinks dropping out was the biggest mistake of your life. Hasn’t called since.' },
  sam: { name: 'Sam', icon: '🧑', role: 'Best friend since middle school. Lent you $1,000 of his car fund.' },
  maya: { name: 'Maya', icon: '👩', role: 'Your old college roommate. Lent you $1,000 and wants a “founder discount”.' },
};

/** Who lent the starting $4,000. */
export const STARTING_DEBT = { mom: 2000, sam: 1000, maya: 1000 } as const;

/** Energy below these levels costs founder hours. */
export const TIRED = { energy: 35, hours: 2 };
export const EXHAUSTED = { energy: 15, hours: 4 };
