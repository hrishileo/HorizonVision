import { useEffect } from "react";
import { Pause, Play, RotateCcw, Download } from "lucide-react";
import { useSim } from "./store";

function downloadLog() {
  const { log, seed, objects, density, irregular } = useSim.getState();
  const payload = {
    seed,
    density,
    irregular,
    objects: objects.map((o) => ({
      id: o.id,
      label: o.label,
      center: o.center,
      size: o.size.map((n) => Number(n.toFixed(2))),
      yaw: Number(o.yaw.toFixed(3)),
    })),
    frames: log,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `horizon-vision-${seed}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Hud() {
  const playing = useSim((s) => s.playing);
  const time = useSim((s) => s.time);
  const sensorX = useSim((s) => s.sensorX);
  const speed = useSim((s) => s.speed);
  const density = useSim((s) => s.density);
  const irregular = useSim((s) => s.irregular);
  const cameraMode = useSim((s) => s.cameraMode);
  const detections = useSim((s) => s.detections);
  const visibleCount = useSim((s) => s.visibleCount);
  const log = useSim((s) => s.log);
  const objects = useSim((s) => s.objects);
  const hoveredId = useSim((s) => s.hoveredId);
  const setPlaying = useSim((s) => s.setPlaying);
  const setSpeed = useSim((s) => s.setSpeed);
  const setDensity = useSim((s) => s.setDensity);
  const setIrregular = useSim((s) => s.setIrregular);
  const setCameraMode = useSim((s) => s.setCameraMode);
  const reset = useSim((s) => s.reset);
  const hovered = objects.find((o) => o.id === hoveredId);

  useEffect(() => {
    if (objects.length === 0) reset(42817);
  }, [objects.length, reset]);

  return (
    <div className="hud">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div className="panel" style={{ maxWidth: 280, padding: "12px 16px" }}>
          <p className="muted" style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", margin: 0 }}>
            Horizon Vision
          </p>
          <h1 style={{ margin: "6px 0 4px", fontSize: 18 }}>Live LiDAR + Camera</h1>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            You are the drone. Hover a box to read its class.
          </p>
          <div className="seg" style={{ marginTop: 12 }}>
            <button type="button" className={cameraMode === "drone" ? "on" : ""} onClick={() => setCameraMode("drone")}>
              Drone
            </button>
            <button type="button" className={cameraMode === "third" ? "on" : ""} onClick={() => setCameraMode("third")}>
              Third person
            </button>
          </div>
          <div className="seg" style={{ marginTop: 8 }}>
            <button type="button" className={!irregular ? "on" : ""} onClick={() => setIrregular(false)}>
              Uniform
            </button>
            <button type="button" className={irregular ? "on" : ""} onClick={() => setIrregular(true)}>
              Irregular
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-primary" onClick={() => setPlaying(!playing)}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="btn" onClick={() => reset()}>
            <RotateCcw size={16} /> New scene
          </button>
          <button type="button" className="btn" onClick={downloadLog}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="panel" style={{ minWidth: 260, flex: "1 1 280px", maxWidth: 440 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
            <span className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Live detections</span>
            <span className="mono live" style={{ fontSize: 12 }}>{detections.length} in range</span>
          </div>
          {hovered && (
            <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
              <div className="muted" style={{ fontSize: 11 }}>Hover</div>
              <div style={{ textTransform: "capitalize" }}>{hovered.label}</div>
            </div>
          )}
          <div style={{ maxHeight: 180, overflow: "auto" }}>
            {detections.length === 0 ? (
              <p className="muted" style={{ padding: 12 }}>No objects in sensor range.</p>
            ) : (
              detections.map((d) => (
                <div key={d.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ textTransform: "capitalize" }}>
                    {d.label}
                    {objects.find((o) => o.id === d.id)?.irregular && (
                      <span className="warn" style={{ marginLeft: 6, fontSize: 12 }}>irregular</span>
                    )}
                  </span>
                  <span className="mono muted" style={{ fontSize: 12 }}>
                    {d.size[0].toFixed(1)}×{d.size[1].toFixed(1)}×{d.size[2].toFixed(1)}
                  </span>
                  <span className="mono accent" style={{ fontSize: 12 }}>{d.distance.toFixed(1)} m</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel" style={{ minWidth: 240, flex: "1 1 240px", maxWidth: 360, padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 14 }}>
            <div><div className="muted" style={{ fontSize: 12 }}>Time</div><div className="mono">{time.toFixed(1)} s</div></div>
            <div><div className="muted" style={{ fontSize: 12 }}>Sensor X</div><div className="mono">{sensorX.toFixed(1)} m</div></div>
            <div><div className="muted" style={{ fontSize: 12 }}>LiDAR returns</div><div className="mono">{visibleCount}</div></div>
            <div><div className="muted" style={{ fontSize: 12 }}>Vehicles</div><div className="mono">{objects.length}</div></div>
            <div><div className="muted" style={{ fontSize: 12 }}>Frames logged</div><div className="mono">{log.length}</div></div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Status</div>
              <div className={playing ? "live" : "warn"}>{playing ? "Collecting" : "Paused"}</div>
            </div>
          </div>
          <label>
            Traffic density {density}
            <input type="range" min={1} max={10} step={1} value={density} onChange={(e) => setDensity(Number(e.target.value))} />
          </label>
          <label>
            Speed {speed.toFixed(0)} m/s
            <input type="range" min={2} max={14} step={1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          </label>
        </div>
      </div>
    </div>
  );
}
