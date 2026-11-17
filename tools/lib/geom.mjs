/* Small 2D geometry helpers for the city pipeline (build time and validation). Points are flat arrays [x, z, x, z, ...] in local metres (x east, z south). Pure. */

export const r1 = v => Math.round(v * 10) / 10;
/* signed area by the shoelace formula in (x, z): positive = counter-clockwise in the pack's convention (see docs/CITY_PACK.md section 5) */
export function area(p) { let a = 0; const n = p.length; for (let i = 0, j = n - 2; i < n; j = i, i += 2) a += p[j] * p[i + 1] - p[i] * p[j + 1]; return a / 2; }
export function centroid(p) {
  const n = p.length / 2; let a = 0, cx = 0, cz = 0;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { const f = p[j] * p[i + 1] - p[i] * p[j + 1]; a += f; cx += (p[j] + p[i]) * f; cz += (p[j + 1] + p[i + 1]) * f; }
  if (Math.abs(a) < 1e-9) { let sx = 0, sz = 0; for (let i = 0; i < p.length; i += 2) { sx += p[i]; sz += p[i + 1]; } return [sx / n, sz / n]; }
  return [cx / (3 * a), cz / (3 * a)];
}
export function bbox(p) { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (let i = 0; i < p.length; i += 2) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < z0) z0 = p[i + 1]; if (p[i + 1] > z1) z1 = p[i + 1]; } return [x0, z0, x1, z1]; }
export function pointInRing(x, z, p) {
  let c = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { const xi = p[i], zi = p[i + 1], xj = p[j], zj = p[j + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c;
}
export function lineLength(p) { let l = 0; for (let i = 2; i < p.length; i += 2) l += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return l; }

/* Douglas-Peucker on an open polyline (keeps the ends); for a closed ring pass keepMin = 3 points */
export function simplify(p, eps, keepMin = 2) {
  const n = p.length / 2; if (n <= keepMin) return Array.from(p);
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1; const st = [[0, n - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = -1, mi = -1; const ax = p[a * 2], az = p[a * 2 + 1], bx = p[b * 2], bz = p[b * 2 + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    for (let i = a + 1; i < b; i++) { const px = p[i * 2], pz = p[i * 2 + 1]; let d; if (l2 === 0) d = Math.hypot(px - ax, pz - az); else { const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)); d = Math.hypot(px - ax - t * dx, pz - az - t * dz); } if (d > md) { md = d; mi = i; } }
    if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(p[i * 2], p[i * 2 + 1]); return out;
}
/* a closed ring: simplify, never below 3 points; returns a new array */
export function simplifyRing(p, eps) {
  if (p.length / 2 <= 4) return Array.from(p);
  // split at the two farthest-apart vertices so the closing point is not special
  const n = p.length / 2; let bi = 0, bd = -1; for (let i = 1; i < n; i++) { const d = Math.hypot(p[i * 2] - p[0], p[i * 2 + 1] - p[1]); if (d > bd) { bd = d; bi = i; } }
  const a = Array.from(p.slice ? p.slice(0, bi * 2 + 2) : p), b = []; for (let i = bi; i < n; i++) b.push(p[i * 2], p[i * 2 + 1]); b.push(p[0], p[1]);
  const sa = simplify(a, eps), sb = simplify(b, eps), out = sa.slice(0, -2).concat(sb.slice(0, -2)); return out.length >= 6 ? out : Array.from(p);
}

/* Sutherland-Hodgman clip of a ring to the rectangle [x0, x1] x [z0, z1]. Returns a flat ring (possibly empty). Concave input may produce edges along the rectangle edge: fine for filling. */
export function clipRing(p, x0, z0, x1, z1) {
  let pts = []; for (let i = 0; i < p.length; i += 2) pts.push([p[i], p[i + 1]]);
  const edges = [[0, x0, 1], [0, x1, -1], [1, z0, 1], [1, z1, -1]];
  for (const [ax, v, s] of edges) {
    const out = [], inside = q => (q[ax] - v) * s >= 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) { const t = (v - a[ax]) / (b[ax] - a[ax]); out.push(ax === 0 ? [v, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), v]); }
    }
    pts = out; if (!pts.length) return [];
  }
  const o = []; for (const q of pts) o.push(q[0], q[1]); return o;
}
/* split an open polyline at the lines x = k * size and z = k * size; returns [{ tx, tz, pts, clipA, clipB }] pieces in order */
export function splitLine(p, size) {
  const pieces = []; let cur = null;
  const cross = (ts, a, d) => { if (d === 0) return; const lo = Math.min(a, a + d), hi = Math.max(a, a + d); for (let k = Math.floor(lo / size) + 1; k * size < hi; k++) ts.push((k * size - a) / d); };
  for (let i = 0; i + 3 < p.length; i += 2) {
    const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, ts = [0, 1]; cross(ts, ax, dx); cross(ts, az, dz); ts.sort((u, v) => u - v);
    for (let s = 0; s + 1 < ts.length; s++) {
      const t0 = ts[s], t1 = ts[s + 1]; if (t1 - t0 < 1e-9) continue;
      const x0 = ax + dx * t0, z0 = az + dz * t0, x1 = ax + dx * t1, z1 = az + dz * t1, tx = Math.floor((x0 + x1) / 2 / size), tz = Math.floor((z0 + z1) / 2 / size);
      if (!cur || cur.tx !== tx || cur.tz !== tz) { if (cur) cur.clipB = true; cur = { tx, tz, pts: [x0, z0], clipA: pieces.length > 0, clipB: false }; pieces.push(cur); }
      cur.pts.push(x1, z1);
    }
  }
  return pieces;
}

/* does a ring cross itself? (proper crossings only, O(n^2) with a bbox guard; rings above maxN points are sampled by the caller) */
export function selfIntersects(p) {
  const n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const a = i, b = (i + 1) % n;
    for (let j = i + 2; j < n; j++) {
      const c = j, d = (j + 1) % n; if (d === a || c === b) continue;
      if (segCross(p[a * 2], p[a * 2 + 1], p[b * 2], p[b * 2 + 1], p[c * 2], p[c * 2 + 1], p[d * 2], p[d * 2 + 1])) return true;
    }
  } return false;
}
function orient(ax, az, bx, bz, cx, cz) { const v = (bx - ax) * (cz - az) - (bz - az) * (cx - ax); return v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0; }
export function segCross(ax, az, bx, bz, cx, cz, dx, dz) { const o1 = orient(ax, az, bx, bz, cx, cz), o2 = orient(ax, az, bx, bz, dx, dz), o3 = orient(cx, cz, dx, dz, ax, az), o4 = orient(cx, cz, dx, dz, bx, bz); return o1 * o2 < 0 && o3 * o4 < 0; }

/* a polygon (list of rings, the first the boundary) with a coarse raster so that millions of point-in-polygon tests are cheap */
export class PolyMask {
  constructor(rings, cell = 250) {
    this.rings = rings; this.cell = cell; const bb = rings.map(bbox); this.bb = [Math.min(...bb.map(b => b[0])), Math.min(...bb.map(b => b[1])), Math.max(...bb.map(b => b[2])), Math.max(...bb.map(b => b[3]))];
    this.nx = Math.ceil((this.bb[2] - this.bb[0]) / cell) + 1; this.nz = Math.ceil((this.bb[3] - this.bb[1]) / cell) + 1; this.g = new Uint8Array(this.nx * this.nz); // 0 outside, 1 inside, 2 boundary
    for (const r of rings) for (let i = 0; i < r.length; i += 2) { const j = (i + 2) % r.length, x0 = Math.min(r[i], r[j]), x1 = Math.max(r[i], r[j]), z0 = Math.min(r[i + 1], r[j + 1]), z1 = Math.max(r[i + 1], r[j + 1]);
      for (let cx = Math.floor((x0 - this.bb[0]) / cell); cx <= Math.floor((x1 - this.bb[0]) / cell); cx++) for (let cz = Math.floor((z0 - this.bb[1]) / cell); cz <= Math.floor((z1 - this.bb[1]) / cell); cz++) this.g[cz * this.nx + cx] = 2; }
    for (let cz = 0; cz < this.nz; cz++) for (let cx = 0; cx < this.nx; cx++) if (!this.g[cz * this.nx + cx]) this.g[cz * this.nx + cx] = this._exact(this.bb[0] + (cx + .5) * cell, this.bb[1] + (cz + .5) * cell) ? 1 : 0;
  }
  _exact(x, z) { let c = false; for (const r of this.rings) if (pointInRing(x, z, r)) c = !c; return c; }
  has(x, z) {
    if (x < this.bb[0] || x > this.bb[2] || z < this.bb[1] || z > this.bb[3]) return false;
    const v = this.g[Math.floor((z - this.bb[1]) / this.cell) * this.nx + Math.floor((x - this.bb[0]) / this.cell)]; return v === 2 ? this._exact(x, z) : v === 1;
  }
}
/* join open ways (flat arrays) into rings by matching end points (exact, as OSM shares nodes; here matched by key). ways: [{ pts: flat, a: endKeyA, b: endKeyB }] */
export function joinRings(ways) {
  const rings = [], open = ways.filter(w => w.pts.length >= 4).map(w => ({ ...w })), used = new Array(open.length).fill(false);
  const byEnd = new Map(); open.forEach((w, i) => { for (const k of [w.a, w.b]) { let l = byEnd.get(k); if (!l) byEnd.set(k, l = []); l.push(i); } });
  for (let i = 0; i < open.length; i++) {
    if (used[i]) continue; used[i] = true; let pts = open[i].pts.slice(), head = open[i].a, tail = open[i].b, guard = 0;
    while (head !== tail && guard++ < 10000) {
      const cand = (byEnd.get(tail) || []).find(j => !used[j]); if (cand === undefined) break; used[cand] = true; const w = open[cand];
      if (w.a === tail) { for (let k = 2; k < w.pts.length; k++) pts.push(w.pts[k]); tail = w.b; } else { for (let k = w.pts.length - 4; k >= 0; k -= 2) pts.push(w.pts[k], w.pts[k + 1]); tail = w.a; }
    }
    if (head === tail && pts.length >= 8) { pts = pts.slice(0, -2); rings.push(pts); }
  }
  return rings;
}
