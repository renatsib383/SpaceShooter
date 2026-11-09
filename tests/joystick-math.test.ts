import { describe, expect, it } from 'vitest';
import { readStick } from '../src/input/joystick-math';

const geo = { radius: 100, deadZone: 0.2, recenter: false };

describe('readStick', () => {
  it('reports zero at the origin', () => {
    const r = readStick({ x: 0, y: 0 }, { x: 0, y: 0 }, geo);
    expect(r.value.x).toBe(0);
    expect(r.value.y).toBe(0);
  });

  it('reports zero inside the dead zone', () => {
    const r = readStick({ x: 0, y: 0 }, { x: 19, y: 0 }, geo);
    expect(Math.hypot(r.value.x, r.value.y)).toBe(0);
  });

  it('rescales travel past the dead zone to start near zero', () => {
    // 1px past a 20px dead zone, over 80px of usable travel.
    const r = readStick({ x: 0, y: 0 }, { x: 21, y: 0 }, geo);
    expect(Math.hypot(r.value.x, r.value.y)).toBeCloseTo(1 / 80, 5);
  });

  it('reaches exactly full magnitude at the rim', () => {
    const r = readStick({ x: 0, y: 0 }, { x: 100, y: 0 }, geo);
    expect(r.value.x).toBeCloseTo(1, 6);
    expect(r.value.y).toBeCloseTo(0, 6);
  });

  it('clamps magnitude to 1 beyond the rim but keeps the direction', () => {
    const r = readStick({ x: 0, y: 0 }, { x: 600, y: 600 }, geo);
    expect(Math.hypot(r.value.x, r.value.y)).toBeCloseTo(1, 6);
    expect(r.value.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(r.value.y).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it('keeps diagonals at magnitude <= 1 (no square dead zone artefact)', () => {
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const r = readStick(
        { x: 0, y: 0 },
        { x: Math.cos(a) * 95, y: Math.sin(a) * 95 },
        geo,
      );
      expect(Math.hypot(r.value.x, r.value.y)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('pins the knob to the rim when dragged past it', () => {
    const r = readStick({ x: 50, y: 50 }, { x: 400, y: 50 }, geo);
    expect(Math.hypot(r.knob.x - 50, r.knob.y - 50)).toBeCloseTo(100, 6);
  });

  it('leaves the origin alone when recentering is off', () => {
    const r = readStick({ x: 10, y: 10 }, { x: 900, y: 10 }, geo);
    expect(r.origin).toEqual({ x: 10, y: 10 });
  });

  it('drags the origin along to stay one radius behind the finger', () => {
    const r = readStick({ x: 0, y: 0 }, { x: 250, y: 0 }, { ...geo, recenter: true });
    expect(r.origin.x).toBeCloseTo(150, 6);
    expect(Math.hypot(r.value.x, r.value.y)).toBeCloseTo(1, 6);
  });

  it('still reads full magnitude after recentering diagonally', () => {
    const r = readStick(
      { x: 0, y: 0 },
      { x: 300, y: 400 },
      { ...geo, recenter: true },
    );
    expect(Math.hypot(r.origin.x, r.origin.y)).toBeCloseTo(400, 6);
    expect(Math.hypot(r.value.x, r.value.y)).toBeCloseTo(1, 6);
  });

  it('treats a zero dead zone as fully linear', () => {
    const r = readStick({ x: 0, y: 0 }, { x: 50, y: 0 }, { ...geo, deadZone: 0 });
    expect(r.value.x).toBeCloseTo(0.5, 6);
  });
});
