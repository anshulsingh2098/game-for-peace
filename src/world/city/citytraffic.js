/* Ambient traffic on the streets of the city pack (D5b). Cars follow the street pieces of the loaded tiles: they keep to the left (India), respect one-ways, slow behind the car or the player in front, pick a
   continuing street at each end (pieces meet end to end within a few metres) and are respawned near the player when they leave the loaded ground. They are simple boxes (one instanced body and one cabin), not the
   traffic pack's models, and they have no signals yet. Obstacle circles go to the vehicle physics through `circles()`, so the player cannot drive through them. Browser only. */
import * as THREE from 'three';

const MODES = { off: 0, low: 10, mid: 22, high: 34 }, CELL = 8, PAINT = [0xf2f2f2, 0xf2f2f2, 0xd9d9d9, 0x1b1b1d, 0x9a9da3, 0xb11f1f, 0x2a4f8a, 0xe8c547, 0x3a3a3c, 0xcfd2d6];
const DRIVABLE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential']);
const rnd = (() => { let s = 12345; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();

export class CityTraffic {
  constructor(scene, origin, G) {
    this.origin = origin; this.G = G; this.max = 34; this.want = 0; this.cars = []; this.pieces = new Map(); this.ends = new Map(); this.tile = new Map();
    const body = new THREE.BoxGeometry(1.8, 0.8, 4.2), cab = new THREE.BoxGeometry(1.6, 0.65, 2.1), mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.2 }), glass = new THREE.MeshStandardMaterial({ color: 0x1c242c, roughness: 0.2, metalness: 0.3 });
    this.body = new THREE.InstancedMesh(body, mat, this.max); this.cab = new THREE.InstancedMesh(cab, glass, this.max); for (const m of [this.body, this.cab]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
    this.sig = new Map(); this.time = 0; { const xz = G.xz, f = G.nodeFlags; for (let i = 0; i < G.nodes; i++) if (f[i] & 1) { const k = Math.floor(xz[i * 2] / 12) + ',' + Math.floor(xz[i * 2 + 1] / 12); let l = this.sig.get(k); if (!l) this.sig.set(k, l = []); l.push(i); } }       // the signalised nodes (flag 1) by 12 m cell
    this.col = new THREE.Color(); this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.up = new THREE.Vector3(0, 1, 0); this.sc = new THREE.Vector3(1, 1, 1); this.pos = new THREE.Vector3();
  }
  setMode(m) { this.want = MODES[m] === undefined ? 10 : MODES[m]; }
  key(x, z) { return Math.floor(x / CELL) + ',' + Math.floor(z / CELL); }
  addTile(k, streets, gy) {
    this.gy = gy; const ids = [], G = this.G;
    for (const s of streets) { const id = s.id; if (G.layer[id] !== 0 || !DRIVABLE.has(G.classes[G.cls[id]]) || s.pts.length < 4) continue; const p = s.pts, cum = [0]; for (let i = 2; i < p.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1])); const len = cum[cum.length - 1]; if (len < 6) continue;
      const w = s.width !== undefined ? s.width : Math.max(1, G.lanes[id] * 3), pc = { s, id, cum, len, w, one: G.oneway[id], cls: G.classes[G.cls[id]], speed: Math.min(15, Math.max(5, (G.speed[id] || 30) / 3.6 * 0.6)), alive: true, tile: k };
      ids.push(pc); this.pieces.set(pc, true); for (const e of [0, 1]) { const x = e ? p[p.length - 2] : p[0], z = e ? p[p.length - 1] : p[1], key = this.key(x, z); let l = this.ends.get(key); if (!l) this.ends.set(key, l = []); l.push({ pc, end: e, x, z }); } }
    this.tile.set(k, ids);
  }
  removeTile(k) { const l = this.tile.get(k); if (!l) return; for (const pc of l) { pc.alive = false; this.pieces.delete(pc); } for (const [key, arr] of this.ends) { const n = arr.filter(e => e.pc.alive); if (n.length) this.ends.set(key, n); else this.ends.delete(key); } this.tile.delete(k); }
  /* the signalised node within 6 m of (x, z) or -1 */
  signalAt(x, z) { const G = this.G, i0 = Math.floor(x / 12), j0 = Math.floor(z / 12); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = this.sig.get((i0 + a) + ',' + (j0 + b)); if (l) for (const n of l) if (Math.hypot(G.xz[n * 2] - x, G.xz[n * 2 + 1] - z) < 6) return n; } return -1; }
  /* a signal shows green to one axis (0: east-west, 1: north-south) at a time, 14 s each, offset per junction */
  green(node, tx, tz) { const axis = Math.abs(tx) > Math.abs(tz) ? 0 : 1; return Math.floor((this.time + (node * 7 % 28)) / 14) % 2 === axis; }
  /* where the piece is at arc length s: x, z and the direction of increasing s */
  at(pc, s, out) { const c = pc.cum, p = pc.s.pts; let i = 0; while (i + 2 < c.length && c[i + 1] < s) i++; const f = Math.max(0, Math.min(1, (s - c[i]) / Math.max(0.01, c[i + 1] - c[i]))), dx = p[i * 2 + 2] - p[i * 2], dz = p[i * 2 + 3] - p[i * 2 + 1], L = Math.hypot(dx, dz) || 1; out.x = p[i * 2] + dx * f; out.z = p[i * 2 + 1] + dz * f; out.tx = dx / L; out.tz = dz / L; return out; }
  canGo(pc, dir) { return pc.one === 0 || pc.one === dir; }
  place(car, pc, dir, s) { car.pc = pc; car.dir = dir; car.s = s; car.v = Math.min(car.v || 0, pc.speed); }
  spawn(px, pz) {
    const list = [...this.pieces.keys()]; if (!list.length) return null;
    for (let t = 0; t < 30; t++) { const pc = list[Math.floor(rnd() * list.length)], s = rnd() * pc.len, o = this.at(pc, s, {}), d = Math.hypot(o.x - px, o.z - pz); if (d < 90 || d > 520) continue; const dir = pc.one !== 0 ? pc.one : rnd() < 0.5 ? 1 : -1; if (!this.canGo(pc, dir)) continue;
      return { pc, dir, s, v: pc.speed * (0.6 + 0.4 * rnd()), paint: PAINT[Math.floor(rnd() * PAINT.length)], x: o.x, z: o.z, yaw: 0, lat: 0, wait: 0 }; }
    return null;
  }
  update(dt, px, pz, pyaw) {
    const cars = this.cars; this.time += dt; while (cars.length > this.want) cars.pop();
    if (cars.length < this.want && this.pieces.size) { const c = this.spawn(px, pz); if (c) cars.push(c); }
    const o = {}, SIDE = {};
    for (let n = 0; n < cars.length; n++) { const c = cars[n];
      if (!c.pc.alive || Math.hypot(c.x - px, c.z - pz) > 700) { const r = this.spawn(px, pz); if (r) cars[n] = r; else cars.splice(n--, 1); continue; }
      /* the gap to what is ahead on this lane: another car, or the player */
      this.at(c.pc, c.s, o); const tx = o.tx * c.dir, tz = o.tz * c.dir; let gap = 99;
      for (const k of [...cars, { x: px, z: pz, player: true }]) { if (k === c) continue; const dx = k.x - c.x, dz = k.z - c.z, ahead = dx * tx + dz * tz, side = Math.abs(-dx * tz + dz * tx); if (ahead > 0 && ahead < gap && side < (k.player ? 2.4 : 2.0)) gap = ahead; }
      { const rem = c.dir > 0 ? c.pc.len - c.s : c.s; if (rem < 22 && rem > 0.5) { const q = c.pc.s.pts, ex = c.dir > 0 ? q[q.length - 2] : q[0], ez = c.dir > 0 ? q[q.length - 1] : q[1], nd = this.signalAt(ex, ez); if (nd >= 0 && !this.green(nd, tx, tz)) gap = Math.min(gap, rem - 1.5); } }       // a red signal at the end of the piece is a wall
      const want = gap < 9 ? 0 : Math.min(c.pc.speed, c.v + 3 * dt) * Math.min(1, (gap - 9) / 14); c.v += Math.max(-9 * dt, Math.min(2.5 * dt, want - c.v)); c.s += c.dir * c.v * dt;
      if (c.s > c.pc.len || c.s < 0) {                                    // the end of the piece: continue on another that starts here, else turn this car round at a dead end (or retire it)
        const end = c.dir > 0 ? c.pc.len : 0, p = c.pc.s.pts, ex = c.dir > 0 ? p[p.length - 2] : p[0], ez = c.dir > 0 ? p[p.length - 1] : p[1], opts = [];
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = this.ends.get(this.key(ex + a * CELL, ez + b * CELL)); if (l) for (const e of l) if (e.pc !== c.pc && e.pc.alive && Math.hypot(e.x - ex, e.z - ez) < 4 && this.canGo(e.pc, e.end === 0 ? 1 : -1)) opts.push(e); }
        if (opts.length) { const e = opts[Math.floor(rnd() * opts.length)]; this.place(c, e.pc, e.end === 0 ? 1 : -1, e.end === 0 ? 0.1 : e.pc.len - 0.1); } else { const r = this.spawn(px, pz); if (r) cars[n] = r; else cars.splice(n--, 1); continue; }
        void end; }
      this.at(c.pc, c.s, o); const dx = o.tx * c.dir, dz = o.tz * c.dir, lat = c.pc.one !== 0 ? 0 : -Math.min(c.pc.w / 4, 2.2); c.lat += (lat - c.lat) * Math.min(1, dt * 2);
      const nx = -dz, nz = dx; c.x = o.x + nx * c.lat; c.z = o.z + nz * c.lat; c.yaw = Math.atan2(dz, dx); }
    void SIDE; void pyaw; this.draw();
  }
  draw() {
    const n = this.cars.length, gy = this.gy || 0; this.body.count = this.cab.count = n;
    for (let i = 0; i < n; i++) { const c = this.cars[i]; this.q.setFromAxisAngle(this.up, -c.yaw + Math.PI / 2); this.pos.set(c.x - this.origin.x, gy + 0.75, c.z - this.origin.z); this.m4.compose(this.pos, this.q, this.sc); this.body.setMatrixAt(i, this.m4); this.col.setHex(c.paint); this.body.setColorAt(i, this.col);
      const cx = Math.cos(c.yaw) * -0.2, cz = Math.sin(c.yaw) * -0.2; this.pos.set(c.x - this.origin.x + cx, gy + 1.45, c.z - this.origin.z + cz); this.m4.compose(this.pos, this.q, this.sc); this.cab.setMatrixAt(i, this.m4); }
    this.body.instanceMatrix.needsUpdate = this.cab.instanceMatrix.needsUpdate = true; if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
  }
  /* the nearest car in front of `ph` ({ x, z, yaw }) within `range` m and 2.3 m either side of its heading: { gap, speed } or null (autodrive's leader) */
  leaderAhead(ph, range) { const fx = Math.cos(ph.yaw), fz = Math.sin(ph.yaw); let best = null; for (const c of this.cars) { const dx = c.x - ph.x, dz = c.z - ph.z, ahead = dx * fx + dz * fz, side = Math.abs(-dx * fz + dz * fx); if (ahead > 0 && ahead < range && side < 2.3 && (!best || ahead < best.gap)) best = { gap: ahead - 2.1, speed: c.v }; } return best; }
  /* obstacle circles near (x, z) for the vehicle physics (front and rear of each car) */
  circles(x, z, r) { const out = []; for (const c of this.cars) { if (Math.abs(c.x - x) > r + 4 || Math.abs(c.z - z) > r + 4) continue; const cx = Math.cos(c.yaw), sz = Math.sin(c.yaw); out.push({ x: c.x + cx * 1.2, z: c.z + sz * 1.2, r: 1.2, y: this.gy, traffic: true }, { x: c.x - cx * 1.2, z: c.z - sz * 1.2, r: 1.2, y: this.gy, traffic: true }); } return out; }
}
