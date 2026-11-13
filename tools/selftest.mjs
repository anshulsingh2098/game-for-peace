/* Self-test for the pure engine modules. Run: node tools/selftest.mjs
   Checks that the same seed always gives the same world, and that the maths stays within its limits. */
import assert from 'node:assert/strict';
import { alea } from '../src/core/rng.js';
import { createNoise } from '../src/core/noise.js';
import { makeConfig, encodeConfig, decodeConfig, DEFAULT_CONFIG } from '../src/core/config.js';
import { createTerrain } from '../src/world/terrain.js';
import { fillTile, tileIndex, vertexCount, skirtDepth } from '../src/world/tiledata.js';
import { Road } from '../src/world/router.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok   ' + name); };
const seq = (r, n) => Array.from({ length: n }, () => r());

test('rng: same seed gives the same sequence', () => assert.deepEqual(seq(alea('peace'), 50), seq(alea('peace'), 50)));
test('rng: different seeds and labels give different sequences', () => {
  assert.notDeepEqual(seq(alea('peace'), 8), seq(alea('peacf'), 8)); assert.notDeepEqual(seq(alea('peace', 'a'), 8), seq(alea('peace', 'b'), 8));
});
test('rng: values are in [0, 1) and spread evenly', () => {
  const r = alea(42), v = seq(r, 20000); assert.ok(v.every(x => x >= 0 && x < 1));
  const mean = v.reduce((a, b) => a + b) / v.length; assert.ok(Math.abs(mean - 0.5) < 0.01, 'mean ' + mean);
});
test('noise: deterministic, bounded and smooth', () => {
  const a = createNoise('peace'), b = createNoise('peace'); let lo = 9, hi = -9, jump = 0;
  for (let i = 0; i < 20000; i++) {
    const x = (i % 141) * 0.173 - 9, y = Math.floor(i / 141) * 0.191 - 11, v = a.n2(x, y);
    assert.equal(v, b.n2(x, y)); lo = Math.min(lo, v); hi = Math.max(hi, v); jump = Math.max(jump, Math.abs(v - a.n2(x + 0.001, y)));
  }
  assert.ok(lo >= -1.001 && hi <= 1.001, `range ${lo}..${hi}`); assert.ok(hi - lo > 1.4, 'range too narrow'); assert.ok(jump < 0.01, 'not continuous: ' + jump);
  for (let i = 0; i < 2000; i++) { const f = a.fbm(i * 0.37, i * 0.11, 5), g = a.ridged(i * 0.37, i * 0.11, 5); assert.ok(f >= -1 && f <= 1); assert.ok(g >= 0 && g <= 1); }
});
test('config: share code round-trips', () => {
  const c = makeConfig({ seed: 'coast', terrain: { hills: { amp: 80 } } });
  assert.equal(c.terrain.hills.scale, DEFAULT_CONFIG.terrain.hills.scale); assert.equal(c.terrain.hills.amp, 80);
  assert.deepEqual(decodeConfig(encodeConfig(c)), c); assert.equal(decodeConfig('not a code'), null);
});
test('terrain: same seed gives the same land; another seed differs', () => {
  const a = createTerrain(makeConfig({ seed: 'peace' })), b = createTerrain(makeConfig({ seed: 'peace' })), c = createTerrain(makeConfig({ seed: 'other' })); let diff = 0;
  for (let i = 0; i < 3000; i++) { const x = (i * 97.3) % 9000 - 4500, z = (i * 61.7) % 9000 - 4500; assert.equal(a.height(x, z), b.height(x, z)); if (Math.abs(a.height(x, z) - c.height(x, z)) > 1) diff++; }
  assert.ok(diff > 2000, 'seeds too similar: ' + diff);
});
test('terrain: continuous, with sea, lowland and mountains present', () => {
  const t = createTerrain(makeConfig({ seed: 'peace' })); let sea = 0, low = 0, high = 0, jump = 0, cliffs = 0, lo = 1e9, hi = -1e9; const N = 40000;
  for (let i = 0; i < N; i++) {
    const x = (i % 200) * 150 - 15000, z = Math.floor(i / 200) * 150 - 15000, h = t.height(x, z);
    lo = Math.min(lo, h); hi = Math.max(hi, h); if (h < 0) sea++; else if (h < 120) low++; else high++;
    jump = Math.max(jump, Math.abs(t.height(x + 0.01, z) - h));                       // a break in the surface would show as a jump over 1 cm
    if (h >= 0 && Math.hypot(t.height(x + 1, z) - h, t.height(x, z + 1) - h) > 1) cliffs++;
  }
  const land = N - sea;
  assert.ok(jump < 0.15, 'surface is not continuous: ' + jump.toFixed(3) + ' m over 1 cm');
  assert.ok(cliffs / land < 0.06, 'too much land steeper than 45 degrees: ' + (cliffs / land * 100).toFixed(1) + '%');
  assert.ok(sea / N > 0.08 && low / N > 0.2 && high / N > 0.03, `sea ${(sea / N).toFixed(2)} low ${(low / N).toFixed(2)} high ${(high / N).toFixed(2)}`);
  console.log(`     heights ${lo.toFixed(0)}..${hi.toFixed(0)} m; sea ${(sea / N * 100).toFixed(0)}%, lowland ${(low / N * 100).toFixed(0)}%, highland ${(high / N * 100).toFixed(0)}%; ${(cliffs / land * 100).toFixed(1)}% of land steeper than 45 degrees`);
});
test('terrain: spawn point is dry and gentle', () => {
  for (const seed of ['peace', 'coast', 'alps', 'x1', 'x2']) { const t = createTerrain(makeConfig({ seed })), p = t.findSpawn(); assert.ok(p.y > 5 && p.y < 95, seed + ' spawn height ' + p.y); }
});
test('tiles: neighbours meet exactly and the mesh is well formed', () => {
  const t = createTerrain(makeConfig({ seed: 'peace' })), S = 128;
  for (const res of [16, 32, 64]) {
    const n = vertexCount(res), mk = () => ({ pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), col: new Float32Array(n * 3), uv: new Float32Array(n * 2) });
    const A = mk(), B = mk(), ia = fillTile(t, 0, 0, S, res, A.pos, A.nor, A.col, A.uv); fillTile(t, S, 0, S, res, B.pos, B.nor, B.col, B.uv);
    const row = res + 1;
    for (let j = 0; j < row; j++) {                                    // A's right edge against B's left edge
      const a = j * row + res, b = j * row;
      assert.equal(A.pos[a * 3 + 1], B.pos[b * 3 + 1]); for (let c = 0; c < 3; c++) { assert.equal(A.nor[a * 3 + c], B.nor[b * 3 + c]); assert.equal(A.col[a * 3 + c], B.col[b * 3 + c]); }
    }
    for (let k = 0; k < n; k++) { const l = Math.hypot(A.nor[k * 3], A.nor[k * 3 + 1], A.nor[k * 3 + 2]); assert.ok(Math.abs(l - 1) < 1e-4 && A.nor[k * 3 + 1] > 0); }
    const idx = tileIndex(res); assert.equal(idx.length % 3, 0); assert.ok(idx.every(v => v < n)); assert.equal(idx.length, res * res * 6 + 4 * res * 12);
    assert.ok(Math.abs(ia.minY - (Math.min(...Array.from({ length: row * row }, (_, k) => A.pos[k * 3 + 1])) - skirtDepth(S, res))) < 1e-3);
    const again = mk(); fillTile(t, 0, 0, S, res, again.pos, again.nor, again.col, again.uv); assert.deepEqual(again.pos, A.pos);
  }
});
const world = seed => { const cfg = makeConfig({ seed }), t = createTerrain(cfg), r = new Road(t, cfg); r.ensure(-4000, 4000); t.attachRoad(r); return { cfg, t, r }; };
test('road: same seed gives the same road, in both directions', () => {
  const a = world('peace').r, b = world('peace').r; assert.ok(a.sMax >= 4000 && a.sMin <= -4000);
  for (let s = -3900; s <= 3900; s += 130) { const p = a.at(s, {}), q = b.at(s, {}); assert.equal(p.x, q.x); assert.equal(p.y, q.y); assert.equal(p.z, q.z); }
  const far = world('peace').r; far.ensure(-9000, 9000); const p = a.at(3333, {}), q = far.at(3333, {}); assert.equal(p.x, q.x); assert.equal(p.y, q.y);      // building further never changes what exists
});
test('road: grade, bend radius and clearance stay within limits; it never crosses itself', () => {
  for (const seed of ['peace', 'coast', 'kilo', 'mesa', 'bay']) {
    const { cfg, r } = world(seed), R = cfg.road; let maxG = 0, minR = Infinity, low = Infinity, prev = null; const pts = [];
    for (let s = r.sMin + 40; s < r.sMax - 40; s += 5) {
      const p = r.at(s, {}); maxG = Math.max(maxG, Math.abs(p.slope)); low = Math.min(low, p.y);
      if (prev !== null) { const k = Math.abs(Math.atan2(Math.sin(p.th - prev), Math.cos(p.th - prev))) / 5; if (k > 0) minR = Math.min(minR, 1 / k); } prev = p.th;
      if (Math.round(s) % 20 === 0) pts.push(p);
    }
    assert.ok(maxG < R.lastGrade * 1.25, seed + ' grade ' + (maxG * 100).toFixed(1) + '%'); assert.ok(minR > R.minRadius * 0.5, seed + ' radius ' + minR.toFixed(0)); assert.ok(low >= cfg.terrain.seaLevel + R.clearance - 0.6, seed + ' lowest ' + low.toFixed(2));
    for (let i = 0; i < pts.length; i++) for (let j = i + 12; j < pts.length; j++) assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) > 25, seed + ' road meets itself');
  }
});
test('road: the land is graded to it and untouched far away', () => {
  const { cfg, t, r } = world('peace'), R = cfg.road; let worst = 0;
  for (let s = -3500; s <= 3500; s += 37) {
    const p = r.at(s, {}), nx = -p.tz, nz = p.tx;
    for (const d of [0, 2, -3.5]) worst = Math.max(worst, Math.abs(t.height(p.x + nx * d, p.z + nz * d) - (p.y - R.sink)));          // under the carriageway: just below the surface
    for (const d of [70, -90]) assert.equal(t.height(p.x + nx * d, p.z + nz * d) === t.base(p.x + nx * d, p.z + nz * d) || r.nearest(p.x + nx * d, p.z + nz * d), true);
    assert.ok(r.nearest(p.x + nx * 20, p.z + nz * 20)); assert.ok(Math.abs(r.hit.d - 20) < 1.5, 'distance ' + r.hit.d.toFixed(2)); assert.ok(Math.abs(r.hit.s - s) < 12, 'road distance off by ' + (r.hit.s - s).toFixed(1));
  }
  assert.ok(worst < 0.35, 'bed is off by ' + worst.toFixed(2) + ' m');
  assert.equal(t.height(1e6, 1e6), t.base(1e6, 1e6));
});
console.log(`\n${passed} checks passed`);
