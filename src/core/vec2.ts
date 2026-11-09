export interface Vec2 {
  x: number;
  y: number;
}

export function vec2(x = 0, y = 0): Vec2 {
  return { x, y };
}

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function set(out: Vec2, x: number, y: number): Vec2 {
  out.x = x;
  out.y = y;
  return out;
}

export function copy(out: Vec2, v: Vec2): Vec2 {
  out.x = v.x;
  out.y = v.y;
  return out;
}

/** Scale `v` so its length is at most `max`. Mutates and returns `v`. */
export function limit(v: Vec2, max: number): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len > max && len > 0) {
    const s = max / len;
    v.x *= s;
    v.y *= s;
  }
  return v;
}

export function angleOf(v: Vec2): number {
  return Math.atan2(v.y, v.x);
}

export function fromAngle(angle: number, len = 1): Vec2 {
  return { x: Math.cos(angle) * len, y: Math.sin(angle) * len };
}
