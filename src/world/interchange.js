/* Overpasses where two roads cross (docs/INDIA_MAP_PLAN.md, interchanges). Every road is routed on the land on its own, so where two of them cross they would meet on one level. This finds the places
   where a road crosses another one and raises the road on a deck over the other: a lift (Road.addLift) with a smooth approach ramp each side and a level deck long enough to clear the road below.
   The car's physics then sees two layers there (the ground with the lower road, and the deck above: see RoadSet and RapierVehicle.buildPatch).
   Pure (no three.js): the self-test runs it. */
import { LIFT_LAYER } from './router.js';

export const CLEAR = 6.5, MAX_LIFT = 16, MIN_SIN = 0.34, SCAN = 6;        // headroom under the deck (m), the highest an approach may climb (m), the sharpest crossing allowed (sine of the angle: 20 degrees), scan step (m)

/* the crossings of `road` with each road of `others` between road distances s0 and s1 (it must be built that far, and settled: keep clear of its growing ends). Each: { s (on road), other, so (on other), x, z, sin, cos, yRoad, yOther } */
export function findCrossings(road, others, s0, s1) {
  const out = [], p = {}, q = {};
  for (const o of others) {
    if (o === road) continue; const reach = o.style.outer + road.style.outer + 4; let dPrev = Infinity, dPrev2 = Infinity, sPrev = s0;
    for (let s = s0; s <= s1; s += SCAN) {
      road.at(s, p); let d = Infinity; if (o.nearest(p.x, p.z) && o.hit.d < reach + 30) d = o.hit.d;
      if (dPrev < dPrev2 && dPrev <= d && dPrev < 6) {                       // the previous sample was a local minimum of the distance: refine it
        let bs = sPrev, bd = Infinity, bo = 0;
        for (let t = sPrev - SCAN; t <= sPrev + SCAN; t += 0.5) { road.at(t, p); if (o.nearest(p.x, p.z) && o.hit.d < bd) { bd = o.hit.d; bs = t; bo = o.hit.s; } }
        if (bd < 1.5) {
          road.at(bs, p); o.at(bo, q); const dot = p.tx * q.tx + p.tz * q.tz, sin = Math.abs(p.tx * q.tz - p.tz * q.tx);
          if (sin >= MIN_SIN && !out.some(c => c.other === o && Math.abs(c.s - bs) < 60)) out.push({ s: bs, other: o, so: bo, x: p.x, z: p.z, sin, cos: Math.abs(dot), yRoad: p.y, yOther: q.y });
        }
      }
      dPrev2 = dPrev; dPrev = d; sPrev = s;
    }
  }
  return out;
}

/* raise `road` over the crossings found (see findCrossings) that it does not already pass over; returns the lifts added: [{ s0, s1 }] (the road distances touched, for the mesh and terrain to rebuild).
   `margin` keeps the work clear of the road's growing ends (the heights there are not final yet); `skip` (metres from the start of the road) leaves out the junction at the road's own start. */
export function addOverpasses(road, others, { margin = 120, skip = 450 } = {}) {
  const made = [], ranges = []; if (road.sMin + margin < -skip) ranges.push([road.sMin + margin, -skip]); if (road.sMax - margin > skip) ranges.push([skip, road.sMax - margin]);
  for (const [a, b] of ranges) for (const c of findCrossings(road, others, a, b)) {
    if (road.lifts.some(l => Math.abs(c.s - l.cross) < 150 + l.gap)) continue;                // already passed over here
    const wO = c.other.style.outer, wR = road.style.outer, foot = (wO + wR * c.cos) / c.sin;      // half the length of road that lies over the other's carriageway
    const yNow = road.at(c.s, {}).y;                                                           // after earlier lifts of this call (two crossings close together share their ramps)
    let h = c.yOther + CLEAR - yNow; if (h <= 0.5 && yNow - c.yOther >= CLEAR - 0.5) continue;       // already well above it
    h = Math.max(h, LIFT_LAYER + 1); if (h > MAX_LIFT) continue;                                 // a crossing where the road would have to climb too far is left as it is
    const half = foot + 10, ramp = Math.max(110, h * 36);
    made.push(road.addLift({ sa: c.s - half, sb: c.s + half, h, ramp, cross: c.s, gap: foot + 4 }));
  }
  return made;
}
