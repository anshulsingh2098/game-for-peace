// Build assets/cities/delhi/transit.json (metro, railway stations, buses) from the raw OpenStreetMap files in data/raw/delhi_transit/
// (fetched by tools/fetch_delhi_transit.mjs), cross-checked with Wikipedia (list of stations: layout, platform type, opening date) and Wikidata (CC0 names).
// Run: node tools/build_delhi_transit.mjs      Deterministic: same raw files, same bytes. Schema: docs/CITY_PACK.md section 5 (transit.json, format 1).
// Data: (c) OpenStreetMap contributors, ODbL 1.0; Wikidata CC0; Wikipedia facts CC BY-SA. See docs/OPEN_DATA.md and docs/DELHI_TRANSIT.md.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { TRANSIT_BUILDER_VERSION, project, r1, dist, nearestOnPath, pathLength, simplify, routeThrough, norm, ORIGIN, R_EARTH } from './lib_transit.mjs';
import { parseWikiList } from './lib_wikilist.mjs';
const BUILDER = { name: 'build_delhi_transit', version: TRANSIT_BUILDER_VERSION };
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), RAW = path.join(root, 'data/raw/delhi_transit'), OUT = path.join(root, 'assets/cities/delhi/transit.json');
const rd = f => JSON.parse(fs.readFileSync(path.join(RAW, f)));
const report = { warnings: [] }; const warn = m => report.warnings.push(m);

/* ---------- line table: what OSM does not say (names in Hindi: DMRC's own; gauge and cars from Wikipedia, see docs/DELHI_TRANSIT.md) ---------- */
const LINES = {
  red:      { ref: '1', name: { en: 'Red Line', hi: 'रेड लाइन' }, colour: '#FF4040', operator: 'DMRC', network: 'Delhi Metro' },
  yellow:   { ref: '2', name: { en: 'Yellow Line', hi: 'येलो लाइन' }, colour: '#FFDF00', operator: 'DMRC', network: 'Delhi Metro' },
  blue:     { ref: '3/4', name: { en: 'Blue Line', hi: 'ब्लू लाइन' }, colour: '#4169E1', operator: 'DMRC', network: 'Delhi Metro' },
  green:    { ref: '5', name: { en: 'Green Line', hi: 'ग्रीन लाइन' }, colour: '#008000', operator: 'DMRC', network: 'Delhi Metro' },
  violet:   { ref: '6', name: { en: 'Violet Line', hi: 'वायलेट लाइन' }, colour: '#553592', operator: 'DMRC', network: 'Delhi Metro' },
  pink:     { ref: '7', name: { en: 'Pink Line', hi: 'पिंक लाइन' }, colour: '#FC8EAC', operator: 'DMRC', network: 'Delhi Metro' },
  magenta:  { ref: '8', name: { en: 'Magenta Line', hi: 'मैजेंटा लाइन' }, colour: '#CC338B', operator: 'DMRC', network: 'Delhi Metro' },
  grey:     { ref: '9', name: { en: 'Grey Line', hi: 'ग्रे लाइन' }, colour: '#838996', operator: 'DMRC', network: 'Delhi Metro' },
  airport:  { ref: 'AEx', name: { en: 'Airport Express (Orange Line)', hi: 'एयरपोर्ट एक्सप्रेस लाइन' }, colour: '#FF8C00', operator: 'DMRC', network: 'Delhi Metro' },
  aqua:     { ref: 'Aqua', name: { en: 'Aqua Line (Noida Metro)', hi: 'एक्वा लाइन' }, colour: '#00B7C3', operator: 'NMRC', network: 'Noida Metro', colourNote: 'OSM says "aqua"; hex chosen here, not from a source' },
  rapid:    { ref: 'RMGL', name: { en: 'Rapid Metro Gurgaon', hi: 'रैपिड मेट्रो गुड़गांव' }, colour: '#808080', operator: 'Rapid Metro Gurgaon', network: 'Rapid Metro Gurgaon', colourNote: 'OSM says "gray"' },
};
const WIKI_GAUGE = { red: '1676', yellow: '1676', blue: '1676', green: '1435', violet: '1435', pink: '1435', magenta: '1435', grey: '1435', airport: '1435' }; // Wikipedia (Delhi Metro): Red, Blue, Yellow broad gauge, all newer lines standard gauge
const wikiLine = { Red: 'red', Yellow: 'yellow', Blue: 'blue', Green: 'green', Violet: 'violet', Pink: 'pink', Magenta: 'magenta', Grey: 'grey', 'Airport Express': 'airport' };
const lineOfRelation = t => {
  const n = t.name || '';
  if (t.network === 'Noida Metro') return 'aqua'; if (t.network === 'Rapid Metro Gurgaon') return 'rapid';
  for (const [k, v] of Object.entries({ Red: 'red', Yellow: 'yellow', Blue: 'blue', Green: 'green', Violet: 'violet', Pink: 'pink', Magenta: 'magenta', Grey: 'grey', Airport: 'airport' })) if (n.startsWith(k)) return v;
  return null;
};
/* name differences between OSM and the Wikipedia list (normalised keys) */
const ALIAS = { /* Wikipedia name (normalised) -> spellings OSM uses */
  golfcourse: ['Noida Golf Course'], barakhambaroad: ['Barakhambha Road'], chawribazar: ['Chawri Bazaar'], lalqila: ['Lal Quila'], indiragandhiinternationalairport: ['IGI Airport'],
  newdelhi: ['New Delhi Airport Express Terminal'], iit: ['IIT Delhi'], uttaripitampuraprashantvihar: ['North Pitampura - Prashant Vihar'], badkhalmor: ['Badhkal Mor'], mewlamaharajpur: ['Mewala Maharajpur'], delhicantonment: ['Delhi Cantt'] };

/* ---------- read raw ---------- */
const routes = rd('metro_routes.json').elements.filter(e => e.tags && /^(subway|light_rail)$/.test(e.tags.route) && ['Delhi Metro', 'Noida Metro', 'Rapid Metro Gurgaon'].includes(e.tags.network));
const ways = new Map(rd('metro_ways.json').elements.map(e => [e.id, e]));
const stationsRaw = rd('stations.json').elements; const wd = rd('wikidata.json');
const wiki = parseWikiList(JSON.parse(fs.readFileSync(path.join(RAW, 'wp_List_of_Delhi_Metro_stations.json'))).parse.wikitext);

const gradeOf = t => { if (!t) return 'g'; if (t.tunnel && t.tunnel !== 'no') return 'u'; const l = +t.layer; if (l < 0) return 'u'; if (t.bridge && t.bridge !== 'no') return 'e'; if (l >= 1) return 'e'; return 'g'; };

/* ---------- stations: OSM nodes/ways with railway=station + station=subway/light_rail in the metro networks ---------- */
const METRO_NETS = new Set(['Delhi Metro', 'Noida Metro', 'Rapid Metro Gurgaon', 'Aqua Line', 'Blue Line', 'Pink Line']);
const sCand = stationsRaw.filter(e => e.tags && !e.tags.barrier && e.tags.railway === 'station' && /^(subway|light_rail)$/.test(e.tags.station || '') && (METRO_NETS.has(e.tags.network) || !e.tags.network));
const centre = e => e.type === 'node' ? [e.lat, e.lon] : [e.center.lat, e.center.lon];
let osmSt = sCand.map(e => { const [la, lo] = centre(e), [x, z] = project(la, lo), t = e.tags; return { osm: e.type[0] + e.id, name: t.name, hi: t['name:hi'] || null, ref: t.ref || null, q: t.wikidata || null, net: t.network || null, x, z, tags: t }; });
/* merge records with the same name within 160 m (OSM sometimes maps one station twice: a node and a building way) */
const merged = []; for (const s of osmSt.sort((a, b) => (a.osm < b.osm ? -1 : 1))) {
  const m = merged.find(o => norm(o.name) === norm(s.name) && dist([o.x, o.z], [s.x, s.z]) < 160);   // one building: separate platforms of one interchange that sit further apart stay separate stations joined by a transfer
  if (m) { m.alt.push(s.osm); m.ref = m.ref || s.ref; m.hi = m.hi || s.hi; m.q = m.q || s.q; m.net = m.net || s.net; if (s.osm[0] === 'n' && m.osm[0] === 'w') { m.x = s.x; m.z = s.z; } } else merged.push({ ...s, alt: [] });
}
const HI_RULES = [[/^Noida Sector (\d+)/, 'नोएडा सेक्टर $1'], [/^Sector (\d+)/, 'सेक्टर $1'], [/^DLF Phase (\d)/, 'डीएलएफ फेज $1'], [/^Phase (\d)/, 'फेज $1'], [/^Sultanpur$/, 'सुल्तानपुर'], [/^Moulsari Avenue/, 'मौलसरी एवेन्यू'], [/^Belvedere Towers/, 'बेल्वेडियर टावर्स'], [/^Cyber City/, 'साइबर सिटी'], [/^Sikanderpur/, 'सिकंदरपुर'], [/^Rainbow/, 'रेनबो'], [/^Alpha 1/, 'अल्फा 1'], [/^Delta 1/, 'डेल्टा 1'], [/^GNIDA Office/, 'जीएनआईडीए ऑफिस'], [/^NSEZ/, 'एनएसईजेड'], [/^Pari Chowk/, 'परी चौक'], [/^Knowledge Park II/, 'नॉलेज पार्क II'], [/^Depot/, 'डिपो']];
const genHindi = n => { for (const [re, to] of HI_RULES) if (re.test(n)) return n.replace(re, to).replace(/ (Metro )?Station$/i, ''); return null; };
const cleanName = n => n.replace(/\s*\((?:[A-Za-z ]+ Line)\)\s*$/, '').replace(/\s+(Metro )?Station$/i, '').trim();
const entrances = stationsRaw.filter(e => e.tags && e.tags.railway === 'subway_entrance' && e.type === 'node').map(e => project(e.lat, e.lon));

/* ---------- routes: chain ways, grades, stops ---------- */
const lineRoutes = []; // { line, rel, from, to, pts, grades, stops: [stationIdx], gaps }
const tagStats = {}; // line -> tag -> value -> metres of track carrying it (gauge, electrification, voltage, maxspeed read from the OSM ways)
const addStat = (line, tags, len) => { for (const k of ['gauge', 'electrified', 'voltage', 'maxspeed', 'frequency']) if (tags[k]) { const m = ((tagStats[line] ||= {})[k] ||= {}); m[tags[k]] = (m[tags[k]] || 0) + len; } };
const topTag = (line, k) => { const m = tagStats[line] && tagStats[line][k]; if (!m) return null; return Object.entries(m).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0]; };
for (const rel of routes.sort((a, b) => a.id - b.id)) {
  const line = lineOfRelation(rel.tags); if (!line) { warn('route not mapped to a line: ' + rel.tags.name); continue; }
  const pieces = []; const stopsXZ = [];
  for (const m of rel.members) {
    if (m.type === 'way' && m.geometry) { const w = ways.get(m.ref), g = gradeOf(w && w.tags); const pc = m.geometry.map(p => { const [x, z] = project(p.lat, p.lon); return [x, z, g]; }); pieces.push(pc); if (w && w.tags && !/yard|siding|spur|crossover/.test(w.tags.service || '')) addStat(line, w.tags, pathLength(pc.flatMap(q => [q[0], q[1]]))); }
    else if (m.type === 'node' && /stop/.test(m.role)) stopsXZ.push(project(m.lat, m.lon));
  }
  const { pts, gaps, stopsAt } = routeThrough(pieces, stopsXZ);
  const nm = rel.tags.name.match(/\((.*?)\s*(?:→|=>|->)\s*(.*?)\)/) || rel.tags.name.match(/:\s*(.*?)\s*(?:→|=>|->)\s*(.*)$/) || [];
  lineRoutes.push({ line, rel: rel.id, name: rel.tags.name, from: (nm[1] || '').trim(), to: (nm[2] || '').trim(), pts, gaps, stopsXZ, stopsAt, ref: rel.tags.ref });
}
/* a stop belongs to the nearest metro station of the same network within 400 m */
const netOfLine = l => LINES[l].network;
for (const r of lineRoutes) {
  r.stops = []; for (const p of r.stopsXZ) {
    let b = -1, bd = 400; merged.forEach((s, i) => { const d = dist(p, [s.x, s.z]); const okNet = !s.net || s.net === netOfLine(r.line) || /Line$/.test(s.net); if (d < bd && okNet) { bd = d; b = i; } });
    if (b < 0) warn(`${r.name}: a stop at (${p.map(r1)}) has no station within 400 m`); else if (!r.stops.includes(b)) r.stops.push(b);
  }
}
/* ---------- assemble lines ---------- */
const stationLines = new Map(); // idx -> Set(line)
for (const r of lineRoutes) for (const i of r.stops) { if (!stationLines.has(i)) stationLines.set(i, new Set()); stationLines.get(i).add(r.line); }
const used = merged.map((s, i) => i).filter(i => stationLines.has(i));
const unused = merged.map((s, i) => i).filter(i => !stationLines.has(i)).map(i => merged[i].name);
if (unused.length) warn('OSM metro stations on no route: ' + unused.join(', '));

const idFor = new Map(), seen = new Set();
for (const i of used) { const s = merged[i]; let id = (s.ref || s.name.replace(/[^A-Za-z0-9]+/g, '').slice(0, 6)).toUpperCase(); const base = id; let k = 2; while (seen.has(id)) id = base + k++; seen.add(id); idFor.set(i, id); }

const wikiBy = new Map(); for (const w of wiki) { const l = wikiLine[w.line] || w.line; for (const nm of [w.station, w.formerly, ...(ALIAS[norm(w.station)] || [])]) if (nm) wikiBy.set(norm(nm) + '|' + l, w); }
const stationOut = []; let wikiHit = 0, wikiMiss = [];
for (const i of used) {
  const s = merged[i], ls = [...stationLines.get(i)].sort(), per = [];
  for (const l of ls) {
    const w = wikiBy.get(norm(s.name) + '|' + l);
    if (w) { wikiHit++; per.push({ line: l, wikiName: w.station, grade: /under/i.test(w.layout) ? 'underground' : /elev/i.test(w.layout) ? 'elevated' : 'at-grade', layout: /island/i.test(w.platform) ? 'island' : 'side', opened: w.opened }); }
    else { wikiMiss.push(s.name + '/' + l); per.push({ line: l, grade: null, layout: null, opened: null }); }
  }
  const e = entrances.filter(p => dist(p, [s.x, s.z]) < 220).map(p => [r1(p[0]), r1(p[1])]);
  const w = s.q && wd[s.q];
  const cn = cleanName(s.name), wk = per.map(p => p.wikiName).find(n => n && norm(n) !== norm(cn)) || null;
  stationOut.push({ id: idFor.get(i), name: { en: cn, hi: s.hi || (w && w.hi) || genHindi(s.name) }, code: s.ref, x: r1(s.x), z: r1(s.z), lines: ls, per, entrances: e, interchange: ls.length > 1, osm: s.osm, wikidata: s.q, ...(cn !== s.name ? { osmName: s.name } : {}), ...(wk ? { nameNow: wk } : {}), hiSrc: s.hi ? 'osm' : (w && w.hi) ? 'wikidata' : genHindi(s.name) ? 'rule (transliterated by tools/build_delhi_transit.mjs, not checked by a native speaker)' : null });
}
stationOut.sort((a, b) => (a.id < b.id ? -1 : 1));
if (wikiMiss.length) warn('no Wikipedia row for: ' + wikiMiss.join(', '));

/* ---------- grade of each station on each line (from the track geometry: OSM tunnel / bridge / layer tags), compared with Wikipedia ---------- */
const sIndexById = new Map(used.map(i => [idFor.get(i), i]));
const gradeWord = { u: 'underground', e: 'elevated', g: 'at-grade' };
const mismatches = [];
for (const st of stationOut) {
  const i = sIndexById.get(st.id), P = [st.x, st.z];
  for (const per of st.per) {
    const r = lineRoutes.find(r => r.line === per.line && r.stops.includes(i)); if (!r) continue;
    const flat = r.pts.flatMap(p => [p[0], p[1]]), n = nearestOnPath(flat, P), cnt = { u: 0, e: 0, g: 0 }; let acc = 0;
    for (let q = 0; q < r.pts.length; q++) { if (q) acc += dist(r.pts[q - 1], r.pts[q]); if (Math.abs(acc - n.s) <= 100) cnt[r.pts[q][2]]++; }   // majority grade within 100 m along the track
    const g = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
    per.osmGrade = gradeWord[g]; per.railDist = r1(n.d);
    if (per.grade && per.osmGrade !== per.grade) { // Wikipedia wins for the station; the track within 120 m of it is re-graded to match so the platform never floats on the wrong structure
      const w = Object.entries(gradeWord).find(([, v]) => v === per.grade)[0]; let acc = 0; for (let q = 0; q < r.pts.length; q++) { if (q) acc += dist(r.pts[q - 1], r.pts[q]); if (Math.abs(acc - n.s) <= 120) r.pts[q][2] = w; }
      per.osmGradeOverridden = true; }
    if (per.grade && per.osmGrade !== per.grade) mismatches.push(`${st.name.en} (${per.line}): OSM geometry says ${per.osmGrade}, Wikipedia says ${per.grade}`);
    if (!per.grade) per.grade = per.osmGrade, per.gradeSrc = 'osm';
  }
}
if (mismatches.length) warn('grade disagreements (OSM track tags vs Wikipedia list): ' + mismatches.join('; '));

/* ---------- lines ---------- */
const TOL = 1.5;                                                    // metres: Douglas-Peucker tolerance for the shipped track polylines
const lineOut = []; const stationsOfLine = new Map();
for (const lid of Object.keys(LINES)) {
  const rs = lineRoutes.filter(r => r.line === lid).sort((a, b) => a.rel - b.rel); if (!rs.length) { warn('line with no routes: ' + lid); continue; }
  const routesOut = [], seenSt = []; let k = 0;
  for (const r of rs) {
    // twin with the same stops and gaps: reuse the reversed twin when this direction's relation is broken
    const keep = new Set([0, r.pts.length - 1, ...r.stopsAt]); for (let q = 1; q < r.pts.length; q++) if (r.pts[q][2] !== r.pts[q - 1][2]) { keep.add(q - 1); keep.add(q); }
    const idx = simplify(r.pts, TOL, keep), pts = idx.map(q => r.pts[q]), flat = [], grades = []; let last = null, s = 0; const sAt = [0];
    pts.forEach((p, q) => { flat.push(r1(p[0]), r1(p[1])); if (p[2] !== last) { grades.push([q, p[2]]); last = p[2]; } if (q) { s += dist(pts[q - 1], p); sAt.push(s); } });
    const stopIds = r.stops.map(i => idFor.get(i)), stopsS = r.stopsAt.map(a => r1(sAt[idx.indexOf(a)]));
    for (const id of stopIds) if (!seenSt.includes(id)) seenSt.push(id);
    routesOut.push({ id: `${lid}-${++k}`, from: r.from || null, to: r.to || null, osmRelation: r.rel, km: Math.round(s / 10) / 100, path: flat, grades, stops: stopIds.map((id, q) => [id, stopsS[q]]), gaps: r.gaps.length ? r.gaps : undefined });
  }
  const L = LINES[lid]; lineOut.push({ id: lid, mode: 'metro', ref: L.ref, name: L.name, colour: L.colour, colourNote: L.colourNote, operator: L.operator, network: L.network, routes: routesOut, stations: seenSt, track: { gauge: WIKI_GAUGE[lid] || topTag(lid, 'gauge'), osmGauge: topTag(lid, 'gauge'), electrified: topTag(lid, 'electrified'), voltage: topTag(lid, 'voltage'), maxspeed: topTag(lid, 'maxspeed'), src: 'osm ways (longest-length value)' } });
}
/* ---------- depots ---------- */
const depotRaw = rd('depots.json').elements.filter(e => e.tags && e.tags.name && /metro.*depot|depot.*metro|yamuna bank depot|vinod nagar depot|depot station/i.test(e.tags.name) && (e.tags.railway === 'depot' || e.tags.landuse === 'railway' || e.tags.station));
const depots = []; for (const e of depotRaw) {
  if (/Depot Station/.test(e.tags.name)) continue; const [la, lo] = e.center ? [e.center.lat, e.center.lon] : [e.lat, e.lon], [x, z] = project(la, lo), nm = e.tags.name.replace(/ Metro( Rail)? Depot| Depot/i, '').trim() + ' depot';
  if (depots.some(d => d.name.en === nm)) continue;
  let best = null; for (const L of lineOut) for (const r of L.routes) { const n = nearestOnPath(r.path, [x, z]); if (!best || n.d < best.d) best = { d: n.d, line: L.id }; }
  depots.push({ id: 'depot-' + nm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-depot$/, ''), name: { en: nm, hi: null }, x: r1(x), z: r1(z), osm: e.type[0] + e.id, nearestLine: best && best.d < 3000 ? best.line : null, railDist: best ? r1(best.d) : null });
}
depots.sort((a, b) => (a.id < b.id ? -1 : 1));
/* ---------- transfers on foot between stations of different networks that sit close together ---------- */
const transfers = []; for (let a = 0; a < stationOut.length; a++) for (let b = a + 1; b < stationOut.length; b++) { const A = stationOut[a], B = stationOut[b], d = dist([A.x, A.z], [B.x, B.z]); if (d < 450 && !A.lines.some(l => B.lines.includes(l))) transfers.push([A.id, B.id, Math.round(d)]); }

/* ================= railway stations (Indian Railways / Delhi Suburban) ================= */
const NCR_EAST = 77.36; // stations east of this (Ghaziabad, Sahibabad, Khekra) are Uttar Pradesh, outside the Delhi pack; kept with ncr:true
// Facts that OSM does not carry. Each line says where it came from; "memory" means written from general knowledge and NOT verified (docs/DELHI_TRANSIT.md lists them).
const RAIL_FACTS = {
  NDLS: { class: 'terminal+through', platformsWiki: 16, tracksWiki: 20, opened: '1926 (first platform), building 1956; Ajmeri Gate building 2009', sides: ['Paharganj (platform 1)', 'Ajmeri Gate (platform 16)'], src: 'wikipedia: New Delhi railway station', note: 'platform 1 is on the Paharganj side; the 3-storey 9,000 m2 Ajmeri Gate building opened Sept 2009 and platforms went from 12 to 16; a 242 m skywalk joins the Ajmeri Gate foot overbridges to the Metro and a 442 m foot overbridge runs from the Paharganj entrance to the Bhavbhuti Marg parking' },
  DLI:  { class: 'terminal+through', platformsWiki: 16, tracksWiki: 18, opened: '1864, present building 1903', sides: ['Mori Gate / Chandni Chowk (platform 1)', 'Kashmere Gate (platform 16)'], src: 'wikipedia: Old Delhi railway station', note: 'platforms renumbered Sept 2011 from the main entrance (1) to the Kashmere Gate entrance (16); red-stone building in the style of the Red Fort; six clock towers originally, one survives as a water tank; four pit lines' },
  NZM:  { class: 'terminal', platformsWiki: 9, tracksWiki: 13, opened: '1926', src: 'wikipedia: Hazrat Nizamuddin railway station', note: '2019 revamp: green polycarbonate platform roofs, murals on the approach road, fountains, lifts and escalators; joined to Sarai Kale Khan Nizamuddin Metro (Pink Line), Sarai Kale Khan ISBT and the RapidX station' },
  ANVT: { class: 'terminal', platformsWiki: 7, tracksWiki: 12, opened: '19 Dec 2009', src: 'wikipedia: Anand Vihar Terminal railway station', note: 'two-storey terminal building with separate arrival and departure areas, a separate building with two suburban platforms, coach yard and feeder lines to Sahibabad; 2025-26 airport-style upgrade' },
  DEE:  { class: 'terminal', platformsWiki: 5, tracksWiki: 12, opened: 'metre-gauge terminal; broad gauge since 1990s', src: 'wikipedia: Delhi Sarai Rohilla railway station', note: 'terminal for trains to Haryana, Punjab, Rajasthan and Gujarat; two platforms of the Vivekanandpuri halt share a foot overbridge with it; three washing lines' },
  DEC:  { class: 'through', platformsWiki: 4, tracksWiki: 4, opened: 'metre gauge, broad gauge 1991', src: 'wikipedia: Delhi Cantonment railway station', note: 'a new "airport-like" building was built in 2025-26 with separate arrival and departure areas; Vande Bharat trains to Jodhpur, Bikaner, Ajmer-Chandigarh start here' },
  DSA:  { class: 'through', opened: '1910', src: 'wikipedia: Shahdara Junction railway station', note: 'junction on the Delhi-Ghaziabad line; Metro: Shahdara (Red Line)' },
  DKZ:  { class: 'suburban', platformsWiki: 3, tracksWiki: 6, src: 'wikipedia: Delhi Kishanganj railway station' },
  DSJ:  { class: 'suburban', platformsWiki: 3, tracksWiki: 6, src: 'wikipedia: Delhi Safdarjung railway station' },
  OKA:  { class: 'suburban', platformsWiki: 4, tracksWiki: 7, src: 'wikipedia: Okhla railway station' },
  TKJ:  { class: 'suburban', platformsWiki: 2, tracksWiki: 4, src: 'wikipedia: Tilak Bridge railway station' },
};
const irAll = stationsRaw.filter(e => e.tags && e.tags.railway === 'station' && !/subway|light_rail/.test(e.tags.station || '') && /Indian Railways|^IR$/.test(e.tags.network || '') && e.tags.ref);
const rwAll = rd('rail_ways.json').elements.filter(w => w.geometry && w.tags && /^(rail)$/.test(w.tags.railway));
const platAll = rd('platforms.json').elements.filter(e => e.geometry || e.bounds).map(e => { const g = (e.geometry || []).map(p => project(p.lat, p.lon)); return { id: e.id, tags: e.tags || {}, g }; }).filter(e => e.g.length);
let detail = null; try { detail = rd('rail_station_detail.json').elements; } catch { /* optional: only present after the second Overpass query */ }
const circMeanAxis = ws => { let sx = 0, sz = 0; for (const w of ws) for (let i = 0; i + 1 < w.length; i++) { const dx = w[i + 1][0] - w[i][0], dz = w[i + 1][1] - w[i][1], L = Math.hypot(dx, dz), a = 2 * Math.atan2(dz, dx); sx += L * Math.cos(a); sz += L * Math.sin(a); } return Math.atan2(sz, sx) / 2; };
const irPos = irAll.map(e => ({ id: e.tags.ref, p: project(...centre(e)) })), railStations = [];
for (const e of irAll.sort((a, b) => a.tags.ref < b.tags.ref ? -1 : 1)) {
  const t = e.tags, [la, lo] = centre(e), [x, z] = project(la, lo); if (la < 28.40 || la > 28.90 || lo < 76.95 || lo > 77.36) { if (!['GZB', 'SBB', 'GZN', 'FDB', 'FDN', 'GGN'].includes(t.ref)) continue; }
  const f = RAIL_FACTS[t.ref] || {}, around = rwAll.filter(w => w.geometry.some(g => dist(project(g.lat, g.lon), [x, z]) < 300) && !w.tags.service).map(w => w.geometry.map(g => project(g.lat, g.lon)));
  const axis = around.length ? circMeanAxis(around) : null;
  const near = platAll.filter(p => p.g.some(q => dist(q, [x, z]) < 420) && irPos.reduce((b, o) => { const d = Math.min(...p.g.map(q => dist(q, o.p))); return d < b.d ? { d, id: o.id } : b; }, { d: Infinity, id: null }).id === t.ref), faces = new Set(), bodies = [];   // each platform belongs to its nearest station
  for (const p of near) {
    const ref = (p.tags.ref || '').toString(); const fs_ = ref.split(/[;,]/).map(v => v.trim()).filter(v => /^\d+[A-Za-z]?$/.test(v)); fs_.forEach(v => faces.add(v));
    const cx = p.g.reduce((a, q) => a + q[0], 0) / p.g.length, cz = p.g.reduce((a, q) => a + q[1], 0) / p.g.length;
    let along = 0, across = 0; if (axis !== null) { const ux = Math.cos(axis), uz = Math.sin(axis); const as = p.g.map(q => (q[0] - cx) * ux + (q[1] - cz) * uz), cs = p.g.map(q => -(q[0] - cx) * uz + (q[1] - cz) * ux); along = Math.max(...as) - Math.min(...as); across = Math.max(...cs) - Math.min(...cs); }
    bodies.push({ faces: fs_, type: fs_.length > 1 ? 'island' : 'side', x: r1(cx), z: r1(cz), len: r1(along), w: r1(across), osm: 'w' + p.id });
  }
  bodies.sort((a, b) => (a.faces[0] || '~').localeCompare(b.faces[0] || '~', 'en', { numeric: true }));
  const entr = (detail || []).filter(d => d.type === 'node' && d.tags && (d.tags.entrance || d.tags.railway === 'subway_entrance') && dist(project(d.lat, d.lon), [x, z]) < 450).map(d => { const p = project(d.lat, d.lon); return [r1(p[0]), r1(p[1])]; });
  // footprints, canopies, foot bridges and tunnels near the main stations (second Overpass query), each attached to the nearest of those stations
  const dRef = new Set(['NDLS', 'DLI', 'NZM', 'ANVT', 'DEE', 'DEC', 'DSA', 'SZM', 'DKZ', 'TKJ', 'OKA', 'DSJ', 'DAZ', 'ANDI']), mine = (detail && dRef.has(t.ref)) ? detail.filter(d => d.type === 'way' && d.geometry && d.geometry.length > 1 && (() => { const c = project(d.geometry[0].lat, d.geometry[0].lon); const best = irPos.filter(o => dRef.has(o.id)).reduce((b, o) => { const dd = dist(c, o.p); return dd < b.d ? { d: dd, id: o.id } : b; }, { d: Infinity, id: null }); return best.id === t.ref && best.d < 450; })()) : [];
  const ring = d => { const P = d.geometry.map(g => { const q = project(g.lat, g.lon); return [q[0], q[1]]; }), idx = simplify(P, 0.6); return idx.flatMap(i => [r1(P[i][0]), r1(P[i][1])]); };
  const buildings = mine.filter(d => d.tags && d.tags.building).map(d => ({ kind: d.tags.building, name: d.tags.name || undefined, levels: +d.tags['building:levels'] || undefined, colour: d.tags['building:colour'] || undefined, ring: ring(d), osm: 'w' + d.id })), bridges = mine.filter(d => d.tags && /^(footway|steps|pedestrian|corridor)$/.test(d.tags.highway || '')).map(d => ({ kind: d.tags.tunnel ? 'tunnel' : d.tags.bridge ? 'bridge' : 'steps', path: ring(d), osm: 'w' + d.id }));
  railStations.push({ id: t.ref, name: { en: t.name, hi: t['name:hi'] || (wd[t.wikidata] && wd[t.wikidata].hi) || null }, osm: e.type[0] + e.id, x: r1(x), z: r1(z), class: f.class || 'through', ncr: lo > NCR_EAST || la < 28.45 ? true : undefined,
    zone: t.network ? 'NR' : null, platforms: { osmFaces: [...faces].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), osmCount: faces.size || null, wikipedia: f.platformsWiki || null, tracksWikipedia: f.tracksWiki || null },
    axis: axis === null ? null : Math.round(axis * 1000) / 1000, bodies, entrances: entr, ...(buildings.length ? { buildings } : {}), ...(bridges.length ? { footbridges: bridges } : {}), opened: f.opened || null, note: f.note || null, src: f.src || 'osm' });
}
/* Metro/rail interchanges: a metro station within 450 m of a railway station */
for (const r of railStations) r.metro = stationOut.filter(m => dist([m.x, m.z], [r.x, r.z]) < 450).map(m => m.id);

const SOURCES = [
  { id: 'osm', name: 'OpenStreetMap (Overpass API, bbox 28.30,76.85,28.95,77.60)', licence: 'ODbL 1.0', credit: '(c) OpenStreetMap contributors', use: 'track geometry and grade, station positions, codes, names, entrances, route relations, platforms, depots' },
  { id: 'wikipedia', name: 'Wikipedia: List of Delhi Metro stations, line and station articles', licence: 'CC BY-SA 4.0 (facts only, no text copied)', use: 'station layout (elevated/underground/at grade), platform type (island/side), opening dates, renames, gauge, depot list, railway station platform and track counts' },
  { id: 'wikidata', name: 'Wikidata', licence: 'CC0', use: 'Hindi names where OSM has none' },
];
export const metro = { lines: lineOut, stations: stationOut, depots, transfers };
export const SOURCES_USED = SOURCES;
export { railStations };
export { report, LINES };

/* ================= buses (optional: only when the raw bus files exist) ================= */
let bus = null; try { bus = (await import('./build_delhi_bus.mjs')).buildBus({ RAW, project, r1, dist, simplify, rd }); } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const doc = { format: 1, kind: 'transit', id: 'delhi', builder: BUILDER, origin: ORIGIN, frame: { earthRadiusM: R_EARTH, x: 'east, metres: (lon - lon0) * R * cos(lat0)', z: 'south, metres: -(lat - lat0) * R', note: 'same equirectangular frame as manifest.origin in docs/CITY_PACK.md' },
    sources: SOURCES, metro, rail: { stations: railStations }, ...(bus ? { bus } : {}) };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const text = JSON.stringify(doc, (k, v) => v === undefined ? undefined : v);
  fs.writeFileSync(OUT, text);
  console.log('wrote', path.relative(root, OUT), (text.length / 1e6).toFixed(2) + ' MB;', 'lines', lineOut.length, 'routes', lineRoutes.length, 'metro stations', stationOut.length, 'depots', depots.length, 'rail stations', railStations.length, bus ? 'bus routes ' + bus.routes.length : 'no bus part');
  for (const L of lineOut) console.log(L.id.padEnd(8), L.routes.map(r => r.km + ' km ' + r.stops.length + ' st ' + (r.gaps ? 'GAPS' + r.gaps : '')).join(' | '));
  console.log(report.warnings.join('\n'));
}
