// Cars: the models on Solmar Bay's roads, the arcade driving model (throttle, brake, steering,
// handbrake drifts, grip), crashes into the city and into each other, damage, fire and wrecks.
import { CAR_RADIUS, TILE, T_SAND } from './config.js';
import { angleDiff, clamp, resolveCircleVsCity } from './physics.js';

export const CAR_MODELS = {
  mako: { name: 'Mako GT', len: 46, wid: 22, top: 430, accel: 340, grip: 7.5, turn: 2.7, colors: ['#e0303a', '#f5c400', '#ff6a1f'], cabin: 0.42 },
  pelican: { name: 'Pelican', len: 48, wid: 23, top: 300, accel: 230, grip: 6.5, turn: 2.3, colors: ['#f1efe8', '#3b6ea8', '#7a8a92', '#2d6b58', '#b8a37a'], cabin: 0.55 },
  cicada: { name: 'Cicada', len: 38, wid: 20, top: 270, accel: 250, grip: 7, turn: 2.8, colors: ['#9fd8c8', '#f6a5b5', '#f3e28a', '#a9c6ef'], cabin: 0.6 },
  tern: { name: 'Tern Cab', len: 48, wid: 23, top: 300, accel: 230, grip: 6.5, turn: 2.3, colors: ['#ffc928'], cabin: 0.55, taxi: true },
  ramble: { name: 'Ramble Van', len: 56, wid: 26, top: 240, accel: 170, grip: 6, turn: 1.9, colors: ['#e8e4d8', '#5c7f9c', '#c46a3d'], cabin: 0.3 },
  bastion: { name: 'Bastion Cruiser', len: 50, wid: 24, top: 380, accel: 320, grip: 7.5, turn: 2.5, colors: ['#f4f6f8'], cabin: 0.5, police: true },
  vault: { name: 'Vault Armored', len: 62, wid: 28, top: 230, accel: 150, grip: 6, turn: 1.7, colors: ['#4c5a52'], cabin: 0.28, armored: true },
  marquis: { name: 'Marquis Limo', len: 64, wid: 24, top: 330, accel: 240, grip: 6.5, turn: 1.9, colors: ['#15161c'], cabin: 0.6 },
};
export const TRAFFIC_MODELS = ['pelican', 'pelican', 'cicada', 'cicada', 'tern', 'ramble', 'mako', 'pelican'];

let nextCarId = 1;

export function createCar(model, x, y, angle, color) {
  const spec = CAR_MODELS[model];
  return {
    id: nextCarId++,
    model, spec,
    color: color ?? spec.colors[0],
    x, y, angle, vx: 0, vy: 0, speed: 0,
    steer: 0, throttle: 0, handbrake: false, braking: false,
    health: spec.armored ? 260 : 100,
    burning: 0, wrecked: false,
    driver: null, ai: null, tag: null,
    siren: false, skid: 0, hitTimer: 0,
  };
}

export function forwardOf(car) { return { x: Math.cos(car.angle), y: Math.sin(car.angle) }; }

/**
 * One physics step. `car.throttle` (-1..1), `car.steer` (-1..1) and `car.handbrake` are the inputs;
 * returns the impact speed of any crash into the city this step (0 when none).
 */
export function driveCar(car, city, dt) {
  const spec = car.spec;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let vf = car.vx * fx + car.vy * fy;
  let vl = -car.vx * fy + car.vy * fx;
  const onSand = city.tileAtPoint(car.x, car.y) === T_SAND;
  const top = (car.wrecked ? 0 : spec.top) * (onSand ? 0.55 : 1);

  car.braking = false;
  if (!car.wrecked) {
    if (car.throttle > 0) {
      if (vf < -10) { vf += 600 * dt; car.braking = true; } else vf += spec.accel * car.throttle * dt * (1 - Math.max(0, vf) / (top + 1)) * 1.6;
    } else if (car.throttle < 0) {
      if (vf > 10) { vf -= 620 * dt; car.braking = true; } else vf = Math.max(-top * 0.4, vf + spec.accel * car.throttle * 0.7 * dt);
    }
  }
  vf -= vf * (car.throttle === 0 ? 0.9 : 0.25) * dt;
  if (car.handbrake) vf -= vf * 1.8 * dt;
  const grip = car.handbrake ? 1.4 : spec.grip;
  const slip = Math.abs(vl);
  vl -= vl * Math.min(1, grip * dt);
  car.skid = car.wrecked ? 0 : clamp((slip - 70) / 120, 0, 1) + (car.braking && Math.abs(vf) > 150 ? 0.5 : 0);

  const steerAuthority = clamp(vf / 140, -1, 1) * (1 - clamp((Math.abs(vf) - 250) / 600, 0, 0.35));
  car.angle += car.steer * spec.turn * steerAuthority * dt * (car.handbrake ? 1.35 : 1);

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  car.vx = nfx * vf - nfy * vl;
  car.vy = nfy * vf + nfx * vl;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = vf;

  let impact = 0;
  for (const offset of [spec.len * 0.28, -spec.len * 0.28]) {
    const px = car.x + Math.cos(car.angle) * offset;
    const py = car.y + Math.sin(car.angle) * offset;
    const res = resolveCircleVsCity(city, px, py, spec.wid * 0.62);
    if (!res.hit) continue;
    car.x += res.x - px;
    car.y += res.y - py;
    const into = car.vx * res.nx + car.vy * res.ny;
    if (into < 0) {
      impact = Math.max(impact, -into);
      car.vx -= into * res.nx * 1.35;
      car.vy -= into * res.ny * 1.35;
      car.vx *= 0.8;
      car.vy *= 0.8;
    }
  }
  if (impact > 90) damageCar(car, (impact - 90) * 0.12);
  car.x = clamp(car.x, TILE, city.width - TILE);
  car.y = clamp(car.y, TILE, city.height - TILE);
  if (car.hitTimer > 0) car.hitTimer -= dt;
  return impact;
}

export function damageCar(car, amount) {
  if (car.wrecked) return;
  car.health -= amount;
  car.hitTimer = 0.15;
  if (car.health <= 0 && car.burning === 0) car.burning = 3.2;
}

/** Push overlapping cars apart and trade momentum; returns pairs that hit hard. */
export function collideCars(cars) {
  const hits = [];
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = CAR_RADIUS * 2 * ((a.spec.len + b.spec.len) / 100);
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const push = (min - d) / 2;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const ma = a.spec.armored ? 3 : 1;
        const mb = b.spec.armored ? 3 : 1;
        const impulse = (-rel * 1.2) / (ma + mb);
        a.vx -= nx * impulse * mb; a.vy -= ny * impulse * mb;
        b.vx += nx * impulse * ma; b.vy += ny * impulse * ma;
        if (-rel > 120) {
          damageCar(a, (-rel - 120) * 0.08 / ma);
          damageCar(b, (-rel - 120) * 0.08 / mb);
          hits.push({ a, b, speed: -rel, x: a.x + nx * d / 2, y: a.y + ny * d / 2 });
        }
      }
    }
  }
  return hits;
}

/** Set steering and throttle to drive toward a point at a wanted speed (used by traffic and police). */
export function steerToward(car, tx, ty, wantSpeed) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(car.angle, want);
  car.steer = clamp(diff * 2.6, -1, 1);
  const turnSlow = 1 - Math.min(0.6, Math.abs(diff) * 0.5);
  const target = wantSpeed * turnSlow;
  car.throttle = car.speed < target - 10 ? 1 : car.speed > target + 25 ? -0.6 : 0.15;
  car.handbrake = false;
  return diff;
}
