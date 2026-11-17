/* The street life of one tile (D7): what turns plain extruded buildings and strips into a Delhi street. Called by tilemesh.js after the buildings, it adds four merged meshes to the tile: `sign` (shop name boards, from
   the StreetArt atlas), `ad` (unipole hoardings at signalled junctions, flyover-rail boards, bus-shelter panels), `ban` (lamp-post banners and wall posters) and `prop` (vertex coloured: awnings, goods, stalls,
   kiosks, electric poles and wires, lamp posts, bus shelters, street trees). Everything is read from identity.json through the Identity: the area under a building says how dense and what kind the shops are, how
   many boards are stacked, whether there are awnings, stalls and wires, how many ads and which trees. Obstacle circles for the things standing on the pavement go to `out.circles`. Everything is merged per tile
   (4 draw calls) and the meshes are hidden beyond the near radius by CityWorld. Pure geometry (three.js maths only; the textures live in StreetArt). */
import * as THREE from 'three';
import { deckHeight, pieceWidth, pieceSidewalk } from './pack.js';
import { hash } from './identity.js';

const PALE = { red: 0xb8332b, blue: 0x2a64c9, green: 0x2f8f5b, yellow: 0xe3b21a, orange: 0xe8791e, white: 0xe8e2d0, tarp: 0x3a7ab8, pink: 0xc23a7a, grey: 0x8a8a86, dark: 0x2b2b2d, wood: 0x6a4a2a, pole: 0x9a9890, steel: 0x6a6e72, wire: 0x16161a };
const GOODS = { sweets: [0xf2b134, 0xe8e0c8, 0xd96a3a], cloth: [0xc23a7a, 0x2a64c9, 0xe3b21a, 0x2f8f5b], electronics: [0x2b2b2d, 0xd9d9d9], hardware: [0x8a8a86, 0xb8332b, 0x2a64c9], chai: [0xe8e0c8, 0x6a4a2a], paan: [0x2f8f5b, 0xe8e0c8], pharmacy: [0xe8e0c8, 0x2f8f5b], mobile: [0x2b2b2d, 0x2a64c9], barber: [0xe8e0c8], jewellery: [0xe3b21a], spices: [0xd96a3a, 0xe3b21a, 0x8a5a2a], shoes: [0x2b2b2d, 0x6a4a2a, 0xc23a7a] };
const PROFILE = { round: [[0, 0], [0.25, 0.85], [0.6, 1], [0.85, 0.7], [1, 0]], oval: [[0, 0], [0.2, 0.7], [0.5, 1], [0.8, 0.8], [1, 0]], cone: [[0, 0.9], [0.5, 0.55], [1, 0]], flat: [[0, 0], [0.3, 0.9], [0.55, 1], [0.8, 0.7], [1, 0]] };
const DRIVABLE = new Set(['primary', 'secondary', 'tertiary', 'residential', 'trunk']);
const cache = new Map(), C = h => { let c = cache.get(h); if (!c) { c = new THREE.Color(h); cache.set(h, c); } return c; };

/* a flat rectangle: corners bottom-left, bottom-right, top-right, top-left (each [x, y, z]); uv = [u0, v0, u1, v1] */
function quad(m, A, B, Cc, D, nx, ny, nz, c, uv) {
  const u = uv || [0, 0, 0, 0], a = m.v(A[0], A[1], A[2], nx, ny, nz, c, u[0], u[1]), b = m.v(B[0], B[1], B[2], nx, ny, nz, c, u[2], u[1]), cc = m.v(Cc[0], Cc[1], Cc[2], nx, ny, nz, c, u[2], u[3]), d = m.v(D[0], D[1], D[2], nx, ny, nz, c, u[0], u[3]);
  m.tri(a, b, cc, nx, ny, nz); m.tri(a, cc, d, nx, ny, nz);
}
/* a board centred at (cx, cy, cz) facing outwards along (nx, nz): reads left to right for a viewer in front */
function board(m, cx, cy, cz, nx, nz, w, h, c, uv) { const ux = nz * w / 2, uz = -nx * w / 2; quad(m, [cx - ux, cy - h / 2, cz - uz], [cx + ux, cy - h / 2, cz + uz], [cx + ux, cy + h / 2, cz + uz], [cx - ux, cy + h / 2, cz - uz], nx, 0, nz, c, uv); }
/* a box standing on y0 with its width along (ux, uz) */
function box(m, cx, y0, cz, sx, sy, sz, ux, uz, c, cTop) {
  const hx = sx / 2, hz = sz / 2, fx = -uz, fz = ux, y1 = y0 + sy, P = (i, j, y) => [cx + ux * hx * i + fx * hz * j, y, cz + uz * hx * i + fz * hz * j];
  quad(m, P(-1, 1, y0), P(1, 1, y0), P(1, 1, y1), P(-1, 1, y1), fx, 0, fz, c); quad(m, P(1, -1, y0), P(-1, -1, y0), P(-1, -1, y1), P(1, -1, y1), -fx, 0, -fz, c);
  quad(m, P(1, 1, y0), P(1, -1, y0), P(1, -1, y1), P(1, 1, y1), ux, 0, uz, c); quad(m, P(-1, -1, y0), P(-1, 1, y0), P(-1, 1, y1), P(-1, -1, y1), -ux, 0, -uz, c);
  quad(m, P(-1, -1, y1), P(1, -1, y1), P(1, 1, y1), P(-1, 1, y1), 0, 1, 0, cTop || c);
}
/* a tree: a trunk box and a lathed crown from a profile (sides of 6) */
function tree(m, x, y0, z, sp, k, bloom) {
  const h = sp.h * (0.8 + 0.4 * k), r = sp.r * (0.8 + 0.4 * ((k * 7) % 1)), th = h * 0.42, prof = PROFILE[sp.shape] || PROFILE.round, base = C(bloom && sp.bloom ? sp.bloom : sp.canopy), N = 6;
  if (sp.id !== 'bougainvillea') box(m, x, y0, z, 0.3, th + 0.6, 0.3, 1, 0, C(PALE.wood));
  const y1 = y0 + th * (sp.id === 'bougainvillea' ? 0 : 1), ch = h - th * (sp.id === 'bougainvillea' ? 0 : 1);
  for (let i = 0; i + 1 < prof.length; i++) { const [h0, r0] = prof[i], [h1, r1] = prof[i + 1]; if (r0 === 0 && r1 === 0) continue; const dy = (h1 - h0) * ch, dr = (r1 - r0) * r, ln = Math.hypot(dy, dr) || 1, f0 = 0.72 + 0.28 * h0, f1 = 0.72 + 0.28 * h1;
    for (let a = 0; a < N; a++) { const a0 = a / N * 6.2832, a1 = (a + 1) / N * 6.2832, am = (a0 + a1) / 2, nx = Math.cos(am) * dy / ln, nz = Math.sin(am) * dy / ln, ny = -dr / ln, c0 = base.clone().multiplyScalar(f0 * (0.9 + 0.2 * ((k * 13 + a) % 1))), c1 = base.clone().multiplyScalar(f1 * (0.9 + 0.2 * ((k * 13 + a) % 1)));
      const v0 = m.v(x + Math.cos(a0) * r0 * r, y1 + h0 * ch, z + Math.sin(a0) * r0 * r, nx, ny, nz, c0), v1 = m.v(x + Math.cos(a1) * r0 * r, y1 + h0 * ch, z + Math.sin(a1) * r0 * r, nx, ny, nz, c0), v2 = m.v(x + Math.cos(a1) * r1 * r, y1 + h1 * ch, z + Math.sin(a1) * r1 * r, nx, ny, nz, c1), v3 = m.v(x + Math.cos(a0) * r1 * r, y1 + h1 * ch, z + Math.sin(a0) * r1 * r, nx, ny, nz, c1);
      if (r0 > 0) m.tri(v0, v1, v2, nx, ny, nz); if (r1 > 0) m.tri(v0, v2, v3, nx, ny, nz); } }
}
/* a wire from (x0, y0, z0) to (x1, y1, z1) sagging by `sag`, as a vertical and a flat ribbon of 4 pieces */
function wire(m, x0, y0, z0, x1, y1, z1, sag, c) {
  const n = 4; let px = x0, py = y0, pz = z0; for (let i = 1; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t - sag * 4 * t * (1 - t), dx = x - px, dz = z - pz, l = Math.hypot(dx, dz) || 1, sx = -dz / l * 0.03, sz = dx / l * 0.03;
    quad(m, [px, py, pz], [x, y, z], [x, y + 0.05, z], [px, py + 0.05, pz], sx * 33, 0, sz * 33, c); quad(m, [px - sx, py, pz - sz], [x - sx, y, z - sz], [x + sx, y, z + sz], [px + sx, py, pz + sz], 0, 1, 0, c); px = x; py = y; pz = z; }
}
function inPoly(r, x, z) { let ins = false; const n = r.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = r[i * 2], zi = r[i * 2 + 1], xj = r[j * 2], zj = r[j * 2 + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; } return ins; }

/* tile: the decoded tile; ctx: { G, gy, size, identity, art, month, stops, Mesher, yieldNow }; out: the tile's `out` (circles are added). Returns { sign, ad, ban, prop, stats }. */
export function* buildStreetLife(tile, ctx, out) {
  const { G, gy, size, identity: ID, art, Mesher } = ctx, ox = tile.tx * size, oz = tile.tz * size, seed = tile.tx * 7919 + tile.tz * 104729, rnd = (i, k = 0) => hash(seed + i * 31 + k * 977);
  const M = { sign: new Mesher(), ad: new Mesher(), ban: new Mesher(), prop: new Mesher() }, st = { signs: 0, stacked: 0, awnings: 0, stalls: 0, kiosks: 0, hoardings: 0, shelters: 0, poles: 0, trees: 0, spans: 0 };
  /* local frame in, circles absolute out */
  const L = (x, z) => [x - ox, z - oz], circle = (x, z, r) => out.circles.push(x, z, r), WHITE = C(0xffffff);
  /* the street pieces of the tile (ground level), with a grid of their segments for "where is the nearest street" */
  const pieces = [], grid = new Map(), CELL = 24; let sid = 0;
  for (const s of tile.streets) { const id = s.id, cls = G.classes[G.cls[id]], lay = G.layer[id]; if (s.pts.length < 4) continue; const w = pieceWidth(G, s), walk = pieceSidewalk(G, s), p = s.pts, cum = [0]; for (let i = 2; i < p.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]));
    const pc = { s, id, cls, lay, w, hw: w / 2, walk, p, cum, len: cum[cum.length - 1], n: sid++ }; pieces.push(pc); if (lay !== 0 || !DRIVABLE.has(cls)) continue;
    for (let i = 0; i + 3 < p.length; i += 2) { const x0 = p[i], z0 = p[i + 1], x1 = p[i + 2], z1 = p[i + 3], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (CELL / 2))); let last = ''; for (let k = 0; k <= n; k++) { const key = Math.floor((x0 + (x1 - x0) * k / n) / CELL) + ',' + Math.floor((z0 + (z1 - z0) * k / n) / CELL); if (key === last) continue; last = key; let l = grid.get(key); if (!l) grid.set(key, l = []); l.push({ pc, x0, z0, x1, z1 }); } } }
  /* the nearest ground street to (x, z) within 40 m: { d (to the centre line), hw, tx, tz (direction), side (+1 right of travel), px, pz (the closest point) } */
  const nearest = (x, z) => { let best = null, bd = 40; const i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const l = grid.get((i0 + a) + ',' + (j0 + b)); if (l) for (const q of l) { const dx = q.x1 - q.x0, dz = q.z1 - q.z0, L2 = dx * dx + dz * dz, f = L2 ? Math.max(0, Math.min(1, ((x - q.x0) * dx + (z - q.z0) * dz) / L2)) : 0, px = q.x0 + dx * f, pz = q.z0 + dz * f, d = Math.hypot(x - px, z - pz); if (d < bd) { const ln = Math.sqrt(L2) || 1, tx = dx / ln, tz = dz / ln; bd = d; best = { d, hw: q.pc.hw, walk: q.pc.walk, tx, tz, side: (x - px) * -tz + (z - pz) * tx >= 0 ? 1 : -1, px, pz, pc: q.pc }; } } } return best; };
  /* true when a prop of radius r at (x, z) would stand in the carriageway of ANY ground street (its own is kept clear by its offset; a crossing or parallel street's is not) */
  const inRoad = (x, z, r) => { const i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = grid.get((i0 + a) + ',' + (j0 + b)); if (l) for (const q of l) { const dx = q.x1 - q.x0, dz = q.z1 - q.z0, L2 = dx * dx + dz * dz, f = L2 ? Math.max(0, Math.min(1, ((x - q.x0) * dx + (z - q.z0) * dz) / L2)) : 0; if (Math.hypot(x - (q.x0 + dx * f), z - (q.z0 + dz * f)) < q.pc.hw + r - 0.05) return true; } } return false; };
  /* the buildings of the tile in a grid, for "is this point inside one" */
  const bgrid = new Map(), BC = 32; for (const b of tile.buildings) { const r = b.ring; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]); } for (let i = Math.floor(x0 / BC); i <= Math.floor(x1 / BC); i++) for (let j = Math.floor(z0 / BC); j <= Math.floor(z1 / BC); j++) { const k = i + ',' + j; let l = bgrid.get(k); if (!l) bgrid.set(k, l = []); l.push(b); } }
  const insideBuilding = (x, z, pad = 0) => { const l = bgrid.get(Math.floor(x / BC) + ',' + Math.floor(z / BC)); if (l) for (const b of l) if (inPoly(b.ring, x, z) || (pad && (inPoly(b.ring, x + pad, z) || inPoly(b.ring, x - pad, z) || inPoly(b.ring, x, z + pad) || inPoly(b.ring, x, z - pad)))) return true; return false; };
  const at = (pc, s) => { const c = pc.cum, p = pc.p; let i = 0; while (i + 2 < c.length && c[i + 1] < s) i++; const f = Math.max(0, Math.min(1, (s - c[i]) / Math.max(0.01, c[i + 1] - c[i]))), dx = p[i * 2 + 2] - p[i * 2], dz = p[i * 2 + 3] - p[i * 2 + 1], l = Math.hypot(dx, dz) || 1; return { x: p[i * 2] + dx * f, z: p[i * 2 + 1] + dz * f, tx: dx / l, tz: dz / l }; };

  /* ---- shops: boards, stacked boards, awnings, goods, along the walls that face a street ---- */
  let cnt = 0;
  for (const b of tile.buildings) {
    if (ctx.yieldNow && (++cnt & 15) === 0 && ctx.yieldNow()) yield;
    const r = b.ring, n = r.length / 2; if (n < 3 || b.minHeight) continue; let cx = 0, cz = 0, area = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; cx += r[i * 2]; cz += r[i * 2 + 1]; area += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1]; } cx /= n; cz /= n;
    const A = ID.area(ID.areaOfBuilding(b, cx, cz)), an = ID.areaOfBuilding(b, cx, cz), com = b.use === 'commercial' || b.use === 'retail', hgt = b.height || 9; if (hgt < 4 || b.landmark) continue;
    const p = com ? A.shop.density : (A.shop.density >= 0.5 ? A.shop.density * 0.5 : A.shop.density * 0.12); if (rnd(b.id) > p) continue;
    const ccw = area > 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ax = r[i * 2], az = r[i * 2 + 1], dx = r[j * 2] - ax, dz = r[j * 2 + 1] - az, l = Math.hypot(dx, dz); if (l < 3.2) continue; let nx = dz / l, nz = -dx / l; if (!ccw) { nx = -nx; nz = -nz; }
      const mx = ax + dx / 2, mz = az + dz / 2, ns = nearest(mx + nx * 3, mz + nz * 3); if (!ns || ns.d - ns.hw > 11) continue;
      const nb = Math.min(4, Math.max(1, Math.round(l / 5.5))), kindBase = ID.shopKind(an, rnd(b.id, i + 1)), ex = dx / l, ez = dz / l, gap = ns.d - ns.hw - 1.8;
      for (let k = 0; k < nb; k++) {
        const t = l * (k + 0.5) / nb, w = Math.min(5.5, l / nb - 0.3), px = ax + ex * t + nx * 0.12, pz = az + ez * t + nz * 0.12, kind = k && rnd(b.id, i * 5 + k) < 0.5 ? ID.shopKind(an, rnd(b.id, i * 5 + k + 40)) : kindBase;
        const cell = art.signFor(kind, rnd(b.id, i * 9 + k)); board(M.sign, px - ox, gy + 3.55, pz - oz, nx, nz, w, w * 0.2 > 1.1 ? 1.1 : Math.max(0.7, w * 0.2), WHITE, [cell.u0, cell.v0, cell.u1, cell.v1]); st.signs++;
        for (let q = 1; q < A.shop.stack; q++) { const y = gy + 3.55 + q * 1.6; if (y + 1 > gy + hgt) break; const kk = ID.shopKind(an, rnd(b.id, i * 13 + k * 3 + q)), c2 = art.signFor(kk, rnd(b.id, i * 17 + q)); board(M.sign, px - ox + nx * 0.05 * q, y, pz - oz + nz * 0.05 * q, nx, nz, w * 0.85, 0.9, C(0xd8d0c4), [c2.u0, c2.v0, c2.u1, c2.v1]); st.stacked++; }
        if (rnd(b.id, i * 7 + k) < A.shop.awning) {                                         // an awning over the shop front: stripes of two colours, sloping down and out
          const AW = [PALE.red, PALE.blue, PALE.yellow, PALE.green, PALE.orange, PALE.white], c0 = C(AW[Math.floor(rnd(b.id, i + k * 3) * AW.length)]), c1 = C(PALE.white), ux = ex * w / 2, uz = ez * w / 2, out0 = 1.3, y0 = gy + 3.0, y1 = gy + 2.5, S = 6;
          for (let s2 = 0; s2 < S; s2++) { const f0 = s2 / S, f1 = (s2 + 1) / S, X0 = px - ox - ux + ux * 2 * f0, Z0 = pz - oz - uz + uz * 2 * f0, X1 = px - ox - ux + ux * 2 * f1, Z1 = pz - oz - uz + uz * 2 * f1; quad(M.prop, [X0, y0, Z0], [X1, y0, Z1], [X1 + nx * out0, y1, Z1 + nz * out0], [X0 + nx * out0, y1, Z0 + nz * out0], nx * 0.4, 0.9, nz * 0.4, s2 % 2 ? c1 : c0); } st.awnings++; }
        if (gap < 3 && A.shop.density > 0.4 && rnd(b.id, i * 11 + k) < 0.5) { const gs = GOODS[kind] || GOODS.cloth, ng = 2 + Math.floor(rnd(b.id, i + k) * 3); for (let g = 0; g < ng; g++) { const o = (g / ng - 0.5) * w * 0.8, gx = px + ex * o + nx * 0.5, gz = pz + ez * o + nz * 0.5; box(M.prop, gx - ox, gy, gz - oz, 0.5 + 0.2 * (g % 2), 0.5 + 0.35 * rnd(b.id, g + k), 0.5, ex, ez, C(gs[(g + k) % gs.length])); } }
      }
    }
  }
  /* ---- along the streets: poles and wires, lamp posts and banners, stalls and kiosks, street trees ---- */
  out.stallPts = []; const veg = ctx.identity.j.vegetation, cap = { trees: 520, poles: 320 };
  for (const pc of pieces) {
    if (ctx.yieldNow && ctx.yieldNow()) yield;
    if (pc.lay !== 0 || !DRIVABLE.has(pc.cls) || pc.len < 14) { if (pc.lay > 0 && pc.len > 20) deckLife(pc); continue; }
    const mid = at(pc, pc.len / 2), an = ID.areaNameAt(mid.x, mid.z), A = ID.area(an), edge = pc.hw + (pc.walk > 0 ? 1.7 : 0.7), lamp = an === 'cp' || an === 'lutyens' || an === 'business';
    /* poles */
    let prev = null, prevSide = 0; const step = lamp ? 32 : 28, sd = rnd(pc.id, 5) < 0.5 ? 1 : -1;
    for (let s = 6 + rnd(pc.id, 6) * 6; s < pc.len - 6 && st.poles < cap.poles; s += step) {
      const o = at(pc, s), px = o.x + -o.tz * edge * sd, pz = o.z + o.tx * edge * sd; if (insideBuilding(px, pz, 0.4) || inRoad(px, pz, 0.4)) { prev = null; continue; }
      const [lx, lz] = L(px, pz); st.poles++; circle(px, pz, 0.25);
      if (lamp) { box(M.prop, lx, gy, lz, 0.14, 7, 0.14, 1, 0, C(0x3a3d40)); box(M.prop, lx + o.tz * sd * 1.0, gy + 7, lz - o.tx * sd * 1.0, 0.5, 0.18, 0.3, 1, 0, C(0xe8e0c8)); }
      else { box(M.prop, lx, gy, lz, 0.2, 7.2, 0.2, 1, 0, C(PALE.pole)); box(M.prop, lx, gy + 6.2, lz, 1.4, 0.1, 0.12, -o.tz, o.tx, C(PALE.pole)); }
      const w = rnd(pc.id, s | 0) < A.shop.wires * 1.2;
      if (!lamp && prev && w) { for (let k = 0; k < 3; k++) wire(M.prop, prev.x - ox, gy + 6.3 - k * 0.35, prev.z - oz, px - ox, gy + 6.3 - k * 0.35, pz - oz, 0.6 + 0.25 * k, C(PALE.wire)); st.spans++;
        if (A.shop.wires > 0.6 && rnd(pc.id, s | 0, 3) < 0.5) { const ox2 = px + o.tz * (edge * 2 + pc.hw) * sd, oz2 = pz - o.tx * (edge * 2 + pc.hw) * sd; wire(M.prop, px - ox, gy + 6.0, pz - oz, ox2 - ox, gy + 5.2, oz2 - oz, 0.5, C(PALE.wire)); wire(M.prop, px - ox, gy + 5.7, pz - oz, ox2 - ox, gy + 4.9, oz2 - oz, 0.7, C(PALE.wire)); st.spans++; } }
      if (A.ads > 0.4 && rnd(pc.id, (s | 0) + 3) < A.ads * 0.7) { const c = art.bannerFor(rnd(pc.id, (s | 0) + 7)); for (const f of [1, -1]) board(M.ban, lx + o.tz * sd * 0.5 + o.tx * 0.05 * f, gy + 5.0, lz - o.tx * sd * 0.5 + o.tz * 0.05 * f, o.tx * f, o.tz * f, 0.8, 1.6, WHITE, [c.u0, c.v0, c.u1, c.v1]); }
      prev = { x: px, z: pz }; prevSide = sd; void prevSide;
    }
    /* street trees */
    const dens = (veg.classDensity[pc.cls] || 0.5) * A.trees.density; if (dens > 0.03) {
      const sp = veg.spacing / dens, avenue = A.trees.avenue, one = A.trees.species[Math.floor(rnd(pc.id, 3) * A.trees.species.length)], bloomOn = sp0 => sp0.bloomMonths && sp0.bloomMonths.includes(ctx.month);
      for (const sideSign of [1, -1]) { if (!avenue && rnd(pc.id, 20 + sideSign) > 0.6) continue; for (let s = 4 + rnd(pc.id, 9 + sideSign) * sp; s < pc.len - 4 && st.trees < cap.trees; s += sp * (0.85 + 0.3 * rnd(pc.id, (s | 0) + 11))) {
        const o = at(pc, s), off = pc.hw + (pc.walk > 0 ? 2.0 : 1.2), px = o.x + -o.tz * off * sideSign, pz = o.z + o.tx * off * sideSign; if (insideBuilding(px, pz, 1.6) || inRoad(px, pz, 0.6)) continue;
        const id = avenue ? one : A.trees.species[Math.floor(rnd(pc.id, (s | 0) + 13) * A.trees.species.length)], spc = ID.species.get(id); if (!spc || spc.id === 'bougainvillea') continue; const [lx, lz] = L(px, pz); tree(M.prop, lx, gy, lz, spc, rnd(pc.id, (s | 0) + 17), bloomOn(spc)); st.trees++; circle(px, pz, 0.4); } }
    }
    /* stalls and kiosks on the pavement of market streets */
    if (A.shop.stalls > 0.05 && pc.len > 24) { const sp = 20 / A.shop.stalls, side = rnd(pc.id, 31) < 0.5 ? 1 : -1;
      for (let s = 9 + rnd(pc.id, 32) * sp; s < pc.len - 9; s += sp * (0.8 + 0.5 * rnd(pc.id, (s | 0) + 33))) { const o = at(pc, s), off = pc.hw + 1.1, px = o.x + -o.tz * off * side, pz = o.z + o.tx * off * side; if (insideBuilding(px, pz, 0.8) || inRoad(px, pz, 1.0)) continue;
        const [lx, lz] = L(px, pz), kind = ID.shopKind(an, rnd(pc.id, (s | 0) + 34)), t = rnd(pc.id, (s | 0) + 35); st.stalls++; out.stallPts.push(px, pz);
        if (t < 0.28 && (kind === 'chai' || kind === 'paan' || kind === 'mobile' || kind === 'sweets')) { box(M.prop, lx, gy, lz, 1.7, 2.3, 1.4, o.tx, o.tz, C(0x5a7a8a)); box(M.prop, lx, gy + 2.3, lz, 2.1, 0.12, 1.8, o.tx, o.tz, C(PALE.red)); const c = art.signFor(kind, rnd(pc.id, (s | 0) + 36)); board(M.sign, lx + o.tz * side * 0.75, gy + 2.0, lz - o.tx * side * 0.75, o.tz * side, -o.tx * side, 1.5, 0.4, WHITE, [c.u0, c.v0, c.u1, c.v1]); st.kiosks++; circle(px, pz, 0.9); }
        else { const gs = GOODS[kind] || GOODS.cloth, cc = [PALE.tarp, PALE.orange, PALE.red, PALE.white, PALE.yellow][Math.floor(t * 5) % 5]; box(M.prop, lx, gy, lz, 1.8, 0.85, 0.9, o.tx, o.tz, C(PALE.wood)); for (let g = 0; g < 4; g++) box(M.prop, lx + o.tx * (g - 1.5) * 0.4, gy + 0.85, lz + o.tz * (g - 1.5) * 0.4, 0.34, 0.2 + 0.1 * (g % 2), 0.5, o.tx, o.tz, C(gs[g % gs.length]));
          if (t > 0.4) { for (const q of [-1, 1]) box(M.prop, lx + o.tx * q * 0.95, gy, lz + o.tz * q * 0.95, 0.05, 2.1, 0.05, 1, 0, C(PALE.steel)); box(M.prop, lx, gy + 2.1, lz, 2.2, 0.04, 1.6, o.tx, o.tz, C(cc)); } circle(px, pz, 0.8); } } }
  }
  /* flyover decks: ad boards on the rails every 60 m, bougainvillea at the foot of the piers */
  function deckLife(pc) {
    for (let s = 20 + rnd(pc.id, 41) * 20; s < pc.len - 20; s += 55 + 30 * rnd(pc.id, (s | 0) + 42)) { const o = at(pc, s), h = deckHeight(G, pc.id, o.x, o.z); if (h < 3) continue; const mid = ID.areaAt(o.x, o.z), side = rnd(pc.id, (s | 0) + 43) < 0.5 ? 1 : -1;
      if (rnd(pc.id, (s | 0) + 44) < Math.max(0.3, mid.ads)) { const c = art.adFor(rnd(pc.id, (s | 0) + 45)), off = pc.hw + 0.35; board(M.ad, o.x - ox + -o.tz * off * side, gy + h + 1.7, o.z - oz + o.tx * off * side, -o.tz * side, o.tx * side, 5, 2.5, WHITE, [c.u0, c.v0, c.u1, c.v1]); st.hoardings++; }
      const sp = ID.species.get('bougainvillea'); if (sp && rnd(pc.id, (s | 0) + 46) < 0.8) { const [lx, lz] = L(o.x, o.z); tree(M.prop, lx, gy, lz, sp, rnd(pc.id, (s | 0) + 47), false); st.trees++; } }
  }
  /* ---- hoardings at signalled junctions: a unipole beside the street 12 m before the signal ---- */
  for (const f of tile.furniture || []) { if (f.kind !== 'signal') continue; const ns = nearest(f.x, f.z); if (!ns) continue; const A = ID.areaAt(f.x, f.z), k = Math.floor(f.x * 3 + f.z * 7); if (rnd(k, 50) > A.ads * 1.4) continue;
    const dir = rnd(k, 51) < 0.5 ? 1 : -1, off = ns.hw + 3.2, side = rnd(k, 52) < 0.5 ? 1 : -1, px = f.x + ns.tx * 14 * dir + -ns.tz * off * side, pz = f.z + ns.tz * 14 * dir + ns.tx * off * side; if (insideBuilding(px, pz, 2)) continue;
    const [lx, lz] = L(px, pz); box(M.prop, lx, gy, lz, 0.6, 9.2, 0.6, 1, 0, C(PALE.steel)); box(M.prop, lx, gy + 7, lz, 0.3 + 8.2 * Math.abs(ns.tz), 0.2, 0.3 + 8.2 * Math.abs(ns.tx), 1, 0, C(0x4a4e52));
    for (const f2 of [1, -1]) { const c = art.adFor(rnd(k, 53 + f2)); board(M.ad, lx + ns.tx * 0.45 * f2, gy + 9.2, lz + ns.tz * 0.45 * f2, ns.tx * f2, ns.tz * f2, 8, 4, WHITE, [c.u0, c.v0, c.u1, c.v1]); } st.hoardings++; circle(px, pz, 0.5); }
  /* ---- bus shelters at the stops of the transit data ---- */
  for (const sp of ctx.stops || []) { const ns = nearest(sp[0], sp[1]); if (!ns || ns.d > 30) continue; const side = ns.side, off = ns.hw + 1.2, px = ns.px + -ns.tz * off * side, pz = ns.pz + ns.tx * off * side; if (insideBuilding(px, pz, 1.4)) continue;
    const [lx, lz] = L(px, pz), nxo = -ns.tz * side, nzo = ns.tx * side;                    // nxo, nzo: towards the road is the opposite way: the shelter's open side faces the road
    box(M.prop, lx, gy + 2.45, lz, 3.0, 0.1, 1.5, ns.tx, ns.tz, C(0x3a4a5a)); for (const q of [-1, 1]) box(M.prop, lx + ns.tx * q * 1.4, gy, lz + ns.tz * q * 1.4, 0.08, 2.45, 0.08, 1, 0, C(PALE.steel));
    box(M.prop, lx + nxo * 0.55, gy + 0.45, lz + nzo * 0.55, 2.2, 0.08, 0.4, ns.tx, ns.tz, C(PALE.steel), C(PALE.steel)); const c = art.bannerFor(rnd(Math.floor(sp[0]), Math.floor(sp[1])));
    board(M.ban, lx + nxo * 0.7, gy + 1.5, lz + nzo * 0.7, -nxo, -nzo, 1.2, 1.9, WHITE, [c.u0, c.v0, c.u1, c.v1]); box(M.prop, lx - ns.tx * 2.0 - nxo * 0.2, gy, lz - ns.tz * 2.0 - nzo * 0.2, 0.08, 3.2, 0.08, 1, 0, C(PALE.steel)); box(M.prop, lx - ns.tx * 2.0 - nxo * 0.2, gy + 2.7, lz - ns.tz * 2.0 - nzo * 0.2, 0.5, 0.4, 0.05, ns.tx, ns.tz, C(PALE.green));
    st.shelters++; circle(px + ns.tx * 0.9, pz + ns.tz * 0.9, 0.7); circle(px - ns.tx * 0.9, pz - ns.tz * 0.9, 0.7); }
  return { M, stats: st };
}
