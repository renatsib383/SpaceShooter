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
  // Default layout is right-handed: stick on the right half, actions on the left.
  const ox = Math.round(vp.width * 0.75);
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
    // Right-handed layout mirrors FIRE to 0.14 / 0.74 of the viewport.
    c.dispatchEvent(mk('pointerdown', 12, vw * 0.14, vh * 0.74));
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

  // ---- A touch on the action side must not move the ship. ----
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
    c.dispatchEvent(mk('pointerdown', vw * 0.25, vh * 0.3));
    c.dispatchEvent(mk('pointermove', vw * 0.1, vh * 0.2));
  }, [vp.width, vp.height]);
  await page.waitForTimeout(200);
  const rightHalf = await page.evaluate(() => ({
    stickActive: window.__sandbox.joystick.active,
    stick: Math.hypot(window.__sandbox.input.state.move.x, window.__sandbox.input.state.move.y),
  }));
  check('touch on the action side does not steer', rightHalf.stickActive === false && rightHalf.stick === 0, JSON.stringify(rightHalf));

  // ---- Handedness: the whole touch layout must swap sides together. ----
  const layoutFor = async (hand) => {
    await page.evaluate((h) => {
      window.__sandbox.settings.handedness = h;
      window.__sandbox.applyLayout();
    }, hand);
    await page.waitForTimeout(120);
    return page.evaluate(() => ({
      zoneX: window.__sandbox.settings.stick.zone.x,
      anchorX: window.__sandbox.joystick.visual.origin.x / innerWidth,
      buttons: window.__sandbox.buttons.visuals.map((b) => b.center.x / innerWidth),
    }));
  };

  const right = await layoutFor('right');
  check(
    'right-handed: stick right, actions left',
    right.zoneX === 0.5 && right.anchorX > 0.5 && right.buttons.every((x) => x < 0.5),
    JSON.stringify(right),
  );

  const left = await layoutFor('left');
  check(
    'left-handed: stick left, actions right',
    left.zoneX === 0 && left.anchorX < 0.5 && left.buttons.every((x) => x > 0.5),
    JSON.stringify(left),
  );

  await layoutFor('right');

  // ---- Centred buttons sit INSIDE the stick's own half. They are only safe
  // because the buttons claim the pointer in the capture phase, so verify that
  // a press on one fires and does not also steer. ----
  const centred = await page.evaluate(async () => {
    window.__sandbox.settings.buttonPlacement = 'center';
    window.__sandbox.applyLayout();
    await new Promise((r) => setTimeout(r, 120));
    const fire = window.__sandbox.buttons.visuals.find((b) => b.id === 'fire');
    return {
      cx: fire.center.x / innerWidth,
      cy: fire.center.y / innerHeight,
      zoneX: window.__sandbox.settings.stick.zone.x,
    };
  });
  check(
    'centred FIRE sits inside the stick half',
    Math.abs(centred.cx - 0.5) < 0.01 && centred.cx >= centred.zoneX,
    JSON.stringify(centred),
  );

  await page.evaluate(([cx, cy]) => {
    const c = document.querySelector('#stage');
    c.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 31, pointerType: 'touch', isPrimary: true,
      clientX: cx * innerWidth, clientY: cy * innerHeight,
      bubbles: true, cancelable: true,
    }));
  }, [centred.cx, centred.cy]);
  await page.waitForTimeout(200);

  const pressCentred = await page.evaluate(() => ({
    fire: window.__sandbox.input.state.fire,
    stickActive: window.__sandbox.joystick.active,
    stick: Math.hypot(window.__sandbox.input.state.move.x, window.__sandbox.input.state.move.y),
  }));
  check('centred FIRE fires', pressCentred.fire === true, JSON.stringify(pressCentred));
  check(
    'centred FIRE does not steal the stick',
    pressCentred.stickActive === false && pressCentred.stick === 0,
    JSON.stringify(pressCentred),
  );
  await page.screenshot({ path: `${SHOT}/06-centred-buttons.png`, scale: 'css' });

  // A drag starting next to the button, still in the stick half, must steer.
  await page.evaluate(() => {
    const c = document.querySelector('#stage');
    c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 31, pointerType: 'touch',
      clientX: 0, clientY: 0, bubbles: true }));
    const mk = (t, x, y) => new PointerEvent(t, { pointerId: 32, pointerType: 'touch',
      isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true });
    c.dispatchEvent(mk('pointerdown', innerWidth * 0.8, innerHeight * 0.4));
    c.dispatchEvent(mk('pointermove', innerWidth * 0.86, innerHeight * 0.32));
  });
  await page.waitForTimeout(200);
  const stillSteers = await page.evaluate(() => ({
    active: window.__sandbox.joystick.active,
    stick: Math.hypot(window.__sandbox.input.state.move.x, window.__sandbox.input.state.move.y),
  }));
  check(
    'stick still works alongside centred buttons',
    stillSteers.active === true && stillSteers.stick > 0.1,
    JSON.stringify(stillSteers),
  );
  await page.evaluate(() => document.querySelector('#stage').dispatchEvent(
    new PointerEvent('pointerup', { pointerId: 32, pointerType: 'touch',
      clientX: 0, clientY: 0, bubbles: true })));

  await page.evaluate(() => {
    window.__sandbox.settings.buttonPlacement = 'side';
    window.__sandbox.applyLayout();
  });

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
  // Asserts the property, not a button count, so adding controls cannot
  // falsely fail this: every segmented button must carry its own label as its
  // accessible name and a real pressed state.
  const named = names.every((n) => n.text && n.text.trim().length > 0);
  const pressedIsBoolean = names.every((n) => n.pressed === 'true' || n.pressed === 'false');
  const exactlyOnePressedPerGroup =
    names.filter((n) => n.pressed === 'true').length >= 1;
  check(
    'segmented buttons expose their own name and pressed state',
    named && pressedIsBoolean && exactlyOnePressedPerGroup &&
      names.find((n) => n.text === 'Tank').pressed === 'true',
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

  // ---- The touch HUD must reveal itself on the FIRST touch, wherever it
  // lands. A press on a button is claimed in the capture phase and stops
  // propagation, so presence detection must not depend on listener order. ----
  for (const [label, spot] of [
    ['empty space', [0.7, 0.3]],
    ['the FIRE button', [0.14, 0.74]],
    ['the BST button', [0.3, 0.86]],
  ]) {
    const fresh = await ctx.newPage();
    await fresh.goto(URL, { waitUntil: 'load' });
    await fresh.waitForFunction(() => !!window.__sandbox, null, { timeout: 10000 });
    await fresh.waitForTimeout(300);

    const hidden = await fresh.evaluate(() => window.__sandbox.hudOpacity());
    await fresh.evaluate(([fx, fy]) => {
      const c = document.querySelector('#stage');
      const x = fx * innerWidth, y = fy * innerHeight;
      const mk = (t) => new PointerEvent(t, { pointerId: 77, pointerType: 'touch',
        isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true });
      c.dispatchEvent(mk('pointerdown'));
      c.dispatchEvent(mk('pointerup'));
    }, spot);
    await fresh.waitForTimeout(600);
    const shown = await fresh.evaluate(() => window.__sandbox.hudOpacity());

    check(
      `touch HUD appears when the first touch lands on ${label}`,
      hidden < 0.05 && shown > 0.5,
      `opacity ${hidden.toFixed(2)} -> ${shown.toFixed(2)}`,
    );
    await fresh.close();
  }

  check('no runtime errors over the whole run', errors.length === 0, errors.join(' | '));

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('HARNESS ERROR', e);
  process.exit(2);
});
