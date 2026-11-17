/* Pedestrians on the pavements of the city pack (WORK_REMAINING 12.5). They walk along the street pieces CityTraffic already holds (the ground streets of the loaded tiles), on the pavement side at the kerb line plus 0.9 m,
   at the end of a piece they carry on along another street that starts there (or turn round), and now and then cross the street at a piece end when no car is near. The figures are drawn by the existing
   `pedestrians/pedestrians.js` (four instanced meshes); this module only simulates. Obstacle circles (r 0.35) go to the vehicle physics so a car does not drive through anyone. Browser only (it makes the Pedestrians meshes). */
import { Pedestrians } from '../../pedestrians/pedestrians.js';

const MODES = { off: 0, low: 10, mid: 24, high: 44 }, SPAWN_MIN = 25, SPAWN_MAX = 110, DESPAWN = 150;
const rnd = (() => { let s = 777; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
const WALKABLE = new Set(['primary', 'secondary', 'tertiary', 'residential']);

export class CityPeds {
  constructor(scene, origin, traffic) {
    this.traffic = traffic; this.cap = 0; this.list = []; this.gy = 0; this.t = 0;
    this.sim = { list: this.list, level: 'mid', update() {}, setLevel() {}, clear() {} };
    this.view = new Pedestrians(scene, { graph: { edges: new Map() } }, 'city', origin, { density: 1, level: 'high' }); this.view.sim = this.sim;
  }
  setMode(m) { this.cap = Math.min(44, MODES[m] === undefined ? 10 : MODES[m]); }
  pos(p, s, out) { const pc = p.pc, c = pc.cum, pts = pc.s.pts; let i = 0; while (i + 2 < c.length && c[i + 1] < s) i++; const f = Math.max(0, Math.min(1, (s - c[i]) / Math.max(0.01, c[i + 1] - c[i]))), dx = pts[i * 2 + 2] - pts[i * 2], dz = pts[i * 2 + 3] - pts[i * 2 + 1], L = Math.hypot(dx, dz) || 1; out.x = pts[i * 2] + dx * f; out.z = pts[i * 2 + 1] + dz * f; out.tx = dx / L; out.tz = dz / L; return out; }
  spawn(px, pz) {
    const tr = this.traffic; if (!tr.pieces.size) return null; const list = [...tr.pieces.keys()];
    for (let t = 0; t < 30; t++) { const pc = list[Math.floor(rnd() * list.length)]; if (!WALKABLE.has(pc.cls) || pc.len < 20) continue; const s = rnd() * pc.len, o = this.pos({ pc }, s, {}), d = Math.hypot(o.x - px, o.z - pz); if (d < SPAWN_MIN || d > SPAWN_MAX) continue;
      return { pc, s, dir: rnd() < 0.5 ? 1 : -1, side: rnd() < 0.5 ? 1 : -1, lat: 0, v: 1.0 + rnd() * 0.5, colour: Math.floor(rnd() * 24), skin: Math.floor(rnd() * 8), phase: rnd() * 6, state: 'walk', x: o.x, z: o.z, y: this.gy, yaw: 0, cross: 0, wait: 0 }; }
    return null;
  }
  update(dt, px, pz, gy) {
    this.gy = gy; const tr = this.traffic, L = this.list; while (L.length > this.cap) L.pop();
    if (L.length < this.cap && tr.pieces.size && dt > 0) { const p = this.spawn(px, pz); if (p) L.push(p); }
    const o = {};
    for (let n = 0; n < L.length; n++) { const p = L[n];
      if (!p.pc.alive || Math.hypot(p.x - px, p.z - pz) > DESPAWN) { const r = this.spawn(px, pz); if (r) L[n] = r; else L.splice(n--, 1); continue; }
      if (p.state === 'cross') { p.cross += dt * 1.4 / Math.max(4, p.pc.w + 1.8); p.phase += dt * 7; if (p.cross >= 1) { p.cross = 0; p.side = -p.side; p.state = 'walk'; } }
      else if (p.state === 'wait') { p.wait -= dt; p.phase = 0; if (p.wait <= 0 && !this.carNear(p.x, p.z, 22)) { p.state = 'cross'; p.cross = 0; } }
      else { p.s += p.dir * p.v * dt; p.phase += dt * 6;
        if (p.s > p.pc.len || p.s < 0) {
          const end = p.dir > 0 ? p.pc.len : 0; this.pos(p, end, o); const ex = o.x, ez = o.z;
          if (rnd() < 0.3) { p.s = end; p.state = 'wait'; p.wait = 1 + rnd() * 3; }                                               // cross here, once the street is clear
          else { const opts = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = tr.ends.get(tr.key(ex + a * 8, ez + b * 8)); if (l) for (const e of l) if (e.pc !== p.pc && e.pc.alive && WALKABLE.has(e.pc.cls) && Math.hypot(e.x - ex, e.z - ez) < 4) opts.push(e); }
            if (opts.length) { const e = opts[Math.floor(rnd() * opts.length)]; p.pc = e.pc; p.dir = e.end === 0 ? 1 : -1; p.s = e.end === 0 ? 0.1 : e.pc.len - 0.1; } else { p.dir = -p.dir; p.s = Math.max(0.1, Math.min(p.pc.len - 0.1, p.s)); } } } }
      this.pos(p, Math.max(0, Math.min(p.pc.len, p.s)), o); const off = (p.pc.w / 2 + 0.9) * (p.side * (1 - 2 * Math.min(1, p.state === 'cross' ? p.cross : 0)));       // lateral: the pavement, or somewhere across the street
      const nx = -o.tz, nz = o.tx; p.x = o.x + nx * off; p.z = o.z + nz * off; p.y = gy; p.yaw = Math.atan2(o.tz * p.dir, o.tx * p.dir) + (p.state === 'cross' ? p.side * -Math.PI / 2 * 0 : 0);
      if (p.state === 'cross') p.yaw = Math.atan2(nz * -p.side, nx * -p.side); p.frozen = p.state === 'wait'; }
    this.view.draw({ x: px, z: pz });
  }
  carNear(x, z, r) { for (const c of this.traffic.cars) if (Math.hypot(c.x - x, c.z - z) < r) return true; return false; }
  circles(x, z, r) { const out = []; for (const p of this.list) if (Math.abs(p.x - x) < r + 2 && Math.abs(p.z - z) < r + 2) out.push({ x: p.x, z: p.z, r: 0.35, y: this.gy, ped: true }); return out; }
}
