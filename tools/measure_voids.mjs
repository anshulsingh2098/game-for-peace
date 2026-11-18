/* Measures the grey voids left inside built-up blocks after the infill (Phase P1 of docs/DELHI_POLISH_PLAN.md).
   Run: node tools/measure_voids.mjs [--json]
   For five sample areas (Chandni Chowk, Karol Bagh, Connaught Place, Khan Market, Lajpat Nagar) it takes the tiles within 1 km of the area's centre, builds the infill exactly as the game does,
   and cuts the tile into 100 m x 100 m cells. A cell is "in a block" when its centre lies in a non-park block; it is a VOID when it is in a block, holds no park or water, and the mapped buildings
   plus infill cover under 3 % of it; "still bare after the paved yards" also counts a void as filled when paved yards cover 10 % of it or more. The target of P1 is no void cell in the sample areas.
   Prints per area: block cells, void cells, coverage of the block cells, and the first void cells with game x, z. */
import fs from 'node:fs';
import { decodeTile, decodeGraphColumns, pieceWidth } from '../src/world/city/pack.js';
import { infillBuildings } from '../src/world/city/infill.js';
import { Identity } from '../src/world/city/identity.js';

const base = new URL('../assets/cities/delhi', import.meta.url).pathname, man = JSON.parse(fs.readFileSync(base + '/manifest.json')), S = man.tileSize;
const G = decodeGraphColumns(JSON.parse(fs.readFileSync(base + '/graph.json'))), ident = new Identity(JSON.parse(fs.readFileSync(base + '/identity.json')), man.origin);
const AREAS = { 'Chandni Chowk': [2065, -4717], 'Karol Bagh': [-1855, -3569], 'Connaught Place': [1045, -2102], 'Khan Market': [1712, 1517], 'Lajpat Nagar': [3104, 4993] };
const SKIP = new Set(['park', 'garden', 'forest', 'farmland', 'cemetery', 'religious', 'grass', 'recreation_ground', 'water', 'meadow', 'allotments']);
const pip = (r, x, z) => { let c = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { if ((r[i + 1] > z) !== (r[j + 1] > z) && x < (r[j] - r[i]) * (z - r[i + 1]) / (r[j + 1] - r[i + 1]) + r[i]) c = !c; } return c; };
const CELL = 100, SUB = 10;       // a cell is sampled on a 10 x 10 grid: a sample is covered when it lies in a building

const out = {};
for (const [name, [cx, cz]] of Object.entries(AREAS)) {
  const tiles = [];
  for (let tx = Math.floor((cx - 1000) / S); tx <= Math.floor((cx + 1000) / S); tx++) for (let tz = Math.floor((cz - 1000) / S); tz <= Math.floor((cz + 1000) / S); tz++) {
    const f = `${base}/tiles/${tx}_${tz}.json`; if (!fs.existsSync(f)) continue;
    const t = decodeTile(JSON.parse(fs.readFileSync(f, 'utf8')), S), inf = infillBuildings(t, { size: S, G, widthOf: s => pieceWidth(G, s), styleAt: (x, z) => ident.areaNameAt(x, z) });
    tiles.push({ t, blds: [...(t.buildings || []).map(b => b.ring), ...inf.map(b => b.ring)], yards: (inf.yards || []).map(y => [y[0], y[1], y[2], y[1], y[2], y[3], y[0], y[3]]), blocks: (t.blocks || []).filter(b => !SKIP.has(b.landuse)).map(b => b.ring), open: [...(t.parks || []), ...(t.water || [])].map(p => p.ring) });
  }
  let cells = 0, voids = 0, voidsPaved = 0, covered = 0, total = 0; const list = [];
  for (let gx = Math.floor((cx - 1000) / CELL); gx < Math.floor((cx + 1000) / CELL); gx++) for (let gz = Math.floor((cz - 1000) / CELL); gz < Math.floor((cz + 1000) / CELL); gz++) {
    const x0 = gx * CELL, z0 = gz * CELL, T = tiles.find(q => q.t.tx === Math.floor((x0 + 50) / S) && q.t.tz === Math.floor((z0 + 50) / S)); if (!T) continue;
    if (!T.blocks.some(r => pip(r, x0 + 50, z0 + 50)) || T.open.some(r => pip(r, x0 + 50, z0 + 50))) continue;
    let n = 0; for (let a = 0; a < SUB; a++) for (let b = 0; b < SUB; b++) { const x = x0 + (a + 0.5) * CELL / SUB, z = z0 + (b + 0.5) * CELL / SUB; if (T.blds.some(r => pip(r, x, z))) n++; }
    cells++; covered += n; total += SUB * SUB; if (n < SUB * SUB * 0.03) { voids++; let py = 0; for (let a = 0; a < SUB; a++) for (let b = 0; b < SUB; b++) { const x = x0 + (a + 0.5) * CELL / SUB, z = z0 + (b + 0.5) * CELL / SUB; if (T.yards.some(r => pip(r, x, z))) py++; } if (n + py < SUB * SUB * 0.03 + SUB * SUB * 0.10) { voidsPaved++; list.push([Math.round(x0 + 50), Math.round(z0 + 50)]); } }
  }
  out[name] = { blockCells: cells, voidCells: voids, voidCellsAfterYards: voidsPaved, coverage: +(covered / Math.max(1, total)).toFixed(3), firstVoids: list.slice(0, 5) };
}
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else for (const [k, v] of Object.entries(out)) console.log(k.padEnd(16), 'block cells', String(v.blockCells).padStart(4), ' void cells', String(v.voidCells).padStart(4), ' (' + v.voidCellsAfterYards + ' still bare after the paved yards)', ' coverage', (v.coverage * 100).toFixed(1) + '%', v.voidCells ? ' first voids (x,z): ' + v.firstVoids.map(p => p.join(',')).join(' ') : '');
