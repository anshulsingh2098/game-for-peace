/* Things a car can knock over (docs/DAMAGE_PLAN.md, phase 1): traffic cones and street dustbins on the pavements of the city. They are not solid for the car (it drives through them, losing a little
   speed); when the car touches one fast enough, it leaves the tile and becomes a rigid body in a small Rapier world of its own, tumbles, and lies where it stops. The car is a kinematic box in that world,
   so a bin thrown onto the bonnet rolls off it. Placement is deterministic: a hash of the street piece's id and the position along it. Browser only (it makes meshes); the numbers are in DAMAGE. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import RAPIER from '../../../vendor/rapier/rapier.mjs';

/* the design table for this phase: closing speed (m/s) at which the car knocks it over, mass (kg), the car's speed kept after hitting it, collider size.
   These are choices for a believable result, not measured values (see the plan). */
export const DAMAGE = {
  cone: { knock: 0.3, mass: 1.5, keep: 0.997, r: 0.2, h: 0.7, up: 2.2 },
  bin: { knock: 0.5, mass: 22, keep: 0.985, r: 0.27, h: 0.8, up: 1.6, scatter: 6 },
  /* poles (phase 2): the closing speed (m/s) at which the car snaps them off at the base; below it they hold and dent the car. A steel lamp post on a breakaway base gives way from 6 m/s (22 km/h);
     an electric pole (concrete or steel, carrying wires) holds up to 26 m/s (94 km/h). The wires of the tile stay where they were. */
  lamp: { snap: 6, mass: 110, keep: 0.93, r: 0.22, h: 7.1, solid: 0.2 },
  power: { snap: 26, mass: 260, keep: 0.8, r: 0.25, h: 7.2, solid: 0.25 },
};
const WALK = new Set(['primary', 'secondary', 'tertiary', 'residential']);
const CAP = 480, RANGE = 220, MAXDEBRIS = 14, CAR = 1 << 15, GROUND = 1 << 14, H = 1 / 120;
const hash = n => { let h = (n | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function binGeo() {
  const body = new THREE.CylinderGeometry(0.27, 0.23, 0.74, 14); body.translate(0, 0.37, 0);
  const lid = new THREE.CylinderGeometry(0.29, 0.28, 0.07, 14); lid.translate(0, 0.78, 0);
  const rim = new THREE.TorusGeometry(0.255, 0.018, 6, 14); rim.rotateX(Math.PI / 2); rim.translate(0, 0.7, 0);
  const g = mergeGeometries([body, lid, rim].map(x => x.toNonIndexed())); const c = new Float32Array(g.attributes.position.count * 3), col = new THREE.Color();
  for (let i = 0; i < g.attributes.position.count; i++) { const y = g.attributes.position.getY(i); col.setHex(y > 0.74 ? 0x1f5a36 : 0x2f8a52); c.set([col.r, col.g, col.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
function colored(boxes) {
  const parts = boxes.map(([w, h, d, x, y, z, hex]) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); const c = new Float32Array(g.attributes.position.count * 3), col = new THREE.Color(hex); for (let i = 0; i < g.attributes.position.count; i++) c.set([col.r, col.g, col.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; });
  const g = mergeGeometries(parts); g.deleteAttribute('uv'); return g;
}
/* the arm of both poles points along +x of the model; the base is at y 0 */
const lampGeo = () => colored([[0.14, 7, 0.14, 0, 3.5, 0, 0x3a3d40], [0.5, 0.18, 0.3, 1.0, 7.09, 0, 0xe8e0c8]]);
const powerGeo = () => colored([[0.2, 7.2, 0.2, 0, 3.6, 0, 0x9a9890], [1.4, 0.1, 0.12, 0, 6.25, 0, 0x9a9890]]);
function coneGeo() {
  const cone = new THREE.ConeGeometry(0.15, 0.62, 12); cone.translate(0, 0.37, 0); const base = new THREE.BoxGeometry(0.4, 0.04, 0.4); base.translate(0, 0.02, 0);
  const g = mergeGeometries([cone, base].map(x => x.toNonIndexed())); const c = new Float32Array(g.attributes.position.count * 3), col = new THREE.Color();
  for (let i = 0; i < g.attributes.position.count; i++) { const y = g.attributes.position.getY(i); col.setHex(y < 0.05 ? 0x222222 : (y > 0.25 && y < 0.42 ? 0xf4f4f0 : 0xf2641a)); c.set([col.r, col.g, col.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}

/* rigid bodies of knocked-over things, in a Rapier world of their own */
class Debris {
  constructor(scene, origin, geos, mat) { this.scene = scene; this.origin = origin; this.geos = geos; this.mat = mat; this.world = null; this.list = []; this.ox = 0; this.oz = 0; this.acc = 0; this.carBody = null; this.carCol = null; this.gy = 0; }
  ensure(x, z, y) {
    if (this.world) return; this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); this.world.timestep = H; this.ox = x; this.oz = z; this.gy = y;
    this.ground = this.world.createCollider(RAPIER.ColliderDesc.cuboid(300, 0.5, 300).setTranslation(0, y - 0.5, 0).setFriction(0.7).setRestitution(0.25).setCollisionGroups((GROUND << 16) | 0x3fff));
    this.carBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()); this.carCol = this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.95, 0.5, 2.3).setFriction(0.5).setRestitution(0.2).setCollisionGroups(CAR << 16), this.carBody);
  }
  spawn(kind, prop, car) {
    this.ensure(prop.x, prop.z, prop.y); if (this.list.length >= MAXDEBRIS) this.remove(0);
    let slot = 0; const used = new Set(this.list.map(d => d.slot)); while (used.has(slot)) slot++; if (slot > 13) return null;
    const D = DAMAGE[kind], cv = [car.u * Math.cos(car.yaw) - car.v * Math.sin(car.yaw), car.u * Math.sin(car.yaw) + car.v * Math.cos(car.yaw)], sp = Math.hypot(cv[0], cv[1]), r = () => Math.random() - 0.5;
    const pole = kind === 'lamp' || kind === 'power', k = pole ? 0.2 : kind === 'bin' ? 0.85 : 0.7, qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), prop.yaw || 0);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(prop.x - this.ox, prop.y + D.h / 2, prop.z - this.oz).setRotation({ x: qy.x, y: qy.y, z: qy.z, w: qy.w })
      .setLinvel(cv[0] * k + r() * 0.4, pole ? 0.3 : D.up + 0.12 * sp, cv[1] * k + r() * 0.4).setAngvel(pole ? { x: (cv[1] / (sp || 1)) * (1.2 + 0.15 * sp), y: r() * 0.3, z: -(cv[0] / (sp || 1)) * (1.2 + 0.15 * sp) } : { x: r() * Math.min(14, 2 + sp), y: r() * 4, z: r() * Math.min(14, 2 + sp) }).setLinearDamping(0.05).setAngularDamping(0.5).setCcdEnabled(true));
    const cd = kind === 'bin' || pole ? RAPIER.ColliderDesc.cylinder(D.h / 2, D.r) : RAPIER.ColliderDesc.cylinder(D.h / 2, D.r * 0.9);
    this.world.createCollider(cd.setMass(D.mass).setFriction(0.7).setRestitution(0.3).setCollisionGroups(((1 << slot) << 16) | GROUND | CAR), body);
    const mesh = new THREE.Mesh(this.geos[kind], this.mat); mesh.castShadow = true; mesh.frustumCulled = false; this.scene.add(mesh);
    const d = { slot, kind, body, mesh, age: 0, rest: 0, fade: -1 }; this.list.push(d); return d;
  }
  remove(i) { const d = this.list[i]; this.world.removeRigidBody(d.body); this.scene.remove(d.mesh); this.list.splice(i, 1); }
  update(dt, car) {
    if (!this.world) return;
    if (car) { const hl = Math.max(1.8, (car.circles ? Math.max(...car.circles) - Math.min(...car.circles) : 3) / 2 + (car.radius || 0.95)), hw = Math.max(0.8, (car.radius || 0.95) * 0.95); this.carCol.setHalfExtents({ x: hw, y: 0.5, z: hl });
      this.carBody.setNextKinematicTranslation({ x: car.x - this.ox, y: car.y + 0.8, z: car.z - this.oz }); const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 - car.yaw); this.carBody.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w }); }
    let mask = 0; for (const d of this.list) if (car && d.age > 0.12) mask |= 1 << d.slot; this.carCol.setCollisionGroups((CAR << 16) | mask);
    this.acc += Math.min(dt, 0.05); let n = 0; while (this.acc >= H && n++ < 6) { this.world.step(); this.acc -= H; }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i]; d.age += dt; const t = d.body.translation(), q = d.body.rotation(), v = d.body.linvel();
      d.mesh.quaternion.set(q.x, q.y, q.z, q.w);
      // the mesh's origin is at its base; the body's centre is half the height up, along the body's own axis
      const up = new THREE.Vector3(0, -DAMAGE[d.kind].h / 2, 0).applyQuaternion(d.mesh.quaternion); d.mesh.position.set(t.x + this.ox - this.origin.x + up.x, t.y + up.y, t.z + this.oz - this.origin.z + up.z);
      d.rest = Math.hypot(v.x, v.y, v.z) < 0.15 ? d.rest + dt : 0; if (d.rest > 1 && d.age > 1) d.body.sleep();
      if (d.age > (DAMAGE[d.kind].snap ? 300 : 90) && d.fade < 0) d.fade = 0; if (d.fade >= 0) { d.fade += dt; d.mesh.scale.setScalar(Math.max(0.001, 1 - d.fade / 1.2)); if (d.fade > 1.2) this.remove(i); }
    }
    if (!this.list.length) { this.world.free && this.world.free(); this.world = null; this.carBody = this.carCol = this.ground = null; }
  }
  dispose() { for (let i = this.list.length - 1; i >= 0; i--) this.remove(i); if (this.world) { this.world.free && this.world.free(); this.world = null; } }
}

export class StreetProps {
  constructor(scene, origin, traffic) {
    this.scene = scene; this.origin = origin; this.traffic = traffic; this.t = 0; this.scanT = 0; this.byPiece = new Map(); this.knocked = new Set(); this.nextId = 1; this.dirty = true; this.gy = 0;
    this.geos = { bin: binGeo(), cone: coneGeo(), lamp: lampGeo(), power: powerGeo() }; this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.05, envMapIntensity: 0.4 });
    this.mesh = { bin: new THREE.InstancedMesh(this.geos.bin, this.mat, CAP), cone: new THREE.InstancedMesh(this.geos.cone, this.mat, CAP) };
    for (const m of Object.values(this.mesh)) { m.count = 0; m.frustumCulled = false; m.castShadow = true; scene.add(m); }
    this.poles = new Map(); this.pmesh = { lamp: new THREE.InstancedMesh(this.geos.lamp, this.mat, 900), power: new THREE.InstancedMesh(this.geos.power, this.mat, 900) }; this.pdirty = false;
    for (const m of Object.values(this.pmesh)) { m.count = 0; m.frustumCulled = false; m.castShadow = true; scene.add(m); }
    this.debris = new Debris(scene, origin, this.geos, this.mat); this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.one = new THREE.Vector3(1, 1, 1); this.axisY = new THREE.Vector3(0, 1, 0);
    this.stats = { placed: 0, knocked: 0 };
  }
  /* a point beside the street piece at arc length s, `off` metres to the side (+ left of the direction of travel) */
  at(pc, s, off, out) {
    const c = pc.cum, pts = pc.s.pts; let i = 0; while (i + 2 < c.length && c[i + 1] < s) i++;
    const f = Math.max(0, Math.min(1, (s - c[i]) / Math.max(0.01, c[i + 1] - c[i]))), dx = pts[i * 2 + 2] - pts[i * 2], dz = pts[i * 2 + 3] - pts[i * 2 + 1], L = Math.hypot(dx, dz) || 1;
    out.x = pts[i * 2] + dx * f - dz / L * off; out.z = pts[i * 2 + 1] + dz * f + dx / L * off; out.yaw = Math.atan2(dz, dx); return out;
  }
  populate(pc) {
    const list = []; this.byPiece.set(pc, list); if (!WALK.has(pc.cls) || pc.len < 24) return; const o = {};
    for (let k = 0, s = 9; s < pc.len - 7; k++, s += 26) {
      const h = hash(pc.id * 131 + k * 17);
      if (h < 0.34) { const side = hash(pc.id * 7 + k) < 0.5 ? 1 : -1; this.at(pc, s, side * (hash(pc.id * 3 + k) < 0.6 ? pc.w / 2 - 0.6 : pc.w / 2 + 0.75), o); list.push({ id: this.nextId++, kind: 'bin', x: o.x, z: o.z, y: this.gy, yaw: hash(pc.id + k) * 6.28, road: o.yaw, key: pc.id * 1000 + k }); }
      else if (h > 0.9) { const side = hash(pc.id * 11 + k) < 0.5 ? 1 : -1; for (let c = 0; c < 4; c++) { this.at(pc, Math.min(pc.len - 2, s + c * 1.7), side * (pc.w / 2 - 0.35), o); list.push({ id: this.nextId++, kind: 'cone', x: o.x, z: o.z, y: this.gy, yaw: 0, road: o.yaw, key: pc.id * 1000 + k * 10 + c + 500000 }); } }
    }
    this.stats.placed += list.length; for (const p of list) if (this.knocked.has(p.key)) p.gone = true; this.dirty = true;
  }
  /* every frame: car = { x, z, y, yaw, u, v, circles, radius } or null. Returns what the car hit: [{ kind, speed, keep }] */
  update(dt, px, pz, gy, car) {
    this.t += dt; if (this.gy !== gy) { this.gy = gy; for (const arr of this.poles.values()) for (const p of arr) p.y = gy; this.pdirty = true; } this.scanT -= dt; const hits = [];
    if (this.scanT <= 0) { this.scanT = 0.8; this.pdirty = true;
      for (const pc of this.traffic.pieces.keys()) { if (!this.byPiece.has(pc)) { const p = pc.s.pts; if (Math.hypot(p[0] - px, p[1] - pz) < RANGE + pc.len) this.populate(pc); } }
      for (const pc of [...this.byPiece.keys()]) if (!pc.alive) this.byPiece.delete(pc);
      this.dirty = true; }
    if (car) {
      const sp = Math.hypot(car.u, car.v), c = Math.cos(car.yaw), s = Math.sin(car.yaw);
      if (sp > 0.2) for (const list of this.byPiece.values()) for (const p of list) {
        if (p.gone || Math.abs(p.x - car.x) > 8 || Math.abs(p.z - car.z) > 8) continue;
        const D = DAMAGE[p.kind], rr = (car.radius || 0.95) + D.r; let hit = false; for (const off of car.circles || [0]) { const dx = p.x - (car.x + c * off), dz = p.z - (car.z + s * off); if (dx * dx + dz * dz < rr * rr) { hit = true; break; } }
        if (!hit || Math.abs(p.y - car.y) > 2) continue;
        const dirx = (p.x - car.x), dirz = (p.z - car.z), dl = Math.hypot(dirx, dirz) || 1, vn = (car.u * c - car.v * s) * dirx / dl + (car.u * s + car.v * c) * dirz / dl;
        if (vn < D.knock) continue;
        if (this.debris.spawn(p.kind, p, car)) { p.gone = true; this.knocked.add(p.key); this.stats.knocked++; this.dirty = true; hits.push({ kind: p.kind, speed: vn, keep: D.keep }); }
      }
    }
    if (this.dirty) this.rebuild(px, pz);
    if (this.pdirty) this.rebuildPoles(px, pz);
    this.debris.update(dt, car); return hits;
  }
  rebuild(px, pz) {
    const n = { bin: 0, cone: 0 }; this.dirty = false;
    for (const list of this.byPiece.values()) for (const p of list) {
      if (p.gone || Math.abs(p.x - px) > RANGE || Math.abs(p.z - pz) > RANGE) continue; const im = this.mesh[p.kind]; if (n[p.kind] >= CAP) continue;
      this.q.setFromAxisAngle(this.axisY, -p.yaw); this.v.set(p.x - this.origin.x, p.y, p.z - this.origin.z); this.m4.compose(this.v, this.q, this.one); im.setMatrixAt(n[p.kind]++, this.m4);
    }
    for (const k of Object.keys(this.mesh)) { const im = this.mesh[k]; im.count = n[k]; im.visible = n[k] > 0; im.instanceMatrix.needsUpdate = true; }
  }
  /* lamp posts and electric poles of a tile (from streetlife.js: { k, x, z, ax, az }, the arm's direction): drawn here, solid for the car until it snaps one */
  addPoles(k, list) {
    const arr = list.map(p => ({ k: p.k, x: p.x, z: p.z, y: this.gy, yaw: Math.atan2(-p.az, p.ax), alive: true, tile: k })); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of arr) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    arr.bb = [x0 - 3, z0 - 3, x1 + 3, z1 + 3]; this.poles.set(k, arr); this.pdirty = true;
  }
  removePoles(k) { if (this.poles.delete(k)) this.pdirty = true; }
  circles(x, z, r) {
    const out = []; for (const arr of this.poles.values()) { const b = arr.bb; if (x < b[0] - r || x > b[2] + r || z < b[1] - r || z > b[3] + r) continue;
      for (const p of arr) { if (!p.alive || Math.abs(p.x - x) > r + 2 || Math.abs(p.z - z) > r + 2) continue; const D = DAMAGE[p.k]; out.push({ x: p.x, z: p.z, r: D.solid, y: p.y, snap: D.snap, keep: D.keep, pole: p }); } } return out;
  }
  /* the car broke this pole off: it stops being solid and falls over, away from the car */
  snapPole(p, car) { if (!p.alive) return; p.alive = false; this.pdirty = true; this.stats.snapped = (this.stats.snapped || 0) + 1; const c = car || { x: p.x - 1, z: p.z, y: p.y, yaw: 0, u: 3, v: 0 }; this.debris.spawn(p.k, p, c); }
  rebuildPoles(px, pz) {
    const n = { lamp: 0, power: 0 }; this.pdirty = false;
    for (const arr of this.poles.values()) for (const p of arr) { if (!p.alive || Math.abs(p.x - px) > 320 || Math.abs(p.z - pz) > 320) continue; const im = this.pmesh[p.k]; if (n[p.k] >= 900) continue;
      this.q.setFromAxisAngle(this.axisY, p.yaw); this.v.set(p.x - this.origin.x, p.y, p.z - this.origin.z); this.m4.compose(this.v, this.q, this.one); im.setMatrixAt(n[p.k]++, this.m4); }
    for (const k of Object.keys(this.pmesh)) { const im = this.pmesh[k]; im.count = n[k]; im.visible = n[k] > 0; im.instanceMatrix.needsUpdate = true; }
  }
  dispose() { this.debris.dispose(); for (const m of Object.values(this.pmesh)) { this.scene.remove(m); m.dispose(); } for (const m of Object.values(this.mesh)) { this.scene.remove(m); m.dispose(); } for (const g of Object.values(this.geos)) g.dispose(); this.mat.dispose(); }
}
