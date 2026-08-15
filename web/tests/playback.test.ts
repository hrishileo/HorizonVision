import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SENSOR_END_X,
  nextSensorX,
  playingAfterTick,
  reachedEnd,
} from "../src/sim/playback.ts";

test("tick never force-plays a user pause", () => {
  assert.equal(playingAfterTick(false, 10), false);
  assert.equal(playingAfterTick(false, SENSOR_END_X), false);
});

test("tick auto-stops only at the end of the road", () => {
  assert.equal(playingAfterTick(true, 10), true);
  assert.equal(playingAfterTick(true, SENSOR_END_X - 0.01), true);
  assert.equal(playingAfterTick(true, SENSOR_END_X), false);
  assert.equal(reachedEnd(67.89), false);
  assert.equal(reachedEnd(67.9), true);
});

test("sensor advance clamps at the road end", () => {
  assert.equal(nextSensorX(67.5, 6, 1), 68);
  assert.ok(nextSensorX(10, 6, 0.1) > 10);
});
