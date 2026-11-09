import { describe, expect, it } from 'vitest';
import { createProjectilePool } from '../src/game/projectiles';
import { createWeapon, playerWeapon, updateWeapon } from '../src/game/weapon';
import type { Shooter } from '../src/game/weapon';

function shooter(over: Partial<Shooter> = {}): Shooter {
  return {
    x: 0, y: 0, vx: 0, vy: 0, angle: 0,
    faction: 'player', muzzleOffset: 10, ...over,
  };
}

const noSpread = () => 0.5; // centre of the spread cone

describe('updateWeapon', () => {
  it('does not fire when not asked', () => {
    const pool = createProjectilePool(8);
    updateWeapon(createWeapon(), playerWeapon, shooter(), false, pool, 0.1, noSpread);
    expect(pool.aliveCount).toBe(0);
  });

  it('fires immediately on the first request', () => {
    const pool = createProjectilePool(8);
    const fired = updateWeapon(createWeapon(), playerWeapon, shooter(), true, pool, 0.016, noSpread);
    expect(fired).toBe(true);
    expect(pool.aliveCount).toBe(1);
  });

  it('respects the fire interval while held', () => {
    const pool = createProjectilePool(64);
    const state = createWeapon();
    const dt = 1 / 120;
    // Hold for exactly one second.
    for (let i = 0; i < 120; i++) {
      updateWeapon(state, playerWeapon, shooter(), true, pool, dt, noSpread);
    }
    const expected = Math.floor(1 / playerWeapon.fireInterval) + 1;
    expect(pool.aliveCount).toBeGreaterThanOrEqual(expected - 1);
    expect(pool.aliveCount).toBeLessThanOrEqual(expected);
  });

  it('does not bank up free shots while idle', () => {
    const pool = createProjectilePool(16);
    const state = createWeapon();
    // Idle for a long time, then ask to fire twice in a row.
    for (let i = 0; i < 300; i++) {
      updateWeapon(state, playerWeapon, shooter(), false, pool, 1 / 120, noSpread);
    }
    updateWeapon(state, playerWeapon, shooter(), true, pool, 1 / 120, noSpread);
    updateWeapon(state, playerWeapon, shooter(), true, pool, 1 / 120, noSpread);
    expect(pool.aliveCount).toBe(1);
  });

  it('launches from the muzzle, not the centre', () => {
    const pool = createProjectilePool(8);
    updateWeapon(createWeapon(), playerWeapon, shooter({ angle: 0 }), true, pool, 0.016, noSpread);
    expect(pool.items[0]!.x).toBeCloseTo(10, 6);
  });

  it('adds the shooter velocity so shots lead a moving ship', () => {
    const pool = createProjectilePool(8);
    updateWeapon(
      createWeapon(), playerWeapon, shooter({ vx: 0, vy: 300, angle: 0 }),
      true, pool, 0.016, noSpread,
    );
    expect(pool.items[0]!.vy).toBeCloseTo(300, 6);
    expect(pool.items[0]!.vx).toBeCloseTo(playerWeapon.muzzleSpeed, 6);
  });

  it('applies recoil to the shooter it is given', () => {
    const pool = createProjectilePool(8);
    const s = shooter({ angle: 0 });
    updateWeapon(createWeapon(), playerWeapon, s, true, pool, 0.016, noSpread);
    expect(s.vx).toBeCloseTo(-playerWeapon.recoil, 6);
  });

  it('tags the projectile with the shooter faction', () => {
    const pool = createProjectilePool(8);
    updateWeapon(
      createWeapon(), playerWeapon, shooter({ faction: 'raider' }),
      true, pool, 0.016, noSpread,
    );
    expect(pool.items[0]!.faction).toBe('raider');
  });

  it('does not start the cooldown when the pool is full', () => {
    const pool = createProjectilePool(1);
    const state = createWeapon();
    updateWeapon(state, playerWeapon, shooter(), true, pool, 0.016, noSpread);
    expect(state.cooldown).toBeGreaterThan(0);

    // Pool is now full; a dropped shot must leave the cooldown untouched.
    const full = createWeapon();
    const fired = updateWeapon(full, playerWeapon, shooter(), true, pool, 0.016, noSpread);
    expect(fired).toBe(false);
    expect(full.cooldown).toBe(0);
  });

  it('spreads shots within the configured cone', () => {
    const pool = createProjectilePool(64);
    const angles: number[] = [];
    for (let i = 0; i < 20; i++) {
      const state = createWeapon();
      updateWeapon(state, playerWeapon, shooter(), true, pool, 0.016, () => i / 20);
      const p = pool.items[i]!;
      angles.push(Math.atan2(p.vy, p.vx));
    }
    const half = playerWeapon.spread / 2;
    for (const a of angles) expect(Math.abs(a)).toBeLessThanOrEqual(half + 1e-9);
  });
});
