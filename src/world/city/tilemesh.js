/* One 1 km tile of the city pack as three.js geometry (docs/CITY_PACK.md): ground fills (blocks, land use), parks and water, street carriageways with lane marks and painted sidewalks, flyover decks with
   edges and piers, and extruded building footprints. Everything of a kind is merged into one mesh per tile, so a tile costs five draw calls. Vertices are relative to the tile's corner (tx * 1000, tz * 1000) in x
   and z and absolute in y; the flat layers lie exactly in the ground plane and are ordered by polygon offset (the terrain here is flat), so a car's wheels sit on the paint. 97 % of the building heights in
   the pack are guesses (docs/CITY_PACK.md 5a): the look is a style, not data. */
import * as THREE from 'three';
import { CP_CIRCLE } from './smooth.js';
import { brandBand, drumCorner, makeBrandMaterial, facadeBands, bladeSign, soffitLights, makeLightMaterial, arcadePools, cpFacadeTextures, roofCornice, makeLeafCanvas, columnWash, wallWash, boardReflections } from './cpfacade.js';
import { deckHeight, underDepth, OPEN_CUT, pieceWidth, pieceSidewalk } from './pack.js';
import { infillSteps } from './infill.js';
import { buildingsToSkip } from './rules.js';
import { buildStreetLife } from './streetlife.js';
import { islandInfo, dress as dressIsland } from './roundabout.js';
import { hindiName } from './hindi.js';
import { destsAt, adjOf } from './signdests.js';

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
const WALK = col(0x77736a), MARK = col(0xe9e6da), YEL = col(0xe0ae1e), CONCRETE = col(0x8c8a84), BLOCK = { urban: col(0x6f695c), residential: col(0x716a5c), commercial: col(0x6c6a64), retail: col(0x6c6a64), industrial: col(0x64625d), park: col(0x5a7a3a), garden: col(0x5a7a3a), forest: col(0x44663a), farmland: col(0x8f9a55), grass: col(0x66843f), meadow: col(0x7a8a45), water: col(0x2e5f73), river: col(0x2e5f73), cemetery: col(0x6f7f50), military: col(0x7b7f66), religious: col(0x9a8f78) };
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
const GRIME = { kartavya: 0.04, lutyens: 0.08, business: 0.25, cp: 0.3, dda: 0.5, default: 0.65, market: 0.85, village: 0.9, oldDelhi: 1.0 };
const VIP_TYPES = new Set(['government', 'memorial', 'avenue', 'museum', 'convention', 'fort', 'tomb', 'monument', 'archaeological', 'observatory', 'stepwell']);      // landmarks that are kept clean around; markets, stations, temples and the busy districts are landmarks too but are not kept clean
const grimeAt = (ID, vip, x, z) => { let g = GRIME[ID && ID.areaNameAt ? ID.areaNameAt(x, z) : 'default']; if (g === undefined) g = 0.65; for (const l of vip) if (Math.hypot(l.x - x, l.z - z) < 220) { g *= 0.35; break; } return g; };

/* Road wear (the owner's GTA reference frames G1 to G5 show worn wheel tracks, patches, cracks and manholes on every road; ours was one flat colour). All in the marking layer, dark shades of asphalt, deterministic, with a budget a tile so it stays cheap. g (0 to 1, GRIME above) decides how much: wheel tracks (two 0.45 m strips a lane), tar patches, manhole covers (always), hairline cracks, and from g 0.4 up dust along the kerbs, from 0.5 potholes with a dust ring, scattered leaflets and wrappers, and from 0.55 piles of rubbish bags on the pavement edge (3D, own mesh `junk`). Set ?nowear to turn it all off. */
const WEAR = !(typeof location !== 'undefined' && new URLSearchParams(location.search).has('nowear')), W_BUDGET = { tr: 24000, pa: 1600, mh: 600, cr: 1600, du: 3000, ph: 700, lf: 5200, gb: 480, bl: 2400, rp: 700, al: 3500 };
const LEAF = [0xe9e9e4, 0xe8d24a, 0xe58aa5, 0x6aa0e8, 0xd04a3a, 0xbdb8a8, 0xf2f2ee].map(h => col(h)), BAGS = [0x1d1d1d, 0x2e4a7a, 0xd8d8d0, 0x6b4a2a, 0x3a5a3a, 0x8a2e2e].map(h => col(h));
function junkBox(J, X, Z, cx, y0, cz, sx, sy, sz, yaw, C) {
  const c = Math.cos(yaw), sn = Math.sin(yaw), P = (a, b, y) => [cx + a * c - b * sn, y, cz + a * sn + b * c], hx = sx / 2, hz = sz / 2, q = [P(-hx, -hz, y0), P(hx, -hz, y0), P(hx, hz, y0), P(-hx, hz, y0)], t = q.map(p => [p[0], p[1] + sy, p[2]]);
  const face = (a, b, nx, ny, nz, cc) => { const i0 = J.v(X(a[0]), a[1], Z(a[2]), nx, ny, nz, cc), i1 = J.v(X(b[0]), b[1], Z(b[2]), nx, ny, nz, cc), i2 = J.v(X(b[0]), b[1] + sy * (a[1] === y0 ? 1 : 0), Z(b[2]), nx, ny, nz, cc); void i2; return [i0, i1]; };
  for (let k = 0; k < 4; k++) { const a = q[k], b = q[(k + 1) % 4], mx = (a[0] + b[0]) / 2 - cx, mz = (a[2] + b[2]) / 2 - cz, l = Math.hypot(mx, mz) || 1, nx = mx / l, nz = mz / l, v0 = J.v(X(a[0]), y0, Z(a[2]), nx, 0, nz, C), v1 = J.v(X(b[0]), y0, Z(b[2]), nx, 0, nz, C), v2 = J.v(X(b[0]), y0 + sy, Z(b[2]), nx, 0, nz, C), v3 = J.v(X(a[0]), y0 + sy, Z(a[2]), nx, 0, nz, C); J.tri(v0, v1, v2, nx, 0, nz); J.tri(v0, v2, v3, nx, 0, nz); }
  const tv = t.map(p => J.v(X(p[0]), p[1], Z(p[2]), 0, 1, 0, C.clone().multiplyScalar(1.15))); J.tri(tv[0], tv[1], tv[2], 0, 1, 0); J.tri(tv[0], tv[2], tv[3], 0, 1, 0); void face;
}
function wearDetail(m, J, F, pts, H, w, hw, id, gy, X, Z, two, B, g, walk, WD, WL) {
  const total = F.arc[F.n - 1], lo = 7, hi = total - 7; if (hi - lo < 10) return;
  const at = sa => { let i = 0; while (i + 2 < F.n && F.arc[i + 1] < sa) i++; const f = Math.max(0, Math.min(1, (sa - F.arc[i]) / Math.max(0.01, F.arc[i + 1] - F.arc[i]))), j = i + 1; return { x: pts[i * 2] + (pts[j * 2] - pts[i * 2]) * f, z: pts[i * 2 + 1] + (pts[j * 2 + 1] - pts[i * 2 + 1]) * f, nx: F.nx[i] + (F.nx[j] - F.nx[i]) * f, nz: F.nz[i] + (F.nz[j] - F.nz[i]) * f, y: H[i] + (H[j] - H[i]) * f }; };
  const y = q => gy + q.y + LIFT.mark - 0.012, V = (q, off, C, mm = m) => mm.v(X(q.x + q.nx * off), y(q), Z(q.z + q.nz * off), 0, 1, 0, C), lerpC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
  const BLK = col(0x000000), WHT = col(0xffffff), PD = col(0x1f1f22), PL = col(0x3d3d43), MH = col(0x26262a), RIM = col(0x4a4a50), CRK = col(0x111113), DUST = col(0x77705f), HOLE = col(0x0e0e10), HRIM = col(0x58524a);
  const lanes = Math.max(two ? 2 : 1, Math.round(w / 3.4)), lw = w / lanes, len = hi - lo, rnd = k => hash(id * 977 + k * 131);
  /* wheel bands (owner's GTA frames 11 and 12: a broad dark band down each wheel path, soft at the edges): two layers a wheel, a wide faint one and a narrow darker one, in broken lengths with gaps, only where g is 0.35 or more */
  if (g >= 0.35 && B.tr < W_BUDGET.tr) for (let k = 0; k < lanes; k++) { const c = -hw + (k + 0.5) * lw; for (const side of [-0.8, 0.8]) for (const [hwd, C] of [[0.52, BLK], [0.22, BLK]]) { let s0 = lo + rnd(2000 + k * 3 + (side > 0 ? 1 : 0)) * 12; while (s0 < hi) { const seg = 8 + rnd(2100 + (s0 | 0) + k) * 24, gap = 4 + rnd(2200 + (s0 | 0) + k) * 14, e0 = Math.min(hi, s0 + seg); let prev = -1; for (let t = s0; t <= e0 + 0.01; t += 6) { const q = at(Math.min(t, e0)), wd = hwd * (0.75 + 0.5 * rnd(2300 + (t | 0))), a = V(q, c + side - wd, C, WD), b = V(q, c + side + wd, C, WD); if (prev >= 0) { WD.tri(prev, prev + 1, a, 0, 1, 0); WD.tri(prev + 1, b, a, 0, 1, 0); B.tr += 2; } prev = a; } s0 = e0 + gap; } } }
  /* large blotches of lighter and darker asphalt (old and new surfacing), repair strips along and across the road (utility cuts) and alligator crack networks */
  B.bl = B.bl || 0; B.rp = B.rp || 0; B.al = B.al || 0; const quadQ = (q1, o1, q2, o2, C) => { const mm = C === WHT ? WL : WD, a = V(q1, o1[0], C, mm), b = V(q1, o1[1], C, mm), c2 = V(q2, o2[1], C, mm), d = V(q2, o2[0], C, mm); mm.tri(a, b, c2, 0, 1, 0); mm.tri(a, c2, d, 0, 1, 0); };
  if (g > 0.25) for (let k = 0, n = Math.floor(len / 22 * (0.2 + g * 0.8)); k < n && B.bl < W_BUDGET.bl; k++) { const s0 = lo + rnd(3000 + k) * len, lx = 3 + rnd(3100 + k) * 6, lz = 1.6 + rnd(3200 + k) * 1.8, lat = (rnd(3300 + k) - 0.5) * (w - lz - 0.6), C = rnd(3400 + k) < 0.5 ? WHT : BLK; quadQ(at(s0), [lat - lz / 2, lat + lz / 2], at(Math.min(hi, s0 + lx)), [lat - lz / 2, lat + lz / 2], C); B.bl++; }
  if (g >= 0.4) for (let k = 0, n = Math.floor(len / 110 * (0.4 + g)); k < n && B.rp < W_BUDGET.rp; k++) { const s0 = lo + rnd(3500 + k) * len, C = rnd(3600 + k) < 0.5 ? WHT : BLK; if (rnd(3700 + k) < 0.5) { const wd = 0.5 + rnd(3800 + k) * 0.5; quadQ(at(s0), [-hw + 0.5, hw - 0.5], at(Math.min(hi, s0 + wd)), [-hw + 0.5, hw - 0.5], C); } else { const lat = -hw + (Math.floor(rnd(3900 + k) * lanes) + 0.5) * lw + (rnd(4000 + k) - 0.5), lx = 4 + rnd(4100 + k) * 7; quadQ(at(s0), [lat - 0.3, lat + 0.3], at(Math.min(hi, s0 + lx)), [lat - 0.3, lat + 0.3], C); } B.rp++; }
  if (g > 0.5) for (let k = 0, n = Math.floor(len / 80 * g + rnd(4200)); k < n && B.al < W_BUDGET.al; k++) { const q = at(lo + rnd(4300 + k) * len), lat = (rnd(4400 + k) - 0.5) * (w - 2), cx0 = q.x + q.nx * lat, cz0 = q.z + q.nz * lat; let px = cx0, pz = cz0; for (let j = 0; j < 9; j++) { const an = rnd(4500 + k * 11 + j) * 6.283, L2 = 0.3 + rnd(4600 + k * 11 + j) * 0.8, ex = px + Math.cos(an) * L2, ez = pz + Math.sin(an) * L2, ox = -Math.sin(an) * 0.022, oz = Math.cos(an) * 0.022, yy = gy + q.y + LIFT.mark - 0.008, a = m.v(X(px - ox), yy, Z(pz - oz), 0, 1, 0, CRK), b = m.v(X(px + ox), yy, Z(pz + oz), 0, 1, 0, CRK), c2 = m.v(X(ex + ox), yy, Z(ez + oz), 0, 1, 0, CRK), d = m.v(X(ex - ox), yy, Z(ez - oz), 0, 1, 0, CRK); m.tri(a, b, c2, 0, 1, 0); m.tri(a, c2, d, 0, 1, 0); B.al++; if (j % 3 === 2) { px = cx0; pz = cz0; } else { px = ex; pz = ez; } } }
  for (let k = 0, n = Math.floor(len / 38 * (0.15 + 1.9 * g) + rnd(1)); k < n && B.pa < W_BUDGET.pa; k++) { const s0 = lo + rnd(10 + k) * len, q = at(s0), lat = (rnd(20 + k) - 0.5) * (w - 2.4), lx = 1.2 + rnd(30 + k) * 2.8, lz = 0.8 + rnd(40 + k) * 1.4, C = rnd(50 + k) < 0.6 ? BLK : WHT, mm = C === WHT ? WL : WD, q2 = at(Math.min(hi, s0 + lx)), a = V(q, lat - lz / 2, C, mm), b = V(q, lat + lz / 2, C, mm), c2 = V(q2, lat + lz / 2, C, mm), d = V(q2, lat - lz / 2, C, mm); mm.tri(a, b, c2, 0, 1, 0); mm.tri(a, c2, d, 0, 1, 0); B.pa++; }
  for (let k = 0, n = Math.floor(len / 55 + rnd(2)); k < n && B.mh < W_BUDGET.mh; k++) { const s0 = lo + rnd(60 + k) * len, q = at(s0), lat = -hw + (Math.floor(rnd(70 + k) * lanes) + 0.5) * lw + (rnd(80 + k) - 0.5) * 0.8, cx = q.x + q.nx * lat, cz = q.z + q.nz * lat, yy = y(q) + 0.004; let first = -1; for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; const v = m.v(X(cx + Math.cos(an) * 0.4), yy, Z(cz + Math.sin(an) * 0.4), 0, 1, 0, i % 2 ? RIM : MH); if (first < 0) first = v; } const ctr = m.v(X(cx), yy, Z(cz), 0, 1, 0, MH); for (let i = 0; i < 8; i++) m.tri(ctr, first + i, first + (i + 1) % 8, 0, 1, 0); B.mh++; }
  for (let k = 0, n = Math.floor(len / 30 * (0.1 + 2.2 * g * g) + rnd(3)); k < n && B.cr < W_BUDGET.cr; k++) { const s0 = lo + rnd(90 + k) * len, lat = (rnd(100 + k) - 0.5) * (w - 2); let prev = -1; for (let j = 0; j < 4; j++) { const q = at(Math.min(hi, s0 + j * 1.6)), l2 = lat + (rnd(110 + k * 7 + j) - 0.5) * 0.9, a = V(q, l2 - 0.03, CRK), b = V(q, l2 + 0.03, CRK); if (prev >= 0) { m.tri(prev, prev + 1, a, 0, 1, 0); m.tri(prev + 1, b, a, 0, 1, 0); } prev = a; } B.cr++; }
  if (g > 0.4) {
    for (const side of [-1, 1]) { let prev = -1; for (let s0 = lo; s0 <= hi; s0 += 5) { if (rnd(200 + s0 * 3 + side) < 0.3) { prev = -1; continue; } const q = at(s0), wd = (0.4 + rnd(300 + s0) * 1.0) * g, e = side * hw, a = V(q, e, DUST), b = V(q, e - side * wd, DUST); if (prev >= 0 && B.du < W_BUDGET.du) { m.tri(prev, prev + 1, a, 0, 1, 0); m.tri(prev + 1, b, a, 0, 1, 0); B.du += 2; } prev = a; } }
    for (let k = 0, n = Math.floor(len / 3 * g * g * 1.6); k < n && B.lf < W_BUDGET.lf; k++) { const q = at(lo + rnd(400 + k) * len), side = rnd(500 + k) < 0.5 ? -1 : 1, lat = side * (hw - 0.25 - rnd(600 + k) * 1.4), sz = 0.1 + rnd(700 + k) * 0.2, an = rnd(800 + k) * 6.283, C = LEAF[Math.floor(rnd(900 + k) * LEAF.length)], cx = q.x + q.nx * lat, cz = q.z + q.nz * lat, yy = y(q) + 0.006, ca = Math.cos(an) * sz, sa = Math.sin(an) * sz, a = m.v(X(cx - ca), yy, Z(cz - sa), 0, 1, 0, C), b = m.v(X(cx + sa), yy, Z(cz - ca), 0, 1, 0, C), c2 = m.v(X(cx + ca), yy, Z(cz + sa), 0, 1, 0, C), d = m.v(X(cx - sa), yy, Z(cz + ca), 0, 1, 0, C); m.tri(a, b, c2, 0, 1, 0); m.tri(a, c2, d, 0, 1, 0); B.lf++; }
  }
  if (g > 0.5) for (let k = 0, n = Math.floor(len / 28 * (g - 0.4) * 3 + rnd(4)); k < n && B.ph < W_BUDGET.ph; k++) { const q = at(lo + rnd(1000 + k) * len), lat = -hw + (Math.floor(rnd(1100 + k) * lanes) + 0.5) * lw + (rnd(1200 + k) - 0.5) * 1.6, r = 0.35 + rnd(1300 + k) * 0.5, cx = q.x + q.nx * lat, cz = q.z + q.nz * lat, yy = y(q) + 0.003; for (const [rr, C, dy] of [[r * 1.4, HRIM, 0], [r, HOLE, 0.004]]) { const ctr = m.v(X(cx), yy + dy, Z(cz), 0, 1, 0, C); let first = -1; for (let i = 0; i < 7; i++) { const an = i * 6.283 / 7, rj = rr * (0.8 + 0.4 * hash(id * 31 + k * 7 + i)); const v = m.v(X(cx + Math.cos(an) * rj), yy + dy, Z(cz + Math.sin(an) * rj), 0, 1, 0, C); if (first < 0) first = v; } for (let i = 0; i < 7; i++) m.tri(ctr, first + i, first + (i + 1) % 7, 0, 1, 0); } B.ph++; }
  if (g > 0.55 && J) for (let k = 0, n = Math.floor(len / 38 * (g - 0.35) * 3 + rnd(5) * g); k < n && B.gb < W_BUDGET.gb; k++) { const q = at(lo + rnd(1400 + k) * len), side = rnd(1500 + k) < 0.5 ? -1 : 1, off = hw + (walk ? 0.7 : 0.4), cx = q.x + q.nx * side * off, cz = q.z + q.nz * side * off, base = gy + q.y + (walk ? 0.13 : 0.03); for (let b = 0, nb = 3 + Math.floor(rnd(1600 + k) * 3); b < nb; b++) junkBox(J, X, Z, cx + (hash(id * 17 + k * 5 + b) - 0.5) * 1.1, base + (b > 2 ? 0.3 : 0), cz + (hash(id * 19 + k * 3 + b) - 0.5) * 1.1, 0.35 + hash(id + k + b * 9) * 0.35, 0.22 + hash(id * 3 + k + b) * 0.3, 0.35 + hash(id * 5 + k + b * 7) * 0.3, hash(id + b * 13 + k) * 6.28, BAGS[Math.floor(hash(id * 7 + k * 11 + b) * BAGS.length)]); B.gb++; }
}

/* Road signs on poles at signalled junctions, matched to the owner's Delhi reference photos (20 Nov 2026): a GREEN name board (NDMC style) shaped as a hexagon with an arrow point at each end, a white inner border, the Hindi name above the English name in white, on two steel posts; and a YELLOW square speed-limit plate (red ring, car and truck limits, the words SPEED LIMIT) on its own post. Sizes are real: board 2.0 x 0.95 m with its lower edge 2.5 m above the road, speed plate 0.8 m square. One texture atlas drawn in code (2048 px, transparent outside the hexagon, material alphaTest), material `rsign`. Hindi and English names come from the pack. */
let SIGNATLAS = null;
const SIGN_GREEN = '#0d7d5c', SIGN_W = 400, SIGN_H = 190, SIGN_Y0 = 384;
function makeSignAtlas() {
  const S = 2048, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.fillStyle = '#6f7275'; g.fillRect(S - 64, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const cell = i => ({ x: (i % 8) * 128, y: Math.floor(i / 8) * 128 }), icon = (i, f) => { const p = cell(i); g.save(); g.translate(p.x, p.y); f(g); g.restore(); };
  const disc = (g2, fill, ring) => { g2.fillStyle = ring; g2.beginPath(); g2.arc(64, 64, 62, 0, 7); g2.fill(); g2.fillStyle = fill; g2.beginPath(); g2.arc(64, 64, 46, 0, 7); g2.fill(); };
  icon(0, g2 => { disc(g2, '#c8202a', '#c8202a'); g2.fillStyle = '#fff'; g2.fillRect(24, 54, 80, 20); });                        // no entry
  icon(1, g2 => { g2.fillStyle = '#1c4f9c'; g2.fillRect(4, 4, 120, 120); g2.fillStyle = '#fff'; g2.fillRect(20, 52, 62, 24); g2.beginPath(); g2.moveTo(76, 30); g2.lineTo(110, 64); g2.lineTo(76, 98); g2.fill(); });      // one way
  icon(6, g2 => { g2.fillStyle = '#c8202a'; g2.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; g2.lineTo(64 + 62 * Math.cos(a), 64 + 62 * Math.sin(a)); } g2.fill(); g2.fillStyle = '#fff'; g2.font = 'bold 34px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('STOP', 64, 66); });
  /* yellow curve chevrons (2 points left, 3 right), the red-bordered give-way triangle (4), the speed-camera plate (5): after the owner's GTA frames 13 and 17 */
  const chev = d => g2 => { g2.fillStyle = '#f2c10f'; g2.fillRect(0, 0, 128, 128); g2.strokeStyle = '#1b1b1b'; g2.lineWidth = 5; g2.strokeRect(4, 4, 120, 120); g2.lineWidth = 16; g2.lineJoin = 'miter'; g2.beginPath(); g2.moveTo(64 - d * 22, 24); g2.lineTo(64 + d * 22, 64); g2.lineTo(64 - d * 22, 104); g2.stroke(); };
  icon(2, chev(-1)); icon(3, chev(1));
  icon(4, g2 => { g2.fillStyle = '#d3202a'; g2.beginPath(); g2.moveTo(4, 10); g2.lineTo(124, 10); g2.lineTo(64, 118); g2.closePath(); g2.fill(); g2.fillStyle = '#fff'; g2.beginPath(); g2.moveTo(24, 21); g2.lineTo(104, 21); g2.lineTo(64, 90); g2.closePath(); g2.fill(); g2.fillStyle = '#111'; g2.font = 'bold 17px Arial, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('GIVE', 64, 36); g2.fillText('WAY', 64, 54); });
  icon(5, g2 => { g2.fillStyle = '#fff'; g2.fillRect(0, 0, 128, 128); g2.strokeStyle = '#1b1b1b'; g2.lineWidth = 6; g2.strokeRect(5, 5, 118, 118); g2.fillStyle = '#111'; g2.fillRect(26, 44, 76, 46); g2.fillRect(40, 34, 28, 12); g2.fillStyle = '#fff'; g2.beginPath(); g2.arc(70, 67, 15, 0, 7); g2.fill(); g2.fillStyle = '#111'; g2.beginPath(); g2.arc(70, 67, 9, 0, 7); g2.fill(); });
  /* speed-limit plates: yellow square, black rim, a white disc with a red ring, a car with its limit and a truck with its limit, SPEED LIMIT underneath */
  const car = (g2, x, y, w) => { g2.fillStyle = '#222'; g2.beginPath(); g2.moveTo(x, y + w * 0.34); g2.lineTo(x + w * 0.2, y + w * 0.34); g2.lineTo(x + w * 0.32, y); g2.lineTo(x + w * 0.7, y); g2.lineTo(x + w * 0.84, y + w * 0.34); g2.lineTo(x + w, y + w * 0.4); g2.lineTo(x + w, y + w * 0.6); g2.lineTo(x, y + w * 0.6); g2.fill(); };
  const truck = (g2, x, y, w) => { g2.fillStyle = '#222'; g2.fillRect(x, y, w * 0.68, w * 0.56); g2.fillRect(x + w * 0.7, y + w * 0.16, w * 0.3, w * 0.4); };
  [30, 40, 50, 60].forEach((v, k) => { const x0 = k * 256, y0 = 128; g.save(); g.translate(x0, y0); g.fillStyle = '#f2c10f'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#1b1b1b'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 244);
    g.fillStyle = '#d3202a'; g.beginPath(); g.arc(128, 100, 84, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 100, 64, 0, 7); g.fill();
    car(g, 82, 52, 56); truck(g, 82, 100, 52); g.fillStyle = '#111'; g.font = 'bold 34px Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(String(v), 144, 70); g.fillText(String(v - 10), 144, 116);
    g.font = 'bold 30px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('SPEED', 128, 206); g.fillText('LIMIT', 128, 238); g.restore(); });
  const names = new Map(); let next = 0;
  const uvOf = (x, y, w, h) => [(x + 2) / S, 1 - (y + h - 2) / S, (x + w - 2) / S, 1 - (y + 2) / S];
  const hexPath = (g2, x, y, w, h, r) => { g2.beginPath(); g2.moveTo(x + r, y); g2.lineTo(x + w - r, y); g2.lineTo(x + w, y + h / 2); g2.lineTo(x + w - r, y + h); g2.lineTo(x + r, y + h); g2.lineTo(x, y + h / 2); g2.closePath(); };
  const arrow = (g2, cx, cy, h, dir) => { g2.beginPath(); g2.moveTo(cx + dir * h * 0.22, cy); g2.lineTo(cx - dir * h * 0.14, cy - h * 0.2); g2.lineTo(cx - dir * h * 0.14, cy + h * 0.2); g2.closePath(); g2.fill(); };
  const fit = (g2, txt, font, max, size) => { let fs = size; g2.font = font(fs); while (g2.measureText(txt).width > max && fs > 14) { fs -= 2; g2.font = font(fs); } return fs; };
  SIGNATLAS = { tex, icon: i => { const p = cell(i); return uvOf(p.x, p.y, 128, 128); }, speed: v => { const k = Math.max(0, [30, 40, 50, 60].indexOf(v)); return uvOf(k * 256, 128, 256, 256); }, plain: [(S - 56) / S, 1 - 50 / S, (S - 8) / S, 1 - 8 / S],
    name(en, hi) { const key = en + '|' + (hi || ''); if (names.has(key)) return names.get(key); const k = next++ % 40, x = (k % 5) * SIGN_W, y = SIGN_Y0 + Math.floor(k / 5) * SIGN_H, W = SIGN_W, H = SIGN_H - 6; g.clearRect(x, y, SIGN_W, SIGN_H);
      g.fillStyle = SIGN_GREEN; hexPath(g, x + 1, y + 1, W - 2, H, 46); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 4; hexPath(g, x + 14, y + 12, W - 28, H - 22, 36); g.stroke();
      g.fillStyle = '#fff'; arrow(g, x + 38, y + 1 + H / 2, H, -1); arrow(g, x + W - 38, y + 1 + H / 2, H, 1); g.textAlign = 'center'; g.textBaseline = 'middle';
      const cx = x + W / 2, tw = W - 150, EN = f => 'bold ' + f + 'px Arial,Helvetica,sans-serif', HI = f => 'bold ' + f + 'px "Noto Sans Devanagari","Kohinoor Devanagari","Devanagari Sangam MN",sans-serif';
      g.font = EN(40); const two = g.measureText(en).width > tw * 1.05 && en.includes(' '); let lines = [en]; if (two) { const w = en.split(' '); let best = 1, bd = 1e9; for (let i = 1; i < w.length; i++) { const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length); if (d < bd) { bd = d; best = i; } } lines = [w.slice(0, best).join(' '), w.slice(best).join(' ')]; }
      const rows = (hi ? 1 : 0) + lines.length, ys = rows === 1 ? [0.5] : rows === 2 ? [0.32, 0.68] : [0.25, 0.54, 0.8]; let r = 0;
      if (hi) { fit(g, hi, HI, tw, rows === 3 ? 36 : 46); g.fillText(hi, cx, y + H * ys[r++]); }
      for (const ln of lines) { fit(g, ln, EN, tw, rows === 3 ? 34 : hi ? 42 : 56); g.fillText(ln, cx, y + H * ys[r++]); }
      tex.needsUpdate = true; const uv = uvOf(x, y, W, H); names.set(key, uv); return uv; },
    /* a blue direction board (NDMC): white border, the destination in Hindi over English, an arrow (dir 'left', 'up' or 'right') at the end it points to */
    blue(en, hi, dir, opt) { const key = 'B|' + en + '|' + (hi || '') + '|' + dir + '|' + (opt && opt.km || '') + (opt && opt.green ? 'g' : ''); if (names.has(key)) return names.get(key); const k = next++ % 40, x = (k % 5) * SIGN_W, y = SIGN_Y0 + Math.floor(k / 5) * SIGN_H, W = SIGN_W, H = SIGN_H - 6; g.clearRect(x, y, SIGN_W, SIGN_H);
      const rr = (x0, y0, w, h, r) => { g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + w, y0, x0 + w, y0 + h, r); g.arcTo(x0 + w, y0 + h, x0, y0 + h, r); g.arcTo(x0, y0 + h, x0, y0, r); g.arcTo(x0, y0, x0 + w, y0, r); g.closePath(); };
      g.fillStyle = opt && opt.green ? SIGN_GREEN : '#1259ad'; rr(x + 1, y + 1, W - 2, H, 12); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 5; rr(x + 10, y + 10, W - 20, H - 18, 8); g.stroke();
      g.fillStyle = '#fff'; g.strokeStyle = '#fff'; const ay = y + 1 + H / 2, ax = dir === 'left' ? x + 52 : x + W - 52, sz = 58;
      g.lineWidth = 11; g.lineCap = 'butt'; g.beginPath(); if (dir === 'up') { g.moveTo(ax, ay + sz * 0.5); g.lineTo(ax, ay - sz * 0.15); } else { const d = dir === 'left' ? -1 : 1; g.moveTo(ax - d * sz * 0.5, ay); g.lineTo(ax + d * sz * 0.15, ay); } g.stroke();
      g.beginPath(); if (dir === 'up') { g.moveTo(ax, ay - sz * 0.62); g.lineTo(ax - sz * 0.36, ay - sz * 0.1); g.lineTo(ax + sz * 0.36, ay - sz * 0.1); } else { const d = dir === 'left' ? -1 : 1; g.moveTo(ax + d * sz * 0.62, ay); g.lineTo(ax + d * sz * 0.1, ay - sz * 0.36); g.lineTo(ax + d * sz * 0.1, ay + sz * 0.36); } g.closePath(); g.fill();
      g.textAlign = 'center'; g.textBaseline = 'middle'; const cx = dir === 'left' ? x + W / 2 + 34 : x + W / 2 - 34, tw = W - 150;
      if (hi) { fit(g, hi, f => 'bold ' + f + 'px "Noto Sans Devanagari","Kohinoor Devanagari","Devanagari Sangam MN",sans-serif', tw, 46); g.fillText(hi, cx, y + H * 0.33); }
      fit(g, en, f => 'bold ' + f + 'px Arial,Helvetica,sans-serif', tw, hi ? 42 : 56); g.fillText(en, cx, y + H * (hi ? 0.68 : 0.5));
      if (opt && opt.km) { g.textAlign = 'right'; g.font = 'bold 28px Arial,Helvetica,sans-serif'; g.fillText(opt.km + ' km', x + W - 24, y + H - 26); }
      tex.needsUpdate = true; const uv = uvOf(x, y, W, H); names.set(key, uv); return uv; },
    /* the junction diagram board: a ring with an arrow out of it for each road, the road's name beside the arrow (like the owner's traffic-circle reference) */
    diagram(items) { const key = 'D|' + items.map(d => d.dir + d.en).join('|'); if (names.has(key)) return names.get(key); const k = next++ % 40, x = (k % 5) * SIGN_W, y = SIGN_Y0 + Math.floor(k / 5) * SIGN_H, W = SIGN_W, H = SIGN_H - 6; g.clearRect(x, y, SIGN_W, SIGN_H);
      const rr = (x0, y0, w, h, r) => { g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + w, y0, x0 + w, y0 + h, r); g.arcTo(x0 + w, y0 + h, x0, y0 + h, r); g.arcTo(x0, y0 + h, x0, y0, r); g.arcTo(x0, y0, x0 + w, y0, r); g.closePath(); };
      g.fillStyle = '#1259ad'; rr(x + 1, y + 1, W - 2, H, 12); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 5; rr(x + 10, y + 10, W - 20, H - 18, 8); g.stroke();
      const cx = x + W / 2, cy = y + H * 0.62, r = 20; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 22px Arial,Helvetica,sans-serif'; g.textBaseline = 'middle';
      for (const d of items) { const v = d.dir === 'left' ? [-1, 0] : d.dir === 'right' ? [1, 0] : [0, -1], x0 = cx + v[0] * r, y0 = cy + v[1] * r, x1 = cx + v[0] * (r + 52), y1 = cy + v[1] * (r + 52 * (v[1] ? 0.9 : 1)); g.lineWidth = 8; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.beginPath(); if (v[1]) { g.moveTo(x1, y1 - 14); g.lineTo(x1 - 12, y1 + 4); g.lineTo(x1 + 12, y1 + 4); } else { g.moveTo(x1 + v[0] * 14, y1); g.lineTo(x1 - v[0] * 4, y1 - 12); g.lineTo(x1 - v[0] * 4, y1 + 12); } g.closePath(); g.fill();
        const t = d.en.length > 13 ? d.en.slice(0, 12) + '.' : d.en; g.textAlign = d.dir === 'left' ? 'right' : d.dir === 'right' ? 'left' : 'center'; g.fillText(t, d.dir === 'left' ? x1 - 18 : d.dir === 'right' ? x1 + 18 : x1 + 0, d.dir === 'up' ? y + 34 : y1 - 18); }
      tex.needsUpdate = true; const uv = uvOf(x, y, W, H); names.set(key, uv); return uv; },
    /* a blue route-number plate (NH 48, SH 26, ...) */
    refPlate(ref) { const key = 'R|' + ref; if (names.has(key)) return names.get(key); const k = next++ % 40, x = (k % 5) * SIGN_W, y = SIGN_Y0 + Math.floor(k / 5) * SIGN_H, W = SIGN_W, H = SIGN_H - 6; g.clearRect(x, y, SIGN_W, SIGN_H);
      const rr = (x0, y0, w, h, r) => { g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + w, y0, x0 + w, y0 + h, r); g.arcTo(x0 + w, y0 + h, x0, y0 + h, r); g.arcTo(x0, y0 + h, x0, y0, r); g.arcTo(x0, y0, x0 + w, y0, r); g.closePath(); };
      g.fillStyle = '#1259ad'; rr(x + 1, y + 1, W - 2, H, 16); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 6; rr(x + 12, y + 12, W - 24, H - 22, 10); g.stroke(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 96px Arial,Helvetica,sans-serif'; g.fillText(ref.replace(/^([A-Z]+)\s*/, '$1 '), x + W / 2, y + H / 2 + 4, W - 60);
      tex.needsUpdate = true; const uv = uvOf(x, y, W, H); names.set(key, uv); return uv; } };
  return SIGNATLAS;
}
const SPEEDS = [30, 40, 50, 60];
/* The boards face the traffic that ARRIVES at the junction: the normal is the road direction (tx, tz) pointing away from the node, the board is spread along the sideways axis (nx, nz) and its left edge (seen by the driver) is on the +n side, the driver's kerb side (traffic keeps left). The back is a plain grey plate, so no text is ever seen mirrored. */
function signPole(M, X, Z, gy, bx, bz, tx, tz, nx, nz, name, speed, hi, gant, extra) {
  const m = M.rsign, A = SIGNATLAS, pw = 0.045, pu = A.plain;
  const V = (x, y, z, nxn, nzn, u, v) => m.v(X(x), y, Z(z), nxn, 0, nzn, WHITE_C, u, v);
  const at = (ox, dt) => [bx + nx * ox + tx * dt, bz + nz * ox + tz * dt];
  /* a flat board centred at (ox along n, dt along t), cy high, w wide, h tall; front uv, plain back 4 cm behind */
  const board = (ox, dt, cy0, w, h, uv, uvB) => { const cy = gy + cy0, [cx, cz] = at(ox, dt);
    const side = (dt2, sgn, u) => { const px = cx + tx * dt2, pz = cz + tz * dt2, L = [px + nx * w / 2, pz + nz * w / 2], R = [px - nx * w / 2, pz - nz * w / 2]; const a = V(L[0], cy - h / 2, L[1], tx * sgn, tz * sgn, sgn > 0 ? u[0] : u[2], u[1]), b = V(R[0], cy - h / 2, R[1], tx * sgn, tz * sgn, sgn > 0 ? u[2] : u[0], u[1]), c2 = V(R[0], cy + h / 2, R[1], tx * sgn, tz * sgn, sgn > 0 ? u[2] : u[0], u[3]), d = V(L[0], cy + h / 2, L[1], tx * sgn, tz * sgn, sgn > 0 ? u[0] : u[2], u[3]); m.tri(a, b, c2, tx * sgn, 0, tz * sgn); m.tri(a, c2, d, tx * sgn, 0, tz * sgn); };
    side(0.04, 1, uv); side(-0.04, -1, uvB || uv); };      /* text on both sides, the right way round from either (the back is the same picture, with left and right arrows swapped for the opposing traffic) */
  const post = (ox, dt, hgt) => { const [px, pz] = at(ox, dt); for (const [dx, dz] of [[tx, tz], [nx, nz]]) { const a = V(px - dx * pw, gy, pz - dz * pw, nz, -nx, pu[0], pu[1]), b = V(px + dx * pw, gy, pz + dz * pw, nz, -nx, pu[2], pu[1]), c2 = V(px + dx * pw, gy + hgt, pz + dz * pw, nz, -nx, pu[2], pu[3]), d = V(px - dx * pw, gy + hgt, pz - dz * pw, nz, -nx, pu[0], pu[3]); m.tri(a, b, c2, nz, 0, -nx); m.tri(a, c2, d, nz, 0, -nx); } };
  /* a horizontal bar from ox0 to ox1 along n at height y, thickness th (a front face and a top face) */
  const beam = (ox0, ox1, dt, y0, th) => { const y = gy + y0, [x0, z0] = at(ox0, dt), [x1, z1] = at(ox1, dt); let a = V(x0, y - th, z0, tx, tz, pu[0], pu[1]), b = V(x1, y - th, z1, tx, tz, pu[2], pu[1]), c2 = V(x1, y + th, z1, tx, tz, pu[2], pu[3]), d = V(x0, y + th, z0, tx, tz, pu[0], pu[3]); m.tri(a, b, c2, tx, 0, tz); m.tri(a, c2, d, tx, 0, tz);
    a = V(x0 + tx * th, y + th, z0 + tz * th, 0, 1, pu[0], pu[1]); b = V(x1 + tx * th, y + th, z1 + tz * th, 0, 1, pu[2], pu[1]); c2 = V(x1 - tx * th, y + th, z1 - tz * th, 0, 1, pu[2], pu[3]); d = V(x0 - tx * th, y + th, z0 - tz * th, 0, 1, pu[0], pu[3]); m.tri(a, b, c2, 0, 1, 0); m.tri(a, c2, d, 0, 1, 0); };
  /* the small road signs on their own thin posts: curve chevrons (yellow, one each side so each direction sees its own), the give-way triangle, the speed-camera plate, the blue route-number plate */
  if (extra) { const k = extra.kind;
    if (k === 'chev') { post(0, 0, 2.3); board(0, 0, 1.75, 0.85, 1.15, A.icon(extra.dir === 'left' ? 2 : 3), A.icon(extra.dir === 'left' ? 3 : 2)); }
    else if (k === 'give') { post(0, 0, 2.4); board(0, 0, 1.95, 0.95, 0.85, A.icon(4)); }
    else if (k === 'stop') { post(0, 0, 2.4); board(0, 0, 1.95, 0.85, 0.85, A.icon(6)); }
    else if (k === 'cam') { post(0, 0, 2.7); board(0, 0, 2.2, 0.75, 0.75, A.icon(5)); }
    else if (k === 'ref') { post(-0.5, 0, 2.5); post(0.5, 0, 2.5); board(0, 0, 2.05, 1.3, 0.62, A.refPlate(extra.ref)); }
    return; }
  /* the street's own name: green hexagon (NDMC), 2.0 x 0.95 m, lower edge at 2.5 m, on two posts */
  if (name) { post(-0.9, 0, 3.55); post(0.9, 0, 3.55); board(0, 0, 2.98, 2.0, 0.95, A.name(name, hi)); }
  /* the speed limit: yellow plate, 0.8 m, 12 m further back so it is read from afar */
  if (speed) { post(0, 12, 2.9); board(0, 12, 2.4, 0.8, 0.8, A.speed(speed)); }
  /* the direction gantry, after the owner's GTA frames (13, 15, 16, 17): a thick round concrete column on the kerb with a footing, a lattice truss (two chords and zig-zag braces) across the carriageway, big boards hung under it on small brackets with a row of lamps below, board 4.2 x 2.0 m, lower edge 5.3 m above the road (a real gantry clears 5.5 m; the GTA boards are about 1.3 lanes wide) */
  if (gant && gant.dests.length) { const list = gant.dests.diag && gant.w >= 9 ? [{ diag: gant.dests.diag }, gant.dests[0]] : gant.dests, dt = 22, n = list.length, BW = 4.2, BH = 2.0, GAP = 0.5, span = n * BW + (n - 1) * GAP + 1.4, L = Math.max(span, Math.min(gant.w + 3.6, 17)), CON = new THREE.Color(0x9b9a95), STL = new THREE.Color(0x7d8185), DRK = new THREE.Color(0x2b2c2e);
    const Vc = (x, y, z, nxn, nyn, nzn, C) => m.v(X(x), gy + y, Z(z), nxn, nyn, nzn, C, pu[0], pu[1]);
    const quadC = (P, N, C) => { const q = P.map(v => Vc(v[0], v[1], v[2], N[0], N[1], N[2], C)); m.tri(q[0], q[1], q[2], N[0], N[1], N[2]); m.tri(q[0], q[2], q[3], N[0], N[1], N[2]); };
    /* an upright box with its centre (ox along n, dt along t), half sizes hn along n, ht along t, from y0 to y1 */
    const box = (ox, dtc, hn, ht, y0, y1, C, top = true) => { const [cx, cz] = at(ox, dtc), P = (a, b, y) => [cx + nx * a * hn + tx * b * ht, y, cz + nz * a * hn + tz * b * ht];
      for (const [a0, b0, a1, b1, N] of [[-1, -1, 1, -1, [-tx, 0, -tz]], [1, -1, 1, 1, [nx, 0, nz]], [1, 1, -1, 1, [tx, 0, tz]], [-1, 1, -1, -1, [-nx, 0, -nz]]]) quadC([P(a0, b0, y0), P(a1, b1, y0), P(a1, b1, y1), P(a0, b0, y1)], N, C);
      if (top) quadC([P(-1, -1, y1), P(1, -1, y1), P(1, 1, y1), P(-1, 1, y1)], [0, 1, 0], C); };
    /* a round column: an 8-sided prism */
    const prism = (ox, dtc, r, y0, y1, C) => { const [cx, cz] = at(ox, dtc); for (let k = 0; k < 8; k++) { const a0 = k * Math.PI / 4, a1 = (k + 1) * Math.PI / 4, am = (a0 + a1) / 2, N = [Math.cos(am), 0, Math.sin(am)], p0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r]; quadC([[p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]]], N, C); } };
    const ox0 = 0.9;                                     // the column stands 0.9 m beyond the kerb post line, ox = +n
    box(ox0, dt, 0.75, 0.75, 0, 0.55, CON); prism(ox0, dt, 0.34, 0.55, 8.9, CON); box(ox0, dt, 0.46, 0.46, 8.9, 9.05, CON);
    const yb = 7.55, yt = 8.55, x0 = ox0 - 0.34, x1 = ox0 - L;      // the truss runs from the column toward -n (over the road)
    box((x0 + x1) / 2, dt, Math.abs(x1 - x0) / 2, 0.09, yb - 0.09, yb + 0.09, STL); box((x0 + x1) / 2, dt, Math.abs(x1 - x0) / 2, 0.09, yt - 0.09, yt + 0.09, STL);      // the two chords
    const nb = Math.round(Math.abs(x1 - x0) / 1.1); for (let k = 0; k < nb; k++) { const a = x0 + (x1 - x0) * k / nb, b = x0 + (x1 - x0) * (k + 1) / nb, up = k % 2 === 0, ya = up ? yb : yt, yb2 = up ? yt : yb, ax = at(a, dt), bx2 = at(b, dt); for (const off of [-0.07, 0.07]) { const A = [ax[0] + tx * off, ax[1] + tz * off], B = [bx2[0] + tx * off, bx2[1] + tz * off], d = 0.05; quadC([[A[0], ya - d, A[1]], [B[0], yb2 - d, B[1]], [B[0], yb2 + d, B[1]], [A[0], ya + d, A[1]]], [tx, 0, tz], STL); quadC([[A[0], ya - d, A[1]], [A[0], ya + d, A[1]], [B[0], yb2 + d, B[1]], [B[0], yb2 - d, B[1]]], [-tx, 0, -tz], STL); } }
    box(x1 + 0.34, dt, 0.75, 0.75, 0, 0.55, CON); prism(x1 + 0.34, dt, 0.34, 0.55, 8.9, CON); box(x1 + 0.34, dt, 0.46, 0.46, 8.9, 9.05, CON);       // the second column, on the far kerb
    const cm = (x0 + x1) / 2, half = Math.abs(x1 - x0) / 2; box(cm, dt + 0.55, half, 0.5, 4.93, 5.0, STL);                                   // the catwalk (a grating plate) under the boards
    box(cm, dt + 1.05, half, 0.025, 5.95, 6.02, STL); box(cm, dt + 1.05, half, 0.02, 5.45, 5.5, STL);                                          // the rail and the knee rail along its outer edge
    for (let q = 0, nq = Math.floor(half * 2 / 1.5); q <= nq; q++) box(x0 - q * (half * 2) / nq, dt + 1.05, 0.03, 0.03, 5.0, 6.02, STL);        // rail posts
    for (let k = 0; k < n; k++) { const ox = ox0 - 0.34 - 0.5 - BW / 2 - k * (BW + GAP), bcy = 6.3; const d = list[k], flip = q => q === 'left' ? 'right' : q === 'right' ? 'left' : 'up', hw2 = d.r >= 4 ? { green: true, km: d.km } : d.r >= 2 && d.km ? { km: d.km } : null;
      if (d.diag) board(ox, dt + 0.12, bcy, BW, BH, A.diagram(d.diag), A.diagram(d.diag.map(q => ({ ...q, dir: flip(q.dir) }))));
      else board(ox, dt + 0.12, bcy, BW, BH, A.blue(d.en, d.hi, d.dir, hw2), A.blue(d.en, d.hi, flip(d.dir), hw2));      /* roads of class primary and up get the green highway board with the distance (km) */
      for (const e of [-1, 1]) box(ox + e * BW * 0.32, dt, 0.05, 0.05, bcy + BH / 2, yb, STL);            // brackets from the board to the lower chord
      for (let q = 0; q < 4; q++) box(ox + (q - 1.5) * BW * 0.24, dt + 0.5, 0.12, 0.1, 5.0, 5.25, DRK); } }
}
const WHITE_C = new THREE.Color(0xffffff);

/* a round fluted column for the CP colonnade (owner's photo R1: a shaft about 0.8 to 1 m across on a stepped base under a capital with a square top): 8-sided shaft, alternate sides a shade darker to read as flutes, a plinth, an echinus ring and a square abacus; about 52 triangles, so it goes in its own mesh `colm` that is drawn only within 170 m (the thin posts in the building mesh are the far fallback and stay hidden inside the shaft) */
function roundColumn(J, X, Z, cx, y0, cz, h, C) {
  junkBox(J, X, Z, cx, y0, cz, 1.0, 0.4, 1.0, 0, C);                                         // plinth
  const ys = y0 + 0.4, yt = y0 + h - 0.55, R = 0.40, N = 8;
  for (let k = 0; k < N; k++) { const a0 = k * Math.PI * 2 / N, a1 = (k + 1) * Math.PI * 2 / N, am = (a0 + a1) / 2, nx = Math.cos(am), nz = Math.sin(am), cc = k % 2 ? C : C.clone().multiplyScalar(0.9), p0 = [cx + Math.cos(a0) * R, cz + Math.sin(a0) * R], p1 = [cx + Math.cos(a1) * R, cz + Math.sin(a1) * R]; const v0 = J.v(X(p0[0]), ys, Z(p0[1]), nx, 0, nz, cc), v1 = J.v(X(p1[0]), ys, Z(p1[1]), nx, 0, nz, cc), v2 = J.v(X(p1[0]), yt, Z(p1[1]), nx, 0, nz, cc), v3 = J.v(X(p0[0]), yt, Z(p0[1]), nx, 0, nz, cc); J.tri(v0, v1, v2, nx, 0, nz); J.tri(v0, v2, v3, nx, 0, nz); }
  for (let k = 0; k < N; k++) { const a0 = k * Math.PI * 2 / N, a1 = (k + 1) * Math.PI * 2 / N, am = (a0 + a1) / 2, nx = Math.cos(am), nz = Math.sin(am), R2 = 0.54; const v0 = J.v(X(cx + Math.cos(a0) * R), yt, Z(cz + Math.sin(a0) * R), nx, 0.4, nz, C), v1 = J.v(X(cx + Math.cos(a1) * R), yt, Z(cz + Math.sin(a1) * R), nx, 0.4, nz, C), v2 = J.v(X(cx + Math.cos(a1) * R2), yt + 0.25, Z(cz + Math.sin(a1) * R2), nx, 0.4, nz, C), v3 = J.v(X(cx + Math.cos(a0) * R2), yt + 0.25, Z(cz + Math.sin(a0) * R2), nx, 0.4, nz, C); J.tri(v0, v1, v2, nx, 0.4, nz); J.tri(v0, v2, v3, nx, 0.4, nz); }
  junkBox(J, X, Z, cx, yt + 0.25, cz, 1.05, 0.3, 1.05, 0, C);                                // abacus
}
/* a traffic signal on a mast arm (owner's GTA frames G8 and G9): a grey pole at the kerb, an arm over the arriving lanes, and signal heads hanging from it facing the driver, each a dark housing with a dull red, amber and green lens. Static: the heads do not animate (the cars obey the real signal state in citytraffic.js). In the `junk` mesh, drawn within 240 m; about 100 triangles a mast. */
function mastArm(J, X, Z, gy, bx, bz, tx, tz, nx, nz, armLen, headOs, lamps, node) {
  const yaw = Math.atan2(nz, nx), GREY = col(0x6b6f73), DARK = col(0x1b1d1f), LR = col(0x8a2a2a), LA = col(0x9a7a20), LG = col(0x2a7a46), y0 = gy + 0.12;
  junkBox(J, X, Z, bx, y0, bz, 0.22, 7.0, 0.22, yaw, GREY);                                              // pole
  const mx = bx + nx * armLen / 2, mz = bz + nz * armLen / 2; junkBox(J, X, Z, mx, y0 + 6.3, mz, Math.abs(armLen), 0.16, 0.16, yaw, GREY);       // the arm along the sideways axis (negative = toward the road)
  for (const o of headOs) { const cx = bx + nx * o, cz = bz + nz * o; junkBox(J, X, Z, cx, y0 + 5.2, cz, 0.42, 1.1, 0.3, yaw, DARK);
    [0.82, 0.55, 0.28].forEach((h, kind) => lamps.push(cx + tx * 0.2, y0 + 5.2 + h + 0.1, cz + tz * 0.2, node, tx, tz, kind)); }      // the three lenses are handed over as lamp records (red, amber, green) and lit live in signalheads.js
}
/* a painted road arrow (straight or turning) in the marking layer: tail at (cx, cz), pointing along (dx, dz), (nx, nz) the sideways unit vector; turn: -1 turns toward -n, +1 toward +n, 0 straight. Shaft 0.24 m wide, head 0.9 m wide. */
function roadArrow(m, X, Z, y, cx, cz, dx, dz, nx, nz, turn) {
  const tri = (p, q, r) => { const a = m.v(X(p[0]), y, Z(p[1]), 0, 1, 0, MARK), b = m.v(X(q[0]), y, Z(q[1]), 0, 1, 0, MARK), c = m.v(X(r[0]), y, Z(r[1]), 0, 1, 0, MARK); m.tri(a, b, c, 0, 1, 0); }, quad = (p0, p1, p2, p3) => { tri(p0, p1, p2); tri(p0, p2, p3); };
  const shaft = (x0, z0, ex, ez, len, w2) => { const px = -ez, pz = ex; quad([x0 + px * w2, z0 + pz * w2], [x0 - px * w2, z0 - pz * w2], [x0 + ex * len - px * w2, z0 + ez * len - pz * w2], [x0 + ex * len + px * w2, z0 + ez * len + pz * w2]); return [x0 + ex * len, z0 + ez * len]; };
  const head = (x0, z0, ex, ez) => { const px = -ez, pz = ex; tri([x0 + px * 0.45, z0 + pz * 0.45], [x0 - px * 0.45, z0 - pz * 0.45], [x0 + ex * 0.95, z0 + ez * 0.95]); };
  if (!turn) { const e = shaft(cx, cz, dx, dz, 2.0, 0.12); head(e[0], e[1], dx, dz); return; }
  const k = Math.SQRT1_2, ex = dx * k + nx * turn * k, ez = dz * k + nz * turn * k, e1 = shaft(cx, cz, dx, dz, 1.5, 0.12), e2 = shaft(e1[0], e1[1], ex, ez, 1.1, 0.12); head(e2[0], e2[1], ex, ez);
}
export function* buildTileSteps(tile, ctx) {
  const { G, lm, gy, size } = ctx, ox = tile.tx * size, oz = tile.tz * size, M = { ground: new Mesher(), park: new Mesher(), lawn: new Mesher(), walk: new Mesher(), plaza: new Mesher(), rsign: new Mesher(), junk: new Mesher(), colm: new Mesher(), cpbrand: new Mesher(), cplight: new Mesher(), wearD: new Mesher(), wearL: new Mesher(), road: new Mesher(), mark: new Mesher(), bldg: new Mesher(), bldgO: new Mesher(), bldgG: new Mesher(), bldgCP: new Mesher(), shop: new Mesher(), infill: new Mesher(), infillShop: new Mesher() };
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
  const IDN = ctx.life && ctx.life.identity, GREEN_AREAS = new Set(['lutyens', 'kartavya', 'dda', 'business']), GREEN_USE = new Set(['grass', 'meadow', 'recreation_ground', 'village_green', 'park', 'garden', 'forest', 'flowerbed']);
  for (const b of tile.blocks) { let cx = 0, cz = 0; const n = b.ring.length / 2; for (let i = 0; i < n; i++) { cx += b.ring[i * 2]; cz += b.ring[i * 2 + 1]; } cx /= n || 1; cz /= n || 1;
    let an = IDN && IDN.areaNameAt ? IDN.areaNameAt(cx, cz) : ''; if (IDN && IDN.areaNameAt && !GREEN_AREAS.has(an) && n > 3) { /* a long block's centre can lie outside the green zone while most of its edge is inside (a 330 m block beside Janpath stayed bare sand, 21 Nov): vote by the outline */ const cnt = {}; const st = Math.max(1, Math.floor(n / 12)); let tot = 0; for (let i = 0; i < n; i += st) { const q = IDN.areaNameAt(b.ring[i * 2], b.ring[i * 2 + 1]); cnt[q] = (cnt[q] || 0) + 1; tot++; } for (const q of ['kartavya', 'lutyens']) if ((cnt[q] || 0) * 2 > tot) { an = q; break; } }
    const h = ((Math.floor(cx * 0.37) * 73856093) ^ (Math.floor(cz * 0.37) * 19349663)) >>> 0, v = (h % 1000) / 1000;
    if (GREEN_USE.has(b.landuse) || (GREEN_AREAS.has(an) && v < (an === 'kartavya' || an === 'lutyens' ? 1.01 : 0.8))       /* 21 Nov, spot check k5: one block in five was dusty earth in the green areas (a large bare sand patch beside Janpath); Kartavya Path and Lutyens' Delhi are now all lawn */) flat(M.lawn, b.ring, b.holes, shade(0xcfe69a, 0.82 + 0.3 * v), LIFT.park * 0.5);
    else if (an === 'cp' && Math.hypot(cx - CP_CIRCLE.cx, cz - CP_CIRCLE.cz) < CP_CIRCLE.PLAZA_R + 90) flat(M.plaza, b.ring, b.holes, shade(0xc9c0aa, 0.94 + 0.1 * v), 0, 4.8);       // CP match (photos R2 to R4): the ground between the roads and the colonnades is stone slabs, not earth; 1.2 m slabs, 4 by 4 to a texture repeat
    else flat(M.ground, b.ring, b.holes, shade(0xb9a888, 0.85 + 0.25 * v), 0); }
  const PARKC = { forest: shade(0xb4cf86, 0.72), scrub: col(0xd6c98e), sports: shade(0xe2f6aa, 1.0), golf: shade(0xe2f6aa, 1.05), garden: shade(0xd3ec9e, 0.95) };
  for (const p of tile.parks) flat(M.lawn, p.ring, p.holes, PARKC[p.class] || PARK, LIFT.park);          // by class: forest deeper green, scrub dry olive, sports and golf bright
  { let nIsl = 0; for (const p of tile.parks) { if (nIsl >= 6) break; const isl = islandInfo(p.ring); if (!isl || (p.holes && p.holes.length)) continue; nIsl++; dressIsland((cx, y0, cz, sx, sy, sz, yaw, hex) => junkBox(M.junk, X, Z, cx, y0, cz, sx, sy, sz, yaw, col(hex)), isl, gy + LIFT.park); } out.nIslands = nIsl; }       // round traffic islands: painted kerb, hedges, beds (src/world/city/roundabout.js)
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
  const KERB_H = 0.12, KERB_W = 0.3, KERBC = col(0xb4b0a6), KRED = col(0xb23a32), KWHT = col(0xd6d2c6), PAINTED = new Set(['trunk', 'primary', 'secondary']);      /* painted kerbs (owner's GTA frame G8): red and white in 3 m pieces on the main roads */
  /* a kerb along one side of a street: a raised stone (0.12 m, the car physics gets wall circles of negative radius = mountable at walking pace) in 3 m pieces, none where a side street joins */
  const kerb = (pts, F, hw, side, id) => {
    const at = (i, f, off) => { const x = pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * f, z = pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * f, nx = F.nx[i] + (F.nx[i + 1] - F.nx[i]) * f, nz = F.nz[i] + (F.nz[i + 1] - F.nz[i]) * f, k = F.sc[i] + (F.sc[i + 1] - F.sc[i]) * f; return [x + nx * off * k * side, z + nz * off * k * side, nx * side, nz * side]; };
    const m = M.walk, y1 = gy + KERB_H, paint = PAINTED.has(G.classes[G.cls[id]]);
    for (let i = 0; i + 1 < F.n; i++) { const L = Math.hypot(pts[i * 2 + 2] - pts[i * 2], pts[i * 2 + 3] - pts[i * 2 + 1]), n = Math.max(1, Math.round(L / 3));
      for (let q = 0; q < n; q++) { const f0 = q / n, f1 = (q + 1) / n, mid = at(i, (f0 + f1) / 2, hw + KERB_W / 2); if (!mouthFree(mid[0], mid[1], id)) continue;
        const KC = paint ? ((i + q) % 2 ? KRED : KWHT) : KERBC, a0 = at(i, f0, hw), a1 = at(i, f1, hw), b0 = at(i, f0, hw + KERB_W), b1 = at(i, f1, hw + KERB_W), nxv = -a0[2], nzv = -a0[3];       // the inner face looks at the road
        const va = m.v(X(a0[0]), gy, Z(a0[1]), nxv, 0, nzv, KC), vb = m.v(X(a1[0]), gy, Z(a1[1]), nxv, 0, nzv, KC), vc = m.v(X(a1[0]), y1, Z(a1[1]), nxv, 0, nzv, KC), vd = m.v(X(a0[0]), y1, Z(a0[1]), nxv, 0, nzv, KC); m.tri(va, vb, vc, nxv, 0, nzv); m.tri(va, vc, vd, nxv, 0, nzv);
        const ta = m.v(X(a0[0]), y1, Z(a0[1]), 0, 1, 0, KC), tb = m.v(X(a1[0]), y1, Z(a1[1]), 0, 1, 0, KC), tc = m.v(X(b1[0]), y1, Z(b1[1]), 0, 1, 0, KC), td = m.v(X(b0[0]), y1, Z(b0[1]), 0, 1, 0, KC); m.tri(ta, tb, tc, 0, 1, 0); m.tri(ta, tc, td, 0, 1, 0);
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
    if (walk > 0) { const mx = pts[(F.n >> 1) * 2] - CP_CIRCLE.cx, mz = pts[(F.n >> 1) * 2 + 1] - CP_CIRCLE.cz, dcp = Math.hypot(mx, mz), wl = dcp > 90 && dcp < CP_CIRCLE.PLAZA_R && !deck && (cls === 'primary' || cls === 'secondary' || cls === 'tertiary') ? 4.2 : 1.8; /* CP (owner 21 Nov, phase 5): the pavements round the circles and on the radials are wide, 4.2 m, not 1.8 */ strip(M.walk, hw, hw + wl, WALK, 0); if (walk > 1 || two) strip(M.walk, -hw - wl, -hw, WALK, 0); if (!deck) { kerb(pts, F, hw, 1, id); if (walk > 1 || two) kerb(pts, F, hw, -1, id); } }
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
        { const o0 = two ? 0.25 : -hw + 0.25, o1 = hw - 0.25, nl = Math.max(1, Math.round((o1 - o0) / 3.3)), lwid = (o1 - o0) / nl, ay = gy + LIFT.mark - 0.006;      // painted arrows in each arriving lane, 16.5 m back (the kerb lane turns left, the inside lane of three or more turns right, the others go straight)
          if (o1 - o0 > 2.2) for (let k = 0; k < nl; k++) { const o = o0 + (k + 0.5) * lwid, cx = pts[i0 * 2] + tx * 16.5 + nxv * o, cz = pts[i0 * 2 + 1] + tz * 16.5 + nzv * o, turn = nl >= 2 && k === nl - 1 ? 1 : nl >= 3 && k === 0 ? -1 : 0; roadArrow(M.mark, X, Z, ay, cx, cz, -tx, -tz, nxv, nzv, turn); out.nArrow = (out.nArrow || 0) + 1; } }
        if ((out.nMast || 0) < 40) { const o0 = two ? 0.25 : -hw + 0.25, o1 = hw - 0.25; if (o1 - o0 > 2.5) { const off = hw + 0.8, bxm = pts[i0 * 2] + tx * 11 + nxv * off, bzm = pts[i0 * 2 + 1] + tz * 11 + nzv * off, heads = (o1 - o0 > 6 ? [o0 + (o1 - o0) * 0.28, o0 + (o1 - o0) * 0.72] : [(o0 + o1) / 2]).map(o => o - off); mastArm(M.junk, X, Z, gy, bxm, bzm, tx, tz, nxv, nzv, (o0 + (o1 - o0) * 0.12) - off, heads, out.lamps || (out.lamps = []), node); out.nMast = (out.nMast || 0) + 1; } }
        if (SIGNATLAS && (out.nPole || 0) < 40 && (G.oneway[id] === 0 || G.oneway[id] === (end ? 1 : -1))) { const nm = G.names && G.name ? G.names[G.name[id]] : null, en = nm && (typeof nm === 'string' ? nm : nm.en || nm.ref || ''), sp0 = G.speed ? G.speed[id] : 0, sp = sp0 >= 25 && sp0 <= 100 ? SPEEDS.reduce((b, v) => Math.abs(v - sp0) < Math.abs(b - v) ? v : b, 30) : ({ residential: 30, tertiary: 40, secondary: 50, primary: 60, trunk: 60 }[cls] || 40), off = hw + 0.9; signPole(M, X, Z, gy, sx + nxv * off, sz + nzv * off, tx, tz, nxv, nzv, en || null, sp, nm ? hindiName(nm) : '', w >= 6.5 ? { w, dests: destsAt(G, node, id, tx, tz, nxv, nzv) } : null); out.nPole = (out.nPole || 0) + 1; } }
    }
    /* small signs. Give way: where this road ends at an unsignalled node that a bigger road also meets, 4 m before the node on the kerb. Speed camera and route number plate: 28 to 34 m before a signalled node on a long straight run (a camera on a minority of roads, the plate where the road has a number, NH 48 and the like). */
    if (SIGNATLAS && !deck && !sunk && lay === 0 && ['trunk', 'primary', 'secondary', 'tertiary', 'residential'].includes(cls) && w >= 4) for (const end of [0, 1]) {
      if (clip & (end ? 2 : 1)) continue; if (!(G.oneway[id] === 0 || G.oneway[id] === (end ? 1 : -1))) continue; const node = end ? G.b[id] : G.a[id], fl = G.nodeFlags[node]; const nx0 = G.xz[node * 2], nz0 = G.xz[node * 2 + 1], e0 = end ? pts.length - 2 : 0; if (Math.hypot(pts[e0] - nx0, pts[e0 + 1] - nz0) > 3) continue;
      const i0 = end ? F.n - 1 : 0, i1 = end ? F.n - 2 : 1, dx = pts[i1 * 2] - pts[i0 * 2], dz = pts[i1 * 2 + 1] - pts[i0 * 2 + 1], L = Math.hypot(dx, dz); if (L < 6) continue; const tx = dx / L, tz = dz / L, nxv = -tz, nzv = tx, off = hw + 0.8, put = (d, extra) => signPole(M, X, Z, gy, pts[i0 * 2] + tx * d + nxv * off, pts[i0 * 2 + 1] + tz * d + nzv * off, tx, tz, nxv, nzv, null, 0, '', null, extra);
      if (!(fl & 1)) { const { head, nxt } = adjOf(G); let deg = 0, bigger = false; for (let h = head[node]; h >= 0; h = nxt[h]) { const e = h >> 1; if (e === id) continue; deg++; if ((RANKOF[G.classes[G.cls[e]]] || 0) > rank) bigger = true; }
        if (deg >= 2 && bigger && (out.nGive || 0) < 30) { const stop = rank <= 1 && (G.nodeFlags[node] & 2) === 0 && hash(id * 13 + end) < 0.6; put(stop ? 3.5 : 4, { kind: stop ? 'stop' : 'give' }); if (stop) { const sx = pts[i0 * 2] + tx * 3.2, sz = pts[i0 * 2 + 1] + tz * 3.2, o0 = two ? 0.25 : -hw + 0.25, o1 = hw - 0.25, m = M.mark, y = gy + LIFT.mark, P = (o, d) => m.v(X(sx + nxv * o + tx * d), y, Z(sz + nzv * o + tz * d), 0, 1, 0, MARK); if (o1 - o0 > 1) { const q0 = P(o0, -0.25), q1 = P(o1, -0.25), q2 = P(o1, 0.25), q3 = P(o0, 0.25); m.tri(q0, q1, q2, 0, 1, 0); m.tri(q0, q2, q3, 0, 1, 0); } } out.nGive = (out.nGive || 0) + 1; if (typeof window !== 'undefined') { const q = window.__signs || (window.__signs = { junction: 0, give: 0, chev: 0, cam: 0, ref: 0, signal: 0 }); q.give++; } }
        /* Delhi-wide: a main road (secondary and up) arriving at any junction, signalled or not, gets its name board and speed plate, and the bigger ones the direction gantry (only 1,017 of the 38,913 main-road junction ends are mapped as signals, mostly outside Connaught Place) */
        else if (deg >= 2 && !bigger && rank >= 2 && w >= 5.5 && (out.nJ || 0) < 24) { const nm = G.names && G.name ? G.names[G.name[id]] : null, en = nm && nm.en, sp0 = G.speed ? G.speed[id] : 0, sp = sp0 >= 25 && sp0 <= 100 ? SPEEDS.reduce((b2, v) => Math.abs(v - sp0) < Math.abs(b2 - v) ? v : b2, 30) : ({ tertiary: 40, secondary: 50, primary: 60, trunk: 60 }[cls] || 40);
          signPole(M, X, Z, gy, pts[i0 * 2] + tx * 8.2 + nxv * off, pts[i0 * 2 + 1] + tz * 8.2 + nzv * off, tx, tz, nxv, nzv, en || null, sp, nm ? hindiName(nm) : '', rank >= 4 && w >= 6.5 ? { w, dests: destsAt(G, node, id, tx, tz, nxv, nzv) } : null); out.nJ = (out.nJ || 0) + 1; if (typeof window !== 'undefined') { const q = window.__signs || (window.__signs = { junction: 0, give: 0, chev: 0, cam: 0, ref: 0, signal: 0 }); q.junction++; } } }
      else if (L >= 36 && rank >= 3) { const nm = G.names && G.name ? G.names[G.name[id]] : null, rf = nm && nm.ref; if (rf && rank >= 4 && (out.nRef || 0) < 10 && hash(id * 31 + end) < 0.5) { put(26, { kind: 'ref', ref: rf }); out.nRef = (out.nRef || 0) + 1; } else if ((out.nCam || 0) < 6 && hash(id * 57 + end) < 0.25) { put(32, { kind: 'cam' }); out.nCam = (out.nCam || 0) + 1; } }
    }
    /* curve chevrons: where the road turns more than 29 degrees inside 24 m (not near its ends), a chevron board on the outside of the curve, 30 m apart at most; two-sided so each direction sees its own */
    if (SIGNATLAS && !deck && !sunk && lay === 0 && ['trunk', 'primary', 'secondary', 'tertiary'].includes(cls) && w >= 6 && F.n >= 4 && (out.nChev || 0) < 30) {
      let lastArc = -99; const total = F.arc[F.n - 1];
      for (let i = 1; i < F.n - 1 && (out.nChev || 0) < 30; i++) { const s0 = F.arc[i]; if (s0 < 14 || s0 > total - 14 || s0 - lastArc < 30) continue;
        let j0 = i; while (j0 > 0 && s0 - F.arc[j0] < 12) j0--; let j1 = i; while (j1 < F.n - 1 && F.arc[j1] - s0 < 12) j1++;
        const ax = pts[i * 2] - pts[j0 * 2], az = pts[i * 2 + 1] - pts[j0 * 2 + 1], bx = pts[j1 * 2] - pts[i * 2], bz = pts[j1 * 2 + 1] - pts[i * 2 + 1], la = Math.hypot(ax, az), lb = Math.hypot(bx, bz); if (la < 5 || lb < 5) continue;
        const cr = (ax * bz - az * bx) / (la * lb), dt = (ax * bx + az * bz) / (la * lb), ang = Math.atan2(Math.abs(cr), dt); if (ang < 0.5) continue;
        let hx = ax / la + bx / lb, hz = az / la + bz / lb; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl; const left = cr < 0, ox = left ? -hz : hz, oz = left ? hx : -hx;          // heading of travel; outside of the curve (a left turn bends away from the right-hand side)
        signPole(M, X, Z, gy, pts[i * 2] + ox * (hw + 1.0), pts[i * 2 + 1] + oz * (hw + 1.0), -hx, -hz, hz, -hx, null, 0, '', null, { kind: 'chev', dir: left ? 'left' : 'right' }); out.nChev = (out.nChev || 0) + 1; lastArc = s0; }
    }
    /* lane marks: a dashed line on the centre of a two-way street, between the lanes of a one-way street; none near a junction (the piece ends that are real nodes) */
    if (['motorway', 'trunk', 'primary', 'secondary', 'tertiary'].includes(cls) && w >= 5.5) {
      const dbl = two && w >= 7, divs = []; if (two) { if (!dbl) divs.push(0); const side = Math.floor(lanes / 2); for (let k = 1; k < side; k++) divs.push(k * w / lanes, -k * w / lanes); } else { const nl = Math.max(lanes, Math.round(w / 3.3)); for (let k = 1; k < nl; k++) divs.push(-hw + k * w / nl); }       /* a wide one-way road tagged with one lane (the CP circles: 9 m, 1 lane) gets lane lines by its width, one per 3.3 m */
      const total = F.arc[F.n - 1], lo = clip & 1 ? 0 : 9, hi = total - (clip & 2 ? 0 : 9);
      const at = sa => { let i = 0; while (i + 2 < F.n && F.arc[i + 1] < sa) i++; const f = Math.max(0, Math.min(1, (sa - F.arc[i]) / Math.max(0.01, F.arc[i + 1] - F.arc[i]))), j = i + 1; return { x: pts[i * 2] + (pts[j * 2] - pts[i * 2]) * f, z: pts[i * 2 + 1] + (pts[j * 2 + 1] - pts[i * 2 + 1]) * f, nx: F.nx[i] + (F.nx[j] - F.nx[i]) * f, nz: F.nz[i] + (F.nz[j] - F.nz[i]) * f, y: H[i] + (H[j] - H[i]) * f }; };
      /* CP match, owner's GTA frames 11 to 14: a two-way road 7 m or wider has a DOUBLE SOLID YELLOW centre line, and the main roads have solid white edge lines (Delhi's own roads vary; this follows the owner's references) */
      const solid = (off, e, C) => { const m = M.mark; let prev = -1; for (let s0 = lo; s0 <= hi + 5.99; s0 += 6) { const q = at(Math.min(s0, hi)), y = gy + q.y + LIFT.mark, va = m.v(X(q.x + q.nx * (off - e)), y, Z(q.z + q.nz * (off - e)), 0, 1, 0, C), vb = m.v(X(q.x + q.nx * (off + e)), y, Z(q.z + q.nz * (off + e)), 0, 1, 0, C); if (prev >= 0) { m.tri(prev, prev + 1, va, 0, 1, 0); m.tri(prev + 1, vb, va, 0, 1, 0); } prev = va; } };
      if (dbl) { solid(-0.14, 0.045, YEL); solid(0.14, 0.045, YEL); }
      if (w >= 7 && cls !== 'residential') { solid(-(hw - 0.3), 0.07, MARK); solid(hw - 0.3, 0.07, MARK); }
      for (const off of divs) for (let s0 = lo; s0 + 3 < hi; s0 += 9) {
        const m = M.mark; let prev = -1; for (let k = 0; k <= 2; k++) { const q = at(s0 + k * 1.5), y = gy + q.y + LIFT.mark, e = 0.08;
          const va = m.v(X(q.x + q.nx * (off - e)), y, Z(q.z + q.nz * (off - e)), 0, 1, 0, MARK), vb = m.v(X(q.x + q.nx * (off + e)), y, Z(q.z + q.nz * (off + e)), 0, 1, 0, MARK); if (prev >= 0) { m.tri(prev, prev + 1, va, 0, 1, 0); m.tri(prev + 1, vb, va, 0, 1, 0); } prev = va; }
      }
    }
    if (!deck && !sunk && lay === 0 && ['trunk', 'primary', 'secondary', 'tertiary', 'residential'].includes(cls) && w >= 5.5 && WEAR) { const mi = (pts.length / 4) | 0, g = grimeAt(IDW, vipLm, pts[mi * 2], pts[mi * 2 + 1]); wearDetail(M.mark, M.junk, F, pts, H, w, hw, id, gy, X, Z, two, out.wear || (out.wear = { tr: 0, pa: 0, mh: 0, cr: 0, du: 0, ph: 0, lf: 0, gb: 0, bl: 0, rp: 0, al: 0 }), g, walk > 0, M.wearD, M.wearL); }      // GTA-style road wear (reference G1 to G5)
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
  let cornN = 0, arcN = 0, nArc = 0, drumN = 0;
  /* the CP colonnade (reference N19: white columns, a continuous shaded walk, shop bays behind): a paved walk D m deep along the wall, square columns every ~3.6 m at its outer edge, and a slab over it at 5.6 m (the photos R2 and R4: columns about 3 persons high, about 0.7 m across; an estimate) whose underside is darker; one wall is about 20 triangles per bay */
  const arcade = (B, ax, az, bx, bz, nx, nz, l, y0, D, k, y1) => {
    const wc = shade(0xf1ede2, 0.94 + 0.08 * k), sc = wc.clone().multiplyScalar(0.62), pc = shade(0x9c978c, 0.9 + 0.2 * k), H = 5.6, T = 0.5, TH = 0.5, tx = (bx - ax) / l, tz = (bz - az) / l, nb = Math.max(2, Math.round(l / 3.6)), P = (u, d) => [ax + tx * u + nx * d, az + tz * u + nz * d];
    const face = (p, q, ya, yb, c, wx, wz) => { let a = p, b = q; if ((-(q[1] - p[1])) * wx + (q[0] - p[0]) * wz < 0) { a = q; b = p; } const v = (pt, y) => B.v(X(pt[0]), y, Z(pt[1]), wx, 0, wz, c, 0.06, 0.06); const q0 = v(a, ya), q1 = v(b, ya), q2 = v(b, yb), q3 = v(a, yb); B.tri(q0, q1, q2, wx, 0, wz); B.tri(q0, q2, q3, wx, 0, wz); };
    const flat = (pts, y, c, up) => { const idx = pts.map(pt => B.v(X(pt[0]), y, Z(pt[1]), 0, up, 0, c, 0.06, 0.06)); const cr = (pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0]); const o = (cr < 0) === (up > 0) ? 0 : 1; B.tri(idx[0], idx[o ? 2 : 1], idx[o ? 1 : 2], 0, up, 0); B.tri(idx[0], idx[o ? 3 : 2], idx[o ? 2 : 3], 0, up, 0); };
    const A0 = P(0, 0), A1 = P(l, 0), A2 = P(l, D), A3 = P(0, D), ye = y0 + H;
    const wv = (pt) => M.walk.v(X(pt[0]), gy + LIFT.walk + 0.012, Z(pt[1]), 0, 1, 0, pc, X(pt[0]) / TEX_WALK, Z(pt[1]) / TEX_WALK), w = [wv(A0), wv(A1), wv(A2), wv(A3)]; M.walk.tri(w[0], w[3], w[2], 0, 1, 0); M.walk.tri(w[0], w[2], w[1], 0, 1, 0);   // paved walk
    flat([A0, A1, A2, A3], ye, sc, -1); flat([A0, A1, A2, A3], ye + TH, wc, 1); face(A3, A2, ye, ye + TH, wc, nx, nz); brandBand(M.cpbrand, X, Z, A3[0], A3[1], A2[0], A2[1], nx, nz, ye + TH, 1.1, 3.6, Math.floor(k * 1000)); brandBand(M.cpbrand, X, Z, A0[0], A0[1], A1[0], A1[1], nx, nz, ye + TH + 0.45, 1.0, 5.0, Math.floor(k * 1000) + 5, true);      /* L2: a second, sparser row of boards on the wall above the slab (docs/CP_LANDMARKS.md) */ boardReflections(M.cplight, X, Z, A3[0], A3[1], A2[0], A2[1], nx, nz, y0 + 0.08, 3.6, Math.floor(k * 1000));      /* the boards' reflections on the wet paving at night */ if (y1) facadeBands(B, X, Z, ax, az, bx, bz, nx, nz, ye + TH + 1.2, y1, wc); soffitLights(M.cpbrand, X, Z, ax, az, tx, tz, nx, nz, l, D, ye, nb); arcadePools(M.cplight, X, Z, ax, az, tx, tz, nx, nz, l, D, y0 + 0.07, nb); wallWash(M.cplight, X, Z, ax, az, tx, tz, nx, nz, l, nb, ye);      /* warm lights under the slab, glowing at night */      /* the brand-board band on the arcade front (cpfacade.js) */                                           // soffit, top of the slab and its front fascia
    face(A0, A3, ye, ye + TH, wc, tx, tz); face(A1, A2, ye, ye + TH, wc, -tx, -tz);
    for (let q = 0; q <= nb; q++) { const u = q === 0 ? 0.5 : q === nb ? l - 0.5 : l * q / nb, rc = P(u, D - 0.55); roundColumn(M.colm, X, Z, rc[0], y0, rc[1], H, wc); columnWash(M.cplight, X, Z, rc[0], rc[1], nx, nz, tx, tz, y0);       // the round column (near view) and the light spilling down it at night
      if (q > 0 && q < nb && q % 3 === 1) bladeSign(M.cpbrand, X, Z, rc[0], rc[1], nx, nz, tx, tz, y0 + 2.9, Math.floor(k * 1000) + q);      // a vertical blade sign on every third column (cpfacade.js)
      const c0 = P(u - T / 2, D - 0.8), c1 = P(u + T / 2, D - 0.8), c2 = P(u + T / 2, D - 0.3), c3 = P(u - T / 2, D - 0.3);                // columns
      face(c3, c2, y0, ye, wc, nx, nz); face(c0, c3, y0, ye, sc, -tx, -tz); face(c1, c2, y0, ye, wc, tx, tz); }
    nArc++;
  };
  for (const b of tile.buildings) {
    if (ctx.yieldNow && ctx.yieldNow()) yield;
    if (ruled.has(b)) continue;
    const r = b.ring, n = r.length / 2; if (n < 3) continue; let L = b.landmark ? lm.get(b.landmark) : null, kit = L && L.type ? 'gov' : { office: 'off', hotel: 'off', civic: 'gov', religious: 'gov', transit: 'gov' }[b.use] || 'res', B = b.infill ? M.infill : kit === 'off' ? M.bldgO : kit === 'gov' ? M.bldgG : M.bldg, shopB = !L && (b.use === 'commercial' || b.use === 'retail') && (b.height || 9) >= 5, hgt = Math.max(3, (L && L.height) || cpLift(b, guessHeight(b, hash), hash)), y0 = gy + (b.minHeight || 0), y1 = gy + hgt;
    const cpF = !b.infill && (!L || L.type === 'district') && hgt >= 9 && !!(ctx.life && ctx.life.identity) && ctx.life.identity.areaNameAt(r[0], r[1]) === 'cp'; if (cpF) B = M.bldgCP;       /* a CP block: its own facade texture (cpFacadeTextures): arched and shuttered windows on 4.0 m storeys counted from the top of the arcade band, 7.3 m up */
    const vv = yy => cpF ? (yy - gy - 7.3) / 16 : (yy - gy) / 12.8;
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
      let nx = dz / l, nz = -dx / l; if (!ccw) { nx = -nx; nz = -nz; } const u1 = l / 14.4, v0 = vv(y0), v1 = vv(y1), y2 = Math.min(y1, y0 + 2.4), AO = 0.6;
      /* a wall in two quads: the foot (2.4 m, darker at the ground like a shadow) and the rest; a shop's ground floor is its own quad with the shop-front texture */
      const quad = (m, ya, yb, ca, cb, va, vb) => { const q0 = m.v(X(ax), ya, Z(az), nx, 0, nz, ca, 0, va), q1 = m.v(X(bx), ya, Z(bz), nx, 0, nz, ca, u1, va), q2 = m.v(X(bx), yb, Z(bz), nx, 0, nz, cb, u1, vb), q3 = m.v(X(ax), yb, Z(az), nx, 0, nz, cb, 0, vb); m.tri(q0, q1, q2, nx, 0, nz); m.tri(q0, q2, q3, nx, 0, nz); };
      const dark = c0 => c0.clone().multiplyScalar(AO);
      if (shopB && y1 - y0 > 4) { const ys = y0 + 3.2, sc = shade(0xffffff, 0.7 + 0.3 * hash(b.id * 11 + i)); quad(b.infill ? M.infillShop : M.shop, y0, ys, dark(sc), sc, 0, 1); quad(B, ys, y1, wc, wc, vv(ys), v1); }
      else if (b.infill) quad(B, y0, y1, wc, wc, v0, v1);                                  // infill: one quad a wall (it is drawn only near, and in the hundreds)
      else { quad(B, y0, y2, dark(wc), wc, v0, vv(y2)); if (y1 > y2) quad(B, y2, y1, wc, wc, vv(y2), v1); }
      if (corn && l > 2.5) { const cc = shade(wall, 1.12 + 0.1 * hash(b.id * 13 + i)), cd = cc.clone().multiplyScalar(0.78), ox = nx * 0.4, oz = nz * 0.4, yb = y1 - 0.35, yt = y1 + 0.25;
        const f0 = B.v(X(ax + ox), yb, Z(az + oz), nx, 0, nz, cd, 0.06, 0.06), f1 = B.v(X(bx + ox), yb, Z(bz + oz), nx, 0, nz, cd, 0.06, 0.06), f2 = B.v(X(bx + ox), yt, Z(bz + oz), nx, 0, nz, cc, 0.06, 0.06), f3 = B.v(X(ax + ox), yt, Z(az + oz), nx, 0, nz, cc, 0.06, 0.06); B.tri(f0, f1, f2, nx, 0, nz); B.tri(f0, f2, f3, nx, 0, nz);
        const t0 = B.v(X(ax + ox), yt, Z(az + oz), 0, 1, 0, cc, 0.06, 0.06), t1 = B.v(X(bx + ox), yt, Z(bz + oz), 0, 1, 0, cc, 0.06, 0.06), t2 = B.v(X(bx), yt, Z(bz), 0, 1, 0, cc, 0.06, 0.06), t3 = B.v(X(ax), yt, Z(az), 0, 1, 0, cc, 0.06, 0.06); B.tri(t0, t1, t2, 0, 1, 0); B.tri(t0, t2, t3, 0, 1, 0); B.tri(t0, t2, t1, 0, 1, 0); B.tri(t0, t3, t2, 0, 1, 0); }
      if (arc && l >= 8 && arcN < 200 && infill.streetClear) { const D = 3.4, ok = [0.08, 0.5, 0.92].every(t => infill.streetClear(ax + dx * t + nx * (D + 0.6), az + dz * t + nz * (D + 0.6), 0.6) && infill.streetClear(ax + dx * t + nx * (D * 0.5), az + dz * t + nz * (D * 0.5), 0.4));
        if (ok) { arcN++; arcade(B, ax, az, bx, bz, nx, nz, l, y0, D, hash(b.id * 29 + i), y1); } }
      if (arc && l > 4) roofCornice(B, X, Z, ax, az, bx, bz, nx, nz, y1, wc);      /* the deep roof cornice of the CP blocks (cpfacade.js) */
      if (hgt < 60 || i % 2 === 0) { const mx = (ax + bx) / 2 - nx * 0.7, mz = (az + bz) / 2 - nz * 0.7; for (let s = 0; s < l; s += 2) { const t = (s + 1) / l; if (t > 1) break; out.circles.push(ax + dx * t - nx * WALL_R, az + dz * t - nz * WALL_R, WALL_R); } void mx; void mz; }
    }
    if (arc && drumN < 30 && Math.hypot(r[0] - CP_CIRCLE.cx, r[1] - CP_CIRCLE.cz) > 135 && Math.hypot(r[0] - CP_CIRCLE.cx, r[1] - CP_CIRCLE.cz) < 340) { let mine = 0; for (let i = 0; i < n && mine < 2 && drumN < 30; i++) { const p = (i + n - 1) % n, q = (i + 1) % n, ax = r[p * 2] - r[i * 2], az = r[p * 2 + 1] - r[i * 2 + 1], bx = r[q * 2] - r[i * 2], bz = r[q * 2 + 1] - r[i * 2 + 1], la = Math.hypot(ax, az), lb = Math.hypot(bx, bz); if (la < 10 || lb < 10) continue;
        const cosA = (ax * bx + az * bz) / (la * lb), cross = ax * bz - az * bx; if (cosA < -0.34 || cosA > 0.5 || (cross < 0) !== ccw) continue;          /* a convex corner of 60 to 110 degrees: the drum corner block of the CP photos (cpfacade.js drumCorner), 2 a building and 30 a tile at most */
        let ox = -(ax / la + bx / lb), oz = -(az / la + bz / lb); const ol = Math.hypot(ox, oz) || 1; drumCorner(B, X, Z, r[i * 2], r[i * 2 + 1], ox / ol, oz / ol, y0, y1, wc, wc.clone().multiplyScalar(0.16)); mine++; drumN++;
        { const uxn = ox / ol, uzn = oz / ol, pxn = -uzn, pzn = uxn, dcx = r[i * 2] - uxn * 1.815, dcz = r[i * 2 + 1] - uzn * 1.815, bx2 = dcx + uxn * 4.1, bz2 = dcz + uzn * 4.1;      /* paired corner columns under a lintel in front of the drum */
          for (const sg of [-1, 1]) roundColumn(M.colm, X, Z, bx2 + pxn * 1.6 * sg, y0, bz2 + pzn * 1.6 * sg, 5.6, wc); junkBox(M.colm, X, Z, bx2, y0 + 5.6, bz2, 3.9, 0.55, 0.9, Math.atan2(pzn, pxn), wc); } } }
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
  if (ctx.life) { const r = yield* buildStreetLife(tile, { G, gy, size, ...ctx.life, Mesher, yieldNow: ctx.yieldNow, cpbrand: M.cpbrand, cplight: M.cplight }, out); Object.assign(M, r.M); out.life = r.stats; }
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
  const kit = k => { const [a, b] = k === 'shop' ? shopTextures(rnd) : k === 'cp' ? cpFacadeTextures(rnd) : kitTextures(k, rnd), m = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex(a), emissive: 0xffffff, emissiveMap: tex(b), emissiveIntensity: 0, roughness: 0.92, metalness: 0, envMapIntensity: 0.3 }); m.userData.kit = true; return m; };
  const pbr = (name, tint, dir = 'roads') => { const L = new THREE.TextureLoader(), ld = (f, srgb) => { const t = L.load('assets/' + dir + '/' + name + '_' + f + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }; const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: ld('color', true), normalMap: ld('normal', false), roughnessMap: ld('rough', false), roughness: 1, metalness: 0, envMapIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -5 }); m.normalScale.set(0.8, 0.8); m.color.setScalar(tint); return m; };
  const lawn = (() => { const m = pbr('grass', 1.85, 'ground'); m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -3; return m; })();
  const dirt = (() => { const m = pbr('sand', 1.7, 'ground'); m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; return m; })();
    const plazaTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), S = 128; g.fillStyle = '#d9d2c0'; g.fillRect(0, 0, 512, 512);        // 4 by 4 stone slabs: cream, each its own tone, speckle and a hairline joint
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) { const t = 0.9 + rnd() * 0.16, x = q * S, y = r * S; g.fillStyle = 'rgb(' + Math.round(236 * t) + ',' + Math.round(230 * t) + ',' + Math.round(214 * t) + ')'; g.fillRect(x + 2, y + 2, S - 4, S - 4);
      for (let k = 0; k < 90; k++) { const v = 150 + Math.floor(rnd() * 100); g.fillStyle = 'rgba(' + v + ',' + (v - 4) + ',' + (v - 14) + ',0.22)'; g.fillRect(x + 3 + rnd() * (S - 8), y + 3 + rnd() * (S - 8), 1 + rnd() * 3, 1 + rnd() * 3); }
      g.strokeStyle = 'rgba(120,112,96,0.35)'; g.lineWidth = 1; for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(x + rnd() * S, y + rnd() * S); g.lineTo(x + rnd() * S, y + rnd() * S); g.stroke(); } }
    g.strokeStyle = '#a79f8c'; g.lineWidth = 3; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * S, 0); g.lineTo(k * S, 512); g.stroke(); g.beginPath(); g.moveTo(0, k * S); g.lineTo(512, k * S); g.stroke(); } return c; })();
  const plaza = (() => { const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex(plazaTex), roughness: 0.6, metalness: 0, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); return m; })();
const rsign = (() => { const A = makeSignAtlas(); const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: A.tex, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide, envMapIntensity: 0.4, alphaTest: 0.5 }); return m; })(), junk = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.2 });
  const wearMat = (opacity, lit) => { const o = { vertexColors: true, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -9 }; return lit ? new THREE.MeshStandardMaterial({ ...o, roughness: 1, metalness: 0, envMapIntensity: 0.1 }) : new THREE.MeshBasicMaterial(o); };
  const leafTex = (() => { const t = new THREE.CanvasTexture(makeLeafCanvas()); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })(), hedgeMat = (() => { const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: leafTex, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }); m.userData.kit = true; return m; })();
  const mats = { ground: dirt, plaza, rsign, junk, hedge: hedgeMat, colm: junk, cpbrand: makeBrandMaterial(), cplight: makeLightMaterial(), wearD: wearMat(0.16, false), wearL: wearMat(0.12, true), park: flat(-2, -3, noise), lawn, walk: (() => { const m = pbr('pavement', 1.55); m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; return m; })(), road: pbr('asphalt', 6), mark: flat(-5, -9), sky: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.25, emissive: 0xffd58a, emissiveIntensity: 0 }), bldg: kit('res'), bldgO: kit('off'), bldgG: kit('gov'), bldgCP: kit('cp'), shop: kit('shop'), tex: noise };
  mats.setNight = on => { mats.cpbrand.emissiveIntensity = on ? 1.0 : 0.12; mats.cplight.visible = !!on; mats.plaza.roughness = on ? 0.3 : 0.6; mats.plaza.envMapIntensity = on ? 0.9 : 0.5; for (const k of ['bldg', 'bldgO', 'bldgG', 'bldgCP', 'shop']) mats[k].emissiveIntensity = on ? 1.1 : 0; };
  return mats;
}
