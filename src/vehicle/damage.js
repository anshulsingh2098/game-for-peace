/* Visible crash damage to the player's vehicle (docs/DAMAGE_PLAN.md, phase 3): when the car physics reports a hit, the body's vertices near the contact point are pushed inward along the hit direction,
   smoothly (a falloff from the contact point), with a little noise, up to a limit per vertex, so repeated hits pile up. A hit below `DENT.soft` closing speed leaves no mark. Damage is kept per zone (front,
   rear, left, right) for the later phases (parts that come off, driving effects). `repair()` puts every vertex back. Browser only (it edits the loaded model's geometry, copied first so the shared model
   in the cache is never touched). The numbers are design choices, one table (`DENT`). */
import * as THREE from 'three';
import { FireFx } from './fire.js';

/* health, fire and the wreck (phase 4). Each hit costs body health lossK * (closing speed - soft) ^ lossPow (a 41 km/h wall costs 0.28, a 72 km/h wall 0.69, 100 km/h wrecks at once); engine health loses more from front hits
   (the engine is up front; the Ember RS has its engine behind the seats, so for it the rear counts). Below `smoke` engine health the bonnet smokes, below `fire` it burns for a fuse of a few seconds and then bursts: the car is
   wrecked, charred and cannot be driven again (a new vehicle from the garage replaces it). Design choices, tunable here. */
export const HEALTH = { lossK: 0.012, lossPow: 1.4, front: 1.6, side: 0.6, rear: 0.5, smoke: 0.55, fire: 0.25, fuse: [6, 9], burnSeconds: 38, smokeSeconds: 120 };
export const DENT = { soft: 2.0, k: 0.055, pow: 1.2, maxHit: 0.34, maxTotal: 0.5, r0: 0.45, rk: 0.07, noise: 0.3 };
const hashf = i => { let h = (i | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), Q = new THREE.Quaternion(), M = new THREE.Matrix4();

export class CarDamage {
  constructor(view) { this.view = view; this.parts = null; this.zone = { front: 0, rear: 0, left: 0, right: 0 }; this.hits = 0; this.box = null; this.reset(); }
  reset() { this.health = 1; this.engine = 1; this.state = 'ok'; this.fuse = 0; this.since = 0; this.char = 0; this.fx = null; this.orig = null; this.copies = null; this.cosmetic = false; this.burstAt = 0; }
  /* find the body's meshes (not the wheels), copy their geometry, remember each vertex in the model's own space */
  attach() {
    if (this.parts) return; const model = this.view.model; model.updateWorldMatrix(true, true); const inv = new THREE.Matrix4().copy(model.matrixWorld).invert(); this.parts = []; const box = new THREE.Box3();
    model.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      for (let p = o; p && p !== model; p = p.parent) if (/^Wheel_/.test(p.name)) return;
      if (/interior/i.test(o.name)) return;
      const g = o.geometry.clone(), pos = g.attributes.position, n = pos.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = pos.getX(i); a[i * 3 + 1] = pos.getY(i); a[i * 3 + 2] = pos.getZ(i); }
      g.setAttribute('position', new THREE.BufferAttribute(a, 3)); o.geometry = g;
      M.multiplyMatrices(inv, o.matrixWorld); const toModel = M.clone(), toMesh = M.clone().invert(), cur = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { V.set(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]).applyMatrix4(toModel); cur[i * 3] = V.x; cur[i * 3 + 1] = V.y; cur[i * 3 + 2] = V.z; box.expandByPoint(V); }
      this.parts.push({ mesh: o, g, n, orig: cur.slice(), cur, tot: new Float32Array(n), toMesh });
    });
    this.box = box;
  }
  /* h: { x, z, nx, nz, vn } = contact point in game metres, the hit direction pointing from the thing hit into the car, closing speed (m/s); origin: the floating origin; y: the car's height. Returns the dent depth (m). */
  hit(h, origin, y) {
    if (!(h.vn >= DENT.soft)) return 0; this.attach(); if (!this.parts.length) return 0;
    const model = this.view.model, depth = Math.min(DENT.maxHit, DENT.k * Math.pow(h.vn - DENT.soft, DENT.pow)); if (depth < 0.004) return 0;
    model.updateWorldMatrix(true, false); const c = model.worldToLocal(new THREE.Vector3(h.x - origin.x, y, h.z - origin.z));
    c.x = Math.max(this.box.min.x, Math.min(this.box.max.x, c.x)); c.z = Math.max(this.box.min.z, Math.min(this.box.max.z, c.z)); c.y = Math.max(this.box.min.y + 0.25, Math.min(this.box.max.y - 0.15, c.y > 0.1 ? c.y : 0.65));
    model.getWorldQuaternion(Q).invert(); const dir = V2.set(h.nx, 0, h.nz).applyQuaternion(Q); dir.y = 0; if (dir.lengthSq() < 1e-6) return 0; dir.normalize();
    const R = DENT.r0 + DENT.rk * h.vn, R2 = R * R, dx = dir.x, dz = dir.z;
    for (const P of this.parts) {
      const cur = P.cur, tot = P.tot; let touched = false;
      for (let i = 0, j = 0; i < P.n; i++, j += 3) {
        const ex = cur[j] - c.x, ey = cur[j + 1] - c.y, ez = cur[j + 2] - c.z, d2 = ex * ex + ey * ey + ez * ez; if (d2 > R2) continue;
        const t = 1 - Math.sqrt(d2) / R, w = t * t * (3 - 2 * t), room = DENT.maxTotal - tot[i]; if (room <= 0) continue;
        const dl = Math.min(room, depth * w * (1 - DENT.noise / 2 + DENT.noise * hashf(i * 7 + this.hits)));
        cur[j] += dx * dl; cur[j + 2] += dz * dl; cur[j + 1] -= dl * 0.12; tot[i] += dl; touched = true;
      }
      if (touched) this.write(P);
    }
    this.hits++; const zx = c.x, zz = c.z, side = Math.abs(zz) > Math.abs(zx) * 1.4 ? (zz > 0 ? 'front' : 'rear') : (zx > 0 ? 'left' : 'right'); this.zone[side] += depth;
    if (!this.cosmetic && this.state !== 'wrecked') {
      const loss = HEALTH.lossK * Math.pow(h.vn - DENT.soft, HEALTH.lossPow), mid = this.view.def && this.view.def.id === 'sport', k = side === 'front' ? (mid ? HEALTH.rear : HEALTH.front) : side === 'rear' ? (mid ? HEALTH.front : HEALTH.rear) : HEALTH.side;
      this.health = Math.max(0, this.health - loss); this.engine = Math.max(0, this.engine - loss * k); if (this.health <= 0.04) this.engine = Math.min(this.engine, HEALTH.fire - 0.01); this.stage();
    }
    return depth;
  }
  /* move to the next stage when the engine health says so */
  stage() {
    if (this.state === 'ok' && this.engine < HEALTH.smoke) this.state = 'smoking';
    if ((this.state === 'smoking' || this.state === 'ok') && this.engine < HEALTH.fire) { this.state = 'burning'; this.fuse = HEALTH.fuse[0] + Math.random() * (HEALTH.fuse[1] - HEALTH.fuse[0]); this.since = 0; }
  }
  /* where the engine is, in scene metres */
  enginePos(out) {
    if (!this.box) this.attach(); const b = this.box, id = this.view.def && this.view.def.id, mid = id === 'sport', bike = id === 'bike';
    V.set(0, Math.min(b.max.y - 0.3, 0.95), bike ? 0 : mid ? b.min.z + 1.5 : b.max.z - 1.0); this.view.model.updateWorldMatrix(true, false); return this.view.model.localToWorld(out.copy(V));
  }
  get power() { if (this.state === 'wrecked') return 0; return this.engine >= HEALTH.smoke ? 1 : 0.35 + 0.65 * Math.max(0, this.engine / HEALTH.smoke); }
  get pull() { return this.cosmetic ? 0 : Math.max(-0.2, Math.min(0.2, (this.zone.right - this.zone.left) * 0.5)); }
  get wrecked() { return this.state === 'wrecked'; }
  /* every frame: smoke, flames, the fuse, the burst, the charring. Returns { burst: true } on the frame the car blows up. */
  update(dt) {
    const out = {}; if (this.state === 'ok' || !this.parts) return out; this.since += dt; if (!this.fx) this.fx = new FireFx(this.view.scene);
    const fx = this.fx, pos = this.enginePos(new THREE.Vector3()); let burning = false;
    if (this.state === 'smoking') fx.smoke(pos, 10 + 22 * (1 - this.engine / HEALTH.smoke), dt, 0.3, 0.55);
    else if (this.state === 'burning') { const u = Math.min(1, this.since / 4); burning = true; fx.flame(pos, 25 + 45 * u, dt, 0.4 + 0.6 * u); fx.smoke(pos, 30, dt, 0.8, 0.12); this.fuse -= dt; if (this.fuse <= 0) { this.burst(pos); out.burst = true; } }
    else if (this.state === 'wrecked') {
      const t = this.since - this.burstAt; this.char = Math.min(1, t / 3.5); this.charMats(t);
      if (t < HEALTH.burnSeconds) { const k = 1 - t / HEALTH.burnSeconds; burning = true; fx.flame(pos, 8 + 40 * k * k, dt, 0.25 + 0.7 * k); fx.smoke(pos, 18 + 14 * k, dt, 0.8, 0.1); }
      else if (t < HEALTH.smokeSeconds) fx.smoke(pos, 6 * (1 - (t - HEALTH.burnSeconds) / (HEALTH.smokeSeconds - HEALTH.burnSeconds)), dt, 0.4, 0.2);
    }
    fx.update(dt, burning ? pos : null); return out;
  }
  burst(pos) { this.state = 'wrecked'; this.burstAt = this.since; this.fx.blast(pos); this.bulge(pos); this.takeMaterials(); }
  /* the bonnet buckles upward over the engine */
  bulge(pos) {
    const c = this.view.model.worldToLocal(pos.clone()), R = 1.5, R2 = R * R;
    for (const P of this.parts) {
      let touched = false;
      for (let i = 0, j = 0; i < P.n; i++, j += 3) { const ex = P.cur[j] - c.x, ez = P.cur[j + 2] - c.z, d2 = ex * ex + ez * ez; if (d2 > R2 || P.cur[j + 1] < c.y - 0.25) continue; const t = 1 - Math.sqrt(d2) / R; P.cur[j + 1] += 0.22 * t * t * (0.7 + 0.6 * hashf(i)); touched = true; }
      if (touched) this.write(P);
    }
  }
  /* own copies of the materials (the model's are shared with every other use of it), so charring one car does not mark the others */
  takeMaterials() {
    if (this.orig) return; this.orig = []; const copies = new Map();
    for (const P of this.parts) { const m = P.mesh, list = [].concat(m.material), mine = list.map(x => { if (!copies.has(x)) copies.set(x, x.clone()); return copies.get(x); }); this.orig.push({ mesh: m, mat: m.material }); m.material = Array.isArray(m.material) ? mine : mine[0]; }
    this.copies = [...copies.entries()].map(([o, c]) => ({ c, color: c.color ? c.color.clone() : null, rough: c.roughness, metal: c.metalness, env: c.envMapIntensity, name: o.name }));
  }
  charMats(t) {
    if (!this.copies) return; const k = this.char, ember = Math.max(0, 1 - t / 45);
    for (const e of this.copies) {
      const c = e.c; if (k > 0.4 && c.map) { c.map = null; c.needsUpdate = true; }                                                // the livery stripes burn off: one soot colour
      if (e.color) { const tgt = /Glass/i.test(e.name) ? 0.012 : /Tyre/i.test(e.name) ? 0.01 : /Light/i.test(e.name) ? 0.015 : 0.04, m = Math.min(1, k * 1.15); c.color.setRGB(e.color.r * (1 - m) + tgt * m * 1.1, e.color.g * (1 - m) + tgt * m * 0.95, e.color.b * (1 - m) + tgt * m * 0.85); }
      if ('roughness' in c) { c.roughness = e.rough + (1 - e.rough) * k * 0.9; c.metalness = e.metal * (1 - 0.7 * k); c.envMapIntensity = e.env * (1 - 0.85 * k); if ('clearcoat' in c) c.clearcoat = 0; }
      if (c.emissive) { if (/Light/i.test(e.name)) c.emissive.setHex(0x000000); else { c.emissive.setHex(0xff3a08); c.emissiveIntensity = 0.05 * ember * k * (0.7 + 0.3 * Math.sin(t * 11 + c.id)); } }
    }
  }
  write(P) {
    const a = P.g.attributes.position.array, cur = P.cur;
    for (let i = 0; i < P.n; i++) { V.set(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]).applyMatrix4(P.toMesh); a[i * 3] = V.x; a[i * 3 + 1] = V.y; a[i * 3 + 2] = V.z; }
    P.g.attributes.position.needsUpdate = true; if (P.g.index && P.g.attributes.normal) P.g.computeVertexNormals(); P.g.computeBoundingSphere(); P.g.computeBoundingBox();
  }
  /* the worst dent anywhere (m), for the wear level */
  get worst() { return Math.max(0, ...Object.values(this.zone)); }
  repair() {
    if (this.state === 'wrecked') return false;                                                                       // a burnt-out car stays burnt out (choose another vehicle in the garage)
    this.endFire(); this.health = 1; this.engine = 1; this.state = 'ok'; this.fuse = 0; this.since = 0;
    if (!this.parts) { this.zone = { front: 0, rear: 0, left: 0, right: 0 }; this.hits = 0; return true; }
    for (const P of this.parts) { P.cur.set(P.orig); P.tot.fill(0); this.write(P); } this.zone = { front: 0, rear: 0, left: 0, right: 0 }; this.hits = 0; return true;
  }
  endFire() { if (this.fx) { this.fx.dispose(); this.fx = null; } }
  dispose() { this.endFire(); if (this.copies) for (const e of this.copies) e.c.dispose(); this.copies = null; if (!this.parts) return; for (const P of this.parts) P.g.dispose(); this.parts = null; }
}
