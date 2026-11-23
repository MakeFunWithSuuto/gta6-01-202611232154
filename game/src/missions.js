// The mission runner: shows where the next story mission starts, starts it when the player steps
// into the marker, plays each step (go to, steal, deliver, kill, wreck, lose the cops, beat the
// clock), fails on death, arrest or a wrecked mission car, and pays out. Also runs courier side
// jobs from Mercado Norte between missions.
import { dist2, distance } from './physics.js';
import { MISSIONS } from './story.js';
import { addFloatText } from './effects.js';
import { earnRep } from './progression.js';

export function createStory() {
  return { next: 0, active: null, courier: null, courierDone: 0 };
}

/** Where the current objective points (for the HUD arrow, the minimap and the ground marker). */
export function objectivePoint(world) {
  const s = world.story;
  if (s.courier) return s.courier.stage === 0 ? s.courier.from : s.courier.to;
  const active = s.active;
  if (!active) {
    if (s.next >= MISSIONS.length) return null;
    return world.city.places[MISSIONS[s.next].giver];
  }
  const step = active.mission.steps[active.step];
  if (step.at && (step.kind !== 'deliver' || world.player.car?.tag === step.tag)) return world.city.places[step.at];
  if (step.tag) {
    const car = world.cars.find((c) => c.tag === step.tag);
    if (car && world.player.car !== car) return car;
    const ped = world.peds.find((p) => p.tag === step.tag && !p.dead);
    if (ped) return ped;
  }
  return step.at ? world.city.places[step.at] : null;
}

export function objectiveText(world) {
  const s = world.story;
  if (s.courier) return s.courier.stage === 0 ? 'Courier: pick up the parcel' : `Courier: deliver to ${s.courier.to.name}`;
  if (!s.active) {
    if (s.next >= MISSIONS.length) return 'Story complete - Solmar Bay is yours. Free roam.';
    const m = MISSIONS[s.next];
    return `Meet ${m.contact === 'dex' ? 'Dex' : 'Marisol'} at ${world.city.places[m.giver].name}`;
  }
  const step = s.active.mission.steps[s.active.step];
  if (step.kind === 'deliver' && world.player.car?.tag !== step.tag) return 'Get back in the vehicle';
  return step.text;
}

function beginStep(world) {
  const a = world.story.active;
  const step = a.mission.steps[a.step];
  a.timer = step.limit ?? 0;
  step.setup?.(world);
}

export function startMission(world, index) {
  const mission = MISSIONS[index];
  world.story.active = { mission, step: 0, timer: 0 };
  world.banner = { title: mission.title, sub: 'Mission', t: 3.5 };
  for (const [who, text] of mission.intro) world.subtitle(who, text);
  world.events.push({ type: 'missionStart' });
  beginStep(world);
}

function cleanupMission(world) {
  for (const car of world.cars) { car.tag = null; car.fleeing = false; }
  for (const ped of world.peds) if (ped.tag) { ped.tag = null; if (!ped.dead) ped.hostile = ped.kind === 'cop' && world.wanted.stars > 0; }
}

export function failMission(world, reason) {
  if (!world.story.active) return;
  world.banner = { title: 'Mission failed', sub: reason, t: 3.5, bad: true };
  world.events.push({ type: 'fail' });
  world.story.active = null;
  cleanupMission(world);
}

function completeMission(world) {
  const a = world.story.active;
  const m = a.mission;
  world.player.money += m.reward;
  world.stats.missions += 1;
  for (const [key, amount] of Object.entries(m.unlock ?? {})) {
    if (key === 'armor') world.player.armor = Math.max(world.player.armor, amount);
    else { world.player.ammo[key] = (world.player.ammo[key] ?? 0) + amount; world.unlocked[key] = true; }
  }
  world.banner = { title: 'Mission passed', sub: `+$${m.reward.toLocaleString('en-US')}  ·  respect up`, t: 4.5 };
  for (const [who, text] of m.outro) world.subtitle(who, text);
  world.events.push({ type: 'pass' });
  world.story.active = null;
  world.story.next += 1;
  cleanupMission(world);
  earnRep(world, Math.round(m.reward / 8));
  world.requestSave = true;
}

function stepDone(world, step, dt) {
  const p = world.player;
  const a = world.story.active;
  if (step.limit) {
    a.timer -= dt;
    if (a.timer <= 0) { failMission(world, 'Out of time'); return false; }
  }
  const tagged = step.tag ? world.cars.find((c) => c.tag === step.tag) : null;
  if ((step.kind === 'enter' || step.kind === 'deliver' || (step.kind === 'lose' && step.tag)) && tagged?.wrecked) {
    failMission(world, 'The vehicle was destroyed');
    return false;
  }
  const at = step.at ? world.city.places[step.at] : null;
  switch (step.kind) {
    case 'goto':
      return distance(p.x, p.y, at.x, at.y) < (step.radius ?? 70) && (!step.onFoot || !p.car);
    case 'enter':
      return p.car && p.car.tag === step.tag;
    case 'deliver':
      return p.car?.tag === step.tag && distance(p.x, p.y, at.x, at.y) < 110 && Math.abs(p.car.speed) < 160;
    case 'kill':
      return !world.peds.some((ped) => ped.tag === step.tag && !ped.dead);
    case 'destroy':
      return Boolean(tagged?.wrecked || !tagged);
    case 'lose':
      return world.wanted.stars === 0 && (!step.tag || p.car?.tag === step.tag);
    default:
      return false;
  }
}

const COURIER_SPOTS = ['safehouse', 'respray', 'hospital', 'police', 'arms', 'tower', 'club', 'garage', 'pier'];

function updateCourier(world, dt) {
  const c = world.story.courier;
  const p = world.player;
  c.timer -= dt;
  if (c.timer <= 0) {
    world.story.courier = null;
    world.banner = { title: 'Delivery late', sub: 'The client went elsewhere', t: 3, bad: true };
    world.events.push({ type: 'fail' });
    return;
  }
  const goal = c.stage === 0 ? c.from : c.to;
  if (dist2(p.x, p.y, goal.x, goal.y) > 90 * 90) return;
  if (c.stage === 0) {
    c.stage = 1;
    c.timer += 20;
    world.events.push({ type: 'pickup' });
    addFloatText(world, p.x, p.y - 30, 'Parcel picked up', '#9fe8ff');
    return;
  }
  const pay = 180 + Math.round(c.timer * 4);
  p.money += pay;
  world.story.courierDone += 1;
  earnRep(world, 35);
  world.story.courier = null;
  world.banner = { title: 'Delivered', sub: `+$${pay}  ·  ${Math.ceil(c.timer)}s to spare`, t: 3 };
  world.events.push({ type: 'pass' });
}

/** Offer a courier run starting at Mercado Norte: a pickup nearby, then a drop across town. */
function startCourier(world) {
  const places = world.city.places;
  const from = places[world.rng.pick(COURIER_SPOTS)];
  let to = from;
  while (to === from) to = places[world.rng.pick(COURIER_SPOTS)];
  const d = distance(from.x, from.y, to.x, to.y) + distance(places.market.x, places.market.y, from.x, from.y);
  world.story.courier = { from, to, stage: 0, timer: 25 + d / 95 };
  world.banner = { title: 'Courier Job', sub: 'Pick up the parcel, beat the clock', t: 3 };
  world.events.push({ type: 'missionStart' });
}

export function updateMissions(world, dt) {
  const s = world.story;
  const p = world.player;
  if (p.dead) return;
  if (s.courier) { updateCourier(world, dt); return; }
  if (!s.active) {
    if (s.next < MISSIONS.length) {
      const giver = world.city.places[MISSIONS[s.next].giver];
      if (dist2(p.x, p.y, giver.x, giver.y) < 60 * 60 && (!p.car || Math.abs(p.car.speed) < 60) && world.wanted.stars === 0) startMission(world, s.next);
    }
    const market = world.city.places.market;
    if (s.next >= 1 && dist2(p.x, p.y, market.x, market.y) < 50 * 50 && (!p.car || Math.abs(p.car.speed) < 60)) startCourier(world);
    return;
  }
  const a = s.active;
  const step = a.mission.steps[a.step];
  if (!stepDone(world, step, dt) || !s.active) return;
  a.step += 1;
  world.events.push({ type: 'checkpoint' });
  if (a.step >= a.mission.steps.length) completeMission(world);
  else beginStep(world);
}
