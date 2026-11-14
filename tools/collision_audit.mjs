/* Can the car get out of a tunnel through its wall, or end up somewhere it should not on a bridge? Drives the real vehicle physics on the real graded ground
   (terrain.drive) into the side of a tunnel and over the edge of a bridge. Run: node tools/collision_audit.mjs [--check] */
import { VEHICLES } from '../src/vehicle/defs.js';
import { vehicleParams } from '../src/vehicle/physics.js';
import { RapierVehicle, initRapier } from '../src/vehicle/rapier-vehicle.js';
import { locationConfig } from '../src/world/locations.js';
import { createTerrain } from '../src/world/terrain.js';
import { Road } from '../src/world/router.js';
import { PORTAL_W } from '../src/world/router.js';
import { createRails } from '../src/world/bridge_rails.js';
await initRapier();
const problems = [], check = process.argv.includes('--check');
for (const [loc, seed] of [['himalayas', 'hill'], ['alps', 'alps']]) {
  const cfg = locationConfig(loc, seed), t = createTerrain(cfg), r = new Road(t, cfg); r.ensure(-4000, 4000); t.attachRoad(r);
  const rails = createRails(r, r.style.shoulder);
  const world = { height: (x, z) => t.drive(x, z), surface: (x, z) => t.surface(x, z), near: (x, z, rr) => rails(x, z, rr), seaLevel: t.seaLevel };
  const find = (pred) => { for (let s = r.sMin + 200; s < r.sMax - 200; s += 10) if (pred(s)) return s; return null; };
  // the doorway: at the first row of the tube the land over the road must not stand in the opening (the hill face is a few metres behind it), and well inside it must stand above the roof
  for (let s = r.sMin + 300; s < r.sMax - 100; s += 1) if (r.tunnelW(s) >= PORTAL_W && r.tunnelW(s - 1) < PORTAL_W) {
    const p = r.at(s, {}), q = r.at(s + 14, {}), at0 = t.height(p.x, p.z) - p.y, in14 = t.height(q.x, q.z) - q.y;
    console.log(`${loc} doorway at s ${s}: land over the road ${at0.toFixed(1)} m at the portal, ${in14.toFixed(1)} m 14 m inside`);
    if (at0 > 3) problems.push(`${loc}: land stands ${at0.toFixed(1)} m over the road at the portal (doorway blocked)`); if (in14 < 9) problems.push(`${loc}: land is only ${in14.toFixed(1)} m over the road 14 m inside the tunnel (tube would show)`); break;
  }
  const tests = [['tunnel', find(s => r.tunnelW(s) === 1 && r.tunnelW(s - 60) === 1 && r.tunnelW(s + 60) === 1 && r.tunnelRise(s) > 6)], ['bridge', find(s => r.bridgeW(s) === 1 && r.bridgeW(s - 40) === 1 && r.bridgeW(s + 40) === 1)]];
  for (const [kind, s] of tests) {
    if (s === null) { console.log(loc, kind, 'none found'); continue; }
    for (const side of [-1, 1]) {
      const V = VEHICLES[0], ph = new RapierVehicle(vehicleParams(V.body, V.stats), V.id, world), p = r.at(s, {});
      // start on the centre line heading along the road, then steer hard to one side at 60 km/h
      ph.reset(p.x, p.z, p.th);
      for (let k = 0; k < 30; k++) ph.step(1 / 60, { steer: 0, throttle: 0, brake: 0, hand: 0 }); const y0 = ph.y - p.y;
      let maxOff = 0, minY = 1e9;
      for (let k = 0; k < 60 * 14; k++) { ph.step(1 / 60, { steer: k > 60 && k < 200 ? side * 0.6 : 0, throttle: ph.kmh < 60 ? 1 : 0.2, brake: 0, hand: 0 });
        if (r.nearest(ph.x, ph.z)) { maxOff = Math.max(maxOff, r.hit.d); } minY = Math.min(minY, ph.y); }
      console.log(`${loc} ${kind} side ${side}: farthest from centre line ${maxOff.toFixed(1)} m (road half ${r.style.half}, outer ${r.style.outer}), height vs deck at rest ${y0.toFixed(1)} m, at the end ${(ph.y - p.y).toFixed(1)} m, kmh ${ph.kmh.toFixed(0)}`);
      if (kind === 'tunnel' && maxOff > r.style.outer + 4) problems.push(`${loc}: the car got ${maxOff.toFixed(1)} m from the centre line inside a tunnel`);
      if (kind === 'bridge' && maxOff > r.style.outer + 1) problems.push(`${loc}: the car went over the bridge rail (${maxOff.toFixed(1)} m from the centre line)`);
      ph.free();
    }
  }
}
console.log(problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') : 'no problems found'); if (problems.length && check) process.exit(1);
