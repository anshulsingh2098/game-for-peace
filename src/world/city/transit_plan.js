/* Delhi Metro, the plan (package D6): everything about the lines that needs no three.js, so tools/selftest.mjs can test it. From `transit.json` (docs/DELHI_TRANSIT.md) it makes, per route (one direction of one line):
   the track resampled every 8 m, the height of the rail over the ground along it (a profile, not data: elevated 11.5 m, at grade 0.3 m, underground -11 m, never steeper than 4 %), the timetable (accelerate, cruise, brake,
   dwell at every stop) and where the stations are along it. Coordinates are the pack frame (metres, x east, z south). Heights are rail-top over the ground (the city ground is flat). The look and the figures
   of SPEC are written from general knowledge, not measured (docs/DELHI_TRANSIT.md section 9). */

export const RAIL_H = 11.5, AT_GRADE_H = 0.3, UG_H = -11, MAXGRADE = 0.04, STEP = 8, PIER_SPACE = 28, GIRDER = 2.0;
export const DWELL = 25, TURN = 120, PEAK_HEADWAY = 240, ACC = 0.85, BRAKE = 0.95, CAR_L = 21.6, CAR_GAP = 0.45, MIN_RUN = 250;
/* per line: cars per train (assumed, section 3.4 of DELHI_TRANSIT says 4, 6 or 8), top speed (m/s), body width, third rail instead of overhead */
export const SPEC = {
  red: { cars: 6, vmax: 22.2, w: 3.2 }, yellow: { cars: 8, vmax: 22.2, w: 3.2 }, blue: { cars: 8, vmax: 22.2, w: 3.2 }, green: { cars: 4, vmax: 22.2, w: 2.9 }, violet: { cars: 6, vmax: 22.2, w: 2.9 },
  pink: { cars: 6, vmax: 25, w: 2.9 }, magenta: { cars: 6, vmax: 25, w: 2.9 }, grey: { cars: 4, vmax: 22.2, w: 2.9 }, airport: { cars: 6, vmax: 27.8, w: 2.9 }, aqua: { cars: 4, vmax: 22.2, w: 2.9 }, rapid: { cars: 3, vmax: 22.2, w: 2.9, third: true },
};
export const specOf = id => SPEC[id] || { cars: 6, vmax: 22.2, w: 3.0 };
export const platformLen = id => specOf(id).cars * CAR_L + 10;

export function hexRgb(h) { const n = parseInt((h || '#888888').replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
/* aqua and rapid have an OSM colour name instead of a hex: transit.json carries the hex chosen */
export const lineColour = line => (/^#/.test(line.colour) ? line.colour : '#00a3ad');

/* classes per vertex from the grade runs ([[vertex, 'e'|'g'|'u'], ...]); runs shorter than MIN_RUN metres (a mapping blip, a short underpass) take the class of the longer neighbour */
export function vertexClasses(nv, vc, grades) {
  const cls = new Array(nv).fill('g'), g = grades && grades.length ? grades : [[0, 'g']];
  for (let k = 0; k < g.length; k++) { const a = g[k][0], b = k + 1 < g.length ? g[k + 1][0] : nv; for (let i = a; i < b && i < nv; i++) cls[i] = g[k][1]; }
  for (let pass = 0; pass < 6; pass++) {
    const runs = []; for (let i = 0; i < nv; i++) { const r = runs[runs.length - 1]; if (r && r.c === cls[i]) r.i1 = i; else runs.push({ c: cls[i], i0: i, i1: i }); }
    let changed = false; for (let k = 1; k + 1 < runs.length; k++) { const r = runs[k], len = vc[r.i1] - vc[r.i0]; if (len >= MIN_RUN) continue; const A = runs[k - 1], B = runs[k + 1], la = vc[A.i1] - vc[A.i0], lb = vc[B.i1] - vc[B.i0], c = la >= lb ? A.c : B.c; if (c !== r.c) { for (let i = r.i0; i <= r.i1; i++) cls[i] = c; changed = true; } }
    if (!changed) break;
  } return cls;
}
export const targetH = c => (c === 'e' ? RAIL_H : c === 'u' ? UG_H : AT_GRADE_H);

/* one route resampled: R.x, R.z (Float64), R.s (metres along), R.h (rail height), R.cls ('e' 'g' 'u' per sample), R.stops [{ id, s, i }]. `pins` ([{ s, half, h }]) force the height near a station. */
export function planRoute(line, route, pins = []) {
  const P = route.path, nv = P.length / 2, vc = new Float64Array(nv); for (let i = 1; i < nv; i++) vc[i] = vc[i - 1] + Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]);
  const vcls = vertexClasses(nv, vc, route.grades), xs = [], zs = [], ss = [], cl = [];
  for (let i = 0; i < nv - 1; i++) { const L = vc[i + 1] - vc[i], n = Math.max(1, Math.ceil(L / STEP)); for (let j = 0; j < n; j++) { const f = j / n; xs.push(P[i * 2] + (P[i * 2 + 2] - P[i * 2]) * f); zs.push(P[i * 2 + 1] + (P[i * 2 + 3] - P[i * 2 + 1]) * f); ss.push(vc[i] + L * f); cl.push(vcls[i]); } }
  xs.push(P[nv * 2 - 2]); zs.push(P[nv * 2 - 1]); ss.push(vc[nv - 1]); cl.push(vcls[nv - 1]);
  const n = xs.length, T = new Float64Array(n), h = new Float64Array(n); for (let i = 0; i < n; i++) T[i] = targetH(cl[i]);
  for (const p of pins) for (let i = 0; i < n; i++) if (Math.abs(ss[i] - p.s) <= p.half) { T[i] = p.h; cl[i] = p.h > 6 ? 'e' : p.h < -3 ? 'u' : 'g'; }
  h[0] = T[0]; for (let i = 1; i < n; i++) { const d = (ss[i] - ss[i - 1]) * MAXGRADE; h[i] = Math.max(h[i - 1] - d, Math.min(h[i - 1] + d, T[i])); }
  for (let i = n - 2; i >= 0; i--) { const d = (ss[i + 1] - ss[i]) * MAXGRADE; h[i] = Math.max(h[i + 1] - d, Math.min(h[i + 1] + d, h[i])); }
  const R = { id: route.id, line: line.id, from: route.from, to: route.to, n, x: Float64Array.from(xs), z: Float64Array.from(zs), s: Float64Array.from(ss), h, cls: cl, len: vc[nv - 1], stops: [] };
  R.tx = new Float32Array(n); R.tz = new Float32Array(n); for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = R.x[b] - R.x[a], dz = R.z[b] - R.z[a], L = Math.hypot(dx, dz) || 1; R.tx[i] = dx / L; R.tz[i] = dz / L; }       // tangent at every sample
  Object.assign(R, Rproto); R.stops = route.stops.map(([id, s]) => ({ id, s, i: R.indexAt(s) })); return R;
}
const Rproto = {
  /* sample index i with s[i] <= s < s[i+1] */
  indexAt(s) { const S = this.s; let lo = 0, hi = this.n - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (S[m] <= s) lo = m; else hi = m - 1; } return lo; },
  /* position, rail height and direction (tx, tz unit, slope) at s (clamped) into `o` */
  at(s, o = {}) {
    const i = this.indexAt(Math.max(0, Math.min(this.len, s))), j = i + 1, d = this.s[j] - this.s[i] || 1, inside = s >= 0 && s <= this.len, f0 = (s - this.s[i]) / d, f = inside ? Math.max(0, Math.min(1, f0)) : f0, dx = this.x[j] - this.x[i], dz = this.z[j] - this.z[i], L = Math.hypot(dx, dz) || 1;       // beyond the ends the track goes straight on (a train standing at a terminus)
    o.x = this.x[i] + dx * f; o.z = this.z[i] + dz * f; o.h = this.h[i] + (this.h[j] - this.h[i]) * (inside ? f : f0 < 0 ? 0 : 1); o.tx = dx / L; o.tz = dz / L; o.slope = (this.h[j] - this.h[i]) / d; o.cls = this.cls[f > 0.5 ? j : i]; return o;
  },
};

/* the timetable of one route: legs between consecutive stops (trapezoid speed), dwell at each, turnback at the end.
   tt.state(tau) -> { s, v, stop } (stop = index while standing at a stop, else -1) for tau in [0, tt.T); tt.period = T + TURN; trains are spaced evenly by tt.headway. */
export function buildTimetable(R, vmax, headway0 = PEAK_HEADWAY) {
  const st = R.stops, legs = []; let t = 0;
  for (let k = 0; k + 1 < st.length; k++) {
    const d = Math.max(1, st[k + 1].s - st[k].s), dacc = vmax * vmax / (2 * ACC), dbr = vmax * vmax / (2 * BRAKE); let vp = vmax, ta, tb, tc;
    if (dacc + dbr <= d) { ta = vmax / ACC; tb = vmax / BRAKE; tc = (d - dacc - dbr) / vmax; } else { vp = Math.sqrt(2 * d / (1 / ACC + 1 / BRAKE)); ta = vp / ACC; tb = vp / BRAKE; tc = 0; }
    legs.push({ k, s0: st[k].s, d, vp, ta, tc, tb, tl: ta + tc + tb, t0: t + DWELL }); t += DWELL + ta + tc + tb;
  }
  const T = t + DWELL, period = T + TURN, n = Math.max(1, Math.round(period / headway0)), headway = period / n;
  const tt = { legs, T, period, n, headway, arrive: [0, ...legs.map(l => l.t0 + l.tl)], depart: [DWELL, ...legs.map(l => l.t0 + l.tl + DWELL)].slice(0, st.length) };
  tt.arrive[0] = 0;
  tt.state = tau => {
    if (tau >= T || !legs.length) return null; if (tau < legs[0].t0) return { s: st[0].s, v: 0, stop: 0 };
    let lo = 0, hi = legs.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (legs[m].t0 <= tau) lo = m; else hi = m - 1; }
    const L = legs[lo], u = tau - L.t0; if (u >= L.tl) return { s: L.s0 + L.d, v: 0, stop: L.k + 1 };
    let s, v; if (u < L.ta) { v = ACC * u; s = 0.5 * ACC * u * u; } else if (u < L.ta + L.tc) { v = L.vp; s = L.vp * L.vp / (2 * ACC) + L.vp * (u - L.ta); } else { const w = L.tl - u; v = BRAKE * w; s = L.d - 0.5 * BRAKE * w * w; }
    return { s: L.s0 + s, v, stop: -1 };
  };
  return tt;
}
/* seconds until the next train of a route stands at stop k (trains are spaced by tt.headway on a cycle of tt.period) */
export function nextArrival(tt, k, t) { const a = tt.arrive[k] || 0, h = tt.headway; return (((a - t) % h) + h) % h; }

/* the whole network: routes resampled with the station heights pinned (a station sits flat at its grade for its platform length), and the stations with the routes that call there.
   Returns { routes: [R], lineOf: Map(id -> line), stations: Map(id -> { st, calls: [{ R, k, s }] }), byKey } */
export function buildNetwork(transit) {
  const byKey = new Map(); for (const s of transit.metro.stations) byKey.set(s.id, s); for (const s of transit.metro.stations) if (!byKey.has(s.code)) byKey.set(s.code, s);
  const routes = [], lineOf = new Map(), stations = new Map();
  for (const line of transit.metro.lines) {
    lineOf.set(line.id, line);
    for (const route of line.routes) {
      const pins = []; for (const [id, s] of route.stops) { const st = byKey.get(id), per = st && st.per.find(p => p.line === line.id); if (per) pins.push({ s, half: platformLen(line.id) / 2 + 25, h: pinHeight(kitOf(per)) }); }
      routes.push(planRoute(line, route, pins));
    }
  }
  for (const R of routes) for (let k = 0; k < R.stops.length; k++) { const st = byKey.get(R.stops[k].id); if (!st) continue; let e = stations.get(st.id); if (!e) stations.set(st.id, e = { st, calls: [] }); e.calls.push({ R, k, s: R.stops[k].s }); }
  return { routes, lineOf, stations, byKey };
}
/* the station kit of a line at a station: 'elevated' | 'ground' | 'underground' (Wikipedia grade, per[]) */
export function kitOf(per) { const g = per && per.grade; return g === 'underground' ? 'underground' : g === 'at-grade' ? 'ground' : 'elevated'; }
export const pinHeight = kit => (kit === 'underground' ? UG_H : kit === 'ground' ? AT_GRADE_H : RAIL_H);
