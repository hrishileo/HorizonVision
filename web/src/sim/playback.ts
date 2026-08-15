/** Sensor stops here. Matches the previous tick() end-of-road check. */
export const SENSOR_END_X = 67.9;
export const SENSOR_MAX_X = 68;

export function nextSensorX(sensorX: number, speed: number, dt: number): number {
  return Math.min(SENSOR_MAX_X, sensorX + speed * dt);
}

export function reachedEnd(sensorX: number): boolean {
  return sensorX >= SENSOR_END_X;
}

/**
 * Tick may auto-stop at the end of the road. It must never force-play:
 * a user pause has to survive an in-flight tick.
 */
export function playingAfterTick(wasPlaying: boolean, sensorX: number): boolean {
  if (!wasPlaying) return false;
  return !reachedEnd(sensorX);
}
