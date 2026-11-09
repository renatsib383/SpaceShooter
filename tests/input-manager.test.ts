import { describe, expect, it } from 'vitest';
import { createInputManager } from '../src/input/input-manager';
import type { ControlState, InputDevice } from '../src/input/types';

function stub(write: (out: ControlState) => void): InputDevice {
  return { sample: write, dispose: () => {} };
}

describe('createInputManager', () => {
  it('reports no source when every device is idle', () => {
    const state = createInputManager([stub(() => {})]).poll();
    expect(state.source).toBe('none');
    expect(state.moving).toBe(false);
    expect(state.move).toEqual({ x: 0, y: 0 });
  });

  it('lets a later active device override an earlier one', () => {
    const input = createInputManager([
      stub((o) => {
        o.move.x = 1;
        o.moving = true;
        o.source = 'keyboard';
      }),
      stub((o) => {
        o.move.x = -1;
        o.moving = true;
        o.source = 'touch';
      }),
    ]);
    const state = input.poll();
    expect(state.move.x).toBe(-1);
    expect(state.source).toBe('touch');
  });

  it('keeps an earlier device when the later one is idle', () => {
    const input = createInputManager([
      stub((o) => {
        o.move.x = 1;
        o.moving = true;
        o.source = 'keyboard';
      }),
      stub(() => {}),
    ]);
    const state = input.poll();
    expect(state.move.x).toBe(1);
    expect(state.source).toBe('keyboard');
  });

  it('ORs the action buttons across devices', () => {
    const input = createInputManager([
      stub((o) => {
        o.fire = true;
      }),
      stub((o) => {
        o.boost = true;
      }),
    ]);
    const state = input.poll();
    expect(state.fire).toBe(true);
    expect(state.boost).toBe(true);
  });

  it('clears stale input between polls', () => {
    let active = true;
    const input = createInputManager([
      stub((o) => {
        if (!active) return;
        o.move.x = 1;
        o.moving = true;
        o.fire = true;
        o.source = 'touch';
      }),
    ]);
    input.poll();
    active = false;
    const state = input.poll();
    expect(state.move.x).toBe(0);
    expect(state.fire).toBe(false);
    expect(state.moving).toBe(false);
    expect(state.source).toBe('none');
  });
});
