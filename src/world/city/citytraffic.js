/* Ambient traffic on the streets of the city pack (D5b). Cars follow the street pieces of the loaded tiles: they keep to the left (India), respect one-ways, slow behind the car or the player in front, pick a
   continuing street at each end (pieces meet end to end within a few metres) and are respawned near the player when they leave the loaded ground. They are simple boxes (one instanced body and one cabin), not the
   traffic pack's models, and they have no signals yet. Flyovers, ramps and underpasses carry traffic too (audit R14, owner decision 17 Nov 2026): each car has a height `h` above or below the ground, cars only see cars at their own level, and a car's obstacle circles carry that height so the physics ignores a car on the other level. Obstacle circles go to the vehicle physics through `circles()`, so the player cannot drive through them. Browser only. */
import * as THREE from 'three';
import { Fleet, DIM } from './vehicles.js';
import { deckHeight, underDepth } from './pack.js';

const PARK_MAX = 300, AUTO = [0xe3b21a, 0x2e8b57, 0x2e8b57, 0xe3b21a];
const MODES = { off: 0, low: 10, mid: 22, high: 34 }, CELL = 8, PAINT = [0xf2f2f2, 0xf2f2f2, 0xd9d9d9, 0x1b1b1d, 0x9a9da3, 0xb11f1f, 0x2a4f8a, 0xe8c547, 0x3a3a3c, 0xcfd2d6];
const DRIVABLE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential']);
/* each simulation owns its random stream, seeded when it is made, so a replay does not depend on what another simulation drew (audit R15) */
const makeRnd = seed => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

export class CityTraffic {
  constructor(scene, origin, G, identity = null) {
    this.rnd = makeRnd(12345);
    this.identity = identity; this.buses = []; this.origin = origin; this.G = G; this.max = 34 + PARK_MAX; this.parked = new Map(); this.px = 0; this.pz = 0; this.scA = new THREE.Vector3(0.78, 0.95, 0.62); this.want = 0; this.cars = []; this.pieces = new Map(); this.ends = new Map(); this.tile = new Map();
    this.fleet = new Fleet(scene);
    this.sig = new Map(); this.xing = new Map(); this.peds = null; this.time = 0; { const xz = G.xz, f = G.nodeFlags; for (let i = 0; i < G.nodes; i++) { const k = Math.floor(xz[i * 2] / 12) + ',' + Math.floor(xz[i * 2 + 1] / 12); if (f[i] & 1) { let l = this.sig.get(k); if (!l) this.sig.set(k, l = []); l.push(i); } else if (f[i] & 2) { let l = this.xing.get(k); if (!l) this.xing.set(k, l = []); l.push(i); } } }       // the signalised nodes (flag 1) by 12 m cell
    this.col = new THREE.Color(); this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.up = new THREE.Vector3(0, 1, 0); this.sc = new THREE.Vector3(1, 1, 1); this.pos = new THREE.Vector3();
  }
  /* a vehicle kind for the area at (x, z) from identity.json (buses are CityBuses'; a parked vehicle is never a cycle rickshaw, a truck or an auto stand-in) */
  pickKind(x, z, r, parked = false) { const ID = this.identity; if (!ID) return 'hatch'; let k = ID.vehicleKind(ID.areaNameAt(x, z), r); if (k === 'bus') k = 'hatch'; if (parked && (k === 'cyclerick' || k === 'truck')) k = 'two'; return k; }
  paintOf(kind) { const ID = this.identity, l = ID && ID.j.vehicles.paints[kind]; if (!l) return PAINT[Math.floor(this.rnd() * PAINT.length)]; return parseInt(l[Math.floor(this.rnd() * l.length)].slice(1), 16); }
  setMode(m) { this.want = MODES[m] === undefined ? 10 : MODES[m]; if (this.onMode) this.onMode(m); }
  key(x, z) { return Math.floor(x / CELL) + ',' + Math.floor(z / CELL); }
  addTile(k, streets, gy) {
    this.gy = gy; const ids = [], G = this.G;
    for (const s of streets) { const id = s.id; if (Math.abs(G.layer[id]) > 3 || !DRIVABLE.has(G.classes[G.cls[id]]) || s.pts.length < 4) continue; const p = s.pts, cum = [0]; for (let i = 2; i < p.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1])); const len = cum[cum.length - 1]; if (len < 6) continue;
      const w = s.width !== undefined ? s.width : Math.max(1, G.lanes[id] * 3), pc = { s, id, lay: G.layer[id], cum, len, w, one: G.oneway[id], cls: G.classes[G.cls[id]], speed: Math.min(15, Math.max(5, (G.speed[id] || 30) / 3.6 * 0.6)), alive: true, tile: k };
      ids.push(pc); this.pieces.set(pc, true); for (const e of [0, 1]) { const x = e ? p[p.length - 2] : p[0], z = e ? p[p.length - 1] : p[1], key = this.key(x, z); let l = this.ends.get(key); if (!l) this.ends.set(key, l = []); l.push({ pc, end: e, x, z }); } }
    const pk = []; for (const pc of ids) { const mid = this.at(pc, pc.len / 2, {}), inCP = !!(this.identity && this.identity.areaNameAt && this.identity.areaNameAt(mid.x, mid.z) === 'cp'); if (pc.lay !== 0 || (pc.cls !== 'residential' && pc.cls !== 'tertiary' && !(inCP && pc.cls === 'secondary'))) continue; const side = this.rnd() < 0.5 ? 1 : -1; for (let s = inCP ? 8 : 12; s < pc.len - (inCP ? 8 : 12); s += (inCP ? 6 : 8) + this.rnd() * (inCP ? 4 : 6)) { if (this.rnd() > (inCP ? 0.75 : 0.4)) continue; const o = this.at(pc, s, {}); if (this.crossingAt(o.x, o.z)) continue; const off = (pc.w / 2 + 0.3) * side, nx = -o.tz, nz = o.tx; let kind = this.pickKind(o.x, o.z, this.rnd(), true); if (inCP && this.rnd() < 0.3) kind = 'two';      /* F4: CP kerbs are lined with parked cars (75 percent of the slots, on the secondary Outer Circle too) and every third is a scooter or motorbike */
       pk.push({ x: o.x + nx * off, z: o.z + nz * off, yaw: Math.atan2(o.tz, o.tx), kind, paint: this.paintOf(kind) }); } }
    this.parked.set(k, pk); this.tile.set(k, ids);
  }
  removeTile(k) { this.parked.delete(k); const l = this.tile.get(k); if (!l) return; for (const pc of l) { pc.alive = false; this.pieces.delete(pc); } for (const [key, arr] of this.ends) { const n = arr.filter(e => e.pc.alive); if (n.length) this.ends.set(key, n); else this.ends.delete(key); } this.tile.delete(k); }
  /* is there a crossing (flag 2) or signal (flag 1) node within 6 m of (x, z) */
  crossingAt(x, z) { if (this.signalAt(x, z) >= 0) return true; const G = this.G, i0 = Math.floor(x / 12), j0 = Math.floor(z / 12); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = this.xing.get((i0 + a) + ',' + (j0 + b)); if (l) for (const n of l) if (Math.hypot(G.xz[n * 2] - x, G.xz[n * 2 + 1] - z) < 6) return true; } return false; }
  /* the signalised node within 6 m of (x, z) or -1 */
  signalAt(x, z) { const G = this.G, i0 = Math.floor(x / 12), j0 = Math.floor(z / 12); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = this.sig.get((i0 + a) + ',' + (j0 + b)); if (l) for (const n of l) if (Math.hypot(G.xz[n * 2] - x, G.xz[n * 2 + 1] - z) < 6) return n; } return -1; }
  /* a signal shows green to one axis (0: east-west, 1: north-south) at a time, 14 s each, offset per junction */
  green(node, tx, tz) { const axis = Math.abs(tx) > Math.abs(tz) ? 0 : 1; return Math.floor((this.time + (node * 7 % 28)) / 14) % 2 === axis; }
  /* where the piece is at arc length s: x, z and the direction of increasing s */
  at(pc, s, out) { const c = pc.cum, p = pc.s.pts; let i = 0; while (i + 2 < c.length && c[i + 1] < s) i++; const f = Math.max(0, Math.min(1, (s - c[i]) / Math.max(0.01, c[i + 1] - c[i]))), dx = p[i * 2 + 2] - p[i * 2], dz = p[i * 2 + 3] - p[i * 2 + 1], L = Math.hypot(dx, dz) || 1; out.x = p[i * 2] + dx * f; out.z = p[i * 2 + 1] + dz * f; out.tx = dx / L; out.tz = dz / L; return out; }
  /* how far above (+) or below (-) the ground this street piece's road surface is at (x, z): flyover decks, ramps and underpasses (audit R14) */
  hOf(pc, x, z) { const l = pc.lay; return l > 0 ? deckHeight(this.G, pc.id, x, z) : l < 0 ? -underDepth(this.G, pc.id, x, z) : 0; }
  canGo(pc, dir) { return pc.one === 0 || pc.one === dir; }
  place(car, pc, dir, s) { car.pc = pc; car.dir = dir; car.s = s; car.v = Math.min(car.v || 0, pc.speed); }
  spawn(px, pz) {
    const list = [...this.pieces.keys()]; if (!list.length) return null;
    /* phase 11 (GTA gap list item 6): a tournament, not the first piece that fits: of several random places 40 or 90 to 520 m from the player the NEAREST is taken (6 tries in the dense CP, 3 elsewhere), so the cars you see are not all at the far edge; the 17 cars at CP had none within 150 m before */
    let best = null, bd = 1e9, tries = 0; const want = this.minD === 40 ? 6 : 3; let found = 0;
    for (let t = 0; t < 60 && found < want; t++) { const pc = list[Math.floor(this.rnd() * list.length)], s = this.rnd() * pc.len, o = this.at(pc, s, {}), d = Math.hypot(o.x - px, o.z - pz); if (d < (this.minD || 90) || d > 520) continue; const dir = pc.one !== 0 ? pc.one : this.rnd() < 0.5 ? 1 : -1; if (!this.canGo(pc, dir)) continue; found++; tries++;
      if (d < bd) { bd = d; best = { pc, dir, s, o: { x: o.x, z: o.z } }; } }
    if (!best) return null; const { pc, dir, s, o } = best, kind = this.pickKind(o.x, o.z, this.rnd());
    return { pc, dir, s, h: this.hOf(pc, o.x, o.z), v: pc.speed * (0.6 + 0.4 * this.rnd()), kind, k: DIM[kind].speed, paint: this.paintOf(kind), x: o.x, z: o.z, yaw: 0, lat: 0, wait: 0 };
  }
  update(dt, px, pz, pyaw, py) {
    this.px = px; this.pz = pz; const ph = py === undefined ? undefined : py - (this.gy || 0);       // ph: the player's height above the ground, so a car on a flyover does not stop for someone driving underneath
    const cars = this.cars; this.time += dt; const inCP = !!(this.identity && this.identity.areaNameAt && this.identity.areaNameAt(px, pz) === 'cp'), want = Math.round(this.want * (inCP ? 1.7 : 1)); this.minD = inCP ? 40 : 90;      /* Connaught Place is busy: 70 percent more cars round the player, and they may appear from 40 m (not 90 m) away (GTA gap list item 6, phase 11) */
    while (cars.length > want) cars.pop();
    if (cars.length < want && this.pieces.size) { const c = this.spawn(px, pz); if (c) cars.push(c); }
    const o = {}, SIDE = {};
    for (let n = 0; n < cars.length; n++) { const c = cars[n];
      if (!c.pc.alive || Math.hypot(c.x - px, c.z - pz) > (inCP ? 330 : 700)) { const r = this.spawn(px, pz); if (r) cars[n] = r; else cars.splice(n--, 1); continue; }
      /* the gap to what is ahead on this lane: another car, or the player */
      this.at(c.pc, c.s, o); const tx = o.tx * c.dir, tz = o.tz * c.dir; let gap = 99;
      for (const k of [...cars, ...this.buses, ...(this.peds ? this.peds.filter(p => p.state === 'cross') : []), { x: px, z: pz, player: true, h: ph }]) { if (k === c) continue; if (k.player ? (k.h !== undefined && Math.abs(k.h - c.h) > 3) : Math.abs((k.h || 0) - c.h) > 3) continue; const dx = k.x - c.x, dz = k.z - c.z, ahead = dx * tx + dz * tz, side = Math.abs(-dx * tz + dz * tx); if (ahead > 0 && ahead < gap && side < (k.player ? 2.4 : 2.0)) gap = ahead; }
      { const rem = c.dir > 0 ? c.pc.len - c.s : c.s; if (rem < 22 && rem > 0.5) { const q = c.pc.s.pts, ex = c.dir > 0 ? q[q.length - 2] : q[0], ez = c.dir > 0 ? q[q.length - 1] : q[1], nd = this.signalAt(ex, ez); if (nd >= 0 && !this.green(nd, tx, tz)) gap = Math.min(gap, rem - 1.5); } }       // a red signal at the end of the piece is a wall
      const want = gap < 9 ? 0 : Math.min(c.pc.speed * c.k, c.v + 3 * dt) * Math.min(1, (gap - 9) / 14); c.v += Math.max(-9 * dt, Math.min(2.5 * dt, want - c.v)); c.s += c.dir * c.v * dt;
      if (c.s > c.pc.len || c.s < 0) {                                    // the end of the piece: continue on another that starts here, else turn this car round at a dead end (or retire it)
        const end = c.dir > 0 ? c.pc.len : 0, p = c.pc.s.pts, ex = c.dir > 0 ? p[p.length - 2] : p[0], ez = c.dir > 0 ? p[p.length - 1] : p[1], opts = [];
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = this.ends.get(this.key(ex + a * CELL, ez + b * CELL)); if (l) for (const e of l) if (e.pc !== c.pc && e.pc.alive && Math.hypot(e.x - ex, e.z - ez) < 4 && Math.abs(this.hOf(e.pc, e.x, e.z) - c.h) < 3 && this.canGo(e.pc, e.end === 0 ? 1 : -1)) opts.push(e); }
        if (opts.length) { const e = opts[Math.floor(this.rnd() * opts.length)]; this.place(c, e.pc, e.end === 0 ? 1 : -1, e.end === 0 ? 0.1 : e.pc.len - 0.1); } else { const r = this.spawn(px, pz); if (r) cars[n] = r; else cars.splice(n--, 1); continue; }
        void end; }
      this.at(c.pc, c.s, o); const dx = o.tx * c.dir, dz = o.tz * c.dir, lat = c.pc.one !== 0 ? 0 : -Math.min(c.pc.w / 4, 2.2); c.lat += (lat - c.lat) * Math.min(1, dt * 2);
      const nx = -dz, nz = dx; c.x = o.x + nx * c.lat; c.z = o.z + nz * c.lat; c.yaw = Math.atan2(dz, dx); c.h = this.hOf(c.pc, c.x, c.z); }
    void SIDE; void pyaw; this.draw();
  }
  draw() {
    const gy = this.gy || 0, pk = this.parkedNear(), F = this.fleet, ox = this.origin.x, oz = this.origin.z; F.begin();
    for (const c of this.cars) F.add(c.kind, c.x - ox, gy + (c.h || 0), c.z - oz, c.yaw, c.paint);
    for (const c of pk) F.add(c.kind, c.x - ox, gy, c.z - oz, c.yaw, c.paint);
    F.end();
  }
  /* the nearest car in front of `ph` ({ x, z, yaw }) within `range` m and 2.3 m either side of its heading: { gap, speed } or null (autodrive's leader) */
  leaderAhead(ph, range) { const fx = Math.cos(ph.yaw), fz = Math.sin(ph.yaw); let best = null; for (const c of this.cars) { if (ph.y !== undefined && Math.abs((c.h || 0) + (this.gy || 0) - ph.y) > 3) continue; const dx = c.x - ph.x, dz = c.z - ph.z, ahead = dx * fx + dz * fz, side = Math.abs(-dx * fz + dz * fx); if (ahead > 0 && ahead < range && side < 2.3 && (!best || ahead < best.gap)) best = { gap: ahead - 2.1, speed: c.v }; } return best; }
  /* obstacle circles near (x, z) for the vehicle physics (front and rear of each car) */
  /* parked cars within 220 m of the player (at most PARK_MAX) */
  parkedNear() { const out = []; for (const l of this.parked.values()) for (const c of l) if (Math.abs(c.x - this.px) < 220 && Math.abs(c.z - this.pz) < 220) { out.push(c); if (out.length >= PARK_MAX) return out; } return out; }
  circles(x, z, r) {
    const out = [], put = (c, tr) => { const d = DIM[c.kind || 'hatch'], rr = d.wid / 2 + 0.15, h = Math.max(0, d.len / 2 - rr), cx = Math.cos(c.yaw), sz = Math.sin(c.yaw); if (h < 0.3) out.push({ x: c.x, z: c.z, r: rr, y: this.gy + (c.h || 0), traffic: tr }); else out.push({ x: c.x + cx * h, z: c.z + sz * h, r: rr, y: this.gy + (c.h || 0), traffic: tr }, { x: c.x - cx * h, z: c.z - sz * h, r: rr, y: this.gy + (c.h || 0), traffic: tr }); };
    for (const l of this.parked.values()) for (const c of l) { if (Math.abs(c.x - x) > r + 3 || Math.abs(c.z - z) > r + 3) continue; put(c, undefined); }
    for (const c of this.cars) { if (Math.abs(c.x - x) > r + 5 || Math.abs(c.z - z) > r + 5) continue; put(c, true); } return out; }
}
