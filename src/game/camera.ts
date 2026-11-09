import { decay } from '../core/math';
import { vec2, type Vec2 } from '../core/vec2';
import type { Ship } from './ship';

export interface Camera {
  pos: Vec2;
  /**
   * How far ahead of the ship the camera leads, as seconds of travel at the
   * current velocity. Leading the ship shows the player where they are going
   * instead of where they have been.
   */
  lookAhead: number;
  /** Seconds for the camera's remaining offset to halve. Lower = stiffer. */
  halfLife: number;
}

export function createCamera(x = 0, y = 0): Camera {
  return { pos: vec2(x, y), lookAhead: 0.35, halfLife: 0.18 };
}

/** Critically-damped follow; framerate independent for the same reason drag is. */
export function updateCamera(camera: Camera, ship: Ship, dt: number): void {
  const targetX = ship.pos.x + ship.vel.x * camera.lookAhead;
  const targetY = ship.pos.y + ship.vel.y * camera.lookAhead;
  const remaining = decay(camera.halfLife, dt);
  camera.pos.x = targetX + (camera.pos.x - targetX) * remaining;
  camera.pos.y = targetY + (camera.pos.y - targetY) * remaining;
}
