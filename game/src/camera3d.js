// The 3D chase camera. In a car it swings in behind the car, low and close, pulling back and
// widening the lens with speed; on foot it hangs higher over Rae's shoulder at a fixed heading
// so WASD and mouse aim stay predictable. It also turns screen points into ground points (mouse
// aim) and world points into screen points (HUD labels).
import { lookAt, multiply, perspective, project } from './gl-math.js';
import { angleDiff } from './physics.js';

export function createCamera3d() {
  return {
    yaw: -Math.PI / 2, x: 0, y: 0, dist: 330, height: 300, fov: 0.95, lift: 0,
    width: 1280, height2d: 720, eye: [0, 300, 0], target: [0, 0, 0], viewProj: new Float32Array(16),
    shake: 0,
  };
}

function rebuild(cam) {
  const fx = Math.cos(cam.yaw);
  const fz = Math.sin(cam.yaw);
  cam.eye = [cam.x - fx * cam.dist, cam.height, cam.y - fz * cam.dist];
  cam.target = [cam.x + fx * cam.lift, 14, cam.y + fz * cam.lift];
  if (cam.shake > 0.2) {
    cam.eye[0] += (Math.random() - 0.5) * cam.shake;
    cam.eye[1] += (Math.random() - 0.5) * cam.shake;
  }
  const view = lookAt(cam.eye, cam.target);
  const proj = perspective(cam.fov, cam.width / cam.height2d, 8, 9000);
  cam.viewProj = multiply(proj, view);
}

/** Jump straight to the follow position (new game, staged shots). */
export function snapCamera3d(cam, world) {
  const car = world.player.car;
  if (car) cam.yaw = car.angle;
  updateCamera3d(cam, world, 10);
}

export function updateCamera3d(cam, world, dt) {
  const p = world.player;
  const f = world.focus;
  const k = Math.min(1, dt * 3.2);
  let want;
  if (p.car) {
    const speed = Math.hypot(p.car.vx, p.car.vy);
    if (p.car.speed > -30) cam.yaw += angleDiff(cam.yaw, p.car.angle) * Math.min(1, dt * 2.6);
    want = { dist: 230 + speed * 0.16, height: 120 + speed * 0.05, fov: 0.95 + Math.min(0.25, speed / 1800), lift: 90 + speed * 0.25 };
  } else {
    want = { dist: 250, height: 260, fov: 0.95, lift: 40 };
  }
  if (world.wanted.stars >= 3) { want.dist += 30; want.height += 30; }
  cam.dist += (want.dist - cam.dist) * k;
  cam.height += (want.height - cam.height) * k;
  cam.fov += (want.fov - cam.fov) * k;
  cam.lift += (want.lift - cam.lift) * k;
  cam.x += (f.x - cam.x) * Math.min(1, dt * 9);
  cam.y += (f.y - cam.y) * Math.min(1, dt * 9);
  cam.shake = world.shake;
  rebuild(cam);
}

/** Free camera placement for the title screen and staged views. */
export function placeCamera3d(cam, x, y, yaw, dist, height, lift = 0, fov = 0.95) {
  Object.assign(cam, { x, y, yaw, dist, height, lift, fov });
  rebuild(cam);
}

export function resizeCamera3d(cam, w, h) {
  cam.width = w;
  cam.height2d = h;
  rebuild(cam);
}

/** The ground point under a screen point (CSS px). */
export function groundAt(cam, sx, sy) {
  const fx = cam.target[0] - cam.eye[0];
  const fy = cam.target[1] - cam.eye[1];
  const fz = cam.target[2] - cam.eye[2];
  const fl = Math.hypot(fx, fy, fz);
  const f = [fx / fl, fy / fl, fz / fl];
  let r = [f[2], 0, -f[0]];
  const rl = Math.hypot(r[0], r[2]) || 1;
  r = [-r[0] / rl, 0, -r[2] / rl];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const t = Math.tan(cam.fov / 2);
  const nx = (sx / cam.width) * 2 - 1;
  const ny = 1 - (sy / cam.height2d) * 2;
  const aspect = cam.width / cam.height2d;
  const d = [f[0] + r[0] * nx * t * aspect + u[0] * ny * t, f[1] + r[1] * nx * t * aspect + u[1] * ny * t, f[2] + r[2] * nx * t * aspect + u[2] * ny * t];
  if (d[1] > -0.02) d[1] = -0.02;
  const k = -cam.eye[1] / d[1];
  return { x: cam.eye[0] + d[0] * k, y: cam.eye[2] + d[2] * k };
}

/** Screen position of a world point at height h, or null behind the camera. */
export function toScreen(cam, x, y, h = 0) {
  return project(cam.viewProj, x, h, y, cam.width, cam.height2d);
}
