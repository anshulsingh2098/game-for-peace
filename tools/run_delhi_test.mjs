/* Delhi QA runner, headless part (Phase T2/T3). Checks every fixture of tools/delhi_test_routes.json against the Delhi pack with the game's own pure code (CityRouter, deckHeight, underDepth): no browser, no WebGL, so it can run anywhere.
   Run: node tools/run_delhi_test.mjs [--fixture id] [--no-write]      Report: reports/delhi-qa/<git sha>/headless.json (the folder is git-ignored)
   What it asserts: the start and end are near a street; the game's router finds a route; its length is in range; it never travels a one-way edge against its direction; the layered (flyover, underpass, tunnel) edges the fixture expects are on the route;
   the surface height is continuous at every node of the route (deckHeight and underDepth from the two edges that meet there; a step over 0.25 m is reported); and for the Todarmal fixture, the parallel fan and building overlaps are recounted against the plan's own baseline.
   What it cannot do: drive. The driving half (frame times, falls, stalls, errors) runs in a browser through src/debug/delhi_test_adapter.js `runFixture`: a machine with no WebGL reports that half as NOT RUN, never PASS. */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { decodeGraphColumns, decodeTile, deckHeight, underDepth, pieceWidth, LEVEL, RAMP } from '../src/world/city/pack.js';
import { CityRouter } from '../src/world/city/citynav.js';
const base = new URL('../assets/cities/delhi', import.meta.url).pathname, man = JSON.parse(fs.readFileSync(base + '/manifest.json')), G = decodeGraphColumns(JSON.parse(fs.readFileSync(base + '/graph.json')));
const FX = JSON.parse(fs.readFileSync(new URL('./delhi_test_routes.json', import.meta.url))), args = process.argv.slice(2), only = args.includes('--fixture') ? args[args.indexOf('--fixture') + 1] : null;
const nm = e => { const n = G.names[G.name[e]]; return n && (typeof n === 'string' ? n : n.en || n.ref) || ''; };
const seg = e => { const A = G.a[e], B = G.b[e]; return [G.xz[A * 2], G.xz[A * 2 + 1], G.xz[B * 2], G.xz[B * 2 + 1]]; };
const dSeg = (x, z, s) => { const dx = s[2] - s[0], dz = s[3] - s[1], t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(s[0] + t * dx - x, s[1] + t * dz - z); };
const nearestEdge = (x, z) => { let b = -1, bd = 1e9; for (let e = 0; e < G.a.length; e++) { const s = seg(e); if (Math.abs(s[0] - x) > 400 && Math.abs(s[2] - x) > 400) continue; const d = dSeg(x, z, s); if (d < bd) { bd = d; b = e; } } return { e: b, d: bd }; };
const surf = (e, n) => { const x = G.xz[n * 2], z = G.xz[n * 2 + 1]; return deckHeight(G, e, x, z) - underDepth(G, e, x, z); };
const router = new CityRouter(G); let sha = 'nogit'; try { sha = execSync('git rev-parse --short HEAD', { cwd: new URL('..', import.meta.url).pathname }).toString().trim(); } catch (e) { /* no git */ }
const results = [], T0 = Date.now();

function geometryAudit(f) {
  const g = f.geometry, c = g.centre, near = []; for (let e = 0; e < G.a.length; e++) { const s = seg(e); if (Math.abs(s[0] - c.x) > 600 && Math.abs(s[2] - c.x) > 600) continue; if (dSeg(c.x, c.z, s) <= g.edgeRadius) near.push(e); }
  const twoLane = near.filter(e => G.classes[G.cls[e]] === 'residential' && G.oneway[e] === 0 && G.lanes[e] === 2), unnamedFan = twoLane.filter(e => !nm(e)).length;
  const B = g.box, S = man.tileSize, bld = [], edgesBox = []; for (let e = 0; e < G.a.length; e++) { const s = seg(e); if (Math.max(s[0], s[2]) < B.x0 - 30 || Math.min(s[0], s[2]) > B.x1 + 30 || Math.max(s[1], s[3]) < B.z0 - 30 || Math.min(s[1], s[3]) > B.z1 + 30) continue; if (G.layer[e] !== 0 || ['footway', 'cycleway', 'busway'].includes(G.classes[G.cls[e]])) continue; edgesBox.push(e); }
  for (const m of man.tiles) { const x0 = m.tx * S, z0 = m.tz * S; if (x0 > B.x1 || x0 + S < B.x0 || z0 > B.z1 || z0 + S < B.z0) continue; const t = decodeTile(JSON.parse(fs.readFileSync(`${base}/tiles/${m.tx}_${m.tz}.json`)), S); for (const b of t.buildings || []) { let cx = 0, cz = 0; for (let i = 0; i < b.ring.length; i += 2) { cx += b.ring[i]; cz += b.ring[i + 1]; } cx /= b.ring.length / 2; cz /= b.ring.length / 2; if (cx >= B.x0 && cx <= B.x1 && cz >= B.z0 && cz <= B.z1) bld.push(b); } }
  const pip = (r, x, z) => { let k = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) if ((r[i + 1] > z) !== (r[j + 1] > z) && x < (r[j] - r[i]) * (z - r[i + 1]) / (r[j + 1] - r[i + 1]) + r[i]) k = !k; return k; };
  let touching = 0; const worst = [];
  for (const b of bld) { let hit = 0; for (const e of edgesBox) { const s = seg(e), hw = (G.classes[G.cls[e]] === 'residential' ? 3.5 : 6) + 1.5; /* half carriageway by class (a stand-in for pieceWidth, which needs a tile piece) */
      let d = 1e9; for (let i = 0; i < b.ring.length; i += 2) d = Math.min(d, dSeg(b.ring[i], b.ring[i + 1], s)); if (d < hw) { hit = Math.max(hit, hw - d); continue; } const n = Math.ceil(G.len[e] / 3); for (let k = 0; k <= n && !hit; k++) { const x = s[0] + (s[2] - s[0]) * k / n, z = s[1] + (s[3] - s[1]) * k / n; if (pip(b.ring, x, z)) hit = hw; } }
    if (hit) { touching++; worst.push(+hit.toFixed(1)); } }
  worst.sort((a, b) => b - a);
  return { edgesIn130m: near.length, residentialTwoLaneTwoWay: twoLane.length, ofWhichUnnamed: unnamedFan, buildingsInBox: bld.length, buildingsTouchingCorridor: touching, worstIntrusionM: worst.slice(0, 3), baseline: g.baseline,
    note: 'a recount with a crude corridor (half width 3.5 m residential, 6 m other, plus 1.5 m); the plan\'s figures used pieceWidth. Equal order of magnitude is the check; the counts are not expected to match to the unit' };
}

for (const f of FX.fixtures) {
  if (only && f.id !== only) continue; const r = { id: f.id, title: f.title, checks: [], status: 'PASS' }; const add = (name, ok, detail, skip = false) => { r.checks.push({ name, status: skip ? 'SKIPPED' : ok ? 'PASS' : 'FAIL', detail }); if (!skip && !ok) r.status = 'FAIL'; };
  const ver = f.from.verified !== false && f.to.verified !== false; if (!ver) r.note = 'a point is not from the pack (verified:false): checks are reported but not counted as pass or fail';
  const a = nearestEdge(f.from.x, f.from.z), b = nearestEdge(f.to.x, f.to.z); add('start is near a street', a.d <= (f.spawnSnapM || 40), Math.round(a.d) + ' m to edge ' + a.e + ' ' + nm(a.e)); add('end is near a street', b.d <= 200, Math.round(b.d) + ' m to edge ' + b.e + ' ' + nm(b.e));
  let yaw = 0; const s0 = seg(a.e); const dir = G.oneway[a.e] < 0 ? -1 : 1; yaw = Math.atan2(-(s0[2] - s0[0]) * dir, -(s0[3] - s0[1]) * dir);
  const t0 = Date.now(), rt = router.plan(f.from.x, f.from.z, yaw, f.to.x, f.to.z, null), ms = Date.now() - t0; add('the game\'s router finds a route', !!rt, rt ? Math.round(rt.metres) + ' m, ' + rt.edges.length + ' edges, ' + ms + ' ms' : 'no route');
  if (rt) {
    add('route length in range', rt.metres >= f.expect.minMetres * 0.8 && rt.metres <= f.expect.maxMetres, Math.round(rt.metres) + ' m, expected ' + f.expect.minMetres + ' to ' + f.expect.maxMetres);
    let wrong = 0; for (let i = 0; i < rt.edges.length; i++) { const e = rt.edges[i], o = G.oneway[e]; if (!o) continue; const from = rt.nodes[i], fwd = G.a[e] === from; if ((fwd && o < 0) || (!fwd && o > 0)) wrong++; } add('no one-way edge travelled against its direction', wrong === 0, wrong + ' of ' + rt.edges.length + ' edges');
    if (f.expect.layer !== undefined) { const L = rt.edges.filter(e => G.layer[e] === f.expect.layer).length; add('the expected layer ' + f.expect.layer + ' edges are on the route', L >= f.expect.layerEdgesMin, L + ' edges (need ' + f.expect.layerEdgesMin + ')'); }
    let jump = 0, jumpAt = null; for (let i = 1; i < rt.edges.length; i++) { const n = rt.nodes[i], d = Math.abs(surf(rt.edges[i - 1], n) - surf(rt.edges[i], n)); if (d > 0.25 && d > jump) { jump = d; jumpAt = { x: Math.round(G.xz[n * 2]), z: Math.round(G.xz[n * 2 + 1]), from: nm(rt.edges[i - 1]) + ' L' + G.layer[rt.edges[i - 1]], to: nm(rt.edges[i]) + ' L' + G.layer[rt.edges[i]] }; } }
    add('surface height continuous at every route node (limit 0.25 m)', jump === 0, jump ? 'largest step ' + jump.toFixed(2) + ' m at ' + JSON.stringify(jumpAt) : 'all joins within 0.25 m'); r.route = { metres: Math.round(rt.metres), edges: rt.edges.length, layers: [...new Set(rt.edges.map(e => G.layer[e]))].sort(), streets: [...new Set(rt.edges.map(nm).filter(Boolean))].slice(0, 12) };
  }
  if (f.geometry) { r.geometry = geometryAudit(f); const gm = r.geometry, bl = f.geometry.baseline; add('Todarmal: 66 street edges within 130 m, as in the plan', gm.edgesIn130m === 66, gm.edgesIn130m + ' now'); add('Todarmal: the fan of two-lane two-way residential edges is still there (the plan\'s "48 unnamed" is 48 residential in all: 34 unnamed + 14 named)', gm.residentialTwoLaneTwoWay === bl.unnamedTwoLaneTwoWayResidential, gm.residentialTwoLaneTwoWay + ' now (' + gm.ofWhichUnnamed + ' unnamed), baseline ' + bl.unnamedTwoLaneTwoWayResidential); add('Todarmal: buildings touching a street corridor (INFO only: this recount is cruder than the plan\'s; it is not asserted)', true, gm.buildingsTouchingCorridor + ' of ' + gm.buildingsInBox + ' (' + Math.round(100 * gm.buildingsTouchingCorridor / (gm.buildingsInBox || 1)) + ' %) here; the plan measured ' + bl.buildingsTouchingCorridor + ' of ' + bl.buildingsInBox + ' (41 %). Both say a large share of footprints sit on a street: C2 is still open', true); }
  if (!ver) { for (const c of r.checks) c.countedAsFail = c.status === 'FAIL'; r.status = 'UNVERIFIED'; }
  r.drive = 'NOT RUN: needs a browser (src/debug/delhi_test_adapter.js runFixture)'; results.push(r);
}
/* Delhi-wide ramp audit: a raised or sunken drivable edge that has a ramp end climbs LEVEL x layers over a ramp of min(half its length, RAMP x layers) with a smoothstep, whose steepest part is 1.5 x height / ramp. A short ramp edge therefore climbs steeply (seen in the game: 26 % at the Rani Jhansi Flyover entry, edge 242741, 64 m long). Info, not asserted: this is the C1 baseline. */
const DRV = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential']); const ramp = { rampEdges: 0, over12pct: 0, over25pct: 0, worstPct: 0 };
for (let e = 0; e < G.a.length; e++) { const L = G.layer[e]; if (L === 0 || !DRV.has(G.classes[G.cls[e]])) continue; const up = L > 0, m = up ? Math.min(L, 3) : Math.min(-L, 2), cnt = up ? G.up : G.dn; if (cnt[G.a[e]] >= 2 && cnt[G.b[e]] >= 2) continue; const sl = 1.5 * m * LEVEL / Math.max(8, Math.min(G.len[e] / 2, RAMP * m)); ramp.rampEdges++; if (sl > 0.12) ramp.over12pct++; if (sl > 0.25) ramp.over25pct++; ramp.worstPct = Math.max(ramp.worstPct, Math.round(sl * 100)); }
const nRestr = Array.isArray(G.restrictions) ? G.restrictions.length : Object.keys(G.restrictions || {}).length;
const report = { build: sha, when: new Date().toISOString(), seconds: +((Date.now() - T0) / 1000).toFixed(1), pack: 'assets/cities/delhi', facts: { edges: G.a.length, turnRestrictionsInPack: nRestr, rampSlopeAudit: ramp }, fixtures: results };
for (const r of results) { console.log(`\n${r.status.padEnd(10)} ${r.id}  ${r.title}`); for (const c of r.checks) console.log(`   ${c.status.padEnd(7)} ${c.name}: ${c.detail}`); if (r.note) console.log('   note: ' + r.note); if (r.geometry) console.log('   geometry: ' + JSON.stringify({ ...r.geometry, baseline: undefined, note: undefined })); }
console.log(`\nramp audit (drivable edges that carry a ramp end): ${ramp.rampEdges} edges, ${ramp.over12pct} steeper than 12 %, ${ramp.over25pct} steeper than 25 % at the steepest point, worst ${ramp.worstPct} %`);
console.log(`turn restrictions in the pack: ${nRestr} (the router cannot honour what the data does not hold)\ndrive checks: NOT RUN (headless)`);
if (!args.includes('--no-write')) { const dir = new URL(`../reports/delhi-qa/${sha}/`, import.meta.url).pathname; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(dir + 'headless.json', JSON.stringify(report, null, 1)); console.log('report: reports/delhi-qa/' + sha + '/headless.json'); }
process.exitCode = results.some(r => r.status === 'FAIL') ? 1 : 0;
