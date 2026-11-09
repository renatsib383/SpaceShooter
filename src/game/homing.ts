import { angleDelta } from '../core/math';
import { isHostile, type Faction } from './faction';
import type { Projectile } from './projectiles';

export interface HomingTarget {
  x: number;
  y: number;
  alive: boolean;
  faction: Faction;
}

/**
 * Gentle in-flight course correction.
 *
 * Deliberately not a lock-on. A projectile only acquires a target that is
 * already roughly ahead of it (`homingArc`) and within `homingRange`, and it
 * may turn no faster than `homingRate`. That turns a near miss into a hit
 * without turning a wild shot into one — aiming still has to be most of the
 * work, or the weapon stops being a weapon and becomes a button.
 *
 * Steering rotates the velocity vector and leaves its length alone, so speed,
 * range and travel time are unchanged by homing.
 */
export function homeProjectile(
  projectile: Projectile,
  targets: readonly HomingTarget[],
  dt: number,
): boolean {
  if (!projectile.alive || projectile.homingRate <= 0) return false;

  const speed = Math.hypot(projectile.vx, projectile.vy);
  if (speed <= 0) return false;

  const heading = Math.atan2(projectile.vy, projectile.vx);

  // Nearest target *inside the cone*, not the nearest overall: picking
  // globally and then rejecting it would let a close target behind the
  // projectile mask a valid one ahead.
  let bestAngle = 0;
  let bestDistance = Infinity;
  let found = false;

  for (const target of targets) {
    if (!target.alive) continue;
    if (!isHostile(projectile.faction, target.faction)) continue;

    const dx = target.x - projectile.x;
    const dy = target.y - projectile.y;
    const distance = Math.hypot(dx, dy);
    if (distance > projectile.homingRange || distance === 0) continue;

    const bearing = Math.atan2(dy, dx);
    if (Math.abs(angleDelta(heading, bearing)) > projectile.homingArc) continue;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestAngle = bearing;
      found = true;
    }
  }

  if (!found) return false;

  const turn = angleDelta(heading, bestAngle);
  const maxTurn = projectile.homingRate * dt;
  const applied = Math.abs(turn) <= maxTurn ? turn : Math.sign(turn) * maxTurn;
  const steered = heading + applied;

  projectile.vx = Math.cos(steered) * speed;
  projectile.vy = Math.sin(steered) * speed;
  return true;
}
