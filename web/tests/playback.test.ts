import { describe, expect, it } from "vitest";
import {
  SENSOR_END_X,
  nextSensorX,
  playingAfterTick,
  reachedEnd,
} from "../src/sim/playback";

describe("playback helpers", () => {
  it("never force-plays a user pause", () => {
    expect(playingAfterTick(false, 10)).toBe(false);
    expect(playingAfterTick(false, SENSOR_END_X)).toBe(false);
  });

  it("auto-stops only at the end of the road", () => {
    expect(playingAfterTick(true, 10)).toBe(true);
    expect(playingAfterTick(true, SENSOR_END_X - 0.01)).toBe(true);
    expect(playingAfterTick(true, SENSOR_END_X)).toBe(false);
    expect(reachedEnd(67.89)).toBe(false);
    expect(reachedEnd(67.9)).toBe(true);
  });

  it("clamps sensor advance at the road end", () => {
    expect(nextSensorX(67.5, 6, 1)).toBe(68);
    expect(nextSensorX(10, 6, 0.1)).toBeGreaterThan(10);
  });
});
