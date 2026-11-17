/* Autodrive: the car follows the road by itself, like the "autodrive" in slowroads.io.
   Steering is pure pursuit: aim at a point on the road centre line a little ahead (further at speed).
   Speed is a cruise value, lowered for the sharpest bend within the next 90 m so the car never has to slide.
   update() returns { steer, throttle, brake } in the same form as Controls.read(); main.js uses it while enabled.
   Any manual steer or brake input from the player turns it off.
   Two levels: 'full' (the car steers and drives) and 'cruise' (the car holds the speed and keeps its distance; the player steers; only braking takes over).
   The drive mode sets how it drives (see STYLES): Eco is gentle and law-abiding, Normal keeps to the limit, Sport drives like a sports car (fast, late braking,
   tailgates and overtakes on the right even where it is not allowed), Off-road is slow and careful. */
import { TOLL_LEN } from '../world/highway_plan.js';
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

/* how each drive mode drives itself: kmh = cruise speed on an open road (never above the vehicle's own top speed), lat = cornering acceleration it accepts (m/s2),
   gap0/gap1 = safe gap in metres plus seconds of speed, decel = the braking it plans with (m/s2, below what the car can do), pass = overtakes a slower car in front instead of waiting, rules = false drives past the speed limits */
export const STYLES = {
  eco:     { kmh: 80,  lat: 2.4, gap0: 10, gap1: 1.8, pass: false, rules: true, decel: 3.2 },
  normal:  { kmh: 90,  lat: 3, gap0: 8,  gap1: 1.4, pass: false, rules: true, decel: 4 },
  sport:   { kmh: 200, lat: 3.4, gap0: 3,  gap1: 0.55, pass: true, rules: false, decel: 6 },
  offroad: { kmh: 45,  lat: 2.2, gap0: 8,  gap1: 1.2, pass: false, rules: true, decel: 3.2 },
};
export function styleFor(id, topMs) { const S = STYLES[id] || STYLES.normal; return { ...S, cruise: Math.min(S.kmh / 3.6, (topMs || 60) * 0.92) }; }

export class Autodrive {
  /* lane: optional function dir -> lateral offset (m, along the road's left normal) of the lane to drive in; leader: optional function (phys, s) -> { gap, speed } of a car in front (traffic) */
  constructor() { this.lane = null; this.lookMin = 12; this.forward = false; this.leader = null; this.enabled = false; this.cruise = 70 / 3.6; this.level = 'full'; this.style = STYLES.normal; this.passing = 0; this.laneK = 0; this.laneT = 0; this.lanesAt = null; this.damp = 0; this.abort = false; this.passOncoming = false; this.dropBack = false; this.latCmd = null; this.lanes = null; this.tolls = null; this.road = null; this.oncoming = false; this.s = 0; this.input = { steer: 0, throttle: 0, brake: 0 }; this.p = {}; this.q = {}; }
  toggle(on = !this.enabled) { this.enabled = on; this.passing = 0; this.latCmd = null; this.laneK = 0; return on; }
  setStyle(id, topMs) { this.style = styleFor(id, topMs); this.cruise = this.style.cruise; }
  /* The planner. It looks as far ahead as the car needs to stop (the horizon), so it knows what to do long before a bend or a slow car:
     the allowed speed is the lowest of (speed a bend ahead allows) and (a car in front), each brought back to now with v^2 = v_there^2 + 2 * decel * distance,
     so the car brakes early and smoothly instead of late and hard. Sport also plans a pass: it moves into the next lane only when that lane is clear in front and behind.
     phys: x, z, yaw, u (forward speed, m/s); road: Road; hand: the player's input (cruise level); returns the input to drive with */
  update(phys, road, hand) {
    const i = this.input, p = this.p, q = this.q, u = Math.max(phys.u, 0), St = this.style, aB = St.decel, full = this.level === 'full';
    this.s = road.closestS(phys.x, phys.z, this.s);
    road.at(this.s, p);
    const fx = Math.cos(phys.yaw), fz = Math.sin(phys.yaw), dir = this.forward || fx * p.tx + fz * p.tz >= 0 ? 1 : -1;          // drive the way the car already faces (a route path only has one way)
    const H = clamp(u * u / (2 * aB) + 50 + u * 1.2, 70, 420);                                                       // horizon: stopping distance plus a margin
    const lat0 = this.lane ? this.lane(dir, 0) : 0, lat1 = this.lane ? this.lane(dir, 1) : 0, two = lat1 !== lat0; this.oncoming = !!this.lanes && this.lanes(dir) < 2;       // one lane each way: passing in the oncoming lane needs the sim's cars to be seen far ahead, which it cannot promise (cars can appear 100 m ahead), so it is off unless this.passOncoming
    let tollNear = false; if (this.tolls) for (const ts of this.tolls(this.s)) { const e = dir > 0 ? ts : ts + TOLL_LEN, d = (e - this.s) * dir; if (d > -TOLL_LEN - 25 && d < 60 + u * 2) tollNear = true; }
    /* lane plan (sport overtaking) */
    if (this.passing > 0) this.passing -= 1 / 60;
    if (!full || !two || !St.pass || (this.oncoming && !this.passOncoming)) this.laneK = 0;
    else if (tollNear) { /* keep the lane through a toll plaza */ }
    else if (this.laneK === 0) {
      const L0 = this.leader ? this.leader(phys, this.s, Math.min(H, 90), lat0) : null;
      if (L0 && L0.speed < this.cruise - 3 && L0.gap < 70 + u * 1.5 && this.laneFree(phys, lat1, u, this.oncoming)) { this.laneK = 1; this.laneT = 0; }
    } else {
      this.laneT += 1 / 60; if (this.laneT > 1.5 && this.laneFree(phys, lat0, u)) this.laneK = 0;
      if (this.oncoming && this.lanesAt) { const o = this.lanesAt(phys, this.s, lat1, 400, 0).ahead; if (o && o.gap < (u - o.speed) * 10) { this.dropBack = true; if (this.laneFree(phys, lat0, u)) { this.laneK = 0; this.abort = true; } } else this.dropBack = false; }      // an oncoming car turns up: back in at once, or drop back behind the car being passed
    }
    this.passing = this.laneK === 1 ? 1 : 0;
    const look = clamp(9 + u * 0.9, this.lookMin, 55), want = this.laneK === 1 ? lat1 : lat0;
    if (this.latCmd === null || Math.abs(want - this.latCmd) > 9) this.latCmd = want; else this.latCmd += clamp(want - this.latCmd, -(this.abort ? 3 : 1.3) / 60, (this.abort ? 3 : 1.3) / 60); if (this.laneK === 1) this.abort = false;   // a lane change is a smooth slide over a few seconds, not a step
    const laneLat = this.latCmd;
    road.at(this.s + dir * look, q); if (this.lane && laneLat) { q.x -= q.tz * laneLat; q.z += q.tx * laneLat; }       // aim at the lane, not the centre line
    const dx = q.x - phys.x, dz = q.z - phys.z, ahead = dx * fx + dz * fz, side = -dx * fz + dz * fx;             // target in the car's own frame (side > 0: to the right)
    const err = Math.atan2(side, Math.max(ahead, 1));
    const psi = Math.atan2(dir * p.tx * -fz + dir * p.tz * fx, dir * p.tx * fx + dir * p.tz * fz);                    // the car's heading against the road's: steering back against it damps the swing
    i.steer = !full && hand ? hand.steer : clamp(err * 1.6 - this.damp * psi, -1, 1);   // in cruise level the player steers
    let v = this.cruise;                                                                                           // bends: the speed each point ahead allows, brought back to here
    for (let d = 10; d <= H; d += d < 120 ? 10 : 20) {
      road.at(this.s + dir * (d - 10), p); const th0 = p.th; road.at(this.s + dir * (d + 10), p);
      const k = Math.abs(Math.atan2(Math.sin(p.th - th0), Math.cos(p.th - th0))) / 20;
      if (k > 1e-4) { const vc = Math.max(6, Math.sqrt(St.lat / k)); v = Math.min(v, Math.sqrt(vc * vc + 2 * aB * Math.max(0, d - 10))); }
    }
    if (this.tolls) for (const ts of this.tolls(this.s)) {                                                           // a toll plaza ahead: walking pace through the booths, braking early; no lane change near it
      const e = dir > 0 ? ts : ts + TOLL_LEN, d = (e - this.s) * dir;
      if (d > -TOLL_LEN - 2 && d < H) v = Math.min(v, d <= 0 ? 5 : Math.sqrt(25 + 2 * aB * d));
    }
    if (full && Math.abs(err) > 0.35) v *= 0.6;
    if (this.dropBack && this.laneK === 1 && this.lanesAt) { const b = this.lanesAt(phys, this.s, lat0, 60, 30).ahead; if (b) v = Math.min(v, Math.max(0, b.speed - 4)); }   // too late to finish the pass: slow below the car beside us to slot in behind it
    const L = this.leader ? this.leader(phys, this.s, H, full && laneLat ? laneLat : undefined) : null;              // the car in front, in the lane we are driving in
    if (L) {
      const gapMin = St.pass && full && two ? Math.max(St.gap0, 14) : St.gap0, g = L.gap - u * 0.25;                // sport keeps room to swing out                                                               // 0.25 s of reaction counts as distance already used
      v = Math.min(v, Math.sqrt(Math.max(0, L.speed * L.speed + 2 * aB * Math.max(0, g - gapMin))));              // be at its speed by the time the gap is the minimum
      const safe = St.gap0 + St.gap1 * u, hard = Math.min(3, St.gap0 * 0.4); if (L.gap < safe) v = Math.min(v, L.speed * clamp((L.gap - hard) / (safe - hard), 0, 1)); if (L.gap < hard) v = 0;
    }
    i.throttle = clamp((v - u) / 2.5, 0, 1); i.brake = u > v + 0.8 ? clamp((u - v) / 2.5, 0, 1) : 0;
    return i;
  }
  /* is the lane line `lat` (opp: the oncoming lane) free beside and around the car, for a move into it: nothing close in front (counting how much faster we are), nothing fast closing from behind */
  laneFree(phys, lat, u, opp) {
    if (!this.lanesAt) return false;
    if (opp) { const far = clamp((u + 25) * 10, 300, 650), o = this.lanesAt(phys, this.s, lat, far, 20); return !o.ahead && !o.behind; }     // the oncoming lane: nothing in it for the whole pass
    const g = this.lanesAt(phys, this.s, lat, 40 + u * 2.5, 15 + u * 1.2), a = g.ahead, b = g.behind;
    if (a && a.gap < 25 + Math.max(0, u - a.speed) * 2.5) return false; if (b && b.gap < 12 + Math.max(0, b.speed - u) * 2.5 + u * 0.3) return false; return true;
  }
}
