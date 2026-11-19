/* Prefetch (city and highway flow): going between the India map and a city reloads the page (the two worlds are different scales), so the other world's files are fetched
   quietly into the browser cache while the player is still on the way. The reload then finds them already on the device and the switch takes a moment, not a download.
   Rules: each file once per page; one at a time; low priority; nothing on a "save data" connection; a failed fetch is forgotten and may be tried again later. Pure browser code. */
const CITY = 'assets/cities/delhi/', INDIA = 'assets/india/';
export const CITY_FILES = [CITY + 'manifest.json', CITY + 'identity.json', CITY + 'landmarks.json', CITY + 'transit.json', CITY + 'graph.json'];           // graph.json is the big one (14.6 MB), last
export const INDIA_FILES = [INDIA + 'skeleton.json', INDIA + 'rails.json', INDIA + 'trains.json', INDIA + 'terrain.json', INDIA + 'terrain.bin.gz'];
const seen = new Set(), queue = []; let busy = false;
const allowed = () => { try { const c = navigator.connection; return !(c && c.saveData); } catch (e) { return true; } };
async function pump() {
  if (busy) return; busy = true;
  while (queue.length) { const u = queue.shift(); try { const r = await fetch(u, { priority: 'low' }); if (r.ok) await r.arrayBuffer(); else seen.delete(u); } catch (e) { seen.delete(u); } }
  busy = false;
}
/* ask for these files to be fetched in the background (a list of paths relative to the page) */
export function prefetch(files) {
  if (typeof fetch !== 'function' || !allowed()) return 0; let n = 0;
  for (const u of files) if (!seen.has(u)) { seen.add(u); queue.push(u); n++; }
  if (n) pump(); return n;
}
