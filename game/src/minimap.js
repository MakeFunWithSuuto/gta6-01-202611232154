// The round radar in the bottom-left corner: a pre-drawn map of Solmar Bay scrolled under the
// player, with blips for police, the helicopter, services and the objective (pinned to the rim
// when it is off the radar), framed by the health and armor arcs.
import { TILE, T_BUILDING, T_DOCK, T_GRASS, T_PLAZA, T_ROAD, T_SAND, T_WATER } from './config.js';
import { objectivePoint } from './missions.js';

const SCALE = 0.1;
let mapCanvas = null;

const COLORS = {
  [T_ROAD]: '#4a4f5c', [T_BUILDING]: '#a6a091', [T_GRASS]: '#5f9f4c', [T_SAND]: '#e6cf92',
  [T_WATER]: '#2f8fb0', [T_PLAZA]: '#c9bb9f', [T_DOCK]: '#7d6248',
};

function bakeMap(city) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(city.width * SCALE);
  c.height = Math.ceil(city.height * SCALE);
  const g = c.getContext('2d');
  const s = TILE * SCALE;
  g.fillStyle = '#c3bcae';
  g.fillRect(0, 0, c.width, c.height);
  const rows = city.height / TILE;
  const cols = city.width / TILE;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const color = COLORS[city.tileAt(x, y)];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x * s, y * s, s + 0.4, s + 0.4);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (const b of city.buildings) if (b.height > 150) g.fillRect(b.x * SCALE, b.y * SCALE, b.w * SCALE, b.h * SCALE);
  return c;
}

export function cityMapImage(city) {
  if (!mapCanvas) mapCanvas = bakeMap(city);
  return mapCanvas;
}

/** Radar centred at (cx, cy) on screen with radius r (screen pixels). */
export function drawMinimap(ctx, world, cx, cy, r, yaw = -Math.PI / 2) {
  if (!mapCanvas) mapCanvas = bakeMap(world.city);
  const f = world.focus;
  const zoom = world.player.car ? 1.15 : 1.6;
  const k = SCALE * zoom;
  const turn = -Math.PI / 2 - yaw;
  const cs = Math.cos(turn);
  const sn = Math.sin(turn);
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,22,0.75)';
  ctx.beginPath(); ctx.arc(cx, cy, r + 9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(turn);
  ctx.drawImage(mapCanvas, -f.x * k, -f.y * k, mapCanvas.width * zoom, mapCanvas.height * zoom);
  ctx.restore();
  const toMap = (x, y) => {
    const dx = (x - f.x) * k;
    const dy = (y - f.y) * k;
    return { x: cx + dx * cs - dy * sn, y: cy + dx * sn + dy * cs };
  };

  const places = world.city.places;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const key of ['safehouse', 'respray', 'arms', 'hospital', 'police']) {
    const pl = places[key];
    const m = toMap(pl.x, pl.y);
    ctx.fillStyle = '#10151f'; ctx.beginPath(); ctx.arc(m.x, m.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pl.color; ctx.fillText(pl.icon, m.x, m.y + 0.5);
  }
  const blink = Math.sin(world.time * 10) > 0;
  for (const car of world.cars) {
    if (car.driver !== 'cop' || car.wrecked) continue;
    const m = toMap(car.x, car.y);
    ctx.fillStyle = blink ? '#ff3b3b' : '#3b7bff';
    ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, Math.PI * 2); ctx.fill();
  }
  for (const ped of world.peds) {
    if (ped.dead || !ped.hostile) continue;
    const m = toMap(ped.x, ped.y);
    ctx.fillStyle = ped.kind === 'cop' ? (blink ? '#ff8080' : '#80a8ff') : '#ff4d4d';
    ctx.fillRect(m.x - 2, m.y - 2, 4, 4);
  }
  if (world.heli) {
    const m = toMap(world.heli.x, world.heli.y);
    ctx.strokeStyle = blink ? '#ff3b3b' : '#3b7bff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(m.x, m.y, 6, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  const target = objectivePoint(world);
  if (target) {
    let m = toMap(target.x, target.y);
    const dx = m.x - cx;
    const dy = m.y - cy;
    const d = Math.hypot(dx, dy);
    if (d > r - 6) m = { x: cx + (dx / d) * (r - 4), y: cy + (dy / d) * (r - 4) };
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#3a2a00';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(m.x, m.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  const heading = world.player.car ? world.player.car.angle : world.player.angle;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(heading + turn);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0b1220';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -7); ctx.lineTo(-3, 0); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();

  const p = world.player;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.arc(cx, cy, r + 5, Math.PI * 0.55, Math.PI * 1.45); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r + 5, Math.PI * 1.55, Math.PI * 2.45); ctx.stroke();
  ctx.strokeStyle = p.health > 30 ? '#5ee07a' : '#ff4d4d';
  ctx.beginPath(); ctx.arc(cx, cy, r + 5, Math.PI * 1.45 - Math.PI * 0.9 * Math.max(0, p.health) / 100, Math.PI * 1.45); ctx.stroke();
  ctx.strokeStyle = '#4da3ff';
  if (p.armor > 0) { ctx.beginPath(); ctx.arc(cx, cy, r + 5, Math.PI * 1.55, Math.PI * 1.55 + Math.PI * 0.9 * p.armor / 100); ctx.stroke(); }
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('N', cx + Math.cos(turn - Math.PI / 2) * (r - 10), cy + Math.sin(turn - Math.PI / 2) * (r - 10));
}
