/* Game for Peace - endless road engine.
   One procedural road, built in 40 m chunks around the vehicle; scenery is a strip either side of it. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const CH = 40, DS = 2, ROWS = CH / DS;                       // chunk length, sample spacing, rows per chunk
const TOFF = [5.4, 6.6, 8.5, 11, 15, 21, 30, 42, 58, 78, 100, 135, 175, 225, 285]; // terrain columns, metres from the road centre
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const WIND = { t: { value: 0 }, a: { value: 1 } };
function sway(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWind = WIND.t; sh.uniforms.uWindAmp = WIND.a;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uWindAmp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sw = sin(uWind * 1.3 + ip.x * 0.37 + ip.z * 0.29) * 0.6 + sin(uWind * 2.3 + ip.z * 0.53 + ip.x * 0.17) * 0.3;
        float hg = max(transformed.y, 0.0);
        transformed.x += sw * hg * 0.03 * uWindAmp; transformed.z += sw * hg * 0.018 * uWindAmp;`);
  };
  return mat;
}
function rng(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- the endless path: curvature and height are smooth functions of distance ---------- */
class World {
  constructor(seed) {
    const r = rng(seed); this.seed = seed; this.A = AREAS.mixed;
    const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    this.perm = new Uint8Array(512); for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    this.K = [...Array(4)].map((_, i) => ({ a: 0.4 + r() * 0.6, w: 2 * Math.PI / (140 + r() * 520) * (1 + i * 0.5), p: r() * 6.28 }));
    this.kScale = 0.0072 / this.K.reduce((a, k) => a + k.a, 0);       // tightest bend is about 140 m radius
    this.E = [...Array(3)].map((_, i) => ({ a: (3 + r() * 6) / (1 + i * 0.4), w: 2 * Math.PI / (260 + r() * 600), p: r() * 6.28 }));
    this.xs = [0]; this.zs = [0]; this.th = [0]; this.ys = [0];
  }
  kappa(s) { let v = 0; for (const k of this.K) v += k.a * Math.sin(k.w * s + k.p); return v * this.kScale * smooth(0, 250, s); }
  elev(s) { let v = 0; for (const e of this.E) v += e.a * Math.sin(e.w * s + e.p); return v * smooth(0, 200, s); }
  ensure(i) {
    while (this.xs.length <= i) {
      const k = this.xs.length - 1, s = k * DS, th = this.th[k], dth = this.kappa(s + DS / 2) * DS, tm = th + dth / 2;
      this.xs.push(this.xs[k] + Math.sin(tm) * DS); this.zs.push(this.zs[k] - Math.cos(tm) * DS);
      this.th.push(th + dth); this.ys.push(this.elev((k + 1) * DS));
    }
  }
  at(s) { const i = Math.floor(s / DS); this.ensure(i + 2); const f = s / DS - i;
    return { x: lerp(this.xs[i], this.xs[i + 1], f), z: lerp(this.zs[i], this.zs[i + 1], f), y: lerp(this.ys[i], this.ys[i + 1], f),
             th: lerp(this.th[i], this.th[i + 1], f), kappa: (this.th[i + 1] - this.th[i]) / DS, slope: (this.ys[i + 1] - this.ys[i]) / DS }; }
  vn(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), P = this.perm;
    const h = (a, b) => P[P[a & 255] + (b & 255)] / 255;
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v); }
  setArea(name) { this.A = AREAS[name] || AREAS.mixed; }
  cliff(wx, wz) { return smooth(this.A.cLo, this.A.cHi, this.fbm(wx * 0.0045 + 3, wz * 0.0045 - 8)); }          // where rock walls rise beside the road
  fbm(x, y) { return (0.5 * this.vn(x, y) + 0.25 * this.vn(2 * x, 2 * y) + 0.125 * this.vn(4 * x, 4 * y)) / 0.875; }
  /* ground height beside the road: flat near it, rolling hills further out */
  ter(t, wx, wz, ry) {
    const a = Math.abs(t), hills = ((this.fbm(wx * 0.006, wz * 0.006) - 0.45) * 30 + (this.fbm(wx * 0.025, wz * 0.025) - 0.5) * 5) * this.A.hill;
    const river = Math.exp(-Math.pow((this.fbm(wx * 0.0028 + 9, wz * 0.0028 - 4) - 0.5) / this.A.riverW, 2));          // winding rivers follow a contour of a big noise field
    const cf = this.cliff(wx, wz), rr = 1 - Math.abs(2 * this.fbm(wx * 0.0016 + 17, wz * 0.0016 - 3) - 1);       // ridged noise = mountain ranges
    return ry - 0.25 * smooth(5, 7, a) * (1 - smooth(7, 12, a)) + smooth(8, 46, a) * hills - this.A.riverD * river * smooth(10, 30, a)
      + cf * smooth(12, 19, a) * (26 + 22 * this.fbm(wx * 0.01 + 5, wz * 0.01)) * this.A.cliffH + smooth(this.A.mS, this.A.mE, a) * Math.pow(rr, 2.6) * 190 * this.A.mount;
  }
}

/* ---------- procedural textures and props, built once ---------- */
function tint(g, r, gg, b) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function canvasTex(c, repeat) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.needsUpdate = true; return t; }
function tileDraw(x, s, px, py, fn) { for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) { if (px + dx < -20 || px + dx > s + 20 || py + dy < -20 || py + dy > s + 20) continue; fn(px + dx, py + dy); } }
function grassTex() {
  const s = 512, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'), R = rng(11);
  x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) { const px = R() * s, py = R() * s, r = 12 + R() * 40, v = 110 + Math.floor(R() * 70);
    tileDraw(x, s, px, py, (X, Y) => { const g = x.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, `rgba(${v},${v},${v},.35)`); g.addColorStop(1, 'rgba(150,150,150,0)'); x.fillStyle = g; x.fillRect(X - r, Y - r, r * 2, r * 2); }); }
  for (let i = 0; i < 14000; i++) { const px = R() * s, py = R() * s, l = 3 + R() * 9, a = (R() - 0.5) * 1.1, v = 85 + Math.floor(R() * 150);
    x.strokeStyle = `rgba(${v},${v},${v},.55)`; x.lineWidth = 0.8 + R();
    tileDraw(x, s, px, py, (X, Y) => { x.beginPath(); x.moveTo(X, Y); x.lineTo(X + Math.sin(a) * l, Y - Math.cos(a) * l); x.stroke(); }); }
  return canvasTex(c, true);
}
function asphaltTex() {
  const w = 256, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), R = rng(5);
  x.fillStyle = '#767676'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = 70 + Math.floor(R() * 90); x.fillStyle = `rgba(${v},${v},${v + 2},.55)`; x.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); }
  // darker wheel paths and a lighter centre, sandy gravel at both edges (u = lateral position)
  for (const [u, wd, a] of [[0.30, 0.10, 0.28], [0.70, 0.10, 0.28]]) { const g = x.createLinearGradient((u - wd) * w, 0, (u + wd) * w, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  for (let i = 0; i < 26; i++) { x.strokeStyle = 'rgba(25,25,25,.35)'; x.lineWidth = 1; x.beginPath(); let px = R() * w, py = R() * h; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (R() - 0.5) * 30; py += R() * 22; x.lineTo(px, py); } x.stroke(); }
  const e = x.createLinearGradient(0, 0, w, 0); e.addColorStop(0, 'rgba(210,190,150,1)'); e.addColorStop(0.065, 'rgba(210,190,150,1)'); e.addColorStop(0.085, 'rgba(210,190,150,0)');
  e.addColorStop(0.915, 'rgba(210,190,150,0)'); e.addColorStop(0.935, 'rgba(210,190,150,1)'); e.addColorStop(1, 'rgba(210,190,150,1)'); x.fillStyle = e; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 2200; i++) { const sx = R() < 0.5 ? R() * 0.07 * w : (0.93 + R() * 0.07) * w, v = 120 + Math.floor(R() * 110); x.fillStyle = `rgba(${v},${v - 10},${v - 30},.6)`; x.fillRect(sx, R() * h, 1 + R() * 2, 1 + R() * 2); }
  const t = canvasTex(c, false); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; return t;
}
function leafTex(kind) {
  const c = document.createElement('canvas'), R = rng(kind === 'pine' ? 3 : 9);
  if (kind === 'pine') {
    c.width = 256; c.height = 512; const x = c.getContext('2d'); x.lineCap = 'round';
    for (let tier = 0; tier < 15; tier++) { const y = 30 + tier * 31, hw = 16 + tier * 7.6;
      for (let n = 0; n < 170; n++) { const side = (R() - 0.5) * 2, px = 128 + side * hw * R(), l = 18 + R() * 26, sag = 0.5 + R() * 0.6;
        const L = 20 + Math.floor(R() * 38), G = 50 + Math.floor(R() * 40); x.strokeStyle = `rgba(${L},${G},${L + 8},1)`; x.lineWidth = 1.4 + R() * 2;
        x.beginPath(); x.moveTo(128 + side * hw * 0.15, y - 8 + R() * 8); x.lineTo(px, y + 6 + R() * 12); x.lineTo(px + side * 6, y + 6 + l * sag); x.stroke(); } }
  } else {
    c.width = 256; c.height = 256; const x = c.getContext('2d');
    for (let n = 0; n < 1100; n++) { const a = R() * 6.283, r = Math.sqrt(R()), px = 128 + Math.cos(a) * r * 112, py = 124 + Math.sin(a) * r * 96, rad = 5 + R() * 8;
      const top = 1 - py / 256, H = 78 + Math.floor(R() * 34), Sat = 32 + Math.floor(R() * 20), Li = 15 + top * 22 + R() * 12;
      x.fillStyle = `hsl(${H},${Sat}%,${Li}%)`; x.beginPath(); x.ellipse(px, py, rad, rad * 0.8, R() * 3, 0, 6.283); x.fill(); }
  }
  return canvasTex(c, false);
}
function bark(g, r, gg, b) { return tint(g, r, gg, b); }
function crossCards(w, h, cy, count) {
  const parts = []; for (let i = 0; i < count; i++) { const p = new THREE.PlaneGeometry(w, h); p.rotateY(i * Math.PI / count); p.translate(0, cy, 0); parts.push(p); }
  const g = mergeGeometries(parts), pos = g.attributes.position, n = new Float32Array(pos.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.set(pos.getX(i), pos.getY(i) - cy * 0.9, pos.getZ(i)).normalize(); v.y = v.y * 0.6 + 0.5; v.normalize(); n[i * 3] = v.x; n[i * 3 + 1] = v.y; n[i * 3 + 2] = v.z; }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); return g;
}
function hash3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function rockGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 1).toNonIndexed(), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.78 + 0.5 * hash3(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50)); p.setXYZ(i, x * k, y * k * 0.7, z * k); }
  g.computeVertexNormals(); return tint(g, 0.47, 0.45, 0.42);
}
function tuftTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), R = rng(21); x.lineCap = 'round';
  for (let i = 0; i < 70; i++) { const bx = 14 + R() * 100, h = 40 + R() * 70, lean = (R() - 0.5) * 36, G = 90 + Math.floor(R() * 90), Rr = Math.floor(G * (0.55 + R() * 0.35));
    x.strokeStyle = `rgb(${Rr},${G},${Math.floor(G * 0.35)})`; x.lineWidth = 1.6 + R() * 1.6; x.beginPath(); x.moveTo(bx, 128); x.quadraticCurveTo(bx + lean * 0.3, 128 - h * 0.6, bx + lean, 128 - h); x.stroke();
    if (R() < 0.07) { x.fillStyle = R() < 0.5 ? '#f4f1e6' : '#f2d04a'; x.beginPath(); x.arc(bx + lean, 128 - h, 3.2, 0, 6.283); x.fill(); } }
  return canvasTex(c, false);
}
function waterNormalTex() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), im = x.createImageData(S, S), R = rng(77);
  const W = [...Array(9)].map(() => ({ kx: 1 + Math.floor(R() * 5), ky: 1 + Math.floor(R() * 5), p: R() * 6.28, a: 0.5 + R() }));
  const h = (u, v) => { let s = 0; for (const w of W) s += w.a * Math.sin((w.kx * u + w.ky * v) * 6.2832 + w.p); return s; };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const u = i / S, v = j / S, e = 1 / S, dx = h(u + e, v) - h(u - e, v), dy = h(u, v + e) - h(u, v - e), nx = -dx * 1.1, ny = -dy * 1.1, l = Math.hypot(nx, ny, 1), k = (j * S + i) * 4;
    im.data[k] = (nx / l * 0.5 + 0.5) * 255; im.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; im.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[k + 3] = 255; }
  x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function signTex(kind) {
  const c = document.createElement('canvas'); c.width = 128; c.height = kind === 'chev' ? 100 : 128; const x = c.getContext('2d');
  if (kind === 'chev') {
    x.fillStyle = '#f0c12a'; x.fillRect(0, 0, 128, 100); x.strokeStyle = '#111'; x.lineWidth = 6; x.strokeRect(5, 5, 118, 90);
    x.lineWidth = 12; x.lineJoin = 'miter'; x.beginPath(); x.moveTo(38, 18); x.lineTo(82, 50); x.lineTo(38, 82); x.stroke();
  } else {
    x.fillStyle = '#f2f2f2'; x.beginPath(); x.arc(64, 64, 62, 0, 6.283); x.fill(); x.strokeStyle = '#c4161c'; x.lineWidth = 12; x.beginPath(); x.arc(64, 64, 54, 0, 6.283); x.stroke();
    x.fillStyle = '#111'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('80', 64, 68);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function propGeometry() {
  const cg = (r1, r2, h) => new THREE.CylinderGeometry(r1, r2, h, 8);
  const cactus = mergeGeometries([
    tint(cg(0.2, 0.24, 3.4).translate(0, 1.7, 0), 0.26, 0.46, 0.26), tint(cg(0.13, 0.13, 1.0).rotateZ(Math.PI / 2).translate(0.55, 1.7, 0), 0.26, 0.46, 0.26),
    tint(cg(0.13, 0.14, 1.1).translate(0.95, 2.2, 0), 0.28, 0.50, 0.28), tint(cg(0.12, 0.12, 0.9).rotateZ(Math.PI / 2).translate(-0.5, 1.2, 0), 0.26, 0.46, 0.26),
    tint(cg(0.12, 0.13, 0.9).translate(-0.9, 1.6, 0), 0.28, 0.50, 0.28)]);
  const trunkP = bark(new THREE.CylinderGeometry(0.14, 0.34, 5, 7).translate(0, 2.5, 0), 0.20, 0.15, 0.11);
  const trunkR = bark(new THREE.CylinderGeometry(0.18, 0.36, 3.6, 7).translate(0, 1.8, 0), 0.26, 0.20, 0.15);
  return {
    pine: { trunk: trunkP, foliage: crossCards(5.8, 11, 6.3, 3), mat: sway(new THREE.MeshLambertMaterial({ map: leafTex('pine'), alphaTest: 0.45, side: THREE.DoubleSide })) },
    round: { trunk: trunkR, foliage: crossCards(8.6, 7.6, 6.6, 3), mat: sway(new THREE.MeshLambertMaterial({ map: leafTex('round'), alphaTest: 0.45, side: THREE.DoubleSide })) },
    bush: { foliage: crossCards(2.8, 2.1, 1.0, 3), mat: sway(new THREE.MeshLambertMaterial({ map: leafTex('round'), alphaTest: 0.45, side: THREE.DoubleSide })) },
    tuft: { foliage: crossCards(1.7, 1.2, 0.55, 3), mat: sway(new THREE.MeshLambertMaterial({ map: tuftTex(), alphaTest: 0.4, side: THREE.DoubleSide })) },
    cactus,
    rock: rockGeometry(),
    pole: mergeGeometries([tint(new THREE.BoxGeometry(0.2, 8.6, 0.2).translate(0, 4.3, 0), 0.30, 0.23, 0.17), tint(new THREE.BoxGeometry(2.3, 0.13, 0.13).translate(0, 8.0, 0), 0.26, 0.20, 0.15),
      tint(new THREE.BoxGeometry(0.1, 0.18, 0.1).translate(-1.0, 8.15, 0), 0.7, 0.7, 0.72), tint(new THREE.BoxGeometry(0.1, 0.18, 0.1).translate(0, 8.15, 0), 0.7, 0.7, 0.72), tint(new THREE.BoxGeometry(0.1, 0.18, 0.1).translate(1.0, 8.15, 0), 0.7, 0.7, 0.72)]),
    signpole: tint(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6).translate(0, 1.2, 0), 0.5, 0.52, 0.55),
    chev: { foliage: new THREE.PlaneGeometry(1.15, 0.9), mat: new THREE.MeshLambertMaterial({ map: signTex('chev'), side: THREE.DoubleSide }) },
    limit: { foliage: new THREE.PlaneGeometry(0.9, 0.9), mat: new THREE.MeshLambertMaterial({ map: signTex('limit'), side: THREE.DoubleSide }) },
    railpost: tint(new THREE.BoxGeometry(0.1, 0.85, 0.1).translate(0, 0.425, 0), 0.30, 0.31, 0.33),
    post: mergeGeometries([tint(new THREE.BoxGeometry(0.1, 0.95, 0.1).translate(0, 0.475, 0), 0.9, 0.9, 0.88), tint(new THREE.BoxGeometry(0.11, 0.14, 0.11).translate(0, 0.78, 0), 0.8, 0.1, 0.08)])
  };
}

/* ---------- time of day ---------- */
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const TIMES = {
  day:   { top: '#2f6fd6', mid: '#78b4ef', bot: '#cfe6ff', sun: [-0.30, 0.85, -0.45], sunCol: [1, 0.95, 0.8], light: '#fff2dc', li: 3.2, hs: '#cfe2ff', hg: '#7d7a6a', hi: 1.15, stars: 0, cc: [1, 1, 1], ca: 0.6, mtn: '#8aa0b8' },
  dawn:  { top: '#3d5a96', mid: '#b99ab8', bot: '#f6c9a0', sun: [-0.35, 0.10, -0.9], sunCol: [1, 0.78, 0.55], light: '#ffc79a', li: 2.8, hs: '#cfd8ff', hg: '#7d7566', hi: 1.15, stars: 0.1, cc: [1, 0.80, 0.72], ca: 0.8, mtn: '#6d6a88' },
  dusk:  { top: '#27305e', mid: '#9d6a8a', bot: '#f2a36e', sun: [-0.35, 0.06, -0.9], sunCol: [1, 0.6, 0.35], light: '#ffa468', li: 2.7, hs: '#aaa6e4', hg: '#66565e', hi: 1.15, stars: 0.45, cc: [0.96, 0.58, 0.48], ca: 0.75, mtn: '#5b4a72' },
  night: { top: '#03050d', mid: '#0b1230', bot: '#1f2c5c', sun: [-0.3, 0.55, -0.7], sunCol: [0.25, 0.3, 0.5], light: '#8fa6ff', li: 0.7, hs: '#2a3a78', hg: '#0b0c16', hi: 0.9, stars: 1, cc: [0.10, 0.13, 0.22], ca: 0.35, mtn: '#11172e' }
};
const CYCLE = 360;                                            // seconds for a full day in Auto mode
const TOD_KEYS = [[0, 'night'], [0.20, 'night'], [0.27, 'dawn'], [0.36, 'day'], [0.64, 'day'], [0.73, 'dusk'], [0.82, 'night'], [1, 'night']];
const TOD_LABEL = { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' };
function mixT(A, B, t, out) {
  const o = out || {};
  for (const k in A) { const a = A[k], b = B[k];
    if (typeof a === 'string') { _c1.set(a); _c2.set(b); o[k] = '#' + _c1.lerp(_c2, t).getHexString(); }
    else if (Array.isArray(a)) o[k] = a.map((v, i) => lerp(v, b[i], t)); else o[k] = lerp(a, b, t); }
  return o;
}
/* ---------- climate zones (they change along the road) and weather ---------- */
const ZL = 2200;                                              // metres per climate zone; zones blend over 300 m
const ZNAMES = ['temperate', 'desert', 'snow', 'tropical'];
const CLIM = {
  temperate: { g1: [.62, .74, .30], g2: [.34, .50, .18], dry: [.66, .60, .34], patch: .35, dens: 1, pine: .55, leaf: [1, 1, 1], pineT: [1, 1, 1], tuftT: [1, 1, 1], rock: .10, tuft: 1, cactus: 0, skyT: [1, 1, 1, 0], wl: -3.0, mtn: [.35, .45, .35], mtnA: 0, cap: 1 },
  autumn:    { g1: [.68, .60, .28], g2: [.48, .38, .16], dry: [.74, .55, .28], patch: .65, dens: .95, pine: .30, leaf: [1.65, .78, .32], pineT: [1.05, .95, .85], tuftT: [1.35, 1, .55], rock: .10, tuft: .9, cactus: 0, skyT: [1, .75, .55, .12], wl: -3.0, mtn: [.46, .30, .18], mtnA: .35, cap: 1 },
  desert:    { g1: [.88, .72, .46], g2: [.76, .58, .36], dry: [.92, .76, .50], patch: .5, dens: .06, pine: .2, leaf: [1.4, 1.1, .6], pineT: [1.3, 1.1, .8], tuftT: [1.8, 1.5, .7], rock: .55, tuft: .25, cactus: .5, skyT: [1, .78, .52, .22], wl: -60, mtn: [.65, .36, .22], mtnA: .65, cap: 0 },
  snow:      { g1: [1.5, 1.55, 1.68], g2: [1.25, 1.32, 1.48], dry: [1.38, 1.44, 1.58], patch: .2, dens: .8, pine: .9, leaf: [1.2, 1.3, 1.45], pineT: [1.45, 1.6, 1.75], tuftT: [1.7, 1.8, 2], rock: .15, tuft: .2, cactus: 0, skyT: [.78, .88, 1, .18], wl: -3.2, mtn: [.88, .92, .98], mtnA: .7, cap: 1 },
  tropical:  { g1: [.30, .68, .18], g2: [.16, .46, .10], dry: [.40, .64, .20], patch: .12, dens: 1.15, pine: .08, leaf: [.78, 1.3, .62], pineT: [.9, 1.2, .8], tuftT: [.8, 1.25, .7], rock: .08, tuft: 1.2, cactus: 0, skyT: [.62, .88, .80, .10], wl: -2.2, mtn: [.18, .36, .24], mtnA: .55, cap: 0.35 }
};
CLIM.spring = { g1: [.55, .80, .35], g2: [.36, .60, .22], dry: [.62, .68, .38], patch: .15, dens: 1, pine: .45, leaf: [1.5, 1.2, 1.35], pineT: [1, 1.05, 1], tuftT: [1.15, 1.2, 1], rock: .10, tuft: 1.5, cactus: 0, skyT: [1, 1, 1, 0], wl: -3.0, mtn: [.45, .55, .45], mtnA: .1, cap: 1 };
CLIM.winter = { g1: [1.3, 1.35, 1.5], g2: [1.0, 1.08, 1.2], dry: [1.1, 1.14, 1.28], patch: .3, dens: .7, pine: .75, leaf: [.75, .65, .55], pineT: [1.3, 1.4, 1.55], tuftT: [1.5, 1.55, 1.8], rock: .15, tuft: .3, cactus: 0, skyT: [.85, .92, 1, .12], wl: -3.2, mtn: [.8, .85, .95], mtnA: .6, cap: 1 };
const AREAS = {   // what the land looks like: forest, mountains, canyon, lakeside, plains, or the natural mix
  mixed:     { hill: 1,    mount: 1,   mS: 50, mE: 200, cLo: 0.58, cHi: 0.66, cliffH: 1,   riverW: 0.03,  riverD: 7.5, wl: 0,   dens: 1,   tuft: 1 },
  forest:    { hill: 0.9,  mount: 0.7, mS: 70, mE: 220, cLo: 0.93, cHi: 0.99, cliffH: 1,   riverW: 0.03,  riverD: 7.5, wl: 0,   dens: 1.5, tuft: 1 },
  mountains: { hill: 1.2,  mount: 1.7, mS: 30, mE: 130, cLo: 0.56, cHi: 0.62, cliffH: 1.3, riverW: 0.025, riverD: 7,   wl: 0,   dens: 0.8, tuft: 0.7 },
  canyon:    { hill: 0.8,  mount: 1,   mS: 60, mE: 200, cLo: 0.36, cHi: 0.44, cliffH: 1.5, riverW: 0.035, riverD: 6,   wl: 0,   dens: 0.5, tuft: 0.6 },
  lakeside:  { hill: 0.9,  mount: 0.8, mS: 60, mE: 220, cLo: 0.85, cHi: 0.93, cliffH: 0.8, riverW: 0.075, riverD: 9,   wl: 1.6, dens: 1.1, tuft: 1.1 },
  plains:    { hill: 0.35, mount: 0.3, mS: 90, mE: 260, cLo: 0.95, cHi: 0.99, cliffH: 0.6, riverW: 0.02,  riverD: 4,   wl: 0,   dens: 0.3, tuft: 1.5 }
};
const SEASON_NAME = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
export const CLIM_NAME = { temperate: 'Temperate', autumn: 'Autumn', desert: 'Desert', snow: 'Snowfields', tropical: 'Tropical' };
const WX = {
  clear:    { cloud: .55, dark: 0,   fogMul: 1,   light: 1,   rain: 0,   snow: 0, wet: 0 },
  overcast: { cloud: 1,   dark: .55, fogMul: .85, light: .55, rain: 0,   snow: 0, wet: .05 },
  fog:      { cloud: .9,  dark: .35, fogMul: .22, light: .55, rain: 0,   snow: 0, wet: .2 },
  rain:     { cloud: 1,   dark: .72, fogMul: .55, light: .38, rain: .75, snow: 0, wet: .85 },
  storm:    { cloud: 1,   dark: .95, fogMul: .40, light: .22, rain: 1,   snow: 0, wet: 1 },
  snow:     { cloud: 1,   dark: .45, fogMul: .40, light: .55, rain: 0,   snow: 1, wet: .1 }
};
export const WX_NAME = { clear: 'Clear', overcast: 'Overcast', fog: 'Fog', rain: 'Rain', storm: 'Storm', snow: 'Snow' };
const WX_AUTO = { temperate: { clear: 4, overcast: 2.5, rain: 2, fog: 1, storm: .5 }, autumn: { overcast: 3.5, rain: 3, clear: 2, fog: 1.5 }, desert: { clear: 8, overcast: 1, rain: .4 },
  snow: { snow: 4.5, overcast: 2.5, fog: 1.5, clear: 1.5 }, tropical: { rain: 3.5, clear: 3.5, storm: 1.5, overcast: 1.5 } };
const mixV = (a, b, t) => Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], t)) : lerp(a, b, t);
const mixC = (A, B, t) => { const o = {}; for (const k in A) o[k] = mixV(A[k], B[k], t); return o; };
const QUALITY = { low: { ahead: 8, pr: 1, trees: 0.45 }, med: { ahead: 12, pr: 1.5, trees: 0.75 }, high: { ahead: 16, pr: 2, trees: 1 } };

/* ---------- vehicle handling, per vehicle id ---------- */
const LIGHTS = {   // light positions in model space (front is +Z)
  car:   { tail: [[-0.68, 0.84, -2.27], [0.68, 0.84, -2.27]], head: [[-0.66, 0.74, 2.14], [0.66, 0.74, 2.14]], ts: 0.8, hs: 1.1 },
  truck: { tail: [[-1.1, 1.7, -7.44], [1.1, 1.7, -7.44]], head: [[-0.98, 1.72, 5.96], [0.98, 1.72, 5.96]], ts: 0.9, hs: 1.3 },
  bike:  { tail: [[0, 1.07, -1.05]], head: [[0, 0.86, 0.84]], ts: 0.6, hs: 0.9 }
};
const EYES = { car: [-0.32, 1.22, 0.14], truck: [-0.5, 2.85, 3.3], bike: [0, 1.60, 0.20] };
const VEH = {
  car:   { L: 2.9, steer: 0.50, wr: 0.35, cam: { back: 7.5, up: 3.0, look: 2.5 }, lean: 0.03 },
  truck: { L: 5.0, steer: 0.36, wr: 0.55, cam: { back: 17, up: 6.5, look: 4 }, lean: 0.015 },
  bike:  { L: 1.4, steer: 0.60, wr: 0.34, cam: { back: 5.0, up: 2.2, look: 2.0 }, lean: 0.55 }
};

const name_night = t => t === 'night';

export class Game {
  constructor(canvas, hooks = {}) {
    this.hooks = hooks; this.canvas = canvas; this.running = false; this.paused = false; this.chunks = new Map();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25; this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(58, 1, 0.3, 1500);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5); this.sunL = new THREE.DirectionalLight(0xffffff, 1.5);
    this.fill = new THREE.DirectionalLight(0xffffff, 0.5); this.scene.add(this.hemi, this.sunL, this.sunL.target, this.fill, this.fill.target);
    this.pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = this.pm.fromScene(new RoomEnvironment(), 0.04).texture; this.envTimer = 0; this.envSig = '';
    this.skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() },
        cloudCol: { value: new THREE.Color() }, cloudAmt: { value: 0.7 }, time: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 cloudCol; uniform float cloudAmt; uniform float time; varying vec3 vDir;
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
          gl_FragColor = vec4(c, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
        }` });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 24, 12), this.skyMat); this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.scene.add(this.sky);
    const sp = new Float32Array(900 * 3), sr = rng(7); for (let i = 0; i < 900; i++) { const u = sr() * 6.283, v = 0.05 + sr() * 0.95, rr = 1050; sp[i * 3] = Math.cos(u) * Math.sqrt(1 - v * v) * rr; sp[i * 3 + 1] = v * rr; sp[i * 3 + 2] = Math.sin(u) * Math.sqrt(1 - v * v) * rr; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false })); this.scene.add(this.stars);
    this.envScene = new THREE.Scene(); this.envScene.add(new THREE.Mesh(this.sky.geometry, this.skyMat));
    this.props = propGeometry(); this.sharedGeo = new Set([this.props.signpole, this.props.chev.foliage, this.props.limit.foliage, this.props.pole, this.props.railpost, this.props.cactus, this.props.bush.foliage, this.props.tuft.foliage, this.props.rock, this.props.post, this.props.pine.trunk, this.props.pine.foliage, this.props.round.trunk, this.props.round.foliage]);
    for (const k of ['pine', 'round']) this.props[k].depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.props[k].mat.map, alphaTest: 0.45 });
    this.lam = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: grassTex() });
    this.roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: asphaltTex(), roughness: 0.95, metalness: 0 });
    this.markMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.railMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }); this.wireMat = new THREE.LineBasicMaterial({ color: 0x15151a });
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x1d4a5a, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.9, normalMap: waterNormalTex(), normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.5 });
    this.uSnow = { value: 0 }; this.addSnow(this.groundMat, 1); this.addSnow(this.roadMat, 0.5);
    this.rain = this.makeRain(); this.snowfall = this.makeSnow(); this.scene.add(this.rain, this.snowfall);
    this.wcur = { ...WX.clear }; this.zones = ['temperate']; this.zr = rng(1); this.fixedClim = null; this.fixedWx = null; this.wxTarget = 'clear'; this.wxTimer = 60; this.flash = 0; this.flashT = 5;
    this.cNow = CLIM.temperate; this.lightsNow = false; this.headMode = 'auto'; this.mtnBase = new THREE.Color(); this.mtnCol = new THREE.Color(); this._mc = new THREE.Color(); this._gr = new THREE.Color(); this._mul = new THREE.Color(); this._ft = 0;
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.scene.add(this.shadow);
    this.keys = { left: 0, right: 0, up: 0, down: 0 }; this.pad = { steer: 0, up: 0, down: 0 }; this.prScale = 1; this.adaptT = -3; this.fpsA = 0.016; this.view = 'third'; this.eye = new THREE.Vector3();
    addEventListener('resize', () => this.resize()); this.resize();
    this._loop = t => this.frame(t);
  }
  addSnow(mat, k) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uSnow = this.uSnow;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUp = normal.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSnow;\nvarying float vUp;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 1.0), uSnow * smoothstep(0.5, 0.9, vUp) * ' + k.toFixed(2) + ');');
    }; mat.needsUpdate = true;
  }
  makeRain() {
    const N = 3500, pos = new Float32Array(N * 6), tip = new Float32Array(N * 2), seed = new Float32Array(N * 2), r = rng(33);
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
    const N = 3000, pos = new Float32Array(N * 3), seed = new Float32Array(N), r = rng(44);
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
  CK(name) { return name === 'temperate' ? ({ spring: 'spring', summer: 'temperate', autumn: 'autumn', winter: 'winter' }[this.season] || 'temperate') : name; }
  zone(k) { while (this.zones.length <= k) { const prev = this.zones[this.zones.length - 1]; let n; do { n = ZNAMES[Math.floor(this.zr() * ZNAMES.length)]; } while (n === prev); this.zones.push(n); } return this.zones[k]; }
  clim(s) {
    if (this.fixedClim) return CLIM[this.CK(this.fixedClim)];
    const m = Math.round(s / ZL); let a, b, t = 0;
    if (m >= 1 && Math.abs(s - m * ZL) < 150) { a = this.zone(m - 1); b = this.zone(m); t = smooth(0, 1, (s - m * ZL + 150) / 300); } else a = b = this.zone(Math.max(0, Math.floor(s / ZL)));
    if (a === b || t <= 0.001) return CLIM[this.CK(a)]; if (t >= 0.999) return CLIM[this.CK(b)];
    const key = a + b + Math.round(t * 16); if (this._ck !== key) { this._ck = key; this._cv = mixC(CLIM[this.CK(a)], CLIM[this.CK(b)], t); } return this._cv;
  }
  pickWeather(c) { const w = WX_AUTO[c]; let tot = 0; for (const k in w) tot += w[k]; let r = Math.random() * tot; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return 'clear'; }
  updateWorld(dt) {
    this.cNow = this.clim(this.s + 250); this.cName = this.fixedClim || this.zone(Math.floor((this.s + 400) / ZL));
    if (!this.fixedWx) { this.wxTimer -= dt; if (this.wxTimer <= 0) { this.wxTarget = this.pickWeather(this.cName); this.wxTimer = 80 + Math.random() * 90; } }
    const tgt = WX[this.fixedWx || this.wxTarget], k = Math.min(1, dt * 0.35); for (const key in tgt) this.wcur[key] = lerp(this.wcur[key], tgt[key], k);
    if (this.time === 'auto') this.tod = ((this.tod || 0) + dt / CYCLE) % 1;
    this.applyWorld(dt);
    const lab = CLIM_NAME[this.cName] + (this.cName === 'temperate' ? ' (' + (SEASON_NAME[this.season] || 'Summer') + ')' : '') + ' · ' + WX_NAME[this.fixedWx || this.wxTarget] + ' · ' + this.timeName(); if (lab !== this._lab) { this._lab = lab; this.hooks.onWorld && this.hooks.onWorld(lab); }
  }
  /* turns the current climate + weather + time of day into sky, fog, light, wetness and precipitation */
  curT() { return this.time === 'auto' ? this.todT(this.tod || 0) : (TIMES[this.time] || TIMES.dusk); }
  todT(tod) { let i = 0; while (i < TOD_KEYS.length - 2 && tod >= TOD_KEYS[i + 1][0]) i++; const [a, na] = TOD_KEYS[i], [b, nb] = TOD_KEYS[i + 1]; return mixT(TIMES[na], TIMES[nb], smooth(0, 1, (tod - a) / (b - a)), this._tT || (this._tT = {})); }
  timeName() { if (this.time !== 'auto') return TOD_LABEL[this.time] || ''; const t = this.tod || 0; return t < 0.22 ? 'Night' : t < 0.33 ? 'Dawn' : t < 0.68 ? 'Day' : t < 0.78 ? 'Dusk' : 'Night'; }
  applyWorld(dt) {
    const T = this.curT(), W = this.wcur, cl = this.cNow, u = this.skyMat.uniforms, dk = W.dark, tmp = this._mc, gr = this._gr, mul = this._mul, sk = cl.skyT, am = Math.min(1, sk[3] * 3);
    u.sunDir.value.set(...T.sun); u.sunCol.value.setRGB(...T.sunCol); this.sunDirV.set(...T.sun).normalize(); this.mtnBase.set(T.mtn);
    this.sunL.color.set(T.light); this.fill.color.set(T.hs); this.hemi.color.set(T.hs); this.hemi.groundColor.set(T.hg); this.lightsOn = T.li < 1.8;
    mul.setRGB(lerp(1, sk[0], am), lerp(1, sk[1], am), lerp(1, sk[2], am));
    const eff = (hex, out) => { out.set(hex).multiply(mul); const L = out.r * 0.3 + out.g * 0.55 + out.b * 0.15; gr.setRGB(L * 0.95, L * 0.98, L * 1.04); return out.lerp(gr, dk * 0.85); };
    eff(T.top, u.top.value); eff(T.mid, u.mid.value); eff(T.bot, u.bot.value); this.fogCol.copy(u.bot.value);
    u.cloudCol.value.setRGB(...T.cc); { const L = (T.cc[0] + T.cc[1] + T.cc[2]) / 3 * 0.8; gr.setRGB(L, L, L * 1.05); u.cloudCol.value.lerp(gr, dk * 0.6); }
    u.cloudAmt.value = Math.min(1, T.ca * (0.4 + W.cloud));
    const flash = this.flash; this.stars.material.opacity = T.stars * Math.max(0, 1 - dk * 1.3); this.stars.visible = this.stars.material.opacity > 0.05;
    this.sunL.intensity = T.li * W.light + flash * 2; this.hemi.intensity = T.hi * (0.65 + 0.35 * W.light) + flash * 2.5; this.fill.intensity = (T.li < 1.8 ? 0.25 : 0.7) * (0.5 + 0.5 * W.light);
    const f = this.scene.fog; f.color.copy(this.fogCol); f.near = 40 * W.fogMul; f.far = (this.fogFar || 420) * W.fogMul;
    this.mtnCol.copy(this.mtnBase).lerp(tmp.setRGB(...cl.mtn), cl.mtnA); this._ft -= dt; if (this._ft <= 0) { this._ft = 0.5; this.tintFar(); }
    this.roadMat.roughness = lerp(0.95, 0.3, W.wet); this.roadMat.envMapIntensity = 0.2 + W.wet; this.roadMat.color.setScalar(lerp(1, 0.62, W.wet)); this.groundMat.color.setScalar(lerp(1, 0.8, W.wet)); this.uSnow.value = W.snow;
    const t = this.skyMat.uniforms.time.value, cam = this.camera.position;
    { const nm = this.waterMat.normalMap; nm.offset.x = (t * 0.011) % 1; nm.offset.y = (t * 0.007) % 1; const icy = cl.g1[2] > 1.2; if (icy !== this._icy) { this._icy = icy; this.waterMat.color.set(icy ? 0x9ab4c6 : 0x1d4a5a); } }
    this.rain.visible = W.rain > 0.02; const ru = this.rain.material.uniforms; ru.time.value = t; ru.cam.value.copy(cam); ru.inten.value = W.rain; ru.wind.value.set(0.25 + W.rain * 0.25, 0);
    this.snowfall.visible = W.snow > 0.02; const su = this.snowfall.material.uniforms; su.time.value = t; su.cam.value.copy(cam); su.inten.value = W.snow;
    if (W.dark > 0.9) { this.flashT -= dt; if (this.flashT <= 0) { this.flash = 1; this.flashT = 3 + Math.random() * 7; } } this.flash = Math.max(0, this.flash - dt * 3.5);
    this.envTimer -= dt; { const sig = this.time + (this.time === 'auto' ? Math.floor((this.tod || 0) * 36) : '') + '|' + this.cName + '|' + Math.round(W.dark * 8) + '|' + Math.round(W.cloud * 8); if ((this.envTimer <= 0 && sig !== this.envSig) || dt === 0) { this.envSig = sig; this.envTimer = 3; this.refreshEnv(); } else if (this.envTimer <= 0) this.envTimer = 3; }
    const hm = this.headMode, ln = hm === 'on' || (hm !== 'off' && (this.lightsOn || W.dark > 0.7)); if (ln !== this.lightsNow) { this.lightsNow = ln; if (this.model) this.lightEmit(); }
    this._hl = (this._hl || 0) + ((ln ? 1 : 0) - (this._hl || 0)) * Math.min(1, (dt || 1) * 4);
    if (this.head) { this.head.intensity = 260 * this._hl; this.head.visible = this._hl > 0.02; }
  }
  refreshEnv() {                                                // reflections (car paint, wet road) come from the current sky
    const old = this.envRT; this.envRT = this.pm.fromScene(this.envScene, 0, 10, 2000); this.scene.environment = this.envRT.texture; if (old) old.dispose();
  }
  buildCockpit(id) {
    if (this.cockpit && this.cockpit.parent) this.cockpit.parent.remove(this.cockpit); this.cockpit = null; this.sw = null;
    if (id === 'bike') return;
    const g = new THREE.Group(), dark = new THREE.MeshLambertMaterial({ color: 0x15151b }), mid = new THREE.MeshLambertMaterial({ color: 0x30303a }), glow = new THREE.MeshBasicMaterial({ color: 0x6fd0ff });
    const box = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || dark); m.position.set(x, y, z); g.add(m); return m; };
    let pos, R, tilt;
    if (id === 'car') { box(1.5, 0.07, 0.42, 0, 0.955, 0.66); box(0.46, 0.08, 0.2, -0.32, 1.0, 0.64, mid); box(0.28, 0.01, 0.05, -0.32, 1.045, 0.58, glow); box(0.3, 0.05, 0.1, 0.2, 0.99, 0.60, mid); box(0.08, 0.22, 0.08, -0.32, 0.86, 0.54, mid); pos = [-0.32, 0.98, 0.50]; R = 0.13; tilt = 0.6; }
    else { box(2.0, 0.24, 0.8, 0, 2.30, 3.95); box(0.8, 0.12, 0.26, -0.5, 2.43, 3.85, mid); box(0.5, 0.012, 0.05, -0.5, 2.5, 3.75, glow); box(0.2, 0.5, 0.15, -0.5, 2.1, 3.65, mid); pos = [-0.5, 2.36, 3.62]; R = 0.24; tilt = 0.3; }
    const sw = new THREE.Group(); sw.position.set(...pos); sw.rotation.x = tilt; const inner = new THREE.Group(); sw.add(inner);
    inner.add(new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.14, 8, 28), mid));
    for (const [w, h] of [[R * 1.9, R * 0.16], [R * 0.16, R * 0.95]]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(w, h, R * 0.1), mid); if (h > w) sp.position.y = -R * 0.47; inner.add(sp); }
    inner.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.3, R * 0.3, R * 0.2, 12).rotateX(Math.PI / 2), dark));
    g.add(sw); this.model.add(g); this.cockpit = g; this.sw = inner;
  }
  setView(v) {
    this.view = v; const fp = v === 'first';
    if (this.model) this.model.traverse(o => {                       // windows must be see-through from the inside (the models' glass is opaque)
      if (o.name === 'Cab' || o.name === 'Cabin') o.visible = !fp;
      if (!o.isMesh) return; [].concat(o.material).forEach(m => { if (m.name === 'Glass') { m.colorWrite = !fp; m.depthWrite = !fp; } });
    });
    if (this.cockpit) this.cockpit.visible = fp; for (const o of this.riderObjs || []) o.visible = !fp; for (const gl of this.glows || []) gl.sp.visible = !fp;
    this.camera.near = fp ? 0.18 : 0.3; this.camera.updateProjectionMatrix();
  }
  rebuildAll() { for (const v of this.chunks.values()) v.dispose(); this.chunks.clear(); this.updateChunks(true); }
  configure(o) {
    if (o.time && o.time !== this.time) this.setTime(o.time);
    if ('view' in o && !this.demo) this.setView(o.view);
    if ('lights' in o) this.headMode = o.lights;
    if ('weather' in o) { this.fixedWx = o.weather === 'auto' ? null : o.weather; if (!this.fixedWx) this.wxTimer = 0; }
    if ('season' in o && o.season !== this.season) { this.season = o.season; this._ck = null; this.rebuildAll(); }
    if ('area' in o && o.area !== this.areaName) { this.areaName = o.area; this.world.setArea(o.area); this.rebuildAll(); }
    if ('climate' in o) { const nc = o.climate === 'auto' ? null : o.climate; if (nc !== this.fixedClim) { this.fixedClim = nc; this._ck = null; for (const v of this.chunks.values()) v.dispose(); this.chunks.clear(); this.updateChunks(true); } }
  }
  applyPR() { this.renderer.setPixelRatio(Math.min(devicePixelRatio, (this.q || QUALITY.med).pr) * this.prScale); this.resize(); }
  resize() { const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setTime(name) {
    this.time = name; if (name === 'auto' && this.tod === undefined) this.tod = 0.30; const T = this.curT(); const u = this.skyMat.uniforms;
    u.top.value.set(T.top); u.mid.value.set(T.mid); u.bot.value.set(T.bot); u.sunDir.value.set(...T.sun); u.sunCol.value.setRGB(...T.sunCol);
    this.fogCol = new THREE.Color(T.bot); this.scene.fog = new THREE.Fog(this.fogCol, 60, this.fogFar || 420);
    this.sunL.color.set(T.light); this.sunL.intensity = T.li; this.fill.color.set(T.hs); this.fill.intensity = name === 'night' ? 0.25 : 0.7; this.hemi.color.set(T.hs); this.hemi.groundColor.set(T.hg); this.hemi.intensity = T.hi;
    const u2 = this.skyMat.uniforms; u2.cloudCol.value.setRGB(...T.cc); u2.cloudAmt.value = T.ca; this.mtnBase.set(T.mtn);
    this.stars.material.opacity = T.stars; this.stars.visible = T.stars > 0.1; this.sunDirV = new THREE.Vector3(...T.sun).normalize();
    this.tintFar(); if (this.world) this.applyWorld(0);
  }
  buildFar() {
    if (this.far) this.far.forEach(f => { this.scene.remove(f.m); f.m.geometry.dispose(); });
    this.far = [];
    for (const [rad, hmin, hamp, mix, seed] of [[1000, 70, 230, 0.55, 1], [940, 40, 130, 0.35, 2]]) {
      const N = 128, pos = [], idx = [];
      for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, nx = Math.cos(a) * 3 + seed * 11, nz = Math.sin(a) * 3 + seed * 7;
        const h = hmin + this.world.fbm(nx, nz) * hamp + this.world.fbm(nx * 4, nz * 4) * 35;
        pos.push(Math.sin(a) * rad, -40, -Math.cos(a) * rad, Math.sin(a) * rad, h, -Math.cos(a) * rad); if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length), 3)); g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, depthWrite: false })); m.renderOrder = 0; m.frustumCulled = false; this.scene.add(m); this.far.push({ m, mix });
    }
    this.tintFar();
  }
  tintFar() {
    if (!this.far || !this.fogCol) return; const top = new THREE.Color(), hi = new THREE.Color();
    for (const f of this.far) { top.copy(this.mtnCol).lerp(this.fogCol, Math.min(1, f.mix + (1 - f.mix) * (1 - this.wcur.fogMul) * 0.9)); const c = f.m.geometry.attributes.color, p = f.m.geometry.attributes.position;
      for (let i = 0; i < c.count; i++) { const k = Math.min(1, Math.max(0, (p.getY(i) + 40) / 260)); hi.copy(this.fogCol).lerp(top, 0.25 + 0.75 * smooth(0, 0.7, k)); c.setXYZ(i, hi.r, hi.g, hi.b); }
      c.needsUpdate = true; }
  }
  makeGlow() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 1, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  addGlows(id) {
    const L = LIGHTS[id]; if (!L) return; this.glowT = this.glowT || this.makeGlow(); this.glows = [];
    const mk = (pos, col, size, kind) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowT, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 }));
      sp.position.set(...pos); sp.scale.setScalar(size); this.model.add(sp); this.glows.push({ sp, kind }); };
    for (const p of L.tail) mk(p, 0xff2a14, L.ts, 'tail'); for (const p of L.head) mk(p, 0xfff0d0, L.hs, 'head'); if (this.view === 'first') for (const gl of this.glows) gl.sp.visible = false;
    this.tailMats = []; this.model.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => { if (m.name === 'Light_Tail' && !this.tailMats.includes(m)) this.tailMats.push(m); }); });
  }
  lightFx() {
    const brake = !this.demo && (this.keys.down || this.pad.down > 0.1) && this.v > 1, on = this.lightsNow;
    for (const m of this.tailMats || []) m.emissiveIntensity = brake ? 8 : (on ? 3 : 1.5);
    const rev = !this.demo && this.v < -0.3;
    for (const g of this.glows || []) { if (g.kind === 'tail') g.sp.material.color.setHex(rev ? 0xffffff : 0xff2a14); g.sp.material.opacity = g.kind === 'tail' ? (rev ? 0.95 : brake ? 1 : (on ? 0.7 : 0.18)) : (on ? 0.9 : 0.1); }
  }
  lightEmit() { this.model.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => { if (m.name === 'Light_Head') m.emissiveIntensity = this.lightsNow ? 4 : 0.6; if (m.name === 'Light_Tail') m.emissiveIntensity = this.lightsNow ? 3 : 1.5; }); }); }

  /* ---------- chunks ---------- */
  buildChunk(ci) {
    const w = this.world, i0 = ci * ROWS; w.ensure(i0 + ROWS + 2);
    const ox = w.xs[i0], oy = w.ys[i0], oz = w.zs[i0], seed = (w.seed ^ (ci * 7919 + 13)) | 0, R = rng(seed), g = new THREE.Group();
    g.position.set(ox, oy, oz);
    const nT = TOFF.length, vpr = nT * 2, dirt0 = [0.55, 0.47, 0.34], rock0 = [0.55, 0.52, 0.48], Cm = this.clim((i0 + ROWS / 2) * DS), rock = rock0.map((v, c) => lerp(v, Cm.g1[c], Cm.g1[2] > 1.2 ? 0.6 : 0));
    const gp = new Float32Array((ROWS + 1) * vpr * 3), gc = new Float32Array((ROWS + 1) * vpr * 3), gu = new Float32Array((ROWS + 1) * vpr * 2), gi = [];
    const rp = [], rc = [], ru = [], ri = [], mp = [], mc = [], mi = [], lp = [], lc = [], li = [], railPosts = [], chevs = [], limits = [];
    const quad = (arr, a, b, c, d, flip) => flip ? arr.push(a, c, b, b, c, d) : arr.push(a, b, c, b, d, c);
    for (let r = 0; r <= ROWS; r++) {
      const i = i0 + r, x = w.xs[i], z = w.zs[i], ry = w.ys[i], th = w.th[i], cx = Math.cos(th), sz = Math.sin(th), s0 = i * DS, C = this.clim(s0), grass = C.g1, grass2 = C.g2, dry = C.dry, dirt = dirt0.map((v, c) => lerp(v, C.g2[c], 0.55));
      for (let side = 0; side < 2; side++) for (let j = 0; j < nT; j++) {
        const t = (side ? 1 : -1) * TOFF[j], wx = x + cx * t, wz = z + sz * t, y = w.ter(t, wx, wz, ry), k = (r * vpr + side * nT + j) * 3;
        gp[k] = wx - ox; gp[k + 1] = y - oy; gp[k + 2] = wz - oz; gu[(r * vpr + side * nT + j) * 2] = wx * 0.11; gu[(r * vpr + side * nT + j) * 2 + 1] = wz * 0.11;
        const n = w.fbm(wx * 0.04, wz * 0.04), m = smooth(5.4, 7.4, Math.abs(t)), h = smooth(-6, 14, y - ry);
        const patch = smooth(0.52, 0.72, w.fbm(wx * 0.012 + 40, wz * 0.012)) * Math.min(1.4, C.patch * 2); for (let c = 0; c < 3; c++) { const base = lerp(lerp(grass[c], grass2[c], n * 0.7 + h * 0.4), dry[c], patch * 0.7); gc[k + c] = lerp(dirt[c], base, m) * (0.9 + 0.2 * w.vn(wx * 0.3, wz * 0.3)); }
        { const below = y - ry - C.wl - w.A.wl, wet = 1 - smooth(-0.4, 0.7, below), sand = smooth(0.35, 0.9, below) * (1 - smooth(0.9, 1.9, below)); for (let c = 0; c < 3; c++) { const mud = [0.28, 0.24, 0.17][c], snd = [0.66, 0.58, 0.40][c]; gc[k + c] = lerp(lerp(gc[k + c], snd, sand * 0.5), mud, wet * 0.85); } }
        { const hh = y - ry, cf = w.cliff(wx, wz) * smooth(12, 19, Math.abs(t)), rk = Math.max(smooth(30, 58, hh) * 0.95, cf * 0.9), cap = smooth(55, 88, hh) * C.cap, strata = 0.86 + 0.14 * Math.sin(y * 1.9 + w.fbm(wx * 0.05, wz * 0.05) * 6);
          for (let c = 0; c < 3; c++) { const rc = lerp([0.50, 0.47, 0.43][c], C.mtn[c] * 1.25, C.mtnA * 0.85) * strata; gc[k + c] = lerp(lerp(gc[k + c], rc, rk), [0.93, 0.95, 1.0][c], cap); } }
      }
      // road: gravel | asphalt | gravel (duplicated verts at the edges keep the colour change sharp)
      const cols = [[-5.4, 0], [-4, 0], [-4, 1], [4, 1], [4, 0], [5.4, 0]];
      for (const [t, asph] of cols) {
        const edge = Math.abs(t) > 5, y = edge ? w.ter(t, x + cx * t, z + sz * t, ry) : ry - (asph ? 0 : 0.02);
        rp.push(x + cx * t - ox, y - oy, z + sz * t - oz);
        if (asph) rc.push(0.78, 0.78, 0.80); else rc.push(lerp(0.85, C.g2[0], 0.3), lerp(0.82, C.g2[1], 0.3), lerp(0.76, C.g2[2], 0.3));
        ru.push((t + 5.4) / 10.8, s0 / 9);
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let side = 0; side < 2; side++) for (let j = 0; j < nT - 1; j++) {
        const a = r * vpr + side * nT + j; quad(gi, a, a + 1, a + vpr, a + vpr + 1, side === 0);
      }
      const b = r * 6; for (const c of [0, 2, 4]) quad(ri, b + c, b + c + 1, b + c + 6, b + c + 7, false);
      { const kap = (w.th[i0 + r + 1] - w.th[i0 + r]) / DS;                  // guardrail on the outside of tight bends
        if (Math.abs(kap) > 0.0034) { const t = (kap > 0 ? -1 : 1) * 6.0, v = lp.length / 3;
          for (const rr of [r, r + 1]) { const ii = i0 + rr, cx2 = Math.cos(w.th[ii]), sz2 = Math.sin(w.th[ii]), yy = w.ys[ii] - 0.02;
            for (const hh of [0.45, 0.78]) { lp.push(w.xs[ii] + cx2 * t - ox, yy + hh - oy, w.zs[ii] + sz2 * t - oz); lc.push(0.72, 0.74, 0.77); } }
          li.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
          if (r % 6 === 0) { const ii = i0 + r, tt = t * 1.12; chevs.push([w.xs[ii] + Math.cos(w.th[ii]) * tt - ox, w.ys[ii] - 0.1 - oy, w.zs[ii] + Math.sin(w.th[ii]) * tt - oz, -w.th[ii], kap > 0 ? 1 : -1]); }
          if (r % 2 === 0) railPosts.push([w.xs[i0 + r] + Math.cos(w.th[i0 + r]) * t - ox, w.ys[i0 + r] - 0.05 - oy, w.zs[i0 + r] + Math.sin(w.th[i0 + r]) * t - oz, -w.th[i0 + r]]); } }
      // lane markings: dashed centre line, solid edge lines
      const s = (i0 + r) * DS;
      for (const [t0, wd, dashed] of [[0, 0.16, true], [-3.6, 0.16, false], [3.6, 0.16, false]]) {
        if (dashed && Math.floor(s / 4) % 2) continue;
        const v = mp.length / 3;
        for (const rr of [r, r + 1]) { const i = i0 + rr, th = w.th[i], cx = Math.cos(th), sz = Math.sin(th);
          for (const tt of [t0 - wd / 2, t0 + wd / 2]) { mp.push(w.xs[i] + cx * tt - ox, w.ys[i] + 0.035 - oy, w.zs[i] + sz * tt - oz); mc.push(0.88, 0.86, 0.78); } }
        quad(mi, v, v + 1, v + 2, v + 3, false);
      }
    }
    const geo = (p, c, idx, uv) => { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3)); gg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(c), 3)); if (uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2)); gg.setIndex(idx); gg.computeVertexNormals(); return gg; };
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); tg.setAttribute('color', new THREE.BufferAttribute(gc, 3)); tg.setAttribute('uv', new THREE.BufferAttribute(gu, 2)); tg.setIndex(gi); tg.computeVertexNormals();
    { const nn = tg.attributes.normal; for (let v = 0; v < nn.count; v++) { const m = Math.min(1, Math.max(0, (0.86 - nn.getY(v)) / 0.2)) ; if (m > 0) for (let c = 0; c < 3; c++) gc[v * 3 + c] = lerp(gc[v * 3 + c], rock[c], m * 0.85); } tg.attributes.color.needsUpdate = true; }
    const meshes = [new THREE.Mesh(tg, this.groundMat), new THREE.Mesh(geo(rp, rc, ri, ru), this.roadMat), new THREE.Mesh(geo(mp, mc, mi), this.markMat)];
    if (li.length) meshes.push(new THREE.Mesh(geo(lp, lc, li), this.railMat));
    if (Cm.wl > -20) {                                                    // lakes and rivers: the water follows the road's slope, 3 m below it
      const TW = [-110, -70, -40, -12, 12, 40, 70, 110], wp = [], wu = [], wi = [], nc = TW.length;
      for (let r = 0; r <= ROWS; r++) { const i = i0 + r, th = w.th[i], cx2 = Math.cos(th), sz2 = Math.sin(th), lvl = w.ys[i] + this.clim(i * DS).wl + w.A.wl;
        for (const t of TW) { const wx = w.xs[i] + cx2 * t, wz = w.zs[i] + sz2 * t; wp.push(wx - ox, lvl - oy, wz - oz); wu.push(wx * 0.07, wz * 0.07); } }
      for (let r = 0; r < ROWS; r++) for (let j = 0; j < nc - 1; j++) { const a = r * nc + j; wi.push(a, a + 1, a + nc, a + 1, a + nc + 1, a + nc); }
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wp), 3)); wg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(wu), 2)); wg.setIndex(wi); wg.computeVertexNormals();
      const wm = new THREE.Mesh(wg, this.waterMat); wm.renderOrder = 1; g.add(wm);
    }
    meshes.forEach(m => { m.receiveShadow = this.shadows; g.add(m); });
    // trees, rocks and delineator posts
    const q = new THREE.Quaternion(), e = new THREE.Euler(), M = new THREE.Matrix4(), P = new THREE.Vector3(), S = new THREE.Vector3(), col = new THREE.Color();
    const lists = { pine: [], round: [], rock: [], post: [], bush: [], tuft: [], cactus: [] };
    const count = Math.round(26 * this.q.trees * Cm.dens * w.A.dens), T3 = (arr, t) => [...arr, 0, t[0], t[1], t[2]];
    for (let side = -1; side <= 1; side += 2) for (let n = 0; n < count + Math.round(4 * Cm.rock * this.q.trees); n++) {
      const t = side * (9 + Math.pow(R(), 1.5) * 75), s = (i0 + R() * ROWS) * DS, p = w.at(s), wx = p.x + Math.cos(p.th) * t, wz = p.z + Math.sin(p.th) * t, y = w.ter(t, wx, wz, p.y), C = this.clim(s);
      if (y - p.y < C.wl + w.A.wl + 0.9) continue;
      if (y - p.y > 40 || w.cliff(wx, wz) * smooth(12, 19, Math.abs(t)) > 0.2) { if (R() < 0.4) lists.rock.push([wx - ox, y - oy + 0.1, wz - oz, 0.8 + R() * 2.2, R() * 6.28, 0.55 + R() * 0.5]); continue; }
      const f = w.fbm(wx * 0.01, wz * 0.01), kind = R();
      if (kind < C.rock + (n >= count ? 1 : 0)) { lists.rock.push([wx - ox, y - oy + 0.1, wz - oz, 0.5 + R() * 1.7, R() * 6.28, 0.55 + R() * 0.5]); continue; }
      if (n >= count) continue;
      if (f < 0.32 && R() < 0.6) continue;
      const sc = 0.75 + R() * 0.85, pine = R() < C.pine; lists[pine ? 'pine' : 'round'].push(T3([wx - ox, y - oy - 0.15, wz - oz, sc, R() * 6.28, 0.9 + R() * 0.3], pine ? C.pineT : C.leaf));
    }
    for (let side = -1; side <= 1; side += 2) for (let n = 0, cnt = Math.round(16 * this.q.trees * Cm.dens * w.A.dens); n < cnt; n++) {     // distant forest on the mountain foothills
      const t = side * (86 + R() * 95), s = (i0 + R() * ROWS) * DS, p = w.at(s), wx = p.x + Math.cos(p.th) * t, wz = p.z + Math.sin(p.th) * t, y = w.ter(t, wx, wz, p.y), C = this.clim(s);
      if (y - p.y < C.wl + w.A.wl + 0.9 || y - p.y > 52) continue; const pine = R() < Math.min(1, C.pine + 0.25);
      lists[pine ? 'pine' : 'round'].push(T3([wx - ox, y - oy - 0.15, wz - oz, 1.0 + R() * 1.1, R() * 6.28, 0.9 + R() * 0.3], pine ? C.pineT : C.leaf));
    }
    for (let side = -1; side <= 1; side += 2) {
      for (let n = 0, cnt = Math.round(10 * this.q.trees * Cm.dens * w.A.dens); n < cnt; n++) {     // shrubs near the verge
        const t = side * (7 + R() * 9), s = (i0 + R() * ROWS) * DS, p = w.at(s), wx = p.x + Math.cos(p.th) * t, wz = p.z + Math.sin(p.th) * t, C = this.clim(s);
        if (w.ter(t, wx, wz, p.y) - p.y < C.wl + w.A.wl + 0.9 || w.cliff(wx, wz) * smooth(12, 19, Math.abs(t)) > 0.2) continue;
        lists.bush.push(T3([wx - ox, w.ter(t, wx, wz, p.y) - oy - 0.05, wz - oz, 0.6 + R() * 0.9, R() * 6.28, 0.8 + R() * 0.5], C.leaf));
      }
      for (let n = 0, cnt = Math.round(46 * this.q.trees * Cm.tuft * w.A.tuft); n < cnt; n++) {     // grass tufts and flowers
        const t = side * (5.7 + Math.pow(R(), 1.4) * 22), s = (i0 + R() * ROWS) * DS, p = w.at(s), wx = p.x + Math.cos(p.th) * t, wz = p.z + Math.sin(p.th) * t, C = this.clim(s);
        if (w.ter(t, wx, wz, p.y) - p.y < C.wl + w.A.wl + 0.9 || w.cliff(wx, wz) * smooth(12, 19, Math.abs(t)) > 0.2) continue;
        lists.tuft.push(T3([wx - ox, w.ter(t, wx, wz, p.y) - oy - 0.02, wz - oz, 0.42 + R() * 0.6, R() * 6.28, 0.8 + R() * 0.5], C.tuftT));
      }
      for (let n = 0, cnt = Math.round(7 * this.q.trees * Cm.cactus); n < cnt; n++) {     // cacti in the desert
        const t = side * (7 + R() * 40), s = (i0 + R() * ROWS) * DS, p = w.at(s), wx = p.x + Math.cos(p.th) * t, wz = p.z + Math.sin(p.th) * t;
        lists.cactus.push([wx - ox, w.ter(t, wx, wz, p.y) - oy - 0.05, wz - oz, 0.8 + R() * 1.0, R() * 6.28, 0.9 + R() * 0.3]);
      }
    }
    for (let s = Math.ceil(i0 * DS / 20) * 20; s < (i0 + ROWS) * DS; s += 20) for (const side of [-1, 1]) {
      const p = w.at(s), t = side * 5.8, wx = p.x + Math.cos(p.th) * t, wz = p.z + Math.sin(p.th) * t;
      lists.post.push([wx - ox, w.ter(t, wx, wz, p.y) - oy, wz - oz, 1, 0, 1]);
    }
    const POLE = 48, pl = [];
    for (let sp = Math.ceil(i0 * DS / POLE) * POLE; sp < (i0 + ROWS) * DS; sp += POLE) pl.push(sp);
    for (const sp of pl) {
      const side = -1, t = side * 10.5, A = w.at(sp), B = w.at(sp + POLE), pos = (p, tt) => { const wx = p.x + Math.cos(p.th) * tt, wz = p.z + Math.sin(p.th) * tt; return [wx, w.ter(tt, wx, wz, p.y), wz]; };
      const a0 = pos(A, t); lists.pole = lists.pole || []; lists.pole.push([a0[0] - ox, a0[1] - oy, a0[2] - oz, 1, -A.th, 1]);
      const b0 = pos(B, t), segs = [];
      for (const off of [-1, 0, 1]) { let prev = null;
        for (let u = 0; u <= 8; u++) { const f = u / 8, th = lerp(A.th, B.th, f), px = lerp(a0[0], b0[0], f) + Math.cos(th) * off, pz = lerp(a0[2], b0[2], f) + Math.sin(th) * off, py = lerp(a0[1], b0[1], f) + 8.0 - 1.1 * (1 - Math.pow(2 * f - 1, 2));
          const cur = [px - ox, py - oy, pz - oz]; if (prev) segs.push(...prev, ...cur); prev = cur; } }
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3)); g.add(new THREE.LineSegments(wg, this.wireMat));
    }
    for (let sp2 = Math.ceil(i0 * DS / 800) * 800; sp2 < (i0 + ROWS) * DS; sp2 += 800) { const p2 = w.at(sp2), tt = 6.9, wx2 = p2.x + Math.cos(p2.th) * tt, wz2 = p2.z + Math.sin(p2.th) * tt; limits.push([wx2 - ox, w.ter(tt, wx2, wz2, p2.y) - oy, wz2 - oz, -p2.th]); }
    lists.signpole = [...chevs, ...limits].map(a => [a[0], a[1], a[2], 1, 0, 1]); lists.chev = chevs.map(a => [a[0], a[1] + 1.65, a[2], a[4], a[3], a[4]]); lists.limit = limits.map(a => [a[0], a[1] + 2.05, a[2], 1, a[3], 1]);
    if (railPosts.length) lists.railpost = railPosts.map(p => [p[0], p[1], p[2], 1, p[3], 1]);
    const fill = (geom, mat, arr, jitter) => {
      const im = new THREE.InstancedMesh(geom, mat, arr.length);
      arr.forEach((a, n) => { P.set(a[0], a[1], a[2]); q.setFromEuler(e.set(0, a[4], 0)); S.set(a[3], a[3] * (a[5] || 1), a[3]); im.setMatrixAt(n, M.compose(P, q, S));
        const v = 0.80 + a[6] * 0.4, tr = a[7] ?? 1, tg = a[8] ?? 1, tb = a[9] ?? 1; im.setColorAt(n, jitter ? col.setRGB(v * tr, v * (0.94 + a[6] * 0.12) * tg, v * (0.92 + a[6] * 0.1) * tb) : col.setRGB(1, 1, 1)); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); g.add(im); return im;
    };
    for (const k of ['pine', 'round']) { const arr = lists[k].map(a => { a[6] = R(); return a; }); if (!arr.length) continue; const tm = fill(this.props[k].trunk, this.lam, arr, false), fm = fill(this.props[k].foliage, this.props[k].mat, arr, true); if (this.treeShadows) { tm.castShadow = true; fm.castShadow = true; fm.customDepthMaterial = this.props[k].depth; } }
    for (const k of ['bush', 'tuft']) if (lists[k].length) fill(this.props[k].foliage, this.props[k].mat, lists[k].map(a => { a[6] = R(); return a; }), true);
    if (lists.cactus.length) fill(this.props.cactus, this.lam, lists.cactus.map(a => [...a, R()]), true);
    if (lists.rock.length) fill(this.props.rock, this.lam, lists.rock.map(a => [...a, R()]), true);
    if (lists.signpole.length) fill(this.props.signpole, this.lam, lists.signpole.map(a => [...a, 0.5]), false);
    for (const k of ['chev', 'limit']) if (lists[k].length) fill(this.props[k].foliage, this.props[k].mat, lists[k].map(a => [...a, 0.5]), false);
    if (lists.pole && lists.pole.length) fill(this.props.pole, this.lam, lists.pole.map(a => [...a, 0.5]), false);
    if (lists.railpost && lists.railpost.length) fill(this.props.railpost, this.lam, lists.railpost.map(a => [...a, 0.5]), false);
    if (lists.post.length) fill(this.props.post, this.lam, lists.post.map(a => [...a, 0.5]), false);
    this.scene.add(g);
    return { g, dispose: () => { this.scene.remove(g); g.traverse(o => { if (o.isMesh && !this.sharedGeo.has(o.geometry)) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); }); } };
  }
  updateChunks(force) {
    const c = Math.floor(this.s / CH), lo = Math.max(0, c - 2), hi = c + this.q.ahead;
    for (const [k, v] of this.chunks) if (k < lo || k > hi) { v.dispose(); this.chunks.delete(k); }
    const t0 = performance.now();
    for (let k = lo; k <= hi; k++) if (!this.chunks.has(k)) { this.chunks.set(k, this.buildChunk(k)); if (!force && performance.now() - t0 > 5) break; }
  }

  /* ---------- run control ---------- */
  start({ id, model, stats, buff, time = 'dusk', quality = 'med', weather = 'auto', climate = 'auto', demo = false, view = 'third', lights = 'auto', season = 'summer', area = 'mixed' }) {
    this.season = season; this.areaName = area;
    this.headMode = lights; this.tod = 0.30; this._hl = 0;
    this.demo = demo; this.demoT = 0;
    this.stop(); this.q = QUALITY[quality] || QUALITY.med; this.fogFar = this.q.ahead * CH * 0.9;
    this.prScale = 1; this.adaptT = -3; this.applyPR();
    this.world = new World((Math.random() * 1e9) | 0); this.world.setArea(area); this.def = VEH[id] || VEH.car; this.id = id; this.stats = stats; this.buff = buff;
    this.treeShadows = quality === 'high'; this.shadows = quality !== 'low'; this.renderer.shadowMap.enabled = this.shadows;
    this.sunL.castShadow = this.shadows; const sh = this.sunL.shadow, ext = id === 'truck' ? 30 : 17; sh.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    Object.assign(sh.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: 700 }); sh.camera.updateProjectionMatrix(); sh.bias = -0.0006; sh.normalBias = 0.05; if (sh.map) { sh.map.dispose(); sh.map = null; }
    this.zones = ['temperate']; this.zr = rng(this.world.seed + 991); this.fixedClim = climate === 'auto' ? null : climate; this.fixedWx = weather === 'auto' ? null : weather;
    this.wxTarget = this.fixedWx || 'clear'; this.wxTimer = 40 + Math.random() * 40; this.wcur = { ...WX[this.wxTarget] }; this.flash = 0; this.flashT = 4; this._ck = null; this._lab = null; this.s = 100; this.cNow = this.clim(350); this.cName = this.fixedClim || 'temperate';
    this.setTime(time); this.buildFar();
    if (this.model) this.scene.remove(this.model);
    this.model = model.clone(true); this.model.rotation.order = 'YXZ'; this.model.traverse(o => { if (o.isMesh) o.castShadow = this.shadows; }); this.shadow.visible = !this.shadows; this.model.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => { if ('envMapIntensity' in m) m.envMapIntensity = name_night(time) ? 0.35 : 0.7; }); }); this.scene.add(this.model); this.lightEmit();
    if (this.head) { this.head.parent && this.head.parent.remove(this.head); this.head = null; }
    { const o = { car: [0.7, 2.3], truck: [1.5, 6.1], bike: [0.8, 0.95] }[id] || [0.7, 2]; const sp = new THREE.SpotLight(0xfff1d6, 0, 90, 0.5, 0.65, 1.2);
      sp.position.set(0, o[0], o[1]); sp.target.position.set(0, 0.1, o[1] + 25); this.model.add(sp, sp.target); this.head = sp; }
    this.buildCockpit(id); this.riderObjs = []; this.model.traverse(o => { if (o.name === 'Rider') this.riderObjs.push(o); }); this.setView(demo ? 'third' : view);
    this.addGlows(id); this.lightsNow = false; this.lightEmit(); this.applyWorld(0);
    this.wheels = []; this.model.traverse(o => { if (/^Wheel_/.test(o.name) && !o.isMesh) { o.rotation.order = 'YXZ'; this.wheels.push({ o, front: /^Wheel_F/.test(o.name), spin: 0 }); } });
    this.s = 100; this.x = 0; this.psi = 0; this.v = 0; this.steerIn = 0; this.dist = 0; this.cd = 0; this.buffT = 0; this.camHead = 0; this.camInit = false; this.roll = 0;
    this.updateChunks(true); this.place(0); this.running = true; this.paused = false; this.last = performance.now(); requestAnimationFrame(this._loop);
  }
  stop() { this.running = false; if (this.model) this.setView('third'); for (const v of this.chunks.values()) v.dispose(); this.chunks.clear(); }
  pause() { this.running = false; this.paused = true; }
  resume() { if (!this.world || this.running) return; this.running = true; this.paused = false; this.last = performance.now(); requestAnimationFrame(this._loop); }
  useBuff() { if (!this.running || this.cd > 0) return false; this.cd = this.buff[3]; this.buffT = this.id === 'car' ? 4 : 5; return true; }

  frame(t) {
    if (!this.running) return; requestAnimationFrame(this._loop);
    const raw = (t - this.last) / 1000; this.fpsA = this.fpsA * 0.93 + raw * 0.07; this.adaptT += raw;
    if (this.adaptT > 2.5 && !document.hidden) { this.adaptT = 0; const fps = 1 / this.fpsA; if (fps < 38 && this.prScale > 0.6) { this.prScale = Math.max(0.6, this.prScale - 0.15); this.applyPR(); } else if (fps > 57 && this.prScale < 1) { this.prScale = Math.min(1, this.prScale + 0.1); this.applyPR(); } }
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t; this.skyMat.uniforms.time.value = t / 1000; WIND.t.value = t / 1000; WIND.a.value = 1 + this.wcur.rain * 1.4 + this.wcur.snow * 0.3; this.update(dt); this.renderer.render(this.scene, this.camera);
  }
  update(dt) {
    const k = this.demo ? { left: 0, right: 0, up: 0, down: 0 } : this.keys, pd = this.demo ? null : this.pad, upA = Math.max(k.up, pd ? pd.up : 0), dnA = (k.down || (pd && pd.down > 0.1)) ? 1 : 0, stA = Math.max(-1, Math.min(1, (k.right - k.left) + (pd ? pd.steer : 0))), st = this.stats, d = this.def, top = st.Top / 3.6 * (this.buffT > 0 && this.id === 'car' ? 1.3 : 1), acc = 0.8 + st.Accel * 0.05 * (this.buffT > 0 && this.id === 'car' ? 1.6 : 1);
    const p = this.world.at(this.s), off = Math.abs(this.x) > 4.4;
    // speed: gentle auto-cruise unless the player accelerates or brakes
    // speed: hold accelerate to speed up, brake to slow quickly; letting go coasts to a stop in a few seconds (about 6 s from 100 km/h)
    const coast = this.id === 'truck' ? 0.75 : this.id === 'bike' ? 1.1 : 1, revMax = this.id === 'truck' ? 4.5 : this.id === 'bike' ? 5 : 7, revAcc = this.id === 'truck' ? 1.6 : 2.6;
    if (this.demo) this.v += (Math.min(top, 20) - this.v) * Math.min(1, dt * 0.5);
    else if (upA) this.v += (this.v < 0 ? 16 : acc * Math.max(0.35, upA)) * dt;                      // braking out of reverse first, then forward
    else if (dnA) this.v -= (this.v > 0.4 ? 14 : revAcc) * dt;               // brake to a stop, then keep holding to reverse
    else { const dr = (3 + 0.12 * Math.abs(this.v)) * coast * dt; this.v = this.v > 0 ? Math.max(0, this.v - dr) : Math.min(0, this.v + dr); }
    this.v -= 9.8 * p.slope * dt * (this.id === 'truck' && this.buffT > 0 ? 0 : 0.65);
    if (off && !(this.id === 'truck' && this.buffT > 0)) this.v -= Math.sign(this.v) * (this.id === 'truck' ? 2 : 5) * dt * Math.min(1, Math.abs(this.v) / 8);
    this.v = Math.max(-revMax, Math.min(top, this.v)); if (!upA && !dnA && Math.abs(this.v) < 0.08) this.v = 0;
    // steering
    const target = stA; this.steerIn += (target - this.steerIn) * Math.min(1, dt * 7);
    const gain = (this.id === 'bike' && this.buffT > 0 ? 1.5 : 1), delta = this.steerIn * d.steer * gain / (1 + Math.pow(this.v / 26, 2));
    const yaw = this.v / d.L * Math.tan(delta);
    const dsdt = this.v * Math.cos(this.psi) / (1 - p.kappa * this.x);
    this.psi += (yaw - p.kappa * dsdt) * dt;
    if (Math.abs(stA) < 0.05) this.psi -= this.psi * Math.min(1, dt * 1.6);          // calm self-straightening
    if (off) this.psi -= Math.sign(this.x) * Math.min(0.5, (Math.abs(this.x) - 4.4) * 0.05) * dt * 3; // shoulder pushes back
    this.psi = Math.max(-0.9, Math.min(0.9, this.psi));
    this.x += this.v * Math.sin(this.psi) * dt; if (Math.abs(this.x) > 9) { this.x = Math.sign(this.x) * 9; this.psi *= 0.4; }
    this.s += dsdt * dt; if (this.s < 30) { this.s = 30; if (this.v < 0) this.v = 0; } this.dist += Math.abs(this.v) * dt;
    this.buffT = Math.max(0, this.buffT - dt); this.cd = Math.max(0, this.cd - dt);
    this.updateChunks(false); this.place(dt); this.updateWorld(dt); this.lightFx();
    if (!this.demo && this.hooks.onAudio) this.hooks.onAudio({ v: Math.abs(this.v), rev: this.v < -0.3, top, throttle: upA || 0.06, rain: this.wcur.rain, flash: this.flash, buff: this.buffT > 0, id: this.id, brake: !!dnA && this.v > 1, off: Math.abs(this.x) > 4.4, view: this.view });
    if (!this.demo && this.hooks.onFrame) this.hooks.onFrame({ kmh: this.v * 3.6, distKm: this.dist / 1000, cd: this.cd, cdMax: this.buff[3], buff: this.buffT > 0 });
  }
  place(dt) {
    const w = this.world, p = w.at(this.s), cx = Math.cos(p.th), sz = Math.sin(p.th), m = this.model, d = this.def;
    m.position.set(p.x + cx * this.x, p.y, p.z + sz * this.x);
    const head = p.th + this.psi; m.rotation.y = Math.PI - head; m.rotation.x = -Math.atan(p.slope);
    const lean = -this.steerIn * Math.min(1, Math.abs(this.v) / 25) * d.lean; this.roll += (lean - this.roll) * Math.min(1, (dt || 1) * 5); m.rotation.z = this.roll;
    const r = d.wr; for (const wh of this.wheels) { wh.spin += this.v * (dt || 0) / r; wh.o.rotation.x = wh.spin; wh.o.rotation.y = wh.front ? -this.steerIn * d.steer * 0.9 : 0; }
    this.shadow.position.set(m.position.x, p.y + 0.06, m.position.z); this.shadow.rotation.z = -head + Math.PI; this.shadow.scale.set(this.id === 'bike' ? 2.2 : 3.4, this.id === 'truck' ? 15 : this.id === 'bike' ? 3.2 : 6, 1);
    // chase camera: follows the road heading smoothly
    const camTarget = p.th + this.psi * 0.45;
    if (!this.camInit) { this.camHead = camTarget; this.camInit = true; }
    let df = camTarget - this.camHead; df = Math.atan2(Math.sin(df), Math.cos(df)); this.camHead += df * Math.min(1, (dt || 1) * 3);
    this.demoT += dt || 0; const cam0 = d.cam, c = this.demo ? { back: cam0.back * 1.1, up: cam0.up * 0.85, look: cam0.look } : cam0, ang = this.camHead + (this.demo ? Math.sin(this.demoT * 0.11) * 0.55 : 0), dx = Math.sin(ang), dz = -Math.cos(ang);
    const fp = this.view === 'first' && !this.demo;
    if (!fp) this.camera.position.set(m.position.x - dx * c.back, m.position.y + c.up, m.position.z - dz * c.back);
    if (!this.demo) { const sh = Math.min(1, Math.abs(this.v) / 40) * 0.014 * (this.buffT > 0 ? 2.4 : 1), tt = this.demoT; this.camera.position.x += Math.sin(tt * 43) * Math.sin(tt * 11) * sh; this.camera.position.y += Math.sin(tt * 37 + 1) * Math.sin(tt * 13) * sh; }
    if (fp) {                                                              // driver's eyes
      m.updateMatrixWorld(true); const e = EYES[this.id]; this.eye.set(e[0], e[1], e[2]); m.localToWorld(this.eye); this.camera.position.copy(this.eye);
      const sh2 = Math.min(1, Math.abs(this.v) / 40) * 0.006 * (this.buffT > 0 ? 2.4 : 1), tt2 = this.demoT; this.camera.position.x += Math.sin(tt2 * 43) * Math.sin(tt2 * 11) * sh2; this.camera.position.y += Math.sin(tt2 * 37 + 1) * Math.sin(tt2 * 13) * sh2;
      this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(Math.atan(p.slope) * 0.9 - 0.03, -head, this.roll * 0.5);
      if (this.sw) this.sw.rotation.z = -this.steerIn * 1.3;
      this.camera.fov = 70 + Math.min(14, Math.abs(this.v) * 0.18 + (this.buffT > 0 ? 4 : 0)); this.camera.updateProjectionMatrix();
    } else {
      this.camera.lookAt(m.position.x + dx * c.look, m.position.y + c.up * 0.45, m.position.z + dz * c.look);
      this.camera.fov = 56 + Math.min(14, Math.abs(this.v) * 0.16 + (this.buffT > 0 ? 4 : 0)); this.camera.updateProjectionMatrix();
    }
    if (this.demo) { const W = this.canvas.clientWidth || innerWidth, H = this.canvas.clientHeight || innerHeight; if (W > H) this.camera.setViewOffset(W, H, -W * 0.2, 0, W, H); else this.camera.setViewOffset(W, H, 0, -H * 0.24, W, H); } else if (this.camera.view && this.camera.view.enabled) this.camera.clearViewOffset();
    this.sky.position.copy(this.camera.position); this.stars.position.copy(this.camera.position); if (this.far) for (const f of this.far) { f.m.position.x = this.camera.position.x; f.m.position.z = this.camera.position.z; }
    this.sunL.position.copy(this.camera.position).addScaledVector(this.sunDirV, 300); this.sunL.target.position.copy(this.camera.position);
    this.fill.position.set(this.camera.position.x - this.sunDirV.x * 100, this.camera.position.y + 80, this.camera.position.z - this.sunDirV.z * 100); this.fill.target.position.copy(this.camera.position);
  }
}
