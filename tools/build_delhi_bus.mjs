// Bus part of assets/cities/delhi/transit.json: stops, routes (as stop sequences), depots and terminals, from OpenStreetMap only
// (the Delhi Open Transit Data GTFS needs a click-through licence with a stated purpose and was NOT used: docs/DELHI_TRANSIT.md section 1).
// Raw inputs (tools/fetch_delhi_transit.mjs): bus_routes.json, bus_route_members.json, bus_member_nodes.json, bus_stops.json, bus_depots.json.
// Imported by tools/build_delhi_transit.mjs; returns null when the raw files are missing.
import fs from 'node:fs'; import path from 'node:path';
const OPERATOR = o => /delhi transport corporation|^dtc|\bdtc\b/i.test(o) ? 'dtc' : /dimts|cluster|delhi transit/i.test(o) ? 'cluster' : /haryana|gmcbl|gurugram/i.test(o) ? 'haryana' : /nmrc/i.test(o) ? 'noida' : null;
export function buildBus({ RAW, project, r1, dist, rd }) {
  const need = ['bus_routes.json', 'bus_route_members.json', 'bus_stops.json', 'bus_depots.json'];   // bus_member_nodes.json is optional: it adds the member stops outside the bus_stop query
  if (need.some(f => !fs.existsSync(path.join(RAW, f)))) { const e = new Error('bus raw files missing'); e.code = 'ERR_MODULE_NOT_FOUND'; throw e; }
  const relTags = new Map(rd('bus_routes.json').elements.map(e => [e.id, e.tags])), rels = rd('bus_route_members.json').elements;
  const nodes = new Map(); for (const f of ['bus_stops.json', 'bus_member_nodes.json']) if (fs.existsSync(path.join(RAW, f))) for (const e of rd(f).elements) { if (e.type === 'node') nodes.set(e.id, e); else if (e.center) nodes.set(e.type[0] + e.id, { lat: e.center.lat, lon: e.center.lon, tags: e.tags }); }
  const stops = [], stopIdx = new Map(); // [x, z, name] by index, only the stops some route uses
  const stopOf = id => { if (stopIdx.has(id)) return stopIdx.get(id); const n = nodes.get(id); if (!n || n.lat == null) return -1; const [x, z] = project(n.lat, n.lon); stops.push([r1(x), r1(z), (n.tags && n.tags.name) || '']); stopIdx.set(id, stops.length - 1); return stops.length - 1; };
  const routes = [];
  for (const rel of rels.sort((a, b) => a.id - b.id)) {
    const t = relTags.get(rel.id) || rel.tags || {}; const ref = (t.ref || '').toString().trim(); if (!ref) continue;
    const seq = []; for (const m of rel.members || []) if (m.type === 'node' && /^(stop|platform)/.test(m.role || '')) { const i = stopOf(m.ref); if (i >= 0 && seq[seq.length - 1] !== i) seq.push(i); }
    if (seq.length < 2) continue;
    const op = OPERATOR([t.operator, t.network, t.name].filter(Boolean).join(' ')) || 'unknown'; let km = 0; for (let i = 1; i < seq.length; i++) km += dist(stops[seq[i - 1]], stops[seq[i]]);
    routes.push({ ref, op, from: t.from || null, to: t.to || null, via: t.via || undefined, osm: rel.id, km: Math.round(km / 100) / 10, stops: seq });
  }
  routes.sort((a, b) => a.ref.localeCompare(b.ref, 'en', { numeric: true }) || a.osm - b.osm);
  /* depots and terminals */
  const raw = rd('bus_depots.json').elements.filter(e => e.type !== 'relation' && e.tags && e.tags.name), out = [], seen = [];
  for (const e of raw) {
    const n = e.tags.name, [la, lo] = e.center ? [e.center.lat, e.center.lon] : [e.lat, e.lon], [x, z] = project(la, lo);
    const kind = /depot|workshop/i.test(n) ? 'depot' : /ISBT|inter.?state|terminal|terminus|bus stand|bus station|bus adda/i.test(n) ? (/ISBT|inter.?state/i.test(n) ? 'isbt' : 'terminal') : null;
    if (!kind || e.tags.amenity === 'police') continue; const key = n.toLowerCase().replace(/[^a-z0-9]+/g, ''); if (seen.some(s => s.key === key && dist([s.x, s.z], [x, z]) < 400)) continue; seen.push({ key, x, z });
    out.push({ kind, name: n, x: r1(x), z: r1(z), operator: OPERATOR([e.tags.operator, e.tags.network, n].filter(Boolean).join(' ')) || null, osm: e.type[0] + e.id });
  }
  out.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  for (let i = out.length - 1; i > 0; i--) for (let j = 0; j < i; j++) if (out[i].kind === out[j].kind && dist([out[i].x, out[i].z], [out[j].x, out[j].z]) < (out[i].kind === 'isbt' ? 700 : 120)) { out.splice(i, 1); break; }   // one record per ISBT and per depot (OSM maps several nodes and buildings for each)
  out.splice(0, out.length, ...out.filter(p => !/workshop/i.test(p.name)));
  const byOp = {}; for (const r of routes) byOp[r.op] = (byOp[r.op] || 0) + 1;
  return {
    note: 'Routes are stop sequences (straight segments between stops), not road geometry: snap them to the pack street graph when a bus is driven. OSM carries no timetable or frequency; see docs/DELHI_TRANSIT.md.',
    operators: { dtc: { name: 'Delhi Transport Corporation', livery: 'green (DTC)', src: 'owner brief; to verify from reference photos' }, cluster: { name: 'Delhi cluster scheme (DIMTS)', livery: 'orange and red', src: 'owner brief; to verify from reference photos' } },
    routeCountByOperator: byOp, stops, routes, places: out,
  };
}
