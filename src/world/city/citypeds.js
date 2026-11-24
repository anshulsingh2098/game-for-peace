/* Pedestrians on the pavements of the city pack (WORK_REMAINING 12.5). They walk along the street pieces CityTraffic already holds (the ground streets of the loaded tiles), on the pavement side at the kerb line plus 0.9 m,
   at the end of a piece they carry on along another street that starts there (or turn round), and now and then cross the street at a piece end when no car is near. The figures are drawn by the existing
   `pedestrians/pedestrians.js` (four instanced meshes); this module only simulates. Obstacle circles (r 0.35) go to the vehicle physics so a car does not drive through anyone. Browser only (it makes the Pedestrians meshes). */
import { Pedestrians } from '../../pedestrians/pedestrians.js';

const MODES = { off: 0, low: 10, mid: 24, high: 44 }, SPAWN_MIN = 25, SPAWN_MAX = 110, DESPAWN = 150;
/* each simulation owns its random stream, seeded when it is made, so a replay does not depend on what another simulation drew (audit R15) */
const makeRnd = seed => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const WALKABLE = new Set(['primary', 'secondary', 'tertiary', 'residential']);

export class CityPeds {
  constructor(scene, origin, traffic, city = null) {
    this.rnd = makeRnd(777);
    this.city = city; this.extra = []; this.extraT = 0; this.snapCache = new Map(); this.traffic = traffic; this.cap = 0; this.list = []; this.gy = 0; this.t = 0;
    this.sim = { list: this.list, level: 'mid', update() {}, setLevel() {}, clear() {} };
    this.view = new Pedestrians(scene, { graph: { edges: new Map() } }, 'city', origin, { density: 1, level: 'high' }); this.view.sim = this.sim; this.hitSpots = []; this.view.onRemove = p => this.hitSpots.push({ x: p.x, z: p.z, t: this.t });
  }
  setMode(m) { this.cap = Math.min(44, MODES[m] === undefined ? 10 : MODES[m]); }
  pos(p, s, out) { const pc = p.pc, c = pc.cum, pts = pc.s.pts; let i = 0; while (i + 2 < c.length && c[i + 1] < s) i++; const f = Math.max(0, Math.min(1, (s - c[i]) / Math.max(0.01, c[i + 1] - c[i]))), dx = pts[i * 2 + 2] - pts[i * 2], dz = pts[i * 2 + 3] - pts[i * 2 + 1], L = Math.hypot(dx, dz) || 1; out.x = pts[i * 2] + dx * f; out.z = pts[i * 2 + 1] + dz * f; out.tx = dx / L; out.tz = dz / L; return out; }
  spawn(px, pz) {
    const tr = this.traffic; if (!tr.pieces.size) return null; const list = [...tr.pieces.keys()];
    for (let t = 0; t < 30; t++) { const pc = list[Math.floor(this.rnd() * list.length)]; if (!WALKABLE.has(pc.cls) || pc.len < 20) continue; const s = this.rnd() * pc.len, o = this.pos({ pc }, s, {}), d = Math.hypot(o.x - px, o.z - pz); if (d < SPAWN_MIN || d > SPAWN_MAX) continue; if (this.list.some(q => Math.hypot(q.x - o.x, q.z - o.z) < 1.4) || this.extra.some(q => Math.hypot(q.x - o.x, q.z - o.z) < 1.4)) continue;
      const ID = this.city && this.city.identity; if (ID && this.rnd() > ID.areaAt(o.x, o.z).people.density) continue;
      return { cloth: ID ? this.clothes(ID) : undefined, pc, s, dir: this.rnd() < 0.5 ? 1 : -1, side: this.rnd() < 0.5 ? 1 : -1, lane: (this.rnd() - 0.5) * 1.1, lat: 0, v: 1.0 + this.rnd() * 0.5, colour: Math.floor(this.rnd() * 24), skin: Math.floor(this.rnd() * 8), phase: this.rnd() * 6, state: 'walk', x: o.x, z: o.z, y: this.gy, yaw: 0, cross: 0, wait: 0 }; }
    return null;
  }
  update(dt, px, pz, gy) {
    this.gy = gy; this.t += dt; const tr = this.traffic, L = this.list, ID = this.city && this.city.identity, capNow = ID && ID.areaNameAt && this.cap > 0 && ID.areaNameAt(px, pz) === 'cp' ? Math.min(60, Math.round(this.cap * 1.5)) : this.cap;      /* F4: Connaught Place is crowded: half as many people again (up to 60) */
    while (L.length > capNow) L.pop();
    if (L.length < capNow && tr.pieces.size && dt > 0) { const p = this.spawn(px, pz); if (p) L.push(p); }
    const o = {}, GR = new Map(), CS = 1.5, put = q => { const k = Math.floor(q.x / CS) * 100003 + Math.floor(q.z / CS); let l = GR.get(k); if (!l) GR.set(k, l = []); l.push(q); };
    for (const q of L) put(q); for (const q of this.extra) put(q);
    for (let n = 0; n < L.length; n++) { const p = L[n];
      if (p.gone || !p.pc.alive || Math.hypot(p.x - px, p.z - pz) > DESPAWN) { const r = this.spawn(px, pz); if (r) L[n] = r; else L.splice(n--, 1); continue; }
      if (p.state === 'cross') { p.cross += dt * 1.4 / Math.max(4, p.pc.w + 1.8); p.phase += dt * 7; if (p.cross >= 1) { p.cross = 0; p.side = -p.side; p.state = 'walk'; } }
      else if (p.state === 'wait') { p.wait -= dt; p.phase = 0; if (p.wait <= 0 && !this.carNear(p.x, p.z, 22)) { p.state = 'cross'; p.cross = 0; } }
      else {
        let slow = 1; const ds = p.dir > 0 ? 1 : -1;                                                                                    // keep left: a walker's own side of the pavement depends on which way they walk
        if (p.lane === undefined) p.lane = 0; const base = p.lane + 0.3 * ds, fx = Math.cos(p.yaw), fz = Math.sin(p.yaw), cx = Math.floor(p.x / CS), cz = Math.floor(p.z / CS); let push = 0;
        if (!this.noAvoid) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = GR.get((cx + a) * 100003 + (cz + b)); if (!l) continue;
          for (const q of l) { if (q === p) continue; const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz); if (d > 1.3 || d < 1e-3) continue; const ahead = dx * fx + dz * fz, side = -dx * fz + dz * fx;       // side > 0: they are on my left
            if (d < 0.85) push += (side >= 0 ? -1 : 1) * (0.85 - d);                                                                        // step away from someone too close
            if (ahead > 0.05 && Math.abs(side) < 0.6 && ahead < 1.25 && (q.state !== 'walk' || q.dir === p.dir)) slow = Math.min(slow, Math.max(q.state === 'walk' ? 0 : 0.35, (ahead - 0.5) / 0.75)); } }       // someone just ahead, going the same way or standing: slow behind them
        p.lat = (p.lat === undefined ? base : p.lat); p.lat += push * ds * dt * 3.2 + (base - p.lat) * Math.min(1, dt * 0.7); p.lat = Math.max(base - 1.1, Math.min(base + 1.1, p.lat));
        p.s += p.dir * p.v * slow * dt; p.phase += dt * 6;
        if (p.s > p.pc.len || p.s < 0) {
          const end = p.dir > 0 ? p.pc.len : 0; this.pos(p, end, o); const ex = o.x, ez = o.z;
          if (tr.crossingAt(ex, ez) && this.rnd() < 0.5) { p.s = end; p.state = 'wait'; p.wait = 1 + this.rnd() * 3; }                     // cross at a zebra (a flagged node), once the street is clear
          else { const opts = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = tr.ends.get(tr.key(ex + a * 8, ez + b * 8)); if (l) for (const e of l) if (e.pc !== p.pc && e.pc.alive && WALKABLE.has(e.pc.cls) && Math.hypot(e.x - ex, e.z - ez) < 4) opts.push(e); }
            if (opts.length) { const e = opts[Math.floor(this.rnd() * opts.length)]; p.pc = e.pc; p.dir = e.end === 0 ? 1 : -1; p.s = e.end === 0 ? 0.1 : e.pc.len - 0.1; } else { p.dir = -p.dir; p.s = Math.max(0.1, Math.min(p.pc.len - 0.1, p.s)); } } } }
      this.pos(p, Math.max(0, Math.min(p.pc.len, p.s)), o); const off = (p.pc.w / 2 + 0.9) * (p.side * (1 - 2 * Math.min(1, p.state === 'cross' ? p.cross : 0))) + (p.state === 'walk' && p.lat ? p.lat : 0);       // lateral: the pavement, or somewhere across the street
      const nx = -o.tz, nz = o.tx; p.x = o.x + nx * off; p.z = o.z + nz * off; p.y = gy; p.yaw = Math.atan2(o.tz * p.dir, o.tx * p.dir) + (p.state === 'cross' ? p.side * -Math.PI / 2 * 0 : 0);
      if (p.state === 'cross') p.yaw = Math.atan2(nz * -p.side, nx * -p.side); p.frozen = p.state === 'wait'; }
    this.extraT -= dt; if (this.extraT <= 0 && this.cap > 0) { this.extraT = 2; this.refreshExtras(px, pz); } this.sim.list = this.cap > 0 ? L.concat(this.extra) : L; this.view.draw({ x: px, z: pz });
  }
  clothes(ID) { const l = ID.clothing(this.city.month || 6); return parseInt(l[Math.floor(this.rnd() * l.length)].slice(1), 16); }
  /* a point on the pavement beside the nearest loaded street to (x, z): cached per key */
  snap(key, x, z) { let r = this.snapCache.get(key); if (r) return r; let best = null, bd = 40; for (const pc of this.traffic.pieces.keys()) { if (!WALKABLE.has(pc.cls)) continue; const p = pc.s.pts; for (let i = 0; i + 3 < p.length; i += 2) { const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], L2 = dx * dx + dz * dz, f = L2 ? Math.max(0, Math.min(1, ((x - p[i]) * dx + (z - p[i + 1]) * dz) / L2)) : 0, qx = p[i] + dx * f, qz = p[i + 1] + dz * f, d = Math.hypot(qx - x, qz - z); if (d < bd) { const l = Math.sqrt(L2) || 1, side = (x - qx) * -dz / l + (z - qz) * dx / l >= 0 ? 1 : -1; bd = d; best = { x: qx + -dz / l * (pc.w / 2 + 1.2) * side, z: qz + dx / l * (pc.w / 2 + 1.2) * side, yaw: Math.atan2(dx * side, -dz * side) }; } } }
    r = best || { x, z, yaw: 0 }; this.snapCache.set(key, r); if (this.snapCache.size > 400) this.snapCache.delete(this.snapCache.keys().next().value); return r; }
  /* the standing people of the neighbourhood, rebuilt every 2 s: passengers at the bus stops, people at the Metro entrances, vendors at the stalls of the tiles */
  refreshExtras(px, pz) {
    const c = this.city, ID = c && c.identity; if (!ID) return; const E = [], mk = (x, z, yaw, k, cloth) => E.push({ x, z, y: this.gy, yaw, colour: Math.floor(k * 24), skin: Math.floor(((k * 97) % 1) * 8), cloth, phase: k * 6, state: 'stand', frozen: true });
    const hash = (n) => { let h = (n | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }, cl = ID.clothing(c.month || 6), vend = [0x8a7a5a, 0xc9b08a, 0x6a7a6a, 0xa0a0a0];
    if (c.buses && c.buses.ok) for (const s of c.buses.stopsNear(px, pz, 130)) { const q = this.snap('b' + s.id, s.x, s.z), n = Math.floor(hash(s.id) * 4); for (let i = 0; i < n; i++) { const k = hash(s.id * 13 + i); mk(q.x + Math.cos(q.yaw + 1.57) * (i - n / 2) * 0.6, q.z + Math.sin(q.yaw + 1.57) * (i - n / 2) * 0.6, q.yaw, k, parseInt(cl[Math.floor(k * cl.length)].slice(1), 16)); } }
    const st = c.transit && c.transit.data && c.transit.data.metro && c.transit.data.metro.stations; if (st) for (const s of st) { if (!s.entrances) continue; for (const [ex, ez] of s.entrances) { if (Math.abs(ex - px) > 130 || Math.abs(ez - pz) > 130) continue; const n = 2 + Math.floor(hash(ex * 3 + ez) * 3); for (let i = 0; i < n; i++) { const k = hash(ex * 7 + ez * 5 + i); mk(ex + (k - 0.5) * 5, ez + (hash(k * 91) - 0.5) * 5, k * 6.28, k, parseInt(cl[Math.floor(k * cl.length)].slice(1), 16)); } } }
    for (const t of c.tiles.values()) { const sp = t.stalls; if (!sp) continue; for (let i = 0; i < sp.length; i += 2) { if (Math.abs(sp[i] - px) > 110 || Math.abs(sp[i + 1] - pz) > 110) continue; const k = hash(sp[i] * 5 + sp[i + 1]); mk(sp[i] + 1.3, sp[i + 1] + 0.4, k * 6.28, k, vend[Math.floor(k * vend.length) % vend.length]); } }
    /* people who stand should not stand inside each other (bus-stop queues were 0.6 m apart: the shoulders and arms of the new models overlap): push neighbours apart until each is at least 0.9 m from the next */
    for (let it = 0; it < 4; it++) for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) { const a = E[i], b = E[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d >= 0.9) continue; const ux = d > 1e-3 ? dx / d : Math.cos(i * 2.4), uz = d > 1e-3 ? dz / d : Math.sin(i * 2.4), m = (0.9 - d) / 2; a.x -= ux * m; a.z -= uz * m; b.x += ux * m; b.z += uz * m; }
    const hs = this.hitSpots; this.hitSpots = hs.filter(h => this.t - h.t < 120);         // a standing person who was knocked down does not reappear at the next refresh
    this.extra = E.filter(e => !this.hitSpots.some(h => Math.hypot(h.x - e.x, h.z - e.z) < 1.6)).slice(0, 120);
  }
  carNear(x, z, r) { for (const c of this.traffic.cars) if (Math.abs(c.h || 0) < 3 && Math.hypot(c.x - x, c.z - z) < r) return true; return false; }
  circles() { return []; }            // walkers are no longer solid for the car: a hit makes them fall as a ragdoll (pedestrians/ragdoll.js)
}
