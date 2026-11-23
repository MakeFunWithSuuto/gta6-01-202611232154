// The WebGL2 frame: one shader lights every batch with the sun for the hour (warm afternoon,
// golden sunset, blue night with lit windows and glowing lamps), draws window bands on walls,
// moving light on the sea and distance haze; the static city is uploaded once, shadows are laid
// through the stencil so they never double up, then solid and see-through actors, and the 2D HUD
// canvas is drawn on top.
import { FLOATS, createBatch } from './mesh.js';
import { buildCityMesh } from './scene-city.js';
import { fillActors, fillShadows } from './scene-actors.js';
import { bakeGroundTexture } from './ground-texture.js';
import { resizeCamera3d } from './camera3d.js';
import { drawHud } from './hud.js';

const VERT = `#version 300 es
in vec3 a_pos; in vec3 a_normal; in vec4 a_color; in vec2 a_uv; in float a_mat;
uniform mat4 u_viewProj;
out vec3 v_world; out vec3 v_normal; out vec4 v_color; out vec2 v_uv; flat out int v_mat;
void main() {
  v_world = a_pos; v_normal = a_normal; v_color = a_color; v_uv = a_uv; v_mat = int(a_mat + 0.5);
  gl_Position = u_viewProj * vec4(a_pos, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3 v_world; in vec3 v_normal; in vec4 v_color; in vec2 v_uv; flat in int v_mat;
uniform sampler2D u_ground;
uniform vec3 u_sunDir; uniform vec3 u_sunColor; uniform vec3 u_ambient; uniform vec3 u_fog;
uniform vec3 u_eye; uniform float u_time; uniform float u_night; uniform float u_flat;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 base = v_color.rgb;
  float alpha = v_color.a;
  vec3 n = normalize(v_normal);
  float glow = 0.0;
  if (v_mat == 2) base = texture(u_ground, v_uv).rgb;
  if (v_mat == 1 && abs(n.y) < 0.5) {
    float along = abs(n.x) > 0.5 ? v_world.z : v_world.x;
    float floorF = fract(v_world.y / 16.0);
    float colF = fract(along / 18.0);
    vec2 cell = vec2(floor(v_world.y / 16.0), floor(along / 18.0));
    if (v_world.y > 8.0 && floorF > 0.28 && floorF < 0.85 && colF > 0.18 && colF < 0.82) {
      vec3 sky = mix(vec3(0.42, 0.62, 0.78), vec3(0.95, 0.85, 0.7), 0.3 + 0.4 * hash(cell));
      base = mix(base * 0.45, sky * 0.8, 0.65);
      if (u_night > 0.2 && hash(cell + 7.1) > 0.55) { base = vec3(1.0, 0.85, 0.5); glow = u_night; }
    }
  }
  if (v_mat == 3) {
    float w = sin(v_world.z * 0.045 + sin(v_world.x * 0.004) * 3.0 - u_time * 1.3) + 0.5 * sin(v_world.x * 0.013 + v_world.z * 0.02 + u_time * 0.7);
    base = base + vec3(0.1, 0.13, 0.13) * smoothstep(0.9, 1.45, w);
    float d = length(v_world.xz - u_eye.xz);
    base = mix(base, base * 1.15, smoothstep(300.0, 1500.0, d));
  }
  vec3 color;
  if (v_mat == 4) { color = base; glow = 1.0; }
  else {
    float diff = max(dot(n, normalize(u_sunDir)), 0.0);
    color = base * (u_ambient + u_sunColor * diff * (1.0 - u_flat * 0.6));
    color = mix(color, base, glow);
  }
  float dist = length(v_world - u_eye);
  float fog = 1.0 - exp(-pow(dist / 4200.0, 2.0));
  color = mix(color, u_fog, fog * (1.0 - glow * 0.5));
  outColor = vec4(color, alpha);
}`;

const SKY = [
  [0, [0.05, 0.07, 0.16]], [5, [0.07, 0.08, 0.2]], [6.5, [0.95, 0.62, 0.55]], [8, [0.62, 0.8, 0.95]],
  [16, [0.62, 0.82, 0.96]], [17.5, [0.95, 0.75, 0.55]], [19, [0.98, 0.5, 0.42]], [20.3, [0.42, 0.28, 0.48]],
  [21.5, [0.07, 0.08, 0.2]], [24, [0.05, 0.07, 0.16]],
];

function sample(table, clock) {
  for (let i = 0; i < table.length - 1; i += 1) {
    const [h0, c0] = table[i];
    const [h1, c1] = table[i + 1];
    if (clock >= h0 && clock <= h1) {
      const t = (clock - h0) / (h1 - h0 || 1);
      return c0.map((v, k) => v + (c1[k] - v) * t);
    }
  }
  return table[0][1];
}

/** Sun direction, colours and how dark it is for an hour of the day. */
export function lighting(clock) {
  const t = Math.min(1, Math.max(0, (clock - 6) / 14));
  const ang = Math.PI * t;
  const elev = Math.max(0.12, Math.sin(ang));
  const sunDir = [-Math.cos(ang), elev * 1.2, -0.45];
  const night = clock < 6 || clock > 20 ? Math.min(1, clock < 6 ? (6 - clock) / 1 : (clock - 20) / 1.2) : 0;
  const warm = clock > 16 ? Math.min(1, (clock - 16) / 3) : clock < 8 ? Math.min(1, (8 - clock) / 2) : 0;
  const sunColor = [1.0, 0.95 - warm * 0.3, 0.85 - warm * 0.5].map((v) => v * (1 - night * 0.85));
  const ambient = [0.5 + warm * 0.05, 0.5, 0.56 + night * 0.06].map((v, k) => v * (1 - night * 0.55) + (k === 2 ? night * 0.08 : 0));
  return { sunDir, sunColor, ambient, fog: sample(SKY, clock), night, shadow: { x: Math.cos(ang) * (0.25 + (1 - elev) * 1.1), y: 0.3 + (1 - elev) * 0.25 } };
}

export function createRenderer3d(canvas, hudCanvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, stencil: true, preserveDrawingBuffer: true });
  const hud = hudCanvas.getContext('2d');
  if (!gl) throw new Error('WebGL2 is not available');
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const loc = (name) => gl.getUniformLocation(program, name);
  const U = {
    viewProj: loc('u_viewProj'), sunDir: loc('u_sunDir'), sunColor: loc('u_sunColor'), ambient: loc('u_ambient'),
    fog: loc('u_fog'), eye: loc('u_eye'), time: loc('u_time'), night: loc('u_night'), flat: loc('u_flat'), ground: loc('u_ground'),
  };
  const ATTRS = [['a_pos', 3, 0], ['a_normal', 3, 3], ['a_color', 4, 6], ['a_uv', 2, 10], ['a_mat', 1, 12]];

  function makeBuffer() {
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [name, size, offset] of ATTRS) {
      const l = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, gl.FLOAT, false, FLOATS * 4, offset * 4);
    }
    gl.bindVertexArray(null);
    return { vao, buffer, count: 0 };
  }
  function upload(target, batch, usage) {
    gl.bindBuffer(gl.ARRAY_BUFFER, target.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, batch.data.subarray(0, batch.count * FLOATS), usage);
    target.count = batch.count;
  }
  function drawBuffer(target) {
    if (!target.count) return;
    gl.bindVertexArray(target.vao);
    gl.drawArrays(gl.TRIANGLES, 0, target.count);
  }

  let cityCity = null;
  const cityBuf = makeBuffer();
  const shadowBuf = makeBuffer();
  const solidBuf = makeBuffer();
  const glassBuf = makeBuffer();
  const shadowBatch = createBatch(16384);
  const solidBatch = createBatch(65536);
  const glassBatch = createBatch(32768);
  const groundTex = gl.createTexture();

  function ensureCity(city) {
    if (cityCity === city) return;
    cityCity = city;
    const batch = createBatch(200000);
    buildCityMesh(batch, city);
    upload(cityBuf, batch, gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D, groundTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bakeGroundTexture(city));
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  }

  function resize(cam) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    for (const c of [canvas, hudCanvas]) {
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    }
    resizeCamera3d(cam, w, h);
    return { w, h, dpr };
  }

  /** Draw a frame. `overlay(ctx, w, h)` paints menus over the HUD; `hud` false hides the HUD. */
  function draw(world, cam, { hud: showHud = true, overlay = null } = {}) {
    const { w, h, dpr } = resize(cam);
    ensureCity(world.city);
    const light = lighting(world.clock);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(light.fog[0], light.fog[1], light.fog[2], 1);
    gl.clearStencil(0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(program);
    gl.uniformMatrix4fv(U.viewProj, false, cam.viewProj);
    gl.uniform3fv(U.sunDir, light.sunDir);
    gl.uniform3fv(U.sunColor, light.sunColor);
    gl.uniform3fv(U.ambient, light.ambient);
    gl.uniform3fv(U.fog, light.fog);
    gl.uniform3fv(U.eye, cam.eye);
    gl.uniform1f(U.time, world.time);
    gl.uniform1f(U.night, light.night);
    gl.uniform1f(U.flat, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, groundTex);
    gl.uniform1i(U.ground, 0);

    gl.disable(gl.BLEND);
    drawBuffer(cityBuf);

    const reach = 2600;
    const view = { x0: cam.x - reach, x1: cam.x + reach, y0: cam.y - reach, y1: cam.y + reach };
    shadowBatch.reset();
    fillShadows(shadowBatch, world, view, light.shadow);
    upload(shadowBuf, shadowBatch, gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.STENCIL_TEST);
    gl.stencilFunc(gl.EQUAL, 0, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
    gl.depthMask(false);
    gl.uniform1f(U.flat, 1);
    gl.blendColor(0, 0, 0, 0.3 * (1 - light.night * 0.7));
    gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
    drawBuffer(shadowBuf);
    gl.disable(gl.STENCIL_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(U.flat, 0);
    gl.depthMask(true);

    solidBatch.reset();
    glassBatch.reset();
    const near = { x0: cam.x - 1800, x1: cam.x + 1800, y0: cam.y - 1800, y1: cam.y + 1800 };
    fillActors(solidBatch, glassBatch, world, near);
    upload(solidBuf, solidBatch, gl.DYNAMIC_DRAW);
    upload(glassBuf, glassBatch, gl.DYNAMIC_DRAW);
    drawBuffer(solidBuf);
    gl.depthMask(false);
    drawBuffer(glassBuf);
    gl.depthMask(true);

    hud.setTransform(1, 0, 0, 1, 0, 0);
    hud.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    hud.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vignette = hud.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, h * 0.95);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.25)');
    hud.fillStyle = vignette;
    hud.fillRect(0, 0, w, h);
    if (showHud) drawHud(hud, world, cam, w, h);
    if (overlay) overlay(hud, w, h);
  }

  return { draw };
}
