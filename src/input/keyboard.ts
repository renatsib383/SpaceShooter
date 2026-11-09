import { limit } from '../core/vec2';
import type { ControlState, InputDevice } from './types';

export interface KeyboardBindings {
  up: readonly string[];
  down: readonly string[];
  left: readonly string[];
  right: readonly string[];
  fire: readonly string[];
  boost: readonly string[];
}

export const defaultKeyboardBindings: KeyboardBindings = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  fire: ['Space', 'KeyJ'],
  boost: ['ShiftLeft', 'ShiftRight'],
};

/**
 * Keyboard device. Produces the same 0..1 analogue vector the stick does, so
 * physics never needs to know which one is driving. Diagonals are normalized,
 * otherwise diagonal travel would be 1.41x faster than cardinal.
 */
export function createKeyboard(
  bindings: KeyboardBindings = defaultKeyboardBindings,
): InputDevice {
  const pressed = new Set<string>();

  const any = (codes: readonly string[]): boolean => codes.some((c) => pressed.has(c));

  const onKeyDown = (e: KeyboardEvent): void => {
    pressed.add(e.code);
    // Arrows and space scroll the page otherwise.
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    pressed.delete(e.code);
  };
  // A window that loses focus mid-keypress never delivers the keyup.
  const onBlur = (): void => pressed.clear();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    sample(out: ControlState): void {
      const x = (any(bindings.right) ? 1 : 0) - (any(bindings.left) ? 1 : 0);
      const y = (any(bindings.down) ? 1 : 0) - (any(bindings.up) ? 1 : 0);
      if (any(bindings.fire)) out.fire = true;
      if (any(bindings.boost)) out.boost = true;
      if (x === 0 && y === 0) return;
      out.move.x = x;
      out.move.y = y;
      limit(out.move, 1);
      out.moving = true;
      out.source = 'keyboard';
    },
    dispose(): void {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
