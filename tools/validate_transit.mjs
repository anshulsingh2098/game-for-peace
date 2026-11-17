// Validation of assets/cities/delhi/transit.json (docs/CITY_PACK.md section 5, docs/DELHI_TRANSIT.md). Pure: validateTransit(doc) returns { errors, warnings, stats }.
// CLI: node tools/validate_transit.mjs [file]       The self-test (tools/selftest.mjs) runs the same function on the shipped file.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { TRANSIT_BUILDER_VERSION, nearestOnPath, dist, norm } from './lib_transit.mjs';
/** Line and station counts from the Wikipedia list of Delhi Metro stations (cross-checked with the OSM route relations); a station that serves two lines counts on both. */
export const EXPECT = {
  stationsPerRoute: { red: [29], yellow: [37], blue: [50, 8], green: [22, 3], violet: [34], pink: [46], magenta: [26, 7], grey: [4], airport: [7], aqua: [21], rapid: [11] },
  lineIds: ['red', 'yellow', 'blue', 'green', 'violet', 'pink', 'magenta', 'grey', 'airport', 'aqua', 'rapid'],
  // station name (normalised) -> lines it must serve (the main interchanges of the DMRC network)
  interchanges: { rajivchowk: ['yellow', 'blue'], kashmeregate: ['red', 'yellow', 'violet'], centralsecretariat: ['yellow', 'violet'], inderlok: ['red', 'green'], mandihouse: ['blue', 'violet'], hauzkhas: ['yellow', 'magenta'], kalkajimandir: ['violet', 'magenta'], kirtinagar: ['blue', 'green'], janakpuriwest: ['blue', 'magenta'], welcome: ['red', 'pink'], laxminagar: ['blue'], dwarkasector21: ['blue', 'airport'], newdelhi: ['yellow', 'airport'], azadpur: ['yellow', 'pink'], netajisubhashplace: ['red', 'pink'], lajpatnagar: ['violet', 'pink'], ashram: ['pink'], dhaulakuan: ['airport'] },
  railStations: { NDLS: 16, DLI: 16, NZM: 7, ANVT: 3, DEE: 3, DEC: 5 },   // platform faces counted from OSM `ref` tags near the station (Wikipedia figures sit beside them: NDLS 16, DLI 16, NZM 9, ANVT 7, DEE 5, DEC 4; the differences are listed in docs/DELHI_TRANSIT.md)
  maxStationToTrack: 160, maxInterchangeSeparation: 160, maxSegment: 2500,
};
export function validateTransit(doc) {
  const errors = [], warnings = [], stats = {}; const err = m => errors.push(m), warn = m => warnings.push(m);
  if (!doc || doc.format !== 1 || doc.kind !== 'transit' || doc.id !== 'delhi') return { errors: ['not a Delhi transit.json format 1'], warnings, stats };
  if (!doc.builder || doc.builder.version !== TRANSIT_BUILDER_VERSION) err(`builder version ${doc.builder && doc.builder.version} but the tools are at ${TRANSIT_BUILDER_VERSION}: run node tools/build_delhi_transit.mjs`);
  if (!Array.isArray(doc.sources) || !doc.sources.some(s => /ODbL/.test(s.licence))) err('sources must list the ODbL credit for OpenStreetMap');
  const M = doc.metro; if (!M) return { errors: [...errors, 'no metro part'], warnings, stats };
  const inBox = (x, z) => Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) < 60000 && Math.abs(z) < 60000;
  /* lines */
  const ids = M.lines.map(l => l.id); if (new Set(ids).size !== ids.length) err('duplicate line ids');
  for (const id of EXPECT.lineIds) if (!ids.includes(id)) err('missing metro line ' + id);
  const lineById = new Map(M.lines.map(l => [l.id, l])), stById = new Map(); let kmTotal = 0;
  for (const s of M.stations) { if (stById.has(s.id)) err('duplicate station id ' + s.id); stById.set(s.id, s); if (!inBox(s.x, s.z)) err('station outside the box: ' + s.id); if (!s.name || !s.name.en) err('station without name: ' + s.id); if (!s.lines.length) err('station on no line: ' + s.id); for (const l of s.lines) if (!lineById.has(l)) err(`station ${s.id} names unknown line ${l}`); if (s.per.length !== s.lines.length) err('per-line records do not match lines at ' + s.id); }
  for (const L of M.lines) {
    if (!/^#[0-9a-fA-F]{6}$/.test(L.colour)) err('bad colour on ' + L.id);
    if (!L.name || !L.name.en || !L.name.hi) err('line without English and Hindi name: ' + L.id);
    const want = EXPECT.stationsPerRoute[L.id]; if (want && want.length !== L.routes.length / 2) err(`${L.id}: ${L.routes.length} routes, expected ${want.length * 2} (two directions per section)`);
    for (const r of L.routes) {
      if (r.path.length < 4 || r.path.length % 2) err('bad path ' + r.id); else {
        const P = r.path; for (let i = 0; i < P.length; i++) if (!Number.isFinite(P[i])) { err('NaN in ' + r.id); break; }
        for (let i = 0; i + 3 < P.length; i += 2) if (Math.hypot(P[i + 2] - P[i], P[i + 3] - P[i + 1]) > EXPECT.maxSegment) { err(`${r.id}: a straight segment longer than ${EXPECT.maxSegment} m at point ${i / 2}`); break; }
        if (!r.grades.length || r.grades[0][0] !== 0 || r.grades.some((g, i) => (i && g[0] <= r.grades[i - 1][0]) || g[0] >= P.length / 2 || !/^[ueg]$/.test(g[1]))) err('bad grade runs on ' + r.id);
      }
      if (r.gaps && r.gaps.length) err(`${r.id}: track not connected between stops (jumps of ${r.gaps.join(', ')} m)`);
      let last = -1; for (const [sid, sAt] of r.stops) { if (!stById.has(sid)) err(`${r.id}: unknown station ${sid}`); else if (!stById.get(sid).lines.includes(L.id)) err(`${r.id}: station ${sid} does not list line ${L.id}`); if (sAt < last) err(`${r.id}: stops not in order along the track at ${sid}`); last = sAt; }
      kmTotal += r.km;
    }
    L.routes.forEach((r, i) => { const w = want && want[Math.floor(i / 2)]; });
    const counts = L.routes.map(r => r.stops.length).sort((a, b) => a - b), exp = (want || []).slice().sort((a, b) => a - b); // each section appears twice (both directions)
    if (want) { const got = counts.filter((_, i) => i % 2 === 0); if (got.join() !== exp.join()) err(`${L.id}: stations per route ${counts.join(',')}, expected two of each of ${exp.join(',')}`); }
  }
  /* every station sits on the track of every line it claims */
  let worst = 0, worstName = ''; for (const s of M.stations) for (const lid of s.lines) { const L = lineById.get(lid); let best = Infinity; for (const r of L.routes) if (r.stops.some(([id]) => id === s.id)) best = Math.min(best, nearestOnPath(r.path, [s.x, s.z]).d); if (best > worst) { worst = best; worstName = s.id + '/' + lid; } if (best > EXPECT.maxStationToTrack) err(`station ${s.id} is ${Math.round(best)} m from the ${lid} track`); }
  stats.worstStationToTrack = Math.round(worst) + ' m at ' + worstName;
  /* counts */
  const dm = M.stations.filter(s => s.lines.some(l => lineById.get(l).network === 'Delhi Metro')); stats.delhiMetroStations = dm.length; stats.allMetroStations = M.stations.length; stats.trackKm = Math.round(kmTotal / 2);
  if (dm.length < 244 || dm.length > 262) err(`Delhi Metro stations: ${dm.length}, expected 244 to 262 (Wikipedia counts 244 unique stations; an interchange whose platforms are in two separate buildings is two records here)`);
  const lineStations = M.stations.reduce((n, s) => n + s.lines.length, 0); stats.stationLines = lineStations; if (lineStations < 295) err(`${lineStations} station-line pairs, expected about 303 (271 DMRC + 21 Aqua + 11 Rapid)`);
  const noHi = M.stations.filter(s => !s.name.hi); stats.withoutHindi = noHi.length; if (noHi.length > M.stations.length * 0.1) err(`${noHi.length} stations without a Hindi name`); else if (noHi.length) warn('stations without a Hindi name: ' + noHi.map(s => s.id).join(' '));
  /* interchanges: lines connected */
  const names = [...M.stations].map(s => [norm(s.name.en), s]);
  for (const [n, want] of Object.entries(EXPECT.interchanges)) { const group = names.filter(([k]) => k.startsWith(n)).map(([, s]) => s); if (!group.length) { warn('interchange not found by name: ' + n); continue; } const have = new Set(group.flatMap(s => s.lines)); for (const l of want) if (!have.has(l)) err(`${group[0].name.en} should serve ${l} (serves ${[...have].join(', ')})`); }
  /* two lines of one interchange are connected when their tracks come within 160 m of each other near the station (crossing, same building, or a walkway between two buildings) */
  const near = (A, B, P) => { let m = Infinity; for (const ra of A.routes) for (let i = 0; i < ra.path.length; i += 2) if (Math.hypot(ra.path[i] - P[0], ra.path[i + 1] - P[1]) < 500) for (const rb of B.routes) m = Math.min(m, nearestOnPath(rb.path, [ra.path[i], ra.path[i + 1]]).d); return m; };
  let nInter = 0; for (const s of M.stations) if (s.lines.length > 1) { nInter++; if (!s.interchange) err(s.id + ' serves several lines but is not marked interchange'); for (let a = 0; a < s.lines.length; a++) for (let b = a + 1; b < s.lines.length; b++) { const d = near(lineById.get(s.lines[a]), lineById.get(s.lines[b]), [s.x, s.z]); if (!(d <= EXPECT.maxInterchangeSeparation)) err(`${s.id}: the ${s.lines[a]} and ${s.lines[b]} tracks come no closer than ${Math.round(d)} m near the interchange`); } }
  stats.interchanges = nInter; stats.walkTransfers = M.transfers.length; if (nInter + M.transfers.length < 24) err(`only ${nInter} interchange stations and ${M.transfers.length} walking transfers; Wikipedia counts 27 transfer stations`);
  for (const [a, b, d] of M.transfers) { if (!stById.has(a) || !stById.has(b)) err('transfer names unknown station ' + a + ' ' + b); else if (d > 450) err('transfer too long ' + a + '-' + b); }
  /* depots */
  if (M.depots.length < 12) err('depots: ' + M.depots.length + ', expected at least 12'); for (const d of M.depots) if (!inBox(d.x, d.z)) err('depot outside box ' + d.id);
  stats.depots = M.depots.length;
  /* rail */
  if (!doc.rail || !doc.rail.stations) err('no rail part'); else {
    const rs = new Map(doc.rail.stations.map(s => [s.id, s])); stats.railStations = rs.size; if (rs.size !== doc.rail.stations.length) err('duplicate rail station ids');
    for (const [id, n] of Object.entries(EXPECT.railStations)) { const s = rs.get(id); if (!s) { err('missing railway station ' + id); continue; } if (s.platforms.osmCount !== n) err(`${id}: ${s.platforms.osmCount} platform faces from OSM, expected ${n}`); if (!s.name.hi) err(id + ' has no Hindi name'); if (!inBox(s.x, s.z)) err('rail station outside box ' + id); }
    for (const id of ['DSA', 'SZM', 'DKZ', 'TKJ', 'OKA', 'DSJ', 'DAZ']) if (!rs.has(id)) warn('railway station not in OSM extract: ' + id);
    const ndls = rs.get('NDLS'), nm = ndls && ndls.metro; if (!nm || !nm.length) err('New Delhi railway station must list the Metro stations beside it');
  }
  if (doc.bus) {
    const B = doc.bus; stats.busRoutes = B.routes.length; stats.busStops = B.stops.length;
    if (B.routes.length < 400) err(`bus routes: ${B.routes.length}, expected at least 400 (OSM has 430 numbers)`); if (B.stops.length < 1500) err('bus stops: ' + B.stops.length);
    for (const s of B.stops) if (!inBox(s[0], s[1])) { err('bus stop outside the box: ' + s); break; }
    for (const r of B.routes) { if (!r.ref) err('bus route without number'); if (r.stops.length < 2) err('bus route with fewer than 2 stops ' + r.ref); if (r.stops.some(i => !(i >= 0 && i < B.stops.length))) err(`bus route ${r.ref}: stop index out of range`); }
    const kinds = {}; for (const p of B.places) { kinds[p.kind] = (kinds[p.kind] || 0) + 1; if (!inBox(p.x, p.z)) err('bus place outside the box ' + p.name); } stats.busPlaces = kinds;
    if ((kinds.isbt || 0) !== 3) err('Delhi has three ISBTs (Kashmere Gate, Anand Vihar, Sarai Kale Khan); found ' + (kinds.isbt || 0)); if ((kinds.depot || 0) < 25) err('bus depots: ' + (kinds.depot || 0));
  }
  return { errors, warnings, stats };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const f = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets/cities/delhi/transit.json'); const doc = JSON.parse(fs.readFileSync(f));
  const r = validateTransit(doc); console.log(JSON.stringify(r.stats)); r.warnings.forEach(w => console.log('warning:', w)); r.errors.forEach(e => console.log('ERROR:', e)); console.log(r.errors.length ? r.errors.length + ' errors' : 'valid'); process.exit(r.errors.length ? 1 : 0);
}
