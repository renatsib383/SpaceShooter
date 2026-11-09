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

/**
 * Default resting height per stick side, as a fraction of the viewport.
 *
 * A centred stick rests lower than a side one. A side stick sits under a thumb
 * that is already curled around the edge of the phone; a centred stick has to
 * be reached across the palm, which only works near the bottom — and drawn any
 * higher it covers the ship the player is watching.
 */
export const DEFAULT_REST_HEIGHTS: Record<StickSide, number> = {
  left: 0.74,
  center: 0.86,
  right: 0.74,
};

type ButtonSpot = { cx: number; cy: number };

/**
 * Button positions per placement, written for the canonical case and mirrored
 * when the stick would collide. Deriving both sides from one set keeps a
 * repeated application idempotent instead of flip-flopping.
 */
const BUTTONS: Record<ButtonPlacement, Record<TouchButtonSpec['id'], ButtonSpot>> = {
  // Canonical: stick left, actions spread over the right half.
  side: {
    fire: { cx: 0.86, cy: 0.74 },
    brake: { cx: 0.86, cy: 0.52 },
    boost: { cx: 0.7, cy: 0.86 },
  },
  // Kept off the very bottom: that band is the home indicator on most phones,
  // and a thumb resting there triggers system gestures.
  center: {
    fire: { cx: 0.5, cy: 0.84 },
    brake: { cx: 0.5, cy: 0.68 },
    boost: { cx: 0.5, cy: 0.52 },
  },
  // Canonical column hugs the LEFT edge, for a stick that is centred or right.
  // FIRE lowest, where the thumb rests; BRAKE next, since it is held often.
  column: {
    fire: { cx: 0.15, cy: 0.82 },
    brake: { cx: 0.15, cy: 0.655 },
    boost: { cx: 0.15, cy: 0.49 },
  },
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
  /**
   * Resting height per stick side. Held per side rather than as one number so
   * that moving the stick to the centre drops it to where a centred stick
   * belongs, without discarding the height tuned for a side stick.
   */
  restHeights: Record<StickSide, number> = DEFAULT_REST_HEIGHTS,
): void {
  const zone = STICK_ZONES[stickSide];
  stick.zone.x = zone.x;
  stick.zone.w = zone.w;
  stick.anchor.x = zone.anchorX;
  stick.anchor.y = restHeights[stickSide];

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
