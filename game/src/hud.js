// The in-game HUD over the city: wanted stars, money, clock, weapon and ammo, the objective panel
// and mission timer, district and vehicle names, speedometer, dialogue subtitles, banners,
// service prompts, the off-screen objective arrow, and the WASTED / BUSTED overlay.
import { drawMinimap } from './minimap.js';
import { objectivePoint, objectiveText } from './missions.js';
import { WEAPON_ORDER, WEAPONS } from './combat.js';
import { REP_LEVELS, repLevel, repProgress } from './progression.js';
import { CAST } from './story.js';
import { TOKEN_COUNT } from './services.js';
import { toScreen } from './camera3d.js';
import { WANTED_COOLDOWN } from './config.js';

export const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

export function outlined(ctx, text, x, y, fill, size, align = 'left', weight = 'bold') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.lineWidth = Math.max(3, size / 6);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function star(ctx, x, y, r, filled, color) {
  ctx.beginPath();
  for (let k = 0; k < 10; k += 1) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? color : 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = filled ? '#2a1a00' : 'rgba(255,255,255,0.35)';
  ctx.stroke();
}

const SLOT_LABEL = { fists: 'FIST', pistol: 'PSTL', smg: 'SMG', shotgun: 'SHTG' };

function drawTopRight(ctx, world, w) {
  const p = world.player;
  const right = w - 28;
  const h = Math.floor(world.clock);
  const m = Math.floor((world.clock % 1) * 60);
  outlined(ctx, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, right, 36, '#ffffff', 22, 'right');
  outlined(ctx, `$${Math.floor(p.money).toLocaleString('en-US')}`, right, 74, '#7dffa0', 34, 'right');
  const rep = world.stats.rep ?? 0;
  const level = repLevel(rep);
  outlined(ctx, `REP ${level} · ${REP_LEVELS[level].title.toUpperCase()}`, right - 96, 98, '#ff9ad5', 13, 'right');
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(right - 88, 89, 88, 7);
  ctx.fillStyle = '#ff5ab4'; ctx.fillRect(right - 88, 89, 88 * repProgress(rep), 7);

  const slotW = 50;
  WEAPON_ORDER.forEach((key, i) => {
    const x = right - (WEAPON_ORDER.length - i) * (slotW + 6) + 6;
    const owned = key === 'fists' || p.ammo[key] > 0;
    const active = p.weapon === key;
    ctx.fillStyle = active ? 'rgba(232,120,30,0.95)' : owned ? 'rgba(10,14,22,0.7)' : 'rgba(10,14,22,0.35)';
    ctx.beginPath(); ctx.roundRect(x, 108, slotW, 44, 7); ctx.fill();
    outlined(ctx, SLOT_LABEL[key], x + slotW / 2, 128, active ? '#ffffff' : owned ? '#ffe6a8' : '#666c78', 13, 'center');
    if (key !== 'fists') outlined(ctx, owned ? String(p.ammo[key]) : '-', x + slotW / 2, 146, active ? '#ffffff' : '#c9d2e0', 12, 'center', 'normal');
  });
  outlined(ctx, WEAPONS[p.weapon].name, right, 170, '#ffe6a8', 14, 'right', 'normal');

  const wanted = world.wanted;
  const flashing = wanted.flash > 0 && Math.sin(world.time * 16) > 0;
  const fade = wanted.stars > 0 && !wanted.seen && Math.sin(world.time * 6) > 0;
  for (let k = 0; k < 5; k += 1) {
    const filled = k < wanted.stars && !flashing;
    star(ctx, right - 16 - (4 - k) * 36, 196, 14, filled, fade && filled ? '#c9a24a' : '#ffd23f');
  }
}

/** Under the stars while wanted: the nearest units hunting the player, air support and sight. */
function drawPoliceResponse(ctx, world, w) {
  const wanted = world.wanted;
  if (wanted.stars === 0) return;
  const f = world.focus;
  const units = world.cars
    .filter((c) => c.driver === 'cop' && !c.wrecked)
    .map((c) => ({ label: `Unit ${c.unit ?? 7}`, kind: 'Cruiser', d: Math.hypot(c.x - f.x, c.y - f.y) }));
  for (const ped of world.peds) if (ped.kind === 'cop' && !ped.dead && ped.hostile) units.push({ label: `Officer ${ped.id % 90 + 10}`, kind: 'On foot', d: Math.hypot(ped.x - f.x, ped.y - f.y) });
  if (world.heli) units.push({ label: 'Air-1', kind: 'Helicopter', d: Math.hypot(world.heli.x - f.x, world.heli.y - f.y) });
  units.sort((a, b) => a.d - b.d);
  const shown = units.slice(0, 4);
  const x = w - 268;
  const y = 220;
  const height = 58 + shown.length * 20;
  ctx.fillStyle = 'rgba(10,14,22,0.72)';
  ctx.beginPath(); ctx.roundRect(x, y, 240, height, 8); ctx.fill();
  const blink = Math.sin(world.time * 10) > 0;
  ctx.fillStyle = blink ? '#ff3b3b' : '#3b7bff';
  ctx.fillRect(x, y, 240, 4);
  outlined(ctx, `SBPD RESPONSE · ${units.length} UNITS`, x + 12, y + 23, '#bcd4ff', 13);
  shown.forEach((u, i) => {
    const yy = y + 44 + i * 20;
    outlined(ctx, u.label, x + 12, yy, '#ffffff', 13, 'left', 'normal');
    outlined(ctx, u.kind, x + 110, yy, '#9fb3d8', 13, 'left', 'normal');
    outlined(ctx, `${Math.round(u.d / 8)} m`, x + 228, yy, u.d < 400 ? '#ff8a8a' : '#c9d2e0', 13, 'right', 'normal');
  });
  const evade = wanted.seen ? 'SPOTTED - break line of sight' : `EVADING · stars drop in ${Math.max(0, Math.ceil(WANTED_COOLDOWN[wanted.stars] - wanted.lost))}s`;
  outlined(ctx, evade, x + 12, y + height - 8, wanted.seen ? '#ff6b6b' : '#7dffa0', 13);
}

/** Health and armor bars beside the radar, with numbers. */
function drawVitals(ctx, world, h) {
  const p = world.player;
  const x = 250;
  const bar = (y, label, value, max, color) => {
    outlined(ctx, label, x, y - 4, '#ffffff', 12);
    outlined(ctx, String(Math.max(0, Math.round(value))), x + 170, y - 4, color, 12, 'right');
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, 170, 9);
    ctx.fillStyle = color; ctx.fillRect(x, y, 170 * Math.max(0, Math.min(1, value / max)), 9);
  };
  bar(h - 58, 'HEALTH', p.health, 100, p.health > 30 ? '#5ee07a' : '#ff4d4d');
  bar(h - 26, 'ARMOR', p.armor, 100, '#4da3ff');
}

function drawObjective(ctx, world) {
  const s = world.story;
  const text = objectiveText(world);
  const title = s.active ? `MISSION · ${s.active.mission.title.toUpperCase()}` : s.courier ? 'SIDE JOB · COURIER' : 'STORY · SOLMAR BAY: HEATWAVE';
  ctx.font = `bold 19px ${FONT}`;
  const width = Math.max(300, ctx.measureText(text).width + 40);
  ctx.fillStyle = 'rgba(10,14,22,0.66)';
  ctx.beginPath(); ctx.roundRect(24, 24, width, 74, 10); ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(24, 24, 5, 74);
  outlined(ctx, title, 42, 50, '#ffd23f', 14);
  outlined(ctx, text, 42, 80, '#ffffff', 19);
  let timer = null;
  if (s.active?.timer > 0) timer = s.active.timer;
  if (s.courier) timer = s.courier.timer;
  if (timer !== null) {
    const urgent = timer < 15 && Math.sin(world.time * 10) > 0;
    outlined(ctx, `${Math.floor(timer / 60)}:${String(Math.floor(timer % 60)).padStart(2, '0')}`, 42, 128, urgent ? '#ff5d5d' : '#ffffff', 30);
  }
  outlined(ctx, `Sun Tokens ${world.tokens.size}/${TOKEN_COUNT}`, 42, timer !== null ? 156 : 124, '#ffc93c', 14);
}

function drawObjectiveArrow(ctx, world, cam, w, h) {
  const target = objectivePoint(world);
  if (!target) return;
  const pos = toScreen(cam, target.x, target.y, 60);
  const meters = Math.round(Math.hypot(target.x - world.focus.x, target.y - world.focus.y) / 8);
  if (pos && pos.x > 40 && pos.x < w - 40 && pos.y > 60 && pos.y < h - 60) {
    outlined(ctx, `${meters} m`, pos.x, pos.y - 10, '#ffd23f', 15, 'center');
    return;
  }
  const rel = Math.atan2(target.y - cam.y, target.x - cam.x) - cam.yaw;
  const a = rel - Math.PI / 2;
  const ex = Math.min(w - 50, Math.max(50, w / 2 + Math.cos(a) * w));
  const ey = Math.min(h - 50, Math.max(50, h / 2 + Math.sin(a) * h));
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#2a1a00';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-10, -15); ctx.lineTo(-4, 0); ctx.lineTo(-10, 15); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  outlined(ctx, `${meters} m`, ex, ey + 34, '#ffd23f', 14, 'center');
}

/** Labels that float over the 3D world: service icons, floating money, nearby place names. */
function drawWorldLabels(ctx, world, cam) {
  const places = world.city.places;
  for (const key of ['safehouse', 'respray', 'arms', 'hospital', 'police']) {
    const pl = places[key];
    const d = Math.hypot(pl.x - cam.x, pl.y - cam.y);
    if (d > 1400) continue;
    const pos = toScreen(cam, pl.x, pl.y, 46);
    if (!pos) continue;
    ctx.fillStyle = 'rgba(10,14,22,0.75)';
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = pl.color; ctx.lineWidth = 2; ctx.stroke();
    outlined(ctx, pl.icon, pos.x, pos.y + 6, pl.color, 17, 'center');
    if (d < 500) outlined(ctx, pl.name, pos.x, pos.y - 22, '#ffffff', 13, 'center');
  }
  for (const f of world.floaters) {
    const pos = toScreen(cam, f.x, f.y, 40);
    if (!pos) continue;
    ctx.globalAlpha = Math.min(1, f.life);
    outlined(ctx, f.text, pos.x, pos.y - (1.6 - f.life) * 30, f.color, 18, 'center');
    ctx.globalAlpha = 1;
  }
}

function drawBottom(ctx, world, w, h) {
  const p = world.player;
  outlined(ctx, world.district, w - 28, h - 30, '#ffffff', 22, 'right', 'bold italic');
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    outlined(ctx, `${kmh}`, w - 28, h - 92, '#ffffff', 44, 'right');
    outlined(ctx, `km/h · ${p.car.spec.name}`, w - 28, h - 64, '#bfe9ff', 15, 'right');
    const dmg = Math.max(0, p.car.health) / (p.car.spec.armored ? 260 : 100);
    const state = p.car.burning > 0 ? 'ON FIRE' : dmg < 0.35 ? 'Engine smoking' : dmg < 0.7 ? 'Dented' : 'Clean';
    outlined(ctx, `Body ${Math.round(dmg * 100)}% · ${state}`, w - 28, h - 140, dmg > 0.35 ? '#9fe8ff' : '#ff8a5d', 14, 'right');
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(w - 168, h - 134, 140, 6);
    ctx.fillStyle = dmg > 0.35 ? '#9fe8ff' : '#ff8a5d'; ctx.fillRect(w - 168, h - 134, 140 * dmg, 6);
  }
  if (world.prompt) {
    ctx.font = `bold 18px ${FONT}`;
    const tw = ctx.measureText(world.prompt).width + 36;
    ctx.fillStyle = 'rgba(10,14,22,0.75)';
    ctx.beginPath(); ctx.roundRect(w / 2 - tw / 2, h - 190, tw, 40, 8); ctx.fill();
    outlined(ctx, world.prompt, w / 2, h - 163, '#ffffff', 18, 'center');
  }
  const sub = world.subtitles[0];
  if (sub) {
    const who = CAST[sub.who];
    ctx.font = `bold 20px ${FONT}`;
    const line = `${who.name}: ${sub.text}`;
    const tw = Math.min(w - 80, ctx.measureText(line).width + 40);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(w / 2 - tw / 2, h - 128, tw, 42, 8); ctx.fill();
    ctx.textAlign = 'left';
    const start = w / 2 - tw / 2 + 20;
    outlined(ctx, `${who.name}:`, start, h - 100, who.color, 20);
    const nameW = ctx.measureText(`${who.name}: `).width;
    outlined(ctx, sub.text, start + nameW, h - 100, '#ffffff', 20, 'left', 'normal');
  }
}

function drawBanner(ctx, world, w, h) {
  const b = world.banner;
  if (!b) return;
  const a = Math.min(1, b.t * 2);
  ctx.globalAlpha = a;
  const y = h * 0.3;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, y - 52, w, 92);
  outlined(ctx, b.title.toUpperCase(), w / 2, y, b.bad ? '#ff6b6b' : '#ffd23f', 46, 'center', 'bold italic');
  outlined(ctx, b.sub, w / 2, y + 30, '#ffffff', 20, 'center');
  ctx.globalAlpha = 1;
}

function drawOutcome(ctx, world, w, h) {
  if (!world.outcome) return;
  const t = 3.2 - world.respawn;
  ctx.fillStyle = `rgba(${world.outcome === 'wasted' ? '90,0,0' : '0,10,60'},${Math.min(0.55, t * 0.4)})`;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = Math.min(1, t * 1.5);
  outlined(ctx, world.outcome === 'wasted' ? 'WASTED' : 'BUSTED', w / 2, h / 2, world.outcome === 'wasted' ? '#ff4040' : '#6aa8ff', 92, 'center', 'bold italic');
  ctx.globalAlpha = 1;
}

export function drawHud(ctx, world, cam, w, h) {
  const p = world.player;
  if (p.hurtFlash > 0) {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8);
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(1, `rgba(200,0,0,${p.hurtFlash})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  drawWorldLabels(ctx, world, cam);
  drawObjectiveArrow(ctx, world, cam, w, h);
  drawMinimap(ctx, world, 130, h - 130, 100, cam.yaw);
  drawTopRight(ctx, world, w);
  drawPoliceResponse(ctx, world, w);
  drawVitals(ctx, world, h);
  drawObjective(ctx, world);
  drawBottom(ctx, world, w, h);
  drawBanner(ctx, world, w, h);
  drawOutcome(ctx, world, w, h);
}
