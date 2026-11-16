/* Builds assets/india/rails.json: the real railway network of India as a graph in game metres (1:100, the same space as skeleton.json).
   Source: Natural Earth "Railroads" 1:10m (public domain), downloaded to data/raw/rail/ne_10m_railroads.geojson (see docs/OPEN_DATA.md). Run: node tools/build_india_rails.mjs
   Steps: project to game metres, keep lines near Indian cities, simplify, join pieces into a graph (ends within 40 m snap together, an end that lands on the middle of another line splits it),
   put a station on the line nearest each city, join chains between junctions, smooth the corners, keep the parts that connect at least two stations.
   Output: { version, nodes: [{ id, x, z, city?, deg }], edges: [{ id, a, b, len, pts: [x, z, ...] }], provenance }. A node with deg 3 or more is a junction. */
import { readFileSync, writeFileSync } from 'node:fs';
import { toGame, CITIES, GAME_SCALE } from '../src/world/india_network.js';

const src = new URL('../data/raw/rail/ne_10m_railroads.geojson', import.meta.url), out = new URL('../assets/india/rails.json', import.meta.url);
const gj = JSON.parse(readFileSync(src, 'utf8')), SNAP = 40, NEAR_CITY = 1200, STATION_MAX = 300, TOL = 18;
const cities = CITIES.map(c => ({ id: c.id, tier: c.tier, ...toGame(c.lat, c.lon, GAME_SCALE) }));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/* 1. polylines in game metres, near India */
let lines = [];
for (const f of gj.features) {
  const g = f.geometry, parts = g.type === 'MultiLineString' ? g.coordinates : g.type === 'LineString' ? [g.coordinates] : []; for (const p of parts) {
    if (!p.some(([x, y]) => x > 66 && x < 99 && y > 5 && y < 37)) continue; const pts = p.map(([x, y]) => { const q = toGame(y, x, GAME_SCALE); return [q.x, q.z]; }); lines.push(pts); }
}
const nearCity = (x, z) => cities.some(c => Math.hypot(c.x - x, c.z - z) < NEAR_CITY);
lines = lines.filter(l => l.some(([x, z]) => nearCity(x, z)));

/* 2. Douglas-Peucker simplification */
function dp(pts, tol) {
  if (pts.length < 3) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let m = -1, dm = 0; const ax = pts[a][0], az = pts[a][1], bx = pts[b][0], bz = pts[b][1], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / L; if (d > dm) { dm = d; m = i; } } if (dm > tol && m > 0) { keep[m] = 1; st.push([a, m], [m, b]); } }
  return pts.filter((_, i) => keep[i]);
}
lines = lines.map(l => dp(l, TOL)).filter(l => l.length >= 2);

/* 3. graph: nodes by snapping the ends, T-junction splits */
const nodes = [], nodeAt = p => { for (const n of nodes) if (Math.hypot(n.x - p[0], n.z - p[1]) < SNAP) return n; const n = { id: nodes.length, x: p[0], z: p[1], city: null }; nodes.push(n); return n; };
/* split a line where another line's end lands on its middle */
const ends = lines.flatMap(l => [l[0], l[l.length - 1]]);
function splitAt(l, p) { let best = Infinity, bi = -1, bt = 0; for (let i = 0; i + 1 < l.length; i++) { const ax = l[i][0], az = l[i][1], dx = l[i + 1][0] - ax, dz = l[i + 1][1] - az, L2 = dx * dx + dz * dz || 1; let t = ((p[0] - ax) * dx + (p[1] - az) * dz) / L2; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(ax + dx * t - p[0], az + dz * t - p[1]); if (d < best) { best = d; bi = i; bt = t; } }
  if (best > SNAP || (bi === 0 && bt < 0.02) || (bi === l.length - 2 && bt > 0.98)) return null; const q = [l[bi][0] + (l[bi + 1][0] - l[bi][0]) * bt, l[bi][1] + (l[bi + 1][1] - l[bi][1]) * bt]; return [[...l.slice(0, bi + 1), q], [q, ...l.slice(bi + 1)]]; }
for (let pass = 0; pass < 3; pass++) { const next = []; for (const l of lines) { let cur = [l], did = true; while (did) { did = false; for (let ci = 0; ci < cur.length && !did; ci++) { const c = cur[ci]; for (const p of ends) { if (dist(p, c[0]) < SNAP || dist(p, c[c.length - 1]) < SNAP) continue; const sp = splitAt(c, p); if (sp) { cur.splice(ci, 1, ...sp); did = true; break; } } } } next.push(...cur); } lines = next; }
let edges = []; for (const l of lines) { const a = nodeAt(l[0]), b = nodeAt(l[l.length - 1]); if (a === b && l.length < 4) continue; edges.push({ a: a.id, b: b.id, pts: l.map(p => [p[0], p[1]]) }); }

/* 4. a station on the line nearest each city: split that edge at the nearest point */
function nearestOnEdge(e, x, z) { let best = Infinity, bi = 0, bt = 0; const P = e.pts; for (let i = 0; i + 1 < P.length; i++) { const ax = P[i][0], az = P[i][1], dx = P[i + 1][0] - ax, dz = P[i + 1][1] - az, L2 = dx * dx + dz * dz || 1; let t = ((x - ax) * dx + (z - az) * dz) / L2; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(ax + dx * t - x, az + dz * t - z); if (d < best) { best = d; bi = i; bt = t; } } return { d: best, i: bi, t: bt }; }
for (const c of [...cities].sort((u, v) => ['metro', 'major', 'city', 'town'].indexOf(u.tier) - ['metro', 'major', 'city', 'town'].indexOf(v.tier))) {
  let best = null; for (const e of edges) { const r = nearestOnEdge(e, c.x, c.z); if (r.d < STATION_MAX && (!best || r.d < best.r.d)) best = { e, r }; } if (!best) continue;
  const { e, r } = best, P = e.pts, q = [P[r.i][0] + (P[r.i + 1][0] - P[r.i][0]) * r.t, P[r.i][1] + (P[r.i + 1][1] - P[r.i][1]) * r.t];
  const existing = nodes.find(n => Math.hypot(n.x - q[0], n.z - q[1]) < 90); if (existing) { if (!existing.city) existing.city = c.id; continue; }
  const n = { id: nodes.length, x: q[0], z: q[1], city: c.id }; nodes.push(n); const e2 = { a: n.id, b: e.b, pts: [q, ...P.slice(r.i + 1)] }; e.pts = [...P.slice(0, r.i + 1), q]; e.b = n.id; edges.push(e2);
}

/* 5. keep the components that join two or more stations */
const adj = new Map(); for (const n of nodes) adj.set(n.id, []); edges.forEach((e, i) => { adj.get(e.a).push(i); adj.get(e.b).push(i); });
const comp = new Map(); let cc = 0; for (const n of nodes) { if (comp.has(n.id)) continue; const st = [n.id]; comp.set(n.id, cc); while (st.length) { const u = st.pop(); for (const i of adj.get(u)) for (const v of [edges[i].a, edges[i].b]) if (!comp.has(v)) { comp.set(v, cc); st.push(v); } } cc++; }
const stationsIn = new Map(); for (const n of nodes) if (n.city) stationsIn.set(comp.get(n.id), (stationsIn.get(comp.get(n.id)) || 0) + 1);
edges = edges.filter(e => (stationsIn.get(comp.get(e.a)) || 0) >= 2);

/* 6. join chains through nodes of degree 2 that are not stations */
for (let changed = true; changed;) { changed = false; const deg = new Map(); for (const e of edges) { deg.set(e.a, (deg.get(e.a) || 0) + 1); deg.set(e.b, (deg.get(e.b) || 0) + 1); }
  for (const n of nodes) { if (n.city || deg.get(n.id) !== 2) continue; const inc = edges.filter(e => e.a === n.id || e.b === n.id); if (inc.length !== 2 || inc[0] === inc[1]) continue; const [e1, e2] = inc; const p1 = e1.b === n.id ? e1.pts : [...e1.pts].reverse(), o1 = e1.b === n.id ? e1.a : e1.b, p2 = e2.a === n.id ? e2.pts : [...e2.pts].reverse(), o2 = e2.a === n.id ? e2.b : e2.a; if (o1 === o2 && o1 === n.id) continue;
    edges = edges.filter(e => e !== e1 && e !== e2); edges.push({ a: o1, b: o2, pts: [...p1, ...p2.slice(1)] }); changed = true; break; } }

/* 7. smooth the corners (Chaikin, twice, ends fixed), then number the survivors */
const chaikin = pts => { let P = pts; for (let k = 0; k < 2; k++) { const Q = [P[0]]; for (let i = 0; i + 1 < P.length; i++) { const a = P[i], b = P[i + 1]; Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } Q.push(P[P.length - 1]); P = Q; } return P; };
const used = new Set(edges.flatMap(e => [e.a, e.b])), remap = new Map(); const outNodes = []; for (const n of nodes) if (used.has(n.id)) { remap.set(n.id, outNodes.length); outNodes.push({ id: outNodes.length, x: +n.x.toFixed(1), z: +n.z.toFixed(1), city: n.city, deg: 0 }); }
const outEdges = edges.map((e, i) => { const P = chaikin(e.pts); let len = 0; for (let k = 1; k < P.length; k++) len += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); const a = remap.get(e.a), b = remap.get(e.b); outNodes[a].deg++; outNodes[b].deg++; return { id: i, a, b, len: Math.round(len), pts: P.flatMap(p => [+p[0].toFixed(1), +p[1].toFixed(1)]) }; });
const stations = outNodes.filter(n => n.city).length, junctions = outNodes.filter(n => n.deg >= 3).length, total = outEdges.reduce((s, e) => s + e.len, 0);
writeFileSync(out, JSON.stringify({ version: 1, scale: GAME_SCALE, nodes: outNodes, edges: outEdges, provenance: 'Railway lines: Natural Earth 1:10m Railroads, public domain (naturalearthdata.com), simplified and joined into a graph by tools/build_india_rails.mjs. Rough alignments, not surveyed track.' }));
console.log(`rails: ${outNodes.length} nodes (${stations} stations, ${junctions} junctions), ${outEdges.length} edges, ${(total / 1000 * GAME_SCALE / 1000 * 1000 / 1000).toFixed(0)} real thousand km?`, 'game metres total', total, 'real km', Math.round(total * GAME_SCALE / 1000), 'points', outEdges.reduce((s, e) => s + e.pts.length / 2, 0));
