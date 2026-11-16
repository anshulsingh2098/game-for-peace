/* Terrain: land height and ground colour as pure functions of the WorldConfig.
   Everything that needs the land (tile meshes, wheels, scenery, the road router) asks these same functions,
   so they always agree. World coordinates are metres; y is up.
     base(x, z)    the natural land, before any road
     height(x, z)  the land as it is driven on: natural, with the road cut or filled in once a road is attached
     forest(x, z)  0..1, how wooded a place is (scenery and ground colour both use it)
     surface(x, z) what the wheels are on there: asphalt, gravel, grass, sand, rock or snow */
import { createNoise } from '../core/noise.js';
import { alea } from '../core/rng.js';
import { roadSurfaceAt } from './roadstyles.js';

const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const HAY = [1.55, 1.12, 0.62], LUSH = [0.68, 1.12, 0.72];
const DIRT = [0.55, 0.47, 0.34], BARE = [0.84, 0.67, 0.36], BUILT = [0.5, 0.48, 0.46];

export function createTerrain(config) {
  const T = config.terrain, P = config.palette, N = createNoise(config.seed), r = alea(config.seed, 'terrain');
  const off = () => [r.range(-4000, 4000), r.range(-4000, 4000)];
  const oW = off(), oW2 = off(), oC = off(), oH = off(), oM = off(), oR = off(), oD = off(), oK = off(), oK2 = off(), oF = off();
  const sea = T.seaLevel; let road = null;
  /* Real elevation and land cover (India mode, assets/india/terrain.bin, see tools/build_india_grids.py): T.macro = { cell, x0, z0 (the grid's corner in game metres), ox, oz (add to a terrain
     coordinate to get the game coordinate), nx, nz, vscale (game metres of height per real metre), h (real metres, Int16Array), rel (relief, real metres / 8), tree, crop, grass, bare, built (0..255) }.
     The land is the real relief, scaled down vertically, with procedural hills and ridges on top whose strength follows the real relief, so plains stay plain and ranges stay rough. */
  const MAC = T.macro || null;
  function mix(plane, x, z) {
    const gx = (x + MAC.ox - MAC.x0) / MAC.cell - 0.5, gz = (z + MAC.oz - MAC.z0) / MAC.cell - 0.5, i0 = Math.max(0, Math.min(MAC.nx - 2, Math.floor(gx))), j0 = Math.max(0, Math.min(MAC.nz - 2, Math.floor(gz))), fx = Math.max(0, Math.min(1, gx - i0)), fz = Math.max(0, Math.min(1, gz - j0)), k = j0 * MAC.nx + i0;
    return (plane[k] * (1 - fx) + plane[k + 1] * fx) * (1 - fz) + (plane[k + MAC.nx] * (1 - fx) + plane[k + MAC.nx + 1] * fx) * fz;
  }
  /* region blending (N9): T.macro.region = { cell, x0, z0, nx, nz, a, b, w } (nearest region index, second nearest, blend toward it 0..255) and T.macro.palettes / tints per region index:
     the ground colours and the plants' tint change gradually from one region to the next along a long road */
  function regionAt(x, z) {
    const R = MAC && MAC.region; if (!R) return null; const i = Math.max(0, Math.min(R.nx - 1, Math.floor((x + MAC.ox - R.x0) / R.cell))), j = Math.max(0, Math.min(R.nz - 1, Math.floor((z + MAC.oz - R.z0) / R.cell))), k = j * R.nx + i;
    return { a: R.a[k], b: R.b[k], w: R.w[k] / 255 };
  }
  function regionTint(x, z) { const r = regionAt(x, z); if (!r || !MAC.tints) return null; const A = MAC.tints[r.a], B = MAC.tints[r.b]; return [lerp(A[0], B[0], r.w), lerp(A[1], B[1], r.w), lerp(A[2], B[2], r.w)]; }
  function cover(x, z) { if (!MAC) return null; return { tree: mix(MAC.tree, x, z) / 255, crop: mix(MAC.crop, x, z) / 255, grass: mix(MAC.grass, x, z) / 255, bare: mix(MAC.bare, x, z) / 255, built: mix(MAC.built, x, z) / 255 }; }
  function baseMacro(x, z) {
    const real = mix(MAC.h, x, z), rel = clamp01(mix(MAC.rel, x, z) * 8 / 520), V = MAC.vscale, land = sstep(-30, 30, real);
    let h = sea + (real >= 0 ? real * V : Math.max(real * V * 0.5, T.seabed));
    const wx = x + T.warp.amp * 0.25 * N.n2(x / T.warp.scale + oW[0], z / T.warp.scale + oW[1]), wz = z + T.warp.amp * 0.25 * N.n2(x / T.warp.scale + oW2[0], z / T.warp.scale + oW2[1]);
    h += N.fbm(wx / T.hills.scale + oH[0], wz / T.hills.scale + oH[1], T.hills.octaves, T.hills.lacunarity, T.hills.gain) * T.hills.amp * (0.1 + 0.6 * rel) * land;
    if (rel > 0.2) h += Math.pow(N.ridged(wx / T.mountains.scale + oR[0], wz / T.mountains.scale + oR[1], T.mountains.octaves, 2.1, T.mountains.gain), T.mountains.sharp) * T.mountains.amp * 0.07 * (rel - 0.2) / 0.8 * land;
    h += N.fbm(x / T.detail.scale + oD[0], z / T.detail.scale + oD[1], T.detail.octaves, 2, 0.5) * T.detail.amp * land * (0.5 + rel);
    return h;
  }

  function base(x, z) {
    if (MAC) return baseMacro(x, z);
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
  /* flat zones: ground levelled for a landmark. The land eases from `y` to its natural height between r and r + blend metres out. They affect what is built and driven on, not the road routing. */
  const zones = [];
  function natural(x, z) {
    let h = base(x, z);
    for (let i = 0; i < zones.length; i++) { const q = zones[i], d = Math.hypot(x - q.x, z - q.z); if (d < q.r + q.blend) h = q.y + (h - q.y) * sstep(q.r, q.r + q.blend, d); }
    return h;
  }
  let railG = null;                                                                                                  // the railway's cuttings and embankments (world/rail_grade.js), where no road already shapes the ground
  function height(x, z) { const h = zones.length ? natural(x, z) : base(x, z), r = road ? road.grade(x, z, h) : h; return railG && r === h ? railG.grade(x, z, h) : r; }
  function drive(x, z, y) { const h = zones.length ? natural(x, z) : base(x, z), r = road ? road.drive(x, z, h, y) : h; return railG && r === h ? railG.grade(x, z, h) : r; }                  // what wheels roll on: the road surface itself. y (optional): the height of whoever asks, to pick the layer where roads cross at different heights (RoadSet); -Infinity: the ground only
  function deck(x, z) { if (!road || !road.deck) return NaN; return road.deck(x, z, zones.length ? natural(x, z) : base(x, z)); }                  // the deck of a lifted road over this point, or NaN
  function inZone(x, z, margin = 0) { for (let i = 0; i < zones.length; i++) if (Math.hypot(x - zones[i].x, z - zones[i].z) < zones[i].r + margin) return true; return false; }                  // what wheels roll on: the road surface itself
  function forest(x, z) { if (MAC) { const c = cover(x, z); return sstep(0.1, 0.5, c.tree + 0.25 * c.grass) * (1 - 0.8 * c.built); } return sstep(-0.12, 0.22, N.fbm(x / 430 + oF[0], z / 430 + oF[1], 3, 2, 0.5)); }

  /* what the wheels are on at a point: a key of SURFACES in vehicle/physics.js */
  function surface(x, z) {
    if (road && road.nearest(x, z)) { const k = roadSurfaceAt(road.style, road.hit.d); if (k) return k; }
    const up = base(x, z) - sea; return up < 3.2 ? 'sand' : up > P.snowline + 10 ? 'snow' : up > P.treeline + 60 ? 'rock' : 'grass';
  }

  /* Indian farmland from above: small rectangular parcels (about 50 to 130 m), each its own crop or stubble tone, with thin darker field bunds, laid out at an angle that changes slowly across the land.
     Only with real land cover (India world). Returns the tone [r, g, b] and writes the bund darkening into fp.bund. */
  const FIELD_TONES = [[0.7, 0.6, 0.4], [0.32, 0.47, 0.2], [0.36, 0.5, 0.22], [0.8, 0.69, 0.2], [0.55, 0.43, 0.3], [0.2, 0.31, 0.14], [0.66, 0.58, 0.38], [0.42, 0.52, 0.24]], fp = { r: 0, g: 0, b: 0, bund: 1 };
  const hash2 = (i, j) => { let h = (i * 374761393 + j * 668265263 + 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function fieldPattern(x, z) {
    const th = 0.35 + 1.1 * N.n2(x / 6000 + oK[0], z / 6000 + oK[1]), ct = Math.cos(th), st = Math.sin(th), wx = x + 24 * N.n2(x / 190 + oK2[0], z / 190 + oK2[1]), wz = z + 24 * N.n2(x / 170 + oK2[1], z / 170 + oK2[0]);
    const u = (wx * ct + wz * st) / 84, v = (-wx * st + wz * ct) / 58, i = Math.floor(u), j = Math.floor(v), h = hash2(i, j), t = FIELD_TONES[Math.floor(h * FIELD_TONES.length)], b = 0.9 + 0.2 * hash2(j, i + 77);
    fp.r = t[0] * b; fp.g = t[1] * b; fp.b = t[2] * b; const eu = Math.min(u - i, 1 - (u - i)) * 84, ev = Math.min(v - j, 1 - (v - j)) * 58; fp.bund = 1 - 0.18 * (1 - sstep(0.4, 1.6, Math.min(eu, ev))); return fp;
  }
  /* ground colour at a point. `ny` is the y of the unit surface normal (1 = flat, 0 = vertical). Writes r, g, b into out.
     `nearRoad` false skips the roadside verge (used for the distant, coarse tiles). */
  function colour(x, z, h, ny, out, nearRoad = true) {
    const n = 0.5 + 0.5 * N.n2(x / 26 + oK[0], z / 26 + oK[1]), patch = sstep(0.1, 0.6, N.n2(x / 85 + oK2[0], z / 85 + oK2[1]));
    const up = h - sea, alt = sstep(0, 160, up);
    const rg = MAC && MAC.palettes ? regionAt(x, z) : null, PA = rg ? MAC.palettes[rg.a] : P, PB = rg ? MAC.palettes[rg.b] : P, pw = rg ? rg.w : 0, PL = (key, c) => rg ? lerp(PA[key][c], PB[key][c], pw) : P[key][c];
    const cv = MAC ? cover(x, z) : null, mixG = clamp01(n * 0.7 + alt * 0.4), dry = clamp01(patch * 0.55 + (cv ? cv.grass * 0.5 : 0));
    const alp = sstep(P.treeline - 60, P.treeline + 40, up + n * 30);
    const rock = clamp01((0.86 - ny) / 0.2) * 0.9;
    const snow = sstep(P.snowline - 25, P.snowline + 25, up + n * 40) * sstep(0.45, 0.75, ny);
    const beach = 1 - sstep(1.0, 3.5, up), deep = sstep(0, 14, -up);
    const wood = forest(x, z) * (1 - alp) * (1 - rock) * (1 - beach) * 0.5;      // woodland floor is darker, so far forests read as forest
    const verge = nearRoad && road && road.nearest(x, z) ? 1 - sstep(5.2, 9.5, road.hit.d) : 0;
    const shade = 0.92 + 0.16 * n;
    /* a patchwork of fields and meadows (a few hundred metres across, fairly hard edges): hay-yellow, fresh green and deep green, so open land is not one flat colour. Only on open lowland. */
    const f1 = N.n2(x / 140 + oK2[1] * 3.1, z / 140 + oK2[0] * 2.3), f2 = N.n2(x / 240 + oK[1] * 1.7, z / 240 + oK[0] * 2.9), hay = sstep(0.04, 0.12, f1), lush = sstep(-0.02, 0.06, f2) * (1 - hay), fieldW = (1 - forest(x, z)) * (1 - alp) * (1 - rock) * (1 - beach) * 0.85 * (cv ? 0.15 + 1.1 * cv.crop : 1);                       // with real land cover the patchwork shows on farmland
    const fpt = cv && cv.crop > 0.06 ? fieldPattern(x, z) : null, fieldAmt = fpt ? clamp01(fieldW * 0.8) : 0;
    for (let c = 0; c < 3; c++) {
      let v = lerp(lerp(PL('grass', c), PL('grass2', c), mixG), PL('dry', c), dry);
      if (cv) v = lerp(lerp(v, BARE[c], cv.bare * 0.6), BUILT[c], cv.built * 0.55);                                   // real land cover: bare ground is ochre, built-up land grey
      if (fpt) v = lerp(v, fpt[c === 0 ? 'r' : c === 1 ? 'g' : 'b'], fieldAmt) * (1 - fieldAmt + fieldAmt * fpt.bund); else v *= 1 + fieldW * (hay * (HAY[c] - 1) + lush * (LUSH[c] - 1));
      v = lerp(v, PL('grass2', c) * 0.62, wood);
      v = lerp(v, P.alpine[c], alp);
      v = lerp(v, P.rock[c] * (0.9 + 0.2 * n), rock);
      v = lerp(v, P.snow[c], snow);
      v = lerp(v, lerp(P.sand[c], P.seabed[c], deep), beach);
      v = lerp(v, lerp(DIRT[c], PL('grass2', c), 0.45), verge * 0.9);
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

  const terrain = { base, height, drive, deck, surface, inZone, addZone: (x, z, r, y, blend = 40) => { zones.push({ x, z, r, y, blend }); }, colour, forest, findSpawn, seaLevel: sea, config,
    cover, regionAt, regionTint, attachRoad(r) { road = r; }, attachRail(g) { railG = g; }, get road() { return road; },
    /* the same land without the road, for the coarse horizon tiles */
    far: { height: base, colour: (x, z, h, ny, out) => colour(x, z, h, ny, out, false) } };
  return terrain;
}
