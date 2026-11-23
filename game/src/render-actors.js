// Paints everything that moves or can be picked up: cars (paint, glass, lights, police bars,
// damage), walkers and the player with their weapons, the police helicopter and its searchlight,
// pickups, mission markers, and the effects (skids, blood, smoke, fire, tracers, floating text).
import { lift, shade } from './render-city.js';
import { objectivePoint } from './missions.js';
import { MISSIONS } from './story.js';

export function drawDecals(ctx, world) {
  for (const s of world.skids) {
    ctx.strokeStyle = `rgba(20,20,22,${Math.min(0.45, s.life / 14 * 0.45)})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
  }
  for (const d of world.decals) {
    ctx.fillStyle = d.scorch ? `rgba(20,18,16,${Math.min(0.6, d.life / 60)})` : `rgba(130,10,14,${Math.min(0.75, d.life / 10)})`;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawCar(ctx, car, time) {
  const { len, wid, cabin } = car.spec;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const body = car.wrecked ? '#2b2a29' : car.hitTimer > 0 ? '#ffffff' : car.color;
  ctx.fillStyle = '#151515';
  for (const [x, y] of [[len * 0.3, -wid / 2], [len * 0.3, wid / 2], [-len * 0.3, -wid / 2], [-len * 0.3, wid / 2]]) ctx.fillRect(x - 6, y - 3, 12, 6);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.roundRect(-len / 2, -wid / 2, len, wid, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath(); ctx.roundRect(-len / 2 + 3, -wid / 2 + 2, len - 6, wid * 0.28, 4); ctx.fill();
  if (!car.wrecked) {
    const cabLen = len * cabin;
    const cabX = car.model === 'ramble' || car.model === 'vault' ? len * 0.1 : -cabLen * 0.45;
    ctx.fillStyle = '#1f2a36';
    ctx.beginPath(); ctx.roundRect(cabX, -wid / 2 + 3, cabLen, wid - 6, 4); ctx.fill();
    ctx.fillStyle = shade(car.color.startsWith('#') ? car.color : '#888888', -0.08);
    ctx.fillRect(cabX + cabLen * 0.32, -wid / 2 + 4, cabLen * 0.42, wid - 8);
    ctx.fillStyle = 'rgba(150,200,230,0.5)';
    ctx.fillRect(cabX + cabLen - 4, -wid / 2 + 4, 3, wid - 8);
    ctx.fillStyle = '#fff6c8';
    ctx.fillRect(len / 2 - 3, -wid / 2 + 2, 3, 5);
    ctx.fillRect(len / 2 - 3, wid / 2 - 7, 3, 5);
    ctx.fillStyle = car.braking ? '#ff3030' : '#a3161b';
    ctx.fillRect(-len / 2, -wid / 2 + 2, 3, 5);
    ctx.fillRect(-len / 2, wid / 2 - 7, 3, 5);
    if (car.spec.taxi) {
      ctx.fillStyle = '#222'; ctx.fillRect(-4, -5, 9, 10);
      ctx.fillStyle = '#fff'; ctx.fillRect(-3, -3, 7, 6);
    }
    if (car.spec.police) {
      ctx.fillStyle = '#18233a';
      ctx.fillRect(-len * 0.12, -wid / 2, len * 0.26, wid);
      const blink = car.siren && Math.sin(time * 18) > 0;
      ctx.fillStyle = car.siren ? (blink ? '#ff2b2b' : '#5a1010') : '#7a2020';
      ctx.fillRect(-3, -wid / 2 + 3, 6, wid / 2 - 3);
      ctx.fillStyle = car.siren ? (blink ? '#14205a' : '#2d7bff') : '#203a7a';
      ctx.fillRect(-3, 0, 6, wid / 2 - 3);
    }
    if (car.spec.armored) {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      ctx.strokeRect(-len / 2 + 4, -wid / 2 + 4, len * 0.5, wid - 8);
    }
  }
  ctx.restore();
  if (car.spec.police && car.siren && !car.wrecked) {
    const blink = Math.sin(time * 18) > 0;
    const g = ctx.createRadialGradient(car.x, car.y, 0, car.x, car.y, 70);
    g.addColorStop(0, blink ? 'rgba(255,40,40,0.35)' : 'rgba(40,110,255,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(car.x, car.y, 70, 0, Math.PI * 2); ctx.fill();
  }
}

function drawWalker(ctx, x, y, angle, look, phase, gun, flash) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const step = Math.sin(phase) * 5;
  ctx.fillStyle = '#2a2a33';
  ctx.beginPath(); ctx.ellipse(step, -5, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-step, 5, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = look.shirt;
  ctx.beginPath(); ctx.ellipse(0, 0, 7, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = look.skin;
  if (gun) {
    ctx.fillRect(4, -2, 12, 4);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(12, -2, gun === 'shotgun' ? 14 : gun === 'smg' ? 11 : 8, 3);
    if (flash) {
      ctx.fillStyle = '#ffe9a0';
      ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(34, -5); ctx.lineTo(32, 0); ctx.lineTo(34, 5); ctx.closePath(); ctx.fill();
    }
  } else {
    ctx.beginPath(); ctx.arc(3, -10, 3, 0, Math.PI * 2); ctx.arc(3, 10, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = look.skin;
  ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = look.hair;
  ctx.beginPath(); ctx.arc(-1.5, 0, 5, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
  if (look.cap) { ctx.fillStyle = look.cap; ctx.beginPath(); ctx.arc(-1, 0, 5.2, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(2, -3, 5, 6); }
  ctx.restore();
}

export function drawPeds(ctx, world, alive) {
  for (const ped of world.peds) {
    if (ped.dead === alive) continue;
    if (ped.dead) {
      ctx.save();
      ctx.translate(ped.x, ped.y); ctx.rotate(ped.angle + 1.2);
      ctx.fillStyle = ped.shirt; ctx.beginPath(); ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ped.skin; ctx.beginPath(); ctx.arc(13, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    const look = { shirt: ped.shirt, skin: ped.skin, hair: ped.hair, cap: ped.kind === 'cop' ? '#13254a' : null };
    drawWalker(ctx, ped.x, ped.y, ped.angle, look, ped.walkPhase, ped.hostile ? ped.weapon : null, ped.fireCd > (ped.weapon === 'smg' ? 0.12 : 0.85));
    if (ped.tag === 'pike' || ped.tag === 'guard' || ped.tag === 'crew') {
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath(); ctx.moveTo(ped.x, ped.y - 18); ctx.lineTo(ped.x - 6, ped.y - 28); ctx.lineTo(ped.x + 6, ped.y - 28); ctx.closePath(); ctx.fill();
    }
  }
}

const RAE = { shirt: '#f2f2f2', skin: '#c98e63', hair: '#1c1410', cap: null };

export function drawPlayer(ctx, world) {
  const p = world.player;
  if (p.car) return;
  if (p.dead) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(1.1);
    ctx.fillStyle = RAE.shirt; ctx.beginPath(); ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.strokeStyle = 'rgba(127,227,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.stroke();
  drawWalker(ctx, p.x, p.y, p.angle, RAE, p.walkPhase, p.weapon === 'fists' ? null : p.weapon, p.muzzle > 0);
  ctx.fillStyle = '#e3b04b';
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.fillRect(-6, -7, 4, 14); ctx.restore();
}

export function drawHelicopter(ctx, world, cam) {
  const heli = world.heli;
  if (!heli) return;
  const pos = lift(cam, heli.x, heli.y, 380);
  const g = ctx.createRadialGradient(heli.x, heli.y, 0, heli.x, heli.y, 110);
  g.addColorStop(0, 'rgba(255,255,230,0.42)');
  g.addColorStop(1, 'rgba(255,255,230,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(heli.x, heli.y, 110, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(heli.x + 60, heli.y + 30, 34, 16, heli.angle, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(heli.angle);
  ctx.scale(1.5, 1.5);
  ctx.fillStyle = '#1d2a44';
  ctx.fillRect(-46, -3, 34, 6);
  ctx.fillRect(-50, -10, 6, 20);
  ctx.fillStyle = '#f2f4f7';
  ctx.beginPath(); ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d2a44';
  ctx.beginPath(); ctx.ellipse(-4, 0, 14, 13, 0, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
  ctx.fillStyle = '#7fc3e6';
  ctx.beginPath(); ctx.ellipse(12, 0, 8, 9, 0, -Math.PI / 2, Math.PI / 2); ctx.fill();
  ctx.fillStyle = Math.sin(world.time * 14) > 0 ? '#ff3030' : '#3070ff';
  ctx.fillRect(-2, -2, 4, 4);
  ctx.strokeStyle = 'rgba(30,30,30,0.55)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 4; k += 1) {
    const a = heli.rotor + (k * Math.PI) / 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 40, Math.sin(a) * 40); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(40,40,40,0.12)';
  ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawPickups(ctx, world) {
  for (const item of world.pickups) {
    if (item.respawn > 0) continue;
    const y = item.y + Math.sin(item.bob) * 3;
    if (item.type === 'cash') {
      ctx.fillStyle = '#2f9e44'; ctx.fillRect(item.x - 8, y - 5, 16, 10);
      ctx.fillStyle = '#b6f5c0'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', item.x, y);
    } else if (item.type === 'token') {
      const r = 10 + Math.sin(item.bob * 2) * 1.5;
      ctx.fillStyle = 'rgba(255,200,60,0.25)'; ctx.beginPath(); ctx.arc(item.x, y, r + 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.arc(item.x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff8a1f'; ctx.lineWidth = 2;
      for (let k = 0; k < 8; k += 1) {
        const a = item.bob + (k * Math.PI) / 4;
        ctx.beginPath(); ctx.moveTo(item.x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2)); ctx.lineTo(item.x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7)); ctx.stroke();
      }
    } else {
      ctx.fillStyle = item.type === 'health' ? '#ffffff' : '#3d6fd8';
      ctx.beginPath(); ctx.roundRect(item.x - 10, y - 10, 20, 20, 5); ctx.fill();
      ctx.fillStyle = item.type === 'health' ? '#e53935' : '#dfe8ff';
      if (item.type === 'health') { ctx.fillRect(item.x - 2.5, y - 7, 5, 14); ctx.fillRect(item.x - 7, y - 2.5, 14, 5); } else { ctx.beginPath(); ctx.moveTo(item.x - 6, y - 6); ctx.lineTo(item.x + 6, y - 6); ctx.lineTo(item.x + 5, y + 2); ctx.lineTo(item.x, y + 7); ctx.lineTo(item.x - 5, y + 2); ctx.closePath(); ctx.fill(); }
    }
  }
}

function drawRing(ctx, x, y, color, time, label) {
  const pulse = 1 + Math.sin(time * 4) * 0.08;
  ctx.fillStyle = color + '44';
  ctx.beginPath(); ctx.arc(x, y, 34 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(x, y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
  if (label) {
    ctx.fillStyle = color;
    ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 1);
  }
}

/** Ground rings for services and the objective, and a light column over the objective. */
export function drawMarkers(ctx, world, cam) {
  const places = world.city.places;
  for (const key of ['safehouse', 'respray', 'arms', 'hospital', 'police']) {
    const p = places[key];
    drawRing(ctx, p.x, p.y, p.color, world.time, p.icon);
  }
  if (world.story.next >= 1 && !world.story.active && !world.story.courier) drawRing(ctx, places.market.x, places.market.y, '#57c7ff', world.time, 'C');
  const target = objectivePoint(world);
  if (!target) return;
  const isPlace = Object.values(places).includes(target) || world.story.courier;
  if (isPlace) {
    const giver = !world.story.active && !world.story.courier && world.story.next < MISSIONS.length;
    drawRing(ctx, target.x, target.y, '#ffd23f', world.time, giver ? (MISSIONS[world.story.next].contact === 'dex' ? 'D' : 'M') : null);
  }
}

export function drawBeacon(ctx, world, cam) {
  const target = objectivePoint(world);
  if (!target) return;
  const top = lift(cam, target.x, target.y, 260);
  const g = ctx.createLinearGradient(target.x, target.y, top.x, top.y);
  g.addColorStop(0, 'rgba(255,210,63,0.55)');
  g.addColorStop(1, 'rgba(255,210,63,0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(target.x, target.y); ctx.lineTo(top.x, top.y); ctx.stroke();
  ctx.lineCap = 'butt';
  if (!Object.values(world.city.places).includes(target)) {
    const bob = Math.sin(world.time * 5) * 4;
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#3a2a00';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(target.x, target.y - 26 + bob); ctx.lineTo(target.x - 10, target.y - 42 + bob); ctx.lineTo(target.x + 10, target.y - 42 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

export function drawEffects(ctx, world) {
  for (const t of world.tracers) {
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t.x0, t.y0); ctx.lineTo(t.x1, t.y1); ctx.stroke();
  }
  for (const p of world.particles) {
    const a = Math.max(0, p.life / p.max);
    if (p.kind === 'smoke') { ctx.fillStyle = p.color; ctx.globalAlpha = a * 0.55; }
    else if (p.kind === 'fire') { ctx.fillStyle = a > 0.5 ? '#ffe08a' : p.color; ctx.globalAlpha = a; }
    else if (p.kind === 'flash') { ctx.fillStyle = p.color; ctx.globalAlpha = a * 0.6; }
    else { ctx.fillStyle = p.color; ctx.globalAlpha = a; }
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.kind === 'flash' ? (1.2 - a) : 1), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 16px sans-serif';
  for (const f of world.floaters) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = '#000';
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}
