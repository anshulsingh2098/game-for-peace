/* Traffic you see: draws the cars of the simulation (sim.js) as a few instanced meshes, one per kind of vehicle plus tail and head lights, so a whole road of traffic is
   about five draw calls. The cars are plain boxes in the same plain materials as the rest of the world's structures: they are scenery to drive past, not hero models. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TrafficSim, MODES, KINDS } from './sim.js';

const PAINT = [0xc8101c, 0x2846a4, 0xe9ecef, 0x16181d, 0xf08a24, 0x2a9d5b, 0x8a9099, 0xd8c86a];            // body colours (the instance colour multiplies the white body vertices)
function part(w, h, d, x, y, z, hex) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g;
}
const GLASS = 0x232b36, TYRE = 0x131418, WHITE = 0xffffff;
function geometry(kind) {                                                                                       // front is +z, wheels sit on y = 0
  const K = KINDS[kind], w = K.w, L = K.len, parts = [];
  if (kind === 'truck') {
    parts.push(part(w, 1.0, 2.2, 0, 1.2, L / 2 - 1.1, WHITE), part(w * 0.92, 1.0, 1.6, 0, 1.9, L / 2 - 1.1, GLASS), part(w, 2.4, L - 2.5, 0, 1.9, -1.25, 0xd9dde2));          // cab, windscreen band, box trailer
    for (const z of [L / 2 - 1.3, -L / 2 + 1.3, -L / 2 + 2.6]) for (const s of [-1, 1]) parts.push(part(0.3, 0.9, 0.9, s * (w / 2 - 0.1), 0.45, z, TYRE));
  } else {
    const hgt = kind === 'van' ? 1.0 : 0.62;
    parts.push(part(w, 0.62, L, 0, 0.62, 0, WHITE), part(w * 0.88, hgt, L * 0.5, 0, 0.62 + 0.31 + hgt / 2, -L * 0.06, GLASS), part(w * 0.84, 0.06, L * 0.46, 0, 0.93 + hgt + 0.03, -L * 0.06, WHITE));    // body, glass cabin, roof
    for (const z of [L / 2 - 0.95, -L / 2 + 0.95]) for (const s of [-1, 1]) parts.push(part(0.26, 0.7, 0.7, s * (w / 2 - 0.08), 0.35, z, TYRE));
  }
  const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); g.computeBoundingSphere(); return g;
}

export class Traffic {
  /* seed: the world's seed string; origin: the render origin (grid.origin); drive: 'right' or 'left' (which side the traffic keeps to) */
  constructor(scene, road, seed, origin, { mode = 'light', drive = 'right' } = {}) {
    this.scene = scene; this.origin = origin; this.sim = new TrafficSim(road, { seed, mode, drive }); this.group = new THREE.Group(); scene.add(this.group);
    const cap = MODES.busy + 4, body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35, envMapIntensity: 0.9 });
    this.meshes = {}; this.geos = [];
    for (const kind of Object.keys(KINDS)) { const geo = geometry(kind); this.geos.push(geo); const m = new THREE.InstancedMesh(geo, body, cap); m.count = 0; m.castShadow = true; m.frustumCulled = false; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.group.add(m); this.meshes[kind] = m; }
    const lg = new THREE.BoxGeometry(0.34, 0.14, 0.06), tail = new THREE.MeshBasicMaterial({ fog: true }), head = new THREE.MeshBasicMaterial({ color: 0xfff1d0, fog: true });
    this.tail = new THREE.InstancedMesh(lg, tail, cap * 2); this.head = new THREE.InstancedMesh(lg, head, cap * 2); for (const m of [this.tail, this.head]) { m.count = 0; m.frustumCulled = false; this.group.add(m); }
    this.tail.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2 * 3), 3); this.lgeo = lg; this.mats = [body, tail, head];
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.one = new THREE.Vector3(1, 1, 1); this.c = new THREE.Color(); this.l = new THREE.Matrix4();
  }
  setMode(mode) { this.sim.setMode(mode); this.draw(false); }
  get mode() { return this.sim.mode; }
  /* advance the cars and place the instances; `player` is { x, z, s, u, yaw }; `night`: lights on */
  update(dt, player, night) { this.sim.update(dt, player); this.draw(night); }
  draw(night) {
    const counts = { sedan: 0, van: 0, truck: 0 }, o = this.origin; let nt = 0, nh = 0;
    for (const car of this.sim.cars) {
      const mesh = this.meshes[car.kind], i = counts[car.kind]++; if (i >= mesh.instanceMatrix.count) continue;
      this.q.setFromEuler(this.e.set(0, Math.PI / 2 - car.yaw, 0)); this.m.compose(this.v.set(car.x - o.x, car.y + 0.02, car.z - o.z), this.q, this.one); mesh.setMatrixAt(i, this.m);
      mesh.setColorAt(i, this.c.setHex(PAINT[car.colour % PAINT.length]));
      const L = car.len / 2, hy = car.kind === 'truck' ? 1.0 : 0.78;
      for (const s of [-1, 1]) {
        this.l.compose(this.v.set(s * (car.w / 2 - 0.4), hy, -L - 0.02), this.q.identity(), this.one); this.l.premultiply(this.m); this.tail.setMatrixAt(nt, this.l); this.tail.setColorAt(nt++, this.c.setRGB(car.brake ? 1 : night ? 0.55 : 0.28, car.brake ? 0.05 : 0.02, 0.02));
        this.l.compose(this.v.set(s * (car.w / 2 - 0.4), hy, L + 0.02), this.q.identity(), this.one); this.l.premultiply(this.m); this.head.setMatrixAt(nh++, this.l);
      }
    }
    for (const k in this.meshes) { const m = this.meshes[k]; m.count = Math.min(counts[k], m.instanceMatrix.count); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    this.tail.count = Math.min(nt, this.tail.instanceMatrix.count); this.head.count = Math.min(nh, this.head.instanceMatrix.count); this.head.visible = night || nh > 0 && night;
    this.tail.instanceMatrix.needsUpdate = true; this.tail.instanceColor.needsUpdate = true; this.head.instanceMatrix.needsUpdate = true;
  }
  /* obstacle circles for the player's physics (world.near contract) */
  circles(x, z, r) { return this.sim.circles(x, z, r); }
  dispose() { this.scene.remove(this.group); for (const g of this.geos) g.dispose(); this.lgeo.dispose(); for (const m of this.mats) m.dispose(); for (const m of [...Object.values(this.meshes), this.tail, this.head]) m.dispose(); }
}
