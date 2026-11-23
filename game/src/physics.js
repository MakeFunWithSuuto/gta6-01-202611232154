// Small geometry helpers shared by walkers, cars and bullets: pushing a circle out of solid city
// tiles, line-of-sight through the tile grid and angle arithmetic.
import { TILE, T_BUILDING } from './config.js';

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
export const distance = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

/** Signed smallest difference b - a between two angles, in -PI..PI. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Push a circle out of every solid tile it overlaps. Returns the corrected centre and the summed
 * push normal (zero when nothing was touched).
 */
export function resolveCircleVsCity(city, x, y, r) {
  let nx = 0;
  let ny = 0;
  const x0 = Math.floor((x - r) / TILE);
  const x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE);
  const y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (!city.solidAt(tx * TILE + 1, ty * TILE + 1)) continue;
      const cx = clamp(x, tx * TILE, tx * TILE + TILE);
      const cy = clamp(y, ty * TILE, ty * TILE + TILE);
      let dx = x - cx;
      let dy = y - cy;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d >= r) continue;
      if (d < 0.001) { dx = 0; dy = -1; d = 1; }
      const push = r - d;
      x += (dx / d) * push;
      y += (dy / d) * push;
      nx += dx / d;
      ny += dy / d;
    }
  }
  const len = Math.hypot(nx, ny);
  return { x, y, nx: len ? nx / len : 0, ny: len ? ny / len : 0, hit: len > 0 };
}

/** True when the straight line between two points crosses no building (sampled every 16 px). */
export function lineOfSight(city, ax, ay, bx, by) {
  const d = distance(ax, ay, bx, by);
  const steps = Math.ceil(d / 16);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (city.tileAtPoint(ax + (bx - ax) * t, ay + (by - ay) * t) === T_BUILDING) return false;
  }
  return true;
}
