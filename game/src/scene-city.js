// Builds the static 3D city into one vertex batch: the baked ground, the sea reaching to the
// horizon, every building as a lit box with window-banded walls and rooftop detail, palms with
// drooping fronds, street lamps on the corners and umbrellas on the beach.
import { BEACH_ROW, BLOCK, TILE, WATER_ROW } from './config.js';
import { createRandom } from './random.js';
import { MAT_GLOW, MAT_GROUND, MAT_PLAIN, MAT_WATER, MAT_WINDOWS, rgb } from './mesh.js';

const UP = [0, 1, 0];

function shadeRgb(c, k) { return c.map((v) => Math.max(0, Math.min(1, k < 0 ? v * (1 + k) : v + (1 - v) * k))); }

function addGround(batch, city) {
  const W = city.width;
  const H = city.height;
  batch.quad([0, 0, 0], [0, 0, H], [W, 0, H], [W, 0, 0], UP, [1, 1, 1], 1, MAT_GROUND, [0, 0, 0, 1, 1, 1, 1, 0]);
  const far = 9000;
  const sea = rgb('#2c8fb3');
  batch.quad([-far, -1, -far], [-far, -1, H + far], [0, -1, H + far], [0, -1, -far], UP, sea, 1, MAT_WATER);
  batch.quad([W, -1, -far], [W, -1, H + far], [W + far, -1, H + far], [W + far, -1, -far], UP, sea, 1, MAT_WATER);
  batch.quad([0, -1, -far], [0, -1, 0], [W, -1, 0], [W, -1, -far], UP, sea, 1, MAT_WATER);
  batch.quad([0, -1, H], [0, -1, H + far], [W, -1, H + far], [W, -1, H], UP, sea, 1, MAT_WATER);
  const top = WATER_ROW * TILE + 10;
  batch.quad([0, 0.6, top], [0, 0.6, H], [W, 0.6, H], [W, 0.6, top], UP, sea, 0.55, MAT_WATER);
  const harbor = (BEACH_ROW + 3) * TILE;
  batch.quad([0, 0.6, harbor], [0, 0.6, top], [26 * TILE, 0.6, top], [26 * TILE, 0.6, harbor], UP, sea, 0.55, MAT_WATER);
}

function addBuilding(batch, b, rng) {
  const side = rgb(b.color);
  const roof = b.kind === 'villa' ? rgb('#d9825b') : b.kind === 'tower' ? shadeRgb(side, -0.35) : shadeRgb(side, 0.1);
  const cx = b.x + b.w / 2;
  const cz = b.y + b.h / 2;
  const walls = b.kind === 'container' || b.kind === 'warehouse' ? MAT_PLAIN : MAT_WINDOWS;
  batch.box(cx, cz, 0, 0, b.w, b.h, b.height, side, roof, 1, MAT_PLAIN, walls);
  if (b.kind === 'container') return;
  const parapet = shadeRgb(side, -0.15);
  const t = 4;
  if (b.kind !== 'villa') {
    batch.box(cx, b.y + t / 2, b.height, 0, b.w, t, 6, parapet);
    batch.box(cx, b.y + b.h - t / 2, b.height, 0, b.w, t, 6, parapet);
    batch.box(b.x + t / 2, cz, b.height, 0, t, b.h, 6, parapet);
    batch.box(b.x + b.w - t / 2, cz, b.height, 0, t, b.h, 6, parapet);
  } else {
    batch.box(cx, cz, b.height, 0, b.w * 0.6, b.h * 0.6, 12, rgb('#c96f4a'));
    batch.box(cx, b.y + b.h + 6, 0, 0, b.w * 0.5, 12, 3, rgb('#e8dcc8'));
  }
  if (b.kind === 'tower') {
    if (b.height > 330) {
      batch.disc(cx, cz, b.height + 0.8, Math.min(b.w, b.h) * 0.3, rgb('#4d555c'));
      batch.disc(cx, cz, b.height + 1.2, Math.min(b.w, b.h) * 0.27, rgb('#f2c94c'), 1, Math.min(b.w, b.h) * 0.24);
      batch.box(cx - 10, cz, b.height + 1.4, 0, 4, 24, 0.5, rgb('#ffffff'));
      batch.box(cx + 10, cz, b.height + 1.4, 0, 4, 24, 0.5, rgb('#ffffff'));
      batch.box(cx, cz, b.height + 1.4, 0, 20, 4, 0.5, rgb('#ffffff'));
      batch.box(b.x + 12, b.y + 12, b.height, 0, 3, 3, 40, rgb('#cccccc'));
      batch.box(b.x + 12, b.y + 12, b.height + 40, 0, 6, 6, 6, rgb('#ff3030'), rgb('#ff3030'), 1, MAT_GLOW);
    } else {
      batch.box(cx, cz, b.height, 0, b.w * 0.45, b.h * 0.45, 28, shadeRgb(side, -0.2), shadeRgb(side, -0.4), 1, MAT_PLAIN, MAT_WINDOWS);
    }
  }
  if (b.kind === 'block' || b.kind === 'warehouse') {
    for (let k = 0; k < (b.kind === 'warehouse' ? 5 : 3); k += 1) {
      const w = rng.range(10, 22);
      batch.box(b.x + rng.range(16, b.w - 16), b.y + rng.range(16, b.h - 16), b.height, rng.range(0, 1) > 0.5 ? 0 : Math.PI / 2, w, w * 0.7, rng.range(6, 12), rgb('#b9bfc4'));
    }
  }
}

function addPalm(batch, palm) {
  const h = 92 * palm.size;
  const trunk = rgb('#8a6a45');
  const lean = 6 * palm.size;
  for (let k = 0; k < 4; k += 1) {
    const f = k / 4;
    batch.box(palm.x + Math.cos(palm.turn) * lean * f * f, palm.y + Math.sin(palm.turn) * lean * f * f, h * f, palm.turn, 6 - k * 0.6, 6 - k * 0.6, h / 4 + 1, shadeRgb(trunk, k % 2 ? -0.1 : 0.05));
  }
  const tx = palm.x + Math.cos(palm.turn) * lean;
  const tz = palm.y + Math.sin(palm.turn) * lean;
  for (let k = 0; k < 8; k += 1) {
    const a = palm.turn + (k / 8) * Math.PI * 2;
    const len = 40 * palm.size;
    const cx = Math.cos(a);
    const sz = Math.sin(a);
    const px = -sz * 7;
    const pz = cx * 7;
    const mid = [tx + cx * len * 0.55, h + 6, tz + sz * len * 0.55];
    const tip = [tx + cx * len, h - 16 * palm.size, tz + sz * len];
    const green = rgb(k % 2 ? '#2f8a3e' : '#45a852');
    batch.quad([tx, h + 2, tz], [mid[0] + px, mid[1], mid[2] + pz], tip, [mid[0] - px, mid[1], mid[2] - pz], UP, green);
  }
  batch.box(tx, tz, h - 4, 0, 8, 8, 8, rgb('#6b4b2a'));
}

function addStreetLamps(batch, city) {
  const pole = rgb('#3a3f46');
  for (let j = 0; j < 7; j += 1) {
    for (let i = 0; i < 8; i += 1) {
      for (const [ox, oz] of [[2.5, 2.5], [11.5, 11.5]]) {
        const x = (i * BLOCK + ox) * TILE;
        const z = (j * BLOCK + oz) * TILE;
        batch.box(x, z, 0, 0, 3, 3, 64, pole);
        batch.box(x, z, 64, 0, 10, 10, 3, pole, rgb('#fff3c4'), 1, MAT_GLOW, MAT_PLAIN);
      }
    }
  }
  for (const prop of city.props) {
    if (prop.type !== 'umbrella') continue;
    batch.box(prop.x, prop.y, 0, 0, 2, 2, 30, rgb('#dddddd'));
    const c = rgb(prop.color);
    for (let k = 0; k < 8; k += 1) {
      const a0 = (k / 8) * Math.PI * 2;
      const a1 = ((k + 1) / 8) * Math.PI * 2;
      batch.quad([prop.x, 36, prop.y], [prop.x + Math.cos(a0) * 26, 26, prop.y + Math.sin(a0) * 26], [prop.x + Math.cos(a1) * 26, 26, prop.y + Math.sin(a1) * 26], [prop.x, 36, prop.y], UP, k % 2 ? c : [1, 1, 1]);
    }
    batch.box(prop.x + 22, prop.y + 8, 0, 0.4, 30, 12, 2, rgb('#f6f1e6'));
  }
}

export function buildCityMesh(batch, city) {
  const rng = createRandom(4242);
  addGround(batch, city);
  for (const b of city.buildings) addBuilding(batch, b, rng);
  for (const palm of city.palms) addPalm(batch, palm);
  addStreetLamps(batch, city);
}
