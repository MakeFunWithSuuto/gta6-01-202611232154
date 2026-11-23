// Bakes the whole ground of Solmar Bay into one texture for the 3D renderer: asphalt with lane
// lines and crosswalks, sidewalks with curbs, lawns, plazas, parking lots, docks, sand and sea,
// plus pools, fountains and parked cars, painted tile by tile at TEXELS pixels per tile.
import { BEACH_ROW, BLOCK, TILE, T_BUILDING, T_DOCK, T_GRASS, T_LOT, T_PLAZA, T_ROAD, T_SAND, T_WALK, T_WATER, WATER_ROW } from './config.js';
import { createRandom } from './random.js';

const CHUNK = 8;
const CHUNK_PX = CHUNK * TILE;
export const TEXELS = 32;

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

function bakeChunkInto(g, city, cx, cy) {
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
}


/** One canvas holding the whole map's ground at TEXELS px per tile. */
export function bakeGroundTexture(city) {
  const scale = TEXELS / TILE;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(city.width * scale);
  canvas.height = Math.round(city.height * scale);
  const g = canvas.getContext('2d');
  for (let cy = 0; cy * CHUNK_PX < city.height; cy += 1) {
    for (let cx = 0; cx * CHUNK_PX < city.width; cx += 1) {
      g.setTransform(scale, 0, 0, scale, cx * CHUNK_PX * scale, cy * CHUNK_PX * scale);
      g.save();
      g.beginPath(); g.rect(0, 0, CHUNK_PX, CHUNK_PX); g.clip();
      bakeChunkInto(g, city, cx, cy);
      g.restore();
    }
  }
  return canvas;
}
