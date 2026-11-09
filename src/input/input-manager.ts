import { createControlState, type ControlState, type InputDevice } from './types';

export interface InputManager {
  /** Re-read every device. Call once per simulation step. */
  poll(): ControlState;
  readonly state: ControlState;
  dispose(): void;
}

/**
 * Merges several devices into one ControlState.
 *
 * Devices are sampled in order and only write when they have real input, so a
 * plugged-in gamepad resting at center never overrides the keyboard, and the
 * player can switch devices mid-game without any mode toggle.
 */
export function createInputManager(devices: readonly InputDevice[]): InputManager {
  const state = createControlState();

  return {
    state,
    poll(): ControlState {
      state.move.x = 0;
      state.move.y = 0;
      state.moving = false;
      state.aim = null;
      state.fire = false;
      state.boost = false;
      state.brake = false;
      state.source = 'none';
      for (const device of devices) device.sample(state);
      return state;
    },
    dispose(): void {
      for (const device of devices) device.dispose();
    },
  };
}
