/* Autodrive: the car follows the road by itself, like the "autodrive" in slowroads.io.
   Steering is pure pursuit: aim at a point on the road centre line a little ahead (further at speed).
   Speed is a cruise value, lowered for the sharpest bend within the next 90 m so the car never has to slide.
   update() returns { steer, throttle, brake } in the same form as Controls.read(); main.js uses it while enabled.
   Any manual steer or brake input from the player turns it off.
   Two levels: 'full' (the car steers and drives) and 'cruise' (the car holds the speed and keeps its distance; the player steers; only braking takes over).
   The drive mode sets how it drives (see STYLES): Eco is gentle and law-abiding, Normal keeps to the limit, Sport drives like a sports car (fast, late braking,
   tailgates and overtakes on the right even where it is not allowed), Off-road is slow and careful. */
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

/* how each drive mode drives itself: kmh = cruise speed on an open road (never above the vehicle's own top speed), lat = cornering acceleration it accepts (m/s2),
   gap0/gap1 = safe gap in metres plus seconds of speed, pass = overtakes a slower car in front instead of waiting, rules = false drives past the speed limits */
export const STYLES = {
  eco:     { kmh: 80,  lat: 2.6, gap0: 10, gap1: 1.8, pass: false, rules: true },
  normal:  { kmh: 90,  lat: 3.6, gap0: 8,  gap1: 1.4, pass: false, rules: true },
  sport:   { kmh: 200, lat: 6.5, gap0: 3,  gap1: 0.55, pass: true, rules: false },
  offroad: { kmh: 45,  lat: 2.4, gap0: 8,  gap1: 1.2, pass: false, rules: true },
};
export function styleFor(id, topMs) { const S = STYLES[id] || STYLES.normal; return { ...S, cruise: Math.min(S.kmh / 3.6, (topMs || 60) * 0.92) }; }

export class Autodrive {
  /* lane: optional function dir -> lateral offset (m, along the road's left normal) of the lane to drive in; leader: optional function (phys, s) -> { gap, speed } of a car in front (traffic) */
  constructor() { this.lane = null; this.leader = null; this.enabled = false; this.cruise = 70 / 3.6; this.level = 'full'; this.style = STYLES.normal; this.passing = 0; this.s = 0; this.input = { steer: 0, throttle: 0, brake: 0 }; this.p = {}; this.q = {}; }
  toggle(on = !this.enabled) { this.enabled = on; this.passing = 0; return on; }
  setStyle(id, topMs) { this.style = styleFor(id, topMs); this.cruise = this.style.cruise; }
  /* phys: x, z, yaw, u (forward speed, m/s); road: Road; returns the input to drive with */
  update(phys, road, hand) {
    const i = this.input, p = this.p, q = this.q, u = Math.max(phys.u, 0);
    this.s = road.closestS(phys.x, phys.z, this.s);
    road.at(this.s, p);
    const fx = Math.cos(phys.yaw), fz = Math.sin(phys.yaw), dir = fx * p.tx + fz * p.tz >= 0 ? 1 : -1;          // drive the way the car already faces
    const look = clamp(9 + u * 0.9, 12, 55), St = this.style;
    road.at(this.s + dir * look, q); const lat = this.lane ? this.lane(dir, this.passing > 0 ? 1 : 0) : 0; if (lat) { q.x -= q.tz * lat; q.z += q.tx * lat; }            // aim at the lane, not the centre line
    const dx = q.x - phys.x, dz = q.z - phys.z, ahead = dx * fx + dz * fz, side = -dx * fz + dz * fx;             // target in the car's own frame (side > 0: to the right)
    const err = Math.atan2(side, Math.max(ahead, 1));
    i.steer = this.level === 'cruise' && hand ? hand.steer : clamp(err * 1.6, -1, 1);                   // in cruise level the player steers
    let v = this.cruise;                                                                                           // the slowest speed any bend ahead allows
    for (let d = 15; d <= 90; d += 15) {
      road.at(this.s + dir * d, p); const th0 = p.th; road.at(this.s + dir * (d + 15), p);
      const k = Math.abs(Math.atan2(Math.sin(p.th - th0), Math.cos(p.th - th0))) / 15;
      if (k > 1e-4) v = Math.min(v, Math.max(8, Math.sqrt(St.lat / k)));
    }
    const slow = this.level === 'full' && Math.abs(err) > 0.35 ? 0.6 : 1; v *= slow;
    const L = this.leader ? this.leader(phys, this.s) : null;                                                                                       // follow a car in front at a safe gap
    if (this.passing > 0) this.passing -= 1 / 60;
    if (L && St.pass && this.level === 'full' && L.speed < v - 3 && L.gap < 30 + u) this.passing = 4;          // sport: swing out and go round a slower car
    if (L && this.passing <= 0) { const safe = St.gap0 + St.gap1 * u, hard = Math.min(3, St.gap0 * 0.4); if (L.gap < safe) v = Math.min(v, L.speed * clamp((L.gap - hard) / (safe - hard), 0, 1)); if (L.gap < hard) v = 0; }
    i.throttle = clamp((v - u) / 3, 0, 1); i.brake = u > v + 1.5 ? clamp((u - v) / 5, 0, 1) : 0;
    return i;
  }
}
