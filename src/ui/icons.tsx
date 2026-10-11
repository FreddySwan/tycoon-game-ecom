import type { CSSProperties, ReactNode } from 'react';
import { type IconName, SVG } from './iconSvgs';

export type { IconName };


/** Emoji that older text (sim notices, data labels) still uses, mapped to their pixel icon. */
export const EMOJI_ICON: Record<string, IconName> = {
  '📦': 'archive', '🔍': 'search', '🔎': 'search', '📝': 'note', '📸': 'camera', '📷': 'camera', '💡': 'lightbulb', '✅': 'check',
  '🗞': 'article', '💌': 'mailHeart', '📊': 'chartBar', '😬': 'sad', '🎉': 'trophy', '📉': 'trendingDown', '🔒': 'lock', '⏸': 'pause',
  '⏩': 'forward', '⏭': 'next', '🔇': 'volumeX', '🔊': 'volume', '☰': 'menu', '🛠': 'debug', '📌': 'pin', '🧪': 'zoomIn', '🎯': 'bullseye',
  '👍': 'happy', '🧐': 'neutral', '❌': 'close', '📈': 'trendingUp', '🏭': 'buildings', '🛍': 'shoppingBag', '🏷': 'label', '📣': 'radioSignal',
  '🛒': 'cart', '👥': 'users', '📬': 'inbox', '💵': 'money', '🏢': 'building', '🚀': 'checklist', '🎁': 'gift', '🧱': 'layout', '⚠': 'warning',
  '✕': 'close', '💬': 'chat', '⛏': 'lightbulbOn', '🐈': 'heart', '✨': 'zap', '💸': 'money', '🦺': 'humanUp', '🎬': 'movie', '🔥': 'zap',
  '🧭': 'gps', '🏪': 'store', '⚡': 'zap', '⬆': 'arrowUp', '🛡': 'shield', '❓': 'infoBox', '🚚': 'truck', '🤔': 'neutral', '🤨': 'neutral',
  '⏰': 'clock', '🤝': 'briefcaseCheck', '🎧': 'headset', '✏': 'edit', '🎨': 'colors', '🌍': 'map', '✈': 'speedFast', '🚢': 'ship',
  '🔁': 'repeat', '🤖': 'android', '⏳': 'hourglass', '🧾': 'reciept', '💳': 'creditCard', '⭐': 'trophy', '📧': 'mail', '🗄': 'archive',
  '➡': 'arrowRight', '📞': 'deskphone', '🏗': 'buildings', '🚛': 'truck', '🧽': 'close', '😴': 'moon', '☕': 'coffee', '🥪': 'coffee',
  '🍳': 'coffee', '📺': 'tv', '💤': 'moon', '🚶': 'human', '🐾': 'heart', '🧑': 'user', '💼': 'briefcase', '👩': 'user', '👨': 'user',
  '🔧': 'sliders', '🧵': 'edit', '💛': 'heart', '🏬': 'store', '👑': 'trophy', '🗂': 'folder', '🖼': 'image', '🏠': 'home', '🖥': 'monitor',
  '💪': 'humanRun', '🥣': 'coffee', '🪴': 'drop', '💻': 'laptop', '⛲': 'drop', '🫙': 'drop', '🎗': 'flag', '🌅': 'sun', '🧲': 'link',
  '🛏': 'bed', '🧘': 'human', '😞': 'sad', '🔔': 'notification', '🏆': 'trophy', '🧰': 'archive', '💰': 'coin', '📮': 'mail', '💎': 'trophy',
  '🌆': 'buildings', '📖': 'book', '😕': 'sad', '😤': 'sad', '♥': 'heart', '📱': 'phone', '🎂': 'cake', '📅': 'calendar', '🎓': 'teach',
  '⚖': 'scale', '👋': 'happy', '😊': 'happy', '❤': 'heart', '📚': 'book', '🧠': 'lightbulb', '💻️': 'laptop', '🏁': 'flag', '📩': 'mail', '🍕': 'cake',
};

// Emoji plus any variation selector, skin tone or zero-width-joined parts. ★ ☆ ✦ → ↑ ↓ stay as plain text glyphs.
const EMOJI_RE = /(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{2604}\u{2607}-\u{2725}\u{2727}-\u{27BF}\u{2B50}\u{2B06}\u{23E9}-\u{23FA}])(?:\u{FE0F}|[\u{1F3FB}-\u{1F3FF}]|\u{200D}[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\u{FE0F}?)*/gu;

interface Props {
  name: IconName;
  size?: number | string;
  color?: string;
  title?: string;
  style?: CSSProperties;
  className?: string;
}

export function Icon({ name, size = '1.15em', color, title, style, className = '' }: Props) {
  return (
    <span
      className={`px-icon ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      title={title}
      style={{ width: size, height: size, color, ...style }}
      dangerouslySetInnerHTML={{ __html: SVG[name] }}
    />
  );
}

export function iconFor(emoji: string): IconName | null {
  const base = [...emoji][0];
  return EMOJI_ICON[base] ?? null;
}

/** Render text, swapping any emoji for its pixel icon (unknown emoji are dropped). */
export function withIcons(text: string | null | undefined, size?: number | string): ReactNode {
  if (!text) return text ?? null;
  const parts: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(EMOJI_RE)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    const name = iconFor(m[0]);
    if (name) parts.push(<Icon key={k++} name={name} size={size} />);
    last = at + m[0].length;
  }
  if (!parts.length) return text;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Plain-text version (for title attributes, Pixi labels and the like). */
export function stripEmoji(text: string): string {
  return text.replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
}
