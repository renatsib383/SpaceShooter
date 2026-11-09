import { clamp } from '../core/math';
import type { ControlState, InputDevice } from './types';

export interface GamepadOptions {
  /** Radial dead zone on the analogue sticks, 0..1. Default 0.18. */
  deadZone?: number;
}

/**
 * Standard-mapping gamepad. Polled rather than event-driven, because that is
 * all the Gamepad API offers.
 *
 * Dead zone is applied radially to the whole vector, not per axis: per-axis
 * dead zones carve a square hole out of the middle and make slow diagonal
 * movement impossible.
 */
export function createGamepadDevice(options: GamepadOptions = {}): InputDevice {
  const deadZone = options.deadZone ?? 0.18;

  const firstConnected = (): Gamepad | null => {
    if (typeof navigator.getGamepads !== 'function') return null;
    for (const pad of navigator.getGamepads()) {
      if (pad && pad.connected) return pad;
    }
    return null;
  };

  const radial = (x: number, y: number): { x: number; y: number; m: number } => {
    const len = Math.hypot(x, y);
    if (len <= deadZone) return { x: 0, y: 0, m: 0 };
    const m = clamp((len - deadZone) / (1 - deadZone), 0, 1);
    return { x: (x / len) * m, y: (y / len) * m, m };
  };

  return {
    sample(out: ControlState): void {
      const pad = firstConnected();
      if (!pad) return;

      const move = radial(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      if (move.m > 0) {
        out.move.x = move.x;
        out.move.y = move.y;
        out.moving = true;
        out.source = 'gamepad';
      }

      const aim = radial(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
      if (aim.m > 0) out.aim = { x: aim.x / aim.m, y: aim.y / aim.m };

      // Standard mapping: 0 = south face button, 7 = right trigger, 6 = left trigger.
      if (pad.buttons[0]?.pressed || pad.buttons[7]?.pressed) out.fire = true;
      if (pad.buttons[6]?.pressed) out.boost = true;
      // 1 = east face button, 4 = left shoulder.
      if (pad.buttons[1]?.pressed || pad.buttons[4]?.pressed) out.brake = true;
    },
    dispose(): void {
      /* polled; nothing to unbind */
    },
  };
}
