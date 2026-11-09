import type { ControlState } from '../input/types';
import type { Ship } from '../game/ship';
import { speedOf, type ShipTuning } from '../game/ship';
import { ui } from '../ui/strings';

export interface DebugInfo {
  fps: number;
  zoom: number;
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
  const { control, ship, tuning, fps, zoom } = info;
  const magnitude = Math.hypot(control.move.x, control.move.y);
  const d = ui.debug;
  // Labels are padded to the widest one so the column of values stays aligned
  // whatever language the labels are in.
  const width = Math.max(
    ...[d.scheme, d.source, d.stick, d.speed, d.zoom, d.heading, d.throttle, d.fps]
      .map((label) => label.length),
  );
  const row = (label: string, value: string): string => `${label.padEnd(width)}  ${value}`;

  const lines = [
    row(d.fps, fps.toFixed(0)),
    row(d.scheme, ui.scheme[tuning.scheme]),
    row(d.source, ui.source[control.source]),
    row(
      d.stick,
      `${control.move.x.toFixed(2)}, ${control.move.y.toFixed(2)}  |${magnitude.toFixed(2)}|`,
    ),
    row(d.speed, `${speedOf(ship).toFixed(0)} / ${tuning.maxSpeed} px/s`),
    row(d.zoom, ui.units.times(zoom)),
    row(d.heading, ui.units.degrees((ship.angle * 180) / Math.PI)),
    row(
      d.throttle,
      `${ship.throttle.toFixed(2)}${control.boost ? '  ' + d.boostOn : ''}${control.fire ? '  ' + d.fireOn : ''}`,
    ),
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
