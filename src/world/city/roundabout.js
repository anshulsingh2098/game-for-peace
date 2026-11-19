/* Delhi traffic-island dressing (owner's reference photos, 20 Nov 2026): the island of a roundabout has a yellow-and-black painted kerb all round, concentric hedges and flower beds, paths on the big ones and a lamp in the middle.
   islandInfo(ring) says whether a park polygon is a round island (circularity 0.88 or more, radius 4 to 120 m) and where its centre is; dress(box, info, y0, rnd) calls box(cx, y0, cz, sx, sy, sz, yaw, colour) for every piece.
   Size decides the dressing: SMALL (radius under 14 m: a ring of hedge and a shrub in the middle), MEDIUM (14 to 35 m: hedge, a flower bed ring, an inner hedge, a lamp), BIG (35 m and more: two flower beds in alternating colours, hedges, four paths, lamps round the ring).
   Reference photos added 20 Nov 2026 (owner: a city-centre circle with a central pillar, a fountain basin, iron railings and a paved ring; a park with a green wrought-iron fence on a low plinth wall): about half the medium and big islands (decided by a hash of their centre, so it is the same every time) get a RAILING of upright pickets between top and bottom rails on posts; a third of the big ones a central PILLAR with a basin and a paved ring; medium ones without a railing get round planters.
   Pure geometry (no three.js here), so tools/selftest.mjs checks it; `colours` are plain hex numbers that the caller turns into colours. */
export const KERB_Y = 0.16, CAP = 2600;
export function islandInfo(ring) {
  const n = ring.length / 2; if (n < 6) return null; let a = 0, per = 0, cx = 0, cz = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) { const x0 = ring[j * 2], z0 = ring[j * 2 + 1], x1 = ring[i * 2], z1 = ring[i * 2 + 1]; a += x0 * z1 - x1 * z0; per += Math.hypot(x1 - x0, z1 - z0); cx += x1; cz += z1; }
  a = Math.abs(a) / 2; cx /= n; cz /= n; if (!per) return null; const circ = 4 * Math.PI * a / (per * per), R = Math.sqrt(a / Math.PI);
  if (circ < 0.88 || R < 4 || R > 120) return null; return { cx, cz, R, circ, size: R < 14 ? 'small' : R < 35 ? 'medium' : 'big' };
}
/* F4: each hedge piece of the islands gets its own green (85 to 115 percent, by its number), so a ring of hedge is no longer one flat colour */
const tone = (hex, k) => { const f = 0.85 + 0.3 * (((Math.sin(k * 12.9898 + 4.1) * 43758.5453) % 1 + 1) % 1), r = Math.min(255, Math.round(((hex >> 16) & 255) * f)), g = Math.min(255, Math.round(((hex >> 8) & 255) * f)), b = Math.min(255, Math.round((hex & 255) * f)); return (r << 16) | (g << 8) | b; };
const FENCE = 0x2f5a3a, PLINTH = 0x9a968c, COLUMN = 0xb9b19c, BASIN = 0xa7a59a, YEL = 0xe0ae1e, BLK = 0x1b1b1d, HEDGE = 0x3f6b2c, HEDGE2 = 0x4d7a30, SHRUB = 0x56803a, PATH = 0xb7ad98, POLE = 0x2c2f33, BEDS = [0xc9302c, 0xe6c229, 0xe48ab0, 0xf1efe6, 0xd96a1f];
const hash2 = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };
export const styleOf = info => ({ fenced: info.size !== 'small' && hash2(info.cx, info.cz) < 0.55, pillar: info.size === 'big' && hash2(info.cz, info.cx) < 0.4 });
export function dress(box, info, y0, rnd = Math.random) {
  const st = styleOf(info);
  const { cx, cz, R, size } = info; let n = 0; const put = (...a) => { if (n < CAP) { box(...a); n++; } };
  /* a ring of boxes at radius r, width w, height h, the colour from f(k); the piece length is len (m) */
  const ring = (r, w, h, len0, f, from = 0, to = Math.PI * 2) => { const len = size === 'big' ? len0 * 2.4 : len0, cnt = Math.max(6, Math.round((to - from) * r / len)), step = (to - from) / cnt; for (let k = 0; k < cnt; k++) { const t = from + (k + 0.5) * step; put(cx + Math.cos(t) * r, y0, cz + Math.sin(t) * r, step * r * 1.04, h, w, t + Math.PI / 2, f(k, t)); } };
  ring(R - 0.2, 0.4, KERB_Y, 1.2, k => k % 2 ? BLK : YEL);                                  // the painted kerb: 1.2 m stripes
  if (size === 'small') { ring(Math.max(1.2, R - 1.3), 0.7, 0.55, 1.0, (k) => tone(HEDGE, k)); put(cx, y0, cz, Math.max(1.4, R * 0.35), 0.7, Math.max(1.4, R * 0.35), 0.4, SHRUB); }
  else if (size === 'medium') { ring(R - 1.4, 0.8, 0.6, 1.0, (k) => tone(HEDGE, k)); ring(R - 3.6, 1.8, 0.22, 0.9, (k) => BEDS[(k >> 2) % 3]); ring(R - 6.4, 0.8, 0.55, 1.0, (k) => tone(HEDGE2, k)); put(cx, y0, cz, 0.16, 5.2, 0.16, 0, POLE); put(cx, y0 + 5.2, cz, 0.5, 0.18, 0.5, 0, POLE); }
  else {
    ring(R - 1.5, 0.9, 0.65, 1.0, (k) => tone(HEDGE, k)); ring(R - 4.2, 2.6, 0.22, 0.9, (k) => BEDS[(k >> 3) % BEDS.length]); ring(R - 8, 0.9, 0.6, 1.0, (k) => tone(HEDGE2, k));
    ring(R * 0.55, 3.4, 0.2, 0.9, (k) => BEDS[((k >> 2) + 2) % BEDS.length]); ring(R * 0.3, 1.0, 0.55, 1.0, (k) => tone(HEDGE, k));
    for (let q = 0; q < 4; q++) { const t = q * Math.PI / 2 + 0.4, r0 = R * 0.3, r1 = R - 1.2, len = r1 - r0; put(cx + Math.cos(t) * (r0 + r1) / 2, y0 + 0.01, cz + Math.sin(t) * (r0 + r1) / 2, len, 0.06, 1.3, t, PATH); }       // four paths to the centre
    put(cx, y0, cz, 0.2, 6, 0.2, 0, POLE); for (let q = 0; q < 6; q++) { const t = q * Math.PI / 3, r = R - 6; put(cx + Math.cos(t) * r, y0, cz + Math.sin(t) * r, 0.14, 5, 0.14, 0, POLE); }       // a lamp in the middle and six round the ring
  }
  const ring2 = (r, w, h, len, c, dy = 0) => { const cnt = Math.max(6, Math.round(Math.PI * 2 * r / len)), step = Math.PI * 2 / cnt; for (let k = 0; k < cnt; k++) { const t = (k + 0.5) * step; put(cx + Math.cos(t) * r, y0 + dy, cz + Math.sin(t) * r, step * r * 1.04, h, w, t + Math.PI / 2, c); } };
  if (st.fenced) {                                       // a railing: posts every 2.4 m, a top and a bottom rail, pickets every 0.8 m (1.4 m on the big ones), 0.95 m high, on a 0.2 m plinth
    const rr = R - 0.9, pick = size === 'big' ? 1.4 : 0.8; ring2(rr, 0.3, 0.2, 1.6, PLINTH);
    const cnt = Math.max(8, Math.round(Math.PI * 2 * rr / pick)); for (let k = 0; k < cnt; k++) { const t = (k + 0.5) * Math.PI * 2 / cnt; put(cx + Math.cos(t) * rr, y0 + 0.2, cz + Math.sin(t) * rr, 0.035, 0.8, 0.035, t, FENCE); }
    const posts = Math.max(6, Math.round(Math.PI * 2 * rr / 2.4)); for (let k = 0; k < posts; k++) { const t = k * Math.PI * 2 / posts; put(cx + Math.cos(t) * rr, y0 + 0.2, cz + Math.sin(t) * rr, 0.12, 1.0, 0.12, t, FENCE); }
    ring2(rr, 0.06, 0.05, 1.6, FENCE, 0.32); ring2(rr, 0.06, 0.05, 1.6, FENCE, 0.95);       // the bottom and the top rail
  }
  if (size === 'medium' && !st.fenced) { for (let q = 0; q < 4; q++) { const t = q * Math.PI / 2 + 0.7, r = R * 0.5; const px = cx + Math.cos(t) * r, pz = cz + Math.sin(t) * r; for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; put(px + Math.cos(a) * 1.4, y0, pz + Math.sin(a) * 1.4, 0.7, 0.4, 0.3, a + Math.PI / 2, BASIN); } put(px, y0, pz, 1.9, 0.12, 1.9, 0.4, BEDS[q % BEDS.length]); } }      // round planters (the reference with the small fountains)
  if (st.pillar) { const rP = Math.min(R * 0.32, 7); ring2(R - 4.2, 2.6, 0.05, 1.6, PATH);      // a paved ring walk and, in the middle, a stepped round basin with a tall pillar
    ring2(rP, 0.5, 0.55, 0.9, BASIN); put(cx, y0, cz, 2.2, 1.0, 2.2, 0.4, COLUMN); put(cx, y0 + 1.0, cz, 1.3, 9.0, 1.3, 0.4, COLUMN); put(cx, y0 + 10.0, cz, 1.9, 0.5, 1.9, 0.4, COLUMN); put(cx, y0 + 10.5, cz, 0.7, 1.2, 0.7, 0.4, COLUMN); }
  return n;
}
