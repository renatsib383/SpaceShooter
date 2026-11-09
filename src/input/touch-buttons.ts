import type { Vec2 } from '../core/vec2';
import { ui } from '../ui/strings';
import type { ControlState, InputDevice } from './types';

export interface TouchButtonSpec {
  id: 'fire' | 'boost' | 'brake';
  label: string;
  /** Center as fractions of the viewport. */
  cx: number;
  cy: number;
  /** Hit/draw radius in CSS pixels. */
  r: number;
}

export const defaultTouchButtons: readonly TouchButtonSpec[] = [
  { id: 'fire', label: ui.buttons.fire, cx: 0.86, cy: 0.74, r: 42 },
  { id: 'brake', label: ui.buttons.brake, cx: 0.86, cy: 0.52, r: 32 },
  { id: 'boost', label: ui.buttons.boost, cx: 0.7, cy: 0.86, r: 32 },
];

export interface TouchButtonVisual extends TouchButtonSpec {
  /** Center in CSS pixels, resolved against the current viewport. */
  center: Vec2;
  pressed: boolean;
}

export interface TouchButtons extends InputDevice {
  readonly visuals: readonly TouchButtonVisual[];
  /** True once a finger or stylus has touched this surface. */
  readonly sawTouch: boolean;
  /**
   * Recompute button centres. Call once per frame: they are fractions of the
   * viewport, so they move on resize, rotation and any layout change.
   */
  update(): void;
}

interface Size {
  width: number;
  height: number;
}

/**
 * Canvas-drawn action buttons sharing one pointer surface with the joystick.
 *
 * Each button tracks its own pointer ids, so holding fire with the right thumb
 * while steering with the left works, and a slide off the button releases it.
 */
export function createTouchButtons(
  target: HTMLElement,
  getSize: () => Size,
  specs: readonly TouchButtonSpec[] = defaultTouchButtons,
): TouchButtons {
  // One pointer may hold several buttons at once: ОГОНЬ and СТОП overlap on
  // purpose so a single thumb in the shared band presses both.
  const held = new Map<number, TouchButtonSpec['id'][]>();
  let sawTouch = false;
  const visuals: TouchButtonVisual[] = specs.map((s) => ({
    ...s,
    center: { x: 0, y: 0 },
    pressed: false,
  }));

  const localPoint = (e: PointerEvent): Vec2 => {
    const rect = target.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const refreshCenters = (): void => {
    const size = getSize();
    for (const v of visuals) {
      v.center.x = v.cx * size.width;
      v.center.y = v.cy * size.height;
    }
  };

  /** Every button whose hit area contains the point, not just the first. */
  const hitAll = (p: Vec2): TouchButtonSpec['id'][] => {
    refreshCenters();
    const ids: TouchButtonSpec['id'][] = [];
    for (const v of visuals) {
      if (Math.hypot(p.x - v.center.x, p.y - v.center.y) <= v.r) ids.push(v.id);
    }
    return ids;
  };

  const syncPressed = (): void => {
    const active = new Set<TouchButtonSpec['id']>();
    for (const ids of held.values()) for (const id of ids) active.add(id);
    for (const v of visuals) v.pressed = active.has(v.id);
  };

  const onPointerDown = (e: PointerEvent): void => {
    // This handler runs in the capture phase and stops propagation when it
    // claims a press, so it is the only listener guaranteed to see a touch
    // that lands on a button. It must record presence itself.
    if (e.pointerType === 'touch' || e.pointerType === 'pen') sawTouch = true;
    const ids = hitAll(localPoint(e));
    if (ids.length === 0) return;
    held.set(e.pointerId, ids);
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

  // Pointer events are registered in the capture phase so a press that lands on
  // a button is consumed before the joystick (bubble phase) can claim it.
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
      for (const ids of held.values()) {
        for (const id of ids) {
          if (id === 'fire') out.fire = true;
          else if (id === 'boost') out.boost = true;
          else if (id === 'brake') out.brake = true;
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
