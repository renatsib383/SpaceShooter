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
});
