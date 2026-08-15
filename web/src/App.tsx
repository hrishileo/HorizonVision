import { useEffect } from "react";
import { HorizonCanvas } from "./sim/HorizonCanvas";
import { Hud } from "./sim/Hud";
import { startEdgeIngest, startPredictionPoll } from "./sim/edgeIngest";

export function App() {
  useEffect(() => {
    const stopIngest = startEdgeIngest();
    const stopPred = startPredictionPoll();
    return () => {
      stopIngest();
      stopPred();
    };
  }, []);

  return (
    <main className="app">
      <HorizonCanvas />
      <Hud />
    </main>
  );
}
