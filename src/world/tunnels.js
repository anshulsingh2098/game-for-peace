/* Tunnels: where Road.tunnelRise says the mountain over the road is deep enough, a tube follows the road, with an arched portal wall at
   each end and, outside it, a pitched-roof gate on banded stone pillars with the tunnel's name board (after the Atal Tunnel at Rohtang).
   The inside is lit like a real road tunnel: cream walls, strips of warm light down both sides, a lamp row on the roof and orange cones along
   the lane edges. The terrain above is left whole (see Road.tunnelW), so the tube is hidden until you drive in.
   The name on the board is road.c.tunnelName (set per location in locations.js). Same flat materials as the bridges and landmarks. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PORTAL_W } from './router.js';

export const COVER = 0.8;                                       // (older rule, kept for reference: the tube now starts where Road.tunnelW reaches PORTAL_W)
export const WALL = 4.3, ARCH = 4.3, ARC_N = 10;                       // straight wall height, arch rise (so 8.6 m clear in the middle)
const LAMP_EVERY = 14, STRIP_EVERY = 3, CONE_EVERY = 6, EXIT_EVERY = 60, SOS_EVERY = 120, LIMIT_EVERY = 200;         // roof lamps, wall light strips, cones along the lane edges (m)
const GATE_OUT = 7;                                             // how far in front of the portal wall the gate stands (m)

/* small wall signs of a real road tunnel, drawn to a texture: 'exit' (green, running figure and EXIT), 'sos' (orange call box with SOS) and 'limit' (red ring, 60) */
function wallSign(kind) {
  const c = document.createElement('canvas'); c.width = 256; c.height = kind === 'limit' ? 256 : 90; const x = c.getContext('2d'), w = c.width, h = c.height; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (kind === 'exit') { x.fillStyle = '#0c8a4a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 4; x.strokeRect(5, 5, w - 10, h - 10); x.fillStyle = '#fff'; x.font = 'bold 44px sans-serif'; x.fillText('EXIT', 150, h / 2 + 2);
    x.beginPath(); x.arc(52, 24, 8, 0, 6.3); x.fill(); x.lineWidth = 7; x.lineCap = 'round'; x.strokeStyle = '#fff'; x.beginPath(); x.moveTo(52, 34); x.lineTo(46, 56); x.lineTo(32, 66); x.moveTo(46, 56); x.lineTo(60, 66); x.moveTo(52, 38); x.lineTo(72, 46); x.stroke(); }
  else if (kind === 'sos') { x.fillStyle = '#e8590c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 4; x.strokeRect(5, 5, w - 10, h - 10); x.fillStyle = '#fff'; x.font = 'bold 54px sans-serif'; x.fillText('SOS', w / 2, h / 2 + 3); }
  else { x.fillStyle = '#fff'; x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 6, 0, 6.3); x.fill(); x.strokeStyle = '#d4181e'; x.lineWidth = 24; x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 22, 0, 6.3); x.stroke(); x.fillStyle = '#111'; x.font = 'bold 100px sans-serif'; x.fillText('60', w / 2, h / 2 + 6); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* the name board: dark panel, small red-and-white peak, a small line above and the name large */
function signTexture(name) {
  const c = document.createElement('canvas'); c.width = 1740; c.height = 200; const x = c.getContext('2d');
  x.fillStyle = '#1b2530'; x.fillRect(0, 0, 1740, 200);
  x.fillStyle = '#e2362b'; x.beginPath(); x.moveTo(870, 12); x.lineTo(906, 52); x.lineTo(834, 52); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(870, 24); x.lineTo(892, 52); x.lineTo(848, 52); x.fill();
  x.fillStyle = '#d9dde3'; x.font = '600 24px sans-serif'; x.textAlign = 'center'; x.fillText('BORDER ROADS ORGANISATION', 870, 82);
  let size = 78; x.font = `800 ${size}px sans-serif`; while (x.measureText(name).width > 1640 && size > 30) { size -= 4; x.font = `800 ${size}px sans-serif`; }
  x.fillStyle = '#fff'; x.fillText(name, 870, 150);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/* horizontal bands of two stones, for the gate pillars */
function stoneTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 4 === 3 ? '#8a4b36' : i % 2 ? '#a6a39b' : '#b9b5aa'; x.fillRect(0, i * 16, 64, 16); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, i * 16, 64, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/* the gate modelled in Blender (tools/blender/build_atal_gate.py, assets/atal): loaded once, cloned at each portal. Falls back to the box gate until it arrives. */
const GATE_HALF = 7.9;                                                  // half-span the model was built for; the game moves the pillars and stretches the span for wider roads
let gateModel = null; const gateReady = new GLTFLoader().loadAsync('assets/atal/atal_gate.glb').then(g => { gateModel = g.scene; return gateModel; }, () => null);

export class Tunnels {
  constructor(scene, road, style, origin, rows) {
    this.road = road; this.style = style; this.origin = origin; this.rows = rows; this.len = rows * road.ds; this.pieces = new Map(); this.range = 1800;
    const m = (color, rough = 0.95, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, envMapIntensity: 0.3, side: THREE.DoubleSide, ...o });
    const tl = new THREE.TextureLoader(), tt = (f, srgb) => { const t = tl.load(`assets/atal/tile_${f}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
    this.wall = m(0xf3ead2, 0.85, { map: tt('color', true), normalMap: tt('normal', false), emissive: 0x4d4128, emissiveIntensity: 0.8 });   // real cream tiles, warm from the lights              // cream, and warm from the lights: never dark, day or night
    this.portal = m(0xc9c3b6); this.lamp = new THREE.MeshBasicMaterial({ color: 0xfff1c4 }); this.cone = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.7, emissive: 0x6a2200, emissiveIntensity: 0.5 });
    this.stone = m(0xffffff); this.stone.map = stoneTexture(); this.roof = m(0x3d4650); this.brown = m(0x5b2e22); this.dark = m(0x222831); this.hutWall = m(0xe9e3d4); this.green = m(0x2f7a45);
    this.sign = new THREE.MeshBasicMaterial({ map: signTexture(road.c.tunnelName || 'TUNNEL'), side: THREE.DoubleSide });
    const gt = this.sign.map.clone(); gt.flipY = false; gt.needsUpdate = true; this.signGlb = new THREE.MeshBasicMaterial({ map: gt, side: THREE.DoubleSide });      // glTF models put the texture's origin at the top-left
    this.ledge = m(0xb9b3a6, 0.9); this.exitMat = new THREE.MeshBasicMaterial({ map: wallSign('exit') }); this.sosMat = new THREE.MeshBasicMaterial({ map: wallSign('sos') }); this.limitMat = new THREE.MeshBasicMaterial({ map: wallSign('limit') });
    this.exitGeo = new THREE.BoxGeometry(1.3, 0.46, 0.06); this.sosGeo = new THREE.BoxGeometry(0.7, 0.26, 0.06); this.limitGeo = new THREE.BoxGeometry(0.9, 0.9, 0.06);
    this.lampGeo = new THREE.BoxGeometry(0.7, 0.18, 1.8); this.stripGeo = new THREE.BoxGeometry(0.14, 0.14, 1.5); this.coneGeo = new THREE.ConeGeometry(0.17, 0.75, 7);
    this.group = new THREE.Group(); scene.add(this.group); this._p = {};
    gateReady.then(m => { if (m) { for (const p of this.pieces.values()) this.drop(p); this.pieces.clear(); } });          // rebuild what was drawn with the box gate
    const W = style.shoulder + 0.8; this.W = W;                                     // inside half-width of the tube
    this.section = [[-W, -0.4], [-W, WALL]]; for (let i = 1; i <= ARC_N; i++) { const a = Math.PI - Math.PI * i / ARC_N; this.section.push([Math.cos(a) * W, WALL + Math.sin(a) * ARCH]); } this.section.push([W, -0.4]);
    this.secLen = [0]; for (let i = 1; i < this.section.length; i++) this.secLen.push(this.secLen[i - 1] + Math.hypot(this.section[i][0] - this.section[i - 1][0], this.section[i][1] - this.section[i - 1][1]));       // distance along the cross-section, for the tile texture
  }
  update(s) {
    const r = this.road, L = this.len, lo = Math.floor(Math.max(r.sMin + L, s - this.range) / L), hi = Math.floor(Math.min(r.sMax - L, s + this.range) / L) - 1;
    for (const [k, p] of this.pieces) if (k < lo - 1 || k > hi + 1) { this.drop(p); this.pieces.delete(k); }
    for (let k = lo; k <= hi; k++) if (!this.pieces.has(k)) { this.pieces.set(k, this.build(k)); return; }
  }
  /* the gate over the road, in front of a portal: two banded stone pillars, a beam, a pitched roof and the name board on both faces */
  gate(grp, x, y, z, th) {
    if (gateModel) {
      const Wg = this.W + 1.7, k = Wg / GATE_HALF, g = gateModel.clone(true), at = (n) => g.getObjectByName(n);
      g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (o.name.startsWith('Sign')) o.material = this.signGlb; } });
      const span = at('Span'); if (span) span.scale.x = k; for (const n of ['SignF', 'SignB']) { const o = at(n); if (o) o.scale.x = 1 / k; }       // the board keeps its width on wide roads
      for (const o of g.children) if (/^Pillar[LR]_/.test(o.name)) o.position.x = Math.sign(o.position.x) * Wg;
      g.position.set(x, y, z); g.rotation.y = th; grp.add(g); this.hut(g, Wg); return;
    }
    this.boxGate(grp, x, y, z, th);
  }
  /* a small hut with a green pitched roof beside the road, as at the real tunnel (g is the gate's group, so it takes the gate's position and heading) */
  hut(g, Wg) {
    const box = (mat, w, h, d, px, py, pz) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(px, py, pz); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
    const hx = Wg + 11.5, hw = 11, hh = 3.8, hr = 1.9; box(this.hutWall, hw, hh + 1.4, 7.5, hx, hh / 2 - 0.7, 6); const ha = Math.atan2(hr, hw / 2 + 0.5), hl = Math.hypot(hw / 2 + 0.5, hr);
    for (const sx of [-1, 1]) { const q = box(this.green, hl, 0.22, 8.6, hx + sx * (hw / 4 + 0.25), hh + hr / 2 - 0.1, 6); q.rotation.z = -sx * ha; }
  }
  boxGate(grp, x, y, z, th) {
    const W = this.W, Wg = W + 1.7, eave = Wg + 2.3, rise = 2.3, g = new THREE.Group(), box = (mat, w, h, d, px, py, pz) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(px, py, pz); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
    for (const sx of [-1, 1]) box(this.stone, 2.1, 7.2, 2.3, sx * Wg, 3.6, 0);
    box(this.brown, 2 * eave, 0.9, 3.2, 0, 7.65, 0);
    const ang = Math.atan2(rise, eave), len = Math.hypot(eave, rise);
    for (const sx of [-1, 1]) { const s = box(this.roof, len, 0.24, 5.6, sx * eave / 2, 8.1 + rise / 2, 0); s.rotation.z = -sx * ang; }
    const tri = new THREE.Shape(); tri.moveTo(-eave, 0); tri.lineTo(eave, 0); tri.lineTo(0, rise); tri.lineTo(-eave, 0);
    for (const sz of [-1, 1]) { const t = new THREE.Mesh(new THREE.ShapeGeometry(tri), this.dark); t.position.set(0, 8.1, sz * 2.8); g.add(t); }
    for (const sz of [-1, 1]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(2 * Wg - 1.2, 1.45), this.sign); b.position.set(0, 7.65, sz * 1.62); if (sz < 0) b.rotation.y = Math.PI; g.add(b); }
    const hx = Wg + 11.5, hw = 11, hh = 3.8, hr = 1.9;                                               // a small hut with a green pitched roof beside the road, as at the real tunnel
    box(this.hutWall, hw, hh + 1.4, 7.5, hx, hh / 2 - 0.7, 6); const ha = Math.atan2(hr, hw / 2 + 0.5), hl = Math.hypot(hw / 2 + 0.5, hr);
    for (const sx of [-1, 1]) { const q = box(this.green, hl, 0.22, 8.6, hx + sx * (hw / 4 + 0.25), hh + hr / 2 - 0.1, 6); q.rotation.z = -sx * ha; }
    g.position.set(x, y, z); g.rotation.y = th; grp.add(g);
  }
  build(k) {
    const r = this.road, ds = r.ds, s0 = k * this.len, p = this._p, n = this.rows, sec = this.section, W = this.W, o = r.at(s0, {}), ox = o.x, oz = o.z;
    const inTube = s => r.tunnelW(s) >= PORTAL_W, runs = []; let run = null;
    for (let row = 0; row <= n; row++) { if (inTube(s0 + row * ds)) { if (!run) runs.push(run = []); run.push(row); } else run = null; }
    if (!runs.length) return null;
    const portals = [], grp = new THREE.Group(), P = [], U = [], I = [], lamps = [], strips = [], cones = [], exits = [], soss = [], limits = [], LP = [], LI = [];
    const frame = s => { r.at(s, p); return { s, x: p.x - ox, y: p.y, z: p.z - oz, nx: -p.tz, nz: p.tx, tx: p.tx, tz: p.tz }; };
    const edge = this.style.shoulder - 0.45;                                                          // cones stand just outside the lane edge lines
    for (const rows of runs) {
      const fr = rows.map(row => frame(s0 + row * ds));
      for (let i = 0; i + 1 < fr.length; i++) {
        const A = fr[i], B = fr[i + 1];
        for (const side of [-1, 1]) {                                                                 // a raised walkway along each wall: its top and its inner face
          const t0 = side * (W - 0.7), t1 = side * W, at2 = (q, t, h) => [q.x + q.nx * t, q.y + h, q.z + q.nz * t], v = LP.length / 3, h = 0.32;
          for (const pt of [at2(A, t0, h), at2(A, t1, h), at2(B, t0, h), at2(B, t1, h), at2(A, t0, -0.02), at2(B, t0, -0.02)]) LP.push(...pt);
          LI.push(v, v + 1, v + 2, v + 1, v + 3, v + 2, v + 4, v, v + 5, v, v + 2, v + 5);
        }
        for (let j = 0; j + 1 < sec.length; j++) {
          const v = P.length / 3; for (const [q, jj] of [[A, j], [A, j + 1], [B, j], [B, j + 1]]) { const [t, y] = sec[jj]; P.push(q.x + q.nx * t, q.y + y, q.z + q.nz * t); U.push(this.secLen[jj] / 2.4, q.s / 2.4); }
          I.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
        }
      }
      const at = (q, every, f) => { if (Math.floor(q.s / every) !== Math.floor((q.s - ds) / every)) f(q, Math.atan2(q.tx, q.tz)); };
      for (const q of fr) {
        at(q, LAMP_EVERY, (q, th) => lamps.push([q.x, q.y + WALL + ARCH - 0.25, q.z, th]));
        at(q, STRIP_EVERY, (q, th) => { for (const side of [-1, 1]) strips.push([q.x + q.nx * side * (W - 0.1), q.y + 4.1, q.z + q.nz * side * (W - 0.1), th]); });
        at(q, CONE_EVERY, (q) => { for (const side of [-1, 1]) cones.push([q.x + q.nx * side * edge, q.y + 0.37, q.z + q.nz * side * edge]); });
        const wallSpot = (q, side, h, back) => [q.x + q.nx * side * (W - 0.08), q.y + h, q.z + q.nz * side * (W - 0.08), Math.atan2(-side * q.nx, -side * q.nz)];            // a spot on the wall, turned to face the road
        at(q, EXIT_EVERY, q => { for (const side of [-1, 1]) exits.push(wallSpot(q, side, 2.4)); });
        at(q, SOS_EVERY, q => { for (const side of [-1, 1]) soss.push(wallSpot(q, side, 1.3)); });
        at(q, LIMIT_EVERY, q => { for (const side of [-1, 1]) limits.push(wallSpot(q, side, 3.0)); });
      }
      for (const [idx, atStart] of [[0, true], [rows.length - 1, false]]) {                          // a portal wall and a gate where the tube really begins or ends (not at a piece edge)
        const row = rows[idx], edgeRow = atStart ? row === 0 : row === n; if (edgeRow) continue;
        const q = fr[idx], th = Math.atan2(q.tx, q.tz), shape = new THREE.Shape(), hole = new THREE.Path();
        shape.moveTo(-W - 2.4, -2); shape.lineTo(W + 2.4, -2); shape.lineTo(W + 2.4, 11); shape.lineTo(-W - 2.4, 11); shape.lineTo(-W - 2.4, -2);
        hole.moveTo(-W, -0.4); hole.lineTo(-W, WALL); hole.absellipse(0, WALL, W, ARCH, Math.PI, 0, true); hole.lineTo(W, -0.4); hole.lineTo(-W, -0.4); shape.holes.push(hole);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false, curveSegments: 14 }), m = new THREE.Mesh(geo, this.portal);
        m.rotation.y = th; m.position.set(q.x - Math.sin(th) * (atStart ? 0 : 1.2), q.y, q.z - Math.cos(th) * (atStart ? 0 : 1.2)); m.castShadow = true; m.receiveShadow = true; grp.add(m);
        const gq = frame(q.s + (atStart ? -GATE_OUT : GATE_OUT)); this.gate(grp, gq.x, gq.y, gq.z, th); portals.push({ x: ox + q.x, y: q.y, z: oz + q.z, dx: atStart ? q.tx : -q.tx, dz: atStart ? q.tz : -q.tz });
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I); geo.computeVertexNormals();
    const tube = new THREE.Mesh(geo, this.wall); tube.receiveShadow = true; grp.add(tube);
    const inst = (g, mat, list) => {
      if (!list.length) return; const im = new THREE.InstancedMesh(g, mat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
      list.forEach((it, i) => { pos.set(it[0], it[1], it[2]); e.set(0, it[3] || 0, 0); q.setFromEuler(e); m4.compose(pos, q, sc); im.setMatrixAt(i, m4); }); grp.add(im);
    };
    if (LP.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3)); lg.setIndex(LI); lg.computeVertexNormals(); const lm = new THREE.Mesh(lg, this.ledge); lm.receiveShadow = true; grp.add(lm); }
    inst(this.exitGeo, this.exitMat, exits); inst(this.sosGeo, this.sosMat, soss); inst(this.limitGeo, this.limitMat, limits);
    inst(this.lampGeo, this.lamp, lamps); inst(this.stripGeo, this.lamp, strips); inst(this.coneGeo, this.cone, cones);
    grp.userData = { x: ox, z: oz, portals }; grp.position.set(ox - this.origin.x, 0, oz - this.origin.z); this.group.add(grp); return grp;
  }
  /* the portals of the built pieces: [{ x, y, z, dx, dz }] in world coordinates, dx/dz pointing into the tube (for tunnel_holes.js) */
  portals() { const out = []; for (const g of this.pieces.values()) if (g && g.userData.portals) out.push(...g.userData.portals); return out; }
  drop(grp) { if (!grp) return; this.group.remove(grp); grp.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.geometry) o.geometry.dispose(); }); }
  reposition() { for (const g of this.pieces.values()) if (g) g.position.set(g.userData.x - this.origin.x, 0, g.userData.z - this.origin.z); }
  dispose() {
    for (const g of this.pieces.values()) this.drop(g); this.pieces.clear(); this.group.parent && this.group.parent.remove(this.group);
    for (const m of [this.wall, this.portal, this.lamp, this.cone, this.stone, this.roof, this.brown, this.dark, this.hutWall, this.green, this.sign, this.signGlb, this.ledge, this.exitMat, this.sosMat, this.limitMat]) { if (m.map) m.map.dispose(); m.dispose(); }
    this.lampGeo.dispose(); this.stripGeo.dispose(); this.coneGeo.dispose(); this.exitGeo.dispose(); this.sosGeo.dispose(); this.limitGeo.dispose();
  }
}
