import { beforeEach, describe, expect, it } from "vitest";
import { SENSOR_END_X } from "../src/sim/playback";
import { useSim } from "../src/sim/store";

beforeEach(() => {
  useSim.getState().reset(42817);
});

describe("sim store playback", () => {
  it("stays paused across many ticks", () => {
    useSim.getState().tick(0.2);
    const { sensorX, time, playing } = useSim.getState();
    expect(playing).toBe(true);
    expect(sensorX).toBeGreaterThan(0);
    expect(time).toBeGreaterThan(0);

    useSim.getState().setPlaying(false);
    expect(useSim.getState().playing).toBe(false);
    expect(useSim.getState().paused).toBe(true);

    for (let i = 0; i < 20; i++) {
      useSim.getState().tick(0.1);
    }

    const after = useSim.getState();
    expect(after.playing).toBe(false);
    expect(after.paused).toBe(true);
    expect(after.sensorX).toBe(sensorX);
    expect(after.time).toBe(time);
  });

  it("tick never writes playing true after a user pause", () => {
    useSim.getState().tick(0.1);
    useSim.getState().pause();
    useSim.getState().tick(0.1);
    useSim.getState().tick(0.1);
    expect(useSim.getState().playing).toBe(false);
    expect(useSim.getState().paused).toBe(true);
  });

  it("play after the end rewinds the same scene", () => {
    const seed = useSim.getState().seed;
    useSim.setState({ sensorX: SENSOR_END_X, playing: false, paused: true, time: 9 });
    useSim.getState().setPlaying(true);
    const after = useSim.getState();
    expect(after.seed).toBe(seed);
    expect(after.sensorX).toBe(0);
    expect(after.time).toBe(0);
    expect(after.playing).toBe(true);
    expect(after.paused).toBe(false);
  });
});
