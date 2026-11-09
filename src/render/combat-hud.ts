import { TAU } from '../core/math';
import type { World } from '../game/world';

/**
 * Combat HUD: hull, kills, and death state.
 *
 * Anchored to the top-left under the safe-area inset and kept clear of the
 * touch controls, which own the bottom of the screen.
 */
export function drawCombatHud(
  ctx: CanvasRenderingContext2D,
  world: World,
  width: number,
  height: number,
  debugOffset: number,
): void {
  const { player } = world;
  const x = 14;
  const y = debugOffset;

  const barW = Math.min(170, width * 0.42);
  const barH = 8;
  const frac = Math.max(0, player.hull / player.maxHull);

  ctx.save();
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textBaseline = 'top';

  ctx.fillStyle = 'rgba(190, 232, 255, 0.75)';
  ctx.fillText('HULL', x, y);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(x + 36, y, barW, barH);
  ctx.fillStyle = frac > 0.5 ? '#7fe3a0' : frac > 0.22 ? '#ffb561' : '#ff6b6b';
  ctx.fillRect(x + 36, y, barW * frac, barH);

  // Spawn protection: a ring of remaining time beats a word.
  if (player.invulnerable > 0 && player.alive) {
    ctx.strokeStyle = 'rgba(159, 232, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 36 + barW + 14, y + barH / 2, 6, 0, TAU * Math.min(1, player.invulnerable / 2.5));
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(190, 232, 255, 0.75)';
  ctx.fillText(`KILLS ${world.kills}`, x, y + 16);

  ctx.restore();

  if (!player.alive) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 107, 107, 0.9)';
    ctx.font = '600 22px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('HULL BREACH', width / 2, height * 0.38);
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = 'rgba(255, 190, 190, 0.8)';
    ctx.fillText(
      `respawning in ${Math.max(0, player.respawnIn).toFixed(1)}s`,
      width / 2,
      height * 0.38 + 24,
    );
    ctx.restore();
  }
}

/** Red vignette pulse when the hull is hit. */
export function drawDamageFlash(
  ctx: CanvasRenderingContext2D,
  intensity: number,
  width: number,
  height: number,
): void {
  if (intensity <= 0.01) return;
  const grad = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.25,
    width / 2, height / 2, Math.max(width, height) * 0.62,
  );
  grad.addColorStop(0, 'rgba(255, 40, 40, 0)');
  grad.addColorStop(1, `rgba(255, 40, 40, ${0.45 * intensity})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}
