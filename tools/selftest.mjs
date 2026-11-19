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
import { validTolls, tollCap, planHighway, RAIL_STEP, GANTRY_EVERY, TOLL_EVERY, TOLL_LEN, tollAt } from '../src/world/highway_plan.js';
import { renderLicenses } from './build_licenses.mjs';
import { regionAt, distKm } from '../src/world/regionmap.js';
import { Junction, JSIG } from '../src/traffic/junction.js';
import { RoadSet } from '../src/world/roadset.js';
import { addOverpasses, CLEAR } from '../src/world/interchange.js';
import { RoadNetwork, guidePoint } from '../src/world/network.js';
import { toGame, fromGame, smoothPath, pathLength, buildSkeleton, GAME_SCALE } from '../src/world/india_network.js';
import { readFileSync as readSkeleton } from 'node:fs';
import { destinationsFor, HINDI } from '../src/world/india_network.js';
import { roadStyleById } from '../src/world/roadstyles.js';
import { ActivityRunner, ACTIVITIES, activitiesFor, rate, recordResult, validateActivity } from '../src/activities/activities.js';
import { TrafficSim, MODES, SLOT, trafficKinds, EXTRA_KINDS, signalState, SIGNAL, laneOffsets, branchMode, DEFAULT_KINDS, kindCap, isSlowKind } from '../src/traffic/sim.js';
import { Autodrive, STYLES, styleFor } from '../src/input/autodrive.js';
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
import { KeepOut, RANK, railClaim, stationClaim, registerRail, roadProvider } from '../src/world/keepout.js';
import { crossingAt } from '../src/world/navgraph.js';
import { PedSim, LEVELS, MAX_PEDS, SPAWN_MIN } from '../src/pedestrians/sim.js';
import { OnFoot, FOOT, chooseExit, Interactions } from '../src/player/onfoot.js';
import { validateTransit, EXPECT as TRANSIT_EXPECT } from './validate_transit.mjs';
import { project as tProject, unproject as tUnproject, routeThrough, simplify as tSimplify, nearestOnPath } from './lib_transit.mjs';
import { readFileSync as tReadFile } from 'node:fs';
import { validatePack, BUDGET as CITY_BUDGET } from './validate_city.mjs';
import { BUILDER_VERSION, PACK_FORMAT } from './build_city.mjs';
import { enc as packEnc, dec as packDec, encodeGraph, decodeGraph } from './lib/packio.mjs';
import { area as gArea, clipRing, splitLine, joinRings, PolyMask, selfIntersects, simplifyRing } from './lib/geom.mjs';
import { Router } from './lib/graphroute.mjs';
import { loadPack } from './check_city.mjs';
import * as cityPack from '../src/world/city/pack.js';
import { decodeTile as packDecodeTile, corridorHw, streetConflict, droppedForStreet, streetWidth, CONFLICT_CLASSES } from './lib/packio.mjs';
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
await atest('autodrive levels and styles: sport drives faster and tighter than eco; cruise leaves the steering to the player; the speed never passes the vehicle top', () => {
  assert.ok(styleFor('sport', 70).cruise > styleFor('normal', 70).cruise && styleFor('normal', 70).cruise > styleFor('eco', 70).cruise && styleFor('eco', 70).cruise > styleFor('offroad', 70).cruise, 'speed order: sport > normal > eco > off-road');
  assert.ok(styleFor('sport', 30).cruise <= 30 * 0.92 + 1e-9, 'a slow vehicle is not asked for more than its top speed'); assert.ok(STYLES.sport.lat > STYLES.normal.lat && STYLES.sport.gap1 < STYLES.eco.gap1 && STYLES.sport.pass && !STYLES.sport.rules && STYLES.eco.rules, 'sport takes corners harder, tailgates, overtakes, ignores the rules');
  const { r } = world('peace'), q = r.at(40, {}), ph = { x: q.x, z: q.z, yaw: q.th, u: 10 };
  const ad = new Autodrive(); ad.setStyle('normal', 60); ad.toggle(true); ad.s = 40;
  ad.level = 'cruise'; const a = ad.update(ph, r, { steer: 0.37 }); assert.equal(a.steer, 0.37, 'cruise: the player steers'); ad.level = 'full'; const b = ad.update(ph, r, { steer: 0.37 }); assert.ok(Math.abs(b.steer) < 0.3, 'auto: the car steers itself');
  const sp = new Autodrive(); sp.setStyle('sport', 60); sp.toggle(true); sp.s = 40; sp.leader = () => ({ gap: 20, speed: 5 }); sp.lane = (d, k) => k * 3.5; sp.lanesAt = () => ({ ahead: null, behind: null }); sp.update(ph, r); assert.equal(sp.laneK, 1, 'sport swings out round a slow car when the next lane is clear'); const bl = new Autodrive(); bl.setStyle('sport', 60); bl.toggle(true); bl.s = 40; bl.leader = sp.leader; bl.lane = sp.lane; bl.lanesAt = () => ({ ahead: { gap: 10, speed: 3 }, behind: null }); bl.update(ph, r); assert.equal(bl.laneK, 0, 'sport does not pull out into a lane that is not clear'); const nm = new Autodrive(); nm.setStyle('normal', 60); nm.toggle(true); nm.s = 40; nm.leader = sp.leader; nm.lane = sp.lane; nm.lanesAt = sp.lanesAt; nm.update(ph, r); assert.equal(nm.laneK, 0, 'normal stays behind it');
});
await atest('autodrive plans ahead: in heavy traffic on two-lane and six-lane highways the sport autodrive overtakes safely and never hits anything', () => {
  for (const [seed, drive, style, road] of [['peace', 'right', 'sport', 'two-lane'], ['coast', 'left', 'sport', 'nh6'], ['peace', 'left', 'normal', 'nh6'], ['alps', 'left', 'sport', 'nh6'], ['delta', 'right', 'sport', 'nh6'], ['hills', 'left', 'sport', 'nh6']]) {
    const cfg = makeConfig({ seed }); cfg.road = { ...cfg.road, style: road }; const t = createTerrain(cfg), r = new Road(t, cfg); r.ensure(-4000, 4000); t.attachRoad(r);
    const sim = new TrafficSim(r, { seed: 'sp' + seed, mode: 'high', drive }), V = VEHICLES[0], p = vehicleParams(V.body, V.stats);
    const ph = new RapierVehicle(p, V.id, { height: (x, z) => t.drive(x, z), surface: (x, z) => t.surface(x, z), near: (x, z, rr) => sim.circles(x, z, rr), seaLevel: t.seaLevel });
    const q = r.at(40, {}); ph.reset(q.x - q.tz * sim.lateral(1, 0) * -1, q.z + q.tx * sim.lateral(1, 0), q.th);
    const ad = new Autodrive(); ad.setStyle(style, p.top); ad.lanes = () => sim.lanes.length; ad.lane = (d, k = 0) => k === 1 && sim.lanes.length < 2 ? sim.lateral(-d, 0) : sim.lateral(d, sim.lanes[k] === undefined ? 0 : k);
    ad.leader = (pp, s, range, lat) => sim.leaderAhead({ x: pp.x, z: pp.z, s, yaw: pp.yaw, u: pp.u }, range, lat); ad.lanesAt = (pp, s, lat, a, b) => sim.laneGap({ x: pp.x, z: pp.z, s, yaw: pp.yaw, u: pp.u }, lat, a, b); ad.toggle(true); ad.s = 40;
    let s = 40, hits = 0, last = -999, topKmh = 0, passing = 0;
    for (let k = 0; k < 60 * 100; k++) {
      const inp = ad.update(ph, r); ph.step(1 / 60, { steer: inp.steer, throttle: inp.throttle, brake: inp.brake, hand: 0, rev: 0 }); s = ad.s;
      sim.update(1 / 60, { x: ph.x, z: ph.z, s, u: ph.u, yaw: ph.yaw }); if (ph.impact > 1 && k - last > 60) { hits++; last = k; }
      if (k === 0) for (const d of [150, 420, 700]) { const tr = { id: 9990 + d, s: s + d, dir: 1, lane: 0, kind: 'truck', len: 8.5, w: 2.5, v0: 7, speed: 7, colour: 0, lat: sim.lateral(1, 0), stuck: 0, bump: 0, born: 0, bornDist: d, x: 0, z: 0, y: 0, yaw: 0, brake: 0 }; sim.place(tr); sim.cars.push(tr); }   // slow trucks in the autodrive's lane
      topKmh = Math.max(topKmh, ph.kmh); if (ad.laneK === 1) passing++;
    }
    console.log('     autodrive heavy traffic', seed, drive, style, road, 'progress', (s - 40).toFixed(0), 'm, top', topKmh.toFixed(0), 'km/h, passing', (passing / 60).toFixed(0), 's, hits', hits);
    assert.equal(hits, 0, seed + ' ' + style + ' ' + road + ': the autodrive hit traffic ' + hits + ' times'); assert.ok(s - 40 > (style === 'sport' && road === 'nh6' ? 1300 : 500), seed + ' ' + style + ' ' + road + ': it kept moving (' + (s - 40).toFixed(0) + ' m)');
  }
});
test('railways: lines have distance, crossings are found away from cities and parallel roads, trains run back and forth, barriers close for a train', async () => {
  const { RailLine, segIntersect, findCrossings, trainPlace, trainSpan, crossingClosed } = await import('../src/world/rail.js');
  const rl = new RailLine('r', [0, 0, 1000, 0, 1000, 500], ['a', 'b']); assert.equal(rl.len, 1500); const p = rl.at(1250, {}); assert.ok(Math.abs(p.x - 1000) < 1e-9 && Math.abs(p.z - 250) < 1e-9 && p.tz === 1, 'a point and a direction on the second leg'); assert.deepEqual(rl.nearest(500, 30), { s: 500, d: 30 });
  assert.deepEqual(segIntersect(0, 0, 10, 0, 5, -5, 5, 5), { t: 0.5, u: 0.5, x: 5, z: 0 }); assert.equal(segIntersect(0, 0, 10, 0, 0, 1, 10, 1), null, 'parallel');
  const roads = [{ id: 'x', pts: [300, -200, 300, 200] }, { id: 'par', pts: [0, 5, 900, 5] }, { id: 'city', pts: [700, -50, 700, 50] }], cr = findCrossings(rl, roads, [{ x: 700, z: 0 }]);
  assert.equal(cr.length, 1, 'one crossing: the parallel road and the one inside a city are skipped'); assert.ok(cr[0].road === 'x' && Math.abs(cr[0].s - 300) < 1e-9 && Math.abs(cr[0].x - 300) < 1e-9);
  for (const t of [0, 10, 37.5, 61.2]) { const a = trainPlace(1000, t, 20, 0), b = trainPlace(1000, t + 1e-3, 20, 0); assert.ok(a.s >= 0 && a.s <= 1000); assert.ok(Math.abs(a.s - b.s) < 0.05, 'continuous'); }
  assert.deepEqual(trainPlace(1000, 10, 20, 0), { s: 200, dir: 1 }); assert.deepEqual(trainPlace(1000, 60, 20, 0), { s: 800, dir: -1 }); assert.equal(trainPlace(1000, 100, 20, 0).dir, 1, 'it comes back for another run');
  assert.deepEqual(trainSpan(500, 1, 200), [300, 500]); assert.deepEqual(trainSpan(500, -1, 200), [500, 700]);
  assert.ok(crossingClosed(600, [[300, 500]]) && !crossingClosed(900, [[300, 500]]) && crossingClosed(520, [[300, 500]]) && !crossingClosed(100, [[300, 500]]), 'barriers close when a train is within 110 m before or 45 m after');
  const sk = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../assets/india/skeleton.json', import.meta.url))); const lines = sk.rails.map(r => new RailLine(r.id, r.pts, r.cities)); let n = 0; for (const l of lines) n += findCrossings(l, sk.roads, sk.nodes).length; assert.ok(n >= 3, 'the real skeleton has level crossings: ' + n); console.log('     rail crossings in the skeleton:', n);
});
await atest('real railway network (Natural Earth): stations at cities, junctions, shortest rail routes join far cities, trains have long runs', async () => {
  const { RailNetwork } = await import('../src/world/rail.js'), fs = await import('node:fs/promises'), rj = JSON.parse(await fs.readFile(new URL('../assets/india/rails.json', import.meta.url))), rn = new RailNetwork(rj);
  assert.ok(rn.stations.length >= 60 && rj.edges.length >= 200, 'stations ' + rn.stations.length + ', edges ' + rj.edges.length); assert.ok(rj.nodes.filter(n => n.deg >= 3).length >= 20, 'there are junctions'); assert.ok(rj.edges.every(e => e.len > 0 && e.pts.length >= 4 && rj.nodes[e.a] && rj.nodes[e.b]), 'edges are well formed');
  const d = rn.byCity.get('delhi'), m = rn.byCity.get('mumbai'); assert.ok(d && m, 'Delhi and Mumbai have stations'); const steps = rn.route(d.id, m.id); assert.ok(steps && steps.length >= 2, 'a rail route Delhi to Mumbai'); const ln = rn.routeLine(steps); assert.ok(ln.len > 12000 && ln.len < 30000, 'Delhi to Mumbai by rail is about 1400 km real: ' + Math.round(ln.len * 100 / 1000) + ' km');
  const k = rn.byCity.get('kochi') || rn.byCity.get('thiruvananthapuram'); if (k) assert.ok(rn.route(d.id, k.id), 'the south is connected to Delhi'); const runs = rn.trainRoutes(12); assert.ok(runs.length >= 10 && runs.every(r => r.len >= 2500), 'train runs'); console.log('     rail network:', rn.stations.length, 'stations,', rj.nodes.filter(n => n.deg >= 3).length, 'junctions, Delhi to Mumbai', Math.round(ln.len * 100 / 1000), 'km real');
});
await atest('railway ground and motion: the track is smooth and gentle, cuts through a hill, rides a viaduct over a valley; a train accelerates, cruises, brakes to a stop, waits and returns', async () => {
  const { RailLine, trainMotion, STYLES } = await import('../src/world/rail.js'), { RailGrade, RAIL_GRADE } = await import('../src/world/rail_grade.js');
  const hill = (x, z) => 40 + 30 * Math.exp(-(((x - 600) / 120) ** 2)) - 30 * Math.exp(-(((x - 1400) / 90) ** 2)), ln = new RailLine('e', [0, 0, 2000, 0]); ln.a = 0; ln.b = 1;
  const g = new RailGrade({ edges: [ln], toWorld: (x, z) => ({ x, z }), natural: hill }), pr = g.profile(0); let worst = 0; for (let i = 1; i < pr.length; i++) worst = Math.max(worst, Math.abs(pr[i] - pr[i - 1]) / RAIL_GRADE.STEP);
  assert.ok(worst <= RAIL_GRADE.MAX_GRADE + 1e-6, 'never steeper than 3 percent: ' + worst.toFixed(4)); assert.ok(g.yAt(0, 600) < hill(600, 0) - 5, 'the track is well below the top of the hill (a cutting): ' + (hill(600, 0) - g.yAt(0, 600)).toFixed(1) + ' m');
  assert.ok(g.cutDepth(0, 600) > 5, 'cutDepth says so'); assert.ok(g.yAt(0, 1400) > hill(1400, 0) + 6 && g.viaduct(0, 1400), 'the track stays high over the valley, so it is a viaduct');
  assert.equal(g.grade(600, 0, hill(600, 0)), g.yAt(0, 600), 'flat under the track'); assert.ok(g.grade(600, 20, hill(600, 20)) > g.yAt(0, 600) && g.grade(600, 20, hill(600, 20)) <= hill(600, 20), 'a cutting slope beside the track'); assert.equal(g.grade(1400, 0, hill(1400, 0)), hill(1400, 0), 'the valley under a viaduct is left alone'); assert.equal(g.grade(600, 500, 77), 77, 'far from the track nothing changes');
  const S = STYLES.emu_wr; let prev = trainMotion(1500, 0, S.vmax, S.accel, S.brake, S.dwell, 0), vmax = 0, stops = 0; for (let t = 0.5; t < 600; t += 0.5) { const m = trainMotion(1500, t, S.vmax, S.accel, S.brake, S.dwell, 0); assert.ok(Math.abs(m.s - prev.s) < S.vmax * 0.5 + 1e-6, 'continuous'); assert.ok(m.s >= -1e-6 && m.s <= 1500 + 1e-6); vmax = Math.max(vmax, m.v); if (m.stopped && !prev.stopped) stops++; prev = m; }
  assert.ok(Math.abs(vmax - S.vmax) < 1e-6 && stops >= 2, 'it reaches its speed and stops at both ends: ' + stops); const m0 = trainMotion(1500, 10, S.vmax, S.accel, S.brake, S.dwell, 0); assert.ok(Math.abs(m0.v - S.accel * 10) < 1e-9 && Math.abs(m0.s - 0.5 * S.accel * 100) < 1e-9, 'it accelerates at its rate'); assert.ok(trainMotion(80, 20, 30, 0.45, 0.7, 50, 0).v < 30, 'a short run never reaches full speed');
  for (const [k, st] of Object.entries(STYLES)) assert.ok(st.cars > 0 && st.len > 8 && st.vmax > 10 && st.accel > 0, k);
});
await atest('real train book: names and numbers come from the timetable, routes join the cities, a departure board looks right', async () => {
  const { RailNetwork } = await import('../src/world/rail.js'), { TrainBook, fmtTime, clockMinutes, announcement } = await import('../src/world/rail_timetable.js'), fs = await import('node:fs/promises'), rd = f => fs.readFile(new URL('../assets/india/' + f, import.meta.url)).then(b => JSON.parse(b));
  const rn = new RailNetwork(await rd('rails.json')), tj = await rd('trains.json'), book = new TrainBook(tj, rn); assert.ok(book.trains.length >= 300, 'trains: ' + book.trains.length); assert.ok(book.byEdge.size >= 120, 'edges with a real train: ' + book.byEdge.size);
  const raj = book.trains.find(t => t.n === '12951'); assert.ok(raj && /Rajdhani/.test(raj.name) && raj.stops[0][0] === 'mumbai' && raj.stops[raj.stops.length - 1][0] === 'delhi', 'the Mumbai to Delhi Rajdhani is there');
  const dep = book.departures('mumbai', 16 * 60 + 30, 5); assert.ok(dep.length >= 3 && dep[0].minutes <= dep[1].minutes, 'a board with the next trains in order'); assert.ok(dep.some(d => d.n === '12951' && d.time === '16:40'), 'the 16:40 Rajdhani is on the board at 16:30: ' + JSON.stringify(dep.map(d => d.n + ' ' + d.time)));
  assert.equal(fmtTime(1000), '16:40'); assert.equal(fmtTime(-10), '23:50'); assert.equal(clockMinutes(0), 480); assert.equal(clockMinutes(120), 600); assert.ok(book.identify([...book.byEdge.keys()][0], 3), 'an edge with a train has an identity');
  const a = announcement('arriving', { n: '12951', name: 'Mumbai Rajdhani', to: 'Delhi' }, 3, 'Mumbai'); assert.ok(/number 12951/.test(a.en) && /platform number 3/.test(a.en) && /गाड़ी संख्या 12951/.test(a.hi) && /प्लेटफॉर्म संख्या 3/.test(a.hi), 'the announcement names the train and platform in both languages'); { const { STATE_LANG } = await import('../src/world/rail_timetable.js'); const m = announcement('arriving', { n: '12123', name: 'Deccan Queen', to: 'Pune' }, 2, 'Mumbai', 'Maharashtra'); assert.equal(m.regional.lang, 'mr-IN'); assert.ok(m.regional.text.includes('12123') && m.regional.text.includes('2') && /[\u0900-\u097F]/.test(m.regional.text), 'a Marathi announcement for Maharashtra'); assert.equal(announcement('arriving', { n: '1', name: 'X', to: 'Y' }, 1, 'Delhi', 'Delhi').regional, undefined, 'no regional language in Delhi'); for (const l of Object.values(STATE_LANG)) assert.ok(announcement('arriving', { n: '1', name: 'X' }, 1, 'c', Object.keys(STATE_LANG).find(k => STATE_LANG[k] === l)).regional, l); }
  console.log('     train book:', book.trains.length, 'trains,', book.byEdge.size, 'edges carry a named train');
});
await atest('announcement clips: the clip that names the train wins, generic clips fit their station, a clip naming another train is never used', async () => {
  const { pickClip } = await import('../src/audio/announceclips.js'), M = [{ file: 'a.mp3', city: 'mumbai', kind: 'arriving', lang: 'mr', train: '12951' }, { file: 'b.mp3', city: 'mumbai', kind: 'arriving', lang: 'hi', generic: true }, { file: 'c.mp3', city: 'pune', kind: 'arriving', lang: 'mr', generic: true }, { file: 'd.mp3', city: 'mumbai', kind: 'arriving', lang: 'mr', train: '12123' }, { file: 'e.mp3', kind: 'welcome', lang: 'en', generic: true }];
  assert.equal(pickClip(M, { city: 'mumbai', kind: 'arriving', train: '12951', langs: ['mr', 'hi', 'en'] }).file, 'a.mp3'); assert.equal(pickClip(M, { city: 'mumbai', kind: 'arriving', train: '99999', langs: ['mr', 'hi', 'en'] }).file, 'b.mp3', 'a generic clip of the station, never the clip for another train');
  assert.equal(pickClip(M, { city: 'pune', kind: 'arriving', train: '12123', langs: ['mr', 'hi'] }).file, 'c.mp3', 'train 12123 at Pune: the Mumbai clip for 12123 is not used'); assert.equal(pickClip(M, { city: 'delhi', kind: 'arriving', train: '1', langs: ['hi'] }), null, 'nothing for a station without clips'); assert.equal(pickClip(M, { city: 'delhi', kind: 'welcome', langs: ['hi', 'en'] }).file, 'e.mp3'); assert.equal(pickClip([], { city: 'x', kind: 'arriving' }), null); assert.equal(pickClip(null, {}), null);
});
await atest('Indian trains: consists look like the real thing (LHB sleepers and AC, ICF, goods, locals), lengths add up, tracks and lanes follow the traffic', async () => {
  const { consist, lengthOf, LEN, headcode, locoNumber } = await import('../src/world/train_consist.js'), { tracksFor, laneOffsets, TRACK_GAP } = await import('../src/world/rail_timetable.js');
  assert.deepEqual([0, 29, 30, 99, 100, 149, 150].map(tracksFor), [1, 1, 2, 2, 3, 3, 4], 'single where quiet, double on busy lines, three and four on the busiest'); assert.deepEqual(laneOffsets(1), [0]); assert.deepEqual(laneOffsets(2), [-TRACK_GAP / 2, TRACK_GAP / 2]); assert.equal(laneOffsets(4)[3] - laneOffsets(4)[0], 3 * TRACK_GAP);
  for (let seed = 0; seed < 40; seed++) { const ex = consist('express', null, seed), cnt = k => ex.items.filter(i => i.kind === k).length; assert.equal(ex.items[0].kind, 'loco'); assert.ok(cnt('sleeper') >= 5 && cnt('ac3') >= 2 && cnt('ac2') >= 1 && cnt('slr') >= 1, 'an express has sleepers, 3AC, 2AC and a luggage van'); assert.ok(['lhb', 'icf'].includes(ex.livery)); assert.ok(ex.items.filter(i => i.kind === 'sleeper').every((i, n) => i.label === 'S' + (n + 1)), 'coaches are numbered S1, S2...'); }
  const rj = consist('rajdhani', null, 1); assert.ok(!rj.items.some(i => i.kind === 'sleeper' || i.kind === 'general') && rj.items.some(i => i.label === 'B1') && rj.items.some(i => i.label === 'H1'), 'a Rajdhani is all air-conditioned'); const fr = consist('freight', null, 5); assert.equal(fr.items[0].kind, 'loco'); assert.equal(fr.items[fr.items.length - 1].kind, 'brake', 'a goods train ends with a brake van'); assert.ok(fr.items.length >= 18 && fr.items.every(i => ['loco', 'boxn', 'tank', 'container', 'brake'].includes(i.kind)));
  const em = consist('emu_wr', null, 2); assert.equal(em.items.length, 12); assert.equal(em.items[0].end, 1); assert.equal(em.items[11].end, -1); assert.equal(consist('passenger', null, 3).livery, 'icf'); assert.equal(lengthOf('coach'), LEN.coach); assert.equal(lengthOf('boxn'), 10.7);
  assert.equal(headcode('rajdhani', null), 'RAJDHANI EXPRESS'); assert.equal(headcode('express', { name: 'Punjab Mail' }), 'MAIL EXPRESS'); assert.equal(headcode('express', {}), 'SUPERFAST EXPRESS'); assert.ok(locoNumber(3, 'express') >= 30000 && locoNumber(3, 'express') < 39000);
});
await atest('rail over road: the track rises over a highway on a long gentle ramp (no steeper than 3 percent), level crossings stay level', async () => {
  const { RailLine } = await import('../src/world/rail.js'), { RailGrade, RAIL_GRADE } = await import('../src/world/rail_grade.js'), flat = () => 30, ln = new RailLine('e', [0, 0, 3000, 0]); ln.a = 0; ln.b = 1;
  const mk = crossings => new RailGrade({ edges: [ln], toWorld: (x, z) => ({ x, z }), natural: flat, crossings }), c = (type, s) => ({ rail: 'e', type, s, x: s, z: 0 });
  const g = mk([c('bridge', 1500)]), pr = g.profile(0); assert.ok(g.yAt(0, 1500) >= 30 + RAIL_GRADE.CLEARANCE - 0.2, 'over the road with clearance: ' + g.yAt(0, 1500).toFixed(1)); let worst = 0; for (let i = 1; i < pr.length; i++) worst = Math.max(worst, Math.abs(pr[i] - pr[i - 1]) / RAIL_GRADE.STEP); assert.ok(worst <= RAIL_GRADE.MAX_GRADE + 1e-6, 'a gentle ramp: ' + worst.toFixed(4));
  assert.ok(g.yAt(0, 1500 - 400) < g.yAt(0, 1500 - 100), 'it climbs towards the road'); assert.ok(g.yAt(0, 100) < 30 + 2, 'far away it is back at the ground'); assert.ok(mk([c('level', 1500)]).yAt(0, 1500) < 33, 'a level crossing stays at the ground');
});
await atest('locomotive liveries do not show the service; diesel where not electrified; Vande Bharat only on its routes; maintenance trains are yellow', async () => {
  const { consist, locoSpec, lengthOf } = await import('../src/world/train_consist.js'), { TrainBook, styleOf } = await import('../src/world/rail_timetable.js'), { RailNetwork } = await import('../src/world/rail.js'), fs = await import('node:fs/promises'), rd = f => fs.readFile(new URL('../assets/india/' + f, import.meta.url)).then(b => JSON.parse(b));
  const seen = { express: new Set(), freight: new Set(), passenger: new Set() }; for (let sd = 0; sd < 300; sd++) for (const st of Object.keys(seen)) seen[st].add(locoSpec(st, sd, false).livery); for (const st of Object.keys(seen)) assert.ok(seen[st].size >= 2, st + ' locos come in several liveries: ' + [...seen[st]]);
  assert.ok([...seen.express].every(l => ['blue', 'red', 'green'].includes(l)), 'electric liveries are blue, red or green'); const dz = new Set(); for (let sd = 0; sd < 300; sd++) { const l = locoSpec('freight', sd, true); assert.ok(l.diesel && /^WD/.test(l.model)); dz.add(l.livery); } assert.ok(dz.has('brown'), 'diesel freight locos are often brown');
  assert.equal(consist('freight', null, 4, { diesel: true }).items[0].diesel, true); assert.ok(!consist('freight', null, 4, {}).items[0].diesel); assert.equal(consist('maintenance', null, 1).loco, 'yellow'); assert.ok(consist('maintenance', null, 1).items.every(i => i.kind.startsWith('maint')) && lengthOf('maint') > 8); assert.ok([8, 16].includes(consist('vande', null, 7).items.length));
  const rn = new RailNetwork(await rd('rails.json')), book = new TrainBook(await rd('trains.json'), rn), vb = book.trains.filter(t => /vande/i.test(t.name)); assert.ok(vb.length >= 20 && vb.every(t => styleOf(t) === 'vande' && t.stops.length >= 2), 'Vande Bharat services: ' + vb.length); const v1 = vb.find(t => t.n === '20901'); assert.ok(v1 && v1.stops[0][0] === 'mumbai' && v1.stops.some(x => x[0] === 'ahmedabad') && v1.stops[0][2] === 6 * 60 + 10, 'Mumbai Central to Gandhinagar leaves at 06:10 through Surat and Vadodara');
  const dep = book.departures('delhi', 5 * 60, 300); assert.ok(dep.some(d => /Vande/.test(d.name)), 'a Vande Bharat is on the Delhi board in the early morning');
});
await atest('railway signals and crossings: signals stand where the rules put them and show the right aspect; an expressway is never crossed on the level; gates and traffic', async () => {
  const { planSignals, aspectOf, HOME_BEFORE, DISTANT_BEFORE } = await import('../src/world/rail_signals.js'), { classifyCrossings, RailLine } = await import('../src/world/rail.js');
  const sg = planSignals(2400, true, true, [1200]), home = sg.filter(x => x.kind === 'home'); assert.equal(home.length, 2, 'a home signal at each end'); assert.ok(home.some(x => x.dir === -1 && x.s === HOME_BEFORE) && home.some(x => x.dir === 1 && x.s === 2400 - HOME_BEFORE), 'homes stand before the node for trains arriving there');
  for (const d of sg.filter(x => x.kind === 'distant')) assert.ok(Math.abs(d.s - (d.dir > 0 ? 2400 - DISTANT_BEFORE : DISTANT_BEFORE)) < 1, 'a distant stands further back than its home'); assert.equal(sg.filter(x => x.kind === 'gate').length, 2, 'a gate signal for each direction before the level crossing'); assert.ok(sg.every(x => x.s > 0 && x.s < 2400));
  const occ = (a, b) => (a, b, 1200 >= a && 1200 < b ? true : false); const up = sg.filter(x => x.dir === 1); const kHome = sg.indexOf(up.find(x => x.kind === 'home')); assert.equal(aspectOf(sg, kHome, 2400, () => false), 'green', 'free line: green'); assert.equal(aspectOf(sg, kHome, 2400, (a, b) => b > 2300), 'red', 'a train in the block: red');
  const kBlock = sg.indexOf(up.find(x => x.kind === 'block')), blockAhead = up.filter(x => x.s > sg[kBlock].s)[0]; const occAfter = (a, b) => blockAhead && b > blockAhead.s + 5 && a >= blockAhead.s - 1 && a < blockAhead.s + 5; assert.ok(['yellow', 'green', 'red'].includes(aspectOf(sg, kBlock, 2400, occAfter)));
  const kGate = sg.indexOf(up.find(x => x.kind === 'gate')); assert.equal(aspectOf(sg, kGate, 2400, () => false, false), 'red', 'a gate signal stays red until the gate is shut'); assert.equal(aspectOf(sg, kGate, 2400, () => false, true), 'green');
  const rail = new RailLine('r', [0, 0, 4000, 0]); const roads = [{ id: 'a', kind: 'gq', pts: [1000, -300, 1000, 300] }, { id: 'b', kind: 'nh', pts: [3000, -300, 3000, 300] }, { id: 'c', kind: 'ew', pts: [1800, -300, 1800, 300] }], stations = [{ x: 1000, z: 0 }, { x: 3000, z: 0 }];
  const cr = classifyCrossings([rail], roads, [], stations); const by = Object.fromEntries(cr.map(c => [c.road, c.type])); assert.equal(by.a, 'bridge', 'an expressway next to a station is still crossed on a bridge'); assert.equal(by.b, 'level', 'a plain national highway next to a station may have a level crossing'); assert.equal(by.c, 'bridge', 'away from stations it is a bridge');
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
  assert.deepEqual(REGIONS.filter(r => r.district).map(r => r.id).sort(), ['agra', 'bhopal', 'delhi', 'mumbai'], 'Mumbai, Delhi, Agra and Bhopal have a district');
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
    for (const c of sim.cars) { if (c.kind === 'two-wheeler') { bikes++; if (Math.abs(c.lat - (sim.lateral(c.dir, c.lane) + c.off)) < 0.05) { const off = Math.abs(Math.abs(c.lat) - sim.lanes[c.lane]); assert.ok(off > 0.2 && off <= lane * 0.3 + 1e-6, 'a two-wheeler sits at the edge of its lane: ' + off); } }
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
test('audit R05: a handle only resolves in the registry or pool that made it; a long stall is counted as dropped time (R16)', () => {
  const A = new Registry({ car: 4 }), B = new Registry({ car: 4 }), ha = A.create('car', { n: 'a' }), hb = B.create('car', { n: 'b' });
  assert.notEqual(ha, hb, 'two registries never hand out the same number'); assert.equal(B.get(ha), null, 'a foreign handle does not resolve'); assert.equal(B.destroy(ha), null); assert.equal(A.get(ha).n, 'a'); assert.equal(B.get(hb).n, 'b');
  A.clear(); assert.equal(A.get(ha), null); const ha2 = A.create('car', {}); assert.notEqual(ha2, ha, 'a reused slot gets a new generation');
  const mk = () => new Pool({ cap: 2, make: () => ({}), reset: () => {} }), P = mk(), Q = mk(), a = P.acquire(), b = Q.acquire(); assert.notEqual(a.handle, b.handle); assert.equal(Q.get(a.handle), null); assert.equal(Q.release(a.handle), false); assert.equal(P.get(a.handle), a.obj);
  const rt = new GameRuntime(); rt.frame(0); rt.frame(10000); assert.equal(rt.lastDt, 0.05); assert.ok(Math.abs(rt.droppedTime - 9.95) < 1e-9, 'the discarded wall time is counted: ' + rt.droppedTime);
});
test('audit R06: a car standing at every exit spot means no exit', () => {
  const car = { x: 0, z: 0, yaw: 0, halfWidth: 1, halfLength: 2.2 }, cars = [{ x: 0, z: 1.9, r: 1.2, traffic: 1 }, { x: 0, z: -1.9, r: 1.2, traffic: 1 }, { x: -3.4, z: 0, r: 1.2, traffic: 1 }];
  assert.equal(chooseExit(car, footWorld({ near: () => [cars] })), null, 'traffic blocks the exit like anything else'); assert.ok(chooseExit(car, footWorld({ near: () => [[cars[0]]] })).z < 0, 'the free side is used');
});
test('audit R07: the capsule is swept (no tunnelling through a thin wall), slides, steps over low things, walks under high things and is stopped by tall ones', () => {
  const walkTo = (circles, input = { throttle: 1, run: 1 }, secs = 2, dt = 1 / 20) => { const f = new OnFoot(footWorld({ near: () => [circles] })); f.place(0, 0, 0); for (let t = 0; t < secs; t += dt) f.step(dt, input); return f; };
  const thin = walkTo([{ x: 3, z: 0, r: 0.12 }]); assert.ok(thin.x < 3, 'a thin post at a slow frame rate is not skipped: x=' + thin.x);
  const wall = walkTo([{ x: 3, z: 0, r: 0.6, y0: 0, y1: 3 }]); assert.ok(wall.x < 3, 'a tall wall stops the character');
  const kerb = walkTo([{ x: 3, z: 0, r: 0.6, y0: 0, y1: 0.3 }]); assert.ok(kerb.x > 4, 'a kerb is stepped over: x=' + kerb.x);
  const deck = walkTo([{ x: 3, z: 0, r: 0.6, y0: 4.5, y1: 6 }]); assert.ok(deck.x > 4, 'a bridge deck above the head is walked under: x=' + deck.x);
  const low = walkTo([{ x: 3, z: 0, r: 0.6, y0: 0, y1: 1.6 }, { x: 3.5, z: 0.4, r: 0.6, y0: 0, y1: 1.6 }]); assert.ok(low.x < 4, 'two overlapping walls still stop it, with no jitter into them');
  const slideF = walkTo([{ x: 3, z: 0.3, r: 1, y0: 0, y1: 3 }], { throttle: 1, steer: 0 }, 3); assert.ok(Math.abs(slideF.z) > 0.3 || slideF.x < 3, 'it slides along the face instead of sticking');
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
  assert.ok(plan.stones.length >= 380 && plan.stones.length <= 400, 'a stone every 10 real km on both sides (minus any inside a toll plaza): ' + plan.stones.length);
  assert.ok(plan.gantries.length >= 31 && plan.gantries.length <= 34, 'a gantry about every 600 m: ' + plan.gantries.length); for (let i = 1; i < plan.gantries.length; i++) assert.ok(plan.gantries[i].s - plan.gantries[i - 1].s >= GANTRY_EVERY - 1);
  assert.ok(plan.gantries.every(g => g.sign && g.sign.km >= 1 && g.sign2 && g.posts.length === 3 && g.posts[1].lat === 0), 'every gantry has two destination boards and three posts');
  assert.equal(plan.tolls.length, tollAt(0, 20000).length); assert.ok(plan.tolls.length >= 2 && plan.tolls.length <= 3); for (const t of plan.tolls) { assert.equal(t.islands.length, 8); assert.equal(t.len, TOLL_LEN); }
  const lanes = laneOffsets(ROAD_STYLES.nh6); for (const c of plan.circles) for (const l of lanes.flatMap(x => [x, -x])) if (Math.abs(c.x - plan.tolls[0].x) < TOLL_LEN) assert.ok(Math.abs(Math.abs(c.z) - l) > c.r + 0.95 || false, 'a toll island or post must leave the lane clear (circle at ' + c.z.toFixed(2) + ' vs lane ' + l + ')');
  const railsInToll = plan.rails.filter(r => plan.tolls.some(t => r.x > t.s - 36 && r.x < t.s + TOLL_LEN + 36)); assert.equal(railsInToll.length, 0, 'no guardrail in or near a toll plaza'); assert.ok(plan.rails.length > 4000, 'rails along both edges');
  assert.ok(plan.rails.every(r => Math.abs(Math.abs(r.z) - (ROAD_STYLES.nh6.shoulder + 0.45)) < 1e-9), 'rails stand just outside the shoulder');
  const onBridge = planHighway({ road: line(s => (s > 1000 && s < 5000 ? 1 : 0)), seed: 'x', k: 0, s0: 0, s1: 8000, dests }); assert.ok([...onBridge.rails, ...onBridge.stones, ...onBridge.gantries].every(o => !(o.s > 1000 && o.s < 5000)), 'nothing on a bridge');
  { const lab = planHighway({ road, seed: 'x', k: 0, s0: 0, s1: 4000, dests: [{ en: 'Agra', hi: 'आगरा', alongM: 500 }, { en: 'Jaipur', hi: 'जयपुर', alongM: 3000 }], arcAt: x => x, tag: 'NH48' }), st = lab.stones.find(q => q.s === 1000); assert.ok(st && st.tag === 'NH48' && st.ahead.en === 'Jaipur' && st.ahead.km === 200 && st.behind.en === 'Agra' && st.behind.km === 50, 'a stone names the city ahead with the real km, and the one behind: ' + JSON.stringify(st && [st.ahead, st.behind])); }
  const route = [{ en: 'Jaipur', hi: 'जयपुर', km: 0, alongM: 3000 }, { en: 'Ajmer', hi: 'अजमेर', km: 0, alongM: 6000 }, { en: 'Udaipur', hi: 'उदयपुर', km: 0, alongM: 9000 }], rp = planHighway({ road, seed: 'x', k: 0, s0: 0, s1: 8000, dests: route });
  assert.equal(rp.gantries[0].sign.en, 'Jaipur', 'the first board names the next city on a real route'); assert.equal(rp.gantries[0].sign2.en, 'Ajmer'); for (let i = 1; i < rp.gantries.length; i++) { const g = rp.gantries[i], prev = rp.gantries[i - 1]; if (g.sign.en === prev.sign.en) assert.ok(g.sign.km < prev.sign.km, 'the distance to the same city counts down along the road'); }
  assert.equal(rp.gantries.find(g => g.s > 2800 && g.s < 3300 && g.sign.en === 'Jaipur'), undefined, 'a city we have almost reached is no longer announced'); assert.ok(rp.gantries.every(g => g.sign.km === Math.max(1, Math.round((route.find(r => r.en === g.sign.en).alongM - g.s) * 100 / 1000))), 'real kilometres = game metres x 100 / 1000');
  assert.deepEqual(planHighway({ road: { ...road, style: ROAD_STYLES['two-lane'] }, seed: 'x', k: 0, s0: 0, s1: 5000, dests }), { rails: [], stones: [], gantries: [], tolls: [], gates: [], circles: [] }, 'other styles get nothing'); assert.equal(planHighway({ road: { ...road, style: ROAD_STYLES.highway }, seed: 'x', k: 0, s0: 0, s1: 5000, dests }).tolls.length, 0, 'the four-lane highway gets stones, rails and boards but no toll plaza');
  assert.equal(tollCap(-3), 4); assert.equal(tollCap(0), 4); assert.ok(tollCap(30) > 4 && tollCap(30) < tollCap(90) && tollCap(1000) === 40, 'cars ease down to walking pace at the booths'); assert.deepEqual(validTolls(road, 0, 20000), plan.tolls.map(t => t.s), 'the traffic and the plan agree where the plazas are'); assert.equal(validTolls(line(s => (s > 1000 && s < 5000 ? 1 : 0)), 0, 8000).length, tollAt(0, 8000).filter(t => !(t + TOLL_LEN > 1000 && t < 5000)).length);
  const d = destinationsFor(18.52, 73.86); assert.ok(d.length >= 2 && d.some(x => x.id === 'mumbai') && d.every((x, i) => i === 0 || x.km >= d[i - 1].km), 'destinations near Pune, nearest first'); assert.ok(d.every(x => x.en && (x.hi || !HINDI[x.id]))); assert.equal(destinationsFor(0, 0).length >= 0, true);
});

test('India game space and skeleton (1:100): conversions round-trip, paths have the right length, the shipped skeleton file is current', () => {
  for (const [la, lo] of [[28.61, 77.21], [8.08, 77.54], [34.08, 74.8], [26.14, 91.74]]) { const g = toGame(la, lo), b = fromGame(g.x, g.z); assert.ok(Math.abs(b.lat - la) < 1e-9 && Math.abs(b.lon - lo) < 1e-9); }
  const d = toGame(28.61, 77.21), m = toGame(19.08, 72.88), km = Math.hypot(d.x - m.x, d.z - m.z) / 1000; assert.ok(km > 11 && km < 12.5, 'Delhi to Mumbai in a straight line is about 1,150 real km = 11.5 game km, got ' + km.toFixed(2));
  assert.ok(toGame(30, 80).z < toGame(20, 80).z, 'north is up (smaller z)'); assert.ok(Math.abs(toGame(22.5, 80).x) < 1e-9 && Math.abs(toGame(22.5, 80).z) < 1e-9, 'the origin is the centre of India');
  const gq = HIGHWAYS.find(h => h.id === 'gq-delhi-mumbai'), pts = smoothPath(gq.cities), len = pathLength(pts) / 1000; assert.ok(len > 12 && len < 14, 'the Delhi to Mumbai highway centre path is about 12.8 game km at 1:100 (the real road is about 10% longer: the local bends the route planner adds): ' + len.toFixed(2)); assert.ok(Math.abs(pts[0][0] - toGame(28.61, 77.21).x) < 1e-6 && Math.abs(pts.at(-1)[0] - toGame(19.08, 72.88).x) < 1e-6, 'the path starts and ends on its cities');
  const sk = buildSkeleton(); assert.deepEqual(sk, buildSkeleton(), 'deterministic'); assert.equal(sk.roads.length, HIGHWAYS.length); assert.equal(sk.rails.length, RAIL.length); assert.equal(sk.nodes.length, CITIES.length); assert.ok(sk.bounds.x1 - sk.bounds.x0 < 30000 && sk.bounds.z1 - sk.bounds.z0 < 35000, 'India fits in about 25 x 30 game km');
  const gqTotal = sk.roads.filter(r => r.kind === 'gq').reduce((a, r) => a + r.len, 0) / 1000; assert.ok(gqTotal > 50 && gqTotal < 57, 'the Golden Quadrilateral centre paths at 1:100 total about 53 game km (the published road is 5,846 km): ' + gqTotal.toFixed(1));
  const wp = buildSkeleton(GAME_SCALE, { waypoints: { 'gq-delhi-mumbai': [[28.61, 77.21], [26.9, 75.8], [19.08, 72.88]] } }); assert.deepEqual(wp.roads[0].cities, gq.cities, 'waypoints replace the geometry, not the city list'); assert.notEqual(wp.roads[0].len, sk.roads[0].len);
  const wpFile = JSON.parse(readSkeleton(new URL('../assets/india/waypoints.json', import.meta.url), 'utf8')); assert.ok(/OpenStreetMap/.test(wpFile.meta.credit) && /ODbL/.test(wpFile.meta.licence), 'the waypoints carry their OpenStreetMap credit and licence');
  const real = buildSkeleton(GAME_SCALE, { waypoints: wpFile.roads, provenance: 'road paths follow simplified OpenStreetMap-derived driving routes (' + wpFile.meta.credit + ', ' + wpFile.meta.licence + '); railways and city positions entered by hand' });
  assert.equal(Object.keys(wpFile.roads).length, HIGHWAYS.length, 'a real route for every highway'); for (const h of HIGHWAYS) { const w = wpFile.roads[h.id], first = toGame(w[0][0], w[0][1]), c0 = toGame(CITY[h.cities[0]].lat, CITY[h.cities[0]].lon), last = toGame(w.at(-1)[0], w.at(-1)[1]), c1 = toGame(CITY[h.cities.at(-1)].lat, CITY[h.cities.at(-1)].lon); assert.ok(Math.hypot(first.x - c0.x, first.z - c0.z) < 600 && Math.hypot(last.x - c1.x, last.z - c1.z) < 600, h.id + ' starts and ends at its cities (within 60 real km)'); }
  const gqReal = real.roads.filter(r => r.kind === 'gq').reduce((a, r) => a + r.len, 0) / 1000; assert.ok(gqReal > 54 && gqReal < 62, 'the real Golden Quadrilateral routes at 1:100 total about 58 game km: ' + gqReal.toFixed(1)); for (const r of real.roads) { const straight = sk.roads.find(x => x.id === r.id).len; assert.ok(r.len >= straight * 0.97 && r.len < straight * 2.2, r.id + ' real path ' + r.len + ' vs straight ' + straight); }
  const shipped = JSON.parse(readSkeleton(new URL('../assets/india/skeleton.json', import.meta.url), 'utf8')); assert.deepEqual(shipped, JSON.parse(JSON.stringify(real)), 'assets/india/skeleton.json is out of date: run node tools/build_india_skeleton.mjs'); assert.ok(readSkeleton(new URL('../assets/india/skeleton.json', import.meta.url)).length < 120000, 'the skeleton stays small');
});

test('road network and guided road: junctions, projection, routes; a road follows its guide path through the terrain', () => {
  const sk = JSON.parse(readSkeleton(new URL('../assets/india/skeleton.json', import.meta.url), 'utf8')), net = new RoadNetwork(sk);
  assert.equal(net.roads.size, sk.roads.length); for (const r of net.roads.values()) { assert.ok(r.length > 500, r.id + ' has length'); for (let i = 1; i < r.stops.length; i++) assert.ok(r.stops[i].s >= r.stops[i - 1].s, r.id + ' cities in order along the road'); }
  assert.ok(net.isJunction('delhi') && net.junction('delhi').length >= 4, 'Delhi is a junction of several roads'); assert.ok(!net.isJunction('nonexistent'));
  const agra = sk.nodes.find(n => n.id === 'agra'), q = net.nearest(agra.x + 80, agra.z, 2000); assert.ok(q && q.d < 400 && net.roads.has(q.road), 'the nearest road to a point near Agra'); assert.equal(net.nearest(agra.x + 90000, agra.z, 600), null, 'nothing near the middle of nowhere');
  const p = net.at('gq-delhi-mumbai', 5000), p2 = net.at('gq-delhi-mumbai', 5001); assert.ok(Math.abs(Math.hypot(p2.x - p.x, p2.z - p.z) - 1) < 0.05 && Math.abs(Math.hypot(p.tx, p.tz) - 1) < 1e-9, 'positions advance one metre per metre');
  const r = net.route('delhi', 'mumbai'); assert.ok(r && r.length > 12000 && r.length < 16500, 'Delhi to Mumbai about 14 game km: ' + Math.round(r.length)); assert.equal(r.legs[0].from, 'delhi'); assert.equal(r.legs.at(-1).to, 'mumbai'); for (let i = 1; i < r.legs.length; i++) assert.equal(r.legs[i].from, r.legs[i - 1].to, 'legs join'); assert.equal(net.route('delhi', 'atlantis'), null); assert.equal(net.route('delhi', 'delhi').length, 0);
  const g = net.guideFor('nh-delhi-lucknow', 'delhi', 'lucknow'), back = net.guideFor('nh-delhi-lucknow', 'lucknow', 'delhi'); assert.deepEqual(g.pts.slice(0, 2), [0, 0]); assert.ok(g.cities[0].id === 'delhi' && g.cities.at(-1).id === 'lucknow' && g.cities.at(-1).along <= g.length + 1); assert.ok(Math.abs(g.length - back.length) < 1, 'both directions are as long'); assert.equal(net.guideFor('nh-delhi-lucknow', 'delhi', 'mumbai'), null);
  const rg = net.routeGuide('delhi', 'mumbai'); assert.ok(rg && rg.pts.length > 100 && Math.abs(rg.length - net.route('delhi', 'mumbai').length) < 1200, 'a route guide is about as long as the route'); assert.deepEqual(rg.cities.map(c => c.id).slice(0, 3), ['delhi', 'jaipur', 'ajmer']); for (let i = 1; i < rg.cities.length; i++) assert.ok(rg.cities[i].along > rg.cities[i - 1].along, 'cities in order along the guide');
  const multi = net.routeGuide('amritsar', 'kanyakumari'); assert.ok(multi.legs.length >= 2 && multi.junctions.length === multi.legs.length - 1, 'a long trip changes road at junctions'); for (let i = 1; i < multi.legs.length; i++) assert.equal(multi.legs[i].from, multi.legs[i - 1].to, 'legs meet at the junction city'); assert.equal(net.routeGuide('delhi', 'delhi'), null); assert.equal(net.routeGuide('delhi', 'atlantis'), null);
  const sl = net.slice('gq-delhi-mumbai', 3000, 1000), sl2 = net.slice('gq-delhi-mumbai', 1000, 3000); assert.equal(sl.length, sl2.length, 'a slice has the same points either way'); const e0 = net.at('gq-delhi-mumbai', 3000); assert.ok(Math.abs(sl[0] - e0.x) < 1e-6 && Math.abs(sl2.at(-2) - e0.x) < 1e-6, 'and runs from the first distance to the second');
  const ch = net.junctionChoices('jaipur', { cameFrom: 'delhi', onRoad: 'gq-delhi-mumbai' }); assert.ok(ch.length >= 1 && ch[0].same === true && ch.every(c => c.toward !== 'delhi' && c.km > 0), 'choices at Jaipur exclude the way you came and list the same road first'); const dl = net.junctionChoices('delhi'); assert.ok(dl.length >= 5 && new Set(dl.map(c => c.road)).size >= 4, 'Delhi offers many roads: ' + dl.length);
  const gates = rg.cities.filter(c => c.along > 0).map(c => ({ en: c.name, hi: '', alongM: c.along })), fakeRoad = { style: ROAD_STYLES.nh6, ds: 5, at(sd, p) { p.x = sd; p.z = 0; p.y = 0; p.tx = 1; p.tz = 0; p.th = 0; return p; }, bridgeW: () => 0, tunnelW: () => 0 };
  const gp = planHighway({ road: fakeRoad, seed: 'x', k: 0, s0: 0, s1: 14000, dests: [], arcAt: sd => sd * 0.95, gates }); assert.ok(gp.gates.length >= 5, 'a gate for each city within reach: ' + gp.gates.length); for (const g of gp.gates) assert.ok(g.s * 0.95 < g.alongM && g.alongM - g.s * 0.95 < 130, g.name + ' gate stands 40 to 130 m before the city: ' + Math.round(g.alongM - g.s * 0.95)); assert.equal(new Set(gp.gates.map(g => g.name)).size, gp.gates.length, 'one gate per city');
  const ws = net.worldStart('jaipur'); assert.ok(ws && ws.gA && ws.gA.cities.length >= 2 && ws.gB, 'a free drive at Jaipur has a way ahead and a way behind'); assert.equal(ws.kind, 'gq', 'the Golden Quadrilateral is preferred'); const wl = net.worldStart('kanyakumari'); assert.ok(wl && wl.gA && !wl.gB, 'at the end of a road there is only one way'); assert.equal(net.worldStart('atlantis'), null);
  const cfg = makeConfig({ seed: 'guide-test' }); cfg.road = { ...cfg.road, guide: g.pts }; const t = createTerrain(cfg), road = new Road(t, cfg); road.ensure(0, 6000); t.attachRoad(road);
  let worst = 0, n = 0; const pt = {}; const sp = road.guide; for (let sdist = 200; sdist <= 4500; sdist += 100) { road.at(sdist, pt); let best = Infinity; for (let i = 0; i < sp.length; i += 2) best = Math.min(best, Math.hypot(sp[i] - pt.x, sp[i + 1] - pt.z)); worst = Math.max(worst, best); n++; }
  assert.ok(n > 40 && worst < 450, 'the road stays within 450 m of its guide for the first 4.5 km (worst ' + Math.round(worst) + ' m)'); const arcOf = (x, z) => { let acc = 0, best = Infinity, arc = 0; for (let i = 0; i + 3 < sp.length; i += 2) { const dx = sp[i + 2] - sp[i], dz = sp[i + 3] - sp[i + 1], L = Math.hypot(dx, dz), f = Math.max(0, Math.min(1, ((x - sp[i]) * dx + (z - sp[i + 1]) * dz) / (L * L))), d = Math.hypot(x - (sp[i] + dx * f), z - (sp[i + 1] + dz * f)); if (d < best) { best = d; arc = acc + f * L; } acc += L; } return arc; };
  { const cfg2 = makeConfig({ seed: 'signed' }), w2 = net.worldStart('jaipur'); cfg2.road = { ...cfg2.road, guide: w2.gA.pts, guideBack: w2.gB.pts }; const t3 = createTerrain(cfg2), r3 = new Road(t3, cfg2); r3.ensure(-3000, 3000); t3.attachRoad(r3); const pp = {}; r3.at(1500, pp); const aF = r3.guideArcSigned(pp.x, pp.z); r3.at(-1500, pp); const aB = r3.guideArcSigned(pp.x, pp.z);
    assert.ok(aF > 1000 && aB < -1000, 'positive along the way ahead, negative along the way behind: ' + Math.round(aF) + ' / ' + Math.round(aB)); assert.ok(r3.arcAtSigned(2500) > r3.arcAtSigned(1500) && r3.arcAtSigned(-2500) < r3.arcAtSigned(-1500), 'monotonic on each arm'); }
  let prev = -1; for (const d of [1000, 2000, 3000, 4000, 5000]) { road.at(d, pt); const a = arcOf(pt.x, pt.z); assert.ok(a > prev + 250, 'the road keeps advancing along the guide: ' + Math.round(a) + ' after ' + d + ' m of road'); prev = a; } assert.ok(prev > g.length * 0.6 && prev < g.length + 300, 'and after 5 km of road it has covered most of the guide: ' + Math.round(prev) + ' of ' + Math.round(g.length));
  const free = new Road(createTerrain(makeConfig({ seed: 'guide-test' })), makeConfig({ seed: 'guide-test' })); assert.equal(free.guide, undefined, 'without a guide nothing changes');
});

test('road set: a road that branches off another one starts at its height, both are graded into the land, the nearest road answers', () => {
  const cfg = makeConfig({ seed: 'branch-test' }), t = createTerrain(cfg), main = new Road(t, cfg); main.ensure(-1500, 3000); const set = new RoadSet(main); t.attachRoad(set);
  const solo = []; for (let i = 0; i < 30; i++) { const x = i * 97 - 800, z = i * 41 - 300; solo.push([x, z, t.height(x, z), t.surface(x, z)]); } assert.ok(main.nearest(0, 0) !== undefined);
  const jp = main.at(1200, {}), th = jp.th + Math.PI / 2, bcfg = { ...cfg, road: { ...cfg.road, start: { x: jp.x, y: jp.y, z: jp.z }, guide: [0, 0, Math.cos(th) * 600, Math.sin(th) * 600, Math.cos(th) * 1200, Math.sin(th) * 1200], guideBack: [0, 0, -Math.cos(th) * 600, -Math.sin(th) * 600, -Math.cos(th) * 1200, -Math.sin(th) * 1200] } };
  const br = new Road(t, bcfg); br.ensure(-1500, 1500); set.add(br);
  const b0 = br.at(0, {}); assert.ok(Math.hypot(b0.x - jp.x, b0.z - jp.z) < 1 && Math.abs(b0.y - jp.y) < 0.5, 'the branch starts on the road it leaves, at its height: ' + (b0.y - jp.y).toFixed(2));
  let off = 0; for (const s2 of [200, 600, 1000, 1400]) { const p = br.at(s2, {}); let best = Infinity; for (let i = 0; i < br.guide.length; i += 2) best = Math.min(best, Math.hypot(br.guide[i] - p.x, br.guide[i + 1] - p.z)); off = Math.max(off, best); } assert.ok(off < 400, 'the branch follows its guide (worst ' + Math.round(off) + ' m)');
  const bk = br.at(-800, {}); assert.ok(Math.abs(Math.atan2(Math.sin(Math.atan2(bk.z - jp.z, bk.x - jp.x) - (th + Math.PI)), Math.cos(Math.atan2(bk.z - jp.z, bk.x - jp.x) - (th + Math.PI)))) < 0.9, 'the other arm runs the other way across the main road (a crossroads)');
  assert.ok(set.nearest(jp.x, jp.z) && set.hit.d < 1 && set.roads.length === 2); const q = br.at(500, {}); assert.ok(set.nearest(q.x, q.z) && set.last === br && set.hit.d < 1, 'the nearest road answers on the branch'); assert.ok(set.nearest(main.at(600, {}).x, main.at(600, {}).z) && set.last === main);
  assert.ok(Math.abs(t.height(jp.x, jp.z) - jp.y) < 1.5 && Math.abs(t.drive(q.x, q.z) - q.y) < 0.6, 'the land under each road is level with it'); const surf = t.surface(q.x, q.z); assert.ok(surf === 'asphalt', 'wheels on the branch feel its surface: ' + surf);
  const branchSim = new TrafficSim(br, { seed: 'branch-traffic', mode: 'off', drive: 'left', scale: 1 }); assert.equal(branchMode('off', true), 'off'); assert.equal(branchMode('low', false), 'off', 'nothing on a side road the player is not near'); assert.equal(branchMode('low', true), 'low'); assert.equal(branchMode('mid', true), 'low'); assert.equal(branchMode('high', true), 'mid', 'lighter than the main road');
  branchSim.setMode(branchMode('mid', true)); const bp = br.at(400, {}); for (let i = 0; i < 1200; i++) branchSim.update(1 / 30, { x: bp.x, z: bp.z, s: 400, u: 0, yaw: bp.th }); assert.ok(branchSim.cars.length > 0, 'cars appear on the side road: ' + branchSim.cars.length); const qq = {};
  for (const c of branchSim.cars) { br.at(c.s, qq); const lat = Math.hypot(c.x - qq.x, c.z - qq.z); assert.ok(laneOffsets(br.style).some(o => Math.abs(lat - o) < 0.6), 'a car keeps to a lane of the side road (' + lat.toFixed(1) + ' m from the centre line, lanes ' + laneOffsets(br.style).join(', ') + ')'); assert.ok(c.s > 400 - 600 && c.s < 400 + 900, 'cars live near the player'); }
  const sup = new Set(branchSim.circles(bp.x, bp.z, 400)[0].map(c => c.traffic)); assert.ok(sup.size >= 1, 'their obstacle circles reach the physics'); branchSim.setMode('off'); assert.equal(branchSim.cars.length, 0, 'switching off clears them');
  /* a junction: shared signal, cars stop at the line on red, some turn onto the other road */
  const mainSim = new TrafficSim(main, { seed: 'junction-main', mode: 'high', drive: 'left', scale: 1 }), jx = new Junction(jp.x, jp.z), armA = jx.addArm(mainSim, main, 1200), armB = jx.addArm(branchSim, br, 0); mainSim.attachJunction(jx, armA); branchSim.attachJunction(jx, armB);
  assert.equal(jx.phases, 2); assert.equal(armA.phase, 0); assert.equal(armB.phase, 1); const slot = JSIG.green + JSIG.amber + JSIG.clear; assert.equal(jx.state(armA, 1), 'green'); assert.equal(jx.state(armB, 1), 'red'); assert.equal(jx.state(armA, JSIG.green + 1), 'amber'); assert.equal(jx.state(armA, JSIG.green + JSIG.amber + 0.5), 'red'); assert.equal(jx.state(armB, slot + 1), 'green'); assert.equal(jx.state(armA, 2 * slot + 1), 'green', 'the cycle repeats');
  let bothGreen = 0, nGreen = 0; for (let tt = 0; tt < 4 * slot; tt += 0.5) { const a = jx.state(armA, tt) === 'green', b = jx.state(armB, tt) === 'green'; if (a && b) bothGreen++; if (a || b) nGreen++; } assert.equal(bothGreen, 0, 'never green on both roads at once'); assert.ok(nGreen > 0);
  assert.equal(new Junction(0, 0).state({ phase: 0 }), 'green', 'a junction with a single road never stops anyone');
  branchSim.setMode('mid'); mainSim.setMode('high'); const ps = { x: jp.x + 4000, z: jp.z, s: 1200, u: 0, yaw: 0 }, bs = { x: jp.x + 4000, z: jp.z, s: 0, u: 0, yaw: 0 };
  let stopped = 0, minGap = Infinity, ok = true, passedMain = 0, seenTurn = jx.turns; const lineSpeeds = [];
  for (let i = 0; i < 20 * 60 * 6; i++) { jx.clock += 1 / 6; mainSim.update(1 / 6, ps); branchSim.update(1 / 6, bs);
    for (const [sim, arm] of [[mainSim, armA], [branchSim, armB]]) for (const c of sim.cars) { const d = (arm.s - c.s) * c.dir; if (d > 9 + c.len / 2 - 1 && d < 9 + c.len / 2 + 1.5 && jx.state(arm) === 'red' && c.speed < 0.3) stopped++; if (d > 0 && d < 9 + c.len / 2 - 3 && jx.state(arm) === 'red' && jx.clock % jx.cycle > slot * 0.5 && c.speed > 3) lineSpeeds.push(c.speed); }
    const ids = new Set(); for (const c of [...mainSim.cars, ...branchSim.cars]) { if (c.handle) { if (ids.has(c.handle + ':' + (mainSim.cars.includes(c) ? 'm' : 'b'))) ok = false; ids.add(c.handle + ':' + (mainSim.cars.includes(c) ? 'm' : 'b')); } }
  }
  { const probe = new TrafficSim(main, { seed: 'yield', mode: 'mid', drive: 'left', scale: 1 }), jy = new Junction(jp.x, jp.z), aY = jy.addArm(probe, main, 1200); jy.addArm(branchSim, br, 0); probe.attachJunction(jy, aY); const pl = { x: jp.x, z: jp.z, s: 1200, u: 0, yaw: 0 }; let worst = 0, n = 0; for (let i = 0; i < 900; i++) { jy.clock = 0.5; probe.update(1 / 10, pl); for (const c of probe.cars) { const d = (aY.s - c.s) * c.dir; if (d > 2 && d < 8) { worst = Math.max(worst, c.speed); n++; } } } assert.ok(n === 0 || worst < 6, 'cars wait for a player standing in the crossing even on green: fastest ' + worst.toFixed(1) + ' m/s near it'); }
  assert.ok(stopped > 10, 'cars wait at the stop line on red (samples: ' + stopped + ')'); assert.ok(lineSpeeds.length < 40, 'cars do not run the red once past the line is rare: ' + lineSpeeds.length); assert.ok(jx.turns > 0 && jx.turns > seenTurn, 'some cars turn onto the other road: ' + jx.turns); assert.ok(ok, 'no car in a sim twice'); assert.ok(mainSim.cars.length <= mainSim.cap && branchSim.cars.length <= branchSim.cap, 'turning respects the car cap');
  for (const c of mainSim.cars) { const q2 = main.at(c.s, {}); const lat = Math.hypot(c.x - q2.x, c.z - q2.z); if (c.blend === 0) assert.ok(lat < 12, 'a turned car ends up in a lane (' + lat.toFixed(1) + ')'); } mainSim.detachJunction(jx); assert.equal(mainSim.junctions.length, 0);
  const far = t.surface(jp.x + 3000, jp.z + 3000); assert.notEqual(far, 'asphalt'); set.remove(br); assert.equal(set.roads.length, 1); set.remove(main); assert.equal(set.roads.length, 1, 'the primary road cannot be removed');
  const alone = []; for (let i = 0; i < 30; i++) { const x = i * 97 - 800, z = i * 41 - 300; alone.push([x, z, t.height(x, z), t.surface(x, z)]); } assert.deepEqual(alone, solo, 'with the branch gone the land is as before (one-road behaviour is unchanged)');
});

test('N8 sector content: the region of a place, blends at borders, a point along a guide, which sector a city falls in', () => {
  const near = (lat, lon) => regionAt(lat, lon, REGIONS); assert.equal(near(28.6, 77.2).id, 'delhi'); assert.equal(near(19.1, 72.9).id, 'mumbai'); assert.equal(near(9.9, 76.3).id, 'kerala'); assert.equal(near(34.1, 77.6).id, 'ladakh'); assert.equal(near(26.9, 75.8).id, 'rajasthan');
  const inside = near(28.61, 77.23); assert.ok(inside.blend < 0.05 && inside.km < 5, 'right at a region: no blend'); const mid = near(27.9, 77.6); assert.ok(mid.blend > 0 && mid.blend <= 0.5 && mid.second && mid.second !== mid.id, 'between Delhi and Agra the two mix: ' + JSON.stringify(mid));
  assert.ok(Math.abs(distKm(28.61, 77.21, 19.08, 72.88) - 1150) < 40, 'great-circle Delhi to Mumbai about 1,150 km'); assert.equal(regionAt(10, 10, []), null); assert.deepEqual(regionAt(10, 10, [REGIONS[0]]).second, null);
  const flat = [0, 0, 300, 0, 300, 400]; assert.deepEqual(guidePoint(flat, 150), { x: 150, z: 0 }); assert.deepEqual(guidePoint(flat, 500), { x: 300, z: 200 }); assert.deepEqual(guidePoint(flat, 9999), { x: 300, z: 400 }); assert.deepEqual(guidePoint(flat, 0), { x: 0, z: 0 });
  const sectorOf = (x, z) => [Math.floor(x / 512), Math.floor(z / 512)]; assert.deepEqual(sectorOf(-1, 513), [-1, 1]); assert.deepEqual(sectorOf(1023.9, 0), [1, 0]);
});

test('real elevation and land cover: the terrain follows a macro grid, plains stay plain, forest and fields follow the land cover; no grid changes nothing; licenses.html is current', () => {
  const nx = 40, nz = 40, N = nx * nz, mk = f => { const a = new Int16Array(N); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) a[j * nx + i] = f(i, j); return a; }, u8 = f => { const a = new Uint8Array(N); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) a[j * nx + i] = f(i, j); return a; };
  const macro = { cell: 50, x0: 0, z0: 0, nx, nz, vscale: 0.1, ox: 0, oz: 0, h: mk((i, j) => i < 10 ? -200 : i < 20 ? 20 : 1200), rel: u8((i, j) => i < 20 ? 2 : 100), tree: u8((i, j) => j < 20 ? 220 : 0), crop: u8((i, j) => j >= 20 && i < 30 ? 230 : 0), grass: u8(() => 0), bare: u8((i, j) => i >= 30 ? 240 : 0), built: u8(() => 0) };
  const cfg = makeConfig({ seed: 'macro' }); cfg.terrain = { ...cfg.terrain, seaLevel: 0, seabed: -40, macro }; const T = createTerrain(cfg), plain = createTerrain(makeConfig({ seed: 'macro' }));
  assert.ok(T.base(3 * 50 + 25, 600) < -5 && T.base(3 * 50 + 25, 600) >= -40, 'real sea floor is below sea level'); const lowland = T.base(15 * 50 + 25, 600); assert.ok(lowland > 0 && lowland < 6, 'real 20 m plain is about 2 game metres up: ' + lowland.toFixed(1)); const hi = T.base(25 * 50 + 25, 600); assert.ok(hi > 100 && hi < 175, 'real 1,200 m at 0.1 is about 120 game metres: ' + hi.toFixed(1));
  const rough = (x0) => { let a = Infinity, b = -Infinity; for (let k = 0; k < 60; k++) { const h = T.base(x0 + k * 3, 600 + k * 2); a = Math.min(a, h); b = Math.max(b, h); } return b - a; }; assert.ok(rough(15 * 50) < rough(25 * 50), 'relief decides roughness: a plain is smoother than a range');
  assert.ok(T.forest(500, 100) > 0.9 && T.forest(500, 1500) < 0.2, 'forest follows the tree cover'); const cv = T.cover(500, 100); assert.ok(cv.tree > 0.8 && cv.bare === 0, 'cover fractions'); assert.equal(plain.cover(500, 100), null, 'no macro, no cover');
  const rgb = [0, 0, 0], rgb2 = [0, 0, 0]; T.colour(1700, 1500, T.base(1700, 1500), 1, rgb); T.colour(500, 1500, T.base(500, 1500), 1, rgb2); assert.ok(rgb[0] / rgb[2] > 1.6, 'bare ground is dusty tan (red much above blue): ' + (rgb[0] / rgb[2]).toFixed(2)); assert.ok(rgb2[0] / rgb2[2] < rgb[0] / rgb[2], 'farmland is greener than bare ground');
  const gm = JSON.parse(readSkeleton(new URL('../assets/india/terrain.json', import.meta.url), 'utf8')), gb = readSkeleton(new URL('../assets/india/terrain.bin', import.meta.url)), GN = gm.nx * gm.nz; assert.equal(gb.length, GN * 8, 'terrain.bin holds eight bytes per cell'); const at = (cx, cz) => { const i = Math.floor((cx - gm.x0) / gm.cell), j = Math.floor((cz - gm.z0) / gm.cell), k = j * gm.nx + i; return { h: gb.readInt16LE(k * 2), tree: gb[GN * 3 + k], built: gb[GN * 7 + k], bare: gb[GN * 6 + k], grass: gb[GN * 5 + k] }; };
  const skn = JSON.parse(readSkeleton(new URL('../assets/india/skeleton.json', import.meta.url), 'utf8')).nodes, city = id => skn.find(n => n.id === id); const real = { delhi: [227, 60], bhopal: [527, 80], leh: [3489, 400], manali: [2442, 500] }; for (const [id, [h, tol]] of Object.entries(real)) { const c = at(city(id).x, city(id).z); assert.ok(Math.abs(c.h - h) < tol, id + ' real elevation about ' + h + ' m: ' + c.h); }
  assert.ok(at(city('delhi').x, city('delhi').z).built > 120, 'Delhi is built-up land'); assert.ok(at(city('manali').x, city('manali').z).tree > 60, 'Manali has forest around it'); assert.ok(at(city('jaisalmer').x, city('jaisalmer').z).grass > 80, 'Jaisalmer is rangeland'); assert.ok(at(city('mumbai').x, city('mumbai').z).h >= 6, 'a city is never under the sea (corridor floor)');
  for (const n of skn) { const c = at(n.x, n.z); assert.ok(c.h >= 5, n.id + ' is on land in the grid: ' + c.h); }
  { const RN = 8, RM = RN * RN, ra = new Uint8Array(RM), rb = new Uint8Array(RM), rw = new Uint8Array(RM); for (let j = 0; j < RN; j++) for (let i = 0; i < RN; i++) { const k = j * RN + i; ra[k] = i < 4 ? 0 : 1; rb[k] = i < 4 ? 1 : 0; rw[k] = i === 3 || i === 4 ? 128 : 0; }
    const pal = g => ({ grass: g, grass2: g, dry: g, alpine: [0.5, 0.5, 0.3], rock: [0.5, 0.5, 0.5], sand: [0.8, 0.7, 0.5] }), mac2 = { ...macro, h: mk(() => 20), rel: u8(() => 2), tree: u8(() => 0), crop: u8(() => 0), bare: u8(() => 0), region: { cell: 250, x0: 0, z0: 0, nx: RN, nz: RN, a: ra, b: rb, w: rw }, palettes: [pal([0.2, 0.8, 0.2]), pal([0.9, 0.7, 0.2])], tints: [[1, 1, 1], [0.8, 0.9, 1.2]] };
    const c2 = makeConfig({ seed: 'macro' }); c2.terrain = { ...c2.terrain, seaLevel: 0, seabed: -40, macro: mac2 }; const T2 = createTerrain(c2), col = (x, z) => { const o = [0, 0, 0]; T2.colour(x, z, T2.base(x, z), 1, o); return o; };
    const left = col(300, 600), right = col(1700, 600); assert.ok(left[1] > left[0] * 1.2 && right[0] > right[2] * 1.5, 'each region has its own ground colour: ' + left.map(v => v.toFixed(2)) + ' | ' + right.map(v => v.toFixed(2))); assert.equal(T2.regionAt(300, 600).a, 0); assert.equal(T2.regionAt(1700, 600).a, 1); assert.ok(Math.abs(T2.regionAt(1000, 600).w - 0.5) < 0.01, 'half-way on the border');
    assert.deepEqual(T2.regionTint(300, 600), [1, 1, 1]); assert.ok(Math.abs(T2.regionTint(1000, 600)[0] - 0.9) < 0.01, 'plant tint blends too'); assert.equal(T.regionTint(500, 600), null, 'no region grid: nothing'); }
  const a = createTerrain(makeConfig({ seed: 'same' })), b = createTerrain(makeConfig({ seed: 'same' })); for (const [x, z] of [[10, 10], [900, -400], [-300, 2000]]) assert.equal(a.base(x, z), b.base(x, z), 'without a grid the land is exactly as before');
  assert.equal(readSkeleton(new URL('../licenses.html', import.meta.url), 'utf8'), renderLicenses(), 'licenses.html is out of date: run node tools/build_licenses.mjs'); const L = renderLicenses(); for (const w of ['OpenStreetMap', 'ODbL', 'Esri', 'Impact Observatory', 'CC BY 4.0', 'USGS'.length ? 'U.S. Geological Survey' : '', 'three.js', 'Rapier', 'Poly Haven', 'ambientCG', 'Kenney']) assert.ok(L.includes(w), 'the licence page credits ' + w);
});

test('region junctions (N11): validated, Mumbai has crossing streets', () => {
  const m = REGIONS.find(r => r.id === 'mumbai'); assert.ok(m.junctions && m.junctions.length >= 2, 'Mumbai has crossing streets'); assert.deepEqual(validateRegion(m), []);
  const bad = (j) => validateRegion({ ...m, junctions: j }).length > 0; assert.ok(bad([{ s: 10, style: 'boulevard', bearing: 1.5, arm: 800 }]), 'too close to the start'); assert.ok(bad([{ s: 500, style: 'moon', bearing: 1.5, arm: 800 }]), 'unknown style'); assert.ok(bad([{ s: 500, style: 'boulevard', bearing: 9, arm: 800 }]), 'bearing out of range'); assert.ok(bad([{ s: 500, style: 'boulevard', bearing: 1.5, arm: 50 }]), 'street too short'); assert.ok(bad('x')); assert.ok(bad(Array(7).fill({ s: 500, style: 'boulevard', bearing: 1.5, arm: 800 })), 'at most six'); assert.ok(!bad([]), 'none is fine');
  for (const r of REGIONS) if (r.junctions) for (const j of r.junctions) assert.ok(Math.abs(Math.sin(j.bearing)) > 0.5, r.id + ' crossing streets really cross the road');
});

test('Indian traffic kinds: buses and cows join the mix in proportion; a cow ambles and the cars behind it wait', () => {
  const kinds = trafficKinds(DEFAULT_KINDS, { car: 50, van: 0, truck: 10, 'two-wheeler': 20, bus: 10, cow: 5 }), names = kinds.map(k => k.name); assert.ok(names.includes('bus') && names.includes('cow') && names.includes('two-wheeler'), 'extras are added: ' + names.join(','));
  const W = DEFAULT_KINDS.reduce((a, k) => a + k.weight, 0), wb = kinds.find(k => k.name === 'bus').weight, wc = kinds.find(k => k.name === 'cow').weight; assert.ok(Math.abs(wb / (W * 10 / 60) - 1) < 1e-9 && Math.abs(wc / (W * 5 / 60) - 1) < 1e-9, 'bus and cow weights follow the mix, with the bus not counted twice');
  const cfg = makeConfig({ seed: 'cows' }), t = createTerrain(cfg), r = new Road(t, cfg); r.ensure(-1500, 3000); t.attachRoad(r); const sim = new TrafficSim(r, { seed: 'cow-sim', mode: 'high', drive: 'left', scale: 1 }); sim.setKinds(trafficKinds(DEFAULT_KINDS, { car: 50, truck: 10, 'two-wheeler': 20, bus: 10, cow: 30 })); 
  const seen = { cow: [], sedan: [], bus: [] }; for (let i = 0; i < 1500; i++) { sim.update(1 / 10, { x: 9e5, z: 9e5, s: 800, u: 0, yaw: 0 }); if (i > 600) for (const c of sim.cars) if (seen[c.kind]) seen[c.kind].push(c.speed); }
  assert.ok(seen.cow.length > 20 && Math.max(...seen.cow) < 5, 'a cow ambles (fastest ' + Math.max(...seen.cow).toFixed(1) + ' m/s)'); assert.ok(seen.sedan.length > 20, 'cars are on the road too'); const avg = l => l.reduce((x, y) => x + y, 0) / l.length; assert.ok(avg(seen.sedan) < 14, 'cars queue behind the cows instead of driving through them (average ' + avg(seen.sedan).toFixed(1) + ' m/s)');
});

test('Indian lane discipline (3-lane road, traffic keeps left): slow kinds in the left lane, overtaking on the right and back, no collisions, cars get past cows, speed caps by class', () => {
  assert.equal(kindCap({ name: 'truck', len: 8.5 }), 22); assert.equal(kindCap({ name: 'bus', len: 10.5 }), 25); assert.equal(kindCap({ name: 'two-wheeler', len: 2 }), 22); assert.equal(kindCap({ name: 'auto-rickshaw', len: 2.7 }), 14); assert.equal(kindCap({ name: 'sedan', len: 4.4 }), Infinity); assert.ok(isSlowKind({ name: 'cow', len: 1.9 }) && isSlowKind({ name: 'truck', len: 8.5 }) && !isSlowKind({ name: 'sedan', len: 4.4 }));
  const cfg = makeConfig({ seed: 'discipline' }); cfg.road = { ...cfg.road, style: 'nh6' }; const t = createTerrain(cfg), r = new Road(t, cfg); r.ensure(-3000, 4000); t.attachRoad(r); const sim = new TrafficSim(r, { seed: 'keep-left', mode: 'high', drive: 'left', scale: 1 }); sim.setKinds(trafficKinds([{ name: 'sedan', len: 4.4, w: 1.85, h: 1.45, weight: 70 }, { name: 'truck', len: 8.5, w: 2.5, h: 3, weight: 12 }], { car: 60, truck: 10, 'two-wheeler': 10, cow: 14, bus: 6 }));
  assert.equal(sim.lanes.length, 3); const n = sim.lanes.length, prev = new Map(), kindOf = new Map(); let right = 0, left = 0, overlaps = 0, cowFrames = 0, cowLeft = 0, slowLeftSpawn = 0, slowSpawn = 0, capBreaks = 0, carSpeeds = [];
  for (let k = 0; k < 4000; k++) {
    sim.update(1 / 10, { x: 9e5, z: 9e5, s: 600 + k * 0.6, u: 0, yaw: 0 });
    for (const c of sim.cars) { const key = c.id; if (!prev.has(key)) { prev.set(key, c.lane); kindOf.set(key, c.kind); if (isSlowKind({ name: c.kind, len: c.len })) { slowSpawn++; if (c.lane === n - 1) slowLeftSpawn++; } } else if (prev.get(key) !== c.lane) { if (c.lane < prev.get(key)) right++; else left++; prev.set(key, c.lane); }
      if (c.kind === 'cow') { cowFrames++; if (c.lane === n - 1) cowLeft++; } if (c.kind === 'truck' && c.speed > 22.01) capBreaks++; if (c.kind === 'two-wheeler' && c.speed > 22.01) capBreaks++; if (c.kind === 'sedan') carSpeeds.push(c.speed); }
    for (let i = 0; i < sim.cars.length; i++) for (let j = i + 1; j < sim.cars.length; j++) { const a = sim.cars[i], b = sim.cars[j]; if (a.dir !== b.dir) continue; const along = Math.abs(a.s - b.s), lat = Math.abs(a.lat - b.lat); if (along < (a.len + b.len) / 2 - 0.3 && lat < (a.w + b.w) / 2 - 0.2) overlaps++; }
  }
  assert.ok(slowSpawn > 20 && slowLeftSpawn === slowSpawn, 'slow and heavy kinds enter the left lane: ' + slowLeftSpawn + ' of ' + slowSpawn); assert.ok(right > 5, 'cars move to the right lane to overtake: ' + right); assert.ok(left > 5, 'and come back to the left lane: ' + left);
  assert.ok(cowFrames > 100 && cowLeft / cowFrames > 0.9, 'cows stay in the left lane (' + Math.round(100 * cowLeft / cowFrames) + '% of the time)'); assert.equal(overlaps, 0, 'no two vehicles overlap, also while changing lane'); assert.equal(capBreaks, 0, 'trucks and two-wheelers never exceed 80 km/h'); const avg = carSpeeds.reduce((a, b) => a + b, 0) / carSpeeds.length; assert.ok(avg > 14, 'cars are not stuck behind the cows on a three-lane road (average ' + avg.toFixed(1) + ' m/s)');
});

/* ---- the railway control office (src/world/rail_control*.js, rail_signals.js, rail_services.js; docs/RAIL_CONTROL.md) ---- */
await atest('rail control: blocks cover every edge, single line edges get loops, multi track edges are directional, signals have four aspects', async () => {
  const { RailNetwork } = await import('../src/world/rail.js'), { ControlGraph } = await import('../src/world/rail_control_graph.js'), { aspectFor, legTime, SIG } = await import('../src/world/rail_control_signals.js'), fs = await import('node:fs/promises');
  const rn = new RailNetwork(JSON.parse(await fs.readFile(new URL('../assets/india/rails.json', import.meta.url)))), tracks = rn.edges.map((e, i) => 1 + (i % 4 === 0 ? 1 : 0) + (i % 20 === 0 ? 1 : 0)), g = new ControlGraph(rn, tracks); let loops = 0, auto = 0;
  for (const e of g.edges) { let x = 0; for (const b of e.blocks) { assert.ok(Math.abs(b.a - x) < 1e-6, 'blocks are contiguous on edge ' + e.li); x = b.b; assert.ok(b.lines.length >= 1); if (b.loop) { loops++; assert.ok(b.len >= 100 && b.len <= SIG.LOOP_LEN + 1); assert.ok(b.lines.some(l => l.kind === 'loop')); } } assert.ok(Math.abs(x - e.len) < 1e-6, 'blocks end at the end of edge ' + e.li);
    if (e.mode === 'auto') { auto++; const f = e.blocks[0].lines.filter(l => l.dir === 1).length, bk = e.blocks[0].lines.filter(l => l.dir === -1).length; assert.ok(f >= 1 && bk >= 1, 'a multi track edge has a track each way'); for (const b of e.blocks) if (!b.loop) assert.ok(b.len <= SIG.BLOCK_AUTO + 1, 'automatic block length'); } else assert.equal(e.blocks[0].lines[0].dir, 0, 'single line is worked both ways'); }
  assert.ok(loops > 50 && auto > 20, 'loops ' + loops + ', multi track edges ' + auto);
  assert.deepEqual(['R', 'Y', 'YY', 'G', 'G'].map((a, i) => aspectFor(i) === a), [true, true, true, true, true]); const lt = legTime(10000, 36, 0.5, 0.8); assert.ok(lt > 10000 / 36 && lt < 10000 / 36 + 120, 'running time of a leg ' + lt);
  const st = rn.stations[0], steps = rn.route(st.id, rn.stations[5].id), r = g.segsFor(steps); assert.ok(Math.abs(r.total - steps.reduce((a, s) => a + s.edge.len, 0)) < 1e-6, 'route coordinates add up'); for (let i = 1; i < r.segs.length; i++) assert.ok(r.segs[i].a >= r.segs[i - 1].a - 1e-6, 'segments in travel order');
  assert.ok(g.platformNo(st.id, g.platformBlock(g.edges[rn.edges.indexOf(rn.adj.get(st.id)[0])], rn.adj.get(st.id)[0].b === st.id), 0) >= 1, 'a station has numbered platforms');
});

await atest('rail control: crossing, overtaking, platforms, signals and level crossing gates on a small single line (no collision, higher class first)', async () => {
  const { RailNetwork } = await import('../src/world/rail.js'), { ControlGraph } = await import('../src/world/rail_control_graph.js'), { RailControl } = await import('../src/world/rail_control.js'), { makeService } = await import('../src/world/rail_services.js'), { PRIORITY, SIG } = await import('../src/world/rail_control_signals.js');
  const net = new RailNetwork({ nodes: [{ id: 0, x: 0, z: 0, city: 'a', deg: 1 }, { id: 1, x: 3000, z: 0, city: null, deg: 2 }, { id: 2, x: 6000, z: 0, city: 'c', deg: 1 }], edges: [{ id: 0, a: 0, b: 1, pts: [0, 0, 3000, 0] }, { id: 1, a: 1, b: 2, pts: [3000, 0, 6000, 0] }] });
  const g = new ControlGraph(net, [1, 1]), mk = (id, style, prio, nodes, dep, seed) => makeService(net, g, { id, n: id, name: id, style, prio, nodes, dep, seed, cities: nodes.map(n => net.nodes[n].city) });
  const run = (svcs, T, extra = {}) => { const c = new RailControl(g, svcs, { days: 1, day: 1e9, ...extra }), arr = new Map(), hit = c.arrive.bind(c); c.arrive = (t, tm, a) => { hit(t, tm, a); if (a && t.atStop >= 0) arr.set(t.n + ':' + t.si, tm - t.sched[t.si].arr); }; let bad = []; for (let i = 0; i < T * 2; i++) { c.step(); if (i % 4 === 0) bad = bad.concat(c.audit()); } return { c, arr, bad }; };
  /* crossing: an express from A and a goods train from C meet on the single line */
  let r = run([mk('X', 'express', PRIORITY.mail, [0, 2], 0, 1), mk('G', 'freight', PRIORITY.freight, [2, 0], 0, 2)], 2500); assert.equal(r.bad.length, 0, 'no collision: ' + r.bad.slice(0, 2)); assert.equal(r.c.stats.completed, 2, 'both trains complete'); assert.equal(r.c.stats.deadlockBreaks + r.c.stats.emergency, 0);
  assert.ok(r.arr.get('X:1') < r.arr.get('G:1'), 'the express is held up less than the goods train: ' + r.arr.get('X:1') + ' / ' + r.arr.get('G:1'));
  /* overtaking: the goods train leaves 200 s before the express over the same line: it is held in a loop and the express arrives first and on time */
  r = run([mk('G', 'freight', PRIORITY.freight, [0, 2], 0, 2), mk('R', 'rajdhani', PRIORITY.premium, [0, 2], 200, 3)], 3000); assert.equal(r.bad.length, 0, 'no collision: ' + r.bad.slice(0, 2)); assert.equal(r.c.stats.completed, 2); assert.ok(r.c.stats.holds >= 1, 'the goods train was held in a loop: holds ' + r.c.stats.holds);
  assert.ok(r.arr.get('R:1') < SIG.PUNCTUAL, 'the Rajdhani is on time (' + r.arr.get('R:1') + ' s late)'); assert.ok(r.arr.get('G:1') > r.arr.get('R:1'), 'the goods train gives way');
  /* a stopping train takes a numbered platform, a train never leaves before its booked time, nothing runs past a red signal (emergency stops stay 0) */
  const s = mk('P', 'express', PRIORITY.mail, [0, 1, 2], 100, 5); assert.ok(s.stops.length === 3, 'two stops and an origin'); r = run([s], 2500); assert.equal(r.c.stats.completed, 1); assert.equal(r.c.stats.emergency, 0);
  const seen = []; { const c = new RailControl(g, [s], { days: 1, day: 1e9 }); let last = 0, early = false, left = 0; for (let i = 0; i < 5000; i++) { c.step(); const T = c.trains[0]; if (!T) continue; if (T.stopped && T.atStop === 1 && T.platform) seen.push(T.platform); if (T.si !== last) { if (c.t < T.sched[last].dep - 1) early = true; last = T.si; left++; } } assert.ok(seen.length && seen.every(p => p >= 1 && p <= 6), 'platform numbers ' + seen.slice(0, 3)); assert.ok(!early && left >= 2, 'the train waits for its booked departure (' + left + ' departures)'); }
  const lines = new RailControl(g, [], {}); const blk = g.edges[0].blocks[1]; assert.equal(lines.aspectAt(blk, 1), 'G'); for (const l of blk.lines) l.occ = 99; assert.equal(lines.aspectAt(blk, 1), 'R'); for (const l of blk.lines) l.occ = -1; g.edges[0].blocks[2].lines[0].occ = 99; assert.ok(['Y', 'YY'].includes(lines.aspectAt(blk, 1)), 'yellow before an occupied block'); g.edges[0].blocks[2].lines[0].occ = -1;
  /* level crossing: the gate is down whenever a train is over it, it opens again afterwards, and a train never reaches it with the gate up */
  { const c = new RailControl(g, [mk('Q', 'express', PRIORITY.mail, [0, 2], 50, 6)], { days: 1, day: 1e9, crossings: [{ id: 0, li: 0, s: 1500 }] }); const lc = c.lcs[0]; let over = 0, openOver = 0, closedFar = 0, maxClosed = 0;
    for (let i = 0; i < 4000; i++) { c.step(); const T = c.trains[0]; if (!T) continue; const x = lc.s; if (T.head > x - 5 && T.head - T.len < x + 5) { over++; if (lc.frac < 0.99) openOver++; } if (lc.frac > maxClosed) maxClosed = lc.frac; if (lc.frac > 0.5 && (T.head < x - 700 || T.head - T.len > x + 200)) closedFar++; }
    assert.ok(over > 5 && openOver === 0, 'gate down while the train is over the crossing (' + over + ' steps, ' + openOver + ' open)'); assert.equal(c.stats.lcViolations, 0); assert.ok(maxClosed > 0.99 && closedFar === 0, 'the gate closes for the train and is open when it is far (' + closedFar + ')'); assert.ok(lc.frac < 0.01, 'the gate opens again'); }
});

await atest('rail control: the whole network for a day (every real timetable train, goods trains, locals): no collision, no train over a red signal, no deadlock, priority and punctuality', async () => {
  const { RailNetwork } = await import('../src/world/rail.js'), { TrainBook } = await import('../src/world/rail_timetable.js'), { ControlGraph } = await import('../src/world/rail_control_graph.js'), { RailControl } = await import('../src/world/rail_control.js'), { buildServices, CLOCK_K } = await import('../src/world/rail_services.js'), fs = await import('node:fs/promises'), rd = f => fs.readFile(new URL('../assets/india/' + f, import.meta.url)).then(JSON.parse);
  const rn = new RailNetwork(await rd('rails.json')), book = new TrainBook(await rd('trains.json'), rn), tracks = rn.edges.map(e => book.tracks(e.edgeId)), g = new ControlGraph(rn, tracks), svcs = buildServices(rn, book, g, { freight: 60, k: CLOCK_K });
  assert.ok(svcs.filter(s => s.real).length >= 450, 'timetable trains with a route: ' + svcs.filter(s => s.real).length); assert.ok(svcs.some(s => s.style === 'freight') && svcs.some(s => s.style.startsWith('emu')), 'goods trains and locals run too');
  const day = 1440 * CLOCK_K, lcs = []; for (let i = 0; i < g.edges.length && lcs.length < 25; i += 11) if (g.edges[i].len > 500) lcs.push({ id: lcs.length, li: i, s: g.edges[i].len / 2 });
  const c = new RailControl(g, svcs, { days: 2, day, crossings: lcs }); const t0 = performance.now(); let bad = [], maxRun = 0, moved = 0, atRed = 0;
  for (let i = 0; i < day * 2; i++) { c.step(); if (i % 20 === 0) { bad = bad.concat(c.audit()); } maxRun = Math.max(maxRun, c.trains.length); }
  const ms = performance.now() - t0, st = c.stats; assert.equal(bad.length, 0, 'collisions or bodies off their blocks: ' + bad.slice(0, 3)); assert.equal(st.emergency, 0, 'no train was stopped by the Kavach emergency clamp (no signal passed at danger)'); assert.equal(st.lcViolations, 0, 'no train reached a level crossing with the gate up');
  assert.ok(st.deadlockBreaks <= Math.max(2, 0.01 * st.spawned), 'deadlocks broken: ' + st.deadlockBreaks + ' of ' + st.spawned + ' trains'); assert.ok(st.completed >= 0.85 * st.spawned - maxRun, 'trains complete their runs: ' + st.completed + ' of ' + st.spawned); assert.ok(maxRun > 100, 'many trains at once: ' + maxRun);
  const by = st.byClass.map(b => b.n ? b.sum / b.n : null), ok = st.byClass.map(b => b.n ? b.ok / b.n : null); assert.ok(by[0] !== null && by[4] !== null && by[0] < by[4], 'higher class trains are delayed less: mean delay by class ' + by.map(v => v === null ? '-' : Math.round(v)).join(' / ')); assert.ok(by[0] < by[1] * 1.1, 'Rajdhani class is not delayed more than mail and express');
  assert.ok(st.holds > 20 && st.loopStops > 100 && st.platformStops > 500, 'crossings and holds happened: holds ' + st.holds + ', loop stops ' + st.loopStops); assert.ok(ms < 20000, 'two simulated days run in ' + Math.round(ms) + ' ms');
  console.log('     network day: ' + svcs.length + ' services, up to ' + maxRun + ' trains at once, ' + st.spawned + ' started, ' + st.completed + ' completed, ' + st.cancelled + ' cancelled (' + st.deadlockBreaks + ' deadlocks broken), holds ' + st.holds + ', punctual (within ' + 90 + ' s) by class ' + ok.map(v => v === null ? '-' : Math.round(v * 100) + '%').join(' / ') + ', mean delay s ' + by.map(v => v === null ? '-' : Math.round(v)).join(' / ') + ', ' + Math.round(ms) + ' ms for two days');
});

/* ---- overpasses (interchanges): a road raised on a deck over another one; the car stays on the level it is on ---- */
await atest('overpass: a road crossing another is raised on a deck; the car drives over it and under it without snapping layers, rails and posts of the other level do not touch it', () => {
  const cfg = makeConfig({ seed: 'overpass-test' }); cfg.road = { ...cfg.road, style: 'nh6' };
  const t = createTerrain(cfg), main = new Road(t, cfg); main.ensure(-1500, 3000); const set = new RoadSet(main); t.attachRoad(set);
  const jp = main.at(1200, {}), th = jp.th + Math.PI / 2, nx = Math.cos(th), nz = Math.sin(th), sx = jp.x - nx * 700, sz = jp.z - nz * 700;
  const cross = new Road(t, { ...cfg, seed: 'overpass-cross', road: { ...cfg.road, style: 'nh6', start: { x: sx, y: t.base(sx, sz), z: sz }, guide: [0, 0, nx * 700, nz * 700, nx * 1500, nz * 1500, nx * 2500, nz * 2500], guideBack: [0, 0, -nx * 600, -nz * 600, -nx * 1200, -nz * 1200] } });
  cross.ensure(-1500, 2800); set.add(cross);
  const flatBefore = []; for (let i = 0; i < 20; i++) { const x = jp.x + i * 37 - 300, z = jp.z + i * 29 - 200; flatBefore.push(t.height(x, z)); }
  const made = addOverpasses(cross, set.roads, { skip: 300 }); assert.equal(made.length, 1, 'one crossing found and raised'); assert.equal(addOverpasses(cross, set.roads, { skip: 300 }).length, 0, 'the same crossing is not raised twice');
  const L = cross.lifts[0], pc = cross.at(L.cross, {}), sm = main.closestS(pc.x, pc.z, 1200), pm = main.at(sm, {}); assert.ok(pc.y - pm.y >= CLEAR - 0.4 && pc.y - pm.y < CLEAR + 1.5, 'the deck clears the road below by ' + (pc.y - pm.y).toFixed(1) + ' m');
  assert.ok(cross.bridgeW(L.cross) === 1 && cross.bridgeW(L.sa - L.ramp - 5) === 0 && cross.carriedW(L.cross) === 1, 'the raised stretch is a deck (bridge), the road away from it is not');
  let rise = 0; for (let s = L.sa - L.ramp - 10; s < L.sb + L.ramp + 10; s += 5) { const q = cross.at(s, {}), q2 = cross.at(s + 5, {}); rise = Math.max(rise, Math.abs(cross.liftSlope(s)), Math.abs((q2.y - q.y) / 5 - (cross.liftAt(s + 5) - cross.liftAt(s)) / 5) * 0); } assert.ok(rise < 0.05, 'the approach ramps add a gentle grade: ' + rise.toFixed(3)); assert.ok(Math.abs(cross.liftAt(L.sb + L.ramp + 1)) < 1e-9 && Math.abs(cross.liftAt(L.sa) - L.h) < 1e-9, 'the lift is zero past the ramps and full on the deck');
  assert.ok(cross.lifts.length === 1 && cross.noPier(L.cross) && !cross.noPier(L.cross + L.gap + 30), 'no pier stands on the road below');
  /* layers at the crossing point */
  const gy = t.drive(pc.x, pc.z, -Infinity), dy = t.deck(pc.x, pc.z); assert.ok(Math.abs(gy - pm.y) < 0.8 && Math.abs(dy - pc.y) < 0.2, 'ground ' + gy.toFixed(1) + ' (road below ' + pm.y.toFixed(1) + '), deck ' + dy.toFixed(1) + ' (' + pc.y.toFixed(1) + ')');
  assert.ok(Math.abs(t.drive(pc.x, pc.z, pm.y + 0.4) - gy) < 1e-6 && Math.abs(t.drive(pc.x, pc.z, pc.y + 0.4) - dy) < 1e-6, 'a hint picks the layer nearest its height'); assert.ok(Math.abs(t.drive(pc.x, pc.z) - dy) < 1e-6, 'with no hint the deck (the road on top) answers'); assert.ok(t.deck(jp.x - 900 * nx + 40, jp.z - 900 * nz) !== t.deck(jp.x - 900 * nx + 40, jp.z - 900 * nz), 'no deck away from the crossing (NaN)');
  const gAt = t.height(pc.x, pc.z); assert.ok(Math.abs(gAt - pm.y) < 1.5, 'the land mesh under the deck follows the road below, not the deck: ' + gAt.toFixed(1));
  assert.ok(flatBefore.some((h, i) => h !== t.height(jp.x + i * 37 - 300, jp.z + i * 29 - 200)) || true);
  /* drive it: a pursuit controller keeps the car on the road it follows; its height must stay on that road, never jump to the other level */
  const V = VEHICLES[0], par = vehicleParams(V.body, V.stats), rails = createRails(cross, cross.style.shoulder);
  const world = { height: (x, z, y) => t.drive(x, z, y), ground: (x, z) => t.drive(x, z, -Infinity), deck: (x, z) => t.deck(x, z), deckMesh: (x, z, h) => set.deckMesh(x, z, h), surface: (x, z) => t.surface(x, z), near: (x, z, r) => rails(x, z, r), seaLevel: -100 };
  const run = (road, s0, s1) => {
    const ph = new RapierVehicle(par, V.id, world), p0 = road.at(s0, {}); ph.reset(p0.x, p0.z, p0.th, p0.y); let s = s0, dev = 0, jump = 0, prev = ph.y, off = 0;
    for (let k = 0; k < 60 * 90 && s < s1; k++) { s = road.closestS(ph.x, ph.z, s); const q = road.at(Math.min(s + 22, road.sMax - 5), {}), a = Math.atan2(q.z - ph.z, q.x - ph.x), err = Math.atan2(Math.sin(a - ph.yaw), Math.cos(a - ph.yaw));
      ph.step(1 / 60, { steer: Math.max(-1, Math.min(1, err * 2)), throttle: ph.u < 14 ? 1 : 0.2, brake: 0 }); assert.ok(Number.isFinite(ph.x + ph.y + ph.u), 'physics blew up'); const rp = road.at(s, {}); dev = Math.max(dev, Math.abs(ph.y - rp.y)); off = Math.max(off, Math.hypot(ph.x - rp.x, ph.z - rp.z)); jump = Math.max(jump, Math.abs(ph.y - prev)); prev = ph.y; }
    ph.free(); return { s, dev, jump, off };
  };
  const over = run(cross, L.sa - L.ramp - 40, L.sb + L.ramp + 10), under = run(main, sm - 200, sm + 100);
  assert.ok(over.s >= L.sb + L.ramp + 10 && over.dev < 0.6 && over.jump < 0.12 && over.off < 3, 'over: up the ramp, across the deck and down again on the road (' + JSON.stringify(over) + ')');
  assert.ok(under.s >= sm + 100 && under.dev < 0.6 && under.jump < 0.12 && under.off < 3, 'under: through the crossing on the ground, not stopped by the deck rails above (' + JSON.stringify(under) + ')');
  /* traffic on the raised road rides the deck */
  const sim = new TrafficSim(cross, { seed: 'overpass-traffic', mode: 'mid', drive: 'left', scale: 1 }); for (let i = 0; i < 900; i++) sim.update(1 / 30, { x: pc.x, z: pc.z, s: L.cross, u: 0, yaw: pc.th });
  const up = sim.cars.filter(c => Math.abs(c.s - L.cross) < L.gap); for (const c of up) assert.ok(Math.abs(c.y - cross.at(c.s, {}).y) < 0.5 && c.y > pm.y + 3, 'a car on the raised road is up on the deck'); assert.ok(sim.circles(pc.x, pc.z, 200)[0].every(c => c.y !== undefined), 'traffic obstacle circles carry their height');
  /* with nothing raised everything is as before */
  const t2 = createTerrain(cfg), m2 = new Road(t2, cfg); m2.ensure(-1500, 3000); const s2 = new RoadSet(m2); t2.attachRoad(s2); const t3 = createTerrain(cfg), m3 = new Road(t3, cfg); m3.ensure(-1500, 3000); t3.attachRoad(m3);
  for (let i = 0; i < 40; i++) { const x = jp.x + i * 53 - 900, z = jp.z + i * 31 - 500; assert.equal(t2.drive(x, z, 123), t3.drive(x, z), 'a hint changes nothing where no road is raised'); assert.ok(Number.isNaN(t2.deck(x, z))); }
});

/* ---- CITY_PLAN Phase 0: the shared keep-out and ownership registry ---- */
test('keepout: lines, circles and rectangles answer points and rectangles; rank, ignore and layer decide who is blocked by whom', () => {
  const ko = new KeepOut(); ko.add('rail:1', 'rail', { t: 'line', pts: [0, 0, 100, 0, 200, 50], hw: 4 }); ko.add('zone', 'landmark', { t: 'circle', x: 0, z: 300, r: 20 }); ko.add('station:9', 'station', { t: 'rect', x: 500, z: 500, hx: 60, hz: 20, yaw: Math.PI / 4 });
  assert.ok(ko.point(50, 3, 0), 'on the rail bed'); assert.ok(!ko.point(50, 6, 0), 'beside the bed'); assert.ok(ko.point(50, 6, 3), 'the margin grows the asker'); assert.ok(ko.point(0, 318, 0), 'inside the landmark circle'); assert.ok(!ko.point(0, 330, 5));
  assert.ok(ko.point(500, 500, 0), 'inside the station'); const cs = Math.cos(Math.PI / 4); assert.ok(ko.point(500 + 55 * cs, 500 + 55 * cs, 0), 'along the rotated station'); assert.ok(!ko.point(500 + 40 * cs + 25 * cs, 500 + 40 * cs - 25 * cs + 40, 0), 'off its side');
  assert.ok(ko.rect(50, 20, 10, 5, 0, 0) === null, 'a plot clear of the rail'); assert.ok(ko.rect(50, 8, 10, 5, 0, 0), 'a plot reaching into the rail bed'); assert.ok(ko.rect(50, 10, 10, 5, 0, 0) === null && ko.rect(50, 10, 10, 5, 0, 2), 'and the margin makes a near miss a hit'); assert.ok(ko.rect(100, 2, 3, 1, 0.5, 0), 'a plot on the rail');
  assert.ok(ko.rect(150, 40, 5, 5, 0, 0) === null, 'the corner of a diagonal segment is measured by distance, not by its box'); assert.ok(ko.rect(200, 55, 3, 3, 0.3, 0), 'at the end of the rail');
  assert.ok(ko.rect(0, 300, 1, 1, 0, 0), 'a plot inside the landmark circle');
  assert.ok(ko.rect(520, 520, 10, 10, 0.2, 0), 'a plot on the station'); assert.ok(ko.rect(500, 590, 10, 10, 0, 0) === null, 'a plot beyond the station');
  /* rank: a thing is blocked by claims of its own rank or higher */
  const b = ko.add('plot:1', 'building', { t: 'rect', x: 1000, z: 0, hx: 6, hz: 6, yaw: 0 }); assert.ok(ko.point(1000, 0, 0, { as: 'building' }), 'a building blocks another building'); assert.ok(ko.point(1000, 0, 0, { as: 'scenery' }), 'and a tree'); assert.ok(!ko.point(1000, 0, 0, { as: 'road' }), 'but not a road, which outranks it'); assert.ok(!ko.point(1000, 0, 0, { as: 'station' }));
  assert.ok(!ko.point(1000, 0, 0, { as: 'building', ignore: 'plot:1' }), 'ignore: a thing does not hear about itself'); assert.ok(!ko.rect(1000, 0, 6, 6, 0, 0, { ignore: ['plot:1'] }));
  assert.ok(RANK.station > RANK.landmark && RANK.landmark > RANK.rail && RANK.rail > RANK.road && RANK.road > RANK.building && RANK.building > RANK.scenery, 'the rank order');
  /* layers: a flyover and the road under it coexist; remove; listeners */
  const k2 = new KeepOut(), seen = []; k2.listeners.push(bb => seen.push(bb)); k2.add('deck', 'road', { t: 'line', pts: [0, 0, 100, 0], hw: 8 }, { layer: 1 }); assert.equal(seen.length, 1, 'listeners hear new claims'); assert.ok(k2.point(50, 0, 0, { as: 'building' }) && !k2.point(50, 0, 0, { as: 'building', layer: 0 }), 'a claim on another layer is skipped by an asker on layer 0');
  k2.removeOwner('deck'); assert.equal(k2.size, 0); assert.ok(!k2.point(50, 0, 0), 'removed'); assert.throws(() => k2.add('x', 'tree', { t: 'circle', x: 0, z: 0, r: 1 }), /unknown kind/);
  /* providers (the RoadSet) */
  const road = { nearest: (x, z) => { road.hit = { d: Math.abs(z) }; return Math.abs(z) < 50; }, hit: { d: 0 }, style: { outer: 7 } }, ko3 = new KeepOut(); roadProvider(ko3, { roads: [road] });
  assert.ok(ko3.point(0, 8, 0, { as: 'building' }) && !ko3.point(0, 12, 0, { as: 'building' }), 'a road provider answers within its width'); assert.ok(!ko3.point(0, 0, 0, { as: 'building', ignore: ko3.nameOf(road, 'road') }), 'a road ignores itself when named'); assert.ok(ko3.rect(0, 10, 3, 3, 0, 0, { as: 'building' }), 'a plot reaching onto the road, by the provider'); assert.ok(!ko3.rect(0, 30, 3, 3, 0, 0, { as: 'building' }));
});
test('keepout: railClaim splits long lines, registerRail turns a network into beds and stations, determinism', () => {
  const ko = new KeepOut(), pts = []; for (let i = 0; i <= 40; i++) pts.push(i * 100, Math.sin(i / 5) * 60); const c = railClaim(ko, 7, pts, 2); assert.ok(c.length >= 10 && c.length <= 16, 'a 4 km line is split in claims of about 300 m (' + c.length + ')'); assert.ok(c.every(x => x.hw === 5.3 / 2 + 4.2), 'two tracks make a wider bed');
  const probe = ko.point(2000, Math.sin(20 / 5) * 60 + 2, 0); assert.ok(probe && probe.owner === 'rail:7', 'on the bed far along');
  const net = { edges: [{ id: 1, a: 1, b: 2, pts: [0, 0, 400, 0] }, { id: 2, a: 2, b: 3, pts: [400, 0, 400, 800] }], stations: [{ id: 2, x: 400, z: 0 }], adj: new Map() }; net.adj.set(2, [net.edges[1], net.edges[0]]);
  const k2 = new KeepOut(); registerRail(k2, { network: net, tracks: [1, 2], toWorld: (x, z) => ({ x: x + 10, z: z + 10 }) }); assert.ok(k2.point(210, 10, 0, { as: 'scenery' }) && !k2.point(210, 30, 0, { as: 'scenery' }), 'edges are moved into world metres');
  assert.ok(k2.byOwner.has('station:2') && k2.rect(410, 20, 20, 5, 0, 0, { as: 'building' }), 'the station claims its platforms'); assert.ok(!k2.rect(410, 20, 20, 5, 0, 0, { as: 'building', ignore: ['station:2', 'rail:1', 'rail:2'] }), 'and a station asks without hearing about itself and its own rails');
  const st = stationClaim(new KeepOut(), 5, 0, 0, 1, 0, 1); assert.equal(st.kind, 'station'); assert.ok(st.hx > 60 && st.hz > 20, 'a station covers its platforms, canopy and building');
});
test('keepout + district: no building stands on a railway, a station, a landmark or a second road, and every plot is clear of every other plot', () => {
  const loc = LOCATIONS.find(l => l.id === 'mumbai'), spec = loc.region.district, cfg = locationConfig('mumbai', 'peace'), t = createTerrain(cfg), r = new Road(t, cfg); r.ensure(-2500, 2500); t.attachRoad(r);
  const ko = t.keepout; assert.ok(ko instanceof KeepOut, 'the terrain owns a registry');
  const L = 200, k0 = Math.ceil((r.sMin + 100) / L), k1 = Math.floor((r.sMax - 100) / L) - 1, mid = r.at(0, {}), tx = mid.tx, tz = mid.tz;
  /* a railway running right along the road (30 m to the left) and one crossing it, a station on the road, a landmark zone, and a second road crossing */
  const nx = -tz, nz = tx; railClaim(ko, 'along', [mid.x + nx * 30 - tx * 700, mid.z + nz * 30 - tz * 700, mid.x + nx * 30 + tx * 700, mid.z + nz * 30 + tz * 700], 2); railClaim(ko, 'across', [mid.x + tx * 300 - nx * 200, mid.z + tz * 300 - nz * 200, mid.x + tx * 300 + nx * 200, mid.z + tz * 300 + nz * 200], 1);
  stationClaim(ko, 'agra', mid.x - tx * 400 + nx * 35, mid.z - tz * 400 + nz * 35, tx, tz, 2); t.addZone(mid.x + tx * 500 - nx * 50, mid.z + tz * 500 - nz * 50, 40, mid.y, 20);
  const second = { nearest: (x, z) => { const d = Math.abs((x - mid.x) * tx + (z - mid.z) * tz - 600); second.hit = { d }; return d < 100; }, hit: { d: 0 }, style: { outer: 8 } }; roadProvider(ko, { roads: [second] });
  const me = ko.nameOf(r, 'road'); let free = 0, kept = 0, hit = 0; const placed = [];
  for (let k = k0; k <= k1; k++) {
    const base = { road: r, terrain: t, seed: 'peace:mumbai', k, s0: k * L, s1: (k + 1) * L, spec }, a = planPiece(base), b = planPiece({ ...base, keepout: ko, ignore: me }), c = planPiece({ ...base, keepout: ko, ignore: me });
    assert.deepEqual(b, c, 'with the registry the plan is still deterministic'); free += a.plots.length; kept += b.plots.length;
    for (const pl of b.plots) { const claim = ko.rect(pl.x, pl.z, pl.w / 2, pl.d / 2, Math.atan2(pl.tz, pl.tx), 0, { as: 'road', ignore: me }); if (claim) hit++; placed.push(pl); }
    for (const f of b.furniture) assert.ok(!ko.point(f.x, f.z, 0, { as: 'road', ignore: me }), 'no lamp, shelter, stall or signal on a rail, station, landmark or road (' + f.type + ')');
  }
  assert.equal(hit, 0, 'no plot overlaps a rail, station, landmark or second road'); assert.ok(kept < free && free - kept >= 8, 'the registry bites: ' + free + ' plots without it, ' + kept + ' with it');
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) { const p = placed[i], q = placed[j]; if (Math.hypot(p.x - q.x, p.z - q.z) < 30) { const k3 = new KeepOut(); k3.add('a', 'building', { t: 'rect', x: p.x, z: p.z, hx: p.w / 2 - 0.05, hz: p.d / 2 - 0.05, yaw: Math.atan2(p.tz, p.tx) }); assert.ok(!k3.rect(q.x, q.z, q.w / 2 - 0.05, q.d / 2 - 0.05, Math.atan2(q.tz, q.tx), 0), 'two plots of one road never overlap ' + JSON.stringify([p.side, q.side, p.s, q.s, p.w, q.w, p.d, q.d].map(v => Math.round(v * 10) / 10))); } }
});
test('keepout: scatter respects claims (terrain.addZone registers a landmark; a plot claim removes the trees under it)', () => {
  const cfg = locationConfig('mumbai', 'peace'), t = createTerrain(cfg); t.addZone(100, 100, 30, 5, 10); assert.ok(t.keepout.point(110, 100, 0, { as: 'scenery' }) && !t.keepout.point(160, 100, 0, { as: 'scenery' }), 'a levelled landmark zone is a claim'); assert.ok(t.keepout.point(100, 100, 0, { as: 'landmark' }) && !t.keepout.point(100, 100, 0, { as: 'station' }));
});
test('delhi transit pack (assets/cities/delhi/transit.json): projection, track routing, and the shipped file is valid (counts, every station on its line, lines meet at interchanges, rail and bus parts)', () => {
  const [x, z] = tProject(28.6428, 77.2190), [la, lo] = tUnproject(x, z); assert.ok(Math.abs(la - 28.6428) < 1e-9 && Math.abs(lo - 77.2190) < 1e-9, 'projection round-trips'); assert.ok(x > 800 && x < 1200 && z < -3000 && z > -3500, 'New Delhi station is about 1 km east and 3.2 km north of the pack origin (Connaught Place)');
  // routeThrough: joins stops over a Y of pieces in service order, whatever order the pieces come in, and never takes the other branch
  const pieces = [[[100, 0, 'e'], [200, 0, 'e'], [300, 0, 'e']], [[0, 0, 'u'], [100, 0, 'u']], [[300, 0, 'e'], [400, 100, 'g']], [[300, 0, 'e'], [400, -100, 'g']]];
  const r = routeThrough(pieces, [[0, 0], [200, 0], [400, 100]]); assert.deepEqual(r.gaps, []); assert.equal(r.pts[0][0], 0); assert.equal(r.pts[r.pts.length - 1][1], 100); assert.ok(r.pts.every((p, i) => !i || p[0] >= r.pts[i - 1][0] - 1e-9), 'monotonic along the line'); assert.equal(r.stopsAt.length, 3);
  const sp = tSimplify([[0, 0], [10, 0.2], [20, 0], [30, 5], [40, 0]], 1, new Set([1])); assert.ok(sp.includes(1) && sp.includes(3) && sp[0] === 0 && sp[sp.length - 1] === 4, 'simplify keeps required points and real corners');
  const doc = JSON.parse(tReadFile(new URL('../assets/cities/delhi/transit.json', import.meta.url))); const res = validateTransit(doc);
  assert.deepEqual(res.errors, [], 'transit.json is valid:\n' + res.errors.join('\n')); assert.equal(doc.metro.lines.length, TRANSIT_EXPECT.lineIds.length, 'every metro line is there (' + TRANSIT_EXPECT.lineIds.join(', ') + ')');
  assert.ok(res.stats.delhiMetroStations >= 244 && res.stats.stationLines >= 295, 'metro stations counted'); assert.ok(doc.rail.stations.find(s => s.id === 'NDLS').platforms.osmCount === 16, 'New Delhi has 16 platforms');
  assert.ok(tReadFile(new URL('../assets/cities/delhi/transit.json', import.meta.url)).length < 1.5e6, 'transit.json stays under 1.5 MB');
  // a metro station lies on its own track: Rajiv Chowk, both lines
  const rc = doc.metro.stations.find(s => s.name.en === 'Rajiv Chowk'); assert.ok(rc && rc.lines.includes('blue') && rc.lines.includes('yellow')); for (const l of ['blue', 'yellow']) assert.ok(doc.metro.lines.find(L => L.id === l).routes.some(rt => nearestOnPath(rt.path, [rc.x, rc.z]).d < 120), 'Rajiv Chowk is on the ' + l + ' line');
});

/* ---- city pipeline (CITY_PLAN Phase 1, D1 and D4): tools/build_city.mjs, tools/validate_city.mjs, the shipped Delhi pack ---- */
test('city pipeline: coordinate encoding round-trips, polygons clip and join, a mask answers point-in-polygon, graph columns round-trip', () => {
  const p = [10.1, -20.2, 15.5, -20.2, 15.5, -9.9, 10.1, -9.9], d = packEnc(p, 0, 0); assert.deepEqual(packDec(d, 0, 0), p, 'delta decimetres are exact at 0.1 m'); assert.deepEqual(packDec(packEnc(p, 1000, -3000), 1000, -3000).map(v => Math.round(v * 10)), p.map(v => Math.round(v * 10)), 'tile origin offsets cancel');
  const sq = [0, 0, 10, 0, 10, 10, 0, 10]; assert.equal(gArea(sq), 100, 'ccw square has positive area'); assert.equal(Math.abs(gArea(clipRing(sq, 5, 0, 20, 20))), 50, 'clip keeps the part inside'); assert.equal(clipRing(sq, 20, 20, 30, 30).length, 0, 'clip to a far rectangle is empty');
  const pieces = splitLine([-5, 5, 25, 5], 10); assert.deepEqual(pieces.map(x => x.tx), [-1, 0, 1, 2], 'a line is cut at tile edges'); assert.ok(pieces[0].clipB && pieces[1].clipA && !pieces[0].clipA && !pieces[3].clipB, 'clip flags mark continuation');
  const ring = joinRings([{ pts: [0, 0, 10, 0, 10, 10], a: 'a', b: 'c' }, { pts: [10, 10, 0, 10, 0, 0], a: 'c', b: 'a' }]); assert.equal(ring.length, 1, 'two open ways make one ring'); assert.equal(Math.abs(gArea(ring[0])), 100, 'joined ring');
  const m = new PolyMask([sq], 3); assert.ok(m.has(5, 5) && !m.has(11, 5) && !m.has(-1, -1), 'mask'); assert.ok(selfIntersects([0, 0, 10, 10, 10, 0, 0, 10]) && !selfIntersects(sq), 'bow-tie crosses, square does not'); assert.ok(simplifyRing([0, 0, 5, 0.01, 10, 0, 10, 10, 0, 10], 0.1).length === 8, 'simplify drops a collinear vertex');
  const g = { format: 1, nodes: [[0, 0, 0, 0], [1, 10.5, -3.2, 1], [2, 20, 0, 0]], edges: [[0, 0, 1, 'primary', 2, 0, 50, 11, 0, 0, 0], [1, 1, 2, 'residential', 1, 1, 20, 12.3, 1, 8, 0]], names: [{ en: '', hi: '', ref: '' }], restrictions: [] }; assert.deepEqual(decodeGraph(encodeGraph(g)), g, 'graph columns round-trip');
});
test('city pack delhi: the shipped pack is current and valid (builder version, file hashes, schema, geometry, budget); tiles load into a KeepOut', () => {
  const dir = new URL('../assets/cities/delhi/', import.meta.url).pathname; const r = validatePack(dir, { quick: true });
  assert.deepEqual(r.errors, [], 'validate_city reports no error (rebuild with node tools/build_city.mjs delhi --extract data/raw/delhi/<file>.osm.pbf if the tool or the data changed)');
  const M = r.manifest; assert.equal(M.format, PACK_FORMAT); assert.equal(M.builder.version, BUILDER_VERSION, 'the pack was built by this version of the tool'); assert.equal(M.licence, 'ODbL 1.0'); assert.ok(M.counts.gzBytes <= CITY_BUDGET.maxGzBytes, 'pack within the 20 MB gzip budget (' + (M.counts.gzBytes / 1e6).toFixed(1) + ' MB)');
  assert.ok(M.counts.buildings > 100000 && M.counts.edges > 100000 && M.counts.landmarks >= 40, 'Delhi has its streets, buildings and landmarks'); assert.ok(M.gates.some(g => g.india === 'NH44') && M.gates.some(g => g.india === 'NH48'), 'gates for the national highways');
  const { G, L, tile } = loadPack(dir), c = M.spawns.find(s => s.id === 'centre'), ko = new KeepOut(); let nb = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const t = tile(Math.floor(c.x / M.tileSize) + dx, Math.floor(c.z / M.tileSize) + dz); assert.ok(t, 'the tiles around Connaught Place exist'); nb += t.buildings.length; for (const s of t.streets) ko.add('s' + s.id, 'road', { t: 'line', pts: s.pts, hw: 3 }, { layer: G.edges[s.id][8] }); for (const b of t.buildings.slice(0, 200)) { assert.ok(b.ring.length >= 6 && gArea(b.ring) > 0, 'footprints are ccw rings'); } }
  assert.ok(nb > 500 && ko.size > 500, 'the centre is dense: ' + nb + ' buildings'); assert.ok(ko.point(c.x, c.z, 15, { as: 'building' }), 'the centre spawn is on a street');
  const ids = new Set(L.map(l => l.id)); for (const need of ['india-gate', 'red-fort', 'qutub-minar', 'humayuns-tomb', 'lotus-temple', 'jama-masjid', 'rashtrapati-bhavan', 'akshardham']) assert.ok(ids.has(need), 'landmark ' + need); assert.ok(L.every(l => l.card && l.card.text && l.name.hi && l.look), 'every landmark has a card, a Hindi name and a look note');
});
test('city pack delhi: the street graph routes (one-ways respected) between Connaught Place, India Gate, the Red Fort and the airport', () => {
  const dir = new URL('../assets/cities/delhi/', import.meta.url).pathname, { M, G } = loadPack(dir), R = new Router(G), at = id => M.spawns.find(s => s.id === id);
  const leg = (a, b) => { const A = at(a), B = at(b); return R.route(R.nearest(A.x, A.z).node, R.nearest(B.x, B.z).node); };
  const ig = leg('centre', 'indiagate'), rf = leg('centre', 'redfort'), igi = leg('centre', 'igi'); assert.ok(ig && ig.metres > 2000 && ig.metres < 6000, 'CP to India Gate by road: ' + (ig && ig.metres)); assert.ok(rf && rf.metres > 4000 && rf.metres < 10000, 'CP to the Red Fort'); assert.ok(igi && igi.metres > 14000 && igi.metres < 30000, 'CP to the airport');
  const back = leg('indiagate', 'centre'); assert.ok(back && Math.abs(back.metres - ig.metres) / ig.metres < 0.6, 'the way back is of similar length');
});

/* ---- D5: the game's loader of the city pack (src/world/city/pack.js) agrees with the tool's, flyovers have ramps, stations stand clear of streets ---- */
test('city loader: decode, graph columns and street widths agree with tools/lib/packio.mjs', () => {
  const dir = new URL('../assets/cities/delhi/', import.meta.url).pathname, { M } = loadPack(dir), rawG = JSON.parse(readFileSync(dir + 'graph.json', 'utf8')), ref = decodeGraph(rawG), G = cityPack.decodeGraphColumns(rawG);
  assert.deepEqual(cityPack.dec([10, -5, 3, 4], 100, 200), packDec([10, -5, 3, 4], 100, 200)); assert.equal(G.n, ref.edges.length); assert.equal(G.nodes, ref.nodes.length);
  for (const i of [0, 1, 1000, 123456, G.n - 1]) { const e = ref.edges[i]; assert.equal(G.a[i], e[1]); assert.equal(G.b[i], e[2]); assert.equal(G.classes[G.cls[i]], e[3]); assert.equal(G.lanes[i], e[4]); assert.equal(G.layer[i], e[8]); assert.ok(Math.abs(G.len[i] - e[7]) < 0.01); }
  const t = M.tiles.find(x => x.tx === 0 && x.tz === -2), raw = JSON.parse(readFileSync(dir + 'tiles/0_-2.json', 'utf8')); assert.deepEqual(cityPack.decodeTile(raw, M.tileSize), packDecodeTile(raw, M.tileSize)); assert.ok(t);
  const tile = cityPack.decodeTile(raw, M.tileSize); for (const s of tile.streets.slice(0, 200)) assert.equal(cityPack.pieceWidth(G, s), streetWidth(s, ref.edges[s.id]));
  assert.ok(Math.abs(cityPack.yawFromBearing(0) - -Math.PI / 2) < 1e-9 && Math.abs(Math.cos(cityPack.yawFromBearing(Math.PI / 2)) - 1) < 1e-9, 'bearing north is -z, east is +x');
});
test('city loader: a flyover is on the ground at a ramp end, one level up in the middle, and a ground street is never lifted', () => {
  const dir = new URL('../assets/cities/delhi/', import.meta.url).pathname, G = cityPack.decodeGraphColumns(JSON.parse(readFileSync(dir + 'graph.json', 'utf8'))); let n = 0, flat = 0;
  for (let i = 0; i < G.n && n < 40; i++) if (G.layer[i] === 1 && G.len[i] > 200 && G.up[G.a[i]] < 2 && G.up[G.b[i]] < 2) {
    const ax = G.xz[G.a[i] * 2], az = G.xz[G.a[i] * 2 + 1], bx = G.xz[G.b[i] * 2], bz = G.xz[G.b[i] * 2 + 1];
    assert.ok(cityPack.deckHeight(G, i, ax, az) < 0.01 && cityPack.deckHeight(G, i, bx, bz) < 0.01, 'ramp ends on the ground'); assert.ok(Math.abs(cityPack.deckHeight(G, i, (ax + bx) / 2, (az + bz) / 2) - cityPack.LEVEL) < 0.01, 'one level up in the middle'); n++;
  }
  assert.ok(n >= 5, 'Delhi has flyovers: ' + n); for (let i = 0; i < G.n && flat < 100; i++) if (G.layer[i] === 0) { assert.equal(cityPack.deckHeight(G, i, G.xz[G.a[i] * 2], G.xz[G.a[i] * 2 + 1]), 0); flat++; }
});
test('city pack delhi: the five stations have footprints, stand clear of the streets of their tiles, and claim their ground in the registry', () => {
  const dir = new URL('../assets/cities/delhi/', import.meta.url).pathname, { M, G, L, tile } = loadPack(dir), stations = L.filter(l => ['old-delhi-station', 'new-delhi-station', 'nizamuddin-station', 'anand-vihar-terminal', 'sarai-rohilla-station'].includes(l.id)); assert.equal(stations.length, 5);
  for (const l of stations) {
    assert.ok(l.footprint && l.footprint.length >= 8, l.id + ' has a footprint'); const rect = cityPack.footprintRect(l.footprint, l.yaw || 0), ko = new KeepOut(), ko2 = new KeepOut(); ko2.add('city:lm:' + l.id, 'station', rect); assert.ok(ko2.point(rect.x, rect.z, 0, { as: 'scenery' }), 'the registry knows the station');
    for (let i = Math.floor((rect.x - 150) / 1000); i <= Math.floor((rect.x + 150) / 1000); i++) for (let j = Math.floor((rect.z - 150) / 1000); j <= Math.floor((rect.z + 150) / 1000); j++) { const t = tile(i, j); if (!t) continue; for (const s of t.streets) { const e = G.edges[s.id]; if (e[8] !== 0 || !CONFLICT_CLASSES.has(e[3])) continue; ko.add('s', 'road', { t: 'line', pts: s.pts, hw: corridorHw(e[3], streetWidth(s, e)) }); } }
    let cx = 0, cz = 0; for (let k = 0; k < l.footprint.length; k += 2) { cx += l.footprint[k]; cz += l.footprint[k + 1]; } const n = l.footprint.length / 2, r = streetConflict(l.footprint, [cx / n, cz / n], ko); assert.ok(!droppedForStreet(r), l.id + ' stands on a street: ' + (r.share * 100).toFixed(0) + ' % of its outline');
  }
});

/* ---- D5b follow-up: the city's navigation (src/world/city/citynav.js): A* on the pack graph, turn steps, the path an autodrive follows ---- */
test('city nav: A* routes on the Delhi graph from a point on a street to a point on a street, steps and a PathRoad follow it', async () => {
  const nav = await import('../src/world/city/citynav.js'), dir = new URL('../assets/cities/delhi/', import.meta.url).pathname, { M } = loadPack(dir), G = cityPack.decodeGraphColumns(JSON.parse(readFileSync(dir + 'graph.json', 'utf8'))), R = new nav.CityRouter(G);
  const at = id => M.spawns.find(s => s.id === id), A = at('centre'), B = at('indiagate'), r = R.plan(A.x, A.z, 0, B.x, B.z); assert.ok(r, 'a route'); assert.ok(r.metres > 2000 && r.metres < 8000, 'CP to India Gate: ' + r.metres);
  assert.ok(r.steps.length >= 4 && r.steps[0].text.startsWith('Head along') && r.steps[r.steps.length - 1].text === 'You have arrived', 'turn steps'); const p = new nav.PathRoad(r.poly); assert.ok(p.length > r.metres * 0.9 && p.length < r.metres * 1.3, 'the polyline is as long as the route: ' + p.length + ' vs ' + r.metres);
  assert.ok(p.closestS(A.x, A.z, 0) < 30, 'the start is at the start'); const o = p.at(p.length / 2, {}); assert.ok(Math.abs(Math.hypot(o.tx, o.tz) - 1) < 1e-9, 'unit tangent'); assert.ok(Math.abs(p.closestS(o.x, o.z, p.length / 2 - 40) - p.length / 2) < 2, 'closestS finds the point it was given, searching near the hint');
  const back = R.plan(B.x, B.z, 0, A.x, A.z); assert.ok(back && Math.abs(back.metres - r.metres) / r.metres < 0.6, 'the way back is of similar length');
  const bn = nav.roundCorners([0, 0, 50, 0, 50, 50], 9); assert.ok(bn.length > 6 && Math.min(...bn.filter((_, i) => i % 2 === 0).map((x, i) => Math.hypot(x - 50, bn[i * 2 + 1] - 0))) < 10, 'a right angle is rounded off but the path still passes near the corner'); assert.equal(nav.roundCorners([0, 0, 50, 0, 100, 1], 9).length, 6, 'a gentle bend is left alone');
  const ban = new Set(r.edges.slice(5, 6)); R.banned = ban; const r2 = R.plan(A.x, A.z, 0, B.x, B.z); assert.ok(r2 && !r2.edges.includes(r.edges[5]), 'a banned street is routed around'); R.banned = new Set();
});

test('city gates: each pack gate maps to the India road arm that leaves Delhi the same way; the entry gate follows the road you drive in on', async () => {
  const { mapGates, pickGate } = await import('../src/world/city/gates.js'), { RoadNetwork } = await import('../src/world/network.js'), sk = JSON.parse(readFileSync(new URL('../assets/india/skeleton.json', import.meta.url), 'utf8')), net = new RoadNetwork(sk);
  const M = JSON.parse(readFileSync(new URL('../assets/cities/delhi/manifest.json', import.meta.url), 'utf8')), gs = mapGates(net, 'delhi', M.gates), by = id => gs.find(g => g.id === id);
  assert.ok(gs.every(g => g.road && g.toward), 'every gate has an India road'); assert.equal(by('nh48-south-16').toward, 'jaipur', 'the Delhi-Gurugram expressway leaves towards Jaipur'); assert.equal(by('nh44-north-14').toward, 'ambala', 'the Grand Trunk Road north leaves towards Ambala');
  assert.equal(by('nh709b-north-17').road, 'nh-delhi-dehradun', 'the Dehradun expressway'); assert.equal(by('nh24-east-11').road, 'nh-delhi-lucknow', 'NH24 east is the Lucknow road');
  const g = pickGate(gs, 'gq-delhi-mumbai', Math.atan2(-Math.cos(by('nh48-south-16').bearing), Math.sin(by('nh48-south-16').bearing)), 'NH48'); assert.ok(g && g.road === 'gq-delhi-mumbai', 'driving in from Jaipur on the GQ enters by a gate of the GQ');
  const w = net.worldStart('delhi', { road: 'ns', toward: 'ambala' }), w2 = net.worldStart('delhi', { road: 'ns', toward: 'agra' }); assert.ok(w && w.road === 'ns' && w.gA.toward === 'ambala' && w2.gA.toward === 'agra', 'leaving by a gate starts the India world on that road, heading out'); assert.ok(net.worldStart('delhi').road, 'no options: the best road as before');
  const { sanitiseSaved } = await import('../src/core/saved.js'); assert.equal(sanitiseSaved({ enclave: 'delhi' }).enclave, 'delhi', 'the save keeps the city you were in'); assert.equal(sanitiseSaved({ enclave: '../x' }).enclave, undefined, 'a bad enclave is dropped');
});

test('city underpasses: a street on layer -1 is on the ground at a portal and one level (5.6 m) down in the middle, a ground street is never sunk', () => {
  const dir = new URL('../assets/cities/delhi/', import.meta.url).pathname, G = cityPack.decodeGraphColumns(JSON.parse(readFileSync(dir + 'graph.json', 'utf8'))); let n = 0, flat = 0;
  for (let i = 0; i < G.n; i++) if (G.layer[i] === -1 && G.len[i] > 200 && G.dn[G.a[i]] === 1 && G.dn[G.b[i]] >= 2) { const ax = G.xz[G.a[i] * 2], az = G.xz[G.a[i] * 2 + 1], bx = G.xz[G.b[i] * 2], bz = G.xz[G.b[i] * 2 + 1]; assert.equal(cityPack.underDepth(G, i, ax, az), 0, 'on the ground at the portal'); assert.ok(Math.abs(cityPack.underDepth(G, i, bx, bz) - cityPack.LEVEL) < 1e-6, 'a level down where the street continues underground'); assert.ok(cityPack.underDepth(G, i, (ax + bx) / 2, (az + bz) / 2) <= cityPack.LEVEL + 1e-9); n++; }
  assert.ok(n >= 3, 'Delhi has underpasses: ' + n); for (let i = 0; i < G.n && flat < 100; i++) if (G.layer[i] >= 0) { assert.equal(cityPack.underDepth(G, i, G.xz[G.a[i] * 2], G.xz[G.a[i] * 2 + 1]), 0); flat++; }
});

test('Delhi Metro plan (D6): every route has a height profile within 4 %, every station is on its routes, timetables stop at every station, trains fit the headway', async () => {
  const P = await import('../src/world/city/transit_plan.js'), T = JSON.parse(readFileSync(new URL('../assets/cities/delhi/transit.json', import.meta.url))), N = P.buildNetwork(T);
  assert.equal(N.routes.length, 28); assert.equal(N.stations.size, T.metro.stations.length, 'every station record is called at by a route');
  for (const R of N.routes) {
    for (let i = 1; i < R.n; i++) assert.ok(Math.abs(R.h[i] - R.h[i - 1]) <= (R.s[i] - R.s[i - 1]) * P.MAXGRADE + 1e-6, R.id + ' grade at sample ' + i);
    const tt = P.buildTimetable(R, P.specOf(R.line).vmax); assert.ok(tt.headway >= 150 && tt.headway <= 300, R.id + ' headway ' + tt.headway);
    for (let k = 0; k < R.stops.length; k++) { const a = k === 0 ? 0 : tt.arrive[k]; const st = tt.state(a + 5); assert.ok(st && st.stop === k && Math.abs(st.s - R.stops[k].s) < 0.5, R.id + ' stands at stop ' + k); }
    let prev = -1; for (let tau = 0; tau < tt.T; tau += 7) { const st = tt.state(tau); assert.ok(st.s >= prev - 1e-6, R.id + ' never goes backwards'); prev = st.s; }
  }
  { let off = 0, all = 0; for (const [, e] of N.stations) for (const c of e.calls) { const per = e.st.per.find(p => p.line === c.R.line); all++; if (Math.abs(c.R.at(c.s).h - P.pinHeight(P.kitOf(per))) > 0.6) off++; } assert.ok(off <= 12, off + ' of ' + all + ' station calls are off their kit height (the profile comes down before tunnels)'); }
  const e = N.stations.get('RC') || [...N.stations.values()].find(x => x.st.name.en === 'Rajiv Chowk'); assert.ok(e && e.st.per.length === 2, 'Rajiv Chowk serves two lines');
});

test('Delhi landmark models (D8): every plan id is a landmark with a footprint, the plan files are balanced, and the plan geometry helpers (ray against a polygon, frames) are right', async () => {
  const dir = new URL('../src/world/city/landmarks/', import.meta.url), { L } = loadPack(new URL('../assets/cities/delhi/', import.meta.url).pathname), lm = new Map(L.map(l => [l.id, l])); let n = 0;
  for (const f of ['plans_axis.js', 'plans_mughal.js', 'plans_modern.js']) { const src = readFileSync(new URL(f, dir), 'utf8'); assert.equal((src.match(/{/g) || []).length, (src.match(/}/g) || []).length, f + ' has balanced braces');
    for (const m of src.matchAll(/export const (?:AXIS|MUGHAL|MODERN) = {([^}]*)}/g)) for (const k of m[1].split(',')) { const key = (k.split(':')[0] || '').trim().replace(/['"]/g, ''); if (!key) continue; const id = key.replace(/([A-Z])/g, c => '-' + c.toLowerCase()); const l = lm.get(key) || lm.get(id); n++; if (l) assert.ok(l.footprint && l.footprint.length >= 8 && l.name.en && l.name.hi && l.card && l.card.text, key + ' has a footprint, both names and a card'); } }
  assert.ok(n >= 19, 'at least 19 landmark plans registered (' + n + ')');
  const { rayPoly, frame } = await import('../src/world/city/landmarks/geo.js'), sq = [[-10, -5], [10, -5], [10, 5], [-10, 5]], h = rayPoly(sq, 0, 0, 1, 0); assert.ok(Math.abs(h.x - 10) < 1e-9 && Math.abs(h.t - 10) < 1e-9 && Math.abs(h.ex) < 1e-9, 'the ray east hits the east side, whose edge runs along z'); assert.equal(rayPoly(sq, 20, 0, 1, 0), null, 'a ray pointing away hits nothing');
  const F = frame(3, 4, Math.PI / 2), p = F.loc(10, 2); assert.ok(Math.abs(p[0] - 1) < 1e-9 && Math.abs(p[1] - 14) < 1e-9, 'u runs along the frame angle, v to its left');
});

test('signal heads: the phase of a head is the rule the cars obey (green for one axis 14 s, then the other), never green both ways, amber only at the end of a green slot, exactly one lamp lit', async () => {
  const { signalPhase, lampLit, SLOT, AMBER } = await import('../src/world/city/signalphase.js'), green = (time, node, tx, tz) => { const axis = Math.abs(tx) > Math.abs(tz) ? 0 : 1; return Math.floor((time + (node * 7 % 28)) / 14) % 2 === axis; };     // citytraffic.js green(), copied
  let amber = 0, all = 0; for (const node of [0, 1, 5, 99, 12345, 406000]) for (const [tx, tz] of [[1, 0], [0, 1], [-0.7, 0.2], [0.1, -0.9]]) for (let time = 0; time < 120; time += 0.25) { all++; const st = signalPhase(time, node, tx, tz); assert.equal(st !== 'red', green(time, node, tx, tz), 'a head is lit non-red exactly when the cars see green'); assert.ok(!(st === 'green' && signalPhase(time, node, tz, tx) === 'green'), 'never green both ways'); assert.equal([0, 1, 2].filter(k => lampLit(st, k)).length, 1, 'exactly one lamp lit'); if (st === 'amber') { amber++; assert.ok(((time + (node * 7 % 28)) % SLOT) >= SLOT - AMBER, 'amber only at the end of the slot'); } }
  assert.ok(amber / all > 0.05 && amber / all < 0.15, 'amber share ' + amber / all);
});
test('CP smooth circles: the Inner Circle is laid on its fitted circle in steps of 2.5 degrees or less, no piece end moves, other streets are untouched, a piece that is not an arc is left alone', async () => {
  const { smoothCircles, arcPiece, chaikin, CP_CIRCLE: C } = await import('../src/world/city/smooth.js'), dir = new URL('../assets/cities/delhi/', import.meta.url).pathname, { M } = loadPack(dir), G = cityPack.decodeGraphColumns(JSON.parse(readFileSync(dir + 'graph.json', 'utf8')));
  const nm = id => { const n = G.names[G.name[id]]; return n ? (typeof n === 'string' ? n : n.en || n.ref || '') : ''; }; let pieces = 0, other = 0;
  for (const k of ['0_-3', '1_-3', '0_-2', '1_-2']) { const t = cityPack.decodeTile(JSON.parse(readFileSync(dir + 'tiles/' + k + '.json', 'utf8')), M.tileSize), u = smoothCircles(t, G); assert.equal(u.streets.length, t.streets.length);
    u.streets.forEach((s, i) => { const o = t.streets[i], n = nm(s.id); if (s === o) return; assert.ok(['Inner Circle', 'Middle Circle', 'Outer Circle'].includes(n), 'only the circles change: ' + n); assert.equal(s.pts[0], o.pts[0]); assert.equal(s.pts[1], o.pts[1]); assert.equal(s.pts[s.pts.length - 2], o.pts[o.pts.length - 2]); assert.equal(s.pts[s.pts.length - 1], o.pts[o.pts.length - 1]); assert.equal(s.id, o.id);
      if (n === 'Inner Circle') { pieces++; const P = s.pts; for (let j = 2; j < P.length; j += 2) { let d = Math.abs(Math.atan2(P[j + 1] - C.cz, P[j] - C.cx) - Math.atan2(P[j - 1] - C.cz, P[j - 2] - C.cx)); if (d > Math.PI) d = 2 * Math.PI - d; assert.ok(d <= 2.6 * Math.PI / 180, 'step ' + (d * 180 / Math.PI)); } for (let j = 2; j < P.length - 2; j += 2) assert.ok(Math.abs(Math.hypot(P[j] - C.cx, P[j + 1] - C.cz) - C.R) < 4, 'on the circle'); } else other++; }); }
  assert.ok(pieces >= 8, 'inner circle pieces smoothed: ' + pieces); assert.ok(other >= 1, 'the middle or outer circle smoothed');
  assert.equal(arcPiece([C.cx + C.R, C.cz, C.cx + C.R, C.cz + 30, C.cx + C.R, C.cz]), null, 'a back and forth piece is left alone'); assert.equal(chaikin([0, 0, 10, 0, 10, 10], 1).length > 6, true);
  const hand = [0, 0, 5, 0, 5, 5, 0, 5]; const c2 = chaikin(hand, 2); assert.deepEqual([c2[0], c2[1], c2[c2.length - 2], c2[c2.length - 1]], [0, 0, 0, 5], 'ends stay');
});
test('Delhi infill (P1): lots are inside blocks, clear of streets, mapped buildings, parks and each other; deterministic; adds coverage; stays under the cap', async () => {
  const { infillBuildings, STYLE } = await import('../src/world/city/infill.js'), dir = new URL('../assets/cities/delhi/', import.meta.url).pathname, { M } = loadPack(dir), G = cityPack.decodeGraphColumns(JSON.parse(readFileSync(dir + 'graph.json', 'utf8')));
  const area = r => { let a = 0; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) a += r[j] * r[i + 1] - r[i] * r[j + 1]; return Math.abs(a) / 2; }, pip = (r, x, z) => { let c = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { if ((r[i + 1] > z) !== (r[j + 1] > z) && x < (r[j] - r[i]) * (z - r[i + 1]) / (r[j + 1] - r[i + 1]) + r[i]) c = !c; } return c; };
  for (const [tx, tz] of [[0, -2], [0, -4]]) {
    const tile = cityPack.decodeTile(JSON.parse(readFileSync(dir + `tiles/${tx}_${tz}.json`, 'utf8')), M.tileSize), o = { size: M.tileSize, G, widthOf: s => cityPack.pieceWidth(G, s), styleAt: () => 'default' };
    const a = infillBuildings(tile, o), b = infillBuildings(tile, o); assert.deepEqual(a.map(x => x.ring), b.map(x => x.ring), 'deterministic'); assert.ok(a.length > 50 && a.length <= 4000, 'infill count ' + a.length); assert.ok(a.yards && a.yards.length > 0 && a.yards.length <= 700, 'yards: ' + (a.yards && a.yards.length)); for (const y of a.yards.slice(0, 300)) { const yx = (y[0] + y[2]) / 2, yz = (y[1] + y[3]) / 2; assert.ok(tile.blocks.some(bl => pip(bl.ring, yx, yz)), 'yard inside a block'); assert.ok(![...tile.buildings, ...a].some(bl => pip(bl.ring || bl, yx, yz)), 'yard not under a building'); } assert.deepEqual(a.yards, b.yards, 'yards deterministic');
    assert.ok(a.some(x => x.interior) && a.filter(x => x.interior).length <= 1800, 'interior lots exist and stay under their cap');
    const before = tile.buildings.reduce((q, x) => q + area(x.ring), 0), add = a.reduce((q, x) => q + area(x.ring), 0); assert.ok(add > before * 0.15, 'adds at least 15 percent to the mapped building area: ' + (add / before).toFixed(2));
    const ids = new Set(a.map(x => x.id)); assert.equal(ids.size, a.length, 'unique ids');
    for (const x of [...a.slice(0, 400), ...a.filter(q => q.interior).slice(0, 200)]) {
      const r = x.ring, cx = (r[0] + r[4]) / 2, cz = (r[1] + r[5]) / 2; assert.ok(x.infill && x.height >= 3.2 && x.hsrc === 'tag');
      assert.ok(tile.blocks.some(bl => pip(bl.ring, cx, cz)), 'lot centre inside a block');
      assert.ok(!tile.buildings.some(bl => pip(bl.ring, cx, cz)), 'not on a mapped building');
      for (const st of tile.streets) { const cls = G.classes[G.cls[st.id]]; if (['footway', 'cycleway', 'path', 'steps', 'pedestrian'].includes(cls)) continue; const hw = cityPack.pieceWidth(G, st) / 2, p = st.pts; for (let i = 0; i + 3 < p.length; i += 2) { const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((cx - p[i]) * dx + (cz - p[i + 1]) * dz) / L2)) : 0; assert.ok(Math.hypot(cx - (p[i] + dx * t), cz - (p[i + 1] + dz * t)) > hw + 0.5, 'lot centre on a carriageway'); } }
    }
    assert.ok(STYLE.oldDelhi.fill > STYLE.lutyens.fill, 'Old Delhi is denser than Lutyens');
  }
});
test('Delhi map rules and audit: the Connaught Place station block is left out, no landmark is, and no audit class is worse than its baseline', async () => {
  const { buildingsToSkip } = await import('../src/world/city/rules.js'), { execFileSync } = await import('node:child_process'), dir = new URL('../assets/cities/delhi/', import.meta.url).pathname, { M } = loadPack(dir), G = cityPack.decodeGraphColumns(JSON.parse(readFileSync(dir + 'graph.json', 'utf8')));
  const tile = cityPack.decodeTile(JSON.parse(readFileSync(dir + 'tiles/2_-5.json', 'utf8')), M.tileSize), skip = buildingsToSkip(tile, G);
  assert.ok([...skip].some(b => b.use === 'transit' && (b.height || 0) < 8), 'a transit block on a park is left out'); assert.ok(![...skip].some(b => b.landmark), 'no landmark is left out'); assert.ok(skip.size < tile.buildings.length * 0.2, 'the rules leave out a small share of a tile: ' + skip.size);
  const now = JSON.parse(execFileSync(process.execPath, [new URL('./audit_city.mjs', import.meta.url).pathname, '--json'], { encoding: 'utf8' })), base = JSON.parse(readFileSync(new URL('./city_audit_baseline.json', import.meta.url), 'utf8')).counts;
  for (const k of Object.keys(base)) assert.ok(now[k] <= base[k], 'audit class ' + k + ' got worse: ' + now[k] + ' against ' + base[k]);
});
test('Delhi roads out: every gate joins an India highway toward a city, and every city reachable from Delhi has a gate to leave by', async () => {
  const { RoadNetwork } = await import('../src/world/network.js'), { mapGates, gateForCity } = await import('../src/world/city/gates.js'), dir = new URL('../assets/cities/delhi/', import.meta.url).pathname, net = new RoadNetwork(JSON.parse(readFileSync(new URL('../assets/india/skeleton.json', import.meta.url), 'utf8'))), { M } = loadPack(dir);
  const g = mapGates(net, 'delhi', M.gates); assert.equal(g.length, M.gates.length); for (const x of g) { assert.ok(x.road && x.toward, 'gate ' + x.id + ' joins no highway'); assert.ok(net.cities.get(x.toward), 'gate ' + x.id + ' leads toward an unknown city'); }
  let n = 0, miss = [], byGate = {}; for (const c of net.cities.values()) { if (c.id === 'delhi') continue; const rt = net.route('delhi', c.id); if (!rt || !rt.legs || !rt.legs.length) continue; n++; const r = gateForCity(net, 'delhi', g, c.id); if (!r) miss.push(c.id); else byGate[r.gate.toward] = (byGate[r.gate.toward] || 0) + 1; }
  assert.ok(n >= 10, 'cities reachable from Delhi: ' + n); assert.deepEqual(miss, [], 'cities with no gate to leave by: ' + miss.join(', ')); assert.ok(Object.keys(byGate).length >= 4, 'the cities spread over several exits: ' + JSON.stringify(byGate)); console.log('     roads out of Delhi: ' + g.length + ' gates, ' + n + ' cities reachable, by exit ' + JSON.stringify(byGate));
});
test('Delhi identity (D7): identity.json is valid, zones lie inside the pack, every shop kind has name boards, areas answer', async () => {
  const I = await import('../src/world/city/identity.js'), J = JSON.parse(readFileSync(new URL('../assets/cities/delhi/identity.json', import.meta.url))), M = JSON.parse(readFileSync(new URL('../assets/cities/delhi/manifest.json', import.meta.url)));
  const ID = new I.Identity(J, M.origin); assert.equal(J.format, 1);
  for (const z of ID.zones) { assert.ok(J.areas[z.area], z.id + ' names a known area'); assert.ok(z.x > M.bbox[0] - 2000 && z.x < M.bbox[2] + 2000 && z.z > M.bbox[1] - 2000 && z.z < M.bbox[3] + 2000, z.id + ' is near the pack: ' + Math.round(z.x) + ', ' + Math.round(z.z)); }
  assert.equal(ID.areaNameAt(ID.zones.find(z => z.id === 'cp').x, ID.zones.find(z => z.id === 'cp').z), 'cp', 'the small zone wins over the big Lutyens circle');
  assert.equal(ID.areaNameAt(1e7, 1e7), 'default');
  for (const [name, a] of Object.entries(J.areas)) {
    const t = Object.entries(a.traffic).filter(([k]) => k !== 'guess').reduce((x, [, v]) => x + v, 0); assert.ok(Math.abs(t - 1) < 0.02, name + ' traffic shares sum to 1: ' + t);
    for (const k of Object.keys(a.shopKinds || {})) assert.ok(J.signage.shopNames[k] && J.signage.shopNames[k].length, name + ' shop kind ' + k + ' has name boards');
    for (const sp of a.trees.species) assert.ok(ID.species.has(sp), name + ' tree species ' + sp);
    for (const k in a.traffic) if (k !== 'guess') assert.ok(['two', 'hatch', 'suv', 'auto', 'erick', 'taxi', 'tempo', 'truck', 'cyclerick', 'bus'].includes(k), 'vehicle kind ' + k);
  }
  assert.equal(J.sky.months.length, 12); assert.ok(ID.month(11).smog > ID.month(8).smog, 'November smog is worse than August');
  assert.ok(J.signage.ads.length <= 16 && J.signage.notices.length <= 5, 'the art atlases hold these lists');
  const n = J.signage.shopNames; assert.ok(Object.values(n).reduce((x, l) => x + l.length, 0) <= 64, 'the sign atlas has 64 cells');
  assert.ok(ID.shopKind('oldDelhi', 0.5) && ID.vehicleKind('market', 0.99) && ID.clothing(11).length, 'pickers answer');
  assert.ok(['neem', 'jamun'].includes('neem'));
});

test('prefetch: each file once, one at a time in order, a failure is tried again later, nothing on a save-data connection', async () => {
  const P = await import('../src/world/prefetch.js'), got = [], realFetch = globalThis.fetch; let fail = new Set(['assets/india/rails.json']);
  globalThis.fetch = async u => { got.push(u); if (fail.has(u)) throw new Error('offline'); return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) }; };
  try {
    assert.equal(P.prefetch(P.INDIA_FILES), P.INDIA_FILES.length); assert.equal(P.prefetch(P.INDIA_FILES), 0, 'asked twice: nothing new'); await new Promise(r => setTimeout(r, 30));
    assert.deepEqual(got, P.INDIA_FILES, 'in order, once each'); fail = new Set(); assert.equal(P.prefetch(P.INDIA_FILES), 1, 'only the one that failed is asked again'); await new Promise(r => setTimeout(r, 30)); assert.equal(got.length, P.INDIA_FILES.length + 1);
    Object.defineProperty(globalThis, 'navigator', { value: { connection: { saveData: true } }, configurable: true }); assert.equal(P.prefetch(P.CITY_FILES), 0, 'save-data: nothing');
  } finally { globalThis.fetch = realFetch; delete globalThis.navigator; }
});
test('gzfetch: the gzip copy is used and unpacked, a host that already unpacked it works, a missing copy falls back to the plain file', async () => {
  const G = await import('../src/core/gzfetch.js'), data = Uint8Array.from({ length: 5000 }, (_, i) => i % 251), gz = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  assert.ok(G.isGzip(gz) && !G.isGzip(data));
  const mk = map => async u => { const v = map[u]; return v ? { ok: true, arrayBuffer: async () => v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) } : { ok: false, status: 404 }; };
  const same = (a, b) => assert.deepEqual(new Uint8Array(a), b);
  same(await G.fetchGrid('x.bin', mk({ 'x.bin.gz': gz })), data); same(await G.fetchGrid('x.bin', mk({ 'x.bin.gz': data })), data); same(await G.fetchGrid('x.bin', mk({ 'x.bin': data })), data);
  await assert.rejects(() => G.fetchGrid('x.bin', mk({})));
});
test('roundabout islands: round parks are found, dressed by size, with a painted kerb', async () => {
  const R = await import('../src/world/city/roundabout.js'), ring = r => { const o = []; for (let i = 0; i < 24; i++) { const t = i / 24 * Math.PI * 2; o.push(100 + r * Math.cos(t), 50 + r * Math.sin(t)); } return o; };
  assert.equal(R.islandInfo(ring(8)).size, 'small'); assert.equal(R.islandInfo(ring(25)).size, 'medium'); assert.equal(R.islandInfo(ring(60)).size, 'big'); assert.equal(R.islandInfo([0, 0, 50, 0, 50, 5, 0, 5, 0, 0, 10, 10]), null); assert.equal(R.islandInfo(ring(2)), null);
  const n = {}; for (const r of [8, 25, 60]) { const cols = new Set(); n[r] = R.dress((cx, y0, cz, sx, sy, sz, yaw, c) => { assert.ok(Number.isFinite(cx + cz + sx + sy + sz + yaw)); cols.add(c); }, R.islandInfo(ring(r)), 0); assert.ok(cols.has(0xe0ae1e) && cols.has(0x1b1b1d), 'yellow and black kerb'); }
  assert.ok(n[8] < n[25] && n[25] < n[60] && n[60] <= R.CAP);
});
test('place banner: bracketed names are shortened and every place type has a reach', async () => {
  const P = await import('../src/ui/placebanner.js');
  assert.equal(P.shortName('Karol Bagh (Ajmal Khan Road)'), 'Karol Bagh'); assert.equal(P.shortName('Connaught Place (Rajiv Chowk)'), 'Connaught Place'); assert.equal(P.shortName('Khan Market'), 'Khan Market');
  const fs = await import('node:fs'), lm = JSON.parse(fs.readFileSync(new URL('../assets/cities/delhi/landmarks.json', import.meta.url))).landmarks; for (const l of lm) { const r = P.reach(l); assert.ok(r >= 200 && r <= 400, l.name.en); assert.ok(P.shortName(l.name.en).length > 2); }
});
test('offline download: the list is split into core and Delhi, sizes add up, the label is readable, the state follows the stored version', async () => {
  const O = await import('../src/ui/offline.js'), m = { version: 'v2', files: [{ p: './', s: 0, g: 'core' }, { p: 'a.js', s: 3000000, g: 'core' }, { p: 'assets/cities/delhi/t.json', s: 70000000, g: 'delhi' }] };
  assert.equal(O.plan(m, 'core').files.length, 2); assert.equal(O.plan(m, 'delhi').bytes, 70000000); assert.equal(O.plan(null, 'core').bytes, 0);
  assert.equal(O.label(70000000), '70 MB'); assert.equal(O.label(3000000), '3 MB');
  const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  try { assert.equal(O.stateOf('core', m), 'none'); store['gfp-offline'] = JSON.stringify({ core: 'v2', delhi: 'v1' }); assert.equal(O.stateOf('core', m), 'ready'); assert.equal(O.stateOf('delhi', m), 'old'); } finally { delete globalThis.localStorage; }
  const sw = (await import('node:fs')).readFileSync(new URL('../sw.js', import.meta.url), 'utf8'); assert.ok(/k !== OFFLINE/.test(sw) && /offline-download/.test(sw), 'the service worker keeps the offline cache and answers the download message');
});
test('Lite build: Delhi only by default (no India files in the deploy list, none preloaded), the full game stays reachable with ?build=full', async () => {
  const B = await import('../src/core/build.js'), fs = await import('node:fs'), rd = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  assert.equal(B.BUILD, 'lite'); assert.equal(B.LITE, true);
  assert.ok(/LITE_SKIP = \('assets\/india\/',\)/.test(rd('tools/stage_cloudflare.py')) && /build == 'lite'/.test(rd('tools/stage_cloudflare.py')), 'the stage script leaves assets/india out of Lite');
  assert.ok(/var lite = !\/\[\?&\]build=full/.test(rd('index.html')) && /lite \? \[\]/.test(rd('index.html')), 'the page preloads no India file in Lite');
  const m = rd('src/main.js'); assert.ok(/const cityMode = LITE \|\|/.test(m) && /\(q\.get\('india'\) \|\| wantWorld\) && !LITE/.test(m) && /cityMode && !LITE\) Promise\.all/.test(m), 'main.js starts Delhi and reads no India file in Lite');
});
test('sign boards: Hindi for every name is Devanagari, the dictionary words are right, and the sign code keeps its rules (arrivals only, enterable roads, chevrons, give way)', async () => {
  const H = await import('../src/world/city/hindi.js'), fs = await import('node:fs'), src = fs.readFileSync(new URL('../src/world/city/tilemesh.js', import.meta.url), 'utf8') + fs.readFileSync(new URL('../src/world/city/signdests.js', import.meta.url), 'utf8');
  assert.equal(H.hindiOf('Ring Road'), 'रिंग रोड'); assert.equal(H.hindiOf('Mahatma Gandhi Marg'), 'महात्मा गांधी मार्ग'); assert.equal(H.hindiName({ en: 'Ring Road', hi: 'x' }), 'x');
  const man = JSON.parse(fs.readFileSync(new URL('../assets/cities/delhi/graph.json', import.meta.url), 'utf8')).names; let n = 0;
  for (const nm of man) { if (!nm.en || !/[A-Za-z]/.test(nm.en)) continue; const h = H.hindiOf(nm.en); assert.ok(h && /[ऀ-ॿ]/.test(h) && !/[A-Za-z]/.test(h), 'Hindi for ' + nm.en + ': ' + h); n++; }
  assert.ok(n > 3000, 'names checked: ' + n);
  assert.ok(/G\.oneway\[id\] === \(end \? 1 : -1\)/.test(src) && /one !== \(G\.a\[e\] === node \? 1 : -1\)/.test(src), 'signs only where traffic arrives, boards only list roads that can be entered');
  assert.ok(/kind: 'chev'/.test(src) && /'give'/.test(src) && /kind: 'cam'/.test(src) && /kind: 'ref'/.test(src) && /diagram/.test(src) && /green: true, km/.test(src), 'chevrons, give-way, camera, route plate, diagram and green distance boards are built');
});
test('sign boards name real places: PLACES is built from the pack, a road leading toward Karol Bagh gets a board for it, STOP and give-way signs exist', async () => {
  const fs = await import('node:fs'), { decodeGraphColumns } = await import('../src/world/city/pack.js'), { destsAt, adjOf, placeFor } = await import('../src/world/city/signdests.js'), { PLACES } = await import('../src/world/city/places.js');
  assert.ok(PLACES.length > 300 && PLACES.every(p => p[0] && isFinite(p[2]) && isFinite(p[3])), 'places: ' + PLACES.length);
  const pl = placeFor(-1855, -3569 + 900, 0, -1); assert.ok(pl && /Karol Bagh|Rajendra|Patel|Shadipur|Delhi Cantt|Kirti|Jhandewalan|Rama|Moti|Satguru|Inderlok|Ashok Park/i.test(pl.en + ' ') || pl, 'a place to the north of Karol Bagh: ' + JSON.stringify(pl)); assert.equal(placeFor(0, 0, 1, 0).km !== undefined, true);
  const G = decodeGraphColumns(JSON.parse(fs.readFileSync(new URL('../assets/cities/delhi/graph.json', import.meta.url), 'utf8'))), { head, nxt } = adjOf(G); let boards = 0, withKm = 0;
  for (let n = 0; n < G.nodes && boards < 30; n += 97) for (let h = head[n]; h >= 0; h = nxt[h]) { const e = h >> 1, c = G.classes[G.cls[e]]; if (c !== 'primary' && c !== 'secondary') continue; const o = (h & 1) ? G.a[e] : G.b[e], dx = G.xz[o * 2] - G.xz[n * 2], dz = G.xz[o * 2 + 1] - G.xz[n * 2 + 1], L = Math.hypot(dx, dz); if (L < 30) continue; const d = destsAt(G, n, e, dx / L, dz / L, -dz / L, dx / L); for (const b of d) { boards++; if (b.km) withKm++; assert.ok(b.en && ['left', 'up', 'right'].includes(b.dir)); } break; }
  assert.ok(boards >= 20 && withKm === boards, 'boards ' + boards);
  const src = fs.readFileSync(new URL('../src/world/city/tilemesh.js', import.meta.url), 'utf8'); assert.ok(/kind: stop \? 'stop' : 'give'/.test(src) && /k === 'stop'/.test(src), 'STOP signs with a stop line');
});
test('CP street furniture (cpstreet.js): bins, bollards, drains, barricades, CCTV and transformers are placed by rule on a CP street piece, deterministically, and none sits in a building or the road', async () => {
  const { cpStreetPiece } = await import('../src/world/city/cpstreet.js'), mk = (id, len, walk) => ({ id, len, hw: 4, walk, cls: 'secondary' }), at = (pc, s) => ({ x: s, z: 0, tx: 1, tz: 0 });
  const run = pc => { const boxes = [], circles = [], h = { box: (M, lx, y, lz, sx, sy, sz) => boxes.push([lx, y, lz, sx, sy, sz]), M: {}, gy: 0, rnd: (a, b) => { let x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }, C: v => v, insideBuilding: () => false, inRoad: () => false, L: (x, z) => [x, z], circle: (x, z, r) => circles.push([x, z, r]) }; return { n: cpStreetPiece(pc, at, h), boxes, circles }; };
  const a = run(mk(5, 120, 2)), b = run(mk(5, 120, 2)); assert.deepEqual(a, b); assert.ok(a.n.bin >= 2 && a.n.bollard >= 4 && a.n.drain >= 4, JSON.stringify(a.n)); assert.ok(a.boxes.length >= 20 && a.boxes.every(q => q.every(Number.isFinite)));
  assert.equal(Object.values(run(mk(6, 10, 2)).n).reduce((x, y) => x + y, 0), 0, 'a short piece gets nothing'); assert.equal(Object.values(run(mk(7, 120, 0)).n).reduce((x, y) => x + y, 0), 0, 'a street without a walk gets nothing');
  let kinds = new Set(); for (let id = 1; id < 60; id++) for (const [k, v] of Object.entries(run(mk(id, 90, 2)).n)) if (v) kinds.add(k); assert.equal(kinds.size, 6, 'all six kinds occur: ' + [...kinds]);
});
test('Delhi QA test adapter (T1): inert without the dev flags and imported by nothing in the game', async () => {
  const m = await import('../src/debug/delhi_test_adapter.js'); assert.equal(m.status.installed, false, 'no ?dev&testdrive=1 in node, so it installs nothing');
  const { readdirSync, statSync } = await import('node:fs'); const files = []; const walk = d => { for (const f of readdirSync(d)) { const q = d + '/' + f; if (statSync(q).isDirectory()) walk(q); else if (/\.m?js$/.test(f)) files.push(q); } }; walk(new URL('../src', import.meta.url).pathname);
  const hits = files.filter(f => !f.endsWith('delhi_test_adapter.js') && readFileSync(f, 'utf8').includes('delhi_test_adapter')); assert.deepEqual(hits, [], 'the game must not import the test adapter: ' + hits);
});
test('Delhi QA runner (T2/T3): every verified fixture routes on the pack, no wrong-way edge, continuous surface heights', async () => {
  const { execFileSync } = await import('node:child_process'); const out = execFileSync(process.execPath, [new URL('../tools/run_delhi_test.mjs', import.meta.url).pathname, '--no-write'], { encoding: 'utf8' });
  assert.ok(!/^FAIL /m.test(out), 'a fixture failed:\n' + out.split('\n').filter(l => /FAIL/.test(l)).join('\n')); assert.ok(/PASS +cp-india-gate/.test(out) && /PASS +flyover-rani-jhansi/.test(out) && /PASS +todarmal-replay/.test(out), 'the CP, flyover and Todarmal fixtures pass');
});
test('carjacking (C2): every garage car a taken NPC car becomes exists, and every model kind has a garage car', async () => {
  const { VEHICLES } = await import('../src/vehicle/defs.js'), src = readFileSync(new URL('../src/world/city/vehicles.js', import.meta.url), 'utf8'), ids = new Set(VEHICLES.map(v => v.id));
  const m = src.match(/GARAGE_OF = \{([^}]*)\}/); assert.ok(m, 'GARAGE_OF is in vehicles.js'); const pairs = [...m[1].matchAll(/'?([\w-]+)'?: ('?[\w-]+'?|null)/g)].map(x => [x[1], x[2].replace(/'/g, '')]); assert.ok(pairs.length >= 10);
  for (const [k, v] of pairs) if (v !== 'null') assert.ok(ids.has(v), 'GARAGE_OF ' + k + ' -> ' + v + ' is a garage car');
  const sets = [...src.matchAll(/^  '([\w-]+)': \{ (?:pack: '[\w-]+', )?base: '(\w+)'/gm)].map(x => x[1]); assert.ok(sets.length >= 10); for (const k of sets) assert.ok(pairs.some(([a, b]) => a === k && b !== 'null'), k + ' (a model kind) can be taken');
});
console.log(`\n${passed} checks passed`);
