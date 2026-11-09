import { describe, expect, it } from 'vitest';
import { applyHandedness } from '../src/input/layout';
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
    applyHandedness('left', stick, freshButtons());
    expect(stick.zone.x).toBe(0);
    expect(stick.zone.w).toBe(0.5);
  });

  it('puts the stick on the right half for a right thumb', () => {
    const stick = freshStick();
    applyHandedness('right', stick, freshButtons());
    expect(stick.zone.x).toBe(0.5);
    expect(stick.zone.w).toBe(0.5);
  });

  it('moves the action buttons to the side the stick is not on', () => {
    const stick = freshStick();
    const buttons = freshButtons();

    applyHandedness('right', stick, buttons);
    for (const b of buttons) {
      expect(b.cx).toBeLessThan(0.5); // actions left, stick right
    }

    applyHandedness('left', stick, buttons);
    for (const b of buttons) {
      expect(b.cx).toBeGreaterThan(0.5); // actions right, stick left
    }
  });

  it('never leaves a button inside the stick zone', () => {
    for (const hand of ['left', 'right'] as const) {
      const stick = freshStick();
      const buttons = freshButtons();
      applyHandedness(hand, stick, buttons);
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
      applyHandedness(hand, stick, freshButtons());
      expect(stick.anchor.x).toBeGreaterThan(0);
      expect(stick.anchor.x).toBeLessThan(1);
    }
  });

  it('is idempotent: applying the same hand twice changes nothing', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyHandedness('right', stick, buttons);
    const once = { zone: { ...stick.zone }, anchor: { ...stick.anchor }, cx: buttons.map((b) => b.cx) };
    applyHandedness('right', stick, buttons);
    expect(stick.zone).toEqual(once.zone);
    expect(stick.anchor).toEqual(once.anchor);
    expect(buttons.map((b) => b.cx)).toEqual(once.cx);
  });

  it('round-trips back to the original layout', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyHandedness('left', stick, buttons);
    const left = { zone: { ...stick.zone }, anchor: { ...stick.anchor }, cx: buttons.map((b) => b.cx) };

    applyHandedness('right', stick, buttons);
    applyHandedness('left', stick, buttons);

    expect(stick.zone).toEqual(left.zone);
    expect(stick.anchor).toEqual(left.anchor);
    expect(buttons.map((b) => b.cx)).toEqual(left.cx);
  });

  it('mirrors each button about the screen centre', () => {
    const stick = freshStick();
    const a = freshButtons();
    const b = freshButtons();
    applyHandedness('left', stick, a);
    applyHandedness('right', stick, b);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.cx + b[i]!.cx).toBeCloseTo(1, 9);
      expect(a[i]!.cy).toBe(b[i]!.cy); // vertical placement is unchanged
    }
  });
});
