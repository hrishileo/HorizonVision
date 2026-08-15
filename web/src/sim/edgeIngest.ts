import { SENSOR_MIN, SENSOR_RANGE, type DetectorMetrics, type PredictedDetection } from "./types";
import { renderCameraFrame } from "./renderCamera";
import { useSim } from "./store";

const DEFAULT_INGEST_URL = "http://127.0.0.1:8765/ingest";
const DEFAULT_HEALTH_URL = "http://127.0.0.1:8765/health";
const DEFAULT_PREDICTIONS_URL = "http://127.0.0.1:8765/predictions";
const HZ = 10;
const MAX_POINTS = 720;

export function ingestUrl(): string {
  const fromEnv = (import.meta.env.VITE_EDGE_INGEST_URL as string | undefined)?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_INGEST_URL;
}

function siblingUrl(suffix: string, fallback: string): string {
  const ingest = ingestUrl();
  if (ingest.endsWith("/ingest") || ingest.endsWith("/ingest/")) {
    return ingest.replace(/\/ingest\/?$/, suffix);
  }
  return fallback;
}

export function healthUrl(): string {
  return siblingUrl("/health", DEFAULT_HEALTH_URL);
}

export function predictionsUrl(): string {
  return siblingUrl("/predictions", DEFAULT_PREDICTIONS_URL);
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
  camera: { width: number; height: number; encoding: "rgb8"; pixels: string };
  lidar: { points: number[][]; numPoints: number };
  /** Sim labels for scoring only. The edge detector must not copy these. */
  labels: ReturnType<typeof useSim.getState>["detections"];
};

export function buildEdgeSample(): EdgeSample | null {
  const s = useSim.getState();
  if (s.objects.length === 0) return null;
  const points = sampleCloud(s.cloud, s.sensorX);
  return {
    t: Date.now() / 1000,
    sensorX: Number(s.sensorX.toFixed(3)),
    camera: renderCameraFrame(s.objects, s.sensorX),
    lidar: { points, numPoints: s.visibleCount || points.length },
    labels: s.detections,
  };
}

/** ~10 Hz POST of the moving sensor's camera frame + LiDAR subset + sim labels. */
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

function asPredictions(raw: unknown): PredictedDetection[] {
  if (!Array.isArray(raw)) return [];
  const out: PredictedDetection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const center = rec.center;
    const size = rec.size;
    if (!Array.isArray(center) || center.length < 3) continue;
    if (!Array.isArray(size) || size.length < 3) continue;
    out.push({
      label: String(rec.label ?? "object"),
      confidence: Number(rec.confidence ?? 0),
      center: [Number(center[0]), Number(center[1]), Number(center[2])],
      size: [Number(size[0]), Number(size[1]), Number(size[2])],
      yaw: Number(rec.yaw ?? 0),
      distance: rec.distance == null ? null : Number(rec.distance),
    });
  }
  return out;
}

function asMetrics(raw: unknown): DetectorMetrics | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.precision !== "number" || typeof rec.recall !== "number") return null;
  return {
    precision: rec.precision,
    recall: rec.recall,
    mean_iou: Number(rec.mean_iou ?? 0),
    tp: Number(rec.tp ?? 0),
    fp: Number(rec.fp ?? 0),
    fn: Number(rec.fn ?? 0),
  };
}

/** Poll the edge detector so the viewer can draw pred boxes next to GT. */
export function startPredictionPoll(url = predictionsUrl()): () => void {
  const id = window.setInterval(() => {
    void fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!body) return;
        useSim.getState().setPredictions(asPredictions(body.predictions), asMetrics(body.metrics));
      })
      .catch(() => {
        useSim.getState().setPredictions([], null);
      });
  }, 400);
  return () => window.clearInterval(id);
}
