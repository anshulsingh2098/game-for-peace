/* Infill buildings for the Delhi pack (Phase P1 of docs/DELHI_POLISH_PLAN.md).
   OpenStreetMap's building footprints are incomplete in Delhi: in the pack a 1 km tile has buildings on only 6 to 19 % of its ground, so the blocks (the faces of the street graph) read as flat grey ground
   with a few boxes. This adds plausible buildings where the data is silent: rows of lots along the edges of the built-up blocks, set back from the carriageway and its pavement, never on a street, a park, water,
   a mapped building or another lot, by the character of the area (Old Delhi dense and tall and narrow, markets, urban villages, DDA slabs, Lutyens low and wide). Deterministic from the tile and the area.
   Pure (no three.js): `tools/selftest.mjs` checks it. The result is a list of building records like the pack's (`ring` flat x, z in world metres, `levels`, `height`, `use`, `hsrc: 'tag'`, `infill: true`). */
import { hash } from './identity.js';

/* what a block of each land use may get; area style by identity area name: fill = chance a free lot is built, floors, lot width and depth in metres, use */
const SKIP_LANDUSE = new Set(['park', 'garden', 'forest', 'farmland', 'cemetery', 'religious', 'grass', 'recreation_ground', 'water', 'meadow', 'allotments']);
export const STYLE = {
  oldDelhi: { rows: 3, fill: 0.95, floors: [3, 5], w: [4, 8], d: [10, 16], use: 'commercial' },
  market: { rows: 3, fill: 0.9, floors: [2, 4], w: [4, 9], d: [10, 15], use: 'commercial' },
  village: { rows: 3, fill: 0.85, floors: [2, 4], w: [5, 10], d: [9, 14], use: 'residential' },
  default: { rows: 3, fill: 0.85, floors: [2, 4], w: [7, 14], d: [11, 17], use: 'residential' },
  dda: { rows: 1, fill: 0.45, floors: [4, 5], w: [14, 30], d: [10, 14], use: 'residential' },
  cp: { rows: 2, fill: 0.5, floors: [3, 4], w: [12, 22], d: [14, 18], use: 'commercial' },
  lutyens: { rows: 1, fill: 0.1, floors: [1, 2], w: [14, 24], d: [16, 24], use: 'residential' },
  business: { rows: 1, fill: 0.45, floors: [5, 10], w: [18, 36], d: [18, 30], use: 'office' },
};
const MAX_PER_TILE = 4000, INTERIOR_MAX = 1800, LANE = 3.2, INTERIOR_FILL = 0.8, EDGE_MARGIN = 25, STREET_CLEAR = 0.9, FLOOR = 3.2;

const area2 = r => { let a = 0; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) a += r[j] * r[i + 1] - r[i] * r[j + 1]; return a / 2; };
function pip(r, x, z) { let c = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { const xi = r[i], zi = r[i + 1], xj = r[j], zj = r[j + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
const clean = r => (r.length > 2 && r[0] === r[r.length - 2] && r[1] === r[r.length - 1]) ? r.slice(0, -2) : r;

/* tile: a decoded pack tile (world metres); o: { size, G (graph columns, for lane counts), widthOf(streetPiece) -> carriageway width, styleAt(x, z) -> style name } */
/* the generator: yields after each block so the tile mesher can spread the work over frames; infillBuildings() runs it to the end (tests, tools) */
export function infillBuildings(tile, o) { const g = infillSteps(tile, o); let r; while (!(r = g.next()).done); return r.value; }
export function* infillSteps(tile, o) {
  const size = o.size, ox = tile.tx * size, oz = tile.tz * size, out = [], CELL = 16, CS = 24;
  const bgrid = new Map(), sgrid = new Map(), placed = [];
  const addB = (r, id) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]); } const b = { r, x0, x1, z0, z1 }; for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) { const k = i + ',' + j; let l = bgrid.get(k); if (!l) bgrid.set(k, l = []); l.push(b); } return b; };
  for (const b of tile.buildings || []) if (b.ring && b.ring.length >= 6) addB(b.ring);
  for (const s of tile.streets || []) {
    const cls = o.G.classes[o.G.cls[s.id]]; if (cls === 'footway' || cls === 'cycleway' || cls === 'path' || cls === 'steps' || cls === 'pedestrian') continue; const hw = o.widthOf(s) / 2 + 1.8, p = s.pts;
    for (let i = 0; i + 3 < p.length; i += 2) { const seg = [p[i], p[i + 1], p[i + 2], p[i + 3], hw]; for (let a = Math.floor((Math.min(p[i], p[i + 2]) - hw) / CS); a <= Math.floor((Math.max(p[i], p[i + 2]) + hw) / CS); a++) for (let b = Math.floor((Math.min(p[i + 1], p[i + 3]) - hw) / CS); b <= Math.floor((Math.max(p[i + 1], p[i + 3]) + hw) / CS); b++) { const k = a + ',' + b; let l = sgrid.get(k); if (!l) sgrid.set(k, l = []); l.push(seg); } }
  }
  const streetClear = (x, z, r) => { const l = sgrid.get(Math.floor(x / CS) + ',' + Math.floor(z / CS)); if (!l) return true; for (const [x0, z0, x1, z1, hw] of l) { const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2)) : 0; if (Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t)) < hw + r) return false; } return true; };
  /* the nearest street to (x, z): distance to its centre line and its half width with pavement */
  const nearStreet = (x, z) => { let bd = 1e9, bhw = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = sgrid.get((Math.floor(x / CS) + a) + ',' + (Math.floor(z / CS) + b)); if (l) for (const [x0, z0, x1, z1, hw] of l) { const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2)) : 0, d = Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t)); if (d - hw < bd - bhw) { bd = d; bhw = hw; } } } return { d: bd, hw: bhw }; };
  const inBuilding = (x, z) => { const l = bgrid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)); if (l) for (const b of l) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && pip(b.r, x, z)) return true; return false; };
  const polys = [...(tile.parks || []), ...(tile.water || [])].map(p => clean(p.ring)), inPoly = (x, z) => { for (const r of polys) if (pip(r, x, z)) return true; return false; };

  const blocks = (tile.blocks || []).filter(b => !SKIP_LANDUSE.has(b.landuse)).map(b => ({ ring: clean(b.ring), holes: (b.holes || []).map(clean), landuse: b.landuse }));
  const st = { tried: 0, margin: 0, outside: 0, street: 0, bldg: 0, ok: 0, skippedFill: 0, shortEdge: 0 }; out.stats = st;
  let seq = 0; const baseId = 700000000 + (((tile.tx + 64) & 127) * 128 + ((tile.tz + 64) & 127)) * 4000;
  for (let bi = 0; bi < blocks.length && out.length < MAX_PER_TILE; bi++) {
    if (o.yieldNow && o.yieldNow()) yield;
    const B = blocks[bi], r = B.ring, n = r.length / 2; if (n < 3) continue; const ccw = area2(r) > 0;
    for (let e = 0; e < n && out.length < MAX_PER_TILE; e++) {
      const ax = r[e * 2], az = r[e * 2 + 1], bx = r[((e + 1) % n) * 2], bz = r[((e + 1) % n) * 2 + 1], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 12) continue;
      const ux = dx / L, uz = dz / L; let nx = -uz, nz = ux; if (!pip(r, ax + dx / 2 + nx, az + dz / 2 + nz)) { nx = -nx; nz = -nz; } void ccw;
      const mx = ax + dx / 2, mz = az + dz / 2, style = STYLE[o.styleAt(mx, mz)] || STYLE.default, h0 = hash(bi * 977 + e * 31 + tile.tx * 7 + tile.tz * 13);
      const pitch = (style.d[0] + style.d[1]) / 2 + 1.0;
      for (let row = 0; row < style.rows && out.length < MAX_PER_TILE; row++) {
      let s = 2 + h0 * 3 + row * 1.7, k = row * 101;
      while (s < L - 4 && out.length < MAX_PER_TILE) {
        const rn = hash(bi * 7919 + e * 131 + k++ * 17 + tile.tx * 3 + tile.tz * 5), w = style.w[0] + (style.w[1] - style.w[0]) * rn, dep = style.d[0] + (style.d[1] - style.d[0]) * hash(bi * 313 + e * 71 + k * 19 + 5);
        if (s + w > L - 2) break; const step = w + (rn < 0.12 ? 3 + rn * 20 : 0.4 * rn);       // a few lots left open: a side lane or a gap
        const fillRoll = hash(bi * 53 + e * 17 + k * 29 + tile.tx * 11 + tile.tz * 23); st.tried++; if (fillRoll > style.fill) { st.skippedFill++; s += step; continue; }
        let ok = false, ring = null, cx = 0, cz = 0;
        const ns = nearStreet(ax + ux * (s + w / 2), az + uz * (s + w / 2)), need = Math.max(0.4, (ns.d < 1e8 ? ns.hw + 0.9 - ns.d : 4) + 0.2);
        for (const off of [need + row * pitch, need + 1.6 + row * pitch, need + 3.6 + row * pitch]) {                                             // set back: carriageway edge, pavement, then a setback; step in if a wider street needs it
          const p0 = [ax + ux * s + nx * off, az + uz * s + nz * off], p1 = [ax + ux * (s + w) + nx * off, az + uz * (s + w) + nz * off], p2 = [p1[0] + nx * dep, p1[1] + nz * dep], p3 = [p0[0] + nx * dep, p0[1] + nz * dep];
          const pts = [p0, p1, p2, p3]; cx = (p0[0] + p2[0]) / 2; cz = (p0[1] + p2[1]) / 2;
          const probe = [...pts, [cx, cz], [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], [(p2[0] + p3[0]) / 2, (p2[1] + p3[1]) / 2], [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], [(p3[0] + p0[0]) / 2, (p3[1] + p0[1]) / 2]];
          if (probe.some(q => q[0] < ox + EDGE_MARGIN || q[0] > ox + size - EDGE_MARGIN || q[1] < oz + EDGE_MARGIN || q[1] > oz + size - EDGE_MARGIN)) { st.margin++; break; }
          if (probe.some(q => !pip(r, q[0], q[1]))) { st.outside++; continue; } if (B.holes.some(h => probe.some(q => pip(h, q[0], q[1])))) continue;
          if (probe.some(q => !streetClear(q[0], q[1], STREET_CLEAR) || inPoly(q[0], q[1]))) { st.street++; continue; }
          let hit = false; for (let a = 0; a <= 4 && !hit; a++) for (let b = 0; b <= 3 && !hit; b++) { const fx = a / 4, fz = b / 3, qx = p0[0] + (p1[0] - p0[0]) * fx + nx * dep * fz, qz = p0[1] + (p1[1] - p0[1]) * fx + nz * dep * fz; if (inBuilding(qx, qz)) hit = true; }
          if (hit) { st.bldg++; continue; }
          const x0 = Math.min(...pts.map(q => q[0])) - 0.5, x1 = Math.max(...pts.map(q => q[0])) + 0.5, z0 = Math.min(...pts.map(q => q[1])) - 0.5, z1 = Math.max(...pts.map(q => q[1])) + 0.5;
          for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL) && !hit; i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL) && !hit; j++) { const l = bgrid.get(i + ',' + j); if (l) for (const b of l) { for (let v = 0; v < b.r.length; v += 2) { const vx = b.r[v], vz = b.r[v + 1]; if (vx < x0 || vx > x1 || vz < z0 || vz > z1) continue; const rx = vx - p0[0], rz = vz - p0[1], uu = rx * ux + rz * uz, vv = rx * nx + rz * nz; if (uu > -0.5 && uu < w + 0.5 && vv > -0.5 && vv < dep + 0.5) { hit = true; break; } } if (hit) break; } }
          if (hit) continue;
          ring = [p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]]; ok = true; break;
        }
        if (ok) {
          const fl = Math.round(style.floors[0] + (style.floors[1] - style.floors[0]) * hash(bi * 211 + e * 37 + k * 41 + 9)), lv = Math.max(1, fl); addB(ring);
          out.push({ id: baseId + (seq++ % 4000), ring, levels: lv, height: lv * FLOOR, use: style.use, hsrc: 'tag', infill: true });
        }
        s += step;
      }
      }
    }
  }
  /* P1 part 2: the interiors. The frontage rows above leave the middle of a big block open (the map data has no buildings there either). Here the block is cut into back-to-back rows of lots in the direction of its longest edge, with a 3 m lane between rows, and the same acceptance test as the frontage lots (inside the block, clear of every street, park, mapped building, earlier lot and hole). */
  const interior = []; let nIn = 0;
  for (let bi = 0; bi < blocks.length && nIn < INTERIOR_MAX && out.length < MAX_PER_TILE; bi++) {
    if (o.yieldNow && o.yieldNow()) yield;
    const B = blocks[bi], r = B.ring, n = r.length / 2; if (n < 3) continue;
    let bl = 0, ux = 1, uz = 0; for (let e = 0; e < n; e++) { const dx = r[((e + 1) % n) * 2] - r[e * 2], dz = r[((e + 1) % n) * 2 + 1] - r[e * 2 + 1], L = Math.hypot(dx, dz); if (L > bl) { bl = L; ux = dx / L; uz = dz / L; } }
    const vx = -uz, vz = ux; let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9; for (let i = 0; i < r.length; i += 2) { const u = r[i] * ux + r[i + 1] * uz, v = r[i] * vx + r[i + 1] * vz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    if (u1 - u0 < 36 || v1 - v0 < 36) continue;
    const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, style = STYLE[o.styleAt(cu * ux + cv * vx, cu * uz + cv * vz)] || STYLE.default, dep = (style.d[0] + style.d[1]) / 2, pitch = dep + LANE, fill = style.fill * INTERIOR_FILL;
    let k = bi * 1009 + 7, rowN = 0;
    for (let v = v0 + 2 + hash(bi * 61 + tile.tx * 5 + tile.tz * 3) * pitch; v + dep < v1 && nIn < INTERIOR_MAX; v += pitch + (rowN++ % 2 ? 0 : 0)) {
      for (let u = u0 + 2 + hash(bi * 67 + rowN * 13) * 6; u < u1 - 2 && nIn < INTERIOR_MAX; ) {
        const rn = hash(k++ * 17 + tile.tx * 3 + tile.tz * 5 + bi), w = style.w[0] + (style.w[1] - style.w[0]) * rn, step = w + (rn < 0.1 ? 3 + rn * 15 : 0.4 * rn);
        if (hash(k * 29 + bi * 53 + tile.tx * 11 + tile.tz * 23) > fill) { u += step; continue; }
        const W = (a, b) => [a * ux + b * vx, a * uz + b * vz], p0 = W(u, v), p1 = W(u + w, v), p2 = W(u + w, v + dep), p3 = W(u, v + dep), pts = [p0, p1, p2, p3], ccx = (p0[0] + p2[0]) / 2, ccz = (p0[1] + p2[1]) / 2;
        u += step;
        const probe = [...pts, [ccx, ccz], [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], [(p2[0] + p3[0]) / 2, (p2[1] + p3[1]) / 2], [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], [(p3[0] + p0[0]) / 2, (p3[1] + p0[1]) / 2]];
        st.iTry = (st.iTry || 0) + 1; if (probe.some(q => q[0] < ox + EDGE_MARGIN || q[0] > ox + size - EDGE_MARGIN || q[1] < oz + EDGE_MARGIN || q[1] > oz + size - EDGE_MARGIN)) { st.iMargin = (st.iMargin || 0) + 1; continue; }
        if (probe.some(q => !pip(r, q[0], q[1]))) { st.iOut = (st.iOut || 0) + 1; continue; } if (probe.some(q => !streetClear(q[0], q[1], STREET_CLEAR) || inPoly(q[0], q[1]))) { st.iStreet = (st.iStreet || 0) + 1; continue; } if (B.holes.some(h => probe.some(q => pip(h, q[0], q[1])))) { st.iHole = (st.iHole || 0) + 1; continue; }
        let hit = false; for (let a = 0; a <= 4 && !hit; a++) for (let b = 0; b <= 3 && !hit; b++) { const qx = p0[0] + (p1[0] - p0[0]) * a / 4 + (p3[0] - p0[0]) * b / 3, qz = p0[1] + (p1[1] - p0[1]) * a / 4 + (p3[1] - p0[1]) * b / 3; if (inBuilding(qx, qz)) hit = true; }
        if (hit) { st.iBld = (st.iBld || 0) + 1; continue; }
        const x0 = Math.min(...pts.map(q => q[0])) - 0.5, x1 = Math.max(...pts.map(q => q[0])) + 0.5, z0 = Math.min(...pts.map(q => q[1])) - 0.5, z1 = Math.max(...pts.map(q => q[1])) + 0.5;
        for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL) && !hit; i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL) && !hit; j++) { const l = bgrid.get(i + ',' + j); if (l) for (const b of l) { for (let q = 0; q < b.r.length; q += 2) { const qx = b.r[q], qz = b.r[q + 1]; if (qx < x0 || qx > x1 || qz < z0 || qz > z1) continue; const rx = qx - p0[0], rz = qz - p0[1], uu = rx * ux + rz * uz, vv = rx * vx + rz * vz; if (uu > -0.5 && uu < w + 0.5 && vv > -0.5 && vv < dep + 0.5) { hit = true; break; } } if (hit) break; } }
        if (hit) continue;
        const ring = [p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]], fl = Math.round(style.floors[0] + (style.floors[1] - style.floors[0]) * hash(k * 41 + bi * 211 + 9)), lv = Math.max(1, fl); addB(ring); nIn++; st.interior = (st.interior || 0) + 1;
        out.push({ id: baseId + (seq++ % 4000), ring, levels: lv, height: lv * FLOOR, use: style.use, hsrc: 'tag', infill: true, interior: true });
      }
    }
  }
  void placed; return out;
}
