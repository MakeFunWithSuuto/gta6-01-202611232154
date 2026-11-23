// Saving and loading progress in localStorage: story progress, money, arsenal, unlocks, Sun
// Tokens, stats and the time of day. A load puts Rae back at the safehouse.
import { SAVE_KEY } from './config.js';

export function hasSave() {
  try { return Boolean(window.localStorage.getItem(SAVE_KEY)); } catch { return false; }
}

export function readSave() {
  try {
    const data = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
    return data && typeof data === 'object' ? data : null;
  } catch { return null; }
}

export function writeSave(world) {
  const p = world.player;
  const data = {
    version: 1,
    savedAt: Date.now(),
    next: world.story.next,
    courierDone: world.story.courierDone,
    money: p.money,
    armor: p.armor,
    ammo: { pistol: p.ammo.pistol, smg: p.ammo.smg, shotgun: p.ammo.shotgun },
    unlocked: world.unlocked,
    tokens: [...world.tokens],
    stats: world.stats,
    clock: world.clock,
  };
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}

/** Apply a save onto a freshly made world. */
export function applySave(world, data) {
  const p = world.player;
  world.story.next = data.next ?? 0;
  world.story.courierDone = data.courierDone ?? 0;
  p.money = data.money ?? p.money;
  p.armor = data.armor ?? 0;
  Object.assign(p.ammo, data.ammo ?? {});
  world.unlocked = data.unlocked ?? {};
  world.tokens = new Set(data.tokens ?? []);
  world.pickups = world.pickups.filter((item) => item.type !== 'token' || !world.tokens.has(item.id));
  Object.assign(world.stats, data.stats ?? {});
  world.clock = data.clock ?? world.clock;
  const home = world.city.places.safehouse;
  p.x = home.x; p.y = home.y;
}
