/* Free-roam vehicle physics. Lightweight and pure maths (no three.js), so it runs in the self-test too.
   The vehicle is a "bicycle model": one front and one rear axle, each with tyres that can only push so hard
   before they slide (the grip limit, which depends on the surface). It lives in world coordinates:
     x, z      position (metres)          yaw   heading (radians; forward is (cos yaw, sin yaw), right turn is +)
     u, v      speed forward and sideways (to the right), m/s      r   yaw rate
     y, pitch, roll    taken from the ground under the wheels
   The world object supplies height(x, z), surface(x, z) -> a key of SURFACES, near(x, z, radius) -> lists of
   collision circles {x, z, r}, seaLevel, and optionally grip(surface) -> a 0..1 factor for the weather. */

export const SURFACES = {
  asphalt: { name: 'Road',   grip: 1.00, drag: 0.012 },
  gravel:  { name: 'Gravel', grip: 0.74, drag: 0.050 },
  grass:   { name: 'Grass',  grip: 0.55, drag: 0.150 },
  sand:    { name: 'Sand',   grip: 0.48, drag: 0.300 },
  rock:    { name: 'Rock',   grip: 0.70, drag: 0.040 },
  snow:    { name: 'Snow',   grip: 0.36, drag: 0.100 }
};
const G = 9.81, H = 1 / 120;                                    // gravity; fixed physics step
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* turn a vehicle's garage stats and body measurements into physics numbers */
export function vehicleParams(body, stats) {
  const L = body.front + body.rear;
  return {
    ...body, L, cg: body.cg || 0.5, mass: body.mass, Iz: body.mass * (0.45 * L) ** 2,
    top: stats.Top / 3.6, accel: 0.8 + stats.Accel * 0.05,     // top speed (m/s) and standing-start acceleration (m/s2)
    mu: 0.72 + stats.Grip * 0.005,                             // tyre grip on dry asphalt: the Grip stat is real now
    stiff: 8 + stats.Handling * 0.06                           // how sharply the tyres answer the steering: the Handling stat
  };
}

/* The one definition of what a vehicle reports about itself (HUD, sound, tests and tools all read this; see VEHICLE_CONTRACT.md for the full table).
   Works for both physics classes; fields the physics does not have are null. Units: m/s, radians, rpm, 0..1 as marked. */
export function makeTelemetry(ph, id) {
  const inp = ph.input || {}, pt = ph.p && ph.p.pt, wheels = ph.wheelStates, contact = wheels ? wheels.filter(w => w.contact).length / wheels.length : 1;
  let wheelSlip = null; if (ph.alpha && ph.alpha.length) { wheelSlip = 0; for (const a of ph.alpha) if (Math.abs(a) > wheelSlip) wheelSlip = Math.abs(a); }
  return {
    id, x: ph.x, z: ph.z, yaw: ph.yaw,
    speed: Math.hypot(ph.u, ph.v), u: ph.u, v: ph.v, kmh: ph.u * 3.6,                  // speed m/s (never negative); u signed forward speed m/s (negative reversing); v sideways m/s
    throttle: inp.throttle || 0, brake: inp.brake || 0, hand: inp.hand || 0, steerInput: inp.steer || 0,       // what the driver asked for: 0..1, 0..1, 0..1, -1..1 (right +)
    steerAngle: ph.delta, yawRate: ph.r,                                                    // front road-wheel angle rad; yaw rate rad/s
    gear: pt && ph.gear !== undefined ? ph.gear : null, gearCount: pt ? pt.gears.length : null,   // gear: 0 = first; null when the vehicle has no gearbox model
    rpm: pt && ph.rpm !== undefined ? ph.rpm : null, rpm01: pt && ph.rpm !== undefined ? Math.max(0, Math.min(1, (ph.rpm - pt.idle) / (pt.redline - pt.idle))) : null,   // engine rpm; and 0..1 between idle and the rev limiter
    slip: ph.slip, wheelSlip,                                                               // body sideslip angle rad; the largest wheel slip angle rad (null on the old physics)
    surface: ph.surface, grounded: contact,                                                // surface key; share of wheels touching the ground 0..1
    buff: !!ph.mod && ph.mod !== NO_MOD                                                    // a buff (boost, haul, lean) is active
  };
}

/* temporary multipliers (buffs): top speed, acceleration, pull of slopes, surface drag, steering lock, grip */
export const NO_MOD = { top: 1, accel: 1, slope: 1, drag: 1, steer: 1, grip: 1 };

/* Drive modes, as on a modern car (docs/DRIVE_MODES.md). A mode is a set of multipliers plus a few settings, kept apart from a buff (boost, haul, lean) so both can be on at once.
     cap      speed limiter, km/h (0 = none): the engine fades out as the limit nears, so the car settles at it
     accel    engine force multiplier; pedal  throttle map exponent (above 1 = softer at part throttle, below 1 = sharper)
     steer    steering authority at speed; shift  scales the up-shift point (below 1 = early shifts, above = holds the gear); tcs  traction limit (above 1 = traction control relaxed)
     regen    engine-braking strength when you lift off (one-pedal feel); loose  grip multiplier on loose ground (gravel, grass, snow, sand); hdc  hill descent: speed (m/s) held on a steep
     downhill with no pedals touched (0 = off). */
export const DRIVE_MODES = {
  eco:     { id: 'eco', name: 'Eco', top: 1, accel: 0.8, steer: 0.96, grip: 1, drag: 0.92, cap: 110, pedal: 1.7, shift: 0.86, tcs: 0.9, regen: 1.7, loose: 1, hdc: 0, blurb: 'Softer throttle, early shifts, stronger coasting, speed limited to 110 km/h' },
  normal:  { id: 'normal', name: 'Normal', top: 1, accel: 1, steer: 1, grip: 1, drag: 1, cap: 0, pedal: 1, shift: 1, tcs: 1, regen: 1, loose: 1, hdc: 0, blurb: 'Balanced' },
  sport:   { id: 'sport', name: 'Sport', top: 1, accel: 1.1, steer: 1.12, grip: 1, drag: 1, cap: 0, pedal: 0.75, shift: 1.03, tcs: 1.18, regen: 1.1, loose: 1, hdc: 0, blurb: 'Sharper throttle, holds gears, quicker steering, traction control relaxed, no limiter' },
  offroad: { id: 'offroad', name: 'Off-road', top: 1, accel: 1.15, steer: 1, grip: 1, drag: 0.85, cap: 85, pedal: 1.3, shift: 0.85, tcs: 1.05, regen: 1.4, loose: 1.3, hdc: 3.2, blurb: 'Low-range pull, grip on loose ground, hill descent control, speed limited to 85 km/h' }
};
export const DRIVE_MODE_IDS = ['eco', 'normal', 'sport', 'offroad'];
/* the multipliers physics uses: a buff's (mod) and the drive mode's together */
export function combineMods(mod, dm) {
  return { top: mod.top * dm.top, accel: mod.accel * dm.accel, slope: mod.slope, drag: mod.drag * dm.drag, steer: mod.steer * dm.steer, grip: mod.grip * dm.grip,
    cap: dm.cap / 3.6, pedal: dm.pedal, shift: dm.shift, tcs: dm.tcs, regen: dm.regen, loose: dm.loose, hdc: dm.hdc };
}

export class VehiclePhysics {
  constructor(params, world) { this.p = params; this.world = world; this.acc = 0; this.mod = NO_MOD; this.dm = DRIVE_MODES.normal; this.M = combineMods(NO_MOD, this.dm); this.reset(0, 0, 0); }
  /* apply a buff's multipliers, or clear them with no argument */
  setMod(mod) { this.mod = mod ? { ...NO_MOD, ...mod } : NO_MOD; this.M = combineMods(this.mod, this.dm); }
  setDriveMode(id) { this.dm = DRIVE_MODES[id] || DRIVE_MODES.normal; this.M = combineMods(this.mod, this.dm); }
  reset(x, z, yaw, yHint) {
    Object.assign(this, { x, z, yaw, u: 0, v: 0, r: 0, steer: 0, delta: 0, pitch: 0, roll: 0, lean: 0, spin: 0, slip: 0, ay: 0, impact: 0, wet: 0, stuck: 0, surface: 'asphalt', acc: 0, afS: 0, arS: 0, axL: 0, dPitch: 0, dRoll: 0 });
    this.y = this.world.height(x, z, yHint); this.ground(1);
  }
  get speed() { return Math.hypot(this.u, this.v); }
  get kmh() { return this.u * 3.6; }

  /* advance by dt seconds of real time, in fixed steps. input: { steer -1..1, throttle 0..1, brake 0..1 } */
  step(dt, input) {
    this.acc += Math.min(dt, 0.1); this.impact = 0;
    while (this.acc >= H) { this.sub(input); this.acc -= H; }
  }
  /* ground under the four corners: body height, pitch and roll (k = 1 snaps, smaller eases) */
  ground(k) {
    const p = this.p, W = this.world, c = Math.cos(this.yaw), s = Math.sin(this.yaw), ht = p.track / 2;
    const fx = this.x + c * p.front, fz = this.z + s * p.front, bx = this.x - c * p.rear, bz = this.z - s * p.rear;      // right of travel is (-s, c)
    const yh = this.y, fl = W.height(fx + s * ht, fz - c * ht, yh), fr = W.height(fx - s * ht, fz + c * ht, yh), bl = W.height(bx + s * ht, bz - c * ht, yh), br = W.height(bx - s * ht, bz + c * ht, yh);
    this.gPitch = Math.atan2((fl + fr - bl - br) / 2, p.L); this.gRoll = Math.atan2((fl + bl - fr - br) / 2, p.track);
    const y = (fl + fr) / 2 * (p.rear / p.L) + (bl + br) / 2 * (p.front / p.L);
    this.y += (y - this.y) * Math.max(k, 0.85); this.pitch += (this.gPitch - this.pitch) * Math.max(k, 0.35); this.roll += (this.gRoll - this.roll) * Math.max(k, 0.35); this.groundY = y;   // the body stays on the ground (no lag, so it never sinks into a climb); tilt eases a little
  }
  sub(input) {
    const p = this.p, W = this.world, h = H, m = p.mass, M = this.M, top = Math.min(p.top * M.top, M.cap > 0 ? M.cap : Infinity);
    /* steering: the wheel is turned at a limited rate (slower at speed, quick to come back to centre), and the lock shrinks with speed like a real car's effective steering */
    const want = clamp(input.steer, -1, 1), back = Math.abs(want) < Math.abs(this.steer) || want * this.steer < 0, rate = back ? 8 : 5.5 / (1 + Math.abs(this.u) / 14);
    this.steer += clamp(want - this.steer, -rate * h, rate * h);
    this.delta = this.steer * Math.min(p.steerMax, 1.7 * M.steer * p.mu * G * p.L / Math.max(this.u * this.u, 1));     // full lock when slow; at speed about what the tyres can use (a little more, so you can run wide)
    this.ground(Math.min(1, h * 14));
    const key = W.surface(this.x, this.z); this.surface = key; const S = SURFACES[key] || SURFACES.grass;
    const depth = W.seaLevel - this.groundY; this.wet = depth > 0 ? depth : 0;
    const mu = p.mu * S.grip * (depth > 0.3 ? 0.6 : 1) * (W.grip ? W.grip(key) : 1) /* weather on the tyres; 1 when dry */ * M.grip, N = m * G * Math.cos(this.gPitch);

    /* forward force: engine, brakes, reverse */
    let Fx = 0; const thr = clamp(input.throttle, 0, 1), brk = clamp(Math.max(input.brake, input.rev || 0), 0, 1), flooded = depth > 1.1;
    if (thr > 0 && !flooded) Fx = this.u < -0.4 ? m * p.brake * thr : m * p.accel * M.accel * thr * Math.max(0, 1 - (this.u / top) ** 2);
    else if (brk > 0) Fx = this.u > 0.5 ? -m * p.brake * brk : flooded ? 0 : -m * p.revAccel * brk * Math.max(0, 1 - (this.u / p.revTop) ** 2);
    else Fx = -m * 0.55 * clamp(this.u, -1, 1);                                     // engine braking when coasting
    Fx = clamp(Fx, -mu * N, mu * N);                                                // the tyres can only push so hard
    const roll = -m * G * (S.drag * M.drag + (depth > 0 ? Math.min(1.2, depth * 1.4) : 0)) * clamp(this.u / 0.5, -1, 1);
    const air = -p.aero * this.u * Math.abs(this.u);
    const Fg = -m * G * Math.sin(this.gPitch) * M.slope, Fside = m * G * Math.sin(this.gRoll);          // slopes pull the car back and sideways

    /* sideways forces from the tyres (above walking pace); below it the car simply follows its front wheels */
    const blend = sstep(3, 6, this.u); let dv = 0, dr = 0;
    if (blend > 0) {
      const a = p.front, b = p.rear, C = p.stiff, dN = clamp(m * this.axL * p.cg / p.L, -0.3 * N, 0.3 * N);       // weight moves to the rear under power and to the front under braking
      const Nf0 = N * b / p.L, Nr0 = N * a / p.L, Nf = Nf0 - dN, Nr = Nr0 + dN;       // stiffness follows the static loads (keeps the car stable); the grip limit follows the moving ones
      const af = this.delta - Math.atan2(this.v + a * this.r, this.u), ar = -Math.atan2(this.v - b * this.r, this.u);
      const k = Math.min(1, Math.abs(this.u) * h / 0.12); this.afS += (af - this.afS) * k; this.arS += (ar - this.arS) * k;   // tyres take a moment to build side force (relaxation length)
      const muF = mu * 0.9;                                                         // the front lets go a little before the rear, so the car runs wide instead of spinning
      const roomF = Fx < 0 ? Math.sqrt(Math.max(0, (muF * Nf) ** 2 - (0.6 * Fx * 0.65) ** 2)) : muF * Nf;                      // hard braking uses up front grip too
      const Fyf = clamp(C * Nf0 * this.afS, -roomF, roomF), room = Math.sqrt(Math.max(0, (mu * Nr) ** 2 - (0.7 * Fx) ** 2));      // driving or braking hard uses up rear grip
      const Fyr = clamp(C * 1.15 * Nr0 * this.arS, -room, room);
      dv = (Fyf * Math.cos(this.delta) + Fyr + Fside) / m - this.u * this.r; dr = (a * Fyf * Math.cos(this.delta) - b * Fyr) / p.Iz;
      this.slip = Math.max(Math.abs(af), Math.abs(ar)); this.ay = (Fyf * Math.cos(this.delta) + Fyr) / m;      // sideways acceleration from the tyres
    } else { this.slip = 0; this.ay = this.u * this.r; }
    const ax = (Fx + roll + air) / m; this.axL += (ax - this.axL) * Math.min(1, h * 6);
    this.dPitch += (this.axL * 0.016 * p.cg - this.dPitch) * Math.min(1, h * 7); this.dRoll += (this.ay * 0.016 * p.cg * (1 - Math.min(1, p.lean)) - this.dRoll) * Math.min(1, h * 7);   // the body squats, dives and leans on its springs
    this.u += ((Fx + roll + air + Fg) / m + this.v * this.r) * h;
    const vDyn = this.v + dv * h, rDyn = this.r + dr * h;
    const rKin = this.u * Math.tan(this.delta) / p.L, vKin = this.v * (1 - Math.min(1, h * 8)) + (Math.abs(this.gRoll) > 0.5 ? Fside / m * h : 0);     // very steep side slopes still slide you
    this.v = vKin + (vDyn - vKin) * blend; this.r = rKin + (rDyn - rKin) * blend;
    this.u = clamp(this.u, -p.revTop * 1.1, Math.max(top * 1.08, this.u - 6 * h));          // when a speed buff ends, the extra speed bleeds off instead of vanishing

    /* parked: with no input, on a slope the tyres can hold, stay put */
    if (!thr && !brk && Math.abs(this.u) < 0.25 && Math.abs(Fg) < mu * N * 0.9 && Math.abs(this.gRoll) < 0.5) { this.u = 0; this.v = 0; this.r = 0; }

    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this.yaw += this.r * h; this.x += (this.u * c - this.v * s) * h; this.z += (this.u * s + this.v * c) * h;
    this.spin += this.u * h / p.wheelR;
    this.lean += (clamp(Math.atan(this.u * this.r / G), -0.8, 0.8) * p.lean - this.lean) * Math.min(1, h * 6);   // bikes lean into a turn; cars barely
    this.stuck = flooded ? this.stuck + h : 0;
    this.collide();
  }
  /* trees and rocks: push the body out of them and take away the speed that was going in */
  collide() {
    const p = this.p, lists = this.world.near(this.x, this.z, p.front + p.rear + 3); if (!lists.length) return;
    let c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    for (const off of p.circles) {
      const cx = this.x + c * off, cz = this.z + s * off;
      for (const list of lists) for (let i = 0; i < list.length; i++) {
        const o = list[i], dx = cx - o.x, dz = cz - o.z, rr = p.radius + o.r, d2 = dx * dx + dz * dz; if (d2 >= rr * rr || d2 === 0) continue;
        if (o.y !== undefined && Math.abs(o.y - this.y) > 3.2) continue;                  // the other level of an overpass
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = rr - d;
        this.x += nx * pen; this.z += nz * pen;
        const wx = this.u * c - this.v * s, wz = this.u * s + this.v * c, vn = wx * nx + wz * nz; if (vn >= 0) continue;
        const ax = wx - 1.2 * vn * nx, az = wz - 1.2 * vn * nz;                    // a dull thud: almost no bounce
        this.u = (ax * c + az * s) * 0.85; this.v = (-ax * s + az * c) * 0.6; this.r += (-s * nx + c * nz) * off * -vn * 0.02;
        this.impact = Math.max(this.impact, -vn);
      }
    }
  }
}
