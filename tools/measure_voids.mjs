/* Measures how much of the ground inside Delhi's urban blocks is still an empty grey void (Phase P1 of docs/DELHI_POLISH_PLAN.md), headless, in the 5 sample areas.
   For each area it loads the pack tiles around the area's centre, adds the infill buildings the game adds, paints a 5 m grid over a 1.5 km box and marks every cell that is
   inside an urban block and covered by nothing: no street (with its pavement), mapped or infill building, park, water, or P1 filler (forecourts, courtyards, parking).
   It reports the building coverage of the blocks and the biggest empty square (metres) and how many empty squares of 100 m are left.
   Usage:  node tools/measure_voids.mjs [--json] [--no-infill] [--area oldDelhi,cp,...]      (read only; nothing is written)
   "Done" for P1 is: biggest empty square under 100 m in every sample area. */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as pack from '../src/world/city/pack.js';
import { Identity, projectLL } from '../src/world/city/identity.js';
import { infillBuildings } from '../src/world/city/infill.js';
let fill = null; try { fill = await import('../src/world/city/fillers.js'); } catch (e) { /* P1 fillers not built yet */ }

const dir = fileURLToPath(new URL('../assets/cities/delhi/', import.meta.url)), args = process.argv.slice(2), arg = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const M = JSON.parse(readFileSync(dir + 'manifest.json', 'utf8')), G = pack.decodeGraphColumns(JSON.parse(readFileSync(dir + 'graph.json', 'utf8'))), I = new Identity(JSON.parse(readFileSync(dir + 'identity.json', 'utf8')), M.origin);
const SAMPLES = { oldDelhi: 'Old Delhi (Chandni Chowk)', karolbagh: 'Karol Bagh', cp: 'Connaught Place', lajpat: 'Lajpat Nagar', lutyens: 'Lutyens Delhi (Khan Market side)' };
const want = (arg('--area') || Object.keys(SAMPLES).join(',')).split(','), CELL = 5, HALF = 750, SIZE = M.tileSize;
const SKIP = new Set(['park', 'garden', 'forest', 'farmland', 'cemetery', 'religious', 'grass', 'recreation_ground', 'water', 'meadow', 'allotments']);
const have = new Set(M.tiles.map(t => t.tx + '_' + t.tz)), cache = new Map();
const tileAt = (tx, tz) => { const k = tx + '_' + tz; if (!have.has(k)) return null; if (!cache.has(k)) cache.set(k, pack.decodeTile(JSON.parse(readFileSync(dir + 'tiles/' + k + '.json', 'utf8')), SIZE)); return cache.get(k); };
const clean = r => (r.length > 2 && r[0] === r[r.length - 2] && r[1] === r[r.length - 1]) ? r.slice(0, -2) : r;
function fillRing(grid, n, x0, z0, ring, val, only) {            // scanline fill of a polygon into the grid (val 1 = set; only: restrict to cells where only(cell) is true)
  let zmin = Infinity, zmax = -Infinity; for (let i = 1; i < ring.length; i += 2) { zmin = Math.min(zmin, ring[i]); zmax = Math.max(zmax, ring[i]); }
  for (let j = Math.max(0, Math.floor((zmin - z0) / CELL)); j <= Math.min(n - 1, Math.floor((zmax - z0) / CELL)); j++) {
    const z = z0 + (j + 0.5) * CELL, xs = []; for (let i = 0, k = ring.length - 2; i < ring.length; k = i, i += 2) { const zi = ring[i + 1], zk = ring[k + 1]; if ((zi > z) !== (zk > z)) xs.push(ring[i] + (z - zi) / (zk - zi) * (ring[k] - ring[i])); }
    xs.sort((a, b) => a - b); for (let q = 0; q + 1 < xs.length; q += 2) for (let i = Math.max(0, Math.ceil((xs[q] - x0) / CELL - 0.5)); i <= Math.min(n - 1, Math.floor((xs[q + 1] - x0) / CELL - 0.5)); i++) grid[j * n + i] = val;
  }
}
const report = [];
for (const name of want) {
  const zone = I.zones.find(z => z.area === name || z.id === name || z.name === name) || I.zones.find(z => z.area === name); if (!zone) { console.error('no zone for ' + name); continue; }
  const cx = zone.x, cz = zone.z, x0 = cx - HALF, z0 = cz - HALF, n = Math.round(HALF * 2 / CELL);
  const block = new Uint8Array(n * n), covered = new Uint8Array(n * n), bld = new Uint8Array(n * n);
  let nInfill = 0, nMapped = 0, nFill = 0;
  for (let tx = Math.floor((cx - HALF) / SIZE); tx <= Math.floor((cx + HALF) / SIZE); tx++) for (let tz = Math.floor((cz - HALF) / SIZE); tz <= Math.floor((cz + HALF) / SIZE); tz++) {
    const tile = tileAt(tx, tz); if (!tile) continue;
    const o = { size: SIZE, G, widthOf: s => pack.pieceWidth(G, s), styleAt: (x, z) => I.areaNameAt(x, z) };
    const inf = args.includes('--no-infill') ? [] : infillBuildings(tile, o); nInfill += inf.length; nMapped += (tile.buildings || []).length;
    for (const b of tile.blocks || []) if (!SKIP.has(b.landuse)) { fillRing(block, n, x0, z0, clean(b.ring), 1); for (const h of b.holes || []) fillRing(block, n, x0, z0, clean(h), 0); }
    for (const b of (tile.buildings || []).concat(inf)) if (b.ring && b.ring.length >= 6) { fillRing(covered, n, x0, z0, clean(b.ring), 1); fillRing(bld, n, x0, z0, clean(b.ring), 1); }
    for (const p of [...(tile.parks || []), ...(tile.water || [])]) fillRing(covered, n, x0, z0, clean(p.ring), 1);
    for (const s of tile.streets || []) { const cls = G.classes[G.cls[s.id]], hw = pack.pieceWidth(G, s) / 2 + 1.8; if (cls === 'footway' || cls === 'steps') continue;
      for (let i = 0; i + 3 < s.pts.length; i += 2) { const ax = s.pts[i], az = s.pts[i + 1], bx = s.pts[i + 2], bz = s.pts[i + 3], L = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.ceil(L / (CELL / 2)));
        for (let q = 0; q <= k; q++) { const px = ax + (bx - ax) * q / k, pz = az + (bz - az) * q / k; for (let a = Math.floor((px - hw - x0) / CELL); a <= Math.floor((px + hw - x0) / CELL); a++) for (let b = Math.floor((pz - hw - z0) / CELL); b <= Math.floor((pz + hw - z0) / CELL); b++) if (a >= 0 && b >= 0 && a < n && b < n && Math.hypot(x0 + (a + 0.5) * CELL - px, z0 + (b + 0.5) * CELL - pz) <= hw) covered[b * n + a] = 1; } } }
    if (fill && fill.fillerRects && !args.includes('--no-fill')) { const f = fill.fillerRects(tile, inf, o); nFill += f.length; for (const r of f) fillRing(covered, n, x0, z0, r.ring, 1); }
  }
  let blockCells = 0, bldCells = 0; for (let i = 0; i < n * n; i++) { if (block[i]) { blockCells++; if (bld[i]) bldCells++; } }
  /* the biggest square of block cells that nothing covers (dynamic programming), and how many disjoint 100 m squares fit */
  const e = new Uint8Array(n * n); for (let i = 0; i < n * n; i++) e[i] = block[i] && !covered[i] ? 1 : 0;
  const dp = new Uint16Array(n * n); let best = 0, bi = 0; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { if (!e[j * n + i]) continue; dp[j * n + i] = (i && j) ? 1 + Math.min(dp[j * n + i - 1], dp[(j - 1) * n + i], dp[(j - 1) * n + i - 1]) : 1; if (dp[j * n + i] > best) { best = dp[j * n + i]; bi = j * n + i; } }
  const need = 100 / CELL; let voids100 = 0; const used = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (dp[j * n + i] >= need) { let free = true; for (let a = 0; a < need && free; a++) for (let b = 0; b < need; b++) if (used[(j - b) * n + i - a]) { free = false; break; } if (free) { voids100++; for (let a = 0; a < need; a++) for (let b = 0; b < need; b++) used[(j - b) * n + i - a] = 1; } }
  let emptyCells = 0; for (let i = 0; i < n * n; i++) emptyCells += e[i];
  report.push({ area: name, label: SAMPLES[name] || name, centre: [Math.round(cx), Math.round(cz)], blockHa: +(blockCells * CELL * CELL / 1e4).toFixed(1), buildingCoverPct: +(100 * bldCells / Math.max(1, blockCells)).toFixed(1), emptyPct: +(100 * emptyCells / Math.max(1, blockCells)).toFixed(1), biggestEmptySquareM: best * CELL, at: [Math.round(x0 + (bi % n - best + 1) * CELL), Math.round(z0 + (Math.floor(bi / n) - best + 1) * CELL)], voids100m: voids100, mapped: nMapped, infill: nInfill, fillers: nFill });
}
if (args.includes('--json')) console.log(JSON.stringify(report, null, 1)); else {
  console.log('area                          block ha  built%  empty%  biggest void   100 m voids  mapped  infill  fillers');
  for (const r of report) console.log(r.label.padEnd(30) + String(r.blockHa).padStart(7) + String(r.buildingCoverPct).padStart(8) + String(r.emptyPct).padStart(8) + (r.biggestEmptySquareM + ' m').padStart(11) + String(r.voids100m).padStart(13) + String(r.mapped).padStart(9) + String(r.infill).padStart(8) + String(r.fillers).padStart(9));
  const worst = Math.max(...report.map(r => r.biggestEmptySquareM)); console.log('\nP1 target: biggest empty square under 100 m everywhere. Worst now: ' + worst + ' m' + (worst < 100 ? '  (met)' : '  (not met)'));
}
