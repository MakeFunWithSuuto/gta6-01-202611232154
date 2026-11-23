// People on foot: civilians strolling the sidewalks and beach who panic at gunfire, and the armed
// walkers (police officers, Tidewater Crew gangsters, mission targets) who close in and shoot.
import { PED_COUNT, PED_RADIUS, TILE, T_DOCK, T_GRASS, T_LOT, T_PLAZA, T_SAND, T_WALK } from './config.js';
import { angleDiff, dist2, distance, lineOfSight, resolveCircleVsCity } from './physics.js';
import { DIRS } from './traffic.js';

const STROLL = new Set([T_WALK, T_PLAZA, T_GRASS, T_SAND, T_LOT, T_DOCK]);
const SKIN = ['#f1c9a5', '#d9a37c', '#a9714b', '#7a4b2f', '#5a3522', '#e8b48f'];
const SHIRTS = ['#ff7a59', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#f4f1de', '#9b5de5', '#00bbf9', '#fee440'];
const HAIR = ['#2b1d14', '#5a3b22', '#d9b25a', '#111', '#8c4a2f', '#ccc'];

let nextPedId = 1;

export function createPed(world, kind, x, y) {
  const r = world.rng;
  const ped = {
    id: nextPedId++, kind, x, y,
    angle: r.range(0, Math.PI * 2), dir: r.int(0, 3),
    hp: kind === 'cop' ? 70 : kind === 'gang' ? 60 : 40,
    dead: false, deadTimer: 0,
    state: 'walk', timer: 0, speed: r.range(42, 62),
    skin: r.pick(SKIN), hair: r.pick(HAIR),
    shirt: kind === 'cop' ? '#1f3f7a' : kind === 'gang' ? '#1f9a8a' : r.pick(SHIRTS),
    weapon: kind === 'civ' ? null : kind === 'cop' ? 'pistol' : r.pick(['pistol', 'smg']),
    fireCd: r.range(0.5, 1.5), tag: null, walkPhase: r.range(0, 6), kvx: 0, kvy: 0,
    hostile: kind !== 'civ',
  };
  return ped;
}

/** Scare every civilian within `radius` of a point (a gunshot, a crash, an explosion). */
export function panic(world, x, y, radius) {
  for (const ped of world.peds) {
    if (ped.dead || ped.kind !== 'civ') continue;
    if (dist2(ped.x, ped.y, x, y) < radius * radius) {
      ped.state = 'flee';
      ped.timer = 5 + world.rng.next() * 3;
      ped.fleeFrom = { x, y };
    }
  }
}

function moveWalker(world, ped, vx, vy, dt) {
  ped.x += (vx + ped.kvx) * dt;
  ped.y += (vy + ped.kvy) * dt;
  ped.kvx *= 0.9; ped.kvy *= 0.9;
  const res = resolveCircleVsCity(world.city, ped.x, ped.y, PED_RADIUS);
  ped.x = res.x; ped.y = res.y;
  if (vx || vy) { ped.walkPhase += dt * Math.hypot(vx, vy) * 0.09; }
  return res.hit;
}

function strollCivilian(world, ped, dt) {
  const [dx, dy] = DIRS[ped.dir];
  const look = world.city.tileAtPoint(ped.x + dx * 18, ped.y + dy * 18);
  if (!STROLL.has(look) || world.rng.chance(0.002)) {
    const options = [0, 1, 2, 3].filter((d) => STROLL.has(world.city.tileAtPoint(ped.x + DIRS[d][0] * 18, ped.y + DIRS[d][1] * 18)));
    ped.dir = options.length ? world.rng.pick(options) : (ped.dir + 2) % 4;
  }
  const want = Math.atan2(DIRS[ped.dir][1], DIRS[ped.dir][0]);
  ped.angle += angleDiff(ped.angle, want) * Math.min(1, dt * 8);
  moveWalker(world, ped, Math.cos(ped.angle) * ped.speed, Math.sin(ped.angle) * ped.speed, dt);
}

function fleeCivilian(world, ped, dt) {
  const from = ped.fleeFrom ?? world.player;
  const want = Math.atan2(ped.y - from.y, ped.x - from.x) + Math.sin(ped.id + world.time * 2) * 0.4;
  ped.angle += angleDiff(ped.angle, want) * Math.min(1, dt * 6);
  const hit = moveWalker(world, ped, Math.cos(ped.angle) * 150, Math.sin(ped.angle) * 150, dt);
  if (hit) ped.angle += 1.3;
  ped.timer -= dt;
  if (ped.timer <= 0) ped.state = 'walk';
}

/**
 * Armed walkers close to their preferred range of the player and fire when they can see them.
 * Police at one star only chase to make an arrest. Returns a shot request or null.
 */
function updateArmed(world, ped, dt) {
  const p = world.player;
  const target = p.car ?? p;
  const d = distance(ped.x, ped.y, target.x, target.y);
  const sees = d < 520 && lineOfSight(world.city, ped.x, ped.y, target.x, target.y);
  const lethal = ped.kind !== 'cop' || world.wanted.stars >= 2;
  if (ped.guard && !ped.hostile) { ped.angle += Math.sin(world.time + ped.id) * dt; return null; }
  if (!ped.hostile || p.dead) { strollCivilian(world, ped, dt); return null; }
  ped.angle = Math.atan2(target.y - ped.y, target.x - ped.x);
  const range = lethal ? (ped.kind === 'cop' ? 200 : 240) : 18;
  if (d > range || !sees) {
    const speed = ped.kind === 'cop' ? 175 : 150;
    if (moveWalker(world, ped, Math.cos(ped.angle) * speed, Math.sin(ped.angle) * speed, dt)) {
      moveWalker(world, ped, Math.cos(ped.angle + 1.57) * speed, Math.sin(ped.angle + 1.57) * speed, dt);
    }
  } else {
    const strafe = Math.sin(world.time * 1.3 + ped.id) * 60;
    moveWalker(world, ped, -Math.sin(ped.angle) * strafe, Math.cos(ped.angle) * strafe, dt);
  }
  ped.fireCd -= dt;
  if (lethal && sees && d < 480 && ped.fireCd <= 0) {
    ped.fireCd = ped.weapon === 'smg' ? 0.16 : 0.9 + world.rng.next() * 0.6;
    if (ped.weapon === 'smg' && world.rng.chance(0.12)) ped.fireCd = 1.2;
    return { shooter: ped, x: ped.x, y: ped.y, angle: ped.angle, weapon: ped.weapon };
  }
  return null;
}

/** Step every walker; returns the shots the armed ones fired this step. */
export function updatePeds(world, dt) {
  const shots = [];
  for (const ped of world.peds) {
    if (ped.dead) { ped.deadTimer += dt; ped.x += ped.kvx * dt; ped.y += ped.kvy * dt; ped.kvx *= 0.88; ped.kvy *= 0.88; continue; }
    if (ped.kind === 'civ') {
      if (ped.state === 'flee') fleeCivilian(world, ped, dt);
      else strollCivilian(world, ped, dt);
    } else {
      const shot = updateArmed(world, ped, dt);
      if (shot) shots.push(shot);
    }
  }
  world.peds = world.peds.filter((ped) => !(ped.dead && ped.deadTimer > 40));
  return shots;
}

/** Keep sidewalks busy: drop far civilians and the long dead, add new walkers out of view. */
export function maintainPeds(world) {
  const p = world.focus;
  world.peds = world.peds.filter((ped) => ped.tag || ped.kind !== 'civ' || dist2(ped.x, ped.y, p.x, p.y) < 1700 * 1700);
  let civil = world.peds.filter((ped) => ped.kind === 'civ' && !ped.dead).length;
  let tries = 0;
  while (civil < PED_COUNT && tries < 40) {
    tries += 1;
    const x = p.x + world.rng.range(-1400, 1400);
    const y = p.y + world.rng.range(-1100, 1100);
    const d = dist2(x, y, p.x, p.y);
    if (d < 760 * 760 && !world.populateVisible) continue;
    const t = world.city.tileAtPoint(x, y);
    if (t !== T_WALK && t !== T_PLAZA && t !== T_SAND) continue;
    const ped = createPed(world, 'civ', Math.floor(x / TILE) * TILE + TILE / 2, Math.floor(y / TILE) * TILE + TILE / 2);
    world.peds.push(ped);
    civil += 1;
  }
}
