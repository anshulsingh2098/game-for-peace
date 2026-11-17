/* The Mughal and Sultanate places of Delhi: Red Fort, Jama Masjid, Humayun's Tomb, Qutub Minar and its complex, Purana Qila, Safdarjung's Tomb. Colours: red sandstone, white marble, buff sandstone, gold finials.
   Local frame: x along the landmark's yaw, z across, y up; `s.toLocal(east, south)` turns a world offset into it. Interior layouts that the data does not hold (where the halls of the Red Fort stand, the lesser buildings of the
   Qutub complex) are placed from the known plans along the line from the main gate, in fractions of the data's own footprint, and are approximate (docs/DELHI_LANDMARKS.md). */
import { rayPoly, frame } from './geo.js';

const RED = 0xa5432d, RED_L = 0xb85a3c, SAND = 0xc9a574, BUFF = 0xd9c394, MARBLE = 0xf1ede2, GOLD = 0xd9b54a, DKR = 0x8e3a28, CHJ = 0xcdb27c;
const tri = x => { const t = ((x / (2 * Math.PI)) % 1 + 1) % 1; return 1 - 4 * Math.abs(t - 0.5); };

/* crenellated wall round a polygon: a wall box per edge with a parapet, merlons (detail), octagonal bastions every `every` metres with a kiosk on top; walls are collision circles */
function fortWalls(k, poly, o) {
  const n = poly.length, h = o.h, t = o.t, col = o.color;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 1) continue; const ang = Math.atan2(dz, dx), ux = dx / L, uz = dz / L;
    k.box((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, L + 0.4, h, t, col, { ry: -ang }); k.box((a[0] + b[0]) / 2, h, (a[1] + b[1]) / 2, L + 0.4, 0.9, t + 1.0, o.trim || col, { ry: -ang });
    for (let q = 1.5; q < L - 1; q += 3.4) { const mx = a[0] + ux * q, mz = a[1] + uz * q; k.box(mx, h + 0.9, mz, 1.7, 1.7, t + 0.6, col, { ry: -ang, d: true }); }
    const nt = Math.max(0, Math.floor(L / o.every)); for (let q = 1; q <= nt; q++) { const f = q / (nt + 1), tx = a[0] + dx * f, tz = a[1] + dz * f; k.cyl(tx, 0, tz, o.tr * 0.92, o.tr, h + 2, col, { seg: 8 }); k.box(tx, h + 2, tz, o.tr * 1.9, 0.7, o.tr * 1.9, o.trim || col, { ry: 0.4 }); if (o.kiosks) k.kiosk(tx, h + 2.7, tz, o.tr * 0.9, 2.6, o.kc || CHJ, o.dc || MARBLE, { d: true }); }
    k.cyl(a[0], 0, a[1], o.tr * 1.05, o.tr * 1.15, h + 3, col, { seg: 8 }); k.box(a[0], h + 3, a[1], o.tr * 2, 0.7, o.tr * 2, o.trim || col, { ry: 0.4 }); if (o.kiosks) k.kiosk(a[0], h + 3.7, a[1], o.tr, 2.8, o.kc || CHJ, o.dc || MARBLE);
    k.wall(a[0], a[1], b[0], b[1], o.cr || 2.2);
  }
}

/* a minaret: a tapering shaft in bands of two colours from y0 to y0 + H, balconies at the quarter heights, a small domed cupola on top */
function minaret(k, x, z, y0, H, r0, r1, c0, c1, bands = 8) {
  for (let i = 0; i < bands; i++) { const f0 = i / bands, f1 = (i + 1) / bands, ra = r0 + (r1 - r0) * f0, rb = r0 + (r1 - r0) * f1; k.cyl(x, y0 + H * f0, z, rb, ra, H / bands, i % 2 ? c1 : c0, { seg: 16 }); }
  for (const f of [0.28, 0.52, 0.76]) { const r = r0 + (r1 - r0) * f; k.cyl(x, y0 + H * f, z, r + 1.5, r + 1.3, 0.6, c1, { seg: 16 }); k.cyl(x, y0 + H * f + 0.6, z, r + 1.5, r + 1.5, 0.8, c0, { seg: 16, open: true, d: true }); }
  k.cyl(x, y0 + H, z, r1 + 1.5, r1 + 1.2, 0.5, c1, { seg: 16 }); k.kiosk(x, y0 + H + 0.5, z, r1 * 2.4, 2.8, c1, MARBLE);
}

/* ---- Red Fort ---- */
const redFort = {
  boardY: () => 70,
  build(k, s) {
    k.flat(s.poly.map(p => [p[0] * 0.985, p[1] * 0.985]), 0x77904a, { mat: 'lawn' });                                                                  // the fort's lawns (roads and paths from the map are drawn over them)
    fortWalls(k, s.poly, { h: 17, t: 3.8, color: RED, trim: RED_L, every: 80, tr: 5.2, kiosks: true });
    const w = s.toLocal(-1, 0), P = rayPoly(s.poly, 0, 0, w[0], w[1]); if (!P) return; const ang = Math.atan2(-w[1], -w[0]), F = frame(P.x, P.z, ang), far = rayPoly(s.poly, P.x - w[0] * 0.5, P.z - w[1] * 0.5, -w[0], -w[1]), L = far ? far.t : 500;
    const loc = (f, v = 0) => F.loc(f * L, v), at = (f, v, y, sx, sh, sz, c, o = {}) => { const [x, z] = loc(f, v); k.box(x, y, z, sx, sh, sz, c, { ry: F.ryBox, ...o }); };
    /* Lahori Gate: a gatehouse with the passage along the axis, two octagonal towers, white marble kiosks on the roof, and the flag; Aurangzeb's barbican walls reach out in front */
    { const [gx, gz] = F.loc(-0.2, 0); k.arch(gx, 0, gz, 34, 24, 14, 8, 14, RED, { ry: F.ryArch, pointed: true }); k.box(gx, 24, gz, 36, 1.2, 16, RED_L, { ry: F.ryBox });
      for (const v of [-19, 19]) { const [tx, tz] = F.loc(-0.2, v); k.cyl(tx, 0, tz, 6.2, 6.6, 27, RED, { seg: 8 }); k.kiosk(tx, 27, tz, 7, 3.4, MARBLE, MARBLE); }
      for (const v of [-12, -4, 4, 12]) { const [kx, kz] = F.loc(-0.2, v); k.kiosk(kx, 25.2, kz, 5, 3, MARBLE, MARBLE); }
      const [px, pz] = F.loc(-0.2, 0); k.cyl(px, 25.2, pz, 0.12, 0.18, 22, 0xd8d8d0, { seg: 5, d: true }); k.box(px, 44, pz + 0, 0.15, 1.0, 4.4, 0xff9933, { ry: F.ryBox - Math.PI / 2 }); k.box(px, 43, pz, 0.15, 1.0, 4.4, 0xf4f4f0, { ry: F.ryBox - Math.PI / 2 }); k.box(px, 42, pz, 0.15, 1.0, 4.4, 0x138808, { ry: F.ryBox - Math.PI / 2 });
      for (const v of [-24, 24]) { const [bx, bz] = F.loc(-0.2 - 34 / L, v); k.box(bx, 0, bz, 34, 13, 3.6, RED, { ry: F.ryBox }); k.wall(...F.loc(-0.2, v), ...F.loc(-0.2 - 34 / L, v), 2.2); } }
    k.rect(...loc(0.14, 0), 0.28 * L, 7, 0xb59878, { mat: 'path', ry: F.ryBox, y: 0 });                                                                          // the paved way (Chatta Chowk and beyond)
    at(0.07, 0, 0, 78, 8.5, 20, RED_L, { mat: 'facade' }); at(0.07, 0, 8.5, 80, 1.0, 22, CHJ);                                                               // Chatta Chowk, the covered bazaar
    { const [nx, nz] = loc(0.27, 0); k.arch(nx, 0, nz, 44, 17, 14, 8, 10, RED, { ry: F.ryArch, pointed: true }); k.box(nx, 17, nz, 46, 1.0, 16, RED_L, { ry: F.ryBox }); for (const v of [-14, 0, 14]) { const [kx, kz] = F.loc(0.27 * L, v); k.kiosk(kx, 18, kz, 5.5, 3.2, MARBLE, MARBLE); } k.solid(nx, nz, 7, 22, 2.2, F.ryBox * -1); }   // Naubat Khana
    at(0.43, 0, 0, 30, 1.5, 64, MARBLE, { mat: 'marble' }); for (const v of [-24, -12, 0, 12, 24]) for (const u of [-9, 0, 9]) { const [cx2, cz2] = F.loc(0.43 * L + u, v); k.box(cx2, 1.5, cz2, 1.4, 8.5, 1.4, RED_L, { d: true }); }
    at(0.43, 0, 10, 28, 1.0, 62, RED_L); { const [tx, tz] = F.loc(0.43 * L + 12, 0); k.box(tx, 1.5, tz, 5, 8, 14, MARBLE, { mat: 'marble' }); }                  // Diwan-i-Aam: the hall of columns with the throne alcove
    at(0.84, 0, 0, 24, 2.2, 36, MARBLE, { mat: 'marble' }); at(0.84, 0, 2.2, 20, 9, 32, MARBLE, { mat: 'marble' }); at(0.84, 0, 11.2, 23, 0.9, 35, CHJ); for (const u of [-9, 9]) for (const v of [-15, 15]) { const [kx, kz] = F.loc(0.84 * L + u, v); k.kiosk(kx, 12, kz, 5, 3.2, MARBLE, MARBLE); }   // Diwan-i-Khas
    at(0.84, -70, 0, 22, 10, 60, MARBLE, { mat: 'marble' }); at(0.84, -70, 10, 24, 0.9, 62, CHJ);                                                         // Rang Mahal
    { const [mx, mz] = loc(0.88, 62); k.box(mx, 0, mz, 20, 8, 20, MARBLE, { mat: 'marble', ry: F.ryBox }); for (const v of [-5.5, 0, 5.5]) { const [dx2, dz2] = F.loc(0.88 * L, 62 + v); k.striped(dx2, 8, dz2, [[2.6, 0], [3.2, 1.2], [2.8, 2.6], [1.8, 3.8], [0.7, 4.6], [0.05, 5.2]], 3, MARBLE, MARBLE, { mat: 'marble', seg: 14 }); k.dome(dx2, 8, dz2, 2.4, 3.8, GOLD, { mat: 'gold', seg: 12 }); } }    // Moti Masjid
    for (const f of [0.4, 0.6]) for (const sg of [-1, 1]) for (let i = 0; i < 8; i++) { const [tx, tz] = loc(f + i * 0.012 - 0.04, sg * (50 + (i % 2) * 6)); k.tree(tx, tz, 8 + (i % 3) * 2, 0x3f6b2e, { d: false }); }
  },
  ground: () => [],
};

/* ---- Jama Masjid ---- */
const jamaMasjid = {
  boardY: () => 62,
  build(k, s) {
    const hx = s.hx, hz = s.hz, wl = s.toLocal(-1, 0), sg = wl[0] >= 0 ? 1 : -1, PH = 5, STR = 0xb04a35, TRIM = MARBLE;                                                // the prayer hall is on the west side: local sign sg along x
    k.slab(-hx, -hz, hx, hz, 0, PH, STR); k.slab(-hx - 0.6, -hz - 0.6, hx + 0.6, hz + 0.6, PH - 0.84, 0.8, CHJ); k.slab(-hx + 2, -hz + 2, hx - 2, hz - 2, PH, 0.25, 0xa8624a);   // the platform (5 m) and the courtyard floor
    for (const sd of [-1, 1]) k.stairs(sd * hx, 0, 0, 22, 1.0, 5, PH, STR, { ry: sd > 0 ? Math.PI : 0, d: false });                                         // the stairs to the east/west gates
    k.stairs(0, 0, hz, 20, 1.0, 5, PH, STR, { ry: -Math.PI / 2 }); k.stairs(0, 0, -hz, 20, 1.0, 5, PH, STR, { ry: Math.PI / 2 });
    /* the gateways: east (the royal gate, high and big), north and south */
    const gate = (gx, gz, ry, big) => { const w = big ? 26 : 18, h = big ? 20 : 15; k.arch(gx, PH, gz, w, h, 9, w * 0.45, h * 0.72, STR, { ry, pointed: true }); k.box(gx, PH + h, gz, w + 1.6, 1.0, 10.4, CHJ, { ry }); for (const o of [-1, 0, 1]) { const c = Math.cos(ry), sn = Math.sin(ry); k.kiosk(gx + o * w * 0.32 * c, PH + h + 1, gz - o * w * 0.32 * sn, 4.4, 2.8, MARBLE, MARBLE); } };
    gate(-sg * (hx - 5), 0, sg > 0 ? Math.PI / 2 : -Math.PI / 2, true); gate(0, hz - 5, 0, false); gate(0, -hz + 5, 0, false);
    /* the cloisters: low arcades round the courtyard on the three sides that have no prayer hall */
    for (const [x0, z0, x1, z1] of [[-sg * (hx - 2), -hz + 3, -sg * (hx - 2), hz - 3], [-hx + 3, hz - 3, hx - 3, hz - 3], [-hx + 3, -hz + 3, hx - 3, -hz + 3]]) { k.wall(x0, z0, x1, z1, 1.5); const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0); k.box((x0 + x1) / 2, PH, (z0 + z1) / 2, L, 5, 3.4, STR, { ry: -a, mat: 'facade' }); k.box((x0 + x1) / 2, PH + 5, (z0 + z1) / 2, L + 0.6, 0.8, 4.2, CHJ, { ry: -a }); k.colonnade(x0, z0, x1, z1, PH, Math.round(L / 3.2), 0.28, 4.8, MARBLE, { d: true, beam: false }); }
    for (const xx of [-1, 1]) for (const zz of [-1, 1]) k.kiosk(xx * (hx - 4), PH + 5.8, zz * (hz - 4), 5.6, 3.4, MARBLE, MARBLE);
    /* the prayer hall: a long red block with the great pointed arch in the middle, three white and black striped domes, minarets at the ends */
    const hd = hx * 0.32, hcx = sg * (hx - hd - 2), hw = hz * 1.7, hh = 15;
    k.box(hcx, PH, 0, hd * 2, hh, hw, STR, { mat: 'facade' }); k.box(hcx, PH + hh, 0, hd * 2 + 1.4, 1.2, hw + 1.4, CHJ);
    for (const sd of [-1, 1]) for (const z of [-hw / 2 + 5, hw / 2 - 5]) { }
    k.arch(hcx + sg * (-hd + 0.5) * -1 * 0 + (-sg) * hd, PH, 0, 30, 26, 6, 15, 21, MARBLE, { ry: Math.PI / 2, pointed: true, mat: 'marble' });                  // the great iwan faces the courtyard (east)
    for (let i = -4; i <= 4; i++) if (Math.abs(i) > 1) { k.arch(hcx - sg * hd, PH, i * (hw / 10), 4.6, 12, 1.0, 3.2, 9, MARBLE, { ry: Math.PI / 2, pointed: true, mat: 'marble', d: true }); }
    const dome = (z, r, h) => { const prof = []; for (let i = 0; i <= 18; i++) { const t = i / 18; prof.push([i === 18 ? 0.04 : r * Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.6))) * (1 + 0.2 * Math.sin(t * Math.PI)), h * t]); } k.striped(hcx, PH + hh + 1.2, z, prof, 12, MARBLE, 0x2a2a2e, { seg: 20 }); k.cyl(hcx, PH + hh + 1.2 + h, z, 0.1, 0.4, 3, GOLD, { mat: 'gold', seg: 6 }); k.cyl(hcx, PH + hh + 0.5, z, r * 0.9, r, 1.2, MARBLE, { seg: 20 }); };
    dome(0, 10.5, 17); dome(-hw * 0.3, 8, 13); dome(hw * 0.3, 8, 13);
    for (const sd of [-1, 1]) minaret(k, hcx - sg * (hd - 1), sd * (hw / 2 + 2.6), PH, s.h ? s.h - PH : 36, 2.6, 1.8, STR, MARBLE, 9);
    k.solid(0, 0, hx, hz, 1.6);
  },
};

/* ---- Humayun's Tomb ---- */
const humayunsTomb = {
  boardY: () => 58,
  ground: s => [{ x: 0, z: 0, hx: s.hx + 3.5, hz: s.hz + 3.5 }, ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => ({ x: a * (s.hx + 70), z: b * (s.hz + 70), hx: a ? 68 : 3, hz: b ? 68 : 3 }))],
  build(k, s) {
    const hx = s.hx, hz = s.hz, PH = 6.5, BH = 21, W = Math.min(hx, hz) * 0.46;
    k.slab(-hx, -hz, hx, hz, 0, PH, RED); k.slab(-hx - 0.6, -hz - 0.6, hx + 0.6, hz + 0.6, PH - 0.94, 0.9, MARBLE, { mat: 'marble' });                                // the arcaded platform
    for (const side of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const [a, b] = side, along = a ? hz : hx, n = 9, ry = a ? Math.PI / 2 : 0; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n * 2 - 1, px = a ? a * (hx + 0.15) : t * along, pz = a ? t * along : b * (hz + 0.15); if (Math.abs(t) < 0.12) continue; k.arch(px, 0.4, pz, 7.2, PH - 0.9, 0.6, 4.4, 5.0, 0xcdb89a, { ry, pointed: true, d: true }); } k.stairs(a * hx, 0, b * hz, 13, 1.1, 6, PH, RED, { ry: Math.atan2(-b, -a), d: false }); }
    k.solid(0, 0, hx, hz, 1.6);
    const c = W * 0.34, oct = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; const q = [[1, -1 + c / W], [1, 1 - c / W]]; void q; } void oct;
    const chamfer = [[W, -W + 8], [W, W - 8], [W - 8, W], [-W + 8, W], [-W, W - 8], [-W, -W + 8], [-W + 8, -W], [W - 8, -W]];
    k.prism(chamfer, PH, BH, RED_L); k.prism(chamfer.map(p => [p[0] * 1.015, p[1] * 1.015]), PH + BH - 1.4, 1.4, MARBLE, { mat: 'marble' });                    // the octagonal-plan mausoleum with white marble cornice
    for (const side of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const [a, b] = side, ry = a ? Math.PI / 2 : 0; k.arch(a * (W + 1.5), PH, b * (W + 1.5), 24, BH - 1, 4, 11.5, 17, MARBLE, { ry, pointed: true, mat: 'marble' }); k.box(a * (W + 1.0), PH, b * (W + 1.0), a ? 1.5 : 24, 0.5, a ? 24 : 1.5, MARBLE, { mat: 'marble' }); }
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const px = a * (W - 4), pz = b * (W - 4); k.kiosk(px, PH + BH, pz, 6.4, 4.2, MARBLE, MARBLE); k.arch(a * (W - 1.8), PH + 1, b * (W - 1.8), 7, 12, 1.2, 3.6, 8, MARBLE, { ry: a * b > 0 ? Math.PI / 4 : -Math.PI / 4, pointed: true, mat: 'marble', d: true }); }
    const y = PH + BH; k.cyl(0, y, 0, W * 0.5, W * 0.54, 8, MARBLE, { seg: 16, mat: 'marble' }); k.ringColumns(0, 0, W * 0.5, 16, y, 0.35, 8, MARBLE, { beam: false, d: true });
    k.striped(0, y + 8, 0, [[W * 0.46, 0], [W * 0.5, 1.8], [W * 0.46, 4.5], [W * 0.36, 7.2], [W * 0.2, 9], [W * 0.05, 9.9]], 3, MARBLE, MARBLE, { mat: 'marble', seg: 24 });
    k.cyl(0, y + 17.6, 0, 0.1, 0.5, 5, GOLD, { mat: 'gold', seg: 6 });
    /* the charbagh: stone causeways with a water channel down the middle, in the four directions */
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const L = 66, cx = a * (hx + 2 + L / 2), cz = b * (hz + 2 + L / 2); k.rect(cx, cz, a ? L : 9, a ? 9 : L, 0xb59878, { mat: 'path', ry: 0 }); k.rect(cx, cz, a ? L : 3.4, a ? 3.4 : L, 0xffffff, { mat: 'water', y: 0.01 }); }
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { k.rect(a * (hx + 36), b * (hz + 36), 3, 3, 0xffffff, { mat: 'water', y: 0.01 }); }
  },
};

/* ---- Qutub Minar and its complex ---- */
const qutubMinar = {
  boardY: s => (s.h || 72.5) + 8,
  ground: s => [{ x: 0, z: 0, hx: s.hx + 3, hz: s.hz + 3 }, ...[[-45, -5, 26, 18], [5, 40, 12, 12], [10, -90, 14, 14]].map(([e, so, a, b]) => { const [x, z] = s.toLocal(e, so); return { x, z, hx: a, hz: b }; })],
  build(k, s) {
    const H = s.h || 72.5, R = 7.2, ys = [0, 0.34, 0.57, 0.73, 0.86, 1.0].map(f => f * H), rs = [R, 5.9, 4.7, 3.7, 2.7, 1.5], N = 96;
    const ring = (r, kind, y) => ({ y, pts: Array.from({ length: N }, (_, j) => { const th = j / N * Math.PI * 2; let f = 0; if (kind === 1) { const q = th / (Math.PI * 2) * 24, i = Math.floor(q), fr = q - i; f = i % 2 === 0 ? 1 - 2 * Math.abs(2 * fr - 1) : Math.sin(fr * Math.PI) * 2 - 1; } else if (kind === 2) f = Math.abs(Math.sin(th * 12)) * 2 - 1; else if (kind === 3) f = tri(th * 20); const rr = r * (1 + (kind ? 0.1 : 0) * f); return [Math.cos(th) * rr, Math.sin(th) * rr]; }) });
    const kinds = [1, 2, 3, 0, 0], cols = [0xbd6642, 0xbd6642, 0xad5539, 0xd5c8a4, 0xc36d4a];
    for (let i = 0; i < 5; i++) { k.loft([ring(rs[i], kinds[i], ys[i]), ring(rs[i + 1] * 1.0 + (rs[i] - rs[i + 1]) * 0.04, kinds[i], ys[i + 1])], cols[i], { seg: 1 }); }
    for (let i = 0; i < 4; i++) { const y = ys[i + 1], r = rs[i + 1]; k.cyl(0, y - 0.1, 0, r + 1.7, r + 1.0, 0.8, i === 2 ? RED : RED_L, { seg: 24 }); k.cyl(0, y + 0.7, 0, r + 1.8, r + 1.8, 0.95, i === 3 ? MARBLE : RED_L, { seg: 24, open: true }); k.ring(0, 0, r - 0.4, r + 1.8, 0x8a5a44, { y: y + 0.72, seg: 24 });
      for (let j = 0; j < 24; j++) { const a = j / 24 * Math.PI * 2; k.box(Math.cos(a) * (r + 0.6), y - 1.4, Math.sin(a) * (r + 0.6), 0.5, 1.4, 0.5, SAND, { d: true, ry: -a }); } }
    k.cyl(0, H, 0, 1.9, 1.7, 0.4, MARBLE, { seg: 16 }); k.dome(0, H + 0.4, 0, 1.4, 1.4, MARBLE, { seg: 12, rings: 3 }); k.cyl(0, H + 1.8, 0, 0.05, 0.1, 2.2, GOLD, { mat: 'gold', seg: 5 });
    k.ringSolid(0, 0, R + 1.2, 1.6);
    const L = (e, so) => s.toLocal(e, so), at = (e, so, f) => { const [x, z] = L(e, so); f(x, z); };
    at(-38, -5, (x, z) => { k.cyl(x, 0, z, 1.8, 2.2, 0.5, 0x6a5a4a, { seg: 12 }); k.cyl(x, 0.5, z, 0.26, 0.38, 7.2, 0x383836, { seg: 10 }); k.cyl(x, 7.7, z, 0.46, 0.3, 0.7, 0x4a4a46, { seg: 10 }); k.circle(x, z, 2.4); });             // the Iron Pillar
    at(-52, -5, (x, z) => { for (let i = -4; i <= 4; i++) { const [px, pz] = L(-60, -5 + i * 4.6); k.arch(px, 0, pz, 4.6, 15 - Math.abs(i) * 0.35, 1.8, 2.8, 11 - Math.abs(i) * 0.3, RED, { pointed: true, ry: Math.PI / 2 }); } k.wall(...L(-60, -5 - 22), ...L(-60, -5 + 22), 1.6); for (let i = 0; i < 18; i++) { const [px, pz] = L(-44 + (i % 6) * 6, -22 + Math.floor(i / 6) * 8 + 14); k.box(px, 0, pz, 1.0, 5, 1.0, SAND, { d: true }); k.circle(px, pz, 0.9); } });   // the arched screen and the cloister columns of the mosque
    at(5, 40, (x, z) => { k.box(x, 0, z, 17, 13, 17, RED, { mat: 'facade' }); k.box(x, 13, z, 18.5, 0.9, 18.5, MARBLE, { mat: 'marble' }); k.dome(x, 13.9, z, 6.2, 5.2, 0xc8bda2, { seg: 20, rings: 6 }); k.cyl(x, 19.1, z, 0.1, 0.4, 2.2, GOLD, { mat: 'gold', seg: 5 }); k.solid(x, z, 8.8, 8.8, 1.5); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) k.arch(x + a * 8.7, 0, z + b * 8.7, 9, 10, 0.9, 5, 7.6, MARBLE, { ry: a ? Math.PI / 2 : 0, mat: 'marble', pointed: true, d: true }); });   // Alai Darwaza
    at(10, -90, (x, z) => { k.cyl(x, 0, z, 12.5, 11.5, 25, 0x9a5238, { seg: 16 }); k.cyl(x, 25, z, 11.6, 11, 0.9, 0x7a4430, { seg: 16 }); k.circle(x, z, 12.5); k.ringSolid(x, z, 12.6, 1.8); });                                // the stump of the Alai Minar
  },
};

/* ---- Purana Qila: the walls with their gates, the Qila-i-Kuhna mosque and the Sher Mandal ---- */
const puranaQila = {
  boardY: () => 56,
  build(k, s) {
    k.flat(s.poly.map(p => [p[0] * 0.985, p[1] * 0.985]), 0x77904a, { mat: 'lawn' });
    fortWalls(k, s.poly, { h: 15, t: 4, color: 0x9a5a40, trim: 0xa86a4c, every: 90, tr: 4.6, cr: 2.2 });
    const w = s.toLocal(-1, 0), P = rayPoly(s.poly, 0, 0, w[0], w[1]); if (!P) return; const ang = Math.atan2(-w[1], -w[0]), F = frame(P.x, P.z, ang);
    { const [gx, gz] = F.loc(0, 0); k.arch(gx, 0, gz, 28, 22, 14, 9, 15, 0x9a5a40, { ry: F.ryArch, pointed: true }); k.box(gx, 22, gz, 30, 1.2, 16, 0xa86a4c, { ry: F.ryBox }); for (const v of [-9, 0, 9]) { const [kx, kz] = F.loc(0, v); k.kiosk(kx, 23.2, kz, 5, 3, MARBLE, MARBLE); } for (const v of [-16, 16]) { const [tx, tz] = F.loc(0, v); k.cyl(tx, 0, tz, 5.4, 5.8, 24, 0x9a5a40, { seg: 8 }); k.kiosk(tx, 24, tz, 6, 3, MARBLE, MARBLE); } }       // Bara Darwaza
    const [mx, mz] = F.loc(180, 0), mr = -F.ang;                                                                                                              // Qila-i-Kuhna mosque, 180 m inside along the same axis
    k.box(mx, 0, mz, 14, 15, 52, 0x9a5a40, { ry: F.ryBox }); for (let i = -2; i <= 2; i++) { const [ax, az] = F.loc(180 - 7.2, i * 9.6); k.arch(ax, 0, az, 8, 13.5, 1.2, 5.6, 11, MARBLE, { ry: F.ryArch + Math.PI / 2 * 0 + Math.PI, pointed: true, mat: 'marble', d: true }); } void mr;
    k.solid(mx, mz, 7, 26, 1.6, -F.ang);
    const [sx, sz] = F.loc(330, 70); const oct = Array.from({ length: 8 }, (_, i) => [sx + Math.cos(i / 8 * Math.PI * 2 + 0.39) * 9, sz + Math.sin(i / 8 * Math.PI * 2 + 0.39) * 9]); k.prism(oct, 0, 12, 0xa04a34); k.kiosk(sx, 12, sz, 11, 3.6, MARBLE, MARBLE); k.polyWall(oct, 1.6);   // Sher Mandal
  },
};

/* ---- Safdarjung's Tomb ---- */
const safdarjungTomb = {
  boardY: () => 40,
  ground: s => [{ x: 0, z: 0, hx: s.hx + 3, hz: s.hz + 3 }],
  build(k, s) {
    const hx = s.hx, hz = s.hz, PH = 2.4, W = Math.min(hx, hz) * 0.78;
    k.slab(-hx, -hz, hx, hz, 0, PH, BUFF); k.stairs(hx, 0, 0, 9, 0.9, 3, PH, BUFF, { ry: Math.PI }); k.stairs(-hx, 0, 0, 9, 0.9, 3, PH, BUFF, { ry: 0 }); k.stairs(0, 0, hz, 9, 0.9, 3, PH, BUFF, { ry: -Math.PI / 2 }); k.stairs(0, 0, -hz, 9, 0.9, 3, PH, BUFF, { ry: Math.PI / 2 });
    k.box(0, PH, 0, W * 2, 13, W * 2, RED_L, { mat: 'facade' }); k.box(0, PH + 13, 0, W * 2 + 1.4, 1.0, W * 2 + 1.4, BUFF);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { k.arch(a * (W + 0.6), PH, b * (W + 0.6), W * 1.15, 14, 1.4, W * 0.5, 10, MARBLE, { ry: a ? Math.PI / 2 : 0, pointed: true, mat: 'marble' }); }
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const x = a * (W + 0.5), z = b * (W + 0.5); k.cyl(x, PH, z, 2.2, 2.4, 15, RED_L, { seg: 8 }); k.kiosk(x, PH + 15, z, 4.2, 3, MARBLE, MARBLE); }
    k.cyl(0, PH + 14, 0, W * 0.55, W * 0.6, 3, BUFF, { seg: 24 }); k.striped(0, PH + 17, 0, [[W * 0.5, 0], [W * 0.56, 2.2], [W * 0.5, 5.2], [W * 0.34, 8.2], [W * 0.14, 10.2], [0.05, 11]], 3, MARBLE, MARBLE, { mat: 'marble', seg: 24 }); k.cyl(0, PH + 28, 0, 0.1, 0.4, 3, GOLD, { mat: 'gold', seg: 6 });
    k.solid(0, 0, hx, hz, 1.5);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const L = 40; k.rect(a * (hx + L / 2 + 1), b * (hz + L / 2 + 1), a ? L : 7, a ? 7 : L, 0xb59878, { mat: 'path' }); k.rect(a * (hx + L / 2 + 1), b * (hz + L / 2 + 1), a ? L : 2.6, a ? 2.6 : L, 0xffffff, { mat: 'water', y: 0.01 }); }
  },
};

export const MUGHAL = { 'red-fort': redFort, 'jama-masjid': jamaMasjid, 'humayuns-tomb': humayunsTomb, 'qutub-minar': qutubMinar, 'purana-qila': puranaQila, 'safdarjung-tomb': safdarjungTomb };
