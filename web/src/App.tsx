import { useEffect } from "react";
import { HorizonCanvas } from "./sim/HorizonCanvas";
import { Hud } from "./sim/Hud";
import { startEdgeIngest } from "./sim/edgeIngest";

export function App() {
  useEffect(() => startEdgeIngest(), []);

  return (
    <main className="app">
      <HorizonCanvas />
      <Hud />
    </main>
  );
}
