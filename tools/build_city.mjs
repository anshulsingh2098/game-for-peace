#!/usr/bin/env node
/* City pipeline (CITY_PLAN Phase 1, package D1). Reads an OpenStreetMap extract (.osm.pbf) and writes a city pack in the format of docs/CITY_PACK.md section 5:
     assets/cities/<id>/manifest.json, graph.json, tiles/<tx>_<tz>.json, landmarks.json (when a curated list exists), ATTRIBUTION.txt
   Build time only, never at run time. Deterministic: the same extract and the same tool version give the same bytes (no clock, no random; everything is processed in file order or sorted).
   Run:   node tools/build_city.mjs delhi --extract data/raw/delhi/northern-zone-261116.osm.pbf
   Needs about 4 GB of memory (the tool restarts itself with a larger heap). Nothing is fetched; osmium is not needed (tools/lib/osm_pbf.mjs reads the file).
   What it cuts and why is printed at the end and written to the manifest (`cuts`). */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readPbf } from './lib/osm_pbf.mjs';
import { r1, area, centroid, bbox, pointInRing, lineLength, simplify, simplifyRing, clipRing, splitLine, PolyMask, joinRings } from './lib/geom.mjs';
import { KeepOut } from '../src/world/keepout.js';
import { resolveLandmarks } from './lib/landmarks_resolve.mjs';
import { encodeTile, encodeGraph, LANE_W as LANE_W_, DEFAULT_SIDEWALK, defaultWidth, corridorHw, CONFLICT_CLASSES, streetConflict, droppedForStreet } from './lib/packio.mjs';
import { selfIntersects } from './lib/geom.mjs';

export const BUILDER_VERSION = '1.0.0';
export const PACK_FORMAT = 1;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TILE = 1000;

/* ---- the cities the tool knows (more are added here: Gurgaon, Noida) ---- */
export const CITIES = {
  delhi: {
    id: 'delhi', name: { en: 'Delhi', hi: 'दिल्ली' }, cityId: 'delhi', origin: { lat: 28.6139, lon: 77.2090 }, drive: 'left',
    boundary: { relation: 1942586, adminLevel: '4' },                   // the NCT of Delhi (OSM relation 1942586, admin_level 4, ISO3166-2 IN-DL)
    bboxDeg: [28.38, 76.80, 28.92, 77.40],                              // s, w, n, e: nodes outside are never loaded (the polygon, not the box, decides what is kept)
    keepOutsideM: 600,                                                   // roads are kept this far past the boundary so highways continue to a gate
    landmarks: 'tools/city_data/delhi_landmarks_src.json',
    spawns: [ { id: 'centre', name: 'Connaught Place', lat: 28.6315, lon: 77.2167 }, { id: 'ndls', name: 'New Delhi Railway Station', lat: 28.6430, lon: 77.2197 }, { id: 'igi', name: 'IGI Airport Terminal 3', lat: 28.5562, lon: 77.1000 }, { id: 'indiagate', name: 'India Gate', lat: 28.6129, lon: 77.2295 }, { id: 'redfort', name: 'Red Fort', lat: 28.6562, lon: 77.2410 }, { id: 'qutub', name: 'Qutub Minar', lat: 28.5245, lon: 77.1855 } ],
  },
};

/* ---- command line ---- */
const argv = process.argv.slice(2), has = f => argv.includes(f), opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };

/* ---- classification tables ---- */
const ROAD_CLASS = { motorway: 'motorway', motorway_link: 'motorway', trunk: 'trunk', trunk_link: 'trunk', primary: 'primary', primary_link: 'primary', secondary: 'secondary', secondary_link: 'secondary', tertiary: 'tertiary', tertiary_link: 'tertiary', unclassified: 'tertiary', residential: 'residential', living_street: 'residential', service: 'service', pedestrian: 'footway', footway: 'footway', path: 'footway', steps: 'footway', cycleway: 'cycleway', busway: 'busway' };
const SPEED = { motorway: 80, trunk: 60, primary: 50, secondary: 40, tertiary: 30, residential: 20, service: 15, footway: 5, cycleway: 15, busway: 40 };
const LANE_W = LANE_W_;
const ONEWAY_LANES = { motorway: 3, trunk: 3, primary: 2, secondary: 2, tertiary: 2, residential: 1, service: 1, footway: 1, cycleway: 1, busway: 1 };
const TWOWAY_LANES = { motorway: 4, trunk: 4, primary: 4, secondary: 2, tertiary: 2, residential: 2, service: 1, footway: 1, cycleway: 1, busway: 2 };
const BLOCK_CLASSES = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential']);
const LANDUSE = { residential: 'residential', commercial: 'commercial', retail: 'commercial', industrial: 'industrial', institutional: 'institutional', military: 'military', cemetery: 'cemetery', religious: 'religious', construction: 'construction', railway: 'railway', garages: 'other', education: 'institutional', farmland: 'farmland', farmyard: 'farmland', orchard: 'farmland', meadow: 'farmland', brownfield: 'construction', landfill: 'other', quarry: 'other', allotments: 'farmland', greenfield: 'construction', depot: 'industrial', flowerbed: 'garden' };
const PARK = { park: 'park', garden: 'garden', playground: 'park', pitch: 'sports', stadium: 'sports', sports_centre: 'sports', golf_course: 'golf', nature_reserve: 'forest', recreation_ground: 'park', common: 'park', dog_park: 'park', track: 'sports' };
const NATURAL = { wood: 'forest', scrub: 'scrub', grassland: 'grass', heath: 'scrub', wetland: 'wetland', water: 'water', bare_rock: 'other', sand: 'other', beach: 'other' };
const LANDUSE_PARK = { forest: 'forest', grass: 'grass', village_green: 'park', recreation_ground: 'park', flowerbed: 'garden' };
const USE_OF = { house: 'residential', residential: 'residential', apartments: 'residential', detached: 'residential', terrace: 'residential', dormitory: 'residential', semidetached_house: 'residential', bungalow: 'residential', static_caravan: 'residential', commercial: 'commercial', retail: 'retail', supermarket: 'retail', kiosk: 'retail', shop: 'retail', office: 'office', hotel: 'hotel', motel: 'hotel', hostel: 'hotel', civic: 'civic', government: 'civic', public: 'civic', school: 'civic', college: 'civic', university: 'civic', hospital: 'civic', kindergarten: 'civic', fire_station: 'civic', police: 'civic', townhall: 'civic', courthouse: 'civic', library: 'civic', museum: 'civic', stadium: 'civic', sports_hall: 'civic', temple: 'religious', mosque: 'religious', church: 'religious', gurdwara: 'religious', religious: 'religious', shrine: 'religious', chapel: 'religious', cathedral: 'religious', synagogue: 'religious', industrial: 'industrial', warehouse: 'industrial', factory: 'industrial', manufacture: 'industrial', train_station: 'transit', transportation: 'transit', terminal: 'transit', bus_station: 'transit', hangar: 'transit' };
const LEVEL_GUESS = { residential: 3, commercial: 3, retail: 2, office: 5, hotel: 6, civic: 2, religious: 1, industrial: 1, transit: 2, other: 2 };
const ROOF = { flat: 'flat', gabled: 'gabled', hipped: 'hipped', dome: 'dome', pyramidal: 'pyramidal', skillion: 'skillion', onion: 'dome', cone: 'pyramidal', half_hipped: 'hipped', gambrel: 'gabled' };

const num = v => { if (v === undefined) return null; const m = /^\s*(-?\d+(?:[.,]\d+)?)/.exec(String(v)); return m ? parseFloat(m[1].replace(',', '.')) : null; };
const devanagari = s => /[ऀ-ॿ]/.test(s || '');
function namesOf(t) {
  const en = t['name:en'] || (t.name && !devanagari(t.name) ? t.name : '') || '', hi = t['name:hi'] || (devanagari(t.name) ? t.name : '') || '';
  return { en: en || '', hi: hi || '', ref: t.ref || '' };
}
const lat1 = (a) => a; void lat1;

function main() {
  const cityKey = argv.find(a => !a.startsWith('--') && CITIES[a]); if (!cityKey) { console.error('usage: node tools/build_city.mjs <city> --extract <file.osm.pbf> [--out dir] [--date YYYY-MM-DD] [--url ...]  (cities: ' + Object.keys(CITIES).join(', ') + ')'); process.exit(2); }
  if (!process.execArgv.some(a => a.startsWith('--max-old-space-size'))) { const r = spawnSync(process.execPath, ['--max-old-space-size=12288', fileURLToPath(import.meta.url), ...argv], { stdio: 'inherit' }); process.exit(r.status === null ? 1 : r.status); }
  build(CITIES[cityKey]).catch(e => { console.error(e); process.exit(1); });
}

async function build(C) {
  const t0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
  const extract = path.resolve(ROOT, opt('--extract', `data/raw/${C.id}/extract.osm.pbf`)), outDir = path.resolve(ROOT, opt('--out', `assets/cities/${C.id}`));
  if (!existsSync(extract)) throw new Error('extract not found: ' + extract);
  const extractBytes = statSync(extract).size, extractSha = createHash('sha256').update(readFileSync(extract)).digest('hex');
  const extractDate = opt('--date', (/-(\d\d)(\d\d)(\d\d)\.osm/.exec(extract) || []).slice(1).reduce((a, v, i) => a + (i ? '-' : '20') + v, '') || 'unknown');
  const extractUrl = opt('--url', 'https://download.geofabrik.de/asia/india/northern-zone-' + extractDate.slice(2).replace(/-/g, '') + '.osm.pbf');
  const MIN_BUILDING_AREA = +opt('--min-area', 10), BUILDING_EPS = +opt('--building-eps', 0.8), MIN_BLOCK_AREA = +opt('--min-block', 800);
  const cos0 = Math.cos(C.origin.lat * Math.PI / 180), KM = 111.195 * 1000;           // metres per degree of latitude (R = 6371 km), equirectangular
  const X = lon => (lon - C.origin.lon) * cos0 * KM, Z = lat => -(lat - C.origin.lat) * KM;
  const [bs, bw, bn, be] = C.bboxDeg;

  /* ---------- pass 1: relations (multipolygons, the boundary) ---------- */
  log('pass 1: relations');
  const rels = [], relWays = new Set(); let boundaryRel = null;
  const wantRel = t => t.building || t.landuse || t.leisure || t.natural || t.water || t.waterway === 'riverbank' || t.tourism || t.historic || t['building:part'] === undefined && (t.amenity === 'place_of_worship' || t.amenity === 'marketplace' || t.aeroway === 'terminal');
  await readPbf(extract, { relation(id, members, t) {
    if (id === C.boundary.relation && t.boundary === 'administrative' && t.admin_level === C.boundary.adminLevel) { boundaryRel = { id, members }; for (const m of members) if (m.type === 'w' && (m.role === 'outer' || m.role === '' )) relWays.add(m.ref); return; }
    if (t.type !== 'multipolygon' || !wantRel(t)) return;
    const mem = members.filter(m => m.type === 'w' && (m.role === 'outer' || m.role === 'inner' || m.role === '')); if (!mem.length) return;
    rels.push({ id, members: mem, tags: t }); for (const m of mem) relWays.add(m.ref);
  } }, { skip: { nodes: true, ways: true } });
  if (!boundaryRel) throw new Error('boundary relation not found: ' + C.boundary.relation);
  log('relations kept', rels.length, 'member ways', relWays.size, 'boundary relation', boundaryRel.id);

  /* ---------- pass 2: nodes (in the box), ways, tagged nodes ---------- */
  log('pass 2: nodes and ways');
  let cap = 1 << 22, nn = 0, nid = new Float64Array(cap), nla = new Int32Array(cap), nlo = new Int32Array(cap);        // node store, sorted by id as in the file
  const sigNodes = new Set(), crossNodes = new Set(), roundNodes = new Set(), poiNodes = [], furn = [];
  const find = id => { let lo = 0, hi = nn - 1; while (lo <= hi) { const m = (lo + hi) >> 1, v = nid[m]; if (v === id) return m; if (v < id) lo = m + 1; else hi = m - 1; } return -1; };
  const roads = [], bldgs = [], areas = [], waterLines = [], poiWays = [], relGeom = new Map();
  const resolve = (refs, needAll) => { const out = []; const ids = []; for (const r of refs) { const k = find(r); if (k < 0) { if (needAll) return null; continue; } out.push(X(nlo[k] * 1e-7), Z(nla[k] * 1e-7)); ids.push(r); } return { pts: out, ids }; };
  const poiClass = t => {
    if (t.tourism && /^(attraction|museum|gallery|zoo|viewpoint|theme_park|aquarium|hotel|artwork)$/.test(t.tourism) && t.tourism !== 'artwork' && t.tourism !== 'hotel') return 'tourism:' + t.tourism;
    if (t.historic && t.historic !== 'yes' || t.historic === 'yes') return 'historic:' + t.historic;
    if (t.amenity === 'place_of_worship') return 'worship'; if (t.amenity === 'marketplace') return 'market'; if (t.amenity === 'hospital' || t.amenity === 'university' || t.amenity === 'college' || t.amenity === 'theatre' || t.amenity === 'townhall' || t.amenity === 'courthouse' || t.amenity === 'embassy' || t.amenity === 'library' || t.amenity === 'bus_station') return 'amenity:' + t.amenity;
    if (t.leisure === 'stadium' || t.leisure === 'sports_centre' && t.name || t.leisure === 'pitch' && t.wikidata || t.leisure === 'park' && t.name && t.wikidata) return 'leisure:' + t.leisure;
    if (t.shop === 'mall' || t.shop === 'department_store') return 'shop:' + t.shop; if (t.railway === 'station' || t.public_transport === 'station') return 'station'; if (t.aeroway === 'terminal' || t.aeroway === 'aerodrome') return 'aeroway:' + t.aeroway; if (t.office === 'government' && t.name) return 'office:government';
    return null;
  };
  await readPbf(extract, {
    node(id, lat, lon, t) {
      if (lat < bs || lat > bn || lon < bw || lon > be) return;
      if (nn === cap) { cap *= 2; const a = new Float64Array(cap), b = new Int32Array(cap), c = new Int32Array(cap); a.set(nid); b.set(nla); c.set(nlo); nid = a; nla = b; nlo = c; }
      nid[nn] = id; nla[nn] = Math.round(lat * 1e7); nlo[nn] = Math.round(lon * 1e7); nn++;
      if (!t) return;
      if (t.highway === 'traffic_signals') { sigNodes.add(id); furn.push({ k: 'signal', id, lat, lon }); } else if (t.highway === 'crossing' || t.crossing) crossNodes.add(id);
      else if (t.highway === 'bus_stop' || t.railway === 'subway_entrance') furn.push({ k: t.highway === 'bus_stop' ? 'bus_stop' : 'metro_entrance', id, lat, lon, name: t.name || '' });
      if (t.junction === 'roundabout') roundNodes.add(id);
      const pc = (t.name || t['name:en']) && poiClass(t); if (pc) poiNodes.push({ id, lat, lon, cls: pc, t });
    },
    way(id, refs, t) {
      const isRel = relWays.has(id), hw = t.highway && ROAD_CLASS[t.highway], bld = t.building && t.building !== 'no' && !t['building:part'] ? t.building : null;
      const landuse = LANDUSE[t.landuse] || null, park = PARK[t.leisure] || LANDUSE_PARK[t.landuse] || (t.natural === 'wood' ? 'forest' : null), nat = NATURAL[t.natural] || (t.water ? 'water' : null) || (t.waterway === 'riverbank' ? 'river' : null);
      const wl = t.waterway && /^(river|canal|stream|drain)$/.test(t.waterway) ? t.waterway : null, pc = (t.name || t['name:en']) && poiClass(t);
      if (!(isRel || hw || bld || landuse || park || nat || wl || pc)) return;
      const closed = refs.length > 3 && refs[0] === refs[refs.length - 1];
      const g = resolve(refs, closed && !hw && !wl); if (!g || g.pts.length < 4) return;
      if (isRel) relGeom.set(id, { pts: g.pts, a: refs[0], b: refs[refs.length - 1], closed, ok: g.ids.length === refs.length });
      if (hw) { if (t.area === 'yes' || t.highway === 'proposed' || t.highway === 'construction' || (t.highway === 'footway' && (t.footway === 'sidewalk' || t.footway === 'crossing' || t.footway === 'traffic_island')) || t.access === 'private' && hw === 'service' && false) return; roads.push({ id, ids: g.ids, pts: g.pts, cls: hw, t }); return; }
      if (wl) { waterLines.push({ id, pts: g.pts, cls: wl, name: t.name || '' }); return; }
      if (!closed || g.ids.length !== refs.length) return;
      if (bld) bldgs.push({ osm: 'w' + id, pts: g.pts, t, kind: bld });
      else if (landuse || park || nat) areas.push({ osm: 'w' + id, rings: [g.pts], cls: landuse ? 'landuse:' + landuse : park ? 'parks:' + park : nat === 'water' || nat === 'river' || nat === 'wetland' ? 'water:' + nat : 'parks:' + nat, t });
      if (pc) poiWays.push({ osm: 'w' + id, pts: g.pts, cls: pc, t });
    },
  }, { skip: { relations: true } });
  log('nodes stored', nn, 'roads', roads.length, 'buildings', bldgs.length, 'areas', areas.length, 'water lines', waterLines.length, 'poi ways', poiWays.length);

  /* ---------- the boundary polygon ---------- */
  const bw_ = boundaryRel.members.filter(m => m.type === 'w' && relGeom.has(m.ref) && (m.role === 'outer' || m.role === '')).map(m => relGeom.get(m.ref));
  const bRings = joinRings(bw_).map(p => (area(p) < 0 ? reverse(p) : p)).sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
  if (!bRings.length) throw new Error('boundary did not close (' + bw_.length + ' ways)');
  const mask = new PolyMask([bRings[0]]), buf = new PolyMask([offsetRing(bRings[0], C.keepOutsideM)]);
  log('boundary ring points', bRings[0].length / 2, 'area km2', (area(bRings[0]) / 1e6).toFixed(0));

  /* ---------- multipolygon relations to rings ---------- */
  const relPolys = [];                                                         // { rings: [outer, ...holes], tags, osm }
  for (const r of rels) {
    const ws = r.members.map(m => ({ m, g: relGeom.get(m.ref) })).filter(x => x.g);
    if (!ws.length) continue;
    const outer = joinRings(ws.filter(x => x.m.role !== 'inner').map(x => x.g)), inner = joinRings(ws.filter(x => x.m.role === 'inner').map(x => x.g));
    for (const o of outer) { const holes = inner.filter(h => pointInRing(h[0], h[1], o)); relPolys.push({ rings: [o, ...holes], t: r.tags, osm: 'r' + r.id }); }
  }
  const inside = (x, z) => mask.has(x, z);
  /* relation polygons join the way lists */
  for (const p of relPolys) {
    const t = p.t, c = centroid(p.rings[0]); if (!inside(c[0], c[1])) continue;
    const bld = t.building && t.building !== 'no' ? t.building : null, landuse = LANDUSE[t.landuse], park = PARK[t.leisure] || LANDUSE_PARK[t.landuse] || (t.natural === 'wood' ? 'forest' : null), nat = NATURAL[t.natural] || (t.water ? 'water' : null) || (t.waterway === 'riverbank' ? 'river' : null), pc = (t.name || t['name:en']) && poiClass(t);
    if (bld) bldgs.push({ osm: p.osm, pts: p.rings[0], holes: p.rings.slice(1), t, kind: bld });
    else if (landuse || park || nat) areas.push({ osm: p.osm, rings: p.rings, cls: landuse ? 'landuse:' + landuse : park ? 'parks:' + park : nat === 'water' || nat === 'river' || nat === 'wetland' ? 'water:' + nat : 'parks:' + nat, t });
    if (pc) poiWays.push({ osm: p.osm, pts: p.rings[0], cls: pc, t });
  }

  /* ---------- street graph ---------- */
  log('streets');
  const keepRoad = r => { for (let i = 0; i < r.pts.length; i += 2) if (inside(r.pts[i], r.pts[i + 1])) return true; for (let i = 0; i < r.pts.length; i += 2) if (buf.has(r.pts[i], r.pts[i + 1])) return true; return false; };
  const keptRoads = roads.filter(keepRoad); roads.length = 0;
  const use = new Map(); for (const r of keptRoads) { for (const id of r.ids) use.set(id, (use.get(id) || 0) + 1); }
  const nodeIdx = new Map(), gnodes = [];                                       // graph nodes: [id, x, z, flags]
  const nodeAt = (osmId, x, z) => { let k = nodeIdx.get(osmId); if (k === undefined) { k = gnodes.length; nodeIdx.set(osmId, k); gnodes.push([k, r1(x), r1(z), (sigNodes.has(osmId) ? 1 : 0) | (crossNodes.has(osmId) ? 2 : 0) | (roundNodes.has(osmId) ? 8 : 0)]); } return k; };
  const names = [{ en: '', hi: '', ref: '' }], nameKey = new Map([['||', 0]]);
  const nameIdx = t => { const n = namesOf(t), k = n.en + '|' + n.hi + '|' + n.ref; let i = nameKey.get(k); if (i === undefined) { i = names.length; names.push(n); nameKey.set(k, i); } return i; };
  const edges = [], edgeGeom = [], waterMask = areas.filter(a => a.cls.startsWith('water:')).map(a => ({ bb: bbox(a.rings[0]), ring: a.rings[0] }));
  const overWater = (x, z) => { for (const w of waterMask) if (x >= w.bb[0] && x <= w.bb[2] && z >= w.bb[1] && z <= w.bb[3] && pointInRing(x, z, w.ring)) return true; return false; };
  for (const r of keptRoads) {
    const t = r.t, cls = r.cls, oneRaw = t.oneway, oneway = oneRaw === '-1' || oneRaw === 'reverse' ? -1 : (oneRaw === 'yes' || oneRaw === '1' || oneRaw === 'true' || t.junction === 'roundabout' || cls === 'motorway' && oneRaw !== 'no' && t.highway === 'motorway') ? 1 : 0;
    let lanes = parseInt(t.lanes, 10); if (!(lanes > 0 && lanes <= 10)) lanes = oneway ? ONEWAY_LANES[cls] : TWOWAY_LANES[cls]; if (oneway && t.lanes && t['lanes:forward'] === undefined) lanes = Math.max(1, lanes);
    const speed = num(t.maxspeed) || SPEED[cls]; let layer = parseInt(t.layer, 10) || 0; const bridge = t.bridge && t.bridge !== 'no', tunnel = (t.tunnel && t.tunnel !== 'no') || layer < 0 && !bridge;
    if (bridge && layer < 1) layer = 1; if (tunnel && layer >= 0) layer = -1; layer = Math.max(-2, Math.min(3, layer));
    const wTag = num(t.width), width = r1(Math.max(1, wTag && wTag < 40 && !oneway ? wTag : lanes * LANE_W[cls] * (cls === 'footway' || cls === 'cycleway' ? 1 : 1) + (oneway ? 0 : 0.0)));
    const toll = t.toll === 'yes' ? 4 : 0, ni = nameIdx(t), sw = t.sidewalk === 'both' ? 2 : (t.sidewalk === 'left' || t.sidewalk === 'right' || t.sidewalk === 'yes') ? 1 : t.sidewalk === 'no' || t.sidewalk === 'none' ? 0 : (cls === 'primary' || cls === 'secondary' || cls === 'tertiary' || cls === 'residential') ? (cls === 'residential' ? 1 : 2) : 0;
    const surf = t.surface || (cls === 'footway' ? 'paved' : 'asphalt'), mark = ['motorway', 'trunk', 'primary', 'secondary'].includes(cls) && lanes >= 2 ? 'dashed' : 'none';
    // split at nodes shared by other ways, and at ends
    let start = 0; const n = r.ids.length;
    for (let i = 1; i < n; i++) {
      const last = i === n - 1; if (!last && use.get(r.ids[i]) < 2 && !sigNodes.has(r.ids[i]) && !roundNodes.has(r.ids[i])) continue;
      const seg = r.pts.slice(start * 2, i * 2 + 2);
      if (seg.length >= 4) {
        const a = nodeAt(r.ids[start], seg[0], seg[1]), b = nodeAt(r.ids[i], seg[seg.length - 2], seg[seg.length - 1]), len = lineLength(seg);
        if (len >= 0.5 && a !== b || len > 3) {
          const mx = seg[Math.floor(seg.length / 4) * 2], mz = seg[Math.floor(seg.length / 4) * 2 + 1];
          const fl = (bridge ? 1 : 0) | (tunnel ? 2 : 0) | toll | (bridge && !overWater(mx, mz) ? 8 : 0), id = edges.length;
          edges.push([id, a, b, cls, lanes, oneway, speed, r1(len), layer, fl, ni]); edgeGeom.push({ defW: defaultWidth(cls, lanes), pts: simplify(seg, 0.7), width, sidewalk: sw, markings: mark, surface: surf, cls, layer });
        }
      }
      start = i;
    }
  }
  log('graph nodes', gnodes.length, 'edges', edges.length, 'names', names.length);

  /* ---------- gates: the big roads that cross the boundary ---------- */
  const gateRaw = [];
  for (const e of edges) {
    if (!['motorway', 'trunk', 'primary'].includes(e[3])) continue; const A = gnodes[e[1]], B = gnodes[e[2]], ia = inside(A[1], A[2]), ib = inside(B[1], B[2]); if (ia === ib) continue;
    const nm = names[e[10]], ref = (nm.ref || '').split(';')[0].replace(/\s+/g, ''), inn = ia ? A : B, out = ia ? B : A;
    gateRaw.push({ e, ref, x: inn[1], z: inn[2], node: inn[0], bearing: Math.atan2(inn[1] - out[1], -(inn[2] - out[2])), cls: e[3], lanes: e[4], name: nm.en || nm.hi });
  }
  gateRaw.sort((a, b) => (a.ref + a.x).localeCompare(b.ref + b.x) || a.e[0] - b.e[0]);
  const gates = [];
  for (const g of gateRaw) {                                                    // dual carriageways cross as two edges: merge neighbours with the same ref within 250 m
    const m = gates.find(h => h.ref === g.ref && Math.hypot(h.x - g.x, h.z - g.z) < 250); if (m) { m.lanes += g.lanes; m.edges.push(g.e[0]); gnodes[g.node][3] |= 4; continue; }
    gates.push({ ...g, edges: [g.e[0]] }); gnodes[g.node][3] |= 4;
  }
  const gateOut = gates.map((g, i) => ({ id: ((g.ref || g.name || 'road').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'road') + '-' + (Math.abs(g.bearing) < Math.PI / 4 ? 'south' : Math.abs(g.bearing) > 3 * Math.PI / 4 ? 'north' : g.bearing > 0 ? 'west' : 'east') + '-' + i, india: /^NH\d+/i.test(g.ref) ? g.ref.toUpperCase().replace(/;.*/, '') : null, ref: g.ref, name: g.name, x: r1(g.x), z: r1(g.z), bearing: +g.bearing.toFixed(3), street: g.edges[0], lanes: g.lanes }));

  /* ---------- keep-out registry of the streets (for conflicts) ---------- */
  const ko = new KeepOut(); edgeGeom.forEach((g, i) => { if (g.layer !== 0 || !CONFLICT_CLASSES.has(g.cls)) return; const p = g.pts; let run = [p[0], p[1]], len = 0; for (let k = 2; k < p.length; k += 2) { run.push(p[k], p[k + 1]); len += Math.hypot(p[k] - p[k - 2], p[k + 1] - p[k - 1]); if (len > 150 && k + 2 < p.length) { ko.add('e' + i, 'road', { t: 'line', pts: run, hw: corridorHw(g.cls, g.width) }); run = [p[k], p[k + 1]]; len = 0; } } if (run.length >= 4) ko.add('e' + i, 'road', { t: 'line', pts: run, hw: corridorHw(g.cls, g.width) }); });

  /* ---------- landuse lookup, blocks ---------- */
  log('blocks');
  const luAreas = areas.filter(a => a.cls.startsWith('landuse:')).map(a => ({ cls: a.cls.slice(8), ring: a.rings[0], bb: bbox(a.rings[0]), a: Math.abs(area(a.rings[0])) })).sort((p, q) => p.a - q.a);
  const luGrid = new Map(), LC = 500; for (const l of luAreas) for (let i = Math.floor(l.bb[0] / LC); i <= Math.floor(l.bb[2] / LC); i++) for (let j = Math.floor(l.bb[1] / LC); j <= Math.floor(l.bb[3] / LC); j++) { const k = i + ',' + j; let g = luGrid.get(k); if (!g) luGrid.set(k, g = []); g.push(l); }
  const landuseAt = (x, z) => { const g = luGrid.get(Math.floor(x / LC) + ',' + Math.floor(z / LC)); if (!g) return null; for (const l of g) if (x >= l.bb[0] && x <= l.bb[2] && z >= l.bb[1] && z <= l.bb[3] && pointInRing(x, z, l.ring)) return l.cls; return null; };
  const blocks = extractBlocks(edges, edgeGeom, gnodes, BLOCK_CLASSES);
  for (let i = blocks.length - 1; i >= 0; i--) if (area(blocks[i].ring) < MIN_BLOCK_AREA) blocks.splice(i, 1);
  for (const b of blocks) { const c = centroid(b.ring); b.landuse = landuseAt(c[0], c[1]) || 'urban'; b.c = c; }
  log('blocks', blocks.length);

  /* ---------- buildings ---------- */
  log('buildings');
  const stats = { badRing: 0, badBlock: 0, bldIn: 0, tooSmall: 0, onStreet: 0, overlap: 0, touchStreet: 0, hTag: 0, hLevels: 0, hGuess: 0, outside: 0 };
  const landmarkInfo = C.landmarks && existsSync(path.resolve(ROOT, C.landmarks)) ? JSON.parse(readFileSync(path.resolve(ROOT, C.landmarks), 'utf8')) : null;
  const B = [];
  for (const b of bldgs) {
    const p = b.pts, a = area(p); let ring = a < 0 ? reverse(p) : p; const aa = Math.abs(a);
    const c = centroid(ring); if (!inside(c[0], c[1])) { stats.outside++; continue; } stats.bldIn++;
    if (aa < MIN_BUILDING_AREA) { stats.tooSmall++; continue; }
    { const sr = simplifyRing(ring, BUILDING_EPS).map(r1); ring = sr.length >= 6 && !selfIntersects(sr) ? sr : ring.map(r1); } if (ring.length < 6 || selfIntersects(ring)) { stats.badRing++; continue; } c[0] = centroid(ring)[0]; c[1] = centroid(ring)[1];
    // street conflict: the share of the boundary samples that lie on a street
    const sc = streetConflict(ring, c, ko); if (droppedForStreet(sc)) { stats.onStreet++; continue; } if (sc.share > 0) stats.touchStreet++;
    const t = b.t, use_ = USE_OF[b.kind] || USE_OF[t.amenity] || (t.shop ? 'retail' : t.office ? 'office' : t.tourism === 'hotel' ? 'hotel' : t.amenity === 'place_of_worship' ? 'religious' : null) || ((b.kind === 'yes' || b.kind === 'building') ? ((landuseAt(c[0], c[1]) || 'residential') === 'industrial' ? 'industrial' : (landuseAt(c[0], c[1]) === 'commercial' ? 'commercial' : (landuseAt(c[0], c[1]) === 'institutional' ? 'civic' : 'residential'))) : 'other');
    let levels = num(t['building:levels']), height = num(t.height) ?? num(t['building:height']), hsrc;
    if (height !== null && height > 0 && height < 500) { hsrc = 'tag'; stats.hTag++; if (levels === null) levels = Math.max(1, Math.round(height / 3.2)); }
    else if (levels !== null && levels > 0 && levels < 120) { hsrc = 'levels'; height = levels * 3.2; stats.hLevels++; }
    else { hsrc = 'guess'; stats.hGuess++; levels = guessLevels(use_, aa, landuseAt(c[0], c[1])); height = levels * 3.2; }
    const minH = num(t.min_height) ?? (num(t['building:min_level']) ? num(t['building:min_level']) * 3.2 : 0), roof = ROOF[t['roof:shape']] || (t['building:shape'] === 'dome' ? 'dome' : 'flat');
    const nm = (t.name || t['name:en']) ? namesOf(t) : null;
    B.push({ osm: b.osm, ring, holes: b.holes || [], c, a: aa, levels: Math.max(1, Math.round(levels)), height: r1(height), minHeight: r1(minH || 0), use: use_, roof, name: nm, src: 'osm', hsrc, wikidata: t.wikidata || null, t });
  }
  // two footprints that overlap: the smaller one goes (OSM has duplicates and building parts mapped twice)
  { B.sort((p, q) => q.a - p.a); const cell = 100, grid = new Map(), dead = new Set(); const key = (i, j) => i + ',' + j;
    B.forEach((b, bi) => { const [cx, cz] = b.c; let hit = false; for (let i = Math.floor(cx / cell) - 1; i <= Math.floor(cx / cell) + 1 && !hit; i++) for (let j = Math.floor(cz / cell) - 1; j <= Math.floor(cz / cell) + 1 && !hit; j++) { const g = grid.get(key(i, j)); if (g) for (const o of g) { if (dead.has(o) || B[o].a < b.a) continue; const ob = B[o]; if (pointInRing(cx, cz, ob.ring) || pointInRing(ob.c[0], ob.c[1], b.ring)) { hit = true; break; } } }
      if (hit) { dead.add(bi); stats.overlap++; return; } const k = key(Math.floor(cx / cell), Math.floor(cz / cell)); let g = grid.get(k); if (!g) grid.set(k, g = []); g.push(bi); });
    for (let i = B.length - 1; i >= 0; i--) if (dead.has(i)) B.splice(i, 1); }
  log('buildings kept', B.length, JSON.stringify(stats));

  /* ---------- POIs and landmark resolution ---------- */
  const cand = [];
  for (const p of poiNodes) { const x = X(p.lon), z = Z(p.lat); if (inside(x, z)) cand.push({ osm: 'n' + p.id, x, z, ring: null, cls: p.cls, t: p.t }); }
  for (const p of poiWays) { const c = centroid(p.pts); if (inside(c[0], c[1])) cand.push({ osm: p.osm, x: c[0], z: c[1], ring: p.pts, cls: p.cls, t: p.t }); }
  cand.sort((a, b) => a.osm.localeCompare(b.osm));
  let landmarks = null;
  if (landmarkInfo) { landmarks = resolveLandmarks(landmarkInfo, cand, { X, Z, edges, edgeGeom, names, buildings: B, log }); log('landmarks resolved', landmarks.list.length, 'unresolved', landmarks.unresolved.length); }
  const lmByBuilding = new Map(), lmRings = [];
  if (landmarks) for (const l of landmarks.list) { if (l.footprint && l.footprint.length >= 6) lmRings.push({ id: l.id, ring: l.footprint, bb: bbox(l.footprint) }); for (const o of l._osm || []) lmByBuilding.set(o, l.id); }
  for (const b of B) { let id = lmByBuilding.get(b.osm) || null; if (!id) for (const r of lmRings) if (b.c[0] >= r.bb[0] && b.c[0] <= r.bb[2] && b.c[1] >= r.bb[1] && b.c[1] <= r.bb[3] && pointInRing(b.c[0], b.c[1], r.ring)) { id = r.id; break; } b.landmark = id; }

  const pois = []; const importance = c => { const t = c.t; let s = 0; if (t.wikidata) s += 2; if (t.wikipedia) s += 1; if (/attraction|fort|monument|memorial|museum|tomb|archaeological|stadium|zoo|terminal|aerodrome|mall|university/.test(c.cls)) s += 1; if (c.cls === 'station' && t.name) s += 1; return Math.min(5, s); };
  for (const c of cand) { const imp = importance(c); if (c.cls === 'worship' && !c.t.wikidata && !/mandir|masjid|gurudwara|gurdwara|church|temple|jama|dargah/i.test(c.t.name || '')) continue; if (c.cls.startsWith('historic:') && ['wayside_shrine', 'wayside_cross', 'boundary_stone', 'milestone', 'memorial'].includes(c.cls.slice(9)) && !c.t.wikidata && !c.t.wikipedia) continue; pois.push({ id: c.osm, class: c.cls, name: namesOf(c.t), x: r1(c.x), z: r1(c.z), importance: imp, osm: c.osm, wikidata: c.t.wikidata || null }); }

  /* ---------- tiles ---------- */
  log('tiles');
  const tiles = new Map(); const tile = (tx, tz) => { const k = tx + '_' + tz; let t = tiles.get(k); if (!t) tiles.set(k, t = { tx, tz, streets: [], blocks: [], buildings: [], landuse: [], parks: [], water: [], waterways: [], pois: [], furniture: [] }); return t; };
  const tOf = (x, z) => tile(Math.floor(x / TILE), Math.floor(z / TILE));
  edgeGeom.forEach((g, i) => { for (const pc of splitLine(g.pts, TILE)) { const o = { id: i, pts: pc.pts.map(r1) }; if (g.width !== g.defW) o.width = g.width; if (g.sidewalk !== DEFAULT_SIDEWALK[g.cls]) o.sidewalk = g.sidewalk; if (g.markings !== 'none') o.markings = g.markings; if (g.surface !== 'asphalt' && g.surface !== 'paved') o.surface = g.surface; if (pc.clipA || pc.clipB) o.clip = (pc.clipA ? 1 : 0) | (pc.clipB ? 2 : 0); tile(pc.tx, pc.tz).streets.push(o); } });
  let bid = 0; blocks.forEach(b => { let ring = simplifyRing(b.ring, 3).map(r1); if (selfIntersects(ring)) ring = b.ring.map(r1); if (selfIntersects(ring)) { stats.badBlock++; return; } const c = centroid(ring), t = tOf(c[0], c[1]); t.blocks.push({ id: bid++, ring, holes: [], landuse: b.landuse }); });
  B.forEach((b, i) => { const o = { id: i, ring: b.ring.map(r1), levels: b.levels, height: b.height, use: b.use, osm: b.osm[0] === 'w' ? +b.osm.slice(1) : b.osm }; if (b.roof !== 'flat') o.roof = b.roof; if (b.hsrc !== 'guess') o.hsrc = b.hsrc; if (b.holes.length) o.holes = b.holes.map(h => h.map(r1)); if (b.minHeight) o.minHeight = b.minHeight; if (b.name) o.name = b.name; if (b.landmark) o.landmark = b.landmark; tOf(b.c[0], b.c[1]).buildings.push(o); });
  const clipArea = (a, key, cls) => {
    const ring = a.rings[0]; if (area(ring) < 0) a.rings = a.rings.map(reverse); const bb = bbox(a.rings[0]), tx0 = Math.floor(bb[0] / TILE), tx1 = Math.floor(bb[2] / TILE), tz0 = Math.floor(bb[1] / TILE), tz1 = Math.floor(bb[3] / TILE); const nm = (a.t.name || a.t['name:en']) ? namesOf(a.t) : null;
    for (let tx = tx0; tx <= tx1; tx++) for (let tz = tz0; tz <= tz1; tz++) {
      const single = tx0 === tx1 && tz0 === tz1, x0 = tx * TILE, z0 = tz * TILE, outer = single ? a.rings[0] : clipRing(a.rings[0], x0, z0, x0 + TILE, z0 + TILE); if (outer.length < 6 || Math.abs(area(outer)) < 4) continue;
      const holes = a.rings.slice(1).map(h => single ? h : clipRing(h, x0, z0, x0 + TILE, z0 + TILE)).filter(h => h.length >= 6 && Math.abs(area(h)) >= 4);
      let ring = simplifyRing(outer, 1.0).map(r1); if (selfIntersects(ring)) ring = outer.map(r1); if (selfIntersects(ring)) continue; const o = { ring, holes: holes.map(h => simplifyRing(h, 1.0).map(r1)).filter(h => !selfIntersects(h)), class: cls, osm: a.osm }; if (nm) o.name = nm; tile(tx, tz)[key].push(o);
    }
  };
  const inCity = a => { const c = centroid(a.rings[0]); const bb = bbox(a.rings[0]); return buf.has(c[0], c[1]) || mask.has(bb[0], bb[1]) || mask.has(bb[2], bb[3]) || mask.has(bb[0], bb[3]) || mask.has(bb[2], bb[1]); };
  for (const a of areas) { if (!inCity(a)) continue; const [k, cls] = a.cls.split(':'); if (Math.abs(area(a.rings[0])) < 30) continue; clipArea(a, k, cls); }
  for (const w of waterLines) { if (!keepRoad({ pts: w.pts })) continue; for (const pc of splitLine(simplify(w.pts, 1), TILE)) tile(pc.tx, pc.tz).waterways.push({ pts: pc.pts.map(r1), class: w.cls, name: w.name || undefined }); }
  for (const p of pois) tOf(p.x, p.z).pois.push(p);
  for (const f of furn) { const x = X(f.lon), z = Z(f.lat); if (!inside(x, z)) continue; const o = { kind: f.k, x: r1(x), z: r1(z) }; if (f.name) o.name = f.name; tOf(x, z).furniture.push(o); }

  /* ---------- write ---------- */
  log('writing');
  if (existsSync(path.join(outDir, 'tiles'))) rmSync(path.join(outDir, 'tiles'), { recursive: true });
  mkdirSync(path.join(outDir, 'tiles'), { recursive: true });
  const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
  const tileList = [], hashes = {}; let totalBytes = 0, totalGz = 0;
  const keys = [...tiles.keys()].sort((a, b) => { const [ax, az] = a.split('_').map(Number), [bx, bz] = b.split('_').map(Number); return ax - bx || az - bz; });
  let bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const k of keys) {
    const t = tiles.get(k); if (!t.streets.length && !t.buildings.length && !t.blocks.length && !t.landuse.length && !t.parks.length && !t.water.length && !t.pois.length) continue;
    t.streets.sort((a, b) => a.id - b.id); const json = JSON.stringify(encodeTile({ format: PACK_FORMAT, tx: t.tx, tz: t.tz, streets: t.streets, blocks: t.blocks, buildings: t.buildings, landuse: t.landuse, parks: t.parks, water: t.water, waterways: t.waterways, pois: t.pois, furniture: t.furniture }, TILE));
    writeFileSync(path.join(outDir, 'tiles', k + '.json'), json); const gz = gzipSync(json, { level: 9 }).length; const jb = Buffer.byteLength(json); totalBytes += jb; totalGz += gz; hashes['tiles/' + k + '.json'] = sha(json);
    tileList.push({ tx: t.tx, tz: t.tz, bytes: jb, gz, buildings: t.buildings.length });
    bb[0] = Math.min(bb[0], t.tx * TILE); bb[1] = Math.min(bb[1], t.tz * TILE); bb[2] = Math.max(bb[2], (t.tx + 1) * TILE); bb[3] = Math.max(bb[3], (t.tz + 1) * TILE);
  }
  const graphJson = JSON.stringify(encodeGraph({ format: PACK_FORMAT, nodes: gnodes, edges, names, restrictions: [] })); writeFileSync(path.join(outDir, 'graph.json'), graphJson); hashes['graph.json'] = sha(graphJson);
  const graphGz = gzipSync(graphJson, { level: 9 }).length; totalBytes += Buffer.byteLength(graphJson); totalGz += graphGz;
  let landmarksGz = 0; if (landmarks) { const lj = JSON.stringify({ format: PACK_FORMAT, landmarks: landmarks.list.map(({ _osm, ...l }) => l) }); writeFileSync(path.join(outDir, 'landmarks.json'), lj); hashes['landmarks.json'] = sha(lj); landmarksGz = gzipSync(lj, { level: 9 }).length; totalBytes += Buffer.byteLength(lj); totalGz += landmarksGz; }
  const snap = (lat, lon) => { const x = X(lon), z = Z(lat); let best = null, bd = 1e9; for (let i = 0; i < edgeGeom.length; i++) { const g = edgeGeom[i]; if (g.cls === 'footway' || g.cls === 'cycleway' || g.layer !== 0) continue; const p = g.pts; for (let k = 0; k + 3 < p.length; k += 2) { const mx = (p[k] + p[k + 2]) / 2, mz = (p[k + 1] + p[k + 3]) / 2, d = Math.hypot(mx - x, mz - z); if (d < bd) { bd = d; best = [p[k], p[k + 1], p[k + 2], p[k + 3]]; } } } return { x, z, yaw: best ? +Math.atan2(best[2] - best[0], -(best[3] - best[1])).toFixed(3) : 0, d: bd }; };
  const spawns = C.spawns.map(s => { const q = snap(s.lat, s.lon); return { id: s.id, name: s.name, x: r1(q.x), z: r1(q.z), yaw: q.yaw }; });
  const cuts = [`building footprints under ${MIN_BUILDING_AREA} m2 dropped (${stats.tooSmall})`, `blocks under ${MIN_BLOCK_AREA} m2 dropped, footprints simplified to ${BUILDING_EPS} m, block rings to 3 m, landuse rings to 1 m, street lines to 0.7 m`, `${stats.badBlock} blocks and ${stats.badRing} footprints dropped because simplification made their ring cross itself`, `${stats.onStreet} footprints mostly on a street dropped, ${stats.overlap} duplicate or overlapping footprints dropped (the smaller), ${stats.touchStreet} touch a street and are kept`, 'blocks are the faces of the street graph (motorway to residential, ground level only); service roads and footpaths do not cut blocks', 'no building parts (building:part), no indoor mapping, no railway or metro (transit.json, package D2), no bus routes (D3)'];
  const manifest = { format: PACK_FORMAT, id: C.id, name: C.name, cityId: C.cityId, origin: C.origin, bbox: bb, drive: C.drive, tileSize: TILE, ringOrder: 'ccw by shoelace in (x, z)', encoding: 'enc 1: coordinate lists are delta-coded integers in decimetres from the tile origin (tiles) or the pack origin (graph); see tools/lib/packio.mjs', defaults: { building: { roof: 'flat', hsrc: 'guess', src: 'osm', minHeight: 0, landmark: null }, street: { markings: 'none', surface: 'asphalt (paved for footways)', width: 'lanes x laneWidth[class], see tools/lib/packio.mjs', sidewalk: 'by class, see tools/lib/packio.mjs' }, laneWidth: LANE_W_, sidewalk: DEFAULT_SIDEWALK }, bearing: 'radians clockwise from north (z negative)', tiles: tileList, gates: gateOut, rail_gates: [], spawns,
    extract: { source: 'OpenStreetMap via Geofabrik northern-zone extract', date: extractDate, url: extractUrl, sha256: extractSha, bytes: extractBytes }, licence: 'ODbL 1.0',
    builder: { tool: 'tools/build_city.mjs', version: BUILDER_VERSION, minBuildingArea: MIN_BUILDING_AREA, buildingEps: BUILDING_EPS },
    counts: { edges: edges.length, nodes: gnodes.length, blocks: bid, buildings: B.length, pois: pois.length, landmarks: landmarks ? landmarks.list.length : 0, tiles: tileList.length, bytes: totalBytes, gzBytes: totalGz, graphGz, landmarksGz },
    heights: { tag: stats.hTag, levels: stats.hLevels, guess: stats.hGuess }, conflicts: { streetDropped: stats.onStreet, streetTouching: stats.touchStreet, overlapDropped: stats.overlap, tooSmallDropped: stats.tooSmall }, cuts, hashes };
  manifest.packHash = sha(Object.keys(hashes).sort().map(k => k + hashes[k]).join(''));
  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest));
  writeFileSync(path.join(outDir, 'ATTRIBUTION.txt'), `Map data © OpenStreetMap contributors, available under the Open Database Licence (ODbL 1.0): https://www.openstreetmap.org/copyright\nExtract: ${manifest.extract.source}, ${extractDate}, ${extractUrl}, sha256 ${extractSha}.\nThis pack is a derived database; it is shared under the ODbL as well (share-alike). Built by tools/build_city.mjs ${BUILDER_VERSION}.\n${landmarks ? 'Landmark data also draws on Wikidata (CC0): https://www.wikidata.org . Landmark text is written for this game.\n' : ''}Building heights are real only where OSM tags say so (see manifest heights: tag, levels, guess).\n`);
  log('done', JSON.stringify(manifest.counts));
  if (landmarks && landmarks.unresolved.length) log('landmarks not resolved from OSM (kept with the position given):', landmarks.unresolved.join(', '));
  console.log(JSON.stringify({ edges: edges.length, nodes: gnodes.length, blocks: bid, buildings: B.length, pois: pois.length, tiles: tileList.length, gates: gateOut.length, rawMB: +(totalBytes / 1e6).toFixed(1), gzMB: +(totalGz / 1e6).toFixed(1), heights: manifest.heights, conflicts: manifest.conflicts }));
}

function reverse(p) { const o = []; for (let i = p.length - 2; i >= 0; i -= 2) o.push(p[i], p[i + 1]); return o; }
/* grow a ring outwards by d metres (vertex normals; fine for a coarse buffer around a big polygon) */
function offsetRing(p, d) {
  const n = p.length / 2, ccw = area(p) > 0, o = [];
  for (let i = 0; i < n; i++) { const a = (i + n - 1) % n, b = (i + 1) % n, dx = p[b * 2] - p[a * 2], dz = p[b * 2 + 1] - p[a * 2 + 1], l = Math.hypot(dx, dz) || 1, nx = dz / l, nz = -dx / l, s = ccw ? 1 : -1; o.push(p[i * 2] + nx * d * s, p[i * 2 + 1] + nz * d * s); }
  return area(o) * area(p) > 0 && Math.abs(area(o)) >= Math.abs(area(p)) ? o : o.map((v, i) => v);
}
function guessLevels(use, a, lu) {
  if (use === 'residential') return a < 40 ? 2 : a < 120 ? 3 : a < 400 ? 4 : 5; if (use === 'industrial') return 1; if (use === 'religious') return a > 400 ? 2 : 1;
  if (use === 'retail') return a < 80 ? 2 : 3; if (use === 'commercial') return a < 200 ? 3 : 4; void lu; return LEVEL_GUESS[use] || 2;
}

/* ---- faces of the street graph = blocks ---- */
function extractBlocks(edges, edgeGeom, gnodes, classes) {
  const adj = new Map(); const addDir = (a, b, e, fwd) => { let l = adj.get(a); if (!l) adj.set(a, l = []); l.push({ to: b, e, fwd }); };
  const E = []; edges.forEach((e, i) => { if (!classes.has(e[3]) || e[8] !== 0 || (e[9] & 2) || e[1] === e[2]) return; E.push(i); addDir(e[1], e[2], i, true); addDir(e[2], e[1], i, false); });
  // prune dead ends (cul-de-sacs would draw spikes into the face ring)
  const deg = n => (adj.get(n) || []).length; const stack = [...adj.keys()].filter(n => deg(n) === 1);
  const dead = new Set(); while (stack.length) { const n = stack.pop(); const l = adj.get(n); if (!l || l.length !== 1) continue; const { to, e } = l[0]; dead.add(e); adj.delete(n); const m = adj.get(to); const k = m.findIndex(h => h.e === e && h.to === n); if (k >= 0) m.splice(k, 1); if (m.length === 1) stack.push(to); else if (!m.length) adj.delete(to); }
  const dirPts = (h, from) => { const p = edgeGeom[h.e].pts; return h.fwd ? p : (() => { const q = []; for (let i = p.length - 2; i >= 0; i -= 2) q.push(p[i], p[i + 1]); return q; })(); };
  const ang = (h, from) => { const p = edgeGeom[h.e].pts, i = h.fwd ? 0 : p.length - 2; const x0 = p[i], z0 = p[i + 1], j = h.fwd ? 2 : p.length - 4; return Math.atan2(p[j + 1] - z0, p[j] - x0); };
  for (const l of adj.values()) { for (const h of l) h.a = ang(h); l.sort((p, q) => p.a - q.a); }
  const used = new Set(), faces = [];
  for (const [n0, l0] of adj) for (const h0 of l0) {
    const key0 = h0.e + (h0.fwd ? 'f' : 'r'); if (used.has(key0)) continue; const ring = []; let h = h0, from = n0, guard = 0, ok = true;
    while (guard++ < 5000) {
      const key = h.e + (h.fwd ? 'f' : 'r'); if (used.has(key)) { ok = key === key0; break; } used.add(key);
      const pts = dirPts(h, from); for (let i = 0; i < pts.length - 2; i += 2) ring.push(pts[i], pts[i + 1]);
      const at = h.to, l = adj.get(at); if (!l) { ok = false; break; }
      // arrive at `at` along h; the next edge is the first one clockwise from the reverse of h, i.e. the previous in angle order
      const idx = l.findIndex(x => x.e === h.e && x.to === from); if (idx < 0) { ok = false; break; }
      const nxt = l[(idx + l.length - 1) % l.length]; from = at; h = nxt; if (h.e + (h.fwd ? 'f' : 'r') === key0 && from === n0) { ok = true; break; }
    }
    if (ok && ring.length >= 6) faces.push(ring);
  }
  // the bounded faces all share one sign; the outer faces have the other (and are huge or few)
  const out = []; let pos = 0, neg = 0; for (const f of faces) { if (area(f) > 0) pos++; else neg++; }
  const keepSign = pos >= neg ? 1 : -1;
  for (const f of faces) { const a = area(f) * keepSign; if (a < 20 || a > 4e6) continue; out.push({ ring: keepSign > 0 ? f : reverse(f) }); }
  return out;
}

if (import.meta.url === 'file://' + process.argv[1]) main();
