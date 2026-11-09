import { describe, expect, it } from 'vitest';
import { createShip, defaultShipTuning, speedOf, updateShip } from '../src/game/ship';
import { createControlState } from '../src/input/types';
import type { ShipTuning } from '../src/game/ship';

function control(x: number, y: number, boost = false) {
  const c = createControlState();
  c.move.x = x;
  c.move.y = y;
  c.moving = x !== 0 || y !== 0;
  c.boost = boost;
  return c;
}

/**
 * Run `seconds` of simulation at a given step size.
 *
 * Step count is computed with rounding rather than accumulating `t += dt`:
 * neither 1/30 nor 1/240 is exact in binary, so an accumulator overshoots or
 * undershoots the end time and silently runs an extra step.
 */
function steps(seconds: number, dt: number): number {
  return Math.round(seconds / dt);
}

function simulate(tuning: ShipTuning, c: ReturnType<typeof control>, seconds: number, dt: number) {
  const ship = createShip();
  for (let i = 0; i < steps(seconds, dt); i++) updateShip(ship, c, tuning, dt);
  return ship;
}

describe('updateShip', () => {
  const direct: ShipTuning = { ...defaultShipTuning, scheme: 'direct' };

  it('does not move without input', () => {
    const ship = simulate(direct, control(0, 0), 1, 1 / 120);
    expect(speedOf(ship)).toBe(0);
    expect(ship.pos).toEqual({ x: 0, y: 0 });
  });

  it('accelerates along the stick direction in direct mode', () => {
    const ship = simulate(direct, control(1, 0), 0.5, 1 / 120);
    expect(ship.vel.x).toBeGreaterThan(0);
    expect(ship.vel.y).toBeCloseTo(0, 6);
    expect(ship.pos.x).toBeGreaterThan(0);
  });

  it('never exceeds maxSpeed', () => {
    const ship = simulate(direct, control(1, 1), 10, 1 / 120);
    expect(speedOf(ship)).toBeLessThanOrEqual(direct.maxSpeed + 1e-6);
  });

  it('goes faster while boosting', () => {
    const plain = simulate(direct, control(1, 0), 0.2, 1 / 120);
    const boosted = simulate(direct, control(1, 0, true), 0.2, 1 / 120);
    expect(speedOf(boosted)).toBeGreaterThan(speedOf(plain));
  });

  it('coasts and decays toward zero when input stops', () => {
    const ship = simulate(direct, control(1, 0), 1, 1 / 120);
    const launchSpeed = speedOf(ship);
    const idle = control(0, 0);
    for (let i = 0; i < steps(4, 1 / 120); i++) updateShip(ship, idle, direct, 1 / 120);
    const coastSpeed = speedOf(ship);
    expect(coastSpeed).toBeLessThan(launchSpeed);
    expect(coastSpeed).toBeGreaterThan(0); // momentum, not a hard stop
  });

  it('produces the same drag at any timestep (framerate independence)', () => {
    const tuning: ShipTuning = { ...direct, thrust: 0 };
    const fast = createShip();
    const slow = createShip();
    fast.vel.x = 500;
    slow.vel.x = 500;
    const idle = control(0, 0);
    for (let i = 0; i < steps(1, 1 / 240); i++) updateShip(fast, idle, tuning, 1 / 240);
    for (let i = 0; i < steps(1, 1 / 30); i++) updateShip(slow, idle, tuning, 1 / 30);
    // Exponential decay is exact per step, so both land on the same speed.
    expect(speedOf(fast)).toBeCloseTo(speedOf(slow), 4);
  });

  it('caps the turn rate in heading mode', () => {
    const tuning: ShipTuning = { ...defaultShipTuning, scheme: 'heading', turnRate: 1 };
    const ship = createShip();
    const start = ship.angle;
    updateShip(ship, control(1, 0), tuning, 0.1);
    // Nose starts at -PI/2 and the target is 0, so it cannot arrive in one step.
    expect(Math.abs(ship.angle - start)).toBeCloseTo(0.1, 6);
  });

  it('thrusts along the nose, not the stick, in heading mode', () => {
    const tuning: ShipTuning = {
      ...defaultShipTuning,
      scheme: 'heading',
      turnRate: 0, // nose locked facing up (-PI/2)
      offAxisThrust: 1,
    };
    const ship = createShip();
    updateShip(ship, control(1, 0), tuning, 0.1); // stick points right
    expect(ship.vel.y).toBeLessThan(0); // moved up, where the nose points
    expect(ship.vel.x).toBeCloseTo(0, 6);
  });

  it('gates thrust while turning when offAxisThrust is 0', () => {
    const tuning: ShipTuning = {
      ...defaultShipTuning,
      scheme: 'heading',
      turnRate: 0,
      offAxisThrust: 0,
    };
    const ship = createShip();
    updateShip(ship, control(1, 0), tuning, 0.1); // 90 degrees off the nose
    expect(speedOf(ship)).toBeCloseTo(0, 6);
    expect(ship.throttle).toBeCloseTo(0, 6);
  });

  it('rotates on stick X and throttles on stick up in tank mode', () => {
    const tuning: ShipTuning = { ...defaultShipTuning, scheme: 'tank', turnRate: 2 };
    const ship = createShip();
    const start = ship.angle;
    updateShip(ship, control(1, 0), tuning, 0.5);
    expect(ship.angle).toBeCloseTo(start + 1, 6);

    const forward = createShip();
    updateShip(forward, control(0, -1), tuning, 0.1);
    expect(forward.throttle).toBeCloseTo(1, 6);
    expect(forward.vel.y).toBeLessThan(0);
  });

  it('does not thrust backwards on stick down in tank mode', () => {
    const tuning: ShipTuning = { ...defaultShipTuning, scheme: 'tank' };
    const ship = createShip();
    updateShip(ship, control(0, 1), tuning, 0.1);
    expect(ship.throttle).toBe(0);
  });

  it('scales throttle with partial stick deflection', () => {
    const half = simulate(direct, control(0.5, 0), 0.2, 1 / 120);
    const full = simulate(direct, control(1, 0), 0.2, 1 / 120);
    expect(speedOf(half)).toBeLessThan(speedOf(full));
    expect(speedOf(half)).toBeGreaterThan(0);
  });

  it('records the previous pose for render interpolation', () => {
    const ship = createShip();
    updateShip(ship, control(1, 0), direct, 1 / 60);
    updateShip(ship, control(1, 0), direct, 1 / 60);
    expect(ship.prevPos.x).toBeLessThan(ship.pos.x);
    expect(ship.prevPos.x).toBeGreaterThan(0);
  });
});
