// The chase camera: follows the player with a little look-ahead in the direction of travel,
// pulls back as the car speeds up, shakes on gunfire and explosions, and converts between world
// and screen coordinates.

export function createCamera() {
  return { x: 0, y: 0, zoom: 1, width: 1280, height: 720, shakeX: 0, shakeY: 0 };
}

export function snapCamera(cam, world) {
  const f = world.focus;
  cam.x = f.x; cam.y = f.y;
  cam.zoom = world.player.car ? 0.78 : 1;
}

export function updateCamera(cam, world, dt, aim) {
  const p = world.player;
  const f = world.focus;
  let tx = f.x;
  let ty = f.y;
  let zoom = 1.15;
  if (p.car) {
    const speed = Math.hypot(p.car.vx, p.car.vy);
    tx += p.car.vx * 0.55;
    ty += p.car.vy * 0.55;
    zoom = 1.0 - Math.min(0.24, speed / 1500);
  } else if (aim) {
    tx += (aim.x - f.x) * 0.18;
    ty += (aim.y - f.y) * 0.18;
  }
  if (world.wanted.stars >= 3) zoom -= 0.04;
  const k = Math.min(1, dt * 4.5);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.zoom += (zoom - cam.zoom) * Math.min(1, dt * 1.8);
  const s = world.shake;
  cam.shakeX = (Math.random() - 0.5) * s;
  cam.shakeY = (Math.random() - 0.5) * s;
}

/** The world point under a screen point (CSS pixels). */
export function screenToWorld(cam, sx, sy) {
  return { x: (sx - cam.width / 2) / cam.zoom + cam.x, y: (sy - cam.height / 2) / cam.zoom + cam.y };
}
