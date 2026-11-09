import { wrap } from '../core/math';

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

export function drawStarfield(
  ctx: CanvasRenderingContext2D,
  field: Starfield,
  camX: number,
  camY: number,
  width: number,
  height: number,
): void {
  for (const layer of field.layers) {
    const { tile, depth, stars, size, alpha } = layer;
    // Offset of the tile grid for this layer, in screen space.
    const offX = wrap(-camX * depth, tile);
    const offY = wrap(-camY * depth, tile);
    const cols = Math.ceil(width / tile) + 1;
    const rows = Math.ceil(height / tile) + 1;

    ctx.fillStyle = `rgba(214, 230, 255, ${alpha})`;
    for (let cx = -1; cx < cols; cx++) {
      for (let cy = -1; cy < rows; cy++) {
        const baseX = offX + cx * tile;
        const baseY = offY + cy * tile;
        for (let s = 0; s < stars.length; s += 2) {
          const x = baseX + stars[s]!;
          const y = baseY + stars[s + 1]!;
          if (x < -size || y < -size || x > width + size || y > height + size) continue;
          ctx.fillRect(x, y, size, size);
        }
      }
    }
  }
}
