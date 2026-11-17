/* The landmark model kit (package D8): a small set of primitives (boxes, cylinders, lathed domes, extruded polygons, arch blocks, stairs, colonnades, trees) that a landmark builder calls in its own local frame
   (origin on the ground at the middle of the footprint's oriented box, x along the footprint's yaw, z across it, y up, metres). Everything a builder adds is merged into a few meshes: one per material, and each
   in two layers, the base (always drawn) and the detail (drawn only when you are near: a lower level of detail for distance). Nothing is a model file and no image is used: colours are vertex colours, the surface
   texture is a small canvas (courses of stone, marble panels, arched windows) mapped from the world position, so a big wall and a small one have the same stone. The kit also collects collision circles. Browser only. */
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _n3 = new THREE.Matrix3(), _c = new THREE.Color(), _v = new THREE.Vector3();
/* texture repeat per metre of the materials (u, v) */
const SCALE = { stone: [0.25, 0.25], marble: [0.17, 0.17], facade: [1 / 14.4, 1 / 12.8], gold: [0.2, 0.2], glass: [0.2, 0.2], lawn: [1 / 11, 1 / 11], path: [0.25, 0.25], water: [0.1, 0.1], leaf: [0.2, 0.2], plain: [0.2, 0.2] };
const hexOf = c => (typeof c === 'number' ? _c.setHex(c) : c);

class Bucket { constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.i = []; } }

export class Kit {
  constructor() { this.buckets = new Map(); this.circles = []; this.signs = []; this.rnd = (() => { let s = 1234567; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })(); }
  bucket(mat, d) { const k = mat + (d ? '+' : ''); let b = this.buckets.get(k); if (!b) { b = new Bucket(); b.mat = mat; b.detail = !!d; this.buckets.set(k, b); } return b; }
  /* add a three.js geometry through `matrix`, painted `color`; o: { mat, d (detail layer) } */
  add(geo, matrix, color, o = {}) {
    const mat = o.mat || 'stone', B = this.bucket(mat, o.d), S = SCALE[mat] || SCALE.stone, pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index, col = hexOf(color), base = B.p.length / 3; _n3.getNormalMatrix(matrix);
    for (let i = 0; i < pos.count; i++) {
      _p.fromBufferAttribute(pos, i).applyMatrix4(matrix); _v.fromBufferAttribute(nor, i).applyMatrix3(_n3).normalize();
      B.p.push(_p.x, _p.y, _p.z); B.n.push(_v.x, _v.y, _v.z); B.c.push(col.r, col.g, col.b);
      const ax = Math.abs(_v.x), ay = Math.abs(_v.y), az = Math.abs(_v.z);
      if (ay >= ax && ay >= az) B.u.push(_p.x * S[0], _p.z * S[1]); else if (ax >= az) B.u.push(_p.z * S[0], _p.y * S[1]); else B.u.push(_p.x * S[0], _p.y * S[1]);
    }
    if (idx) for (let i = 0; i < idx.count; i++) B.i.push(base + idx.getX(i)); else for (let i = 0; i < pos.count; i++) B.i.push(base + i);
  }
  /* a transform: position, rotation about y (ry), and optional tilt about x (rx) and z (rz) */
  mx(x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) { _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz); return _m.clone().compose(_p, _q, _s); }
  /* a box standing on y0, centred on (cx, cz); size sx by sh by sz; ry turns it about y */
  box(cx, y0, cz, sx, sh, sz, color, o = {}) { this.add(BOX, this.mx(cx, y0 + sh / 2, cz, sx, sh, sz, o.ry || 0, o.rx || 0, o.rz || 0), color, o); }
  /* a box from two corners in plan (x0, z0)-(x1, z1) */
  slab(x0, z0, x1, z1, y0, sh, color, o = {}) { this.box((x0 + x1) / 2, y0, (z0 + z1) / 2, Math.abs(x1 - x0), sh, Math.abs(z1 - z0), color, o); }
  /* a cylinder or cone frustum standing on y0 */
  cyl(cx, y0, cz, rTop, rBot, h, color, o = {}) { this.add(cylGeo(rTop, rBot, o.seg || 16, o.open), this.mx(cx, y0 + h / 2, cz, 1, h, 1, o.ry || 0), color, o); }
  /* a lathed solid of revolution: profile [[r, y], ...] from the bottom up, centred on (cx, cz), standing on y0 */
  lathe(cx, y0, cz, profile, color, o = {}) { this.add(latheGeo(profile, o.seg || 20), this.mx(cx, y0, cz, o.sx || 1, 1, o.sz || 1), color, o); }
  /* a dome (hemisphere squashed to height h) of radius r, with an optional drum under it is the caller's job */
  dome(cx, y0, cz, r, h, color, o = {}) { const pr = []; const n = o.rings || 7; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pr.push([Math.cos(a) * r, Math.sin(a) * h]); } this.lathe(cx, y0, cz, pr, color, o); }
  /* an onion dome: bulges to rb at a third of the height and closes to a point */
  onion(cx, y0, cz, rb, h, color, o = {}) { const pr = [[rb * 0.72, 0], [rb, h * 0.2], [rb * 0.96, h * 0.38], [rb * 0.62, h * 0.6], [rb * 0.2, h * 0.82], [0.02, h]]; this.lathe(cx, y0, cz, pr, color, o); }
  /* a prism over a polygon [[x, z], ...] from y0 up by h */
  prism(poly, y0, h, color, o = {}) { this.add(prismGeo(poly, h), this.mx(0, y0, 0), color, o); }
  /* a flat polygon lying at y (default just above the ground) with its normal up: lawns, paths, water */
  flat(poly, color, o = {}) { this.add(flatGeo(poly), this.mx(0, o.y || 0, 0), color, o); }
  /* a rectangle on the ground, ry turns it */
  rect(cx, cz, sx, sz, color, o = {}) { this.add(PLANE, this.mx(cx, o.y || 0, cz, sx, 1, sz, o.ry || 0), color, o); }
  disc(cx, cz, r, color, o = {}) { this.add(discGeo(o.seg || 28), this.mx(cx, o.y || 0, cz, r, 1, r), color, o); }
  ring(cx, cz, r0, r1, color, o = {}) { this.add(ringGeo(r0 / r1, o.seg || 40, o.a0 || 0, o.a1 === undefined ? Math.PI * 2 : o.a1), this.mx(cx, o.y || 0, cz, r1, 1, r1), color, o); }
  /* a block of width w, height h and depth d with a round or pointed arch opening of width aw and height ah through its depth (depth along z, then turned by ry) */
  arch(cx, y0, cz, w, h, d, aw, ah, color, o = {}) { this.add(archGeo(w, h, d, aw, ah, !!o.pointed, !!o.cusp), this.mx(cx, y0, cz, 1, 1, 1, o.ry || 0), color, o); }
  /* stairs: n steps from the foot (cx, cz) climbing toward direction ry (0 = toward +x) to total height h; width w, tread run */
  stairs(cx, y0, cz, w, run, n, h, color, o = {}) { const c = Math.cos(o.ry || 0), s = Math.sin(o.ry || 0); for (let i = 0; i < n; i++) { const t = (i + 0.5) * run; this.box(cx + c * t, y0, cz + s * t, run, h * (i + 1) / n, w, color, { ...o, ry: -(o.ry || 0) }); } }
  /* a row of columns between two points: n columns of radius r and height h standing on y0 with a beam on top */
  colonnade(x0, z0, x1, z1, y0, n, r, h, color, o = {}) { for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); this.cyl(x0 + (x1 - x0) * t, y0, z0 + (z1 - z0) * t, r, r * (o.taper || 1), h, color, { ...o, seg: o.seg || 8 }); } if (o.beam !== false) { const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0); this.box((x0 + x1) / 2, y0 + h, (z0 + z1) / 2, L + r * 2.2, o.beamH || r * 1.6, o.beamW || r * 2.8, o.beamColor || color, { ...o, ry: -a }); } }
  /* a tree: a trunk and a crown (two stacked blobs), in the detail layer unless o.d is false */
  tree(x, z, h, color = 0x3f6b2e, o = {}) { const d = o.d === undefined ? true : o.d; this.cyl(x, 0, z, h * 0.04, h * 0.06, h * 0.45, 0x5a4632, { mat: 'plain', seg: 5, d }); this.add(blobGeo(), this.mx(x, h * 0.52, z, h * 0.3, h * 0.28, h * 0.3), color, { mat: 'leaf', d }); this.add(blobGeo(), this.mx(x + h * 0.06, h * 0.78, z - h * 0.04, h * 0.2, h * 0.2, h * 0.2), color, { mat: 'leaf', d }); }
  /* a text plate (its own small canvas mesh): text, centre (x, y, z), size w by h, turned ry about y (the plate faces +z at ry 0); o: { fg, bg, font } */
  sign(text, x, y, z, w, h, ry = 0, o = {}) { this.signs.push({ text, x, y, z, w, h, ry, ...o }); }
  /* a collision circle (local x, z, r) and helpers that fill a wall or the rim of a box with circles */
  circle(x, z, r) { this.circles.push(x, z, r); }
  wall(x0, z0, x1, z1, r = 1.4) { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / (r * 1.6))); for (let i = 0; i <= n; i++) this.circle(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, r); }
  solid(cx, cz, hx, hz, r = 1.4, ry = 0) { const c = Math.cos(ry), s = Math.sin(ry), P = (a, b) => [cx + a * c - b * s, cz + a * s + b * c]; const q = [P(-hx, -hz), P(hx, -hz), P(hx, hz), P(-hx, hz)]; for (let i = 0; i < 4; i++) this.wall(q[i][0], q[i][1], q[(i + 1) % 4][0], q[(i + 1) % 4][1], r); }
  polyWall(poly, r = 1.4) { for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; this.wall(a[0], a[1], b[0], b[1], r); } }
  /* n columns on a circle of radius rad centred (cx, cz), each of radius r and height h on y0, with a ring beam on top */
  ringColumns(cx, cz, rad, n, y0, r, h, color, o = {}) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; this.cyl(cx + Math.cos(a) * rad, y0, cz + Math.sin(a) * rad, r, r, h, color, { seg: 8, ...o }); } if (o.beam !== false) this.ring(cx, cz, rad - r * 1.6, rad + r * 1.6, color, { y: y0 + h + (o.beamH || r * 1.4), mat: o.mat, d: o.d }); }
  /* a small domed kiosk (chhatri): four posts, a roof slab and a dome, standing on y0 */
  kiosk(cx, y0, cz, w, postH, color, domeColor, o = {}) { const p = w * 0.09; for (const a of [-1, 1]) for (const b of [-1, 1]) this.box(cx + a * (w / 2 - p), y0, cz + b * (w / 2 - p), p * 2, postH, p * 2, color, o); this.box(cx, y0 + postH, cz, w, w * 0.12, w, color, o); this.dome(cx, y0 + postH + w * 0.12, cz, w * 0.42, w * 0.5, domeColor, { seg: 12, rings: 4, ...o }); this.cyl(cx, y0 + postH + w * 0.62, cz, 0.04, 0.12, w * 0.3, domeColor, { seg: 5, ...o }); }
  ringSolid(cx, cz, rad, r = 1.4) { const n = Math.max(8, Math.ceil(2 * Math.PI * rad / (r * 1.6))); for (let i = 0; i < n; i++) this.circle(cx + Math.cos(i / n * 2 * Math.PI) * rad, cz + Math.sin(i / n * 2 * Math.PI) * rad, r); }
  /* the merged geometries: [{ key, mat, detail, geometry }] */
  geometries() {
    const out = []; for (const [key, B] of this.buckets) { if (!B.i.length) continue; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2)); g.setIndex(B.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(B.i, 1) : new THREE.Uint16BufferAttribute(B.i, 1)); g.computeBoundingSphere(); out.push({ key, mat: B.mat, detail: B.detail, geometry: g, tris: B.i.length / 3 }); }
    return out;
  }
}

/* shared geometries (unit sizes) */
const BOX = new THREE.BoxGeometry(1, 1, 1), PLANE = (() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; })();
const cache = new Map(); const memo = (k, f) => { let g = cache.get(k); if (!g) cache.set(k, g = f()); return g; };
const cylGeo = (rt, rb, seg, open) => memo('c' + rt + '_' + rb + '_' + seg + open, () => new THREE.CylinderGeometry(rt, rb, 1, seg, 1, !!open));
const latheGeo = (pr, seg) => new THREE.LatheGeometry(pr.map(p => new THREE.Vector2(p[0], p[1])), seg);
const blobGeo = () => memo('blob', () => new THREE.IcosahedronGeometry(1, 1));
const discGeo = seg => memo('d' + seg, () => { const g = new THREE.CircleGeometry(1, seg); g.rotateX(-Math.PI / 2); return g; });
const ringGeo = (k, seg, a0, a1) => { const g = new THREE.RingGeometry(k, 1, seg, 1, a0, a1 - a0); g.rotateX(-Math.PI / 2); return g; };
function flatGeo(poly) { const sh = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], -p[1]))), g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g; }
function prismGeo(poly, h) { const sh = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], -p[1]))), g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; }
function archGeo(w, h, d, aw, ah, pointed, cusp) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h); sh.lineTo(-w / 2, h); sh.closePath();
  const hole = new THREE.Path(), r = aw / 2, sp = ah - (pointed ? r * 1.15 : r); hole.moveTo(-r, 0); hole.lineTo(-r, Math.max(0, sp));
  if (pointed) { hole.quadraticCurveTo(-r, sp + r * 0.75, 0, ah); hole.quadraticCurveTo(r, sp + r * 0.75, r, Math.max(0, sp)); } else hole.absarc(0, sp, r, Math.PI, 0, true);
  void cusp; hole.lineTo(r, 0); hole.closePath(); sh.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 10 }); g.translate(0, 0, -d / 2); return g;
}

/* ---- materials and their canvas textures (one set for all landmarks) ---- */
let MATS = null;
export function landmarkMaterials() {
  if (MATS) return MATS; let seed = 777; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const tex = (c, rep = true) => { const t = new THREE.CanvasTexture(c); if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const stoneC = (() => { const c = cv(128), g = c.getContext('2d'); g.fillStyle = '#ececec'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { const v = 205 + Math.floor(rnd() * 50); g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.5)'; g.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 3, 1 + rnd() * 2); }
    g.fillStyle = 'rgba(70,50,40,0.28)'; for (let r = 0; r < 8; r++) { g.fillRect(0, r * 16, 128, 1); const off = r % 2 ? 0 : 32; for (let k = 0; k < 3; k++) g.fillRect(off + k * 64, r * 16, 1, 16); } return c; })();
  const marbleC = (() => { const c = cv(128), g = c.getContext('2d'); g.fillStyle = '#f6f6f6'; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(120,120,130,0.16)'; g.lineWidth = 1; for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(rnd() * 128, 0); g.bezierCurveTo(rnd() * 128, 40, rnd() * 128, 80, rnd() * 128, 128); g.stroke(); } g.fillStyle = 'rgba(90,90,100,0.30)'; g.fillRect(0, 0, 128, 1); g.fillRect(0, 0, 1, 128); g.fillRect(0, 64, 128, 1); g.fillRect(64, 0, 1, 128); return c; })();
  /* the facade of a government building: 4 bays by 4 storeys in 256 px, arched windows between piers, a cornice line, and a map of lit windows for night */
  const facade = (() => { const c = cv(256), e = cv(256), g = c.getContext('2d'), eg = e.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256); eg.fillStyle = '#000'; eg.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) { const x = q * 64, y = r * 64; g.fillStyle = '#d4d0c4'; g.fillRect(x, y + 60, 64, 4); g.fillStyle = '#e9e5d6'; g.fillRect(x, y, 5, 64); g.fillRect(x + 59, y, 5, 64);
      g.fillStyle = '#3a3f46'; g.beginPath(); g.moveTo(x + 17, y + 52); g.lineTo(x + 17, y + 26); g.arc(x + 32, y + 26, 15, Math.PI, 0); g.lineTo(x + 47, y + 52); g.closePath(); g.fill(); g.fillStyle = '#c7c2b3'; g.fillRect(x + 14, y + 52, 36, 4);
      if (rnd() < 0.5) { eg.fillStyle = rnd() < 0.7 ? '#ffd58a' : '#cfe6ff'; eg.beginPath(); eg.moveTo(x + 19, y + 52); eg.lineTo(x + 19, y + 26); eg.arc(x + 32, y + 26, 13, Math.PI, 0); eg.lineTo(x + 45, y + 52); eg.closePath(); eg.fill(); } } return [c, e]; })();
  const noise = (() => { const c = cv(128), g = c.getContext('2d'); g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 700; i++) { const v = 170 + Math.floor(rnd() * 80), r = 2 + rnd() * 9; g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.35)'; g.beginPath(); g.arc(rnd() * 128, rnd() * 128, r, 0, 7); g.fill(); } return c; })();
  const st = (extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, envMapIntensity: 0.3, ...extra });
  const flat = (f, u, map) => st({ map, roughness: 0.96, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: u, envMapIntensity: 0.2 });
  MATS = {
    stone: st({ map: tex(stoneC), emissive: 0xffe2b0, emissiveIntensity: 0 }), marble: st({ map: tex(marbleC), roughness: 0.5, envMapIntensity: 0.7, emissive: 0xfff0d0, emissiveIntensity: 0 }),
    facade: st({ map: tex(facade[0]), emissive: 0xffffff, emissiveMap: tex(facade[1]), emissiveIntensity: 0 }), gold: st({ roughness: 0.32, metalness: 0.65, envMapIntensity: 1.1, emissive: 0xffc860, emissiveIntensity: 0 }),
    glass: st({ roughness: 0.18, metalness: 0.35, envMapIntensity: 0.9, emissive: 0xffe3a8, emissiveIntensity: 0 }), plain: st({ roughness: 0.9 }), leaf: st({ roughness: 1, flatShading: true }),
    lawn: flat(-2, -3, tex(noise)), path: flat(-3, -4, tex(noise)), water: new THREE.MeshStandardMaterial({ color: 0x2f6a80, roughness: 0.08, metalness: 0.2, envMapIntensity: 1.2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 }),
  };
  MATS.setNight = on => { MATS.stone.emissiveIntensity = on ? 0.16 : 0; MATS.marble.emissiveIntensity = on ? 0.2 : 0; MATS.facade.emissiveIntensity = on ? 1.1 : 0; MATS.gold.emissiveIntensity = on ? 0.3 : 0; MATS.glass.emissiveIntensity = on ? 0.5 : 0; };
  return MATS;
}
