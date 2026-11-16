/* Builds assets/india/trains.json: real Indian train numbers, names and timetables, reduced to the cities of the game (docs/OPEN_DATA.md).
   Source: DataMeet "Indian Railways" (github.com/datameet/railways, CC0), downloaded to data/raw/rail/datameet/ (stations.json, trains.json, schedules.json; collected about 2016, so timings are old).
   Run: node --max-old-space-size=4096 tools/build_india_trains.mjs
   Each station (lat, lon) is matched to the nearest game city within 25 real km; a train keeps the stops that fall in a game city (two stops in the same city merge: first arrival, last departure; at the origin the first departure);
   trains with at least two such cities are kept, famous kinds first (Rajdhani, Shatabdi, Duronto, Vande Bharat, Superfast, Express). Times are minutes after midnight of the train's first day (a day counter is added: 1440 per day).
   The Mumbai suburban lines are written by hand below from public descriptions (first and last train, headways are approximate: see docs/OPEN_DATA.md). Output: { trains: [{ n, name, type, stops: [[cityId, arr, dep]], km }], locals: [...], provenance }. */
import { readFileSync, writeFileSync } from 'node:fs';
import { CITIES } from '../src/world/india_network.js';

const dir = new URL('../data/raw/rail/datameet/', import.meta.url), out = new URL('../assets/india/trains.json', import.meta.url);
const stations = JSON.parse(readFileSync(new URL('stations.json', dir), 'utf8')).features, trains = JSON.parse(readFileSync(new URL('trains.json', dir), 'utf8')).features, sched = JSON.parse(readFileSync(new URL('schedules.json', dir), 'utf8'));
const KM_LAT = 111.2, MAXKM = 25, hav = (a, b) => { const R = Math.PI / 180, dy = (a.lat - b.lat) * KM_LAT, dx = (a.lon - b.lon) * 111.2 * Math.cos(((a.lat + b.lat) / 2) * R); return Math.hypot(dx, dy); };
const codeCity = new Map(); for (const f of stations) { const [lon, lat] = (f.geometry && f.geometry.coordinates) || []; if (!Number.isFinite(lat)) continue; let best = null, bd = MAXKM; for (const c of CITIES) { const d = hav({ lat, lon }, c); if (d < bd) { bd = d; best = c.id; } } if (best) codeCity.set(f.properties.code, best); }
const info = new Map(trains.map(f => [f.properties.number, f.properties])), byTrain = new Map(); for (const r of sched) { let l = byTrain.get(r.train_number); if (!l) byTrain.set(r.train_number, l = []); l.push(r); }
const mins = t => { if (!t || t === 'None') return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const kindRank = (name, type) => { const s = (name + ' ' + type).toLowerCase(); return /rajdhani/.test(s) ? 0 : /vande/.test(s) ? 0 : /shatabdi/.test(s) ? 1 : /duronto/.test(s) ? 1 : /garib|tejas|humsafar/.test(s) ? 2 : /superfast|sf\b|\bsf/.test(s) || type === 'Sup' ? 3 : 4; };
const list = [];
for (const [num, rows] of byTrain) {
  const meta = info.get(num); if (!meta) continue; rows.sort((a, b) => a.id - b.id); const stops = [];
  for (const r of rows) { const city = codeCity.get(r.station_code); if (!city) continue; const base = (r.day - 1) * 1440, arr = mins(r.arrival), dep = mins(r.departure), a = arr === null ? null : base + arr, d = dep === null ? null : base + dep, last = stops[stops.length - 1];
    if (last && last[0] === city) { if (d !== null && stops.length > 1) last[2] = d; } else stops.push([city, a === null ? d : a, d === null ? a : d]); }
  if (stops.length < 2 || stops.every(s => s[1] === null)) continue; const type = meta.type || '', name = meta.name || ''; if (/passenger|memu|demu|special/i.test(name) && stops.length < 3) continue;
  list.push({ n: num, name, type, stops, km: meta.distance || 0, rank: kindRank(name, type) });
}
list.sort((a, b) => a.rank - b.rank || b.stops.length - a.stops.length || b.km - a.km); const keep = list.slice(0, 700).map(({ rank, ...t }) => t);
const nameOf = Object.fromEntries(CITIES.map(c => [c.id, c.name]));
/* Mumbai suburban lines (written by hand): stops in order, the real station names, minutes of running time between them; first and last trains and headways are approximate */
const locals = [
  { id: 'WR', name: 'Western Line', kind: 'Churchgate to Virar', first: 4 * 60 + 5, last: 24 * 60 + 50, peak: 4, off: 8, stops: ['Churchgate', 'Marine Lines', 'Mumbai Central', 'Dadar', 'Bandra', 'Andheri', 'Borivali', 'Bhayandar', 'Vasai Road', 'Virar'], runMin: [3, 6, 5, 6, 8, 12, 9, 12, 8], livery: 'emu_wr' },
  { id: 'CR', name: 'Central Line', kind: 'CSMT to Kalyan', first: 4 * 60, last: 24 * 60 + 40, peak: 5, off: 10, stops: ['CSMT', 'Byculla', 'Dadar', 'Kurla', 'Ghatkopar', 'Thane', 'Dombivli', 'Kalyan'], runMin: [6, 6, 12, 7, 15, 14, 9], livery: 'emu_cr' },
  { id: 'HB', name: 'Harbour Line', kind: 'CSMT to Panvel', first: 4 * 60 + 15, last: 24 * 60 + 15, peak: 8, off: 15, stops: ['CSMT', 'Wadala Road', 'Kurla', 'Chembur', 'Vashi', 'Nerul', 'Panvel'], runMin: [14, 10, 8, 14, 6, 14], livery: 'emu_cr' },
];
writeFileSync(out, JSON.stringify({ version: 1, trains: keep, locals, cities: nameOf, provenance: 'Train numbers, names and timetables: DataMeet Indian Railways data (CC0, github.com/datameet/railways), collected about 2016 and reduced to the cities of the game; Mumbai suburban lines written by hand from public descriptions, approximate.' }));
const kinds = {}; for (const t of keep) kinds[t.name.match(/Rajdhani|Shatabdi|Duronto|Vande|Superfast|Express|Mail|Passenger/i)?.[0] || 'other'] = (kinds[t.name.match(/Rajdhani|Shatabdi|Duronto|Vande|Superfast|Express|Mail|Passenger/i)?.[0] || 'other'] || 0) + 1;
console.log('stations matched', codeCity.size, 'trains with schedules', byTrain.size, '-> kept', keep.length, kinds, 'example', JSON.stringify(keep[0]).slice(0, 300));
