import { useMemo } from "react";
import { localMap, ringAabb, ROUNDABOUT } from "./intersection";

function PolyPlane({
  ring,
  y,
  color,
}: {
  ring: [number, number][];
  y: number;
  color: string;
}) {
  const b = ringAabb(ring);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[b.cx, y, b.cz]} receiveShadow>
      <planeGeometry args={[b.sx, b.sz]} />
      <meshStandardMaterial color={color} roughness={0.92} metalness={0.06} />
    </mesh>
  );
}

function CrosswalkStripes({ ring }: { ring: [number, number][] }) {
  const stripes = useMemo(() => {
    const b = ringAabb(ring);
    const out: { x: number; z: number; sx: number; sz: number }[] = [];
    const bar = 0.4;
    const gap = 0.4;
    const alongZ = b.sz >= b.sx;
    if (alongZ) {
      for (let z = b.minZ + 0.12; z + bar < b.maxZ - 0.08; z += bar + gap) {
        out.push({ x: b.cx, z: z + bar / 2, sx: b.sx - 0.12, sz: bar });
      }
    } else {
      for (let x = b.minX + 0.12; x + bar < b.maxX - 0.08; x += bar + gap) {
        out.push({ x: x + bar / 2, z: b.cz, sx: bar, sz: b.sz - 0.12 });
      }
    }
    return out;
  }, [ring]);

  return (
    <group>
      {stripes.map((s, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[s.x, 0.013, s.z]}>
          <planeGeometry args={[s.sx, s.sz]} />
          <meshBasicMaterial color="#e8e6dc" />
        </mesh>
      ))}
    </group>
  );
}

function LaneDashes() {
  const dashes = useMemo(() => {
    const out: { x: number; z: number; sx: number; sz: number; rot: number }[] = [];
    const dash = 2.2;
    const gap = 2.4;
    const mark = (x0: number, x1: number, z: number) => {
      for (let x = x0 + 0.4; x + dash < x1 - 0.3; x += dash + gap) {
        out.push({ x: x + dash / 2, z, sx: dash, sz: 0.12, rot: 0 });
      }
    };
    const markZ = (z0: number, z1: number, x: number) => {
      for (let z = z0 + 0.4; z + dash < z1 - 0.3; z += dash + gap) {
        out.push({ x, z: z + dash / 2, sx: 0.12, sz: dash, rot: 0 });
      }
    };
    for (const z of [-12.47, -8.63, 8.63, 12.47]) {
      mark(0, 29.5, z);
      mark(86.5, 120, z);
    }
    for (const x of [45.53, 49.37, 66.63, 70.47]) {
      markZ(-50, -28.5, x);
      markZ(28.5, 50, x);
    }
    const { cx, cz, inner, outer } = ROUNDABOUT;
    const laneW = (outer - inner) / 3;
    for (const r of [inner + laneW, inner + laneW * 2]) {
      const n = 56;
      const step = (Math.PI * 2) / n;
      for (let i = 0; i < n; i += 2) {
        const a = i * step;
        out.push({
          x: cx + Math.cos(a) * r,
          z: cz + Math.sin(a) * r,
          sx: 2.1,
          sz: 0.12,
          rot: a + Math.PI / 2,
        });
      }
    }
    return out;
  }, []);

  return (
    <group>
      {dashes.map((d, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, d.rot]}
          position={[d.x, 0.014, d.z]}
        >
          <planeGeometry args={[d.sx, d.sz]} />
          <meshBasicMaterial color="#d4d0c4" />
        </mesh>
      ))}
    </group>
  );
}

export function IntersectionMesh() {
  const { cx, cz, inner, outer } = ROUNDABOUT;
  const apron = ROUNDABOUT.apron ?? inner + 1.6;
  return (
    <group>
      {localMap.roads.map((p) => (
        <PolyPlane key={p.id} ring={p.ring} y={0} color="#2c2c32" />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.004, cz]} receiveShadow>
        <ringGeometry args={[apron, outer, 72]} />
        <meshStandardMaterial color="#2c2c32" roughness={0.92} metalness={0.06} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.008, cz]} receiveShadow>
        <ringGeometry args={[inner, apron, 72]} />
        <meshStandardMaterial color="#6a675c" roughness={0.88} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.05, cz]} receiveShadow>
        <circleGeometry args={[inner - 0.15, 56]} />
        <meshStandardMaterial color="#3d5a38" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.06, cz]}>
        <circleGeometry args={[3.2, 28]} />
        <meshStandardMaterial color="#c9c4b0" roughness={0.9} />
      </mesh>
      {(localMap.medians ?? []).map((p) => (
        <PolyPlane key={p.id} ring={p.ring} y={0.045} color="#3d5a38" />
      ))}
      {localMap.sidewalks.map((p) => (
        <PolyPlane key={p.id} ring={p.ring} y={0.05} color="#5a5a62" />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.052, cz]} receiveShadow>
        <ringGeometry args={[outer, outer + 2.1, 72]} />
        <meshStandardMaterial color="#5a5a62" roughness={0.9} />
      </mesh>
      {localMap.crosswalks.map((p) => (
        <CrosswalkStripes key={p.id} ring={p.ring} />
      ))}
      <LaneDashes />
    </group>
  );
}
