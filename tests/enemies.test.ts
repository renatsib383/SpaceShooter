import { describe, expect, it } from 'vitest';
import { createEnemy, raiderTuning, updateEnemy } from '../src/game/enemies';
import { createProjectilePool } from '../src/game/projectiles';

const steady = () => 0.5;

function run(enemy: ReturnType<typeof createEnemy>, target: { x: number; y: number; alive: boolean }, seconds: number, pool = createProjectilePool(64)) {
  const dt = 1 / 120;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    updateEnemy(enemy, target, raiderTuning, pool, dt, steady);
  }
  return pool;
}

describe('updateEnemy', () => {
  it('turns to face its target', () => {
    const e = createEnemy(0, 0, raiderTuning);
    e.angle = Math.PI; // facing away from a target to the right
    run(e, { x: 1000, y: 0, alive: true }, 2);
    expect(Math.abs(e.angle)).toBeLessThan(0.2);
  });

  it('closes on a distant target', () => {
    const e = createEnemy(0, 0, raiderTuning);
    const target = { x: 1500, y: 0, alive: true };
    const before = Math.hypot(target.x - e.x, target.y - e.y);
    run(e, target, 2);
    expect(Math.hypot(target.x - e.x, target.y - e.y)).toBeLessThan(before);
  });

  it('backs off when far too close', () => {
    const e = createEnemy(30, 0, raiderTuning);
    const target = { x: 0, y: 0, alive: true };
    run(e, target, 1.5);
    expect(Math.hypot(e.x, e.y)).toBeGreaterThan(30);
  });

  it('settles near its preferred range rather than ramming', () => {
    const e = createEnemy(1400, 0, raiderTuning);
    const target = { x: 0, y: 0, alive: true };
    run(e, target, 14);
    const distance = Math.hypot(e.x, e.y);
    expect(distance).toBeGreaterThan(raiderTuning.preferredRange * 0.35);
    expect(distance).toBeLessThan(raiderTuning.preferredRange * 2.2);
  });

  it('never exceeds its maximum speed', () => {
    const e = createEnemy(3000, 0, raiderTuning);
    const target = { x: 0, y: 0, alive: true };
    run(e, target, 8);
    expect(Math.hypot(e.vx, e.vy)).toBeLessThanOrEqual(raiderTuning.maxSpeed + 1e-6);
  });

  it('shoots once lined up and in range', () => {
    const e = createEnemy(0, 0, raiderTuning);
    e.angle = 0;
    const pool = run(e, { x: 300, y: 0, alive: true }, 2);
    expect(pool.aliveCount).toBeGreaterThan(0);
    expect(pool.items.find((p) => p.alive)!.faction).toBe('raider');
  });

  it('holds fire on a target out of range', () => {
    const e = createEnemy(0, 0, raiderTuning);
    e.angle = 0;
    const far = raiderTuning.fireRange + 600;
    const pool = createProjectilePool(64);
    // One step only, so it cannot close the distance first.
    updateEnemy(e, { x: far, y: 0, alive: true }, raiderTuning, pool, 1 / 120, steady);
    expect(pool.aliveCount).toBe(0);
  });

  it('holds fire while still turning onto the target', () => {
    const e = createEnemy(0, 0, raiderTuning);
    e.angle = Math.PI; // facing directly away
    const pool = createProjectilePool(64);
    updateEnemy(e, { x: 200, y: 0, alive: true }, raiderTuning, pool, 1 / 120, steady);
    expect(pool.aliveCount).toBe(0);
  });

  it('shoots a target whose bearing has wrapped past PI', () => {
    // Regression: computing aim error without normalising the angle made an
    // enemy aimed straight at its target believe it was fully turned away.
    const e = createEnemy(0, 0, raiderTuning);
    e.angle = Math.PI * 2; // same heading as 0, expressed past the wrap
    const pool = createProjectilePool(64);
    updateEnemy(e, { x: 200, y: 0, alive: true }, raiderTuning, pool, 1 / 120, steady);
    expect(pool.aliveCount).toBe(1);
  });

  it('stops shooting at a dead target', () => {
    const e = createEnemy(0, 0, raiderTuning);
    e.angle = 0;
    const pool = run(e, { x: 250, y: 0, alive: false }, 2);
    expect(pool.aliveCount).toBe(0);
  });

  it('records the previous pose for interpolation', () => {
    const e = createEnemy(0, 0, raiderTuning);
    run(e, { x: 900, y: 0, alive: true }, 0.5);
    expect(e.px).not.toBe(e.x);
  });
});
