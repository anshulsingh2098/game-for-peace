/* Builds assets/india/skeleton.json: the whole-country road and rail network in game metres (docs/INDIA_MAP_PLAN.md section 9, docs/OPEN_DATA.md).
   Run: node tools/build_india_skeleton.mjs [scale]        (default scale 100: 1 real km = 10 game metres)
   It uses the hand-entered cities and corridor lists in src/world/india_network.js and, when assets/india/waypoints.json exists (tools/fetch_india_routes.mjs, OpenStreetMap data, ODbL), the real alignments of the roads in place of straight legs. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { buildSkeleton, GAME_SCALE } from '../src/world/india_network.js';
const scale = +process.argv[2] || GAME_SCALE, wpFile = new URL('../assets/india/waypoints.json', import.meta.url);
const wpData = existsSync(wpFile) ? JSON.parse(readFileSync(wpFile, 'utf8')) : null, waypoints = wpData ? wpData.roads : {};
const sk = buildSkeleton(scale, { waypoints, provenance: Object.keys(waypoints).length ? 'road paths follow simplified OpenStreetMap-derived driving routes (' + wpData.meta.credit + ', ' + wpData.meta.licence + '); railways and city positions entered by hand' : undefined });
const out = new URL('../assets/india/skeleton.json', import.meta.url); writeFileSync(out, JSON.stringify(sk));
console.log(`skeleton at 1:${scale}: ${sk.nodes.length} cities, ${sk.roads.length} roads, ${sk.rails.length} railways; extent ${((sk.bounds.x1 - sk.bounds.x0) / 1000).toFixed(1)} x ${((sk.bounds.z1 - sk.bounds.z0) / 1000).toFixed(1)} game km; ${Math.round(readFileSync(out).length / 1024)} KB`);
