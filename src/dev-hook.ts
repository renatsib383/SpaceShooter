import type { Camera } from './game/camera';
import type { Ship } from './game/ship';
import type { InputManager } from './input/input-manager';
import type { VirtualJoystick } from './input/virtual-joystick';
import type { TunableSettings } from './ui/tuning-panel';

/**
 * Handle for end-to-end tests and for poking at the simulation from the
 * console while tuning. Only installed by the dev server, so the production
 * bundle keeps the global namespace clean.
 */
export interface SandboxHandle {
  ship: Ship;
  camera: Camera;
  input: InputManager;
  joystick: VirtualJoystick;
  settings: TunableSettings;
}

declare global {
  interface Window {
    __sandbox?: SandboxHandle;
  }
}

export function installDevHook(handle: SandboxHandle): void {
  if (!import.meta.env.DEV) return;
  window.__sandbox = handle;
}
