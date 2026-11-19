/* Visible crash damage to the player's vehicle (docs/DAMAGE_PLAN.md, phase 3): when the car physics reports a hit, the body's vertices near the contact point are pushed inward along the hit direction,
   smoothly (a falloff from the contact point), with a little noise, up to a limit per vertex, so repeated hits pile up. A hit below `DENT.soft` closing speed leaves no mark. Damage is kept per zone (front,
   rear, left, right) for the later phases (parts that come off, driving effects). `repair()` puts every vertex back. Browser only (it edits the loaded model's geometry, copied first so the shared model
   in the cache is never touched). The numbers are design choices, one table (`DENT`). */
import * as THREE from 'three';

export const DENT = { soft: 2.0, k: 0.055, pow: 1.2, maxHit: 0.34, maxTotal: 0.5, r0: 0.45, rk: 0.07, noise: 0.3 };
const hashf = i => { let h = (i | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), Q = new THREE.Quaternion(), M = new THREE.Matrix4();

export class CarDamage {
  constructor(view) { this.view = view; this.parts = null; this.zone = { front: 0, rear: 0, left: 0, right: 0 }; this.hits = 0; this.box = null; }
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
    this.hits++; const zx = c.x, zz = c.z, side = Math.abs(zz) > Math.abs(zx) * 1.4 ? (zz > 0 ? 'front' : 'rear') : (zx > 0 ? 'left' : 'right'); this.zone[side] += depth; return depth;
  }
  write(P) {
    const a = P.g.attributes.position.array, cur = P.cur;
    for (let i = 0; i < P.n; i++) { V.set(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]).applyMatrix4(P.toMesh); a[i * 3] = V.x; a[i * 3 + 1] = V.y; a[i * 3 + 2] = V.z; }
    P.g.attributes.position.needsUpdate = true; if (P.g.index && P.g.attributes.normal) P.g.computeVertexNormals(); P.g.computeBoundingSphere(); P.g.computeBoundingBox();
  }
  /* the worst dent anywhere (m), for the wear level */
  get worst() { return Math.max(0, ...Object.values(this.zone)); }
  repair() {
    if (!this.parts) { this.zone = { front: 0, rear: 0, left: 0, right: 0 }; this.hits = 0; return; }
    for (const P of this.parts) { P.cur.set(P.orig); P.tot.fill(0); this.write(P); } this.zone = { front: 0, rear: 0, left: 0, right: 0 }; this.hits = 0;
  }
  dispose() { if (!this.parts) return; for (const P of this.parts) P.g.dispose(); this.parts = null; }
}
