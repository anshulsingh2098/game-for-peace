/* One 1 km tile of the city pack as three.js geometry (docs/CITY_PACK.md): ground fills (blocks, land use), parks and water, street carriageways with lane marks and painted sidewalks, flyover decks with
   edges and piers, and extruded building footprints. Everything of a kind is merged into one mesh per tile, so a tile costs five draw calls. Vertices are relative to the tile's corner (tx * 1000, tz * 1000) in x
   and z and absolute in y; the flat layers lie exactly in the ground plane and are ordered by polygon offset (the terrain here is flat), so a car's wheels sit on the paint. 97 % of the building heights in
   the pack are guesses (docs/CITY_PACK.md 5a): the look is a style, not data. */
import * as THREE from 'three';
import { deckHeight, underDepth, OPEN_CUT, pieceWidth, pieceSidewalk } from './pack.js';
import { buildStreetLife } from './streetlife.js';

/* layers that lie in the ground plane are given real height steps (metres over the ground: it was 0 for all of them and only depth offsets told them apart, which shimmers with distance): ground 0, parks and water, pavement, road, markings */
const TEX_ROAD = 5, TEX_WALK = 4;       // metres one tile of the road and pavement textures covers (a divisor of 1000, so tiles meet without a seam)
const LIFT = { park: 0.015, walk: 0.03, road: 0.05, mark: 0.07 };
const WALL_R = 1.1;                   // a wall circle's radius, and how far its centre sits inside the footprint edge: the circle ends exactly at the drawn wall (it was 1.25 m wide, 0.7 m inside: an invisible 0.55 m of wall in the street)
export class Mesher {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.i = []; }
  v(x, y, z, nx, ny, nz, col, u = 0, v = 0) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); this.u.push(u, v); return this.p.length / 3 - 1; }
  /* a triangle that faces the way `n` says whatever order its corners come in */
  tri(a, b, c, nx, ny, nz) {
    const P = this.p, ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    if ((uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz >= 0) this.i.push(a, b, c); else this.i.push(a, c, b);
  }
  get empty() { return !this.i.length; }
  /* the mesh cut into square cells of `cell` metres (by the centre of each triangle): [{ gx, gz, geo }]. A tile is 1000 m, so one mesh per tile cannot be hidden or culled by distance; a cell can. */
  cells(cell) {
    const P = this.p, I = this.i, by = new Map();
    for (let t = 0; t < I.length; t += 3) { const a = I[t], b = I[t + 1], c = I[t + 2], gx = Math.floor((P[a * 3] + P[b * 3] + P[c * 3]) / 3 / cell), gz = Math.floor((P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3 / cell), k = gx + ',' + gz; let e = by.get(k); if (!e) by.set(k, e = { gx, gz, I: [] }); e.I.push(a, b, c); }
    const out = [];
    for (const e of by.values()) {
      const map = new Map(), p = [], n = [], c = [], u = [], idx = [];
      for (const v of e.I) { let w = map.get(v); if (w === undefined) { w = p.length / 3; map.set(v, w); p.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); n.push(this.n[v * 3], this.n[v * 3 + 1], this.n[v * 3 + 2]); c.push(this.c[v * 3], this.c[v * 3 + 1], this.c[v * 3 + 2]); u.push(this.u[v * 2], this.u[v * 2 + 1]); } idx.push(w); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
      g.setIndex(p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); g.computeBoundingSphere(); out.push({ gx: e.gx, gz: e.gz, geo: g });
    }
    return out;
  }
  geometry() {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i.length > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1)); g.computeBoundingSphere(); return g;
  }
}

const col = hex => new THREE.Color(hex);
const ROAD = { motorway: col(0x333436), trunk: col(0x333436), primary: col(0x353638), secondary: col(0x383a3b), tertiary: col(0x3b3c3d), residential: col(0x44413e), service: col(0x4a4642), busway: col(0x3a3a3c), footway: col(0x9a9284), cycleway: col(0x6a7a68) };
const WALK = col(0x77736a), MARK = col(0xe9e6da), CONCRETE = col(0x8c8a84), BLOCK = { urban: col(0x6f695c), residential: col(0x716a5c), commercial: col(0x6c6a64), retail: col(0x6c6a64), industrial: col(0x64625d), park: col(0x5a7a3a), garden: col(0x5a7a3a), forest: col(0x44663a), farmland: col(0x8f9a55), grass: col(0x66843f), meadow: col(0x7a8a45), water: col(0x2e5f73), river: col(0x2e5f73), cemetery: col(0x6f7f50), military: col(0x7b7f66), religious: col(0x9a8f78) };
const PARK = col(0x5f8a3c), WATER = col(0x2f6477);
/* walls by use (sRGB hex), a little different for every building */
const WALLS = { residential: [0xcdbd9c, 0xd7c6a6, 0xb9a384, 0xe0d3b8, 0xc4a98a, 0xa89580], commercial: [0xc9c1ae, 0xb6b0a2, 0xd3c6a8, 0xa9a59a], office: [0x9fb3c2, 0xb4c2cc, 0x8aa0b2, 0xc3ccd2], retail: [0xd6c2a0, 0xc7b79a], civic: [0xd9c79a, 0xe6d6ac, 0xc9b88c], religious: [0xece3cc, 0xdcc9a0], industrial: [0x9d9a92, 0xafa99c], hotel: [0xd8cdb4, 0xc8bda5], transit: [0xb7a58a, 0xc4b394], other: [0xbfb5a0, 0xcbc2ad] };
const ROOF = col(0x77726a), SAND = col(0xb0553a);
const LM_WALL = { station: 0xa04a34, memorial: 0xc9936a, monument: 0xc9936a, fort: 0xb05a3c, tomb: 0xd6c19a, temple: 0xeadfc6, mosque: 0xe7dcc2, church: 0xe2d8c0, gurdwara: 0xf0ead8, museum: 0xd5c3a0, government: 0xd9c498 };
const tmp = new THREE.Color(), hash = n => { let h = (n | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const shade = (hex, k) => { tmp.setHex(hex); tmp.multiplyScalar(k); return tmp.clone(); };
const RANKOF = { motorway: 6, trunk: 5, primary: 4, secondary: 3, tertiary: 2, residential: 1, service: 0, busway: 3, footway: 0, cycleway: 0 };

/* a polyline cut into pieces no longer than `step` (decks need points where the height changes) */
function densify(pts, step) { const o = [pts[0], pts[1]]; for (let i = 2; i < pts.length; i += 2) { const x0 = pts[i - 2], z0 = pts[i - 1], x1 = pts[i], z1 = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step)); for (let k = 1; k <= n; k++) o.push(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n); } return o; }
/* the left and right offset curves of a polyline at lateral offsets a..b (right of travel positive: z points south, so right of east is south), with mitred corners */
function frames(pts) {
  const n = pts.length / 2, nx = new Float32Array(n), nz = new Float32Array(n), sc = new Float32Array(n), arc = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let tx = 0, tz = 0, ax = 0, az = 0, cnt = 0;
    if (i > 0) { const dx = pts[i * 2] - pts[i * 2 - 2], dz = pts[i * 2 + 1] - pts[i * 2 - 1], l = Math.hypot(dx, dz) || 1; ax = dx / l; az = dz / l; tx += ax; tz += az; cnt++; arc[i] = arc[i - 1] + l; }
    let bx = 0, bz = 0; if (i < n - 1) { const dx = pts[i * 2 + 2] - pts[i * 2], dz = pts[i * 2 + 3] - pts[i * 2 + 1], l = Math.hypot(dx, dz) || 1; bx = dx / l; bz = dz / l; tx += bx; tz += bz; cnt++; }
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; nx[i] = -tz; nz[i] = tx;
    const sx = i < n - 1 ? bx : ax, sz = i < n - 1 ? bz : az; sc[i] = 1 / Math.max(0.55, tx * sx + tz * sz);          // stretch so the strip keeps its width round a bend
  }
  return { n, nx, nz, sc, arc };
}

/* the tile in slices: a generator that yields whenever `ctx.yieldNow()` says the frame's time is used up (checked between streets and between buildings) and returns { M, out } when done, so a tile of 3 to 41 ms
   is spread over several frames (CityWorld drives it with a budget of about 3 ms a frame); buildTile runs it to the end at once (tests, tools) */
/* a plausible height where the pack only guesses (hsrc not 'tag' or 'levels'): the pack's levels by use, bent by the footprint and a hash so a street is not a row of identical boxes; real tags and levels are kept */
function guessHeight(b, hash) {
  if (b.hsrc === 'tag' || b.hsrc === 'levels') return b.height || 9; const base = b.height || (b.levels ? b.levels * 3.2 : 9), k = hash(b.id * 31 + 7); let area = 0; const r = b.ring, n = r.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1]; } area = Math.abs(area) / 2;
  let lv = Math.round(base / 3.2) + (k < 0.25 ? -1 : k > 0.8 ? 1 : 0); if (b.use === 'office' || b.use === 'hotel') lv += area > 900 ? 3 : 1; else if (b.use === 'industrial') lv = Math.min(lv, 2); else if (b.use === 'residential' && area < 90) lv = Math.min(lv, 3);
  return Math.max(1, Math.min(lv, 25)) * 3.2;
}
export function buildTile(tile, ctx) { const g = buildTileSteps(tile, { ...ctx, yieldNow: null }); let r; while (!(r = g.next()).done); return r.value; }
export function* buildTileSteps(tile, ctx) {
  const { G, lm, gy, size } = ctx, ox = tile.tx * size, oz = tile.tz * size, M = { ground: new Mesher(), park: new Mesher(), walk: new Mesher(), road: new Mesher(), mark: new Mesher(), bldg: new Mesher(), bldgO: new Mesher(), bldgG: new Mesher(), shop: new Mesher() };
  const out = { circles: [], decks: [], cuts: [], claims: [], labels: [], nBuildings: 0, nStreets: 0 }, X = x => x - ox, Z = z => z - oz;
  const flat = (m, ring, holes, c, y) => {                                           // a polygon (ring and holes in metres) lying at height y
    const clean = r => { const n = r.length / 2; if (n > 1 && r[0] === r[r.length - 2] && r[1] === r[r.length - 1]) return r.slice(0, -2); return r; };
    const R = clean(ring), contour = []; for (let i = 0; i < R.length; i += 2) contour.push(new THREE.Vector2(R[i], R[i + 1])); const H = (holes || []).map(h => { const c2 = clean(h), a = []; for (let i = 0; i < c2.length; i += 2) a.push(new THREE.Vector2(c2[i], c2[i + 1])); return a; });
    if (contour.length < 3) return; let tris; try { tris = THREE.ShapeUtils.triangulateShape(contour, H); } catch (e) { return; }
    const all = contour.concat(...H), base = m.p.length / 3; for (const q of all) m.v(X(q.x), gy + y, Z(q.y), 0, 1, 0, c, q.x / 11, q.y / 11);
    for (const t of tris) m.tri(base + t[0], base + t[1], base + t[2], 0, 1, 0);
  };
  /* ---- ground: land use first, then blocks, parks and water ---- */
  for (const l of tile.landuse) { const c = BLOCK[l.class]; if (c && !['residential', 'commercial', 'retail', 'industrial'].includes(l.class)) flat(M.ground, l.ring, l.holes, c, 0); }
  for (const b of tile.blocks) flat(M.ground, b.ring, b.holes, BLOCK[b.landuse] || BLOCK.urban, 0);
  for (const p of tile.parks) flat(M.park, p.ring, p.holes, PARK, LIFT.park);
  for (const w of tile.water) flat(M.park, w.ring, w.holes, WATER, LIFT.park);
  /* ---- streets ---- */
  const groundSeg = new Map(), CELLQ = 24;                                           // ground carriageways of this tile, to keep flyover piers out of them
  const hashSeg = (x0, z0, x1, z1, hw, id) => { const a = Math.floor(Math.min(x0, x1) / CELLQ), b = Math.floor(Math.max(x0, x1) / CELLQ), c = Math.floor(Math.min(z0, z1) / CELLQ), d = Math.floor(Math.max(z0, z1) / CELLQ); for (let i = a; i <= b; i++) for (let j = c; j <= d; j++) { const k = i + ',' + j; let l = groundSeg.get(k); if (!l) groundSeg.set(k, l = []); l.push([x0, z0, x1, z1, hw, id]); } };
  const pierFree = (x, z, r) => { const l = groundSeg.get(Math.floor(x / CELLQ) + ',' + Math.floor(z / CELLQ)); if (!l) return true; for (const [x0, z0, x1, z1, hw] of l) { const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2)) : 0; if (Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t)) < hw + r) return false; } return true; };
  for (const s of tile.streets) { const lay = G.layer[s.id]; if (lay === 0) { const w = pieceWidth(G, s) / 2 + 1; for (let i = 0; i + 3 < s.pts.length; i += 2) hashSeg(s.pts[i], s.pts[i + 1], s.pts[i + 2], s.pts[i + 3], w, s.id); } }
  /* is (x, z) clear of every ground carriageway of the tile except street `id`'s own (a kerb stops at a side street's mouth) */
  const mouthFree = (x, z, id) => { const l = groundSeg.get(Math.floor(x / CELLQ) + ',' + Math.floor(z / CELLQ)); if (!l) return true; for (const [x0, z0, x1, z1, hw, sid] of l) { if (sid === id) continue; const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2)) : 0; if (Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t)) < hw - 0.3) return false; } return true; };
  const KERB_H = 0.12, KERB_W = 0.3, KERBC = col(0xb4b0a6);
  /* a kerb along one side of a street: a raised stone (0.12 m, the car physics gets wall circles of negative radius = mountable at walking pace) in 3 m pieces, none where a side street joins */
  const kerb = (pts, F, hw, side, id) => {
    const at = (i, f, off) => { const x = pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * f, z = pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * f, nx = F.nx[i] + (F.nx[i + 1] - F.nx[i]) * f, nz = F.nz[i] + (F.nz[i + 1] - F.nz[i]) * f, k = F.sc[i] + (F.sc[i + 1] - F.sc[i]) * f; return [x + nx * off * k * side, z + nz * off * k * side, nx * side, nz * side]; };
    const m = M.walk, y1 = gy + KERB_H;
    for (let i = 0; i + 1 < F.n; i++) { const L = Math.hypot(pts[i * 2 + 2] - pts[i * 2], pts[i * 2 + 3] - pts[i * 2 + 1]), n = Math.max(1, Math.round(L / 3));
      for (let q = 0; q < n; q++) { const f0 = q / n, f1 = (q + 1) / n, mid = at(i, (f0 + f1) / 2, hw + KERB_W / 2); if (!mouthFree(mid[0], mid[1], id)) continue;
        const a0 = at(i, f0, hw), a1 = at(i, f1, hw), b0 = at(i, f0, hw + KERB_W), b1 = at(i, f1, hw + KERB_W), nxv = -a0[2], nzv = -a0[3];       // the inner face looks at the road
        const va = m.v(X(a0[0]), gy, Z(a0[1]), nxv, 0, nzv, KERBC), vb = m.v(X(a1[0]), gy, Z(a1[1]), nxv, 0, nzv, KERBC), vc = m.v(X(a1[0]), y1, Z(a1[1]), nxv, 0, nzv, KERBC), vd = m.v(X(a0[0]), y1, Z(a0[1]), nxv, 0, nzv, KERBC); m.tri(va, vb, vc, nxv, 0, nzv); m.tri(va, vc, vd, nxv, 0, nzv);
        const ta = m.v(X(a0[0]), y1, Z(a0[1]), 0, 1, 0, KERBC), tb = m.v(X(a1[0]), y1, Z(a1[1]), 0, 1, 0, KERBC), tc = m.v(X(b1[0]), y1, Z(b1[1]), 0, 1, 0, KERBC), td = m.v(X(b0[0]), y1, Z(b0[1]), 0, 1, 0, KERBC); m.tri(ta, tb, tc, 0, 1, 0); m.tri(ta, tc, td, 0, 1, 0);
        const c = at(i, (f0 + f1) / 2, hw + 1.6); out.circles.push(c[0], c[1], -1.6); } }
  };
  /* an underpass: the trench around the sunken carriageway (walls to the ground, a roof where the cut is deeper than OPEN_CUT), the strips the ground is lowered along for the physics, and the roof as a deck for cars crossing above */
  const underpass = (pts, F, H, hw, id, lay) => {
    const WALLC = shade(0x8c8a84, 0.8), ROOFC = shade(0x6e6c68, 0.9), e = 0.25, rd = out.decks.length; const roofPos = [], roofIdx = []; let inRun = false;
    for (let i = 0; i + 1 < F.n; i++) {
      const d0 = -H[i], d1 = -H[i + 1], covered = d0 >= OPEN_CUT && d1 >= OPEN_CUT;
      for (const side of [1, -1]) { const off = side * (hw + e), x0 = pts[i * 2] + F.nx[i] * off * F.sc[i], z0 = pts[i * 2 + 1] + F.nz[i] * off * F.sc[i], x1 = pts[i * 2 + 2] + F.nx[i + 1] * off * F.sc[i + 1], z1 = pts[i * 2 + 3] + F.nz[i + 1] * off * F.sc[i + 1], nxv = -F.nx[i] * side, nzv = -F.nz[i] * side;       // the wall faces the road
        const a = M.road.v(X(x0), gy + H[i], Z(z0), nxv, 0, nzv, WALLC), b = M.road.v(X(x1), gy + H[i + 1], Z(z1), nxv, 0, nzv, WALLC), c2 = M.road.v(X(x1), gy + 0.05, Z(z1), nxv, 0, nzv, WALLC), d = M.road.v(X(x0), gy + 0.05, Z(z0), nxv, 0, nzv, WALLC); M.road.tri(a, b, c2, nxv, 0, nzv); M.road.tri(a, c2, d, nxv, 0, nzv); }
      if (d0 > 0.05 || d1 > 0.05) out.cuts.push({ x0: pts[i * 2], z0: pts[i * 2 + 1], x1: pts[i * 2 + 2], z1: pts[i * 2 + 3], d0, d1, hw: hw + 0.5, phw: hw + 2.4, open: !covered });       // hw: the strip the ground is not drawn in; phw: the strip it is lowered in for the wheels (a car keeps to the left lane, and the heightfield's walls take a 1.5 m cell to rise)
      if (covered) { const ka = F.sc[i], kb = F.sc[i + 1], y = gy - 0.12, v = (px, pz, nx2, nz2, k, off) => M.road.v(X(px + nx2 * off * k), y, Z(pz + nz2 * off * k), 0, -1, 0, ROOFC);
        const a = v(pts[i * 2], pts[i * 2 + 1], F.nx[i], F.nz[i], ka, -(hw + e)), b = v(pts[i * 2], pts[i * 2 + 1], F.nx[i], F.nz[i], ka, hw + e), c2 = v(pts[i * 2 + 2], pts[i * 2 + 3], F.nx[i + 1], F.nz[i + 1], kb, hw + e), d = v(pts[i * 2 + 2], pts[i * 2 + 3], F.nx[i + 1], F.nz[i + 1], kb, -(hw + e)); M.road.tri(a, b, c2, 0, -1, 0); M.road.tri(a, c2, d, 0, -1, 0);
        const rw = hw + 1.2; if (!inRun) { roofPos.push(pts[i * 2] + F.nx[i] * rw, gy, pts[i * 2 + 1] + F.nz[i] * rw, pts[i * 2] - F.nx[i] * rw, gy, pts[i * 2 + 1] - F.nz[i] * rw); inRun = true; }
        const v0 = roofPos.length / 3; roofPos.push(pts[i * 2 + 2] + F.nx[i + 1] * rw, gy, pts[i * 2 + 3] + F.nz[i + 1] * rw, pts[i * 2 + 2] - F.nx[i + 1] * rw, gy, pts[i * 2 + 3] - F.nz[i + 1] * rw); roofIdx.push(v0 - 2, v0 - 1, v0, v0 - 1, v0 + 1, v0); } else inRun = false;
    }
    if (roofIdx.length) out.decks.push({ pos: roofPos, idx: roofIdx, hw: hw + 1.2, id, lay, roof: true }); void rd;
  };
  /* the list of streets sorted so that small roads are drawn first (their order only matters for z fighting at junctions, which the offsets below settle) */
  for (const s of tile.streets) {
    if (ctx.yieldNow && ctx.yieldNow()) yield;
    const id = s.id, cls = G.classes[G.cls[id]], lay = G.layer[id]; if (s.pts.length < 4 || (lay < 0 && !['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential'].includes(cls))) continue;                 // sunken footways and service lanes are not drawn
    const w = pieceWidth(G, s), walk = pieceSidewalk(G, s), clip = s.clip || 0, deck = lay > 0, rank = RANKOF[cls] || 0, rc = ROAD[cls] || ROAD.residential, two = G.oneway[id] === 0, lanes = G.lanes[id];
    const sunk = lay < 0; let pts = s.pts; if (deck) pts = densify(pts, 5); else if (sunk) pts = densify(pts, 4); const F = frames(pts), hAt = (x, z) => (deck ? deckHeight(G, id, x, z) : sunk ? -underDepth(G, id, x, z) : 0), H = new Float32Array(F.n);
    for (let i = 0; i < F.n; i++) H[i] = hAt(pts[i * 2], pts[i * 2 + 1]);
    const m0 = (m, x, y, z, c) => m.v(x, y, z, 0, 1, 0, c, x / TEX_WALK, z / TEX_WALK);
    const strip = (m, a, b, c, dy, hExtra = 0) => {                                                 // a strip between lateral offsets a and b along the whole piece
      let prev = -1; for (let i = 0; i < F.n; i++) {
        const x = pts[i * 2], z = pts[i * 2 + 1], y = gy + H[i] + dy + hExtra + (m === M.road ? LIFT.road : m === M.walk ? LIFT.walk : m === M.mark ? LIFT.mark : 0), k = F.sc[i]; const ua = X(x + F.nx[i] * a * k), wa = Z(z + F.nz[i] * a * k), ub = X(x + F.nx[i] * b * k), wb = Z(z + F.nz[i] * b * k), TS = m === M.road ? TEX_ROAD : TEX_WALK, va = m.v(ua, y, wa, 0, 1, 0, c, ua / TS, wa / TS), vb = m.v(ub, y, wb, 0, 1, 0, c, ub / TS, wb / TS);
        if (prev >= 0) { m.tri(prev, prev + 1, va, 0, 1, 0); m.tri(prev + 1, vb, va, 0, 1, 0); } prev = va;
      }
    };
    const hw = w / 2;
    if (cls === 'footway' || cls === 'cycleway') {                                         // a footway: grey where it runs beside the streets; where it crosses a carriageway it is a zebra crossing (white bars across the road), not a grey slab lying in the road's plane (which flickered)
      const mk = M.mark, WH = col(0xf1eee4); let arc = 0, nextBar = 0.5, prevA = -1, prevB = -1;
      for (let i = 0; i + 1 < F.n; i++) {
        const x0 = pts[i * 2], z0 = pts[i * 2 + 1], x1 = pts[i * 2 + 2], z1 = pts[i * 2 + 3], dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 1e-6) continue; const ux = dx / L, uz = dz / L, nxs = -uz, nzs = ux;
        const inRoad = !mouthFree((x0 + x1) / 2, (z0 + z1) / 2, id) && cls === 'footway';
        if (!inRoad) { const ya = gy + H[i] + LIFT.walk + 0.025, yb = gy + H[i + 1] + LIFT.walk + 0.025, k0 = F.sc[i], k1 = F.sc[i + 1]; const a0 = m0(M.walk, X(x0 + F.nx[i] * -hw * k0), ya, Z(z0 + F.nz[i] * -hw * k0), rc), a1 = m0(M.walk, X(x0 + F.nx[i] * hw * k0), ya, Z(z0 + F.nz[i] * hw * k0), rc), b0 = m0(M.walk, X(x1 + F.nx[i + 1] * -hw * k1), yb, Z(z1 + F.nz[i + 1] * -hw * k1), rc), b1 = m0(M.walk, X(x1 + F.nx[i + 1] * hw * k1), yb, Z(z1 + F.nz[i + 1] * hw * k1), rc); M.walk.tri(a0, a1, b0, 0, 1, 0); M.walk.tri(a1, b1, b0, 0, 1, 0); }
        else { while (nextBar < arc + L) { const t = (nextBar - arc) / L, cx = x0 + dx * t, cz = z0 + dz * t, y = gy + H[i] + LIFT.mark + 0.0, hl = Math.max(hw, 1.1), bw = 0.25; const q0 = mk.v(X(cx - ux * bw + nxs * hl), y, Z(cz - uz * bw + nzs * hl), 0, 1, 0, WH), q1 = mk.v(X(cx + ux * bw + nxs * hl), y, Z(cz + uz * bw + nzs * hl), 0, 1, 0, WH), q2 = mk.v(X(cx + ux * bw - nxs * hl), y, Z(cz + uz * bw - nzs * hl), 0, 1, 0, WH), q3 = mk.v(X(cx - ux * bw - nxs * hl), y, Z(cz - uz * bw - nzs * hl), 0, 1, 0, WH); mk.tri(q0, q1, q2, 0, 1, 0); mk.tri(q0, q2, q3, 0, 1, 0); nextBar += 0.9; } }
        arc += L; void prevA; void prevB;
      }
      out.nStreets++; continue;
    }
    strip(M.road, -hw, hw, rc, 0);
    if (sunk) { underpass(pts, F, H, hw, id, lay); if (['motorway', 'trunk', 'primary', 'secondary', 'tertiary'].includes(cls) && w >= 5.5) { /* lane marks below */ } } else
    if (walk > 0) { const wl = 1.8; strip(M.walk, hw, hw + wl, WALK, 0); if (walk > 1 || two) strip(M.walk, -hw - wl, -hw, WALK, 0); if (!deck) { kerb(pts, F, hw, 1, id); if (walk > 1 || two) kerb(pts, F, hw, -1, id); } }
    /* sidewalks are painted flat (the car physics has no kerb yet); a flyover gets edges, an underside and piers */
    if (deck) {
      const wall = (off, side) => { for (let i = 0; i + 1 < F.n; i++) {
        const x0 = pts[i * 2] + F.nx[i] * off * F.sc[i], z0 = pts[i * 2 + 1] + F.nz[i] * off * F.sc[i], x1 = pts[i * 2 + 2] + F.nx[i + 1] * off * F.sc[i + 1], z1 = pts[i * 2 + 3] + F.nz[i + 1] * off * F.sc[i + 1];
        const nxv = F.nx[i] * side, nzv = F.nz[i] * side, a = M.road.v(X(x0), gy + H[i] - 1.0, Z(z0), nxv, 0, nzv, CONCRETE), b = M.road.v(X(x1), gy + H[i + 1] - 1.0, Z(z1), nxv, 0, nzv, CONCRETE), c2 = M.road.v(X(x1), gy + H[i + 1] + 0.75, Z(z1), nxv, 0, nzv, CONCRETE), d = M.road.v(X(x0), gy + H[i] + 0.75, Z(z0), nxv, 0, nzv, CONCRETE);
        M.road.tri(a, b, c2, nxv, 0, nzv); M.road.tri(a, c2, d, nxv, 0, nzv); } };
      wall(hw + 0.2, 1); wall(-hw - 0.2, -1);
      for (let i = 0; i + 1 < F.n; i++) { const a = M.road.v(X(pts[i * 2] + F.nx[i] * (-hw - 0.2)), gy + H[i] - 1.0, Z(pts[i * 2 + 1] + F.nz[i] * (-hw - 0.2)), 0, -1, 0, CONCRETE), b = M.road.v(X(pts[i * 2] + F.nx[i] * (hw + 0.2)), gy + H[i] - 1.0, Z(pts[i * 2 + 1] + F.nz[i] * (hw + 0.2)), 0, -1, 0, CONCRETE), c2 = M.road.v(X(pts[i * 2 + 2] + F.nx[i + 1] * (hw + 0.2)), gy + H[i + 1] - 1.0, Z(pts[i * 2 + 3] + F.nz[i + 1] * (hw + 0.2)), 0, -1, 0, CONCRETE), d = M.road.v(X(pts[i * 2 + 2] + F.nx[i + 1] * (-hw - 0.2)), gy + H[i + 1] - 1.0, Z(pts[i * 2 + 3] + F.nz[i + 1] * (-hw - 0.2)), 0, -1, 0, CONCRETE); M.road.tri(a, b, c2, 0, -1, 0); M.road.tri(a, c2, d, 0, -1, 0); }
      let nextPier = 8; for (let i = 0; i < F.n; i++) if (F.arc[i] >= nextPier) { nextPier += 28; if (H[i] < 2.5) continue; const x = pts[i * 2], z = pts[i * 2 + 1]; if (!pierFree(x, z, 1.2)) continue; out.circles.push(x, z, 1.15); const px = X(x), pz = Z(z), r = 0.9, y0 = gy, y1 = gy + H[i] - 1.0; const cs = [[-r, -r], [r, -r], [r, r], [-r, r]];
        for (let k = 0; k < 4; k++) { const [x0, z0] = cs[k], [x1, z1] = cs[(k + 1) % 4], nxv = (x0 + x1) / 2 > 0 ? 1 : (x0 + x1) / 2 < 0 ? -1 : 0, nzv = (z0 + z1) / 2 > 0 ? 1 : (z0 + z1) / 2 < 0 ? -1 : 0, a = M.road.v(px + x0, y0, pz + z0, nxv, 0, nzv, CONCRETE), b = M.road.v(px + x1, y0, pz + z1, nxv, 0, nzv, CONCRETE), c2 = M.road.v(px + x1, y1, pz + z1, nxv, 0, nzv, CONCRETE), d = M.road.v(px + x0, y1, pz + z0, nxv, 0, nzv, CONCRETE); M.road.tri(a, b, c2, nxv, 0, nzv); M.road.tri(a, c2, d, nxv, 0, nzv); } }
      /* the same surface for the physics: a ribbon of triangles over the carriageway where the deck is above the ground */
      const pos = [], idx = []; let prev = -1; for (let i = 0; i < F.n; i++) { if (H[i] < 0.05 && (i + 1 >= F.n || H[i + 1] < 0.05) && (i === 0 || H[i - 1] < 0.05)) { prev = -1; continue; } const v = pos.length / 3, k = F.sc[i]; pos.push(pts[i * 2] + F.nx[i] * hw * k, gy + H[i], pts[i * 2 + 1] + F.nz[i] * hw * k, pts[i * 2] - F.nx[i] * hw * k, gy + H[i], pts[i * 2 + 1] - F.nz[i] * hw * k); if (prev >= 0) idx.push(prev, prev + 1, v, prev + 1, v + 1, v); prev = v; }
      if (idx.length) out.decks.push({ pos, idx, hw, id, lay });
    }
    /* zebra crossings: at a real end of the piece that is a node flagged crossing (2) or signal (1), stripes across the carriageway 5 m back from the node (kerbs have a gap there: see mouthFree users) */
    if (!deck && !sunk && ['primary', 'secondary', 'tertiary', 'residential'].includes(cls) && w >= 4) for (const end of [0, 1]) {
      if (clip & (end ? 2 : 1)) continue; const node = end ? G.b[id] : G.a[id], fl = G.nodeFlags[node]; if (!(fl & 3)) continue; const nx0 = G.xz[node * 2], nz0 = G.xz[node * 2 + 1], e0 = end ? pts.length - 2 : 0; if (Math.hypot(pts[e0] - nx0, pts[e0 + 1] - nz0) > 3) continue;
      const i0 = end ? F.n - 1 : 0, i1 = end ? F.n - 2 : 1, dx = pts[i1 * 2] - pts[i0 * 2], dz = pts[i1 * 2 + 1] - pts[i0 * 2 + 1], L = Math.hypot(dx, dz) || 1, tx = dx / L, tz = dz / L, cx = pts[i0 * 2] + tx * 5, cz = pts[i0 * 2 + 1] + tz * 5, nxv = -tz, nzv = tx;
      for (let o = -hw + 0.5; o < hw - 0.3; o += 1.0) { const a = [cx + nxv * o - tx * 1.4, cz + nzv * o - tz * 1.4], b = [cx + nxv * (o + 0.5) - tx * 1.4, cz + nzv * (o + 0.5) - tz * 1.4], c2 = [cx + nxv * (o + 0.5) + tx * 1.4, cz + nzv * (o + 0.5) + tz * 1.4], d = [cx + nxv * o + tx * 1.4, cz + nzv * o + tz * 1.4]; const m = M.mark, y = gy; const v0 = m.v(X(a[0]), y, Z(a[1]), 0, 1, 0, MARK), v1 = m.v(X(b[0]), y, Z(b[1]), 0, 1, 0, MARK), v2 = m.v(X(c2[0]), y, Z(c2[1]), 0, 1, 0, MARK), v3 = m.v(X(d[0]), y, Z(d[1]), 0, 1, 0, MARK); m.tri(v0, v1, v2, 0, 1, 0); m.tri(v0, v2, v3, 0, 1, 0); }
    }
    /* lane marks: a dashed line on the centre of a two-way street, between the lanes of a one-way street; none near a junction (the piece ends that are real nodes) */
    if (['motorway', 'trunk', 'primary', 'secondary', 'tertiary'].includes(cls) && w >= 5.5) {
      const divs = []; if (two) { divs.push(0); const side = Math.floor(lanes / 2); for (let k = 1; k < side; k++) divs.push(k * w / lanes, -k * w / lanes); } else for (let k = 1; k < lanes; k++) divs.push(-hw + k * w / lanes);
      const total = F.arc[F.n - 1], lo = clip & 1 ? 0 : 9, hi = total - (clip & 2 ? 0 : 9);
      const at = sa => { let i = 0; while (i + 2 < F.n && F.arc[i + 1] < sa) i++; const f = Math.max(0, Math.min(1, (sa - F.arc[i]) / Math.max(0.01, F.arc[i + 1] - F.arc[i]))), j = i + 1; return { x: pts[i * 2] + (pts[j * 2] - pts[i * 2]) * f, z: pts[i * 2 + 1] + (pts[j * 2 + 1] - pts[i * 2 + 1]) * f, nx: F.nx[i] + (F.nx[j] - F.nx[i]) * f, nz: F.nz[i] + (F.nz[j] - F.nz[i]) * f, y: H[i] + (H[j] - H[i]) * f }; };
      for (const off of divs) for (let s0 = lo; s0 + 3 < hi; s0 += 9) {
        const m = M.mark; let prev = -1; for (let k = 0; k <= 2; k++) { const q = at(s0 + k * 1.5), y = gy + q.y, e = 0.08;
          const va = m.v(X(q.x + q.nx * (off - e)), y, Z(q.z + q.nz * (off - e)), 0, 1, 0, MARK), vb = m.v(X(q.x + q.nx * (off + e)), y, Z(q.z + q.nz * (off + e)), 0, 1, 0, MARK); if (prev >= 0) { m.tri(prev, prev + 1, va, 0, 1, 0); m.tri(prev + 1, vb, va, 0, 1, 0); } prev = va; }
      }
    }
    out.claims.push({ shape: { t: 'line', pts: s.pts, hw: hw + (walk ? 1.8 : 0) }, layer: lay, owner: 'street' }); out.nStreets++;
  }
  /* ---- buildings: walls with a facade texture (u along the wall in 3.6 m bays, v in 3.2 m storeys), a flat roof ---- */
  const B = M.bldg;
  for (const b of tile.buildings) {
    if (ctx.yieldNow && ctx.yieldNow()) yield;
    const r = b.ring, n = r.length / 2; if (n < 3) continue; const L = b.landmark ? lm.get(b.landmark) : null, kit = L && L.type ? 'gov' : { office: 'off', hotel: 'off', civic: 'gov', religious: 'gov', transit: 'gov' }[b.use] || 'res', B = kit === 'off' ? M.bldgO : kit === 'gov' ? M.bldgG : M.bldg, shopB = !L && (b.use === 'commercial' || b.use === 'retail') && (b.height || 9) >= 5, hgt = Math.max(3, (L && L.height) || guessHeight(b, hash)), y0 = gy + (b.minHeight || 0), y1 = gy + hgt;
    if (L && ctx.skip && ctx.skip.has(L.id)) continue;                                    // a landmark with its own model (landmarks/, D8) is not drawn as a plain block
    let wall; if (L && L.type) wall = LM_WALL[L.type] || (L.type.includes('station') ? LM_WALL.station : 0); else wall = 0;
    if (!wall) { const pal = WALLS[b.use] || WALLS.other, k = hash(b.id); wall = pal[Math.floor(k * pal.length) % pal.length]; }
    const wc = shade(wall, 0.9 + 0.2 * hash(b.id * 7 + 1)), rc = L && L.type ? shade(wall, 0.8) : shade(0x77726a, 0.85 + 0.3 * hash(b.id * 3)); let area = 0, cx = 0, cz = 0, x0 = Infinity, x1b = -Infinity, z0 = Infinity, z1b = -Infinity;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, xi = r[i * 2], zi = r[i * 2 + 1], xj = r[j * 2], zj = r[j * 2 + 1]; area += xi * zj - xj * zi; cx += xi; cz += zi; x0 = Math.min(x0, xi); x1b = Math.max(x1b, xi); z0 = Math.min(z0, zi); z1b = Math.max(z1b, zi); }
    const ccw = area > 0;                                                                // the pack says counter-clockwise; walls are built for either
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ax = r[i * 2], az = r[i * 2 + 1], bx = r[j * 2], bz = r[j * 2 + 1], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz); if (l < 0.05) continue;
      let nx = dz / l, nz = -dx / l; if (!ccw) { nx = -nx; nz = -nz; } const u1 = l / 14.4, v0 = (y0 - gy) / 12.8, v1 = (y1 - gy) / 12.8, y2 = Math.min(y1, y0 + 2.4), AO = 0.6;
      /* a wall in two quads: the foot (2.4 m, darker at the ground like a shadow) and the rest; a shop's ground floor is its own quad with the shop-front texture */
      const quad = (m, ya, yb, ca, cb, va, vb) => { const q0 = m.v(X(ax), ya, Z(az), nx, 0, nz, ca, 0, va), q1 = m.v(X(bx), ya, Z(bz), nx, 0, nz, ca, u1, va), q2 = m.v(X(bx), yb, Z(bz), nx, 0, nz, cb, u1, vb), q3 = m.v(X(ax), yb, Z(az), nx, 0, nz, cb, 0, vb); m.tri(q0, q1, q2, nx, 0, nz); m.tri(q0, q2, q3, nx, 0, nz); };
      const dark = c0 => c0.clone().multiplyScalar(AO);
      if (shopB && y1 - y0 > 4) { const ys = y0 + 3.2, sc = shade(0xffffff, 0.7 + 0.3 * hash(b.id * 11 + i)); quad(M.shop, y0, ys, dark(sc), sc, 0, 1); quad(B, ys, y1, wc, wc, (ys - gy) / 12.8, v1); }
      else { quad(B, y0, y2, dark(wc), wc, v0, v0 + (y2 - y0) / 12.8); if (y1 > y2) quad(B, y2, y1, wc, wc, v0 + (y2 - y0) / 12.8, v1); }
      if (hgt < 60 || i % 2 === 0) { const mx = (ax + bx) / 2 - nx * 0.7, mz = (az + bz) / 2 - nz * 0.7; for (let s = 0; s < l; s += 2) { const t = (s + 1) / l; if (t > 1) break; out.circles.push(ax + dx * t - nx * WALL_R, az + dz * t - nz * WALL_R, WALL_R); } void mx; void mz; }
    }
    const contour = []; for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(r[i * 2], r[i * 2 + 1])); const holes = (b.holes || []).map(h => { const a = []; for (let i = 0; i < h.length; i += 2) a.push(new THREE.Vector2(h[i], h[i + 1])); return a; });
    let tris = null; try { tris = THREE.ShapeUtils.triangulateShape(contour, holes); } catch (e) { tris = null; }
    if (tris) { const all = contour.concat(...holes), base = B.p.length / 3; for (const q of all) B.v(X(q.x), y1, Z(q.y), 0, 1, 0, rc, 0.06, 0.06); for (const t of tris) B.tri(base + t[0], base + t[1], base + t[2], 0, 1, 0); }
    if (!L && hgt >= 6 && hgt < 40 && (x1b - x0) > 8 && (z1b - z0) > 8 && hash(b.id * 5 + 3) < 0.4) { const rx = (x0 + x1b) / 2 + (hash(b.id) - 0.5) * (x1b - x0) * 0.3, rz = (z0 + z1b) / 2 + (hash(b.id + 9) - 0.5) * (z1b - z0) * 0.3, hs = 1.2 + hash(b.id * 3) * 0.8, hh = 1.6 + hash(b.id * 13) * 1.2, tank = hash(b.id * 17) < 0.5 ? shade(0x3a5a78, 1) : shade(0x9a9890, 1);       // a water tank or a stair head on the roof
      const bx0 = B.p.length / 3; for (const [dx, dz] of [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]]) { B.v(X(rx + dx), y1, Z(rz + dz), 0, 1, 0, tank, 0.06, 0.06); B.v(X(rx + dx), y1 + hh, Z(rz + dz), 0, 1, 0, tank, 0.06, 0.06); }
      for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4, a = bx0 + k * 2, b2 = bx0 + k2 * 2, mx = (k < 2 ? 0 : 0); void mx; const ex = k === 0 ? 0 : k === 1 ? 1 : k === 2 ? 0 : -1, ez = k === 0 ? -1 : k === 1 ? 0 : k === 2 ? 1 : 0; B.tri(a, b2, b2 + 1, ex, 0, ez); B.tri(a, b2 + 1, a + 1, ex, 0, ez); }
      B.tri(bx0 + 1, bx0 + 3, bx0 + 5, 0, 1, 0); B.tri(bx0 + 1, bx0 + 5, bx0 + 7, 0, 1, 0); }
    out.nBuildings++; if (x1b - x0 > 2 && z1b - z0 > 2) out.claims.push({ shape: { t: 'rect', x: (x0 + x1b) / 2, z: (z0 + z1b) / 2, hx: (x1b - x0) / 2, hz: (z1b - z0) / 2, yaw: 0 }, kind: 'building', owner: 'building' });
    if (L && (L.importance >= 3 || (L.type || '').includes('station'))) out.labels.push({ id: L.id, text: L.name.en, x: cx / n, z: cz / n, y: y1 + 10 });
  }
  void SAND;
  /* ---- street life (D7, streetlife.js): shop boards, ads, poles and wires, stalls, shelters, trees ---- */
  if (ctx.life) { const r = yield* buildStreetLife(tile, { G, gy, size, ...ctx.life, Mesher, yieldNow: ctx.yieldNow }, out); Object.assign(M, r.M); out.life = r.stats; }
  /* ---- the meshes ---- */
  return { M, out };
}

/* the facade kits (one 256 px texture of 4 bays by 4 storeys each, and a matching map of the windows that are lit at night): residential with balconies, offices with glazing ribbons, government with arched windows and
   piers, and the shop front of a ground floor (4 bays by 1 storey). A wall's colour comes from the vertex colours and tints the plain wall; windows stay dark and, at night, glow. */
function kitTextures(kind, rnd) {
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = 256; return c; }, cv = mk(), ev = mk(), g = cv.getContext('2d'), e = ev.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256); e.fillStyle = '#000'; e.fillRect(0, 0, 256, 256);
  const lit = () => { const t = rnd(); return t < 0.45 ? '#ffd58a' : t < 0.6 ? '#bfe3ff' : null; };
  for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) { const x = q * 64, y = r * 64;
    g.fillStyle = '#d9d9d9'; g.fillRect(x, y + 58, 64, 6);                                                                     // the floor line
    if (kind === 'res') { g.fillStyle = '#4f6173'; g.fillRect(x + 14, y + 14, 36, 30); g.fillStyle = '#c4ccd2'; g.fillRect(x + 14, y + 14, 36, 4); g.fillStyle = '#e8e8e8'; g.fillRect(x + 6, y + 46, 52, 5); g.fillStyle = '#9aa3aa'; for (let k = 0; k < 7; k++) g.fillRect(x + 8 + k * 7, y + 38, 2, 8); const c = lit(); if (c) { e.fillStyle = c; e.fillRect(x + 16, y + 20, 32, 24); } }
    else if (kind === 'off') { g.fillStyle = '#3f5568'; g.fillRect(x, y + 10, 64, 40); g.fillStyle = '#9fb3c2'; for (let k = 1; k < 4; k++) g.fillRect(x + k * 16 - 1, y + 10, 2, 40); g.fillRect(x, y + 28, 64, 1); const c = lit(); if (c) { e.fillStyle = c; e.fillRect(x + 2, y + 12, 60, 36); } }
    else { g.fillStyle = '#e4dcc8'; g.fillRect(x, y, 6, 64); g.fillRect(x + 58, y, 6, 64); g.fillStyle = '#5a5144'; g.beginPath(); g.moveTo(x + 18, y + 54); g.lineTo(x + 18, y + 24); g.arc(x + 32, y + 24, 14, Math.PI, 0); g.lineTo(x + 46, y + 54); g.closePath(); g.fill(); const c = rnd() < 0.3 ? '#ffd58a' : null; if (c) { e.fillStyle = c; e.beginPath(); e.moveTo(x + 20, y + 52); e.lineTo(x + 20, y + 24); e.arc(x + 32, y + 24, 12, Math.PI, 0); e.lineTo(x + 44, y + 52); e.closePath(); e.fill(); } } }
  return [cv, ev];
}
function shopTextures(rnd) {
  const mk = () => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; return c; }, cv = mk(), ev = mk(), g = cv.getContext('2d'), e = ev.getContext('2d'); g.fillStyle = '#d8d0c0'; g.fillRect(0, 0, 256, 64); e.fillStyle = '#000'; e.fillRect(0, 0, 256, 64);
  const AW = ['#c0392b', '#2e86c1', '#e1a01e', '#2f8f5b', '#8e44ad', '#e8e2d0']; for (let q = 0; q < 4; q++) { const x = q * 64, aw = AW[Math.floor(rnd() * AW.length)];
    g.fillStyle = aw; g.fillRect(x + 2, 4, 60, 12); g.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 6; k++) g.fillRect(x + 2 + k * 10, 4, 5, 12);       // an awning with stripes
    g.fillStyle = '#2b3138'; g.fillRect(x + 4, 20, q % 2 ? 36 : 52, 36); g.fillStyle = '#6b7075'; if (q % 2) { g.fillRect(x + 44, 20, 16, 40); } else g.fillRect(x + 4, 56, 52, 4);        // glass and a shutter or a door
    e.fillStyle = rnd() < 0.8 ? '#ffe2a8' : '#cfeaff'; e.fillRect(x + 6, 22, q % 2 ? 32 : 48, 32); }
  return [cv, ev];
}
export function makeMaterials() {
  let seed = 4242; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const tex = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const noise = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 700; i++) { const v = 170 + Math.floor(rnd() * 80), r = 2 + rnd() * 9; g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.35)'; g.beginPath(); g.arc(rnd() * 128, rnd() * 128, r, 0, 7); g.fill(); } const t = tex(c); t.anisotropy = 2; return t; })();
  const flat = (f, u, map) => new THREE.MeshStandardMaterial({ vertexColors: true, map: map || null, roughness: 0.96, metalness: 0, envMapIntensity: 0.25, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: u });
  const kit = k => { const [a, b] = k === 'shop' ? shopTextures(rnd) : kitTextures(k, rnd), m = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex(a), emissive: 0xffffff, emissiveMap: tex(b), emissiveIntensity: 0, roughness: 0.92, metalness: 0, envMapIntensity: 0.3 }); m.userData.kit = true; return m; };
  const pbr = (name, tint) => { const L = new THREE.TextureLoader(), ld = (f, srgb) => { const t = L.load('assets/roads/' + name + '_' + f + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }; const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: ld('color', true), normalMap: ld('normal', false), roughnessMap: ld('rough', false), roughness: 1, metalness: 0, envMapIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -5 }); m.normalScale.set(0.8, 0.8); m.color.setScalar(tint); return m; };
  const mats = { ground: flat(-1, -1, noise), park: flat(-2, -3, noise), walk: (() => { const m = pbr('pavement', 1.55); m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; return m; })(), road: pbr('asphalt', 2.6), mark: flat(-5, -9), sky: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.25, emissive: 0xffd58a, emissiveIntensity: 0 }), bldg: kit('res'), bldgO: kit('off'), bldgG: kit('gov'), shop: kit('shop'), tex: noise };
  mats.setNight = on => { for (const k of ['bldg', 'bldgO', 'bldgG', 'shop']) mats[k].emissiveIntensity = on ? 1.1 : 0; };
  return mats;
}
