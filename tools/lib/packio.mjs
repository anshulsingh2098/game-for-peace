/* Reading and writing the coordinate encoding of a city pack (format 1, `enc: 1`; docs/CITY_PACK.md section 5). Pure; used by tools/build_city.mjs, tools/validate_city.mjs, tools/selftest.mjs and the
   headless check. The loader in the game uses the same two functions (copy or import).
   enc 1: a coordinate list is stored as integers in decimetres (0.1 m), delta coded: [x0, z0, dx1, dz1, ...], x0 and z0 measured from the tile origin (tx * tileSize, tz * tileSize) in tiles and from the pack
   origin in graph.json. The gzip of a delta list is about 20 % smaller than the same numbers written out, and the numbers are exact (no float drift). */

export function enc(p, ox = 0, oz = 0) { const o = new Array(p.length); let px = 0, pz = 0; for (let i = 0; i < p.length; i += 2) { const x = Math.round((p[i] - ox) * 10), z = Math.round((p[i + 1] - oz) * 10); o[i] = x - px; o[i + 1] = z - pz; px = x; pz = z; } return o; }
export function dec(d, ox = 0, oz = 0) { const o = new Array(d.length); let x = 0, z = 0; for (let i = 0; i < d.length; i += 2) { x += d[i]; z += d[i + 1]; o[i] = ox + x / 10; o[i + 1] = oz + z / 10; } return o; }

const TILE_LISTS = ['streets', 'blocks', 'buildings', 'landuse', 'parks', 'water', 'waterways'];
/* tile object with absolute metres -> JSON-ready tile with enc 1 (and the other way) */
export function encodeTile(t, size) {
  const ox = t.tx * size, oz = t.tz * size, o = { ...t, enc: 1 };
  for (const k of TILE_LISTS) o[k] = t[k].map(e => { const n = { ...e }; if (n.pts) n.pts = enc(n.pts, ox, oz); if (n.ring) n.ring = enc(n.ring, ox, oz); if (n.holes) n.holes = n.holes.map(h => enc(h, ox, oz)); return n; });
  return o;
}
export function decodeTile(j, size) {
  if (j.enc !== 1) return j; const ox = j.tx * size, oz = j.tz * size, o = { ...j }; delete o.enc;
  for (const k of TILE_LISTS) o[k] = j[k].map(e => { const n = { ...e }; if (n.pts) n.pts = dec(n.pts, ox, oz); if (n.ring) n.ring = dec(n.ring, ox, oz); if (n.holes) n.holes = n.holes.map(h => dec(h, ox, oz)); return n; });
  return o;
}
/* graph: nodes [[id, x, z, flags], ...], edges [[id, a, b, class, lanes, oneway, speedKmh, lengthM, layer, flags, nameIndex], ...] <-> columns */
export const CLASS_LIST = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'footway', 'cycleway', 'busway'];
export function encodeGraph(g) {
  const nodes = { xz: enc(g.nodes.flatMap(n => [n[1], n[2]])), flags: g.nodes.map(n => n[3]) };
  const E = g.edges, a = [], d = [], cls = [], lanes = [], oneway = [], speed = [], len = [], layer = [], flags = [], name = []; let pa = 0;
  for (const e of E) { a.push(e[1] - pa); pa = e[1]; d.push(e[2] - e[1]); cls.push(CLASS_LIST.indexOf(e[3])); lanes.push(e[4]); oneway.push(e[5]); speed.push(e[6]); len.push(Math.round(e[7] * 10)); layer.push(e[8]); flags.push(e[9]); name.push(e[10]); }
  return { format: g.format, enc: 1, classes: CLASS_LIST, nodes, edges: { a, d, cls, lanes, oneway, speed, len, layer, flags, name }, names: g.names, restrictions: g.restrictions || [] };
}
export function decodeGraph(j) {
  if (j.enc !== 1) return j; const xz = dec(j.nodes.xz), nodes = j.nodes.flags.map((f, i) => [i, xz[i * 2], xz[i * 2 + 1], f]), c = j.edges, edges = []; let pa = 0;
  for (let i = 0; i < c.a.length; i++) { pa += c.a[i]; edges.push([i, pa, pa + c.d[i], j.classes[c.cls[i]], c.lanes[i], c.oneway[i], c.speed[i], c.len[i] / 10, c.layer[i], c.flags[i], c.name[i]]); }
  return { format: j.format, nodes, edges, names: j.names, restrictions: j.restrictions };
}

/* ---- shared by the builder and the validator so both mean the same by "a building stands on a street" ---- */
/* half width of the ground a street claims against buildings: 42 % of its guessed width, at most 1.8 m for lanes and service roads (their widths are guesses and OSM buildings abut them) */
export const corridorHw = (cls, width) => (cls === 'residential' || cls === 'service' ? Math.min(width * 0.42, 1.8) : width * 0.42);
export const CONFLICT_CLASSES = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential']);
/* ko: a KeepOut holding the streets as 'road' lines. Returns the share of boundary samples (vertices and edge midpoints) on a street and whether the centroid is on one. */
export function streetConflict(ring, c, ko) {
  let on = 0, tot = 0; const n = ring.length;
  for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; if (ko.point(ring[i], ring[i + 1], 0, { as: 'building' })) on++; if (ko.point((ring[i] + ring[j]) / 2, (ring[i + 1] + ring[j + 1]) / 2, 0, { as: 'building' })) on++; tot += 2; }
  return { share: on / tot, centre: !!ko.point(c[0], c[1], 0, { as: 'building' }) };
}
export const droppedForStreet = r => r.share >= 0.5 || r.centre;

/* ---- street widths: stored only when they differ from the class formula (saves about 1 MB gzip in Delhi) ---- */
export const LANE_W = { motorway: 3.5, trunk: 3.5, primary: 3.4, secondary: 3.2, tertiary: 3.0, residential: 2.8, service: 2.8, cycleway: 1.5, busway: 3.4, footway: 1.2 };
export const DEFAULT_SIDEWALK = { motorway: 0, trunk: 0, primary: 2, secondary: 2, tertiary: 2, residential: 1, service: 0, footway: 0, cycleway: 0, busway: 0 };
export const defaultWidth = (cls, lanes) => Math.max(1, Math.round(lanes * LANE_W[cls] * 10) / 10);
/* width and sidewalk of a street piece `s` (tile) on edge `e` (graph edge array) */
export const streetWidth = (s, e) => (s.width !== undefined ? s.width : defaultWidth(e[3], e[4]));
export const streetSidewalk = (s, e) => (s.sidewalk !== undefined ? s.sidewalk : DEFAULT_SIDEWALK[e[3]]);
