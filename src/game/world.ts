import { createShip, updateShip, type Ship, type ShipTuning } from './ship';
import { createEnemy, raiderTuning, updateEnemy, type Enemy, type EnemyTuning } from './enemies';
import { bodiesOverlap, projectileHits, type Collidable } from './collision';
import { createParticles, type ParticleSystem } from './particles';
import { createProjectilePool, type ProjectilePool } from './projectiles';
import { createWeapon, playerWeapon, updateWeapon, type WeaponState } from './weapon';
import type { ControlState } from '../input/types';
import type { Faction } from './faction';

export interface Player {
  ship: Ship;
  hull: number;
  maxHull: number;
  radius: number;
  faction: Faction;
  alive: boolean;
  weapon: WeaponState;
  /** Seconds of spawn protection remaining. */
  invulnerable: number;
  /** Seconds until respawn; only counts while dead. */
  respawnIn: number;
  /** Decays after a hit; drives the damage flash. */
  hitFlash: number;
}

export interface WorldTuning {
  playerHull: number;
  respawnDelay: number;
  invulnerableTime: number;
  /** Seconds between spawn attempts. */
  spawnInterval: number;
  maxEnemies: number;
  /** Enemies appear this far from the player, px. */
  spawnDistanceMin: number;
  spawnDistanceMax: number;
  /** Beyond this an enemy is recycled rather than chased forever, px. */
  despawnDistance: number;
}

export const defaultWorldTuning: WorldTuning = {
  playerHull: 100,
  respawnDelay: 2,
  invulnerableTime: 2.5,
  spawnInterval: 2.6,
  maxEnemies: 7,
  spawnDistanceMin: 520,
  spawnDistanceMax: 900,
  despawnDistance: 2400,
};

export interface World {
  player: Player;
  enemies: Enemy[];
  projectiles: ProjectilePool;
  particles: ParticleSystem;
  kills: number;
  deaths: number;
  /** Seconds until the next spawn attempt. */
  spawnTimer: number;
}

export function createWorld(t: WorldTuning = defaultWorldTuning): World {
  return {
    player: {
      ship: createShip(0, 0),
      hull: t.playerHull,
      maxHull: t.playerHull,
      radius: 13,
      faction: 'player',
      alive: true,
      weapon: createWeapon(),
      invulnerable: t.invulnerableTime,
      respawnIn: 0,
      hitFlash: 0,
    },
    enemies: [],
    projectiles: createProjectilePool(),
    particles: createParticles(),
    kills: 0,
    deaths: 0,
    spawnTimer: t.spawnInterval,
  };
}

// Reused views, so collision and firing never allocate during play.
const shooterView = {
  x: 0, y: 0, vx: 0, vy: 0, angle: 0,
  faction: 'player' as Faction, muzzleOffset: 0,
};
const playerView: Collidable = { x: 0, y: 0, radius: 0, faction: 'player', alive: true };
const enemyView: Collidable = { x: 0, y: 0, radius: 0, faction: 'raider', alive: true };

function syncPlayerView(p: Player): Collidable {
  playerView.x = p.ship.pos.x;
  playerView.y = p.ship.pos.y;
  playerView.radius = p.radius;
  // Spawn protection is expressed as "not a target", so one flag covers
  // projectiles and ramming alike.
  playerView.alive = p.alive && p.invulnerable <= 0;
  return playerView;
}

function syncEnemyView(e: Enemy): Collidable {
  enemyView.x = e.x;
  enemyView.y = e.y;
  enemyView.radius = e.radius;
  enemyView.alive = e.alive;
  return enemyView;
}

function damagePlayer(world: World, amount: number, t: WorldTuning): void {
  const p = world.player;
  if (!p.alive || p.invulnerable > 0) return;
  p.hull -= amount;
  p.hitFlash = 1;
  if (p.hull > 0) return;

  p.hull = 0;
  p.alive = false;
  p.respawnIn = t.respawnDelay;
  world.deaths++;
  world.particles.burst(p.ship.pos.x, p.ship.pos.y, 34, 260, 0);
}

function killEnemy(world: World, enemy: Enemy): void {
  enemy.alive = false;
  world.kills++;
  world.particles.burst(enemy.x, enemy.y, 22, 210, 0);
}

function spawnEnemy(world: World, t: WorldTuning, random: () => number): void {
  const angle = random() * Math.PI * 2;
  const distance = t.spawnDistanceMin + random() * (t.spawnDistanceMax - t.spawnDistanceMin);
  const { pos } = world.player.ship;

  // Reuse a dead slot before growing the list; enemy count is small, but this
  // keeps the array from creeping upward over a long session.
  const recycled = world.enemies.find((e) => !e.alive);
  const spawned = createEnemy(
    pos.x + Math.cos(angle) * distance,
    pos.y + Math.sin(angle) * distance,
    raiderTuning,
  );
  if (recycled) Object.assign(recycled, spawned);
  else world.enemies.push(spawned);
}

export interface WorldUpdateContext {
  control: ControlState;
  shipTuning: ShipTuning;
  worldTuning?: WorldTuning;
  enemyTuning?: EnemyTuning;
  random?: () => number;
}

/** Advance the whole simulation by one fixed step. */
export function updateWorld(world: World, ctx: WorldUpdateContext, dt: number): void {
  const t = ctx.worldTuning ?? defaultWorldTuning;
  const et = ctx.enemyTuning ?? raiderTuning;
  const random = ctx.random ?? Math.random;
  const p = world.player;

  p.invulnerable = Math.max(0, p.invulnerable - dt);
  p.hitFlash = Math.max(0, p.hitFlash - dt * 3);

  if (p.alive) {
    updateShip(p.ship, ctx.control, ctx.shipTuning, dt);
    shooterView.x = p.ship.pos.x;
    shooterView.y = p.ship.pos.y;
    shooterView.vx = p.ship.vel.x;
    shooterView.vy = p.ship.vel.y;
    shooterView.angle = p.ship.angle;
    shooterView.faction = p.faction;
    shooterView.muzzleOffset = p.radius + 4;

    updateWeapon(
      p.weapon, playerWeapon, shooterView,
      ctx.control.fire, world.projectiles, dt, random,
    );

    // updateWeapon writes recoil into the shooter it was handed, so copy the
    // velocity back; without this the recoil lands on a throwaway object.
    p.ship.vel.x = shooterView.vx;
    p.ship.vel.y = shooterView.vy;
  } else {
    p.respawnIn -= dt;
    // Keep drifting while dead so the camera does not stop dead.
    p.ship.prevPos.x = p.ship.pos.x;
    p.ship.prevPos.y = p.ship.pos.y;
    p.ship.pos.x += p.ship.vel.x * dt;
    p.ship.pos.y += p.ship.vel.y * dt;
    if (p.respawnIn <= 0) respawn(world, t);
  }

  const target = { x: p.ship.pos.x, y: p.ship.pos.y, alive: p.alive && p.invulnerable <= 0 };
  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;
    updateEnemy(enemy, target, et, world.projectiles, dt, random);

    const dx = enemy.x - p.ship.pos.x;
    const dy = enemy.y - p.ship.pos.y;
    if (Math.hypot(dx, dy) > t.despawnDistance) enemy.alive = false;
  }

  world.projectiles.update(dt);
  world.particles.update(dt);
  resolveHits(world, t, et);

  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0) {
    world.spawnTimer = t.spawnInterval;
    const living = world.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
    if (living < t.maxEnemies) spawnEnemy(world, t, random);
  }
}

function resolveHits(world: World, t: WorldTuning, et: EnemyTuning): void {
  const p = world.player;

  for (const proj of world.projectiles.items) {
    if (!proj.alive) continue;

    if (proj.faction !== 'player') {
      if (projectileHits(proj, syncPlayerView(p))) {
        proj.alive = false;
        world.particles.burst(proj.x, proj.y, 5, 120, 1);
        damagePlayer(world, proj.damage, t);
        continue;
      }
    }

    for (const enemy of world.enemies) {
      if (!enemy.alive) continue;
      if (!projectileHits(proj, syncEnemyView(enemy))) continue;
      proj.alive = false;
      world.particles.burst(proj.x, proj.y, 5, 140, 1);
      enemy.hull -= proj.damage;
      if (enemy.hull <= 0) killEnemy(world, enemy);
      break;
    }
  }

  // Ramming: both sides take it, so flying into a raider is a trade and not a
  // free way to clear the screen.
  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;
    if (!bodiesOverlap(syncEnemyView(enemy), syncPlayerView(p))) continue;
    damagePlayer(world, et.ramDamage, t);
    enemy.hull -= et.ramDamage;
    if (enemy.hull <= 0) killEnemy(world, enemy);
  }
}

function respawn(world: World, t: WorldTuning): void {
  const p = world.player;
  p.alive = true;
  p.hull = p.maxHull;
  p.invulnerable = t.invulnerableTime;
  p.respawnIn = 0;
  p.ship.vel.x = 0;
  p.ship.vel.y = 0;
  p.ship.throttle = 0;
}

/** Number of enemies currently drawing breath. */
export function livingEnemies(world: World): number {
  let n = 0;
  for (const e of world.enemies) if (e.alive) n++;
  return n;
}
