import { decay, rotateToward, TAU } from '../core/math';
import { angleOf, limit, vec2, type Vec2 } from '../core/vec2';
import type { ControlState } from '../input/types';

export type ControlScheme =
  /**
   * Twin-stick. Stick direction is the thrust direction, in world space. The
   * hull turns to face where it is pushing, but turning never gates movement.
   * Most forgiving on a touchscreen; least "ship-like".
   */
  | 'direct'
  /**
   * Heading-seek. Stick direction sets a target heading; the hull rotates
   * toward it at a limited rate and thrust is applied along the nose only.
   * Reads as a spacecraft while still being one-thumb driveable.
   */
  | 'heading'
  /**
   * Tank. Stick X rotates, stick Y throttles along the nose. Faithful to
   * keyboard-era space games; needs the most practice with a thumb.
   */
  | 'tank';

export interface ShipTuning {
  scheme: ControlScheme;
  /** Thrust acceleration at full throttle, px/s^2. */
  thrust: number;
  /** Extra thrust multiplier while boosting. */
  boostMultiplier: number;
  /** Hard ceiling on speed, px/s. */
  maxSpeed: number;
  /**
   * Seconds for coasting speed to halve with no thrust.
   * Large values feel like vacuum; small values feel like an atmosphere.
   */
  dragHalfLife: number;
  /**
   * Seconds for speed to halve while the brake is held. Much shorter than
   * `dragHalfLife`: the brake exists so you can stop and shoot, and a brake
   * that merely coasts a bit harder does not achieve that.
   */
  brakeHalfLife: number;
  /** Maximum rotation rate, radians/s. */
  turnRate: number;
  /**
   * 'heading' only: how much thrust survives while still turning toward the
   * target. 1 = full thrust immediately, 0 = must be perfectly aligned.
   */
  offAxisThrust: number;
}

export const defaultShipTuning: ShipTuning = {
  scheme: 'heading',
  thrust: 900,
  boostMultiplier: 1.8,
  maxSpeed: 620,
  dragHalfLife: 1.4,
  brakeHalfLife: 0.16,
  turnRate: TAU * 1.15,
  offAxisThrust: 0.35,
};

export interface Ship {
  pos: Vec2;
  vel: Vec2;
  /** Hull heading, radians. */
  angle: number;
  /** Throttle actually applied last step, 0..1 — drives the exhaust plume. */
  throttle: number;
  /** Position at the previous simulation step, for render interpolation. */
  prevPos: Vec2;
  prevAngle: number;
}

export function createShip(x = 0, y = 0): Ship {
  return {
    pos: vec2(x, y),
    vel: vec2(),
    angle: -Math.PI / 2,
    throttle: 0,
    prevPos: vec2(x, y),
    prevAngle: -Math.PI / 2,
  };
}

/**
 * Advance one ship by exactly `dt` seconds.
 *
 * Drag is exponential rather than a linear subtraction: a linear damping term
 * is framerate-sensitive and can push velocity through zero into a jitter at
 * low speeds, while `v *= 0.5^(dt/halfLife)` is exact for any `dt`.
 */
export function updateShip(ship: Ship, control: ControlState, t: ShipTuning, dt: number): void {
  ship.prevPos.x = ship.pos.x;
  ship.prevPos.y = ship.pos.y;
  ship.prevAngle = ship.angle;

  const stickX = control.move.x;
  const stickY = control.move.y;
  const magnitude = Math.min(Math.hypot(stickX, stickY), 1);
  const power = t.thrust * (control.boost ? t.boostMultiplier : 1);

  // Braking cuts thrust but never rotation: the whole point is to hold station
  // and still be able to aim, so steering has to keep working at full rate.
  const braking = control.brake;

  let ax = 0;
  let ay = 0;
  let throttle = 0;

  if (t.scheme === 'direct') {
    if (magnitude > 0) {
      ship.angle = rotateToward(ship.angle, Math.atan2(stickY, stickX), t.turnRate * dt);
      if (!braking) {
        throttle = magnitude;
        ax = stickX * power;
        ay = stickY * power;
      }
    }
  } else if (t.scheme === 'heading') {
    if (magnitude > 0) {
      const target = Math.atan2(stickY, stickX);
      ship.angle = rotateToward(ship.angle, target, t.turnRate * dt);
      if (!braking) {
        // Alignment: 1 when the nose is on target, 0 when 90 degrees off or worse.
        const alignment = Math.max(
          0,
          Math.cos(target - ship.angle),
        );
        const gate = t.offAxisThrust + (1 - t.offAxisThrust) * alignment;
        throttle = magnitude * gate;
        ax = Math.cos(ship.angle) * power * throttle;
        ay = Math.sin(ship.angle) * power * throttle;
      }
    }
  } else {
    // tank
    ship.angle += stickX * t.turnRate * dt;
    if (!braking) {
      // Pushing the stick up (negative Y on screen) means forward.
      throttle = Math.max(0, -stickY);
      ax = Math.cos(ship.angle) * power * throttle;
      ay = Math.sin(ship.angle) * power * throttle;
    }
  }

  ship.throttle = throttle;
  ship.vel.x += ax * dt;
  ship.vel.y += ay * dt;

  const remaining = decay(braking ? t.brakeHalfLife : t.dragHalfLife, dt);
  ship.vel.x *= remaining;
  ship.vel.y *= remaining;

  limit(ship.vel, t.maxSpeed);

  ship.pos.x += ship.vel.x * dt;
  ship.pos.y += ship.vel.y * dt;
}

export function speedOf(ship: Ship): number {
  return Math.hypot(ship.vel.x, ship.vel.y);
}

export function headingOf(ship: Ship): number {
  return angleOf(ship.vel);
}
