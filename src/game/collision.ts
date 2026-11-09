import type { Projectile } from './projectiles';
import { isHostile, type Faction } from './faction';

export interface Collidable {
  x: number;
  y: number;
  radius: number;
  faction: Faction;
  alive: boolean;
}

/**
 * Swept circle-vs-point test.
 *
 * A projectile at 800 px/s moves ~7 px per 120 Hz step, which is already
 * comparable to a small hitbox; at a lower step rate, or against a fast
 * closing target, a plain overlap test at the end position tunnels straight
 * through. This measures the distance from the target centre to the segment
 * the projectile actually travelled.
 */
export function projectileHits(p: Projectile, target: Collidable): boolean {
  if (!p.alive || !target.alive) return false;
  if (!isHostile(p.faction, target.faction)) return false;

  const segX = p.x - p.px;
  const segY = p.y - p.py;
  const toX = target.x - p.px;
  const toY = target.y - p.py;
  const segLenSq = segX * segX + segY * segY;

  // Project the target onto the travelled segment, clamped to its ends.
  const t = segLenSq > 0 ? Math.max(0, Math.min(1, (toX * segX + toY * segY) / segLenSq)) : 0;
  const closestX = p.px + segX * t;
  const closestY = p.py + segY * t;

  const dx = target.x - closestX;
  const dy = target.y - closestY;
  const reach = target.radius + p.radius;
  return dx * dx + dy * dy <= reach * reach;
}

/** Plain circle overlap, for hull-to-hull contact. */
export function bodiesOverlap(a: Collidable, b: Collidable): boolean {
  if (!a.alive || !b.alive) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const reach = a.radius + b.radius;
  return dx * dx + dy * dy <= reach * reach;
}
