/* The railway you can see: track chunks, stations, rail bridges over the roads, level crossings with barriers, and trains (rules and the network are in rail.js, data in assets/india/rails.json).
   Everything is built near the player, one piece per frame, and dropped when far. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { findCrossings, trainPlace, trainSpan, crossingClosed, TRAIN } from './rail.js';

const CHUNK = 64, SEG = 4, RANGE = 750, STATION_LEN = 120, BRIDGE_R = 70, BRIDGE_H = 6.5, LEVEL_NEAR_STATION = 600;
const colourise = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), r = ((c >> 16) & 255) / 255, gg = ((c >> 8) & 255) / 255, b = (c & 255) / 255; for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const box = (parts, w, h, d, x, y, z, yaw, c) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(yaw); g.translate(x, y, z); parts.push(colourise(g, c)); };
const smooth = t => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

/* a train vehicle built along +x (length), width on z: a shell, a colour band, dark windows, a roof, bogies */
function vehicleGeometry(kind) {
  const parts = [], L = kind === 'loco' ? 20 : TRAIN.coach - 1, W = TRAIN.width, H = kind === 'loco' ? 4.1 : 3.9;
  box(parts, L, 0.7, W - 0.4, 0, 0.95, 0, 0, 0x2a2a2e); box(parts, L, H - 1.2, W, 0, 1.3 + (H - 1.2) / 2, 0, 0, kind === 'loco' ? 0x23468a : 0xe9e1cc);
  box(parts, L + 0.02, 0.5, W + 0.02, 0, 2.0, 0, 0, kind === 'loco' ? 0xf2c230 : 0x1d4e89); box(parts, L - 2, 0.62, W + 0.04, 0, 3.15, 0, 0, 0x14222f); box(parts, L - 0.6, 0.18, W - 0.8, 0, H + 0.2, 0, 0, 0xb9bec4);
  for (const k of [-1, 1]) box(parts, 3.2, 0.9, W - 0.7, k * (L / 2 - 3.2), 0.6, 0, 0, 0x1c1c1f); if (kind === 'loco') box(parts, 5.2, 0.6, W - 0.5, L / 2 - 3, H + 0.55, 0, 0, 0x3d4a5c);
  const g = mergeGeometries(parts); for (const p of parts) p.dispose(); return g;
}
function nameTexture(en, hi) {
  const W = 512, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#f2c230'; x.fillRect(0, 0, W, H); x.strokeStyle = '#111'; x.lineWidth = 6; x.strokeRect(5, 5, W - 10, H - 10);
  x.fillStyle = '#111'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 40px "Noto Sans Devanagari","Kohinoor Devanagari","Devanagari Sangam MN",system-ui,sans-serif'; x.fillText(hi || '', W / 2, 40); x.font = '700 46px system-ui,Arial,sans-serif'; x.fillText((en || '').toUpperCase(), W / 2, 92);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export class RailView {
  constructor({ scene, terrain, origin, network, roads, cities, toWorld, toGame, names = {} }) {
    this.scene = scene; this.t = terrain; this.origin = origin; this.net = network; this.lines = network.edges; this.toWorld = toWorld; this.toGame = toGame; this.names = names; this.chunks = new Map(); this.stationsBuilt = new Map(); this.time = 0;
    this.group = new THREE.Group(); scene.add(this.group); this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.15 });
    this.p = {}; this.q = {};
    /* crossings with the roads: a rail bridge over the road, or a level crossing near a station */
    this.crossings = []; const stn = network.stations; for (const ln of this.lines) for (const c of findCrossings(ln, roads, cities, { minCity: 60 })) {
      if (c.sinA < 0.3) continue; const ds = stn.length ? Math.min(...stn.map(n => Math.hypot(n.x - c.x, n.z - c.z))) : 1e9; c.rail = ln.id; c.type = ds < LEVEL_NEAR_STATION ? 'level' : 'bridge'; c.line = ln; this.crossings.push(c); }
    this.byEdge = new Map(); for (const c of this.crossings) { let l = this.byEdge.get(c.rail); if (!l) this.byEdge.set(c.rail, l = []); l.push(c); }
    this.trains = this.lines.filter(l => l.len > 350).map((ln, i) => ({ line: ln, offset: (i * 977) % Math.max(ln.len, 1), speed: 20 + (i % 5) * 2, meshes: [], active: false, circles: [], dir: 1, head: 0, span: null }));
    this.geo = { loco: vehicleGeometry('loco'), coach: vehicleGeometry('coach') };
    this.barMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 }); this.redMat = new THREE.MeshStandardMaterial({ color: 0xc8231f, roughness: 0.6 }); this.nearEdge = new Map();
  }
  lift(ln, s) { const l = this.byEdge.get(ln.id); if (!l) return 0; let h = 0; for (const c of l) if (c.type === 'bridge') h = Math.max(h, BRIDGE_H * smooth(1.5 - Math.abs(s - c.s) / (BRIDGE_R * 0.5))); return h; }
  key(li, k) { return li * 1e6 + k; }
  build(li, k) {
    const ln = this.lines[li], s0 = k * CHUNK, s1 = Math.min(ln.len, s0 + CHUNK), W = this.toWorld, T = this.t, sea = T.seaLevel, parts = [], grp = new THREE.Group(), heightAt = (wx, wz) => T.drive(wx, wz);
    const a0 = ln.at(s0, this.p), w0 = W(a0.x, a0.z), ox = w0.x, oz = w0.z, cross = this.byEdge.get(ln.id) || [];
    for (let s = s0; s < s1 - 0.01; s += SEG) {
      const a = ln.at(s, this.p), b = ln.at(Math.min(s + SEG, ln.len), this.q), wa = W(a.x, a.z), wb = W(b.x, b.z), ga = heightAt(wa.x, wa.z), gb = heightAt(wb.x, wb.z); if (ga < sea + 0.4 || gb < sea + 0.4) continue;
      const la = this.lift(ln, s), lb = this.lift(ln, s + SEG), ha = ga + la, hb = gb + lb, dx = wb.x - wa.x, dz = wb.z - wa.z, L = Math.hypot(dx, dz) || 1, yaw = -Math.atan2(dz, dx), cx = (wa.x + wb.x) / 2 - ox, cz = (wa.z + wb.z) / 2 - oz, y = (ha + hb) / 2, nx = -dz / L, nz = dx / L, lf = (la + lb) / 2;
      const onBridge = cross.some(c => c.type === 'bridge' && Math.abs(s + SEG / 2 - c.s) < 20 / Math.max(c.sinA, 0.5));
      box(parts, L + 0.15, 0.34, 3.6, cx, y + 0.12, cz, yaw, 0x77705f);
      for (const side of [-1, 1]) box(parts, L + 0.1, 0.16, 0.08, cx + nx * 0.72 * side, y + 0.37, cz + nz * 0.72 * side, yaw, 0xa7acb3);
      for (let u = 0.5; u < L; u += 0.85) { const f = u - L / 2, sx = cx + (dx / L) * f, sz = cz + (dz / L) * f; box(parts, 0.26, 0.13, 2.6, sx, y + 0.3, sz, yaw, 0x4b4036); }
      if (onBridge) { box(parts, L + 0.1, 1.0, 5.4, cx, y - 0.45, cz, yaw, 0x8c8f93); for (const side of [-1, 1]) box(parts, L + 0.1, 0.9, 0.18, cx + nx * 2.6 * side, y + 0.55, cz + nz * 2.6 * side, yaw, 0x6b7076); }      // the deck over the road, with side girders
      else if (lf > 0.5) { const h = lf + 0.2; box(parts, L + 0.1, h, 6.2 + lf * 0.9, cx, ga + h / 2 - 0.1 + (la + lb) / 2 * 0, cz, yaw, 0x8a7a5c); }                                                          // the embankment that carries the track up to the bridge
    }
    for (const c of cross) if (c.s >= s0 && c.s < s1 && c.type === 'bridge') {                                                                    // abutment walls each side of the road
      const wc = W(c.x, c.z), h = heightAt(wc.x, wc.z), yaw = Math.atan2(-c.railTz, c.railTx); for (const side of [-1, 1]) { const off = 19 / Math.max(c.sinA, 0.5) * side; box(parts, 1.4, BRIDGE_H + 0.6, 6.8, wc.x + c.railTx * off - ox, h + (BRIDGE_H + 0.6) / 2 - 0.3, wc.z + c.railTz * off - oz, -yaw, 0xa9a69c); } }
    if (parts.length) { const m = new THREE.Mesh(mergeGeometries(parts), this.mat); m.receiveShadow = true; m.castShadow = true; grp.add(m); for (const g of parts) g.dispose(); }
    const arms = [];
    for (const c of cross) if (c.s >= s0 && c.s < s1 && c.type === 'level') {
      const wc = W(c.x, c.z), h = heightAt(wc.x, wc.z), rx = c.roadTx, rz = c.roadTz, wd = Math.atan2(rz, rx);
      for (const side of [-1, 1]) { const px = wc.x + rx * 7.5 * side - ox, pz = wc.z + rz * 7.5 * side - oz, piv = new THREE.Group(); piv.position.set(px, h + 1.05, pz); piv.rotation.y = -wd + (side < 0 ? Math.PI : 0);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 0.3), this.barMat); post.position.set(px, h + 0.55, pz); grp.add(post);
        const arm = new THREE.Group(); for (let i = 0; i < 6; i++) { const seg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.14), i % 2 ? this.redMat : this.barMat); seg.position.set(0.6 + i * 1.2, 0, 0); arm.add(seg); } arm.rotation.z = 1.3; piv.add(arm); grp.add(piv); arms.push({ arm, cs: c.s, side, line: ln }); }
    }
    grp.userData = { x: ox, z: oz, arms }; grp.position.set(ox - this.origin.x, 0, oz - this.origin.z); this.group.add(grp); return grp;
  }
  /* a station at a city: two platforms with a canopy, a building and name boards, along the track through the node */
  buildStation(n) {
    const W = this.toWorld, T = this.t, wn = W(n.x, n.z), e = this.net.adj.get(n.id)[0]; if (!e) return null; const P = e.pts, fwd = e.a === n.id, i = fwd ? 0 : P.length / 2 - 1, j = fwd ? 1 : P.length / 2 - 2;
    const tx = (P[j * 2] - P[i * 2]), tz = (P[j * 2 + 1] - P[i * 2 + 1]), tl = Math.hypot(tx, tz) || 1, ux = tx / tl, uz = tz / tl, nx = -uz, nz = ux, yaw = -Math.atan2(uz, ux), parts = [], grp = new THREE.Group(), y = T.drive(wn.x, wn.z), textures = [];
    for (const side of [-1, 1]) {
      const c = { x: nx * side * 4.9, z: nz * side * 4.9 }; box(parts, STATION_LEN, 1.0, 6, c.x, y + 0.5, c.z, yaw, 0xb8b3a6); box(parts, STATION_LEN, 0.2, 6.2, c.x, y + 1.05, c.z, yaw, 0xe3ded2);               // the platform and its edge
      box(parts, STATION_LEN * 0.8, 0.3, 5.4, c.x, y + 4.6, c.z, yaw, 0x3d5a80); for (let k = -4; k <= 4; k++) box(parts, 0.3, 3.5, 0.3, c.x + ux * k * STATION_LEN * 0.1, y + 2.85, c.z + uz * k * STATION_LEN * 0.1, 0, 0x555a60);    // the canopy and its posts
      box(parts, 34, 7, 9, nx * side * 17 + ux * 20, y + 3.5, nz * side * 17 + uz * 20, yaw, side > 0 ? 0xd8c7a0 : 0xc9b88d); box(parts, 34.4, 1.1, 9.4, nx * side * 17 + ux * 20, y + 7.4, nz * side * 17 + uz * 20, yaw, 0x8b3a2e);   // the station building
    }
    const nm = this.names[n.city] || { en: n.city, hi: '' }, tex = nameTexture(nm.en, nm.hi); textures.push(tex);
    for (const side of [-1, 1]) for (const k of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: tex })); m.position.set(nx * side * 4.9 + ux * k * 30, y + 2.4, nz * side * 4.9 + uz * k * 30); m.rotation.y = Math.atan2(-nx * side, -nz * side); grp.add(m); }   // name boards on the platforms, facing across the track
    if (parts.length) { const m = new THREE.Mesh(mergeGeometries(parts), this.mat); m.castShadow = true; m.receiveShadow = true; grp.add(m); for (const g of parts) g.dispose(); }
    grp.userData = { x: wn.x, z: wn.z, textures }; grp.position.set(wn.x - this.origin.x, 0, wn.z - this.origin.z); this.group.add(grp); return grp;
  }
  drop(g) { this.group.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material !== this.mat) { o.material.map.dispose(); o.material.dispose(); } }); }
  reposition() { for (const g of this.chunks.values()) g.position.set(g.userData.x - this.origin.x, 0, g.userData.z - this.origin.z); for (const g of this.stationsBuilt.values()) g.position.set(g.userData.x - this.origin.x, 0, g.userData.z - this.origin.z); }
  update(dt, px, pz) {
    this.time += dt; const pg = this.toGame(px, pz); let built = false;
    for (let li = 0; li < this.lines.length; li++) {
      const ln = this.lines[li]; if (!ln.bb) { let a = 1e18, b = -1e18, c = 1e18, d = -1e18; for (let i = 0; i < ln.pts.length; i += 2) { a = Math.min(a, ln.pts[i]); b = Math.max(b, ln.pts[i]); c = Math.min(c, ln.pts[i + 1]); d = Math.max(d, ln.pts[i + 1]); } ln.bb = [a, b, c, d]; }
      const R = RANGE + CHUNK * 2, far = pg.x < ln.bb[0] - R || pg.x > ln.bb[1] + R || pg.z < ln.bb[2] - R || pg.z > ln.bb[3] + R, near = far ? null : ln.nearest(pg.x, pg.z); this.nearEdge.set(li, near);
      if (!near || near.d > R) { if (this.edgeHas(li)) for (const [key, g] of this.chunks) if (Math.floor(key / 1e6) === li) { this.drop(g); this.chunks.delete(key); } continue; }
      const lo = Math.max(0, Math.floor((near.s - RANGE) / CHUNK)), hi = Math.floor((near.s + RANGE) / CHUNK);
      for (const [key, g] of this.chunks) if (Math.floor(key / 1e6) === li) { const k = key - li * 1e6; if (k < lo - 1 || k > hi + 1) { this.drop(g); this.chunks.delete(key); } }
      if (!built) for (let d = 0; d <= hi - lo && !built; d++) for (const k of d ? [Math.floor(near.s / CHUNK) + d, Math.floor(near.s / CHUNK) - d] : [Math.floor(near.s / CHUNK)]) { const key = this.key(li, k); if (k >= lo && k <= hi && k * CHUNK < ln.len && !this.chunks.has(key)) { this.chunks.set(key, this.build(li, k)); built = true; break; } }
    }
    for (const n of this.net.stations) { const d = Math.hypot(n.x - pg.x, n.z - pg.z); const has = this.stationsBuilt.has(n.id); if (d < 700 && !has && !built) { const g = this.buildStation(n); if (g) this.stationsBuilt.set(n.id, g); built = true; } else if (d > 1100 && has) { this.drop(this.stationsBuilt.get(n.id)); this.stationsBuilt.delete(n.id); } }
    this.updateTrains(dt, px, pz); this.updateBars();
  }
  edgeHas(li) { for (const key of this.chunks.keys()) if (Math.floor(key / 1e6) === li) return true; return false; }
  updateTrains(dt, px, pz) {
    const len = TRAIN.coaches * TRAIN.coach + 20, p = this.p, li = new Map(this.lines.map((l, i) => [l, i]));
    for (const tr of this.trains) {
      const near = this.nearEdge.get(li.get(tr.line)); tr.circles.length = 0;
      if (!near || near.d > 1100) { if (tr.active) { for (const m of tr.meshes) m.visible = false; tr.active = false; } tr.span = null; continue; }
      const ln = tr.line, run = Math.max(ln.len - len, 30), pl = trainPlace(run, this.time, tr.speed, tr.offset); tr.head = pl.dir > 0 ? pl.s + len : pl.s; tr.dir = pl.dir; tr.span = trainSpan(tr.head, pl.dir, len);
      if (!tr.meshes.length) for (let i = 0; i <= TRAIN.coaches; i++) { const m = new THREE.Mesh(this.geo[i === 0 ? 'loco' : 'coach'], this.mat); m.castShadow = true; this.group.add(m); tr.meshes.push(m); }
      tr.active = true;
      for (let i = 0; i < tr.meshes.length; i++) {
        const back = i === 0 ? 10 : 20 + (i - 1) * TRAIN.coach + TRAIN.coach / 2, s = tr.head - tr.dir * back, a = ln.at(s, p), w = this.toWorld(a.x, a.z), y = this.t.drive(w.x, w.z) + this.lift(ln, s) + 0.35, m = tr.meshes[i];
        m.visible = true; m.position.set(w.x - this.origin.x, y, w.z - this.origin.z); m.rotation.y = -Math.atan2(a.tz * tr.dir, a.tx * tr.dir); const yw = -m.rotation.y;
        const half = (i === 0 ? 10 : TRAIN.coach / 2) - 1.5, f = Math.cos(yw), g = Math.sin(yw); for (let c = -2; c <= 2; c++) tr.circles.push({ x: w.x + f * c * half / 2, z: w.z + g * c * half / 2, r: 1.75, train: true });
      }
    }
  }
  updateBars() { for (const g of this.chunks.values()) for (const b of g.userData.arms) { const spans = this.trains.filter(t => t.line === b.line && t.span).map(t => t.span), closed = crossingClosed(b.cs, spans); b.arm.rotation.z += ((closed ? 0 : 1.3) - b.arm.rotation.z) * 0.1; } }
  near(x, z, r) { const out = this._out || (this._out = [[]]), l = out[0]; l.length = 0; for (const tr of this.trains) if (tr.active) for (const c of tr.circles) if (Math.abs(c.x - x) < r + 4 && Math.abs(c.z - z) < r + 4) l.push(c); return out; }
  dispose() { for (const g of this.chunks.values()) this.drop(g); this.chunks.clear(); for (const g of this.stationsBuilt.values()) this.drop(g); this.stationsBuilt.clear(); for (const t of this.trains) for (const m of t.meshes) this.group.remove(m); this.group.parent && this.group.parent.remove(this.group); this.geo.loco.dispose(); this.geo.coach.dispose(); this.mat.dispose(); }
}
