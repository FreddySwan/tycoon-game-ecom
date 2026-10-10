import { Diorama, useGameLoop } from './Diorama';
import { Hud } from './Hud';
import { Laptop } from './Laptop';
import { Modals, Toast } from './Modals';
import { Feed, GoalNote } from './SidePanel';
import { LaunchChecklist } from './LaunchChecklist';

export function App() {
  useGameLoop();
  return (
    <div className="app">
      <Hud />
      <main className="main">
        <section className="left">
          <GoalNote />
          <LaunchChecklist />
          <Diorama />
          <Feed />
        </section>
        <section className="right">
          <Laptop />
        </section>
      </main>
      <Modals />
      <Toast />
    </div>
  );
}
