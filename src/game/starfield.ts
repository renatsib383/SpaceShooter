import { wrap } from '../core/math';
import type { ViewTransform } from '../render/view-transform';

export interface StarLayer {
  /** Parallax factor: 0 = infinitely far (static), 1 = moves with the camera. */
  depth: number;
  /** Tile size in world units; stars repeat on this grid. */
  tile: number;
  /** Stars per tile. */
  count: number;
  size: number;
  alpha: number;
  stars: Float32Array;
}

export interface Starfield {
  layers: readonly StarLayer[];
}

/**
 * Deterministic 32-bit PRNG (mulberry32). Seeded so the sky is identical on
 * every run and on every device — which matters once the galaxy is procedural
 * and two players are meant to see the same stars.
 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The starfield is a small set of random points per layer, tiled infinitely.
 * Nothing is allocated per frame and nothing is stored per visible star, so
 * the cost is fixed no matter how far the player flies.
 */
export function createStarfield(seed = 1337): Starfield {
  const specs: ReadonlyArray<Omit<StarLayer, 'stars'>> = [
    { depth: 0.18, tile: 900, count: 130, size: 1.0, alpha: 0.4 },
    { depth: 0.38, tile: 1100, count: 90, size: 1.5, alpha: 0.6 },
    { depth: 0.7, tile: 1400, count: 55, size: 2.2, alpha: 0.85 },
  ];

  const layers = specs.map((spec, i) => {
    const random = rng(seed + i * 7919);
    const stars = new Float32Array(spec.count * 2);
    for (let s = 0; s < spec.count; s++) {
      stars[s * 2] = random() * spec.tile;
      stars[s * 2 + 1] = random() * spec.tile;
    }
    return { ...spec, stars };
  });

  return { layers };
}

/**
 * Drawn straight to screen space rather than inside the world transform.
 *
 * Each layer is scaled by the camera zoom so it stays locked to the ships on
 * top of it, but star *size* is deliberately left in screen pixels: scaling a
 * 1 px star down would make the far layers disappear exactly when zooming out
 * is supposed to show more.
 */
export function drawStarfield(
  ctx: CanvasRenderingContext2D,
  field: Starfield,
  v: ViewTransform,
): void {
  const { width, height, zoom } = v;

  for (const layer of field.layers) {
    const { tile, depth, stars, size, alpha } = layer;
    const tileS = tile * zoom;
    if (tileS <= 0) continue;

    // Where this layer's tile grid starts on screen, including the parallax
    // shift and the viewport centre that zoom scales about.
    const offX = wrap(width / 2 - v.camX * depth * zoom, tileS);
    const offY = wrap(height / 2 - v.camY * depth * zoom, tileS);
    const cols = Math.ceil(width / tileS) + 1;
    const rows = Math.ceil(height / tileS) + 1;

    ctx.fillStyle = `rgba(214, 230, 255, ${alpha})`;
    for (let cx = -1; cx < cols; cx++) {
      for (let cy = -1; cy < rows; cy++) {
        const baseX = offX + cx * tileS;
        const baseY = offY + cy * tileS;
        for (let s = 0; s < stars.length; s += 2) {
          const x = baseX + stars[s]! * zoom;
          const y = baseY + stars[s + 1]! * zoom;
          if (x < -size || y < -size || x > width + size || y > height + size) continue;
          ctx.fillRect(x, y, size, size);
        }
      }
    }
  }
}
