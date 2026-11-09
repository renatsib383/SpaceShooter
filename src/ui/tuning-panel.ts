import { defaultCameraTuning, type CameraTuning } from '../game/camera';
import { playerWeapon, type WeaponTuning } from '../game/weapon';
import type { ControlScheme, ShipTuning } from '../game/ship';
import { DEFAULT_REST_HEIGHTS } from '../input/layout';
import type { ButtonPlacement, StickSide } from '../input/layout';
import type { JoystickConfig, StickPlacement } from '../input/virtual-joystick';
import { ui } from './strings';

export interface TunableSettings {
  ship: ShipTuning;
  camera: CameraTuning;
  weapon: WeaponTuning;
  stick: JoystickConfig;
  /** Which part of the screen the movement stick claims. */
  stickSide: StickSide;
  /**
   * Resting height per stick side. Per side, not one number, so moving the
   * stick to the centre drops it to where a centred stick belongs without
   * discarding the height tuned for a side stick.
   */
  stickHeight: Record<StickSide, number>;
  /** Where the action buttons sit. */
  buttonPlacement: ButtonPlacement;
  showDebug: boolean;
}

const STORAGE_KEY = 'spaceshooter.tuning.v1';

interface NumericField {
  label: string;
  min: number;
  max: number;
  step: number;
  get(s: TunableSettings): number;
  set(s: TunableSettings, v: number): void;
  format?(v: number): string;
}

const fields: readonly NumericField[] = [
  {
    label: ui.panel.thrust,
    min: 200,
    max: 2600,
    step: 25,
    get: (s) => s.ship.thrust,
    set: (s, v) => {
      s.ship.thrust = v;
    },
  },
  {
    label: ui.panel.maxSpeed,
    min: 120,
    max: 1600,
    step: 20,
    get: (s) => s.ship.maxSpeed,
    set: (s, v) => {
      s.ship.maxSpeed = v;
    },
  },
  {
    label: ui.panel.drag,
    min: 0.1,
    max: 6,
    step: 0.05,
    get: (s) => s.ship.dragHalfLife,
    set: (s, v) => {
      s.ship.dragHalfLife = v;
    },
    format: (v) => ui.units.seconds(v),
  },
  {
    label: ui.panel.turnRate,
    min: 1,
    max: 20,
    step: 0.25,
    get: (s) => s.ship.turnRate,
    set: (s, v) => {
      s.ship.turnRate = v;
    },
    format: (v) => ui.units.turnsPerSecond(v),
  },
  {
    label: ui.panel.offAxis,
    min: 0,
    max: 1,
    step: 0.05,
    get: (s) => s.ship.offAxisThrust,
    set: (s, v) => {
      s.ship.offAxisThrust = v;
    },
    format: (v) => v.toFixed(2),
  },
  {
    label: ui.panel.homing,
    min: 0,
    max: 3,
    step: 0.05,
    get: (s) => s.weapon.homingRate,
    set: (s, v) => {
      s.weapon.homingRate = v;
    },
    // Shown as degrees per second: radians mean nothing while thumbing a
    // slider on a phone.
    format: (v) => (v <= 0 ? 'выкл' : ui.units.radiansAsDegrees(v) + '/с'),
  },
  {
    label: ui.panel.homingArc,
    min: 0.05,
    max: 1.2,
    step: 0.05,
    get: (s) => s.weapon.homingArc,
    set: (s, v) => {
      s.weapon.homingArc = v;
    },
    format: (v) => ui.units.radiansAsDegrees(v),
  },
  {
    label: ui.panel.fireRate,
    min: 0.05,
    max: 0.6,
    step: 0.01,
    get: (s) => s.weapon.fireInterval,
    set: (s, v) => {
      s.weapon.fireInterval = v;
    },
    format: (v) => ui.units.perSecond(1 / v),
  },
  {
    label: ui.panel.zoomAtSpeed,
    min: 0.3,
    max: 1,
    step: 0.02,
    get: (s) => s.camera.zoomAtSpeed,
    set: (s, v) => {
      s.camera.zoomAtSpeed = v;
    },
    format: (v) => ui.units.times(v),
  },
  {
    label: ui.panel.zoomEase,
    min: 0.05,
    max: 2,
    step: 0.05,
    get: (s) => s.camera.zoomHalfLife,
    set: (s, v) => {
      s.camera.zoomHalfLife = v;
    },
    format: (v) => ui.units.seconds(v),
  },
  {
    label: ui.panel.lookAhead,
    min: 0,
    max: 1,
    step: 0.05,
    get: (s) => s.camera.lookAhead,
    set: (s, v) => {
      s.camera.lookAhead = v;
    },
    format: (v) => ui.units.seconds(v),
  },
  {
    label: ui.panel.stickRadius,
    min: 32,
    max: 140,
    step: 2,
    get: (s) => s.stick.radius,
    set: (s, v) => {
      s.stick.radius = v;
    },
    format: (v) => ui.units.pixels(v),
  },
  {
    label: ui.panel.stickHeight,
    min: 0.35,
    max: 0.92,
    step: 0.01,
    get: (s) => s.stickHeight[s.stickSide],
    set: (s, v) => {
      s.stickHeight[s.stickSide] = v;
    },
    format: (v) => ui.units.percent(v),
  },
  {
    label: ui.panel.stickDeadZone,
    min: 0,
    max: 0.5,
    step: 0.01,
    get: (s) => s.stick.deadZone,
    set: (s, v) => {
      s.stick.deadZone = v;
    },
    format: (v) => ui.units.percent(v),
  },
];

export function loadSettings(defaults: TunableSettings): TunableSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    // `handedness` is the pre-centre-stick name for `stickSide`; read it so a
    // returning player keeps the side they chose.
    const saved = JSON.parse(raw) as Partial<TunableSettings> & { handedness?: StickSide };
    return {
      ship: { ...defaults.ship, ...saved.ship },
      camera: { ...defaultCameraTuning, ...defaults.camera, ...saved.camera },
      weapon: { ...playerWeapon, ...defaults.weapon, ...saved.weapon },
      stick: {
        ...defaults.stick,
        ...saved.stick,
        // Nested objects would otherwise be shared with the defaults literal,
        // and a partial saved anchor would drop the axis it omits.
        zone: { ...defaults.stick.zone, ...saved.stick?.zone },
        anchor: { ...defaults.stick.anchor, ...saved.stick?.anchor },
      },
      stickSide: saved.stickSide ?? saved.handedness ?? defaults.stickSide,
      stickHeight: { ...DEFAULT_REST_HEIGHTS, ...defaults.stickHeight, ...saved.stickHeight },
      buttonPlacement: saved.buttonPlacement ?? defaults.buttonPlacement,
      showDebug: saved.showDebug ?? defaults.showDebug,
    };
  } catch {
    // Private mode, disabled storage, or a stale shape: fall back silently.
    return defaults;
  }
}

function saveSettings(settings: TunableSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* non-fatal */
  }
}

/**
 * Tuning panel as plain DOM on top of the canvas.
 *
 * The whole point of this iteration is feel, and feel cannot be guessed from a
 * desk — so every number that affects handling is adjustable live on the phone
 * itself and persisted, instead of living in a constant that needs a rebuild.
 */
export function createTuningPanel(
  root: HTMLElement,
  settings: TunableSettings,
  onChange: () => void,
): { dispose(): void } {
  const panel = document.createElement('div');
  panel.className = 'panel';

  const toggle = document.createElement('button');
  toggle.className = 'panel-toggle';
  toggle.type = 'button';
  toggle.textContent = ui.panel.toggle;

  const body = document.createElement('div');
  body.className = 'panel-body';
  body.hidden = true;

  toggle.addEventListener('click', () => {
    body.hidden = !body.hidden;
    toggle.classList.toggle('open', !body.hidden);
  });

  const commit = (): void => {
    saveSettings(settings);
    onChange();
  };

  const addRow = (label: string, control: HTMLElement, readout?: HTMLElement): void => {
    // A <label> wrapping a group of buttons hands its own text to every button
    // inside as that button's accessible name, so "Direct" would be announced
    // as "Scheme Heading Tank". Only real form controls get a <label>; button
    // groups become a labelled role="group" instead.
    const labelable =
      control instanceof HTMLInputElement || control instanceof HTMLSelectElement;
    const row = document.createElement(labelable ? 'label' : 'div');
    row.className = 'row';

    const name = document.createElement('span');
    name.className = 'row-label';
    name.textContent = label;

    if (!labelable) {
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', label);
    }

    row.append(name);
    if (readout) row.append(readout);
    row.append(control);
    body.append(row);
  };

  // Set once the sliders exist; the stick-side control calls it so the height
  // slider shows the value belonging to the newly selected side.
  let refreshFields = (): void => {};

  // Stick side first: it decides where every other touch control sits.
  const handWrap = document.createElement('div');
  handWrap.className = 'segmented';
  const sides: ReadonlyArray<{ id: StickSide }> = [
    { id: 'left' }, { id: 'center' }, { id: 'right' },
  ];
  const handButtons = sides.map(({ id }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = ui.panel.stickSideOptions[id];
    b.title = ui.panel.stickSideHints[id];
    b.addEventListener('click', () => {
      settings.stickSide = id;
      syncHand();
      commit();
      refreshFields();
    });
    handWrap.append(b);
    return { id, el: b };
  });
  const syncHand = (): void => {
    for (const { id, el } of handButtons) {
      const on = settings.stickSide === id;
      el.classList.toggle('active', on);
      el.setAttribute('aria-pressed', String(on));
    }
  };
  syncHand();
  addRow(ui.panel.stickSide, handWrap);

  // Where the action buttons live.
  const placeWrap = document.createElement('div');
  placeWrap.className = 'segmented';
  const places: ReadonlyArray<{ id: ButtonPlacement }> = [
    { id: 'column' }, { id: 'side' }, { id: 'center' },
  ];
  const placeButtons = places.map(({ id }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = ui.panel.buttonsOptions[id];
    b.title = ui.panel.buttonsHints[id];
    b.addEventListener('click', () => {
      settings.buttonPlacement = id;
      syncPlace();
      commit();
    });
    placeWrap.append(b);
    return { id, el: b };
  });
  const syncPlace = (): void => {
    for (const { id, el } of placeButtons) {
      const on = settings.buttonPlacement === id;
      el.classList.toggle('active', on);
      el.setAttribute('aria-pressed', String(on));
    }
  };
  syncPlace();
  addRow(ui.panel.buttons, placeWrap);

  // Control scheme.
  const schemeWrap = document.createElement('div');
  schemeWrap.className = 'segmented';
  const schemes: ReadonlyArray<{ id: ControlScheme }> = [
    { id: 'direct' }, { id: 'heading' }, { id: 'tank' },
  ];
  const schemeButtons = schemes.map(({ id }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = ui.panel.schemeOptions[id];
    b.title = ui.panel.schemeHints[id];
    b.addEventListener('click', () => {
      settings.ship.scheme = id;
      syncScheme();
      commit();
    });
    schemeWrap.append(b);
    return { id, el: b };
  });
  const syncScheme = (): void => {
    for (const { id, el } of schemeButtons) {
      const on = settings.ship.scheme === id;
      el.classList.toggle('active', on);
      el.setAttribute('aria-pressed', String(on));
    }
  };
  syncScheme();
  addRow(ui.panel.scheme, schemeWrap);

  // Stick placement.
  const placementWrap = document.createElement('div');
  placementWrap.className = 'segmented';
  const placements: ReadonlyArray<{ id: StickPlacement }> = [
    { id: 'dynamic' }, { id: 'fixed' },
  ];
  const placementButtons = placements.map(({ id }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = ui.panel.placementOptions[id];
    b.addEventListener('click', () => {
      settings.stick.placement = id;
      syncPlacement();
      commit();
    });
    placementWrap.append(b);
    return { id, el: b };
  });
  const syncPlacement = (): void => {
    for (const { id, el } of placementButtons) {
      const on = settings.stick.placement === id;
      el.classList.toggle('active', on);
      el.setAttribute('aria-pressed', String(on));
    }
  };
  syncPlacement();
  addRow(ui.panel.placement, placementWrap);

  // Recenter toggle.
  const recenter = document.createElement('input');
  recenter.type = 'checkbox';
  recenter.checked = settings.stick.recenter;
  recenter.addEventListener('change', () => {
    settings.stick.recenter = recenter.checked;
    commit();
  });
  addRow(ui.panel.recenter, recenter);

  // Numeric sliders.
  const refreshers: Array<() => void> = [];
  for (const field of fields) {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
    input.value = String(field.get(settings));

    const readout = document.createElement('span');
    readout.className = 'row-value';
    const render = (): void => {
      const v = field.get(settings);
      readout.textContent = field.format ? field.format(v) : v.toFixed(0);
    };
    render();

    input.addEventListener('input', () => {
      field.set(settings, Number(input.value));
      render();
      commit();
    });
    refreshers.push(() => {
      input.value = String(field.get(settings));
      render();
    });
    addRow(field.label, input, readout);
  }

  // Sliders that read per-side state must be re-read when the side changes.
  refreshFields = (): void => {
    for (const refresh of refreshers) refresh();
  };

  // Debug overlay toggle.
  const debug = document.createElement('input');
  debug.type = 'checkbox';
  debug.checked = settings.showDebug;
  debug.addEventListener('change', () => {
    settings.showDebug = debug.checked;
    commit();
  });
  addRow(ui.panel.debugOverlay, debug);

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'reset';
  reset.textContent = ui.panel.reset;
  reset.addEventListener('click', () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* non-fatal */
    }
    location.reload();
  });
  body.append(reset);

  panel.append(toggle, body);
  root.append(panel);

  return {
    dispose(): void {
      panel.remove();
    },
  };
}
