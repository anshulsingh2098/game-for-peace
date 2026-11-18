/* Delhi traffic-island dressing (owner's reference photos, 20 Nov 2026): the island of a roundabout has a yellow-and-black painted kerb all round, concentric hedges and flower beds, paths on the big ones and a lamp in the middle.
   islandInfo(ring) says whether a park polygon is a round island (circularity 0.88 or more, radius 4 to 120 m) and where its centre is; dress(box, info, y0, rnd) calls box(cx, y0, cz, sx, sy, sz, yaw, colour) for every piece.
   Size decides the dressing: SMALL (radius under 14 m: a ring of hedge and a shrub in the middle), MEDIUM (14 to 35 m: hedge, a flower bed ring, an inner hedge, a lamp), BIG (35 m and more: two flower beds in alternating colours, hedges, four paths, lamps round the ring).
   Pure geometry (no three.js here), so tools/selftest.mjs checks it; `colours` are plain hex numbers that the caller turns into colours. */
export const KERB_Y = 0.16, CAP = 1800;
export function islandInfo(ring) {
  const n = ring.length / 2; if (n < 6) return null; let a = 0, per = 0, cx = 0, cz = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) { const x0 = ring[j * 2], z0 = ring[j * 2 + 1], x1 = ring[i * 2], z1 = ring[i * 2 + 1]; a += x0 * z1 - x1 * z0; per += Math.hypot(x1 - x0, z1 - z0); cx += x1; cz += z1; }
  a = Math.abs(a) / 2; cx /= n; cz /= n; if (!per) return null; const circ = 4 * Math.PI * a / (per * per), R = Math.sqrt(a / Math.PI);
  if (circ < 0.88 || R < 4 || R > 120) return null; return { cx, cz, R, circ, size: R < 14 ? 'small' : R < 35 ? 'medium' : 'big' };
}
const YEL = 0xe0ae1e, BLK = 0x1b1b1d, HEDGE = 0x3f6b2c, HEDGE2 = 0x4d7a30, SHRUB = 0x56803a, PATH = 0xb7ad98, POLE = 0x2c2f33, BEDS = [0xc9302c, 0xe6c229, 0xe48ab0, 0xf1efe6, 0xd96a1f];
export function dress(box, info, y0, rnd = Math.random) {
  const { cx, cz, R, size } = info; let n = 0; const put = (...a) => { if (n < CAP) { box(...a); n++; } };
  /* a ring of boxes at radius r, width w, height h, the colour from f(k); the piece length is len (m) */
  const ring = (r, w, h, len0, f, from = 0, to = Math.PI * 2) => { const len = size === 'big' ? len0 * 2.4 : len0, cnt = Math.max(6, Math.round((to - from) * r / len)), step = (to - from) / cnt; for (let k = 0; k < cnt; k++) { const t = from + (k + 0.5) * step; put(cx + Math.cos(t) * r, y0, cz + Math.sin(t) * r, step * r * 1.04, h, w, t + Math.PI / 2, f(k, t)); } };
  ring(R - 0.2, 0.4, KERB_Y, 1.2, k => k % 2 ? BLK : YEL);                                  // the painted kerb: 1.2 m stripes
  if (size === 'small') { ring(Math.max(1.2, R - 1.3), 0.7, 0.55, 1.0, () => HEDGE); put(cx, y0, cz, Math.max(1.4, R * 0.35), 0.7, Math.max(1.4, R * 0.35), 0.4, SHRUB); }
  else if (size === 'medium') { ring(R - 1.4, 0.8, 0.6, 1.0, () => HEDGE); ring(R - 3.6, 1.8, 0.22, 0.9, (k) => BEDS[(k >> 2) % 3]); ring(R - 6.4, 0.8, 0.55, 1.0, () => HEDGE2); put(cx, y0, cz, 0.16, 5.2, 0.16, 0, POLE); put(cx, y0 + 5.2, cz, 0.5, 0.18, 0.5, 0, POLE); }
  else {
    ring(R - 1.5, 0.9, 0.65, 1.0, () => HEDGE); ring(R - 4.2, 2.6, 0.22, 0.9, (k) => BEDS[(k >> 3) % BEDS.length]); ring(R - 8, 0.9, 0.6, 1.0, () => HEDGE2);
    ring(R * 0.55, 3.4, 0.2, 0.9, (k) => BEDS[((k >> 2) + 2) % BEDS.length]); ring(R * 0.3, 1.0, 0.55, 1.0, () => HEDGE);
    for (let q = 0; q < 4; q++) { const t = q * Math.PI / 2 + 0.4, r0 = R * 0.3, r1 = R - 1.2, len = r1 - r0; put(cx + Math.cos(t) * (r0 + r1) / 2, y0 + 0.01, cz + Math.sin(t) * (r0 + r1) / 2, len, 0.06, 1.3, t, PATH); }       // four paths to the centre
    put(cx, y0, cz, 0.2, 6, 0.2, 0, POLE); for (let q = 0; q < 6; q++) { const t = q * Math.PI / 3, r = R - 6; put(cx + Math.cos(t) * r, y0, cz + Math.sin(t) * r, 0.14, 5, 0.14, 0, POLE); }       // a lamp in the middle and six round the ring
  }
  return n;
}
