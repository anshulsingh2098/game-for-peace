/* Several roads in one world (docs/INDIA_MAP_PLAN.md section 9): the player's road plus the roads that cross or branch off it at junctions. The terrain, the ground colour, the scenery
   clearing and the wheel surface all ask "the road" the same few questions (nearest, hit, style, grade, drive); a RoadSet answers them for every road at once, by the road that is nearest.
   Anything that needs ONE road (the mesh, traffic, the navigation graph, the district) still gets that road itself. With one road in the set it behaves exactly as that road. Pure (no three.js). */
export class RoadSet {
  constructor(primary) { this.primary = primary; this.roads = [primary]; this.hit = primary.hit; this.style = primary.style; this.last = primary; }
  add(r) { if (!this.roads.includes(r)) this.roads.push(r); return r; }
  remove(r) { if (r !== this.primary) { const i = this.roads.indexOf(r); if (i >= 0) this.roads.splice(i, 1); } if (this.last === r) this.last = this.primary; }
  /* the nearest road within reach of (x, z): sets this.hit (its d, s, y), this.style and this.last (which road); returns true or false */
  nearest(x, z) {
    const R = this.roads; if (R.length === 1) { const r = R[0], ok = r.nearest(x, z); if (ok) { this.hit = r.hit; this.style = r.style; this.last = r; } return ok; }
    let best = null; for (let i = 0; i < R.length; i++) { const r = R[i]; if (r.nearest(x, z) && (best === null || r.hit.d < best.hit.d)) best = r; }
    if (best) { this.hit = best.hit; this.style = best.style; this.last = best; } return best !== null;
  }
  /* the road whose grade applies at (x, z): the nearest one in reach, or null */
  pick(x, z) { return this.nearest(x, z) ? this.last : null; }
  grade(x, z, natural) { const R = this.roads; if (R.length === 1) return R[0].grade(x, z, natural); const r = this.pick(x, z); return r ? r.grade(x, z, natural) : natural; }
  drive(x, z, natural) { const R = this.roads; if (R.length === 1) return R[0].drive(x, z, natural); const r = this.pick(x, z); return r ? r.drive(x, z, natural) : natural; }
}
