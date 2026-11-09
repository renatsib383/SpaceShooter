import type { Vec2 } from '../core/vec2';
import { readStick, type StickGeometry, type StickReading } from './joystick-math';
import type { ControlState, InputDevice } from './types';

export type StickPlacement =
  /** The stick appears wherever the finger lands inside its zone. */
  | 'dynamic'
  /** The stick always sits at a fixed anchor; touches anywhere in the zone drag it. */
  | 'fixed';

export interface ZoneRect {
  /** Fractions of the viewport, 0..1. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface JoystickConfig extends StickGeometry {
  placement: StickPlacement;
  /** Region of the viewport this stick claims. */
  zone: ZoneRect;
  /** Anchor inside the zone, as fractions of the zone. Used when placement is 'fixed'. */
  anchor: Vec2;
  /** Draw the stick while idle (only meaningful for 'fixed'). */
  showIdle: boolean;
}

export const defaultJoystickConfig: JoystickConfig = {
  placement: 'dynamic',
  zone: { x: 0, y: 0, w: 0.5, h: 1 },
  // Low enough to sit under a thumb at rest, high enough that the ring is not
  // clipped by the bottom edge at a large radius.
  anchor: { x: 0.34, y: 0.78 },
  radius: 64,
  deadZone: 0.12,
  recenter: true,
  showIdle: true,
};

/** Everything the renderer needs; no DOM nodes, so the HUD stays on the canvas. */
export interface JoystickVisual {
  active: boolean;
  origin: Vec2;
  knob: Vec2;
  radius: number;
  deadZone: number;
}

export interface VirtualJoystick extends InputDevice {
  readonly config: JoystickConfig;
  readonly visual: JoystickVisual;
  /**
   * Refresh the idle presentation. Call once per frame: the resting anchor is
   * a fraction of the viewport, so it moves on resize and rotation, and the
   * radius / dead zone can change under live tuning.
   */
  update(): void;
  /** True while a finger owns this stick. */
  readonly active: boolean;
  /** Current reading, magnitude 0..1. */
  readonly value: Vec2;
  /** True once a finger or stylus has touched this surface. */
  readonly sawTouch: boolean;
}

interface Size {
  width: number;
  height: number;
}

function pointInZone(p: Vec2, zone: ZoneRect, size: Size): boolean {
  const x0 = zone.x * size.width;
  const y0 = zone.y * size.height;
  return (
    p.x >= x0 &&
    p.x <= x0 + zone.w * size.width &&
    p.y >= y0 &&
    p.y <= y0 + zone.h * size.height
  );
}

/**
 * Pointer capture keeps a drag tracked once the finger leaves the element, but
 * it is an enhancement, not a requirement: it throws NotFoundError if the
 * pointer is already gone. Letting that escape a pointerdown handler would
 * abort the rest of it and leave the stick latched on a pointer that never
 * reports again, so the failure is swallowed and the drag proceeds untracked.
 */
function capturePointer(target: HTMLElement, pointerId: number): void {
  try {
    target.setPointerCapture(pointerId);
  } catch {
    /* pointer already released; events still bubble to the target */
  }
}

function anchorPoint(config: JoystickConfig, size: Size): Vec2 {
  const { zone, anchor } = config;
  return {
    x: (zone.x + anchor.x * zone.w) * size.width,
    y: (zone.y + anchor.y * zone.h) * size.height,
  };
}

/**
 * Touch joystick driven by Pointer Events.
 *
 * Design notes, all of them learned the hard way on real phones:
 *  - One `pointerId` is captured per stick, so a second finger on the fire
 *    button never steals or jitters the stick.
 *  - `setPointerCapture` keeps tracking when the finger slides outside the
 *    element or off-screen; `pointercancel` is handled as a release, which is
 *    what fires when the OS takes over for a system gesture.
 *  - The element must have `touch-action: none` or the browser will start
 *    scrolling mid-drag and swallow the move events.
 */
export function createVirtualJoystick(
  target: HTMLElement,
  getSize: () => Size,
  config: JoystickConfig = { ...defaultJoystickConfig },
): VirtualJoystick {
  let pointerId: number | null = null;
  let sawTouch = false;
  let origin: Vec2 = { x: 0, y: 0 };
  const value: Vec2 = { x: 0, y: 0 };
  const visual: JoystickVisual = {
    active: false,
    origin: { x: 0, y: 0 },
    knob: { x: 0, y: 0 },
    radius: config.radius,
    deadZone: config.deadZone,
  };

  const localPoint = (e: PointerEvent): Vec2 => {
    const rect = target.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const applyReading = (reading: StickReading): void => {
    value.x = reading.value.x;
    value.y = reading.value.y;
    origin = reading.origin;
    visual.origin = reading.origin;
    visual.knob = reading.knob;
    visual.radius = config.radius;
    visual.deadZone = config.deadZone;
  };

  /**
   * Park the drawn stick on its anchor for the current viewport.
   *
   * The anchor is clamped so the ring stays fully visible: the resting height
   * and the radius are tuned independently, and a large radius low on the
   * screen would otherwise draw a stick sliced off by the bottom edge.
   */
  const refreshIdle = (): void => {
    visual.radius = config.radius;
    visual.deadZone = config.deadZone;
    if (pointerId !== null) return;

    const size = getSize();
    const idle = anchorPoint(config, size);
    const margin = config.radius + 6;
    idle.x = Math.min(Math.max(idle.x, margin), Math.max(margin, size.width - margin));
    idle.y = Math.min(Math.max(idle.y, margin), Math.max(margin, size.height - margin));

    visual.origin = idle;
    visual.knob = { x: idle.x, y: idle.y };
  };

  const release = (): void => {
    pointerId = null;
    value.x = 0;
    value.y = 0;
    visual.active = false;
    refreshIdle();
  };

  const onPointerDown = (e: PointerEvent): void => {
    // Recorded before any early return, so a touch that lands outside this
    // stick's zone still counts as "this player is using touch".
    if (e.pointerType === 'touch' || e.pointerType === 'pen') sawTouch = true;
    if (pointerId !== null) return;
    const p = localPoint(e);
    const size = getSize();
    if (!pointInZone(p, config.zone, size)) return;

    pointerId = e.pointerId;
    visual.active = true;
    origin = config.placement === 'dynamic' ? p : anchorPoint(config, size);
    applyReading(readStick(origin, p, config));
    capturePointer(target, e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    applyReading(readStick(origin, localPoint(e), config));
    e.preventDefault();
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    release();
    e.preventDefault();
  };

  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerUp);

  release();

  return {
    config,
    visual,
    get active(): boolean {
      return pointerId !== null;
    },
    get value(): Vec2 {
      return value;
    },
    get sawTouch(): boolean {
      return sawTouch;
    },
    update(): void {
      refreshIdle();
    },
    sample(out: ControlState): void {
      if (pointerId === null) return;
      const magnitude = Math.hypot(value.x, value.y);
      if (magnitude <= 0) return;
      out.move.x = value.x;
      out.move.y = value.y;
      out.moving = true;
      out.source = 'touch';
    },
    dispose(): void {
      target.removeEventListener('pointerdown', onPointerDown);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerUp);
      target.removeEventListener('pointercancel', onPointerUp);
    },
  };
}
