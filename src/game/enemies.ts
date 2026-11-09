import { angleDelta, rotateToward, decay } from '../core/math';
import { limit } from '../core/vec2';
import type { Faction } from './faction';
import { createWeapon, raiderWeapon, updateWeapon, type WeaponState } from './weapon';
import type { ProjectilePool } from './projectiles';

export interface Enemy {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hull: number;
  maxHull: number;
  radius: number;
  faction: Faction;
  weapon: WeaponState;
  /** Previous pose, for render interpolation. */
  px: number;
  py: number;
  pangle: number;
  /** Seconds since spawn; used to stagger behaviour. */
  age: number;
}

export interface EnemyTuning {
  thrust: number;
  maxSpeed: number;
  dragHalfLife: number;
  turnRate: number;
  /** Distance it tries to hold from its target, px. */
  preferredRange: number;
  /** Beyond this it will not shoot, px. */
  fireRange: number;
  /** Must be aimed within this many radians of the target to shoot. */
  fireArc: number;
  maxHull: number;
  radius: number;
  /** Damage dealt by flying into the player. */
  ramDamage: number;
}

export const raiderTuning: EnemyTuning = {
  thrust: 430,
  maxSpeed: 300,
  dragHalfLife: 1.1,
  turnRate: 2.6,
  preferredRange: 260,
  fireRange: 520,
  fireArc: 0.3,
  maxHull: 30,
  radius: 15,
  ramDamage: 18,
};

export interface Target {
  x: number;
  y: number;
  alive: boolean;
}

const shooterView = {
  x: 0, y: 0, vx: 0, vy: 0, angle: 0,
  faction: 'raider' as Faction, muzzleOffset: 0,
};

export function createEnemy(x: number, y: number, t: EnemyTuning): Enemy {
  return {
    alive: true,
    x, y, vx: 0, vy: 0,
    angle: 0,
    hull: t.maxHull,
    maxHull: t.maxHull,
    radius: t.radius,
    faction: 'raider',
    weapon: createWeapon(),
    px: x, py: y, pangle: 0,
    age: 0,
  };
}

/**
 * Raider behaviour: close to a preferred range, hold it, and shoot when lined
 * up.
 *
 * It steers by thrust toward a desired offset rather than by pathfinding;
 * with the same inertia the player has, that produces the overshooting,
 * banking approach that reads as flying rather than sliding. Holding a range
 * instead of ramming also keeps a fight readable: enemies orbit at a distance
 * where the player can see and answer them.
 */
export function updateEnemy(
  enemy: Enemy,
  target: Target,
  t: EnemyTuning,
  pool: ProjectilePool,
  dt: number,
  random: () => number = Math.random,
): void {
  if (!enemy.alive) return;

  enemy.px = enemy.x;
  enemy.py = enemy.y;
  enemy.pangle = enemy.angle;
  enemy.age += dt;

  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const toTarget = Math.atan2(dy, dx);

  // Always face the target: an enemy that aims where it is drifting is far
  // harder to read than one that points at you.
  enemy.angle = rotateToward(enemy.angle, toTarget, t.turnRate * dt);

  if (target.alive) {
    // Positive when too far, negative when too close, so one term both
    // closes and backs off.
    const rangeError = distance - t.preferredRange;
    const closing = Math.max(-1, Math.min(1, rangeError / t.preferredRange));

    // A slow orbit keeps it from parking dead ahead and makes it a moving
    // target; the phase is offset by age so a wing does not fly in lockstep.
    const orbit = Math.sin(enemy.age * 0.7) * 0.55;
    const driveAngle = toTarget + orbit * (closing < 0 ? -1 : 1);

    enemy.vx += Math.cos(driveAngle) * t.thrust * closing * dt;
    enemy.vy += Math.sin(driveAngle) * t.thrust * closing * dt;
  }

  const remaining = decay(t.dragHalfLife, dt);
  enemy.vx *= remaining;
  enemy.vy *= remaining;
  const capped = limit({ x: enemy.vx, y: enemy.vy }, t.maxSpeed);
  enemy.vx = capped.x;
  enemy.vy = capped.y;

  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;

  // angleDelta, not a raw subtraction: the difference must be normalised into
  // (-PI, PI] or a heading that has wrapped reads as fully turned away.
  const aimError = Math.abs(angleDelta(enemy.angle, toTarget));
  const canShoot = target.alive && distance < t.fireRange && aimError < t.fireArc;

  // Reused rather than a literal: updateWeapon writes recoil into the shooter
  // it is given, and a fresh object would swallow it.
  shooterView.x = enemy.x;
  shooterView.y = enemy.y;
  shooterView.vx = enemy.vx;
  shooterView.vy = enemy.vy;
  shooterView.angle = enemy.angle;
  shooterView.faction = enemy.faction;
  shooterView.muzzleOffset = t.radius;

  updateWeapon(enemy.weapon, raiderWeapon, shooterView, canShoot, pool, dt, random);

  enemy.vx = shooterView.vx;
  enemy.vy = shooterView.vy;
}
