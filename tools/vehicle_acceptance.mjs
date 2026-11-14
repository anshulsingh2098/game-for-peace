/* Vehicle acceptance numbers (N1 of the Master Plan): the same measurements for every vehicle, so handling work is judged on numbers and not only by feel.
   Run: node tools/vehicle_acceptance.mjs [car|truck|bike]
   It drives each vehicle in a flat headless world and prints: acceleration, top speed, braking distance, steady cornering, handbrake slide, how the surface changes
   acceleration, a 10% hill, and whether two identical runs give identical results (repeatability). With --check it exits 1 if a limit is broken (used by the self-test). */
import { VEHICLES } from '../src/vehicle/defs.js';
import { vehicleParams, SURFACES } from '../src/vehicle/physics.js';
import { RapierVehicle, initRapier } from '../src/vehicle/rapier-vehicle.js';

const only = process.argv.find(a => ['car', 'truck', 'bike'].includes(a)), check = process.argv.includes('--check');
await initRapier();
const world = (surface = 'asphalt', slope = 0) => ({ height: x => slope * x, surface: () => surface, near: () => [], seaLevel: -1e4 });
const make = (i, w) => { const V = VEHICLES[i], p = vehicleParams(V.body, V.stats); return new RapierVehicle(p, V.id, w || world()); };
const run = (ph, secs, input, each) => { for (let k = 0; k < secs * 60; k++) { ph.step(1 / 60, typeof input === 'function' ? input(ph, k) : input); if (each) each(ph, k); } };
const GO = { steer: 0, throttle: 1, brake: 0, hand: 0, rev: 0 };
const fixed = (x, n = 1) => Number.isFinite(x) ? x.toFixed(n) : String(x);
const problems = [];

for (let i = 0; i < VEHICLES.length; i++) {
  const V = VEHICLES[i]; if (only && V.id !== only) continue;
  const topKmh = V.stats.Top, mark = {}, out = { id: V.id };

  // acceleration and top speed (flat, straight, full throttle)
  { const ph = make(i); let t = 0; run(ph, 70, GO, p => { t += 1 / 60; for (const k of [50, 100, 160, 200]) if (!mark[k] && p.kmh >= k) mark[k] = +t.toFixed(1); out.top = Math.max(out.top || 0, p.kmh); }); out.t = mark; out.gears = ph.gear + 1; ph.free(); }

  // braking from 100 km/h (or 80% of top for slow vehicles), straight
  { const from = Math.min(100, topKmh * 0.8), ph = make(i); run(ph, 60, p => ({ ...GO, throttle: p.kmh < from ? 1 : 0.1 })); const s0 = ph.kmh; let d = 0, drift = 0; run(ph, 20, { steer: 0, throttle: 0, brake: 1, hand: 0 }, p => { if (p.kmh > 1) d += p.u / 60; drift = Math.max(drift, Math.abs(p.z)); }); out.brake = { from: Math.round(s0), metres: Math.round(d), offLine: +drift.toFixed(2) }; ph.free(); }

  // steady cornering at 60% of top, steering 0.5: lateral g reached, slip, no spin
  { const ph = make(i); run(ph, 60, p => ({ ...GO, throttle: p.kmh < topKmh * 0.6 ? 1 : 0.2 })); let g = 0, slip = 0; run(ph, 4, { steer: 0.5, throttle: 0.25, brake: 0 }, p => { g = Math.max(g, Math.abs(p.ay) / 9.81); slip = Math.max(slip, p.slip); }); out.corner = { g: +g.toFixed(2), slip: +slip.toFixed(2), exitKmh: Math.round(ph.kmh) }; if (slip > 1.0) problems.push(V.id + ' spins in a steady corner (slip ' + fixed(slip, 2) + ')'); ph.free(); }

  // handbrake flick at 40% of top: how far the tail steps out, and does it recover when released
  if (V.id !== 'bike') { const ph = make(i); run(ph, 60, p => ({ ...GO, throttle: p.kmh < topKmh * 0.4 ? 1 : 0.2 })); let slip = 0; run(ph, 2, k => ({ steer: 0.8, throttle: 0.2, brake: 0, hand: 1 }), p => { slip = Math.max(slip, p.slip); }); run(ph, 5, { steer: 0, throttle: 0.3, brake: 0, hand: 0 }); out.handbrake = { slip: +slip.toFixed(2), recoveredSlip: +ph.slip.toFixed(2) }; ph.free(); }

  // surfaces: speed after 8 s of full throttle on each
  { const row = {}; for (const key of ['asphalt', 'gravel', 'grass', 'snow']) { if (!SURFACES[key]) continue; const ph = make(i, world(key)); run(ph, 8, GO); row[key] = Math.round(ph.kmh); ph.free(); } out.after8s = row; if (row.asphalt && row.grass && row.grass >= row.asphalt) problems.push(V.id + ' is no slower on grass than on asphalt'); }

  // a 10% hill, parked: does it hold, and can it climb
  { const hold = make(i, world('asphalt', 0.1)); run(hold, 6, { steer: 0, throttle: 0, brake: 0, hand: 0 }); const rolled = Math.abs(hold.x); hold.free(); const up = make(i, world('asphalt', 0.1)); run(up, 20, GO); out.hill = { parkedRolledMetres: +rolled.toFixed(2), climbedKmh: Math.round(up.kmh) }; if (rolled > 1) problems.push(V.id + ' rolls away when parked on a 10% hill'); if (up.kmh < 5) problems.push(V.id + ' cannot climb a 10% hill'); up.free(); }

  // repeatability: two identical runs must agree exactly
  { const a = make(i), b = make(i); const inp = (p, k) => ({ steer: Math.sin(k / 50) * 0.4, throttle: k < 400 ? 1 : 0.3, brake: 0, hand: k > 600 && k < 640 ? 1 : 0 }); run(a, 14, inp); run(b, 14, inp); out.repeat = Math.abs(a.x - b.x) + Math.abs(a.z - b.z) + Math.abs(a.u - b.u); if (out.repeat > 1e-6) problems.push(V.id + ' is not repeatable: runs differ by ' + out.repeat); a.free(); b.free(); }

  // telemetry sanity
  { const ph = make(i); run(ph, 6, GO); const T = ph.telemetry(); const ok = Number.isFinite(T.speed) && Math.abs(T.kmh - T.u * 3.6) < 1e-9 && T.grounded > 0 && (T.rpm === null || (T.rpm >= V.body.pt.idle * 0.99 && T.rpm <= V.body.pt.redline * 1.01)); if (!ok) problems.push(V.id + ' telemetry out of range: ' + JSON.stringify(T)); out.telemetry = { gear: T.gear, rpm: T.rpm && Math.round(T.rpm), grounded: T.grounded }; ph.free(); }

  console.log(JSON.stringify(out));
}
if (problems.length) { console.log('PROBLEMS:\n  ' + problems.join('\n  ')); if (check) process.exit(1); } else console.log('no problems found');
