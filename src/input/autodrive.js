/* Autodrive: the car follows the road by itself, like the "autodrive" in slowroads.io.
   Steering is pure pursuit: aim at a point on the road centre line a little ahead (further at speed).
   Speed is a cruise value, lowered for the sharpest bend within the next 90 m so the car never has to slide.
   update() returns { steer, throttle, brake } in the same form as Controls.read(); main.js uses it while enabled.
   Any manual steer or brake input from the player turns it off. */
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

export class Autodrive {
  /* lane: optional function dir -> lateral offset (m, along the road's left normal) of the lane to drive in; leader: optional function (phys, s) -> { gap, speed } of a car in front (traffic) */
  constructor() { this.lane = null; this.leader = null; this.enabled = false; this.cruise = 70 / 3.6; this.s = 0; this.input = { steer: 0, throttle: 0, brake: 0 }; this.p = {}; this.q = {}; }
  toggle(on = !this.enabled) { this.enabled = on; return on; }
  /* phys: x, z, yaw, u (forward speed, m/s); road: Road; returns the input to drive with */
  update(phys, road) {
    const i = this.input, p = this.p, q = this.q, u = Math.max(phys.u, 0);
    this.s = road.closestS(phys.x, phys.z, this.s);
    road.at(this.s, p);
    const fx = Math.cos(phys.yaw), fz = Math.sin(phys.yaw), dir = fx * p.tx + fz * p.tz >= 0 ? 1 : -1;          // drive the way the car already faces
    const look = clamp(9 + u * 0.9, 12, 55);
    road.at(this.s + dir * look, q); const lat = this.lane ? this.lane(dir) : 0; if (lat) { q.x -= q.tz * lat; q.z += q.tx * lat; }            // aim at the lane, not the centre line
    const dx = q.x - phys.x, dz = q.z - phys.z, ahead = dx * fx + dz * fz, side = -dx * fz + dz * fx;             // target in the car's own frame (side > 0: to the right)
    const err = Math.atan2(side, Math.max(ahead, 1));
    i.steer = clamp(err * 1.6, -1, 1);
    let v = this.cruise;                                                                                           // the slowest speed any bend ahead allows
    for (let d = 15; d <= 90; d += 15) {
      road.at(this.s + dir * d, p); const th0 = p.th; road.at(this.s + dir * (d + 15), p);
      const k = Math.abs(Math.atan2(Math.sin(p.th - th0), Math.cos(p.th - th0))) / 15;
      if (k > 1e-4) v = Math.min(v, Math.max(8, Math.sqrt(3.6 / k)));
    }
    const slow = Math.abs(err) > 0.35 ? 0.6 : 1; v *= slow;
    const L = this.leader ? this.leader(phys, this.s) : null;                                                                                       // follow a car in front at a safe gap
    if (L) { const safe = 8 + 1.4 * u; if (L.gap < safe) v = Math.min(v, L.speed * clamp((L.gap - 3) / (safe - 3), 0, 1)); if (L.gap < 3) v = 0; }
    i.throttle = clamp((v - u) / 3, 0, 1); i.brake = u > v + 1.5 ? clamp((u - v) / 5, 0, 1) : 0;
    return i;
  }
}
