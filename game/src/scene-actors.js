// Fills the per-frame 3D batches: sun shadows of buildings, cars (body, glass, wheels, lights,
// police light bars, wreck smoke), walkers with swinging legs and guns, the player, the police
// helicopter with spinning rotor and searchlight, pickups, mission markers and light beams, and
// effects (skids, blood, smoke, fire, tracers).
import { MAT_GLOW, MAT_PLAIN, rgb } from './mesh.js';
import { objectivePoint } from './missions.js';

const BLACK = [0, 0, 0];
const TIRE = rgb('#18181a');
const GLASS = rgb('#1c2a38');
const WRECK = rgb('#2b2a29');

function shade(c, k) { return c.map((v) => Math.max(0, Math.min(1, k < 0 ? v * (1 + k) : v + (1 - v) * k))); }

/** Building shadows on the ground, cast along the sun for the hour, near the camera only. */
export function fillShadows(batch, world, view, sun) {
  for (const b of world.city.buildings) {
    if (b.x > view.x1 || b.y > view.y1 || b.x + b.w < view.x0 || b.y + b.h < view.y0) continue;
    const dx = sun.x * b.height;
    const dz = sun.y * b.height;
    const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
    for (let k = 0; k < 4; k += 1) {
      const [ax, az] = pts[k];
      const [cx, cz] = pts[(k + 1) % 4];
      batch.quad([ax, 0.3, az], [cx, 0.3, cz], [cx + dx, 0.3, cz + dz], [ax + dx, 0.3, az + dz], [0, 1, 0], BLACK, 1);
    }
    batch.quad([b.x + dx, 0.3, b.y + dz], [b.x + b.w + dx, 0.3, b.y + dz], [b.x + b.w + dx, 0.3, b.y + b.h + dz], [b.x + dx, 0.3, b.y + b.h + dz], [0, 1, 0], BLACK, 1);
  }
  for (const palm of world.city.palms) {
    if (palm.x < view.x0 || palm.x > view.x1 || palm.y < view.y0 || palm.y > view.y1) continue;
    const h = 92 * palm.size;
    batch.disc(palm.x + sun.x * h, palm.y + sun.y * h, 0.3, 26 * palm.size, BLACK, 1, 0, MAT_PLAIN, 9);
  }
}

function drawCar(batch, car, time) {
  const { len, wid, cabin } = car.spec;
  const yaw = car.angle;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const at = (f, side) => [car.x + c * f - s * side, car.y + s * f + c * side];
  const body = car.wrecked ? WRECK : car.hitTimer > 0 ? [1, 1, 1] : rgb(car.color);
  const tall = car.model === 'ramble' || car.model === 'vault';
  batch.disc(car.x, car.y, 0.5, len * 0.55, BLACK, 0.35, 0, MAT_PLAIN, 12);
  for (const [f, side] of [[len * 0.3, wid / 2], [len * 0.3, -wid / 2], [-len * 0.3, wid / 2], [-len * 0.3, -wid / 2]]) {
    const [x, z] = at(f, side);
    batch.box(x, z, 0, yaw + (f > 0 ? car.steer * 0.4 : 0), 13, 5, 10, TIRE);
  }
  batch.box(car.x, car.y, 4, yaw, len, wid, 10, body, shade(body, 0.08));
  if (car.wrecked) { batch.box(car.x, car.y, 14, yaw, len * 0.5, wid - 4, 6, WRECK); return; }
  const cabLen = len * cabin;
  const cabOff = tall ? len * 0.12 : -cabLen * 0.08;
  const [kx, kz] = at(cabOff, 0);
  const cabH = tall ? 16 : 9;
  batch.box(kx, kz, 14, yaw, cabLen, wid - 3, cabH, GLASS, shade(body, -0.05));
  batch.box(kx, kz, 14 + cabH, yaw, cabLen * 0.85, wid - 5, 1.2, body);
  const [hx1, hz1] = at(len / 2, wid / 2 - 4);
  const [hx2, hz2] = at(len / 2, -wid / 2 + 4);
  const head = rgb('#fff3c4');
  batch.box(hx1, hz1, 8, yaw, 2, 5, 3, head, head, 1, MAT_GLOW);
  batch.box(hx2, hz2, 8, yaw, 2, 5, 3, head, head, 1, MAT_GLOW);
  const [tx1, tz1] = at(-len / 2, wid / 2 - 4);
  const [tx2, tz2] = at(-len / 2, -wid / 2 + 4);
  const tail = car.braking ? [1, 0.15, 0.15] : [0.6, 0.05, 0.08];
  batch.box(tx1, tz1, 9, yaw, 2, 5, 3, tail, tail, 1, MAT_GLOW);
  batch.box(tx2, tz2, 9, yaw, 2, 5, 3, tail, tail, 1, MAT_GLOW);
  if (car.spec.taxi) batch.box(kx, kz, 14 + cabH + 1, yaw, 6, 12, 4, rgb('#ffffff'), rgb('#ffee88'), 1, MAT_GLOW);
  if (car.spec.police) {
    batch.box(car.x, car.y, 4.1, yaw, len * 0.3, wid + 0.4, 9.8, rgb('#16223a'));
    const blink = Math.sin(time * 18) > 0;
    const on = car.siren;
    const red = on && blink ? [1, 0.1, 0.1] : [0.35, 0.05, 0.05];
    const blue = on && !blink ? [0.2, 0.4, 1] : [0.05, 0.08, 0.35];
    const [l1, m1] = at(cabOff, wid * 0.22);
    const [l2, m2] = at(cabOff, -wid * 0.22);
    batch.box(l1, m1, 14 + cabH + 1, yaw, 5, wid * 0.4, 3, red, red, 1, on ? MAT_GLOW : MAT_PLAIN);
    batch.box(l2, m2, 14 + cabH + 1, yaw, 5, wid * 0.4, 3, blue, blue, 1, on ? MAT_GLOW : MAT_PLAIN);
    if (on) batch.disc(car.x, car.y, 0.8, 60, blink ? [1, 0.15, 0.15] : [0.2, 0.4, 1], 0.22, 0, MAT_GLOW, 16);
  }
}

function drawWalker(batch, x, z, yaw, look, phase, gun, flash, scale = 0.8) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const at = (f, side) => [x + c * f - s * side, z + s * f + c * side];
  batch.disc(x, z, 0.5, 9 * scale, BLACK, 0.3, 0, MAT_PLAIN, 10);
  const step = Math.sin(phase) * 5;
  const pants = rgb(look.pants ?? '#2a2a33');
  const [l1x, l1z] = at(step, 3.5);
  const [l2x, l2z] = at(-step, -3.5);
  batch.box(l1x, l1z, 0, yaw, 5, 4.5, 13 * scale, pants);
  batch.box(l2x, l2z, 0, yaw, 5, 4.5, 13 * scale, pants);
  const shirt = rgb(look.shirt);
  batch.box(x, z, 13 * scale, yaw, 8, 15, 13 * scale, shirt);
  const skin = rgb(look.skin);
  batch.box(x, z, 26 * scale, yaw, 8, 8, 8 * scale, skin, rgb(look.cap ?? look.hair));
  if (gun) {
    const [ax, az] = at(8, 4);
    batch.box(ax, az, 19 * scale, yaw, 12, 3.5, 3.5, skin);
    const [gx, gz] = at(15, 4);
    batch.box(gx, gz, 20 * scale, yaw, gun === 'shotgun' ? 18 : gun === 'smg' ? 13 : 8, 2.5, 3, rgb('#151515'));
    if (flash) {
      const [fx, fz] = at(26, 4);
      batch.box(fx, fz, 18.5 * scale, yaw + 0.78, 7, 7, 6, [1, 0.9, 0.5], [1, 0.95, 0.6], 1, MAT_GLOW);
    }
  } else {
    const [a1x, a1z] = at(-step * 0.6, 9.5);
    const [a2x, a2z] = at(step * 0.6, -9.5);
    batch.box(a1x, a1z, 14 * scale, yaw, 4, 3.5, 11 * scale, skin);
    batch.box(a2x, a2z, 14 * scale, yaw, 4, 3.5, 11 * scale, skin);
  }
}

function drawBody(batch, ped) {
  const yaw = ped.angle + 1.2;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  batch.box(ped.x, ped.y, 0.5, yaw, 26, 12, 5, rgb(ped.shirt));
  batch.box(ped.x + c * 16, ped.y + s * 16, 0.5, yaw, 8, 8, 5, rgb(ped.skin));
}

const RAE = { shirt: '#f2f2f2', skin: '#c98e63', hair: '#1c1410', pants: '#2b3d66' };

function drawHeli(batch, world) {
  const heli = world.heli;
  if (!heli) return;
  const y = 210;
  const f = world.focus;
  batch.disc(f.x, f.y, 1, 70, [1, 1, 0.85], 0.22, 0, MAT_GLOW, 20);
  batch.disc(heli.x + 40, heli.y + 25, 0.6, 30, BLACK, 0.3, 0, MAT_PLAIN, 12);
  const yaw = heli.angle;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  batch.box(heli.x, heli.y, y, yaw, 44, 22, 20, rgb('#f2f4f7'), rgb('#1d2a44'));
  batch.box(heli.x + c * 16, heli.y + s * 16, y + 4, yaw, 14, 18, 13, rgb('#7fc3e6'));
  batch.box(heli.x - c * 40, heli.y - s * 40, y + 10, yaw, 44, 5, 5, rgb('#1d2a44'));
  batch.box(heli.x - c * 62, heli.y - s * 62, y + 8, yaw, 6, 2, 16, rgb('#1d2a44'));
  for (const side of [-1, 1]) batch.box(heli.x - s * 12 * side, heli.y + c * 12 * side, y - 6, yaw, 40, 2, 2, rgb('#333333'));
  batch.box(heli.x, heli.y, y + 20, 0, 4, 4, 5, rgb('#333333'));
  for (let k = 0; k < 2; k += 1) batch.box(heli.x, heli.y, y + 25, heli.rotor + (k * Math.PI) / 2, 110, 4, 1, rgb('#222222'), rgb('#222222'), 0.75);
  const blink = Math.sin(world.time * 14) > 0;
  batch.box(heli.x, heli.y, y - 2, 0, 4, 4, 3, blink ? [1, 0.2, 0.2] : [0.2, 0.4, 1], [1, 1, 1], 1, MAT_GLOW);
}

function drawPickups(batch, world) {
  for (const item of world.pickups) {
    if (item.respawn > 0) continue;
    const y = 10 + Math.sin(item.bob) * 4;
    if (item.type === 'cash') batch.box(item.x, item.y, 2, item.bob, 14, 8, 5, rgb('#2f9e44'), rgb('#8fe0a0'));
    else if (item.type === 'token') {
      batch.box(item.x, item.y, y, item.bob, 16, 4, 16, rgb('#ffc93c'), rgb('#ffe28a'), 1, MAT_GLOW);
      batch.disc(item.x, item.y, 0.7, 22, [1, 0.8, 0.2], 0.3, 0, MAT_GLOW, 14);
    } else {
      const col = item.type === 'health' ? rgb('#ffffff') : rgb('#3d6fd8');
      batch.box(item.x, item.y, y, item.bob, 14, 14, 14, col, item.type === 'health' ? [0.9, 0.2, 0.2] : col, 1, MAT_GLOW);
    }
  }
}

function drawMarkers(batch, world) {
  const places = world.city.places;
  const pulse = 1 + Math.sin(world.time * 4) * 0.08;
  for (const key of ['safehouse', 'respray', 'arms', 'hospital', 'police']) {
    const p = places[key];
    batch.disc(p.x, p.y, 0.9, 34 * pulse, rgb(p.color), 0.8, 28 * pulse, MAT_GLOW, 24);
    batch.disc(p.x, p.y, 0.8, 28, rgb(p.color), 0.2, 0, MAT_GLOW, 24);
  }
  if (world.story.next >= 1 && !world.story.active && !world.story.courier) {
    const m = places.market;
    batch.disc(m.x, m.y, 0.9, 34 * pulse, rgb('#57c7ff'), 0.8, 28 * pulse, MAT_GLOW, 24);
  }
  const target = objectivePoint(world);
  if (!target) return;
  const yellow = rgb('#ffd23f');
  batch.disc(target.x, target.y, 1, 40 * pulse, yellow, 0.9, 33 * pulse, MAT_GLOW, 28);
  batch.disc(target.x, target.y, 0.9, 33, yellow, 0.25, 0, MAT_GLOW, 28);
  batch.tube(target.x, target.y, 0, 260, 26, yellow, 0.14);
  if (!Object.values(places).includes(target)) {
    batch.box(target.x, target.y, 52 + Math.sin(world.time * 5) * 5, world.time * 2, 14, 14, 14, yellow, yellow, 1, MAT_GLOW);
  }
}

function drawEffects(batch, world) {
  for (const s of world.skids) {
    const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
    if (len < 0.5) continue;
    batch.box((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, 0.2, Math.atan2(s.y1 - s.y0, s.x1 - s.x0), len + 1, 4, 0.1, [0.08, 0.08, 0.09], [0.08, 0.08, 0.09], Math.min(0.5, s.life / 14 * 0.5));
  }
  for (const d of world.decals) {
    batch.disc(d.x, d.y, 0.35, d.r, d.scorch ? [0.08, 0.07, 0.06] : [0.5, 0.03, 0.05], Math.min(0.75, d.life / 10), 0, MAT_PLAIN, 8);
  }
  for (const t of world.tracers) {
    const len = Math.hypot(t.x1 - t.x0, t.y1 - t.y0);
    batch.box((t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2, 19, Math.atan2(t.y1 - t.y0, t.x1 - t.x0), len, 1.5, 1.5, rgb(t.color), rgb(t.color), 0.9, MAT_GLOW);
  }
  for (const p of world.particles) {
    const a = Math.max(0, p.life / p.max);
    const rise = (1 - a) * (p.kind === 'smoke' ? 70 : p.kind === 'fire' ? 30 : 6) + 8;
    const size = p.size * (p.kind === 'flash' ? 1.2 - a : 1);
    if (p.kind === 'smoke') batch.box(p.x, p.y, rise, p.life, size, size, size, rgb(p.color), rgb(p.color), a * 0.55);
    else if (p.kind === 'flash') batch.disc(p.x, p.y, 2, size, rgb(p.color), a * 0.5, 0, MAT_GLOW, 16);
    else batch.box(p.x, p.y, rise, p.life * 3, size, size, size, a > 0.5 && p.kind === 'fire' ? [1, 0.88, 0.5] : rgb(p.color), [1, 0.9, 0.6], a, MAT_GLOW);
  }
}

/** Everything that moves this frame, split into solid and see-through batches. */
export function fillActors(solid, glass, world, view) {
  const inView = (x, y, pad = 80) => x > view.x0 - pad && x < view.x1 + pad && y > view.y0 - pad && y < view.y1 + pad;
  for (const car of world.cars) if (inView(car.x, car.y)) drawCar(solid, car, world.time);
  for (const ped of world.peds) {
    if (!inView(ped.x, ped.y)) continue;
    if (ped.dead) { drawBody(solid, ped); continue; }
    const look = { shirt: ped.shirt, skin: ped.skin, hair: ped.hair, cap: ped.kind === 'cop' ? '#13254a' : null, pants: ped.kind === 'cop' ? '#13254a' : null };
    drawWalker(solid, ped.x, ped.y, ped.angle, look, ped.walkPhase, ped.hostile ? ped.weapon : null, ped.hostile && ped.fireCd > (ped.weapon === 'smg' ? 0.1 : 0.82));
    if (ped.tag === 'pike' || ped.tag === 'guard' || ped.tag === 'crew') solid.box(ped.x, ped.y, 44 + Math.sin(world.time * 5) * 3, world.time * 3, 7, 7, 7, [1, 0.25, 0.25], [1, 0.3, 0.3], 1, MAT_GLOW);
  }
  const p = world.player;
  if (!p.car) {
    if (p.dead) drawBody(solid, { x: p.x, y: p.y, angle: 0.4, shirt: RAE.shirt, skin: RAE.skin });
    else {
      glass.disc(p.x, p.y, 0.7, 17, rgb('#7fe3ff'), 0.7, 14, MAT_GLOW, 20);
      drawWalker(solid, p.x, p.y, p.angle, RAE, p.walkPhase, p.weapon === 'fists' ? null : p.weapon, p.muzzle > 0, 0.85);
    }
  }
  drawPickups(solid, world);
  drawHeli(glass, world);
  drawMarkers(glass, world);
  drawEffects(glass, world);
}

export { shade };
