import { describe, expect, it } from 'vitest';
import { angleDelta, clamp, decay, rotateToward, TAU, wrap } from '../src/core/math';

describe('angleDelta', () => {
  it('takes the short way around the wrap point', () => {
    expect(angleDelta(0.1, -0.1)).toBeCloseTo(-0.2, 6);
    expect(angleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2, 6);
  });

  it('stays within (-PI, PI]', () => {
    for (let a = -10; a < 10; a += 0.37) {
      for (let b = -10; b < 10; b += 0.41) {
        const d = angleDelta(a, b);
        expect(d).toBeGreaterThan(-Math.PI - 1e-9);
        expect(d).toBeLessThanOrEqual(Math.PI + 1e-9);
      }
    }
  });
});

describe('rotateToward', () => {
  it('snaps to the target once it is within reach', () => {
    expect(rotateToward(0, 0.05, 0.1)).toBe(0.05);
  });

  it('steps by exactly maxStep when the target is further', () => {
    expect(rotateToward(0, 1, 0.1)).toBeCloseTo(0.1, 6);
    expect(rotateToward(0, -1, 0.1)).toBeCloseTo(-0.1, 6);
  });

  it('turns the short way across the wrap point', () => {
    expect(rotateToward(Math.PI - 0.05, -Math.PI + 0.05, 0.1)).toBeCloseTo(
      -Math.PI + 0.05,
      6,
    );
  });
});

describe('decay', () => {
  it('halves over exactly one half-life', () => {
    expect(decay(1, 1)).toBeCloseTo(0.5, 9);
  });

  it('composes: two half steps equal one whole step', () => {
    expect(decay(0.7, 0.25) * decay(0.7, 0.25)).toBeCloseTo(decay(0.7, 0.5), 9);
  });

  it('treats a zero half-life as an instant stop', () => {
    expect(decay(0, 0.016)).toBe(0);
  });
});

describe('clamp and wrap', () => {
  it('clamps to the bounds', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('wraps negatives into range', () => {
    expect(wrap(-1, 10)).toBe(9);
    expect(wrap(11, 10)).toBe(1);
    expect(wrap(-TAU, TAU)).toBe(0);
  });
});
