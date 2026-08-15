import { describe, expect, it } from "vitest";
import { buildEdgeSample, sampleCloud } from "../src/sim/edgeIngest";
import { generateScene, buildPointCloud, detectLive } from "../src/sim/generateScene";
import { renderCameraRgb } from "../src/sim/renderCamera";
import { useSim } from "../src/sim/store";
import { SENSOR_MIN, SENSOR_RANGE } from "../src/sim/types";

describe("sim labels vs camera/lidar sample", () => {
  it("detectLive is a range filter on known centers, not a sensor detector", () => {
    const objects = generateScene(42817, 4, false);
    const labels = detectLive(objects, 10, SENSOR_MIN, SENSOR_RANGE);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      const obj = objects.find((o) => o.id === label.id);
      expect(obj).toBeTruthy();
      expect(label.center).toEqual(obj!.center);
    }
  });

  it("edge sample sends labels separately from lidar points", () => {
    useSim.getState().reset(42817);
    useSim.setState({ sensorX: 12 });
    const sample = buildEdgeSample();
    expect(sample).not.toBeNull();
    expect(sample!.labels.length).toBeGreaterThan(0);
    expect(sample!.lidar.points.length).toBeGreaterThan(20);
    expect(sample!.camera.encoding).toBe("rgb8");
    expect(sample!.camera.pixels.length).toBeGreaterThan(100);
    expect(sample).not.toHaveProperty("detections");
  });

  it("camera frame is a real raster, not a two-tone stub", () => {
    const objects = generateScene(42817, 5, false);
    const empty = renderCameraRgb([], 8, 80, 45);
    const filled = renderCameraRgb(objects, 8, 80, 45);
    const unique = (buf: Uint8Array) => {
      const set = new Set<string>();
      for (let i = 0; i < buf.length; i += 3) {
        set.add(`${buf[i]},${buf[i + 1]},${buf[i + 2]}`);
      }
      return set.size;
    };
    expect(unique(empty)).toBeLessThanOrEqual(3);
    expect(unique(filled)).toBeGreaterThan(unique(empty));
  });

  it("sampled cloud keeps only range-gated returns", () => {
    const objects = generateScene(1, 3, false);
    const cloud = buildPointCloud(objects, 1);
    const sensorX = 10;
    const pts = sampleCloud(cloud, sensorX, 200);
    expect(pts.length).toBeGreaterThan(0);
    for (const [x, , z] of pts) {
      const dx = x - sensorX;
      expect(dx).toBeGreaterThan(SENSOR_MIN);
      expect(Math.hypot(dx, z)).toBeLessThan(SENSOR_RANGE);
    }
  });
});
