// The world and its step: makes a fresh Solmar Bay (city, player, traffic, walkers, pickups,
// story) and advances everything one fixed step in order: player, traffic and police driving,
// car physics, crashes, run-overs, fires and explosions, walkers and gunfire, wanted level,
// missions and services, effects, and the WASTED / BUSTED respawns.
import { STEP } from './config.js';
import { createCity, districtAt } from './city.js';
import { createRandom } from './random.js';
import { createPlayer, updatePlayer } from './player.js';
import { collideCars, damageCar, driveCar } from './vehicles.js';
import { driveTraffic, maintainTraffic } from './traffic.js';
import { maintainPeds, updatePeds } from './peds.js';
import { damagePed, damagePlayer, explode, fireWeapon } from './combat.js';
import { clearWanted, reportCrime, updatePolice } from './police.js';
import { createStory, failMission, updateMissions } from './missions.js';
import { createPickups, updateServices } from './services.js';
import { addFire, addSkid, addSmoke, addSparks, updateEffects } from './effects.js';
import { dist2 } from './physics.js';

export function createWorld(seed) {
  const city = createCity();
  const home = city.places.safehouse;
  const world = {
    rng: createRandom(seed),
    city, time: 0, clock: 16.5,
    player: createPlayer(home.x, home.y - 10),
    cars: [], peds: [], pickups: createPickups(city),
    particles: [], tracers: [], skids: [], decals: [], floaters: [],
    events: [], pendingShots: [], subtitles: [],
    wanted: { stars: 0, heat: 0, lost: 0, flash: 0, busted: 0, seen: false },
    heli: null, story: createStory(),
    unlocked: { pistol: true }, tokens: new Set(),
    stats: { kills: 0, carsStolen: 0, missions: 0, deaths: 0, arrests: 0 },
    banner: null, prompt: null, shake: 0, respawn: 0, outcome: null,
    populateVisible: true, requestSave: false, district: '',
  };
  world.focus = world.player;
  world.subtitle = (who, text) => world.subtitles.push({ who, text, t: 0 });
  maintainTraffic(world);
  maintainPeds(world);
  world.populateVisible = false;
  return world;
}

function runOvers(world, car) {
  const fast = Math.hypot(car.vx, car.vy);
  if (fast < 70) return;
  const reach = car.spec.len * 0.5 + 6;
  const byPlayer = car.driver === 'player';
  for (const ped of world.peds) {
    if (ped.dead || dist2(ped.x, ped.y, car.x, car.y) > reach * reach) continue;
    const nx = car.vx / fast;
    const ny = car.vy / fast;
    damagePed(world, ped, fast * 0.32, byPlayer, nx, ny);
    if (byPlayer && !ped.dead && ped.kind === 'civ') reportCrime(world, 1, ped.x, ped.y);
    world.events.push({ type: 'thud', x: ped.x, y: ped.y });
  }
  const p = world.player;
  if (!p.car && !p.dead && dist2(p.x, p.y, car.x, car.y) < reach * reach) {
    damagePlayer(world, fast * 0.12);
    p.vx += (car.vx / fast) * 300;
    p.vy += (car.vy / fast) * 300;
  }
}

function burnAndExplode(world, car, dt) {
  if (car.wrecked) {
    if (world.rng.chance(0.15)) addSmoke(world, car.x, car.y, true);
    return;
  }
  if (car.health < 35 && world.rng.chance(car.health < 15 ? 0.5 : 0.18)) addSmoke(world, car.x + Math.cos(car.angle) * car.spec.len * 0.35, car.y + Math.sin(car.angle) * car.spec.len * 0.35, car.health < 15);
  if (car.burning > 0) {
    car.burning -= dt;
    addFire(world, car.x, car.y);
    if (car.burning <= 0) {
      car.wrecked = true;
      if (car.driver === 'ai' || car.driver === 'cop') car.driver = null;
      explode(world, car.x, car.y, car.lastHitByPlayer ?? false);
    }
  }
}

function respawnPlayer(world, where, outcome) {
  const p = world.player;
  const spot = world.city.places[where];
  p.dead = false;
  p.health = 100;
  p.car = null;
  p.x = spot.x; p.y = spot.y;
  p.vx = 0; p.vy = 0;
  if (outcome === 'busted') { p.ammo.smg = 0; p.ammo.shotgun = 0; p.ammo.pistol = Math.min(p.ammo.pistol, 24); p.weapon = 'pistol'; }
  p.money = Math.max(0, p.money - (outcome === 'busted' ? 150 : 200));
  clearWanted(world);
  world.heli = null;
  world.peds = world.peds.filter((ped) => ped.kind === 'civ');
  world.cars = world.cars.filter((car) => car.driver !== 'cop' && !car.wrecked);
  world.outcome = null;
  world.banner = { title: where === 'hospital' ? 'St. Ines Medical' : 'SBPD Precinct', sub: outcome === 'busted' ? 'Released. Fine paid: $150' : 'Hospital bill: $200', t: 3 };
}

function endPlayerRun(world, outcome) {
  const p = world.player;
  if (p.dead) return;
  p.dead = true;
  world.outcome = outcome;
  world.respawn = 3.2;
  if (outcome === 'wasted') world.stats.deaths += 1; else world.stats.arrests += 1;
  if (p.car) { p.car.driver = null; p.car.throttle = 0; p.x = p.car.x; p.y = p.car.y; }
  failMission(world, outcome === 'wasted' ? 'You died' : 'You were arrested');
  world.story.courier = null;
  world.events.push({ type: outcome });
}

/** Advance the world one fixed step. `input` is null in staged scenes, where the player is scripted. */
export function stepWorld(world, input, aimAt, dt = STEP) {
  world.time += dt;
  world.clock = (world.clock + dt / 45) % 24;
  const p = world.player;
  if (input) updatePlayer(world, input, aimAt, dt);
  world.focus = p.car ?? p;
  world.district = districtAt(world.focus.x, world.focus.y);

  for (const car of world.cars) {
    if (car.wrecked) { car.throttle = 0; car.steer = 0; }
    else if (car.driver === 'ai' && car.ai) driveTraffic(car, world, car.fleeing ? 290 : 165);
    else if (car.driver === null || car.driver === undefined) { car.throttle = 0; car.handbrake = true; }
  }
  updatePolice(world, dt);
  for (const car of world.cars) {
    const before = car.health;
    const impact = driveCar(car, world.city, dt);
    if (impact > 160) { addSparks(world, car.x, car.y, 6); world.events.push({ type: 'crash', x: car.x, y: car.y, power: impact }); }
    if (car.driver === 'player' && car.health < before) car.lastHitByPlayer = true;
    if (car.skid > 0.4 && Math.abs(car.speed) > 60) {
      const bx = -Math.cos(car.angle) * car.spec.len * 0.35;
      const by = -Math.sin(car.angle) * car.spec.len * 0.35;
      const sx = -Math.sin(car.angle) * car.spec.wid * 0.4;
      const sy = Math.cos(car.angle) * car.spec.wid * 0.4;
      for (const s of [-1, 1]) addSkid(world, car.x + bx + sx * s, car.y + by + sy * s, car.x + bx + sx * s - car.vx * dt, car.y + by + sy * s - car.vy * dt);
    }
    runOvers(world, car);
    burnAndExplode(world, car, dt);
  }
  for (const hit of collideCars(world.cars)) {
    addSparks(world, hit.x, hit.y, 8);
    world.events.push({ type: 'crash', x: hit.x, y: hit.y, power: hit.speed });
    world.shake = Math.max(world.shake, Math.min(12, hit.speed / 40));
    if (hit.a.driver === 'player' || hit.b.driver === 'player') {
      const other = hit.a.driver === 'player' ? hit.b : hit.a;
      other.lastHitByPlayer = true;
      if (other.spec.police && world.wanted.stars === 0) reportCrime(world, 1, other.x, other.y);
    }
  }
  if (p.car && !p.dead) {
    p.x = p.car.x; p.y = p.car.y;
    if (p.car.wrecked) { damagePlayer(world, 100); }
    else if (p.car.burning > 0 && p.car.burning < 2.4) { damageCar(p.car, 0); }
  }

  const shots = updatePeds(world, dt).concat(world.pendingShots);
  world.pendingShots = [];
  for (const shot of shots) fireWeapon(world, shot.x, shot.y, shot.angle, shot.weapon, shot.shooter, false);
  for (const ped of world.peds) {
    if (ped.guard && !ped.hostile && !ped.dead && dist2(ped.x, ped.y, world.focus.x, world.focus.y) < 230 * 230) {
      for (const other of world.peds) if (other.tag === ped.tag) other.hostile = true;
    }
  }

  updateMissions(world, dt);
  updateServices(world, input, dt);
  updateEffects(world, dt);
  if (world.time % 1 < dt) { maintainTraffic(world); maintainPeds(world); }
  if (world.banner) { world.banner.t -= dt; if (world.banner.t <= 0) world.banner = null; }
  if (world.subtitles.length) {
    const s = world.subtitles[0];
    s.t += dt;
    if (s.t > 2 + s.text.length * 0.045) world.subtitles.shift();
  }
  world.shake *= 0.9;

  if (!p.dead && p.health <= 0) endPlayerRun(world, 'wasted');
  if (!p.dead && world.events.some((e) => e.type === 'busted')) endPlayerRun(world, 'busted');
  if (p.dead) {
    world.respawn -= dt;
    if (world.respawn <= 0) respawnPlayer(world, world.outcome === 'busted' ? 'police' : 'hospital', world.outcome);
  }
}
