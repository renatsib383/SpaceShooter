import { describe, expect, it } from 'vitest';
import { applyTouchLayout, DEFAULT_REST_HEIGHTS } from '../src/input/layout';
import { defaultJoystickConfig } from '../src/input/virtual-joystick';
import { defaultTouchButtons } from '../src/input/touch-buttons';
import type { JoystickConfig } from '../src/input/virtual-joystick';

function freshStick(): JoystickConfig {
  return {
    ...defaultJoystickConfig,
    zone: { ...defaultJoystickConfig.zone },
    anchor: { ...defaultJoystickConfig.anchor },
  };
}

function freshButtons() {
  return defaultTouchButtons.map((b) => ({ ...b }));
}

describe('applyTouchLayout', () => {
  it('puts the stick on the left half for a left thumb', () => {
    const stick = freshStick();
    applyTouchLayout('left', 'side', stick, freshButtons());
    expect(stick.zone.x).toBe(0);
    expect(stick.zone.w).toBe(0.5);
  });

  it('puts the stick on the right half for a right thumb', () => {
    const stick = freshStick();
    applyTouchLayout('right', 'side', stick, freshButtons());
    expect(stick.zone.x).toBe(0.5);
    expect(stick.zone.w).toBe(0.5);
  });

  it('moves the action buttons to the side the stick is not on', () => {
    const stick = freshStick();
    const buttons = freshButtons();

    applyTouchLayout('right', 'side', stick, buttons);
    for (const b of buttons) {
      expect(b.cx).toBeLessThan(0.5); // actions left, stick right
    }

    applyTouchLayout('left', 'side', stick, buttons);
    for (const b of buttons) {
      expect(b.cx).toBeGreaterThan(0.5); // actions right, stick left
    }
  });

  it('never leaves a button inside the stick zone, for side placement', () => {
    for (const hand of ['left', 'right'] as const) {
      const stick = freshStick();
      const buttons = freshButtons();
      applyTouchLayout(hand, 'side', stick, buttons);
      const zoneStart = stick.zone.x;
      const zoneEnd = stick.zone.x + stick.zone.w;
      for (const b of buttons) {
        const insideZone = b.cx >= zoneStart && b.cx <= zoneEnd;
        expect(insideZone).toBe(false);
      }
    }
  });

  it('keeps the stick anchor inside its own zone', () => {
    for (const hand of ['left', 'right'] as const) {
      const stick = freshStick();
      applyTouchLayout(hand, 'side', stick, freshButtons());
      expect(stick.anchor.x).toBeGreaterThan(0);
      expect(stick.anchor.x).toBeLessThan(1);
    }
  });

  it('is idempotent: applying the same hand twice changes nothing', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyTouchLayout('right', 'side', stick, buttons);
    const once = { zone: { ...stick.zone }, anchor: { ...stick.anchor }, cx: buttons.map((b) => b.cx) };
    applyTouchLayout('right', 'side', stick, buttons);
    expect(stick.zone).toEqual(once.zone);
    expect(stick.anchor).toEqual(once.anchor);
    expect(buttons.map((b) => b.cx)).toEqual(once.cx);
  });

  it('round-trips back to the original layout', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyTouchLayout('left', 'side', stick, buttons);
    const left = { zone: { ...stick.zone }, anchor: { ...stick.anchor }, cx: buttons.map((b) => b.cx) };

    applyTouchLayout('right', 'side', stick, buttons);
    applyTouchLayout('left', 'side', stick, buttons);

    expect(stick.zone).toEqual(left.zone);
    expect(stick.anchor).toEqual(left.anchor);
    expect(buttons.map((b) => b.cx)).toEqual(left.cx);
  });

  it('mirrors each button about the screen centre', () => {
    const stick = freshStick();
    const a = freshButtons();
    const b = freshButtons();
    applyTouchLayout('left', 'side', stick, a);
    applyTouchLayout('right', 'side', stick, b);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.cx + b[i]!.cx).toBeCloseTo(1, 9);
      expect(a[i]!.cy).toBe(b[i]!.cy); // vertical placement is unchanged
    }
  });

  it('stacks the buttons on the horizontal centre when centred', () => {
    for (const hand of ['left', 'right'] as const) {
      const stick = freshStick();
      const buttons = freshButtons();
      applyTouchLayout(hand, 'center', stick, buttons);
      for (const b of buttons) expect(b.cx).toBeCloseTo(0.5, 9);
    }
  });

  it('keeps centred buttons identical for either hand', () => {
    const stickL = freshStick();
    const stickR = freshStick();
    const left = freshButtons();
    const right = freshButtons();
    applyTouchLayout('left', 'center', stickL, left);
    applyTouchLayout('right', 'center', stickR, right);
    expect(left.map((b) => [b.cx, b.cy])).toEqual(right.map((b) => [b.cx, b.cy]));
  });

  it('overlaps ОГОНЬ and СТОП, and keeps every other pair apart', () => {
    // Checked in pixels on a tall phone, since the radii are in pixels while
    // the positions are fractions.
    //
    // The fire/brake overlap is deliberate: a touch is a single point, so the
    // only way one thumb can hold both is for their hit areas to share a band.
    // Every other pair must stay separated or presses become ambiguous.
    const W = 390;
    const H = 664;
    const isFireBrake = (a: string, b: string): boolean =>
      (a === 'fire' && b === 'brake') || (a === 'brake' && b === 'fire');

    for (const side of ['left', 'center', 'right'] as const) {
      for (const placement of ['side', 'center', 'column'] as const) {
        const stick = freshStick();
        const buttons = freshButtons();
        applyTouchLayout(side, placement, stick, buttons);
        for (let i = 0; i < buttons.length; i++) {
          for (let j = i + 1; j < buttons.length; j++) {
            const a = buttons[i]!;
            const b = buttons[j]!;
            const distance = Math.hypot((a.cx - b.cx) * W, (a.cy - b.cy) * H);
            if (isFireBrake(a.id, b.id)) {
              expect(distance).toBeLessThan(a.r + b.r);
            } else {
              expect(distance).toBeGreaterThan(a.r + b.r);
            }
          }
        }
      }
    }
  });

  it('leaves a shared band wide enough for a thumb', () => {
    const H = 664;
    for (const placement of ['side', 'center', 'column'] as const) {
      const stick = freshStick();
      const buttons = freshButtons();
      applyTouchLayout('center', placement, stick, buttons);
      const fire = buttons.find((b) => b.id === 'fire')!;
      const brake = buttons.find((b) => b.id === 'brake')!;
      const gap = Math.abs(fire.cy - brake.cy) * H;
      const overlap = fire.r + brake.r - gap;
      // At least 20 px of shared depth: smaller than that and hitting both
      // becomes a matter of luck.
      expect(overlap).toBeGreaterThan(20);
      // But not so much that either button loses a region of its own.
      expect(gap).toBeGreaterThan(Math.max(fire.r, brake.r) * 0.5);
    }
  });

  it('keeps a point in the shared band inside both circles', () => {
    const W = 390;
    const H = 664;
    const stick = freshStick();
    const buttons = freshButtons();
    applyTouchLayout('center', 'column', stick, buttons);
    const fire = buttons.find((b) => b.id === 'fire')!;
    const brake = buttons.find((b) => b.id === 'brake')!;

    const midY = ((fire.cy + brake.cy) / 2) * H;
    const x = fire.cx * W;
    const inside = (b: typeof fire, py: number): boolean =>
      Math.hypot(x - b.cx * W, py - b.cy * H) <= b.r;

    expect(inside(fire, midY)).toBe(true);
    expect(inside(brake, midY)).toBe(true);

    // And each still has a region that is unambiguously its own.
    const deepFire = (fire.cy * H) + fire.r * 0.8;
    expect(inside(fire, deepFire)).toBe(true);
    expect(inside(brake, deepFire)).toBe(false);

    const deepBrake = (brake.cy * H) - brake.r * 0.8;
    expect(inside(brake, deepBrake)).toBe(true);
    expect(inside(fire, deepBrake)).toBe(false);
  });

  it('keeps every button fully on screen', () => {
    const W = 390;
    const H = 664;
    for (const placement of ['side', 'center', 'column'] as const) {
      const stick = freshStick();
      const buttons = freshButtons();
      applyTouchLayout('center', placement, stick, buttons);
      for (const b of buttons) {
        expect(b.cx * W - b.r).toBeGreaterThanOrEqual(0);
        expect(b.cx * W + b.r).toBeLessThanOrEqual(W);
        expect(b.cy * H - b.r).toBeGreaterThanOrEqual(0);
        expect(b.cy * H + b.r).toBeLessThanOrEqual(H);
      }
    }
  });

  it('still moves the stick zone when buttons are centred', () => {
    const stick = freshStick();
    applyTouchLayout('right', 'center', stick, freshButtons());
    expect(stick.zone.x).toBe(0.5);
    applyTouchLayout('left', 'center', stick, freshButtons());
    expect(stick.zone.x).toBe(0);
  });

  it('round-trips between placements', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyTouchLayout('right', 'side', stick, buttons);
    const side = buttons.map((b) => [b.cx, b.cy]);
    applyTouchLayout('right', 'center', stick, buttons);
    applyTouchLayout('right', 'side', stick, buttons);
    expect(buttons.map((b) => [b.cx, b.cy])).toEqual(side);
  });

  it('puts the stick on the middle half when centred', () => {
    const stick = freshStick();
    applyTouchLayout('center', 'column', stick, freshButtons());
    expect(stick.zone.x).toBe(0.25);
    expect(stick.zone.w).toBe(0.5);
    // Anchor is a fraction of the zone, so dead centre of the screen.
    expect(stick.zone.x + stick.anchor.x * stick.zone.w).toBeCloseTo(0.5, 9);
  });

  it('stacks column buttons vertically on one x', () => {
    for (const side of ['left', 'center', 'right'] as const) {
      const stick = freshStick();
      const buttons = freshButtons();
      applyTouchLayout(side, 'column', stick, buttons);
      const xs = new Set(buttons.map((b) => b.cx));
      expect(xs.size).toBe(1);
      const ys = buttons.map((b) => b.cy);
      expect(new Set(ys).size).toBe(ys.length); // distinct heights
    }
  });

  it('puts the column on the left for a centre or right stick', () => {
    for (const side of ['center', 'right'] as const) {
      const stick = freshStick();
      const buttons = freshButtons();
      applyTouchLayout(side, 'column', stick, buttons);
      for (const b of buttons) expect(b.cx).toBeLessThan(0.25);
    }
  });

  it('moves the column clear of a left stick instead of overlapping it', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyTouchLayout('left', 'column', stick, buttons);
    for (const b of buttons) expect(b.cx).toBeGreaterThan(0.75);
  });

  it('never puts a column button inside the stick zone, for any stick side', () => {
    for (const side of ['left', 'center', 'right'] as const) {
      const stick = freshStick();
      const buttons = freshButtons();
      applyTouchLayout(side, 'column', stick, buttons);
      const start = stick.zone.x;
      const end = stick.zone.x + stick.zone.w;
      for (const b of buttons) {
        expect(b.cx >= start && b.cx <= end).toBe(false);
      }
    }
  });

  it('orders the column with FIRE lowest, under the resting thumb', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyTouchLayout('center', 'column', stick, buttons);
    const fire = buttons.find((b) => b.id === 'fire')!;
    for (const other of buttons) {
      if (other.id !== 'fire') expect(fire.cy).toBeGreaterThan(other.cy);
    }
  });

  it('is idempotent for the centre stick with a column', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyTouchLayout('center', 'column', stick, buttons);
    const once = {
      zone: { ...stick.zone },
      anchor: { ...stick.anchor },
      pos: buttons.map((b) => [b.cx, b.cy]),
    };
    applyTouchLayout('center', 'column', stick, buttons);
    expect(stick.zone).toEqual(once.zone);
    expect(stick.anchor).toEqual(once.anchor);
    expect(buttons.map((b) => [b.cx, b.cy])).toEqual(once.pos);
  });

  it('applies the resting height belonging to the stick side', () => {
    const heights = { left: 0.7, center: 0.9, right: 0.72 };
    for (const side of ['left', 'center', 'right'] as const) {
      for (const placement of ['side', 'center', 'column'] as const) {
        const stick = freshStick();
        applyTouchLayout(side, placement, stick, freshButtons(), heights);
        expect(stick.anchor.y).toBe(heights[side]);
      }
    }
  });

  it('rests a centred stick lower than a stick on either side', () => {
    expect(DEFAULT_REST_HEIGHTS.center).toBeGreaterThan(DEFAULT_REST_HEIGHTS.left);
    expect(DEFAULT_REST_HEIGHTS.center).toBeGreaterThan(DEFAULT_REST_HEIGHTS.right);
  });

  it('keeps each side its own height when the stick moves between them', () => {
    // Tuning the centre must not disturb the height tuned for a side stick.
    const heights = { ...DEFAULT_REST_HEIGHTS, center: 0.91, right: 0.66 };
    const stick = freshStick();

    applyTouchLayout('center', 'column', stick, freshButtons(), heights);
    expect(stick.anchor.y).toBe(0.91);

    applyTouchLayout('right', 'column', stick, freshButtons(), heights);
    expect(stick.anchor.y).toBe(0.66);

    applyTouchLayout('center', 'column', stick, freshButtons(), heights);
    expect(stick.anchor.y).toBe(0.91);
  });

  it('falls back to the default heights when none are given', () => {
    const stick = freshStick();
    applyTouchLayout('center', 'column', stick, freshButtons());
    expect(stick.anchor.y).toBe(DEFAULT_REST_HEIGHTS.center);
  });

  it('rests the stick low enough for a thumb by default', () => {
    const stick = freshStick();
    // Below the middle of the screen, and clear of the very bottom edge.
    expect(stick.anchor.y).toBeGreaterThan(0.6);
    expect(stick.anchor.y).toBeLessThan(0.9);
  });

  it('keeps a centred stick horizontally centred at any height', () => {
    for (const h of [0.4, 0.86, 0.92]) {
      const stick = freshStick();
      const heights = { ...DEFAULT_REST_HEIGHTS, center: h };
      applyTouchLayout('center', 'column', stick, freshButtons(), heights);
      expect(stick.zone.x + stick.anchor.x * stick.zone.w).toBeCloseTo(0.5, 9);
      expect(stick.anchor.y).toBe(h);
    }
  });
});
