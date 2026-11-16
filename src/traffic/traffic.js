/* Traffic you see: draws the cars of the simulation (sim.js) as instanced meshes. Each kind of vehicle is two meshes at most: its paint (tinted a different colour per car, so a
   handful of models gives many cars) and everything else (windows, tyres, lights, trim in their own colours). That is about 25 draw calls for thirteen kinds, plus the tail and
   head lights, and kinds nobody is using cost nothing.
   The models are the traffic pack built by tools/blender/make_traffic_pack.py from Kenney's CC0 Car Kit (assets/traffic/traffic_pack.glb + traffic_pack.json). Until the pack has
   loaded (or if it cannot) the cars are plain boxes, so traffic never depends on the download. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TrafficSim, MODES, KINDS, DEFAULT_KINDS, EXTRA_KINDS, trafficKinds, branchMode } from './sim.js';

/* real-world body colours, as often as they are seen on a road: black, white, silver and grey lead; the rest are bright accents */
const PAINT = [].concat(...[[0x16181d, 4], [0xf2f3f5, 4], [0xb9bec6, 4], [0x6b7078, 3], [0xb3141f, 2], [0x1f3f8f, 2], [0x1f5a3c, 1], [0xd8cfae, 1], [0x6b4a32, 1], [0xe08a1e, 1], [0x2a78c2, 1], [0x7a1f2a, 1]].map(([c, n]) => Array(n).fill(c)));

/* loads the traffic pack: resolves to { kinds: [{ name, len, w, h, weight, paintable }], parts: { name: { paint: BufferGeometry|null, rest: BufferGeometry } } }, or null if anything fails */
export async function loadTrafficPack(dir = 'assets/traffic') {
  try {
    const meta = await (await fetch(dir + '/traffic_pack.json')).json(), gltf = await new GLTFLoader().loadAsync(dir + '/traffic_pack.glb'), parts = {};
    gltf.scene.updateMatrixWorld(true);
    for (const kind of Object.keys(meta)) {
      const node = gltf.scene.getObjectByName(kind); if (!node) continue; const p = { paint: null, rest: null };
      node.traverse(o => { if (!o.isMesh) return; const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); (o.material && o.material.name === 'Paint' ? (p.paint = g) : (p.rest = g)); });
      if (p.rest || p.paint) parts[kind] = p;
    }
    const kinds = Object.entries(meta).filter(([k]) => parts[k]).map(([name, m]) => ({ name, len: m.len, w: m.w, h: m.h, weight: m.weight, paintable: m.paintable }));
    return kinds.length ? { kinds, parts } : null;
  } catch (e) { console.warn('traffic models not loaded, using plain boxes', e); return null; }
}

/* the plain box vehicles used until the models are there */
function part(w, h, d, x, y, z, hex) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g;
}
const GLASS = 0x232b36, TYRE = 0x131418, WHITE = 0xffffff;
function boxGeometry(kind) {
  const K = KINDS[kind] || EXTRA_KINDS[kind], w = K.w, L = K.len, parts = [];
  if (kind === 'two-wheeler') {                                                                                     // a motorbike or scooter with its rider
    parts.push(part(0.22, 0.62, 0.62, 0, 0.35, L / 2 - 0.45, TYRE), part(0.22, 0.62, 0.62, 0, 0.35, -L / 2 + 0.45, TYRE), part(0.3, 0.45, 1.3, 0, 0.62, 0, 0x2f4a73), part(0.36, 0.12, 0.7, 0, 0.9, -0.25, 0x20242a), part(0.16, 0.12, 0.5, 0, 1.05, L / 2 - 0.55, 0x30363b));
    parts.push(part(0.46, 0.62, 0.3, 0, 1.25, -0.35, 0xc94f3a), part(0.24, 0.26, 0.24, 0, 1.78, -0.35, 0xd9a273), part(0.26, 0.2, 0.28, 0, 1.92, -0.35, 0x1f2328));        // rider: back, head, helmet
  } else if (kind === 'auto-rickshaw') {                                                                            // a three-wheeler: yellow body, black hood, open sides
    parts.push(part(0.3, 0.6, 0.6, 0, 0.32, L / 2 - 0.5, TYRE), part(0.26, 0.6, 0.6, -w / 2 + 0.15, 0.32, -L / 2 + 0.6, TYRE), part(0.26, 0.6, 0.6, w / 2 - 0.15, 0.32, -L / 2 + 0.6, TYRE));
    parts.push(part(w * 0.85, 0.55, L * 0.9, 0, 0.62, 0, 0xf2c230), part(w * 0.8, 0.12, L * 0.62, 0, 1.55, -0.25, 0x1d2024), part(0.08, 0.95, 0.08, -w * 0.4, 1.05, 0.55, 0x30363b), part(0.08, 0.95, 0.08, w * 0.4, 1.05, 0.55, 0x30363b), part(0.08, 0.95, 0.08, -w * 0.4, 1.05, -0.9, 0x30363b), part(0.08, 0.95, 0.08, w * 0.4, 1.05, -0.9, 0x30363b), part(w * 0.7, 0.4, 0.8, 0, 0.98, -0.4, 0x39414a), part(w * 0.7, 0.5, 0.12, 0, 1.15, L / 2 - 0.1, GLASS));
  } else if (kind === 'truck') {
    parts.push(part(w, 1.0, 2.2, 0, 1.2, L / 2 - 1.1, WHITE), part(w * 0.92, 1.0, 1.6, 0, 1.9, L / 2 - 1.1, GLASS), part(w, 2.4, L - 2.5, 0, 1.9, -1.25, 0xd9dde2));
    for (const z of [L / 2 - 1.3, -L / 2 + 1.3, -L / 2 + 2.6]) for (const s of [-1, 1]) parts.push(part(0.3, 0.9, 0.9, s * (w / 2 - 0.1), 0.45, z, TYRE));
  } else {
    const hgt = kind === 'van' ? 1.0 : 0.62;
    parts.push(part(w, 0.62, L, 0, 0.62, 0, WHITE), part(w * 0.88, hgt, L * 0.5, 0, 0.62 + 0.31 + hgt / 2, -L * 0.06, GLASS), part(w * 0.84, 0.06, L * 0.46, 0, 0.93 + hgt + 0.03, -L * 0.06, WHITE));
    for (const z of [L / 2 - 0.95, -L / 2 + 0.95]) for (const s of [-1, 1]) parts.push(part(0.26, 0.7, 0.7, s * (w / 2 - 0.08), 0.35, z, TYRE));
  }
  const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g;
}

export class Traffic {
  /* seed: the world's seed string; origin: the render origin (grid.origin); drive: 'right' or 'left'; pack: the loaded traffic pack (or null for boxes) */
  constructor(scene, road, seed, origin, { mode = 'low', drive = 'right', pack = null, scale = 1, mix = null } = {}) {
    this.mix = mix; this.scene = scene; this.origin = origin; this.opts = { seed, drive, scale }; this.extra = []; this.sim = new TrafficSim(road, { seed, mode, drive, scale }); this.group = new THREE.Group(); scene.add(this.group);
    this.cap = MODES.high + 4; this.groups = {}; this.geos = [];
    this.paintMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 });
    this.restMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, envMapIntensity: 0.8 });
    const lg = new THREE.BoxGeometry(0.34, 0.14, 0.06), tail = new THREE.MeshBasicMaterial({ fog: true }), head = new THREE.MeshBasicMaterial({ color: 0xfff1d0, fog: true }), cap2 = this.cap * 2;
    this.tail = new THREE.InstancedMesh(lg, tail, cap2); this.head = new THREE.InstancedMesh(lg, head, cap2); for (const m of [this.tail, this.head]) { m.count = 0; m.frustumCulled = false; this.group.add(m); }
    this.tail.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap2 * 3), 3); this.lgeo = lg; this.lightMats = [tail, head];
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.one = new THREE.Vector3(1, 1, 1); this.c = new THREE.Color(); this.l = new THREE.Matrix4();
    this.useModels(pack);
  }
  /* switch to the real models (or, with null, the plain boxes); the cars start over */
  useModels(pack) {
    for (const g of Object.values(this.groups)) for (const m of [g.paint, g.rest]) if (m) { this.group.remove(m); m.dispose(); }
    for (const g of this.geos) g.dispose(); this.geos = []; this.groups = {}; this.pack = pack || null;
    const kinds = trafficKinds(pack ? pack.kinds : DEFAULT_KINDS, this.mix);
    for (const k of kinds) {
      const g = { paint: null, rest: null };
      if (pack && pack.parts[k.name]) { const p = pack.parts[k.name]; g.rest = p.rest && this.make(p.rest, this.restMat, false); g.paint = p.paint && this.make(p.paint, this.paintMat, true); }
      else { const geo = boxGeometry(k.name); this.geos.push(geo); g.rest = this.make(geo, this.restMat, false, true); }
      this.groups[k.name] = g;
    }
    this.sim.setKinds(kinds); for (const e of this.extra) e.sim.setKinds(kinds);
  }
  /* cars on another road of the world (a road that crosses the main one): its own simulation, drawn with the same instanced meshes; it only runs while the player is near it (see branchMode) */
  addRoad(road) { const o = this.opts, sim = new TrafficSim(road, { seed: o.seed + ':' + this.extra.length, mode: 'off', drive: o.drive, scale: o.scale * 0.8 }); sim.setKinds(this.sim.kinds); const e = { road, sim }; this.extra.push(e); return e; }
  removeRoad(e) { const i = this.extra.indexOf(e); if (i >= 0) this.extra.splice(i, 1); }
  updateExtra(e, dt, player, active) { const want = branchMode(this.sim.mode, active); if (e.sim.mode !== want) e.sim.setMode(want); if (want !== 'off') e.sim.update(dt, player); }
  make(geo, mat, tinted, own) {
    if (!own && !this.pack) this.geos.push(geo);
    const m = new THREE.InstancedMesh(geo, mat, this.cap); m.count = 0; m.visible = false; m.castShadow = true; m.frustumCulled = false;
    if (tinted) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3); this.group.add(m); return m;
  }
  setMode(mode) { this.sim.setMode(mode); for (const e of this.extra) e.sim.setMode('off'); this.draw(false); }
  get mode() { return this.sim.mode; }
  /* advance the cars and place the instances; `player` is { x, z, s, u, yaw }; `night`: lights on */
  update(dt, player, night) { this.sim.update(dt, player); this.draw(night); }
  draw(night) {
    const counts = {}, o = this.origin; let nt = 0, nh = 0;
    const cars = this.extra.length ? this.sim.cars.concat(...this.extra.map(e => e.sim.cars)) : this.sim.cars;
    for (const car of cars) {
      const g = this.groups[car.kind]; if (!g) continue; const i = counts[car.kind] = (counts[car.kind] || 0); if (i >= this.cap) continue; counts[car.kind]++;
      this.q.setFromEuler(this.e.set(0, Math.PI / 2 - car.yaw, 0)); this.m.compose(this.v.set(car.x - o.x, car.y + 0.02, car.z - o.z), this.q, this.one);
      if (g.rest) g.rest.setMatrixAt(i, this.m); if (g.paint) { g.paint.setMatrixAt(i, this.m); g.paint.setColorAt(i, this.c.setHex(PAINT[car.colour % PAINT.length])); }
      const L = car.len / 2, hy = (car.h || 1.5) * 0.42;
      for (const s of [-1, 1]) {
        this.l.compose(this.v.set(s * (car.w / 2 - 0.4), hy, -L - 0.02), this.q.identity(), this.one); this.l.premultiply(this.m); this.tail.setMatrixAt(nt, this.l); this.tail.setColorAt(nt++, this.c.setRGB(car.brake ? 1 : night ? 0.55 : 0.28, car.brake ? 0.05 : 0.02, 0.02));
        this.l.compose(this.v.set(s * (car.w / 2 - 0.4), hy, L + 0.02), this.q.identity(), this.one); this.l.premultiply(this.m); this.head.setMatrixAt(nh++, this.l);
      }
    }
    for (const name in this.groups) { const g = this.groups[name], n = Math.min(counts[name] || 0, this.cap);
      for (const m of [g.paint, g.rest]) if (m) { m.count = n; m.visible = n > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } }
    this.tail.count = Math.min(nt, this.tail.instanceMatrix.count); this.head.count = Math.min(nh, this.head.instanceMatrix.count); this.tail.visible = nt > 0; this.head.visible = nh > 0 && night;
    this.tail.instanceMatrix.needsUpdate = true; this.tail.instanceColor.needsUpdate = true; this.head.instanceMatrix.needsUpdate = true;
  }
  /* obstacle circles for the player's physics (world.near contract) */
  circles(x, z, r) { const l = this.sim.circles(x, z, r); if (!this.extra.length) return l; const out = l.slice(); for (const e of this.extra) if (e.sim.cars.length) out.push(...e.sim.circles(x, z, r).map(a => a.slice())); return out; }
  dispose() {
    this.scene.remove(this.group); for (const g of Object.values(this.groups)) for (const m of [g.paint, g.rest]) if (m) m.dispose();
    for (const g of this.geos) g.dispose(); this.lgeo.dispose(); for (const m of [this.paintMat, this.restMat, ...this.lightMats]) m.dispose(); this.tail.dispose(); this.head.dispose();
  }
}
