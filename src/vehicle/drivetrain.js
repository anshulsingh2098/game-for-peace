/* Drivetrain: engine, clutch and gearbox, with automatic or manual shifting. Pure maths (no three.js, no Rapier), so it runs in the self-test.
   It decides how hard the driven wheels push and how fast the engine turns; rapier-vehicle.js applies the force.

   Gear ratios are worked out from the vehicle's top speed: top gear reaches that speed at the rev limit, and the lower gears are spaced
   geometrically up to a first gear `spread` times shorter. The peak engine torque is set so first gear at peak revs gives about the
   vehicle's stated standing-start acceleration, so the garage stats still mean what they said.
     gear   -1 reverse, 0 neutral, 1..n forward        manual   you shift with shift(+1 / -1); otherwise it shifts itself
   The electric bike has one fixed gear and no revs to shift (ev: true). */
const PI = Math.PI;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

/* per vehicle: gears, first-to-top ratio spread, idle and limit revs (rpm), where the torque peaks (fraction of the limit), launch revs */
export const GEARBOX = {
  car:   { n: 6, spread: 4.7, idle: 850, red: 7200, peak: 0.62, launch: 0.42 },
  sport: { n: 6, spread: 4.9, idle: 900, red: 8400, peak: 0.70, launch: 0.44 },
  rally: { n: 6, spread: 4.5, idle: 1000, red: 7400, peak: 0.60, launch: 0.42 },
  truck: { n: 8, spread: 8.0, idle: 650, red: 2200, peak: 0.55, launch: 0.40 },
  bike:  { ev: true, n: 1 }
};
const ETA = 0.9;                                                  // drivetrain efficiency

/* torque as a fraction of the peak at x = revs / limit: a hump around `peak`, cut off at the limiter */
export function torqueCurve(x, peak) {
  if (x >= 1) return 0;
  return x < peak ? 0.55 + 0.45 * (1 - ((peak - x) / peak) ** 2) : 1 - 0.38 * ((x - peak) / (1 - peak)) ** 2;
}

export class Drivetrain {
  /* id: a key of GEARBOX; p: vehicleParams() (mass, wheelR, top, accel, revTop, ...) */
  constructor(id, p) {
    this.id = id; this.p = p; this.cfg = GEARBOX[id] || GEARBOX.car; this.ev = !!this.cfg.ev; this.n = this.cfg.n; this.manual = false;
    this.mod = { top: 1, accel: 1 }; this.red = this.cfg.red || 1; this.idle = this.cfg.idle || 0;
    if (!this.ev) {                                                                                                                                         // peak engine torque (N m, at the engine): enough for the stated standing-start pull, and enough that top gear can beat drag at the top speed
      const rr = this.ratios(p.top), resist = p.aero * p.top * p.top + 0.02 * p.mass * 9.81;
      this.tpk = Math.max(1.25 * p.mass * p.accel * p.wheelR / (rr[1] * ETA), 1.4 * resist * p.wheelR / (rr[this.n] * ETA * 0.6));
    }
    this.reset();
  }
  reset() { this.gear = 1; this.rpm = this.idle; this.cut = 0; this.lock = 0; this.blocked = 0; }
  setMod(m) { this.mod = { top: m && m.top || 1, accel: m && m.accel || 1 }; }
  /* total ratio engine : wheel for each gear 1..n, for a top speed topV (m/s). Index 0 unused. */
  ratios(topV) {
    const c = this.cfg, p = this.p, rTop = c.red * 2 * PI * p.wheelR / (60 * topV * 0.97), out = [0];
    for (let g = 1; g <= c.n; g++) out.push(c.n === 1 ? rTop : rTop * Math.pow(c.spread, (c.n - g) / (c.n - 1)));
    return out;
  }
  get rpm01() { return this.ev ? 0 : this.rpm / this.red; }
  get rev01() { return this.ev ? 0 : clamp((this.rpm - this.idle) / (this.red - this.idle), 0, 1.05); }          // 0 at idle, 1 at the limiter: what the engine sound follows
  get label() { return this.ev ? 'D' : this.gear < 0 ? 'R' : this.gear === 0 ? 'N' : (this.manual ? 'M' : 'D') + this.gear; }
  setManual(on) { this.manual = !!on; if (!on && this.gear === 0) this.gear = 1; }

  /* the driver shifts: +1 up, -1 down. Returns false if refused (the revs would be too high, or no such gear). */
  shift(d, u = 0) {
    if (this.ev) return false; const g = this.gear + d; if (g < -1 || g > this.n) return false;
    if (g > 0 && d < 0) { const rr = this.ratios(this.p.top * this.mod.top), after = Math.abs(u) * 60 / (2 * PI * this.p.wheelR) * rr[g]; if (after > this.red * 1.06) { this.blocked = 0.4; return false; } }   // a downshift into a screaming engine is refused
    if (g < 0 && u > 2) return false;                                                                                                                          // no reverse while rolling forward
    if (this.gear > 0 && g > 0) this.cut = this.manual ? 0.16 : 0.22; this.gear = g; this.lock = this.manual ? 0 : 0.55; return true;
  }

  /* one physics step. u forward speed (m/s), thr and brk 0..1, flooded: no drive in deep water.
     Returns the driven wheels' total force in N (forward positive; negative while reversing or engine braking). */
  update(h, u, thr, brk, flooded) {
    const p = this.p, M = this.mod, topV = p.top * M.top; this.cut = Math.max(0, this.cut - h); this.lock = Math.max(0, this.lock - h); this.blocked = Math.max(0, this.blocked - h);
    if (this.ev) {                                                                                                                                              // single speed: the old simple curve
      this.rpm = Math.abs(u) / topV * 1; if (flooded) return 0;
      if (thr > 0 && u > -0.4) return p.mass * p.accel * M.accel * thr * Math.max(0, 1 - (u / topV) ** 2);
      if (brk > 0 && u <= 0.5) return -p.mass * p.revAccel * brk * Math.max(0, 1 - (u / p.revTop) ** 2);
      return 0;
    }
    const c = this.cfg, R = p.wheelR, rr = this.ratios(topV), au = Math.abs(u), wheelRpmPer = 60 / (2 * PI * R);
    /* automatic: pick reverse or drive at a standstill, and shift by the revs */
    if (!this.manual) {
      if (this.gear <= 0) { if (thr > 0 && u > -0.6) this.gear = 1; }
      else if (brk > 0 && thr === 0 && u < 0.6) this.gear = -1;
      if (this.gear < 0 && thr > 0 && u > -0.5) this.gear = 1;
      if (this.gear > 0 && this.lock <= 0 && this.cut <= 0) {
        const x = this.rpm / this.red;
        if (this.gear < this.n && x > 0.80 + 0.14 * thr) this.shift(+1, u);
        else if (this.gear > 1) { const after = au * wheelRpmPer * rr[this.gear - 1]; if ((x < 0.30 || (thr > 0.8 && x < 0.46)) && after < 0.9 * this.red) this.shift(-1, u); }
      }
    }
    const g = this.gear, gr = g > 0 ? rr[g] : g < 0 ? rr[1] * 1.15 : 0, rpmWheel = au * wheelRpmPer * gr;
    let force = 0, target = this.idle;
    if (gr === 0) target = this.idle + thr * (this.red - this.idle) * 0.85;                                                                              // neutral: the engine revs freely
    else {
      const launch = this.idle + (c.launch * this.red - this.idle) * thr;                                                                                  // clutch slip while pulling away
      const eng = this.cut > 0 ? rpmWheel : Math.max(rpmWheel, launch); target = Math.max(this.idle, eng);
      const x = eng / this.red, sgn = g < 0 ? -1 : 1;
      if (thr > 0 && !flooded && this.cut <= 0 && !(g < 0 && u < -p.revTop) && !(g > 0 && u < -0.4) && !(g < 0 && u > 0.4)) { const cap = 1.6 * p.mass * p.accel * M.accel; force = clamp(sgn * thr * this.tpk * M.accel * torqueCurve(x, c.peak) * gr / R * ETA, -cap, cap); }        // the cap stands in for traction control: low gears do not pull harder than ~1.6x the stated acceleration
      else if (thr < 0.02 && au > 0.5) { const over = rpmWheel > this.red * 1.02 ? 2.2 : 1; force = -Math.sign(u) * this.tpk * 0.11 * clamp(eng / this.red, 0.15, 1.2) * gr / R * over; }      // engine braking
      if (rpmWheel > this.red * 1.02 && thr > 0) force = Math.min(force, 0);                                                                              // over the limiter
    }
    this.rpm += (target - this.rpm) * (1 - Math.exp(-h * (target > this.rpm ? 14 : 8)));
    return force;
  }
}
