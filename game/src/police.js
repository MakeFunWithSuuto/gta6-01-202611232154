// The Solmar Bay Police Department: crimes raise heat and stars, cruisers are dispatched just out
// of sight and run the player down, officers bail out to chase and shoot, a helicopter joins at
// three stars, stars fade once the player breaks line of sight long enough, and a cop who gets
// hands on the player makes the arrest.
import { MAX_COPS_BY_STARS, WANTED_COOLDOWN } from './config.js';
import { dist2, distance, lineOfSight } from './physics.js';
import { createCar, steerToward } from './vehicles.js';
import { createPed } from './peds.js';
import { nodePoint, placeOnRoad } from './traffic.js';

const THRESHOLDS = [0, 1, 5, 11, 20, 32];
const SIGHT = 650;

export function starsFor(heat) {
  let stars = 0;
  for (let s = 1; s < THRESHOLDS.length; s += 1) if (heat >= THRESHOLDS[s]) stars = s;
  return stars;
}

function copWitness(world, x, y) {
  for (const car of world.cars) if (car.spec.police && !car.wrecked && dist2(car.x, car.y, x, y) < SIGHT * SIGHT) return true;
  for (const ped of world.peds) if (ped.kind === 'cop' && !ped.dead && dist2(ped.x, ped.y, x, y) < SIGHT * SIGHT) return true;
  return false;
}

/**
 * A crime of `severity` happened at (x, y). Minor crimes need a witness (an officer, or a
 * civilian who calls it in); violent ones are always reported.
 */
export function reportCrime(world, severity, x, y) {
  if (world.player.dead) return;
  if (severity < 2 && world.wanted.stars === 0 && !copWitness(world, x, y) && !world.rng.chance(0.4)) return;
  setHeat(world, world.wanted.heat + severity);
}

/** Force the wanted level to at least `stars` (missions use this for a robbery or a break-in). */
export function raiseWanted(world, stars) {
  if (world.wanted.stars < stars) setHeat(world, THRESHOLDS[stars]);
}

export function clearWanted(world) {
  world.wanted.heat = 0;
  world.wanted.stars = 0;
  world.wanted.lost = 0;
  for (const ped of world.peds) if (ped.kind === 'cop') ped.hostile = false;
  for (const car of world.cars) if (car.driver === 'cop') { car.driver = car.ai ? 'ai' : null; car.siren = false; }
}

function setHeat(world, heat) {
  const w = world.wanted;
  const before = w.stars;
  w.heat = Math.min(heat, THRESHOLDS[5] + 6);
  w.stars = starsFor(w.heat);
  w.lost = 0;
  if (w.stars > before) {
    w.flash = 2;
    world.events.push({ type: 'wanted', stars: w.stars });
    for (const ped of world.peds) if (ped.kind === 'cop') ped.hostile = true;
  }
}

function spawnCruiser(world) {
  const focus = world.focus;
  for (let tries = 0; tries < 25; tries += 1) {
    const i = world.rng.int(0, 8);
    const j = world.rng.int(0, 7);
    const node = nodePoint(i, j);
    const d = distance(node.x, node.y, focus.x, focus.y);
    if (d < 760 || d > 1500) continue;
    const dir = world.rng.int(0, 3);
    const car = createCar('bastion', 0, 0, 0);
    placeOnRoad(car, i, j, dir, 40);
    if (car.ai.i < 0 || car.ai.j < 0 || car.ai.i > 8 || car.ai.j > 7) continue;
    car.driver = 'cop';
    car.siren = true;
    world.cars.push(car);
    return;
  }
}

function deployOfficers(world, car) {
  car.deployed = true;
  car.driver = null;
  car.throttle = 0;
  for (const side of [-1, 1]) {
    const ox = -Math.sin(car.angle) * 26 * side;
    const oy = Math.cos(car.angle) * 26 * side;
    const cop = createPed(world, 'cop', car.x + ox, car.y + oy);
    cop.hostile = true;
    world.peds.push(cop);
  }
}

function driveCruiser(world, car, dt) {
  const p = world.player;
  const target = p.car ?? p;
  const d = distance(car.x, car.y, target.x, target.y);
  if (!p.car && d < 230 && !car.deployed) {
    car.throttle = -1;
    if (Math.abs(car.speed) < 40) deployOfficers(world, car);
    return;
  }
  car.stuck = (car.stuck ?? 0);
  if (car.reverse > 0) {
    car.reverse -= dt;
    car.throttle = -1;
    car.steer = -car.steer;
    return;
  }
  const lead = p.car ? 0.5 : 0;
  steerToward(car, target.x + (target.vx ?? 0) * lead, target.y + (target.vy ?? 0) * lead, d < 140 ? 160 : car.spec.top * 0.92);
  if (Math.abs(car.speed) < 25) car.stuck += dt; else car.stuck = 0;
  if (car.stuck > 1.1) { car.reverse = 0.9; car.stuck = 0; }
}

function updateHelicopter(world, dt) {
  const w = world.wanted;
  const p = world.focus;
  if (w.stars >= 3 && !world.heli) {
    world.heli = { x: p.x - 900, y: p.y - 700, angle: 0, rotor: 0, fireCd: 3, light: 0 };
    world.events.push({ type: 'heli' });
  }
  const heli = world.heli;
  if (!heli) return;
  heli.rotor += dt * 30;
  if (w.stars < 3) {
    heli.x -= 300 * dt; heli.y -= 300 * dt;
    if (dist2(heli.x, heli.y, p.x, p.y) > 2500 * 2500) world.heli = null;
    return;
  }
  const orbit = world.time * 0.6;
  const tx = p.x + Math.cos(orbit) * 140;
  const ty = p.y + Math.sin(orbit) * 110;
  const dx = tx - heli.x;
  const dy = ty - heli.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = Math.min(380, d * 1.5);
  heli.x += (dx / d) * speed * dt;
  heli.y += (dy / d) * speed * dt;
  heli.angle = Math.atan2(dy, dx);
  heli.fireCd -= dt;
  if (w.stars >= 4 && heli.fireCd <= 0 && d < 300) {
    heli.fireCd = 1.6;
    world.pendingShots.push({ shooter: { kind: 'cop' }, x: heli.x, y: heli.y, angle: Math.atan2(p.y - heli.y, p.x - heli.x), weapon: 'smg' });
  }
}

/** One step of the police: dispatch, chase, sight checks, stars fading and arrests. */
export function updatePolice(world, dt) {
  const w = world.wanted;
  const p = world.player;
  const focus = world.focus;
  if (w.flash > 0) w.flash -= dt;
  let active = 0;
  for (const car of world.cars) {
    if (car.wrecked) continue;
    if (car.driver === 'cop') {
      active += 1;
      if (w.stars === 0) { car.driver = 'ai'; car.siren = false; continue; }
      driveCruiser(world, car, dt);
    } else if (w.stars > 0 && car.spec.police && car.driver === 'ai' && dist2(car.x, car.y, focus.x, focus.y) < 1300 * 1300) {
      car.driver = 'cop';
      car.siren = true;
    }
  }
  for (const ped of world.peds) if (ped.kind === 'cop' && !ped.dead && ped.hostile) active += 1;
  updateHelicopter(world, dt);
  if (w.stars === 0) { w.busted = 0; return; }

  world.dispatchTimer = (world.dispatchTimer ?? 0) - dt;
  if (active < MAX_COPS_BY_STARS[w.stars] && world.dispatchTimer <= 0) {
    spawnCruiser(world);
    world.dispatchTimer = 2.2 - w.stars * 0.25;
  }

  let seen = world.heli && dist2(world.heli.x, world.heli.y, focus.x, focus.y) < 420 * 420;
  for (const car of world.cars) {
    if (seen) break;
    if (car.driver === 'cop' && dist2(car.x, car.y, focus.x, focus.y) < SIGHT * SIGHT && lineOfSight(world.city, car.x, car.y, focus.x, focus.y)) seen = true;
  }
  for (const ped of world.peds) {
    if (seen) break;
    if (ped.kind === 'cop' && !ped.dead && dist2(ped.x, ped.y, focus.x, focus.y) < SIGHT * SIGHT && lineOfSight(world.city, ped.x, ped.y, focus.x, focus.y)) seen = true;
  }
  w.seen = Boolean(seen);
  if (seen) w.lost = 0;
  else {
    w.lost += dt;
    if (w.lost > WANTED_COOLDOWN[w.stars]) {
      w.heat = THRESHOLDS[w.stars - 1];
      w.stars -= 1;
      w.lost = 0;
      world.events.push({ type: 'starLost', stars: w.stars });
      if (w.stars === 0) clearWanted(world);
    }
  }

  let grabbed = false;
  for (const ped of world.peds) {
    if (ped.kind !== 'cop' || ped.dead) continue;
    const reach = p.car ? (Math.abs(p.car.speed) < 30 ? 44 : 0) : 26;
    if (dist2(ped.x, ped.y, focus.x, focus.y) < reach * reach) grabbed = true;
  }
  w.busted = grabbed ? (w.busted ?? 0) + dt : Math.max(0, (w.busted ?? 0) - dt);
  if (w.busted > (w.stars >= 3 ? 2.2 : 1.4)) world.events.push({ type: 'busted' });
}

