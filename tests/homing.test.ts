import { describe, expect, it } from 'vitest';
import { homeProjectile, type HomingTarget } from '../src/game/homing';
import type { Projectile } from '../src/game/projectiles';

function bolt(over: Partial<Projectile> = {}): Projectile {
  return {
    alive: true, x: 0, y: 0, px: 0, py: 0,
    vx: 800, vy: 0, life: 1, damage: 10, radius: 3, faction: 'player',
    homingRate: 1, homingArc: 0.4, homingRange: 460, ...over,
  };
}

function target(over: Partial<HomingTarget> = {}): HomingTarget {
  return { x: 200, y: 0, alive: true, faction: 'raider', ...over };
}

const heading = (p: Projectile): number => Math.atan2(p.vy, p.vx);
const speed = (p: Projectile): number => Math.hypot(p.vx, p.vy);

describe('homeProjectile', () => {
  it('does nothing when homing is switched off', () => {
    const p = bolt({ homingRate: 0 });
    expect(homeProjectile(p, [target({ y: 40 })], 0.1)).toBe(false);
    expect(p.vy).toBe(0);
  });

  it('turns toward a target off to one side', () => {
    const p = bolt();
    expect(homeProjectile(p, [target({ x: 200, y: 40 })], 0.1)).toBe(true);
    expect(heading(p)).toBeGreaterThan(0); // steered downward, toward +y
  });

  it('turns the other way for a target on the other side', () => {
    const p = bolt();
    homeProjectile(p, [target({ x: 200, y: -40 })], 0.1);
    expect(heading(p)).toBeLessThan(0);
  });

  it('leaves speed untouched', () => {
    const p = bolt();
    const before = speed(p);
    homeProjectile(p, [target({ x: 200, y: 60 })], 0.1);
    expect(speed(p)).toBeCloseTo(before, 6);
  });

  it('never turns faster than its rate allows', () => {
    const p = bolt({ homingRate: 2, homingArc: Math.PI });
    const before = heading(p);
    // Inside homingRange (460) so the cone, not the range check, decides.
    homeProjectile(p, [target({ x: 0, y: 300 })], 0.1); // 90 degrees off
    expect(Math.abs(heading(p) - before)).toBeCloseTo(0.2, 6);
  });

  it('snaps onto the bearing when it is within one step', () => {
    const p = bolt({ homingRate: 10 });
    homeProjectile(p, [target({ x: 200, y: 1 })], 0.1);
    expect(heading(p)).toBeCloseTo(Math.atan2(1, 200), 6);
  });

  it('ignores a target outside the acquisition cone', () => {
    const p = bolt({ homingArc: 0.2 });
    // ~45 degrees off, well beyond a 0.2 rad (11 degree) cone.
    expect(homeProjectile(p, [target({ x: 200, y: 200 })], 0.1)).toBe(false);
  });

  it('ignores a target directly behind it', () => {
    const p = bolt();
    expect(homeProjectile(p, [target({ x: -200, y: 0 })], 0.1)).toBe(false);
  });

  it('ignores a target beyond its range', () => {
    const p = bolt({ homingRange: 100 });
    expect(homeProjectile(p, [target({ x: 400, y: 10 })], 0.1)).toBe(false);
  });

  it('never homes on its own side', () => {
    const p = bolt({ faction: 'player' });
    expect(homeProjectile(p, [target({ faction: 'player', y: 30 })], 0.1)).toBe(false);
  });

  it('ignores dead targets', () => {
    const p = bolt();
    expect(homeProjectile(p, [target({ y: 30, alive: false })], 0.1)).toBe(false);
  });

  it('picks the nearest target inside the cone, not the nearest overall', () => {
    const p = bolt();
    const behind = target({ x: -10, y: 0 });      // very close, but behind
    const ahead = target({ x: 300, y: 30 });      // further, but acquirable
    homeProjectile(p, [behind, ahead], 0.1);
    expect(heading(p)).toBeGreaterThan(0);        // turned toward `ahead`
  });

  it('converges on a target over a flight rather than oscillating', () => {
    const p = bolt({ homingRate: 1.5 });
    const t = target({ x: 400, y: 120 });
    const dt = 1 / 120;
    let last = Infinity;
    for (let i = 0; i < 60; i++) {
      homeProjectile(p, [t], dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const miss = Math.abs(Math.atan2(t.y - p.y, t.x - p.x) - Math.atan2(p.vy, p.vx));
      expect(miss).toBeLessThanOrEqual(last + 1e-6);
      last = miss;
    }
    expect(last).toBeLessThan(0.05);
  });

  it('corrects a near miss into a hit over a realistic flight', () => {
    // Fired straight ahead at a raider slightly off-axis, at bolt speed.
    const p = bolt({ homingRate: 0.95, homingArc: 0.4, homingRange: 460 });
    const t = target({ x: 420, y: 55 });
    const dt = 1 / 120;
    let closest = Infinity;
    for (let i = 0; i < 120; i++) {
      homeProjectile(p, [t], dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      closest = Math.min(closest, Math.hypot(t.x - p.x, t.y - p.y));
    }
    expect(closest).toBeLessThan(18); // inside a raider's hull radius
  });

  it('cannot rescue a wildly wrong shot', () => {
    // Same bolt, target 90 degrees off: the cone must reject it outright.
    const p = bolt({ homingRate: 0.95, homingArc: 0.4 });
    expect(homeProjectile(p, [target({ x: 0, y: 300 })], 0.1)).toBe(false);
  });

  it('handles a stationary projectile without dividing by zero', () => {
    const p = bolt({ vx: 0, vy: 0 });
    expect(homeProjectile(p, [target()], 0.1)).toBe(false);
  });

  it('ignores dead projectiles', () => {
    const p = bolt({ alive: false });
    expect(homeProjectile(p, [target({ y: 30 })], 0.1)).toBe(false);
  });
});
