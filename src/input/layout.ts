import type { JoystickConfig } from './virtual-joystick';
import type { TouchButtonSpec } from './touch-buttons';

export type Handedness = 'left' | 'right';

export type ButtonPlacement =
  /** Action buttons sit on the half opposite the stick. */
  | 'side'
  /** Action buttons stack in the middle, reachable by either thumb. */
  | 'center';

/**
 * Canonical layout, expressed left-handed: stick on the left half, actions on
 * the right. The mirrored layout is derived from these rather than flipped in
 * place, so applying a handedness twice is idempotent instead of flip-flopping.
 */
const CANON = {
  /** Stick anchor as a fraction of its own zone. */
  stickAnchorX: 0.34,
  /** Button centres as fractions of the viewport, per placement. */
  side: {
    fire: { cx: 0.86, cy: 0.74 },
    boost: { cx: 0.7, cy: 0.86 },
  },
  center: {
    // Kept off the very bottom: that band is the home indicator on most
    // phones, and a thumb resting there triggers system gestures.
    fire: { cx: 0.5, cy: 0.83 },
    boost: { cx: 0.5, cy: 0.64 },
  },
} satisfies {
  stickAnchorX: number;
  side: Record<TouchButtonSpec['id'], { cx: number; cy: number }>;
  center: Record<TouchButtonSpec['id'], { cx: number; cy: number }>;
};

type PlaceableButton = Pick<TouchButtonSpec, 'id'> & { cx: number; cy: number };

/**
 * Point the touch layout at one thumb or the other, and choose where the
 * action buttons live.
 *
 * With 'side', the stick and the buttons always swap together: moving only the
 * stick would drop it on top of FIRE.
 *
 * With 'center', the buttons deliberately sit inside the stick's half. That is
 * safe only because the buttons claim their pointer in the capture phase and
 * stop propagation, so a press on one is never also read as a steer — see
 * createTouchButtons.
 */
export function applyTouchLayout(
  hand: Handedness,
  placement: ButtonPlacement,
  stick: JoystickConfig,
  // Readonly array: the entries are mutated in place, the list itself is not.
  buttons: ReadonlyArray<PlaceableButton>,
): void {
  const mirrored = hand === 'right';

  stick.zone.x = mirrored ? 0.5 : 0;
  stick.zone.w = 0.5;
  stick.anchor.x = mirrored ? 1 - CANON.stickAnchorX : CANON.stickAnchorX;

  for (const button of buttons) {
    const canonical = CANON[placement][button.id];
    button.cx = placement === 'center' || !mirrored ? canonical.cx : 1 - canonical.cx;
    button.cy = canonical.cy;
  }
}
