// Paints the city: the ground (asphalt with lane lines and crosswalks, sidewalks, lawns, plazas,
// parking lots, docks, sand and sea) baked into cached chunks, then sun shadows, and the buildings
// as boxes seen from a camera high above, so towers lean away from the centre of the screen.
import {
  BEACH_ROW, BLOCK, CAMERA_HEIGHT, TILE, T_BUILDING, T_DOCK, T_GRASS, T_LOT, T_PLAZA, T_ROAD,
  T_SAND, T_WALK, T_WATER, WATER_ROW,
} from './config.js';
import { createRandom } from './random.js';

const CHUNK = 8;
const CHUNK_PX = CHUNK * TILE;
const MAX_CHUNKS = 70;
const chunkCache = new Map();

function shade(hex, amount) {
  const n = Number.parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
export { shade };

function paintTile(g, city, tx, ty, x, y, rng) {
  const t = city.tileAt(tx, ty);
  const mx = ((tx % BLOCK) + BLOCK) % BLOCK;
  const my = ((ty % BLOCK) + BLOCK) % BLOCK;
  switch (t) {
    case T_ROAD: {
      g.fillStyle = '#41444c';
      g.fillRect(x, y, TILE, TILE);
      for (let k = 0; k < 10; k += 1) {
        g.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
        g.fillRect(x + rng.range(0, TILE), y + rng.range(0, TILE), rng.range(3, 10), rng.range(2, 6));
      }
      const horizontal = my < 2 && ty < BEACH_ROW;
      const vertical = mx < 2;
      if (horizontal && !vertical) {
        if (my === 0) { g.fillStyle = '#f2c94c'; g.fillRect(x, y + TILE - 3, TILE, 2); g.fillRect(x, y + TILE + 1 - 6, TILE, 0); }
        if (mx === 2 || mx === 11) {
          g.fillStyle = 'rgba(240,240,235,0.85)';
          for (let k = 0; k < 6; k += 1) g.fillRect(x + 14, y + 4 + k * 10, 36, 5);
        }
      } else if (vertical && !horizontal) {
        if (mx === 0) { g.fillStyle = '#f2c94c'; g.fillRect(x + TILE - 3, y, 2, TILE); }
        if (my === 2 || my === 11) {
          g.fillStyle = 'rgba(240,240,235,0.85)';
          for (let k = 0; k < 6; k += 1) g.fillRect(x + 4 + k * 10, y + 14, 5, 36);
        }
      } else if (horizontal && vertical) {
        g.fillStyle = 'rgba(0,0,0,0.06)';
        g.fillRect(x, y, TILE, TILE);
      }
      if (ty >= BEACH_ROW - 2 && ty < BEACH_ROW && !vertical && mx % 2 === 0) {
        g.fillStyle = 'rgba(255,255,255,0.7)';
        if (my === 0) g.fillRect(x + 8, y + TILE - 3, 34, 2);
      }
      break;
    }
    case T_WALK:
      g.fillStyle = '#d7cfc1';
      g.fillRect(x, y, TILE, TILE);
      g.strokeStyle = 'rgba(120,105,90,0.25)';
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, 32, 32);
      g.strokeRect(x + 32.5, y + 32.5, 31, 31);
      if (mx === 2 || mx === 11 || my === 2 || my === 11) {
        g.fillStyle = '#b9b0a2';
        if (my === 2) g.fillRect(x, y, TILE, 4);
        if (my === 11) g.fillRect(x, y + TILE - 4, TILE, 4);
        if (mx === 2) g.fillRect(x, y, 4, TILE);
        if (mx === 11) g.fillRect(x + TILE - 4, y, 4, TILE);
      }
      break;
    case T_GRASS:
      g.fillStyle = (tx + ty) % 2 ? '#79b957' : '#74b453';
      g.fillRect(x, y, TILE, TILE);
      for (let k = 0; k < 14; k += 1) {
        g.fillStyle = rng.chance(0.5) ? '#8ccb63' : '#64a246';
        g.fillRect(x + rng.range(0, TILE), y + rng.range(0, TILE), 3, 3);
      }
      break;
    case T_PLAZA:
      g.fillStyle = '#e7d8bd';
      g.fillRect(x, y, TILE, TILE);
      g.fillStyle = '#dcc9a8';
      g.fillRect(x + 2, y + 2, 28, 28);
      g.fillRect(x + 34, y + 34, 28, 28);
      break;
    case T_LOT:
      g.fillStyle = '#6f747c';
      g.fillRect(x, y, TILE, TILE);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(x, y + 4, 2, 26); g.fillRect(x + 32, y + 4, 2, 26);
      g.fillRect(x, y + 34, 2, 26); g.fillRect(x + 32, y + 34, 2, 26);
      break;
    case T_DOCK:
      g.fillStyle = '#8f6c48';
      g.fillRect(x, y, TILE, TILE);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let k = 0; k < TILE; k += 8) g.fillRect(x, y + k, TILE, 1);
      break;
    case T_SAND:
      g.fillStyle = '#f0d9a2';
      g.fillRect(x, y, TILE, TILE);
      for (let k = 0; k < 12; k += 1) {
        g.fillStyle = rng.chance(0.5) ? '#e6cb8d' : '#f7e6b8';
        g.fillRect(x + rng.range(0, TILE), y + rng.range(0, TILE), 2, 2);
      }
      if (ty === WATER_ROW - 1) { g.fillStyle = '#d9c08a'; g.fillRect(x, y + TILE - 14, TILE, 14); }
      break;
    case T_WATER: {
      const depth = Math.min(1, (ty - WATER_ROW) / 8);
      g.fillStyle = `rgb(${Math.round(56 - depth * 30)},${Math.round(190 - depth * 60)},${Math.round(205 - depth * 25)})`;
      g.fillRect(x, y, TILE, TILE);
      break;
    }
    case T_BUILDING:
      g.fillStyle = '#9a9184';
      g.fillRect(x, y, TILE, TILE);
      break;
    default:
      g.fillStyle = '#888';
      g.fillRect(x, y, TILE, TILE);
  }
}

function bakeChunk(city, cx, cy) {
  const canvas = document.createElement('canvas');
  canvas.width = CHUNK_PX;
  canvas.height = CHUNK_PX;
  const g = canvas.getContext('2d');
  const rng = createRandom(cx * 7919 + cy * 104729);
  for (let j = 0; j < CHUNK; j += 1) {
    for (let i = 0; i < CHUNK; i += 1) paintTile(g, city, cx * CHUNK + i, cy * CHUNK + j, i * TILE, j * TILE, rng);
  }
  for (const pool of city.pools) {
    const px = pool.x - cx * CHUNK_PX;
    const py = pool.y - cy * CHUNK_PX;
    if (px > CHUNK_PX || py > CHUNK_PX || px + pool.w < 0 || py + pool.h < 0) continue;
    g.fillStyle = pool.pond ? '#4f9fb0' : '#f4f1ea';
    g.beginPath(); g.roundRect(px - 4, py - 4, pool.w + 8, pool.h + 8, pool.pond ? 40 : 6); g.fill();
    g.fillStyle = pool.pond ? '#3c8ea6' : '#38c6e0';
    g.beginPath(); g.roundRect(px, py, pool.w, pool.h, pool.pond ? 36 : 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(px + 4, py + 4, pool.w * 0.5, 3);
  }
  for (const prop of city.props) {
    const px = prop.x - cx * CHUNK_PX;
    const py = prop.y - cy * CHUNK_PX;
    if (px < -80 || py < -80 || px > CHUNK_PX + 80 || py > CHUNK_PX + 80) continue;
    if (prop.type === 'fountain') {
      g.fillStyle = '#cdbb9a'; g.beginPath(); g.arc(px, py, 26, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5cc8dc'; g.beginPath(); g.arc(px, py, 20, 0, Math.PI * 2); g.fill();
    } else if (prop.type === 'cars') {
      const colors = ['#d0453c', '#e8e4d8', '#3b6ea8', '#222', '#f2c94c'];
      for (let k = 0; k < 4; k += 1) {
        g.fillStyle = colors[(k + cx + cy) % colors.length];
        g.beginPath(); g.roundRect(px - 100 + k * 64 + 18, py - 52, 26, 44, 6); g.fill();
        g.fillStyle = 'rgba(30,40,50,0.6)'; g.fillRect(px - 100 + k * 64 + 21, py - 44, 20, 9);
      }
    }
  }
  return canvas;
}

function chunk(city, cx, cy) {
  const key = cx * 1000 + cy;
  let canvas = chunkCache.get(key);
  if (canvas) { chunkCache.delete(key); chunkCache.set(key, canvas); return canvas; }
  canvas = bakeChunk(city, cx, cy);
  chunkCache.set(key, canvas);
  if (chunkCache.size > MAX_CHUNKS) chunkCache.delete(chunkCache.keys().next().value);
  return canvas;
}

/** Ground for the visible rectangle (world coords), the moving sea, and the surf line. */
export function drawGround(ctx, world, view) {
  const city = world.city;
  const c0 = Math.floor(view.x0 / CHUNK_PX);
  const c1 = Math.floor(view.x1 / CHUNK_PX);
  const r0 = Math.floor(view.y0 / CHUNK_PX);
  const r1 = Math.floor(view.y1 / CHUNK_PX);
  for (let cy = r0; cy <= r1; cy += 1) {
    for (let cx = c0; cx <= c1; cx += 1) {
      if (cx < 0 || cy < 0 || cx * CHUNK_PX >= city.width || cy * CHUNK_PX >= city.height) {
        ctx.fillStyle = '#2f8fb0';
        ctx.fillRect(cx * CHUNK_PX, cy * CHUNK_PX, CHUNK_PX + 1, CHUNK_PX + 1);
        continue;
      }
      ctx.drawImage(chunk(city, cx, cy), cx * CHUNK_PX, cy * CHUNK_PX, CHUNK_PX + 0.5, CHUNK_PX + 0.5);
    }
  }
  const waterTop = WATER_ROW * TILE;
  if (view.y1 > waterTop - 40) {
    const t = world.time;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let x = Math.max(26 * TILE, view.x0 - 20); x < view.x1 + 20; x += 16) {
      const y = waterTop + 6 + Math.sin(x * 0.02 + t * 1.6) * 5 + Math.sin(t * 0.8) * 4;
      if (x === Math.max(26 * TILE, view.x0 - 20)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    for (let row = 0; row < 7; row += 1) {
      const y = waterTop + 60 + row * 90;
      if (y < view.y0 || y > view.y1) continue;
      ctx.beginPath();
      for (let x = view.x0 - 40; x < view.x1 + 40; x += 20) {
        const yy = y + Math.sin(x * 0.012 + t * 1.2 + row) * 8;
        if (x === view.x0 - 40) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }
}

/** Where a point at `height` above (x, y) appears on the ground plane, seen from the camera. */
export function lift(cam, x, y, height) {
  const k = height / (CAMERA_HEIGHT - height);
  return { x: x + (x - cam.x) * k, y: y + (y - cam.y) * k };
}

/** Sun direction and shadow length per unit of height for the time of day. */
export function sunVector(clock) {
  const t = (clock - 6) / 14;
  const ang = Math.PI * Math.min(1, Math.max(0, t));
  const low = Math.abs(Math.cos(ang));
  return { x: -Math.cos(ang) * (0.35 + low * 0.9), y: 0.25 + low * 0.2 };
}

/** Cast shadows of buildings and palms onto `g` (an offscreen layer using the same transform). */
export function drawShadows(g, world, view, sun) {
  g.fillStyle = '#000';
  for (const b of world.city.buildings) {
    if (b.x > view.x1 + 400 || b.y > view.y1 + 400 || b.x + b.w < view.x0 - 400 || b.y + b.h < view.y0 - 400) continue;
    const dx = sun.x * b.height;
    const dy = sun.y * b.height;
    const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
    for (let k = 0; k < 4; k += 1) {
      const [ax, ay] = pts[k];
      const [cx, cy] = pts[(k + 1) % 4];
      g.beginPath();
      g.moveTo(ax, ay); g.lineTo(cx, cy); g.lineTo(cx + dx, cy + dy); g.lineTo(ax + dx, ay + dy);
      g.fill();
    }
    g.fillRect(b.x + dx, b.y + dy, b.w, b.h);
  }
  for (const palm of world.city.palms) {
    if (palm.x < view.x0 - 200 || palm.x > view.x1 + 200 || palm.y < view.y0 - 200 || palm.y > view.y1 + 200) continue;
    const h = 70 * palm.size;
    g.lineWidth = 4;
    g.strokeStyle = '#000';
    g.beginPath(); g.moveTo(palm.x, palm.y); g.lineTo(palm.x + sun.x * h, palm.y + sun.y * h); g.stroke();
    g.beginPath(); g.arc(palm.x + sun.x * h, palm.y + sun.y * h, 15 * palm.size, 0, Math.PI * 2); g.fill();
  }
  for (const car of world.cars) {
    if (car.x < view.x0 - 80 || car.x > view.x1 + 80 || car.y < view.y0 - 80 || car.y > view.y1 + 80) continue;
    g.save();
    g.translate(car.x + sun.x * 10, car.y + sun.y * 10);
    g.rotate(car.angle);
    g.fillRect(-car.spec.len / 2, -car.spec.wid / 2, car.spec.len, car.spec.wid);
    g.restore();
  }
}

function wallColor(base, nx, ny, sun) {
  const light = -(nx * sun.x + ny * sun.y);
  return shade(base, light > 0 ? Math.min(0.25, light * 0.3) : Math.max(-0.45, light * 0.6 - 0.12));
}

function drawWall(ctx, cam, b, ax, ay, bx, by, nx, ny, sun) {
  const ra = lift(cam, ax, ay, b.height);
  const rb = lift(cam, bx, by, b.height);
  ctx.fillStyle = wallColor(b.color, nx, ny, sun);
  ctx.beginPath();
  ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(rb.x, rb.y); ctx.lineTo(ra.x, ra.y);
  ctx.closePath();
  ctx.fill();
  const floor = b.kind === 'tower' ? 16 : b.kind === 'container' ? 0 : 22;
  if (!floor) return;
  ctx.strokeStyle = b.kind === 'tower' ? 'rgba(20,45,70,0.35)' : 'rgba(60,40,30,0.25)';
  ctx.lineWidth = b.kind === 'tower' ? 1.6 : 2.4;
  ctx.beginPath();
  for (let h = floor; h < b.height - 4; h += floor) {
    const pa = lift(cam, ax, ay, h);
    const pb = lift(cam, bx, by, h);
    ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
  }
  const len = Math.hypot(bx - ax, by - ay);
  const cols = Math.floor(len / (b.kind === 'tower' ? 18 : 26));
  for (let c = 1; c < cols; c += 1) {
    const t = c / cols;
    const px = ax + (bx - ax) * t;
    const py = ay + (by - ay) * t;
    const top = lift(cam, px, py, b.height);
    ctx.moveTo(px, py); ctx.lineTo(top.x, top.y);
  }
  ctx.stroke();
}

function drawRoof(ctx, cam, b, now) {
  const corners = [lift(cam, b.x, b.y, b.height), lift(cam, b.x + b.w, b.y, b.height), lift(cam, b.x + b.w, b.y + b.h, b.height), lift(cam, b.x, b.y + b.h, b.height)];
  const roofColor = b.kind === 'villa' ? '#d9825b' : b.kind === 'tower' ? shade(b.color, -0.25) : shade(b.color, 0.12);
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
  ctx.closePath();
  ctx.fill();
  const s = 1 + b.height / (CAMERA_HEIGHT - b.height);
  const x = corners[0].x;
  const y = corners[0].y;
  const w = b.w * s;
  const h = b.h * s;
  if (b.kind === 'villa') {
    ctx.strokeStyle = 'rgba(120,50,30,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (w > h) { ctx.moveTo(x + 6, y + h / 2); ctx.lineTo(x + w - 6, y + h / 2); } else { ctx.moveTo(x + w / 2, y + 6); ctx.lineTo(x + w / 2, y + h - 6); }
    for (let k = 8; k < Math.max(w, h); k += 8) {
      if (w > h) { ctx.moveTo(x + k, y + 2); ctx.lineTo(x + k, y + h - 2); } else { ctx.moveTo(x + 2, y + k); ctx.lineTo(x + w - 2, y + k); }
    }
    ctx.stroke();
    return;
  }
  if (b.kind === 'container') {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let k = 6; k < w - 2; k += 8) ctx.fillRect(x + k, y + 2, 3, h - 4);
    return;
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  const rng = createRandom(Math.floor(b.seed * 1e6));
  if (b.kind === 'tower' && b.height > 330) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) * 0.28;
    ctx.fillStyle = '#5b636b'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r - 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f4f4f4'; ctx.font = `bold ${Math.round(r)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('H', cx, cy + 1);
    if (Math.sin(now * 4) > 0) { ctx.fillStyle = '#ff4040'; ctx.fillRect(x + 6, y + 6, 5, 5); ctx.fillRect(x + w - 11, y + h - 11, 5, 5); }
  } else {
    for (let k = 0; k < (b.kind === 'warehouse' ? 6 : 3); k += 1) {
      ctx.fillStyle = rng.chance(0.5) ? '#b9bfc4' : '#9ca3a9';
      const bw = rng.range(10, 22);
      ctx.fillRect(x + rng.range(10, w - bw - 10), y + rng.range(10, h - bw - 10), bw, bw * 0.7);
    }
    if (b.kind === 'warehouse') {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let k = 12; k < w - 12; k += 24) ctx.fillRect(x + k, y + 8, 10, h - 16);
    }
  }
}

/** Every visible building as a box, farthest from the camera first. */
export function drawBuildings(ctx, world, cam, view, sun) {
  const list = [];
  for (const b of world.city.buildings) {
    const pad = b.height * 0.8;
    if (b.x > view.x1 + pad || b.y > view.y1 + pad || b.x + b.w < view.x0 - pad || b.y + b.h < view.y0 - pad) continue;
    const dx = Math.max(b.x - cam.x, 0, cam.x - (b.x + b.w));
    const dy = Math.max(b.y - cam.y, 0, cam.y - (b.y + b.h));
    list.push({ b, d: dx * dx + dy * dy });
  }
  list.sort((a, c) => c.d - a.d);
  for (const { b } of list) {
    if (cam.y < b.y) drawWall(ctx, cam, b, b.x, b.y, b.x + b.w, b.y, 0, -1, sun);
    if (cam.y > b.y + b.h) drawWall(ctx, cam, b, b.x, b.y + b.h, b.x + b.w, b.y + b.h, 0, 1, sun);
    if (cam.x < b.x) drawWall(ctx, cam, b, b.x, b.y, b.x, b.y + b.h, -1, 0, sun);
    if (cam.x > b.x + b.w) drawWall(ctx, cam, b, b.x + b.w, b.y, b.x + b.w, b.y + b.h, 1, 0, sun);
    drawRoof(ctx, cam, b, world.time);
  }
}

/** Palms: a curved trunk rising toward the camera and a crown of fronds. */
export function drawPalms(ctx, world, cam, view) {
  for (const palm of world.city.palms) {
    if (palm.x < view.x0 - 150 || palm.x > view.x1 + 150 || palm.y < view.y0 - 150 || palm.y > view.y1 + 150) continue;
    const h = 70 * palm.size;
    const top = lift(cam, palm.x, palm.y, h);
    ctx.strokeStyle = '#8a6a45';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.quadraticCurveTo(palm.x + 6, (palm.y + top.y) / 2, top.x, top.y); ctx.stroke();
    const sway = Math.sin(world.time * 1.3 + palm.turn) * 0.08;
    for (let k = 0; k < 7; k += 1) {
      const a = palm.turn + (k / 7) * Math.PI * 2 + sway;
      const len = 26 * palm.size;
      ctx.strokeStyle = k % 2 ? '#2f8a3e' : '#3fa34d';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.quadraticCurveTo(top.x + Math.cos(a) * len * 0.6, top.y + Math.sin(a) * len * 0.6 - 4, top.x + Math.cos(a) * len, top.y + Math.sin(a) * len + 4);
      ctx.stroke();
    }
    ctx.fillStyle = '#6b4b2a';
    ctx.beginPath(); ctx.arc(top.x, top.y, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = 'butt';
}

