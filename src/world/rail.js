/* Railways of the India world (docs/INDIA_MAP_PLAN.md): the six trunk lines of the skeleton as real track you can see and cross, level crossings where a line cuts a road, and trains that run on them.
   Pure part (no three.js, tested by the self-test): RailLine (a path with distance), segIntersect, findCrossings (where rail and road cross, away from cities), trainPlace (a train that runs back and forth
   along its line), crossingClosed (the barriers are down when a train is near).
   View part (RailView): track chunks of 64 m built near the player (ballast, two rails, sleepers, one merged mesh each), barrier arms at crossings that go down for a train, the trains themselves
   (a blue diesel loco and cream-and-blue coaches), and obstacle circles so the car cannot drive through a train.
   Game space: x east, z south in game metres (1:100); the view converts to the world with toWorld(gx, gz) and back with toGame(wx, wz). Rails are rough hand-entered corridors, not surveyed track (WORK_REMAINING 7.7). */
const cum = pts => { const s = [0]; for (let i = 2; i < pts.length; i += 2) s.push(s[s.length - 1] + Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1])); return s; };

export class RailLine {
  constructor(id, pts, cities = []) { this.id = id; this.pts = pts; this.s = cum(pts); this.len = this.s[this.s.length - 1]; this.cities = cities; }
  /* position and direction at distance s along the line (clamped), written into out { x, z, tx, tz } */
  at(s, out = {}) {
    const P = this.pts, S = this.s; s = s < 0 ? 0 : s > this.len ? this.len : s; let lo = 0, hi = S.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const x0 = P[lo * 2], z0 = P[lo * 2 + 1], x1 = P[hi * 2], z1 = P[hi * 2 + 1], d = Math.hypot(x1 - x0, z1 - z0) || 1, f = (s - S[lo]) / d;
    out.x = x0 + (x1 - x0) * f; out.z = z0 + (z1 - z0) * f; out.tx = (x1 - x0) / d; out.tz = (z1 - z0) / d; return out;
  }
  /* the distance along the line of the point on it nearest (x, z), and how far that point is */
  nearest(x, z) {
    const P = this.pts, S = this.s; let best = Infinity, bs = 0;
    for (let i = 0; i + 3 < P.length; i += 2) { const ax = P[i], az = P[i + 1], bx = P[i + 2], bz = P[i + 3], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1; let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const d = Math.hypot(ax + dx * t - x, az + dz * t - z); if (d < best) { best = d; bs = S[i / 2] + t * Math.sqrt(l2); } }
    return { s: bs, d: best };
  }
}

/* where segment a-b crosses segment c-d: { t (along a-b), u (along c-d), x, z } or null */
export function segIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const r1 = bx - ax, r2 = bz - az, s1 = dx - cx, s2 = dz - cz, den = r1 * s2 - r2 * s1; if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * s2 - (cz - az) * s1) / den, u = ((cx - ax) * r2 - (cz - az) * r1) / den; if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, x: ax + r1 * t, z: az + r2 * t };
}

/* level crossings: every place a rail line cuts a road (both as point lists [x, z, ...]), at least `minAngle` radians off parallel and at least `minCity` game metres from any city */
export function findCrossings(rail, roads, cities = [], { minAngle = 0.45, minCity = 60 } = {}) {
  const out = [], P = rail.pts; let rx0 = 1e18, rx1 = -1e18, rz0 = 1e18, rz1 = -1e18; for (let i = 0; i < P.length; i += 2) { rx0 = Math.min(rx0, P[i]); rx1 = Math.max(rx1, P[i]); rz0 = Math.min(rz0, P[i + 1]); rz1 = Math.max(rz1, P[i + 1]); }
  for (const road of roads) {
    const Q = road.pts; if (!road.bb) { let a = 1e18, b = -1e18, c = 1e18, d = -1e18; for (let i = 0; i < Q.length; i += 2) { a = Math.min(a, Q[i]); b = Math.max(b, Q[i]); c = Math.min(c, Q[i + 1]); d = Math.max(d, Q[i + 1]); } road.bb = [a, b, c, d]; }
    if (road.bb[1] < rx0 || road.bb[0] > rx1 || road.bb[3] < rz0 || road.bb[2] > rz1) continue;
    for (let i = 0; i + 3 < P.length; i += 2) for (let j = 0; j + 3 < Q.length; j += 2) {
      const h = segIntersect(P[i], P[i + 1], P[i + 2], P[i + 3], Q[j], Q[j + 1], Q[j + 2], Q[j + 3]); if (!h) continue;
      const ra = Math.atan2(P[i + 3] - P[i + 1], P[i + 2] - P[i]), rb = Math.atan2(Q[j + 3] - Q[j + 1], Q[j + 2] - Q[j]); let d = Math.abs(ra - rb) % Math.PI; d = Math.min(d, Math.PI - d); if (d < minAngle) continue;
      if (cities.some(c => Math.hypot(c.x - h.x, c.z - h.z) < minCity)) continue;
      out.push({ rail: rail.id, road: road.id, s: rail.s[i / 2] + h.t * Math.hypot(P[i + 2] - P[i], P[i + 3] - P[i + 1]), x: h.x, z: h.z, roadTx: Math.cos(rb), roadTz: Math.sin(rb), railTx: Math.cos(ra), railTz: Math.sin(ra), sinA: Math.sin(d), kind: road.kind || '' });
    }
  }
  return out.sort((a, b) => a.s - b.s);
}

/* a train that runs from one end of its line to the other and back, for ever: head distance and travel direction (+1 towards the line's end) at time t (s) */
export function trainPlace(len, t, speed, offset = 0) {
  const span = Math.max(len, 1), d = ((speed * t + offset) % (2 * span) + 2 * span) % (2 * span);
  return d <= span ? { s: d, dir: 1 } : { s: 2 * span - d, dir: -1 };
}
/* the span of line a train occupies: [head - length, head] when going forward, [head, head + length] going back */
export function trainSpan(head, dir, length) { return dir > 0 ? [head - length, head] : [head, head + length]; }
/* barriers are down when any train is within `before` m of the crossing on its approach or `after` m past it */
export function crossingClosed(cs, spans, before = 110, after = 45) { for (const [a, b] of spans) if (b > cs - before && a < cs + after) return true; return false; }

export const TRAIN = { speed: 24, coach: 22, coaches: 9, width: 3.2 };

/* The real network (assets/india/rails.json, tools/build_india_rails.mjs): edges are RailLines between nodes; a node with 3 or more edges is a junction, a node with a city is a station.
   route(a, b) is the shortest way by rail between two node ids as steps { edge, fwd }; routeLine joins the steps into one RailLine; trainRoutes picks the runs of the trains. */
export class RailNetwork {
  constructor(json) {
    this.nodes = json.nodes; this.edges = json.edges.map(e => { const l = new RailLine('e' + e.id, e.pts); l.a = e.a; l.b = e.b; l.edgeId = e.id; return l; });
    this.adj = new Map(this.nodes.map(n => [n.id, []])); for (const e of this.edges) { this.adj.get(e.a).push(e); this.adj.get(e.b).push(e); }
    this.stations = this.nodes.filter(n => n.city); this.byCity = new Map(this.stations.map(n => [n.city, n]));
  }
  route(a, b) {
    if (a === b) return []; const dist = new Map([[a, 0]]), prev = new Map(), open = new Set([a]);
    while (open.size) { let u = null; for (const n of open) if (u === null || dist.get(n) < dist.get(u)) u = n; open.delete(u); if (u === b) break;
      for (const e of this.adj.get(u)) { const v = e.a === u ? e.b : e.a, nd = dist.get(u) + e.len; if (!dist.has(v) || nd < dist.get(v)) { dist.set(v, nd); prev.set(v, { from: u, edge: e }); open.add(v); } } }
    if (!dist.has(b)) return null; const steps = []; for (let c = b; c !== a;) { const p = prev.get(c); steps.unshift({ edge: p.edge, fwd: p.edge.a === p.from }); c = p.from; } return steps;
  }
  routeLine(steps, id = 'route') {
    const pts = []; for (const st of steps) { const P = st.edge.pts, n = P.length / 2; for (let i = 0; i < n; i++) { const k = st.fwd ? i : n - 1 - i; if (pts.length && i === 0) continue; pts.push(P[k * 2], P[k * 2 + 1]); } }
    const l = new RailLine(id, pts); l.steps = steps; return l;
  }
  /* n deterministic runs between far-apart stations; each is a RailLine (its steps say which edges it uses) with the two terminal cities */
  trainRoutes(n = 36, minLen = 2500) {
    const out = [], S = this.stations; if (S.length < 2) return out; let k = 0, guard = 0;
    while (out.length < n && guard++ < n * 40) { const h = (i) => { let x = (k * 2654435761 + i * 40503 + 12345) >>> 0; x = (x ^ (x >>> 15)) >>> 0; x = Math.imul(x, 2246822519) >>> 0; x = (x ^ (x >>> 13)) >>> 0; return x / 4294967296; }; k++;
      const a = S[Math.floor(h(1) * S.length)], b = S[Math.floor(h(2) * S.length)]; if (a === b) continue; const steps = this.route(a.id, b.id); if (!steps || !steps.length) continue; const ln = this.routeLine(steps, 'run' + out.length); if (ln.len < minLen) continue; ln.from = a.city; ln.to = b.city; out.push(ln); }
    return out;
  }
}
