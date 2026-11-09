export interface Viewport {
  readonly ctx: CanvasRenderingContext2D;
  readonly canvas: HTMLCanvasElement;
  /** Logical (CSS pixel) width of the drawing area. */
  readonly width: number;
  /** Logical (CSS pixel) height of the drawing area. */
  readonly height: number;
  /** Backing-store scale actually in use. */
  readonly dpr: number;
  dispose(): void;
}

export interface ViewportOptions {
  /** Cap on device pixel ratio. Keeps fill-rate sane on 3x phones. Default 2. */
  maxDpr?: number;
}

/**
 * Sizes a canvas to its CSS box times devicePixelRatio and keeps it sized on
 * resize / rotation. The 2D context is pre-scaled, so all drawing code works
 * in CSS pixels and never has to think about DPR.
 */
export function createViewport(
  canvas: HTMLCanvasElement,
  options: ViewportOptions = {},
): Viewport {
  const maxDpr = options.maxDpr ?? 2;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D canvas context unavailable');

  let width = 0;
  let height = 0;
  let dpr = 1;

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const nextDpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const nextW = Math.max(1, Math.round(rect.width));
    const nextH = Math.max(1, Math.round(rect.height));
    if (nextW === width && nextH === height && nextDpr === dpr) return;

    width = nextW;
    height = nextH;
    dpr = nextDpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  };

  resize();

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  window.addEventListener('orientationchange', resize);

  return {
    ctx,
    canvas,
    get width(): number {
      return width;
    },
    get height(): number {
      return height;
    },
    get dpr(): number {
      return dpr;
    },
    dispose(): void {
      observer.disconnect();
      window.removeEventListener('orientationchange', resize);
    },
  };
}

/** Reset the transform for a new frame and apply the DPR scale. */
export function beginFrame(view: Viewport): CanvasRenderingContext2D {
  const { ctx } = view;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  return ctx;
}
