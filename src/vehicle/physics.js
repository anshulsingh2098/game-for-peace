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
  gravel:  { name: 'Gravel', grip: 0.76, drag: 0.030 },
  grass:   { name: 'Grass',  grip: 0.62, drag: 0.060 },
  sand:    { name: 'Sand',   grip: 0.50, drag: 0.140 },
  rock:    { name: 'Rock',   grip: 0.70, drag: 0.040 },
  snow:    { name: 'Snow',   grip: 0.36, drag: 0.070 }
};
const G = 9.81, H = 1 / 120;                                    // gravity; fixed physics step
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* turn a vehicle's garage stats and body measurements into physics numbers */
export function vehicleParams(body, stats) {
  const L = body.front + body.rear;
  return {
    ...body, L, mass: body.mass, Iz: body.mass * (0.45 * L) ** 2,
    top: stats.Top / 3.6, accel: 0.8 + stats.Accel * 0.05,     // top speed (m/s) and standing-start acceleration (m/s2)
    mu: 0.72 + stats.Grip * 0.005,                             // tyre grip on dry asphalt: the Grip stat is real now
    stiff: 8 + stats.Handling * 0.06                           // how sharply the tyres answer the steering: the Handling stat
  };
}

/* temporary multipliers (buffs): top speed, acceleration, pull of slopes, surface drag, steering lock, grip */
export const NO_MOD = { top: 1, accel: 1, slope: 1, drag: 1, steer: 1, grip: 1 };

export class VehiclePhysics {
  constructor(params, world) { this.p = params; this.world = world; this.acc = 0; this.mod = NO_MOD; this.reset(0, 0, 0); }
  /* apply a buff's multipliers, or clear them with no argument */
  setMod(mod) { this.mod = mod ? { ...NO_MOD, ...mod } : NO_MOD; }
  reset(x, z, yaw) {
    Object.assign(this, { x, z, yaw, u: 0, v: 0, r: 0, steer: 0, delta: 0, pitch: 0, roll: 0, lean: 0, spin: 0, slip: 0, ay: 0, impact: 0, wet: 0, stuck: 0, surface: 'asphalt', acc: 0 });
    this.y = this.world.height(x, z); this.ground(1);
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
    const fl = W.height(fx + s * ht, fz - c * ht), fr = W.height(fx - s * ht, fz + c * ht), bl = W.height(bx + s * ht, bz - c * ht), br = W.height(bx - s * ht, bz + c * ht);
    this.gPitch = Math.atan2((fl + fr - bl - br) / 2, p.L); this.gRoll = Math.atan2((fl + bl - fr - br) / 2, p.track);
    const y = (fl + fr) / 2 * (p.rear / p.L) + (bl + br) / 2 * (p.front / p.L);
    this.y += (y - this.y) * Math.max(k, 0.85); this.pitch += (this.gPitch - this.pitch) * Math.max(k, 0.35); this.roll += (this.gRoll - this.roll) * Math.max(k, 0.35); this.groundY = y;   // the body stays on the ground (no lag, so it never sinks into a climb); tilt eases a little
  }
  sub(input) {
    const p = this.p, W = this.world, h = H, m = p.mass, M = this.mod, top = p.top * M.top;
    this.steer += (clamp(input.steer, -1, 1) - this.steer) * Math.min(1, h * 7);
    this.delta = this.steer * Math.min(p.steerMax, 1.35 * M.steer * p.mu * G * p.L / Math.max(this.u * this.u, 1));     // full lock when slow; at speed only as much as dry tyres could use
    this.ground(Math.min(1, h * 14));
    const key = W.surface(this.x, this.z); this.surface = key; const S = SURFACES[key] || SURFACES.grass;
    const depth = W.seaLevel - this.groundY; this.wet = depth > 0 ? depth : 0;
    const mu = p.mu * S.grip * (depth > 0.3 ? 0.6 : 1) * (W.grip ? W.grip(key) : 1) /* weather on the tyres; 1 when dry */ * M.grip, N = m * G * Math.cos(this.gPitch);

    /* forward force: engine, brakes, reverse */
    let Fx = 0; const thr = clamp(input.throttle, 0, 1), brk = clamp(input.brake, 0, 1), flooded = depth > 1.1;
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
      const a = p.front, b = p.rear, Nf = N * b / p.L, Nr = N * a / p.L, C = p.stiff;
      const af = this.delta - Math.atan2(this.v + a * this.r, this.u), ar = -Math.atan2(this.v - b * this.r, this.u);
      const muF = mu * 0.88;                                                        // the front lets go a little before the rear, so the car runs wide instead of spinning
      const Fyf = clamp(C * Nf * af, -muF * Nf, muF * Nf), room = Math.sqrt(Math.max(0, (mu * Nr) ** 2 - (0.7 * Fx) ** 2));      // driving or braking hard uses up rear grip
      const Fyr = clamp(C * 1.15 * Nr * ar, -room, room);
      dv = (Fyf * Math.cos(this.delta) + Fyr + Fside) / m - this.u * this.r; dr = (a * Fyf * Math.cos(this.delta) - b * Fyr) / p.Iz;
      this.slip = Math.max(Math.abs(af), Math.abs(ar)); this.ay = (Fyf * Math.cos(this.delta) + Fyr) / m;      // sideways acceleration from the tyres
    } else { this.slip = 0; this.ay = this.u * this.r; }
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
