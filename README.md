# Spaceshooter

A space exploration and combat game for the browser, built mobile-first.

Current state: **control sandbox**. Flight model and touch controls only — you
can fly a ship around an empty starfield and tune how it feels. Combat,
star systems, factions and story come in later iterations.

## Origin and licensing

This project was prompted by *Everyone's Sky*, a js13kGames entry, as a
reference for the kind of game we want: space exploration where the player's
choices decide who their friends and enemies are.

Nothing is ported from it. That game's source carries no licence, which means
all rights reserved, so its code and its writing are off limits. Game genres
and mechanics are not copyrightable, and this is an independent
implementation: our own engine, our own physics, our own art, our own text.

## Why this stack

TypeScript + Vite + Canvas 2D, no game engine.

- **No runtime dependencies.** The game is our code. Nothing to migrate when a
  framework ships a major version or loses its maintainer.
- **We own the game loop.** Fixed-timestep simulation with render
  interpolation, in about forty readable lines. Physics is deterministic and
  independent of refresh rate.
- **Logic is testable without a browser.** Ship physics and stick math are
  pure functions over numbers, so `vitest` covers them in milliseconds with no
  DOM.
- **Touch input is ours.** The joystick is roughly 150 lines of Pointer Events,
  which is less work than bending someone else's plugin to fit.
- **Small and fast to start.** Around 17 kB of JS, 7 kB gzipped.

The cost is that physics, camera and particles are hand-written. For a vector
space game at a few hundred entities that is a small bill. Rendering is kept
behind a thin layer, so swapping in WebGL later would not touch game logic.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run typecheck
npm run build
```

Open the dev server's Network URL on a phone on the same network to test the
real thing. Browser-level checks live in [`e2e/`](./e2e/README.md).

## Controls

| | |
|---|---|
| Touch | Left half of the screen steers. `FIRE` and `BST` sit bottom-right. |
| Keyboard | `WASD` or arrows to steer, `Space` to fire, `Shift` to boost. |
| Gamepad | Left stick steers, right stick aims, `A`/`RT` fires, `LT` boosts. |

Devices can be swapped mid-flight; whichever one is actively producing input
wins, with no mode to toggle.

### Control schemes

Tap `TUNE` to switch schemes and adjust handling live. Settings persist in
`localStorage`, so you can tune on the phone itself rather than guessing at a
desk.

- **Direct** — the stick direction is the thrust direction. Most forgiving
  under a thumb, least like a spacecraft.
- **Heading** *(default)* — the stick sets a target heading; the hull rotates
  toward it at a limited rate and thrusts along its nose. Reads as a ship
  while staying one-thumb driveable. `Off-axis thrust` controls how much push
  survives while still turning.
- **Tank** — stick X rotates, stick up throttles. Faithful to keyboard-era
  space games, hardest on a touchscreen.

The default is Heading. It is a guess until it has been in your hands, which
is what the sandbox is for.

## Touch design notes

Decisions that were made deliberately, and the reasons, so they are not
undone by accident:

- **Dead-zone travel is rescaled, not clipped.** Past the dead zone the stick
  resumes from zero rather than jumping to the dead-zone value, so small
  corrections stay small.
- **The dead zone is radial.** A per-axis dead zone cuts a square hole out of
  the centre and makes slow diagonal movement impossible.
- **One pointer id per control.** A thumb on `FIRE` can never steal or jitter
  the stick, and action buttons are bound in the capture phase so a press that
  lands on a button is not also read as a steer.
- **`pointercancel` is a release.** That is the event the OS sends when it
  takes the touch for a system gesture; ignoring it latches the stick on.
- **Pointer capture is best-effort.** `setPointerCapture` throws if the
  pointer is already gone, and an exception escaping `pointerdown` would leave
  the stick stuck on a pointer that never reports again.
- **The idle anchor is recomputed every frame.** It is a fraction of the
  viewport, so a rotation otherwise parks it off-screen.
- **Controls are drawn on the canvas.** No tap highlights, no text selection,
  and they animate with the scene instead of fighting the compositor.
- **Dynamic placement by default.** The stick appears under the thumb rather
  than demanding the thumb find it. `Fixed` is available for players who want
  a consistent spot.

## Layout

```
src/
  core/      engine primitives: loop, canvas/DPR, math, vectors
  input/     devices (touch stick, buttons, keyboard, gamepad) -> one ControlState
  game/      simulation: ship physics, camera, starfield
  render/    drawing only; reads simulation state, never writes it
  ui/        DOM overlay (tuning panel)
tests/       unit tests for logic that needs no browser
e2e/         browser-level checks
```

Input devices all reduce to a single `ControlState`, so physics never learns
which device is driving. Rendering is strictly downstream of simulation.

## Next

1. Weapons, projectiles, damage, and enemies worth shooting.
2. Procedural star systems and a galaxy to cross.
3. Factions with reputation that reacts to who you shoot and who you help.
4. Audio.
