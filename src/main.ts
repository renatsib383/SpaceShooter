import { beginFrame, createViewport } from './core/canvas';
import { createLoop } from './core/loop';
import { createCamera, defaultCameraTuning, updateCamera } from './game/camera';
import { defaultShipTuning } from './game/ship';
import { createWorld, updateWorld } from './game/world';
import { playerWeapon } from './game/weapon';
import { createStarfield, drawStarfield } from './game/starfield';
import { createGamepadDevice } from './input/gamepad';
import { createInputManager } from './input/input-manager';
import { applyTouchLayout, DEFAULT_REST_HEIGHTS } from './input/layout';
import { createKeyboard } from './input/keyboard';
import { createTouchButtons } from './input/touch-buttons';
import { createVirtualJoystick, defaultJoystickConfig } from './input/virtual-joystick';
import { drawCombatHud, drawDamageFlash } from './render/combat-hud';
import {
  drawEnemies,
  drawParticles,
  drawProjectiles,
  drawThreatMarkers,
} from './render/combat-renderer';
import { drawDebugOverlay } from './render/debug-overlay';
import { applyWorldTransform, type ViewTransform } from './render/view-transform';
import { drawShip, playerHull } from './render/ship-renderer';
import { drawJoystick, drawTouchButtons } from './render/touch-hud';
import { installDevHook } from './dev-hook';
import { ui } from './ui/strings';
import { createTuningPanel, loadSettings, type TunableSettings } from './ui/tuning-panel';

const canvas = document.querySelector<HTMLCanvasElement>('#stage');
const uiLayer = document.querySelector<HTMLDivElement>('#ui');
if (!canvas || !uiLayer) throw new Error('missing #stage or #ui in the document');

const view = createViewport(canvas);
const getSize = (): { width: number; height: number } => ({
  width: view.width,
  height: view.height,
});

const settings: TunableSettings = loadSettings({
  ship: { ...defaultShipTuning },
  stick: { ...defaultJoystickConfig, zone: { ...defaultJoystickConfig.zone }, anchor: { ...defaultJoystickConfig.anchor } },
  camera: { ...defaultCameraTuning },
  weapon: { ...playerWeapon },
  stickSide: 'center',
  stickHeight: { ...DEFAULT_REST_HEIGHTS },
  buttonPlacement: 'column',
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

const world = createWorld();
const ship = world.player.ship;
const camera = createCamera(0, 0);
const starfield = createStarfield();

const syncLayout = (): void => {
  applyTouchLayout(
    settings.stickSide,
    settings.buttonPlacement,
    settings.stick,
    buttons.visuals,
    settings.stickHeight,
  );
  hint.textContent = hintText();
};

createTuningPanel(uiLayer, settings, syncLayout);

installDevHook({
  world,
  ship,
  camera,
  input,
  joystick,
  buttons,
  settings,
  applyLayout: syncLayout,
  hudOpacity: () => touchHudOpacity,
});

const hintText = (): string => {
  const steer = ui.hint.steerArea[settings.stickSide];
  // Where the buttons ended up is derived from the layout, not guessed, so the
  // hint cannot drift out of step with it.
  const fire = buttons.visuals.find((b) => b.id === 'fire');
  const side = !fire ? 'center' : fire.cx < 0.4 ? 'left' : fire.cx > 0.6 ? 'right' : 'center';
  return ui.hint.line(steer, ui.hint.actionsAt[side]);
};

const hint = document.createElement('div');
hint.className = 'hint';
hint.style.whiteSpace = 'pre-line';
uiLayer.append(hint);

syncLayout();

// Fade the touch HUD in only once a touch has actually happened, so the
// desktop view is not cluttered with controls nobody can use.
//
// Presence is asked of the devices rather than tracked by a listener of our
// own: the buttons stop propagation when they claim a press, so a separate
// listener would miss a first touch that landed on a button and leave the
// whole HUD invisible.
let touchHudOpacity = 0;
const touchSeen = (): boolean => joystick.sawTouch || buttons.sawTouch;

// The hint explains the controls it sits next to, so it must not linger under
// them. Retire it as soon as any input arrives.
let hintRetired = false;

let time = 0;
let fps = 60;

const loop = createLoop({
  update(dt) {
    time += dt;
    joystick.update();
    buttons.update();
    const control = input.poll();
    updateWorld(
      world,
      { control, shipTuning: settings.ship, weaponTuning: settings.weapon },
      dt,
    );
    updateCamera(camera, ship, settings.camera, dt);

    if (!hintRetired && control.source !== 'none') {
      hintRetired = true;
      hint.classList.add('is-retired');
    }

    const wanted = touchSeen() ? (joystick.active || settings.stick.showIdle ? 1 : 0) : 0;
    touchHudOpacity += (wanted - touchHudOpacity) * Math.min(1, dt * 10);
  },
  render(alpha, frameDt) {
    if (frameDt > 0) fps += (1 / frameDt - fps) * 0.08;

    const ctx = beginFrame(view);
    const { width, height } = view;

    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, width, height);

    const viewTransform: ViewTransform = {
      camX: camera.pos.x,
      camY: camera.pos.y,
      zoom: camera.zoom,
      width,
      height,
    };
    drawStarfield(ctx, starfield, viewTransform);

    ctx.save();
    applyWorldTransform(ctx, viewTransform);
    drawParticles(ctx, world.particles.items);
    drawEnemies(ctx, world.enemies, alpha);
    drawProjectiles(ctx, world.projectiles.items, alpha);
    if (world.player.alive) {
      // Blink while protected, so spawn immunity is visible rather than a
      // surprise when it ends.
      const protectedNow = world.player.invulnerable > 0;
      ctx.globalAlpha = protectedNow && Math.floor(time * 10) % 2 === 0 ? 0.35 : 1;
      drawShip(ctx, ship, playerHull, alpha, time);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    drawThreatMarkers(ctx, world.enemies, viewTransform);
    drawDamageFlash(ctx, world.player.hitFlash, width, height);
    drawCombatHud(ctx, world, width, height, settings.showDebug ? 158 : 18);

    drawJoystick(ctx, joystick.visual, touchHudOpacity);
    drawTouchButtons(ctx, buttons.visuals, touchHudOpacity);

    if (settings.showDebug) {
      drawDebugOverlay(ctx, {
        fps,
        zoom: camera.zoom,
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
