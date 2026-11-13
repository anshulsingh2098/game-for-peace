/* Terrain: land height and ground colour as pure functions of the WorldConfig.
   Everything that needs the land (tile meshes, wheels, scenery, the road router) asks these same functions,
   so they always agree. World coordinates are metres; y is up.
     base(x, z)    the natural land, before any road
     height(x, z)  the land as it is driven on: natural, with the road cut or filled in once a road is attached
     forest(x, z)  0..1, how wooded a place is (scenery and ground colour both use it)
     surface(x, z) what the wheels are on there: asphalt, gravel, grass, sand, rock or snow */
import { createNoise } from '../core/noise.js';
import { alea } from '../core/rng.js';

const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const DIRT = [0.55, 0.47, 0.34];

export function createTerrain(config) {
  const T = config.terrain, P = config.palette, N = createNoise(config.seed), r = alea(config.seed, 'terrain');
  const off = () => [r.range(-4000, 4000), r.range(-4000, 4000)];
  const oW = off(), oW2 = off(), oC = off(), oH = off(), oM = off(), oR = off(), oD = off(), oK = off(), oK2 = off(), oF = off();
  const sea = T.seaLevel; let road = null;

  function base(x, z) {
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
  function height(x, z) { const h = base(x, z); return road ? road.grade(x, z, h) : h; }
  function forest(x, z) { return sstep(-0.18, 0.32, N.fbm(x / 430 + oF[0], z / 430 + oF[1], 3, 2, 0.5)); }

  /* what the wheels are on at a point: a key of SURFACES in vehicle/physics.js */
  function surface(x, z) {
    if (road && road.nearest(x, z)) { const d = road.hit.d; if (d < 4.05) return 'asphalt'; if (d < 5.7) return 'gravel'; }
    const up = base(x, z) - sea; return up < 3.2 ? 'sand' : up > P.snowline + 10 ? 'snow' : up > P.treeline + 60 ? 'rock' : 'grass';
  }

  /* ground colour at a point. `ny` is the y of the unit surface normal (1 = flat, 0 = vertical). Writes r, g, b into out.
     `nearRoad` false skips the roadside verge (used for the distant, coarse tiles). */
  function colour(x, z, h, ny, out, nearRoad = true) {
    const n = 0.5 + 0.5 * N.n2(x / 26 + oK[0], z / 26 + oK[1]), patch = sstep(0.1, 0.6, N.n2(x / 85 + oK2[0], z / 85 + oK2[1]));
    const up = h - sea, alt = sstep(0, 160, up);
    const mixG = clamp01(n * 0.7 + alt * 0.4), dry = patch * 0.55;
    const alp = sstep(P.treeline - 60, P.treeline + 40, up + n * 30);
    const rock = clamp01((0.86 - ny) / 0.2) * 0.9;
    const snow = sstep(P.snowline - 25, P.snowline + 25, up + n * 40) * sstep(0.45, 0.75, ny);
    const beach = 1 - sstep(1.0, 3.5, up), deep = sstep(0, 14, -up);
    const wood = forest(x, z) * (1 - alp) * (1 - rock) * (1 - beach) * 0.5;      // woodland floor is darker, so far forests read as forest
    const verge = nearRoad && road && road.nearest(x, z) ? 1 - sstep(5.2, 9.5, road.hit.d) : 0;
    const shade = 0.92 + 0.16 * n;
    for (let c = 0; c < 3; c++) {
      let v = lerp(lerp(P.grass[c], P.grass2[c], mixG), P.dry[c], dry);
      v = lerp(v, P.grass2[c] * 0.62, wood);
      v = lerp(v, P.alpine[c], alp);
      v = lerp(v, P.rock[c] * (0.9 + 0.2 * n), rock);
      v = lerp(v, P.snow[c], snow);
      v = lerp(v, lerp(P.sand[c], P.seabed[c], deep), beach);
      v = lerp(v, lerp(DIRT[c], P.grass2[c], 0.45), verge * 0.9);
      out[c] = v * shade;
    }
    return out;
  }

  /* a sensible place to begin: dry, not too high, not too steep, as near the origin as possible */
  function findSpawn() {
    for (let ring = 0; ring < 60; ring++) {
      const rad = ring * 160, steps = ring === 0 ? 1 : ring * 6;
      for (let k = 0; k < steps; k++) {
        const a = k / steps * Math.PI * 2, x = Math.cos(a) * rad, z = Math.sin(a) * rad, h = base(x, z);
        if (h < sea + 6 || h > sea + 90) continue;
        if (Math.abs(base(x + 12, z) - h) > 3 || Math.abs(base(x, z + 12) - h) > 3) continue;
        return { x, z, y: h };
      }
    }
    return { x: 0, z: 0, y: Math.max(sea, base(0, 0)) };
  }

  const terrain = { base, height, surface, colour, forest, findSpawn, seaLevel: sea, config,
    attachRoad(r) { road = r; }, get road() { return road; },
    /* the same land without the road, for the coarse horizon tiles */
    far: { height: base, colour: (x, z, h, ny, out) => colour(x, z, h, ny, out, false) } };
  return terrain;
}
