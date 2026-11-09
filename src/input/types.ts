import type { Vec2 } from '../core/vec2';

export type InputSource = 'none' | 'keyboard' | 'touch' | 'gamepad';

/**
 * Device-independent control intent for one simulation step.
 * Everything downstream (ship physics, UI) reads only this.
 */
export interface ControlState {
  /** Desired movement direction; length 0..1 encodes throttle. */
  move: Vec2;
  /** True while `move` carries a deliberate input (past the dead zone). */
  moving: boolean;
  /** Desired aim direction (unit length), or null when nothing is aiming. */
  aim: Vec2 | null;
  fire: boolean;
  boost: boolean;
  /** Which device produced `move` this step. */
  source: InputSource;
}

export function createControlState(): ControlState {
  return {
    move: { x: 0, y: 0 },
    moving: false,
    aim: null,
    fire: false,
    boost: false,
    source: 'none',
  };
}

export interface InputDevice {
  /** Fold this device's current readings into `out`. Later devices win ties. */
  sample(out: ControlState): void;
  dispose(): void;
}
