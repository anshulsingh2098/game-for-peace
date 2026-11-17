/* Sky, time of day and weather: the sky dome with sun and clouds, stars, the three lights, fog, rain, snow,
   lightning, wet roads and snow cover. Carried over from the current game (game.js) and cut loose from it.
     setTime('dawn' | 'day' | 'dusk' | 'night' | 'auto')        auto = a full day every six minutes
     setWeather('clear' | 'overcast' | 'fog' | 'rain' | 'storm' | 'snow' | 'auto')
     update(dt, now, camera, reach)    once a frame; reach is how far the world is drawn (metres) */
import * as THREE from 'three';
import { alea } from '../core/rng.js';

const lerp = (a, b, t) => a + (b - a) * t, smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const TIMES = {
  day:   { top: '#2f6fd6', mid: '#78b4ef', bot: '#cfe6ff', sun: [-0.30, 0.85, -0.45], sunCol: [1, 0.95, 0.8], light: '#fff2dc', li: 3.2, hs: '#cfe2ff', hg: '#7d7a6a', hi: 1.15, stars: 0, cc: [1, 1, 1], ca: 0.6 },
  dawn:  { top: '#3d5a96', mid: '#b99ab8', bot: '#f6c9a0', sun: [-0.35, 0.10, -0.9], sunCol: [1, 0.78, 0.55], light: '#ffc79a', li: 2.8, hs: '#cfd8ff', hg: '#7d7566', hi: 1.15, stars: 0.1, cc: [1, 0.80, 0.72], ca: 0.8 },
  dusk:  { top: '#27305e', mid: '#9d6a8a', bot: '#f2a36e', sun: [-0.35, 0.06, -0.9], sunCol: [1, 0.6, 0.35], light: '#ffa468', li: 2.7, hs: '#aaa6e4', hg: '#66565e', hi: 1.15, stars: 0.45, cc: [0.96, 0.58, 0.48], ca: 0.75 },
  night: { top: '#03050d', mid: '#0b1230', bot: '#1f2c5c', sun: [-0.3, 0.55, -0.7], sunCol: [0.25, 0.3, 0.5], light: '#8fa6ff', li: 0.7, hs: '#2a3a78', hg: '#0b0c16', hi: 0.9, stars: 1, cc: [0.10, 0.13, 0.22], ca: 0.35 }
};
const CYCLE = 360, TOD_KEYS = [[0, 'night'], [0.20, 'night'], [0.27, 'dawn'], [0.36, 'day'], [0.64, 'day'], [0.73, 'dusk'], [0.82, 'night'], [1, 'night']];
export const TIME_NAME = { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' };
export const WX = {
  clear:    { cloud: .55, dark: 0,   fogMul: 1,   light: 1,   rain: 0,   snow: 0, wet: 0 },
  overcast: { cloud: 1,   dark: .55, fogMul: .75, light: .55, rain: 0,   snow: 0, wet: .05 },
  fog:      { cloud: .9,  dark: .35, fogMul: .22, light: .55, rain: 0,   snow: 0, wet: .2 },
  rain:     { cloud: 1,   dark: .72, fogMul: .42, light: .38, rain: .75, snow: 0, wet: .85 },
  storm:    { cloud: 1,   dark: .95, fogMul: .28, light: .22, rain: 1,   snow: 0, wet: 1 },
  snow:     { cloud: 1,   dark: .45, fogMul: .32, light: .55, rain: 0,   snow: 1, wet: .1 }
};
export const WX_NAME = { clear: 'Clear', overcast: 'Overcast', fog: 'Fog', rain: 'Rain', storm: 'Storm', snow: 'Snow' };
const WX_AUTO = { clear: 4, overcast: 2.5, rain: 2, fog: 1, storm: .5 };
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function mixT(A, B, t, o) {
  for (const k in A) { const a = A[k], b = B[k];
    if (typeof a === 'string') { _c1.set(a); _c2.set(b); o[k] = '#' + _c1.lerp(_c2, t).getHexString(); }
    else if (Array.isArray(a)) o[k] = a.map((v, i) => lerp(v, b[i], t)); else o[k] = lerp(a, b, t); }
  return o;
}
const SKY_R = 11000;

export class Environment {
  constructor(renderer, scene) {
    this.scene = scene; this.pm = new THREE.PMREMGenerator(renderer);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5); this.sun = new THREE.DirectionalLight(0xffffff, 1.5); this.fill = new THREE.DirectionalLight(0xffffff, 0.5);
    scene.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    this.skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() },
        cloudCol: { value: new THREE.Color() }, cloudAmt: { value: 0.7 }, time: { value: 0 }, night: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 cloudCol; uniform float cloudAmt; uniform float time; uniform float night; varying vec3 vDir;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
        float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }
        void main(){ vec3 d = normalize(vDir); float h = d.y;
          vec3 c = mix(bot, mid, smoothstep(-0.02, 0.20, h)); c = mix(c, top, smoothstep(0.15, 0.85, h));
          float sd = max(dot(d, normalize(sunDir)), 0.0);
          vec2 cp = d.xz / (max(h, 0.0) + 0.30) * 1.4 + vec2(time * 0.012, 0.0);
          float cl = smoothstep(0.44, 0.80, fbm(cp)) * smoothstep(0.02, 0.22, h) * cloudAmt;
          float shade = fbm(cp * 1.8 + 3.0);
          vec3 cc = mix(cloudCol * 0.62, cloudCol, shade) + sunCol * pow(sd, 5.0) * 0.55;
          c = mix(c, cc, cl);
          c += sunCol * (pow(sd, 900.0) * 3.5 + pow(sd, 14.0) * 0.30 + pow(sd, 3.0) * 0.10) * (1.0 - cl * 0.85);
          vec3 md = normalize(sunDir); float mc = dot(d, md);                                              // the moon: a pale disc with a soft halo and a few darker maria
          float moon = smoothstep(0.99955, 0.99975, mc), halo = pow(max(mc, 0.0), 220.0) * 0.35;
          vec2 mp = vec2(dot(d, normalize(cross(md, vec3(0.0, 1.0, 0.0)))), dot(d, normalize(cross(cross(md, vec3(0.0, 1.0, 0.0)), md)))) * 900.0;
          float maria = smoothstep(0.35, 0.65, fbm(mp * 2.2 + 5.0));
          c += (vec3(0.86, 0.90, 1.0) * moon * (0.78 + 0.22 * maria) + vec3(0.45, 0.55, 0.85) * halo) * night * (1.0 - cl * 0.9) * smoothstep(0.0, 0.08, h);
          gl_FragColor = vec4(c, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
        }` });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 24, 12), this.skyMat); this.sky.renderOrder = -1; this.sky.frustumCulled = false; scene.add(this.sky);
    const sp = new Float32Array(900 * 3), sr = alea('stars'); for (let i = 0; i < 900; i++) { const u = sr() * 6.283, v = 0.05 + sr() * 0.95, rr = SKY_R * 0.95; sp[i * 3] = Math.cos(u) * Math.sqrt(1 - v * v) * rr; sp[i * 3 + 1] = v * rr; sp[i * 3 + 2] = Math.sin(u) * Math.sqrt(1 - v * v) * rr; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false })); this.stars.frustumCulled = false; scene.add(this.stars);
    this.envScene = new THREE.Scene(); this.envScene.add(new THREE.Mesh(this.sky.geometry, this.skyMat)); { const g = new THREE.Mesh(new THREE.CircleGeometry(SKY_R * 1.5, 32), new THREE.MeshBasicMaterial({ color: 0x33373a, side: THREE.DoubleSide, fog: false })); g.rotation.x = -Math.PI / 2; g.position.y = -40; this.envScene.add(g); }      // a darker ground below the horizon, so the car's paint shows a horizon line when it reflects the sky
    this.rain = this.makeRain(); this.snowfall = this.makeSnow(); scene.add(this.rain, this.snowfall);
    this.fogCol = new THREE.Color(); scene.fog = new THREE.Fog(this.fogCol, 60, 900); scene.background = null;
    this.time = 'day'; this.tod = 0.30; this.fixedWx = 'clear'; this.wxTarget = 'clear'; this.wxTimer = 60; this.w = { ...WX.clear };
    this.flash = 0; this.flashT = 5; this.uSnow = { value: 0 }; this.envTimer = 0; this.envSig = ''; this.lightsOn = false; this.sunDir = new THREE.Vector3(0, 1, 0);
    this._gr = new THREE.Color(); this._T = {}; this.mats = {};
  }
  /* materials the weather changes: ground and road get wet and snowed on */
  attach(mats) {
    this.mats = mats;
    for (const [m, k] of [[mats.ground, 1], [mats.road, 0.5]]) if (m && !m.userData.snowPatch) {
      m.userData.snowPatch = true;
      m.onBeforeCompile = sh => {
        sh.uniforms.uSnow = this.uSnow;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUp = normal.y;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSnow;\nvarying float vUp;')
          .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 1.0), uSnow * smoothstep(0.5, 0.9, vUp) * ' + k.toFixed(2) + ');');
      }; m.needsUpdate = true;
    }
  }
  makeRain() {
    const N = 3500, pos = new Float32Array(N * 6), tip = new Float32Array(N * 2), seed = new Float32Array(N * 2), r = alea('rain');
    for (let i = 0; i < N; i++) { const x = r() * 40, y = r() * 30, z = r() * 40, sd = r(); for (let k = 0; k < 2; k++) { const j = i * 2 + k; pos[j * 3] = x; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z; tip[j] = k; seed[j] = sd; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('tip', new THREE.BufferAttribute(tip, 1)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, inten: { value: 0 }, wind: { value: new THREE.Vector2(0.25, 0) } },
      vertexShader: `attribute float tip; attribute float seed; uniform float time; uniform vec3 cam; uniform float inten; uniform vec2 wind; varying float vA;
        void main(){ vec3 b = position; float W = 40.0, H = 30.0; vec3 p;
          p.x = cam.x + mod(b.x - cam.x, W) - W * 0.5; p.z = cam.z + mod(b.z - cam.z, W) - W * 0.5; p.y = cam.y - 6.0 + mod(b.y - time * (22.0 + seed * 8.0), H);
          p += tip * vec3(wind.x, 1.0, wind.y) * 0.9; vA = step(seed, inten) * (0.16 + 0.18 * seed); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.78, 0.84, 0.95, vA); }' });
    const o = new THREE.LineSegments(g, m); o.frustumCulled = false; o.renderOrder = 5; o.visible = false; return o;
  }
  makeSnow() {
    const N = 3000, pos = new Float32Array(N * 3), seed = new Float32Array(N), r = alea('snow');
    for (let i = 0; i < N; i++) { pos[i * 3] = r() * 50; pos[i * 3 + 1] = r() * 30; pos[i * 3 + 2] = r() * 50; seed[i] = r(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, inten: { value: 0 } },
      vertexShader: `attribute float seed; uniform float time; uniform vec3 cam; uniform float inten; varying float vA;
        void main(){ vec3 b = position; float W = 50.0, H = 30.0; vec3 p;
          p.x = cam.x + mod(b.x - cam.x, W) - W * 0.5 + sin(time * 0.7 + seed * 30.0) * 0.8; p.z = cam.z + mod(b.z - cam.z, W) - W * 0.5 + cos(time * 0.6 + seed * 20.0) * 0.8;
          p.y = cam.y - 6.0 + mod(b.y - time * (1.6 + seed * 1.4), H); vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp((2.0 + seed * 3.0) * 300.0 / max(1.0, -mv.z), 1.5, 14.0); vA = step(seed, inten) * 0.85; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(1.0, 1.0, 1.0, smoothstep(0.5, 0.1, d) * vA); }' });
    const o = new THREE.Points(g, m); o.frustumCulled = false; o.renderOrder = 5; o.visible = false; return o;
  }
  setTime(name) { this.time = TIMES[name] || name === 'auto' ? name : 'day'; this.envTimer = 0; }
  setWeather(name) { this.fixedWx = name === 'auto' ? null : (WX[name] ? name : 'clear'); if (!this.fixedWx) this.wxTimer = 0; }
  curT() {
    if (this.time !== 'auto') return TIMES[this.time];
    let i = 0; while (i < TOD_KEYS.length - 2 && this.tod >= TOD_KEYS[i + 1][0]) i++; const [a, na] = TOD_KEYS[i], [b, nb] = TOD_KEYS[i + 1];
    return mixT(TIMES[na], TIMES[nb], smooth(0, 1, (this.tod - a) / (b - a)), this._T);
  }
  get timeName() { if (this.time !== 'auto') return TIME_NAME[this.time]; const t = this.tod; return t < 0.22 ? 'Night' : t < 0.33 ? 'Dawn' : t < 0.68 ? 'Day' : t < 0.78 ? 'Dusk' : 'Night'; }
  get label() { return WX_NAME[this.fixedWx || this.wxTarget] + ' · ' + this.timeName; }

  /* sun shadows: one map that follows the camera. ext is the half-width in metres, size the map resolution; size 0 turns them off. */
  setShadows(size, ext) {
    const s = this.sun.shadow; this.sun.castShadow = size > 0; this.shadowExt = ext; this.shadowTexel = size > 0 ? 2 * ext / size : 0;
    if (!size) return; s.mapSize.set(size, size); const c = s.camera; c.left = c.bottom = -ext; c.right = c.top = ext; c.near = 10; c.far = 700; c.updateProjectionMatrix();
    s.bias = -0.0005; s.normalBias = 0.35;
  }
  /* centre of the shadow map: the camera position moved to a whole number of map texels, so shadows do not shimmer as you drive */
  shadowSnap(p) {
    const o = this._snap || (this._snap = { out: new THREE.Vector3(), m: new THREE.Matrix4(), v: new THREE.Vector3() }), t = this.shadowTexel; if (!t) return o.out.copy(p);
    o.m.lookAt(o.v.set(0, 0, 0), this.sunDir, THREE.Object3D.DEFAULT_UP); const e = o.m.elements, rx = [e[0], e[1], e[2]], uy = [e[4], e[5], e[6]];
    const a = Math.round((p.x * rx[0] + p.y * rx[1] + p.z * rx[2]) / t) * t, b = Math.round((p.x * uy[0] + p.y * uy[1] + p.z * uy[2]) / t) * t;
    const da = (p.x * rx[0] + p.y * rx[1] + p.z * rx[2]) - a, db = (p.x * uy[0] + p.y * uy[1] + p.z * uy[2]) - b;
    return o.out.set(p.x - da * rx[0] - db * uy[0], p.y - da * rx[1] - db * uy[1], p.z - da * rx[2] - db * uy[2]);
  }
  update(dt, now, camera, reach) {
    if (this.time === 'auto') this.tod = (this.tod + dt / CYCLE) % 1;
    if (!this.fixedWx) { this.wxTimer -= dt; if (this.wxTimer <= 0) { let tot = 0, pick = 'clear'; for (const k in WX_AUTO) tot += WX_AUTO[k]; let r = Math.random() * tot; for (const k in WX_AUTO) { r -= WX_AUTO[k]; if (r <= 0) { pick = k; break; } } this.wxTarget = pick; this.wxTimer = 80 + Math.random() * 90; } }
    const tgt = WX[this.fixedWx || this.wxTarget], k = Math.min(1, dt * 0.35), W = this.w; for (const key in tgt) W[key] = lerp(W[key], tgt[key], k);
    const T = this.curT(), u = this.skyMat.uniforms, dk = W.dark, gr = this._gr, t = now / 1000, cam = camera.position;
    u.time.value = t; u.night.value = smooth(0.6, 1.0, T.stars) * (1 - 0.8 * this.w.dark); u.sunDir.value.set(...T.sun); u.sunCol.value.setRGB(...T.sunCol); this.sunDir.set(...T.sun).normalize();
    this.sun.color.set(T.light); this.fill.color.set(T.hs); this.hemi.color.set(T.hs); this.hemi.groundColor.set(T.hg); this.lightsOn = T.li < 1.8 || dk > 0.7;
    const eff = (hex, out) => { out.set(hex); const L = out.r * 0.3 + out.g * 0.55 + out.b * 0.15; gr.setRGB(L * 0.95, L * 0.98, L * 1.04); return out.lerp(gr, dk * 0.85); };     // bad weather greys the sky
    eff(T.top, u.top.value); eff(T.mid, u.mid.value); eff(T.bot, u.bot.value); this.fogCol.copy(u.bot.value);
    u.cloudCol.value.setRGB(...T.cc); { const L = (T.cc[0] + T.cc[1] + T.cc[2]) / 3 * 0.8; gr.setRGB(L, L, L * 1.05); u.cloudCol.value.lerp(gr, dk * 0.6); }
    u.cloudAmt.value = Math.min(1, T.ca * (0.4 + W.cloud));
    this.stars.material.opacity = T.stars * Math.max(0, 1 - dk * 1.3); this.stars.visible = this.stars.material.opacity > 0.05;
    if (dk > 0.9) { this.flashT -= dt; if (this.flashT <= 0) { this.flash = 1; this.flashT = 3 + Math.random() * 7; } } this.flash = Math.max(0, this.flash - dt * 3.5);      // lightning in storms
    this.sun.intensity = T.li * W.light + this.flash * 2; this.hemi.intensity = T.hi * (0.4 + 0.6 * W.light) + this.flash * 2.5; this.scene.environmentIntensity = 1 - 0.55 * dk;          // bad weather: less sky light from above and less reflected sky ambient this.fill.intensity = (T.li < 1.8 ? 0.25 : 0.7) * (0.5 + 0.5 * W.light);
    const f = this.scene.fog; f.far = reach * 0.96 * Math.pow(W.fogMul, 2.2); f.near = f.far * 0.1;
    const m = this.mats;
    if (m.road) { m.road.roughness = lerp(0.95, 0.3, W.wet); m.road.envMapIntensity = 0.2 + W.wet; m.road.color.setScalar(lerp(1, 0.62, W.wet)); }
    if (m.ground) m.ground.color.setScalar(lerp(1, 0.66, W.wet)); this.uSnow.value = W.snow;
    this.sky.position.copy(cam); this.stars.position.copy(cam);
    const sp = this.shadowSnap(cam); this.sun.position.copy(sp).addScaledVector(this.sunDir, 300); this.sun.target.position.copy(sp);
    this.fill.position.set(cam.x - this.sunDir.x * 100, cam.y + 80, cam.z - this.sunDir.z * 100); this.fill.target.position.copy(cam);
    this.rain.visible = W.rain > 0.02; const ru = this.rain.material.uniforms; ru.time.value = t; ru.cam.value.copy(cam); ru.inten.value = W.rain; ru.wind.value.set(0.25 + W.rain * 0.25, 0);
    this.snowfall.visible = W.snow > 0.02; const su = this.snowfall.material.uniforms; su.time.value = t; su.cam.value.copy(cam); su.inten.value = W.snow;
    this.envTimer -= dt;                                        // reflections (car paint, wet road, water) come from the current sky
    if (this.envTimer <= 0) { this.envTimer = 3; const sig = this.time + (this.time === 'auto' ? Math.floor(this.tod * 36) : '') + '|' + Math.round(dk * 8) + '|' + Math.round(W.cloud * 8);
      if (sig !== this.envSig) { this.envSig = sig; const old = this.envRT; this.envRT = this.pm.fromScene(this.envScene, 0, 10, SKY_R * 2); this.scene.environment = this.envRT.texture; if (old) old.dispose(); } }
  }
}
