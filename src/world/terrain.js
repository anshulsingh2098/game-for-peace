/* Terrain: height(x, z) and ground colour as pure functions of the WorldConfig.
   Everything that needs the land (tile meshes, wheels, scenery, the road router) asks these same functions,
   so they always agree. World coordinates are metres; y is up. */
import { createNoise } from '../core/noise.js';
import { alea } from '../core/rng.js';

const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function createTerrain(config) {
  const T = config.terrain, P = config.palette, N = createNoise(config.seed), r = alea(config.seed, 'terrain');
  const off = () => [r.range(-4000, 4000), r.range(-4000, 4000)];
  const oW = off(), oW2 = off(), oC = off(), oH = off(), oM = off(), oR = off(), oD = off(), oK = off(), oK2 = off();
  const sea = T.seaLevel;

  function height(x, z) {
    const wsx = x / T.warp.scale, wsz = z / T.warp.scale;
    const wx = x + T.warp.amp * N.n2(wsx + oW[0], wsz + oW[1]), wz = z + T.warp.amp * N.n2(wsx + oW2[0], wsz + oW2[1]);
    const c = N.fbm(wx / T.continent.scale + oC[0], wz / T.continent.scale + oC[1], 3, 2, 0.5);
    const land = sstep(T.coast.lo, T.coast.hi, c);
    let h = lerp(T.seabed, T.lowland, land) + Math.max(0, c) * T.continent.rise;
    h += N.fbm(wx / T.hills.scale + oH[0], wz / T.hills.scale + oH[1], T.hills.octaves, T.hills.lacunarity, T.hills.gain) * T.hills.amp * (0.25 + 0.75 * land);
    const M = T.mountains, mm = sstep(M.start, M.full, N.fbm(wx / M.maskScale + oM[0], wz / M.maskScale + oM[1], 2, 2, 0.5)) * land;
    if (mm > 0.001) h += Math.pow(N.ridged(wx / M.scale + oR[0], wz / M.scale + oR[1], M.octaves, 2.1, M.gain), M.sharp) * M.amp * mm;
    h += N.fbm(x / T.detail.scale + oD[0], z / T.detail.scale + oD[1], T.detail.octaves, 2, 0.5) * T.detail.amp * land;
    return h;
  }

  /* ground colour at a point. `ny` is the y of the unit surface normal (1 = flat, 0 = vertical). Writes r, g, b into out. */
  function colour(x, z, h, ny, out) {
    const n = 0.5 + 0.5 * N.n2(x / 26 + oK[0], z / 26 + oK[1]), patch = sstep(0.1, 0.6, N.n2(x / 85 + oK2[0], z / 85 + oK2[1]));
    const up = h - sea, alt = sstep(0, 160, up);
    const mixG = clamp01(n * 0.7 + alt * 0.4), dry = patch * 0.55;
    const alp = sstep(P.treeline - 60, P.treeline + 40, up + n * 30);
    const rock = clamp01((0.86 - ny) / 0.2) * 0.9;
    const snow = sstep(P.snowline - 25, P.snowline + 25, up + n * 40) * sstep(0.45, 0.75, ny);
    const beach = 1 - sstep(1.0, 3.5, up), deep = sstep(0, 14, -up);
    const shade = 0.92 + 0.16 * n;
    for (let c = 0; c < 3; c++) {
      let v = lerp(lerp(P.grass[c], P.grass2[c], mixG), P.dry[c], dry);
      v = lerp(v, P.alpine[c], alp);
      v = lerp(v, P.rock[c] * (0.9 + 0.2 * n), rock);
      v = lerp(v, P.snow[c], snow);
      v = lerp(v, lerp(P.sand[c], P.seabed[c], deep), beach);
      out[c] = v * shade;
    }
    return out;
  }

  /* a sensible place to begin: dry, not too high, not too steep, as near the origin as possible */
  function findSpawn() {
    for (let ring = 0; ring < 60; ring++) {
      const rad = ring * 160, steps = ring === 0 ? 1 : ring * 6;
      for (let k = 0; k < steps; k++) {
        const a = k / steps * Math.PI * 2, x = Math.cos(a) * rad, z = Math.sin(a) * rad, h = height(x, z);
        if (h < sea + 6 || h > sea + 90) continue;
        if (Math.abs(height(x + 12, z) - h) > 3 || Math.abs(height(x, z + 12) - h) > 3) continue;
        return { x, z, y: h };
      }
    }
    return { x: 0, z: 0, y: Math.max(sea, height(0, 0)) };
  }

  return { height, colour, findSpawn, seaLevel: sea, config };
}
