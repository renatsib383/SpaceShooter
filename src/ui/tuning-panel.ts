import type { ControlScheme, ShipTuning } from '../game/ship';
import type { ButtonPlacement, Handedness } from '../input/layout';
import type { JoystickConfig, StickPlacement } from '../input/virtual-joystick';

export interface TunableSettings {
  ship: ShipTuning;
  stick: JoystickConfig;
  /** Which thumb drives the stick; the action buttons take the other side. */
  handedness: Handedness;
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
    label: 'Thrust',
    min: 200,
    max: 2600,
    step: 25,
    get: (s) => s.ship.thrust,
    set: (s, v) => {
      s.ship.thrust = v;
    },
  },
  {
    label: 'Max speed',
    min: 120,
    max: 1600,
    step: 20,
    get: (s) => s.ship.maxSpeed,
    set: (s, v) => {
      s.ship.maxSpeed = v;
    },
  },
  {
    label: 'Drag half-life',
    min: 0.1,
    max: 6,
    step: 0.05,
    get: (s) => s.ship.dragHalfLife,
    set: (s, v) => {
      s.ship.dragHalfLife = v;
    },
    format: (v) => `${v.toFixed(2)}s`,
  },
  {
    label: 'Turn rate',
    min: 1,
    max: 20,
    step: 0.25,
    get: (s) => s.ship.turnRate,
    set: (s, v) => {
      s.ship.turnRate = v;
    },
    format: (v) => `${(v / (Math.PI * 2)).toFixed(2)} rev/s`,
  },
  {
    label: 'Off-axis thrust',
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
    label: 'Stick radius',
    min: 32,
    max: 140,
    step: 2,
    get: (s) => s.stick.radius,
    set: (s, v) => {
      s.stick.radius = v;
    },
    format: (v) => `${v.toFixed(0)}px`,
  },
  {
    label: 'Stick dead zone',
    min: 0,
    max: 0.5,
    step: 0.01,
    get: (s) => s.stick.deadZone,
    set: (s, v) => {
      s.stick.deadZone = v;
    },
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
];

export function loadSettings(defaults: TunableSettings): TunableSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as Partial<TunableSettings>;
    return {
      ship: { ...defaults.ship, ...saved.ship },
      stick: { ...defaults.stick, ...saved.stick },
      handedness: saved.handedness ?? defaults.handedness,
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
  toggle.textContent = 'TUNE';

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

  // Handedness first: it decides which side every other touch control is on.
  const handWrap = document.createElement('div');
  handWrap.className = 'segmented';
  const hands: ReadonlyArray<{ id: Handedness; label: string }> = [
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' },
  ];
  const handButtons = hands.map(({ id, label }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = `Stick under the ${id} thumb, actions on the other side`;
    b.addEventListener('click', () => {
      settings.handedness = id;
      syncHand();
      commit();
    });
    handWrap.append(b);
    return { id, el: b };
  });
  const syncHand = (): void => {
    for (const { id, el } of handButtons) {
      const on = settings.handedness === id;
      el.classList.toggle('active', on);
      el.setAttribute('aria-pressed', String(on));
    }
  };
  syncHand();
  addRow('Stick hand', handWrap);

  // Where the action buttons live.
  const placeWrap = document.createElement('div');
  placeWrap.className = 'segmented';
  const places: ReadonlyArray<{ id: ButtonPlacement; label: string; hint: string }> = [
    { id: 'side', label: 'Side', hint: 'Buttons on the half opposite the stick' },
    { id: 'center', label: 'Center', hint: 'Buttons stacked in the middle' },
  ];
  const placeButtons = places.map(({ id, label, hint }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = hint;
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
  addRow('Buttons', placeWrap);

  // Control scheme.
  const schemeWrap = document.createElement('div');
  schemeWrap.className = 'segmented';
  const schemes: ReadonlyArray<{ id: ControlScheme; label: string; hint: string }> = [
    { id: 'direct', label: 'Direct', hint: 'Stick direction = thrust direction' },
    { id: 'heading', label: 'Heading', hint: 'Stick sets heading, ship turns to it' },
    { id: 'tank', label: 'Tank', hint: 'X rotates, up throttles' },
  ];
  const schemeButtons = schemes.map(({ id, label, hint }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = hint;
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
  addRow('Scheme', schemeWrap);

  // Stick placement.
  const placementWrap = document.createElement('div');
  placementWrap.className = 'segmented';
  const placements: ReadonlyArray<{ id: StickPlacement; label: string }> = [
    { id: 'dynamic', label: 'Dynamic' },
    { id: 'fixed', label: 'Fixed' },
  ];
  const placementButtons = placements.map(({ id, label }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
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
  addRow('Stick', placementWrap);

  // Recenter toggle.
  const recenter = document.createElement('input');
  recenter.type = 'checkbox';
  recenter.checked = settings.stick.recenter;
  recenter.addEventListener('change', () => {
    settings.stick.recenter = recenter.checked;
    commit();
  });
  addRow('Recenter on drag', recenter);

  // Numeric sliders.
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
    addRow(field.label, input, readout);
  }

  // Debug overlay toggle.
  const debug = document.createElement('input');
  debug.type = 'checkbox';
  debug.checked = settings.showDebug;
  debug.addEventListener('change', () => {
    settings.showDebug = debug.checked;
    commit();
  });
  addRow('Debug overlay', debug);

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'reset';
  reset.textContent = 'Reset to defaults';
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
