import { TAU } from '../core/math';
import type { JoystickVisual } from '../input/virtual-joystick';
import type { TouchButtonVisual } from '../input/touch-buttons';

/**
 * The touch controls are drawn on the canvas rather than built from DOM
 * elements. Two reasons: they must never trigger a browser tap highlight or
 * text selection, and they need to animate per frame with the rest of the
 * scene without fighting the compositor.
 */
export function drawJoystick(
  ctx: CanvasRenderingContext2D,
  v: JoystickVisual,
  opacity: number,
): void {
  if (opacity <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineWidth = 2;

  // Outer rim: the full-throttle boundary.
  ctx.beginPath();
  ctx.arc(v.origin.x, v.origin.y, v.radius, 0, TAU);
  ctx.strokeStyle = 'rgba(159, 232, 255, 0.45)';
  ctx.stroke();

  // Dead zone, so the player can see why small nudges do nothing.
  if (v.deadZone > 0) {
    ctx.beginPath();
    ctx.arc(v.origin.x, v.origin.y, v.radius * v.deadZone, 0, TAU);
    ctx.strokeStyle = 'rgba(159, 232, 255, 0.18)';
    ctx.stroke();
  }

  if (v.active) {
    ctx.beginPath();
    ctx.moveTo(v.origin.x, v.origin.y);
    ctx.lineTo(v.knob.x, v.knob.y);
    ctx.strokeStyle = 'rgba(159, 232, 255, 0.3)';
    ctx.stroke();
  }

  // Knob.
  const knobR = v.radius * 0.38;
  const grad = ctx.createRadialGradient(v.knob.x, v.knob.y, 0, v.knob.x, v.knob.y, knobR);
  grad.addColorStop(0, v.active ? 'rgba(190, 243, 255, 0.95)' : 'rgba(159, 232, 255, 0.5)');
  grad.addColorStop(1, 'rgba(60, 120, 160, 0.15)');
  ctx.beginPath();
  ctx.arc(v.knob.x, v.knob.y, knobR, 0, TAU);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(214, 245, 255, 0.7)';
  ctx.stroke();

  ctx.restore();
}

export function drawTouchButtons(
  ctx: CanvasRenderingContext2D,
  buttons: readonly TouchButtonVisual[],
  opacity: number,
): void {
  if (opacity <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';

  for (const b of buttons) {
    ctx.beginPath();
    ctx.arc(b.center.x, b.center.y, b.r, 0, TAU);
    ctx.fillStyle = b.pressed ? 'rgba(255, 181, 97, 0.35)' : 'rgba(159, 232, 255, 0.1)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = b.pressed ? 'rgba(255, 196, 128, 0.9)' : 'rgba(159, 232, 255, 0.45)';
    ctx.stroke();
    ctx.fillStyle = b.pressed ? '#ffd9ab' : 'rgba(200, 236, 255, 0.75)';
    ctx.fillText(b.label, b.center.x, b.center.y);
  }

  ctx.restore();
}
