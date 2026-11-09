import { describe, expect, it } from 'vitest';
import {
  createCamera,
  defaultCameraTuning,
  targetZoomFor,
  updateCamera,
} from '../src/game/camera';
import { createShip } from '../src/game/ship';
import type { CameraTuning } from '../src/game/camera';

const t: CameraTuning = defaultCameraTuning;

function run(camera: ReturnType<typeof createCamera>, ship: ReturnType<typeof createShip>, seconds: number, dt = 1 / 120, tuning = t) {
  for (let i = 0; i < Math.round(seconds / dt); i++) updateCamera(camera, ship, tuning, dt);
}

describe('targetZoomFor', () => {
  it('is fully zoomed in at rest', () => {
    expect(targetZoomFor(0, t)).toBeCloseTo(t.zoomAtRest, 9);
  });

  it('reaches the pulled-back zoom at the reference speed', () => {
    expect(targetZoomFor(t.zoomSpeedRef, t)).toBeCloseTo(t.zoomAtSpeed, 9);
  });

  it('pulls back monotonically as speed rises', () => {
    let previous = Infinity;
    for (let s = 0; s <= t.zoomSpeedRef; s += 40) {
      const z = targetZoomFor(s, t);
      expect(z).toBeLessThanOrEqual(previous + 1e-9);
      previous = z;
    }
  });

  it('does not keep zooming out past the reference speed', () => {
    expect(targetZoomFor(t.zoomSpeedRef * 4, t)).toBeCloseTo(t.zoomAtSpeed, 9);
  });

  it('survives a zero reference speed without dividing by zero', () => {
    const z = targetZoomFor(100, { ...t, zoomSpeedRef: 0 });
    expect(Number.isFinite(z)).toBe(true);
  });
});

describe('updateCamera', () => {
  it('eases zoom out as the ship speeds up', () => {
    const camera = createCamera(0, 0, 1);
    const ship = createShip();
    ship.vel.x = t.zoomSpeedRef;
    run(camera, ship, 3);
    expect(camera.zoom).toBeLessThan(0.7);
    expect(camera.zoom).toBeGreaterThan(t.zoomAtSpeed - 0.02);
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
    const fast = createCamera(0, 0, 1);
    const slow = createCamera(0, 0, 1);
    const shipA = createShip();
    const shipB = createShip();
    shipA.vel.x = t.zoomSpeedRef;
    shipB.vel.x = t.zoomSpeedRef;
    run(fast, shipA, 1, 1 / 240);
    run(slow, shipB, 1, 1 / 30);
    expect(fast.zoom).toBeCloseTo(slow.zoom, 4);
  });

  it('keeps zoom within the configured bounds at all times', () => {
    const camera = createCamera(0, 0, 1);
    const ship = createShip();
    for (let i = 0; i < 2000; i++) {
      ship.vel.x = Math.sin(i / 37) * t.zoomSpeedRef * 2;
      updateCamera(camera, ship, t, 1 / 120);
      expect(camera.zoom).toBeLessThanOrEqual(t.zoomAtRest + 1e-6);
      expect(camera.zoom).toBeGreaterThanOrEqual(t.zoomAtSpeed - 1e-6);
    }
  });

  it('still leads the ship in the direction of travel', () => {
    const camera = createCamera(0, 0, 1);
    const ship = createShip();
    ship.vel.x = 400;
    run(camera, ship, 2);
    expect(camera.pos.x).toBeGreaterThan(ship.pos.x);
  });
});
