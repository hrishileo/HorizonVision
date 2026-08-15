import { SENSOR_HEIGHT, type SceneObject } from "./types";

export const CAMERA_WIDTH = 160;
export const CAMERA_HEIGHT = 90;

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const n = parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function project(
  wx: number,
  wy: number,
  wz: number,
  sensorX: number,
  width: number,
  height: number,
): [number, number, number] | null {
  const forward = wx - sensorX;
  if (forward < 0.6) return null;
  const right = wz;
  const up = wy - SENSOR_HEIGHT;
  const fx = width * 0.92;
  const fy = height * 0.92;
  const u = fx * (right / forward) + width * 0.5;
  const v = height * 0.55 - fy * (up / forward);
  return [u, v, forward];
}

function fillRect(
  pixels: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: [number, number, number],
) {
  const xa = Math.max(0, Math.min(width - 1, Math.floor(Math.min(x0, x1))));
  const xb = Math.max(0, Math.min(width - 1, Math.ceil(Math.max(x0, x1))));
  const ya = Math.max(0, Math.min(height - 1, Math.floor(Math.min(y0, y1))));
  const yb = Math.max(0, Math.min(height - 1, Math.ceil(Math.max(y0, y1))));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const i = (y * width + x) * 3;
      pixels[i] = rgb[0];
      pixels[i + 1] = rgb[1];
      pixels[i + 2] = rgb[2];
    }
  }
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes: Uint8Array): string {
  let out = "";
  const n = bytes.length;
  for (let i = 0; i < n; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < n ? bytes[i + 1]! : 0;
    const c = i + 2 < n ? bytes[i + 2]! : 0;
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < n ? B64[((b & 15) << 2) | (c >> 6)] : "=";
    out += i + 2 < n ? B64[c & 63] : "=";
  }
  return out;
}

/** Pinhole raster of the static scene from the moving sensor. Sensor data, not labels. */
export function renderCameraRgb(
  objects: SceneObject[],
  sensorX: number,
  width = CAMERA_WIDTH,
  height = CAMERA_HEIGHT,
): Uint8Array {
  const pixels = new Uint8Array(width * height * 3);
  const sky: [number, number, number] = [100, 140, 180];
  const road: [number, number, number] = [60, 60, 64];
  const horizon = Math.floor(height * 0.52);
  for (let y = 0; y < height; y++) {
    const rgb = y < horizon ? sky : road;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      pixels[i] = rgb[0];
      pixels[i + 1] = rgb[1];
      pixels[i + 2] = rgb[2];
    }
  }

  const visible = objects
    .map((obj) => ({ obj, depth: obj.center[0] - sensorX }))
    .filter((item) => item.depth > 0.8 && item.depth < 48)
    .sort((a, b) => b.depth - a.depth);

  for (const { obj } of visible) {
    const [l, w, h] = obj.size;
    const corners: Array<[number, number, number]> = [];
    for (const sx of [-0.5, 0.5]) {
      for (const sy of [0, 1]) {
        for (const sz of [-0.5, 0.5]) {
          const c = Math.cos(obj.yaw);
          const s = Math.sin(obj.yaw);
          const lx = sx * l;
          const lz = sz * w;
          corners.push([
            obj.center[0] + c * lx - s * lz,
            obj.center[1] + sy * h,
            obj.center[2] + s * lx + c * lz,
          ]);
        }
      }
    }
    const projected = corners
      .map(([x, y, z]) => project(x, y, z, sensorX, width, height))
      .filter((p): p is [number, number, number] => p !== null);
    if (projected.length < 3) continue;
    let minU = Infinity;
    let minV = Infinity;
    let maxU = -Infinity;
    let maxV = -Infinity;
    for (const [u, v] of projected) {
      minU = Math.min(minU, u);
      minV = Math.min(minV, v);
      maxU = Math.max(maxU, u);
      maxV = Math.max(maxV, v);
    }
    fillRect(pixels, width, height, minU, minV, maxU, maxV, hexToRgb(obj.color));
  }
  return pixels;
}

export function renderCameraFrame(
  objects: SceneObject[],
  sensorX: number,
  width = CAMERA_WIDTH,
  height = CAMERA_HEIGHT,
) {
  const pixels = renderCameraRgb(objects, sensorX, width, height);
  return {
    width,
    height,
    encoding: "rgb8" as const,
    pixels: encodeBase64(pixels),
  };
}
