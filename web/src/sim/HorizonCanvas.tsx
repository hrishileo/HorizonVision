import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useSim } from "./store";
import {
  cellCenterWorld,
  inSensorSweep,
  type BevConfig,
  type CellHit,
} from "./occupancyGrid";
import {
  ROAD_LENGTH,
  ROAD_WIDTH,
  SENSOR_HEIGHT,
  type SceneObject,
} from "./types";

function Road() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ROAD_LENGTH / 2, -0.02, 0]} receiveShadow>
        <planeGeometry args={[ROAD_LENGTH + 8, ROAD_WIDTH]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.92} metalness={0.05} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ROAD_LENGTH / 2, -0.04, 0]} receiveShadow>
        <planeGeometry args={[ROAD_LENGTH + 20, 36]} />
        <meshStandardMaterial color="#1a1a16" roughness={1} />
      </mesh>
      {[-3.3, 3.3].map((z) =>
        Array.from({ length: 20 }).map((_, i) => (
          <mesh
            key={`${z}-${i}`}
            position={[4 + i * 3.8, 0.012, z > 0 ? 0.08 : -0.08]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[1.6, 0.1]} />
            <meshStandardMaterial color="#c8c4b0" roughness={0.6} />
          </mesh>
        )),
      )}
    </group>
  );
}

function VehicleMesh({ obj }: { obj: SceneObject }) {
  const [l, w, h] = obj.size;
  const y = h / 2;
  if (obj.label === "pedestrian") {
    return (
      <group position={[obj.center[0], 0, obj.center[2]]} rotation={[0, obj.yaw, 0]}>
        <mesh position={[0, h * 0.55, 0]} castShadow>
          <capsuleGeometry args={[w * 0.42, h * 0.45, 6, 10]} />
          <meshStandardMaterial color={obj.color} roughness={0.55} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[obj.center[0], 0, obj.center[2]]} rotation={[0, obj.yaw, 0]}>
      <mesh position={[0, y, 0]} castShadow>
        <boxGeometry args={[l, h, w]} />
        <meshStandardMaterial color={obj.color} roughness={0.45} metalness={0.25} />
      </mesh>
      {obj.label !== "motorcycle" && (
        <>
          <mesh position={[l * 0.28, 0.22, w * 0.52]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.28, 0.28, 0.18, 10]} />
            <meshStandardMaterial color="#1c1c1e" />
          </mesh>
          <mesh position={[-l * 0.28, 0.22, w * 0.52]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.28, 0.28, 0.18, 10]} />
            <meshStandardMaterial color="#1c1c1e" />
          </mesh>
        </>
      )}
    </group>
  );
}

function Bounds({
  obj,
  active,
  hovered,
}: {
  obj: SceneObject;
  active: boolean;
  hovered: boolean;
}) {
  const [l, w, h] = obj.size;
  const setHoveredId = useSim((s) => s.setHoveredId);

  return (
    <group position={[obj.center[0], h / 2, obj.center[2]]} rotation={[0, obj.yaw, 0]}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredId(obj.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHoveredId(null);
          document.body.style.cursor = "default";
        }}
      >
        <boxGeometry args={[l + 0.12, h + 0.12, w + 0.12]} />
        <meshBasicMaterial
          color={
            hovered
              ? "#e8eef2"
              : obj.irregular
                ? "#e8b86d"
                : active
                  ? "#8eb4c4"
                  : "#4a4a52"
          }
          wireframe
          transparent
          opacity={hovered ? 1 : obj.irregular || active ? 0.95 : 0.35}
        />
      </mesh>
      {hovered && (
        <Html
          position={[0, h / 2 + 0.55, 0]}
          center
          distanceFactor={10}
          style={{ pointerEvents: "none" }}
        >
          <div className="rounded-md border border-border bg-surface/95 px-2.5 py-1 font-sans text-xs font-medium tracking-wide whitespace-nowrap text-fg shadow-sm">
            <span className="capitalize">{obj.label}</span>
            {obj.irregular === "lane-departure" && (
              <span className="ml-1 text-warn">lane departure</span>
            )}
            {obj.irregular === "pedestrian-in-road" && (
              <span className="ml-1 text-warn">in roadway</span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

function Sensor() {
  const group = useRef<THREE.Group>(null);
  const x = useSim((s) => s.sensorX);

  useFrame(() => {
    if (group.current) group.current.position.x = x;
  });

  return (
    <group ref={group} position={[0, SENSOR_HEIGHT, 0]}>
      <mesh>
        <sphereGeometry args={[0.28, 18, 18]} />
        <meshStandardMaterial color="#f07167" emissive="#f07167" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0.32, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.16, 0.36, 10]} />
        <meshStandardMaterial color="#d8dde4" metalness={0.4} roughness={0.3} />
      </mesh>
      <pointLight color="#f07167" intensity={6} distance={10} />
    </group>
  );
}

function LidarPoints() {
  const pointsRef = useRef<THREE.Points>(null);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(72000), 3));
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: 0xb8c8d4,
        size: 0.08,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.72,
      }),
    [],
  );
  const buf = useRef<Float32Array | null>(null);

  useEffect(() => {
    return () => {
      geom.dispose();
      material.dispose();
    };
  }, [geom, material]);

  useFrame(() => {
    const { cloud, sensorX, setVisibleCount } = useSim.getState();
    const attr = geom.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!attr) return;
    if (!buf.current || buf.current.length !== attr.array.length) {
      buf.current = attr.array as Float32Array;
    }
    const dest = buf.current;
    let w = 0;
    for (let i = 0; i < cloud.length; i += 3) {
      const x = cloud[i]!;
      const y = cloud[i + 1]!;
      const z = cloud[i + 2]!;
      if (inSensorSweep(x, z, sensorX)) {
        dest[w++] = x;
        dest[w++] = y;
        dest[w++] = z;
      }
    }
    geom.setDrawRange(0, w / 3);
    attr.needsUpdate = true;
    setVisibleCount(w / 3);
  });

  return <points ref={pointsRef} geometry={geom} material={material} />;
}

const BEV_INSTANCE_CAP = 24000;

function paintBevInstances(
  mesh: THREE.InstancedMesh | null,
  cells: CellHit[],
  config: BevConfig,
  sensorX: number,
  dummy: THREE.Object3D,
  y: number,
) {
  if (!mesh) return;
  const s = config.cellSize * 0.88;
  const n = Math.min(cells.length, BEV_INSTANCE_CAP);
  for (let i = 0; i < n; i++) {
    const hit = cells[i]!;
    const { x, z } = cellCenterWorld(hit.ix, hit.iy, sensorX, config);
    dummy.position.set(x, y, z);
    dummy.scale.set(s, 1, s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
}

function BevOverlay() {
  const occRef = useRef<THREE.InstancedMesh>(null);
  const freeRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (occRef.current) occRef.current.count = 0;
    if (freeRef.current) freeRef.current.count = 0;
  }, []);

  useFrame(() => {
    const { bev, sensorX } = useSim.getState();
    paintBevInstances(freeRef.current, bev.free, bev.config, sensorX, dummy, 0.018);
    paintBevInstances(occRef.current, bev.occupied, bev.config, sensorX, dummy, 0.034);
  });

  return (
    <group>
      <instancedMesh ref={freeRef} args={[undefined, undefined, BEV_INSTANCE_CAP]} frustumCulled={false}>
        <boxGeometry args={[1, 0.012, 1]} />
        <meshBasicMaterial color="#3d8f72" transparent opacity={0.32} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={occRef} args={[undefined, undefined, BEV_INSTANCE_CAP]} frustumCulled={false}>
        <boxGeometry args={[1, 0.02, 1]} />
        <meshBasicMaterial color="#e8b86d" transparent opacity={0.78} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

function SimLoop() {
  useFrame((_, delta) => {
    useSim.getState().tick(Math.min(delta, 0.05));
  });
  return null;
}

function CamRig() {
  const mode = useSim((s) => s.cameraMode);
  const desired = useRef(new THREE.Vector3(0, 2, 0));
  const look = useRef(new THREE.Vector3(16, 0.4, 0));

  useFrame(({ camera }) => {
    const x = useSim.getState().sensorX;
    const persp = camera as THREE.PerspectiveCamera;
    if (mode === "drone") {
      desired.current.set(x + 0.15, SENSOR_HEIGHT + 0.12, 0);
      look.current.set(x + 22, 0.35, 0);
      persp.fov = 68;
      camera.position.lerp(desired.current, 0.18);
    } else {
      desired.current.set(x - 7.5, 3.8, 0.15);
      look.current.set(x + 9, 0.9, 0);
      persp.fov = 52;
      camera.position.lerp(desired.current, 0.1);
    }
    persp.updateProjectionMatrix();
    camera.lookAt(look.current);
  });
  return null;
}

function World() {
  const objects = useSim((s) => s.objects);
  const detections = useSim((s) => s.detections);
  const hoveredId = useSim((s) => s.hoveredId);
  const live = useMemo(() => new Set(detections.map((d) => d.id)), [detections]);

  return (
    <>
      <color attach="background" args={["#0c0c10"]} />
      <fog attach="fog" args={["#0c0c10", 22, 70]} />
      <hemisphereLight args={["#9aa8b8", "#1a1814", 0.55]} />
      <directionalLight position={[20, 28, 10]} intensity={1.15} castShadow />
      <ambientLight intensity={0.22} />
      <Road />
      <BevOverlay />
      {objects.map((obj) => (
        <group key={obj.id}>
          <VehicleMesh obj={obj} />
          <Bounds obj={obj} active={live.has(obj.id)} hovered={hoveredId === obj.id} />
        </group>
      ))}
      <Sensor />
      <LidarPoints />
      <SimLoop />
      <CamRig />
    </>
  );
}

export function HorizonCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      camera={{ position: [0.2, 1.7, 0], fov: 62, near: 0.15, far: 160 }}
      gl={{ antialias: true, alpha: false }}
      onPointerMissed={() => useSim.getState().setHoveredId(null)}
    >
      <World />
    </Canvas>
  );
}
