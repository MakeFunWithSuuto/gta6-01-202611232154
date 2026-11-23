// Visual effects that live in the world: smoke, fire, sparks, blood, bullet tracers, skid marks
// and floating money/score text. Each is plain data stepped here and painted by the renderer.

const MAX_PARTICLES = 900;
const MAX_SKIDS = 700;

function add(world, particle) {
  if (world.particles.length >= MAX_PARTICLES) world.particles.shift();
  world.particles.push(particle);
}

export function addSparks(world, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const a = world.rng.range(0, Math.PI * 2);
    const s = world.rng.range(60, 240);
    add(world, { kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3, max: 0.3, size: 2, color: '#ffe08a' });
  }
}

export function addBlood(world, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    world.decals.push({ x: x + world.rng.range(-10, 10), y: y + world.rng.range(-10, 10), r: world.rng.range(3, 8), life: 30 });
  }
  if (world.decals.length > 220) world.decals.splice(0, world.decals.length - 220);
}

export function addSmoke(world, x, y, dark) {
  add(world, {
    kind: 'smoke', x, y, vx: world.rng.range(-12, 12) + 18, vy: world.rng.range(-30, -10),
    life: 1.6, max: 1.6, size: world.rng.range(7, 12), color: dark ? '#2a2a2e' : '#d8d8d8',
  });
}

export function addFire(world, x, y) {
  add(world, { kind: 'fire', x: x + world.rng.range(-8, 8), y: y + world.rng.range(-8, 8), vx: world.rng.range(-10, 10), vy: world.rng.range(-50, -20), life: 0.55, max: 0.55, size: world.rng.range(6, 12), color: '#ff9b2f' });
}

export function addExplosion(world, x, y) {
  for (let i = 0; i < 46; i += 1) {
    const a = world.rng.range(0, Math.PI * 2);
    const s = world.rng.range(40, 320);
    add(world, { kind: 'fire', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: world.rng.range(0.4, 0.9), max: 0.9, size: world.rng.range(10, 24), color: '#ffb347' });
  }
  for (let i = 0; i < 20; i += 1) addSmoke(world, x + world.rng.range(-30, 30), y + world.rng.range(-30, 30), true);
  add(world, { kind: 'flash', x, y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: 180, color: '#fff3c4' });
  world.decals.push({ x, y, r: 46, life: 60, scorch: true });
}

export function addTracer(world, x0, y0, x1, y1, fromPlayer) {
  world.tracers.push({ x0, y0, x1, y1, life: 0.07, color: fromPlayer ? '#fff6b0' : '#ffb08a' });
}

export function addSkid(world, x0, y0, x1, y1) {
  world.skids.push({ x0, y0, x1, y1, life: 14 });
  if (world.skids.length > MAX_SKIDS) world.skids.shift();
}

export function addFloatText(world, x, y, text, color) {
  world.floaters.push({ x, y, text, color, life: 1.6 });
}

export function updateEffects(world, dt) {
  for (const p of world.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - dt * 2.2;
    p.vy *= 1 - dt * 2.2;
    if (p.kind === 'smoke') p.size += dt * 14;
  }
  world.particles = world.particles.filter((p) => p.life > 0);
  for (const t of world.tracers) t.life -= dt;
  world.tracers = world.tracers.filter((t) => t.life > 0);
  for (const s of world.skids) s.life -= dt;
  while (world.skids.length && world.skids[0].life <= 0) world.skids.shift();
  for (const d of world.decals) d.life -= dt;
  world.decals = world.decals.filter((d) => d.life > 0);
  for (const f of world.floaters) { f.life -= dt; f.y -= dt * 30; }
  world.floaters = world.floaters.filter((f) => f.life > 0);
}
