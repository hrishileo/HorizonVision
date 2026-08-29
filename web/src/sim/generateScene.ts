import {
  LANE_Z,
  OBJECT_SPECS,
  ROAD_LENGTH,
  type ObjectLabel,
  type SceneObject,
} from "./types";
import { pickSidewalkPoint, sampleRoadGround } from "./map/intersection";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng: () => number, min: number, max: number) {
  return min + rng() * (max - min);
}

function pickVehicle(rng: () => number): ObjectLabel {
  const r = rng();
  if (r < 0.52) return "car";
  if (r < 0.74) return "van";
  if (r < 0.86) return "truck";
  if (r < 0.93) return "bus";
  return "motorcycle";
}

function sized(rng: () => number, label: ObjectLabel): [number, number, number] {
  const spec = OBJECT_SPECS[label];
  return [
    randRange(rng, spec.size[0][0], spec.size[0][1]),
    randRange(rng, spec.size[1][0], spec.size[1][1]),
    randRange(rng, spec.size[2][0], spec.size[2][1]),
  ];
}

/** density 1–10 → vehicles per lane. irregular adds a lane-change car and a pedestrian in the road. */
export function generateScene(
  seed: number,
  density = 5,
  irregular = false,
): SceneObject[] {
  const rng = mulberry32(seed);
  const perLane = Math.max(2, Math.min(10, Math.round(density)));
  const objects: SceneObject[] = [];
  let id = 1;

  const startX = 12;
  const endX = ROAD_LENGTH - 8;
  const span = endX - startX;

  const vehicleIds: number[] = [];

  for (let lane = 0; lane < 2; lane++) {
    const z = LANE_Z[lane]!;
    const heading = lane === 0 ? Math.PI : 0;
    const gap = span / perLane;
    for (let i = 0; i < perLane; i++) {
      const label = pickVehicle(rng);
      const size = sized(rng, label);
      const cx = startX + gap * (i + 0.5) + randRange(rng, -0.45, 0.45);
      if (cx > 31 && cx < 47) continue;
      const obj: SceneObject = {
        id: id++,
        label,
        center: [cx, 0, z + randRange(rng, -0.12, 0.12)],
        size,
        yaw: heading + randRange(rng, -0.02, 0.02),
        color: OBJECT_SPECS[label].color,
      };
      objects.push(obj);
      if (label === "car" || label === "van") vehicleIds.push(obj.id);
    }
  }

  const walkers = Math.max(1, Math.round(perLane * 0.4));
  for (let i = 0; i < walkers; i++) {
    const [wx, wz] = i === 0 ? ([11.2, 7.05] as [number, number]) : pickSidewalkPoint(rng);
    objects.push({
      id: id++,
      label: "pedestrian",
      center: [wx, 0, wz],
      size: sized(rng, "pedestrian"),
      yaw: wz > 0 ? Math.PI : 0,
      color: OBJECT_SPECS.pedestrian.color,
    });
  }

  if (irregular) {
    const pickId =
      vehicleIds[Math.floor(rng() * Math.max(1, vehicleIds.length))] ??
      objects.find((o) => o.label !== "pedestrian")?.id;
    const stray = objects.find((o) => o.id === pickId);
    if (stray) {
      const towardCenter = stray.center[2] > 0 ? -1 : 1;
      const nz = stray.center[2] + towardCenter * randRange(rng, 1.8, 2.6);
      if (Math.abs(nz) < 6 && !(stray.center[0] > 31 && stray.center[0] < 47)) {
        stray.center = [stray.center[0], 0, nz];
        stray.yaw += towardCenter * randRange(rng, 0.28, 0.42);
        stray.irregular = "lane-departure";
      }
    }

  }

  return objects;
}

export type SimCloud = {
  positions: Float32Array;
  /** 0 = ground / unlabeled. Otherwise the SceneObject.id that spawned the return. */
  objectIds: Int32Array;
};

export function buildPointCloud(objects: SceneObject[], seed: number): SimCloud {
  const rng = mulberry32(seed + 91);
  const pts: number[] = [];
  const ids: number[] = [];

  sampleRoadGround(7200, rng, pts, ids);

  for (const obj of objects) {
    const [l, w, h] = obj.size;
    const n =
      obj.label === "pedestrian" ? 160 : obj.label === "motorcycle" ? 200 : 320;
    const c = Math.cos(obj.yaw);
    const s = Math.sin(obj.yaw);
    for (let i = 0; i < n; i++) {
      const lx = randRange(rng, -l / 2, l / 2);
      const lz = randRange(rng, -w / 2, w / 2);
      const ly = randRange(rng, 0.05, h);
      pts.push(obj.center[0] + c * lx - s * lz, ly, obj.center[2] + s * lx + c * lz);
      ids.push(obj.id);
    }
  }

  return { positions: new Float32Array(pts), objectIds: new Int32Array(ids) };
}

export function detectLive(
  objects: SceneObject[],
  sensorX: number,
  minRange: number,
  maxRange: number,
) {
  return objects
    .map((obj) => {
      const rel = obj.center[0] - sensorX;
      const dist = Math.hypot(rel, obj.center[2]);
      return {
        id: obj.id,
        label: obj.label,
        center: obj.center,
        size: obj.size,
        yaw: obj.yaw,
        distance: dist,
        relativeX: rel,
      };
    })
    .filter((d) => d.relativeX > minRange && d.relativeX < maxRange)
    .sort((a, b) => a.distance - b.distance);
}
