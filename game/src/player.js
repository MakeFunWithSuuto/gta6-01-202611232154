// The player, Rae Calder: walking and sprinting with mouse aim, switching and firing weapons,
// jacking cars (throwing the driver out), driving with handbrake and horn, and climbing out.
import { PLAYER_RADIUS, PLAYER_SPRINT, PLAYER_WALK } from './config.js';
import { dist2, resolveCircleVsCity } from './physics.js';
import { fireWeapon, punch, WEAPON_ORDER, WEAPONS } from './combat.js';
import { createPed } from './peds.js';
import { reportCrime } from './police.js';
import { addFloatText } from './effects.js';

export function createPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0, angle: -Math.PI / 2, aim: 0,
    health: 100, armor: 0, money: 250,
    car: null, weapon: 'pistol', ammo: { fists: Infinity, pistol: 48, smg: 0, shotgun: 0 },
    fireCd: 0, dead: false, hurtFlash: 0, walkPhase: 0,
  };
}

/** Next weapon in `step` direction that the player has ammo for. */
export function cycleWeapon(player, step) {
  let index = WEAPON_ORDER.indexOf(player.weapon);
  for (let k = 0; k < WEAPON_ORDER.length; k += 1) {
    index = (index + step + WEAPON_ORDER.length) % WEAPON_ORDER.length;
    if (player.ammo[WEAPON_ORDER[index]] > 0) { player.weapon = WEAPON_ORDER[index]; return; }
  }
}

function nearestEnterableCar(world, p) {
  let best = null;
  let bestD = 70 * 70;
  for (const car of world.cars) {
    if (car.wrecked) continue;
    const d = dist2(car.x, car.y, p.x, p.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

/** Get into the nearest car, pulling its driver out if it has one. */
function enterCar(world, p) {
  const car = nearestEnterableCar(world, p);
  if (!car) return;
  if (car.driver === 'ai' || car.driver === 'cop') {
    const kind = car.driver === 'cop' ? 'cop' : 'civ';
    const ped = createPed(world, kind, car.x - Math.sin(car.angle) * 30, car.y + Math.cos(car.angle) * 30);
    if (kind === 'civ') { ped.state = 'flee'; ped.timer = 6; ped.fleeFrom = p; } else ped.hostile = true;
    world.peds.push(ped);
    reportCrime(world, car.spec.police ? 3 : 1, car.x, car.y);
    world.events.push({ type: 'jack', x: car.x, y: car.y });
    world.stats.carsStolen += 1;
  } else if (car.spec.police) reportCrime(world, 2, car.x, car.y);
  car.driver = 'player';
  car.ai = null;
  car.siren = false;
  p.car = car;
  world.events.push({ type: 'door', x: car.x, y: car.y, enter: true, model: car.spec.name });
}

function exitCar(world, p) {
  const car = p.car;
  if (Math.abs(car.speed) > 120) return;
  for (const side of [-1, 1]) {
    const x = car.x + Math.sin(car.angle) * 32 * side;
    const y = car.y - Math.cos(car.angle) * 32 * side;
    if (world.city.solidAt(x, y)) continue;
    p.x = x; p.y = y;
    break;
  }
  car.driver = null;
  car.throttle = 0; car.steer = 0; car.handbrake = true;
  p.car = null;
  world.events.push({ type: 'door', x: car.x, y: car.y, enter: false });
}

function tryFire(world, p, input, dt, fromX, fromY) {
  p.fireCd -= dt;
  const weapon = WEAPONS[p.weapon];
  const wantsFire = input.mouse.down || input.isDown('ControlLeft');
  if (!wantsFire || p.fireCd > 0) return;
  if (weapon.melee) {
    if (p.car) return;
    p.fireCd = weapon.rate;
    p.punchAnim = 0.2;
    punch(world, p.x, p.y, p.aim);
    return;
  }
  if (p.ammo[p.weapon] <= 0) {
    cycleWeapon(p, 1);
    addFloatText(world, fromX, fromY - 30, 'Out of ammo', '#ffb0b0');
    return;
  }
  p.fireCd = weapon.rate * (p.car ? 1.4 : 1);
  p.ammo[p.weapon] -= 1;
  p.muzzle = 0.06;
  fireWeapon(world, fromX + Math.cos(p.aim) * 14, fromY + Math.sin(p.aim) * 14, p.aim, p.weapon, null, true);
  world.shake = Math.max(world.shake, p.weapon === 'shotgun' ? 6 : 2);
}

/** One step of the player under keyboard and mouse control. `aimAt` is the mouse in world space. */
export function updatePlayer(world, input, aimAt, dt) {
  const p = world.player;
  if (p.hurtFlash > 0) p.hurtFlash -= dt;
  if (p.muzzle > 0) p.muzzle -= dt;
  if (p.punchAnim > 0) p.punchAnim -= dt;
  if (p.dead) return;
  if (input.wasPressed('KeyQ') || input.mouse.wheel < 0) cycleWeapon(p, -1);
  if (input.wasPressed('KeyE') && !world.prompt || input.mouse.wheel > 0) cycleWeapon(p, 1);

  if (input.wasPressed('KeyF') || input.wasPressed('Enter')) {
    if (p.car) exitCar(world, p);
    else enterCar(world, p);
  }

  if (p.car) {
    const car = p.car;
    car.throttle = input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
    car.steer = input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    car.handbrake = input.isDown('Space');
    if (input.wasPressed('KeyH')) world.events.push({ type: 'horn', x: car.x, y: car.y });
    p.x = car.x; p.y = car.y;
    p.aim = Math.atan2(aimAt.y - car.y, aimAt.x - car.x);
    if (p.weapon === 'pistol' || p.weapon === 'smg') tryFire(world, p, input, dt, car.x, car.y);
    else p.fireCd -= dt;
    return;
  }

  const mx = input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
  const my = input.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
  const len = Math.hypot(mx, my) || 1;
  const speed = input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? PLAYER_SPRINT : PLAYER_WALK;
  const tvx = (mx / len) * speed;
  const tvy = (my / len) * speed;
  p.vx += (tvx - p.vx) * Math.min(1, dt * 12);
  p.vy += (tvy - p.vy) * Math.min(1, dt * 12);
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const res = resolveCircleVsCity(world.city, p.x, p.y, PLAYER_RADIUS);
  p.x = res.x; p.y = res.y;
  p.walkPhase += Math.hypot(p.vx, p.vy) * dt * 0.09;
  p.aim = Math.atan2(aimAt.y - p.y, aimAt.x - p.x);
  p.angle = p.aim;
  tryFire(world, p, input, dt, p.x, p.y);
}
