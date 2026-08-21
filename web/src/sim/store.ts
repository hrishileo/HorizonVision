import { create } from "zustand";
import {
  DEFAULT_BEV_CONFIG,
  detectionsFromGrid,
  emptyOccupancyGrid,
  rasterizeLidarSweep,
  type BevConfig,
  type OccupancyGrid,
} from "./occupancyGrid";
import {
  DEFAULT_DENSITY,
  DEFAULT_SPEED,
  type CameraMode,
  type Detection,
  type LogFrame,
  type SceneObject,
} from "./types";
import { buildPointCloud, generateScene } from "./generateScene";

type SimState = {
  seed: number;
  objects: SceneObject[];
  cloud: Float32Array;
  cloudIds: Int32Array;
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
  bevConfig: BevConfig;
  bev: OccupancyGrid;
  reset: (seed?: number) => void;
  setPlaying: (v: boolean) => void;
  setSpeed: (v: number) => void;
  setDensity: (v: number) => void;
  setIrregular: (v: boolean) => void;
  setCameraMode: (v: CameraMode) => void;
  setHoveredId: (id: number | null) => void;
  setVisibleCount: (n: number) => void;
  setBevCellSize: (cellSize: number) => void;
  tick: (dt: number) => void;
};

function makeWorld(seed: number, density: number, irregular: boolean) {
  const objects = generateScene(seed, density, irregular);
  const { positions, objectIds } = buildPointCloud(objects, seed);
  return { seed, objects, cloud: positions, cloudIds: objectIds };
}

function refreshBev(
  cloud: Float32Array,
  cloudIds: Int32Array,
  sensorX: number,
  objects: SceneObject[],
  bevConfig: BevConfig,
) {
  const bev = rasterizeLidarSweep(cloud, cloudIds, sensorX, objects, bevConfig);
  return { bev, detections: detectionsFromGrid(bev, objects, sensorX) };
}

export const useSim = create<SimState>((set, get) => ({
  seed: 0,
  objects: [],
  cloud: new Float32Array(0),
  cloudIds: new Int32Array(0),
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
  bevConfig: DEFAULT_BEV_CONFIG,
  bev: emptyOccupancyGrid(),
  reset: (seed) => {
    const { density, irregular, bevConfig } = get();
    const next = makeWorld(seed ?? Math.floor(Math.random() * 1_000_000), density, irregular);
    const { bev, detections } = refreshBev(next.cloud, next.cloudIds, 0, next.objects, bevConfig);
    set({
      ...next,
      sensorX: 0,
      time: 0,
      detections,
      bev,
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
    const { bev, detections } = refreshBev(next.cloud, next.cloudIds, 0, next.objects, s.bevConfig);
    set({
      ...next,
      density: clamped,
      sensorX: 0,
      time: 0,
      detections,
      bev,
      log: [],
      visibleCount: 0,
      hoveredId: null,
      playing: true,
    });
  },
  setIrregular: (irregular) => {
    const s = get();
    const next = makeWorld(s.seed || 42817, s.density, irregular);
    const { bev, detections } = refreshBev(next.cloud, next.cloudIds, 0, next.objects, s.bevConfig);
    set({
      ...next,
      irregular,
      sensorX: 0,
      time: 0,
      detections,
      bev,
      log: [],
      visibleCount: 0,
      hoveredId: null,
      playing: true,
    });
  },
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setHoveredId: (hoveredId) => set({ hoveredId }),
  setVisibleCount: (visibleCount) => set({ visibleCount }),
  setBevCellSize: (cellSize) => {
    const s = get();
    const next = Math.max(0.1, Math.min(4, cellSize));
    const bevConfig = { ...s.bevConfig, cellSize: next };
    const { bev, detections } = refreshBev(s.cloud, s.cloudIds, s.sensorX, s.objects, bevConfig);
    set({ bevConfig, bev, detections });
  },
  tick: (dt) => {
    const s = get();
    if (!s.playing || s.objects.length === 0) return;
    const sensorX = Math.min(68, s.sensorX + s.speed * dt);
    const time = s.time + dt;
    const { bev, detections } = refreshBev(s.cloud, s.cloudIds, sensorX, s.objects, s.bevConfig);
    const last = s.log[s.log.length - 1];
    const log =
      !last || time - last.time >= 0.12
        ? [
            ...s.log,
            {
              time: Number(time.toFixed(2)),
              sensorX: Number(sensorX.toFixed(2)),
              numPoints: s.visibleCount,
              occupiedCells: bev.occupied.length,
              blobs: bev.blobs.length,
              detections,
            },
          ].slice(-240)
        : s.log;
    // Never force-play: a user pause has to survive this write.
    const playing = get().playing && sensorX < 67.9;
    set({ sensorX, time, detections, bev, log, playing });
  },
}));
