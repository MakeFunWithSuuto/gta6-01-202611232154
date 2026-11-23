// City services the player walks or drives into: the safehouse (save and heal), Spray-Lab
// (respray to lose the cops), Iron Coast Arms (buy ammo and armor), plus pickups lying around
// town: cash, health, armor and the 20 hidden Sun Tokens.
import { TILE, T_SAND, T_WALK } from './config.js';
import { dist2 } from './physics.js';
import { clearWanted } from './police.js';
import { createRandom } from './random.js';
import { addFloatText } from './effects.js';
import { earnRep } from './progression.js';

export const TOKEN_COUNT = 20;

const SHOP = [
  { key: 'pistol', label: '36 pistol rounds', price: 120, amount: 36 },
  { key: 'smg', label: '90 SMG rounds', price: 360, amount: 90, needs: 'smg' },
  { key: 'shotgun', label: '18 shells', price: 420, amount: 18, needs: 'shotgun' },
  { key: 'armor', label: 'Body armor', price: 300, amount: 100 },
];

/** The fixed spots of the Sun Tokens and the starting health and armor pickups. */
export function createPickups(city) {
  const rng = createRandom(77);
  const list = [];
  let id = 0;
  while (list.length < TOKEN_COUNT) {
    const tx = rng.int(2, 95);
    const ty = rng.int(2, 90);
    const t = city.tileAt(tx, ty);
    if (t !== T_WALK && t !== T_SAND) continue;
    list.push({ type: 'token', id: id++, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, bob: rng.next() * 6 });
  }
  const p = city.places;
  list.push({ type: 'health', x: p.hospital.x + 70, y: p.hospital.y, respawn: 0 });
  list.push({ type: 'health', x: p.safehouse.x - 70, y: p.safehouse.y, respawn: 0 });
  list.push({ type: 'armor', x: p.police.x + 90, y: p.police.y, respawn: 0 });
  return list;
}

/** The prompt to show when standing at a service, and the action E performs there. */
function serviceHere(world) {
  const p = world.player;
  const places = world.city.places;
  const near = (place, r) => dist2(p.x, p.y, place.x, place.y) < r * r;
  if (near(places.safehouse, 60) && !p.car) {
    return { text: 'E  Sleep & save the game', act: () => {
      p.health = 100;
      world.requestSave = true;
      world.clock = (world.clock + 8) % 24;
      world.banner = { title: 'Game saved', sub: 'Rested at the safehouse', t: 2.5 };
    } };
  }
  if (near(places.respray, 80) && p.car) {
    if (world.wanted.stars === 0) return { text: 'Spray-Lab: no heat on you right now' };
    return { text: p.money >= 150 ? 'E  Respray for $150 and lose the cops' : 'Respray costs $150', act: p.money >= 150 ? () => {
      p.money -= 150;
      p.car.color = world.rng.pick(p.car.spec.colors.concat(['#2f9e8f', '#f0e6d2', '#6b3fa0', '#d94f70']));
      if (p.car.spec.police) p.car.color = '#f2e3c2';
      p.car.health = Math.max(p.car.health, 100);
      clearWanted(world);
      world.banner = { title: 'Fresh paint', sub: 'The cops lost your description', t: 2.5 };
      world.events.push({ type: 'spray' });
    } : null };
  }
  if (near(places.arms, 60) && !p.car) {
    const items = SHOP.filter((item) => !item.needs || world.unlocked[item.needs]);
    const index = (world.shopIndex ?? 0) % items.length;
    const item = items[index];
    return {
      text: `E  Buy ${item.label} - $${item.price}   ·   Tab  next item`,
      tab: () => { world.shopIndex = index + 1; },
      act: p.money >= item.price ? () => {
        p.money -= item.price;
        if (item.key === 'armor') p.armor = 100;
        else { p.ammo[item.key] = (p.ammo[item.key] ?? 0) + item.amount; p.weapon = item.key; }
        world.events.push({ type: 'buy' });
        addFloatText(world, p.x, p.y - 30, `-$${item.price}`, '#ffd166');
      } : null,
    };
  }
  return null;
}

export function updateServices(world, input, dt) {
  const p = world.player;
  const service = p.dead ? null : serviceHere(world);
  world.prompt = service?.text ?? null;
  if (service?.act && input?.wasPressed('KeyE')) service.act();
  if (service?.tab && input?.wasPressed('Tab')) service.tab();

  for (const item of world.pickups) {
    item.bob = (item.bob ?? 0) + dt * 3;
    if (item.respawn > 0) { item.respawn -= dt; continue; }
    if (p.dead || dist2(p.x, p.y, item.x, item.y) > (p.car ? 34 : 24) ** 2) continue;
    if (item.type === 'cash') {
      p.money += item.amount; item.gone = true;
      addFloatText(world, item.x, item.y - 20, `+$${item.amount}`, '#7dffa0');
      world.events.push({ type: 'cash' });
    } else if (item.type === 'token') {
      item.gone = true;
      world.tokens.add(item.id);
      p.money += 250;
      world.banner = { title: `Sun Token ${world.tokens.size}/${TOKEN_COUNT}`, sub: '+$250', t: 2.5 };
      world.events.push({ type: 'token' });
      earnRep(world, 25);
    } else if (item.type === 'health' && p.health < 100) {
      p.health = 100; item.respawn = 60;
      world.events.push({ type: 'cash' });
    } else if (item.type === 'armor' && p.armor < 100) {
      p.armor = 100; item.respawn = 90;
      world.events.push({ type: 'cash' });
    }
  }
  world.pickups = world.pickups.filter((item) => !item.gone);
}
