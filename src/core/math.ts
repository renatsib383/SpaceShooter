export const TAU = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smallest signed difference between two angles, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** Rotate `from` toward `to` by at most `maxStep` radians. */
export function rotateToward(from: number, to: number, maxStep: number): number {
  const d = angleDelta(from, to);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

/**
 * Frame-rate independent exponential decay.
 * Returns the fraction of a value that REMAINS after `dt` seconds,
 * given that `halfLife` seconds halve it.
 */
export function decay(halfLife: number, dt: number): number {
  if (halfLife <= 0) return 0;
  return Math.pow(0.5, dt / halfLife);
}

/** Wrap `v` into [0, size). */
export function wrap(v: number, size: number): number {
  const r = v % size;
  if (r < 0) return r + size;
  // `r` can be -0 here (e.g. wrap(-TAU, TAU)), which is mathematically 0 but
  // compares and divides differently; `|| 0` normalizes it.
  return r || 0;
}
