import raw from "./simple-intersection.json";

export type Ring = [number, number][];

export type MapPoly = {
  id: string;
  kind: string;
  ring: Ring;
};

export type LocalMap = {
  units: string;
  origin: [number, number];
  roads: MapPoly[];
  sidewalks: MapPoly[];
  crosswalks: MapPoly[];
};

export const localMap = raw as LocalMap;

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
export const MAP_X_MAX = 78;
export const MAP_Z_MIN = -28;
export const MAP_Z_MAX = 28;

const roadAabbs = localMap.roads.map((p) => ringAabb(p.ring));
const sidewalkAabbs = localMap.sidewalks.map((p) => ringAabb(p.ring));

export function sampleRoadGround(count: number, rng: () => number, dest: number[], ids: number[]) {
  const areas = roadAabbs.map((b) => b.sx * b.sz);
  const total = areas.reduce((a, b) => a + b, 0);
  let leftover = count;
  for (let i = 0; i < roadAabbs.length; i++) {
    const b = roadAabbs[i]!;
    const n = i === roadAabbs.length - 1 ? leftover : Math.round((count * areas[i]!) / total);
    leftover -= n;
    for (let k = 0; k < n; k++) {
      dest.push(b.minX + rng() * b.sx, rng() * 0.05, b.minZ + rng() * b.sz);
      ids.push(0);
    }
  }
}

export function pickSidewalkPoint(rng: () => number): [number, number] {
  for (let attempt = 0; attempt < 16; attempt++) {
    const b = sidewalkAabbs[Math.floor(rng() * sidewalkAabbs.length)]!;
    const x = b.minX + 0.35 + rng() * Math.max(0.2, b.sx - 0.7);
    const z = b.minZ + 0.25 + rng() * Math.max(0.2, b.sz - 0.5);
    if (Math.abs(z) > 6) return [x, z];
  }
  return [12, 7];
}
