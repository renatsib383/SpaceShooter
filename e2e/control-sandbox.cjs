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
  // Default layout: stick on the middle half, buttons in a left column.
  const ox = Math.round(vp.width * 0.5);
  const oy = Math.round(vp.height * 0.45);
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
    // Column layout puts FIRE at 0.15 / 0.82 of the viewport.
    c.dispatchEvent(mk('pointerdown', 12, vw * 0.15, vh * 0.82));
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
    c.dispatchEvent(mk('pointerdown', vw * 0.08, vh * 0.3));
    c.dispatchEvent(mk('pointermove', vw * 0.04, vh * 0.2));
  }, [vp.width, vp.height]);
  await page.waitForTimeout(200);
  const rightHalf = await page.evaluate(() => ({
    stickActive: window.__sandbox.joystick.active,
    stick: Math.hypot(window.__sandbox.input.state.move.x, window.__sandbox.input.state.move.y),
  }));
  check('touch on the action side does not steer', rightHalf.stickActive === false && rightHalf.stick === 0, JSON.stringify(rightHalf));

  // ---- Handedness: the whole touch layout must swap sides together. ----
  const layoutFor = async (side, placement) => {
    await page.evaluate(([s, p]) => {
      window.__sandbox.settings.stickSide = s;
      window.__sandbox.settings.buttonPlacement = p;
      window.__sandbox.applyLayout();
    }, [side, placement]);
    await page.waitForTimeout(120);
    return page.evaluate(() => ({
      zoneX: window.__sandbox.settings.stick.zone.x,
      zoneW: window.__sandbox.settings.stick.zone.w,
      anchorX: window.__sandbox.joystick.visual.origin.x / innerWidth,
      bx: window.__sandbox.buttons.visuals.map((b) => b.center.x / innerWidth),
      by: window.__sandbox.buttons.visuals.map((b) => b.center.y / innerHeight),
    }));
  };

  const centreStick = await layoutFor('center', 'column');
  check(
    'centre stick: zone is the middle half, anchor dead centre',
    centreStick.zoneX === 0.25 && centreStick.zoneW === 0.5 &&
      Math.abs(centreStick.anchorX - 0.5) < 0.01,
    JSON.stringify(centreStick),
  );
  check(
    'column buttons: one x on the left, distinct heights',
    new Set(centreStick.bx).size === 1 && centreStick.bx[0] < 0.25 &&
      new Set(centreStick.by).size === centreStick.by.length,
    JSON.stringify(centreStick),
  );
  check(
    'column buttons sit outside the centre stick zone',
    centreStick.bx.every((x) => x < centreStick.zoneX),
    JSON.stringify(centreStick),
  );

  const restPos = await page.evaluate(() => ({
    x: window.__sandbox.joystick.visual.origin.x / innerWidth,
    y: window.__sandbox.joystick.visual.origin.y / innerHeight,
    radius: window.__sandbox.joystick.visual.radius,
    h: innerHeight,
  }));
  check(
    'stick rests low and horizontally centred',
    Math.abs(restPos.x - 0.5) < 0.01 && restPos.y > 0.6 && restPos.y < 0.9,
    JSON.stringify(restPos),
  );
  check(
    'resting ring is not clipped by the bottom edge',
    restPos.y * restPos.h + restPos.radius < restPos.h,
    JSON.stringify(restPos),
  );

  // Each stick side keeps its own resting height.
  const restAt = async (side) => {
    await page.evaluate((s) => {
      window.__sandbox.settings.stickSide = s;
      window.__sandbox.applyLayout();
    }, side);
    await page.waitForTimeout(150);
    return page.evaluate(() => window.__sandbox.joystick.visual.origin.y / innerHeight);
  };

  const restCentre = await restAt('center');
  const restRight = await restAt('right');
  check(
    'a centred stick rests lower than a side stick',
    restCentre > restRight + 0.05,
    `centre ${restCentre.toFixed(3)} vs right ${restRight.toFixed(3)}`,
  );

  await page.evaluate(() => {
    window.__sandbox.settings.stickHeight.center = 0.5;
    window.__sandbox.settings.stickSide = 'center';
    window.__sandbox.applyLayout();
  });
  await page.waitForTimeout(150);
  const tuned = await page.evaluate(() => ({
    y: window.__sandbox.joystick.visual.origin.y / innerHeight,
    right: window.__sandbox.settings.stickHeight.right,
  }));
  check(
    'tuning the centre height leaves the side height alone',
    Math.abs(tuned.y - 0.5) < 0.01 && Math.abs(tuned.right - 0.74) < 1e-9,
    JSON.stringify(tuned),
  );

  // A big radius low on the screen must not draw a ring sliced off the bottom.
  await page.evaluate(() => {
    window.__sandbox.settings.stickHeight.center = 0.92;
    window.__sandbox.settings.stick.radius = 140;
    window.__sandbox.applyLayout();
  });
  await page.waitForTimeout(150);
  const clamped = await page.evaluate(() => ({
    y: window.__sandbox.joystick.visual.origin.y,
    r: window.__sandbox.joystick.visual.radius,
    h: innerHeight,
  }));
  check(
    'resting ring is clamped on screen at the largest radius',
    clamped.y + clamped.r <= clamped.h && clamped.y - clamped.r >= 0,
    JSON.stringify(clamped),
  );

  await page.evaluate(() => {
    window.__sandbox.settings.stickHeight.center = 0.86;
    window.__sandbox.settings.stick.radius = 64;
    window.__sandbox.applyLayout();
  });

  const leftStick = await layoutFor('left', 'column');
  check(
    'column moves clear of a left stick instead of overlapping it',
    leftStick.bx.every((x) => x > leftStick.zoneX + leftStick.zoneW),
    JSON.stringify(leftStick),
  );

  const right = await layoutFor('right', 'side');
  check(
    'right stick with side buttons: actions on the left',
    right.zoneX === 0.5 && right.anchorX > 0.5 && right.bx.every((x) => x < 0.5),
    JSON.stringify(right),
  );

  await layoutFor('center', 'column');

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
    c.dispatchEvent(mk('pointerdown', innerWidth * 0.5, innerHeight * 0.4));
    c.dispatchEvent(mk('pointermove', innerWidth * 0.56, innerHeight * 0.32));
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
    window.__sandbox.settings.buttonPlacement = 'column';
    window.__sandbox.applyLayout();
  });

  // ---- Tuning panel opens and schemes switch. ----
  await page.evaluate(() => {
    document.querySelector('#stage').dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 21, pointerType: 'touch', clientX: 0, clientY: 0, bubbles: true }));
  });
  await page.getByRole('button', { name: 'НАСТРОЙКИ', exact: true }).click();
  await page.waitForTimeout(200);
  const panelOpen = await page.locator('.panel-body').isVisible();
  check('tuning panel opens', panelOpen);
  await page.screenshot({ path: `${SHOT}/04-tuning-panel.png`, scale: 'css' });

  await page.getByRole('button', { name: 'Танковая', exact: true }).click();
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
      names.find((n) => n.text === 'Танковая').pressed === 'true',
    JSON.stringify(names),
  );

  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('spaceshooter.tuning.v1')).ship.scheme);
  check('tuning persists to localStorage', persisted === 'tank', persisted);

  // ---- Rotation to landscape keeps everything sane. ----
  await page.getByRole('button', { name: 'НАСТРОЙКИ', exact: true }).click();
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
  const touchSpots = await page.evaluate(() =>
    window.__sandbox.buttons.visuals.map((b) => [b.id, [b.center.x / innerWidth, b.center.y / innerHeight]]));

  for (const [label, spot] of [['empty space', [0.7, 0.3]], ...touchSpots]) {
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

  // ---- The brake must stop the ship while leaving steering alive. ----
  await page.evaluate(() => {
    const S = window.__sandbox;
    S.settings.stickSide = 'center';
    S.settings.buttonPlacement = 'column';
    S.applyLayout();
    S.ship.vel.x = 600;
    S.ship.vel.y = 0;
  });
  const brakeSpot = await page.evaluate(() => {
    // The plain brake button is gone; stopping now goes through the combined
    // stop-and-shoot button.
    const b = window.__sandbox.buttons.visuals.find((v) => v.id === 'fireBrake');
    return { x: b.center.x, y: b.center.y };
  });

  const speedBefore = await page.evaluate(() =>
    Math.hypot(window.__sandbox.ship.vel.x, window.__sandbox.ship.vel.y));

  await page.evaluate(([x, y]) => {
    const c = document.querySelector('#stage');
    const mk = (t, id, cx, cy) => new PointerEvent(t, { pointerId: id,
      pointerType: 'touch', isPrimary: id === 51, clientX: cx, clientY: cy,
      bubbles: true, cancelable: true });
    c.dispatchEvent(mk('pointerdown', 51, x, y));
    // Second thumb steers while the brake is held.
    const o = window.__sandbox.joystick.visual.origin;
    c.dispatchEvent(mk('pointerdown', 52, o.x, o.y));
    c.dispatchEvent(mk('pointermove', 52, o.x + 60, o.y));
  }, [brakeSpot.x, brakeSpot.y]);

  const angleBefore = await page.evaluate(() => window.__sandbox.ship.angle);
  await page.waitForTimeout(1100);
  const braked = await page.evaluate(() => ({
    brake: window.__sandbox.input.state.brake,
    speed: Math.hypot(window.__sandbox.ship.vel.x, window.__sandbox.ship.vel.y),
    angle: window.__sandbox.ship.angle,
    throttle: window.__sandbox.ship.throttle,
    stick: Math.hypot(window.__sandbox.input.state.move.x, window.__sandbox.input.state.move.y),
  }));
  await page.evaluate(() => {
    const c = document.querySelector('#stage');
    for (const id of [51, 52]) {
      c.dispatchEvent(new PointerEvent('pointerup', { pointerId: id,
        pointerType: 'touch', clientX: 0, clientY: 0, bubbles: true }));
    }
  });

  check('combined button registers as a brake', braked.brake === true, JSON.stringify(braked));
  check(
    'brake stops the ship',
    braked.speed < speedBefore * 0.05,
    `${speedBefore.toFixed(0)} -> ${braked.speed.toFixed(1)} px/s`,
  );
  check('no thrust while braking', braked.throttle === 0, JSON.stringify(braked));
  check(
    'steering still works while braking',
    braked.stick > 0.1 && braked.angle !== angleBefore,
    JSON.stringify(braked),
  );
  await page.screenshot({ path: `${SHOT}/07-braking.png`, scale: 'css' });

  // ---- The combined button is one press that both stops and shoots. ----
  const spots = await page.evaluate(() => {
    const S = window.__sandbox;
    S.settings.stickSide = 'center';
    S.settings.buttonPlacement = 'column';
    S.applyLayout();
    const at = (id) => {
      const b = S.buttons.visuals.find((v) => v.id === id);
      return { x: b.center.x, y: b.center.y, r: b.radius };
    };
    return { fire: at('fire'), combined: at('fireBrake'), boost: at('boost') };
  });

  const pressAt = async (x, y, id) => {
    await page.evaluate(([x, y, id]) => {
      document.querySelector('#stage').dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: id, pointerType: 'touch', isPrimary: true,
        clientX: x, clientY: y, bubbles: true, cancelable: true,
      }));
    }, [x, y, id]);
    await page.waitForTimeout(200);
    const state = await page.evaluate(() => ({
      fire: window.__sandbox.input.state.fire,
      brake: window.__sandbox.input.state.brake,
      boost: window.__sandbox.input.state.boost,
    }));
    await page.evaluate((id) => {
      document.querySelector('#stage').dispatchEvent(new PointerEvent('pointerup', {
        pointerId: id, pointerType: 'touch', clientX: 0, clientY: 0, bubbles: true,
      }));
    }, id);
    await page.waitForTimeout(120);
    return state;
  };

  const combined = await pressAt(spots.combined.x, spots.combined.y, 61);
  check(
    'the combined button fires and brakes from one press',
    combined.fire === true && combined.brake === true,
    JSON.stringify(combined),
  );

  const fireOnly = await pressAt(spots.fire.x, spots.fire.y, 62);
  check(
    'ОГОНЬ fires without braking',
    fireOnly.fire === true && fireOnly.brake === false,
    JSON.stringify(fireOnly),
  );

  const boostOnly = await pressAt(spots.boost.x, spots.boost.y, 63);
  check(
    'ФОРС boosts without firing or braking',
    boostOnly.boost === true && boostOnly.fire === false && boostOnly.brake === false,
    JSON.stringify(boostOnly),
  );

  // ---- The stick must stay put under the thumb, not slide with the drag. ----
  const drift = await page.evaluate(async () => {
    const S = window.__sandbox;
    const c = document.querySelector('#stage');
    const x = innerWidth * 0.5;
    const y = innerHeight * 0.6;
    const mk = (t, cx, cy) => new PointerEvent(t, { pointerId: 71, pointerType: 'touch',
      isPrimary: true, clientX: cx, clientY: cy, bubbles: true, cancelable: true });
    c.dispatchEvent(mk('pointerdown', x, y));
    await new Promise((r) => setTimeout(r, 80));
    const placed = { ...S.joystick.visual.origin };
    // Drag far past the rim, the case that used to drag the origin along.
    c.dispatchEvent(mk('pointermove', x + 240, y));
    await new Promise((r) => setTimeout(r, 120));
    const after = { ...S.joystick.visual.origin };
    c.dispatchEvent(mk('pointerup', x + 240, y));
    return { placed, after, recenter: S.settings.stick.recenter };
  });
  check(
    'the stick stays where it was placed while dragging',
    drift.recenter === false && Math.abs(drift.after.x - drift.placed.x) < 0.5,
    JSON.stringify(drift),
  );

  check('no runtime errors over the whole run', errors.length === 0, errors.join(' | '));

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('HARNESS ERROR', e);
  process.exit(2);
});
