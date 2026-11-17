/* Audit of the Delhi pack for map irregularities a person would see, across ALL tiles, by class, with the real latitude and longitude of each hit (so a hit can be looked at in the game with
   the menu's coordinate line, or on any map). Run: node tools/audit_city.mjs [--write]   (--write regenerates docs/CITY_AUDIT.md and tools/city_audit_baseline.json)
   Classes (each has a rule in the generator that fixes it everywhere, or is listed as a data issue):
   park_building   a large building (2,500 m2 and up) mostly on a park, garden or sports area (a station, a landmark outline or a mis-tagged polygon drawn as a solid block over open ground)
   street_building a ground street whose centre line runs through a building footprint for 15 m or more (a mapped building on a road)
   void_block      a built-up block of 15,000 m2 and up with under 5 % of it covered by buildings (a big flat grey area; the infill rule of Phase P1 fills the frontage)
   landmark_offset a landmark whose listed position is more than 150 m from the centre of its footprint (labelled in the wrong place)
   footway_run     a footway that lies inside a carriageway for more than 16 m (it is drawn grey, not as a zebra crossing: the zebra rule only takes short crossings)
   selftest compares the counts with tools/city_audit_baseline.json: a class must not get worse. */
import fs from 'node:fs';
import { decodeTile, decodeGraphColumns, pieceWidth } from '../src/world/city/pack.js';

const base = new URL('../assets/cities/delhi', import.meta.url).pathname, man = JSON.parse(fs.readFileSync(base + '/manifest.json')), S = man.tileSize, O = man.origin;
const G = decodeGraphColumns(JSON.parse(fs.readFileSync(base + '/graph.json')));
const LM = JSON.parse(fs.readFileSync(base + '/landmarks.json')).landmarks;
const K = Math.PI / 180, RE = 6371008.8, ll = (x, z) => ({ lat: +(O.lat - z / (RE * K)).toFixed(5), lon: +(O.lon + x / (RE * Math.cos(O.lat * K) * K)).toFixed(5) });
const area = r => { let a = 0; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) a += r[j] * r[i + 1] - r[i] * r[j + 1]; return Math.abs(a) / 2; };
const pip = (r, x, z) => { let c = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { if ((r[i + 1] > z) !== (r[j + 1] > z) && x < (r[j] - r[i]) * (z - r[i + 1]) / (r[j + 1] - r[i + 1]) + r[i]) c = !c; } return c; };
const bb = r => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]); } return [x0, x1, z0, z1]; };
const cen = r => { let x = 0, z = 0; for (let i = 0; i < r.length; i += 2) { x += r[i]; z += r[i + 1]; } return [x / (r.length / 2), z / (r.length / 2)]; };
const ROADS = new Set(['primary', 'secondary', 'tertiary', 'residential']), hit = { park_building: [], street_building: [], void_block: [], landmark_offset: [], footway_run: [] };
const note = (k, x, z, what) => hit[k].push({ ...ll(x, z), x: Math.round(x), z: Math.round(z), what });

for (const l of LM) { if (!l.footprint || l.footprint.length < 6) continue; const c = cen(l.footprint), d = Math.hypot(c[0] - l.x, c[1] - l.z); if (d > 150) note('landmark_offset', l.x, l.z, `${l.id} listed ${Math.round(d)} m from its footprint centre`); }

let tiles = 0;
for (const m of man.tiles) {
  const t = decodeTile(JSON.parse(fs.readFileSync(`${base}/tiles/${m.tx}_${m.tz}.json`)), S); tiles++;
  const parks = (t.parks || []).map(p => ({ r: p.ring, b: bb(p.ring), name: p.name && p.name.en || p.class })), blds = (t.buildings || []).map(b => ({ r: b.ring, b: bb(b.ring), area: area(b.ring), b0: b }));
  // park_building
  for (const b of blds) { if (b.area < 2500) continue; let tot = 0, h = 0, pn = null; const [x0, x1, z0, z1] = b.b; for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { const x = x0 + (x1 - x0) * (i + .5) / 10, z = z0 + (z1 - z0) * (j + .5) / 10; if (!pip(b.r, x, z)) continue; tot++; for (const p of parks) { if (x < p.b[0] || x > p.b[1] || z < p.b[2] || z > p.b[3]) continue; if (pip(p.r, x, z)) { h++; pn = pn || p.name; break; } } } if (tot >= 10 && h / tot > 0.4 && !/stadium|sports|swimming|complex|ground/i.test(pn || '')) { const c = cen(b.r); note('park_building', c[0], c[1], `${Math.round(b.area)} m2 ${b.b0.use || ''} on ${pn}${b.b0.landmark ? ' (landmark ' + b.b0.landmark + ')' : ''}`); } }
  // street_building (grid of building boxes)
  const grid = new Map(), CELL = 32; for (const b of blds) for (let i = Math.floor(b.b[0] / CELL); i <= Math.floor(b.b[1] / CELL); i++) for (let j = Math.floor(b.b[2] / CELL); j <= Math.floor(b.b[3] / CELL); j++) { const k = i + ',' + j; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(b); }
  const inB = (x, z) => { const l = grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)); if (l) for (const b of l) if (x >= b.b[0] && x <= b.b[1] && z >= b.b[2] && z <= b.b[3] && pip(b.r, x, z)) return true; return false; };
  const roadSegs = [];
  for (const s of t.streets || []) { const cls = G.classes[G.cls[s.id]]; if (G.layer[s.id] !== 0 || !ROADS.has(cls)) continue; let run = 0, best = 0, bx = 0, bz = 0; const p = s.pts; for (let i = 0; i + 3 < p.length; i += 2) { const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], L = Math.hypot(dx, dz); for (let d = 0; d < L; d += 3) { const x = p[i] + dx * d / L, z = p[i + 1] + dz * d / L; if (inB(x, z)) { run += 3; if (run > best) { best = run; bx = x; bz = z; } } else run = 0; } } if (best >= 15) note('street_building', bx, bz, `${cls} #${s.id}: ${best} m of centre line inside a building`); const hw = pieceWidth(G, s) / 2; for (let i = 0; i + 3 < p.length; i += 2) roadSegs.push([p[i], p[i + 1], p[i + 2], p[i + 3], hw, s.id]); }
  // void_block
  for (const b of t.blocks || []) { if (!['urban', 'residential', 'commercial', 'retail', 'industrial', undefined].includes(b.landuse)) continue; const a = area(b.ring); if (a < 15000) continue; let cov = 0; const [x0, x1, z0, z1] = bb(b.ring); for (const bl of blds) { if (bl.b[1] < x0 || bl.b[0] > x1 || bl.b[3] < z0 || bl.b[2] > z1) continue; const c = cen(bl.r); if (pip(b.ring, c[0], c[1])) cov += bl.area; } if (cov / a < 0.05) { const c = cen(b.ring); note('void_block', c[0], c[1], `${Math.round(a)} m2 block with ${(100 * cov / a).toFixed(1)} % built`); } }
  // footway_run: a footway inside a carriageway for more than 16 m
  const sg = new Map(), CS = 24; for (const sgm of roadSegs) { for (let i = Math.floor((Math.min(sgm[0], sgm[2]) - 8) / CS); i <= Math.floor((Math.max(sgm[0], sgm[2]) + 8) / CS); i++) for (let j = Math.floor((Math.min(sgm[1], sgm[3]) - 8) / CS); j <= Math.floor((Math.max(sgm[1], sgm[3]) + 8) / CS); j++) { const k = i + ',' + j; let l = sg.get(k); if (!l) sg.set(k, l = []); l.push(sgm); } }
  for (const s of t.streets || []) { const cls = G.classes[G.cls[s.id]]; if (cls !== 'footway' || G.layer[s.id] !== 0) continue; const p = s.pts; let run = 0, best = 0, bx = 0, bz = 0; for (let i = 0; i + 3 < p.length; i += 2) { const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], L = Math.hypot(dx, dz); for (let d = 0; d < L; d += 2) { const x = p[i] + dx * d / L, z = p[i + 1] + dz * d / L, l = sg.get(Math.floor(x / CS) + ',' + Math.floor(z / CS)); let inside = false; if (l) for (const [x0, z0, x1, z1, hw] of l) { const ex = x1 - x0, ez = z1 - z0, L2 = ex * ex + ez * ez, tt = L2 ? Math.max(0, Math.min(1, ((x - x0) * ex + (z - z0) * ez) / L2)) : 0; if (Math.hypot(x - (x0 + ex * tt), z - (z0 + ez * tt)) < hw - 0.3) { inside = true; break; } } if (inside) { run += 2; if (run > best) { best = run; bx = x; bz = z; } } else run = 0; } } if (best > 16) note('footway_run', bx, bz, `footway #${s.id}: ${best} m inside a carriageway`); }
}

const CPx = 1045, CPz = -2102; for (const v of Object.values(hit)) v.sort((a, b) => Math.hypot(a.x - CPx, a.z - CPz) - Math.hypot(b.x - CPx, b.z - CPz));       // the ones nearest Connaught Place first
const counts = Object.fromEntries(Object.entries(hit).map(([k, v]) => [k, v.length]));
if (process.argv.includes('--json')) { console.log(JSON.stringify(counts)); process.exit(0); }
console.log('tiles', tiles, 'counts', counts);
for (const [k, v] of Object.entries(hit)) { console.log('\n' + k + ' (' + v.length + ')'); for (const h of v.slice(0, 8)) console.log('  ' + h.lat + ', ' + h.lon + '  x ' + h.x + ' z ' + h.z + '  ' + h.what); }
if (process.argv.includes('--write')) {
  const docs = new URL('../docs/CITY_AUDIT.md', import.meta.url).pathname, bl = new URL('./city_audit_baseline.json', import.meta.url).pathname;
  let md = '# Delhi pack audit (generated by `node tools/audit_city.mjs --write`)\n\nEvery hit has its real latitude and longitude. In the game, open the menu: the bottom line shows where you are (lat, lon, x, z, street, area) with a Copy button; to go to a hit, use the x and z in the address `?play&city=delhi&at=<landmark id>` and drive, or paste the coordinates here.\n\n| class | hits | meaning |\n|---|---|---|\n';
  const meaning = { park_building: 'a large building mostly on a park (a station, landmark outline or mis-tagged polygon drawn as a block over open ground)', street_building: 'a ground street running through a mapped building for 15 m or more (data)', void_block: 'a built-up block of 15,000 m2 and up with under 5 % built (a flat grey void)', landmark_offset: 'a landmark more than 150 m from the centre of its footprint (label in the wrong place)', footway_run: 'a footway inside a carriageway for over 16 m (drawn grey; the zebra rule only takes short crossings)' };
  for (const k of Object.keys(hit)) md += `| ${k} | ${hit[k].length} | ${meaning[k]} |\n`;
  for (const [k, v] of Object.entries(hit)) { md += `\n## ${k} (${v.length}, first 25)\n\n| lat, lon | x, z | what |\n|---|---|---|\n`; for (const h of v.slice(0, 25)) md += `| ${h.lat}, ${h.lon} | ${h.x}, ${h.z} | ${h.what} |\n`; }
  fs.writeFileSync(docs, md); fs.writeFileSync(bl, JSON.stringify({ note: 'counts from tools/audit_city.mjs; a class must not get worse (selftest)', counts }, null, 1) + '\n'); console.log('\nwrote', docs, 'and', bl);
}
