/* District (N11): the built-up edge of a city road, drawn from the plan in district_plan.js: modular buildings (a shop front with an awning and sign, floors of windows, balconies,
   cornices, rooftop water tanks), raised sidewalks with kerbs, zebra crossings, lamp posts, bus shelters, market stalls and signal poles. All geometry is original and procedural (no
   external assets), merged into a few meshes per 200 m piece; windows light up at night. Same piece scheme as bridges.js and retaining.js. Obstacle circles for the car come from
   `near(x, z, r)`. Browser only (canvas textures); the layout is tested through district_plan.js. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { planPiece, PALETTES, SHOP, FLOOR_H, GROUND_H, FRONT_GAP } from './district_plan.js';
import { STEP } from './navgraph.js';

function textures() {
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); draw(g); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const win = (g, fill, frame) => { g.fillStyle = frame; g.fillRect(34, 22, 60, 84); g.fillStyle = fill; g.fillRect(40, 28, 48, 72); g.fillStyle = frame; g.fillRect(62, 28, 4, 72); };
  const map = mk(g => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 118, 128, 10); win(g, '#26333f', '#efe9dc'); g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(30, 106, 68, 6); });
  const glow = mk(g => { g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#ffd98a'; g.fillRect(40, 28, 22, 72); g.fillStyle = '#c99a50'; g.fillRect(66, 28, 22, 72); });
  return { map, glow };
}
const WALL_UV = 0.05;                                                                                   // a plain spot of the texture, for parts that should not show windows
const col = hex => new THREE.Color(hex);
/* a box part: size, centre (relative to the plot frame), yaw, colour; uv: 'plain' or { u, v } repeats for the side faces */
function boxPart(list, w, h, d, cx, cy, cz, frame, hex, uv) {
  const g = new THREE.BoxGeometry(w, h, d), n = g.attributes.position.count, c = col(hex), a = new Float32Array(n * 3), t = g.attributes.uv;
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; const face = Math.floor(i / 4);
    if (uv === 'plain' || face === 2 || face === 3) t.setXY(i, WALL_UV, WALL_UV); else if (face === 4 || face === 5) t.setXY(i, t.getX(i) * uv.u, t.getY(i) * uv.v); else t.setXY(i, t.getX(i) * uv.ud, t.getY(i) * uv.v); }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.translate(cx, cy, cz); g.rotateY(frame.yaw); g.translate(frame.x, frame.y, frame.z); list.push(g);
}

export class District {
  /* spec: the region's `district` data; seed: string; blocked(x, z): true where a landmark or the sea is; rows: road rows per piece (as RoadMesh) */
  constructor(scene, road, terrain, style, origin, rows, { spec, seed, blocked }) {
    this.road = road; this.t = terrain; this.style = style; this.origin = origin; this.rows = rows; this.len = rows * road.ds; this.spec = spec; this.seed = seed; this.blocked = blocked; this.pieces = new Map(); this.range = 1100; this.night = -1;
    const tex = textures(); this.tex = tex;
    this.wall = new THREE.MeshStandardMaterial({ map: tex.map, emissiveMap: tex.glow, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.35 });
    this.furn = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1, envMapIntensity: 0.4 });
    this.walk = new THREE.MeshStandardMaterial({ color: 0xb8b3a8, roughness: 0.95, metalness: 0, envMapIntensity: 0.25, side: THREE.DoubleSide });
    this.paint = new THREE.MeshBasicMaterial({ color: 0xf2f2ee, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -10 });
    this.group = new THREE.Group(); scene.add(this.group);
  }
  update(s) {
    const r = this.road, L = this.len, lo = Math.floor(Math.max(r.sMin + L, s - this.range) / L), hi = Math.floor(Math.min(r.sMax - L, s + this.range) / L) - 1;
    for (const [k, p] of this.pieces) if (k < lo - 1 || k > hi + 1) { this.drop(p); this.pieces.delete(k); }
    const mid = Math.floor(s / L); for (let d = 0; d <= hi - lo + 1; d++) for (const k of d ? [mid + d, mid - d] : [mid]) if (k >= lo && k <= hi && !this.pieces.has(k)) { this.pieces.set(k, this.build(k)); return; }       // one piece a frame, nearest first
  }
  setNight(on) { const v = on ? 0.9 : 0; if (this.wall.emissiveIntensity !== v) this.wall.emissiveIntensity = v; }
  build(k) {
    const r = this.road, st = this.style, s0 = k * this.len, s1 = s0 + this.len, o = r.at(s0, {}), ox = o.x, oz = o.z, plan = planPiece({ road: r, terrain: this.t, seed: this.seed, k, s0, s1, spec: this.spec, blocked: this.blocked });
    const walls = [], furn = [], walk = { P: [], I: [] }, zebra = { P: [], I: [] }, p = {};
    const quad = (A, a, b, c, d) => { const v = A.P.length / 3; A.P.push(...a, ...b, ...c, ...d); A.I.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); };
    // plots
    for (const pl of plan.plots) {
      const frame = { yaw: Math.atan2(-pl.tz, pl.tx) + (pl.side < 0 ? Math.PI : 0), x: pl.x - ox, y: pl.y, z: pl.z - oz }, pal = PALETTES[pl.style] || PALETTES.mixed, wallC = pal[pl.colour % pal.length], shopC = SHOP[pl.shop % SHOP.length], w = pl.w, d = pl.d, fl = pl.floors, H = fl * FLOOR_H;
      const bays = Math.max(1, Math.round(w / 3.2)), dbays = Math.max(1, Math.round(d / 3.2)), uv = { u: bays, ud: dbays, v: fl };
      boxPart(walls, w, 2.2, d, 0, -1.1, 0, frame, 0x6d675e, 'plain');                                                                              // foundation below the road level
      boxPart(walls, w, GROUND_H, d, 0, GROUND_H / 2, 0, frame, 0xd8d0c0, 'plain');                                                               // shop floor
      boxPart(walls, w * 0.82, 2.3, 0.12, 0, 1.6, -d / 2 - 0.05, frame, 0x1f2a33, 'plain');                                                       // shop window
      boxPart(walls, w * 0.94, 0.16, 1.5, 0, 3.05, -d / 2 - 0.7, frame, shopC, 'plain');                                                         // awning
      boxPart(walls, w * 0.7, 0.7, 0.14, 0, 3.7, -d / 2 - 0.12, frame, SHOP[(pl.shop + 3) % SHOP.length], 'plain');                              // signboard
      boxPart(walls, w, H, d, 0, GROUND_H + H / 2, 0, frame, wallC, uv);                                                                            // floors of windows
      boxPart(walls, w + 0.6, 0.5, d + 0.6, 0, GROUND_H + H + 0.25, 0, frame, 0xe9e2d2, 'plain');                                               // cornice
      boxPart(walls, w + 0.2, 0.35, d + 0.2, 0, GROUND_H + 0.2, 0, frame, 0xe9e2d2, 'plain');
      if (pl.style === 'art-deco') for (let f = 2; f < fl; f += 2) boxPart(walls, w + 0.35, 0.25, d + 0.35, 0, GROUND_H + f * FLOOR_H, 0, frame, 0xf6f1e4, 'plain');
      if (pl.style === 'colonial') for (const sx of [-1, 1]) boxPart(walls, 0.5, H, 0.5, sx * (w / 2 - 0.2), GROUND_H + H / 2, -d / 2 - 0.1, frame, 0xf0e6cf, 'plain');
      if (fl >= 3 && pl.extras > 0.25) for (let f = 2; f < fl; f += 2) { boxPart(walls, w * 0.6, 0.15, 1.0, 0, GROUND_H + f * FLOOR_H - 0.2, -d / 2 - 0.5, frame, 0xcfc8b8, 'plain'); boxPart(walls, w * 0.6, 0.9, 0.06, 0, GROUND_H + f * FLOOR_H + 0.3, -d / 2 - 1.0, frame, 0x2d3338, 'plain'); }
      if (pl.extras > 0.5) { boxPart(walls, 1.8, 1.6, 1.8, w * 0.2, GROUND_H + H + 1.3, d * 0.2, frame, 0x1b1d20, 'plain'); boxPart(walls, 0.2, 0.9, 0.2, w * 0.2, GROUND_H + H + 0.5, d * 0.2, frame, 0x3a3d40, 'plain'); }
    }
    // furniture
    for (const f of plan.furniture) {
      const frame = { yaw: Math.atan2(-f.tz, f.tx), x: f.x - ox, y: f.y + 0.16, z: f.z - oz }, side = f.side;
      if (f.type === 'lamp') { boxPart(furn, 0.14, 6.4, 0.14, 0, 3.2, 0, frame, 0x30363b, 'plain'); boxPart(furn, 0.1, 0.1, 1.5, 0, 6.35, -side * 0.7, frame, 0x30363b, 'plain'); boxPart(furn, 0.32, 0.14, 0.6, 0, 6.28, -side * 1.4, frame, 0xfff1c4, 'plain'); }
      else if (f.type === 'shelter') { boxPart(furn, 4.2, 0.12, 2.0, 0, 2.7, 0, frame, 0x3b8f6a, 'plain'); for (const [x, z] of [[-1.9, -0.9], [1.9, -0.9], [-1.9, 0.9], [1.9, 0.9]]) boxPart(furn, 0.1, 2.7, 0.1, x, 1.35, z, frame, 0x30363b, 'plain'); boxPart(furn, 4, 1.4, 0.06, 0, 1.6, side * 0.95, frame, 0xbcd7e0, 'plain'); boxPart(furn, 3.2, 0.1, 0.5, 0, 0.5, 0, frame, 0x8a6a45, 'plain'); }
      else if (f.type === 'stall') { const c = SHOP[f.colour % SHOP.length]; boxPart(furn, 1.8, 0.9, 1.0, 0, 0.45, 0, frame, 0x8a6a45, 'plain'); boxPart(furn, 0.08, 2.3, 0.08, 0, 1.15, 0, frame, 0x30363b, 'plain'); boxPart(furn, 2.4, 0.1, 2.4, 0, 2.35, 0, frame, c, 'plain'); boxPart(furn, 1.6, 0.4, 0.7, 0, 1.1, 0, frame, SHOP[(f.colour + 2) % SHOP.length], 'plain'); }
      else if (f.type === 'signal') { boxPart(furn, 0.12, 3.4, 0.12, 0, 1.7, 0, frame, 0x30363b, 'plain'); boxPart(furn, 0.4, 0.95, 0.3, 0, 3.2, 0, frame, 0x1d2024, 'plain'); if (f.signalled) { boxPart(furn, 0.2, 0.2, 0.05, 0, 3.45, 0.17, frame, 0xff3b30, 'plain'); boxPart(furn, 0.2, 0.2, 0.05, 0, 2.95, 0.17, frame, 0x34c759, 'plain'); } }
    }
    // sidewalks with kerbs, along the whole piece
    const a = st.shoulder + 0.1, b = st.shoulder + FRONT_GAP - 0.3, hgt = 0.16;
    for (const side of [1, -1]) {
      let prev = null; for (let row = 0; row <= this.rows; row++) {
        const s = s0 + row * r.ds; r.at(s, p); const nx = -p.tz * side, nz = p.tx * side; let cur = null;
        if (r.bridgeW(s) === 0 && r.tunnelW(s) < 0.01 && !this.blocked(p.x + nx * b, p.z + nz * b)) cur = { A: [p.x + nx * a - ox, p.y + hgt, p.z + nz * a - oz], B: [p.x + nx * b - ox, p.y + hgt, p.z + nz * b - oz], A0: [p.x + nx * a - ox, p.y, p.z + nz * a - oz] };
        if (prev && cur) { quad(walk, prev.A, prev.B, cur.A, cur.B); quad(walk, prev.A0, prev.A, cur.A0, cur.A); }
        prev = cur;
      }
    }
    // zebra crossings
    const half = st.half;
    for (const i of plan.crossings) { r.at(i * STEP, p); for (let lat = -half + 0.4; lat < half - 0.3; lat += 1.15) { const nx = -p.tz, nz = p.tx, ax = p.x + nx * lat, az = p.z + nz * lat, hw = 0.3, l = 1.8; const c = (dl, dw) => [ax + p.tx * dl + nx * dw - ox, p.y + 0.04, az + p.tz * dl + nz * dw - oz]; quad(zebra, c(-l, -hw), c(-l, hw), c(l, -hw), c(l, hw)); } }
    if (!plan.plots.length && !plan.furniture.length && !walk.P.length && !zebra.P.length) return null;
    const grp = new THREE.Group(); const addMerged = (list, mat) => { if (!list.length) return; const g = mergeGeometries(list); list.forEach(x => x.dispose()); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; grp.add(m); };
    addMerged(walls, this.wall); addMerged(furn, this.furn);
    for (const [A, mat, shadow] of [[walk, this.walk, false], [zebra, this.paint, false]]) if (A.P.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(A.P, 3)); g.setIndex(A.I); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.receiveShadow = shadow || mat === this.walk; grp.add(m); }
    grp.userData = { x: ox, z: oz, circles: plan.circles, s0, s1 }; grp.position.set(ox - this.origin.x, 0, oz - this.origin.z); this.group.add(grp); return grp;
  }
  /* obstacle circles near (x, z) within r: the world.near contract (a list of lists of { x, z, r, slide }) */
  near(x, z, r) {
    const out = this._out || (this._out = []); out.length = 0;
    for (const g of this.pieces.values()) { if (!g) continue; const c = g.userData.circles; if (!c.length) continue; const l = []; for (const q of c) if (Math.abs(q.x - x) < r + 4 && Math.abs(q.z - z) < r + 4) l.push(q); if (l.length) out.push(l); }
    return out;
  }
  drop(grp) { if (!grp) return; this.group.remove(grp); grp.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  reposition() { for (const g of this.pieces.values()) if (g) g.position.set(g.userData.x - this.origin.x, 0, g.userData.z - this.origin.z); }
  dispose() { for (const g of this.pieces.values()) this.drop(g); this.pieces.clear(); this.group.parent && this.group.parent.remove(this.group); this.tex.map.dispose(); this.tex.glow.dispose(); for (const m of [this.wall, this.furn, this.walk, this.paint]) m.dispose(); }
}
