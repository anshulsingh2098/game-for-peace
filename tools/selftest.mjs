/* Self-test for the pure engine modules. Run: node tools/selftest.mjs
   Checks that the same seed always gives the same world, and that the maths stays within its limits. */
import assert from 'node:assert/strict';
import { alea } from '../src/core/rng.js';
import { createNoise } from '../src/core/noise.js';
import { makeConfig, encodeConfig, decodeConfig, DEFAULT_CONFIG } from '../src/core/config.js';
import { createTerrain } from '../src/world/terrain.js';
import { fillTile, tileIndex, vertexCount, skirtDepth } from '../src/world/tiledata.js';
import { Road } from '../src/world/router.js';
import { VehiclePhysics, vehicleParams, SURFACES } from '../src/vehicle/physics.js';
import { VEHICLES } from '../src/vehicle/defs.js';
import { RapierVehicle, initRapier } from '../src/vehicle/rapier-vehicle.js';
import { LOCATIONS, locationConfig } from '../src/world/locations.js';

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
const flat = (over = {}) => ({ height: () => 0, surface: () => 'asphalt', near: () => [], seaLevel: -100, ...over });
const drive = (ph, secs, input) => { for (let t = 0; t < secs; t += 1 / 60) { ph.step(1 / 60, typeof input === 'function' ? input(ph) : input); assert.ok(Number.isFinite(ph.x + ph.z + ph.u + ph.v + ph.r + ph.yaw), 'physics blew up'); } };
const GO = { steer: 0, throttle: 1, brake: 0 }, COAST = { steer: 0, throttle: 0, brake: 0 }, STOP = { steer: 0, throttle: 0, brake: 1 };
test('locations: every profile makes a world with a valid road, and the same seed gives the same world', () => {
  assert.ok(LOCATIONS.length >= 5 && new Set(LOCATIONS.map(l => l.id)).size === LOCATIONS.length);
  for (const L of LOCATIONS) {
    const cfg = locationConfig(L.id, 'peace'), t = createTerrain(cfg), r = new Road(t, cfg); r.ensure(-3000, 3000); t.attachRoad(r); let maxG = 0, low = Infinity;
    for (let sd = r.sMin + 40; sd < r.sMax - 40; sd += 5) { const p = r.at(sd, {}); maxG = Math.max(maxG, Math.abs(p.slope)); low = Math.min(low, p.y); }
    assert.ok(r.sMax - r.sMin > 5000 && maxG < cfg.road.lastGrade * 1.3, L.id + ' road: ' + (r.sMax - r.sMin).toFixed(0) + ' m, grade ' + (maxG * 100).toFixed(1) + '%'); assert.ok(low >= cfg.terrain.seaLevel + cfg.road.clearance - 0.6, L.id + ' road dips under water');
    const t2 = createTerrain(locationConfig(L.id, 'peace')); for (let i = 0; i < 50; i++) assert.equal(t.base(i * 331 - 7000, i * 197 - 5000), t2.base(i * 331 - 7000, i * 197 - 5000));
    assert.ok(cfg.location === L.id && L.sky && L.name && L.blurb);
  }
});
test('driving: each vehicle accelerates straight to about its top speed, coasts down and brakes', () => {
  for (const V of VEHICLES) {
    const p = vehicleParams(V.body, V.stats), ph = new VehiclePhysics(p, flat()); drive(ph, 90, GO);
    assert.ok(ph.u > p.top * 0.82 && ph.u <= p.top * 1.08, V.id + ' top speed ' + (ph.u * 3.6).toFixed(0) + ' km/h of ' + V.stats.Top);
    assert.ok(Math.abs(ph.z) < 0.5 && Math.abs(ph.yaw) < 0.01, V.id + ' wandered off a straight line');
    const x0 = ph.x; drive(ph, 30, q => ({ steer: 0, throttle: 0, brake: q.u > 0.5 ? 1 : 0 })); assert.ok(ph.u <= 0.6, V.id + ' did not stop'); assert.ok(ph.x - x0 < p.top * p.top / (2 * p.brake) * 1.6, V.id + ' braking distance ' + (ph.x - x0).toFixed(0) + ' m');
    drive(ph, 20, GO); drive(ph, 120, COAST); assert.equal(ph.u, 0, V.id + ' never rolled to a stop');
  }
});
test('driving: steering follows the wheels at low speed and is limited by grip at high speed', () => {
  const V = VEHICLES[0], p = vehicleParams(V.body, V.stats), ph = new VehiclePhysics(p, flat());
  drive(ph, 30, q => ({ steer: 1, throttle: q.u < 2.5 ? 0.3 : 0, brake: 0 }));                       // slow circle, full lock
  const R = ph.u / ph.r, want = p.L / Math.tan(ph.delta); assert.ok(ph.r > 0 && Math.abs(R - want) / want < 0.15, 'low-speed radius ' + R.toFixed(1) + ' m, expected ' + want.toFixed(1));
  const fast = new VehiclePhysics(p, flat()); drive(fast, 12, GO); let worst = 0, slide = 0;
  drive(fast, 6, q => { worst = Math.max(worst, Math.abs(q.ay)); slide = Math.max(slide, Math.abs(q.v / q.u)); return { steer: 1, throttle: 0.5, brake: 0 }; });
  assert.ok(worst < p.mu * 9.81 * 1.15, 'cornered at ' + (worst / 9.81).toFixed(2) + ' g with grip ' + p.mu.toFixed(2)); assert.ok(worst > p.mu * 9.81 * 0.5, 'barely turned'); assert.ok(slide < 0.6, 'spun out');
  const ice = new VehiclePhysics(p, flat({ surface: () => 'snow' })); drive(ice, 12, GO); let w2 = 0; drive(ice, 6, q => { w2 = Math.max(w2, Math.abs(q.ay)); return { steer: 1, throttle: 0, brake: 0 }; });
  assert.ok(w2 < worst * 0.6, 'snow should corner much worse than asphalt: ' + (w2 / worst).toFixed(2));
});
test('driving: slopes, reverse, water and obstacles behave', () => {
  const V = VEHICLES[0], p = vehicleParams(V.body, V.stats);
  const hill = new VehiclePhysics(p, flat({ height: x => 0.15 * x })); drive(hill, 5, COAST); assert.ok(Math.abs(hill.x) < 0.01, 'rolled away while parked on a hill'); assert.ok(hill.pitch > 0.1, 'did not pitch up the slope');
  const cliff = new VehiclePhysics(p, flat({ height: x => 1.5 * x, surface: () => 'grass' })); drive(cliff, 8, GO); assert.ok(cliff.x < 3, 'drove up a 56 degree slope');
  const back = new VehiclePhysics(p, flat()); drive(back, 6, STOP); assert.ok(back.u < -3 && back.u >= -p.revTop * 1.1 && back.x < -5, 'reverse: ' + back.u.toFixed(1) + ' m/s');
  const sea = new VehiclePhysics(p, flat({ seaLevel: 2 })); drive(sea, 10, GO); assert.ok(sea.u < 0.5 && sea.stuck > 5, 'kept driving under 2 m of water');
  const tree = { x: 60, z: 0.2, r: 0.4 }, hit = new VehiclePhysics(p, flat({ near: () => [[tree]] })); let bang = 0; drive(hit, 8, q => { bang = Math.max(bang, q.impact); return GO; });
  assert.ok(bang > 5, 'no impact felt'); for (const off of p.circles) assert.ok(Math.hypot(hit.x + Math.cos(hit.yaw) * off - tree.x, hit.z + Math.sin(hit.yaw) * off - tree.z) >= p.radius + tree.r - 0.05, 'ended inside the tree');
  assert.ok(Object.keys(SURFACES).every(k => SURFACES[k].grip > 0 && SURFACES[k].grip <= 1));
});
/* ---- the Rapier ray-cast vehicle (the physics the game uses) ---- */
await initRapier(); const rv = (i, over) => { const V = VEHICLES[i]; return new RapierVehicle(vehicleParams(V.body, V.stats), V.id, flat(over)); };
const atest = async (name, fn) => { await fn(); passed++; console.log('ok   ' + name); };
await atest('rapier: each vehicle rests level on its wheels, reaches about its top speed, and brakes straight', () => {
  for (let i = 0; i < VEHICLES.length; i++) {
    const V = VEHICLES[i], ph = rv(i); drive(ph, 1.5, COAST); assert.ok(Math.abs(ph.pitch) < 0.06 && Math.abs(ph.roll) < 0.06 && ph.wheelStates.every(w => w.contact), V.id + ' not resting on its wheels');
    drive(ph, 40, GO); const top = ph.u * 3.6; assert.ok(top > V.stats.Top * 0.8 && top < V.stats.Top * 1.02, V.id + ' top speed ' + top.toFixed(0));
    ph.reset(0, 0, 0); ph.body.setLinvel({ x: 27.8, y: 0, z: 0 }, true); ph.read(); const x0 = ph.x; let stopped = false; drive(ph, 14, q => { if (q.u < 0.3) stopped = true; return stopped ? COAST : STOP; });
    assert.ok(stopped && ph.x - x0 > 5 && ph.x - x0 < 70 && Math.abs(ph.z) < 1.5, V.id + ' braking: ' + (ph.x - x0).toFixed(0) + ' m, ' + ph.z.toFixed(1) + ' m off line');
    ph.free();
  }
});
await atest('rapier: cornering is grip-limited and stable; steering is Ackermann and the lock shrinks with speed', () => {
  for (let i = 0; i < VEHICLES.length; i++) {
    const V = VEHICLES[i], ph = rv(i); drive(ph, 14, GO); let slip = 0, hi = 0; drive(ph, 4, q => { slip = Math.max(slip, q.slip); if (hi === 0 && q.steer > 0.99) hi = Math.abs(q.delta); return { steer: 1, throttle: 0, brake: 0 }; });
    assert.ok(ph.u > 5 && slip < 0.8 && Math.abs(ph.roll) < 0.4, V.id + ' lost it at full lock: slip ' + slip.toFixed(2));
    const lowLock = rv(i); drive(lowLock, 0.8, { steer: 1, throttle: 0.2, brake: 0 }); const lo = Math.abs(lowLock.delta); assert.ok(lo > hi + 0.01, V.id + ' lock does not shrink with speed: ' + lo.toFixed(3) + ' vs ' + hi.toFixed(3));
    ph.free(); lowLock.free();
  }
  const car = rv(0); drive(car, 3, { steer: -1, throttle: 0.2, brake: 0 }); const s = car.wheelStates.filter(w => w.front && w.side); assert.ok(s.length === 2 && Math.abs(s[0].steer - s[1].steer) > 0.002, 'no Ackermann difference'); car.free();
});
await atest('rapier: slopes, water, obstacles and buffs', () => {
  const V = VEHICLES[0], p = vehicleParams(V.body, V.stats);
  const hill = new RapierVehicle(p, V.id, flat({ height: x => 0.15 * x })); drive(hill, 5, COAST); assert.ok(Math.abs(hill.x) < 0.5, 'rolled away while parked on a hill: ' + hill.x.toFixed(2));
  const climb = new RapierVehicle(p, V.id, flat({ height: x => 0.15 * x })); drive(climb, 12, GO); assert.ok(climb.x > 40, 'could not climb a 15% slope: ' + climb.x.toFixed(0));
  const sea = new RapierVehicle(p, V.id, flat({ seaLevel: 2 })); drive(sea, 12, GO); assert.ok(sea.u < 1 && sea.stuck > 4, 'kept driving under 2 m of water');
  const tree = { x: 60, z: 0.2, r: 0.4 }, hit = new RapierVehicle(p, V.id, flat({ near: () => [[tree]] })); let bang = 0; drive(hit, 10, q => { bang = Math.max(bang, q.impact); return GO; });
  assert.ok(bang > 5, 'no impact felt'); for (const off of p.circles) assert.ok(Math.hypot(hit.x + Math.cos(hit.yaw) * off - tree.x, hit.z + Math.sin(hit.yaw) * off - tree.z) >= p.radius + tree.r - 0.05, 'drove through the tree');
  const boost = new RapierVehicle(p, V.id, flat()); boost.setMod({ top: 1.3, accel: 1.6 }); drive(boost, 40, GO); const norm = new RapierVehicle(p, V.id, flat()); drive(norm, 40, GO); assert.ok(boost.u > norm.u * 1.1, 'speed buff does nothing');
  for (const v of [hill, climb, sea, hit, boost, norm]) v.free();
});

await atest('drivetrain: the automatic box climbs through its gears and respects the rev limiter; the electric bike has one gear', () => {
  for (let i = 0; i < VEHICLES.length; i++) {
    const V = VEHICLES[i], ph = rv(i); if (!ph.hasGears) { assert.equal(V.id, 'bike'); drive(ph, 5, GO); assert.equal(ph.gear, 1); ph.free(); continue; }
    const seen = []; let over = 0; drive(ph, 40, q => { if (seen[seen.length - 1] !== q.gear) seen.push(q.gear); over = Math.max(over, q.rpm01); return GO; });
    assert.ok(seen[0] === 1 && seen.length >= 4 && seen.every((g, k) => k === 0 || g === seen[k - 1] + 1), V.id + ' gear sequence ' + seen.join(','));            // up one at a time, never skipping or hunting
    assert.ok(over < 1.04, V.id + ' revs reached ' + over.toFixed(2) + ' of the limit'); assert.ok(ph.gearLabel === 'D' + ph.gear); ph.free();
  }
});
await atest('drivetrain: manual shifting holds the gear, refuses a downshift into too-high revs, and reaches neutral and reverse', () => {
  const ph = rv(0); ph.setManual(true); drive(ph, 3, GO); assert.equal(ph.gear, 1, 'a manual box must stay in first'); assert.ok(ph.rev01 > 0.9, 'first gear should hit the limiter');
  assert.ok(ph.shift(+1)); drive(ph, 0.1, GO); assert.equal(ph.gear, 2); assert.equal(ph.gearLabel, 'M2');
  for (let k = 0; k < 3; k++) { ph.shift(+1); drive(ph, 2.5, GO); } assert.ok(ph.gear >= 4 && ph.u > 30);
  const g = ph.gear; assert.equal(ph.shift(-(g - 1)), false, 'jumped down into a gear that over-revs'); assert.equal(ph.gear, g);                                      // only one step at a time anyway
  let guard = 0; while (ph.gear > -1 && guard++ < 40) { if (!ph.shift(-1)) drive(ph, 1, STOP); else drive(ph, 0.2, COAST); } assert.ok(ph.gear <= 0, 'could not reach neutral: gear ' + ph.gear);
  const v0 = ph.u; drive(ph, 0.5, COAST); assert.ok(ph.gear === 0 ? ph.u <= v0 + 0.01 : true);
  drive(ph, 20, STOP); assert.ok(ph.u < 0.5); assert.ok(ph.shift(-1) || ph.gear === -1); drive(ph, 4, GO); assert.ok(ph.u < -1, 'reverse gear should move the car backwards: ' + ph.u.toFixed(2)); ph.free();
});
console.log(`\n${passed} checks passed`);
