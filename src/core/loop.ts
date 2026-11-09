export interface LoopHandlers {
  /** Advance the simulation by exactly `dt` seconds. Called 0..N times per frame. */
  update(dt: number): void;
  /**
   * Draw one frame.
   * @param alpha  0..1 progress between the last two simulation steps, for interpolation.
   * @param frameDt real seconds since the previous rendered frame (for FPS / UI only).
   */
  render(alpha: number, frameDt: number): void;
}

export interface LoopOptions {
  /** Simulation steps per second. Default 120. */
  hz?: number;
  /**
   * Largest real-time gap a single frame may consume, in seconds. Default 0.25.
   * Protects against the "spiral of death" after a tab has been backgrounded.
   */
  maxFrameTime?: number;
}

export interface Loop {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

/**
 * Fixed-timestep game loop with a render interpolation factor.
 *
 * Simulation always advances in equal `1/hz` steps, so physics is deterministic
 * and independent of display refresh rate; rendering happens once per
 * animation frame with an `alpha` for smoothing between steps.
 */
export function createLoop(handlers: LoopHandlers, options: LoopOptions = {}): Loop {
  const hz = options.hz ?? 120;
  const dt = 1 / hz;
  const maxFrameTime = options.maxFrameTime ?? 0.25;

  let running = false;
  let rafId = 0;
  let prev = 0;
  let accumulator = 0;

  const frame = (now: number): void => {
    if (!running) return;
    rafId = requestAnimationFrame(frame);

    const frameDt = Math.min((now - prev) / 1000, maxFrameTime);
    prev = now;
    accumulator += frameDt;

    while (accumulator >= dt) {
      handlers.update(dt);
      accumulator -= dt;
    }

    handlers.render(accumulator / dt, frameDt);
  };

  return {
    start(): void {
      if (running) return;
      running = true;
      prev = performance.now();
      accumulator = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop(): void {
      running = false;
      cancelAnimationFrame(rafId);
    },
    get running(): boolean {
      return running;
    },
  };
}
