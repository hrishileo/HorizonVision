import { beforeEach, describe, expect, it } from "vitest";
import { useSim } from "../src/sim/store";

beforeEach(() => {
  useSim.getState().reset(42817);
});

describe("sim store + BEV", () => {
  it("stays paused across ticks", () => {
    useSim.getState().tick(0.2);
    const { sensorX, time, playing } = useSim.getState();
    expect(playing).toBe(true);
    expect(sensorX).toBeGreaterThan(0);

    useSim.getState().setPlaying(false);
    for (let i = 0; i < 20; i++) useSim.getState().tick(0.1);

    const after = useSim.getState();
    expect(after.playing).toBe(false);
    expect(after.sensorX).toBe(sensorX);
    expect(after.time).toBe(time);
  });

  it("rasterizes a BEV grid from the live LiDAR sweep", () => {
    useSim.getState().tick(0.5);
    const { bev, detections } = useSim.getState();
    expect(bev.occupied.length + bev.free.length).toBeGreaterThan(0);
    expect(bev.occupied.length).toBeGreaterThan(0);
    expect(bev.blobs.length).toBeGreaterThan(0);
    expect(detections.length).toBeGreaterThan(0);
    for (const d of detections) {
      expect(bev.occupied.some((c) => c.objectIds.includes(d.id))).toBe(true);
    }
  });

  it("keeps occupied cells after the sensor drives past them", () => {
    useSim.getState().tick(0.3);
    const first = useSim.getState().bev;
    expect(first.occupied.length).toBeGreaterThan(0);
    const hit = first.occupied[0]!;

    for (let i = 0; i < 80; i++) useSim.getState().tick(0.2);

    const after = useSim.getState();
    expect(after.sensorX).toBeGreaterThan(20);
    expect(after.bev.occupied.some((c) => c.ix === hit.ix && c.iy === hit.iy)).toBe(true);
    expect(after.bev.occupied.length).toBeGreaterThanOrEqual(first.occupied.length);
  });

  it("changing cell size rebuilds the grid without resuming play", () => {
    useSim.getState().setPlaying(false);
    const { sensorX, time } = useSim.getState();
    useSim.getState().setBevCellSize(1);
    const after = useSim.getState();
    expect(after.playing).toBe(false);
    expect(after.sensorX).toBe(sensorX);
    expect(after.time).toBe(time);
    expect(after.bev.config.cellSize).toBe(1);
    expect(after.bev.occupied.length).toBeGreaterThan(0);
  });
});
