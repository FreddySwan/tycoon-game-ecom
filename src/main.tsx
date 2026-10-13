import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { boot } from './state/store';
import './ui/styles.css';

// Load the saved game before the first render so the diorama and laptop start in the right place.
void boot().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);

if (import.meta.env.DEV) {
  // Debug handles for playtesting from the console.
  void import('./state/store').then((m) => ((window as unknown as Record<string, unknown>).__store = m.useGame));
  void import('./sim/engine').then((m) => ((window as unknown as Record<string, unknown>).__engine = m));
  void import('./sim/bots').then((m) => ((window as unknown as Record<string, unknown>).__bots = m));
}
