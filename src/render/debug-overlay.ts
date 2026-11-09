import type { ControlState } from '../input/types';
import type { Ship } from '../game/ship';
import { speedOf, type ShipTuning } from '../game/ship';

export interface DebugInfo {
  fps: number;
  control: ControlState;
  ship: Ship;
  tuning: ShipTuning;
}

/** Live readout of exactly what the input layer produced, for tuning by feel. */
export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  info: DebugInfo,
  x = 14,
  y = 18,
): void {
  const { control, ship, tuning, fps } = info;
  const magnitude = Math.hypot(control.move.x, control.move.y);
  const lines = [
    `${fps.toFixed(0)} fps`,
    `scheme   ${tuning.scheme}`,
    `source   ${control.source}`,
    `stick    ${control.move.x.toFixed(2)}, ${control.move.y.toFixed(2)}  |${magnitude.toFixed(2)}|`,
    `speed    ${speedOf(ship).toFixed(0)} / ${tuning.maxSpeed} px/s`,
    `heading  ${((ship.angle * 180) / Math.PI).toFixed(0)}deg`,
    `throttle ${ship.throttle.toFixed(2)}${control.boost ? '  BOOST' : ''}${control.fire ? '  FIRE' : ''}`,
  ];

  ctx.save();
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textBaseline = 'top';
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20;
  ctx.fillStyle = 'rgba(6, 14, 24, 0.6)';
  ctx.fillRect(x - 10, y - 8, w, lines.length * 16 + 14);
  ctx.fillStyle = 'rgba(190, 232, 255, 0.9)';
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * 16));
  ctx.restore();
}
