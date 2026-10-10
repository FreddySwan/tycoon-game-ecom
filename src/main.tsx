import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.DEV) {
  // Debug handles for playtesting from the console.
  void import('./state/store').then((m) => ((window as unknown as Record<string, unknown>).__store = m.useGame));
  void import('./sim/engine').then((m) => ((window as unknown as Record<string, unknown>).__engine = m));
}
