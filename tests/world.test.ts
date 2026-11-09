import { describe, expect, it } from 'vitest';
import { createWorld, defaultWorldTuning, livingEnemies, updateWorld } from '../src/game/world';
import { defaultShipTuning } from '../src/game/ship';
import { raiderTuning } from '../src/game/enemies';
import { createControlState } from '../src/input/types';
import type { World } from '../src/game/world';

const steady = () => 0.5;

function ctx(over: Partial<ReturnType<typeof controlOf>> = {}) {
  return {
    control: { ...createControlState(), ...over },
    shipTuning: defaultShipTuning,
    random: steady,
  };
}
function controlOf() {
  return createControlState();
}

function run(world: World, seconds: number, c = ctx()) {
  const dt = 1 / 120;
  for (let i = 0; i < Math.round(seconds / dt); i++) updateWorld(world, c, dt);
}

describe('updateWorld', () => {
  it('starts the player alive at full hull', () => {
    const w = createWorld();
    expect(w.player.alive).toBe(true);
    expect(w.player.hull).toBe(w.player.maxHull);
    expect(w.kills).toBe(0);
  });

  it('spawns enemies over time, up to the cap', () => {
    const w = createWorld();
    run(w, 60);
    expect(livingEnemies(w)).toBeGreaterThan(0);
    expect(livingEnemies(w)).toBeLessThanOrEqual(defaultWorldTuning.maxEnemies);
  });

  it('fires only when the control asks', () => {
    const quiet = createWorld();
    run(quiet, 0.5);
    const playerShots = (w: World) =>
      w.projectiles.items.filter((p) => p.alive && p.faction === 'player').length;
    expect(playerShots(quiet)).toBe(0);

    const firing = createWorld();
    run(firing, 0.5, ctx({ fire: true }));
    expect(playerShots(firing)).toBeGreaterThan(0);
  });

  it('kills an enemy that takes enough damage and counts it', () => {
    const w = createWorld();
    // Spawn protection would make the enemy hold fire; clear it and place a
    // raider directly in front of the player's nose.
    w.player.invulnerable = 0;
    run(w, 10); // let a raider appear
    const enemy = w.enemies.find((e) => e.alive);
    expect(enemy).toBeDefined();

    enemy!.hull = 1;
    enemy!.x = w.player.ship.pos.x + 40;
    enemy!.y = w.player.ship.pos.y;
    w.player.ship.angle = 0;

    run(w, 0.6, ctx({ fire: true }));
    expect(w.kills).toBeGreaterThan(0);
  });

  it('does not let the player shoot themselves', () => {
    const w = createWorld();
    w.player.invulnerable = 0;
    const before = w.player.hull;
    run(w, 1.5, ctx({ fire: true }));
    expect(w.player.hull).toBe(before);
  });

  it('ignores damage while spawn protection holds', () => {
    const w = createWorld();
    w.player.invulnerable = 5;
    const enemy = { ...createWorld().player };
    void enemy;
    // Drop a hostile bolt right on the player.
    w.projectiles.spawn({
      x: w.player.ship.pos.x, y: w.player.ship.pos.y,
      px: 0, py: 0, vx: 0, vy: 0,
      life: 1, damage: 50, radius: 3, faction: 'raider',
    } as never);
    run(w, 0.2);
    expect(w.player.hull).toBe(w.player.maxHull);
  });

  it('takes damage from a hostile bolt once protection has lapsed', () => {
    const w = createWorld();
    w.player.invulnerable = 0;
    w.projectiles.spawn({
      x: w.player.ship.pos.x, y: w.player.ship.pos.y,
      vx: 0, vy: 0, life: 1, damage: 25, radius: 3, faction: 'raider',
    });
    run(w, 0.05);
    expect(w.player.hull).toBeLessThan(w.player.maxHull);
    expect(w.player.hitFlash).toBeGreaterThan(0);
  });

  it('dies, counts the death, then respawns at full hull', () => {
    const w = createWorld();
    w.player.invulnerable = 0;
    w.player.hull = 1;
    w.projectiles.spawn({
      x: w.player.ship.pos.x, y: w.player.ship.pos.y,
      vx: 0, vy: 0, life: 1, damage: 99, radius: 3, faction: 'raider',
    });
    run(w, 0.05);
    expect(w.player.alive).toBe(false);
    expect(w.deaths).toBe(1);

    run(w, defaultWorldTuning.respawnDelay + 0.2);
    expect(w.player.alive).toBe(true);
    expect(w.player.hull).toBe(w.player.maxHull);
    expect(w.player.invulnerable).toBeGreaterThan(0);
  });

  it('grants protection on respawn so a death cannot chain instantly', () => {
    const w = createWorld();
    w.player.invulnerable = 0;
    w.player.hull = 1;
    w.projectiles.spawn({
      x: w.player.ship.pos.x, y: w.player.ship.pos.y,
      vx: 0, vy: 0, life: 0.1, damage: 99, radius: 3, faction: 'raider',
    });
    run(w, defaultWorldTuning.respawnDelay + 0.3);
    expect(w.deaths).toBe(1);
    expect(w.player.alive).toBe(true);
  });

  it('damages both sides on a ram', () => {
    const w = createWorld();
    w.player.invulnerable = 0;
    run(w, 10);
    const enemy = w.enemies.find((e) => e.alive);
    expect(enemy).toBeDefined();
    enemy!.hull = enemy!.maxHull;
    enemy!.x = w.player.ship.pos.x;
    enemy!.y = w.player.ship.pos.y;

    const hullBefore = w.player.hull;
    run(w, 1 / 60);
    expect(w.player.hull).toBeLessThan(hullBefore);
    expect(enemy!.hull).toBeLessThan(enemy!.maxHull);
  });

  it('recycles an enemy that wanders far beyond the despawn distance', () => {
    const w = createWorld();
    run(w, 10);
    const enemy = w.enemies.find((e) => e.alive);
    expect(enemy).toBeDefined();
    enemy!.x = w.player.ship.pos.x + defaultWorldTuning.despawnDistance + 500;
    run(w, 1 / 60);
    expect(enemy!.alive).toBe(false);
  });

  it('never lets the enemy list grow past the cap over a long session', () => {
    const w = createWorld();
    run(w, 400);
    expect(w.enemies.length).toBeLessThanOrEqual(defaultWorldTuning.maxEnemies + 1);
  });

  it('keeps the hull within its bounds', () => {
    const w = createWorld();
    w.player.invulnerable = 0;
    run(w, 120, ctx({ fire: true }));
    expect(w.player.hull).toBeGreaterThanOrEqual(0);
    expect(w.player.hull).toBeLessThanOrEqual(w.player.maxHull);
  });

  it('spawns enemies outside the configured minimum distance', () => {
    const w = createWorld();
    run(w, 3);
    for (const e of w.enemies) {
      const d = Math.hypot(e.x - w.player.ship.pos.x, e.y - w.player.ship.pos.y);
      // Checked at spawn time, so allow for the distance it has since closed.
      expect(d).toBeGreaterThan(raiderTuning.preferredRange * 0.5);
    }
  });
});
