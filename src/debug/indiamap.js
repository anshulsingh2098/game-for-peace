/* india_map.html: draws the schematic network of src/world/india_network.js (our own coordinates, no map data) and plans a route between two clicked cities.
   Highways: orange = Golden Quadrilateral, red = North-South, green = East-West, grey = other national highways; railways: blue dashed. The coastline is a rough sketch, not a boundary. */
import { CITIES, CITY, HIGHWAYS, RAIL, COAST, roadGraph, shortestRoute, routeKm, gameKm, driveMinutes, fromGame } from '../world/india_network.js';
const cv = document.getElementById('c'), x = cv.getContext('2d'), info = document.getElementById('info'), $ = id => document.getElementById(id), graph = roadGraph();
const KIND = { gq: '#f5a623', ns: '#e8503a', ew: '#3cc46a', nh: '#8a97ad' };
let W = 0, H = 0, pick = [], route = null, skeleton = null;
fetch('assets/india/skeleton.json').then(r => r.json()).then(j => { skeleton = j; draw(); }).catch(() => {});          // the real road shapes (OpenStreetMap-derived waypoints), when the file is there
const LAT0 = 6.5, LAT1 = 35.5, LON0 = 67.5, LON1 = 97.5, K = Math.cos(22 * Math.PI / 180);
function size() { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; W = cv.width = Math.round(r.width * d); H = cv.height = Math.round(r.height * d); draw(); }
function project(lat, lon) { const sx = W / ((LON1 - LON0) * K), sy = H / (LAT1 - LAT0), s = Math.min(sx, sy) * 0.96, ox = (W - (LON1 - LON0) * K * s) / 2, oy = (H - (LAT1 - LAT0) * s) / 2; return [ox + (lon - LON0) * K * s, oy + (LAT1 - lat) * s, s]; }
function line(ids, color, w, dash) { x.strokeStyle = color; x.lineWidth = w; x.setLineDash(dash || []); x.beginPath(); ids.forEach((id, i) => { const [px, py] = project(CITY[id].lat, CITY[id].lon); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); x.setLineDash([]); }
function pts(arr, color, w, dash) { x.strokeStyle = color; x.lineWidth = w; x.setLineDash(dash || []); x.beginPath(); for (let i = 0; i < arr.length; i += 2) { const g = fromGame(arr[i], arr[i + 1]), [px, py] = project(g.lat, g.lon); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); x.setLineDash([]); }
function draw() {
  x.clearRect(0, 0, W, H); const d = dpr(); x.lineJoin = 'round';
  x.strokeStyle = '#2b3a58'; x.lineWidth = 2 * d; x.beginPath(); COAST.forEach(([la, lo], i) => { const [px, py] = project(la, lo); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
  if ($('rl').checked) for (const r of RAIL) line(r.cities, '#38bdf8', 2.2 * d, [8 * d, 5 * d]);
  if ($('hw').checked) { const draw1 = (h, c, w) => { const r = skeleton && skeleton.roads.find(q => q.id === h.id); r ? pts(r.pts, c, w) : line(h.cities, c, w); }; for (const h of HIGHWAYS) if (h.kind === 'nh') draw1(h, KIND.nh, 1.4 * d); for (const h of HIGHWAYS) if (h.kind !== 'nh') draw1(h, KIND[h.kind], 3.2 * d); }
  if (route) line(route.cities, '#ffffff', 5 * d);
  const mi = $('mi').checked; x.textBaseline = 'middle';
  for (const c of CITIES) { const big = c.tier === 'metro' || c.tier === 'major'; if (!big && c.tier !== 'city' && !mi) continue; const [px, py] = project(c.lat, c.lon), r = (c.tier === 'metro' ? 6 : c.tier === 'major' ? 4.5 : 3) * d, on = pick.includes(c.id);
    x.fillStyle = on ? '#ffd60a' : big ? '#fff' : '#b8c4d9'; x.beginPath(); x.arc(px, py, r, 0, 6.3); x.fill(); x.strokeStyle = '#0e1522'; x.lineWidth = d; x.stroke();
    if (big || on || mi) { x.font = (big ? 600 : 400) + ' ' + (c.tier === 'metro' ? 14 : 12) * d + 'px system-ui'; x.fillStyle = on ? '#ffd60a' : '#e6edf7'; x.fillText(c.name, px + r + 4 * d, py); } }
}
const dpr = () => devicePixelRatio || 1;
function near(e) { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1, mx = (e.clientX - r.left) * d, my = (e.clientY - r.top) * d; let best = null, bd = 18 * d; for (const c of CITIES) { const [px, py] = project(c.lat, c.lon), dd = Math.hypot(px - mx, py - my); if (dd < bd) { bd = dd; best = c; } } return best; }
cv.addEventListener('click', e => {
  const c = near(e); if (!c) { pick = []; route = null; info.textContent = 'Click a city, then another, to see the shortest road route.'; draw(); return; }
  if (pick.length >= 2) pick = []; pick.push(c.id); route = null;
  if (pick.length === 2) { const r = shortestRoute(pick[0], pick[1], graph), sc = +$('sc').value || 100; route = r;
    info.textContent = r ? CITY[pick[0]].name + ' to ' + CITY[pick[1]].name + ': ' + Math.round(r.km) + ' km by road, via ' + r.cities.map(i => CITY[i].name).join(', ') + '. At 1:' + sc + ' that is ' + gameKm(r.km, sc).toFixed(0) + ' game km, about ' + Math.round(driveMinutes(gameKm(r.km, sc))) + ' min at 100 km/h.' : 'No road route found.'; }
  else info.textContent = c.name + ' (' + c.state + ', ' + c.tier + (c.tags.length ? ', ' + c.tags.join(' ') : '') + '). Click a second city.';
  draw();
});
for (const id of ['hw', 'rl', 'mi', 'sc']) $(id).addEventListener('input', () => { draw(); });
addEventListener('resize', size); size();
window.__india = { CITIES, HIGHWAYS, RAIL, routeKm };
