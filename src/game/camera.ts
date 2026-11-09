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
  /** Scale on first reaching `zoomSpeedRef`. Below 1 pulls back. */
  zoomAtSpeed: number;
  /**
   * Scale once top speed has been *held*. Reached gradually, so a long burn
   * keeps widening the view rather than settling at `zoomAtSpeed`.
   */
  zoomAtSustained: number;
  /** Seconds at full speed to build the sustained pull-back from nothing. */
  sustainRise: number;
  /**
   * Seconds to bleed it back off. Shorter than the rise on purpose: earning
   * the wide view should take a burn, losing it should feel immediate.
   */
  sustainFall: number;
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
  zoomAtSustained: 0.42,
  sustainRise: 5,
  sustainFall: 1.8,
  zoomSpeedRef: 620,
  zoomHalfLife: 0.45,
};

export interface Camera {
  pos: Vec2;
  /** Current scale, eased toward the target. */
  zoom: number;
  /**
   * How much sustained speed has been banked, 0..1. Rises while flying fast,
   * bleeds off when slowing; drives the extra pull-back on a long burn.
   */
  sustain: number;
}

export function createCamera(x = 0, y = 0, zoom = 1): Camera {
  return { pos: vec2(x, y), zoom, sustain: 0 };
}

/** Normalised speed, 0 at rest and 1 at the reference speed. */
export function speedFraction(speed: number, t: CameraTuning): number {
  const ref = t.zoomSpeedRef > 0 ? t.zoomSpeedRef : 1;
  return clamp(speed / ref, 0, 1);
}

/**
 * Advance the sustained-speed accumulator.
 *
 * It chases the current speed fraction on a linear ramp rather than easing
 * exponentially, so "five seconds at full throttle" is exactly what it says
 * instead of an asymptote that never quite arrives.
 */
export function updateSustain(sustain: number, speed: number, t: CameraTuning, dt: number): number {
  const target = speedFraction(speed, t);
  if (target > sustain) {
    const rate = t.sustainRise > 0 ? dt / t.sustainRise : 1;
    return Math.min(target, sustain + rate);
  }
  const rate = t.sustainFall > 0 ? dt / t.sustainFall : 1;
  return Math.max(target, sustain - rate);
}

/**
 * Scale a given speed and banked sustain should be shown at.
 *
 * Two stages: speed alone takes it from `zoomAtRest` to `zoomAtSpeed`, then
 * sustain carries it the rest of the way to `zoomAtSustained`. Holding top
 * speed therefore keeps widening the view instead of settling.
 */
export function targetZoomFor(speed: number, sustain: number, t: CameraTuning): number {
  const bySpeed = lerp(t.zoomAtRest, t.zoomAtSpeed, speedFraction(speed, t));
  return lerp(bySpeed, t.zoomAtSustained, clamp(sustain, 0, 1));
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
  camera.sustain = updateSustain(camera.sustain, speed, t, dt);
  const target = targetZoomFor(speed, camera.sustain, t);
  const zoomRemaining = decay(t.zoomHalfLife, dt);
  camera.zoom = target + (camera.zoom - target) * zoomRemaining;
}
