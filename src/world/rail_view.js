/* The railway you can see: track chunks, level-crossing barriers and trains (see rail.js for the rules). Built near the player, one chunk per frame, dropped when far. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { trainPlace, trainSpan, crossingClosed, TRAIN } from './rail.js';

const CHUNK = 64, SEG = 4, RANGE = 750;
const colourise = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), r = ((c >> 16) & 255) / 255, gg = ((c >> 8) & 255) / 255, b = (c & 255) / 255; for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const box = (parts, w, h, d, x, y, z, yaw, c) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(yaw); g.translate(x, y, z); parts.push(colourise(g, c)); };

/* a train vehicle built along +x (length), width on z: a shell, a colour band, dark windows, a roof, bogies */
function vehicleGeometry(kind) {
  const parts = [], L = kind === 'loco' ? 20 : TRAIN.coach - 1, W = TRAIN.width, H = kind === 'loco' ? 4.1 : 3.9;
  box(parts, L, 0.7, W - 0.4, 0, 0.95, 0, 0, 0x2a2a2e);                                                              // underframe
  box(parts, L, H - 1.2, W, 0, 1.3 + (H - 1.2) / 2, 0, 0, kind === 'loco' ? 0x23468a : 0xe9e1cc);                      // body
  box(parts, L + 0.02, 0.5, W + 0.02, 0, 2.0, 0, 0, kind === 'loco' ? 0xf2c230 : 0x1d4e89);                          // band
  box(parts, L - 2, 0.62, W + 0.04, 0, 3.15, 0, 0, 0x14222f);                                                         // windows
  box(parts, L - 0.6, 0.18, W - 0.8, 0, H + 0.2, 0, 0, 0xb9bec4);                                                      // roof
  for (const k of [-1, 1]) box(parts, 3.2, 0.9, W - 0.7, k * (L / 2 - 3.2), 0.6, 0, 0, 0x1c1c1f);                     // bogies
  if (kind === 'loco') box(parts, 5.2, 0.6, W - 0.5, L / 2 - 3, H + 0.55, 0, 0, 0x3d4a5c);                             // roof fan housing
  const g = mergeGeometries(parts); for (const p of parts) p.dispose(); return g;
}

export class RailView {
  constructor({ scene, terrain, origin, lines, crossings, toWorld, toGame }) {
    this.scene = scene; this.t = terrain; this.origin = origin; this.lines = lines; this.crossings = crossings; this.toWorld = toWorld; this.toGame = toGame; this.chunks = new Map(); this.time = 0;
    this.group = new THREE.Group(); scene.add(this.group); this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.15 });
    this.bars = []; this.p = {}; this.q = {}; this.trains = lines.map((ln, i) => ({ line: ln, offset: (i * 3700) % Math.max(ln.len, 1), meshes: [], active: false, circles: [], dir: 1, head: 0 }));
    this.geo = { loco: vehicleGeometry('loco'), coach: vehicleGeometry('coach') };
    this.barMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 }); this.redMat = new THREE.MeshStandardMaterial({ color: 0xc8231f, roughness: 0.6 });
  }
  key(li, k) { return li * 1e6 + k; }
  /* build the track chunk k of line li (distance k * CHUNK to (k + 1) * CHUNK) */
  build(li, k) {
    const ln = this.lines[li], s0 = k * CHUNK, s1 = Math.min(ln.len, s0 + CHUNK), p = this.p, W = this.toWorld, T = this.t, sea = T.seaLevel, parts = [], grp = new THREE.Group();
    const a0 = ln.at(s0, p), w0 = W(a0.x, a0.z), ox = w0.x, oz = w0.z, heightAt = (wx, wz) => T.drive(wx, wz);
    for (let s = s0; s < s1 - 0.01; s += SEG) {
      const a = ln.at(s, this.p), b = ln.at(Math.min(s + SEG, ln.len), this.q), wa = W(a.x, a.z), wb = W(b.x, b.z), ha = heightAt(wa.x, wa.z), hb = heightAt(wb.x, wb.z); if (ha < sea + 0.4 || hb < sea + 0.4) continue;
      const dx = wb.x - wa.x, dz = wb.z - wa.z, L = Math.hypot(dx, dz) || 1, yaw = -Math.atan2(dz, dx), cx = (wa.x + wb.x) / 2 - ox, cz = (wa.z + wb.z) / 2 - oz, y = (ha + hb) / 2, nx = -dz / L, nz = dx / L;   // n: across the track
      box(parts, L + 0.15, 0.34, 3.6, cx, y + 0.12, cz, yaw, 0x77705f);                                                // ballast
      for (const side of [-1, 1]) box(parts, L + 0.1, 0.16, 0.08, cx + nx * 0.72 * side, y + 0.37, cz + nz * 0.72 * side, yaw, 0xa7acb3);   // rails
      for (let u = 0.5; u < L; u += 0.85) { const f = (u - L / 2), sx = cx + (dx / L) * f, sz = cz + (dz / L) * f; box(parts, 0.26, 0.13, 2.6, sx, y + 0.3, sz, yaw, 0x4b4036); }              // sleepers
    }
    if (parts.length) { const m = new THREE.Mesh(mergeGeometries(parts), this.mat); m.receiveShadow = true; grp.add(m); for (const g of parts) g.dispose(); }
    /* barrier arms of the level crossings inside this chunk */
    const arms = [];
    for (const c of this.crossings) if (c.rail === ln.id && c.s >= s0 && c.s < s1) {
      const wc = W(c.x, c.z), h = heightAt(wc.x, wc.z), rx = c.roadTx, rz = c.roadTz, wd = Math.atan2(rz, rx);
      for (const side of [-1, 1]) {
        const px = wc.x + rx * 7.5 * side - ox, pz = wc.z + rz * 7.5 * side - oz, piv = new THREE.Group(); piv.position.set(px, h + 1.05, pz); piv.rotation.y = -wd + (side < 0 ? Math.PI : 0);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 0.3), this.barMat); post.position.set(px, h + 0.55, pz); grp.add(post);
        const arm = new THREE.Group(); for (let i = 0; i < 6; i++) { const seg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.14), i % 2 ? this.redMat : this.barMat); seg.position.set(0.6 + i * 1.2, 0, 0); arm.add(seg); } arm.rotation.z = 1.3; piv.add(arm); grp.add(piv); arms.push({ arm, cs: c.s, side, line: ln });
      }
    }
    grp.userData = { x: ox, z: oz, arms }; grp.position.set(ox - this.origin.x, 0, oz - this.origin.z); this.group.add(grp); return grp;
  }
  drop(g) { this.group.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  reposition() { for (const g of this.chunks.values()) g.position.set(g.userData.x - this.origin.x, 0, g.userData.z - this.origin.z); }
  /* px, pz: the player in world metres */
  update(dt, px, pz) {
    this.time += dt; const pg = this.toGame(px, pz);
    for (let li = 0; li < this.lines.length; li++) {
      const ln = this.lines[li], near = ln.nearest(pg.x, pg.z); if (near.d > RANGE + CHUNK * 2) { for (const [key, g] of this.chunks) if (Math.floor(key / 1e6) === li) { this.drop(g); this.chunks.delete(key); } continue; }
      const lo = Math.max(0, Math.floor((near.s - RANGE) / CHUNK)), hi = Math.floor((near.s + RANGE) / CHUNK);
      for (const [key, g] of this.chunks) if (Math.floor(key / 1e6) === li) { const k = key - li * 1e6; if (k < lo - 1 || k > hi + 1) { this.drop(g); this.chunks.delete(key); } }
      for (let d = 0; d <= hi - lo; d++) { let built = false; for (const k of d ? [Math.floor(near.s / CHUNK) + d, Math.floor(near.s / CHUNK) - d] : [Math.floor(near.s / CHUNK)]) { const key = this.key(li, k); if (k >= lo && k <= hi && k * CHUNK < ln.len && !this.chunks.has(key)) { this.chunks.set(key, this.build(li, k)); built = true; break; } } if (built) break; }
    }
    this.updateTrains(dt, px, pz); this.updateBars();
  }
  updateTrains(dt, px, pz) {
    const pg = this.toGame(px, pz), len = TRAIN.coaches * TRAIN.coach + 20, V = TRAIN.speed, p = this.p;
    for (const tr of this.trains) {
      const ln = tr.line, pl = trainPlace(ln.len, this.time, V, tr.offset); tr.head = pl.s; tr.dir = pl.dir; tr.span = trainSpan(pl.s, pl.dir, len);
      const mid = ln.at((tr.span[0] + tr.span[1]) / 2, p), near = Math.hypot(mid.x - pg.x, mid.z - pg.z) < len / 2 + 900; tr.circles.length = 0;
      if (!near) { if (tr.active) { for (const m of tr.meshes) m.visible = false; tr.active = false; } continue; }
      if (!tr.meshes.length) for (let i = 0; i <= TRAIN.coaches; i++) { const m = new THREE.Mesh(this.geo[i === 0 ? 'loco' : 'coach'], this.mat); m.castShadow = true; this.group.add(m); tr.meshes.push(m); }
      tr.active = true;
      for (let i = 0; i < tr.meshes.length; i++) {
        const back = i === 0 ? 10 : 20 + (i - 1) * TRAIN.coach + TRAIN.coach / 2, s = tr.head - tr.dir * back, a = ln.at(s, p), w = this.toWorld(a.x, a.z), y = this.t.drive(w.x, w.z) + 0.35, m = tr.meshes[i];
        m.visible = true; m.position.set(w.x - this.origin.x, y, w.z - this.origin.z); m.rotation.y = -Math.atan2(a.tz * tr.dir, a.tx * tr.dir); m.userData.wx = w.x; m.userData.wz = w.z; m.userData.yaw = -m.rotation.y;
        const half = (i === 0 ? 10 : TRAIN.coach / 2) - 1.5, f = Math.cos(m.userData.yaw), g = Math.sin(m.userData.yaw); for (let c = -2; c <= 2; c++) tr.circles.push({ x: w.x + f * c * half / 2, z: w.z + g * c * half / 2, r: 1.75, train: true });
      }
    }
  }
  updateBars() {
    for (const g of this.chunks.values()) for (const b of g.userData.arms) { const spans = this.trains.filter(t => t.line === b.line && t.span).map(t => t.span), closed = crossingClosed(b.cs, spans); b.arm.rotation.z += ((closed ? 0 : 1.3) - b.arm.rotation.z) * 0.1; }       // a barrier arm is down for a train, up otherwise
  }
  /* obstacle circles of the trains near (x, z) for the car's physics: a list of lists, like the other world.near parts */
  near(x, z, r) { const out = this._out || (this._out = [[]]), l = out[0]; l.length = 0; for (const tr of this.trains) if (tr.active) for (const c of tr.circles) if (Math.abs(c.x - x) < r + 4 && Math.abs(c.z - z) < r + 4) l.push(c); return out; }
  dispose() { for (const g of this.chunks.values()) this.drop(g); this.chunks.clear(); for (const t of this.trains) for (const m of t.meshes) this.group.remove(m); this.group.parent && this.group.parent.remove(this.group); this.geo.loco.dispose(); this.geo.coach.dispose(); this.mat.dispose(); }
}
