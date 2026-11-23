// The frame: sizes the canvas to the window, draws the world layers in order (ground, sun
// shadows, decals, markers, pickups, walkers, cars, effects, buildings, palms, the objective
// beacon, the helicopter), grades the light by the time of day with headlights after dark, then
// lays the HUD on top in screen space.
import { drawBuildings, drawGround, drawPalms, drawShadows, sunVector } from './render-city.js';
import { drawBeacon, drawCar, drawDecals, drawEffects, drawHelicopter, drawMarkers, drawPeds, drawPickups, drawPlayer } from './render-actors.js';
import { drawHud } from './hud.js';

const GRADE = [
  [0, [70, 82, 140], 0.0], [5, [80, 90, 150], 0.0], [6.5, [255, 190, 170], 0.6], [8, [255, 255, 255], 1],
  [16, [255, 255, 255], 1], [17.5, [255, 214, 165], 0.95], [19, [255, 160, 120], 0.7], [20.3, [150, 120, 190], 0.35],
  [21.5, [70, 82, 140], 0.0], [24, [70, 82, 140], 0.0],
];

/** Multiply colour and daylight (0 night .. 1 noon) for an hour of the day. */
export function lightAt(clock) {
  for (let i = 0; i < GRADE.length - 1; i += 1) {
    const [h0, c0, d0] = GRADE[i];
    const [h1, c1, d1] = GRADE[i + 1];
    if (clock < h0 || clock > h1) continue;
    const t = (clock - h0) / (h1 - h0 || 1);
    return { rgb: c0.map((v, k) => Math.round(v + (c1[k] - v) * t)), day: d0 + (d1 - d0) * t };
  }
  return { rgb: [255, 255, 255], day: 1 };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const shadowLayer = document.createElement('canvas');
  const sg = shadowLayer.getContext('2d');
  let dpr = 1;

  function resize(cam) {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      shadowLayer.width = canvas.width;
      shadowLayer.height = canvas.height;
    }
    cam.width = w;
    cam.height = h;
  }

  function worldTransform(g, cam) {
    const z = cam.zoom * dpr;
    g.setTransform(z, 0, 0, z, dpr * (cam.width / 2 + cam.shakeX) - cam.x * z, dpr * (cam.height / 2 + cam.shakeY) - cam.y * z);
  }

  function drawNightLights(world, view, night) {
    ctx.globalCompositeOperation = 'lighter';
    for (const car of world.cars) {
      if (car.wrecked || car.x < view.x0 - 200 || car.x > view.x1 + 200 || car.y < view.y0 - 200 || car.y > view.y1 + 200) continue;
      const fx = Math.cos(car.angle);
      const fy = Math.sin(car.angle);
      const hx = car.x + fx * car.spec.len * 0.5;
      const hy = car.y + fy * car.spec.len * 0.5;
      const g = ctx.createRadialGradient(hx + fx * 60, hy + fy * 60, 5, hx + fx * 60, hy + fy * 60, 110);
      g.addColorStop(0, `rgba(255,240,190,${0.35 * night})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(hx + fx * 60, hy + fy * 60, 110, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Draw a whole frame. `overlay(ctx, w, h)` paints menus after the HUD; `hud` false hides the HUD. */
  function draw(world, cam, { hud = true, overlay = null } = {}) {
    resize(cam);
    const w = cam.width;
    const h = cam.height;
    const view = {
      x0: cam.x - w / 2 / cam.zoom - 40, x1: cam.x + w / 2 / cam.zoom + 40,
      y0: cam.y - h / 2 / cam.zoom - 40, y1: cam.y + h / 2 / cam.zoom + 40,
    };
    const light = lightAt(world.clock);
    const sun = sunVector(world.clock);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2f8fb0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    worldTransform(ctx, cam);
    drawGround(ctx, world, view);

    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, shadowLayer.width, shadowLayer.height);
    worldTransform(sg, cam);
    drawShadows(sg, world, view, sun);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.18 + 0.14 * light.day;
    ctx.drawImage(shadowLayer, 0, 0);
    ctx.globalAlpha = 1;
    worldTransform(ctx, cam);

    drawDecals(ctx, world);
    drawMarkers(ctx, world, cam);
    drawPickups(ctx, world);
    drawPeds(ctx, world, false);
    for (const car of world.cars) {
      if (car.x < view.x0 - 80 || car.x > view.x1 + 80 || car.y < view.y0 - 80 || car.y > view.y1 + 80) continue;
      drawCar(ctx, car, world.time);
    }
    drawPeds(ctx, world, true);
    drawPlayer(ctx, world);
    drawEffects(ctx, world);
    drawBuildings(ctx, world, cam, view, sun);
    drawPalms(ctx, world, cam, view);
    drawBeacon(ctx, world, cam);
    drawHelicopter(ctx, world, cam);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (light.day < 0.999) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${light.rgb.join(',')})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      if (light.day < 0.6) {
        worldTransform(ctx, cam);
        drawNightLights(world, view, 1 - light.day / 0.6);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
    const vignette = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.45, canvas.width / 2, canvas.height / 2, canvas.height * 0.95);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (hud) drawHud(ctx, world, cam, w, h);
    if (overlay) overlay(ctx, w, h);
  }

  return { draw };
}
