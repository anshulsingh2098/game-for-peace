/* Several roads in one world (docs/INDIA_MAP_PLAN.md section 9): the player's road plus the roads that cross or branch off it at junctions. The terrain, the ground colour, the scenery
   clearing and the wheel surface all ask "the road" the same few questions (nearest, hit, style, grade, drive); a RoadSet answers them for every road at once, by the road that is nearest.
   Anything that needs ONE road (the mesh, traffic, the navigation graph, the district) still gets that road itself. With one road in the set it behaves exactly as that road. Pure (no three.js). */
import { LIFT_LAYER } from './router.js';
/* Layers (interchanges): where a road is lifted LIFT_LAYER metres or more over its routed height (an overpass, see Road.addLift) it is a deck layer of its own: the land under it (natural ground, or a road passing below)
   is a second surface at that point. `drive(x, z, natural, y)` answers for the layer nearest to the height y (the car's own); without y it answers for the deck where there is one (the road you see on top);
   y = -Infinity asks for the ground only. `deck(x, z)` is the deck height or NaN. With no lifted road in the set everything below behaves exactly as before. */
export class RoadSet {
  constructor(primary) { this.primary = primary; this.roads = [primary]; this.hit = primary.hit; this.style = primary.style; this.last = primary; this.nLift = 0; primary.set = this; }
  add(r) { if (!this.roads.includes(r)) { this.roads.push(r); r.set = this; this.refresh(); } return r; }
  remove(r) { if (r !== this.primary) { const i = this.roads.indexOf(r); if (i >= 0) { this.roads.splice(i, 1); r.set = null; this.refresh(); } } if (this.last === r) this.last = this.primary; }
  refresh() { this.nLift = this.roads.filter(r => r.lifts && r.lifts.length).length; }
  /* the nearest road within reach of (x, z): sets this.hit (its d, s, y), this.style and this.last (which road); returns true or false */
  nearest(x, z) {
    const R = this.roads; if (R.length === 1) { const r = R[0], ok = r.nearest(x, z); if (ok) { this.hit = r.hit; this.style = r.style; this.last = r; } return ok; }
    let best = null; for (let i = 0; i < R.length; i++) { const r = R[i]; if (r.nearest(x, z) && (best === null || r.hit.d < best.hit.d)) best = r; }
    if (best) { this.hit = best.hit; this.style = best.style; this.last = best; } return best !== null;
  }
  /* the road whose grade applies at (x, z): the nearest one in reach, or null */
  pick(x, z) { return this.nearest(x, z) ? this.last : null; }
  /* the ground road at a point (the nearest one that is not a deck layer there) and the deck road, if any: g and dk (null when none); sets this.g, this.dk */
  layers(x, z) {
    let g = null, gd = Infinity, dk = null, any = null, ad = Infinity; const R = this.roads;
    for (let i = 0; i < R.length; i++) { const r = R[i]; if (!r.nearest(x, z)) continue; const h = r.hit; if (h.d < ad) { ad = h.d; any = r; }
      if (h.lift >= LIFT_LAYER) { if (h.d <= r.style.outer + 1.5) dk = r; } else if (h.d < gd) { gd = h.d; g = r; } }
    this.g = g; this.dk = dk; this.any = any; return dk !== null;
  }
  grade(x, z, natural) {
    const R = this.roads; if (R.length === 1) return R[0].grade(x, z, natural);
    if (this.nLift) { this.layers(x, z); const r = this.g || this.any; return r ? r.grade(x, z, natural) : natural; }          // the land follows the road on the ground, not the deck above it
    const r = this.pick(x, z); return r ? r.grade(x, z, natural) : natural;
  }
  drive(x, z, natural, y) {
    const R = this.roads; if (R.length === 1) return R[0].drive(x, z, natural);
    if (this.nLift) {
      if (this.layers(x, z)) {
        if (y === -Infinity) return this.g ? this.g.drive(x, z, natural) : natural;
        const dk = this.dk, dv = dk.drive(x, z, natural); if (y === undefined) return dv;
        const g = this.g, gv2 = g ? g.drive(x, z, natural) : natural; return Math.abs(dv - y) <= Math.abs(gv2 - y) ? dv : gv2;
      }
      const r = this.g || this.any; return r ? r.drive(x, z, natural) : natural;
    }
    const r = this.pick(x, z); return r ? r.drive(x, z, natural) : natural;
  }
  /* the decks of raised roads near (cx, cz) within half metres, as ribbons of triangles for the physics: { pos: [x, y, z, ...], idx: [...] } in world metres, or null. A deck starts a little before it is a layer of its own (the ground
     there is the road itself, at the same height), so no wheel finds a gap between the two. */
  deckMesh(cx, cz, half) {
    if (!this.nLift) return null; const pos = [], idx = [], p = {};
    for (const r of this.roads) for (const l of r.lifts || []) {
      const o = r.style.outer, lim = half + o + 6; let prev = -1;
      for (let s = l.sa - l.ramp; s <= l.sb + l.ramp + 0.01; s += 3) {
        if (s < r.sMin + 2 || s > r.sMax - 2) { prev = -1; continue; }                                    // not built (yet)
        r.at(s, p); if (r.liftAt(s) < LIFT_LAYER - 0.4 || Math.abs(p.x - cx) > lim || Math.abs(p.z - cz) > lim) { prev = -1; continue; }
        const nx = -p.tz, nz = p.tx, v = pos.length / 3; pos.push(p.x + nx * o, p.y, p.z + nz * o, p.x - nx * o, p.y, p.z - nz * o);
        if (prev >= 0) idx.push(prev, prev + 1, v, prev + 1, v + 1, v); prev = v;
      }
    }
    return pos.length ? { pos, idx } : null;
  }
  /* the deck height at a point (the level surface of a lifted road, over its carriageway), or NaN where there is no deck layer */
  deck(x, z, natural) { if (!this.nLift || !this.layers(x, z)) return NaN; const dk = this.dk; return dk.hit.d <= dk.style.outer + 0.2 ? dk.drive(x, z, natural) : NaN; }
}
