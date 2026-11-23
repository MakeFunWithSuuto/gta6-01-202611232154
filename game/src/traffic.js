// The road network and its traffic: cars keep to the right-hand lane from intersection to
// intersection, choose a turn at each one, slow behind whatever is in front of them, and are
// spawned and retired just out of the player's sight so the streets always look alive.
import { BLOCK, BLOCKS_X, BLOCKS_Y, TILE, TRAFFIC_COUNT } from './config.js';
import { dist2 } from './physics.js';
import { CAR_MODELS, createCar, steerToward, TRAFFIC_MODELS } from './vehicles.js';

export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const LANE = 30;
const NODES_X = BLOCKS_X + 1;
const NODES_Y = BLOCKS_Y + 1;

export function nodePoint(i, j) { return { x: (i * BLOCK + 1) * TILE, y: (j * BLOCK + 1) * TILE }; }
const validNode = (i, j) => i >= 0 && j >= 0 && i < NODES_X && j < NODES_Y;

/** The lane point at node (i, j) for a car travelling in `dir`. */
export function lanePoint(i, j, dir) {
  const p = nodePoint(i, j);
  const [dx, dy] = DIRS[dir];
  return { x: p.x - dy * LANE, y: p.y + dx * LANE };
}

function chooseTurn(rng, i, j, dir) {
  const options = [];
  for (let d = 0; d < 4; d += 1) {
    if (d === (dir + 2) % 4) continue;
    if (!validNode(i + DIRS[d][0], j + DIRS[d][1])) continue;
    options.push(d, ...(d === dir ? [d, d] : []));
  }
  return options.length ? rng.pick(options) : (dir + 2) % 4;
}

/** Put a car on the road network heading to the node after (i, j) in `dir`, part way along the street. */
export function placeOnRoad(car, i, j, dir, along) {
  const p = lanePoint(i, j, dir);
  car.x = p.x + DIRS[dir][0] * along;
  car.y = p.y + DIRS[dir][1] * along;
  car.angle = Math.atan2(DIRS[dir][1], DIRS[dir][0]);
  car.ai = { i: i + DIRS[dir][0], j: j + DIRS[dir][1], dir, wait: 0 };
}

/** Nearest node to a world point. */
export function nearestNode(x, y) {
  const i = Math.max(0, Math.min(NODES_X - 1, Math.round((x / TILE - 1) / BLOCK)));
  const j = Math.max(0, Math.min(NODES_Y - 1, Math.round((y / TILE - 1) / BLOCK)));
  return { i, j };
}

/** Is anything (car, walker or the player) in the lane just ahead of this car? */
function blockedAhead(car, world, reach) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const check = (x, y, width) => {
    const dx = x - car.x;
    const dy = y - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead <= 10 || ahead > reach) return false;
    return Math.abs(-dx * fy + dy * fx) < width;
  };
  for (const other of world.cars) if (other !== car && check(other.x, other.y, 24)) return true;
  for (const ped of world.peds) if (!ped.dead && check(ped.x, ped.y, 18)) return true;
  const p = world.player;
  return !p.car && check(p.x, p.y, 20);
}

/** Drive a traffic car one step along its route (steering only; physics runs after). */
export function driveTraffic(car, world, cruise = 165) {
  const ai = car.ai;
  const target = lanePoint(ai.i, ai.j, ai.dir);
  if (dist2(car.x, car.y, target.x, target.y) < 46 * 46) {
    const next = chooseTurn(world.rng, ai.i, ai.j, ai.dir);
    ai.dir = next;
    ai.i += DIRS[next][0];
    ai.j += DIRS[next][1];
  }
  const goal = lanePoint(ai.i, ai.j, ai.dir);
  const blocked = blockedAhead(car, world, 70 + Math.max(0, car.speed) * 0.45);
  steerToward(car, goal.x, goal.y, blocked ? 0 : cruise);
  if (blocked) {
    car.throttle = car.speed > 5 ? -1 : 0;
    ai.wait += 1 / 60;
  } else ai.wait = 0;
}

/** Keep the streets full: retire far civilian cars, add new ones on the network out of view. */
export function maintainTraffic(world) {
  const p = world.focus;
  world.cars = world.cars.filter((car) => {
    const far = dist2(car.x, car.y, p.x, p.y) > 2300 * 2300;
    const keep = car.tag || car === world.player.car || car.driver === 'cop' || car.driver === 'player';
    return !(far && !keep);
  });
  let civil = 0;
  for (const car of world.cars) if (car.driver === 'ai') civil += 1;
  let tries = 0;
  while (civil < TRAFFIC_COUNT && tries < 30) {
    tries += 1;
    const i = world.rng.int(0, NODES_X - 1);
    const j = world.rng.int(0, NODES_Y - 1);
    const dir = world.rng.int(0, 3);
    if (!validNode(i + DIRS[dir][0], j + DIRS[dir][1])) continue;
    const start = nodePoint(i, j);
    const d = dist2(start.x, start.y, p.x, p.y);
    if (d > 1900 * 1900 || (d < 850 * 850 && !world.populateVisible)) continue;
    const model = world.rng.pick(TRAFFIC_MODELS);
    const car = createCar(model, 0, 0, 0, world.rng.pick(CAR_MODELS[model].colors));
    placeOnRoad(car, i, j, dir, world.rng.range(140, BLOCK * TILE - 260));
    if (world.cars.some((c) => dist2(c.x, c.y, car.x, car.y) < 90 * 90)) continue;
    car.driver = 'ai';
    car.speed = 120;
    car.vx = Math.cos(car.angle) * 120;
    car.vy = Math.sin(car.angle) * 120;
    world.cars.push(car);
    civil += 1;
  }
}
