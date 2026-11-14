/* The road: routed through the terrain, then smoothed, then the land is graded to meet it.
   - Routing is predictive: at every 20 m step the router looks a few hundred metres down a fan of headings and
     scores each for steepness, side slope, water, altitude and how sharply it has to turn, then takes the best.
   - A long-range scout picks the general heading every 60 m by looking 1.5 km ahead, so the road turns away from
     the sea and from mountains long before it reaches them.
   - It grows both ways from the start point (road distance s is positive one way, negative the other). Each arm
     may swing only so far from its first bearing and steers away from road that already exists, so it does not
     loop back over itself.
   - Smoothing: heights are averaged along the road and limited to a maximum grade; the centre line is a
     Catmull-Rom spline through the nodes.
   - Grading: grade(x, z, natural) returns the land height with the road cut or filled into it.
   Everything is a pure function of the seed, generated on demand as far as it is asked for. */
import { createNoise } from '../core/noise.js';

const SUB = 4;                                                  // spline samples per node step, used for distance queries
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
const crd = (p0, p1, p2, p3, t) => 0.5 * ((-p0 + p2) + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t + 3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t * t);

import { roadStyleById } from './roadstyles.js';

export class Road {
  constructor(terrain, config) {
    this.t = terrain; this.c = config.road; this.sea = terrain.seaLevel; this.step = this.c.step; this.ds = this.step / SUB;
    this.maxTurn = this.step / this.c.minRadius; this.noise = createNoise(config.seed + ':road');
    this.style = roadStyleById(this.c.style); this.g = this.style.grade;       // widths come from the style
    this.cell = 32; this.reach = this.g.blend + 2; this.cells = new Map(); this.hit = { d: 0, s: 0, y: 0 };
    const p = terrain.findSpawn(), h0 = terrain.base(p.x, p.z);
    let best = 0, bestCost = Infinity;                          // first bearing: the gentlest line through the start point
    for (let a = 0; a < 16; a++) {
      const ang = a / 16 * Math.PI, dx = Math.cos(ang), dz = Math.sin(ang); let cost = 0;
      for (const sgn of [1, -1]) { let hp = h0; for (let k = 1; k <= 25; k++) { const h = terrain.base(p.x + dx * k * this.step * sgn, p.z + dz * k * this.step * sgn), g = (h - hp) / this.step; cost += g * g + (h < this.sea + 4 ? 0.05 : 0); hp = h; } }
      if (cost < bestCost) { bestCost = cost; best = ang; }
    }
    const arm = (dir, th) => ({ dir, th, bearing: th, axis: th, target: th, prevTurn: 0, n: [{ x: p.x, z: p.z, h: h0 }], Y: [], sx: [], sy: [], sz: [], done: 0 });
    this.A = arm(1, best); this.B = arm(-1, best + Math.PI);
    const W = this.c.smooth; while (this.A.n.length < W + 4) this.grow(this.A); while (this.B.n.length < W + 4) this.grow(this.B);
    this.sMin = 0; this.sMax = 0; this.ensure(-this.step * 4, this.step * 4);
  }

  /* Long-range scouting: every few steps, look up to 1.5 km down a wide fan of directions at coarse spacing and
     pick the heading with the least water, climbing and high ground. The short-range steering then aims for it. */
  scout(arm) {
    const c = this.c, T = this.t, last = arm.n[arm.n.length - 1], sea = this.sea, wet = sea + c.clearance + 1; let best = arm.axis, bestCost = Infinity;
    for (let d = -7; d <= 7; d++) {
      const ang = arm.axis + d * 0.17; if (Math.abs(wrap(ang - arm.bearing)) > c.swing) continue;
      const dx = Math.cos(ang), dz = Math.sin(ang); let cost = 0.25 * (d * 0.17) ** 2 + 0.6 * wrap(ang - arm.th) ** 2, hp = last.h, w = 1;
      for (let k = 1; k <= c.scout; k++) {
        const x = last.x + dx * k * 100, z = last.z + dz * k * 100, h = T.base(x, z), g = (h - hp) / 100, over = Math.abs(g) - c.maxGrade;
        cost += w * (6 * g * g + (over > 0 ? 800 * over * over : 0));
        if (h < wet) cost += w * (30 + Math.min(20, (wet - h) * 1.5));      // water outweighs any hill
        const up = h - sea - c.maxAlt; if (up > 0) cost += w * 1.5 * (up / 40) ** 2;
        if (k >= 2 && this.nearest(x, z)) cost += 3;            // heading back towards road that already exists
        hp = h; w *= 0.93;
      }
      if (cost < bestCost) { bestCost = cost; best = ang; }
    }
    arm.target = best;
  }
  /* one routing step for one arm */
  grow(arm) {
    const c = this.c, T = this.t, step = this.step, last = arm.n[arm.n.length - 1], sea = this.sea, wet = sea + c.clearance + 1;
    if ((arm.n.length - 1) % 3 === 0) this.scout(arm);
    arm.axis += Math.max(-0.06, Math.min(0.06, wrap(arm.target - arm.axis)));                                     // the allowed cone turns slowly towards the scouted heading
    const wander = this.noise.n2(arm.n.length * 0.045 + (arm.dir > 0 ? 3.1 : 91.7), 7.7) * this.maxTurn * 0.5;     // a slow sway, so flat land still gets curves
    const steep = c.maxGrade * 0.75; let best = 0, bestCost = Infinity;
    for (let k = -4; k <= 4; k++) {
      /* the turn may only change a little from step to step (no sudden kinks), and may never exceed the tightest bend */
      const turn = Math.max(-this.maxTurn, Math.min(this.maxTurn, arm.prevTurn + k / 4 * this.maxTurn * 0.6)), th = arm.th + turn, aim = wrap(th - arm.target), off = Math.abs(wrap(th - arm.axis));
      let cost = c.wTurn * turn * turn + c.wJerk * (turn - arm.prevTurn) ** 2 + c.wWander * (turn - wander) ** 2 + c.wBearing * aim * aim;
      if (off > c.spread) cost += 1e5 * (1 + off);              // hard wall around the cone axis
      const dx = Math.cos(th), dz = Math.sin(th); let x = last.x, z = last.z, hp = last.h, w = 1;
      for (let l = 1; l <= c.look; l++) {
        x += dx * step; z += dz * step; const h = T.base(x, z), g = (h - hp) / step, over = Math.abs(g) - steep; cost += w * (c.wGrade * g * g + (over > 0 ? c.wSteep * over * over : 0));
        if (h < wet) cost += w * c.wWater * (1 + (wet - h) * 0.2);
        const up = h - sea - c.maxAlt; if (up > 0) cost += w * c.wHigh * (up / 40) ** 2;
        if (l & 1) { const cs = (T.base(x - dz * 12, z + dx * 12) - h) / 12; cost += w * c.wCross * cs * cs; }
        if (l >= 3 && this.nearest(x, z)) cost += 400;          // never steer into road that already exists
        hp = h; w *= 0.9;
      }
      if (cost < bestCost) { bestCost = cost; best = turn; }
    }
    arm.th += best; arm.prevTurn = best; const x = last.x + Math.cos(arm.th) * step, z = last.z + Math.sin(arm.th) * step; arm.n.push({ x, z, h: T.base(x, z) });
  }
  /* node g along the whole road: 0 is the start, positive on arm A, negative on arm B */
  raw(g) { return g >= 0 ? this.A.n[g] : this.B.n[-g]; }
  Y(g) { return g >= 0 ? this.A.Y[g] : this.B.Y[-g]; }

  /* settle road heights and spline samples for every node that now has enough neighbours */
  settle(arm, box) {
    const c = this.c, W = c.smooth, sgn = arm.dir, other = sgn > 0 ? this.B : this.A;
    while (arm.Y.length < arm.n.length - W) {
      const j = arm.Y.length; let sum = 0; for (let k = -W; k <= W; k++) sum += this.raw(sgn * j + k).h;
      const want = Math.max(sum / (2 * W + 1), this.sea + c.clearance); let y = want;
      if (j === 0 && other.Y.length) y = other.Y[0];
      if (j > 0) {
        const p = arm.Y[j - 1]; let lim = c.hardGrade * this.step; y = Math.min(p + lim, Math.max(p - lim, want));
        if (Math.abs(y - want) > c.maxCut) { lim = c.lastGrade * this.step; y = Math.min(p + lim, Math.max(p - lim, want)); }      // a short very steep stretch beats a canyon or a viaduct
      }
      arm.Y.push(y);
    }
    if (other.Y.length < 2) return;
    while (arm.done + 3 <= arm.Y.length) {                    // interval `done` (outward) needs heights up to node done + 2
      const i = arm.done++, g = sgn > 0 ? i : -(i + 1);       // as a global interval: nodes g .. g + 1
      const a = this.raw(g - 1), b = this.raw(g), d = this.raw(g + 1), e = this.raw(g + 2), ya = this.Y(g - 1), yb = this.Y(g), yd = this.Y(g + 1), ye = this.Y(g + 2);
      for (let q = 0; q < SUB; q++) {
        const t = (sgn > 0 ? q : SUB - 1 - q) / SUB, x = cr(a.x, b.x, d.x, e.x, t), z = cr(a.z, b.z, d.z, e.z, t), y = cr(ya, yb, yd, ye, t);
        arm.sx.push(x); arm.sy.push(y); arm.sz.push(z);
        if (box) { box.minX = Math.min(box.minX, x); box.maxX = Math.max(box.maxX, x); box.minZ = Math.min(box.minZ, z); box.maxZ = Math.max(box.maxZ, z); }
        const n = arm.sx.length - 1;                           // new sample; link it to the one before it (towards the start)
        if (sgn > 0) { if (n > 0) this.link(n - 1); else if (this.B.sx.length) this.link(-1); }
        else { this.link(-(n + 1)); if (n === 0 && !this.A.sx.length) this.pending = true; }
      }
    }
    if (this.pending && this.A.sx.length && this.B.sx.length) { this.pending = false; this.link(-1); }
  }
  /* sample q of the centre line: q >= 0 on arm A; q < 0 on arm B (stored outward, B.sx[0] is q = -1) */
  px(q) { return q >= 0 ? this.A.sx[q] : this.B.sx[-q - 1]; }
  py(q) { return q >= 0 ? this.A.sy[q] : this.B.sy[-q - 1]; }
  pz(q) { return q >= 0 ? this.A.sz[q] : this.B.sz[-q - 1]; }
  has(q) { return q >= 0 ? q < this.A.sx.length : -q - 1 < this.B.sx.length; }
  /* register segment q (sample q to q + 1) in every grid cell it can affect, so a point finds it with one lookup */
  link(q) {
    if (!this.has(q) || !this.has(q + 1)) return;
    const ax = this.px(q), az = this.pz(q), bx = this.px(q + 1), bz = this.pz(q + 1), r = this.reach, C = this.cell;
    const x0 = Math.floor((Math.min(ax, bx) - r) / C), x1 = Math.floor((Math.max(ax, bx) + r) / C), z0 = Math.floor((Math.min(az, bz) - r) / C), z1 = Math.floor((Math.max(az, bz) + r) / C);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) { const k = (cx + 32768) * 65536 + (cz + 32768); let l = this.cells.get(k); if (!l) this.cells.set(k, l = []); l.push(q); }
  }

  /* make sure the road exists from sLo to sHi. Returns the box around any newly built part, or null. */
  ensure(sLo, sHi) {
    const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }; let guard = 0;
    while ((this.sMax < sHi || this.sMin > sLo) && guard++ < 4000) {
      if (this.sMax < sHi) { this.grow(this.A); this.settle(this.A, box); }
      if (this.sMin > sLo) { this.grow(this.B); this.settle(this.B, box); }
      this.settle(this.A, box); this.settle(this.B, box);
      this.sMax = Math.max(0, (this.A.sx.length - 1) * this.ds - this.step); this.sMin = -Math.max(0, (this.B.sx.length - 1) * this.ds - this.step);
    }
    return box.minX === Infinity ? null : box;
  }

  /* centre line at road distance s: position, heading (th, radians, x = cos, z = sin) and slope */
  at(s, out = {}) {
    const g = Math.floor(s / this.step), t = s / this.step - g, a = this.raw(g - 1), b = this.raw(g), d = this.raw(g + 1), e = this.raw(g + 2);
    const ya = this.Y(g - 1), yb = this.Y(g), yd = this.Y(g + 1), ye = this.Y(g + 2);
    out.x = cr(a.x, b.x, d.x, e.x, t); out.z = cr(a.z, b.z, d.z, e.z, t); out.y = cr(ya, yb, yd, ye, t);
    const dx = crd(a.x, b.x, d.x, e.x, t), dz = crd(a.z, b.z, d.z, e.z, t), dy = crd(ya, yb, yd, ye, t), l = Math.hypot(dx, dz) || 1;
    out.th = Math.atan2(dz, dx); out.slope = dy / l; out.tx = dx / l; out.tz = dz / l; return out;
  }
  /* nearest point of the road to (x, z), if within reach. Fills this.hit {d, s, y}; returns true or false. */
  nearest(x, z) {
    const C = this.cell, l = this.cells.get((Math.floor(x / C) + 32768) * 65536 + Math.floor(z / C) + 32768); if (!l) return false;
    let bd = Infinity, bq = 0, bt = 0;
    for (let i = 0; i < l.length; i++) {
      const q = l[i], ax = this.px(q), az = this.pz(q), ex = this.px(q + 1) - ax, ez = this.pz(q + 1) - az;
      let t = ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez); t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = x - ax - ex * t, dz = z - az - ez * t, d = dx * dx + dz * dz; if (d < bd) { bd = d; bq = q; bt = t; }
    }
    bd = Math.sqrt(bd); if (bd > this.reach) return false;
    const h = this.hit; h.d = bd; h.s = (bq + bt) * this.ds; h.y = this.py(bq) + (this.py(bq + 1) - this.py(bq)) * bt; return true;
  }
  /* land height with the road cut or filled in: level under the road, easing back to the natural height */
  grade(x, z, natural) {
    if (!this.nearest(x, z)) return natural;
    const c = this.c, g = this.g, h = this.hit, bed = h.y - c.sink * (1 - sstep(g.flat - 2.5, g.flat, h.d));
    return bed + (natural - bed) * sstep(g.flat, g.blend, h.d);
  }
  /* height a vehicle drives on: the graded land, lifted back up to the road surface (the land is cut `sink` below the road so the ribbon sits on top) */
  drive(x, z, natural) {
    if (!this.nearest(x, z)) return natural;
    const c = this.c, g = this.g, h = this.hit, bed = h.y - c.sink * (1 - sstep(g.flat - 2.5, g.flat, h.d));
    return bed + (natural - bed) * sstep(g.flat, g.blend, h.d) + c.sink * (1 - sstep(g.lift[0], g.lift[1], h.d));
  }
  /* road distance of the point on the road closest to (x, z), searching outward from a hint */
  closestS(x, z, hint = 0) {
    const lo = Math.max(this.sMin, hint - 3000), hi = Math.min(this.sMax, hint + 3000), p = this._p || (this._p = {}); let bs = hint, bd = Infinity;
    for (let s = lo; s <= hi; s += 40) { this.at(s, p); const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; bs = s; } }
    for (let s = Math.max(lo, bs - 40); s <= Math.min(hi, bs + 40); s += 2) { this.at(s, p); const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; bs = s; } }
    return bs;
  }
}
