/* The railway's own ground: a railway does not follow the land the way a road does, it cuts through hills and rides embankments and viaducts over valleys (owner's photos, 21 Nov 2026).
   RailGrade gives every rail edge a smooth, gentle vertical profile (a moving average of the land, held within 9 m below and 12 m above it, never steeper than 3 percent, pinned to the same height at the
   node where edges meet) and tells the terrain how to carve it: a flat corridor under the track, cutting slopes (1 : 1.5) where the track is below the land and embankment slopes (1 : 2) where it is above;
   where the track is more than VIADUCT m above the land the land is left alone and the view draws a viaduct instead of an embankment.
   Pure (no three.js): the self-test checks it. Positions are world metres; `toWorld(gx, gz)` converts the network's game metres; `natural(wx, wz)` is the land height before any grading. */
const STEP = 8, FLAT = 4.6, CUT = 1.5, FILL = 2, MAX_GRADE = 0.03, BELOW = 9, ABOVE = 12, VIADUCT = 6, CELL = 48, REACH = 40;

export class RailGrade {
  constructor({ edges, toWorld, natural }) {
    this.edges = edges; this.natural = natural; this.pos = []; this.prof = []; this.occ = new Set(); this.cells = new Map(); this.nodeY = new Map(); this.nodes = null;
    edges.forEach((ln, ei) => {                                                                                    // positions every STEP m along each edge, and an index of the cells they touch
      const n = Math.max(2, Math.ceil(ln.len / STEP) + 1), P = new Float64Array(n * 2), tmp = {}; for (let i = 0; i < n; i++) { ln.at(Math.min(i * STEP, ln.len), tmp); const w = toWorld(tmp.x, tmp.z); P[i * 2] = w.x; P[i * 2 + 1] = w.z; }
      this.pos.push(P); this.prof.push(null);
      for (let i = 0; i < n; i++) { const cx = Math.floor(P[i * 2] / CELL), cz = Math.floor(P[i * 2 + 1] / CELL); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) this.occ.add((cx + dx) * 100003 + (cz + dz)); const k = cx * 100003 + cz; let l = this.cells.get(k); if (!l) this.cells.set(k, l = []); l.push(ei, i); }
    });
  }
  /* the height the track is held at where edge ends meet: the land averaged around the node, so every edge there agrees */
  junctionY(wx, wz) { const k = Math.round(wx) + ',' + Math.round(wz); let y = this.nodeY.get(k); if (y === undefined) { let s = 0, c = 0; for (const [dx, dz] of [[0, 0], [30, 0], [-30, 0], [0, 30], [0, -30]]) { s += this.natural(wx + dx, wz + dz); c++; } y = s / c; this.nodeY.set(k, y); } return y; }
  profile(ei) {
    let pr = this.prof[ei]; if (pr) return pr; const P = this.pos[ei], n = P.length / 2, nat = new Float64Array(n); for (let i = 0; i < n; i++) nat[i] = this.natural(P[i * 2], P[i * 2 + 1]);
    let y = Float64Array.from(nat); for (let pass = 0; pass < 3; pass++) { const z = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = -6; k <= 6; k++) { const j = i + k; if (j >= 0 && j < n) { s += y[j]; c++; } } z[i] = s / c; } y = z; }       // a moving average of about 100 m, three times
    const y0 = this.junctionY(P[0], P[1]), y1 = this.junctionY(P[(n - 1) * 2], P[(n - 1) * 2 + 1]);
    for (let i = 0; i < n; i++) { const w0 = Math.max(0, 1 - i * STEP / 200), w1 = Math.max(0, 1 - (n - 1 - i) * STEP / 200); y[i] = y[i] * (1 - w0) + y0 * w0; y[i] = y[i] * (1 - w1) + y1 * w1; y[i] = Math.min(nat[i] + ABOVE, Math.max(nat[i] - BELOW, y[i])); }
    y[0] = y0; y[n - 1] = y1; const mg = MAX_GRADE * STEP; for (let r = 0; r < 4; r++) { for (let i = 1; i < n; i++) y[i] = Math.min(y[i - 1] + mg, Math.max(y[i - 1] - mg, y[i])); for (let i = n - 2; i >= 0; i--) y[i] = Math.min(y[i + 1] + mg, Math.max(y[i + 1] - mg, y[i])); }
    this.prof[ei] = y; return y;
  }
  /* the track height at distance s along edge ei */
  yAt(ei, s) { const y = this.profile(ei), f = Math.max(0, Math.min(y.length - 1.0001, s / STEP)), i = Math.floor(f), t = f - i; return y[i] * (1 - t) + y[i + 1] * t; }
  /* the nearest track to (x, z) within REACH m: { ei, s, d (metres from the centre line), y (track height there) } or null */
  query(x, z) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL); if (!this.occ.has(cx * 100003 + cz)) return null; let best = null, bd = REACH;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const l = this.cells.get((cx + dx) * 100003 + (cz + dz)); if (!l) continue;
      for (let q = 0; q < l.length; q += 2) { const ei = l[q], i = l[q + 1], P = this.pos[ei]; for (const j of [i - 1, i]) { if (j < 0 || j * 2 + 3 >= P.length) continue; const ax = P[j * 2], az = P[j * 2 + 1], bx = P[j * 2 + 2], bz = P[j * 2 + 3], ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1; let t = ((x - ax) * ex + (z - az) * ez) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const d = Math.hypot(ax + ex * t - x, az + ez * t - z); if (d < bd) { bd = d; best = { ei, s: (j + t) * STEP, d }; } } } }
    if (best) best.y = this.yAt(best.ei, best.s); return best;
  }
  /* what the terrain should be at (x, z) given the natural height h: flat under the track, sloped cuttings and embankments, the land itself where a viaduct stands */
  grade(x, z, h) {
    const q = this.query(x, z); if (!q) return h; const y = q.y, d = q.d;
    if (y > h + VIADUCT && q.d < FLAT + 6) return h;                                                              // a viaduct: the valley stays
    if (d <= FLAT) return y;
    if (h > y) return Math.min(h, y + (d - FLAT) / CUT);                                                          // cutting
    return Math.max(h, y - (d - FLAT) / FILL);                                                                    // embankment
  }
  /* is the track at distance s along edge ei on a viaduct (more than VIADUCT m above the land) */
  viaduct(ei, s) { const P = this.pos[ei], i = Math.min(P.length / 2 - 1, Math.round(s / STEP)); return this.yAt(ei, s) - this.natural(P[i * 2], P[i * 2 + 1]) > VIADUCT; }
  /* how far below the land the track is (positive in a cutting) */
  cutDepth(ei, s) { const P = this.pos[ei], i = Math.min(P.length / 2 - 1, Math.round(s / STEP)); return this.natural(P[i * 2], P[i * 2 + 1]) - this.yAt(ei, s); }
}
export const RAIL_GRADE = { STEP, FLAT, CUT, FILL, MAX_GRADE, BELOW, ABOVE, VIADUCT };
