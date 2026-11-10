import { ui } from '../ui/strings';
import type { Vec2 } from '../core/vec2';
import type { ControlState, InputDevice } from './types';

export type ActionId = 'fire' | 'fireBrake' | 'boost';

export interface TouchButtonSpec {
  id: ActionId;
  /** Label; a newline splits it across two lines. */
  label: string;
  /** Horizontal centre as a fraction of the viewport. */
  cx: number;
  /**
   * Distance from the bottom edge, in reference pixels. Anchored to the
   * bottom rather than given as a fraction of height: thumbs reach up from
   * the bottom edge, and a fraction puts the column in a different physical
   * place on a tall phone than on a short landscape screen.
   */
  bottom: number;
  /** Radius in reference pixels. */
  r: number;
}

/**
 * How far the column reaches above the bottom edge at full size: the topmost
 * button's offset plus its radius. Derived from the specs rather than written
 * down, so moving a button cannot silently invalidate the fit.
 */
export function columnExtent(specs: readonly TouchButtonSpec[]): number {
  return specs.reduce((max, s) => Math.max(max, s.bottom + s.r), 0);
}

/** Breathing room between the top button and the HUD above it. */
const TOP_MARGIN = 10;

/**
 * Smallest acceptable scale. Below this the buttons stop being thumb targets,
 * so the column is allowed to crowd the HUD instead of shrinking further.
 */
const MIN_SCALE = 0.55;

export const defaultTouchButtons: readonly TouchButtonSpec[] = [
  { id: 'fire', label: ui.buttons.fire, cx: 0.86, bottom: 100, r: 42 },
  { id: 'fireBrake', label: ui.buttons.fireBrake, cx: 0.86, bottom: 184, r: 38 },
  { id: 'boost', label: ui.buttons.boost, cx: 0.86, bottom: 276, r: 32 },
];

/**
 * How much to shrink the controls so the column fits the space it has.
 *
 * Computed from the height actually available — the viewport minus whatever
 * the HUD has reserved at the top — rather than from a tuned constant. Height
 * is the only dimension that constrains a single column, and in landscape it
 * collapses to a few hundred pixels, which is where a full-size stack climbs
 * into the HUD.
 */
export function buttonScale(
  height: number,
  reservedTop = 0,
  extent = columnExtent(defaultTouchButtons),
): number {
  if (extent <= 0) return 1;
  const available = height - reservedTop - TOP_MARGIN;
  return Math.max(MIN_SCALE, Math.min(1, available / extent));
}

export interface TouchButtonVisual extends TouchButtonSpec {
  /** Centre in CSS pixels, resolved against the current viewport. */
  center: Vec2;
  /** Radius in CSS pixels after scaling. */
  radius: number;
  pressed: boolean;
}

export interface TouchButtons extends InputDevice {
  readonly visuals: readonly TouchButtonVisual[];
  /** True once a finger or stylus has touched this surface. */
  readonly sawTouch: boolean;
  /**
   * Recompute button centres. Call once per frame: they depend on the
   * viewport, so they move on resize, rotation and any layout change.
   */
  update(): void;
}

export interface Size {
  width: number;
  height: number;
  /**
   * Pixels at the top of the screen already spoken for by the HUD. The button
   * column has to fit under it, and in landscape there is barely room.
   */
  reservedTop?: number;
}

/**
 * Canvas-drawn action buttons sharing one pointer surface with the joystick.
 *
 * Each button tracks its own pointer ids, so holding one with the right thumb
 * while steering with the left works, and a slide off a button releases it.
 */
export function createTouchButtons(
  target: HTMLElement,
  getSize: () => Size,
  specs: readonly TouchButtonSpec[] = defaultTouchButtons,
): TouchButtons {
  const held = new Map<number, ActionId>();
  let sawTouch = false;
  const visuals: TouchButtonVisual[] = specs.map((s) => ({
    ...s,
    center: { x: 0, y: 0 },
    radius: s.r,
    pressed: false,
  }));

  const localPoint = (e: PointerEvent): Vec2 => {
    const rect = target.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const refreshCenters = (): void => {
    const size = getSize();
    const scale = buttonScale(size.height, size.reservedTop ?? 0, columnExtent(specs));
    for (const v of visuals) {
      v.radius = v.r * scale;
      v.center.x = v.cx * size.width;
      v.center.y = size.height - v.bottom * scale;
    }
  };

  const hit = (p: Vec2): TouchButtonVisual | undefined => {
    refreshCenters();
    // Buttons never overlap, so the first containing one is the only one.
    for (const v of visuals) {
      if (Math.hypot(p.x - v.center.x, p.y - v.center.y) <= v.radius) return v;
    }
    return undefined;
  };

  const syncPressed = (): void => {
    const active = new Set(held.values());
    for (const v of visuals) v.pressed = active.has(v.id);
  };

  const onPointerDown = (e: PointerEvent): void => {
    // This handler runs in the capture phase and stops propagation when it
    // claims a press, so it is the only listener guaranteed to see a touch
    // that lands on a button. It must record presence itself.
    if (e.pointerType === 'touch' || e.pointerType === 'pen') sawTouch = true;
    const button = hit(localPoint(e));
    if (!button) return;
    held.set(e.pointerId, button.id);
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // See capturePointer() in virtual-joystick.ts: capture is best-effort and
      // must never abort the handler that records the press.
    }
    syncPressed();
    e.preventDefault();
    e.stopPropagation();
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!held.has(e.pointerId)) return;
    held.delete(e.pointerId);
    syncPressed();
    e.preventDefault();
  };

  // Pointer events are registered in the capture phase so a press that lands
  // on a button is consumed before the joystick (bubble phase) can claim it.
  target.addEventListener('pointerdown', onPointerDown, { capture: true });
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerUp);
  refreshCenters();

  return {
    visuals,
    get sawTouch(): boolean {
      return sawTouch;
    },
    update(): void {
      refreshCenters();
    },
    sample(out: ControlState): void {
      for (const id of held.values()) {
        // The combined button is one press that means two things: stop dead
        // and keep shooting, which is the whole point of having it.
        if (id === 'fire') out.fire = true;
        else if (id === 'boost') out.boost = true;
        else if (id === 'fireBrake') {
          out.fire = true;
          out.brake = true;
        }
      }
    },
    dispose(): void {
      target.removeEventListener('pointerdown', onPointerDown, { capture: true });
      target.removeEventListener('pointerup', onPointerUp);
      target.removeEventListener('pointercancel', onPointerUp);
    },
  };
}
