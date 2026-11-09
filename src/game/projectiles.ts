import type { Faction } from './faction';

export interface Projectile {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds of life remaining. */
  life: number;
  damage: number;
  radius: number;
  /** Who fired it; it cannot hit its own side. */
  faction: Faction;
  /** Previous position, for render interpolation and swept collision. */
  px: number;
  py: number;
}

export interface ProjectilePool {
  readonly items: readonly Projectile[];
  spawn(p: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    damage: number;
    radius: number;
    faction: Faction;
  }): Projectile | null;
  update(dt: number): void;
  clear(): void;
  readonly aliveCount: number;
}

function blank(): Projectile {
  return {
    alive: false, x: 0, y: 0, vx: 0, vy: 0,
    life: 0, damage: 0, radius: 2, faction: 'player', px: 0, py: 0,
  };
}

/**
 * Fixed-capacity pool.
 *
 * Projectiles are the one thing here that would otherwise churn the heap every
 * frame, so slots are preallocated and reused; nothing is allocated during
 * play. When the pool is full the spawn is dropped rather than growing the
 * array, which keeps the frame cost bounded — a weapon that outruns the pool
 * is a tuning bug, not something to paper over with allocation.
 */
export function createProjectilePool(capacity = 256): ProjectilePool {
  const items: Projectile[] = Array.from({ length: capacity }, blank);
  let cursor = 0;
  let aliveCount = 0;

  return {
    items,
    get aliveCount(): number {
      return aliveCount;
    },
    spawn(p): Projectile | null {
      // Linear probe from the last hand-out: dead slots cluster, so this finds
      // one in a step or two in practice.
      for (let i = 0; i < capacity; i++) {
        const slot = items[(cursor + i) % capacity]!;
        if (slot.alive) continue;
        cursor = (cursor + i + 1) % capacity;
        slot.alive = true;
        slot.x = slot.px = p.x;
        slot.y = slot.py = p.y;
        slot.vx = p.vx;
        slot.vy = p.vy;
        slot.life = p.life;
        slot.damage = p.damage;
        slot.radius = p.radius;
        slot.faction = p.faction;
        aliveCount++;
        return slot;
      }
      return null;
    },
    update(dt: number): void {
      for (const p of items) {
        if (!p.alive) continue;
        p.px = p.x;
        p.py = p.y;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          aliveCount--;
        }
      }
    },
    clear(): void {
      for (const p of items) p.alive = false;
      aliveCount = 0;
      cursor = 0;
    },
  };
}
