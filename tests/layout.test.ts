import { describe, expect, it } from 'vitest';
import { applyTouchLayout } from '../src/input/layout';
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

describe('applyHandedness', () => {
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

  it('does not stack centred buttons on top of each other', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyTouchLayout('right', 'center', stick, buttons);
    const [a, b] = buttons;
    // Vertical gap must exceed the two radii, or the hit areas overlap.
    const gap = Math.abs(a!.cy - b!.cy);
    expect(gap).toBeGreaterThan(0.1);
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

  it('keeps column buttons far enough apart not to overlap', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyTouchLayout('center', 'column', stick, buttons);
    const [a, b] = buttons;
    expect(Math.abs(a!.cy - b!.cy)).toBeGreaterThan(0.1);
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

  it('never touches the stick height when placing the layout', () => {
    // Vertical position is the player's choice; only horizontal placement is
    // derived from the layout, so a layout change must leave anchor.y alone.
    for (const side of ['left', 'center', 'right'] as const) {
      for (const placement of ['side', 'center', 'column'] as const) {
        const stick = freshStick();
        stick.anchor.y = 0.42;
        applyTouchLayout(side, placement, stick, freshButtons());
        expect(stick.anchor.y).toBe(0.42);
      }
    }
  });

  it('rests the stick low enough for a thumb by default', () => {
    const stick = freshStick();
    // Below the middle of the screen, and clear of the very bottom edge.
    expect(stick.anchor.y).toBeGreaterThan(0.6);
    expect(stick.anchor.y).toBeLessThan(0.9);
  });

  it('keeps a centred stick horizontally centred at any height', () => {
    const stick = freshStick();
    stick.anchor.y = 0.88;
    applyTouchLayout('center', 'column', stick, freshButtons());
    expect(stick.zone.x + stick.anchor.x * stick.zone.w).toBeCloseTo(0.5, 9);
    expect(stick.anchor.y).toBe(0.88);
  });
});
