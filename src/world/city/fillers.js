/* Fillers for the Delhi pack (Phase P1 of docs/DELHI_POLISH_PLAN.md): what goes on the ground inside a built-up block that neither the mapped buildings nor the infill lots cover.
   After infill.js has put lots along the street frontage, the middle of a large block can still be a flat grey plain. This finds the empty squares left in the block (a 4 m grid over the tile,
   biggest square first, at most 60 m a side) and gives each one a use by the character of the area: a paved courtyard or forecourt with a tree or two (old city, markets, villages), a stone
   plaza ringed with trees (Connaught Place), a parking lot with rows of cars (DDA flats, business districts), a lawn with trees (Lutyens' bungalow gardens). Deterministic from the tile and
   the area; never on a street (with its pavement), a building (with a 4 m margin), a park or water, a mapped landmark, or within 12 m of the tile edge (a building that belongs to the next tile can overhang by more than that in about 1 in 1000 cases).
   Pure (no three.js): `tools/selftest.mjs` and `tools/measure_voids.mjs` use it; `fillerview.js` draws the result. A record: { kind, ring (flat x, z of the paved square), cx, cz, side,
   hue (0..1), trees: [[x, z, k]], cars: [[x, z, yaw, colour index]] }. */
import { hash } from './identity.js';

const SKIP_LANDUSE = new Set(['park', 'garden', 'forest', 'farmland', 'cemetery', 'religious', 'grass', 'recreation_ground', 'water', 'meadow', 'allotments']);
export const FILL = {
  /* by area style (identity area name): kind of filler, trees per 1000 m2, car density 0..1 */
  oldDelhi: { kind: 'courtyard', trees: 1.2, cars: 0 },
  market: { kind: 'courtyard', trees: 1.5, cars: 0.15 },
  village: { kind: 'courtyard', trees: 2.0, cars: 0 },
  default: { kind: 'forecourt', trees: 2.5, cars: 0.5 },
  dda: { kind: 'parking', trees: 3.0, cars: 0.75 },
  cp: { kind: 'plaza', trees: 3.5, cars: 0 },
  lutyens: { kind: 'garden', trees: 6.0, cars: 0 },
  business: { kind: 'parking', trees: 2.0, cars: 0.85 },
};
export const CELL = 4, MIN_SIDE = 5, MAX_SIDE = 15, EDGE = 12, MAX_PER_TILE = 160, MAX_TREES = 120, MAX_CARS = 120;

const clean = r => (r.length > 2 && r[0] === r[r.length - 2] && r[1] === r[r.length - 1]) ? r.slice(0, -2) : r;
/* scanline-fill a polygon (flat x, z) into a grid of n x n cells of CELL metres whose corner is (x0, z0) */
function fillRing(grid, n, x0, z0, ring, val) {
  let zmin = Infinity, zmax = -Infinity; for (let i = 1; i < ring.length; i += 2) { zmin = Math.min(zmin, ring[i]); zmax = Math.max(zmax, ring[i]); }
  for (let j = Math.max(0, Math.floor((zmin - z0) / CELL)); j <= Math.min(n - 1, Math.floor((zmax - z0) / CELL)); j++) {
    const z = z0 + (j + 0.5) * CELL, xs = []; for (let i = 0, k = ring.length - 2; i < ring.length; k = i, i += 2) { const zi = ring[i + 1], zk = ring[k + 1]; if ((zi > z) !== (zk > z)) xs.push(ring[i] + (z - zi) / (zk - zi) * (ring[k] - ring[i])); }
    xs.sort((a, b) => a - b); for (let q = 0; q + 1 < xs.length; q += 2) for (let i = Math.max(0, Math.ceil((xs[q] - x0) / CELL - 0.5)); i <= Math.min(n - 1, Math.floor((xs[q + 1] - x0) / CELL - 0.5)); i++) grid[j * n + i] = val;
  }
}

/* tile: a decoded pack tile (world metres); infill: the infill buildings for it; o: { size, G, widthOf(streetPiece), styleAt(x, z), avoid (optional: rings to keep clear), yieldNow }.
   A generator so the tile mesher can spread the work over frames; fillerRects() runs it to the end. */
export function fillerRects(tile, infill, o) { const g = fillerSteps(tile, infill, o); let r; while (!(r = g.next()).done); return r.value; }
export function* fillerSteps(tile, infill, o) {
  const S = o.size, n = Math.round(S / CELL), ox = tile.tx * S, oz = tile.tz * S, block = new Uint8Array(n * n), cover = new Uint8Array(n * n), out = [];
  for (const b of tile.blocks || []) if (!SKIP_LANDUSE.has(b.landuse)) { fillRing(block, n, ox, oz, clean(b.ring), 1); for (const h of b.holes || []) fillRing(block, n, ox, oz, clean(h), 0); }
  if (o.yieldNow && o.yieldNow()) yield;
  const bld = new Uint8Array(n * n); for (const b of (tile.buildings || []).concat(infill || [])) if (b.ring && b.ring.length >= 6) fillRing(bld, n, ox, oz, clean(b.ring), 1);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (bld[j * n + i]) { for (let b = Math.max(0, j - 1); b <= Math.min(n - 1, j + 1); b++) for (let a = Math.max(0, i - 1); a <= Math.min(n - 1, i + 1); a++) cover[b * n + a] = 1; }       // buildings with one cell (4 m) of margin
  for (const p of [...(tile.parks || []), ...(tile.water || [])]) fillRing(cover, n, ox, oz, clean(p.ring), 1);
  for (const r of o.avoid || []) fillRing(cover, n, ox, oz, clean(r), 1);
  if (o.yieldNow && o.yieldNow()) yield;
  for (const s of tile.streets || []) {
    const cls = o.G.classes[o.G.cls[s.id]]; if (cls === 'footway' || cls === 'steps') continue; const hw = o.widthOf(s) / 2 + 2.3, p = s.pts;
    for (let i = 0; i + 3 < p.length; i += 2) { const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], L = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.ceil(L / (CELL / 2)));
      for (let q = 0; q <= k; q++) { const px = ax + (bx - ax) * q / k, pz = az + (bz - az) * q / k; for (let a = Math.max(0, Math.floor((px - hw - ox) / CELL)); a <= Math.min(n - 1, Math.floor((px + hw - ox) / CELL)); a++) for (let b = Math.max(0, Math.floor((pz - hw - oz) / CELL)); b <= Math.min(n - 1, Math.floor((pz + hw - oz) / CELL)); b++) if (Math.hypot(ox + (a + 0.5) * CELL - px, oz + (b + 0.5) * CELL - pz) <= hw) cover[b * n + a] = 1; } }
  }
  const em = Math.ceil(EDGE / CELL); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (i < em || j < em || i >= n - em || j >= n - em) cover[j * n + i] = 1;
  if (o.yieldNow && o.yieldNow()) yield;
  /* the largest empty square ending at each cell (dynamic programming), then place squares biggest first */
  const dp = new Uint8Array(n * n), by = []; for (let d = 0; d <= 255; d++) by.push(null);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i; if (!block[k] || cover[k]) continue; const v = (i && j) ? 1 + Math.min(dp[k - 1], dp[k - n], dp[k - n - 1]) : 1; dp[k] = v > 255 ? 255 : v; if (v >= MIN_SIDE) (by[v] || (by[v] = [])).push(k); }
  let trees = 0, cars = 0;
  for (let d = 255; d >= MIN_SIDE && out.length < MAX_PER_TILE; d--) {
    const list = by[d]; if (!list) continue;
    for (const k of list) {
      if (out.length >= MAX_PER_TILE) break; const i = k % n, j = (k - i) / n, s = Math.min(d, MAX_SIDE); let free = true;
      for (let b = j - s + 1; b <= j && free; b++) for (let a = i - s + 1; a <= i; a++) if (cover[b * n + a]) { free = false; break; }
      if (!free) continue;
      for (let b = j - s + 1; b <= j; b++) for (let a = i - s + 1; a <= i; a++) cover[b * n + a] = 1;
      const x0 = ox + (i - s + 1) * CELL, z0 = oz + (j - s + 1) * CELL, side = s * CELL, cx = x0 + side / 2, cz = z0 + side / 2, name = o.styleAt ? o.styleAt(cx, cz) : 'default', F = FILL[name] || FILL.default, h0 = hash(tile.tx * 7919 + tile.tz * 104729 + k);
      const rec = { kind: F.kind, ring: [x0 + 1, z0 + 1, x0 + side - 1, z0 + 1, x0 + side - 1, z0 + side - 1, x0 + 1, z0 + side - 1], cx, cz, side, hue: h0, trees: [], cars: [] };
      const nt = Math.min(8, Math.round(F.trees * side * side / 1000 + (hash(k * 3 + 1) < (F.trees * side * side / 1000) % 1 ? 1 : 0)));
      for (let t = 0; t < nt && trees < MAX_TREES; t++) {                                           // trees near the edges, so the middle stays usable
        const e = hash(k * 31 + t * 17 + 5), f = hash(k * 13 + t * 29 + 7), edge = Math.floor(hash(k + t * 41) * 4), u = 2 + (side - 4) * e, v = 2 + (side - 4) * f;
        const tx = edge === 0 ? x0 + 2.2 : edge === 1 ? x0 + side - 2.2 : x0 + u, tz = edge === 2 ? z0 + 2.2 : edge === 3 ? z0 + side - 2.2 : z0 + v; rec.trees.push([tx, tz, hash(k * 5 + t * 11 + 3)]); trees++;
      }
      if (F.cars > 0 && side >= 20) {                                                                  // rows of parked cars, nose to the middle, with an aisle between the rows
        const rows = Math.max(1, Math.floor((side - 8) / 10)), aisle = side / (rows + 1), stepA = 2.7;
        for (let r = 0; r < rows; r++) for (let a = 3; a + 2 < side - 3; a += stepA) { if (cars >= MAX_CARS) break; if (hash(k * 97 + r * 331 + a * 7) > F.cars) continue; const side2 = (r & 1) ? 1 : -1; rec.cars.push([x0 + a + 1, z0 + aisle * (r + 1) + side2 * 3, side2 > 0 ? Math.PI / 2 : -Math.PI / 2, Math.floor(hash(k * 3 + r * 17 + a) * 8)]); cars++; }
      }
      out.push(rec);
    }
    if (o.yieldNow && o.yieldNow()) yield;
  }
  out.stats = { fillers: out.length, trees, cars }; return out;
}
