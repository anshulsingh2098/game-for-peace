/* Gradient noise: 2D simplex noise with a seeded permutation table, plus the usual stacks built on it.
   n2 returns about -1..1. fbm returns -1..1. ridged returns 0..1 (sharp crests, for mountain ranges). */
import { alea } from './rng.js';

const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const GX = [1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0], GY = [1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1];

export function createNoise(seed) {
  const r = alea(seed, 'noise'), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = r.int(i + 1), t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }

  function n2(x, y) {
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, a = 0.5 - x0 * x0 - y0 * y0;
    if (a > 0) { const g = pm12[ii + perm[jj]]; a *= a; n += a * a * (GX[g] * x0 + GY[g] * y0); }
    a = 0.5 - x1 * x1 - y1 * y1;
    if (a > 0) { const g = pm12[ii + i1 + perm[jj + j1]]; a *= a; n += a * a * (GX[g] * x1 + GY[g] * y1); }
    a = 0.5 - x2 * x2 - y2 * y2;
    if (a > 0) { const g = pm12[ii + 1 + perm[jj + 1]]; a *= a; n += a * a * (GX[g] * x2 + GY[g] * y2); }
    return 70 * n;
  }
  /* layered noise: each octave is `lacunarity` times finer and `gain` times weaker */
  function fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let v = 0, amp = 1, tot = 0;
    for (let o = 0; o < octaves; o++) { v += amp * n2(x, y); tot += amp; x = x * lacunarity + 19.7; y = y * lacunarity - 7.3; amp *= gain; }
    return v / tot;
  }
  /* ridged noise: creases where the noise crosses zero, each octave weighted by the one before so ridges carry detail */
  function ridged(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let v = 0, amp = 1, tot = 0, w = 1;
    for (let o = 0; o < octaves; o++) {
      let n = 1 - Math.abs(n2(x, y)); n *= n;
      v += n * amp * w; tot += amp; w = Math.min(1, Math.max(0, n * 1.6));
      x = x * lacunarity + 31.1; y = y * lacunarity + 12.9; amp *= gain;
    }
    return v / tot;
  }
  return { n2, fbm, ridged };
}
