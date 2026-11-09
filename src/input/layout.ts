import type { JoystickConfig } from './virtual-joystick';
import type { TouchButtonSpec } from './touch-buttons';

/** Which part of the screen the movement stick claims. */
export type StickSide = 'left' | 'center' | 'right';

export type ButtonPlacement =
  /** Action buttons spread across the half opposite the stick. */
  | 'side'
  /** Action buttons stacked on the horizontal centre. */
  | 'center'
  /** Action buttons in a vertical column hugging one edge. */
  | 'column';

/**
 * Stick zones, as fractions of the viewport. `anchorX` is the resting position
 * within the zone, not within the screen.
 */
const STICK_ZONES: Record<StickSide, { x: number; w: number; anchorX: number }> = {
  left: { x: 0, w: 0.5, anchorX: 0.34 },
  center: { x: 0.25, w: 0.5, anchorX: 0.5 },
  right: { x: 0.5, w: 0.5, anchorX: 0.66 },
};

type ButtonSpot = { cx: number; cy: number };

/**
 * Button positions per placement, written for the canonical case and mirrored
 * when the stick would collide. Deriving both sides from one set keeps a
 * repeated application idempotent instead of flip-flopping.
 */
const BUTTONS: Record<ButtonPlacement, Record<TouchButtonSpec['id'], ButtonSpot>> = {
  // Canonical: stick left, actions spread over the right half.
  side: { fire: { cx: 0.86, cy: 0.74 }, boost: { cx: 0.7, cy: 0.86 } },
  // Kept off the very bottom: that band is the home indicator on most phones,
  // and a thumb resting there triggers system gestures.
  center: { fire: { cx: 0.5, cy: 0.83 }, boost: { cx: 0.5, cy: 0.64 } },
  // Canonical column hugs the LEFT edge, for a stick that is centred or right.
  column: { fire: { cx: 0.15, cy: 0.78 }, boost: { cx: 0.15, cy: 0.6 } },
};

type PlaceableButton = Pick<TouchButtonSpec, 'id'> & { cx: number; cy: number };

/**
 * Lay out the touch controls.
 *
 * 'side' and 'column' always keep the buttons clear of the stick's zone, so
 * the two never fight over a touch.
 *
 * 'center' deliberately puts the buttons inside the stick's zone. That is safe
 * only because the buttons claim their pointer in the capture phase and stop
 * propagation, so a press on one is never also read as a steer — see
 * createTouchButtons.
 */
export function applyTouchLayout(
  stickSide: StickSide,
  placement: ButtonPlacement,
  stick: JoystickConfig,
  // Readonly array: the entries are mutated in place, the list itself is not.
  buttons: ReadonlyArray<PlaceableButton>,
): void {
  const zone = STICK_ZONES[stickSide];
  stick.zone.x = zone.x;
  stick.zone.w = zone.w;
  stick.anchor.x = zone.anchorX;

  // 'side' is written for a left stick, 'column' for a centre or right one;
  // each mirrors in the case the stick would otherwise sit on top of it.
  const mirrored =
    placement === 'side' ? stickSide !== 'left'
    : placement === 'column' ? stickSide === 'left'
    : false;

  for (const button of buttons) {
    const spot = BUTTONS[placement][button.id];
    button.cx = mirrored ? 1 - spot.cx : spot.cx;
    button.cy = spot.cy;
  }
}
