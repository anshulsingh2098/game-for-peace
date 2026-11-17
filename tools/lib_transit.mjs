// Small pure helpers shared by tools/build_delhi_transit.mjs and tools/validate_transit.mjs.
export const TRANSIT_BUILDER_VERSION = 1;                           // bump when tools/build_delhi_transit.mjs changes what it writes (the self-test checks transit.json carries the current number)
export const R_EARTH = 6371008.8;                                   // metres (mean radius); the same equirectangular frame as docs/CITY_PACK.md
export const ORIGIN = { lat: 28.6139, lon: 77.2090 };               // Delhi pack origin (CITY_PACK manifest)
const KX = R_EARTH * Math.PI / 180 * Math.cos(ORIGIN.lat * Math.PI / 180), KZ = R_EARTH * Math.PI / 180;
export const project = (lat, lon) => [(lon - ORIGIN.lon) * KX, -(lat - ORIGIN.lat) * KZ];   // x east, z south (game convention z = -latitude)
export const unproject = (x, z) => [ORIGIN.lat - z / KZ, ORIGIN.lon + x / KX];
export const r1 = v => Math.round(v * 10) / 10;
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Distance from point p to the polyline pts (flat [x,z,...]); returns { d, s (metres along), i (segment) }. */
export function nearestOnPath(pts, p) {
  let best = { d: Infinity, s: 0, i: 0 }, acc = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i], az = pts[i + 1], bx = pts[i + 2], bz = pts[i + 3], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, L = Math.sqrt(L2);
    let t = L2 ? ((p[0] - ax) * dx + (p[1] - az) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(p[0] - (ax + t * dx), p[1] - (az + t * dz)); if (d < best.d) best = { d, s: acc + t * L, i: i / 2 };
    acc += L;
  }
  return best;
}
export function pathLength(pts) { let s = 0; for (let i = 0; i + 3 < pts.length; i += 2) s += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]); return s; }
/** Douglas-Peucker on [[x,z,tag]...] keeping every index in `keep` (grade changes, stations); tolerance in metres. */
export function simplify(P, tol, keep = new Set()) {
  const n = P.length; if (n < 3) return P.map((_, i) => i); const mark = new Uint8Array(n); mark[0] = mark[n - 1] = 1; for (const k of keep) if (k >= 0 && k < n) mark[k] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let md = -1, mi = -1; const A = P[a], B = P[b], dx = B[0] - A[0], dz = B[1] - A[1], L2 = dx * dx + dz * dz;
    for (let i = a + 1; i < b; i++) { let t = L2 ? ((P[i][0] - A[0]) * dx + (P[i][1] - A[1]) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(P[i][0] - (A[0] + t * dx), P[i][1] - (A[1] + t * dz)); if (d > md) { md = d; mi = i; } }
    if (md > tol) { mark[mi] = 1; stack.push([a, mi], [mi, b]); } else { for (let i = a + 1; i < b; i++) if (mark[i]) { stack.push([a, i], [i, b]); break; } }
  }
  const o = []; for (let i = 0; i < n; i++) if (mark[i]) o.push(i); return o;
}
/** Route through the track pieces of one OSM route relation (each piece [[x,z,grade]...]): build a graph of every piece vertex (consecutive vertices joined along a piece,
 * vertices of different pieces closer than `snap` m joined), snap each stop to its nearest vertex, and join consecutive stops by the shortest path. This does not depend on
 * the order of the relation's members (which is unreliable at junctions and crossovers). Returns { pts: [[x,z,grade]...], stopsAt: [index in pts of each stop], gaps: [metres of a straight jump where the graph was not connected] }. */
export function routeThrough(pieces, stops, snap = 2) {
  const V = []; for (const p of pieces) for (const v of p) V.push(v); const n = V.length, adj = Array.from({ length: n }, () => []);
  let o = 0; for (const p of pieces) { for (let i = 0; i + 1 < p.length; i++) { const w = dist(p[i], p[i + 1]); adj[o + i].push([o + i + 1, w]); adj[o + i + 1].push([o + i, w]); } o += p.length; }
  const cell = new Map(), key = (x, z) => Math.floor(x / 4) + ',' + Math.floor(z / 4);
  for (let i = 0; i < n; i++) { const k = key(V[i][0], V[i][1]); if (!cell.has(k)) cell.set(k, []); cell.get(k).push(i); }
  for (let i = 0; i < n; i++) { const cx = Math.floor(V[i][0] / 4), cz = Math.floor(V[i][1] / 4); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of cell.get((cx + a) + ',' + (cz + b)) || []) if (j > i && dist(V[i], V[j]) < snap) { adj[i].push([j, 0.01]); adj[j].push([i, 0.01]); } }
  const snapTo = p => { let b = -1, bd = Infinity; for (let i = 0; i < n; i++) { const d = dist(p, V[i]); if (d < bd) { bd = d; b = i; } } return b; };
  const seq = stops.map(snapTo), out = [], stopsAt = [], gaps = [];
  const sp = (a, b) => { // Dijkstra with a binary heap
    const D = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), h = [[0, a]]; D[a] = 0;
    const push = x => { h.push(x); let i = h.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (h[q][0] <= h[i][0]) break; [h[q], h[i]] = [h[i], h[q]]; i = q; } };
    const pop = () => { const t = h[0], l = h.pop(); if (h.length) { h[0] = l; let i = 0; for (;;) { let m = i; const L = 2 * i + 1, R = L + 1; if (L < h.length && h[L][0] < h[m][0]) m = L; if (R < h.length && h[R][0] < h[m][0]) m = R; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } } return t; };
    while (h.length) { const [d, u] = pop(); if (d > D[u]) continue; if (u === b) break; for (const [v, w] of adj[u]) if (d + w < D[v]) { D[v] = d + w; prev[v] = u; push([D[v], v]); } }
    if (!isFinite(D[b])) return null; const path = []; for (let u = b; u >= 0; u = prev[u]) path.push(u); return path.reverse();
  };
  for (let k = 0; k < seq.length; k++) {
    if (k === 0) { out.push(V[seq[0]]); stopsAt.push(0); continue; }
    const path = sp(seq[k - 1], seq[k]);
    if (!path) { gaps.push(r1(dist(V[seq[k - 1]], V[seq[k]]))); out.push(V[seq[k]]); }
    else for (let q = 1; q < path.length; q++) { const v = V[path[q]]; if (dist(out[out.length - 1], v) > 0.05) out.push(v); }
    stopsAt.push(out.length - 1);
  }
  return { pts: out, stopsAt, gaps };
}
export const norm = s => (s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/metro station|metro|railway station|station/g, '').replace(/[^a-z0-9]+/g, '');
