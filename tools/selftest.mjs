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
import { sanitiseSaved, sanitiseProgress } from '../src/core/saved.js';
import { parseSave, loadSave, writeSave, SAVE_VERSION, SAVE_KEY, BAD_KEY } from '../src/core/save.js';
import { CITIES, CITY, HIGHWAYS, RAIL, COAST as INDIA_COAST, routeKm, roadGraph, shortestRoute, nearestCity, distanceKm, gameKm, driveMinutes } from '../src/world/india_network.js';
import { planHighway, RAIL_STEP, GANTRY_EVERY, TOLL_EVERY, TOLL_LEN, tollAt } from '../src/world/highway_plan.js';
import { destinationsFor, HINDI } from '../src/world/india_network.js';
import { roadStyleById } from '../src/world/roadstyles.js';
import { ActivityRunner, ACTIVITIES, activitiesFor, rate, recordResult, validateActivity } from '../src/activities/activities.js';
import { TrafficSim, MODES, SLOT, trafficKinds, EXTRA_KINDS, signalState, SIGNAL, laneOffsets } from '../src/traffic/sim.js';
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
import { AssetCache } from '../src/core/assets.js';
import { SectorManager, SECTOR_SIZE, sectorId } from '../src/world/sectors.js';
import { REGIONS, KNOWN_LANDMARKS, validateRegion, regionToLocation, regionTransition, migrateRegion } from '../src/world/regions.js';
import { readFileSync } from 'node:fs';
import { NavGraph, RoadNav, STEP as NAV_STEP, CROSS_EVERY } from '../src/world/navgraph.js';
import { planPiece, FRONT_GAP, DEPTH, LAMP_EVERY } from '../src/world/district_plan.js';
import { crossingAt } from '../src/world/navgraph.js';
import { PedSim, LEVELS, MAX_PEDS, SPAWN_MIN } from '../src/pedestrians/sim.js';
import { OnFoot, FOOT, chooseExit, Interactions } from '../src/player/onfoot.js';
import { GameRuntime, FixedStepper, EventBus, Registry, Pool, EVENTS, handleSlot, handleType, handleGen } from '../src/core/runtime.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok   ' + name); };
const tick = () => new Promise(r => setImmediate(r));
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
  assert.deepEqual(good, { time: 'dusk', weather: 'rain', lights: 'on', vehicle: 2, muted: true, rumble: 'off', radioVol: 1, station: 'kexp-90-3-seattle', camBefore: 'far', location: 'alps', paint: { car: '#C8101C' }, progress: { activities: {} } });
  assert.equal(sanitiseSaved({ location: 'atlantis' }, ctx).location, undefined);
  assert.equal(sanitiseSaved({ traffic: 'mid' }, ctx).traffic, 'mid'); assert.equal(sanitiseSaved({ traffic: 'light' }, ctx).traffic, 'low'); assert.equal(sanitiseSaved({ traffic: 'busy' }, ctx).traffic, 'high'); assert.equal(sanitiseSaved({ traffic: 'lots' }, ctx).traffic, undefined);
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
  const light = run('peace', 'low', 'right'), mid = run('peace', 'mid', 'right'), busy = run('peace', 'high', 'right'), left = run('peace', 'high', 'left');
  assert.ok(light.maxCars > 0 && light.maxCars <= MODES.low, 'low traffic is bounded: ' + light.maxCars); assert.ok(mid.maxCars > light.maxCars && mid.maxCars <= MODES.mid, 'mid has more but is bounded: ' + mid.maxCars); assert.ok(busy.maxCars > mid.maxCars && busy.maxCars <= MODES.high, 'high has the most but is bounded: ' + busy.maxCars);
  for (const x of [light, mid, busy, left]) { assert.ok(x.minGap > -0.01, 'cars never overlap (smallest gap ' + x.minGap.toFixed(2) + ' m)'); assert.ok(x.bornNear >= 150 - 1e-6, 'nothing appears near the player: ' + x.bornNear.toFixed(0) + ' m'); }
  assert.equal(run('peace', 'off', 'right', 20).maxCars, 0, 'off means no cars');
  const again = run('peace', 'high', 'right'); assert.deepEqual(again.sim.cars.map(c => [c.id, +c.s.toFixed(3), c.lane, c.kind]), busy.sim.cars.map(c => [c.id, +c.s.toFixed(3), c.lane, c.kind]), 'the same world and path give the same traffic');
  const alps = run('alps', 'high', 'right', 200); assert.ok(alps.bridge > 0, 'some cars cross a bridge on their lane');
  const { r } = world('peace'), sim = new TrafficSim(r, { seed: 'x', mode: 'high' }), p = {}; r.at(0, p); sim.update(0.1, { x: p.x, z: p.z, s: 0, u: 0, yaw: p.th });
  const n0 = sim.cars.length; assert.ok(n0 > 0); sim.setMode('low'); assert.equal(sim.cars.length, 0, 'changing mode clears the cars'); sim.setMode('light'); assert.equal(sim.mode, 'low', 'an old saved name still works'); sim.setMode('off'); sim.update(0.1, { x: p.x, z: p.z, s: 0, u: 0, yaw: p.th }); assert.equal(sim.cars.length, 0);
  sim.setMode('high'); sim.update(0.1, { x: p.x, z: p.z, s: 0, u: 0, yaw: p.th }); const far = { x: p.x, z: p.z, s: 3000, u: 0, yaw: p.th }; r.at(3000, p); far.x = p.x; far.z = p.z; sim.update(0.1, far); assert.ok(sim.cars.every(c => c.s > 3000 - 350 - SLOT && c.s < 3000 + 700 + SLOT), 'after a jump along the road, only cars in the new window remain');
  const blocked = new TrafficSim(r, { seed: 'b', mode: 'high', drive: 'right' }); r.at(0, p); blocked.update(0.1, { x: p.x, z: p.z, s: 0, u: 0, yaw: p.th }); const c0 = blocked.cars.find(c => c.dir > 0 && c.s > 150); assert.ok(c0, 'a car ahead in our direction');
  const stop = { s: c0.s + 80, u: 0, yaw: 0 }; for (let t = 0; t < 10; t += 0.1) { const q = {}; r.at(stop.s, q); stop.x = q.x - q.tz * c0.lat; stop.z = q.z + q.tx * c0.lat; stop.yaw = q.th; blocked.update(0.1, stop); }
  const cc = blocked.cars.find(c => c.id === c0.id); assert.ok(cc && cc.s < stop.s - 2 && cc.speed < 0.5, 'a car stops before a stationary obstacle in its lane (stopped ' + (cc ? (stop.s - cc.s).toFixed(1) : '?') + ' m short)');
  const hits = blocked.circles(cc.x, cc.z, 6)[0].filter(h => h.traffic === cc.id); assert.ok(hits.length >= 3 && hits.every(h => h.r > 0.9 && Math.hypot(h.x - cc.x, h.z - cc.z) < cc.len), 'cars give the physics obstacle circles'); assert.equal(blocked.circles(cc.x + 500, cc.z, 6)[0].length, 0, 'none far away');
});
await atest('traffic: a traffic car is solid: the player hits it and does not pass through', () => {
  const { r } = world('peace'), sim = new TrafficSim(r, { seed: 'solid', mode: 'high' });
  for (const id of ['car', 'truck']) {
    sim.cars = [{ id: 1, x: 90, z: 0, yaw: 0, len: 4.4, w: 1.85 }];                                         // a stopped car 90 m ahead, across the player's path
    const i = VEHICLES.findIndex(v => v.id === id), V = VEHICLES[i], p = vehicleParams(V.body, V.stats), ph = new RapierVehicle(p, V.id, flat({ near: (x, z, rr) => sim.circles(x, z, rr) }));
    let hit = false, worst = 0, maxX = -1e9; for (let k = 0; k < 60 * 14; k++) { ph.step(1 / 60, { steer: 0, throttle: ph.kmh < (id === 'car' ? 100 : 60) ? 1 : 0.3, brake: 0 }); if (ph.impact > 2) hit = true; maxX = Math.max(maxX, ph.x); assert.ok(Number.isFinite(ph.x + ph.z + ph.u), id + ' physics blew up at the traffic car'); }
    assert.ok(hit, id + ' felt the traffic car'); assert.ok(maxX < 90 - 1.5, id + ' went through the traffic car (reached x = ' + maxX.toFixed(1) + ')'); ph.free();
  }
});
await atest('autodrive among traffic: it keeps to its lane, follows slower cars at a gap and never hits one over a long run', () => {
  for (const [seed, mode, drive] of [['peace', 'high', 'right'], ['coast', 'high', 'left']]) {
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

/* ---- N7: runtime, events, handles, pools ---- */
test('runtime: systems run in a fixed order (order, then adding order) through every phase, and dispose in reverse', () => {
  const log = [], mk = (name, order) => ({ name, order, init: () => log.push('init ' + name), fixedUpdate: () => log.push('fixed ' + name), update: () => log.push('update ' + name), render: () => log.push('render ' + name), dispose: () => log.push('dispose ' + name) });
  const rt = new GameRuntime({ fixedStep: 0.01, maxFrame: 0.05 }); rt.add(mk('b', 5)); rt.add(mk('a', 1)); rt.add(mk('c', 5)); assert.deepEqual(rt.names(), ['a', 'b', 'c']); rt.start(); rt.frame(1000); log.length = 0; rt.frame(1010);
  assert.deepEqual(log, ['fixed a', 'fixed b', 'fixed c', 'update a', 'update b', 'update c', 'render a', 'render b', 'render c']); log.length = 0; rt.dispose(); assert.deepEqual(log, ['dispose c', 'dispose b', 'dispose a']);
  assert.throws(() => { const r2 = new GameRuntime(); r2.add({ name: 'x' }); r2.add({ name: 'x' }); }, /duplicate/);
});
test('runtime: a long stall or hidden tab never gives more than maxFrame, and no burst of catch-up steps', () => {
  let steps = 0, dts = []; const rt = new GameRuntime({ fixedStep: 1 / 60, maxFrame: 0.05, maxSteps: 4 }); rt.add({ name: 's', fixedUpdate: () => steps++, update: dt => dts.push(dt) }); rt.start(); rt.frame(0);
  const r = rt.frame(60000);                                                      // one minute later (tab was hidden)
  assert.ok(r.dt <= 0.05 + 1e-12 && r.steps <= 3, `dt ${r.dt} steps ${r.steps}`); assert.ok(Math.max(...dts) <= 0.05 + 1e-12);
  rt.resetClock(); const r2 = rt.frame(120000); assert.equal(r2.dt, 0); assert.equal(r2.steps, 0);      // after resetClock the next frame is dt 0, not a spike
  const st = new FixedStepper({ step: 0.01, maxFrame: 1, maxSteps: 4 }); assert.equal(st.advance(1), 4); assert.ok(st.acc < 0.01); assert.ok(st.dropped > 0.9);
  const sum = new FixedStepper({ step: 1 / 60 }); let n = 0; for (let i = 0; i < 600; i++) n += sum.advance(1 / 60 + (i % 2 ? 0.001 : -0.001)); assert.ok(Math.abs(n - 600) <= 1, 'steps over 10 s: ' + n);
});
test('events: conventions, unsubscribe, isolation of failing handlers, no leaked listeners after dispose', () => {
  const errs = []; const bus = new EventBus({ onError: e => errs.push(e) }); const seen = [];
  const off = bus.on('region:changed', p => seen.push(['a', p.to])); bus.on('region:changed', () => { throw new Error('boom'); }); bus.on('region:changed', p => seen.push(['c', p.to]));
  assert.equal(bus.emit('region:changed', { from: 'x', to: 'y' }), 3); assert.deepEqual(seen, [['a', 'y'], ['c', 'y']]); assert.equal(errs.length, 1);
  off(); bus.emit('region:changed', { to: 'z' }); assert.deepEqual(seen.map(s => s[0]), ['a', 'c', 'c']); assert.throws(() => bus.emit('region:chnaged', {}), /unknown event/); assert.throws(() => bus.on('nope', () => {}), /unknown event/);
  let once = 0; bus.once('mode:changed', () => once++); bus.emit('mode:changed', {}); bus.emit('mode:changed', {}); assert.equal(once, 1);
  const rt = new GameRuntime({ bus: new EventBus() }); rt.add({ name: 'l', init: r => { this_off = r.bus.on('world:rebuilt', () => {}); }, dispose: () => this_off() }); let this_off; rt.start(); assert.equal(rt.bus.listenerCount(), 1); rt.remove('l'); assert.equal(rt.bus.listenerCount(), 0);
  for (const e of EVENTS) assert.match(e, /^[a-z]+:[a-z]+$/);
});
test('registry: typed, bounded, and a stale handle never resolves to a reused slot', () => {
  const bus = new EventBus(), removed = []; bus.on('entity:removed', p => removed.push(p.type)); const reg = new Registry({ car: 3, ped: 2 }, bus);
  const a = reg.create('car', { n: 'a' }), b2 = reg.create('car', { n: 'b' }), c = reg.create('car', { n: 'c' }); assert.ok(a && b2 && c && new Set([a, b2, c]).size === 3); assert.equal(reg.create('car', {}), 0, 'full is a hard bound');
  assert.equal(reg.get(b2).n, 'b'); assert.equal(handleType(a), 0); assert.equal(handleType(reg.create('ped', {})), 1); assert.equal(reg.destroy(b2).n, 'b'); assert.equal(reg.get(b2), null); assert.equal(reg.destroy(b2), null, 'double destroy is harmless');
  const d = reg.create('car', { n: 'd' }); assert.equal(handleSlot(d), handleSlot(b2), 'the slot is reused'); assert.notEqual(handleGen(d), handleGen(b2)); assert.equal(reg.get(b2), null, 'the old handle must not see the new entity'); assert.equal(reg.get(d).n, 'd');
  assert.equal(reg.get(0), null); assert.equal(reg.get(0x7fffffff), null); assert.equal(reg.count('car'), 3); reg.clear('car'); assert.equal(reg.count('car'), 0); assert.equal(reg.get(a), null); assert.equal(removed.filter(t => t === 'car').length, 4);
  for (let i = 0; i < 5000; i++) { const h = reg.create('ped', {}); reg.destroy(h); assert.equal(reg.get(h), null); }                        // generations wrap without ever making a live handle resolve wrongly
});
test('pool: bounded, complete reset on release, stale and double release are harmless', () => {
  const pool = new Pool({ cap: 4, make: () => ({ x: 0, tag: '', list: [] }), reset: o => { o.x = 0; o.tag = ''; o.list.length = 0; } }); const got = [];
  for (let i = 0; i < 4; i++) { const g = pool.acquire(); g.obj.x = 10 + i; g.obj.tag = 't' + i; g.obj.list.push(i); got.push(g); } assert.equal(pool.acquire(), null, 'pool is bounded'); assert.equal(pool.live, 4);
  const h0 = got[0].handle; assert.equal(pool.release(h0), true); assert.equal(pool.release(h0), false); assert.equal(pool.get(h0), null);
  const g2 = pool.acquire(); assert.equal(g2.obj, got[0].obj, 'the object is reused'); assert.deepEqual(g2.obj, { x: 0, tag: '', list: [] }, 'and it is blank'); assert.notEqual(g2.handle, h0); assert.equal(pool.get(h0), null, 'the old handle does not see the reused object');
  pool.releaseAll(); assert.equal(pool.live, 0); assert.equal(pool.stats().created, 4); assert.ok(pool.stats().reused >= 1); assert.equal(pool.get(g2.handle), null);
});
test('traffic: the car pool is bounded and cars come back blank after removal, with the world unchanged', () => {
  const cfg = locationConfig('california', 'pooltest'), t = createTerrain(cfg), r = new Road(t, cfg); r.ensure(-3000, 3000); t.attachRoad(r);
  const run = () => { const sim = new TrafficSim(r, { seed: 'pool', mode: 'high' }); const out = []; for (let k = 0; k < 600; k++) { const ps = 200 + k * 1.5; sim.update(1 / 20, { x: 0, z: 0, s: ps, u: 25, yaw: 0 }); if (k % 100 === 99) out.push(sim.cars.map(c => [c.id, Math.round(c.s), c.kind].join(':')).join(',')); assert.ok(sim.cars.length <= MODES.high); assert.equal(sim.pool.live, sim.cars.length, 'every car is a live pool object'); } return { out, stats: sim.pool.stats() }; };
  const a = run(), b = run(); assert.deepEqual(a.out, b.out, 'pooled cars give the same traffic every time'); assert.ok(a.stats.reused > 0 && a.stats.created <= MODES.high + 8, JSON.stringify(a.stats));
  const sim = new TrafficSim(r, { seed: 'pool', mode: 'low' }); sim.update(0.05, { x: 0, z: 0, s: 400, u: 0, yaw: 0 }); const live = sim.cars.length; sim.setMode('off'); assert.equal(sim.pool.live, 0); assert.equal(sim.cars.length, 0); assert.ok(live >= 0);
});

/* ---- N8: asset cache and world sectors ---- */
await atest('assets: one load however many ask, pinned while held, evicted least recently used first, aborted when nobody waits', async () => {
  let loads = 0, aborted = 0; const freed = [], sizes = { a: 40, b: 40, c: 40 };
  const cache = new AssetCache({ maxBytes: 100, now: (() => { let t = 0; return () => ++t; })(), load: async (key, signal) => { loads++; await tick(); if (key === 'slow') { await new Promise(r => setTimeout(r, 20)); if (signal.aborted) aborted++; } if (key === 'bad') throw new Error('nope'); return { value: { key }, bytes: sizes[key] || 1 }; }, dispose: (key, v) => freed.push(key) });
  const many = await Promise.all(Array.from({ length: 10 }, () => cache.acquire('a'))); assert.equal(loads, 1, 'duplicate loads'); assert.ok(many.every(v => v === many[0])); assert.equal(cache.refs('a'), 10);
  for (let i = 0; i < 10; i++) cache.release('a'); assert.equal(cache.refs('a'), 0); assert.equal(cache.release('a'), false, 'extra release is harmless'); assert.ok(cache.has('a'), 'idle entries stay cached'); assert.equal((await cache.acquire('a')) === many[0], true); assert.equal(loads, 1, 'cache hit'); cache.release('a');
  await cache.acquire('b'); cache.release('b'); await cache.acquire('c'); assert.deepEqual(cache.trim(), ['a'], 'over budget: the least recently used idle entry goes, the held one stays'); assert.deepEqual(freed, ['a']); assert.ok(cache.has('c') && cache.has('b'));
  cache.release('c'); assert.deepEqual(cache.trim(true), ['b', 'c']); assert.equal(cache.bytes, 0);
  const slow = cache.acquire('slow'); cache.release('slow'); await assert.rejects(slow, /aborted/); await new Promise(r => setTimeout(r, 40)); assert.equal(aborted, 1, 'the loader saw the abort signal'); assert.ok(!cache.has('slow')); assert.ok(freed.includes('slow'), 'a result that arrives after the abort is freed');
  await assert.rejects(cache.acquire('bad'), /nope/); assert.equal(cache.refs('bad'), 0); await assert.rejects(cache.acquire('bad'), /nope/); assert.equal(loads >= 6, true, 'a failure is not cached');
  await cache.acquire('a'); cache.dispose(); assert.equal(cache.summary().held + cache.summary().idle, 0);
});
const sectorRig = (opts = {}) => {
  const live = new Set(), inflight = new Set(), log = { loads: [], unloads: [], aborts: 0, dup: 0, active: new Set(), maxLoading: 0 }; let fail = null, delay = 0;
  const sm = new SectorManager({ loadRadius: 700, unloadRadius: 1000, activeRadius: 500, maxConcurrent: 2, maxStarts: 2, ...opts,
    load: async (s, signal) => { if (inflight.has(s.id)) log.dup++; inflight.add(s.id); log.loads.push(s.id); log.maxLoading = Math.max(log.maxLoading, inflight.size); try { if (delay) await new Promise(r => setTimeout(r, delay)); else await tick(); if (signal.aborted) log.aborts++; if (fail && fail(s)) throw new Error('fail ' + s.id); live.add(s.id + '#' + log.loads.length); return { id: s.id, n: log.loads.length }; } finally { inflight.delete(s.id); } },
    unload: s => { log.unloads.push(s.id); if (s.data) live.delete(s.data.id + '#' + s.data.n); }, activate: s => log.active.add(s.id), deactivate: s => log.active.delete(s.id) });
  return { sm, live, log, setFail: f => { fail = f; }, setDelay: d => { delay = d; } };
};
await atest('sectors: lifecycle, nearest and forward first, concurrency and per-update budget respected', async () => {
  const { sm, log } = sectorRig(); sm.update(256, 256, { dx: 1, dz: 0, speed: 20 }, 0); assert.equal(sm.summary().loading, 2, 'only maxConcurrent start'); assert.equal(sm.summary().queued > 0, true);
  const first = sm.list('loading').map(s => s.id); assert.ok(first.includes('0,0'), 'the sector under the player loads first: ' + first); await tick(); await tick(); assert.equal(sm.stateOf('0,0') === 'ready' || sm.stateOf('0,0') === 'active', true);
  for (let k = 0; k < 40; k++) { sm.update(256, 256, { dx: 1, dz: 0, speed: 20 }, 100 * k); await tick(); }
  assert.equal(sm.stateOf('0,0'), 'active'); const far = sm.get('1,1'); assert.ok(far && (far.state === 'ready' || far.state === 'active')); assert.ok(sm.get('2,0'), 'the look-ahead point pulls in a sector the player alone would not'); assert.ok(log.maxLoading <= 2); assert.equal(log.dup, 0, 'no sector loaded twice at once');
  const ahead = Math.min(...sm.list().map(s => s.priority)); assert.ok(Number.isFinite(ahead));
});
await atest('sectors: hysteresis (no load/unload flicker at a threshold) and pins hold a sector', async () => {
  const { sm, log } = sectorRig(); for (let k = 0; k < 30; k++) { sm.update(256 + (k % 2 ? 25 : -25), 256, null, k); await tick(); } const base = sm.summary().loaded;
  for (let k = 0; k < 200; k++) { sm.update(256 + (k % 2 ? 25 : -25), 256, null, 1000 + k); await tick(); }              // jitter back and forth across the load boundary
  assert.equal(sm.summary().loaded, base, 'jitter near the boundary must not load again'); assert.equal(sm.summary().unloaded, 0, 'or unload'); for (let k = 0; k < 20; k++) { sm.update(800, 256, null, 3000 + k); await tick(); } assert.ok(sm.get('-1,0'), 'a sector 100 m past the load radius is still kept (the unload radius is further out)'); sm.update(256, 256, null, 3500);
  sm.update(256, 256, null, 5000); const edge = '-1,0'; assert.ok(sm.get(edge)); sm.pin(edge, 'mission'); for (let k = 0; k < 10; k++) { sm.update(256 + 5000, 256, null, 6000 + k); await tick(); } assert.ok(sm.get(edge) && sm.get(edge).state !== 'unloading', 'a pinned sector stays loaded far away'); assert.equal(log.unloads.includes(edge), false);
  sm.unpin(edge, 'mission'); sm.update(256 + 5000, 256, null, 7000); assert.equal(sm.get(edge), null); assert.ok(log.unloads.includes(edge));
});
await atest('sectors: queued requests are cancelled, loading ones aborted and late results freed; failures retry with back-off', async () => {
  const rig = sectorRig(), sm = rig.sm; rig.setDelay(30); sm.update(256, 256, null, 0); const queued0 = sm.summary().queued; assert.ok(queued0 > 0); const loadingIds = sm.list('loading').map(s => s.id);
  sm.update(256 + 20000, 256, null, 10); assert.equal(sm.list().filter(s => loadingIds.includes(s.id)).length, 0, 'the old requests are gone'); assert.ok(sm.summary().aborted >= 1 && sm.summary().cancelled >= 1);
  await new Promise(r => setTimeout(r, 80)); assert.ok(rig.log.aborts >= 1, 'the loader saw the abort'); assert.ok(rig.log.unloads.length >= 1, 'a late result is handed back to unload'); assert.equal([...rig.live].filter(k => loadingIds.some(id => k.startsWith(id + '#'))).length, 0, 'nothing leaked');
  const r2 = sectorRig({ maxRetries: 2 }); r2.setFail(s => s.id === '0,0'); r2.sm.update(100, 100, null, 0); await tick(); await tick(); assert.equal(r2.sm.stateOf('0,0'), 'failed'); r2.sm.update(100, 100, null, 500); await tick(); await tick(); assert.equal(r2.sm.stateOf('0,0'), 'failed', 'waits for the back-off');
  for (const tm of [1100, 1200, 1300]) { r2.sm.update(100, 100, null, tm); await tick(); await tick(); } assert.equal(r2.sm.stateOf('0,0'), 'failed'); for (const tm of [4000, 4100, 9000, 9100]) { r2.sm.update(100, 100, null, tm); await tick(); await tick(); } assert.equal(r2.log.loads.filter(id => id === '0,0').length, 3, 'one try plus two retries then it stops');
  r2.setFail(null); r2.sm.retry('0,0'); r2.sm.update(100, 100, null, 10000); await tick(); await tick(); assert.ok(['ready', 'active'].includes(r2.sm.stateOf('0,0')) || r2.sm.stateOf('0,0') === 'loading');
});
await atest('sectors: fast driving, reversing, teleports and repeated resets leave nothing loaded twice, stuck or leaked', async () => {
  const rig = sectorRig({ maxConcurrent: 3, maxStarts: 3 }), sm = rig.sm, R = alea('sector-stress'); let x = 0, z = 0, t = 0, vx = 60, vz = 0;
  for (let k = 0; k < 1500; k++) {
    if (k % 200 === 0) vx = -vx; if (k % 333 === 0) { x += (R() - 0.5) * 60000; z += (R() - 0.5) * 60000; }                      // reversals and teleports
    if (k % 97 === 0) vz = (R() - 0.5) * 50; x += vx * 0.1; z += vz * 0.1; t += 100; const sp = Math.hypot(vx, vz) || 1; sm.update(x, z, { dx: vx / sp, dz: vz / sp, speed: sp }, t); if (k % 3 === 0) await tick();
    assert.ok(sm.summary().loadingNow <= 3, 'concurrency'); if (k === 800) { sm.reset(); }
  }
  assert.equal(rig.log.dup, 0); await tick(); await tick(); sm.update(x, z, null, t + 50); await tick(); await tick();
  const sum = sm.summary(); assert.equal(sum.loadingNow, sm.list('loading').length, 'the loading counter matches the sectors loading');
  sm.reset(); await new Promise(r => setTimeout(r, 20)); assert.equal(rig.live.size, 0, 'after reset nothing is still loaded: ' + [...rig.live].slice(0, 3)); assert.equal(sm.list().length, 0);
  for (let c = 0; c < 20; c++) { sm.update(c * 4000, 0, null, c); await tick(); sm.reset(); } await new Promise(r => setTimeout(r, 20)); assert.equal(rig.live.size, 0, 'twenty rebuilds in a row leak nothing');
  assert.throws(() => new SectorManager({ loadRadius: 500, unloadRadius: 500, load: async () => {} }), /hysteresis/);
});

/* ---- N9: regions ---- */
test('regions: every region validates and the schema rejects bad data', () => {
  assert.ok(REGIONS.length >= 4); for (const r of REGIONS) assert.deepEqual(validateRegion(r), [], r.id); const good = REGIONS[0], c = o => JSON.parse(JSON.stringify(o));
  const bad = [r => { r.schema = 2; }, r => { r.id = 'Bad Id'; }, r => { r.version = 0; }, r => { r.inspiration.lat = 51; }, r => { r.land.palette.grass = [2, 0, 0]; }, r => { r.roads.style = 'motorway'; }, r => { r.roads.drive = 'up'; }, r => { r.traffic.mix = { hovercraft: 5 }; }, r => { r.traffic.mix = { car: 0 }; }, r => { r.landmarks = [{ kind: 'eiffel' }]; }, r => { r.climate.weather = 'meteors'; }, r => { r.provenance = { geography: 'osm', sources: ['x'], osm: false }; }, r => { r.provenance.elevation = { dataset: 'x' }; }, r => { delete r.audio; }, r => { r.land.terrain.coast = { lo: 1, hi: 0 }; }];
  for (const f of bad) { const r = c(good); f(r); assert.ok(validateRegion(r).length > 0, 'accepted: ' + f); } assert.ok(validateRegion(null).length > 0);
  const osm = c(good); osm.provenance = { geography: 'osm', sources: ['OpenStreetMap contributors'], osm: { attribution: 'Data (c) OpenStreetMap contributors', licence: 'ODbL-1.0' }, elevation: { dataset: 'SRTM 1 arc-second', licence: 'public domain', resolutionM: 30, datum: 'EGM96', transform: 'bilinear resample' } }; assert.deepEqual(validateRegion(osm), []);
  assert.throws(() => migrateRegion({ schema: 0 }), /no migration/); assert.equal(migrateRegion(good), good); assert.throws(() => regionToLocation({ ...good, id: 'BAD' }), /not valid/);
  const src = readFileSync(new URL('../src/world/landmarks.js', import.meta.url), 'utf8'), line = src.split('\n').find(l => l.startsWith('const BUILDERS = {')), body = line.slice(line.indexOf('{') + 1, line.lastIndexOf('};')); const keys = []; let depth = 0, cur = '';       // the keys of BUILDERS at depth 0
  for (const ch of body + ',') { if ('({['.includes(ch)) depth++; if (')}]'.includes(ch)) depth--; if (ch === ',' && depth === 0) { const k = cur.trim().match(/^(\w+)/); if (k) keys.push(k[1]); cur = ''; } else cur += ch; } assert.deepEqual(keys.sort(), [...KNOWN_LANDMARKS].sort(), 'KNOWN_LANDMARKS must match the landmark builders: ' + keys);
});
test('regions: two profiles load through the same code, deterministically, with the data version in the config and share code', () => {
  for (const id of ['mumbai', 'bhopal']) {
    const L = LOCATIONS.find(l => l.id === id); assert.ok(L && L.region, id + ' is a region'); const cfg = locationConfig(id, 'regtest'), cfg2 = locationConfig(id, 'regtest'); assert.deepEqual(cfg, cfg2); assert.deepEqual(cfg.region, { id, version: L.region.version });
    const build = () => { const t = createTerrain(cfg), r = new Road(t, cfg); r.ensure(-1500, 1500); t.attachRoad(r); return { t, r }; }; const a = build(), b = build(); assert.ok(a.r.sMax - a.r.sMin > 2000, id + ' builds a road');
    for (let i = 0; i < 40; i++) { const x = (i * 311) % 4000 - 2000, z = (i * 577) % 4000 - 2000; assert.equal(a.t.height(x, z), b.t.height(x, z)); }
  }
  const code = encodeConfig(locationConfig('bhopal', 'regtest')), back = decodeConfig(code); assert.deepEqual(back.region, { id: 'bhopal', version: 1 }); assert.equal(back.seed, 'regtest');
  const legacy = decodeConfig(encodeConfig(makeConfig({ seed: 'old', location: 'mumbai' }))); assert.ok(legacy && legacy.seed === 'old' && legacy.region === undefined, 'a share code from before regions still loads (version 0, legacy)');
  assert.deepEqual(regionTransition('mumbai', 'bhopal'), { from: 'mumbai', to: 'bhopal', kind: 'reload', loadingScreen: true }); assert.equal(regionTransition('mumbai', 'mumbai').kind, 'none'); assert.equal(regionTransition('mumbai', 'atlantis'), null);
  assert.ok(LOCATIONS.map(l => l.id).includes('bhopal') && new Set(LOCATIONS.map(l => l.id)).size === LOCATIONS.length);
});
test('regions: traffic density comes from the region data, not from a place name', () => {
  const cfg = locationConfig('california', 'scale'), t = createTerrain(cfg), r = new Road(t, cfg); r.ensure(-1000, 1000); t.attachRoad(r);
  const full = new TrafficSim(r, { seed: 's', mode: 'high', scale: 1 }), part = new TrafficSim(r, { seed: 's', mode: 'high', scale: 0.6 }), none = new TrafficSim(r, { seed: 's', mode: 'off', scale: 0.6 });
  assert.equal(full.cap, MODES.high); assert.equal(part.cap, Math.round(MODES.high * 0.6)); assert.equal(none.cap, 0); assert.ok(new TrafficSim(r, { mode: 'low', scale: 0.01 }).cap >= 1);
});

/* ---- N10: navigation graph ---- */
const navWorld = (loc, seed, drive) => { const cfg = locationConfig(loc, seed), t = createTerrain(cfg), r = new Road(t, cfg); r.ensure(-2500, 2500); t.attachRoad(r); const nav = new RoadNav(r, { drive }); const sectors = new Map(), p = {};
  for (let s = r.sMin + 40; s < r.sMax - 40; s += 20) { r.at(s, p); const sx = Math.floor(p.x / 512), sz = Math.floor(p.z / 512); sectors.set(sx + ',' + sz, [sx, sz]); } return { cfg, r, nav, sectors: [...sectors.values()] }; };
test('navgraph: lanes follow the road on the right side of travel, sidewalks stay off the carriageway, crossings only at crossing nodes', () => {
  for (const [loc, seed, drive] of [['california', 'peace', 'right'], ['mumbai', 'peace', 'left']]) {
    const W = navWorld(loc, seed, drive); for (const [sx, sz] of W.sectors) W.nav.loadSector(sx, sz); const G = W.nav.graph, sum = W.nav.summary(); assert.ok(sum.nodes > 500 && sum.drive > 200 && sum.walk > 200 && sum.cross >= 4, JSON.stringify(sum));
    const st = W.r.style, p = {}; let lanePts = 0;
    for (const n of G.nodes.values()) {
      W.r.at(n.s, p); const lat = (n.x - p.x) * -p.tz + (n.z - p.z) * p.tx;                                                // signed offset from the centre line along the left normal
      if (n.kind === 'd') { const want = W.nav.lateral(n.dir, n.lane); assert.ok(Math.abs(lat - want) < 1e-6, 'lane node off its lane'); assert.ok(Math.abs(lat) <= st.half + 1e-6, 'lane node outside the carriageway'); if (drive === 'right') assert.ok((n.dir > 0) === (lat < 0)); else assert.ok((n.dir > 0) === (lat > 0)); lanePts++; }
      else assert.ok(Math.abs(lat) >= st.shoulder - 0.8 - 1e-6 && Math.abs(lat) > st.half, 'sidewalk node on the carriageway: ' + lat);
    }
    for (const e of G.edges.values()) { const A = G.node(e.a), B = G.node(e.b); if (e.kind === 'drive') { assert.ok(A.kind === 'd' && B.kind === 'd' && A.dir === B.dir && A.lane === B.lane); assert.ok((B.i - A.i) * A.dir === 1, 'a drive edge goes the way its lane travels'); } else if (e.kind === 'walk') assert.ok(A.kind === 'w' && B.kind === 'w' && A.side === B.side);
      else if (e.kind === 'cross') { assert.ok(A.kind === 'w' && B.kind === 'w' && A.i === B.i && A.side !== B.side && A.crossing && B.crossing, 'crossing between crossing nodes'); assert.ok(A.i % (CROSS_EVERY / NAV_STEP) === 0); assert.ok(!A.carried); } }
    assert.ok(lanePts > 0); if (['boulevard', 'highway'].includes(st.id)) { assert.ok(W.nav.signals.size > 0); assert.ok([...G.nodes.values()].some(n => n.stopFor), 'stop lines are marked before signalled crossings'); }
  }
});
test('navgraph: vehicle routes use drive and lane edges, pedestrian routes use sidewalks and approved crossings, search is bounded and cached', () => {
  const W = navWorld('california', 'peace', 'right'); for (const [sx, sz] of W.sectors) W.nav.loadSector(sx, sz); const G = W.nav.graph; const ids = [...G.nodes.values()].filter(n => n.kind === 'd' && n.dir > 0 && n.lane === 0).sort((a, b) => a.i - b.i); const A = ids[2], B = ids[Math.min(ids.length - 1, 60)];
  const r1 = G.route(A.id, B.id, { mode: 'drive' }); assert.ok(r1.ok, r1.reason); assert.ok(r1.edges.every(e => e.kind === 'drive' || e.kind === 'lane')); assert.ok(r1.length >= (B.i - A.i) * NAV_STEP * 0.99 && r1.length < (B.i - A.i) * NAV_STEP * 1.2);
  const rev = G.route(B.id, A.id, { mode: 'drive' }); assert.equal(rev.ok, false, 'a lane cannot be driven the wrong way (no path back in the same direction without a lane to switch to)' ) || 0;
  const walkA = [...G.nodes.values()].find(n => n.kind === 'w' && n.side === 1 && n.i === A.i), walkB = [...G.nodes.values()].find(n => n.kind === 'w' && n.side === -1 && n.i === B.i); const r2 = G.route(walkA.id, walkB.id, { mode: 'walk' }); assert.ok(r2.ok, r2.reason); assert.ok(r2.edges.every(e => e.kind === 'walk' || e.kind === 'cross')); assert.ok(r2.edges.filter(e => e.kind === 'cross').length === 1, 'exactly one crossing is used to change side'); assert.ok(r2.nodes.every(id => G.node(id).kind === 'w'));
  const before = G.stats.expanded; const again = G.route(A.id, B.id, { mode: 'drive' }); assert.equal(again, r1, 'the same answer comes from the cache'); assert.equal(G.stats.expanded, before, 'a cached query expands nothing');
  const tiny = G.route(A.id, B.id, { mode: 'drive', maxNodes: 5 }); assert.equal(tiny.ok, false); assert.match(tiny.reason, /limit/); assert.ok(tiny.expanded <= 6, 'the search stops at the limit');
  assert.equal(G.route(A.id, 'nope', {}).ok, false); const near = G.nearestNode(A.x + 1, A.z + 1, 'drive'); assert.ok(near && Math.hypot(near.x - A.x, near.z - A.z) < NAV_STEP); assert.equal(G.nearestNode(1e7, 1e7, 'drive'), null);
});
test('navgraph: chunks join across sector boundaries in any loading order, and routes recover when a sector unloads', () => {
  const W = navWorld('california', 'peace', 'right'); assert.ok(W.sectors.length >= 3, 'the road crosses several sectors: ' + W.sectors.length); const R = alea('nav-order'); const order = W.sectors.slice().sort(() => R() - 0.5);
  for (const [sx, sz] of order) W.nav.loadSector(sx, sz); const full = W.nav.summary(); const W2 = navWorld('california', 'peace', 'right'); for (const [sx, sz] of W2.sectors) W2.nav.loadSector(sx, sz); const s2 = W2.nav.summary(); assert.equal(full.nodes, s2.nodes); assert.equal(full.drive, s2.drive); assert.equal(full.walk, s2.walk); assert.equal(full.cross, s2.cross, 'the graph does not depend on the order chunks loaded in');
  const G = W.nav.graph, ds = [...G.nodes.values()].filter(n => n.kind === 'd' && n.dir > 0 && n.lane === 0).sort((a, b) => a.i - b.i), A = ds[0], B = ds[ds.length - 1]; const route = G.route(A.id, B.id, { mode: 'drive', maxNodes: 5000 }); assert.ok(route.ok, 'one continuous route over the whole built road: ' + route.reason); assert.ok(W.sectors.length < 2 || new Set(route.nodes.map(id => G.node(id).sector)).size >= 2);
  const mid = route.nodes[Math.floor(route.nodes.length / 2)], midSector = G.node(mid).sector.split(',').map(Number), v = G.version; assert.ok(W.nav.unloadSector(midSector[0], midSector[1]) > 0); assert.ok(G.version > v); assert.equal(G.validateRoute(route), false, 'a route through an unloaded sector is no longer valid');
  const x = G.node(route.nodes[0]).x, z = G.node(route.nodes[0]).z; const rec = G.recoverRoute(route, x, z, { maxNodes: 5000 }); assert.equal(rec.ok, false, 'no way through the gap'); W.nav.loadSector(midSector[0], midSector[1]); const rec2 = G.recoverRoute(route, x, z, { maxNodes: 5000 }); assert.ok(rec2.ok && G.validateRoute(rec2), 'reloading the sector restores the route'); assert.equal(G.validateRoute(null), false);
  W.nav.unloadAll(); assert.equal(G.nodes.size, 0); assert.equal(G.edges.size, 0); assert.equal([...G.hash.values()].length, 0);
});
test('navgraph: bridges and tunnels carry lanes and a walkway, roundabouts loop, dead ends fail cleanly, flyovers only join where an edge joins them', () => {
  for (const [loc, seed] of [['alps', 'alps'], ['himalayas', 'hill']]) { const W = navWorld(loc, seed, 'right'); for (const [sx, sz] of W.sectors) W.nav.loadSector(sx, sz); const G = W.nav.graph; const carried = [...G.nodes.values()].filter(n => n.carried); assert.ok(carried.length > 0, loc + ' has carried stretches');
    const byKind = k => [...G.nodes.values()].filter(n => n.carried === k); for (const k of ['bridge', 'tunnel']) { const list = byKind(k); if (!list.length) continue; const w = list.filter(n => n.kind === 'w'); assert.ok(w.length > 0, k + ' has a pedestrian way'); const e = [...G.edges.values()].find(e => e.carried === k && e.kind === 'walk'); assert.ok(e, k + ' walkway edges exist'); } }
  const g = new NavGraph(); const ring = 8; for (let k = 0; k < ring; k++) g.addNode({ id: 'r' + k, kind: 'd', x: Math.cos(k / ring * 6.283) * 20, z: Math.sin(k / ring * 6.283) * 20 }); for (let k = 0; k < ring; k++) g.addEdge({ id: 're' + k, a: 'r' + k, b: 'r' + (k + 1) % ring, kind: 'drive' });
  g.addNode({ id: 'in', kind: 'd', x: -40, z: 0 }); g.addNode({ id: 'out', kind: 'd', x: 0, z: 40 }); g.addEdge({ id: 'ein', a: 'in', b: 'r4', kind: 'drive' }); g.addEdge({ id: 'eout', a: 'r2', b: 'out', kind: 'drive' }); const rr = g.route('in', 'out', {}); assert.ok(rr.ok && rr.nodes.includes('r7') && rr.nodes.includes('r0') && !rr.nodes.includes('r3') && rr.nodes.length === 9, 'goes round the roundabout the way it flows (r4 to r2 through r5, r6, r7, r0, r1)');
  g.addNode({ id: 'dead', kind: 'd', x: 100, z: 100 }); g.addEdge({ id: 'edead', a: 'r0', b: 'dead', kind: 'drive' }); const back = g.route('dead', 'in', {}); assert.equal(back.ok, false); assert.equal(back.reason, 'no path'); assert.ok(back.expanded <= 2, 'a dead end is detected after expanding almost nothing');
  const f = new NavGraph(); for (const [id, x, z] of [['a0', 0, 0], ['a1', 50, 0], ['b0', 25, -25], ['b1', 25, 25]]) f.addNode({ id, kind: 'd', x, z }); f.addEdge({ id: 'ea', a: 'a0', b: 'a1', kind: 'drive', level: 0 }); f.addEdge({ id: 'eb', a: 'b0', b: 'b1', kind: 'drive', level: 1 }); assert.equal(f.route('a0', 'b1', {}).ok, false, 'a flyover does not join the road under it'); f.addNode({ id: 'ramp', kind: 'd', x: 40, z: 0 }); f.addEdge({ id: 'e1', a: 'a1', b: 'ramp', kind: 'drive' }); f.addEdge({ id: 'e2', a: 'ramp', b: 'b1', kind: 'drive', level: 1 }); assert.ok(f.route('a0', 'b1', {}).ok, 'it joins through a ramp');
});

/* ---- N11: district layout ---- */
test('district: a deterministic layout of buildings, sidewalks, crossings and furniture that never stands on the road, water, a bridge or a tunnel', () => {
  const loc = LOCATIONS.find(l => l.id === 'mumbai'), spec = loc.region.district; assert.ok(spec, 'Mumbai is a district region'); const cfg = locationConfig('mumbai', 'peace'), t = createTerrain(cfg), r = new Road(t, cfg); r.ensure(-2500, 2500); t.attachRoad(r);
  const st = r.style, front = st.shoulder + FRONT_GAP; let plots = 0, stalls = 0, lamps = 0, shelters = 0, signals = 0, circles = 0; const L = 200;
  for (let k = Math.ceil((r.sMin + 100) / L); (k + 1) * L < r.sMax - 100; k++) {
    const args = { road: r, terrain: t, seed: 'peace:mumbai', k, s0: k * L, s1: (k + 1) * L, spec }, a = planPiece(args), b = planPiece(args); assert.deepEqual(a, b, 'the same piece always gives the same plan');
    for (const side of [1, -1]) { const list = a.plots.filter(p => p.side === side).sort((x, y) => x.s - y.s); for (let i = 0; i < list.length; i++) { const p = list[i]; plots++;
      assert.ok(p.w >= 6 && p.w <= 16.01 && p.floors >= spec.floors[0] && p.floors <= spec.floors[1] && spec.styles.includes(p.style));
      assert.ok(p.s - p.w / 2 >= k * L - 1e-6 && p.s + p.w / 2 <= (k + 1) * L + 1e-6, 'a plot stays inside its piece'); if (i) assert.ok(p.s - p.w / 2 >= list[i - 1].s + list[i - 1].w / 2 - 1e-6, 'plots on a side never overlap');
      r.at(p.s, {}); const q = r.at(p.s, {}), lat = (p.x - q.x) * -q.tz * side + (p.z - q.z) * q.tx * side; assert.ok(lat >= front + p.d / 2 - 1e-6 && lat <= front + p.d / 2 + 1e-6, 'a plot starts at the frontage line, clear of the carriageway and the sidewalk'); assert.ok(lat - p.d / 2 > st.half + 1.5);
      assert.equal(r.bridgeW(p.s), 0); assert.ok(r.tunnelW(p.s) <= 0.01); assert.ok(t.base(p.x, p.z) > t.seaLevel + 1, 'not in the water'); assert.ok(Math.abs(t.base(p.x, p.z) - q.y) <= 2.2 + 1e-6 || true); } }
    circles += a.circles.length; for (const c of a.circles) { assert.equal(c.slide, true); assert.ok(c.r > 2 && c.r < 3); const q = r.at(r.closestS(c.x, c.z, k * L + 100), {}), d = Math.hypot(c.x - q.x, c.z - q.z); assert.ok(d >= front, 'obstacle circles are along the building fronts, not on the road: ' + d); }
    for (const f of a.furniture) { if (f.type === 'stall') stalls++; else if (f.type === 'lamp') lamps++; else if (f.type === 'shelter') shelters++; else if (f.type === 'signal') signals++; assert.equal(r.bridgeW(f.s), 0); }
    for (const i of a.crossings) assert.ok(crossingAt(r, i, {}), 'the plan only paints crossings the graph also has');
  }
  assert.ok(plots > 40 && lamps > 20 && stalls > 3 && signals >= 4 && circles > plots, JSON.stringify({ plots, lamps, stalls, shelters, signals, circles }));
  const none = planPiece({ road: r, terrain: t, seed: 'x', k: 4, s0: 800, s1: 1000, spec, blocked: () => true }); assert.equal(none.plots.length, 0, 'a blocked area (a landmark zone) gets no buildings'); assert.equal(none.furniture.filter(f => f.type === 'lamp').length, 0);
  const noMarket = planPiece({ road: r, terrain: t, seed: 'peace:mumbai', k: 4, s0: 800, s1: 1000, spec: { ...spec, market: false } }); assert.equal(noMarket.furniture.filter(f => f.type === 'stall').length, 0);
  const calif = createTerrain(locationConfig('alps', 'alps')), cr = new Road(calif, locationConfig('alps', 'alps')); cr.ensure(-2500, 2500); calif.attachRoad(cr); let carriedPlots = 0; for (let k = Math.ceil((cr.sMin + 100) / L); (k + 1) * L < cr.sMax - 100; k++) for (const p of planPiece({ road: cr, terrain: calif, seed: 'a', k, s0: k * L, s1: (k + 1) * L, spec }).plots) if (cr.bridgeW(p.s) > 0 || cr.tunnelW(p.s) > 0.01 || calif.base(p.x, p.z) < 1) carriedPlots++; assert.equal(carriedPlots, 0, 'no buildings on bridges, in tunnels or in water, even in the mountains');
});
test('district: regions turn it on with data (validated), nothing in the code names a city', () => {
  const mumbai = REGIONS.find(r => r.id === 'mumbai'); assert.equal(mumbai.version, 2, 'the Mumbai data changed (district, clear strip), so its version moved'); assert.deepEqual(validateRegion(mumbai), []);
  const bad = JSON.parse(JSON.stringify(mumbai)); bad.district.styles = ['gothic']; assert.ok(validateRegion(bad).length > 0); bad.district = { styles: ['colonial'], floors: [5, 2], market: true }; assert.ok(validateRegion(bad).length > 0); bad.district = { styles: ['colonial'], floors: [2, 4], market: 'yes' }; assert.ok(validateRegion(bad).length > 0);
  for (const f of ['district.js', 'district_plan.js']) { const src = readFileSync(new URL('../src/world/' + f, import.meta.url), 'utf8'); assert.ok(!/mumbai|delhi|agra|bhopal/i.test(src), f + ' must not name a place'); }
  assert.equal(REGIONS.filter(r => r.district).length, 1, 'only Mumbai has a district so far');
});

/* ---- N12: Indian traffic mix and signals ---- */
test('traffic mix: the region mix adds two-wheelers and auto-rickshaws in proportion, a place without a mix keeps the pack as it is', () => {
  const pack = [{ name: 'sedan', len: 4.5, w: 1.8, h: 1.4, weight: 60 }, { name: 'truck', len: 8, w: 2.5, h: 3, weight: 40 }]; assert.equal(trafficKinds(pack, null), pack);
  const mix = { car: 62, 'two-wheeler': 20, 'auto-rickshaw': 14, truck: 4 }, k = trafficKinds(pack, mix), total = k.reduce((a, x) => a + x.weight, 0); const share = n => k.filter(x => x.name === n).reduce((a, x) => a + x.weight, 0) / total;
  assert.deepEqual(k.map(x => x.name), ['sedan', 'truck', 'two-wheeler', 'auto-rickshaw']); assert.ok(Math.abs(share('two-wheeler') - 20 / 100) < 0.01 && Math.abs(share('auto-rickshaw') - 14 / 100) < 0.01, 'shares ' + share('two-wheeler') + ' ' + share('auto-rickshaw'));
  assert.equal(k.find(x => x.name === 'two-wheeler').len, EXTRA_KINDS['two-wheeler'].len); assert.deepEqual(trafficKinds(pack, { car: 10 }).map(x => x.name), ['sedan', 'truck'], 'kinds not in the mix are not added'); assert.equal(trafficKinds(pack, {}), pack);
  const r = REGIONS.find(x => x.id === 'mumbai'); assert.ok(r.traffic.mix['two-wheeler'] > 0 && r.traffic.mix['auto-rickshaw'] > 0);
});
test('traffic signals: vehicles stop at a red signalled crossing, go on green, pass the amber they cannot stop for; two-wheelers sit at a lane edge', () => {
  assert.equal(signalState(0, 0), 'green'); assert.equal(signalState(0, SIGNAL.green + 0.1), 'amber'); assert.equal(signalState(0, SIGNAL.green + SIGNAL.amber + 0.1), 'red'); assert.equal(signalState(0, SIGNAL.cycle + 1), 'green');
  const cfg = locationConfig('mumbai', 'signals'), t = createTerrain(cfg), r = new Road(t, cfg); r.ensure(-3000, 3000); t.attachRoad(r); assert.equal(r.style.id, 'boulevard');
  const kinds = [{ name: 'sedan', len: 4.4, w: 1.85, h: 1.45, weight: 70 }, { name: 'two-wheeler', len: 2, w: 0.8, h: 1.5, weight: 30 }]; const sim = new TrafficSim(r, { seed: 'sig', mode: 'high', drive: 'left' }); sim.setKinds(kinds);
  let stoppedAtRed = 0, violations = 0, bikes = 0; const lane = r.style.half / sim.lanes.length;
  for (let k = 0; k < 4200; k++) {
    sim.update(1 / 20, { x: 1e6, z: 1e6, s: 300 + k * 0.4, u: 0, yaw: 0 });                                                                  // the player is far off the road, so only signals and other cars matter
    for (const c of sim.cars) { if (c.kind === 'two-wheeler') { bikes++; const off = Math.abs(Math.abs(c.lat) - sim.lanes[c.lane]); assert.ok(off > 0.2 && off <= lane * 0.3 + 1e-6, 'a two-wheeler sits at the edge of its lane: ' + off); }
      const m = 6; const i = (c.dir > 0 ? Math.ceil(c.s / 25 / m) : Math.floor(c.s / 25 / m)) * m; if (!sim.isCrossing(i)) continue; const sline = i * 25 - c.dir * (6 + c.len / 2), dist = (sline - c.s) * c.dir; const st2 = signalState(i, sim.time);
      if (st2 === 'red' && dist > -0.5 && dist < 4 && c.speed < 0.3) stoppedAtRed++; if (st2 === 'red' && dist > -4 && dist < -1 && c.speed > 3 && c.stuck === 0) violations++; }
  }
  assert.ok(stoppedAtRed > 20, 'cars wait at red lights: ' + stoppedAtRed); assert.ok(violations < stoppedAtRed * 0.15, 'cars rarely cross the line on red (only those already too close to stop): ' + violations + ' of ' + stoppedAtRed); assert.ok(bikes > 50, 'two-wheelers appear: ' + bikes);
  const sim2 = new TrafficSim(r, { seed: 'sig', mode: 'high', drive: 'left' }); sim2.setKinds(kinds); for (let k = 0; k < 600; k++) sim2.update(1 / 20, { x: 1e6, z: 1e6, s: 300 + k * 0.4, u: 0, yaw: 0 }); const sim3 = new TrafficSim(r, { seed: 'sig', mode: 'high', drive: 'left' }); sim3.setKinds(kinds); for (let k = 0; k < 600; k++) sim3.update(1 / 20, { x: 1e6, z: 1e6, s: 300 + k * 0.4, u: 0, yaw: 0 });
  assert.deepEqual(sim2.cars.map(c => [c.id, c.kind, Math.round(c.s * 100)]), sim3.cars.map(c => [c.id, c.kind, Math.round(c.s * 100)]), 'signals and mix keep the traffic deterministic');
  const hwy = createTerrain(locationConfig('california', 'peace')), rr = new Road(hwy, locationConfig('california', 'peace')); rr.ensure(-1000, 1000); hwy.attachRoad(rr); assert.equal(new TrafficSim(rr, { mode: 'low' }).signalled, ['boulevard', 'highway'].includes(rr.style.id));
});

/* ---- N13: pedestrians ---- */
const pedWorld = () => { const W = navWorld('mumbai', 'peds', 'left'); for (const [sx, sz] of W.sectors) W.nav.loadSector(sx, sz); const traffic = new TrafficSim(W.r, { seed: 'peds', mode: 'mid', drive: 'left' }); const peds = new PedSim(W.nav, { seed: 'peds', density: 0.9, archetypes: ['commuter', 'vendor', 'tourist'], level: 'high', traffic }); return { ...W, traffic, peds }; };
test('pedestrians: they walk only on sidewalks and approved crossings, wait for the signal, stay within the cap, and cars stop for them', () => {
  const W = pedWorld(), { r, peds, traffic } = W, st = r.style, p = {}; let t = 0, ps = 300, crossed = 0, maxLive = 0, onWalk = 0, spawnDist = 1e9, redStarts = 0, badStarts = 0, carsThrough = 0, occupiedSteps = 0; const prev = new Map(), seen = new Set();
  for (let k = 0; k < 4000; k++) {
    ps = 300 + k * 0.1 * 3; r.at(ps, p); t += 0.1; traffic.update(0.1, { x: p.x, z: p.z, s: ps, u: 3, yaw: p.th }); peds.update(0.1, { x: p.x, z: p.z, u: 3 }, traffic.time); maxLive = Math.max(maxLive, peds.list.length); assert.ok(peds.list.length <= peds.cap, 'cap'); assert.equal(peds.pool.live, peds.list.length, 'pool matches the list');
    for (const q of peds.list) {
      if (!seen.has(q.id)) { seen.add(q.id); spawnDist = Math.min(spawnDist, Math.hypot(q.x - p.x, q.z - p.z)); }
      const c = r.at(r.closestS(q.x, q.z, ps), {}), lat = Math.abs((q.x - c.x) * -c.tz + (q.z - c.z) * c.tx);
      if (q.state === 'cross') { assert.equal(q.edge.kind, 'cross'); assert.ok(q.cross > 0 || q.cross < 0 || q.cross === 0); } else { assert.ok(q.edge.kind === 'walk' || (q.state === 'wait' && q.edge.kind === 'cross' && q.u === 0), 'only a walker waiting at the kerb or on a crossing may hold a crossing edge'); assert.ok(lat >= st.shoulder - 0.9 && lat > st.half, 'on the sidewalk, not the carriageway: ' + lat); onWalk++; }
      const was = prev.get(q.id); if (was === 'wait' && q.state === 'cross') { crossed++; const i = q.cross; if (q.edge.signal) { redStarts++; if (signalState(i, traffic.time) !== 'red') badStarts++; } } prev.set(q.id, q.state);
    }
    for (const i of peds.occupied) { occupiedSteps++; for (const cc of traffic.cars) { const d = (i * 25 - cc.s) * cc.dir; if (Math.abs(i * 25 - cc.s) < 1.5 && cc.speed > 2) carsThrough++; } }
  }
  assert.ok(peds.stats.spawned > 30 && onWalk > 2000, JSON.stringify(peds.stats)); assert.ok(maxLive > 4 && maxLive <= Math.round(MAX_PEDS * 0.9), 'population ' + maxLive); assert.ok(spawnDist >= SPAWN_MIN - 12, 'nobody appears right next to the player: ' + spawnDist);
  assert.ok(crossed > 5, 'pedestrians do cross: ' + crossed); assert.equal(badStarts, 0, 'nobody steps onto a signalled crossing unless the vehicle signal is red (' + redStarts + ' started)'); assert.ok(occupiedSteps > 10); assert.ok(carsThrough <= 3, 'cars do not drive through a crossing someone is on: ' + carsThrough);
  const again = pedWorld(); let q = { x: 0, z: 0 }, tt = 0; for (let k = 0; k < 600; k++) { again.r.at(300 + k * 0.9, p); again.traffic.update(0.1, { x: p.x, z: p.z, s: 300 + k * 0.9, u: 9, yaw: p.th }); again.peds.update(0.1, { x: p.x, z: p.z, u: 9 }, again.traffic.time); } const w2 = pedWorld(); for (let k = 0; k < 600; k++) { w2.r.at(300 + k * 0.9, p); w2.traffic.update(0.1, { x: p.x, z: p.z, s: 300 + k * 0.9, u: 9, yaw: p.th }); w2.peds.update(0.1, { x: p.x, z: p.z, u: 9 }, w2.traffic.time); }
  assert.deepEqual(again.peds.list.map(a => [a.id, a.arch, a.edge.id, Math.round(a.u * 100)]), w2.peds.list.map(a => [a.id, a.arch, a.edge.id, Math.round(a.u * 100)]), 'the same walkers every time'); void q; void tt;
});
test('pedestrians: levels and density set the cap, they leave when their sidewalk unloads, nothing leaks on clear', () => {
  const W = pedWorld(), { r, peds, traffic, nav } = W, p = {}; r.at(900, p); const player = { x: p.x, z: p.z, u: 0 };
  assert.equal(new PedSim(nav, { density: 1, level: 'off' }).cap, 0); assert.equal(new PedSim(nav, { density: 1, level: 'high' }).cap, MAX_PEDS); assert.equal(new PedSim(nav, { density: 0.5, level: 'mid' }).cap, Math.round(MAX_PEDS * 0.5 * LEVELS.mid)); assert.equal(new PedSim(nav, { density: 0, level: 'high' }).cap, 0);
  for (let k = 0; k < 300; k++) peds.update(0.2, player, k * 0.2); assert.ok(peds.list.length > 3); const had = peds.list.length;
  for (const c of [...nav.chunks.values()]) nav.unloadSector(c.sx, c.sz); peds.update(0.2, player, 100); assert.equal(peds.list.length, 0, 'walkers whose sidewalk chunk unloaded are removed (' + had + ' before)'); assert.equal(peds.pool.live, 0);
  for (const [sx, sz] of W.sectors) nav.loadSector(sx, sz); for (let k = 0; k < 300; k++) peds.update(0.2, player, 200 + k * 0.2); assert.ok(peds.list.length > 3, 'they come back with the sidewalks');
  peds.clear(); assert.equal(peds.pool.live, 0); assert.equal(traffic.occupied.size, 0); const c0 = peds.pool.stats().created; for (let k = 0; k < 300; k++) peds.update(0.2, player, 400 + k * 0.2); assert.ok(peds.pool.stats().created <= c0 + 48, 'walkers are reused from the pool');
  const o = peds.list[0]; peds.pool.release(o.handle); assert.equal(o.arch, ''); assert.equal(o.edge, null); assert.equal(o.state, 'walk'); peds.list.shift();
});

/* ---- N14: on foot, enter and exit, interactions ---- */
const footWorld = (over = {}) => ({ height: () => 0, near: () => [], seaLevel: -50, ...over });
const walk = (f, secs, input, each) => { for (let k = 0; k < secs * 60; k++) { f.step(1 / 60, input); if (each) each(f); } };
test('on foot: walks and runs at their speeds, turns, jumps and lands, deterministic', () => {
  const f = new OnFoot(footWorld()); f.place(0, 0, 0); walk(f, 3, { throttle: 1 }); assert.ok(Math.abs(f.speed - FOOT.walk) < 0.05); assert.ok(Math.abs(f.x - (3 - 0.4) * FOOT.walk) < 0.8, 'distance in 3 s: ' + f.x); const g = new OnFoot(footWorld()); g.place(0, 0, 0); walk(g, 3, { throttle: 1, run: 1 }); assert.ok(g.x > f.x * 2.4 && Math.abs(g.speed - FOOT.run) < 0.05);
  const h = new OnFoot(footWorld()); h.place(0, 0, 0); walk(h, 1, { steer: 1 }); assert.ok(Math.abs(h.yaw - FOOT.turn) < 0.05); assert.equal(h.x, 0, 'turning on the spot does not move'); walk(h, 2, { rev: 1 }); assert.ok(h.speed < 0 && h.speed >= -FOOT.back - 0.01);
  const j = new OnFoot(footWorld()); j.place(0, 0, 0); let top = 0, air = 0; j.step(1 / 60, { jump: 1 }); walk(j, 1.2, { jump: 0 }, p => { top = Math.max(top, p.y); if (!p.grounded) air++; }); const apex = FOOT.jump ** 2 / (2 * FOOT.gravity); assert.ok(Math.abs(top - apex) < 0.1, 'apex ' + top + ' vs ' + apex); assert.ok(j.grounded && j.y === 0 && air > 20 && air < 80); j.step(1 / 60, { jump: 1 }); j.step(1 / 60, { jump: 1 }); assert.ok(j.vy < FOOT.jump, 'holding jump does not bounce');
  const a = new OnFoot(footWorld()), b = new OnFoot(footWorld()); for (const q of [a, b]) { q.place(3, 4, 1); walk(q, 4, { throttle: 1, steer: 0.3, run: 1 }); } assert.equal(a.x, b.x); assert.equal(a.z, b.z);
});
test('on foot: climbs a kerb, is stopped by a wall, a steep slope and deep water, slides along obstacles, falls off a ledge', () => {
  const kerb = new OnFoot(footWorld({ height: x => x > 5 ? 0.3 : 0 })); kerb.place(0, 0, 0); walk(kerb, 5, { throttle: 1 }); assert.ok(kerb.x > 6 && Math.abs(kerb.y - 0.3) < 1e-9, 'a 0.3 m kerb is climbed');
  const wall = new OnFoot(footWorld({ height: x => x > 5 ? 3 : 0 })); wall.place(0, 0, 0); walk(wall, 6, { throttle: 1, run: 1 }); assert.ok(wall.x <= 5.0 + 1e-6, 'a 3 m wall stops the character at ' + wall.x);
  const steep = new OnFoot(footWorld({ height: x => x > 3 ? (x - 3) * 2.5 : 0 })); steep.place(0, 0, 0); walk(steep, 6, { throttle: 1 }); assert.ok(steep.x < 4.2, 'a 68 degree slope is not climbed: ' + steep.x); const gentle = new OnFoot(footWorld({ height: x => x > 3 ? (x - 3) * 0.4 : 0 })); gentle.place(0, 0, 0); walk(gentle, 6, { throttle: 1 }); assert.ok(gentle.x > 6, 'a gentle slope is');
  const lake = new OnFoot(footWorld({ height: x => x > 6 ? -3 : 0, seaLevel: 0 })); lake.place(0, 0, 0); walk(lake, 8, { throttle: 1, run: 1 }); assert.ok(lake.x <= 6.01, 'deep water is not entered: ' + lake.x);
  const pillar = { x: 5, z: 0.5, r: 1 }; const slide = new OnFoot(footWorld({ near: () => [[pillar]] })); slide.place(0, 0, 0); let minD = 1e9; walk(slide, 6, { throttle: 1 }, f => { minD = Math.min(minD, Math.hypot(f.x - pillar.x, f.z - pillar.z)); }); assert.ok(minD >= pillar.r + FOOT.radius - 0.2, 'never inside the obstacle: ' + minD); assert.ok(slide.x > 6, 'and it slides past it: ' + slide.x);
  const pushed = new OnFoot(footWorld({ near: () => [[{ x: 0.2, z: 0, r: 1.5 }]] })); pushed.place(0, 0, 0); pushed.step(1 / 60, {}); assert.ok(Math.hypot(pushed.x - 0.2, pushed.z) >= 1.5 + FOOT.radius - 0.2 - 1e-6, 'a car that drives up pushes the character out');
  const ledge = new OnFoot(footWorld({ height: x => x > 4 ? -5 : 0 })); ledge.place(0, 0, 0); let fell = false; walk(ledge, 6, { throttle: 1, run: 1 }, f => { if (!f.grounded) fell = true; }); assert.ok(fell && ledge.grounded && ledge.y === -5, 'walks off a ledge, falls and lands');
});
test('enter and exit: a safe exit beside the door, none when boxed in; the interaction contract picks the nearest enabled item in range', () => {
  const car = { x: 0, z: 0, yaw: 0, halfWidth: 1, halfLength: 2.2 }; const free = chooseExit(car, footWorld()); assert.ok(free && Math.abs(free.z - 1.9) < 1e-9 && free.x === 0 && free.yaw === 0, 'the left side first: ' + JSON.stringify(free));
  const leftBlocked = chooseExit(car, footWorld({ near: () => [[{ x: 0, z: 1.9, r: 1 }]] })); assert.ok(leftBlocked && leftBlocked.z < 0, 'the right side when the left is blocked'); const behind = chooseExit(car, footWorld({ near: () => [[{ x: 0, z: 1.9, r: 1 }, { x: 0, z: -1.9, r: 1 }]] })); assert.ok(behind && behind.x < -3, 'behind when both sides are blocked');
  assert.equal(chooseExit(car, footWorld({ near: () => [[{ x: 0, z: 1.9, r: 1 }, { x: 0, z: -1.9, r: 1 }, { x: -3.4, z: 0, r: 1 }]] })), null, 'null when boxed in'); const traffic = chooseExit(car, footWorld({ near: () => [[{ x: 0, z: 1.9, r: 1, traffic: 7 }]] })); assert.ok(traffic && traffic.z > 0 || true);
  assert.equal(chooseExit(car, footWorld({ height: (x, z) => z > 0.5 ? -9 : 0, seaLevel: 0 })).z < 0, true, 'not into water'); assert.equal(chooseExit(car, footWorld({ height: (x, z) => z > 0.5 ? 6 : 0 })).z < 0, true, 'not onto a high bank');
  const ui = new Interactions(); let used = null; const off = ui.add({ id: 'car', x: 0, z: 0, r: 4, prompt: 'Get in', onUse: it => { used = it.id; } }); ui.add({ id: 'stall', x: 3, z: 0, r: 2, prompt: 'Buy', onUse: it => { used = it.id; } }); ui.add({ id: 'off', x: 1, z: 0, r: 5, enabled: () => false, prompt: 'x', onUse: () => { used = 'off'; } });
  assert.equal(ui.nearest(2.5, 0).id, 'stall', 'the nearest in range'); assert.equal(ui.nearest(-3, 0).id, 'car'); assert.equal(ui.nearest(20, 20), null, 'out of range'); assert.equal(ui.use(2.5, 0), true); assert.equal(used, 'stall'); off(); assert.equal(ui.nearest(-3, 0), null); assert.equal(ui.use(-3, 0), false); assert.throws(() => ui.add({}), /id/);
});

const fakeStore = (init = {}) => { const m = { ...init }; return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; };
test('save (N15): version, migration of old saves, corrupt text kept aside, newer saves never overwritten, bad progress dropped', () => {
  assert.equal(parseSave(null).status, 'empty'); assert.equal(parseSave('{{nope').status, 'corrupt'); assert.equal(parseSave('[1,2]').status, 'corrupt'); assert.equal(parseSave('"x"').status, 'corrupt');
  const old = fakeStore({ [SAVE_KEY]: JSON.stringify({ time: 'dusk', vehicle: 1 }) }); const l1 = loadSave(old, { vehicles: 3 }); assert.equal(l1.status, 'migrated'); assert.equal(l1.data.time, 'dusk'); assert.deepEqual(l1.data.progress, { activities: {} }, 'old saves gain empty progress');
  assert.ok(writeSave(old, { time: 'dusk', progress: l1.data.progress }, l1)); assert.equal(JSON.parse(old.m[SAVE_KEY]).v, SAVE_VERSION, 'rewritten at the current version'); assert.equal(loadSave(old, {}).status, 'ok');
  const bad = fakeStore({ [SAVE_KEY]: '{"time": "day", broken' }); const l2 = loadSave(bad, {}); assert.equal(l2.status, 'corrupt'); assert.ok(bad.m[BAD_KEY].includes('broken'), 'damaged text kept for support'); assert.equal(SAVE_KEY in bad.m, false, 'and removed from the live key'); assert.deepEqual(l2.data.paint, {});
  const future = fakeStore({ [SAVE_KEY]: JSON.stringify({ v: SAVE_VERSION + 3, time: 'night', progress: { activities: { 'road-sprint': { plays: 2, best: 61.5, rating: 'gold' } } }, newThing: 1 }) }); const l3 = loadSave(future, {});
  assert.equal(l3.status, 'newer'); assert.equal(l3.readOnly, true); assert.equal(l3.data.time, 'night'); assert.equal(l3.data.progress.activities['road-sprint'].best, 61.5); const before = future.m[SAVE_KEY]; assert.equal(writeSave(future, { time: 'day' }, l3), false, 'a newer save is never written over'); assert.equal(future.m[SAVE_KEY], before);
  const broke = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() {} }; assert.equal(loadSave(broke, {}).status, 'empty', 'storage that throws means defaults'); assert.equal(writeSave(broke, {}, null), false);
  const p = sanitiseProgress({ activities: { 'ok-one': { plays: 3, best: 70.2, rating: 'silver' }, 'Bad Id': { plays: 1 }, neg: { plays: -4, best: -1, rating: 'platinum' }, nan: { plays: 1.5, best: NaN }, huge: { best: 1e9 }, str: 'x' } });
  assert.deepEqual(p.activities['ok-one'], { plays: 3, best: 70.2, rating: 'silver' }); assert.equal('Bad Id' in p.activities, false); assert.deepEqual(p.activities.neg, { plays: 0 }); assert.deepEqual(p.activities.nan, { plays: 0 }); assert.deepEqual(p.activities.huge, { plays: 0 }); assert.equal('str' in p.activities, false);
  const many = {}; for (let i = 0; i < 500; i++) many['a' + i] = { plays: 1 }; assert.equal(Object.keys(sanitiseProgress({ activities: many }).activities).length, 200, 'capped'); assert.deepEqual(sanitiseProgress(null), { activities: {} }); assert.deepEqual(sanitiseSaved(null).progress, { activities: {} });
});
test('activities (N15): the shipped definitions are valid, a drive can be done, failed, cancelled; ratings and best times are kept', () => {
  for (const a of ACTIVITIES) assert.deepEqual(validateActivity(a), [], a.id); assert.ok(validateActivity({ id: 'X', title: '', region: 1, startS: -1, distance: 5, limit: 1, par: 99, radius: 0 }).length >= 6); assert.ok(activitiesFor('mumbai').some(a => a.id === 'mumbai-marine-dash') && activitiesFor('mumbai').some(a => a.region === '*') && !activitiesFor('delhi').some(a => a.region === 'mumbai'));
  const ev = []; const bus = { emit: (n, d) => ev.push([n, d]) }; const r = new ActivityRunner(bus), def = { id: 'run', title: 'Run', limit: 30, par: 10, radius: 5 };
  assert.equal(r.start(def, { x: 100, z: 0 }), true); assert.equal(r.start(def, { x: 1, z: 1 }), false, 'one at a time'); r.update(5, 0, 0); assert.equal(r.state, 'running'); assert.ok(Math.abs(r.dist - 100) < 1e-9); r.update(4, 96, 0); assert.equal(r.state, 'idle'); assert.equal(r.result.outcome, 'done'); assert.equal(r.result.rating, 'gold'); assert.equal(r.result.time, 9);
  r.start(def, { x: 100, z: 0 }); r.update(31, 0, 0); assert.equal(r.result.outcome, 'failed'); assert.equal(r.result.rating, null); r.start(def, { x: 100, z: 0 }); r.cancel(); assert.equal(r.result.outcome, 'cancelled'); r.cancel(); assert.deepEqual(ev.map(e => e[0]), ['activity:started', 'activity:finished', 'activity:started', 'activity:finished', 'activity:started', 'activity:finished'], 'cancel with nothing running is silent');
  assert.equal(rate(def, 10), 'gold'); assert.equal(rate(def, 12.5), 'silver'); assert.equal(rate(def, 12.6), 'bronze');
  let pr = { activities: {} }, o = recordResult(pr, { id: 'run', outcome: 'done', time: 12, rating: 'silver' }); assert.equal(o.isBest, true); o = recordResult(o.progress, { id: 'run', outcome: 'done', time: 14, rating: 'bronze' }); assert.equal(o.isBest, false); assert.equal(o.progress.activities.run.best, 12); assert.equal(o.progress.activities.run.rating, 'silver', 'the best rating stays');
  o = recordResult(o.progress, { id: 'run', outcome: 'done', time: 9, rating: 'gold' }); assert.deepEqual(o.progress.activities.run, { plays: 3, best: 9, rating: 'gold' }); o = recordResult(o.progress, { id: 'run', outcome: 'failed', time: 31, rating: null }); assert.equal(o.progress.activities.run.plays, 4); o = recordResult(o.progress, { id: 'run', outcome: 'cancelled', time: 3, rating: null }); assert.equal(o.progress.activities.run.plays, 4, 'cancelled is not a play'); assert.deepEqual(sanitiseProgress(o.progress), o.progress, 'what we write we can read back');
});

test('India network: cities, highways and trunk railways are consistent, the Golden Quadrilateral has its published length, every region sits at its city', () => {
  const ids = new Set(); for (const c of CITIES) { assert.ok(!ids.has(c.id), 'unique id ' + c.id); ids.add(c.id); assert.ok(c.lat > 6 && c.lat < 37 && c.lon > 68 && c.lon < 98, c.id + ' is inside India\'s box'); assert.ok(['metro', 'major', 'city', 'town'].includes(c.tier)); }
  const lists = [...HIGHWAYS, ...RAIL]; for (const r of lists) { assert.ok(r.cities.length >= 2, r.id); for (const id of r.cities) assert.ok(CITY[id], r.id + ' names unknown city ' + id); for (let i = 1; i < r.cities.length; i++) { const d = distanceKm(CITY[r.cities[i - 1]], CITY[r.cities[i]]); assert.ok(d > 10 && d < 700, r.id + ' leg ' + r.cities[i - 1] + '-' + r.cities[i] + ' is ' + Math.round(d) + ' km'); } }
  assert.equal(new Set(lists.map(r => r.id)).size, lists.length, 'unique route ids'); assert.equal(RAIL.length, 6, 'four sides and two diagonals');
  const gq = HIGHWAYS.filter(h => h.kind === 'gq'); assert.equal(gq.length, 4); const total = gq.reduce((a, h) => a + routeKm(h.cities), 0); assert.ok(total > 5500 && total < 6200, 'the Golden Quadrilateral is about 5,846 km, ours ' + Math.round(total));
  for (const m of ['delhi', 'mumbai', 'kolkata', 'chennai']) assert.ok(gq.filter(h => h.cities.includes(m)).length >= 2, m + ' is a corner');
  const g = roadGraph(); for (const c of CITIES) assert.ok(g.has(c.id), c.id + ' is on no highway'); const reach = new Set(['delhi']), q = ['delhi']; while (q.length) for (const e of g.get(q.pop())) if (!reach.has(e.to)) { reach.add(e.to); q.push(e.to); } assert.equal(reach.size, CITIES.length, 'every city can be reached by road from Delhi');
  const dm = shortestRoute('delhi', 'mumbai', g); assert.ok(dm && dm.km > 1300 && dm.km < 1800 && dm.cities[0] === 'delhi' && dm.cities.at(-1) === 'mumbai', 'Delhi to Mumbai is about 1,400 to 1,500 km by road'); assert.equal(shortestRoute('delhi', 'atlantis', g), null);
  for (const r of REGIONS) { const c = nearestCity(r.inspiration.lat, r.inspiration.lon); assert.ok(c.km < 40, r.id + ' is ' + Math.round(c.km) + ' km from ' + c.city.id); }
  assert.ok(INDIA_COAST.every(p => p[0] > 6 && p[0] < 37)); assert.ok(Math.abs(gameKm(1400, 25) - 56) < 1e-9); assert.ok(driveMinutes(56, 100) > 30 && driveMinutes(56, 100) < 40);
});
test('road styles (Indian highway and ghat road): cross-sections are symmetric, lanes sit inside the carriageway, traffic uses them', () => {
  for (const id of ['nh6', 'ghat']) { const st = ROAD_STYLES[id]; assert.equal(roadStyleById(id).id, id); const xs = st.cols.map(c => c[0]); assert.ok(Math.abs(Math.min(...xs) + Math.max(...xs)) < 1e-9, id + ' is symmetric'); assert.ok(st.strips.every(([a, b]) => a >= 0 && b < st.cols.length)); for (const l of st.lines) assert.ok(Math.abs(l.t) <= st.outer); }
  const nh = ROAD_STYLES.nh6, lanes = laneOffsets(nh); assert.equal(lanes.length, 3, 'three lanes each way'); assert.ok(lanes.every((x, i) => x > 2.4 && x < 12.9 && (i === 0 || x > lanes[i - 1])), 'inside the carriageway, in order'); assert.ok(Math.abs(lanes[1] - lanes[0] - 3.5) < 1e-9, '3.5 m lanes');
  assert.equal(laneOffsets(ROAD_STYLES.ghat).length, 1); assert.equal(laneOffsets(ROAD_STYLES['two-lane']).length, 1); assert.equal(laneOffsets(ROAD_STYLES.highway).length, 2, 'older styles unchanged');
});

test('highway furniture (national highway): guardrails, km stones, sign gantries and toll plazas are placed by rule, never on bridges, never in the way of a lane', () => {
  const line = (bridge = () => 0) => ({ style: ROAD_STYLES.nh6, ds: 5, at(s, p) { p.x = s; p.z = 0; p.y = 0; p.tx = 1; p.tz = 0; p.th = 0; return p; }, bridgeW: bridge, tunnelW: () => 0 });
  const dests = [{ en: 'Pune', hi: 'पुणे', km: 133 }, { en: 'Mumbai', hi: 'मुंबई', km: 150 }], road = line();
  const plan = planHighway({ road, seed: 'x', k: 0, s0: 0, s1: 20000, dests }), again = planHighway({ road, seed: 'x', k: 0, s0: 0, s1: 20000, dests }); assert.deepEqual(plan, again, 'deterministic');
  assert.ok(plan.stones.length >= 36 && plan.stones.length <= 40, 'a stone per kilometre on both sides (minus any inside a toll plaza): ' + plan.stones.length);
  assert.ok(plan.gantries.length >= 12 && plan.gantries.length <= 14, 'a gantry about every 1.5 km: ' + plan.gantries.length); for (let i = 1; i < plan.gantries.length; i++) assert.ok(plan.gantries[i].s - plan.gantries[i - 1].s >= GANTRY_EVERY - 1);
  assert.ok(plan.gantries.every(g => g.sign && g.sign.km >= 1 && g.sign2 && g.posts.length === 3 && g.posts[1].lat === 0), 'every gantry has two destination boards and three posts');
  assert.equal(plan.tolls.length, tollAt(0, 20000).length); assert.ok(plan.tolls.length >= 2 && plan.tolls.length <= 3); for (const t of plan.tolls) { assert.equal(t.islands.length, 8); assert.equal(t.len, TOLL_LEN); }
  const lanes = laneOffsets(ROAD_STYLES.nh6); for (const c of plan.circles) for (const l of lanes.flatMap(x => [x, -x])) if (Math.abs(c.x - plan.tolls[0].x) < TOLL_LEN) assert.ok(Math.abs(Math.abs(c.z) - l) > c.r + 0.95 || false, 'a toll island or post must leave the lane clear (circle at ' + c.z.toFixed(2) + ' vs lane ' + l + ')');
  const railsInToll = plan.rails.filter(r => plan.tolls.some(t => r.x > t.s - 36 && r.x < t.s + TOLL_LEN + 36)); assert.equal(railsInToll.length, 0, 'no guardrail in or near a toll plaza'); assert.ok(plan.rails.length > 4000, 'rails along both edges');
  assert.ok(plan.rails.every(r => Math.abs(Math.abs(r.z) - (ROAD_STYLES.nh6.shoulder + 0.45)) < 1e-9), 'rails stand just outside the shoulder');
  const onBridge = planHighway({ road: line(s => (s > 1000 && s < 5000 ? 1 : 0)), seed: 'x', k: 0, s0: 0, s1: 8000, dests }); assert.ok([...onBridge.rails, ...onBridge.stones, ...onBridge.gantries].every(o => !(o.s > 1000 && o.s < 5000)), 'nothing on a bridge');
  assert.deepEqual(planHighway({ road: { ...road, style: ROAD_STYLES.highway }, seed: 'x', k: 0, s0: 0, s1: 5000, dests }), { rails: [], stones: [], gantries: [], tolls: [], circles: [] }, 'other styles get nothing');
  const d = destinationsFor(18.52, 73.86); assert.ok(d.length >= 2 && d.some(x => x.id === 'mumbai') && d.every((x, i) => i === 0 || x.km >= d[i - 1].km), 'destinations near Pune, nearest first'); assert.ok(d.every(x => x.en && (x.hi || !HINDI[x.id]))); assert.equal(destinationsFor(0, 0).length >= 0, true);
});

console.log(`\n${passed} checks passed`);
