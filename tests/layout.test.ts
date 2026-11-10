import { describe, expect, it } from 'vitest';
import { applyTouchLayout, DEFAULT_REST_HEIGHTS } from '../src/input/layout';
import { defaultJoystickConfig } from '../src/input/virtual-joystick';
import { buttonScale, columnExtent, defaultTouchButtons } from '../src/input/touch-buttons';
import type { JoystickConfig } from '../src/input/virtual-joystick';
import type { ButtonPlacement, StickSide } from '../src/input/layout';

/** Viewports the controls have to survive, in CSS pixels. */
const PORTRAIT = { w: 390, h: 664 };
const LANDSCAPE = { w: 664, h: 390 };
const SMALL_PHONE = { w: 320, h: 568 };

const SIDES: readonly StickSide[] = ['left', 'center', 'right'];
const PLACEMENTS: readonly ButtonPlacement[] = ['side', 'center', 'column'];

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

/** Top band the HUD occupies, with and without the debug overlay. */
const HUD_WITH_DEBUG = 204;
const HUD_PLAIN = 52;

/** Resolve a laid-out button to real pixels, the way the renderer does. */
function resolve(
  button: ReturnType<typeof freshButtons>[number],
  vp: { w: number; h: number },
  reservedTop = HUD_WITH_DEBUG,
) {
  const scale = buttonScale(vp.h, reservedTop, columnExtent(defaultTouchButtons));
  return {
    id: button.id,
    x: button.cx * vp.w,
    y: vp.h - button.bottom * scale,
    r: button.r * scale,
  };
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

  it('puts the stick on the middle half when centred', () => {
    const stick = freshStick();
    applyTouchLayout('center', 'column', stick, freshButtons());
    expect(stick.zone.x).toBe(0.25);
    expect(stick.zone.w).toBe(0.5);
    expect(stick.zone.x + stick.anchor.x * stick.zone.w).toBeCloseTo(0.5, 9);
  });

  it('moves side buttons to the half the stick is not on', () => {
    const stick = freshStick();
    const buttons = freshButtons();

    applyTouchLayout('right', 'side', stick, buttons);
    for (const b of buttons) expect(b.cx).toBeLessThan(0.5);

    applyTouchLayout('left', 'side', stick, buttons);
    for (const b of buttons) expect(b.cx).toBeGreaterThan(0.5);
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

  it('never puts a side or column button inside the stick zone', () => {
    for (const side of SIDES) {
      for (const placement of ['side', 'column'] as const) {
        const stick = freshStick();
        const buttons = freshButtons();
        applyTouchLayout(side, placement, stick, buttons);
        const start = stick.zone.x;
        const end = stick.zone.x + stick.zone.w;
        for (const b of buttons) {
          expect(b.cx >= start && b.cx <= end).toBe(false);
        }
      }
    }
  });

  it('stacks column buttons on a single x', () => {
    for (const side of SIDES) {
      const stick = freshStick();
      const buttons = freshButtons();
      applyTouchLayout(side, 'column', stick, buttons);
      expect(new Set(buttons.map((b) => b.cx)).size).toBe(1);
    }
  });

  it('orders the column with ОГОНЬ lowest, under the resting thumb', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyTouchLayout('center', 'column', stick, buttons);
    const fire = buttons.find((b) => b.id === 'fire')!;
    for (const other of buttons) {
      if (other.id !== 'fire') expect(fire.bottom).toBeLessThan(other.bottom);
    }
  });

  it('puts the combined stop-and-shoot button next to ОГОНЬ', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyTouchLayout('center', 'column', stick, buttons);
    const fire = buttons.find((b) => b.id === 'fire')!;
    const combined = buttons.find((b) => b.id === 'fireBrake')!;
    const boost = buttons.find((b) => b.id === 'boost')!;
    // Used together, so it is the nearer neighbour of the two.
    expect(combined.bottom - fire.bottom).toBeLessThan(boost.bottom - combined.bottom + 1);
  });

  it('never overlaps two buttons, on any viewport or layout', () => {
    for (const vp of [PORTRAIT, LANDSCAPE, SMALL_PHONE]) {
      for (const side of SIDES) {
        for (const placement of PLACEMENTS) {
          const stick = freshStick();
          const buttons = freshButtons();
          applyTouchLayout(side, placement, stick, buttons);
          const resolved = buttons.map((b) => resolve(b, vp));
          for (let i = 0; i < resolved.length; i++) {
            for (let j = i + 1; j < resolved.length; j++) {
              const a = resolved[i]!;
              const b = resolved[j]!;
              const distance = Math.hypot(a.x - b.x, a.y - b.y);
              expect(distance).toBeGreaterThan(a.r + b.r);
            }
          }
        }
      }
    }
  });

  it('keeps every button fully on screen, portrait and landscape alike', () => {
    for (const vp of [PORTRAIT, LANDSCAPE, SMALL_PHONE]) {
      for (const side of SIDES) {
        for (const placement of PLACEMENTS) {
          const stick = freshStick();
          const buttons = freshButtons();
          applyTouchLayout(side, placement, stick, buttons);
          for (const b of buttons.map((x) => resolve(x, vp))) {
            expect(b.x - b.r).toBeGreaterThanOrEqual(0);
            expect(b.x + b.r).toBeLessThanOrEqual(vp.w);
            expect(b.y - b.r).toBeGreaterThanOrEqual(0);
            expect(b.y + b.r).toBeLessThanOrEqual(vp.h);
          }
        }
      }
    }
  });

  it('clears the HUD in landscape, where the screen is shortest', () => {
    for (const reserved of [HUD_WITH_DEBUG, HUD_PLAIN]) {
      for (const placement of PLACEMENTS) {
        const stick = freshStick();
        const buttons = freshButtons();
        applyTouchLayout('center', placement, stick, buttons);
        for (const b of buttons.map((x) => resolve(x, LANDSCAPE, reserved))) {
          expect(b.y - b.r).toBeGreaterThan(reserved);
        }
      }
    }
  });

  it('clears the HUD in portrait too, with the debug overlay on', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyTouchLayout('center', 'column', stick, buttons);
    for (const b of buttons.map((x) => resolve(x, PORTRAIT))) {
      expect(b.y - b.r).toBeGreaterThan(HUD_WITH_DEBUG);
    }
  });

  it('keeps the lowest button clear of the bottom gesture band', () => {
    for (const vp of [PORTRAIT, LANDSCAPE]) {
      const stick = freshStick();
      const buttons = freshButtons();
      applyTouchLayout('center', 'column', stick, buttons);
      const lowest = buttons.map((b) => resolve(b, vp)).sort((a, b) => b.y - a.y)[0]!;
      expect(vp.h - (lowest.y + lowest.r)).toBeGreaterThan(8);
    }
  });

  it('never touches the stick height when placing buttons', () => {
    for (const side of SIDES) {
      for (const placement of PLACEMENTS) {
        const stick = freshStick();
        const heights = { ...DEFAULT_REST_HEIGHTS, [side]: 0.77 };
        applyTouchLayout(side, placement, stick, freshButtons(), heights);
        expect(stick.anchor.y).toBe(0.77);
      }
    }
  });

  it('applies the resting height belonging to the stick side', () => {
    const heights = { left: 0.7, center: 0.9, right: 0.72 };
    for (const side of SIDES) {
      const stick = freshStick();
      applyTouchLayout(side, 'column', stick, freshButtons(), heights);
      expect(stick.anchor.y).toBe(heights[side]);
    }
  });

  it('rests a centred stick lower than a stick on either side', () => {
    expect(DEFAULT_REST_HEIGHTS.center).toBeGreaterThan(DEFAULT_REST_HEIGHTS.left);
    expect(DEFAULT_REST_HEIGHTS.center).toBeGreaterThan(DEFAULT_REST_HEIGHTS.right);
  });

  it('is idempotent', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyTouchLayout('center', 'column', stick, buttons);
    const once = {
      zone: { ...stick.zone },
      anchor: { ...stick.anchor },
      pos: buttons.map((b) => [b.cx, b.bottom]),
    };
    applyTouchLayout('center', 'column', stick, buttons);
    expect(stick.zone).toEqual(once.zone);
    expect(stick.anchor).toEqual(once.anchor);
    expect(buttons.map((b) => [b.cx, b.bottom])).toEqual(once.pos);
  });

  it('round-trips between placements and sides', () => {
    const stick = freshStick();
    const buttons = freshButtons();
    applyTouchLayout('right', 'side', stick, buttons);
    const original = buttons.map((b) => [b.cx, b.bottom]);
    applyTouchLayout('left', 'center', stick, buttons);
    applyTouchLayout('right', 'side', stick, buttons);
    expect(buttons.map((b) => [b.cx, b.bottom])).toEqual(original);
  });
});

describe('buttonScale', () => {
  it('is full size on a tall phone', () => {
    expect(buttonScale(PORTRAIT.h, HUD_WITH_DEBUG)).toBe(1);
  });

  it('is full size on a narrow phone: width never constrains a column', () => {
    expect(buttonScale(SMALL_PHONE.h, HUD_WITH_DEBUG)).toBe(1);
  });

  it('shrinks in landscape, where the column runs out of height', () => {
    expect(buttonScale(LANDSCAPE.h, HUD_WITH_DEBUG)).toBeLessThan(1);
  });

  it('shrinks further the more the HUD reserves', () => {
    const plain = buttonScale(LANDSCAPE.h, HUD_PLAIN);
    const withDebug = buttonScale(LANDSCAPE.h, HUD_WITH_DEBUG);
    expect(withDebug).toBeLessThan(plain);
  });

  it('stays full size in landscape once the debug overlay is off', () => {
    expect(buttonScale(LANDSCAPE.h, HUD_PLAIN)).toBe(1);
  });

  it('never shrinks past a usable thumb target', () => {
    const smallest = buttonScale(200, HUD_WITH_DEBUG);
    expect(smallest).toBeGreaterThanOrEqual(0.55);
    // The largest button must stay a tappable size.
    expect(42 * 2 * smallest).toBeGreaterThan(44);
  });
});
