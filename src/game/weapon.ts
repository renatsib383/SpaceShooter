import type { Faction } from './faction';
import type { ProjectilePool } from './projectiles';

export interface WeaponTuning {
  /** Seconds between shots. */
  fireInterval: number;
  /** Projectile speed, px/s, before the shooter's own velocity is added. */
  muzzleSpeed: number;
  damage: number;
  /** Seconds a projectile survives; with muzzleSpeed this sets its range. */
  life: number;
  /** Random angular spread, radians, full cone width. */
  spread: number;
  projectileRadius: number;
  /** Impulse pushed back into the shooter per shot, px/s. */
  recoil: number;
}

export const playerWeapon: WeaponTuning = {
  fireInterval: 0.14,
  muzzleSpeed: 820,
  damage: 10,
  life: 1.1,
  spread: 0.03,
  projectileRadius: 3,
  recoil: 12,
};

export const raiderWeapon: WeaponTuning = {
  fireInterval: 0.62,
  muzzleSpeed: 560,
  damage: 7,
  life: 1.5,
  spread: 0.09,
  projectileRadius: 3,
  recoil: 0,
};

export interface WeaponState {
  /** Seconds until the next shot is allowed. */
  cooldown: number;
}

export function createWeapon(): WeaponState {
  return { cooldown: 0 };
}

export interface Shooter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  faction: Faction;
  /** Distance from the centre to the muzzle. */
  muzzleOffset: number;
}

/**
 * Advance a weapon and fire if asked and able.
 *
 * The shooter's own velocity is added to the muzzle velocity, so shots from a
 * moving ship travel where they are aimed instead of trailing behind it.
 *
 * Cooldown is decremented but never allowed below zero: letting it run
 * negative while not firing would bank up free shots.
 */
export function updateWeapon(
  state: WeaponState,
  tuning: WeaponTuning,
  shooter: Shooter,
  wantsToFire: boolean,
  pool: ProjectilePool,
  dt: number,
  random: () => number = Math.random,
): boolean {
  state.cooldown = Math.max(0, state.cooldown - dt);
  if (!wantsToFire || state.cooldown > 0) return false;

  const spread = (random() - 0.5) * tuning.spread;
  const angle = shooter.angle + spread;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const fired = pool.spawn({
    x: shooter.x + cos * shooter.muzzleOffset,
    y: shooter.y + sin * shooter.muzzleOffset,
    vx: shooter.vx + cos * tuning.muzzleSpeed,
    vy: shooter.vy + sin * tuning.muzzleSpeed,
    life: tuning.life,
    damage: tuning.damage,
    radius: tuning.projectileRadius,
    faction: shooter.faction,
  });

  // A dropped shot must not start the cooldown, or a full pool would also
  // silently halve the fire rate.
  if (!fired) return false;

  state.cooldown = tuning.fireInterval;
  shooter.vx -= cos * tuning.recoil;
  shooter.vy -= sin * tuning.recoil;
  return true;
}
