import { clamp, decay, lerp } from '../core/math';
import { vec2, type Vec2 } from '../core/vec2';
import type { Ship } from './ship';

export interface CameraTuning {
  /**
   * How far ahead of the ship the camera leads, in seconds of travel at the
   * current velocity. Leading shows where you are going, not where you were.
   */
  lookAhead: number;
  /** Seconds for the camera's remaining positional offset to halve. */
  halfLife: number;
  /** Scale when stationary. 1 means one world pixel per screen pixel. */
  zoomAtRest: number;
  /** Scale at `zoomSpeedRef`. Below 1 pulls back and shows more world. */
  zoomAtSpeed: number;
  /** Speed, px/s, at which `zoomAtSpeed` is reached. */
  zoomSpeedRef: number;
  /**
   * Seconds for the remaining zoom gap to halve. Slower than the positional
   * follow on purpose: a zoom that snaps makes the whole screen breathe on
   * every throttle tap.
   */
  zoomHalfLife: number;
}

export const defaultCameraTuning: CameraTuning = {
  lookAhead: 0.35,
  halfLife: 0.18,
  zoomAtRest: 1,
  zoomAtSpeed: 0.62,
  zoomSpeedRef: 620,
  zoomHalfLife: 0.45,
};

export interface Camera {
  pos: Vec2;
  /** Current scale, eased toward the speed-derived target. */
  zoom: number;
}

export function createCamera(x = 0, y = 0, zoom = 1): Camera {
  return { pos: vec2(x, y), zoom };
}

/** Scale this speed should eventually be shown at. */
export function targetZoomFor(speed: number, t: CameraTuning): number {
  const ref = t.zoomSpeedRef > 0 ? t.zoomSpeedRef : 1;
  return lerp(t.zoomAtRest, t.zoomAtSpeed, clamp(speed / ref, 0, 1));
}

/**
 * Critically-damped follow for both position and zoom.
 *
 * Exponential easing rather than a fixed step per frame, for the same reason
 * drag is: it is exact at any timestep, so the camera behaves identically at
 * 30 and 144 Hz.
 */
export function updateCamera(
  camera: Camera,
  ship: Ship,
  t: CameraTuning,
  dt: number,
): void {
  const targetX = ship.pos.x + ship.vel.x * t.lookAhead;
  const targetY = ship.pos.y + ship.vel.y * t.lookAhead;
  const remaining = decay(t.halfLife, dt);
  camera.pos.x = targetX + (camera.pos.x - targetX) * remaining;
  camera.pos.y = targetY + (camera.pos.y - targetY) * remaining;

  const speed = Math.hypot(ship.vel.x, ship.vel.y);
  const target = targetZoomFor(speed, t);
  const zoomRemaining = decay(t.zoomHalfLife, dt);
  camera.zoom = target + (camera.zoom - target) * zoomRemaining;
}
