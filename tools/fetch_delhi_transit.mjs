// Fetch the raw OpenStreetMap transit data for Delhi NCR from the Overpass API into data/raw/delhi_transit/ (git-ignored).
// Run: node tools/fetch_delhi_transit.mjs [name ...]      (no names = all queries, skips files that already exist)
// Licence of the data: ODbL (c) OpenStreetMap contributors. Log of what was downloaded: docs/OPEN_DATA.md.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), out = path.join(root, 'data/raw/delhi_transit');
fs.mkdirSync(out, { recursive: true });
const NCR = '28.30,76.85,28.95,77.60';   // S,W,N,E: Delhi, Gurugram, Faridabad, Noida, Greater Noida, Ghaziabad, Bahadurgarh
const DELHI = '28.40,76.95,28.90,77.45';
const Q = {
  metro_routes: `[out:json][timeout:300];rel["route"~"^(subway|light_rail|train|monorail)$"](${NCR});out geom;`,
  metro_route_masters: `[out:json][timeout:120];rel["route_master"~"^(subway|light_rail|train|monorail)$"](${NCR});out body;`,
  stations: `[out:json][timeout:240];(nwr["railway"~"^(station|halt|stop)$"](${NCR});nwr["public_transport"="station"](${NCR});nwr["station"~"^(subway|light_rail)$"](${NCR});nwr["railway"="subway_entrance"](${NCR}););out center tags;`,
  platforms: `[out:json][timeout:240];(nwr["railway"="platform"](${NCR});nwr["public_transport"="platform"]["train"="yes"](${NCR});nwr["public_transport"="platform"]["subway"="yes"](${NCR});nwr["public_transport"="platform"]["light_rail"="yes"](${NCR}););out geom tags;`,
  depots: `[out:json][timeout:240];(nwr["railway"~"^(depot|yard|workshop)$"](${NCR});nwr["landuse"="railway"]["name"](${NCR});nwr["building"="train_station"](${NCR});nwr["name"~"[Dd]epot|[Yy]ard"]["railway"](${NCR}););out center tags;`,
  metro_ways: `[out:json][timeout:300];way["railway"~"^(subway|light_rail|monorail|narrow_gauge)$"](${NCR});out geom tags;`,
  rail_ways: `[out:json][timeout:300];way["railway"~"^(rail|preserved|construction|proposed)$"](${DELHI});out geom tags;`,
  rail_station_detail: `[out:json][timeout:300];node["railway"="station"]["ref"~"^(NDLS|DLI|NZM|ANVT|DEE|DEC|DSA|SZM|DKZ|TKJ|OKA|DSJ|DAZ|ANDI)$"](${DELHI})->.s;(way(around.s:450)["building"~"^(train_station|roof|transportation|public|civic)$"];way(around.s:450)["railway"="station"];way(around.s:450)["highway"~"^(footway|steps|pedestrian|corridor)$"]["bridge"="yes"];way(around.s:450)["highway"="footway"]["tunnel"="yes"];way(around.s:450)["highway"~"^(footway|steps)$"]["conveying"];node(around.s:450)["entrance"];node(around.s:450)["railway"="subway_entrance"];way(around.s:450)["amenity"~"^(bus_station|taxi|parking)$"];);out geom tags;`,
  bus_routes: `[out:json][timeout:300];rel["route"="bus"](${NCR});out tags;`,
  bus_route_members: `[out:json][timeout:300];rel["route"="bus"](${NCR});out body;`,
  bus_member_nodes: `[out:json][timeout:300];rel["route"="bus"](${NCR});node(r);out;`,
  bus_stops: `[out:json][timeout:300];(nwr["highway"="bus_stop"](${DELHI});nwr["amenity"="bus_station"](${NCR});nwr["public_transport"="station"]["bus"="yes"](${NCR}););out center tags;`,
  bus_depots: `[out:json][timeout:200];(nwr["amenity"="bus_station"](${NCR});nwr["name"~"[Dd]epot"]["amenity"~"bus|depot"](${NCR});nwr["name"~"DTC|ISBT|Bus Terminal|Bus Depot"](${NCR}););out center tags;`,
};
const URLS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const want = process.argv.slice(2), names = want.length ? want : Object.keys(Q);
for (const n of names) {
  const f = path.join(out, n + '.json'); if (fs.existsSync(f) && fs.statSync(f).size > 100) { console.log('have', n); continue; }
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = URLS[attempt % URLS.length];
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'GameForPeace-city-pipeline/0.1 (open-source driving game)' }, body: 'data=' + encodeURIComponent(Q[n]) });
      const t = await r.text();
      if (!r.ok || !t.trim().startsWith('{') || /"remark".*(timed out|runtime error)/i.test(t.slice(0, 600))) throw new Error(r.status + ' ' + t.slice(0, 120).replace(/\s+/g, ' '));
      fs.writeFileSync(f, t); console.log('ok', n, (t.length / 1e6).toFixed(2) + ' MB', url); break;
    } catch (e) { console.log('retry', n, attempt, String(e.message).slice(0, 160)); await new Promise(r => setTimeout(r, 15000 * (attempt + 1))); }
  }
  await new Promise(r => setTimeout(r, 5000));
}
