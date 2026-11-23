// Staged scenes behind ?shot=<name>: each builds a real world with the game's own systems, sets
// up a moment of play (a police chase on a story mission, a dockside shootout, a sunset cruise
// on a courier job, the title screen), runs the simulation forward with a simple autopilot, and
// hands back the world and camera to paint.
import { STEP } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { createCamera3d, placeCamera3d, snapCamera3d, updateCamera3d } from './camera3d.js';
import { lanePoint, placeOnRoad } from './traffic.js';
import { createCar, steerToward } from './vehicles.js';
import { createPed, maintainPeds } from './peds.js';
import { maintainTraffic } from './traffic.js';
import { startMission } from './missions.js';
import { raiseWanted } from './police.js';
import { drawTitle } from './menus.js';
import { fireWeapon } from './combat.js';

function playerCar(world, model, i, j, dir, along, color) {
  const car = createCar(model, 0, 0, 0, color);
  placeOnRoad(car, i, j, dir, along);
  car.ai = null;
  car.driver = 'player';
  car.vx = Math.cos(car.angle) * 250;
  car.vy = Math.sin(car.angle) * 250;
  world.cars.push(car);
  world.player.car = car;
  world.player.x = car.x; world.player.y = car.y;
  world.focus = car;
  return car;
}

function cruiser(world, x, y, angle) {
  const car = createCar('bastion', x, y, angle);
  car.driver = 'cop'; car.siren = true;
  car.vx = Math.cos(angle) * 260; car.vy = Math.sin(angle) * 260;
  world.cars.push(car);
  return car;
}

function run(world, cam, seconds, each) {
  world.focus = world.player.car ?? world.player;
  world.populateVisible = true;
  for (let k = 0; k < 4; k += 1) { maintainTraffic(world); maintainPeds(world); }
  world.populateVisible = false;
  for (let t = 0; t < seconds; t += STEP) {
    each?.(t);
    stepWorld(world, null, { x: 0, y: 0 }, STEP);
    world.viewYaw = cam.yaw;
    updateCamera3d(cam, world, STEP);
    world.events = [];
  }
  world.shake = 0;
  cam.shake = 0;
}

function chase(seed) {
  const world = createWorld(seed);
  world.clock = 17.4;
  world.story.next = 5;
  world.player.money = 18450;
  world.player.ammo.smg = 140;
  world.player.weapon = 'smg';
  world.tokens = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const car = playerCar(world, 'mako', 2, 3, 0, 120, '#e0303a');
  startMission(world, 5);
  world.subtitles = [];
  const limo = world.cars.find((c) => c.tag === 'brandt');
  placeOnRoad(limo, 2, 3, 0, 380);
  limo.vx = 280;
  raiseWanted(world, 3);
  cruiser(world, car.x - 120, car.y + 6, 0);
  cruiser(world, car.x - 210, car.y - 34, 0);
  const cam = createCamera3d();
  snapCamera3d(cam, world);
  world.heli = { x: car.x - 200, y: car.y - 160, angle: 0, rotor: 0, fireCd: 3, light: 0 };
  run(world, cam, 2.1, () => {
    const goal = lanePoint(car.x > lanePoint(3, 3, 0).x - 60 ? 4 : 3, 3, 0);
    steerToward(car, goal.x + 200, goal.y, 360);
    world.player.aim = Math.atan2(limo.y - car.y, limo.x - car.x);
  });
  world.banner = null;
  placeCamera3d(cam, car.x + 20, car.y, car.angle - 0.5, 330, 190, 40, 1.0);
  world.subtitle('brandt', 'Lose her! I pay you people to lose her!');
  return { world, cam, hud: true };
}

function shootout(seed) {
  const world = createWorld(seed);
  world.clock = 15.2;
  world.story.next = 2;
  world.player.money = 2640;
  world.player.ammo.smg = 96;
  world.unlocked.smg = true;
  world.player.weapon = 'smg';
  world.player.armor = 60;
  world.player.health = 72;
  startMission(world, 2);
  world.subtitles = [];
  const pier = world.city.places.pier;
  const p = world.player;
  p.x = pier.x + 230; p.y = pier.y - 150;
  world.focus = p;
  world.story.active.step = 1;
  for (const ped of world.peds) if (ped.tag) ped.hostile = true;
  for (const ped of world.peds) if (ped.tag === 'crew') { ped.x = pier.x + world.rng.range(-120, 120); ped.y = pier.y + world.rng.range(-40, 80); }
  world.peds.filter((ped) => ped.tag === 'crew').slice(0, 2).forEach((ped) => { ped.dead = true; ped.deadTimer = 5; ped.angle = 2; });
  const parked = createCar('ramble', pier.x + 120, pier.y - 60, 0.3, '#c46a3d');
  world.cars.push(parked);
  raiseWanted(world, 2);
  const cam = createCamera3d();
  snapCamera3d(cam, world);
  run(world, cam, 1.4, (t) => {
    const target = world.peds.find((ped) => ped.tag === 'pike' && !ped.dead) ?? world.peds.find((ped) => ped.tag === 'crew' && !ped.dead);
    if (!target) return;
    p.aim = Math.atan2(target.y - p.y, target.x - p.x);
    p.angle = p.aim;
    p.x -= 40 * STEP;
    if (Math.floor(t / 0.12) !== Math.floor((t + STEP) / 0.12)) {
      p.muzzle = 0.06;
      fireWeapon(world, p.x + Math.cos(p.aim) * 14, p.y + Math.sin(p.aim) * 14, p.aim, 'smg', null, true);
    }
    for (const ped of world.peds) if (ped.tag === 'pike') ped.hp = Math.max(ped.hp, 60);
  });
  world.banner = null;
  world.subtitle('dex', 'Pike is the one in the yellow shirt. Do not let him reach the boat.');
  const pike = world.peds.find((ped) => ped.tag === 'pike');
  for (const ped of world.peds) if (ped.kind === 'cop') ped.dead = true;
  pike.x = p.x - 60; pike.y = p.y + 170;
  placeCamera3d(cam, p.x - 20, p.y, Math.PI / 2 - 0.35, 230, 230, 100);
  return { world, cam, hud: true };
}

function cruise(seed) {
  const world = createWorld(seed);
  world.clock = 18.6;
  world.story.next = 3;
  world.player.money = 6120;
  world.tokens = new Set([0, 1, 2, 3, 4, 5]);
  const car = playerCar(world, 'mako', 4, 7, 0, 160, '#ff6a1f');
  const places = world.city.places;
  world.story.courier = { from: places.pier, to: places.club, stage: 1, timer: 47.3 };
  for (let k = 0; k < 6; k += 1) {
    const ped = createPed(world, 'civ', car.x + 200 + k * 90, car.y + 150 + (k % 2) * 40);
    world.peds.push(ped);
  }
  const cam = createCamera3d();
  snapCamera3d(cam, world);
  run(world, cam, 2.2, (t) => {
    const goal = lanePoint(6, 7, 0);
    steerToward(car, goal.x, goal.y, 330);
    car.steer += Math.sin(t * 3) * 0.15;
  });
  world.banner = null;
  world.subtitle('rae', 'Sun going down over the Strand. Forty seconds to Club Marea. Easy.');
  return { world, cam, hud: true };
}

function title(seed) {
  const world = createWorld(seed);
  world.clock = 18.2;
  const cam = createCamera3d();
  const tower = world.city.places.tower;
  world.player.x = tower.x - 300; world.player.y = tower.y + 400;
  run(world, cam, 1.5, () => {
    world.player.x = tower.x - 300; world.player.y = tower.y + 400;
  });
  placeCamera3d(cam, tower.x + 200, tower.y + 900, -1.2, 900, 620, 300, 1.0);
  const overlay = (ctx, w, h) => drawTitle(ctx, w, h, ['Continue', 'New Game', 'Controls'], 0, 1.2, 'Saved: 3/6 missions · $6,120');
  return { world, cam, hud: false, overlay };
}

const SCENES = { chase, shootout, cruise, title };

export function stageShot(name, seed) {
  return (SCENES[name] ?? title)(seed);
}
