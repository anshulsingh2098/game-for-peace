#!/usr/bin/env node
/* Headless check of a city pack: loads it the way the game will (manifest, graph, a ring of tiles around each spawn), routes between the spawns and landmarks on the street graph,
   and prints what it found. Run: node tools/check_city.mjs [assets/cities/delhi]. Exit code 1 on a failed expectation. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { decodeGraph, decodeTile } from './lib/packio.mjs';
import { Router } from './lib/graphroute.mjs';
import { KeepOut } from '../src/world/keepout.js';

export function loadPack(dir) {
  const M = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')), G = decodeGraph(JSON.parse(readFileSync(path.join(dir, 'graph.json'), 'utf8')));
  const L = JSON.parse(readFileSync(path.join(dir, 'landmarks.json'), 'utf8')).landmarks;
  const tile = (tx, tz) => { try { return decodeTile(JSON.parse(readFileSync(path.join(dir, 'tiles', tx + '_' + tz + '.json'), 'utf8')), M.tileSize); } catch { return null; } };
  return { M, G, L, tile };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const dir = path.resolve(process.argv[2] || 'assets/cities/delhi'), { M, G, L, tile } = loadPack(dir), fails = [], t0 = Date.now(), R = new Router(G);
  console.log(`pack ${M.id}: ${G.nodes.length} nodes, ${G.edges.length} edges, ${M.tiles.length} tiles, ${L.length} landmarks; router ready in ${Date.now() - t0} ms; main drive network ${R.main.drive.size} of ${G.nodes.length} nodes`);
  const at = id => (M.spawns.find(s => s.id === id) || L.find(l => l.id === id));
  for (const [a, b, lo, hi] of [['centre', 'india-gate', 1500, 6000], ['centre', 'red-fort', 3000, 9000], ['centre', 'igi', 12000, 30000], ['redfort', 'qutub', 14000, 40000]]) {
    const A = at(a), B = at(b), na = R.nearest(A.x, A.z), nb = R.nearest(B.x, B.z), r = na && nb && R.route(na.node, nb.node);
    console.log(`drive ${a} -> ${b}: ${r ? (r.metres / 1000).toFixed(1) + ' km, ' + (r.seconds / 60).toFixed(0) + ' min' : 'NO ROUTE'} (start snapped ${na && na.d.toFixed(0)} m, end ${nb && nb.d.toFixed(0)} m)`);
    if (!r || r.metres < lo || r.metres > hi) fails.push(`route ${a} -> ${b} out of range`);
  }
  // load the tiles around the centre spawn into a registry like the game will
  const c = at('centre'), ko = new KeepOut(); let n = 0, nb = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const t = tile(Math.floor(c.x / M.tileSize) + dx, Math.floor(c.z / M.tileSize) + dz); if (!t) continue; for (const s of t.streets) { const e = G.edges[s.id]; if (e[8] === 0 && ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential'].includes(e[3])) { ko.add('s' + s.id, 'road', { t: 'line', pts: s.pts.slice(0, 4), hw: 3 }); n++; } } nb += t.buildings.length; }
  console.log(`3x3 tiles around ${M.spawns.find(s => s.id === 'centre').name}: ${nb} buildings, ${n} street claims in the registry (${ko.size} entries)`);
  if (!nb) fails.push('no buildings around the centre');
  for (const f of fails) console.log('FAIL:', f); console.log(fails.length ? 'check failed' : 'check passed'); process.exit(fails.length ? 1 : 0);
}
