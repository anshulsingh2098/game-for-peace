/* The vehicles of a Delhi street (D7): generic Indian-proportion shapes built from a few boxes each (no brand shapes, no logos), merged per kind into one vertex-coloured geometry, and a `Fleet` that draws every
   kind as one InstancedMesh. Vertex colour white means "takes the paint" (the instance colour); everything else is a fixed colour. Model axes: length along +z (the way it drives), width along x, y up.
   Kinds: hatch, suv, taxi, auto (CNG three-wheeler, green with a yellow roof), erick (e-rickshaw), cyclerick, two (a motorbike with its rider), tempo (a small goods vehicle), truck (painted panels).
   DTC and cluster buses are separate (`busGeometry`): their destination boards are textured per route by citybus.js. Browser only (three.js). */
import * as THREE from 'three';

const P = 'P', GL = 0x141a20, TY = 0x1c1c1e, GREY = 0x6a6e72, DARK = 0x2b2b2d;
const wheel = (x, z, r = 0.58, w = 0.22) => [x, r / 2, z, w, r, r, TY, 'cyl'];      /* a real round wheel (10-sided cylinder on the x axis), phase 11, GTA gap list item 5 */
const TC = { kx: 0.92, kz: 0.72, dz: -0.2 };      /* a sloped front cowl or cab (auto, tempo, truck): the top is shorter at the front */
const TR = { kx: 0.8, kz: 0.58, dz: -0.2 };      /* a sloped cabin: the top of a box is 80 percent as wide, 58 percent as long and set back, so the windscreen and the rear glass slope */
/* [cx, cy, cz, sx, sy, sz, colour | 'P'] */
const KINDS = {
  hatch: { len: 3.7, wid: 1.65, speed: 1, parts: [[0, 0.52, 0, 1.65, 0.55, 3.7, P], [0, 1.05, -0.15, 1.5, 0.5, 2.0, P, TR], [0, 1.08, -0.15, 1.53, 0.28, 1.88, GL, TR], [0, 0.35, 1.8, 1.6, 0.25, 0.12, DARK], [0, 0.35, -1.8, 1.6, 0.25, 0.12, DARK], wheel(-0.8, 1.15), wheel(0.8, 1.15), wheel(-0.8, -1.15), wheel(0.8, -1.15), [0, 0.62, 1.86, 1.2, 0.12, 0.05, 0xfff2c8], [0, 0.62, -1.86, 1.2, 0.1, 0.05, 0xb11f1f]] },
  suv: { len: 4.3, wid: 1.85, speed: 1, parts: [[0, 0.7, 0, 1.85, 0.75, 4.3, P], [0, 1.35, -0.2, 1.75, 0.65, 2.7, P, TR], [0, 1.4, -0.2, 1.78, 0.34, 2.55, GL, TR], [0, 0.4, 2.1, 1.8, 0.3, 0.12, DARK], wheel(-0.9, 1.35, 0.7), wheel(0.9, 1.35, 0.7), wheel(-0.9, -1.35, 0.7), wheel(0.9, -1.35, 0.7), [0, 0.85, 2.16, 1.4, 0.14, 0.05, 0xfff2c8], [0, 0.85, -2.16, 1.4, 0.12, 0.05, 0xb11f1f]] },
  taxi: { len: 3.9, wid: 1.7, speed: 0.95, parts: [[0, 0.52, 0, 1.7, 0.55, 3.9, P], [0, 1.05, -0.2, 1.52, 0.5, 2.1, P, TR], [0, 1.08, -0.2, 1.55, 0.28, 1.98, GL, TR], [0, 1.42, -0.2, 0.5, 0.14, 0.22, 0xf2d24a], wheel(-0.82, 1.2), wheel(0.82, 1.2), wheel(-0.82, -1.2), wheel(0.82, -1.2), [0, 0.62, 1.96, 1.2, 0.12, 0.05, 0xfff2c8]] },
  auto: { len: 2.7, wid: 1.4, speed: 0.8, parts: [[0, 0.55, -0.4, 1.35, 0.55, 1.6, 0x2f8f5b], [0, 0.86, -0.6, 1.1, 0.16, 1.05, 0x25262a], [0, 1.28, -1.17, 1.3, 0.9, 0.06, 0x2f8f5b], [-0.64, 1.3, -1.12, 0.07, 0.95, 0.07, 0x2f8f5b], [0.64, 1.3, -1.12, 0.07, 0.95, 0.07, 0x2f8f5b], [-0.64, 1.3, 0.28, 0.07, 0.95, 0.07, 0x2f8f5b], [0.64, 1.3, 0.28, 0.07, 0.95, 0.07, 0x2f8f5b], [0, 1.8, -0.4, 1.42, 0.08, 1.95, 0xe3b21a], [0, 1.78, 0.62, 1.2, 0.07, 0.4, 0xe3b21a], [0, 0.78, 0.98, 1.0, 0.7, 0.85, 0x2f8f5b, TC], [0, 1.4, 0.62, 1.1, 0.5, 0.4, GL, { kx: 1, kz: 0.2, dz: -0.2 }], [0, 0.84, 0.4, 0.5, 0.26, 0.4, 0x25262a], [0, 1.12, 0.78, 0.72, 0.05, 0.05, GREY], [0, 0.62, 1.2, 0.4, 0.06, 0.55, 0x2f8f5b], wheel(0, 1.2, 0.52, 0.14), wheel(-0.62, -0.75, 0.52, 0.14), wheel(0.62, -0.75, 0.52, 0.14), [0, 0.84, 1.42, 0.3, 0.2, 0.06, 0xfff2c8]] },
  erick: { len: 2.8, wid: 1.25, speed: 0.55, parts: [[0, 0.5, 0, 1.2, 0.12, 2.6, GREY], [0, 1.95, -0.1, 1.4, 0.06, 2.5, P], [-0.58, 1.2, 0.9, 0.05, 1.5, 0.05, GREY], [0.58, 1.2, 0.9, 0.05, 1.5, 0.05, GREY], [-0.58, 1.2, -1.15, 0.05, 1.5, 0.05, GREY], [0.58, 1.2, -1.15, 0.05, 1.5, 0.05, GREY], [0, 0.8, -0.3, 1.1, 0.4, 0.5, 0x3a3a3c], [0, 1.0, -0.62, 1.1, 0.5, 0.1, 0x3a3a3c], [0, 0.68, 0.82, 0.55, 0.14, 0.4, 0x25262a], [0, 0.95, 0.66, 0.5, 0.45, 0.08, 0x25262a], [0, 0.85, 1.22, 1.15, 0.75, 0.32, P, TC], [0, 1.5, 1.1, 1.0, 0.5, 0.25, GL, { kx: 1, kz: 0.15, dz: -0.1 }], [0, 1.18, 1.0, 0.7, 0.05, 0.05, GREY], [0, 0.95, 1.4, 0.3, 0.18, 0.06, 0xfff2c8], wheel(-0.52, 0.9, 0.5, 0.12), wheel(0.52, 0.9, 0.5, 0.12), wheel(-0.52, -0.95, 0.5, 0.12), wheel(0.52, -0.95, 0.5, 0.12)] },
  cyclerick: { len: 2.3, wid: 1.0, speed: 0.22, parts: [[0, 0.55, -0.45, 0.95, 0.12, 1.1, DARK], [0, 0.85, -0.7, 0.95, 0.4, 0.5, 0x3a3a3c], [0, 1.35, -0.6, 1.0, 0.07, 1.1, P], [0, 1.15, -0.1, 0.95, 0.5, 0.06, P], [0, 0.55, 0.65, 0.06, 0.06, 1.0, GREY], [0, 1.0, 0.95, 0.4, 0.6, 0.3, 0x8a8f9a], [0, 1.45, 0.95, 0.2, 0.22, 0.2, 0xb98058], wheel(-0.45, -0.9, 0.62, 0.05), wheel(0.45, -0.9, 0.62, 0.05), wheel(0, 1.15, 0.62, 0.05)] },
  two: { len: 1.9, wid: 0.7, speed: 1.05, parts: [[0, 0.55, 0, 0.3, 0.3, 1.1, P], [0, 0.45, 0.1, 0.22, 0.2, 0.6, DARK], [0, 0.82, -0.3, 0.3, 0.1, 0.55, DARK], wheel(0, 0.72, 0.62, 0.12), wheel(0, -0.72, 0.62, 0.12), [0, 1.2, -0.35, 0.4, 0.6, 0.3, 0xd9d2c0], [0, 1.65, -0.3, 0.24, 0.26, 0.24, 0xb98058], [0, 1.05, 0.55, 0.5, 0.05, 0.05, GREY]] },
  tempo: { len: 4.2, wid: 1.7, speed: 0.8, parts: [[0, 0.75, 0, 1.7, 0.18, 4.2, DARK], [0, 1.3, 1.2, 1.65, 1.2, 1.5, P, TC], [0, 1.55, 1.9, 1.5, 0.5, 0.06, GL], [0, 1.45, -0.9, 1.6, 1.0, 2.5, P], [0, 0.45, 2.05, 1.5, 0.25, 0.1, DARK], wheel(-0.82, 1.3, 0.7), wheel(0.82, 1.3, 0.7), wheel(-0.82, -1.2, 0.7), wheel(0.82, -1.2, 0.7)] },
  truck: { len: 7.2, wid: 2.4, speed: 0.8, parts: [[0, 0.9, 0, 2.3, 0.25, 7.2, DARK], [0, 1.9, 2.5, 2.3, 1.8, 1.8, P, TC], [0, 2.3, 3.42, 2.0, 0.7, 0.06, GL], [0, 2.1, -0.9, 2.4, 2.0, 4.8, P], [-1.21, 2.1, -0.9, 0.04, 1.4, 4.4, 0xe3b21a], [1.21, 2.1, -0.9, 0.04, 1.4, 4.4, 0xe3b21a], [-1.23, 2.3, -0.9, 0.04, 0.5, 3.6, 0xb11f1f], [1.23, 2.3, -0.9, 0.04, 0.5, 3.6, 0xb11f1f], [-1.23, 1.6, -0.9, 0.04, 0.3, 4.0, 0x2a64c9], [1.23, 1.6, -0.9, 0.04, 0.3, 4.0, 0x2a64c9], [0, 3.26, 3.0, 2.2, 0.35, 0.8, 0xe3b21a], wheel(-1.1, 2.4, 0.95, 0.3), wheel(1.1, 2.4, 0.95, 0.3), wheel(-1.1, -2.3, 0.95, 0.3), wheel(1.1, -2.3, 0.95, 0.3), wheel(-1.1, -0.9, 0.95, 0.3), wheel(1.1, -0.9, 0.95, 0.3)] },
};
export const DIM = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, { len: v.len, wid: v.wid, speed: v.speed }]));
DIM.bus = { len: 11, wid: 2.5, speed: 0.9 };
/* Real car models used as NPC traffic (docs/NEW_CARS_PLAN.md, phase C1b): each is a low-polygon version (about 3,000 triangles) of one of the owner-supplied cars, stored in the traffic pack (assets/traffic/traffic_pack.glb) and drawn here as one more InstancedMesh. A model stands in for its `base` kind (paint colours, parking and spacing rules come from the base kind) for `share` of the cars of that kind, once the pack has loaded; until then, and if it does not load, every car is the box car. */
export const MODEL_SETS = {
  'sx4-hatch': { base: 'hatch', share: 0.22, speed: 1 },
  'endeavour-suv': { base: 'suv', share: 0.45, speed: 0.95 },
  'gtr-sports': { base: 'hatch', share: 0.012, speed: 1.15 },       // one car in eighty: a supercar is rare on a Delhi road
};
/* which garage car a taken NPC car becomes (null: it cannot be driven by the player: auto rickshaws, e-rickshaws, cycle rickshaws) */
export const GARAGE_OF = { hatch: 'sx4', 'sx4-hatch': 'sx4', suv: 'everest', 'endeavour-suv': 'everest', 'gtr-sports': 'r35', taxi: 'sx4', two: 'bike', tempo: 'truck', truck: 'truck', auto: null, erick: null, cyclerick: null };
export const baseKind = k => (MODEL_SETS[k] ? MODEL_SETS[k].base : k);

function merge(parts) {
  const pos = [], nor = [], col = [], idx = [], c = new THREE.Color(); let base = 0;
  for (const [cx, cy, cz, sx, sy, sz, color, shape] of parts) { let g; if (shape === 'cyl') { g = new THREE.CylinderGeometry(sy / 2, sy / 2, sx, 10); g.rotateZ(Math.PI / 2); } else { g = new THREE.BoxGeometry(sx, sy, sz); if (shape && shape.kx) { const q = g.attributes.position; for (let i = 0; i < q.count; i++) if (q.getY(i) > 0) { q.setX(i, q.getX(i) * shape.kx); q.setZ(i, q.getZ(i) * shape.kz + shape.dz); } g.computeVertexNormals(); } } g.translate(cx, cy, cz); const p = g.attributes.position.array, n = g.attributes.normal.array; if (color === P) c.setRGB(1, 1, 1); else c.setHex(color);
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b); for (const i of g.index.array) idx.push(base + i); base += p.length / 3; g.dispose(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); return g;
}

/* a low-floor bus: liveries { body, stripe, roof } as hex; the doors are on the left (traffic keeps left) */
export function busGeometry(lv) {
  const L = 10.9, parts = [[0, 0.95, 0, 2.5, 1.0, L, lv.body], [0, 1.8, 0, 2.52, 0.85, L - 0.4, GL], [0, 2.45, 0, 2.5, 0.35, L, lv.body], [0, 2.7, 0, 2.3, 0.1, L - 0.3, lv.roof], [0, 1.12, 0, 2.53, 0.1, L, lv.stripe], [0, 1.85, L / 2, 2.3, 0.8, 0.05, GL], [0, 0.5, L / 2, 2.4, 0.4, 0.12, DARK], [0, 0.5, -L / 2, 2.4, 0.4, 0.12, DARK], [0, 1.4, -L / 2, 2.3, 1.7, 0.05, lv.body],
    [1.26, 1.2, 3.6, 0.04, 1.9, 1.0, 0x2a2e33], [1.26, 1.2, -1.0, 0.04, 1.9, 1.0, 0x2a2e33], [0.6, 2.85, 1.0, 1.1, 0.14, 1.6, 0xe0ddd2], [0, 0.95, L / 2 + 0.01, 0.5, 0.1, 0.04, 0xfff2c8], [-0.9, 0.95, L / 2 + 0.01, 0.3, 0.2, 0.04, 0xfff2c8], [0.9, 0.95, L / 2 + 0.01, 0.3, 0.2, 0.04, 0xfff2c8], [-0.9, 0.95, -L / 2 - 0.01, 0.3, 0.2, 0.04, 0xb11f1f], [0.9, 0.95, -L / 2 - 0.01, 0.3, 0.2, 0.04, 0xb11f1f]];
  for (const z of [3.7, -3.4]) for (const x of [-1.2, 1.2]) parts.push(wheel(x, z, 1.0, 0.3));
  return merge(parts);
}
/* the destination boards of a bus (front, rear, both sides) as four quads with uv 0..1 each, so one canvas texture serves all */
export function boardGeometry() {
  const pos = [], uv = [], idx = []; let b = 0; const q = (cx, cy, cz, ux, uz, w, h, nx, nz) => { const hw = w / 2; pos.push(cx - ux * hw, cy - h / 2, cz - uz * hw, cx + ux * hw, cy - h / 2, cz + uz * hw, cx + ux * hw, cy + h / 2, cz + uz * hw, cx - ux * hw, cy + h / 2, cz - uz * hw); uv.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); b += 4; void nx; void nz; };
  q(0, 2.55, 5.5, 1, 0, 1.9, 0.32, 0, 1);               // front: facing +z (a viewer in front has +x on the right)
  q(0, 2.3, -5.46, -1, 0, 1.0, 0.4, 0, -1);             // rear
  q(1.27, 2.2, 1.6, 0, -1, 2.2, 0.36, 1, 0);            // the left side of the bus (+x): the viewer outside has -z on the right
  q(-1.27, 2.2, 1.6, 0, 1, 2.2, 0.36, -1, 0);           // the right side
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}

const CAP = { hatch: 260, suv: 120, taxi: 40, auto: 70, erick: 50, cyclerick: 24, two: 260, tempo: 30, truck: 24 };
export class Fleet {
  constructor(scene) {
    this.f = {}; this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15, envMapIntensity: 0.4 }); this.group = new THREE.Group(); scene.add(this.group);
    for (const k in KINDS) { const g = merge(KINDS[k].parts), m = new THREE.InstancedMesh(g, this.mat, CAP[k]); m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP[k] * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); this.group.add(m); this.f[k] = { mesh: m, n: 0, cap: CAP[k] }; }
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.up = new THREE.Vector3(0, 1, 0); this.sc = new THREE.Vector3(1, 1, 1); this.pos = new THREE.Vector3(); this.col = new THREE.Color();
  }
  begin() { for (const k in this.f) this.f[k].n = 0; }
  /* one vehicle: kind, position relative to the scene (origin already subtracted), yaw (travel direction in the game's x, z plane), paint hex */
  add(kind, x, y, z, yaw, hex) { const f = this.f[kind]; if (!f || f.n >= f.cap) return false; this.q.setFromAxisAngle(this.up, -yaw + Math.PI / 2); this.pos.set(x, y, z); this.m4.compose(this.pos, this.q, this.sc); f.mesh.setMatrixAt(f.n, this.m4); f.mesh.setColorAt(f.n, this.col.setHex(hex)); f.n++; return true; }
  /* a model kind from the traffic pack: geo carries position, normal and a 'color' attribute (white where the body paint goes); len and wid from the pack's size list */
  addModel(kind, geo, len, wid, speed) {
    if (this.f[kind]) return; const cap = 80, m = new THREE.InstancedMesh(geo, this.mat, cap); m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); m.visible = false;
    this.group.add(m); this.f[kind] = { mesh: m, n: 0, cap }; DIM[kind] = { len, wid, speed };
  }
  end() { for (const k in this.f) { const f = this.f[k]; f.mesh.count = f.n; f.mesh.visible = f.n > 0; f.mesh.instanceMatrix.needsUpdate = true; f.mesh.instanceColor.needsUpdate = true; } }
  counts() { const o = {}; for (const k in this.f) o[k] = this.f[k].n; return o; }
}
