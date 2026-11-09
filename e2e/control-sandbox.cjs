const { chromium, devices } = require('playwright');

const SHOT = '/tmp/claude-0/-home-user-SpaceShooter/2fe12533-9013-58c0-9bf7-035782d8c0a4/scratchpad/e2e';
const URL = 'http://localhost:5173/';

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__sandbox, null, { timeout: 10000 });
  await page.waitForTimeout(500);

  const vp = page.viewportSize();
  check('page loads with no console errors', errors.length === 0, errors.join(' | '));

  // Canvas is sized to the full viewport at the capped DPR.
  const canvasInfo = await page.evaluate(() => {
    const c = document.querySelector('#stage');
    const r = c.getBoundingClientRect();
    return { cssW: r.width, cssH: r.height, bufW: c.width, bufH: c.height, dpr: devicePixelRatio };
  });
  check(
    'canvas fills viewport and respects DPR cap',
    Math.abs(canvasInfo.cssW - vp.width) < 2 &&
      canvasInfo.bufW === Math.round(canvasInfo.cssW * Math.min(canvasInfo.dpr, 2)),
    JSON.stringify(canvasInfo),
  );

  // ---- Idle: ship must not drift. ----
  const idle = await page.evaluate(() => {
    const s = window.__sandbox.ship;
    return { x: s.pos.x, y: s.pos.y, speed: Math.hypot(s.vel.x, s.vel.y) };
  });
  check('ship is still before any input', idle.speed === 0, JSON.stringify(idle));
  await page.screenshot({ path: `${SHOT}/01-idle.png`, scale: 'css' });

  // ---- Touch drag on the left half drives the stick. ----
  const ox = Math.round(vp.width * 0.25);
  const oy = Math.round(vp.height * 0.7);
  await page.touchscreen.tap(ox, oy); // wake the touch HUD

  // Hold a drag up-and-right using raw pointer events with a real pointerId.
  await page.evaluate(
    ([x, y]) => {
      const c = document.querySelector('#stage');
      const mk = (type, cx, cy) =>
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: 'touch',
          isPrimary: true,
          clientX: cx,
          clientY: cy,
          bubbles: true,
          cancelable: true,
        });
      c.dispatchEvent(mk('pointerdown', x, y));
      c.dispatchEvent(mk('pointermove', x + 40, y - 55));
    },
    [ox, oy],
  );
  await page.waitForTimeout(900);

  const dragged = await page.evaluate(() => {
    const s = window.__sandbox.ship;
    const st = window.__sandbox.input.state;
    const j = window.__sandbox.joystick;
    return {
      active: j.active,
      stick: { x: st.move.x, y: st.move.y },
      source: st.source,
      speed: Math.hypot(s.vel.x, s.vel.y),
      throttle: s.throttle,
      scheme: window.__sandbox.settings.ship.scheme,
    };
  });
  check('joystick captures the touch', dragged.active === true, JSON.stringify(dragged));
  check(
    'stick reports up-right direction',
    dragged.stick.x > 0.2 && dragged.stick.y < -0.2,
    JSON.stringify(dragged.stick),
  );
  check('input source is touch', dragged.source === 'touch', dragged.source);
  check('ship accelerates while held', dragged.speed > 20, `speed=${dragged.speed.toFixed(1)}`);
  await page.screenshot({ path: `${SHOT}/02-stick-held.png`, scale: 'css' });

  // ---- Release: stick zeroes, momentum remains. ----
  await page.evaluate(([x, y]) => {
    document.querySelector('#stage').dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 7, pointerType: 'touch', isPrimary: true,
        clientX: x + 40, clientY: y - 55, bubbles: true, cancelable: true,
      }),
    );
  }, [ox, oy]);
  await page.waitForTimeout(200);

  const released = await page.evaluate(() => {
    const st = window.__sandbox.input.state;
    const s = window.__sandbox.ship;
    return {
      active: window.__sandbox.joystick.active,
      stick: Math.hypot(st.move.x, st.move.y),
      speed: Math.hypot(s.vel.x, s.vel.y),
    };
  });
  check('stick zeroes on release', released.active === false && released.stick === 0, JSON.stringify(released));
  check('ship keeps momentum after release', released.speed > 5, `speed=${released.speed.toFixed(1)}`);

  // ---- pointercancel (OS gesture steals the touch) must release cleanly. ----
  await page.evaluate(([x, y]) => {
    const c = document.querySelector('#stage');
    const mk = (type, cx, cy) => new PointerEvent(type, {
      pointerId: 9, pointerType: 'touch', isPrimary: true,
      clientX: cx, clientY: cy, bubbles: true, cancelable: true,
    });
    c.dispatchEvent(mk('pointerdown', x, y));
    c.dispatchEvent(mk('pointermove', x + 60, y));
    c.dispatchEvent(mk('pointercancel', x + 60, y));
  }, [ox, oy]);
  await page.waitForTimeout(150);
  const cancelled = await page.evaluate(() => ({
    active: window.__sandbox.joystick.active,
    stick: Math.hypot(window.__sandbox.input.state.move.x, window.__sandbox.input.state.move.y),
  }));
  check('pointercancel releases the stick', cancelled.active === false && cancelled.stick === 0, JSON.stringify(cancelled));

  // ---- Two thumbs: steer and fire at once. ----
  await page.evaluate(([x, y, vw, vh]) => {
    const c = document.querySelector('#stage');
    const mk = (type, id, cx, cy) => new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', isPrimary: id === 11,
      clientX: cx, clientY: cy, bubbles: true, cancelable: true,
    });
    c.dispatchEvent(mk('pointerdown', 11, x, y));
    c.dispatchEvent(mk('pointermove', 11, x, y - 60));
    // FIRE sits at 0.86 / 0.74 of the viewport.
    c.dispatchEvent(mk('pointerdown', 12, vw * 0.86, vh * 0.74));
  }, [ox, oy, vp.width, vp.height]);
  await page.waitForTimeout(300);

  const twoThumb = await page.evaluate(() => {
    const st = window.__sandbox.input.state;
    return {
      stick: Math.hypot(st.move.x, st.move.y),
      fire: st.fire,
      source: st.source,
      stickActive: window.__sandbox.joystick.active,
    };
  });
  check(
    'fire button does not steal the stick',
    twoThumb.stickActive === true && twoThumb.stick > 0.2,
    JSON.stringify(twoThumb),
  );
  check('fire registers while steering', twoThumb.fire === true, JSON.stringify(twoThumb));
  await page.screenshot({ path: `${SHOT}/03-two-thumbs.png`, scale: 'css' });

  // ---- A touch on the right half must not move the ship. ----
  await page.evaluate(([vw, vh]) => {
    const c = document.querySelector('#stage');
    ['pointerup'].forEach((t) => {
      c.dispatchEvent(new PointerEvent(t, { pointerId: 11, pointerType: 'touch', clientX: 0, clientY: 0, bubbles: true }));
      c.dispatchEvent(new PointerEvent(t, { pointerId: 12, pointerType: 'touch', clientX: 0, clientY: 0, bubbles: true }));
    });
    const mk = (type, cx, cy) => new PointerEvent(type, {
      pointerId: 21, pointerType: 'touch', isPrimary: true,
      clientX: cx, clientY: cy, bubbles: true, cancelable: true,
    });
    c.dispatchEvent(mk('pointerdown', vw * 0.75, vh * 0.3));
    c.dispatchEvent(mk('pointermove', vw * 0.9, vh * 0.2));
  }, [vp.width, vp.height]);
  await page.waitForTimeout(200);
  const rightHalf = await page.evaluate(() => ({
    stickActive: window.__sandbox.joystick.active,
    stick: Math.hypot(window.__sandbox.input.state.move.x, window.__sandbox.input.state.move.y),
  }));
  check('right-half touch does not steer', rightHalf.stickActive === false && rightHalf.stick === 0, JSON.stringify(rightHalf));

  // ---- Tuning panel opens and schemes switch. ----
  await page.evaluate(() => {
    document.querySelector('#stage').dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 21, pointerType: 'touch', clientX: 0, clientY: 0, bubbles: true }));
  });
  await page.getByRole('button', { name: 'TUNE' }).click();
  await page.waitForTimeout(200);
  const panelOpen = await page.locator('.panel-body').isVisible();
  check('tuning panel opens', panelOpen);
  await page.screenshot({ path: `${SHOT}/04-tuning-panel.png`, scale: 'css' });

  await page.getByRole('button', { name: 'Tank', exact: true }).click();
  await page.waitForTimeout(150);
  const scheme = await page.evaluate(() => window.__sandbox.settings.ship.scheme);
  check('scheme switch applies live', scheme === 'tank', scheme);

  const names = await page.evaluate(() =>
    [...document.querySelectorAll('.segmented button')].map((b) => ({
      text: b.textContent,
      pressed: b.getAttribute('aria-pressed'),
    })));
  check(
    'segmented buttons expose their own name and pressed state',
    names.length === 5 && names.find((n) => n.text === 'Tank').pressed === 'true',
    JSON.stringify(names),
  );

  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('spaceshooter.tuning.v1')).ship.scheme);
  check('tuning persists to localStorage', persisted === 'tank', persisted);

  // ---- Rotation to landscape keeps everything sane. ----
  await page.getByRole('button', { name: 'TUNE' }).click();
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await page.waitForTimeout(400);
  const afterRotate = await page.evaluate(() => {
    const c = document.querySelector('#stage');
    const r = c.getBoundingClientRect();
    return { cssW: r.width, bufW: c.width, dpr: Math.min(devicePixelRatio, 2) };
  });
  check(
    'canvas resizes on rotation',
    Math.abs(afterRotate.cssW - vp.height) < 2 &&
      afterRotate.bufW === Math.round(afterRotate.cssW * afterRotate.dpr),
    JSON.stringify(afterRotate),
  );
  // The idle stick anchor is a fraction of the viewport, so it must follow a
  // rotation instead of staying parked off the bottom of the new layout.
  const anchor = await page.evaluate(() => ({
    origin: { ...window.__sandbox.joystick.visual.origin },
    w: innerWidth,
    h: innerHeight,
  }));
  check(
    'idle stick anchor stays on screen after rotation',
    anchor.origin.x > 0 && anchor.origin.x < anchor.w &&
      anchor.origin.y > 0 && anchor.origin.y < anchor.h,
    JSON.stringify(anchor),
  );

  // Live tuning must reach the drawn stick even while nothing is touching it.
  await page.evaluate(() => { window.__sandbox.settings.stick.radius = 110; });
  await page.waitForTimeout(150);
  const liveRadius = await page.evaluate(() => window.__sandbox.joystick.visual.radius);
  check('radius changes reach the idle stick', liveRadius === 110, String(liveRadius));
  await page.evaluate(() => { window.__sandbox.settings.stick.radius = 64; });

  await page.screenshot({ path: `${SHOT}/05-landscape.png`, scale: 'css' });

  check('no runtime errors over the whole run', errors.length === 0, errors.join(' | '));

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('HARNESS ERROR', e);
  process.exit(2);
});
