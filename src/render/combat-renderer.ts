import { TAU, angleDelta } from '../core/math';
import type { Enemy } from '../game/enemies';
import type { Particle } from '../game/particles';
import type { Projectile } from '../game/projectiles';
import { worldToScreenX, worldToScreenY, type ViewTransform } from './view-transform';

/**
 * Projectiles are drawn as a short streak along their own velocity rather than
 * as a dot. A dot moving 7 px per step reads as a flicker; a streak reads as a
 * bolt and makes direction obvious at a glance.
 */
export function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  items: readonly Projectile[],
  alpha: number,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  for (const p of items) {
    if (!p.alive) continue;
    const x = p.px + (p.x - p.px) * alpha;
    const y = p.py + (p.y - p.py) * alpha;
    const speed = Math.hypot(p.vx, p.vy) || 1;
    const streak = Math.min(18, speed * 0.016);
    const tailX = x - (p.vx / speed) * streak;
    const tailY = y - (p.vy / speed) * streak;

    const friendly = p.faction === 'player';
    ctx.strokeStyle = friendly ? 'rgba(170, 240, 255, 0.95)' : 'rgba(255, 150, 110, 0.95)';
    ctx.lineWidth = p.radius;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.fillStyle = friendly ? '#eafbff' : '#ffe0cf';
    ctx.beginPath();
    ctx.arc(x, y, p.radius * 0.55, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Raider hull: an angular, inward-notched silhouette, deliberately unlike the
 * player's clean dart so the two are never confused mid-fight.
 */
export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: readonly Enemy[],
  alpha: number,
): void {
  for (const e of enemies) {
    if (!e.alive) continue;
    const x = e.px + (e.x - e.px) * alpha;
    const y = e.py + (e.y - e.py) * alpha;
    const angle = e.pangle + angleDelta(e.pangle, e.angle) * alpha;
    const s = e.radius;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(s * 1.05, 0);
    ctx.lineTo(-s * 0.3, s * 0.85);
    ctx.lineTo(-s * 0.75, s * 0.3);
    ctx.lineTo(-s * 0.45, 0);
    ctx.lineTo(-s * 0.75, -s * 0.3);
    ctx.lineTo(-s * 0.3, -s * 0.85);
    ctx.closePath();
    ctx.fillStyle = 'rgba(62, 26, 34, 0.92)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff8f6b';
    ctx.stroke();
    ctx.restore();

    // Damage bar, shown only once hurt so a clean screen stays clean.
    if (e.hull < e.maxHull) {
      const w = s * 2;
      const frac = Math.max(0, e.hull / e.maxHull);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x - w / 2, y - s - 10, w, 3);
      ctx.fillStyle = frac > 0.4 ? '#ffb561' : '#ff6b6b';
      ctx.fillRect(x - w / 2, y - s - 10, w * frac, 3);
    }
  }
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  items: readonly Particle[],
): void {
  ctx.save();
  for (const p of items) {
    if (!p.alive) continue;
    const fade = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = fade;
    ctx.fillStyle = p.hue > 0.5
      ? 'rgba(200, 240, 255, 1)'
      : `rgba(255, ${Math.round(120 + 110 * fade)}, 70, 1)`;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}

/**
 * Off-screen enemy markers.
 *
 * With inertia and a wide view, the thing shooting you is often outside the
 * viewport; without a marker the only feedback is the hull dropping, which
 * reads as unfair rather than hard.
 */
export function drawThreatMarkers(
  ctx: CanvasRenderingContext2D,
  enemies: readonly Enemy[],
  v: ViewTransform,
): void {
  const { width, height } = v;
  const cx = width / 2;
  const cy = height / 2;
  const margin = 26;

  ctx.save();
  for (const e of enemies) {
    if (!e.alive) continue;
    // Projected through the camera zoom: at a bare subtraction, pulling back
    // would keep flagging raiders that are now plainly visible on screen.
    const sx = worldToScreenX(v, e.x);
    const sy = worldToScreenY(v, e.y);
    if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) continue;

    const angle = Math.atan2(sy - cy, sx - cx);
    // Project onto the viewport edge, inset so the marker is fully visible.
    const halfW = cx - margin;
    const halfH = cy - margin;
    const scale = Math.min(
      Math.abs(halfW / Math.cos(angle)) || Infinity,
      Math.abs(halfH / Math.sin(angle)) || Infinity,
    );
    const mx = cx + Math.cos(angle) * scale;
    const my = cy + Math.sin(angle) * scale;

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, 5);
    ctx.lineTo(-5, -5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 143, 107, 0.85)';
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
