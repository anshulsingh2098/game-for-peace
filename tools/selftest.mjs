/* Self-test for the pure engine modules. Run: node tools/selftest.mjs
   Checks that the same seed always gives the same world, and that the maths stays within its limits. */
import assert from 'node:assert/strict';
import { alea } from '../src/core/rng.js';
import { createNoise } from '../src/core/noise.js';
import { makeConfig, encodeConfig, decodeConfig, DEFAULT_CONFIG } from '../src/core/config.js';
import { createTerrain } from '../src/world/terrain.js';
import { fillTile, tileIndex, vertexCount, skirtDepth } from '../src/world/tiledata.js';
import { Road } from '../src/world/router.js';
import { createRails, RAIL_R } from '../src/world/bridge_rails.js';
import { rumbleFor } from '../src/input/rumble.js';
import { sanitiseSaved } from '../src/core/saved.js';
import { TrafficSim, MODES, SLOT } from '../src/traffic/sim.js';
import { Autodrive } from '../src/input/autodrive.js';
import { VehiclePhysics, vehicleParams, SURFACES } from '../src/vehicle/physics.js';
import { VEHICLES } from '../src/vehicle/defs.js';
import { RapierVehicle, initRapier, ARCADE } from '../src/vehicle/rapier-vehicle.js';
import { CAMFX } from '../src/vehicle/camfx.js';
import { LOOK } from '../src/fx/grade.js';
import { LOCATIONS, locationConfig } from '../src/world/locations.js';
import { ROAD_STYLES, roadSurfaceAt } from '../src/world/roadstyles.js';
import * as tuning from '../src/core/tuning.js';
import { explain, DOCS } from '../src/core/tuning-docs.js';
import worker from '../cloudflare/worker.js';

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
    if (r.bridgeW(s)) continue;                                                                                                       // on a bridge the land is left alone (see the bridge test)
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
await atest('rapier: bridge rails stop every vehicle (none gets through, physics stays finite)', () => {
  const rail = []; for (let x = -50; x < 1200; x++) rail.push({ x, z: 5.33, r: RAIL_R, slide: true }, { x, z: -5.33, r: RAIL_R, slide: true });
  for (const [id, kmh] of [['car', 130], ['car', 220], ['truck', 80], ['bike', 70]]) {
    const i = VEHICLES.findIndex(v => v.id === id), V = VEHICLES[i], p = vehicleParams(V.body, V.stats), ph = new RapierVehicle(p, V.id, flat({ near: (x, z, r) => [rail.filter(c => Math.abs(c.x - x) < r + 2)] }));
    let worst = 0; for (let k = 0; k < 60 * 12; k++) { ph.step(1 / 60, { steer: k > 200 && k < 330 ? 0.3 : 0, throttle: ph.kmh < kmh ? 1 : 0.3, brake: 0 }); worst = Math.max(worst, Math.abs(ph.z)); assert.ok(Number.isFinite(ph.x + ph.z + ph.u), id + ' physics blew up at the rail'); }
    assert.ok(worst < 5.2, id + ' got through the rail: ' + worst.toFixed(2) + ' m from the centre line'); ph.free();
  }
});
await atest('rapier: cornering is grip-limited and stable; steering is Ackermann and the lock shrinks with speed', () => {
  for (let i = 0; i < VEHICLES.length; i++) {
    const V = VEHICLES[i], ph = rv(i); for (let t = 0; t < 90 && ph.kmh < V.stats.Top * 0.93; t += 1 / 60) ph.step(1 / 60, GO); let slip = 0, hi = 0;       // up to near its own top speed (a truck needs far longer than a car) drive(ph, 4, q => { slip = Math.max(slip, q.slip); if (hi === 0 && q.steer > 0.99) hi = Math.abs(q.delta); return { steer: 1, throttle: 0, brake: 0 }; });
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

test('bridges: over water the deck carries the road and the land is left alone; on land nothing changes', () => {
  let bridged = 0, land = 0;
  for (const seed of ['peace', 'coast', 'alps', 'kilo']) {
    const { t, r } = world(seed); r.ensure(-4000, 4000);
    for (let s = r.sMin + 80; s < r.sMax - 80; s += 5) {
      const p = r.at(s, {}), w = r.bridgeW(s);
      if (w === 1) { bridged++; assert.ok(Math.abs(t.drive(p.x, p.z) - p.y) < 0.05, 'wheels are on the deck'); assert.ok(Math.abs(t.height(p.x, p.z) - t.base(p.x, p.z)) < 0.05, 'land untouched under a bridge'); }
      else if (w === 0) land++;
    }
  }
  assert.ok(bridged > 0 && land > bridged, 'some bridge, mostly land: ' + bridged + ' / ' + land);
});
test('bridge rails: rail circles sit on the drawn rail of a bridge, and only there', () => {
  let onRail = 0, offBridge = 0;
  for (const seed of ['peace', 'coast', 'alps', 'kilo']) {
    const { r } = world(seed); r.ensure(-4000, 4000); const W = r.style.shoulder, near = createRails(r, W), p = {};
    for (let s = r.sMin + 80; s < r.sMax - 80; s += 7) {
      r.at(s, p); const w = r.bridgeW(s), nx = -p.tz, nz = p.tx, off = W - 0.07;
      if (w === 1) {                                                                                       // a car beside the rail of a bridge: circles right where the rail is
        const list = near(p.x + nx * (off - 1.2), p.z + nz * (off - 1.2), 6)[0]; assert.ok(list.length > 0, 'no rail circles beside a bridge rail at s=' + s);
        for (const c of list) { const q = {}; r.at(r.closestS(c.x, c.z, s), q); assert.ok(Math.abs(Math.hypot(c.x - q.x, c.z - q.z) - off) < 0.35, 'rail circle is not on the rail line: ' + Math.hypot(c.x - q.x, c.z - q.z).toFixed(2)); assert.equal(c.r, RAIL_R); }
        onRail++;
      } else if (w === 0 && [-60, -30, 0, 30, 60].every(d => r.bridgeW(s + d) === 0)) {                    // well away from any bridge: nothing
        assert.equal(near(p.x + nx * 2, p.z + nz * 2, 6)[0].length, 0, 'rail circles on plain road at s=' + s); offBridge++;
      }
    }
  }
  assert.ok(onRail > 0 && offBridge > 0, 'saw bridge and land: ' + onRail + ' / ' + offBridge);
});
test('tunnels: a deep cutting becomes a tunnel (mountain left whole, wheels on the deck) and no canyon is left', () => {
  const cfg = locationConfig('alps', 'alps'), t = createTerrain(cfg), r = new Road(t, cfg); r.ensure(-4000, 4000); t.attachRoad(r);
  let tunnel = 0, worstCut = 0;
  for (let s = r.sMin + 80; s < r.sMax - 80; s += 5) {
    const p = r.at(s, {}), w = r.tunnelW(s);
    if (w === 1) { tunnel++; assert.ok(Math.abs(t.height(p.x, p.z) - t.base(p.x, p.z)) < 0.05, 'mountain left whole'); assert.ok(Math.abs(t.drive(p.x, p.z) - p.y) < 0.05, 'wheels on the deck'); }
    else if (!r.carriedW(s)) worstCut = Math.max(worstCut, t.base(p.x, p.z) - p.y);
  }
  assert.ok(tunnel > 0, 'the Alps have tunnels'); assert.ok(worstCut < 45, 'deepest remaining cutting ' + worstCut.toFixed(0) + ' m');
});
test('road styles: columns and strips are valid, surfaces are physics keys, two-lane keeps its old widths', () => {
  for (const st of Object.values(ROAD_STYLES)) {
    assert.ok(st.cols.length > 1 && st.strips.length > 0, st.id);
    for (const [a, b] of st.strips) { assert.ok(a >= 0 && b < st.cols.length && b === a + 1, st.id + ' strip'); assert.ok(st.cols[b][0] >= st.cols[a][0], st.id + ' columns run left to right'); }
    for (const c of st.cols) assert.ok(st.colour[c[2]], st.id + ' colour ' + c[2]);
    for (const [d, k] of st.surfaces) { assert.ok(SURFACES[k], st.id + ' surface ' + k); assert.ok(d <= st.grade.flat, st.id + ' surface within the flat band'); }
    assert.ok(st.grade.lift[0] < st.grade.flat, st.id + ' lift ends inside the flat band');
  }
  for (const st of Object.values(ROAD_STYLES)) { const sorted = st.strips.map(x => x[0]).sort((a, b) => a - b); if (st.id !== 'two-lane') for (let i = 0; i < st.cols.length; i++) assert.ok(st.cols[i][0] === -st.cols[st.cols.length - 1 - i][0], st.id + ' symmetric'); }
  const t = ROAD_STYLES['two-lane'];
  assert.deepEqual([t.grade.flat, t.grade.blend, t.clear, t.grade.lift[0]], [9, 46, 10, 5.4]);
  assert.equal(roadSurfaceAt(t, 3), 'asphalt'); assert.equal(roadSurfaceAt(t, 5), 'gravel'); assert.equal(roadSurfaceAt(t, 8), null);
});

test('tuning: settings are found by path, applied, replaced as a whole and reset', () => {
  const V = [{ id: 'car', name: 'x', body: { mass: 1350 }, stats: { Top: 240 } }], T = { day: { top: '#2f6fd6', sun: [-0.3, 0.85, -0.45], li: 3.2 } }; let cfg = { seed: 'a', terrain: { hills: { amp: 46 } } };
  tuning.registerRoot('vehicles', V); tuning.registerRoot('times', T); tuning.registerRoot('world', () => cfg);
  const f = tuning.describe(), by = p => f.find(x => x.path === p);
  assert.equal(by('vehicles.car.body.mass').value, 1350); assert.equal(by('times.day.top').type, 'colour'); assert.ok(by('times.day.sun.1')); assert.ok(!f.some(x => x.path.endsWith('.name') || x.path.endsWith('.seed')));
  assert.deepEqual(tuning.setOverrides({ 'vehicles.car.body.mass': 2000, 'times.day.sun.1': 0.2, 'world.terrain.hills.amp': 90 }).length, 3);
  assert.equal(V[0].body.mass, 2000); assert.equal(T.day.sun[1], 0.2); assert.equal(cfg.terrain.hills.amp, 90);
  tuning.setOverrides({ 'world.terrain.hills.amp': 70 }); assert.equal(V[0].body.mass, 1350); assert.equal(T.day.sun[1], 0.85);      // a path left out goes back to its default
  assert.equal(tuning.applyWorld({ terrain: { hills: { amp: 1 } } }).terrain.hills.amp, 70); tuning.setOverrides({});
});

await atest('worker: anyone reads the published settings; only the password publishes; bad data is refused; history keeps versions', async () => {
  const kv = new Map(), env = { SETTINGS: { get: async (k, t) => kv.has(k) ? (t === 'json' ? JSON.parse(kv.get(k)) : kv.get(k)) : null, put: async (k, v) => { kv.set(k, v); } }, TUNER_PASSWORD: 'pw', AUTH_DELAY_MS: 0, ASSETS: { fetch: async () => new Response('static') } };
  const call = (path, method = 'GET', body, pw) => worker.fetch(new Request('https://x.test' + path, { method, body: body && JSON.stringify(body), headers: pw ? { authorization: 'Bearer ' + pw } : {} }), env);
  assert.equal((await call('/api/settings')).status, 200); assert.deepEqual((await (await call('/api/settings')).json()).overrides, {});
  assert.equal((await call('/api/settings', 'PUT', { overrides: { 'a.b': 1 } })).status, 401); assert.equal((await call('/api/settings', 'PUT', { overrides: { 'a.b': 1 } }, 'nope')).status, 401);
  assert.equal((await call('/api/settings', 'PUT', { overrides: { 'a b': 1 } }, 'pw')).status, 400); assert.equal((await call('/api/settings', 'PUT', { overrides: { 'a.b': 'text' } }, 'pw')).status, 400); assert.equal((await call('/api/settings', 'PUT', { overrides: { 'a.b': NaN } }, 'pw')).status, 400);
  assert.equal((await call('/api/settings', 'PUT', { overrides: { 'vehicles.car.body.mass': 2000, 'times.day.top': '#aabbcc' } }, 'pw')).status, 200);
  assert.equal((await (await call('/api/settings')).json()).overrides['vehicles.car.body.mass'], 2000);
  await call('/api/settings', 'PUT', { overrides: { 'a.b': 2 }, note: 'second' }, 'pw');
  assert.equal((await call('/api/history')).status, 401); const h = (await (await call('/api/history', 'GET', null, 'pw')).json()).history; assert.equal(h.length, 2); assert.equal(h[0].note, 'second');
  const raw = (body, headers) => worker.fetch(new Request('https://x.test/api/settings', { method: 'PUT', body, headers: { authorization: 'Bearer pw', ...headers } }), env);
  assert.equal((await raw('{not json')).status, 400); assert.equal((await raw('[1,2]')).status, 400); assert.equal((await raw(JSON.stringify({ overrides: { 'a.b': 1e12 } }))).status, 400, 'absurd number refused'); assert.equal((await raw(JSON.stringify({ overrides: { 'a.b': -1e12 } }))).status, 400);
  assert.equal((await raw(JSON.stringify({ overrides: { 'a.b': 1e6 } }))).status, 200, 'a big but sane number is fine');
  assert.equal((await raw('x'.repeat(70000))).status, 413, 'a body over 64 KB is refused'); assert.equal((await raw('{}', { 'content-length': '999999' })).status, 413, 'refused from the declared size, before reading');
  assert.equal((await call('/api/settings')).headers.get('x-content-type-options'), 'nosniff');
  const t0 = Date.now(); const slow = await worker.fetch(new Request('https://x.test/api/settings', { method: 'PUT', body: '{}', headers: { authorization: 'Bearer nope' } }), { ...env, AUTH_DELAY_MS: 250 }); assert.equal(slow.status, 401); assert.ok(Date.now() - t0 >= 240, 'a wrong password waits before it answers');
  assert.equal((await worker.fetch(new Request('https://x.test/api/settings', { method: 'PUT', body: '{}', headers: { authorization: 'Bearer pw' } }), { ...env, TUNER_PASSWORD: undefined })).status, 503, 'no password set up: the API says so');
  assert.equal(await (await call('/index.html')).text(), 'static');
  const bare = { ASSETS: env.ASSETS }; assert.equal((await worker.fetch(new Request('https://x.test/api/settings'), bare)).status, 503);        // not set up: API says so, nothing else breaks
  assert.equal((await worker.fetch(new Request('https://x.test/next.html'), bare)).status, 200);
});

test('rumble: quiet on smooth road, thumps on a hit, buzzes on loose ground, and the level and the off switch work', () => {
  const calm = { speed: 30, surface: 'asphalt', slip: 0.02, impact: 0, buff: false, throttle: 0.5, hand: 0 };
  assert.equal(rumbleFor(calm, 1), null); assert.equal(rumbleFor({ ...calm, impact: 9 }, 0), null, 'off means off'); assert.equal(rumbleFor(null, 1), null);
  const hit = rumbleFor({ ...calm, impact: 10 }, 1); assert.ok(hit.strong > 0.7 && hit.ms >= 150, 'a hard hit is a heavy thump');
  assert.ok(rumbleFor({ ...calm, impact: 4 }, 1).strong < hit.strong, 'a softer hit is a softer thump');
  const grass = rumbleFor({ ...calm, surface: 'grass' }, 1); assert.ok(grass.weak > 0.05 && grass.strong === 0, 'grass is a light buzz');
  assert.equal(rumbleFor({ ...calm, surface: 'grass', speed: 1 }, 1), null, 'no buzz when almost stopped');
  const slide = rumbleFor({ ...calm, slip: 0.5 }, 1); assert.ok(slide.weak >= 0.4, 'a slide is felt');
  const half = rumbleFor({ ...calm, impact: 10 }, 0.5); assert.ok(Math.abs(half.strong - hit.strong / 2) < 1e-9, 'level scales the strength');
  for (const t of [hit, grass, slide]) assert.ok(t.strong >= 0 && t.strong <= 1 && t.weak >= 0 && t.weak <= 1, 'magnitudes stay in 0..1');
});
test('saved choices: rubbish in storage never gets into the game (null, text, wrong types, bad colours, unknown ids)', () => {
  const ctx = { vehicles: 3, vehicleIds: ['car', 'truck', 'bike'], locations: ['default', 'alps'] };
  for (const bad of [null, undefined, 'text', 42, [1, 2], true, { paint: null }, { paint: 'x' }, { paint: [] }, { radioVol: 'loud' }, { radioVol: NaN }, { vehicle: 'x' }, { vehicle: -1 }, { vehicle: 99 }, { vehicle: 1.5 }, { time: 'midnight' }, { weather: {} }, { lights: 7 }, { muted: 'yes' }]) {
    const s = sanitiseSaved(bad, ctx); assert.equal(typeof s.paint, 'object'); assert.ok(s.paint && !Array.isArray(s.paint), 'paint is always an object');
    for (const k of ['radioVol', 'vehicle', 'time', 'weather', 'lights', 'muted']) assert.ok(!(k in s), k + ' dropped for ' + JSON.stringify(bad));
  }
  const good = sanitiseSaved({ time: 'dusk', weather: 'rain', lights: 'on', vehicle: 2, muted: true, rumble: 'off', radioVol: 3, station: 'kexp-90-3-seattle', camBefore: 'far', location: 'alps', paint: { car: '#C8101C', truck: 'red', ghost: '#ffffff', bike: '#12' }, extra: 'ignored' }, ctx);
  assert.deepEqual(good, { time: 'dusk', weather: 'rain', lights: 'on', vehicle: 2, muted: true, rumble: 'off', radioVol: 1, station: 'kexp-90-3-seattle', camBefore: 'far', location: 'alps', paint: { car: '#C8101C' } });
  assert.equal(sanitiseSaved({ location: 'atlantis' }, ctx).location, undefined);
});
test('traffic: cars keep to their lanes and the right side, keep a safe gap, appear far from the player, are bounded and deterministic', () => {
  const run = (seed, mode, drive, secs = 140) => {
    const { r } = world(seed), sim = new TrafficSim(r, { seed, mode, drive }), p = {}; let ps = 0, maxCars = 0, bridge = 0, minGap = 1e9, bornNear = 1e9; const half = r.style.half;
    for (let t = 0; t < secs && ps + 3 < r.sMax - 200; t += 0.1) {
      ps += 25 * 0.1; r.at(ps, p); sim.update(0.1, { x: p.x, z: p.z, s: ps, u: 25, yaw: p.th });
      maxCars = Math.max(maxCars, sim.cars.length);
      for (const c of sim.cars) {
        assert.ok(Math.abs(c.lat) < half, 'a car left the asphalt: lateral ' + c.lat.toFixed(2) + ' of ' + half); assert.ok(c.speed >= 0 && c.speed <= 33, 'speed ' + c.speed.toFixed(1));
        assert.equal(c.lat < 0, (c.dir > 0) === (drive === 'right'), 'car on the wrong side of the road');
        if (r.bridgeW(c.s) === 1) bridge++; bornNear = Math.min(bornNear, c.bornDist);
        const q = {}; r.at(c.s, q); assert.ok(Math.hypot(c.x - (q.x - q.tz * c.lat), c.z - (q.z + q.tx * c.lat)) < 1e-6, 'the car is on its lane line');
      }
      for (const a of sim.cars) for (const b of sim.cars) if (a !== b && a.dir === b.dir && a.lane === b.lane && (b.s - a.s) * a.dir > 0) minGap = Math.min(minGap, (b.s - a.s) * a.dir - (a.len + b.len) / 2);
    }
    return { sim, maxCars, bridge, minGap, bornNear };
  };
  const light = run('peace', 'light', 'right'), busy = run('peace', 'busy', 'right'), left = run('peace', 'busy', 'left');
  assert.ok(light.maxCars > 0 && light.maxCars <= MODES.light, 'light traffic is bounded: ' + light.maxCars); assert.ok(busy.maxCars > light.maxCars && busy.maxCars <= MODES.busy, 'busy has more but is bounded: ' + busy.maxCars);
  for (const x of [light, busy, left]) { assert.ok(x.minGap > -0.01, 'cars never overlap (smallest gap ' + x.minGap.toFixed(2) + ' m)'); assert.ok(x.bornNear >= 150 - 1e-6, 'nothing appears near the player: ' + x.bornNear.toFixed(0) + ' m'); }
  assert.equal(run('peace', 'off', 'right', 20).maxCars, 0, 'off means no cars');
  const again = run('peace', 'busy', 'right'); assert.deepEqual(again.sim.cars.map(c => [c.id, +c.s.toFixed(3), c.lane, c.kind]), busy.sim.cars.map(c => [c.id, +c.s.toFixed(3), c.lane, c.kind]), 'the same world and path give the same traffic');
  const alps = run('alps', 'busy', 'right', 200); assert.ok(alps.bridge > 0, 'some cars cross a bridge on their lane');
  const { r } = world('peace'), sim = new TrafficSim(r, { seed: 'x', mode: 'busy' }), p = {}; r.at(0, p); sim.update(0.1, { x: p.x, z: p.z, s: 0, u: 0, yaw: p.th });
  const n0 = sim.cars.length; assert.ok(n0 > 0); sim.setMode('light'); assert.equal(sim.cars.length, 0, 'changing mode clears the cars'); sim.setMode('off'); sim.update(0.1, { x: p.x, z: p.z, s: 0, u: 0, yaw: p.th }); assert.equal(sim.cars.length, 0);
  sim.setMode('busy'); sim.update(0.1, { x: p.x, z: p.z, s: 0, u: 0, yaw: p.th }); const far = { x: p.x, z: p.z, s: 3000, u: 0, yaw: p.th }; r.at(3000, p); far.x = p.x; far.z = p.z; sim.update(0.1, far); assert.ok(sim.cars.every(c => c.s > 3000 - 350 - SLOT && c.s < 3000 + 700 + SLOT), 'after a jump along the road, only cars in the new window remain');
  const blocked = new TrafficSim(r, { seed: 'b', mode: 'busy', drive: 'right' }); r.at(0, p); blocked.update(0.1, { x: p.x, z: p.z, s: 0, u: 0, yaw: p.th }); const c0 = blocked.cars.find(c => c.dir > 0 && c.s > 150); assert.ok(c0, 'a car ahead in our direction');
  const stop = { s: c0.s + 80, u: 0, yaw: 0 }; for (let t = 0; t < 10; t += 0.1) { const q = {}; r.at(stop.s, q); stop.x = q.x - q.tz * c0.lat; stop.z = q.z + q.tx * c0.lat; stop.yaw = q.th; blocked.update(0.1, stop); }
  const cc = blocked.cars.find(c => c.id === c0.id); assert.ok(cc && cc.s < stop.s - 2 && cc.speed < 0.5, 'a car stops before a stationary obstacle in its lane (stopped ' + (cc ? (stop.s - cc.s).toFixed(1) : '?') + ' m short)');
  const hits = blocked.circles(cc.x, cc.z, 6)[0]; assert.ok(hits.length >= 3 && hits.every(h => h.r > 0.9 && Math.hypot(h.x - cc.x, h.z - cc.z) < cc.len), 'cars give the physics obstacle circles'); assert.equal(blocked.circles(cc.x + 500, cc.z, 6)[0].length, 0, 'none far away');
});
await atest('traffic: a traffic car is solid: the player hits it and does not pass through', () => {
  const { r } = world('peace'), sim = new TrafficSim(r, { seed: 'solid', mode: 'busy' });
  for (const id of ['car', 'truck']) {
    sim.cars = [{ id: 1, x: 90, z: 0, yaw: 0, len: 4.4, w: 1.85 }];                                         // a stopped car 90 m ahead, across the player's path
    const i = VEHICLES.findIndex(v => v.id === id), V = VEHICLES[i], p = vehicleParams(V.body, V.stats), ph = new RapierVehicle(p, V.id, flat({ near: (x, z, rr) => sim.circles(x, z, rr) }));
    let hit = false, worst = 0, maxX = -1e9; for (let k = 0; k < 60 * 14; k++) { ph.step(1 / 60, { steer: 0, throttle: ph.kmh < (id === 'car' ? 100 : 60) ? 1 : 0.3, brake: 0 }); if (ph.impact > 2) hit = true; maxX = Math.max(maxX, ph.x); assert.ok(Number.isFinite(ph.x + ph.z + ph.u), id + ' physics blew up at the traffic car'); }
    assert.ok(hit, id + ' felt the traffic car'); assert.ok(maxX < 90 - 1.5, id + ' went through the traffic car (reached x = ' + maxX.toFixed(1) + ')'); ph.free();
  }
});
await atest('autodrive among traffic: it keeps to its lane, follows slower cars at a gap and never hits one over a long run', () => {
  for (const [seed, mode, drive] of [['peace', 'busy', 'right'], ['coast', 'busy', 'left']]) {
    const { t, r } = world(seed), sim = new TrafficSim(r, { seed: 'ad' + seed, mode, drive }), V = VEHICLES[0], p = vehicleParams(V.body, V.stats);
    const ph = new RapierVehicle(p, V.id, { height: (x, z) => t.drive(x, z), surface: (x, z) => t.surface(x, z), near: (x, z, rr) => sim.circles(x, z, rr), seaLevel: t.seaLevel });
    const q = r.at(40, {}), dir = 1; ph.reset(q.x - q.tz * sim.lateral(dir, 0) * -1, q.z + q.tx * sim.lateral(dir, 0), q.th);                  // in the lane the traffic uses for this direction
    const ad = new Autodrive(); ad.lane = d => sim.lateral(d, 0); ad.leader = (pp, s) => sim.leaderAhead({ x: pp.x, z: pp.z, s, yaw: pp.yaw, u: pp.u }); ad.toggle(true); ad.s = 40;
    let s = 40, hits = 0, off = 0, closest = 1e9, follow = 0, slowest = 99, truck = null; const lat = {};      // a slow truck is put 150 m ahead in the lane, so there is always something to follow
    for (let k = 0; k < 60 * 90; k++) {
      const inp = ad.update(ph, r); ph.step(1 / 60, { steer: inp.steer, throttle: inp.throttle, brake: inp.brake, hand: 0, rev: 0 }); s = ad.s;
      sim.update(1 / 60, { x: ph.x, z: ph.z, s, u: ph.u, yaw: ph.yaw }); if (ph.impact > 1) hits++;
      if (k === 0) { truck = { id: 9999, s: s + 150, dir: 1, lane: 0, kind: 'truck', len: 8.5, w: 2.5, v0: 7, speed: 7, colour: 0, lat: sim.lateral(1, 0), stuck: 0, bump: 0, born: 0, bornDist: 150, x: 0, z: 0, y: 0, yaw: 0, brake: 0 }; sim.place(truck); sim.cars.push(truck); }
      r.at(s, lat); const pl = (ph.x - lat.x) * -lat.tz + (ph.z - lat.z) * lat.tx; if (Math.abs(pl - sim.lateral(dir, 0)) > 1.6) off++;
      const L = sim.leaderAhead({ x: ph.x, z: ph.z, s, yaw: ph.yaw, u: ph.u }, 30); if (L) { closest = Math.min(closest, L.gap); follow++; if (L.gap < 20) slowest = Math.min(slowest, ph.u); }
    }
    assert.ok(follow > 60, seed + ': it met the slow truck (' + (follow / 60).toFixed(1) + ' s)'); assert.ok(slowest < 12, seed + ': it slowed down behind the truck (slowest ' + slowest.toFixed(1) + ' m/s)'); assert.equal(hits, 0, seed + ': the autodrive hit a traffic car ' + hits + ' times'); assert.ok(s - 40 > 500, seed + ': it made progress (' + (s - 40).toFixed(0) + ' m)');
    console.log('     autodrive+traffic', seed, drive, 'progress', (s - 40).toFixed(0), 'm, met traffic for', (follow / 60).toFixed(1), 's, closest', closest > 1e8 ? 'none' : closest.toFixed(1) + ' m, off lane', (off / 60).toFixed(1), 's'); assert.ok(off < 60 * 90 * 0.04, seed + ': it kept its lane (off the lane for ' + (off / 60).toFixed(1) + ' s)'); assert.ok(closest > 1.5, seed + ': it kept a gap behind cars (closest ' + closest.toFixed(1) + ' m)'); ph.free();
  }
});
await atest('my music: only audio files within limits are kept, songs play in turn and are freed again (nothing leaves the device)', async () => {
  const fake = new Map(); class FakeAudio { constructor() { this.attrs = {}; this.ev = {}; this.volume = 1; this.paused = true; } addEventListener(n, f) { this.ev[n] = f; } set src(v) { this.attrs.src = v; } get src() { return this.attrs.src; } getAttribute(k) { return this.attrs[k] || null; } removeAttribute(k) { delete this.attrs[k]; } load() {} pause() { this.paused = true; } play() { this.paused = false; return Promise.resolve(); } error = null; }
  globalThis.Audio = FakeAudio; const { Radio } = await import('../src/audio/radio.js'); const { classify, cleanName, MAX_BYTES, MAX_TRACKS } = await import('../src/audio/localmusic.js');
  assert.equal(cleanName('03 - Night Drive (Official Video).mp3'), 'Night Drive'); assert.equal(cleanName('my_song.flac'), 'my song');
  const c = classify([{ name: 'a.mp3', type: 'audio/mpeg', size: 10 }, { name: 'b.txt', type: 'text/plain', size: 10 }, { name: 'c.wav', type: '', size: 10 }, { name: 'huge.mp3', type: 'audio/mpeg', size: MAX_BYTES + 1 }, { name: 'e.mp3', type: 'audio/mpeg', size: 0 }], 0);
  assert.deepEqual(c.ok.map(f => f.name), ['a.mp3', 'c.wav']); assert.deepEqual(c.skipped.map(f => f.reason), ['not an audio file', 'too big (over 80 MB)', 'empty file']);
  assert.equal(classify([{ name: 'x.mp3', type: 'audio/mpeg', size: 5 }], MAX_TRACKS).skipped.length, 1);
  const r = new Radio(), before = r.stations.length, revoked = [], realRevoke = URL.revokeObjectURL; URL.revokeObjectURL = u => { revoked.push(u); realRevoke.call(URL, u); };
  const res = r.addLocal([new File(['aaa'], '01 One.mp3', { type: 'audio/mpeg' }), new File(['bbb'], 'Two.ogg', { type: 'audio/ogg' }), new File(['x'], 'notes.txt', { type: 'text/plain' })]);
  assert.equal(res.added, 2); assert.equal(res.skipped.length, 1); assert.equal(r.stations.length, before + 1); assert.equal(r.stations[before].name, 'My music'); assert.equal(r.stations[before].genre, '2 songs');
  r.tune(before); assert.equal(r.state().track, 'One'); const first = r.audio.src; r.audio.ev.ended(); assert.equal(r.state().track, 'Two'); assert.notEqual(r.audio.src, first); r.audio.ev.ended(); assert.equal(r.state().track, 'One');    // round and round
  r.skipTrack(-1); assert.equal(r.state().track, 'Two');
  r.clearLocal(); assert.equal(r.stations.length, before); assert.equal(r.index, -1); assert.equal(revoked.length, 2); URL.revokeObjectURL = realRevoke; delete globalThis.Audio;
});
test('tuner help: every vehicle, surface and world setting has an explanation and a range', () => {
  tuning.registerRoot('vehicles', VEHICLES); tuning.registerRoot('surfaces', SURFACES); tuning.registerRoot('world', DEFAULT_CONFIG); tuning.registerRoot('handling', ARCADE); tuning.registerRoot('camera', CAMFX); tuning.registerRoot('look', LOOK);
  const missing = tuning.describe().filter(f => !explain(f.path)).map(f => f.path);
  assert.deepEqual(missing, [], 'no help written for: ' + missing.join(', '));
  for (const [k, v] of Object.entries(DOCS)) { assert.ok(Array.isArray(v) && v.length === 2 && v[0].length > 10 && v[1].length > 1, k); }
});

console.log(`\n${passed} checks passed`);
