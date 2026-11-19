/* How the car turns: node tools/measure_turns.mjs. In a flat headless world it holds a speed, then applies full steering (and a keyboard-like half steer) and prints the circle it drives (radius, swept width of a U-turn), the yaw rate, and how long the car takes to start turning. Made for the owner's report that roads feel too narrow to turn in (19 Nov 2026). The numbers are for the real vehicle physics (Rapier vehicle), the same one the game drives. */
import { VEHICLES } from '../src/vehicle/defs.js';
import { vehicleParams } from '../src/vehicle/physics.js';
import { RapierVehicle, initRapier, ARCADE } from '../src/vehicle/rapier-vehicle.js';
await initRapier();
const world = () => ({ height: () => 0, surface: () => 'asphalt', near: () => [], seaLevel: -1e4 });
for (const a of process.argv.slice(3)) { const [k, v] = a.split('='); if (k in ARCADE) ARCADE[k] = +v; else if (k === 'steerMax') VEHICLES[0].body.steerMax = +v; }       // key=value overrides: ARCADE settings (maxYaw, gripMul, latGrip ...) or steerMax, to try numbers without editing files
const V = VEHICLES.find(v => v.id === (process.argv[2] || 'car')), p = vehicleParams(V.body, V.stats);
function run(kmh, steer, secs = 8) {
  const c = new RapierVehicle(p, V.id, world()); c.reset ? c.reset(0, 0, 0, 0) : 0; const dt = 1 / 60, tgt = kmh / 3.6;
  for (let i = 0; i < 60 * 12 && Math.abs(c.u) < tgt; i++) c.step(dt, { steer: 0, throttle: 1, brake: 0, hand: 0, rev: 0 });
  for (let i = 0; i < 60 * 4; i++) c.step(dt, { steer: 0, throttle: c.u < tgt ? 1 : 0.15, brake: 0, hand: 0, rev: 0 });            // settle at the speed
  const x0 = c.x, z0 = c.z, y0 = c.yaw, u0 = c.u, pts = []; let tStart = null;
  for (let i = 0; i < 60 * secs; i++) { c.step(dt, { steer, throttle: c.u < tgt ? 0.6 : 0.1, brake: 0, hand: 0, rev: 0 }); pts.push([c.x, c.z]); if (tStart === null && Math.abs(c.r) > 0.1) tStart = i * dt; }
  /* circle fit through the last 3 seconds */
  const P = pts.slice(-180); let sx = 0, sy = 0; for (const [x, y] of P) { sx += x; sy += y; } const mx = sx / P.length, my = sy / P.length; let sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0; for (const [x0_, y0_] of P) { const x = x0_ - mx, y = y0_ - my, z = x * x + y * y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; }
  const d = sxx * syy - sxy * sxy, a = (sxz * syy - syz * sxy) / d / 2, b = (syz * sxx - sxz * sxy) / d / 2, R = Math.sqrt(a * a + b * b + sz / P.length);
  return { kmh, steer, R: +R.toFixed(1), speedAfter: +(c.u * 3.6).toFixed(0), yawRate: +c.r.toFixed(2), latG: +(c.u * c.r / 9.81).toFixed(2), tStart: tStart === null ? null : +tStart.toFixed(2) };
}
console.log(V.id, 'steerMax', V.body.steerMax, 'wheelbase', (V.body.front + V.body.rear).toFixed(2));
for (const kmh of [10, 20, 30, 40, 50, 60, 80]) { const f = run(kmh, 1), h = run(kmh, 0.5); console.log(`${String(kmh).padStart(3)} km/h  full lock: radius ${f.R} m (U-turn width about ${(2 * f.R + 2.2).toFixed(0)} m), ${f.latG} g, held ${f.speedAfter} km/h   half lock: radius ${h.R} m`); }
