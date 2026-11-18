/* Road paint, wear and medians for the Delhi city (Phase P2 of docs/DELHI_POLISH_PLAN.md), drawn into the tile's EXISTING merged meshes (the mark mesher for paint, the walk mesher for medians), so
   they add no draw calls:
     - stop lines and lane arrows on the approach lanes of signalled junctions (left-hand traffic: the approach lane is on the left of the direction of travel toward the junction);
     - speed breakers on residential streets (yellow and black bands across the carriageway; painted only, the car physics has flat ground);
     - wear on every kind of road: patches of repair, oil stains where cars wait at a signal, dirt along the edges;
     - medians between the two carriageways of a dual road (the pack draws these as two one-way streets with a grey void between): a kerbed, planted strip.
   Everything is deterministic from the street id and position, and bounded per tile. Pure geometry through the Mesher API (m.v, m.tri). */

/* colours as plain { r, g, b } in linear light (the same numbers THREE.Color(hex) gives), so this module needs no three.js and the self-test can run it */
const lin = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4, C = hex => ({ r: lin((hex >> 16 & 255) / 255), g: lin((hex >> 8 & 255) / 255), b: lin((hex & 255) / 255) }), mul = (c, k) => ({ r: c.r * k, g: c.g * k, b: c.b * k }), mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
const WHITE = C(0xe9e6da), YELLOW = C(0xd9b52a), BLACK = C(0x26282a), KERB = C(0xb4b0a6), SOIL = C(0x6b7d45), EDGE = C(0x6a5a48), OIL = C(0x232425);
const hash = n => { let h = (n | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const MARK_Y = 0.07, WEAR_Y = 0.06, MEDIAN_H = 0.12;
export const CAPS = { arrows: 120, breakers: 60, patches: 240, oil: 80, medians: 4000, dirt: 900 };

/* a flat quad (4 corner points [x, z], any order around) at height y */
function quad(m, X, Z, y, c, a, b, c2, d) {
  const v0 = m.v(X(a[0]), y, Z(a[1]), 0, 1, 0, c), v1 = m.v(X(b[0]), y, Z(b[1]), 0, 1, 0, c), v2 = m.v(X(c2[0]), y, Z(c2[1]), 0, 1, 0, c), v3 = m.v(X(d[0]), y, Z(d[1]), 0, 1, 0, c);
  m.tri(v0, v1, v2, 0, 1, 0); m.tri(v0, v2, v3, 0, 1, 0);
}
function tri3(m, X, Z, y, c, a, b, c2) { const v0 = m.v(X(a[0]), y, Z(a[1]), 0, 1, 0, c), v1 = m.v(X(b[0]), y, Z(b[1]), 0, 1, 0, c), v2 = m.v(X(c2[0]), y, Z(c2[1]), 0, 1, 0, c); m.tri(v0, v1, v2, 0, 1, 0); }
/* a rectangle: centre (cx, cz), tangent (tx, tz), lateral normal (nx, nz); extents along the tangent t0..t1 and across n0..n1 */
function rect(m, X, Z, y, c, cx, cz, tx, tz, nx, nz, t0, t1, n0, n1) {
  const P = (t, n) => [cx + tx * t + nx * n, cz + tz * t + nz * n]; quad(m, X, Z, y, c, P(t0, n0), P(t1, n0), P(t1, n1), P(t0, n1));
}
/* the point `dist` metres along a polyline from its start (or from its end), with the unit tangent pointing along the walk */
function along(pts, fromEnd, dist) {
  const n = pts.length / 2; let left = dist;
  for (let k = 0; k + 1 < n; k++) { const i = fromEnd ? n - 1 - k : k, j = fromEnd ? i - 1 : i + 1, dx = pts[j * 2] - pts[i * 2], dz = pts[j * 2 + 1] - pts[i * 2 + 1], L = Math.hypot(dx, dz); if (L < 1e-6) continue;
    if (left <= L) return { x: pts[i * 2] + dx / L * left, z: pts[i * 2 + 1] + dz / L * left, tx: dx / L, tz: dz / L }; left -= L; }
  return null;
}
const plen = pts => { let L = 0; for (let i = 2; i < pts.length; i += 2) L += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); return L; };

/* o: { m (mark mesher), X, Z (world to tile-local), gy, seed, counts (shared caps counters) }.
   s: one street piece { id, pts, hw, w, cls, oneway (-1, 0, 1: b to a, both, a to b), lanes, clip, endFlags: [flags of the node at the start, at the end] (1 signal, 2 crossing), realEnds: [bool, bool] } */
export function approachMarks(s, o) {
  const { m, X, Z, gy, counts } = o, L = plen(s.pts); if (L < 24 || s.w < 5.5) return;
  for (const end of [0, 1]) {
    if (!s.realEnds[end] || !(s.endFlags[end] & 1)) continue;                                      // only at a real, signalled junction
    if (end === 1 ? s.oneway < 0 : s.oneway > 0) continue;                                         // no traffic arrives here
    const two = s.oneway === 0, hw = s.hw, e = along(s.pts, !!end, 0); if (!e) continue;
    const q = along(s.pts, !!end, 7.6); if (!q) continue;                                          // the stop line: 7.6 m back from the node, just before the zebra crossing (5 m back, 1.4 m either side)
    const tx = -q.tx, tz = -q.tz, lx = tz, lz = -tx, y = gy + MARK_Y;                              // travel direction toward the node, and its left
    const nApp = Math.max(1, two ? Math.floor((s.lanes || 2) / 2) : (s.lanes || 1)), a0 = two ? 0.2 : -hw + 0.15, a1 = hw - 0.15, laneW = (a1 - a0) / nApp;
    rect(m, X, Z, y, WHITE, q.x, q.z, tx, tz, lx, lz, -0.2, 0.2, a0, a1);                          // the stop line across the approach lanes (offsets are measured to the left of the travel direction; for one-way the range starts at the right edge)
    if (L > 34 && counts.arrows < CAPS.arrows) for (let k = 0; k < nApp; k++) {
      const c = along(s.pts, !!end, 16); if (!c) break; const off = two ? a0 + laneW * (k + 0.5) : -hw + 0.15 + laneW * (k + 0.5), px = c.x, pz = c.z;   // an arrow 16 m back in each approach lane: a stem and a head
      rect(m, X, Z, y, WHITE, px, pz, tx, tz, lx, lz, -1.2, 0.5, off - 0.12, off + 0.12); tri3(m, X, Z, y, WHITE, [px + tx * 1.9 + lx * off, pz + tz * 1.9 + lz * off], [px + tx * 0.4 + lx * (off - 0.5), pz + tz * 0.4 + lz * (off - 0.5)], [px + tx * 0.4 + lx * (off + 0.5), pz + tz * 0.4 + lz * (off + 0.5)]); counts.arrows++;
    }
    /* oil: the dark stain where the first cars wait, one per approach lane, some of them */
    for (let k = 0; k < nApp && counts.oil < CAPS.oil; k++) if (hash(s.id * 31 + end * 7 + k) < 0.7) { const c = along(s.pts, !!end, 9.5 + hash(s.id + k) * 2), off = (two ? a0 + laneW * (k + 0.5) : -hw + 0.15 + laneW * (k + 0.5)) + (hash(s.id * 5 + k) - 0.5) * 0.6; if (!c) continue;
      const r = 0.45 + hash(s.id * 13 + k) * 0.45, px = c.x + lx * off, pz = c.z + lz * off, col = OIL; for (let a = 0; a < 6; a++) { const a0r = a / 6 * 6.2832, a1r = (a + 1) / 6 * 6.2832; tri3(m, X, Z, gy + WEAR_Y, col, [px, pz], [px + Math.cos(a0r) * r * 1.5, pz + Math.sin(a0r) * r], [px + Math.cos(a1r) * r * 1.5, pz + Math.sin(a1r) * r]); } counts.oil++; }
  }
}

/* yellow and black bands across a residential street, every 70 to 110 m, none near a junction */
export function speedBreakers(s, o) {
  if (s.cls !== 'residential' || s.w < 4) return; const { m, X, Z, gy, counts } = o, L = plen(s.pts); if (L < 45) return; let sd = 22 + hash(s.id * 17) * 30, k = 0;
  while (sd < L - 22 && counts.breakers < CAPS.breakers) {
    const c = along(s.pts, false, sd); if (c) { const nx = -c.tz, nz = c.tx, hw = s.hw - 0.15; for (let b = 0; b < 6; b++) rect(m, X, Z, gy + MARK_Y, b & 1 ? BLACK : YELLOW, c.x, c.z, c.tx, c.tz, nx, nz, -1.8 + b * 0.6, -1.2 + b * 0.6, -hw, hw); counts.breakers++; }
    sd += 70 + hash(s.id * 29 + ++k) * 40;
  }
}

/* wear: patches of repair (a lighter or darker rectangle of asphalt) and dirt along both edges. rc: the road's colour */
export function wear(s, o, rc) {
  const { m, X, Z, gy, counts } = o, L = plen(s.pts); if (L < 8) return; const hw = s.hw, y = gy + WEAR_Y;
  for (let sd = 5 + hash(s.id * 3) * 18, k = 0; sd < L - 5 && counts.patches < CAPS.patches; sd += 26 + hash(s.id * 11 + ++k) * 34) {
    const c = along(s.pts, false, sd); if (!c) continue; const nx = -c.tz, nz = c.tx, off = (hash(s.id * 7 + k) - 0.5) * (hw * 1.5), len = 1.5 + hash(s.id * 19 + k) * 2.4, wid = 0.7 + hash(s.id * 23 + k) * 1.1, light = hash(s.id * 37 + k) < 0.45;
    const col = mul(rc, light ? 1.22 : 0.74); rect(m, X, Z, y, col, c.x, c.z, c.tx, c.tz, nx, nz, -len / 2, len / 2, off - wid / 2, off + wid / 2); counts.patches++;
  }
  if ((s.cls === 'tertiary' || s.cls === 'secondary') && counts.dirt < CAPS.dirt) for (const side of [1, -1]) {                  // dirt and grit collected along the kerb of the bigger streets (12 m pieces: about 1/8 of the cost of drawing it everywhere)
    let prev = null; const col = mix(rc, EDGE, 0.4); for (let sd = 0; sd <= L && counts.dirt < CAPS.dirt; sd += 12) {
      const c = along(s.pts, false, Math.min(sd, L - 0.01)); if (!c) continue; const nx = -c.tz * side, nz = c.tx * side, a = [c.x + nx * (hw - 0.45), c.z + nz * (hw - 0.45)], b = [c.x + nx * hw, c.z + nz * hw];
      if (prev) { quad(m, X, Z, y, col, prev[0], prev[1], b, a); counts.dirt++; } prev = [a, b]; }
  }
}

/* medians: pieces = [{ id, pts, hw, oneway, cls }] of one tile (ground, drivable, one-way); mk = { walk (mesher for the kerbed strip) }.
   For every sample 5 m along a piece, look sideways for an OPPOSITE one-way piece 2 to 24 m beyond the carriageway edge; the strip between them is a median (the lower id of the pair draws it). */
export function medians(pieces, o) {
  const { X, Z, gy, size, ox, oz } = o, m = o.walk, N = pieces.length; if (N < 2) return 0; const CELL = 32, grid = new Map(); let drawn = 0;
  pieces.forEach((p, idx) => { p.idx = idx; for (let i = 0; i + 3 < p.pts.length; i += 2) { const x0 = p.pts[i], z0 = p.pts[i + 1], x1 = p.pts[i + 2], z1 = p.pts[i + 3]; for (let a = Math.floor((Math.min(x0, x1) - 26) / CELL); a <= Math.floor((Math.max(x0, x1) + 26) / CELL); a++) for (let b = Math.floor((Math.min(z0, z1) - 26) / CELL); b <= Math.floor((Math.max(z0, z1) + 26) / CELL); b++) { const k = a + ',' + b; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push([x0, z0, x1, z1, idx]); } } });
  const top = gy + MEDIAN_H, face = (x0, z0, x1, z1, nx, nz) => { const v0 = m.v(X(x0), gy, Z(z0), nx, 0, nz, KERB), v1 = m.v(X(x1), gy, Z(z1), nx, 0, nz, KERB), v2 = m.v(X(x1), top, Z(z1), nx, 0, nz, KERB), v3 = m.v(X(x0), top, Z(z0), nx, 0, nz, KERB); m.tri(v0, v1, v2, nx, 0, nz); m.tri(v0, v2, v3, nx, 0, nz); };
  for (const P of pieces) {
    const L = plen(P.pts); if (L < 14) continue;
    for (const side of [1, -1]) {
      let prev = null;
      for (let sd = 2; sd <= L - 2 && drawn < CAPS.medians; sd += 5) {
        const c = along(P.pts, false, sd); if (!c) continue; const rx = -c.tz * side, rz = c.tx * side, maxD = 24 + P.hw; let best = null;
        const cells = new Set(); for (let t = 0; t <= maxD; t += 16) cells.add(Math.floor((c.x + rx * t) / CELL) + ',' + Math.floor((c.z + rz * t) / CELL));
        for (const k of cells) for (const [x0, z0, x1, z1, idx] of grid.get(k) || []) { if (idx === P.idx) continue; const Q = pieces[idx];
          const dx = x1 - x0, dz = z1 - z0, den = rx * dz - rz * dx; if (Math.abs(den) < 1e-6) continue; const t = ((x0 - c.x) * dz - (z0 - c.z) * dx) / den, u = ((x0 - c.x) * rz - (z0 - c.z) * rx) / den; if (t < 0 || t > maxD || u < 0 || u > 1) continue;
          const ql = Math.hypot(dx, dz) || 1, par = (c.tx * dx + c.tz * dz) / ql; if (P.oneway * Q.oneway * par > -0.9) continue;                          // nearly parallel and travelling the opposite way (each one-way piece is drawn in its own direction of travel, so the pair has opposite geometry)
          if (!best || t < best.t) best = { t, hwQ: Q.hw, idx }; }
        const ok = best && P.idx < best.idx && (best.t - P.hw - best.hwQ) >= 1.6 && (best.t - P.hw - best.hwQ) <= 22;
        if (!ok) { prev = null; continue; }
        const inner = P.hw + 0.3, outer = best.t - best.hwQ - 0.3; if (outer - inner < 0.8) { prev = null; continue; }
        const a = [c.x + rx * inner, c.z + rz * inner], b = [c.x + rx * outer, c.z + rz * outer];
        if (prev) {
          const q = (p0, p1, p2, p3) => { const v0 = m.v(X(p0[0]), top, Z(p0[1]), 0, 1, 0, SOIL, p0[0] / 6, p0[1] / 6), v1 = m.v(X(p1[0]), top, Z(p1[1]), 0, 1, 0, SOIL, p1[0] / 6, p1[1] / 6), v2 = m.v(X(p2[0]), top, Z(p2[1]), 0, 1, 0, SOIL, p2[0] / 6, p2[1] / 6), v3 = m.v(X(p3[0]), top, Z(p3[1]), 0, 1, 0, SOIL, p3[0] / 6, p3[1] / 6); m.tri(v0, v1, v2, 0, 1, 0); m.tri(v0, v2, v3, 0, 1, 0); };
          q(prev.a, a, b, prev.b); face(prev.a[0], prev.a[1], a[0], a[1], -rx, -rz); face(prev.b[0], prev.b[1], b[0], b[1], rx, rz); drawn++;
        }
        prev = { a, b };
      }
    }
  }
  void size; void ox; void oz; return drawn;
}
