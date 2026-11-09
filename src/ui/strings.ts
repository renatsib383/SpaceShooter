import type { ControlScheme } from '../game/ship';
import type { ButtonPlacement, StickSide } from '../input/layout';
import type { InputSource } from '../input/types';
import type { StickPlacement } from '../input/virtual-joystick';

/**
 * Every string the player sees, in one place.
 *
 * Collected rather than written inline so the interface can be read through in
 * one file, and so a second language stays a matter of swapping this object
 * instead of hunting literals through the renderers.
 */
export const ui = {
  title: 'Космический шутер',

  buttons: {
    fire: 'ОГОНЬ',
    boost: 'ФОРС',
  },

  hud: {
    hull: 'КОРПУС',
    kills: 'СБИТО',
    destroyed: 'КОРПУС ПРОБИТ',
    respawn: (seconds: number): string => `возрождение через ${seconds.toFixed(1)} с`,
  },

  debug: {
    scheme: 'схема',
    source: 'ввод',
    stick: 'стик',
    speed: 'скорость',
    zoom: 'зум',
    heading: 'курс',
    throttle: 'тяга',
    fps: 'кадр/с',
    boostOn: 'ФОРСАЖ',
    fireOn: 'ОГОНЬ',
  },

  scheme: {
    direct: 'прямая',
    heading: 'курсовая',
    tank: 'танковая',
  } satisfies Record<ControlScheme, string>,

  source: {
    none: 'нет',
    keyboard: 'клавиатура',
    touch: 'касание',
    gamepad: 'геймпад',
  } satisfies Record<InputSource, string>,

  panel: {
    toggle: 'НАСТРОЙКИ',
    reset: 'Сбросить настройки',

    stickSide: 'Стик',
    stickSideOptions: {
      left: 'Слева',
      center: 'Центр',
      right: 'Справа',
    } satisfies Record<StickSide, string>,
    stickSideHints: {
      left: 'Стик на левой половине экрана',
      center: 'Стик на средней половине экрана',
      right: 'Стик на правой половине экрана',
    } satisfies Record<StickSide, string>,

    buttons: 'Кнопки',
    buttonsOptions: {
      column: 'Столбец',
      side: 'Сбоку',
      center: 'Центр',
    } satisfies Record<ButtonPlacement, string>,
    buttonsHints: {
      column: 'Кнопки вертикальным столбцом у края',
      side: 'Кнопки на половине, свободной от стика',
      center: 'Кнопки столбиком посередине экрана',
    } satisfies Record<ButtonPlacement, string>,

    scheme: 'Схема',
    schemeOptions: {
      direct: 'Прямая',
      heading: 'Курсовая',
      tank: 'Танковая',
    } satisfies Record<ControlScheme, string>,
    schemeHints: {
      direct: 'Куда отклонён стик — туда и тяга',
      heading: 'Стик задаёт курс, корабль доворачивает и толкает носом',
      tank: 'Вбок — поворот, вверх — газ',
    } satisfies Record<ControlScheme, string>,

    placement: 'Появление',
    placementOptions: {
      dynamic: 'Под пальцем',
      fixed: 'На месте',
    } satisfies Record<StickPlacement, string>,

    recenter: 'Смещать центр',
    debugOverlay: 'Отладка',

    thrust: 'Тяга',
    maxSpeed: 'Макс. скорость',
    drag: 'Торможение',
    turnRate: 'Скорость поворота',
    offAxis: 'Тяга вне курса',
    homing: 'Самонаведение',
    homingArc: 'Угол захвата',
    fireRate: 'Темп стрельбы',
    zoomAtSpeed: 'Отъезд на скорости',
    zoomEase: 'Плавность отъезда',
    lookAhead: 'Упреждение камеры',
    stickRadius: 'Радиус стика',
    stickHeight: 'Высота стика',
    stickDeadZone: 'Мёртвая зона',
  },

  units: {
    seconds: (v: number, digits = 2): string => `${v.toFixed(digits)} с`,
    pixels: (v: number): string => `${v.toFixed(0)} px`,
    percent: (v: number): string => `${(v * 100).toFixed(0)} %`,
    turnsPerSecond: (v: number): string => `${(v / (Math.PI * 2)).toFixed(2)} об/с`,
    times: (v: number): string => `${v.toFixed(2)}×`,
    degrees: (v: number): string => `${v.toFixed(0)}°`,
    radiansAsDegrees: (v: number): string => `${((v * 180) / Math.PI).toFixed(0)}°`,
    perSecond: (v: number): string => `${v.toFixed(1)}/с`,
  },

  hint: {
    /** Which part of the screen steers, in the accusative the sentence needs. */
    steerArea: {
      left: 'левую половину',
      center: 'центр',
      right: 'правую половину',
    } satisfies Record<StickSide, string>,
    actionsAt: {
      left: 'слева',
      center: 'посередине',
      right: 'справа',
    },
    line: (steer: string, actions: string): string =>
      `Нажимайте ${steer}, чтобы управлять · ОГОНЬ / ФОРС ${actions}\n` +
      'На компьютере: WASD или стрелки + пробел · геймпад поддерживается',
  },
} as const;
