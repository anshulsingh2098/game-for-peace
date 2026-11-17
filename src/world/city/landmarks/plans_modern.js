/* Temples, Parliament, Connaught Place, the observatory, the gurdwara, the stepwell, the airport and the railway stations. Local frame: x along the landmark's yaw, z across, y up. */
import { frame } from './geo.js';

const MARBLE = 0xf1ede2, GOLD = 0xd9b54a, RED = 0xa5432d, RED_L = 0xb85a3c, CHJ = 0xcdb27c, PINK = 0xe0a98e, CREAM = 0xe3d0a2, WHITE = 0xf3f1ea;

/* ---- Lotus Temple: 27 free-standing white marble petals in three rings of nine, closing into a bud 34 m high, on a low platform with nine pools ---- */
function petal(k, a, r0, r1, h, w0, w1, steps = 6) {
  const rings = [], ca = Math.cos(a), sa = Math.sin(a); for (let i = 0; i <= steps; i++) { const t = i / steps, rr = r0 + (r1 - r0) * (0.25 * t + 0.75 * t * t), w = (w0 + (w1 - w0) * Math.pow(t, 1.1)) / 2, th = 0.7 - 0.25 * t, cx = ca * rr, cz = sa * rr, tx = -sa, tz = ca;
    rings.push({ y: h * t, pts: [[cx - tx * w - ca * th, cz - tz * w - sa * th], [cx + tx * w - ca * th, cz + tz * w - sa * th], [cx + tx * w + ca * th, cz + tz * w + sa * th], [cx - tx * w + ca * th, cz - tz * w + sa * th]] }); }
  k.loft(rings, MARBLE, { mat: 'marble' });
}
const lotusTemple = {
  boardY: s => (s.h || 34) + 8,
  ground: s => [{ x: 0, z: 0, r: Math.min(s.hx, s.hz) * 1.02 }],
  build(k, s) {
    const R = Math.min(s.hx, s.hz) * 0.98, H = s.h || 34;
    k.cyl(0, 0, 0, R, R, 0.7, 0xcfc9b8, { seg: 36 });
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; petal(k, a + Math.PI / 9, R * 0.9, R * 0.5, 14, R * 0.4, 2.2); petal(k, a, R * 0.6, R * 0.2, 24, R * 0.36, 1.8); petal(k, a + Math.PI / 9, R * 0.3, R * 0.01, H, R * 0.27, 1.2);
      const pa = a, px = Math.cos(pa) * R * 0.74, pz = Math.sin(pa) * R * 0.74; k.disc(px, pz, R * 0.14, 0xffffff, { mat: 'water', y: 0.02, seg: 14 }); }
    k.ringSolid(0, 0, R + 0.5, 1.8);
  },
};

/* ---- Akshardham: a pink sandstone and white marble temple on an elephant plinth, a great central dome, smaller domes, pinnacles along the roof and a hall of carved pillars ---- */
const akshardham = {
  boardY: s => (s.h || 43) + 8,
  build(k, s) {
    const hx = s.hx, hz = s.hz, H = s.h || 43, PH = 2.4, bx = hx * 0.86, bz = hz * 0.86, BH = 18;
    k.slab(-hx, -hz, hx, hz, 0, 1.3, 0xd9b9a0); k.slab(-hx + 2, -hz + 2, hx - 2, hz - 2, 1.3, PH - 1.3, PINK);
    for (let i = 0; i < 4; i++) { const sd = [[1, 0], [-1, 0], [0, 1], [0, -1]][i], a = sd[0], b = sd[1], L = (a ? hz : hx) * 2 - 6; for (let q = 0; q < Math.floor(L / 3.6); q++) { const t = -L / 2 + 1.8 + q * 3.6; k.box(a ? a * (hx - 1.1) : t, 0.5, a ? t : b * (hz - 1.1), a ? 1.3 : 2.6, 1.6, a ? 2.6 : 1.3, 0x8a8a84, { d: true }); } }   // the elephant frieze, suggested by a row of grey blocks
    k.box(0, PH, 0, bx * 2, BH, bz * 2, PINK, { mat: 'facade' }); k.box(0, PH + BH, 0, bx * 2 + 2, 1.2, bz * 2 + 2, 0xe9d0b8);
    k.colonnade(-bx - 1.5, -bz + 4, -bx - 1.5, bz - 4, PH, 22, 0.55, 9, 0xe9cbb2, { d: true }); k.colonnade(bx + 1.5, -bz + 4, bx + 1.5, bz - 4, PH, 22, 0.55, 9, 0xe9cbb2, { d: true }); k.colonnade(-bx + 4, bz + 1.5, bx - 4, bz + 1.5, PH, 20, 0.55, 9, 0xe9cbb2, { d: true }); k.colonnade(-bx + 4, -bz - 1.5, bx - 4, -bz - 1.5, PH, 20, 0.55, 9, 0xe9cbb2, { d: true });
    const y = PH + BH + 1.2, dh = H - y - 4; k.cyl(0, y, 0, 11, 12, 6, PINK, { seg: 24 }); k.ringColumns(0, 0, 11.5, 20, y, 0.4, 6, 0xf0e4d8, { d: true, beam: false });
    k.striped(0, y + 6, 0, [[10.5, 0], [11, 2.4], [9.6, 5.4], [6.6, 8.4], [3.4, 10.6], [0.9, 12], [0.05, 12.8]], 3, 0xf0e0d2, 0xe6c4aa, { seg: 28 }); k.cyl(0, y + 18.8, 0, 0.14, 0.4, Math.max(3, dh - 12.8 - 6), GOLD, { mat: 'gold', seg: 6 }); k.cyl(0, y + 22, 0, 0.9, 0.9, 1.5, GOLD, { mat: 'gold', seg: 8, d: true });
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 1], [0, -1], [1, 0], [-1, 0]]) { const x = a * bx * 0.62, z = b * bz * 0.62; k.cyl(x, y, z, 4, 4.4, 3, PINK, { seg: 16 }); k.dome(x, y + 3, z, 4, 5, 0xf0e0d2, { seg: 16, rings: 5 }); k.cyl(x, y + 8, z, 0.05, 0.2, 2, GOLD, { mat: 'gold', seg: 5 }); }
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, x = Math.cos(a) * bx * 0.92, z = Math.sin(a) * bz * 0.92; k.cyl(x, PH + BH + 1.2, z, 0.25, 1.4, 4.4, 0xe9cbb2, { seg: 6, d: true }); }
    k.solid(0, 0, hx, hz, 1.6);
  },
};

/* ---- Sansad Bhavan (the new Parliament): a triangular building of cream and red sandstone with a central foyer and the bronze national emblem on top; Samvidhan Sadan (the old Parliament): the round building with its ring of 144 columns ---- */
const sansadNew = {
  boardY: s => (s.h || 39) + 14,
  build(k, s) {
    const H = s.h || 39.6; k.polyWall(s.poly, 1.6); k.prism(s.poly, 0, 1.2, 0xc9b79a); k.prism(s.poly.map(p => [p[0] * 0.985, p[1] * 0.985]), 1.2, H - 1.2, 0xe6d3ac, { mat: 'facade' }); k.prism(s.poly.map(p => [p[0] * 1.005, p[1] * 1.005]), H, 1.2, 0xc7694a);
    k.prism(s.poly.map(p => [p[0] * 0.5, p[1] * 0.5]), H + 1.2, 6, 0xe6d3ac); k.dome(0, H + 7.2, 0, Math.min(s.hx, s.hz) * 0.22, 4, 0xd9d1bb, { seg: 20, rings: 4 }); k.cyl(0, H + 11.2, 0, 1.4, 1.8, 2.4, 0xb8873f, { mat: 'gold', seg: 12 }); k.cyl(0, H + 13.6, 0, 1.0, 1.4, 3.6, 0xb8873f, { mat: 'gold', seg: 12 });
    for (const v of s.poly) k.box(v[0] * 0.985, H + 1.2, v[1] * 0.985, 2, 2, 2, 0xc7694a, { d: true });
  },
};
const samvidhanSadan = {
  boardY: s => (s.h || 21) + 12,
  build(k, s) {
    const R = Math.min(s.hx, s.hz) * 0.98, H = s.h || 21; k.polyWall(s.poly, 1.6);
    k.cyl(0, 0, 0, R, R, 1.2, 0xc9b79a, { seg: 40 }); k.cyl(0, 1.2, 0, R * 0.78, R * 0.78, H - 4, 0xe6d3ac, { seg: 40, mat: 'facade' }); k.ringColumns(0, 0, R * 0.9, 96, 1.2, 0.55, H - 5.2, 0xefe3c4, { d: true, beamH: 0.9 }); k.cyl(0, H - 4, 0, R * 0.97, R * 0.97, 1.6, 0xe0cfa8, { seg: 40 });
    k.dome(0, H - 2.4, 0, R * 0.36, R * 0.2, 0xd9d1bb, { seg: 28, rings: 5 }); k.cyl(0, H - 2.4, 0, R * 0.36, R * 0.38, 0.8, 0xe0cfa8, { seg: 28 });
  },
};

/* ---- Connaught Place: the inner circle as a ring of white colonnaded blocks round the central park with its great flag ---- */
const connaughtPlace = {
  boardY: () => 70,
  build(k, s) {
    const P = s.poly, inner = P.map(p => [p[0] * 0.84, p[1] * 0.84]), H = 15; k.polyWall(P, 1.6);
    k.prism(P, 0, H, WHITE, { hole: inner.slice().reverse(), mat: 'facade' }); k.prism(P.map(p => [p[0] * 1.005, p[1] * 1.005]), H, 1.0, 0xe4e0d2, { hole: inner.slice().reverse().map(p => [p[0] * 0.985, p[1] * 0.985]) });
    for (let i = 0; i < inner.length; i++) { const a = inner[i], b = inner[(i + 1) % inner.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 4.2)); k.colonnade(a[0], a[1], b[0], b[1], 0, n, 0.5, 6.6, WHITE, { d: true, beamH: 0.7 }); }
    const pk = inner.map(p => [p[0] * 0.93, p[1] * 0.93]); k.flat(pk, 0x6f9a44, { mat: 'lawn' }); k.disc(0, 0, 9, 0xd8cbb0, { mat: 'path', seg: 24 });
    k.cyl(0, 0, 0, 0.9, 1.1, 1.6, 0xd8d0c0, { seg: 12 }); k.cyl(0, 1.6, 0, 0.18, 0.3, 60, 0xd8d8d0, { seg: 6, d: false }); k.box(0.1, 55, 0, 0.12, 4, 6.8, 0x138808, { ry: 0 }); k.box(0.1, 58, 0, 0.12, 4, 6.8, 0xf4f4f0, {}); k.box(0.1, 62, 0, 0.12, 4, 6.8, 0xff9933, {});
    k.circle(0, 0, 1.6);
  },
};

/* ---- Jantar Mantar: the stone observatory of 1724: the great Samrat Yantra with its stair, the two bowls of the Jai Prakash, the Ram Yantra pair, the Misra Yantra and the quadrants, in reddish washed masonry with white marks ---- */
const jantarMantar = {
  boardY: () => 32,
  build(k, s) {
    const hx = s.hx, hz = s.hz, OR = 0xcf5d3c, W = 0xeee6d6; k.polyWall(s.poly, 1.5);
    k.flat(s.poly.map(p => [p[0] * 0.97, p[1] * 0.97]), 0x7c9a4e, { mat: 'lawn' });
    const sz = -hz * 0.35; k.profile([[0, 0], [24, 0], [24, 21.3], [20, 21.3]], 3.2, 0, 0, sz, OR); k.profile([[0, 0], [24, 0], [24, 21.3], [20, 21.3]], 3.2, 0, 0, sz, OR); k.box(-4, 0, sz, 4, 1.2, 6, OR); k.box(12, 0, sz + 4.2, 26, 0.6, 1.2, W, { d: true }); k.profile([[0, 0], [24, 0], [24, 21.3]], 0.1, 0, 0, sz + 1.8, W, { d: true });  k.box(0, 0, sz - 5.4, 11, 7, 3, OR); k.box(0, 0, sz + 5.4, 11, 7, 3, OR);
    k.profile([[0, 0], [24, 0], [24, 21.3], [20, 21.3]], 3.2, -26, 0, sz, OR, { ry: Math.PI }); k.circle(-12, sz, 14); k.circle(12, sz, 14);                                                   // the Samrat Yantra and its twin wing
    for (const [x, z] of [[0, hz * 0.15], [18, hz * 0.3]]) { k.cyl(x, 0, z, 8.6, 8.8, 1.3, OR, { seg: 24 }); k.disc(x, z, 7.6, 0xb04a30, { y: 1.31, seg: 24 }); k.cyl(x, 0, z, 0.4, 0.4, 5, OR, { seg: 8 }); k.circle(x, z, 9); }   // the bowls of the Jai Prakash Yantra
    for (const [x, z] of [[-10, hz * 0.6], [10, hz * 0.6]]) { k.cyl(x, 0, z, 6, 6, 7.5, OR, { seg: 20, open: true }); k.cyl(x, 0, z, 0.8, 0.8, 7.5, OR, { seg: 10 }); k.ring(x, z, 0.8, 6, 0xb04a30, { y: 0.1 }); k.circle(x, z, 6.4); }   // the Ram Yantra
    k.box(hx * 0.4, 0, hz * 0.45, 14, 9, 5, OR); k.box(-hx * 0.4, 0, hz * 0.45, 12, 5, 12, OR); k.circle(hx * 0.4, hz * 0.45, 8); k.circle(-hx * 0.4, hz * 0.45, 8);
  },
};

/* ---- Gurudwara Bangla Sahib: a white marble gurdwara with a gilded dome and four kiosks, the sarovar (sacred pool) with its walkway, and the tall saffron Nishan Sahib flagpole ---- */
const banglaSahib = {
  boardY: () => 44,
  build(k, s) {
    const hx = s.hx, hz = s.hz; k.polyWall(s.poly, 1.6); k.flat(s.poly.map(p => [p[0] * 0.98, p[1] * 0.98]), 0xd9d3c4, { mat: 'path' });
    const wz = -hz * 0.28, W = 38; k.box(0, 0, wz, W * 1.4, 1.2, W, MARBLE, { mat: 'marble' }); k.box(0, 1.2, wz, W * 1.2, 10, W * 0.82, WHITE, { mat: 'marble' }); k.box(0, 11.2, wz, W * 1.25, 1.0, W * 0.88, 0xe8e2d2, { mat: 'marble' });
    k.cyl(0, 12.2, wz, 9, 10, 4, WHITE, { seg: 24, mat: 'marble' }); k.onion(0, 16.2, wz, 8.6, 12, 0xd2a64a, { mat: 'gold', seg: 24 }); k.cyl(0, 28, wz, 0.1, 0.5, 4, GOLD, { mat: 'gold', seg: 6 });
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { k.kiosk(a * W * 0.55, 12.2, wz + b * W * 0.38, 5.5, 4, WHITE, GOLD, { mat: 'marble' }); }
    const px = 0, pz = hz * 0.26, pw = hx * 1.4, pl = hz * 0.5; k.rect(px, pz, pw + 6, pl + 6, 0xe7e3d6, { mat: 'path' }); k.rect(px, pz, pw, pl, 0xffffff, { mat: 'water', y: 0.015 });                    // the sarovar
    k.box(0, 0, -hz + 6, 14, 12, 6, WHITE, { mat: 'marble' }); k.dome(0, 12, -hz + 6, 5, 4, GOLD, { mat: 'gold', seg: 16 });                                                              // the entrance gate
    k.cyl(hx * 0.7, 0, wz + 20, 0.35, 0.5, 30, 0xd4cfc2, { seg: 8 }); k.profile([[0, 0], [5.5, 1.2], [0, 2.4]], 0.15, hx * 0.7 + 0.4, 28.2, wz + 20, 0xf08a1c, { d: false });
    k.solid(0, wz, W * 0.72, W * 0.52, 1.6);
  },
};

/* ---- Agrasen ki Baoli: the stepwell, a long straight stair down between walls with tiers of arched niches; the ground is not carved here, so the shaft is drawn as a dark floor between the walls ---- */
const agrasenKiBaoli = {
  boardY: () => 14,
  build(k, s) {
    const hx = s.hx, hz = s.hz, ST = 0xb49a78; k.flat([[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]], 0x2a2622, { mat: 'path', y: 0.01 });
    for (const sg of [-1, 1]) { k.box(sg * (hx - 1.5), 0, 0, 3, 3.2, hz * 2, ST); for (let q = 0; q < 8; q++) { const z = -hz + 5 + q * (hz * 2 - 10) / 7; k.arch(sg * (hx - 3.1), 0.2, z, 5, 3, 0.8, 3, 2.4, 0xcdb596, { ry: Math.PI / 2, pointed: true, d: true }); } }
    k.box(0, 0, -hz + 1.5, hx * 2, 3.4, 3, ST); k.polyWall([[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]], 1.5);
    for (let i = 0; i < 12; i++) k.box(0, 0.02, -hz + 6 + i * (hz * 2 - 10) / 12, hx * 1.2, 0.04, 0.6, 0x8a7458, { d: true });
  },
};

/* ---- the airport: Terminal 3 with a long glazed concourse and its roof ---- */
const igiT3 = {
  boardY: () => 40,
  build(k, s) {
    const H = 14; k.polyWall(s.poly, 2); k.prism(s.poly, 0, H, 0x7d9bb0, { mat: 'glass' }); k.prism(s.poly.map(p => [p[0] * 1.03, p[1] * 1.03]), H, 1.6, 0xb6b9bc);
    k.prism(s.poly.map(p => [p[0] * 0.72, p[1] * 0.72]), H + 1.6, 4, 0xc9ccce); k.prism(s.poly.map(p => [p[0] * 0.4, p[1] * 0.4]), H + 5.6, 3, 0xdde0e0);
    for (let i = 0; i < s.poly.length; i++) { const a = s.poly[i], b = s.poly[(i + 1) % s.poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 20) continue; k.colonnade(a[0] * 1.04, a[1] * 1.04, b[0] * 1.04, b[1] * 1.04, 0, Math.round(L / 9), 0.5, H, 0xc4c7c8, { d: true, beam: false }); }
  },
};

/* ---- railway station fronts: a long brick or sandstone block, an entrance portico, a clock tower with its dome, kiosks and turrets, a crenellated parapet ---- */
function station(o) {
  return { boardY: () => 40, build(k, s) {
    const hx = s.hx, hz = s.hz, long = hz > hx, H = o.h, hu = long ? hz : hx, hv = long ? hx : hz;
    const B = (u, y0, v, lu, h, lv, c, op = {}) => long ? k.box(v, y0, u, lv, h, lu, c, op) : k.box(u, y0, v, lu, h, lv, c, op), P = (u, v) => long ? [v, u] : [u, v];
    k.polyWall(s.poly, 1.6); k.prism(s.poly, 0, H, o.body, { mat: 'facade' }); k.prism(s.poly.map(p => [p[0] * 1.012, p[1] * 1.012]), H, 1.1, o.trim);
    for (let q = -Math.floor(hu / 4); q <= Math.floor(hu / 4); q++) { B(q * 4, H + 1.1, hv - 0.4, 1.6, 1.1, 0.8, o.body, { d: true }); B(q * 4, H + 1.1, -hv + 0.4, 1.6, 1.1, 0.8, o.body, { d: true }); }
    for (const sg of [-1, 1]) B(0, 0, sg * (hv + 1), Math.min(hu * 0.5, 44), H + 5, 4, o.body, { mat: 'facade' });                                                                 // entrance blocks on both faces
    const [tx, tz] = P(0, 0); k.box(tx, H, tz, 9, 14, 9, o.body); k.box(tx, H + 14, tz, 10.4, 1.0, 10.4, o.trim); k.dome(tx, H + 15, tz, 4.6, 5, o.dome, { seg: 16, rings: 5 }); k.cyl(tx, H + 20, tz, 0.08, 0.3, 3, GOLD, { mat: 'gold', seg: 5 });
    for (const sg of [-1, 1]) for (const sgn of [-1, 1]) { const [x, z] = P(sg * (hu - 4), sgn * (hv - 3)); k.cyl(x, 0, z, 3.2, 3.5, H + 4, o.body, { seg: 8 }); k.dome(x, H + 4, z, 3.6, 4, o.dome, { seg: 10, rings: 4 }); k.cyl(x, H + 8, z, 0.05, 0.2, 2, GOLD, { mat: 'gold', seg: 5 }); }
    for (const f of [-0.6, -0.3, 0.3, 0.6]) { const [x, z] = P(f * hu, 0); k.kiosk(x, H + 1.1, z, 5, 3.2, o.trim, o.dome); }
  } };
}
const newDelhiStation = station({ h: 15, body: 0xb5543a, trim: 0xd9c9a4, dome: 0xd9d1bb });
const oldDelhiStation = station({ h: 17, body: 0xa5432d, trim: 0xc9a574, dome: 0xd9d1bb });
const nizamuddinStation = station({ h: 13, body: 0xd8c7a2, trim: 0xb36a4a, dome: 0xe9e1cf });

export const MODERN = { 'lotus-temple': lotusTemple, akshardham, 'sansad-bhavan-new': sansadNew, 'samvidhan-sadan': samvidhanSadan, 'connaught-place': connaughtPlace, 'jantar-mantar': jantarMantar, 'bangla-sahib': banglaSahib, 'agrasen-ki-baoli': agrasenKiBaoli, 'igi-t3': igiT3, 'new-delhi-station': newDelhiStation, 'old-delhi-station': oldDelhiStation, 'nizamuddin-station': nizamuddinStation };
void frame;
