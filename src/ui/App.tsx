import { useEffect } from 'react';
import { type Speed, useGame } from '../state/store';
import { Diorama, useGameLoop } from './Diorama';
import { Hud } from './Hud';
import { AdminPanel } from './AdminPanel';
import { Laptop } from './Laptop';
import { Modals, Toast } from './Modals';
import { Feed, GoalNote } from './SidePanel';
import { LaunchChecklist } from './LaunchChecklist';
import { PhoneCard } from './Phone';
import { WeekCard } from './Week';

/** Space pauses, 1–4 pick a speed, S skips ahead (ignored while typing). */
function useShortcuts() {
  useEffect(() => {
    let lastSpeed: Speed = 1;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const st = useGame.getState();
      if (e.key === ' ') {
        e.preventDefault();
        if (st.speed) {
          lastSpeed = st.speed;
          st.setSpeed(0);
        } else st.setSpeed(lastSpeed);
      } else if (['1', '2', '3', '4'].includes(e.key)) st.setSpeed(([1, 2, 4, 8] as Speed[])[Number(e.key) - 1]);
      else if (e.key.toLowerCase() === 's' && !st.modal) st.skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  useGameLoop();
  useShortcuts();
  return (
    <div className="app">
      <Hud />
      <main className="main">
        <section className="left">
          <GoalNote />
          <WeekCard />
          <PhoneCard />
          <LaunchChecklist />
          <Diorama />
          <Feed />
        </section>
        <section className="right">
          <Laptop />
        </section>
      </main>
      <AdminPanel />
      <Modals />
      <Toast />
    </div>
  );
}
