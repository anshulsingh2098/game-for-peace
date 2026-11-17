/* The India road network in game space (docs/INDIA_MAP_PLAN.md section 9): the roads of assets/india/skeleton.json as paths with lengths, the junctions where they meet at cities, a grid index for
   "which road is near here", shortest routes between cities, and `guideFor`, the path a drivable road should follow from one city towards another. Pure JavaScript (no three.js, no DOM): the
   self-test runs it and main.js feeds the guide to the road router (world/router.js, `config.road.guide`). Coordinates are game metres (see india_network.js `toGame`). */
/* a road to be driven needs a gentle guide: simplify (Douglas-Peucker, tolerance tol metres) to drop the tiny zigzags where a path passes through a city point, then round the corners (Chaikin) */
export function cleanPath(pts, tol = 90, passes = 3) {
  const n = pts.length / 2; if (n < 3) return pts.slice(); const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1; const stack = [[0, n - 1]];
  while (stack.length) { const [a, b] = stack.pop(); let best = -1, bd = 0; const ax = pts[a * 2], az = pts[a * 2 + 1], dx = pts[b * 2] - ax, dz = pts[b * 2 + 1] - az, L = Math.hypot(dx, dz) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i * 2] - ax) * dz - (pts[i * 2 + 1] - az) * dx) / L; if (d > bd) { bd = d; best = i; } } if (bd > tol && best > 0) { keep[best] = 1; stack.push([a, best], [best, b]); } }
  let out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  for (let k = 0; k < passes; k++) { const q = [out[0], out[1]]; for (let i = 0; i + 3 < out.length; i += 2) { q.push(0.75 * out[i] + 0.25 * out[i + 2], 0.75 * out[i + 1] + 0.25 * out[i + 3], 0.25 * out[i] + 0.75 * out[i + 2], 0.25 * out[i + 1] + 0.75 * out[i + 3]); } q.push(out[out.length - 2], out[out.length - 1]); out = q; }
  return out;
}
/* the point at distance `along` (metres) on a flat [x, z, ...] path: { x, z } (clamped to the ends) */
export function guidePoint(flat, along) {
  let acc = 0; for (let i = 0; i + 3 < flat.length; i += 2) { const dx = flat[i + 2] - flat[i], dz = flat[i + 3] - flat[i + 1], L = Math.hypot(dx, dz); if (acc + L >= along) { const f = L ? (along - acc) / L : 0; return { x: flat[i] + dx * f, z: flat[i + 1] + dz * f }; } acc += L; }
  return { x: flat[flat.length - 2], z: flat[flat.length - 1] };
}
const cumulative = pts => { const s = [0]; for (let i = 2; i < pts.length; i += 2) s.push(s[s.length - 1] + Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1])); return s; };

export class RoadNetwork {
  constructor(skeleton, { cell = 1000 } = {}) {
    this.sk = skeleton; this.cell = cell; this.cities = new Map(skeleton.nodes.map(n => [n.id, n])); this.roads = new Map(); this.grid = new Map();
    for (const r of skeleton.roads) {
      const s = cumulative(r.pts), stops = r.cities.map(id => { const c = this.cities.get(id); return { id, s: this.projectOnPath(r.pts, s, c.x, c.z).s }; });
      for (let i = 1; i < stops.length; i++) if (stops[i].s < stops[i - 1].s) stops[i].s = stops[i - 1].s;            // keep the order along the road even where a path overshoots a city
      this.roads.set(r.id, { id: r.id, name: r.name, kind: r.kind, nh: r.nh, pts: r.pts, s, length: s[s.length - 1], stops });
      for (let i = 0; i < r.pts.length; i += 2) { const k = this.key(r.pts[i], r.pts[i + 1]); let l = this.grid.get(k); if (!l) this.grid.set(k, l = new Set()); l.add(r.id); }
    }
    this.junctions = new Map();                                                                                    // city id -> roads that pass through it
    for (const r of this.roads.values()) for (const st of r.stops) { let l = this.junctions.get(st.id); if (!l) this.junctions.set(st.id, l = []); l.push({ road: r.id, s: st.s }); }
  }
  key(x, z) { return Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell); }
  /* the point on a path (flat [x, z, ...] with cumulative lengths s) nearest to (x, z): { s, d, x, z, tx, tz } */
  projectOnPath(pts, s, x, z) {
    let best = null;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ax = pts[i], az = pts[i + 1], bx = pts[i + 2], bz = pts[i + 3], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz; let t = L2 ? ((x - ax) * dx + (z - az) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz); if (!best || d < best.d) { const L = Math.sqrt(L2) || 1; best = { s: s[i / 2] + t * L, d, x: px, z: pz, tx: dx / L, tz: dz / L }; }
    }
    return best;
  }
  /* the nearest road to a game position within maxD metres: { road, s, d, x, z, tx, tz } or null */
  nearest(x, z, maxD = 600) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell), reach = Math.ceil(maxD / this.cell), seen = new Set(); let best = null;
    for (let i = -reach; i <= reach; i++) for (let j = -reach; j <= reach; j++) { const l = this.grid.get((cx + i) + ',' + (cz + j)); if (l) for (const id of l) if (!seen.has(id)) { seen.add(id); const r = this.roads.get(id), q = this.projectOnPath(r.pts, r.s, x, z); if (q.d <= maxD && (!best || q.d < best.d)) best = { road: id, ...q }; } }
    return best;
  }
  /* position and heading at distance s along a road */
  at(roadId, s) {
    const r = this.roads.get(roadId), p = r.pts; s = Math.max(0, Math.min(r.length, s)); let lo = 0, hi = r.s.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.s[m] <= s) lo = m; else hi = m; }
    const L = r.s[hi] - r.s[lo] || 1, t = (s - r.s[lo]) / L, ax = p[lo * 2], az = p[lo * 2 + 1], bx = p[hi * 2], bz = p[hi * 2 + 1]; return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, tx: (bx - ax) / L, tz: (bz - az) / L };
  }
  /* roads meeting at a city (2 or more is a junction) */
  junction(cityId) { return this.junctions.get(cityId) || []; }
  isJunction(cityId) { return this.junction(cityId).length >= 2; }
  /* shortest route between two cities along the roads: legs [{ road, from, to, s0, s1, length }] and the total length in game metres, or null */
  route(from, to) {
    if (!this.junctions.has(from) || !this.junctions.has(to)) return null; if (from === to) return { legs: [], length: 0 };
    const adj = new Map(), add = (a, b, leg) => { let l = adj.get(a); if (!l) adj.set(a, l = []); l.push({ to: b, leg }); };
    for (const r of this.roads.values()) for (let i = 1; i < r.stops.length; i++) { const a = r.stops[i - 1], b = r.stops[i], len = b.s - a.s; if (a.id === b.id) continue; add(a.id, b.id, { road: r.id, from: a.id, to: b.id, s0: a.s, s1: b.s, length: len }); add(b.id, a.id, { road: r.id, from: b.id, to: a.id, s0: b.s, s1: a.s, length: len }); }
    const dist = new Map([[from, 0]]), prev = new Map(), open = new Set([from]);
    while (open.size) { let u = null; for (const n of open) if (u === null || dist.get(n) < dist.get(u)) u = n; open.delete(u); if (u === to) break; for (const e of adj.get(u) || []) { const nd = dist.get(u) + e.leg.length; if (!dist.has(e.to) || nd < dist.get(e.to)) { dist.set(e.to, nd); prev.set(e.to, { from: u, leg: e.leg }); open.add(e.to); } } }
    if (!dist.has(to)) return null; const legs = []; for (let c = to; c !== from;) { const p = prev.get(c); legs.unshift(p.leg); c = p.from; } return { legs, length: dist.get(to) };
  }
  /* the points of road `roadId` from distance s0 to s1 (either direction), absolute game metres, ends included */
  slice(roadId, s0, s1) {
    const r = this.roads.get(roadId), out = [], a = this.at(roadId, s0), b = this.at(roadId, s1); out.push(a.x, a.z);
    if (s1 >= s0) { for (let i = 0; i < r.s.length; i++) if (r.s[i] > s0 + 0.5 && r.s[i] < s1 - 0.5) out.push(r.pts[i * 2], r.pts[i * 2 + 1]); }
    else { for (let i = r.s.length - 1; i >= 0; i--) if (r.s[i] < s0 - 0.5 && r.s[i] > s1 + 0.5) out.push(r.pts[i * 2], r.pts[i * 2 + 1]); }
    out.push(b.x, b.z); return out;
  }
  /* a guide across several roads: the shortest route from city `from` to city `to`, as one path (relative to the start city) with its cities, the road legs and the junction cities where the road changes */
  routeGuide(from, to) {
    const r = this.route(from, to); if (!r || !r.legs.length) return null; let abs = []; const c0 = this.cities.get(from);
    for (const leg of r.legs) { const seg = this.slice(leg.road, leg.s0, leg.s1); if (abs.length) seg.splice(0, 2); abs.push(...seg); }
    const rel = []; for (let i = 0; i < abs.length; i += 2) rel.push(abs[i] - c0.x, abs[i + 1] - c0.z); const clean = cleanPath(rel), cs = cumulative(clean), cities = [], legs = [];
    const stops = [from, ...r.legs.map(l => l.to)]; stops.forEach((id, i) => { const n0 = this.cities.get(id); cities.push({ id, name: n0.name, along: i === 0 ? 0 : Math.round(this.projectOnPath(clean, cs, n0.x - c0.x, n0.z - c0.z).s) }); });
    r.legs.forEach((l, i) => { const rd = this.roads.get(l.road), prev = legs[legs.length - 1]; if (prev && prev.road === l.road) { prev.to = l.to; prev.toAlong = cities[i + 1].along; } else legs.push({ road: l.road, name: rd.name, nh: rd.nh, from: l.from, to: l.to, fromAlong: cities[i].along, toAlong: cities[i + 1].along }); });
    return { from, to, pts: clean, cities, legs, length: cs[cs.length - 1], junctions: legs.slice(1).map(l => l.from) };
  }
  /* what you can do at a city: for each road through it, the next city each way. `cameFrom` (city id) leaves out the way you arrived; `onRoad` marks the choice that keeps going on your road. Each: { road, name, nh, toward, towardName, km (real), same } */
  junctionChoices(cityId, { cameFrom = null, onRoad = null } = {}) {
    const out = []; for (const { road: rid } of this.junction(cityId)) { const r = this.roads.get(rid), i = r.stops.findIndex(st => st.id === cityId);
      for (const k of [i - 1, i + 1]) { const st = r.stops[k]; if (!st || st.id === cameFrom || st.id === cityId) continue; out.push({ road: rid, name: r.name, nh: r.nh, toward: st.id, towardName: this.cities.get(st.id).name, km: Math.round(Math.abs(st.s - r.stops[i].s) * 100 / 1000), same: rid === onRoad }); } }
    return out.sort((p, q) => (q.same ? 1 : 0) - (p.same ? 1 : 0) || p.km - q.km);
  }
  /* the road to start a free drive on at a city (docs/INDIA_MAP_PLAN.md: one continuous world): the best highway through the city (Golden Quadrilateral, North-South, East-West, then others),
     with the guide ahead (towards the next city) and behind (towards the previous one). null if no road passes through the city. */
  worldStart(cityId, opt = {}) {
    const rank = { gq: 0, ns: 1, ew: 2, nh: 3 }, list = (this.junctions.get(cityId) || []).map(j => this.roads.get(j.road)).sort((a, b) => rank[a.kind] - rank[b.kind] || b.length - a.length); if (!list.length) return null;
    const r = list.find(x => x.id === opt.road) || list[0], i = r.stops.findIndex(s => s.id === cityId); let nxt = r.stops[i + 1], prv = r.stops[i - 1]; if (opt.toward && prv && prv.id === opt.toward) [nxt, prv] = [prv, nxt]; let gA = nxt ? this.guideFor(r.id, cityId, nxt.id) : null, gB = prv ? this.guideFor(r.id, cityId, prv.id) : null; if (!gA) { gA = gB; gB = null; } if (!gA) return null;
    return { road: r.id, name: r.name, kind: r.kind, nh: r.nh, gA, gB };
  }
  /* the path a drivable road follows from city `from` towards city `toward` along road `roadId`: points relative to the start city ([0, 0, x, z, ...], game metres), the road's cities with their
     distance along the guide, and the direction. null if the road does not pass through both cities. */
  guideFor(roadId, from, toward) {
    const r = this.roads.get(roadId); if (!r) return null; const a = r.stops.find(s => s.id === from), b = r.stops.find(s => s.id === toward); if (!a || !b || a.id === b.id) return null;
    const dir = b.s > a.s ? 1 : -1, pts = [], n = r.pts.length / 2, cities = []; const c0 = this.at(r.id, a.s); pts.push(0, 0);
    for (let i = 0; i < n; i++) { const s = r.s[i]; if (dir > 0 ? s > a.s : s < a.s) pts.push(r.pts[i * 2] - c0.x, r.pts[i * 2 + 1] - c0.z); }
    if (dir < 0) { const first = pts.slice(0, 2), rest = []; for (let i = pts.length - 2; i >= 2; i -= 2) rest.push(pts[i], pts[i + 1]); pts.length = 0; pts.push(...first, ...rest); }
    for (const st of r.stops) { const along = (st.s - a.s) * dir; if (along >= -1) cities.push({ id: st.id, name: this.cities.get(st.id).name, along: Math.max(0, along) }); }
    cities.sort((p, q) => p.along - q.along); const clean = cleanPath(pts), cs = cumulative(clean); for (const c of cities) { const n0 = this.cities.get(c.id); c.along = Math.round(this.projectOnPath(clean, cs, n0.x - c0.x, n0.z - c0.z).s); } return { road: r.id, from, toward, dir, pts: clean, cities, length: cs[cs.length - 1] };
  }
}
