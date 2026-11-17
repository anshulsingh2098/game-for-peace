#!/usr/bin/env node
/* Validates a city pack (docs/CITY_PACK.md section 7). Run: node tools/validate_city.mjs [assets/cities/delhi] [--quick]
   Checks: schema and references (graph, gates, spawns, tiles, landmarks), file hashes against the manifest, builder version, geometry (inside the bbox and the tile, rings, areas, self-crossings),
   overlaps (footprints against streets through the keep-out registry, footprints against each other), counts, and sizes against the budget (CITY_PACK section 4).
   Exported as validatePack() so tools/selftest.mjs can run the same checks (quick mode samples tiles). Exit code 1 when there is an error. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { area, centroid, selfIntersects, pointInRing } from './lib/geom.mjs';
import { KeepOut } from '../src/world/keepout.js';
import { BUILDER_VERSION, PACK_FORMAT } from './build_city.mjs';
import { decodeTile, decodeGraph, streetWidth, corridorHw, CONFLICT_CLASSES, streetConflict, droppedForStreet } from './lib/packio.mjs';

export const BUDGET = { maxGzBytes: 20e6, maxPackGzBytes: 30e6, maxTileBytes: 4e6, maxGraphGz: 3.5e6, maxTileBuildings: 6000 };
const CLASSES = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'footway', 'cycleway', 'busway']);
const USES = new Set(['residential', 'commercial', 'office', 'retail', 'civic', 'religious', 'industrial', 'hotel', 'transit', 'other']);
const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 16);

export function validatePack(dir, opts = {}) {
  const errors = [], warnings = [], stats = {}, err = m => { if (errors.length < 60) errors.push(m); }, warn = m => { if (warnings.length < 60) warnings.push(m); };
  const rd = f => readFileSync(path.join(dir, f));
  if (!existsSync(path.join(dir, 'manifest.json'))) return { errors: ['no manifest.json in ' + dir], warnings, stats };
  const mBuf = rd('manifest.json'), M = JSON.parse(mBuf);
  for (const k of ['format', 'id', 'name', 'origin', 'bbox', 'tileSize', 'tiles', 'gates', 'spawns', 'extract', 'licence', 'builder', 'counts', 'hashes']) if (M[k] === undefined) err('manifest: missing ' + k);
  if (errors.length) return { errors, warnings, stats };
  if (M.format !== PACK_FORMAT) err(`manifest: format ${M.format}, the tool writes ${PACK_FORMAT}`);
  if (M.builder.version !== BUILDER_VERSION) err(`pack was built by tool version ${M.builder.version}, the tool is ${BUILDER_VERSION}: rebuild (node tools/build_city.mjs ${M.id} ...)`);
  if (M.licence !== 'ODbL 1.0') err('manifest: licence must be ODbL 1.0');
  if (!/^[0-9a-f]{64}$/.test(M.extract.sha256 || '')) err('manifest: extract.sha256 missing');
  if (!existsSync(path.join(dir, 'ATTRIBUTION.txt'))) err('ATTRIBUTION.txt missing'); else if (!/OpenStreetMap/.test(readFileSync(path.join(dir, 'ATTRIBUTION.txt'), 'utf8'))) err('ATTRIBUTION.txt does not credit OpenStreetMap');
  const TS = M.tileSize, [bx0, bz0, bx1, bz1] = M.bbox, inBox = (x, z, e = 0.5) => x >= bx0 - e && x <= bx1 + e && z >= bz0 - e && z <= bz1 + e;

  /* hashes: every file named in the manifest matches, and no file is missing or extra */
  let gzTotal = 0, rawTotal = 0;
  for (const [f, h] of Object.entries(M.hashes)) { if (!existsSync(path.join(dir, f))) { err('missing file ' + f); continue; } const b = rd(f); if (sha(b) !== h) err('hash differs: ' + f + ' (the pack was edited or is stale)'); }
  const extra = existsSync(path.join(dir, 'tiles')) ? readdirSync(path.join(dir, 'tiles')).filter(f => !M.hashes['tiles/' + f]) : []; if (extra.length) err('tile files not in the manifest: ' + extra.slice(0, 3).join(', '));
  if (M.tiles.length !== M.counts.tiles) err('manifest: tiles list and counts.tiles differ');
  const pk = sha(Object.keys(M.hashes).sort().map(k => k + M.hashes[k]).join('')); if (pk !== M.packHash) err('manifest: packHash differs from its files');

  /* graph */
  const G = decodeGraph(JSON.parse(rd('graph.json'))); const gGz = gzipSync(rd('graph.json')).length; gzTotal += gGz; rawTotal += rd('graph.json').length;
  if (G.format !== PACK_FORMAT) err('graph: format');
  const nn = G.nodes.length; G.nodes.forEach((n, i) => { if (n[0] !== i) err('graph: node id ' + n[0] + ' at ' + i); if (!inBox(n[1], n[2])) err('graph: node ' + i + ' outside the bbox'); });
  const edgeLen = new Float64Array(G.edges.length); let zeroLen = 0;
  G.edges.forEach((e, i) => {
    if (e[0] !== i) err('graph: edge id ' + e[0] + ' at ' + i); if (!(e[1] >= 0 && e[1] < nn && e[2] >= 0 && e[2] < nn)) err('graph: edge ' + i + ' has a bad node'); if (!CLASSES.has(e[3])) err('graph: edge ' + i + ' class ' + e[3]);
    if (!(e[4] >= 1 && e[4] <= 12)) err('graph: edge ' + i + ' lanes ' + e[4]); if (![-1, 0, 1].includes(e[5])) err('graph: edge ' + i + ' oneway'); if (!(e[7] > 0)) zeroLen++; if (e[10] >= G.names.length) err('graph: edge ' + i + ' name index'); edgeLen[i] = e[7];
  });
  if (zeroLen) err('graph: ' + zeroLen + ' edges with length 0');
  if (G.edges.length !== M.counts.edges || nn !== M.counts.nodes) err('manifest counts differ from the graph');
  if (gGz > BUDGET.maxGraphGz) err(`graph.json is ${(gGz / 1e6).toFixed(1)} MB gzip, budget ${BUDGET.maxGraphGz / 1e6} MB`);
  const ids = new Set(); for (const g of M.gates) { if (ids.has(g.id)) err('gate id twice: ' + g.id); ids.add(g.id); if (!(g.street >= 0 && g.street < G.edges.length)) err('gate ' + g.id + ': street does not exist'); if (!inBox(g.x, g.z)) err('gate ' + g.id + ' outside the bbox'); }
  if (!M.gates.length) warn('no gates (no motorway, trunk or primary road crosses the boundary)');
  for (const s of M.spawns) if (!inBox(s.x, s.z)) err('spawn ' + s.id + ' outside the bbox');

  /* tiles */
  let selfBlocks = 0, selfAreas = 0, selfBld = 0; const quick = !!opts.quick, ko = new KeepOut(), seenB = new Set(), seenEdge = new Uint8Array(G.edges.length); let nB = 0, nStreets = 0, nBlocks = 0, nPoi = 0, maxTile = 0, maxTileB = 0, conflicts = 0, selfX = 0, smallB = 0, badRing = 0, tilesRead = 0, overlapB = 0, outTile = 0, badHeight = 0, badUse = 0;
  const list = M.tiles.slice().sort((a, b) => a.tx - b.tx || a.tz - b.tz), step = quick ? Math.max(1, Math.floor(list.length / 40)) : 1;
  for (let ti = 0; ti < list.length; ti += step) {
    const T = list[ti], f = 'tiles/' + T.tx + '_' + T.tz + '.json'; if (!existsSync(path.join(dir, f))) { err('tile missing: ' + f); continue; }
    const raw = rd(f), tj = decodeTile(JSON.parse(raw), TS); tilesRead++; if (raw.length !== T.bytes) err(f + ': bytes differ from the manifest'); maxTile = Math.max(maxTile, raw.length); if (!quick) { gzTotal += gzipSync(raw).length; rawTotal += raw.length; }
    if (tj.tx !== T.tx || tj.tz !== T.tz) err(f + ': wrong tile coordinates'); if (tj.buildings.length !== T.buildings) err(f + ': building count differs from the manifest'); maxTileB = Math.max(maxTileB, tj.buildings.length);
    const x0 = T.tx * TS, z0 = T.tz * TS, inTile = (x, z, e = 0.6) => x >= x0 - e && x <= x0 + TS + e && z >= z0 - e && z <= z0 + TS + e;
    for (const s of tj.streets) {
      nStreets++; if (!(s.id >= 0 && s.id < G.edges.length)) { err(f + ': street edge ' + s.id); continue; } seenEdge[s.id] = 1; if (s.pts.length < 4) err(f + ': street ' + s.id + ' under 2 points'); 
      for (let i = 0; i < s.pts.length; i += 2) if (!inTile(s.pts[i], s.pts[i + 1])) { outTile++; break; }
      const ge = G.edges[s.id]; if (!(streetWidth(s, ge) > 0)) err(f + ': street ' + s.id + ' width'); if (ge[8] === 0 && CONFLICT_CLASSES.has(ge[3])) for (let i = 0; i + 3 < s.pts.length; i += 2) ko.add('s' + s.id, 'road', { t: 'line', pts: s.pts.slice(i, i + 4), hw: corridorHw(ge[3], streetWidth(s, ge)) });
    }
    for (const b of tj.blocks) { nBlocks++; if (b.ring.length < 6) badRing++; else if (b.ring.length <= 400 && selfIntersects(b.ring)) { selfX++; selfBlocks++; } }
    for (const a of [...tj.landuse, ...tj.parks, ...tj.water]) { if (a.ring.length < 6) { badRing++; continue; } if (Math.abs(area(a.ring)) < 4) badRing++; for (let i = 0; i < a.ring.length; i += 2) if (!inTile(a.ring[i], a.ring[i + 1], 1.2)) { outTile++; break; } if (a.ring.length <= 300 && selfIntersects(a.ring)) { selfX++; selfAreas++; } }
    const placed = [];
    for (const b of tj.buildings) {
      nB++; if (seenB.has(b.id)) err('building id twice: ' + b.id); seenB.add(b.id);
      if (b.ring.length < 6) { badRing++; continue; } const a = area(b.ring); if (a <= 0) badRing++; else if (a < 4) smallB++; if (b.ring.length <= 200 && selfIntersects(b.ring)) { selfX++; selfBld++; }
      if (!(b.height > 0 && b.height < 600) || !(b.levels >= 1)) badHeight++; if (!USES.has(b.use)) badUse++;
      const c = centroid(b.ring); if (!inTile(c[0], c[1], 0.01)) outTile++; if (!inBox(c[0], c[1])) err('building ' + b.id + ' outside the bbox');
      if (droppedForStreet(streetConflict(b.ring, c, ko))) conflicts++;
      placed.push({ c, ring: b.ring, a });
    }
    if (placed.length < 3000) for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) { const p = placed[i], q = placed[j]; if (Math.abs(p.c[0] - q.c[0]) > 80 || Math.abs(p.c[1] - q.c[1]) > 80) continue; if (pointInRing(p.c[0], p.c[1], q.ring) || pointInRing(q.c[0], q.c[1], p.ring)) overlapB++; }
    for (const p of [...tj.pois]) { nPoi++; if (!inBox(p.x, p.z)) err('poi ' + p.id + ' outside the bbox'); }
    for (const k of tj.streets) ko.removeOwner('s' + k.id);                 // tile by tile: neighbouring tiles' streets are not loaded, so a building on a tile edge is only checked against its own tile
  }
  if (!quick) {
    for (let i = 0; i < seenEdge.length; i++) if (!seenEdge[i]) { err('edge ' + i + ' has no street piece in any tile'); break; }
    if (nB !== M.counts.buildings) err(`buildings: tiles hold ${nB}, manifest says ${M.counts.buildings}`); if (nPoi !== M.counts.pois) err(`pois: tiles hold ${nPoi}, manifest says ${M.counts.pois}`); if (nBlocks !== M.counts.blocks) err(`blocks: tiles hold ${nBlocks}, manifest says ${M.counts.blocks}`);
    if (M.counts.landmarks && existsSync(path.join(dir, 'landmarks.json'))) { const L = JSON.parse(rd('landmarks.json')); gzTotal += gzipSync(rd('landmarks.json')).length; rawTotal += rd('landmarks.json').length; if (L.landmarks.length !== M.counts.landmarks) err('landmarks count differs');
      const lid = new Set(); for (const l of L.landmarks) { if (lid.has(l.id)) err('landmark id twice ' + l.id); lid.add(l.id); if (!inBox(l.x, l.z)) err('landmark ' + l.id + ' outside the bbox'); if (!l.card || !l.card.text) err('landmark ' + l.id + ' has no card'); if (!l.name || !l.name.en) err('landmark ' + l.id + ' has no name'); if (!l.look) warn('landmark ' + l.id + ' has no look note'); }
      stats.landmarks = L.landmarks.length; }
    if (gzTotal > BUDGET.maxGzBytes) err(`pack is ${(gzTotal / 1e6).toFixed(1)} MB gzip, budget ${BUDGET.maxGzBytes / 1e6} MB for a Delhi NCR pack`); if (gzTotal > BUDGET.maxPackGzBytes) err('pack above 30 MB gzip');
  }
  if (maxTile > BUDGET.maxTileBytes) err(`a tile is ${(maxTile / 1e6).toFixed(1)} MB raw, budget ${BUDGET.maxTileBytes / 1e6} MB`); if (maxTileB > BUDGET.maxTileBuildings) warn(`a tile has ${maxTileB} buildings (more than ${BUDGET.maxTileBuildings})`);
  if (selfX) err(`${selfX} rings cross themselves (blocks ${selfBlocks}, landuse/parks/water ${selfAreas}, buildings ${selfBld})`); if (badRing) err(badRing + ' rings are degenerate (under 3 points, area under 4 m2 or clockwise buildings)'); if (outTile) err(outTile + ' objects lie outside their tile'); if (badHeight) err(badHeight + ' buildings with a bad height or levels'); if (badUse) err(badUse + ' buildings with an unknown use');
  const cr = nB ? conflicts / nB : 0; if (cr > 0.01) err(`${conflicts} buildings (${(cr * 100).toFixed(2)} %) stand mostly on a street (limit 1 %)`); else if (conflicts) warn(conflicts + ' buildings stand mostly on a street (tile edges)');
  const orate = nB ? overlapB / nB : 0; if (orate > 0.01) err(`${overlapB} footprint overlaps (${(orate * 100).toFixed(2)} % of buildings, limit 1 %)`); else if (overlapB) warn(overlapB + ' footprint pairs overlap');
  const sr = nB ? smallB / nB : 0; if (sr > 0.01) err(smallB + ' footprints under 4 m2');
  Object.assign(stats, { tilesRead, tilesTotal: list.length, buildings: nB, streets: nStreets, blocks: nBlocks, pois: nPoi, maxTileKB: Math.round(maxTile / 1024), maxTileBuildings: maxTileB, conflicts, overlaps: overlapB, selfCrossing: selfX, gzMB: quick ? null : +(gzTotal / 1e6).toFixed(2), rawMB: quick ? null : +(rawTotal / 1e6).toFixed(1), graphGzKB: Math.round(gGz / 1024), packHash: M.packHash });
  return { errors, warnings, stats, manifest: M };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const dir = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || 'assets/cities/delhi', ''), r = validatePack(dir, { quick: process.argv.includes('--quick') });
  console.log(JSON.stringify(r.stats)); for (const w of r.warnings) console.log('warning:', w); for (const e of r.errors) console.log('ERROR:', e);
  console.log(r.errors.length ? `${r.errors.length} error(s)` : 'pack is valid'); process.exit(r.errors.length ? 1 : 0);
}
void fileURLToPath;
