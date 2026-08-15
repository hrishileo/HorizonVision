import { HorizonCanvas } from "./sim/HorizonCanvas";
import { Hud } from "./sim/Hud";

export function App() {
  return (
    <main className="app">
      <HorizonCanvas />
      <Hud />
    </main>
  );
}
