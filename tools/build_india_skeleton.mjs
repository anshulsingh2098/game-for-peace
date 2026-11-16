/* Builds assets/india/skeleton.json: the whole-country road and rail network in game metres (docs/INDIA_MAP_PLAN.md section 9, docs/OPEN_DATA.md).
   Run: node tools/build_india_skeleton.mjs [scale]        (default scale 100: 1 real km = 10 game metres)
   Today it needs no download: it uses the hand-entered cities and corridor lists in src/world/india_network.js. When real alignments are available, put them in
   data/india_waypoints.json (kept out of git) as { "<road id>": [[lat, lon], ...] } and they replace the straight legs; the file's licence (OpenStreetMap: ODbL) must then be
   recorded in assets/ASSETS.md and the provenance text below. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { buildSkeleton, GAME_SCALE } from '../src/world/india_network.js';
const scale = +process.argv[2] || GAME_SCALE, wpFile = new URL('../data/india_waypoints.json', import.meta.url);
const waypoints = existsSync(wpFile) ? JSON.parse(readFileSync(wpFile, 'utf8')) : {};
const sk = buildSkeleton(scale, { waypoints, provenance: Object.keys(waypoints).length ? 'real alignments from data/india_waypoints.json (see assets/ASSETS.md for the licence); city positions entered by hand' : undefined });
const out = new URL('../assets/india/skeleton.json', import.meta.url); writeFileSync(out, JSON.stringify(sk));
console.log(`skeleton at 1:${scale}: ${sk.nodes.length} cities, ${sk.roads.length} roads, ${sk.rails.length} railways; extent ${((sk.bounds.x1 - sk.bounds.x0) / 1000).toFixed(1)} x ${((sk.bounds.z1 - sk.bounds.z0) / 1000).toFixed(1)} game km; ${Math.round(readFileSync(out).length / 1024)} KB`);
