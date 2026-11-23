// A growable vertex batch for the WebGL renderer. Every vertex is position, normal, colour,
// texture coordinate and a material id (13 floats). The city is built into one static batch;
// cars, people, effects and markers are rebuilt into dynamic batches every frame.

export const FLOATS = 13;
export const MAT_PLAIN = 0;
export const MAT_WINDOWS = 1;
export const MAT_GROUND = 2;
export const MAT_WATER = 3;
export const MAT_GLOW = 4;

function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const colorCache = new Map();
/** '#rrggbb' to [r, g, b] in 0..1 (cached). */
export function rgb(hex) {
  let c = colorCache.get(hex);
  if (!c) { c = hexToRgb(hex); colorCache.set(hex, c); }
  return c;
}

export function createBatch(initial = 65536) {
  let data = new Float32Array(initial * FLOATS);
  let count = 0;

  function grow(extra) {
    if ((count + extra) * FLOATS <= data.length) return;
    const next = new Float32Array(Math.max(data.length * 2, (count + extra) * FLOATS));
    next.set(data);
    data = next;
  }

  function vertex(x, y, z, nx, ny, nz, c, a, u, v, mat) {
    const o = count * FLOATS;
    data[o] = x; data[o + 1] = y; data[o + 2] = z;
    data[o + 3] = nx; data[o + 4] = ny; data[o + 5] = nz;
    data[o + 6] = c[0]; data[o + 7] = c[1]; data[o + 8] = c[2]; data[o + 9] = a;
    data[o + 10] = u; data[o + 11] = v; data[o + 12] = mat;
    count += 1;
  }

  /** Quad p0..p3 (counter-clockwise seen from the front), as two triangles. */
  function quad(p0, p1, p2, p3, n, c, a = 1, mat = MAT_PLAIN, uv = null) {
    grow(6);
    const t = uv ?? [0, 0, 0, 0, 0, 0, 0, 0];
    vertex(p0[0], p0[1], p0[2], n[0], n[1], n[2], c, a, t[0], t[1], mat);
    vertex(p1[0], p1[1], p1[2], n[0], n[1], n[2], c, a, t[2], t[3], mat);
    vertex(p2[0], p2[1], p2[2], n[0], n[1], n[2], c, a, t[4], t[5], mat);
    vertex(p0[0], p0[1], p0[2], n[0], n[1], n[2], c, a, t[0], t[1], mat);
    vertex(p2[0], p2[1], p2[2], n[0], n[1], n[2], c, a, t[4], t[5], mat);
    vertex(p3[0], p3[1], p3[2], n[0], n[1], n[2], c, a, t[6], t[7], mat);
  }

  /**
   * A box standing on height `y0`, centred at world (x, z), turned by `yaw`, `len` along its
   * heading, `wid` across, `h` tall. `side` colours the walls (or pass `top` for the lid).
   */
  function box(x, z, y0, yaw, len, wid, h, side, top = side, a = 1, mat = MAT_PLAIN, wallMat = mat) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const hl = len / 2;
    const hw = wid / 2;
    const corner = (fx, fz, y) => [x + c * fx - s * fz, y, z + s * fx + c * fz];
    const y1 = y0 + h;
    const a0 = corner(-hl, -hw, y0); const b0 = corner(hl, -hw, y0); const c0 = corner(hl, hw, y0); const d0 = corner(-hl, hw, y0);
    const a1 = corner(-hl, -hw, y1); const b1 = corner(hl, -hw, y1); const c1 = corner(hl, hw, y1); const d1 = corner(-hl, hw, y1);
    quad(a1, d1, c1, b1, [0, 1, 0], top, a, mat);
    quad(a0, b0, b1, a1, [s, 0, -c], side, a, wallMat);
    quad(b0, c0, c1, b1, [c, 0, s], side, a, wallMat);
    quad(c0, d0, d1, c1, [-s, 0, c], side, a, wallMat);
    quad(d0, a0, a1, d1, [-c, 0, -s], side, a, wallMat);
  }

  /** A flat disc (or ring when inner > 0) lying at height y. */
  function disc(x, z, y, r, color, a = 1, inner = 0, mat = MAT_PLAIN, segments = 20) {
    for (let k = 0; k < segments; k += 1) {
      const t0 = (k / segments) * Math.PI * 2;
      const t1 = ((k + 1) / segments) * Math.PI * 2;
      const o0 = [x + Math.cos(t0) * r, y, z + Math.sin(t0) * r];
      const o1 = [x + Math.cos(t1) * r, y, z + Math.sin(t1) * r];
      const i0 = [x + Math.cos(t0) * inner, y, z + Math.sin(t0) * inner];
      const i1 = [x + Math.cos(t1) * inner, y, z + Math.sin(t1) * inner];
      quad(i0, i1, o1, o0, [0, 1, 0], color, a, mat);
    }
  }

  /** An open vertical cylinder (a light beam), fading toward the top in the shader's alpha. */
  function tube(x, z, y0, h, r, color, a, mat = MAT_GLOW, segments = 14) {
    for (let k = 0; k < segments; k += 1) {
      const t0 = (k / segments) * Math.PI * 2;
      const t1 = ((k + 1) / segments) * Math.PI * 2;
      const p0 = [x + Math.cos(t0) * r, y0, z + Math.sin(t0) * r];
      const p1 = [x + Math.cos(t1) * r, y0, z + Math.sin(t1) * r];
      quad(p0, p1, [p1[0], y0 + h, p1[2]], [p0[0], y0 + h, p0[2]], [Math.cos(t0), 0, Math.sin(t0)], color, a, mat);
    }
  }

  return {
    quad, box, disc, tube,
    reset() { count = 0; },
    get count() { return count; },
    get data() { return data; },
  };
}
