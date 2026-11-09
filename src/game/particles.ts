import { decay } from '../core/math';

export interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  /** 0 = ember/orange, 1 = spark/white-blue. */
  hue: number;
}

export interface ParticleSystem {
  readonly items: readonly Particle[];
  burst(x: number, y: number, count: number, speed: number, hue?: number): void;
  update(dt: number): void;
  clear(): void;
}

/**
 * Fixed-capacity particle pool for explosions and impacts.
 *
 * Oldest-wins overwrite rather than dropping: unlike a projectile, a missing
 * particle is invisible but a missing explosion is a bug the player sees, so
 * a late burst is allowed to recycle the longest-lived debris.
 */
export function createParticles(capacity = 400, random: () => number = Math.random): ParticleSystem {
  const items: Particle[] = Array.from({ length: capacity }, () => ({
    alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, hue: 0,
  }));
  let cursor = 0;

  const take = (): Particle => {
    for (let i = 0; i < capacity; i++) {
      const slot = items[(cursor + i) % capacity]!;
      if (!slot.alive) {
        cursor = (cursor + i + 1) % capacity;
        return slot;
      }
    }
    const slot = items[cursor]!;
    cursor = (cursor + 1) % capacity;
    return slot;
  };

  return {
    items,
    burst(x, y, count, speed, hue = 0): void {
      for (let i = 0; i < count; i++) {
        const p = take();
        const angle = random() * Math.PI * 2;
        const v = speed * (0.25 + random() * 0.75);
        p.alive = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * v;
        p.vy = Math.sin(angle) * v;
        p.maxLife = 0.35 + random() * 0.5;
        p.life = p.maxLife;
        p.size = 1 + random() * 2.5;
        p.hue = hue;
      }
    },
    update(dt: number): void {
      const remaining = decay(0.25, dt);
      for (const p of items) {
        if (!p.alive) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= remaining;
        p.vy *= remaining;
        p.life -= dt;
        if (p.life <= 0) p.alive = false;
      }
    },
    clear(): void {
      for (const p of items) p.alive = false;
      cursor = 0;
    },
  };
}
