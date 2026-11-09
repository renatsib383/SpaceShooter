# Spaceshooter

A space exploration and combat game for the browser, built mobile-first.

Current state: **playable combat loop**. Fly, shoot, get shot at, die and
respawn, with raiders that hunt you. Star systems, factions and story come in
later iterations.

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

Vite prints two URLs. `Local` works only on the machine running it; `Network`
is that machine's address on your LAN — open it on a phone joined to the same
Wi-Fi to test the real thing. Browser-level checks live in
[`e2e/`](./e2e/README.md).

## Deployment

Every push to the default branch builds and publishes to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), after
typecheck and tests pass.

One-time setup, done by hand in **Settings > Pages > Build and deployment**:
set **Source** to **GitHub Actions**. The workflow cannot do this itself —
`GITHUB_TOKEN` has no `administration` permission, so the API refuses to
create the Pages site. That gives the game a plain URL to open on a phone,
which beats hunting for a LAN address on networks that isolate clients.

The build uses a relative `base`, so it works from a project Pages subpath
(`/SpaceShooter/`) without further configuration.

## Controls

| | |
|---|---|
| Touch | The stick takes half the screen — left, middle or right, under `TUNE` > `Stick side`. `FIRE` and `BST` go in a vertical `Column`, spread over the opposite half (`Side`), or stacked in the middle (`Center`), under `TUNE` > `Buttons`. Default: centre stick, left column. |
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
- **The stick and the buttons are placed together.** `Side` and `Column` always
  keep the buttons clear of the stick's zone, mirroring to the free side when
  the stick would otherwise sit on top of them — a left stick pushes the column
  to the right edge. Both are derived from canonical positions rather than
  flipped in place, so applying a layout twice cannot drift.
- **Button centres are recomputed every frame**, for the same reason the stick
  anchor is: they are fractions of the viewport.
- **Centred buttons sit inside the stick's own half on purpose.** That is only
  safe because the buttons claim their pointer in the capture phase and stop
  propagation, so a press is never also read as a steer. Change that ordering
  and centred placement breaks.
- **Centred buttons stay off the very bottom band**, which is the home
  indicator on most phones and a source of accidental system gestures.
- **The stick rests low, and a centred stick rests lowest.** A side stick sits
  under a thumb already curled around the edge of the phone; a centred stick
  has to be reached across the palm, which only works near the bottom — and
  drawn any higher it covers the ship. Height is held per stick side and is
  tunable (`TUNE` > `Stick height`), so tuning the centre never disturbs the
  height set for a side stick.
- **The resting ring is clamped on screen.** Height and radius are tuned
  independently, so a large radius low down would otherwise draw a stick
  sliced off by the bottom edge.
- **The hint retires on first input.** It describes the controls it sits next
  to, so it must not linger underneath them.
- **Touch presence is asked of the devices, not tracked by a listener.** The
  buttons stop propagation when they claim a press, so a separate listener
  misses a first touch that lands on a button and the whole HUD stays
  invisible. Each device reports its own truth instead, which cannot be
  broken by listener ordering.

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

## Camera

The camera leads the ship in its direction of travel, and pulls back as it
speeds up — 1.0x at rest down to 0.62x at top speed — so entering a turn at
speed shows you what you are turning into. Both the follow and the zoom use
exponential easing, exact at any timestep, and the zoom eases slower than the
follow on purpose: a zoom that tracks speed exactly makes the whole screen
breathe on every throttle tap.

World-to-screen lives in one place (`render/view-transform.ts`). Zoom is why
that was worth naming: it has to reach the ships, the parallax starfield and
the off-screen threat markers alike, and three copies of the same subtraction
would have drifted apart. Star *size* stays in screen pixels while star
*positions* scale, or the far layers would vanish exactly when pulling back is
meant to reveal more.

Tunable live under `TUNE`: `Zoom at speed`, `Zoom ease`, `Look ahead`.

## Combat

Raiders arrive on a timer up to a cap, close to a preferred range and hold it
rather than ramming, and shoot when they are lined up and in range. Flying
into one damages both of you, so ramming is a trade and not a free kill.

Decisions worth keeping:

- **Projectile hits are swept, not sampled.** A bolt at 820 px/s moves about
  7 px per simulation step, already comparable to a small hitbox; testing only
  the end position tunnels straight through a target. Collision measures the
  distance from the target to the segment actually travelled.
- **Nothing is allocated during play.** Projectiles and particles live in
  fixed-capacity pools. A full projectile pool drops the shot *without*
  starting the weapon cooldown — otherwise running out of pool would silently
  halve the fire rate instead of showing up as the tuning bug it is.
- **Shots inherit the shooter's velocity**, so firing from a moving ship sends
  bolts where they are aimed rather than trailing behind.
- **Weapon cooldown never runs negative**, or idling would bank up free shots.
- **Off-screen raiders get an edge marker.** With this much inertia the thing
  shooting you is often outside the viewport, and without a marker the only
  feedback is the hull dropping, which reads as unfair rather than hard.
- **Spawn protection is modelled as "not a target"**, one flag covering bolts
  and ramming alike, and it is re-granted on respawn so deaths cannot chain.

## Next

1. Procedural star systems and a galaxy to cross.
2. Factions with reputation that reacts to who you shoot and who you help.
3. Audio.
