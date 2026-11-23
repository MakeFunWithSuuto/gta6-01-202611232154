// Weapons and harm: the arsenal, hitscan gunfire with tracers, fists, damage to walkers, cars and
// the player, explosions of burning wrecks, and the crimes each hit reports to the police.
import { dist2 } from './physics.js';
import { damageCar } from './vehicles.js';
import { panic } from './peds.js';
import { addBlood, addExplosion, addSparks, addTracer } from './effects.js';
import { reportCrime } from './police.js';

export const WEAPONS = {
  fists: { name: 'Fists', damage: 16, rate: 0.38, range: 36, melee: true },
  pistol: { name: 'Pistol', damage: 34, rate: 0.28, spread: 0.035, range: 640, pellets: 1, clip: 12 },
  smg: { name: 'Vespa SMG', damage: 17, rate: 0.085, spread: 0.085, range: 560, pellets: 1, clip: 30 },
  shotgun: { name: 'Breaker 12', damage: 15, rate: 0.85, spread: 0.2, range: 360, pellets: 6, clip: 6 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];

/** Fire one weapon from (x, y) along `angle`. `fromPlayer` decides who can be hit and what counts as a crime. */
export function fireWeapon(world, x, y, angle, weaponKey, shooter, fromPlayer) {
  const weapon = WEAPONS[weaponKey];
  world.events.push({ type: weaponKey === 'shotgun' ? 'shotgun' : 'shot', x, y, fromPlayer });
  if (fromPlayer) panic(world, x, y, 420);
  for (let k = 0; k < weapon.pellets; k += 1) {
    const a = angle + (world.rng.next() - 0.5) * weapon.spread * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let ex = x + dx * weapon.range;
    let ey = y + dy * weapon.range;
    let hit = null;
    for (let t = 14; t < weapon.range; t += 8) {
      const px = x + dx * t;
      const py = y + dy * t;
      if (world.city.tileAtPoint(px, py) === 2) { ex = px; ey = py; addSparks(world, px, py, 4); break; }
      hit = findTarget(world, px, py, shooter, fromPlayer);
      if (hit) { ex = px; ey = py; break; }
    }
    addTracer(world, x + dx * 14, y + dy * 14, ex, ey, fromPlayer);
    if (!hit) continue;
    if (hit.kind === 'ped') damagePed(world, hit.target, weapon.damage, fromPlayer, dx, dy);
    else if (hit.kind === 'car') {
      damageCar(hit.target, weapon.damage * 0.35);
      addSparks(world, ex, ey, 5);
      if (fromPlayer && hit.target.driver === 'cop') reportCrime(world, 2, ex, ey);
    } else if (hit.kind === 'player') damagePlayer(world, weapon.damage * (world.player.car ? 0.25 : 0.45));
  }
}

function findTarget(world, px, py, shooter, fromPlayer) {
  for (const ped of world.peds) {
    if (ped.dead || ped === shooter) continue;
    if (!fromPlayer && ped.kind === shooter?.kind) continue;
    if (dist2(px, py, ped.x, ped.y) < 13 * 13) return { kind: 'ped', target: ped };
  }
  for (const car of world.cars) {
    if (car === world.player.car && !fromPlayer && dist2(px, py, car.x, car.y) < 26 * 26) return { kind: 'player' };
    if (car === world.player.car || car.wrecked) continue;
    if (dist2(px, py, car.x, car.y) < (car.spec.len * 0.45) ** 2) return { kind: 'car', target: car };
  }
  const p = world.player;
  if (!fromPlayer && !p.car && !p.dead && dist2(px, py, p.x, p.y) < 13 * 13) return { kind: 'player' };
  return null;
}

/** Punch whoever stands within reach in front of the attacker. */
export function punch(world, x, y, angle) {
  const reach = WEAPONS.fists.range;
  const hx = x + Math.cos(angle) * reach * 0.7;
  const hy = y + Math.sin(angle) * reach * 0.7;
  world.events.push({ type: 'punch', x, y });
  for (const ped of world.peds) {
    if (ped.dead || dist2(hx, hy, ped.x, ped.y) > 24 * 24) continue;
    damagePed(world, ped, WEAPONS.fists.damage, true, Math.cos(angle), Math.sin(angle));
    return true;
  }
  return false;
}

export function damagePed(world, ped, amount, fromPlayer, dx, dy) {
  if (ped.dead) return;
  ped.hp -= amount;
  ped.kvx += dx * 140; ped.kvy += dy * 140;
  addBlood(world, ped.x, ped.y, 4);
  if (ped.kind === 'civ') { ped.state = 'flee'; ped.timer = 6; ped.fleeFrom = world.player; }
  if (fromPlayer && (ped.kind === 'cop' || ped.tag === 'witness')) ped.hostile = true;
  if (ped.hp > 0) {
    if (fromPlayer && ped.kind === 'cop') reportCrime(world, 2, ped.x, ped.y);
    return;
  }
  ped.dead = true;
  ped.kvx = dx * 260; ped.kvy = dy * 260;
  addBlood(world, ped.x, ped.y, 10);
  world.events.push({ type: 'death', x: ped.x, y: ped.y, ped });
  if (!fromPlayer) return;
  world.stats.kills += 1;
  if (ped.kind === 'cop') reportCrime(world, 3, ped.x, ped.y);
  else if (ped.kind === 'civ') reportCrime(world, 1, ped.x, ped.y);
  if (ped.kind !== 'civ' || world.rng.chance(0.35)) {
    world.pickups.push({ type: 'cash', x: ped.x, y: ped.y, amount: ped.kind === 'gang' ? 60 + world.rng.int(0, 90) : 20 + world.rng.int(0, 40), bob: 0 });
  }
}

export function damagePlayer(world, amount) {
  const p = world.player;
  if (p.dead || world.cheatGod) return;
  const soak = Math.min(p.armor, amount * 0.7);
  p.armor -= soak;
  p.health -= amount - soak;
  p.hurtFlash = 0.35;
  world.events.push({ type: 'hurt' });
}

/** A burning wreck goes up: hurts and throws everything close and leaves a blackened car. */
export function explode(world, x, y, byPlayer) {
  addExplosion(world, x, y);
  world.events.push({ type: 'boom', x, y });
  world.shake = Math.max(world.shake, 18);
  panic(world, x, y, 600);
  for (const car of world.cars) {
    const d2 = dist2(x, y, car.x, car.y);
    if (d2 < 150 * 150 && d2 > 1) {
      const d = Math.sqrt(d2);
      damageCar(car, (150 - d) * 0.6);
      car.vx += ((car.x - x) / d) * (150 - d) * 3;
      car.vy += ((car.y - y) / d) * (150 - d) * 3;
    }
  }
  for (const ped of world.peds) {
    const d2 = dist2(x, y, ped.x, ped.y);
    if (d2 < 140 * 140) {
      const d = Math.sqrt(d2) || 1;
      damagePed(world, ped, 120 - d * 0.5, byPlayer, (ped.x - x) / d, (ped.y - y) / d);
    }
  }
  const p = world.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  const pd = Math.sqrt(dist2(x, y, px, py));
  if (pd < 140) damagePlayer(world, (140 - pd) * (p.car ? 0.35 : 0.8));
}
