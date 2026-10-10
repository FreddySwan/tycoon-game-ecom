import { Diorama } from './Diorama';
import { Hud } from './Hud';
import { Laptop } from './Laptop';
import { Modals, Toast } from './Modals';
import { Feed, GoalNote } from './SidePanel';

export function App() {
  return (
    <div className="app">
      <Hud />
      <main className="main">
        <section className="left">
          <GoalNote />
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
