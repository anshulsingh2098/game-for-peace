/* One 1 km tile of the city pack as three.js geometry (docs/CITY_PACK.md): ground fills (blocks, land use), parks and water, street carriageways with lane marks and painted sidewalks, flyover decks with
   edges and piers, and extruded building footprints. Everything of a kind is merged into one mesh per tile, so a tile costs five draw calls. Vertices are relative to the tile's corner (tx * 1000, tz * 1000) in x
   and z and absolute in y; the flat layers lie exactly in the ground plane and are ordered by polygon offset (the terrain here is flat), so a car's wheels sit on the paint. 97 % of the building heights in
   the pack are guesses (docs/CITY_PACK.md 5a): the look is a style, not data. */
import * as THREE from 'three';
import { CP_CIRCLE } from './smooth.js';
import { deckHeight, underDepth, OPEN_CUT, pieceWidth, pieceSidewalk } from './pack.js';
import { infillSteps } from './infill.js';
import { buildingsToSkip } from './rules.js';
import { buildStreetLife } from './streetlife.js';

/* layers that lie in the ground plane are given real height steps (metres over the ground: it was 0 for all of them and only depth offsets told them apart, which shimmers with distance): ground 0, parks and water, pavement, road, markings */
const ZEBRA_MAX = 16, TEX_ROAD = 5, TEX_WALK = 4;       // metres one tile of the road and pavement textures covers (a divisor of 1000, so tiles meet without a seam)
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
const PARK = col(0xcfe69a), WATER = col(0x2f6477);
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
/* CP match: the pack gives Connaught Place's blocks 3 storeys of 3.2 m (median 9.6 m); the photographs (R1 to R4) show an arcade of about 5.5 m under three storeys, 16 to 18 m in all. Blocks of the two rings (135 to 340 m from the circle centre) that are shops, offices or unclassified are raised to 15.5 to 17.5 m. An estimate from the photos, not a survey: replace it with real heights when someone has them. */
function cpLift(b, h, hash) { if (b.infill || !b.ring || !['commercial', 'retail', 'office', 'other', undefined].includes(b.use)) return h; const d = Math.hypot(b.ring[0] - CP_CIRCLE.cx, b.ring[1] - CP_CIRCLE.cz); return d > 135 && d < 340 ? Math.max(h, 15.5 + 2 * hash(b.id * 17 + 5)) : h; }
function guessHeight(b, hash) {
  if (b.hsrc === 'tag' || b.hsrc === 'levels') return b.height || 9; const base = b.height || (b.levels ? b.levels * 3.2 : 9), k = hash(b.id * 31 + 7); let area = 0; const r = b.ring, n = r.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1]; } area = Math.abs(area) / 2;
  let lv = Math.round(base / 3.2) + (k < 0.25 ? -1 : k > 0.8 ? 1 : 0); if (b.use === 'office' || b.use === 'hotel') lv += area > 900 ? 3 : 1; else if (b.use === 'industrial') lv = Math.min(lv, 2); else if (b.use === 'residential' && area < 90) lv = Math.min(lv, 3);
  return Math.max(1, Math.min(lv, 25)) * 3.2;
}
export function buildTile(tile, ctx) { const g = buildTileSteps(tile, { ...ctx, yieldNow: null }); let r; while (!(r = g.next()).done); return r.value; }
/* Junction shaping. Each street is a rectangle that ends at the node, so where roads meet the corners are sharp (and at a bend the outside has a notch). For every node with two or more ground roads, taken in order
   round the node: where two neighbouring roads meet at an angle under 180 degrees the corner gets a fillet (asphalt between the two road edges and an arc of radius 3 to 7 m tangent to both, a kerb along the arc and
   a pavement ring outside it); where they are more than 180 degrees apart (the outside of a bend) the notch is filled with a triangle. Pure geometry into the tile's meshes. J: Map of records { x, z, dx, dz (unit,
   away from the node), hw (half carriageway), rc (road colour), len (piece length) } per node. */
function junctionShapes(J, M, X, Z, gy, out) {
  const KC = col(0xb4b0a6); let nf = 0, nn = 0;
  const rv = (x, y, z, c) => M.road.v(X(x), gy + y, Z(z), 0, 1, 0, c, X(x) / TEX_ROAD, Z(z) / TEX_ROAD), wv = (x, y, z, c, nx = 0, ny = 1, nz = 0) => M.walk.v(X(x), gy + y, Z(z), nx, ny, nz, c, X(x) / TEX_WALK, Z(z) / TEX_WALK);
  for (const l of J.values()) {
    if (l.length < 2) continue; l.sort((p, q) => Math.atan2(p.dz, p.dx) - Math.atan2(q.dz, q.dx));
    for (let k = 0; k < l.length; k++) {
      const a = l[k], b = l[(k + 1) % l.length]; let g = Math.atan2(b.dz, b.dx) - Math.atan2(a.dz, a.dx); if (g <= 0) g += Math.PI * 2;
      const nax = -a.dz, naz = a.dx, nbx = -b.dz, nbz = b.dx, hwa = a.hw, hwb = b.hw, rc = a.hw >= b.hw ? a.rc : b.rc;
      if (g > Math.PI + 0.05) {                                                               // the outside of a bend: fill the notch
        const qa = [a.x + nax * hwa, a.z + naz * hwa], qb = [b.x - nbx * hwb, b.z - nbz * hwb], v0 = rv(a.x, LIFT.road, a.z, rc), v1 = rv(qa[0], LIFT.road, qa[1], rc), v2 = rv(qb[0], LIFT.road, qb[1], rc); M.road.tri(v0, v1, v2, 0, 1, 0); nn++; continue;
      }
      if (g >= Math.PI - 0.05 || g < 0.35) continue;
      const rx = -nbx * hwb - nax * hwa, rz = -nbz * hwb - naz * hwa, det = -a.dx * b.dz + b.dx * a.dz; if (Math.abs(det) < 1e-6) continue;
      const t = (-rx * b.dz + b.dx * rz) / det, u = (a.dx * rz - a.dz * rx) / det; if (!(t > 0.2 && u > 0.2)) continue;
      const px = a.x + nax * hwa + a.dx * t, pz = a.z + naz * hwa + a.dz * t; let r = Math.min(12, Math.max(3, 1.6 * Math.max(hwa, hwb) + 1.5)), q = r / Math.tan(g / 2);       /* CP match: kerb radius grows with the road width (a 9 m road 9 m, a 13 m road 12 m; it was 3 to 7 m, which gave square corners on wide roads); the limit by piece length just below still applies */
      const qmax = Math.min(a.len * 0.9 - t, b.len * 0.9 - u); if (q > qmax) { if (qmax < 1.0) continue; q = qmax; r = q * Math.tan(g / 2); }
      const tax = px + a.dx * q, taz = pz + a.dz * q, tbx = px + b.dx * q, tbz = pz + b.dz * q; let bx = a.dx + b.dx, bz = a.dz + b.dz; const bl = Math.hypot(bx, bz); if (bl < 1e-6) continue; bx /= bl; bz /= bl;
      const cx = px + bx * (r / Math.sin(g / 2)), cz = pz + bz * (r / Math.sin(g / 2)), A0 = Math.atan2(taz - cz, tax - cx); let d = Math.atan2(tbz - cz, tbx - cx) - A0; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      const S = Math.max(3, Math.ceil(Math.abs(d) / 0.45)), arc = []; for (let i = 0; i <= S; i++) { const an = A0 + d * i / S; arc.push([cx + r * Math.cos(an), cz + r * Math.sin(an), Math.cos(an), Math.sin(an)]); }
      const vp = rv(px, LIFT.road, pz, rc), av = arc.map(p => rv(p[0], LIFT.road, p[1], rc)); for (let i = 0; i < S; i++) M.road.tri(vp, av[i], av[i + 1], 0, 1, 0);       // the asphalt between the corner and the arc
      const ri = Math.max(0.2, r - 0.3), ro = Math.max(0.1, r - 2.1);                           // kerb (0.3 m wide, 12 cm high) and the pavement ring outside the arc, toward the centre of the circle
      for (let i = 0; i < S; i++) {
        const p0 = arc[i], p1 = arc[i + 1], f0 = wv(p0[0], 0, p0[1], KC, p0[2], 0, p0[3]), f1 = wv(p1[0], 0, p1[1], KC, p1[2], 0, p1[3]), f2 = wv(p1[0], 0.12, p1[1], KC, p1[2], 0, p1[3]), f3 = wv(p0[0], 0.12, p0[1], KC, p0[2], 0, p0[3]); M.walk.tri(f0, f1, f2, p0[2], 0, p0[3]); M.walk.tri(f0, f2, f3, p0[2], 0, p0[3]);
        const k0 = wv(p0[0], 0.12, p0[1], KC), k1 = wv(p1[0], 0.12, p1[1], KC), k2 = wv(cx + (p1[0] - cx) * ri / r, 0.12, cz + (p1[1] - cz) * ri / r, KC), k3 = wv(cx + (p0[0] - cx) * ri / r, 0.12, cz + (p0[1] - cz) * ri / r, KC); M.walk.tri(k0, k1, k2, 0, 1, 0); M.walk.tri(k0, k2, k3, 0, 1, 0);
        const w0 = wv(cx + (p0[0] - cx) * ri / r, LIFT.walk + 0.025, cz + (p0[1] - cz) * ri / r, WALK), w1 = wv(cx + (p1[0] - cx) * ri / r, LIFT.walk + 0.025, cz + (p1[1] - cz) * ri / r, WALK), w2 = wv(cx + (p1[0] - cx) * ro / r, LIFT.walk + 0.025, cz + (p1[1] - cz) * ro / r, WALK), w3 = wv(cx + (p0[0] - cx) * ro / r, LIFT.walk + 0.025, cz + (p0[1] - cz) * ro / r, WALK); M.walk.tri(w0, w1, w2, 0, 1, 0); M.walk.tri(w0, w2, w3, 0, 1, 0);
      }
      nf++;
    }
  }
  out.nFillets = nf; out.nNotches = nn;
}
/* How worn a street is (0 = new and swept, 1 = broken, dusty and littered), by area: the VIP and government areas and the big landmarks are kept clean, the busy and old parts are not (owner, 20 Nov 2026: Delhi's roads are not all clean). A street within 220 m of a major landmark counts a third as much. These numbers are a judgement from the owner's description, not a survey. */
const GRIME = { lutyens: 0.08, business: 0.25, cp: 0.3, dda: 0.5, default: 0.65, market: 0.85, village: 0.9, oldDelhi: 1.0 };
const VIP_TYPES = new Set(['government', 'memorial', 'avenue', 'museum', 'convention', 'fort', 'tomb', 'monument', 'archaeological', 'observatory', 'stepwell']);      // landmarks that are kept clean around; markets, stations, temples and the busy districts are landmarks too but are not kept clean
const grimeAt = (ID, vip, x, z) => { let g = GRIME[ID && ID.areaNameAt ? ID.areaNameAt(x, z) : 'default']; if (g === undefined) g = 0.65; for (const l of vip) if (Math.hypot(l.x - x, l.z - z) < 220) { g *= 0.35; break; } return g; };

/* Road wear (the owner's GTA reference frames G1 to G5 show worn wheel tracks, patches, cracks and manholes on every road; ours was one flat colour). All in the marking layer, dark shades of asphalt, deterministic, with a budget a tile so it stays cheap. g (0 to 1, GRIME above) decides how much: wheel tracks (two 0.45 m strips a lane), tar patches, manhole covers (always), hairline cracks, and from g 0.4 up dust along the kerbs, from 0.5 potholes with a dust ring, scattered leaflets and wrappers, and from 0.55 piles of rubbish bags on the pavement edge (3D, own mesh `junk`). Set ?nowear to turn it all off. */
const WEAR = !(typeof location !== 'undefined' && new URLSearchParams(location.search).has('nowear')), W_BUDGET = { tr: 16000, pa: 1600, mh: 600, cr: 1100, du: 3000, ph: 420, lf: 3200, gb: 320 };
const LEAF = [0xe9e9e4, 0xe8d24a, 0xe58aa5, 0x6aa0e8, 0xd04a3a, 0xbdb8a8, 0xf2f2ee].map(h => col(h)), BAGS = [0x1d1d1d, 0x2e4a7a, 0xd8d8d0, 0x6b4a2a, 0x3a5a3a, 0x8a2e2e].map(h => col(h));
function junkBox(J, X, Z, cx, y0, cz, sx, sy, sz, yaw, C) {
  const c = Math.cos(yaw), sn = Math.sin(yaw), P = (a, b, y) => [cx + a * c - b * sn, y, cz + a * sn + b * c], hx = sx / 2, hz = sz / 2, q = [P(-hx, -hz, y0), P(hx, -hz, y0), P(hx, hz, y0), P(-hx, hz, y0)], t = q.map(p => [p[0], p[1] + sy, p[2]]);
  const face = (a, b, nx, ny, nz, cc) => { const i0 = J.v(X(a[0]), a[1], Z(a[2]), nx, ny, nz, cc), i1 = J.v(X(b[0]), b[1], Z(b[2]), nx, ny, nz, cc), i2 = J.v(X(b[0]), b[1] + sy * (a[1] === y0 ? 1 : 0), Z(b[2]), nx, ny, nz, cc); void i2; return [i0, i1]; };
  for (let k = 0; k < 4; k++) { const a = q[k], b = q[(k + 1) % 4], mx = (a[0] + b[0]) / 2 - cx, mz = (a[2] + b[2]) / 2 - cz, l = Math.hypot(mx, mz) || 1, nx = mx / l, nz = mz / l, v0 = J.v(X(a[0]), y0, Z(a[2]), nx, 0, nz, C), v1 = J.v(X(b[0]), y0, Z(b[2]), nx, 0, nz, C), v2 = J.v(X(b[0]), y0 + sy, Z(b[2]), nx, 0, nz, C), v3 = J.v(X(a[0]), y0 + sy, Z(a[2]), nx, 0, nz, C); J.tri(v0, v1, v2, nx, 0, nz); J.tri(v0, v2, v3, nx, 0, nz); }
  const tv = t.map(p => J.v(X(p[0]), p[1], Z(p[2]), 0, 1, 0, C.clone().multiplyScalar(1.15))); J.tri(tv[0], tv[1], tv[2], 0, 1, 0); J.tri(tv[0], tv[2], tv[3], 0, 1, 0); void face;
}
function wearDetail(m, J, F, pts, H, w, hw, id, gy, X, Z, two, B, g, walk) {
  const total = F.arc[F.n - 1], lo = 7, hi = total - 7; if (hi - lo < 10) return;
  const at = sa => { let i = 0; while (i + 2 < F.n && F.arc[i + 1] < sa) i++; const f = Math.max(0, Math.min(1, (sa - F.arc[i]) / Math.max(0.01, F.arc[i + 1] - F.arc[i]))), j = i + 1; return { x: pts[i * 2] + (pts[j * 2] - pts[i * 2]) * f, z: pts[i * 2 + 1] + (pts[j * 2 + 1] - pts[i * 2 + 1]) * f, nx: F.nx[i] + (F.nx[j] - F.nx[i]) * f, nz: F.nz[i] + (F.nz[j] - F.nz[i]) * f, y: H[i] + (H[j] - H[i]) * f }; };
  const y = q => gy + q.y + LIFT.mark - 0.012, V = (q, off, C) => m.v(X(q.x + q.nx * off), y(q), Z(q.z + q.nz * off), 0, 1, 0, C), lerpC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
  const TRK = lerpC(0x151517, 0x0b0b0c, g), PD = col(0x17171a), PL = col(0x3d3d43), MH = col(0x26262a), RIM = col(0x4a4a50), CRK = col(0x111113), DUST = col(0x77705f), HOLE = col(0x0e0e10), HRIM = col(0x58524a);
  const lanes = Math.max(two ? 2 : 1, Math.round(w / 3.4)), lw = w / lanes, len = hi - lo, rnd = k => hash(id * 977 + k * 131);
  if (g >= 0.35 && B.tr < W_BUDGET.tr) for (let k = 0; k < lanes; k++) { const c = -hw + (k + 0.5) * lw; for (const side of [-0.8, 0.8]) { let s0 = lo + rnd(2000 + k * 3 + (side > 0 ? 1 : 0)) * 12; while (s0 < hi) { const seg = 8 + rnd(2100 + (s0 | 0) + k) * 24, gap = 4 + rnd(2200 + (s0 | 0) + k) * 14, e0 = Math.min(hi, s0 + seg); let prev = -1; for (let t = s0; t <= e0 + 0.01; t += 6) { const q = at(Math.min(t, e0)), wd = 0.17 + 0.07 * rnd(2300 + (t | 0)), a = V(q, c + side - wd, TRK), b = V(q, c + side + wd, TRK); if (prev >= 0) { m.tri(prev, prev + 1, a, 0, 1, 0); m.tri(prev + 1, b, a, 0, 1, 0); B.tr += 2; } prev = a; } s0 = e0 + gap; } } }      /* wheel tracks: only where the road is worn (g 0.35 and up), in broken lengths with gaps, a neutral dark close to the asphalt: the first version ran unbroken the whole length in a bluish grey that read as drawn lines (owner, 20 Nov 2026) */
  for (let k = 0, n = Math.floor(len / 38 * (0.15 + 1.9 * g) + rnd(1)); k < n && B.pa < W_BUDGET.pa; k++) { const s0 = lo + rnd(10 + k) * len, q = at(s0), lat = (rnd(20 + k) - 0.5) * (w - 2.4), lx = 1.2 + rnd(30 + k) * 2.8, lz = 0.8 + rnd(40 + k) * 1.4, C = rnd(50 + k) < 0.6 ? PD : PL, q2 = at(Math.min(hi, s0 + lx)), a = V(q, lat - lz / 2, C), b = V(q, lat + lz / 2, C), c2 = V(q2, lat + lz / 2, C), d = V(q2, lat - lz / 2, C); m.tri(a, b, c2, 0, 1, 0); m.tri(a, c2, d, 0, 1, 0); B.pa++; }
  for (let k = 0, n = Math.floor(len / 55 + rnd(2)); k < n && B.mh < W_BUDGET.mh; k++) { const s0 = lo + rnd(60 + k) * len, q = at(s0), lat = -hw + (Math.floor(rnd(70 + k) * lanes) + 0.5) * lw + (rnd(80 + k) - 0.5) * 0.8, cx = q.x + q.nx * lat, cz = q.z + q.nz * lat, yy = y(q) + 0.004; let first = -1; for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; const v = m.v(X(cx + Math.cos(an) * 0.4), yy, Z(cz + Math.sin(an) * 0.4), 0, 1, 0, i % 2 ? RIM : MH); if (first < 0) first = v; } const ctr = m.v(X(cx), yy, Z(cz), 0, 1, 0, MH); for (let i = 0; i < 8; i++) m.tri(ctr, first + i, first + (i + 1) % 8, 0, 1, 0); B.mh++; }
  for (let k = 0, n = Math.floor(len / 45 * (0.1 + 2.2 * g) + rnd(3)); k < n && B.cr < W_BUDGET.cr; k++) { const s0 = lo + rnd(90 + k) * len, lat = (rnd(100 + k) - 0.5) * (w - 2); let prev = -1; for (let j = 0; j < 4; j++) { const q = at(Math.min(hi, s0 + j * 1.6)), l2 = lat + (rnd(110 + k * 7 + j) - 0.5) * 0.9, a = V(q, l2 - 0.03, CRK), b = V(q, l2 + 0.03, CRK); if (prev >= 0) { m.tri(prev, prev + 1, a, 0, 1, 0); m.tri(prev + 1, b, a, 0, 1, 0); } prev = a; } B.cr++; }
  if (g > 0.4) {
    for (const side of [-1, 1]) { let prev = -1; for (let s0 = lo; s0 <= hi; s0 += 5) { if (rnd(200 + s0 * 3 + side) < 0.3) { prev = -1; continue; } const q = at(s0), wd = (0.4 + rnd(300 + s0) * 1.0) * g, e = side * hw, a = V(q, e, DUST), b = V(q, e - side * wd, DUST); if (prev >= 0 && B.du < W_BUDGET.du) { m.tri(prev, prev + 1, a, 0, 1, 0); m.tri(prev + 1, b, a, 0, 1, 0); B.du += 2; } prev = a; } }
    for (let k = 0, n = Math.floor(len / 5 * g * 1.1); k < n && B.lf < W_BUDGET.lf; k++) { const q = at(lo + rnd(400 + k) * len), side = rnd(500 + k) < 0.5 ? -1 : 1, lat = side * (hw - 0.25 - rnd(600 + k) * 1.4), sz = 0.1 + rnd(700 + k) * 0.2, an = rnd(800 + k) * 6.283, C = LEAF[Math.floor(rnd(900 + k) * LEAF.length)], cx = q.x + q.nx * lat, cz = q.z + q.nz * lat, yy = y(q) + 0.006, ca = Math.cos(an) * sz, sa = Math.sin(an) * sz, a = m.v(X(cx - ca), yy, Z(cz - sa), 0, 1, 0, C), b = m.v(X(cx + sa), yy, Z(cz - ca), 0, 1, 0, C), c2 = m.v(X(cx + ca), yy, Z(cz + sa), 0, 1, 0, C), d = m.v(X(cx - sa), yy, Z(cz + ca), 0, 1, 0, C); m.tri(a, b, c2, 0, 1, 0); m.tri(a, c2, d, 0, 1, 0); B.lf++; }
  }
  if (g > 0.5) for (let k = 0, n = Math.floor(len / 45 * (g - 0.4) * 3 + rnd(4)); k < n && B.ph < W_BUDGET.ph; k++) { const q = at(lo + rnd(1000 + k) * len), lat = -hw + (Math.floor(rnd(1100 + k) * lanes) + 0.5) * lw + (rnd(1200 + k) - 0.5) * 1.6, r = 0.35 + rnd(1300 + k) * 0.5, cx = q.x + q.nx * lat, cz = q.z + q.nz * lat, yy = y(q) + 0.003; for (const [rr, C, dy] of [[r * 1.4, HRIM, 0], [r, HOLE, 0.004]]) { const ctr = m.v(X(cx), yy + dy, Z(cz), 0, 1, 0, C); let first = -1; for (let i = 0; i < 7; i++) { const an = i * 6.283 / 7, rj = rr * (0.8 + 0.4 * hash(id * 31 + k * 7 + i)); const v = m.v(X(cx + Math.cos(an) * rj), yy + dy, Z(cz + Math.sin(an) * rj), 0, 1, 0, C); if (first < 0) first = v; } for (let i = 0; i < 7; i++) m.tri(ctr, first + i, first + (i + 1) % 7, 0, 1, 0); } B.ph++; }
  if (g > 0.55 && J) for (let k = 0, n = Math.floor(len / 70 * (g - 0.4) * 2.5 + rnd(5) * g); k < n && B.gb < W_BUDGET.gb; k++) { const q = at(lo + rnd(1400 + k) * len), side = rnd(1500 + k) < 0.5 ? -1 : 1, off = hw + (walk ? 0.7 : 0.4), cx = q.x + q.nx * side * off, cz = q.z + q.nz * side * off, base = gy + q.y + (walk ? 0.13 : 0.03); for (let b = 0, nb = 3 + Math.floor(rnd(1600 + k) * 3); b < nb; b++) junkBox(J, X, Z, cx + (hash(id * 17 + k * 5 + b) - 0.5) * 1.1, base + (b > 2 ? 0.3 : 0), cz + (hash(id * 19 + k * 3 + b) - 0.5) * 1.1, 0.35 + hash(id + k + b * 9) * 0.35, 0.22 + hash(id * 3 + k + b) * 0.3, 0.35 + hash(id * 5 + k + b * 7) * 0.3, hash(id + b * 13 + k) * 6.28, BAGS[Math.floor(hash(id * 7 + k * 11 + b) * BAGS.length)]); B.gb++; }
}

/* Road signs on poles at signalled junctions: a blue street-name blade with the real street name as lettering, a speed-limit disc, a one-way arrow on one-way streets. One texture atlas drawn in code (icons in the top row, names lazily below, 56 names), material `rsign`. Own work, no outside image; the Hindi and English names come from the pack. */
let SIGNATLAS = null;
function makeSignAtlas() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.fillStyle = '#7a7d80'; g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const cell = i => ({ x: (i % 8) * 128, y: Math.floor(i / 8) * 128 }), icon = (i, f) => { const p = cell(i); g.save(); g.translate(p.x, p.y); f(g); g.restore(); };
  const disc = (g2, fill, ring) => { g2.fillStyle = ring; g2.beginPath(); g2.arc(64, 64, 62, 0, 7); g2.fill(); g2.fillStyle = fill; g2.beginPath(); g2.arc(64, 64, 46, 0, 7); g2.fill(); };
  icon(0, g2 => { disc(g2, '#c8202a', '#c8202a'); g2.fillStyle = '#fff'; g2.fillRect(24, 54, 80, 20); });                        // no entry
  icon(1, g2 => { g2.fillStyle = '#1c4f9c'; g2.fillRect(4, 4, 120, 120); g2.fillStyle = '#fff'; g2.fillRect(20, 52, 62, 24); g2.beginPath(); g2.moveTo(76, 30); g2.lineTo(110, 64); g2.lineTo(76, 98); g2.fill(); });      // one way
  [30, 40, 50, 60].forEach((v, k) => icon(2 + k, g2 => { disc(g2, '#fafafa', '#c8202a'); g2.fillStyle = '#111'; g2.font = 'bold 54px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(String(v), 64, 68); }));
  icon(6, g2 => { g2.fillStyle = '#c8202a'; g2.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; g2.lineTo(64 + 62 * Math.cos(a), 64 + 62 * Math.sin(a)); } g2.fill(); g2.fillStyle = '#fff'; g2.font = 'bold 34px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('STOP', 64, 66); });
  const names = new Map(); let next = 0;
  const uvOf = (x, y, w, h) => [(x + 2) / S, 1 - (y + h - 2) / S, (x + w - 2) / S, 1 - (y + 2) / S];
  SIGNATLAS = { tex, icon: i => { const p = cell(i); return uvOf(p.x, p.y, 128, 128); }, plain: [0.9, 0.92, 0.95, 0.95],
    name(txt) { if (names.has(txt)) return names.get(txt); const k = next++ % 56, x = (k % 4) * 256, y = 128 + Math.floor(k / 4) * 64; g.fillStyle = '#1c4f9c'; g.fillRect(x, y, 256, 64); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(x + 3, y + 3, 250, 58); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 30; g.font = 'bold ' + fs + 'px sans-serif'; while (g.measureText(txt).width > 232 && fs > 12) { fs -= 2; g.font = 'bold ' + fs + 'px sans-serif'; } g.fillText(txt, x + 128, y + 34); tex.needsUpdate = true; const uv = uvOf(x, y, 256, 64); names.set(txt, uv); return uv; } };
  return SIGNATLAS;
}
const SPEEDS = [30, 40, 50, 60];
function signPole(M, X, Z, gy, bx, bz, tx, tz, nx, nz, name, speed, oneway) {
  const m = M.rsign, A = SIGNATLAS, y0 = gy + 0.12, pw = 0.045, pu = A.plain;
  const plate = (cy, w, h, uv, ox = 0) => { const cx = bx + nx * 0.07 + tx * ox, cz = bz + nz * 0.07 + tz * ox, a = m.v(X(cx - tx * w / 2), cy - h / 2, Z(cz - tz * w / 2), nx, 0, nz, WHITE_C, uv[0], uv[1]), b = m.v(X(cx + tx * w / 2), cy - h / 2, Z(cz + tz * w / 2), nx, 0, nz, WHITE_C, uv[2], uv[1]), c2 = m.v(X(cx + tx * w / 2), cy + h / 2, Z(cz + tz * w / 2), nx, 0, nz, WHITE_C, uv[2], uv[3]), d = m.v(X(cx - tx * w / 2), cy + h / 2, Z(cz - tz * w / 2), nx, 0, nz, WHITE_C, uv[0], uv[3]); m.tri(a, b, c2, nx, 0, nz); m.tri(a, c2, d, nx, 0, nz); };
  for (const [dx, dz] of [[tx, tz], [nx, nz]]) { const a = m.v(X(bx - dx * pw), y0, Z(bz - dz * pw), nz, 0, -nx, WHITE_C, pu[0], pu[1]), b = m.v(X(bx + dx * pw), y0, Z(bz + dz * pw), nz, 0, -nx, WHITE_C, pu[2], pu[1]), c2 = m.v(X(bx + dx * pw), y0 + 3.4, Z(bz + dz * pw), nz, 0, -nx, WHITE_C, pu[2], pu[3]), d = m.v(X(bx - dx * pw), y0 + 3.4, Z(bz - dz * pw), nz, 0, -nx, WHITE_C, pu[0], pu[3]); m.tri(a, b, c2, nz, 0, -nx); m.tri(a, c2, d, nz, 0, -nx); }
  if (name) plate(y0 + 3.05, 1.5, 0.375, A.name(name)); if (speed) plate(y0 + 2.35, 0.62, 0.62, A.icon(2 + Math.max(0, SPEEDS.indexOf(speed)))); if (oneway) plate(y0 + 1.7, 0.55, 0.55, A.icon(1));
}
const WHITE_C = new THREE.Color(0xffffff);

export function* buildTileSteps(tile, ctx) {
  const { G, lm, gy, size } = ctx, ox = tile.tx * size, oz = tile.tz * size, M = { ground: new Mesher(), park: new Mesher(), lawn: new Mesher(), walk: new Mesher(), plaza: new Mesher(), rsign: new Mesher(), junk: new Mesher(), road: new Mesher(), mark: new Mesher(), bldg: new Mesher(), bldgO: new Mesher(), bldgG: new Mesher(), shop: new Mesher(), infill: new Mesher(), infillShop: new Mesher() };
  const out = { circles: [], decks: [], cuts: [], claims: [], labels: [], nBuildings: 0, nStreets: 0 }, X = x => x - ox, Z = z => z - oz;
  const flat = (m, ring, holes, c, y, uvs = 11) => {                                           // a polygon (ring and holes in metres) lying at height y; uvs: metres one texture repeat covers
    const clean = r => { const n = r.length / 2; if (n > 1 && r[0] === r[r.length - 2] && r[1] === r[r.length - 1]) return r.slice(0, -2); return r; };
    const R = clean(ring), contour = []; for (let i = 0; i < R.length; i += 2) contour.push(new THREE.Vector2(R[i], R[i + 1])); const H = (holes || []).map(h => { const c2 = clean(h), a = []; for (let i = 0; i < c2.length; i += 2) a.push(new THREE.Vector2(c2[i], c2[i + 1])); return a; });
    if (contour.length < 3) return; let tris; try { tris = THREE.ShapeUtils.triangulateShape(contour, H); } catch (e) { return; }
    const all = contour.concat(...H), base = m.p.length / 3; for (const q of all) m.v(X(q.x), gy + y, Z(q.y), 0, 1, 0, c, q.x / uvs, q.y / uvs);
    for (const t of tris) m.tri(base + t[0], base + t[1], base + t[2], 0, 1, 0);
  };
  /* ---- ground: land use first, then blocks, parks and water ---- */
  for (const l of tile.landuse) { const c = BLOCK[l.class]; if (c && !['residential', 'commercial', 'retail', 'industrial'].includes(l.class)) flat(M.ground, l.ring, l.holes, c, 0); }
  /* the land between the streets: lawns (green, the real grass texture) where the area is green (Lutyens' Delhi, DDA colonies, business parks) or the block is mapped as grass or a garden, dusty earth elsewhere (the sand texture, warm, not a grey blotch) */
  const IDN = ctx.life && ctx.life.identity, GREEN_AREAS = new Set(['lutyens', 'dda', 'business']), GREEN_USE = new Set(['grass', 'meadow', 'recreation_ground', 'village_green', 'park', 'garden', 'forest', 'flowerbed']);
  for (const b of tile.blocks) { let cx = 0, cz = 0; const n = b.ring.length / 2; for (let i = 0; i < n; i++) { cx += b.ring[i * 2]; cz += b.ring[i * 2 + 1]; } cx /= n || 1; cz /= n || 1;
    const an = IDN && IDN.areaNameAt ? IDN.areaNameAt(cx, cz) : '', h = ((Math.floor(cx * 0.37) * 73856093) ^ (Math.floor(cz * 0.37) * 19349663)) >>> 0, v = (h % 1000) / 1000;
    if (GREEN_USE.has(b.landuse) || (GREEN_AREAS.has(an) && v < 0.8)) flat(M.lawn, b.ring, b.holes, shade(0xcfe69a, 0.82 + 0.3 * v), LIFT.park * 0.5);
    else if (an === 'cp' && Math.hypot(cx - CP_CIRCLE.cx, cz - CP_CIRCLE.cz) < CP_CIRCLE.PLAZA_R) flat(M.plaza, b.ring, b.holes, shade(0xc9c0aa, 0.94 + 0.1 * v), 0, 4.8);       // CP match (photos R2 to R4): the ground between the roads and the colonnades is stone slabs, not earth; 1.2 m slabs, 4 by 4 to a texture repeat
    else flat(M.ground, b.ring, b.holes, shade(0xb9a888, 0.85 + 0.25 * v), 0); }
  const PARKC = { forest: shade(0xb4cf86, 0.72), scrub: col(0xd6c98e), sports: shade(0xe2f6aa, 1.0), golf: shade(0xe2f6aa, 1.05), garden: shade(0xd3ec9e, 0.95) };
  for (const p of tile.parks) flat(M.lawn, p.ring, p.holes, PARKC[p.class] || PARK, LIFT.park);          // by class: forest deeper green, scrub dry olive, sports and golf bright
  /* the Yamuna floodplain and other farmland: fields in greens and ochres (they were left as bare ground) */
  for (const l of tile.landuse) if (l.class === 'farmland') { let cx = 0, cz = 0; const n = l.ring.length / 2; for (let i = 0; i < n; i++) { cx += l.ring[i * 2]; cz += l.ring[i * 2 + 1]; } cx /= n || 1; cz /= n || 1; const v = (((Math.floor(cx * 0.21) * 73856093) ^ (Math.floor(cz * 0.21) * 19349663)) >>> 0) % 1000 / 1000; flat(M.lawn, l.ring, l.holes, v < 0.45 ? shade(0xcde88c, 0.85 + 0.3 * v) : v < 0.8 ? shade(0xe6dc8a, 0.9 + 0.2 * v) : shade(0xcab27a, 0.9), LIFT.park * 0.4); }          // lawns and gardens: the real grass texture (mats.lawn), the water stays plain
  for (const w of tile.water) flat(M.park, w.ring, w.holes, WATER, LIFT.park);
  /* ---- streets ---- */
  const groundSeg = new Map(), CELLQ = 24;                                           // ground carriageways of this tile, to keep flyover piers out of them
  const hashSeg = (x0, z0, x1, z1, hw, id) => { const a = Math.floor(Math.min(x0, x1) / CELLQ), b = Math.floor(Math.max(x0, x1) / CELLQ), c = Math.floor(Math.min(z0, z1) / CELLQ), d = Math.floor(Math.max(z0, z1) / CELLQ); for (let i = a; i <= b; i++) for (let j = c; j <= d; j++) { const k = i + ',' + j; let l = groundSeg.get(k); if (!l) groundSeg.set(k, l = []); l.push([x0, z0, x1, z1, hw, id]); } };
  const pierFree = (x, z, r) => { const l = groundSeg.get(Math.floor(x / CELLQ) + ',' + Math.floor(z / CELLQ)); if (!l) return true; for (const [x0, z0, x1, z1, hw] of l) { const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2)) : 0; if (Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t)) < hw + r) return false; } return true; };
  for (const s of tile.streets) { const lay = G.layer[s.id]; if (lay === 0) { const w = pieceWidth(G, s) / 2 + 1; for (let i = 0; i + 3 < s.pts.length; i += 2) hashSeg(s.pts[i], s.pts[i + 1], s.pts[i + 2], s.pts[i + 3], w, s.id); } }
  /* is (x, z) clear of every ground carriageway of the tile except street `id`'s own (a kerb stops at a side street's mouth) */
  const mouthFree = (x, z, id) => { const l = groundSeg.get(Math.floor(x / CELLQ) + ',' + Math.floor(z / CELLQ)); if (!l) return true; for (const [x0, z0, x1, z1, hw, sid] of l) { if (sid === id) continue; const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2)) : 0; if (Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t)) < hw - 0.3) return false; } return true; };
  /* the direction (unit dx, dz) of the nearest OTHER ground street's segment whose carriageway covers (x, z), or null: what a footway is crossing */
  const roadAt = (x, z, id) => { const l = groundSeg.get(Math.floor(x / CELLQ) + ',' + Math.floor(z / CELLQ)); if (!l) return null; let best = null, bd = 1e9; for (const [x0, z0, x1, z1, hw, sid] of l) { if (sid === id || hw < 3.0) continue; const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2)) : 0, d = Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t)); if (d < hw - 0.3 && d < bd) { bd = d; const Ls = Math.sqrt(L2) || 1; best = { dx: dx / Ls, dz: dz / Ls }; } } return best; };
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
  /* junctions (see junctionShapes below): every ground road end, grouped by the node it ends at */
  const J = new Map(), ROADJ = new Set(['primary', 'secondary', 'tertiary', 'residential']);
  const addJ = (p, hw, rc, cls) => { const n2 = p.length / 2; let len = 0; for (let i = 0; i + 3 < p.length; i += 2) len += Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]); if (len < 6) return; for (const [i0, i1] of [[0, 1], [n2 - 1, n2 - 2]]) { const x = p[i0 * 2], z = p[i0 * 2 + 1]; let j = i1; while (j >= 0 && j < n2 && Math.hypot(p[j * 2] - x, p[j * 2 + 1] - z) < 0.5) j += i1 > i0 ? 1 : -1; if (j < 0 || j >= n2) continue; const dx = p[j * 2] - x, dz = p[j * 2 + 1] - z, L = Math.hypot(dx, dz), k = Math.round(x * 10) + ',' + Math.round(z * 10); let l = J.get(k); if (!l) J.set(k, l = []); l.push({ x, z, dx: dx / L, dz: dz / L, hw, rc, len, cls }); } };
  /* the list of streets sorted so that small roads are drawn first (their order only matters for z fighting at junctions, which the offsets below settle) */
  const IDW = ctx.life && ctx.life.identity, vipLm = [...lm.values()].filter(l => l.importance >= 3 && VIP_TYPES.has(l.type));                       // wear by area and landmark: grimeAt
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
    if (cls === 'footway' || cls === 'cycleway') {                                         // a footway: grey beside the streets; where it crosses a carriageway at a real angle over a short span it is a zebra crossing (white bars across the road); a footway that runs along or inside a lane stays grey
      const mk = M.mark, WH = col(0xf1eee4), nseg = F.n - 1, info = []; let arc = 0, nextBar = 0.5;
      for (let i = 0; i < nseg; i++) { const dx = pts[i * 2 + 2] - pts[i * 2], dz = pts[i * 2 + 3] - pts[i * 2 + 1], L = Math.hypot(dx, dz); let cand = false, inR = false; if (L > 1e-6 && cls === 'footway') { const r = roadAt((pts[i * 2] + pts[i * 2 + 2]) / 2, (pts[i * 2 + 1] + pts[i * 2 + 3]) / 2, id); if (r) { inR = true; cand = Math.abs((dx * r.dz - dz * r.dx) / L) >= 0.64; } } info.push({ L, cand, inR, ok: false }); }
      for (let i = 0; i < nseg;) { if (!info[i].cand) { i++; continue; } let j = i, len = 0; while (j < nseg && info[j].cand) { len += info[j].L; j++; } const ok = len <= ZEBRA_MAX; for (let q = i; q < j; q++) info[q].ok = ok; i = j; }       // a run of crossing segments is a zebra only when it is short (a road is crossed in 16 m or less)
      for (let i = 0; i < nseg; i++) {
        const x0 = pts[i * 2], z0 = pts[i * 2 + 1], x1 = pts[i * 2 + 2], z1 = pts[i * 2 + 3], dx = x1 - x0, dz = z1 - z0, L = info[i].L; if (L < 1e-6) continue; const ux = dx / L, uz = dz / L, nxs = -uz, nzs = ux;
        if (!info[i].ok && info[i].inR) { arc += L; continue; }       // a footway lying inside a carriageway and not crossing it (mapped along the road's centre or inside its guessed width) is not drawn: it would lie on the asphalt
        if (!info[i].ok) { const ya = gy + H[i] + LIFT.walk + 0.025, yb = gy + H[i + 1] + LIFT.walk + 0.025, k0 = F.sc[i], k1 = F.sc[i + 1]; const a0 = m0(M.walk, X(x0 + F.nx[i] * -hw * k0), ya, Z(z0 + F.nz[i] * -hw * k0), rc), a1 = m0(M.walk, X(x0 + F.nx[i] * hw * k0), ya, Z(z0 + F.nz[i] * hw * k0), rc), b0 = m0(M.walk, X(x1 + F.nx[i + 1] * -hw * k1), yb, Z(z1 + F.nz[i + 1] * -hw * k1), rc), b1 = m0(M.walk, X(x1 + F.nx[i + 1] * hw * k1), yb, Z(z1 + F.nz[i + 1] * hw * k1), rc); M.walk.tri(a0, a1, b0, 0, 1, 0); M.walk.tri(a1, b1, b0, 0, 1, 0); }
        else { while (nextBar < arc + L) { const t = (nextBar - arc) / L, cx = x0 + dx * t, cz = z0 + dz * t, y = gy + H[i] + LIFT.mark, hl = Math.max(hw, 1.1), bw = 0.25; const q0 = mk.v(X(cx - ux * bw + nxs * hl), y, Z(cz - uz * bw + nzs * hl), 0, 1, 0, WH), q1 = mk.v(X(cx + ux * bw + nxs * hl), y, Z(cz + uz * bw + nzs * hl), 0, 1, 0, WH), q2 = mk.v(X(cx + ux * bw - nxs * hl), y, Z(cz + uz * bw - nzs * hl), 0, 1, 0, WH), q3 = mk.v(X(cx - ux * bw - nxs * hl), y, Z(cz - uz * bw - nzs * hl), 0, 1, 0, WH); mk.tri(q0, q1, q2, 0, 1, 0); mk.tri(q0, q2, q3, 0, 1, 0); nextBar += 0.9; } }
        arc += L;
      }
      out.nStreets++; continue;
    }
    strip(M.road, -hw, hw, rc, 0); if (lay === 0 && !sunk && ROADJ.has(cls) && s.pts.length >= 4) addJ(s.pts, hw, rc, cls);
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
      for (let o = -hw + 0.5; o < hw - 0.3; o += 1.0) { const a = [cx + nxv * o - tx * 1.4, cz + nzv * o - tz * 1.4], b = [cx + nxv * (o + 0.5) - tx * 1.4, cz + nzv * (o + 0.5) - tz * 1.4], c2 = [cx + nxv * (o + 0.5) + tx * 1.4, cz + nzv * (o + 0.5) + tz * 1.4], d = [cx + nxv * o + tx * 1.4, cz + nzv * o + tz * 1.4]; const m = M.mark, y = gy + LIFT.mark; const v0 = m.v(X(a[0]), y, Z(a[1]), 0, 1, 0, MARK), v1 = m.v(X(b[0]), y, Z(b[1]), 0, 1, 0, MARK), v2 = m.v(X(c2[0]), y, Z(c2[1]), 0, 1, 0, MARK), v3 = m.v(X(d[0]), y, Z(d[1]), 0, 1, 0, MARK); m.tri(v0, v1, v2, 0, 1, 0); m.tri(v0, v2, v3, 0, 1, 0); }
      /* a stop line at a signal: 8.2 m back from the node (3 m behind the zebra), 0.5 m thick, across the lanes that arrive at the node: the half on the (-tz, tx) side of a two-way street (traffic keeps left, citytraffic.js), the whole width of a one-way street (CP match, reference R3: stop lines at the circle entries) */
      if (fl & 1) { const sx = pts[i0 * 2] + tx * 8.2, sz = pts[i0 * 2 + 1] + tz * 8.2, o0 = two ? 0.25 : -hw + 0.25, o1 = hw - 0.25, m = M.mark, y = gy + LIFT.mark, P = (o, d) => m.v(X(sx + nxv * o + tx * d), y, Z(sz + nzv * o + tz * d), 0, 1, 0, MARK); if (o1 - o0 > 1) { const q0 = P(o0, -0.25), q1 = P(o1, -0.25), q2 = P(o1, 0.25), q3 = P(o0, 0.25); m.tri(q0, q1, q2, 0, 1, 0); m.tri(q0, q2, q3, 0, 1, 0); out.nStop = (out.nStop || 0) + 1; }
        if (SIGNATLAS && (out.nPole || 0) < 40) { const nm = G.names && G.name ? G.names[G.name[id]] : null, en = nm && (typeof nm === 'string' ? nm : nm.en || nm.ref || ''), sp0 = G.speed ? G.speed[id] : 0, sp = sp0 >= 25 && sp0 <= 100 ? SPEEDS.reduce((b, v) => Math.abs(v - sp0) < Math.abs(b - v) ? v : b, 30) : ({ residential: 30, tertiary: 40, secondary: 50, primary: 60, trunk: 60 }[cls] || 40), off = hw + 0.9; signPole(M, X, Z, gy, sx + nxv * off, sz + nzv * off, nxv, nzv, tx, tz, en || null, sp, !two); out.nPole = (out.nPole || 0) + 1; } }
    }
    /* lane marks: a dashed line on the centre of a two-way street, between the lanes of a one-way street; none near a junction (the piece ends that are real nodes) */
    if (['motorway', 'trunk', 'primary', 'secondary', 'tertiary'].includes(cls) && w >= 5.5) {
      const divs = []; if (two) { divs.push(0); const side = Math.floor(lanes / 2); for (let k = 1; k < side; k++) divs.push(k * w / lanes, -k * w / lanes); } else { const nl = Math.max(lanes, Math.round(w / 3.3)); for (let k = 1; k < nl; k++) divs.push(-hw + k * w / nl); }       /* a wide one-way road tagged with one lane (the CP circles: 9 m, 1 lane) gets lane lines by its width, one per 3.3 m */
      const total = F.arc[F.n - 1], lo = clip & 1 ? 0 : 9, hi = total - (clip & 2 ? 0 : 9);
      const at = sa => { let i = 0; while (i + 2 < F.n && F.arc[i + 1] < sa) i++; const f = Math.max(0, Math.min(1, (sa - F.arc[i]) / Math.max(0.01, F.arc[i + 1] - F.arc[i]))), j = i + 1; return { x: pts[i * 2] + (pts[j * 2] - pts[i * 2]) * f, z: pts[i * 2 + 1] + (pts[j * 2 + 1] - pts[i * 2 + 1]) * f, nx: F.nx[i] + (F.nx[j] - F.nx[i]) * f, nz: F.nz[i] + (F.nz[j] - F.nz[i]) * f, y: H[i] + (H[j] - H[i]) * f }; };
      for (const off of divs) for (let s0 = lo; s0 + 3 < hi; s0 += 9) {
        const m = M.mark; let prev = -1; for (let k = 0; k <= 2; k++) { const q = at(s0 + k * 1.5), y = gy + q.y + LIFT.mark, e = 0.08;
          const va = m.v(X(q.x + q.nx * (off - e)), y, Z(q.z + q.nz * (off - e)), 0, 1, 0, MARK), vb = m.v(X(q.x + q.nx * (off + e)), y, Z(q.z + q.nz * (off + e)), 0, 1, 0, MARK); if (prev >= 0) { m.tri(prev, prev + 1, va, 0, 1, 0); m.tri(prev + 1, vb, va, 0, 1, 0); } prev = va; }
      }
    }
    if (!deck && !sunk && lay === 0 && ['trunk', 'primary', 'secondary', 'tertiary', 'residential'].includes(cls) && w >= 5.5 && WEAR) { const mi = (pts.length / 4) | 0, g = grimeAt(IDW, vipLm, pts[mi * 2], pts[mi * 2 + 1]); wearDetail(M.mark, M.junk, F, pts, H, w, hw, id, gy, X, Z, two, out.wear || (out.wear = { tr: 0, pa: 0, mh: 0, cr: 0, du: 0, ph: 0, lf: 0, gb: 0 }), g, walk > 0); }      // GTA-style road wear (reference G1 to G5)
    out.claims.push({ shape: { t: 'line', pts: s.pts, hw: hw + (walk ? 1.8 : 0) }, layer: lay, owner: 'street' }); out.nStreets++;
  }
  /* ---- buildings: walls with a facade texture (u along the wall in 3.6 m bays, v in 3.2 m storeys), a flat roof ---- */
  const B = M.bldg;
  junctionShapes(J, M, X, Z, gy, out); yield;
  const ruled = buildingsToSkip(tile, G); out.nRuled = ruled.size;                      // rules.js: a class of map error left out everywhere
  /* P1 (infill.js): buildings where the map data is silent, in their own meshes (a distance limit, no shadows) */
  let infill = []; if (ctx.infill !== false) infill = yield* infillSteps(tile, { size, G, widthOf: s => pieceWidth(G, s), yieldNow: ctx.yieldNow, styleAt: (x, z) => ctx.life && ctx.life.identity ? ctx.life.identity.areaNameAt(x, z) : 'default' }); out.nInfill = infill.length; tile.buildings = tile.buildings.concat(infill); yield;
  /* P1 part 3 (infill.js `yards`): open ground left inside the dense blocks is paved, so a forecourt reads as one; own cells of the pavement mesh, same height and texture as the pavements */
  if (infill.yards) { for (const y of infill.yards) { const v = hash(y[0] * 7 + y[1] * 13), c = shade(0x8a867c, 0.85 + 0.3 * v), q = (x, z) => M.walk.v(X(x), gy + LIFT.walk, Z(z), 0, 1, 0, c, X(x) / TEX_WALK, Z(z) / TEX_WALK), a0 = q(y[0], y[1]), a1 = q(y[2], y[1]), a2 = q(y[2], y[3]), a3 = q(y[0], y[3]); M.walk.tri(a0, a3, a2, 0, 1, 0); M.walk.tri(a0, a2, a1, 0, 1, 0); } out.nYards = infill.yards.length; }
  let cornN = 0, arcN = 0, nArc = 0;
  /* the CP colonnade (reference N19: white columns, a continuous shaded walk, shop bays behind): a paved walk D m deep along the wall, square columns every ~3.6 m at its outer edge, and a slab over it at 5.6 m (the photos R2 and R4: columns about 3 persons high, about 0.7 m across; an estimate) whose underside is darker; one wall is about 20 triangles per bay */
  const arcade = (B, ax, az, bx, bz, nx, nz, l, y0, D, k) => {
    const wc = shade(0xf1ede2, 0.94 + 0.08 * k), sc = wc.clone().multiplyScalar(0.62), pc = shade(0x9c978c, 0.9 + 0.2 * k), H = 5.6, T = 0.7, TH = 0.5, tx = (bx - ax) / l, tz = (bz - az) / l, nb = Math.max(2, Math.round(l / 3.6)), P = (u, d) => [ax + tx * u + nx * d, az + tz * u + nz * d];
    const face = (p, q, ya, yb, c, wx, wz) => { let a = p, b = q; if ((-(q[1] - p[1])) * wx + (q[0] - p[0]) * wz < 0) { a = q; b = p; } const v = (pt, y) => B.v(X(pt[0]), y, Z(pt[1]), wx, 0, wz, c, 0.06, 0.06); const q0 = v(a, ya), q1 = v(b, ya), q2 = v(b, yb), q3 = v(a, yb); B.tri(q0, q1, q2, wx, 0, wz); B.tri(q0, q2, q3, wx, 0, wz); };
    const flat = (pts, y, c, up) => { const idx = pts.map(pt => B.v(X(pt[0]), y, Z(pt[1]), 0, up, 0, c, 0.06, 0.06)); const cr = (pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0]); const o = (cr < 0) === (up > 0) ? 0 : 1; B.tri(idx[0], idx[o ? 2 : 1], idx[o ? 1 : 2], 0, up, 0); B.tri(idx[0], idx[o ? 3 : 2], idx[o ? 2 : 3], 0, up, 0); };
    const A0 = P(0, 0), A1 = P(l, 0), A2 = P(l, D), A3 = P(0, D), ye = y0 + H;
    const wv = (pt) => M.walk.v(X(pt[0]), gy + LIFT.walk + 0.012, Z(pt[1]), 0, 1, 0, pc, X(pt[0]) / TEX_WALK, Z(pt[1]) / TEX_WALK), w = [wv(A0), wv(A1), wv(A2), wv(A3)]; M.walk.tri(w[0], w[3], w[2], 0, 1, 0); M.walk.tri(w[0], w[2], w[1], 0, 1, 0);   // paved walk
    flat([A0, A1, A2, A3], ye, sc, -1); flat([A0, A1, A2, A3], ye + TH, wc, 1); face(A3, A2, ye, ye + TH, wc, nx, nz);                                           // soffit, top of the slab and its front fascia
    face(A0, A3, ye, ye + TH, wc, tx, tz); face(A1, A2, ye, ye + TH, wc, -tx, -tz);
    for (let q = 0; q <= nb; q++) { const u = q === 0 ? T * 0.5 : q === nb ? l - T * 0.5 : l * q / nb, c0 = P(u - T / 2, D - T), c1 = P(u + T / 2, D - T), c2 = P(u + T / 2, D), c3 = P(u - T / 2, D);                // columns
      face(c3, c2, y0, ye, wc, nx, nz); face(c0, c3, y0, ye, sc, -tx, -tz); face(c1, c2, y0, ye, wc, tx, tz); }
    nArc++;
  };
  for (const b of tile.buildings) {
    if (ctx.yieldNow && ctx.yieldNow()) yield;
    if (ruled.has(b)) continue;
    const r = b.ring, n = r.length / 2; if (n < 3) continue; const L = b.landmark ? lm.get(b.landmark) : null, kit = L && L.type ? 'gov' : { office: 'off', hotel: 'off', civic: 'gov', religious: 'gov', transit: 'gov' }[b.use] || 'res', B = b.infill ? M.infill : kit === 'off' ? M.bldgO : kit === 'gov' ? M.bldgG : M.bldg, shopB = !L && (b.use === 'commercial' || b.use === 'retail') && (b.height || 9) >= 5, hgt = Math.max(3, (L && L.height) || cpLift(b, guessHeight(b, hash), hash)), y0 = gy + (b.minHeight || 0), y1 = gy + hgt;
    if (L && ctx.skip && ctx.skip.has(L.id)) continue;                                    // a landmark with its own model (landmarks/, D8) is not drawn as a plain block
    let wall; if (L && L.type) wall = LM_WALL[L.type] || (L.type.includes('station') ? LM_WALL.station : 0); else wall = 0;
    if (!wall) { let pal = WALLS[b.use] || WALLS.other; const A = ctx.life && ctx.life.identity && ['residential', 'commercial', 'retail', 'other', undefined].includes(b.use) ? ctx.life.identity.areaAt(r[0], r[1]) : null; if (A && A.walls && A.walls.length) pal = A.walls.map(h => parseInt(h.slice(1), 16));       // the area's own wall colours from identity.json (CP white, Lutyens cream, Old Delhi sandstone), for the ordinary buildings; offices, civic and religious keep the use palette
      const k = hash(b.id); wall = pal[Math.floor(k * pal.length) % pal.length]; }
    const wc = shade(wall, 0.9 + 0.2 * hash(b.id * 7 + 1)), rc = L && L.type ? shade(wall, 0.8) : shade(0x77726a, 0.85 + 0.3 * hash(b.id * 3)); let area = 0, cx = 0, cz = 0, x0 = Infinity, x1b = -Infinity, z0 = Infinity, z1b = -Infinity;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, xi = r[i * 2], zi = r[i * 2 + 1], xj = r[j * 2], zj = r[j * 2 + 1]; area += xi * zj - xj * zi; cx += xi; cz += zi; x0 = Math.min(x0, xi); x1b = Math.max(x1b, xi); z0 = Math.min(z0, zi); z1b = Math.max(z1b, zi); }
    const ccw = area > 0;                                                                // the pack says counter-clockwise; walls are built for either
    const anB = ctx.life && ctx.life.identity ? ctx.life.identity.areaNameAt(r[0], r[1]) : '', corn = !b.infill && !L && hgt >= 9 && (anB === 'cp' || anB === 'lutyens' || anB === 'oldDelhi') && cornN < 140 && (cornN++, true);          // a cornice on the taller buildings of Connaught Place, Lutyens' Delhi and Old Delhi (140 a tile at most: a lip along the roof edge, 6 triangles a wall)
    const arc = !b.infill && (!L || L.type === 'district') && hgt >= 9 && anB === 'cp';                         // Connaught Place: the colonnade (arcade) in front of the shops, on walls that face a street (200 walls a tile at most)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ax = r[i * 2], az = r[i * 2 + 1], bx = r[j * 2], bz = r[j * 2 + 1], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz); if (l < 0.05) continue;
      let nx = dz / l, nz = -dx / l; if (!ccw) { nx = -nx; nz = -nz; } const u1 = l / 14.4, v0 = (y0 - gy) / 12.8, v1 = (y1 - gy) / 12.8, y2 = Math.min(y1, y0 + 2.4), AO = 0.6;
      /* a wall in two quads: the foot (2.4 m, darker at the ground like a shadow) and the rest; a shop's ground floor is its own quad with the shop-front texture */
      const quad = (m, ya, yb, ca, cb, va, vb) => { const q0 = m.v(X(ax), ya, Z(az), nx, 0, nz, ca, 0, va), q1 = m.v(X(bx), ya, Z(bz), nx, 0, nz, ca, u1, va), q2 = m.v(X(bx), yb, Z(bz), nx, 0, nz, cb, u1, vb), q3 = m.v(X(ax), yb, Z(az), nx, 0, nz, cb, 0, vb); m.tri(q0, q1, q2, nx, 0, nz); m.tri(q0, q2, q3, nx, 0, nz); };
      const dark = c0 => c0.clone().multiplyScalar(AO);
      if (shopB && y1 - y0 > 4) { const ys = y0 + 3.2, sc = shade(0xffffff, 0.7 + 0.3 * hash(b.id * 11 + i)); quad(b.infill ? M.infillShop : M.shop, y0, ys, dark(sc), sc, 0, 1); quad(B, ys, y1, wc, wc, (ys - gy) / 12.8, v1); }
      else if (b.infill) quad(B, y0, y1, wc, wc, v0, v1);                                  // infill: one quad a wall (it is drawn only near, and in the hundreds)
      else { quad(B, y0, y2, dark(wc), wc, v0, v0 + (y2 - y0) / 12.8); if (y1 > y2) quad(B, y2, y1, wc, wc, v0 + (y2 - y0) / 12.8, v1); }
      if (corn && l > 2.5) { const cc = shade(wall, 1.12 + 0.1 * hash(b.id * 13 + i)), cd = cc.clone().multiplyScalar(0.78), ox = nx * 0.4, oz = nz * 0.4, yb = y1 - 0.35, yt = y1 + 0.25;
        const f0 = B.v(X(ax + ox), yb, Z(az + oz), nx, 0, nz, cd, 0.06, 0.06), f1 = B.v(X(bx + ox), yb, Z(bz + oz), nx, 0, nz, cd, 0.06, 0.06), f2 = B.v(X(bx + ox), yt, Z(bz + oz), nx, 0, nz, cc, 0.06, 0.06), f3 = B.v(X(ax + ox), yt, Z(az + oz), nx, 0, nz, cc, 0.06, 0.06); B.tri(f0, f1, f2, nx, 0, nz); B.tri(f0, f2, f3, nx, 0, nz);
        const t0 = B.v(X(ax + ox), yt, Z(az + oz), 0, 1, 0, cc, 0.06, 0.06), t1 = B.v(X(bx + ox), yt, Z(bz + oz), 0, 1, 0, cc, 0.06, 0.06), t2 = B.v(X(bx), yt, Z(bz), 0, 1, 0, cc, 0.06, 0.06), t3 = B.v(X(ax), yt, Z(az), 0, 1, 0, cc, 0.06, 0.06); B.tri(t0, t1, t2, 0, 1, 0); B.tri(t0, t2, t3, 0, 1, 0); B.tri(t0, t2, t1, 0, 1, 0); B.tri(t0, t3, t2, 0, 1, 0); }
      if (arc && l >= 8 && arcN < 200 && infill.streetClear) { const D = 3.4, ok = [0.08, 0.5, 0.92].every(t => infill.streetClear(ax + dx * t + nx * (D + 0.6), az + dz * t + nz * (D + 0.6), 0.6) && infill.streetClear(ax + dx * t + nx * (D * 0.5), az + dz * t + nz * (D * 0.5), 0.4));
        if (ok) { arcN++; arcade(B, ax, az, bx, bz, nx, nz, l, y0, D, hash(b.id * 29 + i)); } }
      if (hgt < 60 || i % 2 === 0) { const mx = (ax + bx) / 2 - nx * 0.7, mz = (az + bz) / 2 - nz * 0.7; for (let s = 0; s < l; s += 2) { const t = (s + 1) / l; if (t > 1) break; out.circles.push(ax + dx * t - nx * WALL_R, az + dz * t - nz * WALL_R, WALL_R); } void mx; void mz; }
    }
    const contour = []; for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(r[i * 2], r[i * 2 + 1])); const holes = (b.holes || []).map(h => { const a = []; for (let i = 0; i < h.length; i += 2) a.push(new THREE.Vector2(h[i], h[i + 1])); return a; });
    let tris = null; try { tris = THREE.ShapeUtils.triangulateShape(contour, holes); } catch (e) { tris = null; }
    if (tris) { const all = contour.concat(...holes), base = B.p.length / 3; for (const q of all) B.v(X(q.x), y1, Z(q.y), 0, 1, 0, rc, 0.06, 0.06); for (const t of tris) B.tri(base + t[0], base + t[1], base + t[2], 0, 1, 0); }
    if (!L && !b.infill && hgt >= 6 && hgt < 40 && (x1b - x0) > 8 && (z1b - z0) > 8 && hash(b.id * 5 + 3) < 0.4) { const rx = (x0 + x1b) / 2 + (hash(b.id) - 0.5) * (x1b - x0) * 0.3, rz = (z0 + z1b) / 2 + (hash(b.id + 9) - 0.5) * (z1b - z0) * 0.3, hs = 1.2 + hash(b.id * 3) * 0.8, hh = 1.6 + hash(b.id * 13) * 1.2, tank = hash(b.id * 17) < 0.5 ? shade(0x3a5a78, 1) : shade(0x9a9890, 1);       // a water tank or a stair head on the roof
      const bx0 = B.p.length / 3; for (const [dx, dz] of [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]]) { B.v(X(rx + dx), y1, Z(rz + dz), 0, 1, 0, tank, 0.06, 0.06); B.v(X(rx + dx), y1 + hh, Z(rz + dz), 0, 1, 0, tank, 0.06, 0.06); }
      for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4, a = bx0 + k * 2, b2 = bx0 + k2 * 2, mx = (k < 2 ? 0 : 0); void mx; const ex = k === 0 ? 0 : k === 1 ? 1 : k === 2 ? 0 : -1, ez = k === 0 ? -1 : k === 1 ? 0 : k === 2 ? 1 : 0; B.tri(a, b2, b2 + 1, ex, 0, ez); B.tri(a, b2 + 1, a + 1, ex, 0, ez); }
      B.tri(bx0 + 1, bx0 + 3, bx0 + 5, 0, 1, 0); B.tri(bx0 + 1, bx0 + 5, bx0 + 7, 0, 1, 0); }
    out.nArc = nArc; out.nBuildings++; if (x1b - x0 > 2 && z1b - z0 > 2) out.claims.push({ shape: { t: 'rect', x: (x0 + x1b) / 2, z: (z0 + z1b) / 2, hx: (x1b - x0) / 2, hz: (z1b - z0) / 2, yaw: 0 }, kind: 'building', owner: 'building' });
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
  const pbr = (name, tint, dir = 'roads') => { const L = new THREE.TextureLoader(), ld = (f, srgb) => { const t = L.load('assets/' + dir + '/' + name + '_' + f + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }; const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: ld('color', true), normalMap: ld('normal', false), roughnessMap: ld('rough', false), roughness: 1, metalness: 0, envMapIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -5 }); m.normalScale.set(0.8, 0.8); m.color.setScalar(tint); return m; };
  const lawn = (() => { const m = pbr('grass', 1.85, 'ground'); m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -3; return m; })();
  const dirt = (() => { const m = pbr('sand', 1.7, 'ground'); m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; return m; })();
    const plazaTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), S = 128; g.fillStyle = '#d9d2c0'; g.fillRect(0, 0, 512, 512);        // 4 by 4 stone slabs: cream, each its own tone, speckle and a hairline joint
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) { const t = 0.9 + rnd() * 0.16, x = q * S, y = r * S; g.fillStyle = 'rgb(' + Math.round(236 * t) + ',' + Math.round(230 * t) + ',' + Math.round(214 * t) + ')'; g.fillRect(x + 2, y + 2, S - 4, S - 4);
      for (let k = 0; k < 90; k++) { const v = 150 + Math.floor(rnd() * 100); g.fillStyle = 'rgba(' + v + ',' + (v - 4) + ',' + (v - 14) + ',0.22)'; g.fillRect(x + 3 + rnd() * (S - 8), y + 3 + rnd() * (S - 8), 1 + rnd() * 3, 1 + rnd() * 3); }
      g.strokeStyle = 'rgba(120,112,96,0.35)'; g.lineWidth = 1; for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(x + rnd() * S, y + rnd() * S); g.lineTo(x + rnd() * S, y + rnd() * S); g.stroke(); } }
    g.strokeStyle = '#a79f8c'; g.lineWidth = 3; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * S, 0); g.lineTo(k * S, 512); g.stroke(); g.beginPath(); g.moveTo(0, k * S); g.lineTo(512, k * S); g.stroke(); } return c; })();
  const plaza = (() => { const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex(plazaTex), roughness: 0.6, metalness: 0, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); return m; })();
const rsign = (() => { const A = makeSignAtlas(); const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: A.tex, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide, envMapIntensity: 0.4 }); return m; })(), junk = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.2 });
  const mats = { ground: dirt, plaza, rsign, junk, park: flat(-2, -3, noise), lawn, walk: (() => { const m = pbr('pavement', 1.55); m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; return m; })(), road: pbr('asphalt', 6), mark: flat(-5, -9), sky: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.25, emissive: 0xffd58a, emissiveIntensity: 0 }), bldg: kit('res'), bldgO: kit('off'), bldgG: kit('gov'), shop: kit('shop'), tex: noise };
  mats.setNight = on => { for (const k of ['bldg', 'bldgO', 'bldgG', 'shop']) mats[k].emissiveIntensity = on ? 1.1 : 0; };
  return mats;
}
