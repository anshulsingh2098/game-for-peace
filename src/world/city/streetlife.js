/* The street life of one tile (D7): what turns plain extruded buildings and strips into a Delhi street. Called by tilemesh.js after the buildings, it adds four merged meshes to the tile: `sign` (shop name boards, from
   the StreetArt atlas), `ad` (unipole hoardings at signalled junctions, flyover-rail boards, bus-shelter panels), `ban` (lamp-post banners and wall posters) and `prop` (vertex coloured: awnings, goods, stalls,
   kiosks, electric poles and wires, lamp posts, bus shelters, street trees). Everything is read from identity.json through the Identity: the area under a building says how dense and what kind the shops are, how
   many boards are stacked, whether there are awnings, stalls and wires, how many ads and which trees. Obstacle circles for the things standing on the pavement go to `out.circles`. Everything is merged per tile
   (4 draw calls) and the meshes are hidden beyond the near radius by CityWorld. Pure geometry (three.js maths only; the textures live in StreetArt). */
import * as THREE from 'three';
import { deckHeight, pieceWidth, pieceSidewalk } from './pack.js';
import { hash } from './identity.js';
import { glowQuad, lightPool } from './cpfacade.js';

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
/* a tree: a trunk and a broad crown of one or two lathed blobs (neem, peepal and jamun in Delhi are 12 to 25 m with wide spreading crowns, so the sizes of identity.json are scaled up, and the crown has a second blob to the side so it is not one ball); `big` scales a whole tree (scrub and forest trees are smaller) */
/* the crown shapes of the main Delhi trees as extra blobs: [dx in crown radii, dy in crown heights, dz, radius scale, height scale]: neem a wide dome of clumps, peepal very broad and low, jamun tall and dense, kikar a flat umbrella */
const BLOBS = { neem: { main: 1, more: [[0.55, 0.12, 0.2, 0.62, 0.7], [-0.5, 0.1, -0.3, 0.6, 0.68], [0.1, 0.32, -0.5, 0.5, 0.6]] }, peepal: { main: 1.05, more: [[0.65, 0.05, 0.1, 0.7, 0.6], [-0.65, 0.05, 0.1, 0.7, 0.6], [0.0, 0.25, 0.55, 0.55, 0.5]] }, jamun: { main: 0.9, more: [[0.3, 0.3, 0.15, 0.55, 0.7], [-0.25, 0.45, -0.2, 0.45, 0.5]] }, gulmohar: { main: 1, more: [[0.6, 0.05, 0.1, 0.65, 0.5], [-0.6, 0.05, -0.1, 0.65, 0.5]] }, amaltas: { main: 0.9, more: [[0.5, 0.1, 0.2, 0.55, 0.6]] } };
const WHITE_C = new THREE.Color(0xffffff), TREE_PIC = { neem: 'delhi_neem', peepal: 'delhi_peepal', jamun: 'delhi_jamun', gulmohar: 'delhi_gulmohar', amaltas: 'delhi_amaltas', kikar: 'delhi_kikar', palm: 'delhi_palm' };
/* a smooth 0..1 field over the ground (two slow waves): where it is high trees stand in clumps, where it is low there are lawns */
const clump = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017) + 0.25 * Math.sin((x + z) * 0.033 + 0.7);
function tree(m, x, y0, z, sp, k, bloom, big = 1, cards = null) {
  const S = 1.4 * big, bu = sp.id === 'bougainvillea', h = sp.h * S * (0.8 + 0.4 * k), r = sp.r * S * (0.8 + 0.4 * ((k * 7) % 1)), th = bu ? 0 : h * 0.4, prof = PROFILE[sp.shape] || PROFILE.round, base = C(bloom && sp.bloom ? sp.bloom : sp.canopy).clone().multiplyScalar(0.85);
  if (cards && !bu) {          // leaf cards: a real-scan tree picture on three crossed planes (6 triangles, not 160), tinted by species; cone trees (ashoka) use the fir card
    const cone = sp.shape === 'cone', key = cone ? 'fir_sapling_0' : TREE_PIC[sp.id] || 'delhi_neem', t = (cone ? base.clone().lerp(WHITE_C, 0.45) : WHITE_C.clone().multiplyScalar(0.92 + 0.12 * ((k * 9) % 1))),
      palm = sp.shape === 'palm', W = cone ? 2 * r * 0.95 * (1.405 / 0.861) : palm ? 2 * r / 0.86 : 2 * r / 0.88, H = cone ? h * (1.405 / 1.301) : palm ? h / 0.86 : h / 0.85, off = cone ? 0.04 * H : palm ? 0.02 * H : 0.05 * H;      /* the palm picture (cpfacade.js makePalmCanvas): crown 86 percent of the width, tree 86 percent of the height, foot 2 percent up */      // the Delhi pictures are drawn with the crown at 88 percent of the width, the tree 85 percent of the height and the foot 5 percent up (tools/make_tree_cards.py)
    (cards[key] || (cards[key] = [])).push(x, y0 - off, z, W, H, t.r, t.g, t.b, k * 6.2832); (cards.shadow || (cards.shadow = [])).push(x, y0, z, r * 1.7); return;
  }
  if (!bu) { const tw = 0.32 + 0.012 * h; box(m, x, y0, z, tw, th + 0.8, tw, 1, 0, C(PALE.wood)); }
  const y1 = y0 + th, ch = h - th;
  const crown = (cx, cz, yb, chh, rr, kk, N, fc) => { const ra = i => 0.84 + 0.32 * ((kk * 13 + (i % N) * 0.618) % 1);
    for (let i = 0; i + 1 < prof.length; i++) { const [h0, r0] = prof[i], [h1, r1] = prof[i + 1]; if (r0 === 0 && r1 === 0) continue; const dy = (h1 - h0) * chh, dr = (r1 - r0) * rr, ln = Math.hypot(dy, dr) || 1, f0 = (0.72 + 0.28 * h0) * fc, f1 = (0.72 + 0.28 * h1) * fc;
      for (let a = 0; a < N; a++) { const ra0 = ra(a), ra1 = ra(a + 1), a0 = a / N * 6.2832, a1 = (a + 1) / N * 6.2832, am = (a0 + a1) / 2, nx = Math.cos(am) * dy / ln, nz = Math.sin(am) * dy / ln, ny = -dr / ln, vr = 0.9 + 0.2 * ((kk * 13 + a) % 1), c0 = base.clone().multiplyScalar(f0 * vr), c1 = base.clone().multiplyScalar(f1 * vr);
        const v0 = m.v(cx + Math.cos(a0) * r0 * rr * ra0, yb + h0 * chh, cz + Math.sin(a0) * r0 * rr * ra0, Math.cos(a0) * dy / ln, ny, Math.sin(a0) * dy / ln, c0), v1 = m.v(cx + Math.cos(a1) * r0 * rr * ra1, yb + h0 * chh, cz + Math.sin(a1) * r0 * rr * ra1, Math.cos(a1) * dy / ln, ny, Math.sin(a1) * dy / ln, c0), v2 = m.v(cx + Math.cos(a1) * r1 * rr * ra1, yb + h1 * chh, cz + Math.sin(a1) * r1 * rr * ra1, Math.cos(a1) * dy / ln, ny, Math.sin(a1) * dy / ln, c1), v3 = m.v(cx + Math.cos(a0) * r1 * rr * ra0, yb + h1 * chh, cz + Math.sin(a0) * r1 * rr * ra0, Math.cos(a0) * dy / ln, ny, Math.sin(a0) * dy / ln, c1);
        if (r0 > 0) m.tri(v0, v1, v2, nx, ny, nz); if (r1 > 0) m.tri(v0, v2, v3, nx, ny, nz); } } };
  crown(x, z, y1, ch, r * (BLOBS[sp.id] ? BLOBS[sp.id].main : 1), k, 8, 1);
  if (!bu && sp.shape !== 'cone') { const t = k * 6.2832, B = BLOBS[sp.id] ? BLOBS[sp.id].more : [[Math.cos(t) * 0.5, 0.1, Math.sin(t) * 0.5, 0.62, 0.72]]; B.forEach((b, q) => crown(x + b[0] * r * Math.cos(t) - b[2] * r * Math.sin(t), z + b[0] * r * Math.sin(t) + b[2] * r * Math.cos(t), y1 + ch * b[1], ch * b[4], r * b[3], k + 0.37 * (q + 1), 6, 0.86 + 0.26 * ((k * 5 + q * 0.3) % 1))); }
}
/* a wire from (x0, y0, z0) to (x1, y1, z1) sagging by `sag`, as a vertical and a flat ribbon of 4 pieces */
function wire(m, x0, y0, z0, x1, y1, z1, sag, c, th = 1, n = 4) {      /* th: thickness factor (1 = a 6 cm ribbon; the CP spans use 2.4 so they read beyond 30 m), n: pieces */
  let px = x0, py = y0, pz = z0; for (let i = 1; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t - sag * 4 * t * (1 - t), dx = x - px, dz = z - pz, l = Math.hypot(dx, dz) || 1, sx = -dz / l * 0.03 * th, sz = dx / l * 0.03 * th;
    quad(m, [px, py, pz], [x, y, z], [x, y + 0.05 * th, z], [px, py + 0.05 * th, pz], sx * 33, 0, sz * 33, c); quad(m, [px - sx, py, pz - sz], [x - sx, y, z - sz], [x + sx, y, z + sz], [px + sx, py, pz + sz], 0, 1, 0, c); px = x; py = y; pz = z; }
}
function inPoly(r, x, z) { let ins = false; const n = r.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = r[i * 2], zi = r[i * 2 + 1], xj = r[j * 2], zj = r[j * 2 + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; } return ins; }

/* tile: the decoded tile; ctx: { G, gy, size, identity, art, month, stops, Mesher, yieldNow }; out: the tile's `out` (circles are added). Returns { sign, ad, ban, prop, stats }. */
export function* buildStreetLife(tile, ctx, out) {
  const { G, gy, size, identity: ID, art, Mesher } = ctx, ox = tile.tx * size, oz = tile.tz * size, seed = tile.tx * 7919 + tile.tz * 104729, rnd = (i, k = 0) => hash(seed + i * 31 + k * 977);
  const M = { sign: new Mesher(), ad: new Mesher(), ban: new Mesher(), prop: new Mesher() }, st = { signs: 0, stacked: 0, awnings: 0, stalls: 0, kiosks: 0, hoardings: 0, shelters: 0, poles: 0, trees: 0, spans: 0 };
  const CARDS = ctx.cards === false ? null : {}; out.cards = CARDS; const plant = (lx, y0, lz, spc, kk, bloom, big) => tree(M.prop, lx, y0, lz, spc, kk, bloom, big, CARDS);
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
    const mid = at(pc, pc.len / 2), an = ID.areaNameAt(mid.x, mid.z), A = ID.area(an), edge = pc.hw + (pc.walk > 0 ? 1.7 : 0.7), lamp = an === 'cp' || an === 'lutyens' || an === 'kartavya' || an === 'business';
    /* poles */
    let prev = null, prevPow = null, pi = 0, prevSide = 0; const step = lamp ? 32 : 28, sd = rnd(pc.id, 5) < 0.5 ? 1 : -1;
    for (let s = 6 + rnd(pc.id, 6) * 6; s < pc.len - 6 && st.poles < cap.poles; s += step) {
      const o = at(pc, s), px = o.x + -o.tz * edge * sd, pz = o.z + o.tx * edge * sd; if (insideBuilding(px, pz, 0.4) || inRoad(px, pz, 0.4)) { prev = null; continue; }
      const [lx, lz] = L(px, pz); st.poles++; circle(px, pz, 0.25);
      if (lamp) { box(M.prop, lx, gy, lz, 0.14, 7, 0.14, 1, 0, C(0x3a3d40)); box(M.prop, lx + o.tz * sd * 1.0, gy + 7, lz - o.tx * sd * 1.0, 0.5, 0.18, 0.3, 1, 0, C(0xe8e0c8)); if (ctx.cpbrand) glowQuad(ctx.cpbrand, x => x, z => z, lx + o.tz * sd * 1.0, gy + 6.99, lz - o.tx * sd * 1.0, 0.5, 0.3, 1, 0); if (ctx.cplight) lightPool(ctx.cplight, x => x, z => z, lx + o.tz * sd * 1.0, gy + 0.08, lz - o.tx * sd * 1.0, 11); }      /* the lamp head glows warm at night (cpfacade.js lamp patch) */
      else { box(M.prop, lx, gy, lz, 0.2, 7.2, 0.2, 1, 0, C(PALE.pole)); box(M.prop, lx, gy + 6.2, lz, 1.4, 0.1, 0.12, -o.tz, o.tx, C(PALE.pole)); }
      const w = rnd(pc.id, s | 0) < A.shop.wires * 1.2;
      if (!lamp && prev && w) { for (let k = 0; k < 3; k++) wire(M.prop, prev.x - ox, gy + 6.3 - k * 0.35, prev.z - oz, px - ox, gy + 6.3 - k * 0.35, pz - oz, 0.6 + 0.25 * k, C(PALE.wire)); st.spans++;
        if (A.shop.wires > 0.6 && rnd(pc.id, s | 0, 3) < 0.5) { const ox2 = px + o.tz * (edge * 2 + pc.hw) * sd, oz2 = pz - o.tx * (edge * 2 + pc.hw) * sd; wire(M.prop, px - ox, gy + 6.0, pz - oz, ox2 - ox, gy + 5.2, oz2 - oz, 0.5, C(PALE.wire)); wire(M.prop, px - ox, gy + 5.7, pz - oz, ox2 - ox, gy + 4.9, oz2 - oz, 0.7, C(PALE.wire)); st.spans++; } }
      if (A.ads > 0.4 && rnd(pc.id, (s | 0) + 3) < A.ads * 0.7) { const c = art.bannerFor(rnd(pc.id, (s | 0) + 7)); for (const f of [1, -1]) board(M.ban, lx + o.tz * sd * 0.5 + o.tx * 0.05 * f, gy + 5.0, lz - o.tx * sd * 0.5 + o.tz * 0.05 * f, o.tx * f, o.tz * f, 0.8, 1.6, WHITE, [c.u0, c.v0, c.u1, c.v1]); }
      prev = { x: px, z: pz }; prevSide = sd; void prevSide;
      /* CP (owner 21 Nov, phase 5 list): a power pole 2.2 m beside every second lamp post (every third gave one pole to a short street piece and so no wire span, seen 21 Nov), a cross-arm and three wires to the last one, so the walk is not bare of overhead cables */
      if (an === 'cp' && (pi++ & 1) === 0) { const qx = px + o.tx * 2.2, qz = pz + o.tz * 2.2; if (!insideBuilding(qx, qz, 0.4) && !inRoad(qx, qz, 0.4)) { const [mx, mz] = L(qx, qz); box(M.prop, mx, gy, mz, 0.22, 8.2, 0.22, 1, 0, C(PALE.pole)); box(M.prop, mx, gy + 7.2, mz, 1.6, 0.1, 0.12, -o.tz, o.tx, C(PALE.pole)); if (prevPow) { for (let k = 0; k < 3; k++) wire(M.prop, prevPow.x - ox, gy + 7.3 - k * 0.3, prevPow.z - oz, qx - ox, gy + 7.3 - k * 0.3, qz - oz, 0.7 + 0.2 * k, C(PALE.wire), 2.4, 8); st.spans++; } prevPow = { x: qx, z: qz }; } }
    }
    /* street trees */
    const dens = (veg.classDensity[pc.cls] || 0.5) * A.trees.density; if (dens > 0.03) {
      const sp = veg.spacing / dens, avenue = A.trees.avenue, one = A.trees.species[Math.floor(rnd(pc.id, 3) * A.trees.species.length)], bloomOn = sp0 => sp0.bloomMonths && sp0.bloomMonths.includes(ctx.month);
      for (const sideSign of [1, -1]) { if (!avenue && rnd(pc.id, 20 + sideSign) > 0.6) continue; for (let s = 4 + rnd(pc.id, 9 + sideSign) * sp; s < pc.len - 4 && st.trees < cap.trees; s += sp * (0.85 + 0.3 * rnd(pc.id, (s | 0) + 11))) {
        const o = at(pc, s), off = pc.hw + (pc.walk > 0 ? 2.0 : 1.2), px = o.x + -o.tz * off * sideSign, pz = o.z + o.tx * off * sideSign; if (insideBuilding(px, pz, 1.6) || inRoad(px, pz, 0.6)) continue;
        const id = avenue ? one : A.trees.species[Math.floor(rnd(pc.id, (s | 0) + 13) * A.trees.species.length)], spc = ID.species.get(id); if (!spc || spc.id === 'bougainvillea') continue; const [lx, lz] = L(px, pz); plant(lx, gy, lz, spc, rnd(pc.id, (s | 0) + 17), bloomOn(spc)); st.trees++; circle(px, pz, 0.4); } }
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
      const sp = ID.species.get('bougainvillea'); if (sp && rnd(pc.id, (s | 0) + 46) < 0.8) { const [lx, lz] = L(o.x, o.z); plant(lx, gy, lz, sp, rnd(pc.id, (s | 0) + 47), false); st.trees++; } }
  }
  /* ---- hoardings at signalled junctions: a unipole beside the street 12 m before the signal ---- */
  for (const f of tile.furniture || []) { if (f.kind !== 'signal') continue; const ns = nearest(f.x, f.z); if (!ns) continue; const A = ID.areaAt(f.x, f.z), k = Math.floor(f.x * 3 + f.z * 7); if (rnd(k, 50) > A.ads * 1.4) continue;
    const dir = rnd(k, 51) < 0.5 ? 1 : -1, off = ns.hw + 3.2, side = rnd(k, 52) < 0.5 ? 1 : -1, px = f.x + ns.tx * 14 * dir + -ns.tz * off * side, pz = f.z + ns.tz * 14 * dir + ns.tx * off * side; if (insideBuilding(px, pz, 2)) continue;
    const [lx, lz] = L(px, pz); box(M.prop, lx, gy, lz, 0.6, 9.2, 0.6, 1, 0, C(PALE.steel)); box(M.prop, lx, gy + 6.95, lz, 8.2, 0.14, 0.3, ns.tz, -ns.tx, C(0x4a4e52));      /* the catwalk under the board: 8.2 m long ALONG the board and thin (it was sized per axis and never turned, so a diagonal street got a 6 m by 6 m flat slab) */
    for (const f2 of [1, -1]) { const c = art.adFor(rnd(k, 53 + f2)); board(M.ad, lx + ns.tx * 0.45 * f2, gy + 9.2, lz + ns.tz * 0.45 * f2, ns.tx * f2, ns.tz * f2, 8, 4, WHITE, [c.u0, c.v0, c.u1, c.v1]); } st.hoardings++; circle(px, pz, 0.5); }
  /* ---- bus shelters at the stops of the transit data ---- */
  for (const sp of ctx.stops || []) { const ns = nearest(sp[0], sp[1]); if (!ns || ns.d > 30) continue; const side = ns.side, off = ns.hw + 1.2, px = ns.px + -ns.tz * off * side, pz = ns.pz + ns.tx * off * side; if (insideBuilding(px, pz, 1.4)) continue;
    const [lx, lz] = L(px, pz), nxo = -ns.tz * side, nzo = ns.tx * side;                    // nxo, nzo: towards the road is the opposite way: the shelter's open side faces the road
    box(M.prop, lx, gy + 2.45, lz, 3.0, 0.1, 1.5, ns.tx, ns.tz, C(0x3a4a5a)); for (const q of [-1, 1]) box(M.prop, lx + ns.tx * q * 1.4, gy, lz + ns.tz * q * 1.4, 0.08, 2.45, 0.08, 1, 0, C(PALE.steel));
    box(M.prop, lx + nxo * 0.55, gy + 0.45, lz + nzo * 0.55, 2.2, 0.08, 0.4, ns.tx, ns.tz, C(PALE.steel), C(PALE.steel)); const c = art.bannerFor(rnd(Math.floor(sp[0]), Math.floor(sp[1])));
    board(M.ban, lx + nxo * 0.7, gy + 1.5, lz + nzo * 0.7, -nxo, -nzo, 1.2, 1.9, WHITE, [c.u0, c.v0, c.u1, c.v1]); box(M.prop, lx - ns.tx * 2.0 - nxo * 0.2, gy, lz - ns.tz * 2.0 - nzo * 0.2, 0.08, 3.2, 0.08, 1, 0, C(PALE.steel)); box(M.prop, lx - ns.tx * 2.0 - nxo * 0.2, gy + 2.7, lz - ns.tz * 2.0 - nzo * 0.2, 0.5, 0.4, 0.05, ns.tx, ns.tz, C(PALE.green));
    st.shelters++; circle(px + ns.tx * 0.9, pz + ns.tz * 0.9, 0.7); circle(px - ns.tx * 0.9, pz - ns.tz * 0.9, 0.7); }
  /* ---- park trees: lawns, gardens, scrub and forest get trees by their class (the Ridge and other forests are dense, scrub is sparse and small, sports grounds and golf courses nearly bare), spaced by the area profile on a jittered grid, never in a building or a road ---- */
  { let np = 0, nc = 0; const CAP_PARK = 900, CAP_COLONY = 260, bloomOnP = sp0 => sp0.bloomMonths && sp0.bloomMonths.includes(ctx.month), KIND = { forest: [6, 0.85, 0.9], scrub: [9, 0.35, 0.55], park: [10, 0.5, 1], garden: [9, 0.55, 0.9], grass: [16, 0.2, 1], sports: [18, 0.12, 1], golf: [14, 0.25, 1], colony: [16, 0.3, 0.85] };          // colony: the trees of residential plots (the forest survey counts about 147 km2 of tree cover outside the forests, about a tenth of Delhi, which the map does not show as parks)
    for (const p of [...(tile.parks || []), ...(tile.blocks || []).filter(b => b.landuse === 'residential').map(b => ({ ring: b.ring, holes: b.holes, class: 'colony' }))]) { const R = p.ring; if (!R || R.length < 8) continue; if (p.class === 'colony' && nc >= CAP_COLONY) continue; if (ctx.yieldNow && ctx.yieldNow()) yield; const [STEP, base, big] = KIND[p.class] || [12, 0.4, 1]; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (let i = 0; i < R.length; i += 2) { x0 = Math.min(x0, R[i]); x1 = Math.max(x1, R[i]); z0 = Math.min(z0, R[i + 1]); z1 = Math.max(z1, R[i + 1]); }
      for (let gx = x0 + STEP / 2; gx < x1 && np < CAP_PARK; gx += STEP) for (let gz = z0 + STEP / 2; gz < z1 && np < CAP_PARK; gz += STEP) {
        const key = Math.floor(gx * 3) * 7919 + Math.floor(gz * 5); const px = gx + (rnd(901, key) - 0.5) * STEP * 0.8, pz = gz + (rnd(902, key) - 0.5) * STEP * 0.8; if (!inPoly(R, px, pz)) continue; let hole = false; for (const h of p.holes || []) if (inPoly(h, px, pz)) { hole = true; break; } if (hole) continue;
        const an = ID.areaNameAt(px, pz), A = ID.area(an), dens = Math.min(0.92, base * (0.6 + 0.8 * A.trees.density)); if (rnd(903, key) > Math.min(0.95, dens * (0.15 + 1.7 * clump(px, pz)))) continue; if (insideBuilding(px, pz, 2.0) || inRoad(px, pz, 1.0)) continue;
        const forest = p.class === 'forest' || p.class === 'scrub', list = forest ? ['neem', 'peepal', 'jamun'] : A.trees.species, id = list[Math.floor(rnd(904, key) * list.length)], spc = ID.species.get(id); if (!spc || spc.id === 'bougainvillea') continue; const [lx, lz] = L(px, pz); plant(lx, gy, lz, spc, rnd(905, key), bloomOnP(spc), big * (forest ? 0.8 + 0.4 * rnd(906, key) : 1)); np++; if (p.class === 'colony') nc++; st.trees++; circle(px, pz, 0.4); } }
  }
  /* ---- hedges: a low clipped hedge along the outer edge of the avenues of Lutyens' Delhi, DDA colonies and Connaught Place ---- */
  { let nh = 0; for (const pc of pieces) { if (nh > 260 || pc.lay !== 0 || !DRIVABLE.has(pc.cls) || pc.len < 24) continue; const mid = at(pc, pc.len / 2), an = ID.areaNameAt(mid.x, mid.z); if (an !== 'lutyens' && an !== 'kartavya' && an !== 'dda' && an !== 'cp') continue; if (ctx.yieldNow && ctx.yieldNow()) yield;
      for (const side of [1, -1]) { if (rnd(pc.id, 70 + side) > 0.55) continue; for (let s = 6; s < pc.len - 6 && nh < 260; s += 6) { const o = at(pc, s), off = pc.hw + (pc.walk > 0 ? 3.4 : 2.4), px = o.x + -o.tz * off * side, pz = o.z + o.tx * off * side; if (insideBuilding(px, pz, 1.2) || inRoad(px, pz, 0.8) || [-3.1, 3.1].some(e => inRoad(px + o.tx * e, pz + o.tz * e, 1.1) || insideBuilding(px + o.tx * e, pz + o.tz * e, 0.5))) continue; /* both ends too: a 5.6 m hedge no longer reaches across the mouth of a side street (seen from above at Radial Road 7, CP match log) */ const [lx, lz] = L(px, pz); box(M.prop, lx, gy, lz, 5.6, 0.85, 0.9, o.tx, o.tz, C(0x3a6a2a), C(0x4f8236)); nh++; } } }
    st.hedges = nh; }
  /* ---- compound walls: a low plastered wall with a coping along the plot edge of the residential streets of Lutyens' Delhi and the DDA colonies, in gaps and not through anything ---- */
  { let nw = 0; for (const pc of pieces) { if (nw > 220 || pc.lay !== 0 || !DRIVABLE.has(pc.cls) || pc.len < 20) continue; const mid = at(pc, pc.len / 2), an = ID.areaNameAt(mid.x, mid.z); if ((an !== 'lutyens' && an !== 'dda') || (pc.cls !== 'residential' && pc.cls !== 'tertiary')) continue; if (ctx.yieldNow && ctx.yieldNow()) yield;
      for (const side of [1, -1]) { if (rnd(pc.id, 90 + side) > 0.6) continue; const wc = [0xe4d8bd, 0xd9caa6, 0xefe6d0, 0xcdb890][Math.floor(rnd(pc.id, 92) * 4)];
        for (let s = 5; s < pc.len - 5 && nw < 220; s += 6) { const o = at(pc, s), off = pc.hw + (pc.walk > 0 ? 5.4 : 4.2), px = o.x + -o.tz * off * side, pz = o.z + o.tx * off * side; if (insideBuilding(px, pz, 1.4) || inRoad(px, pz, 1.2)) continue; const [lx, lz] = L(px, pz); box(M.prop, lx, gy, lz, 6.0, 1.7, 0.3, o.tx, o.tz, C(wc), C(0xf4efe2)); nw++; } } }
    st.walls = nw; }
  /* ---- medians: where two one-way carriageways of a main road run side by side with a gap, the gap is a kerbed median with a clipped shrub strip and now and then a tree (only the carriageway heading the positive way draws it, so it is drawn once) ---- */
  { let nm = 0; for (const pc of pieces) { if (nm > 220 || pc.lay !== 0 || pc.len < 30 || !(pc.cls === 'primary' || pc.cls === 'secondary' || pc.cls === 'trunk')) continue; const ow = G.oneway[pc.id]; if (!ow) continue; if (ctx.yieldNow && ctx.yieldNow()) yield;
      for (let sm = 8; sm < pc.len - 8 && nm < 220; sm += 10) { const o = at(pc, sm), dx = o.tx * ow, dz = o.tz * ow; if (!(dx > 0.01 || (Math.abs(dx) <= 0.01 && dz > 0))) continue; const nx = -o.tz * ow, nz = o.tx * ow; let hit = 0;
        for (let t = pc.hw + 1.0; t < pc.hw + 22; t += 1.5) { if (inRoad(o.x + nx * t, o.z + nz * t, 0.2)) { hit = t; break; } } const gap = hit - pc.hw; if (!hit || gap < 2.4 || gap > 20) continue;
        const ns = nearest(o.x + nx * hit, o.z + nz * hit); if (!ns || Math.abs(ns.tx * o.tx + ns.tz * o.tz) < 0.92) continue;
        const tm = pc.hw + gap / 2, mx = o.x + nx * tm, mz = o.z + nz * tm, [lx, lz] = L(mx, mz), wd = Math.max(1.0, gap - 0.9);
        box(M.prop, lx, gy, lz, 10.4, 0.18, wd, o.tx, o.tz, C(0xb4b0a6)); if (wd > 1.6) box(M.prop, lx, gy + 0.18, lz, 10.0, 0.55, wd - 0.7, o.tx, o.tz, C(0x3d6b2b), C(0x5a8f3a));
        if (gap > 3.6 && ((sm / 10) | 0) % 2 === 0) { const sp = ID.species.get('ashoka'); if (sp) plant(lx, gy, lz, sp, rnd(pc.id, (sm | 0) + 80), false, 0.55); }
        nm++; } }
    st.medians = nm; }
  return { M, stats: st };
}
