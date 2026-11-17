/* Measures the two costs the audit worried about (R09), on this machine: how long it takes to read and decode the Delhi street graph, and how long city routes take on the main thread.
   Usage: node tools/measure_city.mjs        (read only; prints numbers; compare against the frame budget: 16 ms at 60 fps)
   A desktop number is a floor, not a phone number: run the same measurement in the phone's browser before moving the work into a worker. */
import { readFileSync } from 'node:fs';
import { decodeGraphColumns } from '../src/world/city/pack.js';
import { CityRouter } from '../src/world/city/citynav.js';
const dir = new URL('../assets/cities/delhi/', import.meta.url).pathname, ms = (t) => (performance.now() - t).toFixed(1) + ' ms';
let t = performance.now(); const text = readFileSync(dir + 'graph.json', 'utf8'); console.log(`read graph.json: ${(text.length / 1e6).toFixed(1)} MB, ${ms(t)}`);
t = performance.now(); const json = JSON.parse(text); console.log(`JSON.parse: ${ms(t)}  (a single main-thread block in the browser)`);
t = performance.now(); const G = decodeGraphColumns(json); console.log(`decodeGraphColumns: ${ms(t)}  (${G.n} edges, ${G.nodes} nodes)`);
t = performance.now(); const R = new CityRouter(G); console.log(`CityRouter build: ${ms(t)}`);
const M = JSON.parse(readFileSync(dir + 'manifest.json', 'utf8')), b = M.bounds || M.bbox || null;
const xz = G.xz; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (let i = 0; i < G.nodes; i++) { const x = xz[2 * i], z = xz[2 * i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
const pairs = [[0.5, 0.5, 0.5, 0.5], [0.1, 0.1, 0.9, 0.9], [0.1, 0.9, 0.9, 0.1], [0.2, 0.5, 0.8, 0.5], [0.5, 0.1, 0.5, 0.9]];
const at = (u, v) => [x0 + (x1 - x0) * u, z0 + (z1 - z0) * v]; let worst = 0;
for (const [a, b2, c, d] of pairs) { const [ax, az] = at(a, b2), [bx, bz] = at(c, d); t = performance.now(); const r = R.route(ax, az, bx, bz); const e = performance.now() - t; worst = Math.max(worst, e); console.log(`route (${a},${b2}) to (${c},${d}): ${e.toFixed(1)} ms, ${r ? (r.length || r.dist || '') : 'no route'}`); }
console.log(`worst route ${worst.toFixed(1)} ms`);
