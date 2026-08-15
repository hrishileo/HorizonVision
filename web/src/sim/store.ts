import { create } from "zustand";
import {
  DEFAULT_DENSITY,
  DEFAULT_SPEED,
  SENSOR_MIN,
  SENSOR_RANGE,
  type CameraMode,
  type Detection,
  type DetectorMetrics,
  type LogFrame,
  type PredictedDetection,
  type SceneObject,
} from "./types";
import { buildPointCloud, detectLive, generateScene } from "./generateScene";
import { nextSensorX, reachedEnd } from "./playback";

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
  /** User pause. tick() must not clear this or write playing: true. */
  paused: boolean;
  detections: Detection[];
  predictions: PredictedDetection[];
  metrics: DetectorMetrics | null;
  log: LogFrame[];
  visibleCount: number;
  reset: (seed?: number) => void;
  rewind: () => void;
  pause: () => void;
  play: () => void;
  setPlaying: (v: boolean) => void;
  setSpeed: (v: number) => void;
  setDensity: (v: number) => void;
  setIrregular: (v: boolean) => void;
  setCameraMode: (v: CameraMode) => void;
  setHoveredId: (id: number | null) => void;
  setVisibleCount: (n: number) => void;
  setPredictions: (predictions: PredictedDetection[], metrics: DetectorMetrics | null) => void;
  tick: (dt: number) => void;
};

function makeWorld(seed: number, density: number, irregular: boolean) {
  const objects = generateScene(seed, density, irregular);
  const cloud = buildPointCloud(objects, seed);
  return { seed, objects, cloud };
}

function liveDetections(objects: SceneObject[], sensorX: number) {
  return detectLive(objects, sensorX, SENSOR_MIN, SENSOR_RANGE);
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
  paused: false,
  detections: [],
  predictions: [],
  metrics: null,
  log: [],
  visibleCount: 0,
  reset: (seed) => {
    const { density, irregular } = get();
    const next = makeWorld(seed ?? Math.floor(Math.random() * 1_000_000), density, irregular);
    set({
      ...next,
      sensorX: 0,
      time: 0,
      detections: liveDetections(next.objects, 0),
      predictions: [],
      metrics: null,
      log: [],
      visibleCount: 0,
      hoveredId: null,
      paused: false,
      playing: true,
    });
  },
  rewind: () => {
    const s = get();
    if (s.objects.length === 0) return;
    set({
      sensorX: 0,
      time: 0,
      detections: liveDetections(s.objects, 0),
      predictions: [],
      metrics: null,
      log: [],
      visibleCount: 0,
      hoveredId: null,
      paused: false,
      playing: true,
    });
  },
  pause: () => set({ paused: true, playing: false }),
  play: () => {
    if (reachedEnd(get().sensorX)) {
      get().rewind();
      return;
    }
    set({ paused: false, playing: true });
  },
  setPlaying: (playing) => {
    if (playing) get().play();
    else get().pause();
  },
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
      detections: liveDetections(next.objects, 0),
      predictions: [],
      metrics: null,
      log: [],
      visibleCount: 0,
      hoveredId: null,
      paused: false,
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
      detections: liveDetections(next.objects, 0),
      predictions: [],
      metrics: null,
      log: [],
      visibleCount: 0,
      hoveredId: null,
      paused: false,
      playing: true,
    });
  },
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setHoveredId: (hoveredId) => set({ hoveredId }),
  setVisibleCount: (visibleCount) => set({ visibleCount }),
  setPredictions: (predictions, metrics) => set({ predictions, metrics }),
  tick: (dt) => {
    // User pause wins over any in-flight frame. Never write playing: true.
    if (get().paused || !get().playing) return;
    const s = get();
    if (s.objects.length === 0) return;
    const sensorX = nextSensorX(s.sensorX, s.speed, dt);
    const time = s.time + dt;
    const detections = liveDetections(s.objects, sensorX);
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
    if (get().paused) return;
    if (reachedEnd(sensorX)) {
      set({ sensorX, time, detections, log, playing: false });
      return;
    }
    set({ sensorX, time, detections, log });
  },
}));
