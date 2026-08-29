import { useMemo } from "react";
import * as THREE from "three";
import { ROAD_LENGTH, type WorldKind } from "./types";
import { useSim } from "./store";
import { IntersectionMesh } from "./map/IntersectionMesh";
import { overlapsCarriageway, ROUNDABOUT } from "./map/intersection";

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

export const WORLD_THEME: Record<
  WorldKind,
  {
    bg: string;
    fogNear: number;
    fogFar: number;
    hemiSky: string;
    hemiGround: string;
    hemi: number;
    dir: number;
    amb: number;
    ground: string;
    verge: string;
  }
> = {
  city: {
    bg: "#0a101c",
    fogNear: 28,
    fogFar: 150,
    hemiSky: "#8aa0b8",
    hemiGround: "#121018",
    hemi: 0.42,
    dir: 0.85,
    amb: 0.18,
    ground: "#1a1810",
    verge: "#3a3a40",
  },
  forest: {
    bg: "#1a241c",
    fogNear: 34,
    fogFar: 110,
    hemiSky: "#a8c4a0",
    hemiGround: "#1c1810",
    hemi: 0.55,
    dir: 1.05,
    amb: 0.3,
    ground: "#24301c",
    verge: "#334828",
  },
  open: {
    bg: "#8aa6b8",
    fogNear: 42,
    fogFar: 140,
    hemiSky: "#e4eef4",
    hemiGround: "#6a6248",
    hemi: 0.7,
    dir: 1.35,
    amb: 0.48,
    ground: "#8a965c",
    verge: "#9aa86a",
  },
};

type Building = { x: number; z: number; sx: number; sy: number; sz: number; color: string };

function Palm({ x, z, h = 5.4 }: { x: number; z: number; h?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h * 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.16, h * 0.76, 6]} />
        <meshStandardMaterial color="#6a5340" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh
          key={i}
          position={[
            Math.cos((i / 6) * Math.PI * 2) * 0.55,
            h * 0.78,
            Math.sin((i / 6) * Math.PI * 2) * 0.55,
          ]}
          rotation={[0.55, (i / 6) * Math.PI * 2, 0]}
        >
          <boxGeometry args={[0.12, 0.04, 1.35]} />
          <meshStandardMaterial color="#3d6a3c" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function SunshineResidences() {
  return (
    <group position={[18, 0, -32]}>
      <mesh position={[0, 17, 0]} castShadow receiveShadow>
        <boxGeometry args={[26, 34, 16]} />
        <meshStandardMaterial color="#c4b49a" roughness={0.72} metalness={0.08} />
      </mesh>
      <mesh position={[0, 17, 8.08]}>
        <boxGeometry args={[22, 30, 0.12]} />
        <meshStandardMaterial color="#3a4a58" roughness={0.35} metalness={0.25} />
      </mesh>
      <mesh position={[13.05, 17, 0]}>
        <boxGeometry args={[0.35, 34, 16.1]} />
        <meshStandardMaterial color="#c4784a" roughness={0.55} />
      </mesh>
      {Array.from({ length: 10 }).map((_, r) =>
        Array.from({ length: 5 }).map((_, c) => (
          <mesh key={`${r}-${c}`} position={[-8 + c * 4, 3.2 + r * 3.05, 8.12]}>
            <planeGeometry args={[1.6, 1.7]} />
            <meshBasicMaterial color={c % 2 === 0 ? "#c9d6ae" : "#d8c07a"} />
          </mesh>
        )),
      )}
    </group>
  );
}

function CityBlock() {
  const buildings = useMemo(() => {
    const rng = mulberry32(17);
    const list: Building[] = [];
    const palette = ["#b9a890", "#9a8a78", "#cfc3b0", "#8a8074"];
    const extras: Building[] = [
      { x: 96, z: -34, sx: 20, sy: 28, sz: 16, color: "#b0a090" },
      { x: 18, z: 34, sx: 22, sy: 26, sz: 16, color: "#c2b6a4" },
      { x: 96, z: 34, sx: 18, sy: 22, sz: 15, color: "#a89886" },
      { x: 4, z: 33, sx: 16, sy: 18, sz: 14, color: "#d0c4b2" },
    ];
    for (const b of extras) list.push(b);
    for (const side of [-1, 1]) {
      let x = 4;
      while (x < ROAD_LENGTH + 6) {
        const sx = 6 + rng() * 8;
        const sz = 8 + rng() * 8;
        const sy = 10 + rng() * 16;
        const gap = 1.4 + rng() * 2.2;
        const bx = x + sx / 2;
        const bz = side * (22 + sz / 2);
        if (overlapsCarriageway(bx, bz, sx / 2, sz / 2) || Math.hypot(bx - 18, bz + 32) < 28) {
          x += sx + gap;
          continue;
        }
        list.push({
          x: bx,
          z: bz,
          sx,
          sy,
          sz,
          color: palette[Math.floor(rng() * palette.length)]!,
        });
        x += sx + gap;
      }
    }
    return list;
  }, []);

  const palms = useMemo(() => {
    const { cx, cz, inner } = ROUNDABOUT;
    const list: { x: number; z: number; h: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.15;
      list.push({
        x: cx + Math.cos(a) * (inner * 0.62),
        z: cz + Math.sin(a) * (inner * 0.62),
        h: 5.0 + (i % 3) * 0.45,
      });
    }
    return list;
  }, []);

  return (
    <group>
      <SunshineResidences />
      {buildings.map((b, i) => (
        <mesh key={i} position={[b.x, b.sy / 2, b.z]} castShadow receiveShadow>
          <boxGeometry args={[b.sx, b.sy, b.sz]} />
          <meshStandardMaterial color={b.color} roughness={0.86} metalness={0.08} />
        </mesh>
      ))}
      {palms.map((p, i) => (
        <Palm key={i} x={p.x} z={p.z} h={p.h} />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[18, 0.01, -32]} receiveShadow>
        <planeGeometry args={[28, 14]} />
        <meshStandardMaterial color="#c2a878" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[80, 0.01, 30]} receiveShadow>
        <planeGeometry args={[22, 16]} />
        <meshStandardMaterial color="#c2a878" roughness={1} />
      </mesh>
    </group>
  );
}

type TreeSpec = {
  x: number;
  z: number;
  h: number;
  kind: "pine" | "oak";
  rot: number;
};

function Trees({ density }: { density: "sparse" | "few" }) {
  const trees = useMemo(() => {
    const rng = mulberry32(density === "sparse" ? 41 : 77);
    const list: TreeSpec[] = [];
    const step = density === "sparse" ? 6.8 : 20;
    const extra = density === "sparse" ? 2.8 : 11;
    const chance = density === "sparse" ? 0.7 : 0.38;
    if (density === "sparse") {
      list.push(
        { x: 11, z: 16, h: 6.4, kind: "pine", rot: 0.2 },
        { x: 15.5, z: -16, h: 7.1, kind: "oak", rot: 1.1 },
        { x: 21, z: 18, h: 5.6, kind: "pine", rot: 0.5 },
        { x: 72, z: -16, h: 6.8, kind: "pine", rot: 2.1 },
      );
    } else {
      list.push(
        { x: 18, z: -22, h: 5.2, kind: "oak", rot: 0.4 },
        { x: 72, z: 22, h: 6.0, kind: "pine", rot: 1.3 },
      );
    }
    for (const side of [-1, 1]) {
      let x = 8 + rng() * 3;
      while (x < ROAD_LENGTH + 6) {
        if (rng() < chance) {
          const tx = x;
          const tz = side * (12.7 + extra + rng() * 7);
          if (!overlapsCarriageway(tx, tz, 1.6, 1.6)) {
            list.push({
              x: tx,
              z: tz,
              h: 4.4 + rng() * 4.8,
              kind: rng() < 0.55 ? "pine" : "oak",
              rot: rng() * Math.PI,
            });
          }
        }
        x += step * (0.75 + rng() * 0.6);
      }
    }
    return list;
  }, [density]);

  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} rotation={[0, t.rot, 0]}>
          <mesh position={[0, t.h * 0.18, 0]} castShadow>
            <cylinderGeometry args={[t.kind === "pine" ? 0.16 : 0.2, 0.24, t.h * 0.36, 6]} />
            <meshStandardMaterial color="#4a3728" roughness={0.9} />
          </mesh>
          {t.kind === "pine" ? (
            <>
              <mesh position={[0, t.h * 0.48, 0]} castShadow>
                <coneGeometry args={[t.h * 0.22, t.h * 0.42, 7]} />
                <meshStandardMaterial color="#2f4a32" roughness={0.85} />
              </mesh>
              <mesh position={[0, t.h * 0.72, 0]} castShadow>
                <coneGeometry args={[t.h * 0.16, t.h * 0.36, 7]} />
                <meshStandardMaterial color="#3a5a3c" roughness={0.82} />
              </mesh>
            </>
          ) : (
            <>
              <mesh position={[0, t.h * 0.62, 0]} castShadow>
                <sphereGeometry args={[t.h * 0.28, 8, 6]} />
                <meshStandardMaterial color="#3d5c38" roughness={0.84} />
              </mesh>
              <mesh position={[t.h * 0.1, t.h * 0.72, t.h * 0.08]} castShadow>
                <sphereGeometry args={[t.h * 0.2, 8, 6]} />
                <meshStandardMaterial color="#4a6a40" roughness={0.84} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

function OpenHills() {
  return (
    <group>
      <mesh position={[18, 0, -28]} rotation={[0, 0.35, 0]} scale={[14, 6.5, 8]} receiveShadow>
        <sphereGeometry args={[1, 10, 7]} />
        <meshStandardMaterial color="#7a8558" roughness={1} />
      </mesh>
      <mesh position={[78, 0.2, 26]} rotation={[0, -0.4, 0]} scale={[16, 7.5, 8]} receiveShadow>
        <sphereGeometry args={[1, 10, 7]} />
        <meshStandardMaterial color="#8a9460" roughness={1} />
      </mesh>
      <mesh position={[108, 1.2, 4]} rotation={[0, 0.15, 0]} scale={[22, 9, 14]} receiveShadow>
        <sphereGeometry args={[1, 10, 7]} />
        <meshStandardMaterial color="#9aa86c" roughness={1} />
      </mesh>
    </group>
  );
}

export function Environment() {
  const world = useSim((s) => s.world);
  const theme = WORLD_THEME[world];

  return (
    <group>
      <color attach="background" args={[theme.bg]} />
      <fog attach="fog" args={[theme.bg, theme.fogNear, theme.fogFar]} />
      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, theme.hemi]} />
      <directionalLight position={[18, 30, 12]} intensity={theme.dir} castShadow />
      <ambientLight intensity={theme.amb} />
      <mesh>
        <sphereGeometry args={[160, 24, 16]} />
        <meshBasicMaterial color={theme.bg} side={THREE.BackSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ROAD_LENGTH / 2, -0.06, 0]} receiveShadow>
        <planeGeometry args={[ROAD_LENGTH + 90, 130]} />
        <meshStandardMaterial color={theme.ground} roughness={1} />
      </mesh>
      <IntersectionMesh />
      {world === "city" && <CityBlock />}
      {world === "forest" && <Trees density="sparse" />}
      {world === "open" && (
        <>
          <OpenHills />
          <Trees density="few" />
        </>
      )}
    </group>
  );
}
