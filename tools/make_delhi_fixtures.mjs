/* Writes tools/delhi_test_routes.json from the Delhi pack: every game coordinate is taken from the pack itself (a landmark, or the end nodes of a mapped flyover / underpass / tunnel run found in the graph), never typed from memory.
   A point from lat/lon that is not in the pack is marked verified:false (the runner does not assert on it). Run: node tools/make_delhi_fixtures.mjs   (see docs/DELHI_TESTING.md) */
import fs from 'node:fs';
import { decodeGraphColumns } from '../src/world/city/pack.js';
const base = new URL('../assets/cities/delhi', import.meta.url).pathname, man = JSON.parse(fs.readFileSync(base + '/manifest.json')), G = decodeGraphColumns(JSON.parse(fs.readFileSync(base + '/graph.json')));
const LM = new Map(JSON.parse(fs.readFileSync(base + '/landmarks.json')).landmarks.map(l => [l.id, l]));
const K = Math.PI / 180, RE = 6371008.8, O = man.origin, fromLL = (lat, lon) => ({ x: Math.round((lon - O.lon) * RE * Math.cos(O.lat * K) * K), z: Math.round(-(lat - O.lat) * RE * K) });
const nm = e => { const n = G.names[G.name[e]]; return n && (typeof n === 'string' ? n : n.en || n.ref) || ''; };
const nodeXZ = n => ({ x: Math.round(G.xz[n * 2]), z: Math.round(G.xz[n * 2 + 1]) });
const lmPoint = id => { const l = LM.get(id); if (!l) throw new Error('no landmark ' + id); return { x: Math.round(l.x), z: Math.round(l.z), name: id, source: 'landmarks.json', verified: true }; };
/* a connected run of edges on one layer: its entry and exit node by the one-way direction */
function run(layer, nearName, nearXZ, maxD = 1500) {
  const adj = new Map(); for (let e = 0; e < G.a.length; e++) if (G.layer[e] === layer) for (const n of [G.a[e], G.b[e]]) (adj.get(n) || adj.set(n, []).get(n)).push(e);
  const seen = new Set(); let best = null;
  for (let e = 0; e < G.a.length; e++) { if (G.layer[e] !== layer || seen.has(e)) continue; const st = [e], r = []; seen.add(e); while (st.length) { const c = st.pop(); r.push(c); for (const n of [G.a[c], G.b[c]]) for (const f of adj.get(n) || []) if (!seen.has(f)) { seen.add(f); st.push(f); } }
    if (!r.some(x => nm(x).includes(nearName)) || G.oneway[r[0]] === 0) continue; const m = nodeXZ(G.a[r[0]]); if (Math.hypot(m.x - nearXZ.x, m.z - nearXZ.z) > maxD) continue; const L = r.reduce((s, x) => s + G.len[x], 0); if (!best || L > best.L) best = { r, L }; }
  if (!best) throw new Error('no run ' + nearName);
  /* the component can hold both carriageways joined at their ends: walk each directed chain from every entry node and keep the longest (the walk follows the one-way direction, so it is one carriageway) */
  const out = new Map(); for (const e of best.r) { const o = G.oneway[e], a = o >= 0 ? G.a[e] : G.b[e], b = o >= 0 ? G.b[e] : G.a[e]; (out.get(a) || out.set(a, []).get(a)).push({ e, b }); }
  const into = new Set(); for (const l of out.values()) for (const x of l) into.add(x.b); let top = null;
  for (const s0 of [...out.keys()].filter(n => !into.has(n))) { let n = s0, k = 0, m = 0; const seenN = new Set([n]); while (out.get(n) && out.get(n).length && k < 200) { const x = out.get(n).sort((p, q) => G.len[q.e] - G.len[p.e])[0]; if (seenN.has(x.b)) break; seenN.add(x.b); m += G.len[x.e]; n = x.b; k++; } if (!top || m > top.m) top = { s0, n, k, m }; }
  if (!top || top.k < 1) throw new Error('no directed chain in ' + nearName);
  return { edges: top.k, metres: Math.round(top.m), layer, from: nodeXZ(top.s0), to: nodeXZ(top.n) };
}
const pt = (p, name, extra = {}) => ({ x: p.x, z: p.z, name, source: extra.source || 'pack graph node', verified: true, ...extra });
const fx = [];
fx.push({ id: 'cp-india-gate', title: 'CP to India Gate', from: lmPoint('connaught-place'), to: lmPoint('india-gate'), spawnSnapM: 200, expect: { minMetres: 3000, maxMetres: 6000 }, maxSeconds: 420 });
fx.push({ id: 'cp-new-delhi-station', title: 'CP to New Delhi Railway Station', from: lmPoint('connaught-place'), to: lmPoint('new-delhi-station'), spawnSnapM: 200, expect: { minMetres: 1200, maxMetres: 5000 }, maxSeconds: 360 });
const ito = fromLL(28.6289, 77.2405);
fx.push({ id: 'cp-ito', title: 'CP to ITO (junction position from latitude and longitude, not from the pack)', from: lmPoint('connaught-place'), to: { ...ito, name: 'ITO junction (28.6289 N, 77.2405 E)', source: 'lat/lon typed by Claude, nearest street unnamed in the pack', verified: false }, spawnSnapM: 200, expect: { minMetres: 2000, maxMetres: 8000 }, maxSeconds: 420 });
const rj = run(1, 'Rani Jhansi Flyover', { x: -300, z: -5400 }, 1200);
fx.push({ id: 'flyover-rani-jhansi', title: 'Rani Jhansi Flyover, one carriageway end to end (layer 1)', from: pt(rj.from, 'flyover entry'), to: pt(rj.to, 'flyover exit'), spawnSnapM: 30, expect: { minMetres: rj.metres, maxMetres: Math.round(rj.metres * 3), layerEdgesMin: Math.min(3, rj.edges), layer: 1 }, run: rj, maxSeconds: 240 });
const pk = run(-1, 'Panchkuian Road', { x: 521, z: -2440 }, 800);
fx.push({ id: 'underpass-panchkuian', title: 'Panchkuian Road underpass, one carriageway (layer -1), 600 m from CP', from: pt(pk.from, 'underpass entry'), to: pt(pk.to, 'underpass exit'), spawnSnapM: 30, expect: { minMetres: pk.metres, maxMetres: Math.round(pk.metres * 3), layerEdgesMin: Math.min(3, pk.edges), layer: -1 }, run: pk, maxSeconds: 200 });
const pm = run(-1, 'Pragati Maidan Tunnel', { x: 3896, z: -179 }, 1500);
fx.push({ id: 'tunnel-pragati-maidan', title: 'Pragati Maidan Tunnel, primary road run (layer -1)', from: pt(pm.from, 'tunnel entry'), to: pt(pm.to, 'tunnel exit'), spawnSnapM: 200, expect: { minMetres: pm.metres, maxMetres: Math.round(pm.metres * 3), layerEdgesMin: Math.min(3, pm.edges), layer: -1 }, run: pm, maxSeconds: 200 });
fx.push({ id: 'todarmal-replay', title: 'Todarmal Road corridor: the documented parallel fan and building overlaps (geometry audit, plus a drive along the road)', from: { x: 2186, z: -1645, name: 'Todarmal Road west end', source: 'docs/CITY_CONFLICTS_PLAN.md and the pack edges named Todarmal Road', verified: true, note: 'the plan measured around x 2290, z -1760 (the aerial view point)' }, to: { x: 2470, z: -1640, name: 'Todarmal Road east end', source: 'docs/CITY_CONFLICTS_PLAN.md', verified: true }, spawnSnapM: 40, geometry: { centre: { x: 2290, z: -1760 }, edgeRadius: 130, box: { x0: 1890, x1: 2690, z0: -2060, z1: -1460 }, baseline: { edgesIn130m: 66, unnamedTwoLaneTwoWayResidential: 48, buildingsInBox: 176, buildingsTouchingCorridor: 73 } }, expect: { minMetres: 150, maxMetres: 1500 }, maxSeconds: 200 });
fs.writeFileSync(new URL('./delhi_test_routes.json', import.meta.url), JSON.stringify({ format: 1, note: 'Generated by tools/make_delhi_fixtures.mjs from assets/cities/delhi. Game metres (x east, z south). verified:false points are not asserted.', packOrigin: O, fixtures: fx }, null, 1) + '\n');
console.log('wrote', fx.length, 'fixtures'); for (const f of fx) console.log(' ', f.id, JSON.stringify(f.from.x + ',' + f.from.z), '->', JSON.stringify(f.to.x + ',' + f.to.z), f.run ? f.run.edges + ' edges ' + f.run.metres + ' m' : '');
