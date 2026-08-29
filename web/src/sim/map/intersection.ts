import raw from "./simple-intersection.json";

export type Ring = [number, number][];

export type MapPoly = {
  id: string;
  kind: string;
  ring: Ring;
};

export type Roundabout = {
  cx: number;
  cz: number;
  inner: number;
  apron?: number;
  outer: number;
};

export type LocalMap = {
  units: string;
  origin: [number, number];
  place?: { name: string; road: string; area: string; lat: number; lon: number };
  roundabout: Roundabout;
  roads: MapPoly[];
  medians?: MapPoly[];
  sidewalks: MapPoly[];
  crosswalks: MapPoly[];
};

export const localMap = raw as LocalMap;
export const ROUNDABOUT = localMap.roundabout;

export type Aabb = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cz: number;
  sx: number;
  sz: number;
};

export function ringAabb(ring: Ring): Aabb {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    sx: maxX - minX,
    sz: maxZ - minZ,
  };
}

export const MAP_X_MIN = 0;
export const MAP_X_MAX = 120;
export const MAP_Z_MIN = -50;
export const MAP_Z_MAX = 50;

const roadAabbs = localMap.roads.map((p) => ringAabb(p.ring));
const sidewalkAabbs = localMap.sidewalks.map((p) => ringAabb(p.ring));

export function pointInAabb(x: number, z: number, b: Aabb) {
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

export function inRoundabout(x: number, z: number, pad = 0) {
  return Math.hypot(x - ROUNDABOUT.cx, z - ROUNDABOUT.cz) < ROUNDABOUT.outer + pad;
}

export function onRoundaboutRing(x: number, z: number) {
  const r = Math.hypot(x - ROUNDABOUT.cx, z - ROUNDABOUT.cz);
  return r >= ROUNDABOUT.inner && r <= ROUNDABOUT.outer;
}

export function onRoad(x: number, z: number) {
  if (onRoundaboutRing(x, z)) return true;
  return roadAabbs.some((b) => pointInAabb(x, z, b));
}

export function onSidewalk(x: number, z: number) {
  return sidewalkAabbs.some((b) => pointInAabb(x, z, b));
}

export function overlapsCarriageway(x: number, z: number, hx: number, hz: number) {
  const x0 = x - hx;
  const x1 = x + hx;
  const z0 = z - hz;
  const z1 = z + hz;
  if (inRoundabout(x, z, Math.max(hx, hz))) return true;
  for (const b of roadAabbs) {
    if (x0 < b.maxX && x1 > b.minX && z0 < b.maxZ && z1 > b.minZ) return true;
  }
  for (const b of sidewalkAabbs) {
    if (x0 < b.maxX && x1 > b.minX && z0 < b.maxZ && z1 > b.minZ) return true;
  }
  return false;
}

export function sampleRoadGround(count: number, rng: () => number, dest: number[], ids?: number[]) {
  const ringArea =
    Math.PI * (ROUNDABOUT.outer * ROUNDABOUT.outer - ROUNDABOUT.inner * ROUNDABOUT.inner);
  const areas = roadAabbs.map((b) => b.sx * b.sz);
  const rectTotal = areas.reduce((a, b) => a + b, 0);
  const total = rectTotal + ringArea;
  const ringN = Math.round((count * ringArea) / total);
  let leftover = count - ringN;
  for (let i = 0; i < roadAabbs.length; i++) {
    const b = roadAabbs[i]!;
    const n = i === roadAabbs.length - 1 ? leftover : Math.round((count * areas[i]!) / total);
    leftover -= n;
    for (let k = 0; k < n; k++) {
      dest.push(b.minX + rng() * b.sx, rng() * 0.05, b.minZ + rng() * b.sz);
      ids?.push(0);
    }
  }
  for (let k = 0; k < ringN; k++) {
    const u = rng();
    const r = Math.sqrt(u * (ROUNDABOUT.outer ** 2 - ROUNDABOUT.inner ** 2) + ROUNDABOUT.inner ** 2);
    const a = rng() * Math.PI * 2;
    dest.push(ROUNDABOUT.cx + Math.cos(a) * r, rng() * 0.05, ROUNDABOUT.cz + Math.sin(a) * r);
    ids?.push(0);
  }
}

export function pickSidewalkPoint(rng: () => number): [number, number] {
  for (let attempt = 0; attempt < 20; attempt++) {
    const b = sidewalkAabbs[Math.floor(rng() * sidewalkAabbs.length)]!;
    const x = b.minX + 0.35 + rng() * Math.max(0.2, b.sx - 0.7);
    const z = b.minZ + 0.25 + rng() * Math.max(0.2, b.sz - 0.5);
    if (!inRoundabout(x, z, 1.2) && Math.abs(z) > 16) return [x, z];
  }
  return [12, 17.2];
}
