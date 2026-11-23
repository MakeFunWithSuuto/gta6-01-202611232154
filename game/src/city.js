// Builds Solmar Bay: a fixed grid of roads, sidewalks and city blocks, each block dressed by its
// district (glass towers downtown, warehouses at the harbor, pastel villas on the beach strand),
// plus palms, pools, the beach and the sea, and the named places missions and services use.
import {
  BEACH_ROW, BLOCK, BLOCKS_X, BLOCKS_Y, MAP_H, MAP_W, TILE, T_BUILDING, T_DOCK, T_GRASS, T_LOT,
  T_PLAZA, T_ROAD, T_SAND, T_WALK, T_WATER, WATER_ROW,
} from './config.js';
import { createRandom } from './random.js';

export const DISTRICTS = {
  centro: { name: 'Vista Centro', ground: T_PLAZA },
  harbor: { name: 'Saltworks Harbor', ground: T_DOCK },
  strand: { name: 'Coral Strand', ground: T_GRASS },
  heights: { name: 'Jacaranda Heights', ground: T_GRASS },
  midtown: { name: 'Mercado', ground: T_LOT },
  park: { name: 'Palmetto Park', ground: T_GRASS },
};

const PARKS = new Set(['2,1', '6,3', '5,5']);
const GLASS = ['#5fa8c9', '#4d8fb5', '#79bfd1', '#3f7ea3', '#8ccbd6', '#e8eef0'];
const PASTEL = ['#f4b6a6', '#f7d79a', '#a7dcc9', '#f2a5c0', '#fbe9d0', '#b9d7ef', '#f6c28b'];
const STUCCO = ['#e9d8c0', '#d9b99b', '#efe3cf', '#c9a58b', '#e5c7a8', '#f0d3c2'];
const STEEL = ['#8c99a3', '#7a8794', '#a3aab0', '#6f7d86'];
const CONTAINER = ['#c4513b', '#2f6f9e', '#d39b2a', '#3f8a5c', '#8a4ea0'];

export function districtOf(bi, bj) {
  if (PARKS.has(`${bi},${bj}`)) return 'park';
  if (bi <= 1 && bj >= 4) return 'harbor';
  if (bj === 6) return 'strand';
  if (bi >= 3 && bi <= 4 && bj >= 2 && bj <= 4) return 'centro';
  if (bj === 0) return 'heights';
  return 'midtown';
}

/** The district a world position falls in (blocks, then the beach and the sea). */
export function districtAt(x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (ty >= BEACH_ROW) return tx < 26 ? DISTRICTS.harbor.name : 'Solmar Beach';
  const bi = Math.min(BLOCKS_X - 1, Math.max(0, Math.floor((tx - 1) / BLOCK)));
  const bj = Math.min(BLOCKS_Y - 1, Math.max(0, Math.floor((ty - 1) / BLOCK)));
  return DISTRICTS[districtOf(bi, bj)].name;
}

/** Centre of the sidewalk tile midway along a block's south edge: where its door markers stand. */
function blockDoor(bi, bj) {
  return { x: (bi * BLOCK + 6.5) * TILE, y: (bj * BLOCK + 11.5) * TILE };
}

export function createCity() {
  const rng = createRandom(20261117);
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const buildings = [];
  const palms = [];
  const pools = [];
  const props = [];

  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[y * MAP_W + x] = t; };

  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      let t;
      if (y >= WATER_ROW || (x < 26 && y >= BEACH_ROW + 3)) t = T_WATER;
      else if (y >= BEACH_ROW) t = x < 26 ? T_DOCK : T_SAND;
      else if (x % BLOCK < 2 || y % BLOCK < 2) t = T_ROAD;
      else if (x % BLOCK === 2 || x % BLOCK === 11 || y % BLOCK === 2 || y % BLOCK === 11) t = T_WALK;
      else t = DISTRICTS[districtOf(Math.floor(x / BLOCK), Math.floor(y / BLOCK))].ground;
      set(x, y, t);
    }
  }

  function addBuilding(tx, ty, tw, th, height, color, kind) {
    for (let y = ty; y < ty + th; y += 1) for (let x = tx; x < tx + tw; x += 1) set(x, y, T_BUILDING);
    buildings.push({ x: tx * TILE, y: ty * TILE, w: tw * TILE, h: th * TILE, height, color, kind, seed: rng.next() });
  }
  function addPalm(x, y) { palms.push({ x, y, size: rng.range(0.85, 1.25), turn: rng.range(0, Math.PI * 2) }); }

  for (let bj = 0; bj < BLOCKS_Y; bj += 1) {
    for (let bi = 0; bi < BLOCKS_X; bi += 1) {
      const x0 = bi * BLOCK + 3;
      const y0 = bj * BLOCK + 3;
      const district = districtOf(bi, bj);
      if (district === 'centro') {
        if (rng.chance(0.5)) {
          addBuilding(x0 + 1, y0 + 1, 6, 6, rng.range(300, 460), rng.pick(GLASS), 'tower');
        } else {
          addBuilding(x0, y0, 8, 3, rng.range(200, 340), rng.pick(GLASS), 'tower');
          addBuilding(x0 + 1, y0 + 5, 6, 3, rng.range(160, 300), rng.pick(GLASS), 'tower');
        }
        props.push({ type: 'fountain', x: (x0 + 0.5) * TILE, y: (y0 + 7.5) * TILE });
      } else if (district === 'harbor') {
        addBuilding(x0, y0, 8, 3, rng.range(46, 64), rng.pick(STEEL), 'warehouse');
        for (let r = 0; r < 2; r += 1) {
          for (let c = 0; c < 3; c += 1) {
            if (rng.chance(0.75)) addBuilding(x0 + c * 3, y0 + 4 + r * 2, 2, 1, 26, rng.pick(CONTAINER), 'container');
          }
        }
      } else if (district === 'park') {
        for (let k = 0; k < 14; k += 1) addPalm((x0 + rng.range(0.5, 7.5)) * TILE, (y0 + rng.range(0.5, 7.5)) * TILE);
        pools.push({ x: (x0 + 2.5) * TILE, y: (y0 + 2.5) * TILE, w: 3 * TILE, h: 3 * TILE, pond: true });
      } else {
        for (let ly = 0; ly < 2; ly += 1) {
          for (let lx = 0; lx < 2; lx += 1) {
            const lotX = x0 + lx * 4;
            const lotY = y0 + ly * 4;
            if (district === 'midtown') {
              if (rng.chance(0.12)) { props.push({ type: 'cars', x: (lotX + 2) * TILE, y: (lotY + 2) * TILE }); continue; }
              const w = rng.int(3, 4);
              const h = rng.int(3, 4);
              addBuilding(lotX + (4 - w) * lx, lotY + (4 - h) * ly, w, h, rng.range(60, 150), rng.pick(STUCCO), 'block');
            } else {
              const wide = rng.chance(0.5);
              const w = wide ? 3 : 2;
              const h = wide ? 2 : 3;
              const bx = lotX + (lx === 0 ? 0 : 4 - w);
              const by = lotY + (ly === 0 ? 0 : 4 - h);
              addBuilding(bx, by, w, h, rng.range(34, 62), rng.pick(PASTEL), 'villa');
              const px = lx === 0 ? lotX + w : lotX;
              const py = ly === 0 ? lotY + h - 1 : lotY + 4 - h;
              if (rng.chance(0.55)) pools.push({ x: (px + 0.15) * TILE, y: (py + 0.2) * TILE, w: 0.7 * TILE, h: 1.4 * TILE });
              addPalm((px + 0.5) * TILE, (ly === 0 ? lotY + 3.5 : lotY + 0.5) * TILE);
            }
          }
        }
      }
    }
  }

  // Street palms along the sidewalks of the strand and the boulevard by the beach.
  for (let x = 3; x < MAP_W - 2; x += 3) {
    if (tileAt(x, BEACH_ROW - 3) === T_WALK) addPalm((x + 0.5) * TILE, (BEACH_ROW - 2.6) * TILE);
    if (x > 26) addPalm((x + 0.5) * TILE, (BEACH_ROW + 0.7) * TILE);
  }
  for (let k = 0; k < 18; k += 1) props.push({ type: 'umbrella', x: rng.range(28, MAP_W - 2) * TILE, y: rng.range(BEACH_ROW + 1.5, WATER_ROW - 1) * TILE, color: rng.pick(PASTEL) });

  function tileAt(x, y) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return T_WATER;
    return tiles[y * MAP_W + x];
  }

  const places = {
    safehouse: { ...blockDoor(6, 5), name: 'Safehouse', icon: 'H', color: '#5ee0a0' },
    garage: { ...blockDoor(1, 3), name: "Vega's Garage", icon: 'V', color: '#ffcf5a' },
    respray: { ...blockDoor(5, 1), name: 'Spray-Lab Respray', icon: 'S', color: '#ff7ad9' },
    hospital: { ...blockDoor(3, 1), name: 'St. Ines Medical', icon: '+', color: '#ff5d5d' },
    police: { ...blockDoor(4, 4), name: 'SBPD Precinct', icon: 'P', color: '#5d9bff' },
    arms: { ...blockDoor(2, 4), name: 'Iron Coast Arms', icon: 'G', color: '#ffa24d' },
    pier: { x: 12 * TILE, y: (BEACH_ROW + 1.5) * TILE, name: 'Saltworks Pier', icon: '!', color: '#ffcf5a' },
    tower: { ...blockDoor(4, 2), name: 'Halcyon Tower', icon: '!', color: '#ffcf5a' },
    club: { ...blockDoor(7, 6), name: 'Club Marea', icon: '!', color: '#ffcf5a' },
    market: { ...blockDoor(6, 1), name: 'Mercado Norte', icon: '!', color: '#ffcf5a' },
  };

  return {
    tiles, buildings, palms, pools, props, places,
    width: MAP_W * TILE,
    height: MAP_H * TILE,
    tileAt,
    tileAtPoint: (x, y) => tileAt(Math.floor(x / TILE), Math.floor(y / TILE)),
    solidAt: (x, y) => {
      const t = tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
      return t === T_BUILDING || t === T_WATER;
    },
  };
}
