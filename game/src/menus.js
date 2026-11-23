// Menus drawn over the live city: the title screen with its sunset logo, the pause menu, the
// full map of Solmar Bay with its legend, and the controls card. Each returns the screen
// rectangles of its items so the mouse can pick them.
import { FONT, outlined } from './hud.js';
import { MISSIONS } from './story.js';
import { TOKEN_COUNT } from './services.js';
import { objectivePoint } from './missions.js';

export const CONTROLS = [
  ['W A S D', 'Walk / drive'],
  ['Mouse', 'Aim  ·  Left click: fire'],
  ['Shift', 'Sprint'],
  ['F / Enter', 'Steal car, get in / out'],
  ['Space', 'Handbrake (drift)'],
  ['Q / E / wheel', 'Switch weapon'],
  ['E', 'Use: save, shop, respray'],
  ['H', 'Horn'],
  ['M', 'City map'],
  ['R', 'Change radio station'],
  ['Esc / P', 'Pause'],
];

function menuList(ctx, items, selected, x, y, gap, size, align) {
  const rects = [];
  items.forEach((item, i) => {
    const yy = y + i * gap;
    const active = i === selected;
    if (active) {
      ctx.font = `bold ${size}px ${FONT}`;
      const tw = ctx.measureText(item).width;
      const bx = align === 'center' ? x - tw / 2 - 24 : x - 20;
      ctx.fillStyle = 'rgba(255,90,120,0.85)';
      ctx.beginPath(); ctx.roundRect(bx, yy - size * 0.95, tw + 48, size * 1.4, 8); ctx.fill();
    }
    outlined(ctx, item, x + (active && align !== 'center' ? 4 : 0), yy, active ? '#ffffff' : '#ffe9d6', size, align);
    rects.push({ x: x - 200, y: yy - size, w: 400, h: size * 1.4 });
  });
  return rects;
}

export function drawTitle(ctx, w, h, items, selected, time, saveInfo) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(40,10,60,0.55)');
  g.addColorStop(0.55, 'rgba(255,90,90,0.18)');
  g.addColorStop(1, 'rgba(20,0,40,0.7)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const cx = w * 0.3;
  const sunY = h * 0.34;
  const sun = ctx.createLinearGradient(0, sunY - 110, 0, sunY + 110);
  sun.addColorStop(0, '#ffe36e');
  sun.addColorStop(0.5, '#ff8a3d');
  sun.addColorStop(1, '#ff3d7f');
  ctx.fillStyle = sun;
  ctx.beginPath(); ctx.arc(cx, sunY, 110, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(40,10,60,0.9)';
  for (let k = 0; k < 6; k += 1) ctx.fillRect(cx - 120, sunY + 20 + k * 16, 240, 3 + k * 1.2);
  ctx.save();
  ctx.translate(cx, sunY + 30);
  ctx.transform(1, 0, -0.18, 1, 0, 0);
  outlined(ctx, 'SOLMAR BAY', 0, 0, '#ffffff', 96, 'center', '900 italic');
  const sub = ctx.createLinearGradient(-200, 0, 200, 0);
  sub.addColorStop(0, '#2de2e6');
  sub.addColorStop(1, '#ff5ab4');
  outlined(ctx, 'H E A T W A V E', 0, 62, sub, 40, 'center', '900 italic');
  ctx.restore();
  outlined(ctx, 'An open-world crime story on the Solmar coast', cx, sunY + 140, '#ffe9d6', 18, 'center', 'italic');
  const rects = menuList(ctx, items, selected, w * 0.72, h * 0.42, 58, 32, 'center');
  if (saveInfo) outlined(ctx, saveInfo, w * 0.72, h * 0.42 + items.length * 58 + 10, '#ffd23f', 15, 'center', 'normal');
  outlined(ctx, 'W/S or mouse to choose  ·  Enter or click to confirm', w / 2, h - 30, 'rgba(255,255,255,0.8)', 15, 'center', 'normal');
  const pulse = 0.5 + Math.sin(time * 3) * 0.5;
  ctx.fillStyle = `rgba(255,210,63,${0.4 + pulse * 0.4})`;
  ctx.fillRect(w * 0.72 - 120, h * 0.42 - 70, 240, 3);
  return rects;
}

export function drawPause(ctx, world, w, h, items, selected) {
  ctx.fillStyle = 'rgba(10,8,25,0.72)';
  ctx.fillRect(0, 0, w, h);
  outlined(ctx, 'PAUSED', 80, 120, '#ffd23f', 64, 'left', '900 italic');
  const rects = menuList(ctx, items, selected, 100, 220, 56, 30, 'left');
  const s = world.stats;
  const lines = [
    `Story: ${Math.min(world.story.next, MISSIONS.length)}/${MISSIONS.length} missions`,
    `Courier runs: ${world.story.courierDone}`,
    `Sun Tokens: ${world.tokens.size}/${TOKEN_COUNT}`,
    `Cars stolen: ${s.carsStolen}`,
    `Takedowns: ${s.kills}`,
    `Wasted: ${s.deaths}   Busted: ${s.arrests}`,
  ];
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.roundRect(w - 440, 160, 380, 300, 12); ctx.fill();
  outlined(ctx, 'PROGRESS', w - 410, 200, '#ff5ab4', 22, 'left');
  lines.forEach((line, i) => outlined(ctx, line, w - 410, 240 + i * 34, '#ffffff', 19, 'left', 'normal'));
  return rects;
}

export function drawControls(ctx, w, h) {
  ctx.fillStyle = 'rgba(10,8,25,0.85)';
  ctx.fillRect(0, 0, w, h);
  outlined(ctx, 'CONTROLS', w / 2, 90, '#ffd23f', 48, 'center', '900 italic');
  CONTROLS.forEach(([key, what], i) => {
    const y = 150 + i * 40;
    outlined(ctx, key, w / 2 - 20, y, '#2de2e6', 22, 'right');
    outlined(ctx, what, w / 2 + 20, y, '#ffffff', 22, 'left', 'normal');
  });
  outlined(ctx, 'Esc or click to go back', w / 2, h - 40, 'rgba(255,255,255,0.75)', 16, 'center', 'normal');
}

/** The full city map with the player, the objective and every service. */
export function drawCityMap(ctx, world, w, h, mapCanvas) {
  ctx.fillStyle = 'rgba(8,12,22,0.92)';
  ctx.fillRect(0, 0, w, h);
  const scale = Math.min((w - 340) / mapCanvas.width, (h - 80) / mapCanvas.height);
  const mw = mapCanvas.width * scale;
  const mh = mapCanvas.height * scale;
  const x0 = 40;
  const y0 = (h - mh) / 2;
  ctx.drawImage(mapCanvas, x0, y0, mw, mh);
  const k = scale * 0.1;
  const places = world.city.places;
  const legend = [];
  for (const key of ['safehouse', 'garage', 'club', 'respray', 'arms', 'hospital', 'police', 'market']) {
    const pl = places[key];
    const x = x0 + pl.x * k;
    const y = y0 + pl.y * k;
    ctx.fillStyle = '#10151f'; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = key === 'market' ? '#57c7ff' : pl.color;
    outlined(ctx, key === 'market' ? 'C' : key === 'club' ? 'D' : key === 'garage' ? 'M' : pl.icon, x, y + 5, ctx.fillStyle, 14, 'center');
    legend.push([key === 'market' ? 'C' : key === 'club' ? 'D' : key === 'garage' ? 'M' : pl.icon, key === 'market' ? 'Mercado Norte - courier jobs' : key === 'club' ? 'Club Marea - Dex Okafor' : key === 'garage' ? "Vega's Garage - Marisol" : pl.name, key === 'market' ? '#57c7ff' : pl.color]);
  }
  const target = objectivePoint(world);
  if (target) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(x0 + target.x * k, y0 + target.y * k, 8 + Math.sin(world.time * 6) * 2, 0, Math.PI * 2); ctx.fill();
  }
  const f = world.focus;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x0 + f.x * k, y0 + f.y * k, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#0b1220'; ctx.lineWidth = 2; ctx.stroke();
  const lx = x0 + mw + 30;
  outlined(ctx, 'SOLMAR BAY', lx, 80, '#ffd23f', 30, 'left', '900 italic');
  legend.forEach(([icon, name, color], i) => {
    outlined(ctx, icon, lx + 10, 130 + i * 34, color, 18, 'center');
    outlined(ctx, name, lx + 30, 130 + i * 34, '#ffffff', 15, 'left', 'normal');
  });
  outlined(ctx, 'You', lx + 30, 130 + legend.length * 34, '#ffffff', 15, 'left', 'normal');
  outlined(ctx, 'Objective', lx + 30, 164 + legend.length * 34, '#ffd23f', 15, 'left', 'normal');
  outlined(ctx, 'M or Esc to close', lx, h - 40, 'rgba(255,255,255,0.7)', 14, 'left', 'normal');
}
