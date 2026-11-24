/* Damage to the other cars of the city (docs/DAMAGE_PLAN.md, phase 4): traffic cars and parked cars. They are instances of one shared mesh per kind (traffic.fleet), so a car that is hit is taken out of the fleet and
   drawn as a mesh of its own (a copy of its kind's geometry with the paint baked into the vertex colours); the dent is made in that copy, with the same rule as the player's car (vehicle/damage.js: DENT, HEALTH). A hit car
   stops for a while (a shaken driver), a badly hurt one never moves again, and a car whose engine is gone smokes, burns for a fuse and bursts: blast, buckled bonnet, soot-black body, flames for half a minute. A wreck is
   solid like any car, so the street can be blocked by it and the traffic queues behind. Browser only. */
import * as THREE from 'three';
import { FireFx } from '../../vehicle/fire.js';
import { DIM } from './vehicles.js';
import { DENT, HEALTH } from '../../vehicle/damage.js';

const hashf = i => { let h = (i | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const FAR = 520;
/* the same displacement for the same place, so triangles that meet at a corner move together (the copy is not indexed) */
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x, smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hv = (x, y, z) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
const vnoise = (x, y, z) => { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); let fx = x - ix, fy = y - iy, fz = z - iz; fx *= fx * (3 - 2 * fx); fy *= fy * (3 - 2 * fy); fz *= fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t; return L(L(L(hv(ix, iy, iz), hv(ix + 1, iy, iz), fx), L(hv(ix, iy + 1, iz), hv(ix + 1, iy + 1, iz), fx), fy), L(L(hv(ix, iy, iz + 1), hv(ix + 1, iy, iz + 1), fx), L(hv(ix, iy + 1, iz + 1), hv(ix + 1, iy + 1, iz + 1), fx), fy), fz); };
const hp = (x, y, z, k) => hashf((Math.round(x * 40) * 73856093) ^ (Math.round(y * 40) * 19349663) ^ (Math.round(z * 40) * 83492791) ^ (k * 40503));
/* a box has only corner vertices to bend: split every triangle in four, `levels` times, keeping position and colour */
function subdivide(src, levels) {
  let g = src.index ? src.toNonIndexed() : src, P = g.attributes.position.array, C = g.attributes.color.array;
  for (let l = 0; l < levels; l++) {
    const n = P.length / 9, P2 = new Float32Array(n * 36), C2 = new Float32Array(n * 36);
    for (let t = 0; t < n; t++) {
      const o = t * 9, out = t * 36;
      for (const [A, AC] of [[P, 0], [C, 1]]) {
        const D = AC ? C2 : P2, V = i => [A[o + i * 3], A[o + i * 3 + 1], A[o + i * 3 + 2]], a = V(0), b = V(1), c = V(2), m = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2, (u[2] + v[2]) / 2], ab = m(a, b), bc = m(b, c), ca = m(c, a);
        [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]].forEach((tri, k) => tri.forEach((v, j) => { D[out + k * 9 + j * 3] = v[0]; D[out + k * 9 + j * 3 + 1] = v[1]; D[out + k * 9 + j * 3 + 2] = v[2]; }));
      }
    }
    P = P2; C = C2;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3)); out.computeVertexNormals(); return out;
}

export class TrafficDamage {
  constructor(scene, origin, traffic) {
    this.scene = scene; this.origin = origin; this.traffic = traffic; this.list = []; this.fx = new FireFx(scene); this.cosmetic = false; this.gy = 0;
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15, envMapIntensity: 0.4 }); this.light = null; this.stats = { hit: 0, burnt: 0 };
  }
  /* take a car out of the fleet and give it a mesh of its own */
  start(car) {
    const src = this.traffic.fleet.f[car.kind]; if (!src) return null; const g = subdivide(src.mesh.geometry, 2), n = g.attributes.position.count, cols = new Float32Array(g.attributes.color.array), paint = new THREE.Color(car.paint);
    for (let i = 0; i < n; i++) if (cols[i * 3] > 0.99 && cols[i * 3 + 1] > 0.99 && cols[i * 3 + 2] > 0.99) { cols[i * 3] = paint.r; cols[i * 3 + 1] = paint.g; cols[i * 3 + 2] = paint.b; }       // white vertices take the paint
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); const pos = g.attributes.position.array, mesh = new THREE.Mesh(g, this.mat); mesh.castShadow = true; mesh.frustumCulled = false; this.scene.add(mesh);
    car.wreck = true; car.dmg = { mesh, g, orig: pos.slice(), tot: new Float32Array(n), cols0: cols.slice(), health: 1, engine: 1, state: 'ok', fuse: 0, since: 0, burstAt: 0, hits: 0, n, len: DIM[car.kind].len, wid: DIM[car.kind].wid, char: 0 }; this.list.push(car); this.place(car); return car.dmg;
  }
  place(car) {
    const d = car.dmg, m = d.mesh, f = d.fall, e = f ? Math.min(1, f.t / 0.55) : 0, k = e * e * (3 - 2 * e);
    m.position.set(car.x - this.origin.x, this.gy + (car.h || 0), car.z - this.origin.z); m.rotation.order = 'YXZ'; m.rotation.set(0, -car.yaw + Math.PI / 2, f ? f.side * 1.42 * k : 0);       // a bike that is hit tips over on its side
  }
  /* a two-wheeler is knocked over: it takes its own mesh (if it has none yet), stops for good and falls toward `side` (+1: the bike's +x side goes up, -1: down) */
  fall(car, side) { const d = car.dmg || this.start(car); if (!d || d.fall) return; d.fall = { t: 0, side: side >= 0 ? 1 : -1 }; car.hold = Infinity; }                  // it keeps its speed: the traffic simulation brakes it at 9 m/s2, so it slides along the road on its side
  /* car-local coordinates of a world point (x, z) on the car, and of a world direction */
  local(car, x, z) { const th = -car.yaw + Math.PI / 2, c = Math.cos(th), s = Math.sin(th), dx = x - car.x, dz = z - car.z; return { x: dx * c - dz * s, z: dx * s + dz * c }; }
  /* the player's car hit this car: h = { x, z, nx, nz, vn } as the physics reports it (the normal points from this car into the player's) */
  hit(car, h) {
    if (!(h.vn >= DENT.soft)) return; const d = car.dmg || this.start(car); if (!d) return; const depth = Math.min(DENT.maxHit, DENT.k * Math.pow(h.vn - DENT.soft, DENT.pow)); if (depth < 0.004) return;
    const L = this.local(car, h.x, h.z), dir = this.local({ x: 0, z: 0, yaw: car.yaw }, -h.nx, -h.nz), dl = Math.hypot(dir.x, dir.z) || 1, dx = dir.x / dl, dz = dir.z / dl;
    const cx = Math.max(-d.wid / 2, Math.min(d.wid / 2, L.x)), cz = Math.max(-d.len / 2, Math.min(d.len / 2, L.z)), cy = 0.7, R = DENT.r0 + DENT.rk * h.vn, R2 = R * R, pos = d.g.attributes.position.array;
    for (let i = 0, j = 0; i < d.n; i++, j += 3) {
      const ex = pos[j] - cx, ey = pos[j + 1] - cy, ez = pos[j + 2] - cz, d2 = ex * ex + ey * ey + ez * ez; if (d2 > R2) continue;
      const t = 1 - Math.sqrt(d2) / R, w = t * t * (3 - 2 * t), room = DENT.maxTotal - d.tot[i]; if (room <= 0) continue; const m = Math.min(room, depth * w * (1 - DENT.noise / 2 + DENT.noise * hp(pos[j], pos[j + 1], pos[j + 2], d.hits)));
      pos[j] += dx * m; pos[j + 2] += dz * m; pos[j + 1] -= m * 0.12; d.tot[i] += m;
    }
    d.g.attributes.position.needsUpdate = true; d.g.computeVertexNormals(); d.g.computeBoundingSphere(); d.hits++; this.stats.hit++;
    car.hold = Math.max(car.hold || 0, 4 + 0.4 * h.vn);                                                                // a shaken driver stops for a while
    if (!this.cosmetic && d.state !== 'wrecked') {
      const front = L.z > d.len * 0.2, rear = L.z < -d.len * 0.2, loss = Math.min(HEALTH.maxHit, HEALTH.lossK * Math.pow(h.vn - DENT.soft, HEALTH.lossPow)) / HEALTH.toughness;
      d.health = Math.max(0, d.health - loss); if (h.vn >= HEALTH.engMin) d.engine = Math.max(0, d.engine - loss * (front ? HEALTH.engFront : rear ? HEALTH.engRear : HEALTH.engSide));
      if (d.health < 0.3) car.hold = Infinity;                                                                          // too hurt to drive on
      if (d.state === 'ok' && d.engine < HEALTH.smoke) d.state = 'smoking';
      if (d.engine <= HEALTH.dead || d.health <= 0.03) { d.state = d.state === 'burning' ? 'burning' : 'dead'; car.hold = Infinity; }
      if ((d.state === 'smoking' || d.state === 'dead') && d.engine < HEALTH.fireEngine && d.health < HEALTH.fireFrame && h.vn >= HEALTH.fireMinHit && Math.random() < Math.min(0.85, Math.max(0.1, (HEALTH.fireFrame - d.health) + (HEALTH.fireEngine - d.engine) + 0.1))) { d.state = 'burning'; d.fuse = HEALTH.fuse[0] + Math.random() * (HEALTH.fuse[1] - HEALTH.fuse[0]); d.since = 0; car.hold = Infinity; }
    }
  }
  enginePos(car, out) { const d = car.dmg; out.set(0, 0.85, d.len / 2 - 0.8); return d.mesh.localToWorld(out); }
  update(dt, px, pz, gy) {
    this.gy = gy; let lightAt = null; const p = new THREE.Vector3();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const car = this.list[i], d = car.dmg;
      if (Math.hypot(car.x - px, car.z - pz) > FAR) { this.drop(i); continue; }
      if (d.fall) d.fall.t += dt; this.place(car); d.mesh.updateMatrixWorld(true); d.since += dt;
      if (d.state === 'ok') continue; this.enginePos(car, p); const fx = this.fx;
      if (d.state === 'smoking') fx.smoke(p, 8 + 18 * (1 - d.engine / HEALTH.smoke), dt, 0.3, d.engine < HEALTH.smokeBlack ? 0.2 : 0.6);
      else if (d.state === 'dead') fx.smoke(p, 6, dt, 0.35, 0.3);
      else if (d.state === 'burning') { const u = Math.min(1, d.since / 5); d.R = 0.4 + 0.11 * d.since; this.spots(car, d, 3, p).forEach(q => fx.flame(q, (18 + 36 * u) / 3, dt, 0.35 + 0.6 * u)); fx.smoke(p, 22, dt, 0.8, 0.12); this.burnColors(d); lightAt = lightAt || p.clone(); d.fuse -= dt; if (d.fuse <= 0) this.burst(car, p); }
      else if (d.state === 'wrecked') {
        const t = d.since - d.burstAt; d.R = Math.min(5, 1.1 + 0.4 * t); this.burnColors(d);
        if (t < HEALTH.burnSeconds) { const k = 1 - t / HEALTH.burnSeconds; this.spots(car, d, 3, p).forEach(q => fx.flame(q, (6 + 34 * k * k) / 3, dt, 0.25 + 0.7 * k)); fx.smoke(p, 14 + 12 * k, dt, 0.8, 0.1); lightAt = lightAt || p.clone(); }
        else if (t < HEALTH.smokeSeconds) fx.smoke(p, 5 * (1 - (t - HEALTH.burnSeconds) / (HEALTH.smokeSeconds - HEALTH.burnSeconds)), dt, 0.4, 0.2);
      }
    }
    if (this.list.length || this.fx.flash > 0) this.fx.update(dt, lightAt);
  }
  burst(car, p) {
    const d = car.dmg; d.state = 'wrecked'; d.burstAt = d.since; car.hold = Infinity; car.v = 0; this.fx.blast(p); this.stats.burnt++;
    const c = d.mesh.worldToLocal(p.clone()), R = 1.4, R2 = R * R, pos = d.g.attributes.position.array;                      // the bonnet buckles up
    for (let i = 0, j = 0; i < d.n; i++, j += 3) { const ex = pos[j] - c.x, ez = pos[j + 2] - c.z, d2 = ex * ex + ez * ez; if (d2 > R2 || pos[j + 1] < c.y - 0.25) continue; const t = 1 - Math.sqrt(d2) / R; pos[j + 1] += 0.2 * t * t * (0.7 + 0.6 * hp(pos[j], 0, pos[j + 2], 1)); }
    d.g.attributes.position.needsUpdate = true; d.g.computeVertexNormals(); d.g.computeBoundingSphere();
  }
  /* flames at random places inside the burnt region of the body, not at one point */
  spots(car, d, n, eng) { const out = [], R = Math.max(0.3, d.R || 0.4); for (let i = 0; i < n; i++) { const v = new THREE.Vector3((Math.random() - 0.5) * Math.min(d.wid, R * 1.4), 0.4 + Math.random() * 0.7, d.len / 2 - 0.8 + (Math.random() - 0.5) * Math.min(d.len, R * 2)); out.push(d.mesh.localToWorld(v)); } void eng; return out; }
  /* the burn: a noise-edged region growing from the engine, each vertex goes brown then sooty black by how deep inside it is (patchy, not even) */
  burnColors(d) {
    const a = d.g.attributes.color.array, o = d.cols0, pos = d.g.attributes.position.array, ez = d.len / 2 - 0.8, R = d.R || 0; if (R <= 0) return; d.burnT = (d.burnT || 0) + 1; if (d.burnT % 3) return;
    for (let i = 0, j = 0; i < d.n; i++, j += 3) {
      const x = pos[j], y = pos[j + 1], z = pos[j + 2], dist = Math.hypot(x, (y - 0.85) * 1.15, (z - ez) * 0.85), nz = 0.55 * vnoise(x * 2.6, y * 2.6, z * 2.6) + 0.3 * vnoise(x * 5.5, y * 5.5, z * 5.5) + 0.15 * vnoise(x * 11, y * 11, z * 11), b = clamp01((R - dist) / 1.3 + (nz - 0.5) * 1.15);
      const br = smooth(0.02, 0.3, b), so = smooth(0.28, 0.65, b), sf = 0.5 + vnoise(x * 9, y * 9, z * 9);
      for (let k = 0; k < 3; k++) { const base = o[j + k], brown = k === 0 ? 0.3 : k === 1 ? 0.15 : 0.07, soot = (k === 0 ? 0.025 : k === 1 ? 0.02 : 0.017) * sf; a[j + k] = (base * (1 - br) + brown * br) * (1 - so) + soot * so; }
    }
    d.g.attributes.color.needsUpdate = true;
  }
  soot(d, k) {
    if (d.char === k) return; d.char = k; const a = d.g.attributes.color.array, o = d.cols0, g = 0.035;
    for (let i = 0; i < a.length; i += 3) { a[i] = o[i] * (1 - k) + g * k * 1.1; a[i + 1] = o[i + 1] * (1 - k) + g * k * 0.95; a[i + 2] = o[i + 2] * (1 - k) + g * k * 0.85; } d.g.attributes.color.needsUpdate = true;
  }
  drop(i) { const car = this.list[i], d = car.dmg; this.scene.remove(d.mesh); d.g.dispose(); car.wreck = false; car.dmg = null; this.list.splice(i, 1); }
  dispose() { for (let i = this.list.length - 1; i >= 0; i--) this.drop(i); this.fx.dispose(); this.mat.dispose(); }
}
