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
| Actions | `ОГОНЬ` fires, `СТОП ОГОНЬ` stops and shoots in one press, `ФОРС` boosts. Braking cuts thrust and sheds speed in about a sixth of a second per halving, while leaving rotation at full rate — the point is to hold station and still be able to aim. |
| Touch | The stick takes half the screen — left, middle or right, under `НАСТРОЙКИ` > `Стик`. `ОГОНЬ` and `ФОРС` go in a vertical column (`Столбец`), spread over the opposite half (`Сбоку`), or stacked in the middle (`Центр`), under `НАСТРОЙКИ` > `Кнопки`. Default: centre stick, left column. |
| Keyboard | `WASD` or arrows to steer, `Space` to fire, `Shift` to boost, `B` or `Ctrl` to brake. Brake is deliberately not `S` or Down, which are a movement direction in every scheme. |
| Gamepad | Left stick steers, right stick aims, `A`/`RT` fires, `LT` boosts, `B`/`LB` brakes. |

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
- **One pointer id per control.** A thumb on an action button can never steal
  or jitter the stick, and action buttons are bound in the capture phase so a
  press that lands on one is not also read as a steer.
- **Stopping to shoot is its own button, not an overlap.** Braking while
  firing is one intent, so it gets one labelled target. An earlier version
  overlapped `ОГОНЬ` and a plain `СТОП` so a thumb in the shared band hit
  both; a button that does the combination says what it does.
- **The stick does not recentre while dragging.** Pulling the origin along
  behind the finger keeps long drags off the rim, but it reads as the control
  sliding out from under your thumb. Available under `Смещать центр`, off by
  default.
- **Buttons are anchored to the bottom edge in pixels, not as a fraction of
  height**, and scaled to the height actually left under the HUD. Fractions
  put the column in a different physical place on a tall phone than on a short
  landscape screen, and a full-size stack climbs into the HUD when the screen
  is 390 px tall. The reach of the column is derived from the button specs, so
  moving one cannot silently invalidate the fit.
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
  than demanding the thumb find it. `На месте` is available for players who
  want a consistent spot.
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
  tunable (`НАСТРОЙКИ` > `Высота стика`), so tuning the centre never disturbs
  the height set for a side stick.
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

## Interface language

The interface is Russian. Every player-facing string lives in
[`src/ui/strings.ts`](src/ui/strings.ts) rather than inline in the renderers,
so the whole interface can be read through in one file and a second language
is a matter of swapping that object.

Two details worth keeping: the hull bar starts after the *measured* width of
its label rather than a fixed offset, and the debug overlay pads labels to the
widest one — both were tuned to English word lengths and would have clipped
otherwise. Code, comments and this document stay in English.

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

The camera leads the ship in its direction of travel and pulls back as it
speeds up, so entering a turn at speed shows you what you are turning into.

Pull-back has two stages. Speed alone takes it from 1.0x at rest to 0.62x at
top speed; then a *sustained speed* accumulator carries it on to 0.42x over
about five seconds of continuous burn, so a long run keeps widening the view
instead of settling. The accumulator bleeds off in under two seconds — the
wide view should take a burn to earn and no time at all to lose.

Sustain ramps linearly rather than easing exponentially, so "five seconds at
full throttle" means exactly that instead of an asymptote that never quite
arrives. The zoom itself eases slower than the positional follow, or the whole
screen breathes on every throttle tap.

World-to-screen lives in one place (`render/view-transform.ts`). Zoom is why
that was worth naming: it has to reach the ships, the parallax starfield and
the off-screen threat markers alike, and three copies of the same subtraction
would have drifted apart. Star *size* stays in screen pixels while star
*positions* scale, or the far layers would vanish exactly when pulling back is
meant to reveal more.

Tunable live under `НАСТРОЙКИ`: `Отъезд на скорости`, `Отъезд на разгоне`,
`Время разгона`, `Плавность отъезда`, `Упреждение камеры`.

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
- **Player bolts home gently, and only forward.** A bolt acquires a target
  only inside a narrow cone ahead of it and within range, and turns no faster
  than its rate allows: enough to close a near miss, nowhere near enough to
  rescue a bad shot. Steering rotates the velocity and leaves its length
  alone, so speed, range and travel time are unchanged. Raiders fire straight
  — homing on both sides would leave the player nothing to dodge.
- **Homing picks the nearest target inside the cone**, not the nearest
  overall: choosing globally and then rejecting it would let a target just
  behind the bolt mask a valid one ahead.
- **Steering runs before the projectiles move**, or every bolt would correct
  one step late, which is visible at 820 px/s.
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
