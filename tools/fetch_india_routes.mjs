/* Fetches the real driving alignment of each highway in src/world/india_network.js from the public OSRM demo server (router.project-osrm.org), which routes over OpenStreetMap data,
   and writes assets/india/waypoints.json ({ meta, roads: { "<road id>": [[lat, lon], ...] } }) for tools/build_india_skeleton.mjs. The file is small (about 60 KB) and is committed, with its credit.
   Run: node tools/fetch_india_routes.mjs        (about 30 requests, one every 1.2 s: please keep it that polite)
   LICENCE: the result is derived from OpenStreetMap data, © OpenStreetMap contributors, ODbL 1.0 (docs/OPEN_DATA.md). The file and the skeleton built from it are committed with their credit in assets/ASSETS.md; the game must show the OpenStreetMap credit in the game. Nothing is fetched at run time by the game. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { HIGHWAYS, CITY, routeKm } from '../src/world/india_network.js';
const sleep = ms => new Promise(r => setTimeout(r, ms)), out = {}, report = [];
mkdirSync(new URL('../assets/india/', import.meta.url), { recursive: true });
for (const h of HIGHWAYS) {
  const coords = h.cities.map(id => CITY[id].lon + ',' + CITY[id].lat).join(';'), url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=simplified&geometries=geojson&continue_straight=true`;
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    try { const res = await fetch(url, { headers: { 'User-Agent': 'game-for-peace-build-tool/1.0' } }); const j = await res.json();
      if (j.code === 'Ok' && j.routes[0]) { const r = j.routes[0]; out[h.id] = r.geometry.coordinates.map(([lon, lat]) => [Math.round(lat * 1e4) / 1e4, Math.round(lon * 1e4) / 1e4]); report.push(`${h.id.padEnd(24)} ${String(Math.round(r.distance / 1000)).padStart(5)} km real, ours ${String(Math.round(routeKm(h.cities))).padStart(5)} km, ${out[h.id].length} points`); ok = true; }
      else report.push(`${h.id}: ${j.code} ${j.message || ''}`); } catch (e) { report.push(`${h.id}: ${e.message}`); }
    await sleep(1200);
  }
}
const meta = { source: 'OSRM public demo server (router.project-osrm.org), routing over OpenStreetMap data', credit: '© OpenStreetMap contributors', licence: 'ODbL 1.0 (https://www.openstreetmap.org/copyright)', fetched: new Date().toISOString().slice(0, 10), tool: 'tools/fetch_india_routes.mjs', note: 'simplified driving routes through the cities of each highway in src/world/india_network.js; waypoints, not surveyed alignments' };
writeFileSync(new URL('../assets/india/waypoints.json', import.meta.url), JSON.stringify({ meta, roads: out }));
console.log(report.join('\n')); console.log(`${Object.keys(out).length} of ${HIGHWAYS.length} highways fetched`);
