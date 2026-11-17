/* DTC and cluster buses on their real routes (D7, docs/DELHI_LOOK.md section 5; data: assets/cities/delhi/transit.json `bus`). A route is a chain of stops (the data holds no road geometry): a bus is started at a stop
   near the player, its next stops are joined by A* on the street graph (CityRouter), and it drives that chain on the left of the road, slows into each stop, waits there for a few seconds and goes on; at the end of
   the chain it is started again somewhere else. The livery follows Delhi's 50:50 rule (identity.json vehicles.bus): DTC green, cluster orange (non-AC) or blue (AC); the number and the terminus come from the
   route and are drawn on the boards of the front, rear and both sides from a canvas. Passengers wait at the stops near the player (extras of CityPeds). Browser only. */
import * as THREE from 'three';
import { CityRouter } from './citynav.js';
import { busGeometry, boardGeometry } from './vehicles.js';
import { hash } from './identity.js';

const MODES = { off: 0, low: 2, mid: 4, high: 7 }, CRUISE = 9, DWELL = [6, 12], REACH = [160, 650], WINDOW = 3200, LATERAL = -1.9;
const hex = s => parseInt(s.slice(1), 16);

export class CityBuses {
  constructor(city) {
    this.city = city; this.scene = city.scene; this.origin = city.origin; this.G = city.pack.G; this.ID = city.identity; this.cap = 0; this.list = []; this.router = null; this.t = 0; this.nextTry = 0; this.ok = false; this.rseed = 1; this.group = new THREE.Group(); this.scene.add(this.group);
    this.boards = boardGeometry(); this.geo = {}; this.mats = new Map(); this.tex = new Map(); this.stats = { spawned: 0, failed: 0 };
  }
  /* index the bus data: routes with at least three stops, stops by 500 m cell, the routes of every stop */
  init() {
    const d = this.city.transit && this.city.transit.data; if (!d || !d.bus || !this.ID) return this; const B = d.bus; this.stops = B.stops; this.routes = B.routes.filter(r => r.stops.length >= 3 && r.from !== null);
    this.cells = new Map(); this.byStop = new Map(); B.stops.forEach((s, i) => { const k = Math.floor(s[0] / 500) + ',' + Math.floor(s[1] / 500); let l = this.cells.get(k); if (!l) this.cells.set(k, l = []); l.push(i); });
    this.routes.forEach((r, ri) => { r.stops.forEach((si, pos) => { if (pos >= r.stops.length - 1) return; let l = this.byStop.get(si); if (!l) this.byStop.set(si, l = []); l.push(ri); }); });
    const V = this.ID.j.vehicles.bus; for (const k of ['dtc', 'dtcAc', 'cluster', 'clusterAc']) { const lv = V[k]; this.geo[k] = busGeometry({ body: hex(lv.body), stripe: hex(lv.stripe), roof: hex(lv.roof) }); }
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15, envMapIntensity: 0.4 }); this.ok = this.routes.length > 0; return this;
  }
  setMode(m) { this.cap = MODES[m] === undefined ? 2 : MODES[m]; }
  /* a board texture for a route: amber letters on black, number large, the terminus beside it */
  boardMat(ref, to) {
    const key = ref + '|' + to; let m = this.mats.get(key); if (m) return m; const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#0a0a0c'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#ffb21a'; g.textBaseline = 'middle';
    g.font = 'bold 44px "Helvetica Neue",Arial,sans-serif'; g.textAlign = 'left'; g.fillText(String(ref).replace(/^\(-\)\s*/, '').slice(0, 5), 8, 34); g.font = 'bold 20px "Helvetica Neue",Arial,sans-serif'; let t = (to || '').toUpperCase(), w = 170; while (g.measureText(t).width > w && t.length > 4) t = t.slice(0, -1); g.fillText(t, 84, 34);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }); if (this.mats.size > 60) { const [k0, v0] = this.mats.entries().next().value; v0.map.dispose(); v0.dispose(); this.mats.delete(k0); } this.mats.set(key, m); return m;
  }
  /* a stop near the player that begins a route chain: { route, first, nodes... } or null */
  pickStart(px, pz) {
    const cand = [], i0 = Math.floor((px - REACH[1]) / 500), i1 = Math.floor((px + REACH[1]) / 500), j0 = Math.floor((pz - REACH[1]) / 500), j1 = Math.floor((pz + REACH[1]) / 500);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = this.cells.get(i + ',' + j); if (l) for (const si of l) { const s = this.stops[si], d = Math.hypot(s[0] - px, s[1] - pz); if (d > REACH[0] && d < REACH[1] && this.byStop.has(si)) cand.push(si); } }
    if (!cand.length) return null; return cand[Math.floor(hash(this.rseed++ * 7919) * cand.length)];
  }
  spawn(px, pz) {
    if (!this.router) this.router = new CityRouter(this.G); const R = this.router, G = this.G, si = this.pickStart(px, pz); if (si === null) return null;
    const rl = this.byStop.get(si), ri = rl[Math.floor(hash(this.rseed++ * 131) * rl.length)], r = this.routes[ri], from = r.stops.indexOf(si); if (from < 0) return null;
    let nodes = [], stopArc = [], len = 0, prev = -1, last = from;
    for (let p = from; p < r.stops.length && len < WINDOW; p++) { const s = this.stops[r.stops[p]], n = R.nearest(s[0], s[1]); if (n < 0) break; if (prev < 0) { nodes.push(n); stopArc.push([0, r.stops[p]]); prev = n; last = p; continue; } if (n === prev) { stopArc.push([len, r.stops[p]]); last = p; continue; }
      const q = R.routeNodes(prev, n, 40000); if (!q || q.metres > 2500) break; for (let k = 1; k < q.nodes.length; k++) nodes.push(q.nodes[k]); len += q.metres; stopArc.push([len, r.stops[p]]); prev = n; last = p; }
    if (nodes.length < 3 || last === from) { this.stats.failed++; return null; }
    const pts = [], cum = [0]; for (const n of nodes) { const x = G.xz[n * 2], z = G.xz[n * 2 + 1]; if (pts.length && Math.hypot(x - pts[pts.length - 2], z - pts[pts.length - 1]) < 0.5) continue; if (pts.length) cum.push(cum[cum.length - 1] + Math.hypot(x - pts[pts.length - 2], z - pts[pts.length - 1])); pts.push(x, z); }
    /* the stops along the polyline: nearest vertex arc length, in order */
    const stops = []; let from0 = 0; for (const [, idx] of stopArc) { const s = this.stops[idx]; let best = from0, bd = Infinity; for (let i = from0; i < pts.length / 2; i++) { const d = Math.hypot(pts[i * 2] - s[0], pts[i * 2 + 1] - s[1]); if (d < bd) { bd = d; best = i; } } if (bd < 90) { stops.push(cum[best]); from0 = best; } }
    const ac = hash(this.rseed++ * 17) < this.ID.j.vehicles.bus.mix.ac, cl = r.op === 'cluster' ? true : r.op === 'dtc' ? false : hash(this.rseed++ * 29) < this.ID.j.vehicles.bus.mix.cluster, key = (cl ? 'cluster' : 'dtc') + (ac ? 'Ac' : '');
    const group = new THREE.Group(), body = new THREE.Mesh(this.geo[key], this.mat), bd = new THREE.Mesh(this.boards, this.boardMat(r.ref, r.to || this.stopName(r.stops[r.stops.length - 1]))); body.castShadow = true; group.add(body, bd); group.matrixAutoUpdate = true; this.group.add(group);
    this.stats.spawned++; return { pts, cum, len: cum[cum.length - 1], s: 0, v: 0, state: 'dwell', dwell: 3 + hash(this.rseed++) * 4, stops, nextStop: 1, group, x: pts[0], z: pts[1], yaw: 0, ref: r.ref, to: r.to, key, kind: 'bus' };
  }
  stopName(i) { return (this.stops[i] && this.stops[i][2]) || ''; }
  at(b, s, o) { const c = b.cum, p = b.pts; let i = 0; while (i + 1 < c.length - 1 && c[i + 1] < s) i++; const f = Math.max(0, Math.min(1, (s - c[i]) / Math.max(0.01, c[i + 1] - c[i]))), dx = p[i * 2 + 2] - p[i * 2], dz = p[i * 2 + 3] - p[i * 2 + 1], l = Math.hypot(dx, dz) || 1; o.x = p[i * 2] + dx * f; o.z = p[i * 2 + 1] + dz * f; o.tx = dx / l; o.tz = dz / l; return o; }
  remove(b) { this.group.remove(b.group); }
  update(dt, px, pz, gy) {
    if (!this.ok || dt <= 0) return; this.t += dt; const L = this.list, tr = this.city.traffic; while (L.length > this.cap) this.remove(L.pop());
    if (L.length < this.cap && this.t > this.nextTry && this.city.tiles.size > 3) { this.nextTry = this.t + 2.5; const b = this.spawn(px, pz); if (b) L.push(b); }
    const o = {};
    for (let n = 0; n < L.length; n++) { const b = L[n];
      if (Math.hypot(b.x - px, b.z - pz) > 1500 || b.s >= b.len - 2) { this.remove(b); L.splice(n--, 1); continue; }
      this.at(b, b.s, o); const tx = o.tx, tz = o.tz; let gap = 99;
      for (const k of tr.cars) { const dx = k.x - b.x, dz = k.z - b.z, ahead = dx * tx + dz * tz, side = Math.abs(-dx * tz + dz * tx); if (ahead > 0 && ahead < gap && side < 2.4) gap = ahead; }
      { const dx = px - b.x, dz = pz - b.z, ahead = dx * tx + dz * tz, side = Math.abs(-dx * tz + dz * tx); if (ahead > 0 && ahead < gap && side < 2.6) gap = ahead; }
      for (const k of L) if (k !== b) { const dx = k.x - b.x, dz = k.z - b.z, ahead = dx * tx + dz * tz, side = Math.abs(-dx * tz + dz * tx); if (ahead > 0 && ahead < gap && side < 3) gap = ahead; }
      { const q = this.at(b, Math.min(b.len, b.s + 14), {}), nd = tr.signalAt(q.x, q.z); if (nd >= 0 && !tr.green(nd, tx, tz)) gap = Math.min(gap, 6); }
      if (b.state === 'dwell') { b.dwell -= dt; b.v = 0; if (b.dwell <= 0 && gap > 8) { b.state = 'run'; } }
      else { const ns = b.stops[b.nextStop], toStop = ns === undefined ? 1e9 : ns - b.s, vStop = Math.sqrt(2 * 1.4 * Math.max(0, toStop - 0.5)), vGap = gap < 12 ? 0 : Math.min(CRUISE, (gap - 12) * 0.6 + 2), want = Math.min(CRUISE, vStop, vGap); b.v += Math.max(-2.2 * dt, Math.min(1.1 * dt, want - b.v));
        if (b.v < 0.05 && want === 0) b.v = 0; b.s += b.v * dt; if (ns !== undefined && ns - b.s < 0.7 && b.v < 1.2) { b.nextStop++; b.state = 'dwell'; b.dwell = DWELL[0] + hash(this.rseed++) * (DWELL[1] - DWELL[0]); b.v = 0; } }
      this.at(b, b.s, o); const nx = -o.tz, nz = o.tx; b.x = o.x + nx * LATERAL; b.z = o.z + nz * LATERAL; const yaw = Math.atan2(o.tz, o.tx); b.yaw = b.yaw === 0 ? yaw : b.yaw + Math.atan2(Math.sin(yaw - b.yaw), Math.cos(yaw - b.yaw)) * Math.min(1, dt * 4);
      b.group.position.set(b.x - this.origin.x, gy, b.z - this.origin.z); b.group.rotation.set(0, -b.yaw + Math.PI / 2, 0); }
  }
  circles(x, z, r) { const out = []; for (const b of this.list) { if (Math.abs(b.x - x) > r + 8 || Math.abs(b.z - z) > r + 8) continue; const c = Math.cos(b.yaw), s = Math.sin(b.yaw); for (const d of [-3.6, 0, 3.6]) out.push({ x: b.x + c * d, z: b.z + s * d, r: 1.4, y: this.city.gy, traffic: true }); } return out; }
  /* the stops with their dwelling or waiting state, for passengers: [{ x, z, name }] near (px, pz) */
  stopsNear(px, pz, r) { const out = []; if (!this.ok) return out; for (let i = Math.floor((px - r) / 500); i <= Math.floor((px + r) / 500); i++) for (let j = Math.floor((pz - r) / 500); j <= Math.floor((pz + r) / 500); j++) { const l = this.cells.get(i + ',' + j); if (l) for (const si of l) { const s = this.stops[si]; if (Math.hypot(s[0] - px, s[1] - pz) < r) out.push({ x: s[0], z: s[1], id: si, name: s[2] }); } } return out; }
  reposition() { /* positions are recomputed from world metres every frame */ }
  summary() { return 'buses       ' + this.list.length + ' on route' + (this.list[0] ? ' (' + this.list.map(b => b.ref).join(', ') + ')' : '') + '  spawned ' + this.stats.spawned + ' failed ' + this.stats.failed; }
}
