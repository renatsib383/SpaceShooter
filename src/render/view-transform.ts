/**
 * Mapping between world and screen.
 *
 * Zoom made this worth naming: before it, "world to screen" was a subtraction
 * done in three places, and each one would have had to grow the same scale
 * term — exactly the kind of duplication that leaves the starfield drifting
 * out of step with the ships on it.
 */
export interface ViewTransform {
  /** Camera centre, in world units. */
  camX: number;
  camY: number;
  zoom: number;
  width: number;
  height: number;
}

/**
 * Set the canvas transform so subsequent drawing can use world coordinates.
 * Scaling happens about the centre of the viewport, so zoom pulls toward and
 * away from what the camera is looking at rather than the top-left corner.
 */
export function applyWorldTransform(
  ctx: CanvasRenderingContext2D,
  v: ViewTransform,
): void {
  ctx.translate(v.width / 2, v.height / 2);
  ctx.scale(v.zoom, v.zoom);
  ctx.translate(-v.camX, -v.camY);
}

export function worldToScreenX(v: ViewTransform, worldX: number): number {
  return (worldX - v.camX) * v.zoom + v.width / 2;
}

export function worldToScreenY(v: ViewTransform, worldY: number): number {
  return (worldY - v.camY) * v.zoom + v.height / 2;
}

/** Half the world-space width and height currently visible. */
export function visibleHalfWidth(v: ViewTransform): number {
  return v.width / 2 / v.zoom;
}

export function visibleHalfHeight(v: ViewTransform): number {
  return v.height / 2 / v.zoom;
}
