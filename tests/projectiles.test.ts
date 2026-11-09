import { describe, expect, it } from 'vitest';
import { createProjectilePool } from '../src/game/projectiles';

const shot = {
  x: 0, y: 0, vx: 100, vy: 0, life: 1, damage: 5, radius: 2, faction: 'player' as const,
};

describe('createProjectilePool', () => {
  it('starts empty', () => {
    expect(createProjectilePool(4).aliveCount).toBe(0);
  });

  it('spawns and moves a projectile', () => {
    const pool = createProjectilePool(4);
    pool.spawn(shot);
    pool.update(0.5);
    const p = pool.items[0]!;
    expect(p.x).toBeCloseTo(50, 6);
    expect(p.alive).toBe(true);
  });

  it('records the previous position for sweeping', () => {
    const pool = createProjectilePool(4);
    pool.spawn(shot);
    pool.update(0.1);
    const p = pool.items[0]!;
    expect(p.px).toBe(0);
    expect(p.x).toBeCloseTo(10, 6);
  });

  it('expires a projectile when its life runs out', () => {
    const pool = createProjectilePool(4);
    pool.spawn({ ...shot, life: 0.2 });
    pool.update(0.1);
    expect(pool.aliveCount).toBe(1);
    pool.update(0.15);
    expect(pool.aliveCount).toBe(0);
  });

  it('reuses expired slots instead of growing', () => {
    const pool = createProjectilePool(2);
    pool.spawn({ ...shot, life: 0.05 });
    pool.update(0.1);
    expect(pool.aliveCount).toBe(0);
    expect(pool.spawn(shot)).not.toBeNull();
    expect(pool.items.length).toBe(2);
  });

  it('refuses to spawn when full, rather than allocating', () => {
    const pool = createProjectilePool(2);
    expect(pool.spawn(shot)).not.toBeNull();
    expect(pool.spawn(shot)).not.toBeNull();
    expect(pool.spawn(shot)).toBeNull();
    expect(pool.items.length).toBe(2);
    expect(pool.aliveCount).toBe(2);
  });

  it('keeps aliveCount honest across many spawn and expire cycles', () => {
    const pool = createProjectilePool(8);
    for (let cycle = 0; cycle < 20; cycle++) {
      for (let i = 0; i < 5; i++) pool.spawn({ ...shot, life: 0.1 });
      pool.update(0.2);
    }
    expect(pool.aliveCount).toBe(0);
    expect(pool.items.filter((p) => p.alive).length).toBe(0);
  });

  it('clears everything', () => {
    const pool = createProjectilePool(4);
    pool.spawn(shot);
    pool.spawn(shot);
    pool.clear();
    expect(pool.aliveCount).toBe(0);
  });
});
