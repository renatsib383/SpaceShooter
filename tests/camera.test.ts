import { describe, expect, it } from 'vitest';
import {
  createCamera,
  defaultCameraTuning,
  targetZoomFor,
  updateCamera,
  updateSustain,
} from '../src/game/camera';
import { createShip } from '../src/game/ship';
import type { CameraTuning } from '../src/game/camera';

const t: CameraTuning = defaultCameraTuning;

function run(camera: ReturnType<typeof createCamera>, ship: ReturnType<typeof createShip>, seconds: number, dt = 1 / 120, tuning = t) {
  for (let i = 0; i < Math.round(seconds / dt); i++) updateCamera(camera, ship, tuning, dt);
}

describe('targetZoomFor', () => {
  it('is fully zoomed in at rest', () => {
    expect(targetZoomFor(0, 0, t)).toBeCloseTo(t.zoomAtRest, 9);
  });

  it('reaches the pulled-back zoom on first touching the reference speed', () => {
    expect(targetZoomFor(t.zoomSpeedRef, 0, t)).toBeCloseTo(t.zoomAtSpeed, 9);
  });

  it('keeps widening as sustained speed banks up', () => {
    const fresh = targetZoomFor(t.zoomSpeedRef, 0, t);
    const halfway = targetZoomFor(t.zoomSpeedRef, 0.5, t);
    const banked = targetZoomFor(t.zoomSpeedRef, 1, t);
    expect(halfway).toBeLessThan(fresh);
    expect(banked).toBeLessThan(halfway);
    expect(banked).toBeCloseTo(t.zoomAtSustained, 9);
  });

  it('pulls back monotonically as speed rises', () => {
    let previous = Infinity;
    for (let s = 0; s <= t.zoomSpeedRef; s += 40) {
      const z = targetZoomFor(s, 0, t);
      expect(z).toBeLessThanOrEqual(previous + 1e-9);
      previous = z;
    }
  });

  it('does not keep zooming out past the reference speed', () => {
    expect(targetZoomFor(t.zoomSpeedRef * 4, 0, t)).toBeCloseTo(t.zoomAtSpeed, 9);
  });

  it('survives a zero reference speed without dividing by zero', () => {
    const z = targetZoomFor(100, 0, { ...t, zoomSpeedRef: 0 });
    expect(Number.isFinite(z)).toBe(true);
  });
});

describe('updateCamera', () => {
  it('eases zoom out as the ship speeds up', () => {
    const camera = createCamera(0, 0, 1);
    const ship = createShip();
    ship.vel.x = t.zoomSpeedRef;
    run(camera, ship, 3);
    // Three seconds in, speed has taken it past zoomAtSpeed and sustain is
    // still building toward zoomAtSustained.
    expect(camera.zoom).toBeLessThan(t.zoomAtSpeed);
    expect(camera.zoom).toBeGreaterThan(t.zoomAtSustained);
  });

  it('eases back in when the ship slows down', () => {
    const camera = createCamera(0, 0, t.zoomAtSpeed);
    const ship = createShip();
    run(camera, ship, 3); // velocity zero
    expect(camera.zoom).toBeGreaterThan(0.95);
  });

  it('does not snap: one step moves only part of the way', () => {
    const camera = createCamera(0, 0, 1);
    const ship = createShip();
    ship.vel.x = t.zoomSpeedRef;
    updateCamera(camera, ship, t, 1 / 120);
    expect(camera.zoom).toBeLessThan(1);
    expect(camera.zoom).toBeGreaterThan(0.98);
  });

  it('eases zoom identically at any timestep', () => {
    // Measured against a stationary target: exponential easing composes
    // exactly only when the target is fixed, and with sustain building the
    // target itself moves, so a coarse step necessarily chases a staler one.
    // Sustain's own timestep independence is covered in updateSustain below.
    const fixed = { ...t, zoomAtSustained: t.zoomAtSpeed };
    const fast = createCamera(0, 0, 1);
    const slow = createCamera(0, 0, 1);
    const shipA = createShip();
    const shipB = createShip();
    shipA.vel.x = t.zoomSpeedRef;
    shipB.vel.x = t.zoomSpeedRef;
    run(fast, shipA, 1, 1 / 240, fixed);
    run(slow, shipB, 1, 1 / 30, fixed);
    expect(fast.zoom).toBeCloseTo(slow.zoom, 4);
  });

  it('tracks closely enough across timesteps even while sustain builds', () => {
    const fast = createCamera(0, 0, 1);
    const slow = createCamera(0, 0, 1);
    const shipA = createShip();
    const shipB = createShip();
    shipA.vel.x = t.zoomSpeedRef;
    shipB.vel.x = t.zoomSpeedRef;
    run(fast, shipA, 3, 1 / 240);
    run(slow, shipB, 3, 1 / 30);
    expect(Math.abs(fast.zoom - slow.zoom)).toBeLessThan(0.01);
  });

  it('keeps zoom within the configured bounds at all times', () => {
    // The floor is zoomAtSustained now, not zoomAtSpeed: a long burn is meant
    // to carry the view past the speed-only pull-back.
    const camera = createCamera(0, 0, 1);
    const ship = createShip();
    for (let i = 0; i < 2000; i++) {
      ship.vel.x = Math.sin(i / 37) * t.zoomSpeedRef * 2;
      updateCamera(camera, ship, t, 1 / 120);
      expect(camera.zoom).toBeLessThanOrEqual(t.zoomAtRest + 1e-6);
      expect(camera.zoom).toBeGreaterThanOrEqual(t.zoomAtSustained - 1e-6);
    }
  });

  it('still leads the ship in the direction of travel', () => {
    const camera = createCamera(0, 0, 1);
    const ship = createShip();
    ship.vel.x = 400;
    run(camera, ship, 2);
    expect(camera.pos.x).toBeGreaterThan(ship.pos.x);
  });

  it('widens further the longer top speed is held', () => {
    const camera = createCamera(0, 0, 1);
    const ship = createShip();
    ship.vel.x = t.zoomSpeedRef;

    run(camera, ship, 1);
    const early = camera.zoom;
    run(camera, ship, 4);
    const later = camera.zoom;
    run(camera, ship, 6);
    const settled = camera.zoom;

    expect(later).toBeLessThan(early - 0.01);
    expect(settled).toBeLessThan(later);
    expect(settled).toBeCloseTo(t.zoomAtSustained, 2);
  });

  it('gives the wide view back faster than it was earned', () => {
    const camera = createCamera(0, 0, 1);
    const ship = createShip();
    ship.vel.x = t.zoomSpeedRef;
    run(camera, ship, 10);
    expect(camera.sustain).toBeCloseTo(1, 2);

    ship.vel.x = 0;
    run(camera, ship, t.sustainFall + 0.2);
    expect(camera.sustain).toBeCloseTo(0, 2);
  });
});

describe('updateSustain', () => {
  it('takes the configured time to build at full speed', () => {
    let sustain = 0;
    const dt = 1 / 120;
    for (let i = 0; i < Math.round(t.sustainRise / dt); i++) {
      sustain = updateSustain(sustain, t.zoomSpeedRef, t, dt);
    }
    expect(sustain).toBeCloseTo(1, 3);
  });

  it('bleeds off faster than it builds', () => {
    expect(t.sustainFall).toBeLessThan(t.sustainRise);

    let sustain = 1;
    const dt = 1 / 120;
    for (let i = 0; i < Math.round(t.sustainFall / dt); i++) {
      sustain = updateSustain(sustain, 0, t, dt);
    }
    expect(sustain).toBeCloseTo(0, 3);
  });

  it('settles at the speed fraction when cruising below top speed', () => {
    let sustain = 0;
    const dt = 1 / 120;
    for (let i = 0; i < 2000; i++) {
      sustain = updateSustain(sustain, t.zoomSpeedRef * 0.5, t, dt);
    }
    expect(sustain).toBeCloseTo(0.5, 3);
  });

  it('builds at the same rate whatever the timestep', () => {
    const build = (dt: number): number => {
      let sustain = 0;
      for (let i = 0; i < Math.round(2 / dt); i++) {
        sustain = updateSustain(sustain, t.zoomSpeedRef, t, dt);
      }
      return sustain;
    };
    expect(build(1 / 240)).toBeCloseTo(build(1 / 30), 4);
  });

  it('stays within 0..1', () => {
    let sustain = 0;
    for (let i = 0; i < 5000; i++) {
      sustain = updateSustain(sustain, i % 2 ? t.zoomSpeedRef * 3 : 0, t, 1 / 60);
      expect(sustain).toBeGreaterThanOrEqual(0);
      expect(sustain).toBeLessThanOrEqual(1);
    }
  });

  it('survives zero rise and fall times without dividing by zero', () => {
    const instant = { ...t, sustainRise: 0, sustainFall: 0 };
    expect(updateSustain(0, t.zoomSpeedRef, instant, 1 / 60)).toBe(1);
    expect(updateSustain(1, 0, instant, 1 / 60)).toBe(0);
  });
});
