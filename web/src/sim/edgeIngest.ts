import { SENSOR_MIN, SENSOR_RANGE } from "./types";
import { useSim } from "./store";

const DEFAULT_INGEST_URL = "http://127.0.0.1:8765/ingest";
const DEFAULT_HEALTH_URL = "http://127.0.0.1:8765/health";
const HZ = 10;
const MAX_POINTS = 256;

export function ingestUrl(): string {
  const fromEnv = (import.meta.env.VITE_EDGE_INGEST_URL as string | undefined)?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_INGEST_URL;
}

export function healthUrl(): string {
  const ingest = ingestUrl();
  if (ingest.endsWith("/ingest") || ingest.endsWith("/ingest/")) {
    return ingest.replace(/\/ingest\/?$/, "/health");
  }
  return DEFAULT_HEALTH_URL;
}

/** Range-gate the prebuilt cloud the same way `LidarPoints` does, then downsample. */
export function sampleCloud(
  cloud: Float32Array,
  sensorX: number,
  maxPoints = MAX_POINTS,
): number[][] {
  const kept: number[][] = [];
  for (let i = 0; i < cloud.length; i += 3) {
    const x = cloud[i]!;
    const y = cloud[i + 1]!;
    const z = cloud[i + 2]!;
    const dx = x - sensorX;
    const dist = Math.hypot(dx, z);
    if (dx > SENSOR_MIN && dx < SENSOR_RANGE && dist < SENSOR_RANGE && Math.abs(z) < 9) {
      kept.push([round3(x), round3(y), round3(z)]);
    }
  }
  if (kept.length <= maxPoints) return kept;
  const step = kept.length / maxPoints;
  const out: number[][] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(kept[Math.floor(i * step)]!);
  }
  return out;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export type EdgeSample = {
  t: number;
  sensorX: number;
  camera: { width: number; height: number; encoding: "stub" };
  lidar: { points: number[][]; numPoints: number };
  detections: ReturnType<typeof useSim.getState>["detections"];
};

export function buildEdgeSample(): EdgeSample | null {
  const s = useSim.getState();
  if (s.objects.length === 0) return null;
  const points = sampleCloud(s.cloud, s.sensorX);
  return {
    t: Date.now() / 1000,
    sensorX: Number(s.sensorX.toFixed(3)),
    camera: { width: 64, height: 36, encoding: "stub" },
    lidar: { points, numPoints: s.visibleCount || points.length },
    detections: s.detections,
  };
}

/** ~10 Hz POST of the moving sensor's camera stub + LiDAR subset + detections. */
export function startEdgeIngest(url = ingestUrl()): () => void {
  const id = window.setInterval(() => {
    const sample = buildEdgeSample();
    if (sample === null) return;
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sample),
    }).catch(() => {
      // Edge process is optional while iterating on the viewer alone.
    });
  }, 1000 / HZ);
  return () => window.clearInterval(id);
}
