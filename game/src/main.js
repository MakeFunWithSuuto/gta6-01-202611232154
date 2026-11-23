// Boot and the main loop. The game moves between screens: the title (over a drifting camera on
// the live city), play, pause, the city map and the controls card. The world advances in fixed
// 1/60 s steps; sound, saving and the radio hang off each frame.
//
// ?shot=<name>&seed=N stages a scripted scene for a screenshot instead (see shots.js) and sets
// window.__shotReady once it is painted.
import { STEP } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { createInput } from './input.js';
import { createRenderer3d } from './render3d.js';
import { createCamera3d, groundAt, placeCamera3d, snapCamera3d, updateCamera3d } from './camera3d.js';
import { createAudio } from './audio.js';
import { applySave, hasSave, readSave, writeSave } from './save.js';
import { drawCityMap, drawControls, drawPause, drawTitle } from './menus.js';
import { cityMapImage } from './minimap.js';
import { outlined } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer3d(canvas, document.getElementById('hud'));

function hitRect(rects, x, y) {
  return rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

function runShot(name, seed) {
  const scene = stageShot(name, seed);
  let painted = 0;
  function paint() {
    renderer.draw(scene.world, scene.cam, { hud: scene.hud, overlay: scene.overlay });
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  const cam = createCamera3d();
  let world = createWorld(Math.floor(Math.random() * 1e9));
  world.clock = 18.2;
  let screen = 'title';
  let selected = 0;
  let rects = [];
  let accumulator = 0;
  let last = performance.now();
  let titleTime = 0;

  const titleItems = () => (hasSave() ? ['Continue', 'New Game', 'Controls'] : ['New Game', 'Controls']);
  const pauseItems = ['Resume', 'City Map', 'Controls', 'Quit to Title'];

  function announce(text) { status.textContent = text; }

  function newGame(load) {
    world = createWorld(Math.floor(Math.random() * 1e9));
    if (load) { const data = readSave(); if (data) applySave(world, data); }
    world.focus = world.player;
    cam.yaw = -Math.PI / 2;
    snapCamera3d(cam, world);
    screen = 'play';
    if (!load) {
      world.subtitle('rae', 'Solmar Bay. Six years, and it still smells like sunscreen and gasoline.');
      world.subtitle('rae', 'Marisol runs the garage on the west side now. Time to say hello.');
    }
    world.banner = { title: load ? 'Welcome back' : 'Solmar Bay', sub: load ? 'Progress loaded at the safehouse' : 'Follow the yellow marker to meet Marisol', t: 4 };
    announce('Playing.');
  }

  function choose(items, index) {
    const item = items[index];
    audio.start();
    if (item === 'Continue') newGame(true);
    else if (item === 'New Game') newGame(false);
    else if (item === 'Controls') { screen = screen === 'pause' ? 'pauseControls' : 'controls'; }
    else if (item === 'Resume') screen = 'play';
    else if (item === 'City Map') screen = 'map';
    else if (item === 'Quit to Title') { screen = 'title'; selected = 0; world.clock = 18.2; }
  }

  function menuInput(items) {
    if (input.wasPressed('KeyW') || input.wasPressed('ArrowUp')) selected = (selected + items.length - 1) % items.length;
    if (input.wasPressed('KeyS') || input.wasPressed('ArrowDown')) selected = (selected + 1) % items.length;
    const hover = hitRect(rects, input.mouse.x, input.mouse.y);
    if (hover >= 0 && input.mouse.clicked) { selected = hover; choose(items, hover); return; }
    if (input.wasPressed('Enter') || input.wasPressed('Space')) choose(items, selected);
  }

  function handleScreens() {
    const back = input.wasPressed('Escape') || input.wasPressed('KeyP');
    if (screen === 'title') menuInput(titleItems());
    else if (screen === 'controls' || screen === 'pauseControls') {
      if (back || input.mouse.clicked || input.wasPressed('Enter')) screen = screen === 'controls' ? 'title' : 'pause';
    } else if (screen === 'map') {
      if (back || input.wasPressed('KeyM')) screen = 'play';
    } else if (screen === 'pause') {
      if (back) screen = 'play';
      else menuInput(pauseItems);
    } else if (screen === 'play') {
      if (back) { screen = 'pause'; selected = 0; announce('Paused.'); }
      else if (input.wasPressed('KeyM')) screen = 'map';
      else if (input.wasPressed('KeyR')) audio.nextStation();
      if (input.mouse.clicked) audio.start();
    }
  }

  function titleCamera(dt) {
    titleTime += dt;
    const route = world.city.places;
    const x = route.tower.x + Math.sin(titleTime * 0.05) * 900;
    const y = route.tower.y + 300 + Math.cos(titleTime * 0.04) * 600;
    placeCamera3d(cam, x, y, titleTime * 0.07, 700, 420, 200, 1.0);
    world.focus = { x, y };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleScreens();
    if (screen === 'play' || screen === 'title') {
      accumulator += dt;
      while (accumulator >= STEP) {
        const aim = groundAt(cam, input.mouse.x, input.mouse.y);
        world.viewYaw = cam.yaw;
        if (screen === 'title') { titleCamera(STEP); world.player.x = cam.x; world.player.y = cam.y; }
        stepWorld(world, screen === 'play' ? input : null, aim, STEP);
        if (screen === 'title') world.focus = { x: cam.x, y: cam.y };
        accumulator -= STEP;
      }
      if (screen === 'play') updateCamera3d(cam, world, dt);
    } else accumulator = 0;
    if (world.requestSave) { world.requestSave = false; writeSave(world); }
    audio.update(world, dt);
    world.events = [];

    const overlay = (ctx, w, h) => {
      if (screen === 'title') {
        const save = readSave();
        rects = drawTitle(ctx, w, h, titleItems(), selected, titleTime, save ? `Saved: ${save.next ?? 0}/6 missions · $${(save.money ?? 0).toLocaleString('en-US')}` : null);
      } else if (screen === 'pause') rects = drawPause(ctx, world, w, h, pauseItems, selected);
      else if (screen === 'map') drawCityMap(ctx, world, w, h, cityMapImage(world.city));
      else if (screen === 'controls' || screen === 'pauseControls') drawControls(ctx, w, h);
      const label = audio.stationLabel();
      if (label && screen === 'play') outlined(ctx, label, w / 2, 60, '#ff9ad5', 26, 'center', 'bold italic');
    };
    renderer.draw(world, cam, { hud: screen !== 'title', overlay });
    input.endFrame();
  }

  if (params.has('debug')) window.__debug = { get world() { return world; }, cam };
  document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'play') screen = 'pause'; });
  announce('Solmar Bay: Heatwave. Press Enter to start.');
  requestAnimationFrame(frame);
}

const shot = params.get('shot');
if (shot) runShot(shot, Number.parseInt(params.get('seed') ?? '1', 10) || 1);
else runGame();
