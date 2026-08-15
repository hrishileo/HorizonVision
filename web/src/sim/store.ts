import { create } from "zustand";
import {
  DEFAULT_DENSITY,
  DEFAULT_SPEED,
  SENSOR_MIN,
  SENSOR_RANGE,
  type CameraMode,
  type Detection,
  type LogFrame,
  type SceneObject,
} from "./types";
import { buildPointCloud, detectLive, generateScene } from "./generateScene";

type SimState = {
  seed: number;
  objects: SceneObject[];
  cloud: Float32Array;
  sensorX: number;
  time: number;
  speed: number;
  density: number;
  irregular: boolean;
  cameraMode: CameraMode;
  hoveredId: number | null;
  playing: boolean;
  detections: Detection[];
  log: LogFrame[];
  visibleCount: number;
  reset: (seed?: number) => void;
  setPlaying: (v: boolean) => void;
  setSpeed: (v: number) => void;
  setDensity: (v: number) => void;
  setIrregular: (v: boolean) => void;
  setCameraMode: (v: CameraMode) => void;
  setHoveredId: (id: number | null) => void;
  setVisibleCount: (n: number) => void;
  tick: (dt: number) => void;
};

function makeWorld(seed: number, density: number, irregular: boolean) {
  const objects = generateScene(seed, density, irregular);
  const cloud = buildPointCloud(objects, seed);
  return { seed, objects, cloud };
}

export const useSim = create<SimState>((set, get) => ({
  seed: 0,
  objects: [],
  cloud: new Float32Array(0),
  sensorX: 0,
  time: 0,
  speed: DEFAULT_SPEED,
  density: DEFAULT_DENSITY,
  irregular: false,
  cameraMode: "drone",
  hoveredId: null,
  playing: true,
  detections: [],
  log: [],
  visibleCount: 0,
  reset: (seed) => {
    const { density, irregular } = get();
    const next = makeWorld(seed ?? Math.floor(Math.random() * 1_000_000), density, irregular);
    set({
      ...next,
      sensorX: 0,
      time: 0,
      detections: detectLive(next.objects, 0, SENSOR_MIN, SENSOR_RANGE),
      log: [],
      visibleCount: 0,
      hoveredId: null,
      playing: true,
    });
  },
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setDensity: (density) => {
    const clamped = Math.max(1, Math.min(10, Math.round(density)));
    const s = get();
    const next = makeWorld(s.seed || 42817, clamped, s.irregular);
    set({
      ...next,
      density: clamped,
      sensorX: 0,
      time: 0,
      detections: detectLive(next.objects, 0, SENSOR_MIN, SENSOR_RANGE),
      log: [],
      visibleCount: 0,
      hoveredId: null,
      playing: true,
    });
  },
  setIrregular: (irregular) => {
    const s = get();
    const next = makeWorld(s.seed || 42817, s.density, irregular);
    set({
      ...next,
      irregular,
      sensorX: 0,
      time: 0,
      detections: detectLive(next.objects, 0, SENSOR_MIN, SENSOR_RANGE),
      log: [],
      visibleCount: 0,
      hoveredId: null,
      playing: true,
    });
  },
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setHoveredId: (hoveredId) => set({ hoveredId }),
  setVisibleCount: (visibleCount) => set({ visibleCount }),
  tick: (dt) => {
    const s = get();
    if (!s.playing || s.objects.length === 0) return;
    const sensorX = Math.min(68, s.sensorX + s.speed * dt);
    const time = s.time + dt;
    const detections = detectLive(s.objects, sensorX, SENSOR_MIN, SENSOR_RANGE);
    const last = s.log[s.log.length - 1];
    const log =
      !last || time - last.time >= 0.12
        ? [
            ...s.log,
            {
              time: Number(time.toFixed(2)),
              sensorX: Number(sensorX.toFixed(2)),
              numPoints: s.visibleCount,
              detections,
            },
          ].slice(-240)
        : s.log;
    const playing = sensorX < 67.9;
    set({ sensorX, time, detections, log, playing });
  },
}));
