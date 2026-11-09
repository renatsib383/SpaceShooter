import { angleDelta } from '../core/math';
import type { Ship } from '../game/ship';

/**
 * The hull is drawn from a handful of line segments rather than a sprite: no
 * assets to load, it stays crisp at any DPR, and the silhouette is trivial to
 * restyle per faction later by swapping two colours.
 */
export interface HullStyle {
  stroke: string;
  fill: string;
  plume: string;
  /** Hull length in px, nose to tail. */
  size: number;
}

export const playerHull: HullStyle = {
  stroke: '#9fe8ff',
  fill: 'rgba(28, 54, 78, 0.9)',
  plume: '#ffb561',
  size: 26,
};

export function drawShip(
  ctx: CanvasRenderingContext2D,
  ship: Ship,
  style: HullStyle,
  alpha: number,
  time: number,
): void {
  // Interpolate between the last two simulation steps so a 120 Hz sim rendered
  // at 60 Hz (or a 60 Hz sim at 144 Hz) shows no stepping.
  const x = ship.prevPos.x + (ship.pos.x - ship.prevPos.x) * alpha;
  const y = ship.prevPos.y + (ship.pos.y - ship.prevPos.y) * alpha;
  const angle = ship.prevAngle + angleDelta(ship.prevAngle, ship.angle) * alpha;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const s = style.size;

  if (ship.throttle > 0.01) {
    // Exhaust: length tracks throttle, with a small flicker so it reads as fire.
    const flicker = 0.78 + 0.22 * Math.sin(time * 42);
    const len = s * (0.5 + 1.25 * ship.throttle) * flicker;
    const grad = ctx.createLinearGradient(-s * 0.5, 0, -s * 0.5 - len, 0);
    grad.addColorStop(0, style.plume);
    grad.addColorStop(1, 'rgba(255, 110, 40, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-s * 0.48, -s * 0.2);
    ctx.lineTo(-s * 0.48 - len, 0);
    ctx.lineTo(-s * 0.48, s * 0.2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.beginPath();
  ctx.moveTo(s * 0.6, 0);
  ctx.lineTo(-s * 0.4, s * 0.42);
  ctx.lineTo(-s * 0.2, 0);
  ctx.lineTo(-s * 0.4, -s * 0.42);
  ctx.closePath();
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = style.stroke;
  ctx.stroke();

  ctx.restore();
}
