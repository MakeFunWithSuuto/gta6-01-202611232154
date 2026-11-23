// All sound is synthesised with Web Audio, no files: gunfire, punches, crashes, explosions, the
// horn, pickups and mission jingles, the player's engine, police sirens that rise as cruisers
// close in, and two in-car radio stations playing their own generated music.

const STATIONS = [
  { name: 'Neon Tide FM', bpm: 104, root: 45, chords: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5]], style: 'synth' },
  { name: 'Coral 98.4', bpm: 96, root: 50, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]], style: 'dembow' },
  { name: 'Radio off', bpm: 0 },
];

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export function createAudio() {
  let ac = null;
  let master = null;
  let sfx = null;
  let music = null;
  let noiseBuf = null;
  let engine = null;
  let siren = null;
  let station = 0;
  let nextBeat = 0;
  let beat = 0;
  let stationLabel = { text: '', t: 0 };

  function start() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new AudioContext();
    master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
    sfx = ac.createGain(); sfx.gain.value = 0.8; sfx.connect(master);
    music = ac.createGain(); music.gain.value = 0; music.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    engine = makeEngine();
    siren = makeSiren();
  }

  function makeEngine() {
    const osc = ac.createOscillator(); osc.type = 'sawtooth';
    const osc2 = ac.createOscillator(); osc2.type = 'square';
    const filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 500;
    const gain = ac.createGain(); gain.gain.value = 0;
    osc.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(sfx);
    osc.start(); osc2.start();
    return { osc, osc2, filter, gain };
  }

  function makeSiren() {
    const osc = ac.createOscillator(); osc.type = 'triangle';
    const gain = ac.createGain(); gain.gain.value = 0;
    osc.connect(gain); gain.connect(sfx); osc.start();
    return { osc, gain };
  }

  function noise(time, dur, freq, q, vol, type = 'bandpass', dest = sfx) {
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(time, Math.random() * 0.5); src.stop(time + dur + 0.05);
    return f;
  }

  function tone(time, freq, dur, vol, type = 'square', dest = sfx, endFreq = null) {
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, time);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, time + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g); g.connect(dest);
    o.start(time); o.stop(time + dur + 0.05);
  }

  function jingle(notes, step, type = 'triangle', vol = 0.18) {
    const t = ac.currentTime;
    notes.forEach((n, i) => tone(t + i * step, midi(n), step * 1.8, vol, type));
  }

  function play(event, near) {
    const t = ac.currentTime;
    const v = near;
    switch (event.type) {
      case 'shot': noise(t, 0.16, 1400, 0.8, 0.55 * v); tone(t, 140, 0.12, 0.35 * v, 'sine', sfx, 50); break;
      case 'shotgun': noise(t, 0.35, 900, 0.6, 0.8 * v); tone(t, 110, 0.25, 0.5 * v, 'sine', sfx, 40); break;
      case 'punch': tone(t, 120, 0.1, 0.35, 'sine', sfx, 60); noise(t, 0.06, 600, 1, 0.2); break;
      case 'boom': noise(t, 1.4, 300, 0.4, 1.0 * v, 'lowpass'); tone(t, 70, 0.9, 0.7 * v, 'sine', sfx, 30); break;
      case 'crash': noise(t, 0.3, 700, 0.7, Math.min(0.7, event.power / 500) * v); tone(t, 210, 0.2, 0.08 * v, 'square', sfx, 150); break;
      case 'thud': tone(t, 90, 0.15, 0.4 * v, 'sine', sfx, 50); break;
      case 'horn': tone(t, 392, 0.45, 0.12, 'square'); tone(t, 494, 0.45, 0.1, 'square'); break;
      case 'door': noise(t, 0.08, 2000, 2, 0.25); tone(t + 0.05, 180, 0.06, 0.15, 'square'); break;
      case 'jack': noise(t, 0.2, 1200, 1, 0.3); break;
      case 'cash': jingle([84, 88, 91], 0.06, 'square', 0.08); break;
      case 'token': jingle([79, 83, 86, 91, 95], 0.07, 'triangle', 0.18); break;
      case 'buy': jingle([72, 79], 0.08, 'square', 0.08); break;
      case 'pickup': jingle([76, 81], 0.08, 'triangle', 0.15); break;
      case 'checkpoint': jingle([81, 88], 0.09, 'triangle', 0.16); break;
      case 'missionStart': jingle([62, 69, 74, 69], 0.14, 'sawtooth', 0.08); break;
      case 'pass': jingle([67, 71, 74, 79, 83, 86], 0.11, 'square', 0.1); break;
      case 'fail': jingle([67, 63, 60, 55], 0.18, 'sawtooth', 0.1); break;
      case 'spray': noise(t, 1.2, 4000, 0.5, 0.25, 'highpass'); jingle([72, 76, 79], 0.15, 'triangle', 0.12); break;
      case 'wanted': tone(t, 880, 0.12, 0.12, 'square'); tone(t + 0.15, 660, 0.15, 0.12, 'square'); break;
      case 'starLost': tone(t, 523, 0.2, 0.08, 'triangle'); break;
      case 'hurt': tone(t, 200, 0.12, 0.1, 'sawtooth', sfx, 120); break;
      case 'wasted': case 'busted': tone(t, 110, 2.2, 0.25, 'sawtooth', sfx, 55); noise(t, 1.5, 200, 0.5, 0.4, 'lowpass'); break;
      case 'heli': noise(t, 1.5, 120, 2, 0.3, 'lowpass'); break;
      default: break;
    }
  }

  function scheduleMusic(inCar) {
    const st = STATIONS[station];
    music.gain.setTargetAtTime(inCar && st.bpm ? 0.32 : 0, ac.currentTime, 0.3);
    if (!st.bpm) return;
    const sixteenth = 60 / st.bpm / 4;
    if (nextBeat < ac.currentTime) nextBeat = ac.currentTime + 0.05;
    while (nextBeat < ac.currentTime + 0.15) {
      const step = beat % 16;
      const bar = Math.floor(beat / 16) % 4;
      const chord = st.chords[bar];
      const t = nextBeat;
      if (st.style === 'synth') {
        if (step % 4 === 0) tone(t, 90, 0.25, 0.7, 'sine', music, 40);
        if (step === 4 || step === 12) noise(t, 0.18, 1800, 0.7, 0.35, 'bandpass', music);
        if (step % 2 === 1) noise(t, 0.04, 8000, 1, 0.12, 'highpass', music);
        tone(t, midi(st.root - 12 + chord[0] + (step % 4 === 2 ? 12 : 0)), sixteenth * 0.9, 0.22, 'sawtooth', music);
        if (step % 8 === 0) for (const n of chord) tone(t, midi(st.root + 12 + n), sixteenth * 7, 0.05, 'square', music);
        if (step % 2 === 0) tone(t, midi(st.root + 24 + chord[(step / 2) % 3]), sixteenth * 1.5, 0.05, 'triangle', music);
      } else {
        if (step === 0 || step === 8) tone(t, 80, 0.25, 0.8, 'sine', music, 40);
        if ([3, 6, 11, 14].includes(step)) noise(t, 0.12, 2200, 0.8, 0.35, 'bandpass', music);
        if (step % 2 === 0) noise(t, 0.03, 9000, 1, 0.1, 'highpass', music);
        if ([0, 3, 8, 11].includes(step)) tone(t, midi(st.root - 12 + chord[0]), sixteenth * 2.5, 0.3, 'triangle', music);
        if ([2, 6, 10, 13].includes(step)) for (const n of chord) tone(t, midi(st.root + 12 + n), sixteenth * 0.8, 0.05, 'triangle', music);
        if (step % 4 === 2) tone(t, midi(st.root + 24 + chord[(beat >> 2) % 3]), sixteenth * 2, 0.04, 'square', music);
      }
      nextBeat += sixteenth;
      beat += 1;
    }
  }

  /** Per-frame: play this frame's events, run engine, siren and radio. */
  function update(world, dt) {
    stationLabel.t -= dt;
    if (!ac) return;
    const f = world.focus;
    for (const event of world.events) {
      const d = event.x === undefined ? 0 : Math.hypot(event.x - f.x, event.y - f.y);
      const near = Math.max(0.08, 1 - d / 1400);
      play(event, event.fromPlayer ? 1 : near);
    }
    const car = world.player.car;
    const t = ac.currentTime;
    if (car && !world.player.dead) {
      const speed = Math.abs(car.speed);
      const rev = 45 + speed * 0.22 + Math.abs(car.throttle) * 18;
      engine.osc.frequency.setTargetAtTime(rev, t, 0.05);
      engine.osc2.frequency.setTargetAtTime(rev * 0.5, t, 0.05);
      engine.filter.frequency.setTargetAtTime(300 + speed * 2, t, 0.05);
      engine.gain.gain.setTargetAtTime(0.06 + Math.abs(car.throttle) * 0.05, t, 0.08);
    } else engine.gain.gain.setTargetAtTime(0, t, 0.1);
    let nearest = Infinity;
    for (const c of world.cars) if (c.siren && !c.wrecked) nearest = Math.min(nearest, Math.hypot(c.x - f.x, c.y - f.y));
    const sirenVol = nearest < 1100 ? (1 - nearest / 1100) * 0.08 : 0;
    siren.gain.gain.setTargetAtTime(sirenVol, t, 0.1);
    siren.osc.frequency.setTargetAtTime(700 + Math.sin(world.time * 5) * 260, t, 0.02);
    scheduleMusic(Boolean(car) && !world.player.dead);
  }

  return {
    start,
    update,
    nextStation() {
      station = (station + 1) % STATIONS.length;
      stationLabel = { text: STATIONS[station].name, t: 2.5 };
    },
    stationLabel: () => (stationLabel.t > 0 ? stationLabel.text : null),
    setVolume(v) { if (master) master.gain.value = v; },
  };
}
