import { beginFrame, createViewport } from './core/canvas';
import { createLoop } from './core/loop';
import { createCamera, updateCamera } from './game/camera';
import { createShip, defaultShipTuning, updateShip } from './game/ship';
import { createStarfield, drawStarfield } from './game/starfield';
import { createGamepadDevice } from './input/gamepad';
import { createInputManager } from './input/input-manager';
import { applyHandedness } from './input/layout';
import { createKeyboard } from './input/keyboard';
import { createTouchButtons } from './input/touch-buttons';
import { createVirtualJoystick, defaultJoystickConfig } from './input/virtual-joystick';
import { drawDebugOverlay } from './render/debug-overlay';
import { drawShip, playerHull } from './render/ship-renderer';
import { drawJoystick, drawTouchButtons } from './render/touch-hud';
import { installDevHook } from './dev-hook';
import { createTuningPanel, loadSettings, type TunableSettings } from './ui/tuning-panel';

const canvas = document.querySelector<HTMLCanvasElement>('#stage');
const ui = document.querySelector<HTMLDivElement>('#ui');
if (!canvas || !ui) throw new Error('missing #stage or #ui in the document');

const view = createViewport(canvas);
const getSize = (): { width: number; height: number } => ({
  width: view.width,
  height: view.height,
});

const settings: TunableSettings = loadSettings({
  ship: { ...defaultShipTuning },
  stick: { ...defaultJoystickConfig, zone: { ...defaultJoystickConfig.zone }, anchor: { ...defaultJoystickConfig.anchor } },
  handedness: 'right',
  showDebug: true,
});

// Touch surface is the canvas itself: the stick claims the left half of the
// screen, the action buttons sit on the right, and both read from the same
// pointer stream so a two-thumb grip works.
const joystick = createVirtualJoystick(canvas, getSize, settings.stick);
const buttons = createTouchButtons(canvas, getSize);
const input = createInputManager([
  createKeyboard(),
  createGamepadDevice(),
  buttons,
  joystick,
]);

const ship = createShip(0, 0);
const camera = createCamera(0, 0);
const starfield = createStarfield();

const syncLayout = (): void => {
  applyHandedness(settings.handedness, settings.stick, buttons.visuals);
  hint.textContent = hintText();
};

createTuningPanel(ui, settings, syncLayout);

installDevHook({ ship, camera, input, joystick, buttons, settings, applyLayout: syncLayout });

const hintText = (): string => {
  const steer = settings.handedness === 'right' ? 'right' : 'left';
  const actions = settings.handedness === 'right' ? 'left' : 'right';
  return (
    `Touch the ${steer} half to steer · FIRE / BST on the ${actions}\n` +
    'WASD or arrows + Space on desktop · gamepad supported'
  );
};

const hint = document.createElement('div');
hint.className = 'hint';
hint.style.whiteSpace = 'pre-line';
ui.append(hint);

syncLayout();

// Fade the touch HUD in only once a touch has actually happened, so the
// desktop view is not cluttered with controls nobody can use.
let touchHudOpacity = 0;
let touchSeen = false;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' || e.pointerType === 'pen') touchSeen = true;
});

let time = 0;
let fps = 60;

const loop = createLoop({
  update(dt) {
    time += dt;
    joystick.update();
    buttons.update();
    const control = input.poll();
    updateShip(ship, control, settings.ship, dt);
    updateCamera(camera, ship, dt);

    const wanted = touchSeen ? (joystick.active || settings.stick.showIdle ? 1 : 0) : 0;
    touchHudOpacity += (wanted - touchHudOpacity) * Math.min(1, dt * 10);
  },
  render(alpha, frameDt) {
    if (frameDt > 0) fps += (1 / frameDt - fps) * 0.08;

    const ctx = beginFrame(view);
    const { width, height } = view;

    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, width, height);

    const camX = camera.pos.x - width / 2;
    const camY = camera.pos.y - height / 2;
    drawStarfield(ctx, starfield, camX, camY, width, height);

    ctx.save();
    ctx.translate(-camX, -camY);
    drawShip(ctx, ship, playerHull, alpha, time);
    ctx.restore();

    drawJoystick(ctx, joystick.visual, touchHudOpacity);
    drawTouchButtons(ctx, buttons.visuals, touchHudOpacity);

    if (settings.showDebug) {
      drawDebugOverlay(ctx, {
        fps,
        control: input.state,
        ship,
        tuning: settings.ship,
      });
    }
  },
});

loop.start();

// Pause while the tab is hidden: the loop's frame cap would otherwise hand the
// simulation one huge catch-up step the moment the player comes back.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else loop.start();
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    loop.stop();
    input.dispose();
    view.dispose();
  });
}
