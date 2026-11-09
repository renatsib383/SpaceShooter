import { describe, expect, it } from 'vitest';
import { bodiesOverlap, projectileHits, type Collidable } from '../src/game/collision';
import type { Projectile } from '../src/game/projectiles';

function bolt(over: Partial<Projectile> = {}): Projectile {
  return {
    alive: true, x: 10, y: 0, px: 0, py: 0,
    vx: 1000, vy: 0, life: 1, damage: 5, radius: 2, faction: 'player',
    homingRate: 0, homingArc: 0, homingRange: 0, ...over,
  };
}

function body(over: Partial<Collidable> = {}): Collidable {
  return { x: 0, y: 0, radius: 10, faction: 'raider', alive: true, ...over };
}

describe('projectileHits', () => {
  it('hits a target sitting on the path', () => {
    expect(projectileHits(bolt(), body({ x: 5 }))).toBe(true);
  });

  it('misses a target well off the path', () => {
    expect(projectileHits(bolt(), body({ x: 5, y: 400 }))).toBe(false);
  });

  it('ignores a dead projectile or a dead target', () => {
    expect(projectileHits(bolt({ alive: false }), body({ x: 5 }))).toBe(false);
    expect(projectileHits(bolt(), body({ x: 5, alive: false }))).toBe(false);
  });

  it('never hits its own faction', () => {
    expect(projectileHits(bolt({ faction: 'player' }), body({ faction: 'player', x: 5 }))).toBe(false);
    expect(projectileHits(bolt({ faction: 'raider' }), body({ faction: 'raider', x: 5 }))).toBe(false);
  });

  it('catches a target the projectile skipped over in one step', () => {
    // Travelled 0 -> 600 in one step, past a target at x=300 that a plain
    // end-position overlap test would miss entirely.
    const fast = bolt({ px: 0, py: 0, x: 600, y: 0 });
    expect(projectileHits(fast, body({ x: 300, radius: 8 }))).toBe(true);
  });

  it('does not hit a target behind the start of the sweep', () => {
    expect(projectileHits(bolt({ px: 0, x: 100 }), body({ x: -200 }))).toBe(false);
  });

  it('does not hit a target beyond the end of the sweep', () => {
    expect(projectileHits(bolt({ px: 0, x: 100 }), body({ x: 400 }))).toBe(false);
  });

  it('counts the projectile radius in the reach', () => {
    // Target edge at y = 10, projectile radius 2: a centre 11 away still hits.
    expect(projectileHits(bolt({ px: 0, x: 100 }), body({ x: 50, y: 11.5, radius: 10 }))).toBe(true);
    expect(projectileHits(bolt({ px: 0, x: 100 }), body({ x: 50, y: 13, radius: 10 }))).toBe(false);
  });

  it('handles a zero-length sweep without dividing by zero', () => {
    const still = bolt({ px: 5, py: 0, x: 5, y: 0 });
    expect(projectileHits(still, body({ x: 5 }))).toBe(true);
    expect(projectileHits(still, body({ x: 500 }))).toBe(false);
  });
});

describe('bodiesOverlap', () => {
  it('detects touching hulls', () => {
    expect(bodiesOverlap(body({ x: 0, radius: 10 }), body({ x: 15, radius: 10 }))).toBe(true);
  });

  it('rejects separated hulls', () => {
    expect(bodiesOverlap(body({ x: 0, radius: 10 }), body({ x: 40, radius: 10 }))).toBe(false);
  });

  it('is exact at the moment of contact', () => {
    expect(bodiesOverlap(body({ x: 0, radius: 10 }), body({ x: 20, radius: 10 }))).toBe(true);
    expect(bodiesOverlap(body({ x: 0, radius: 10 }), body({ x: 20.001, radius: 10 }))).toBe(false);
  });

  it('ignores dead bodies', () => {
    expect(bodiesOverlap(body({ alive: false }), body({ x: 5 }))).toBe(false);
  });
});
