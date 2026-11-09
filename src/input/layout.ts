import type { JoystickConfig } from './virtual-joystick';
import type { TouchButtonSpec } from './touch-buttons';

export type Handedness = 'left' | 'right';

/**
 * Canonical layout, expressed left-handed: stick on the left half, actions on
 * the right. The mirrored layout is derived from these rather than flipped in
 * place, so applying a handedness twice is idempotent instead of flip-flopping.
 */
const CANON = {
  /** Stick anchor as a fraction of its own zone. */
  stickAnchorX: 0.34,
  /** Action button centres as fractions of the viewport. */
  buttons: { fire: 0.86, boost: 0.7 } as Record<TouchButtonSpec['id'], number>,
};

/**
 * Point the touch layout at one thumb or the other.
 *
 * The stick takes half the screen and the action buttons take the other half,
 * so the two always move together: moving only the stick would drop it on top
 * of FIRE.
 */
export function applyHandedness(
  hand: Handedness,
  stick: JoystickConfig,
  // Readonly array: the entries are mutated in place, the list itself is not.
  buttons: ReadonlyArray<Pick<TouchButtonSpec, 'id'> & { cx: number }>,
): void {
  const mirrored = hand === 'right';

  stick.zone.x = mirrored ? 0.5 : 0;
  stick.zone.w = 0.5;
  stick.anchor.x = mirrored ? 1 - CANON.stickAnchorX : CANON.stickAnchorX;

  for (const button of buttons) {
    const canonical = CANON.buttons[button.id];
    button.cx = mirrored ? 1 - canonical : canonical;
  }
}
