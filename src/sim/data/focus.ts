import type { StageId } from '../types';

export type FocusId = 'ads' | 'suppliers' | 'freight' | 'customers' | 'content' | 'pages' | 'ops' | 'team' | 'retail' | 'rivals' | 'repeat' | 'friends' | 'investors';

export interface FocusCard {
  id: FocusId;
  name: string;
  icon: string;
  minStage: StageId;
  maxStage?: StageId;
  effect: string;
}

/** What the founder spends the week on. Each card is a week-long effect; you get a few slots per week. */
export const FOCUS: Record<FocusId, FocusCard> = {
  ads: { id: 'ads', name: 'Tune the ads', icon: '📣', minStage: 1, effect: '+8% ad click-through this week' },
  pages: { id: 'pages', name: 'Polish the store', icon: '🛍️', minStage: 1, effect: '+5% store conversion this week' },
  suppliers: { id: 'suppliers', name: 'Supplier calls', icon: '🏭', minStage: 1, effect: '−5% unit cost on orders placed this week' },
  customers: { id: 'customers', name: 'Answer every review', icon: '💬', minStage: 1, effect: '−20% refunds this week, a few extra good reviews' },
  content: { id: 'content', name: 'Make content', icon: '🎬', minStage: 1, effect: 'Brand awareness boost (more organic visitors)' },
  friends: { id: 'friends', name: 'Time with friends & family', icon: '❤️', minStage: 1, maxStage: 3, effect: 'Goodwill with Sam & Maya, Dad warms up' },
  freight: { id: 'freight', name: 'Freight shopping', icon: '🚢', minStage: 2, effect: '−15% freight on orders placed this week' },
  repeat: { id: 'repeat', name: 'Win back customers', icon: '🔁', minStage: 2, effect: '+15% repeat orders this week' },
  ops: { id: 'ops', name: 'Fix the packing line', icon: '📦', minStage: 2, effect: '+15% packing speed this week' },
  team: { id: 'team', name: 'Coach the team', icon: '👥', minStage: 2, effect: 'Team morale +12' },
  investors: { id: 'investors', name: 'Investor coffees', icon: '💼', minStage: 2, effect: 'Builds investor interest (needed to raise a round)' },
  rivals: { id: 'rivals', name: 'Study the rivals', icon: '🎯', minStage: 2, effect: 'Find a weak spot: your strongest rival loses ground' },
  retail: { id: 'retail', name: 'Pitch retailers', icon: '🏪', minStage: 3, effect: 'Much likelier wholesale inquiries for 2 weeks' },
};

export const FOCUS_ORDER: FocusId[] = ['ads', 'pages', 'suppliers', 'customers', 'content', 'friends', 'freight', 'repeat', 'ops', 'team', 'investors', 'rivals', 'retail'];

/** Focus slots per week by stage: the founder's attention is the scarce resource. */
export const FOCUS_SLOTS: Record<StageId, number> = { 1: 2, 2: 3, 3: 3, 4: 4, 5: 4 };
