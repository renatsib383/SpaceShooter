import { clamp } from '../core/math';
import type { Vec2 } from '../core/vec2';

export interface StickGeometry {
  /** Travel in CSS pixels that corresponds to full throttle. */
  radius: number;
  /** Fraction of `radius` ignored as slop, 0..1. */
  deadZone: number;
  /**
   * When the drag exceeds `radius`, slide the origin along so it stays within
   * `radius` of the finger. Keeps long drags from pinning at the rim.
   */
  recenter: boolean;
}

export interface StickReading {
  /** Direction with magnitude 0..1 after dead-zone rescaling. */
  value: Vec2;
  /** Origin after any recentering, in the same space as the input points. */
  origin: Vec2;
  /** Knob position clamped to the rim, for drawing. */
  knob: Vec2;
}

/**
 * Core stick math, deliberately free of DOM and state so it can be unit tested.
 *
 * Dead-zone handling rescales the remaining travel back to 0..1 instead of
 * clipping it, so the first pixel past the dead zone produces a near-zero
 * throttle rather than a jump to `deadZone`.
 */
export function readStick(
  origin: Vec2,
  pointer: Vec2,
  geometry: StickGeometry,
): StickReading {
  const { radius, deadZone, recenter } = geometry;

  let ox = origin.x;
  let oy = origin.y;
  let dx = pointer.x - ox;
  let dy = pointer.y - oy;
  let dist = Math.hypot(dx, dy);

  if (recenter && dist > radius && dist > 0) {
    // Pull the origin toward the pointer until it is exactly `radius` away.
    const pull = dist - radius;
    ox += (dx / dist) * pull;
    oy += (dy / dist) * pull;
    dx = pointer.x - ox;
    dy = pointer.y - oy;
    dist = Math.hypot(dx, dy);
  }

  const clampedDist = Math.min(dist, radius);
  const nx = dist > 0 ? dx / dist : 0;
  const ny = dist > 0 ? dy / dist : 0;

  const dzPixels = radius * clamp(deadZone, 0, 0.95);
  const usable = radius - dzPixels;
  const magnitude = usable > 0 ? clamp((clampedDist - dzPixels) / usable, 0, 1) : 0;

  return {
    value: { x: nx * magnitude, y: ny * magnitude },
    origin: { x: ox, y: oy },
    knob: { x: ox + nx * clampedDist, y: oy + ny * clampedDist },
  };
}
