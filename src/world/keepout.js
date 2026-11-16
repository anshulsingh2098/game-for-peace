/* Keep-out and ownership registry (CITY_PLAN Phase 0). Every thing that covers ground (a road, a railway edge, a station, a landmark, a building plot) registers the ground it covers;
   everything that places something (the district's buildings, scatter's trees, props, a station's own building, a landmark) asks before it builds. One answer for all of them, so a building
   can no longer stand on a railway, a second road or a station just because its own code only knew its own road. Pure JavaScript (no three.js, no DOM): tools/selftest.mjs tests it.

   Claims (all in world metres, x and z; y is not used: stacking is a layer question for the road system, see Road.addLift):
     line   { t: 'line', pts: [x0, z0, x1, z1, ...], hw }             a polyline with a half width (a road, a rail edge with its bed)
     circle { t: 'circle', x, z, r }                                    (a landmark zone, a tree, a pole)
     rect   { t: 'rect', x, z, hx, hz, yaw }                            an oriented rectangle: hx along the direction (cos yaw, sin yaw), hz across it (a station, a plot)
     fn     (x, z, margin, ignore) -> true                              a provider for ground that is already answered by another object (the RoadSet answers "is a road here")
   Every claim has an owner (a string such as 'rail:12', 'station:5', 'road:main', 'plot:agra:3:1') and a kind. Who is blocked by whom is decided by the kind of the thing being PLACED:
     a claim blocks the thing being placed when RANK[claim.kind] >= RANK[as]
   so a building (1) is blocked by roads, rails, stations, landmarks and other buildings; scenery (0) is blocked by everything, trees included; a road (2) is not blocked by a building.
   `ignore` (an owner, or a list of owners) lets a thing ask without hearing about itself, and `layer` lets a flyover and the road under it coexist: claims on a different layer than the asker's are skipped.
   Queries are deterministic and allocation-light (a cell hash, 64 m cells); `margin` grows the asker by that many metres. */
export const RANK = { station: 5, landmark: 4, rail: 3, road: 2, building: 1, scenery: 0 };
const CELL = 64;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/* distance from point (px, pz) to segment (ax, az)-(bx, bz) */
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = l2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0; return Math.hypot(px - (ax + dx * t), pz - (az + dz * t)); }
/* does segment (ax, az)-(bx, bz) touch the axis-aligned box [-hx, hx] x [-hz, hz]? (slab method) */
function segBox(ax, az, bx, bz, hx, hz) {
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for (const [a, d, h] of [[ax, dx, hx], [az, dz, hz]]) {
    if (Math.abs(d) < 1e-12) { if (a < -h || a > h) return false; continue; }
    let u = (-h - a) / d, v = (h - a) / d; if (u > v) { const w = u; u = v; v = w; } t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false;
  } return true;
}
/* two oriented rectangles overlap? (separating axis test) */
function rectRect(a, b) {
  const ca = Math.cos(a.yaw), sa = Math.sin(a.yaw), cb = Math.cos(b.yaw), sb = Math.sin(b.yaw), dx = b.x - a.x, dz = b.z - a.z;
  for (const [ux, uz] of [[ca, sa], [-sa, ca], [cb, sb], [-sb, cb]]) {
    const ra = a.hx * Math.abs(ca * ux + sa * uz) + a.hz * Math.abs(-sa * ux + ca * uz), rb = b.hx * Math.abs(cb * ux + sb * uz) + b.hz * Math.abs(-sb * ux + cb * uz);
    if (Math.abs(dx * ux + dz * uz) > ra + rb) return false;
  } return true;
}
const bboxOf = c => {
  if (c.t === 'circle') return [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r];
  if (c.t === 'rect') { const e = Math.abs(Math.cos(c.yaw)) * c.hx + Math.abs(Math.sin(c.yaw)) * c.hz, f = Math.abs(Math.sin(c.yaw)) * c.hx + Math.abs(Math.cos(c.yaw)) * c.hz; return [c.x - e, c.z - f, c.x + e, c.z + f]; }
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (let i = 0; i < c.pts.length; i += 2) { x0 = Math.min(x0, c.pts[i]); x1 = Math.max(x1, c.pts[i]); z0 = Math.min(z0, c.pts[i + 1]); z1 = Math.max(z1, c.pts[i + 1]); }
  return [x0 - c.hw, z0 - c.hw, x1 + c.hw, z1 + c.hw];
};

export class KeepOut {
  constructor() { this.cells = new Map(); this.byOwner = new Map(); this.providers = []; this.n = 0; this.stamp = 0; this.names = new Map(); this.listeners = []; }
  /* a stable owner name for an object (a Road): `<prefix>:<n>`; an asker passes its own name in `ignore` */
  nameOf(obj, prefix = 'obj') { let v = this.names.get(obj); if (!v) this.names.set(obj, v = prefix + ':' + (this.names.size + 1)); return v; }
  /* register a claim: shape is a line, circle or rect (see above); opts { layer } (default 0). Returns the claim. */
  add(owner, kind, shape, opts = {}) {
    if (!(kind in RANK)) throw new Error('keepout: unknown kind ' + kind);
    const c = { ...shape, owner, kind, rank: RANK[kind], layer: opts.layer || 0, id: ++this.n }; c.bb = bboxOf(c);
    const x0 = Math.floor(c.bb[0] / CELL), x1 = Math.floor(c.bb[2] / CELL), z0 = Math.floor(c.bb[1] / CELL), z1 = Math.floor(c.bb[3] / CELL);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4096) throw new Error('keepout: claim too large for ' + owner);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i + ',' + j; let l = this.cells.get(k); if (!l) this.cells.set(k, l = []); l.push(c); }
    let l = this.byOwner.get(owner); if (!l) this.byOwner.set(owner, l = []); l.push(c); for (const f of this.listeners) f(c.bb, c); return c;
  }
  /* a long polyline can touch many cells; split by the caller if it is very long. fn providers: fn(x, z, margin) -> true when the ground is taken. */
  addProvider(owner, kind, fn, opts = {}) { if (!(kind in RANK)) throw new Error('keepout: unknown kind ' + kind); const p = { owner, kind, rank: RANK[kind], fn, layer: opts.layer || 0 }; this.providers.push(p); return p; }
  removeOwner(owner) {
    const l = this.byOwner.get(owner); if (l) { for (const c of l) { const x0 = Math.floor(c.bb[0] / CELL), x1 = Math.floor(c.bb[2] / CELL), z0 = Math.floor(c.bb[1] / CELL), z1 = Math.floor(c.bb[3] / CELL);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const cl = this.cells.get(i + ',' + j); if (cl) { const k = cl.indexOf(c); if (k >= 0) cl.splice(k, 1); if (!cl.length) this.cells.delete(i + ',' + j); } } } this.byOwner.delete(owner); }
    this.providers = this.providers.filter(p => p.owner !== owner);
  }
  get size() { let n = 0; for (const l of this.byOwner.values()) n += l.length; return n + this.providers.length; }
  /* the filter shared by every query */
  _skip(c, rank, ignore, layer) { return c.rank < rank || (ignore && (Array.isArray(ignore) ? ignore.includes(c.owner) : ignore === c.owner)) || (layer !== undefined && c.layer !== layer); }
  /* is the circle (x, z, margin) on a claim? Returns the claim (or provider) or null. opts { as: 'building', ignore, layer } */
  point(x, z, margin = 0, opts = {}) {
    const rank = RANK[opts.as === undefined ? 'building' : opts.as], l = this.cells.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL));
    if (l) for (const c of l) { if (this._skip(c, rank, opts.ignore, opts.layer)) continue; if (this._hitCircle(c, x, z, margin)) return c; }
    for (const p of this.providers) { if (this._skip(p, rank, opts.ignore, opts.layer)) continue; if (p.fn(x, z, margin, opts.ignore)) return p; }
    return null;
  }
  _hitCircle(c, x, z, m) {
    if (x < c.bb[0] - m || x > c.bb[2] + m || z < c.bb[1] - m || z > c.bb[3] + m) return false;
    if (c.t === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + m;
    if (c.t === 'rect') { const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw), u = (x - c.x) * cs + (z - c.z) * sn, v = -(x - c.x) * sn + (z - c.z) * cs, du = Math.max(Math.abs(u) - c.hx, 0), dv = Math.max(Math.abs(v) - c.hz, 0); return Math.hypot(du, dv) < m || (du === 0 && dv === 0); }
    const P = c.pts, r = c.hw + m; for (let i = 0; i + 3 < P.length; i += 2) if (segDist(x, z, P[i], P[i + 1], P[i + 2], P[i + 3]) < r) return true; return false;
  }
  /* is the oriented rectangle (centre cx, cz; half sizes hx along (cos yaw, sin yaw), hz across; grown by margin) on a claim? Returns the claim or null. */
  rect(cx, cz, hx, hz, yaw, margin = 0, opts = {}) {
    const rank = RANK[opts.as === undefined ? 'building' : opts.as], me = { x: cx, z: cz, hx: hx + margin, hz: hz + margin, yaw }, e = Math.abs(Math.cos(yaw)) * me.hx + Math.abs(Math.sin(yaw)) * me.hz, f = Math.abs(Math.sin(yaw)) * me.hx + Math.abs(Math.cos(yaw)) * me.hz;
    const x0 = Math.floor((cx - e) / CELL), x1 = Math.floor((cx + e) / CELL), z0 = Math.floor((cz - f) / CELL), z1 = Math.floor((cz + f) / CELL), seen = ++this.stamp;
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const l = this.cells.get(i + ',' + j); if (!l) continue;
      for (const c of l) { if (c._seen === seen) continue; c._seen = seen; if (this._skip(c, rank, opts.ignore, opts.layer)) continue; if (cx + e < c.bb[0] || cx - e > c.bb[2] || cz + f < c.bb[1] || cz - f > c.bb[3]) continue; if (this._hitRect(c, me)) return c; } }
    if (this.providers.length) { const cs = Math.cos(yaw), sn = Math.sin(yaw), pt = (u, v) => [cx + cs * u - sn * v, cz + sn * u + cs * v];
      for (const [u, v] of [[0, 0], [-me.hx, -me.hz], [me.hx, -me.hz], [-me.hx, me.hz], [me.hx, me.hz], [0, -me.hz], [0, me.hz], [-me.hx, 0], [me.hx, 0]]) { const [px, pz] = pt(u, v); for (const p of this.providers) { if (this._skip(p, rank, opts.ignore, opts.layer)) continue; if (p.fn(px, pz, 0, opts.ignore)) return p; } } }
    return null;
  }
  _hitRect(c, me) {
    if (c.t === 'circle') { const cs = Math.cos(me.yaw), sn = Math.sin(me.yaw), u = (c.x - me.x) * cs + (c.z - me.z) * sn, v = -(c.x - me.x) * sn + (c.z - me.z) * cs; return Math.hypot(Math.max(Math.abs(u) - me.hx, 0), Math.max(Math.abs(v) - me.hz, 0)) < c.r; }
    if (c.t === 'rect') return rectRect(me, c);
    const cs = Math.cos(me.yaw), sn = Math.sin(me.yaw), P = c.pts, g = c.hw;                                   // a polyline: its segments against the rectangle grown by the half width, in the rectangle's frame
    for (let i = 0; i + 3 < P.length; i += 2) {
      const ax = (P[i] - me.x) * cs + (P[i + 1] - me.z) * sn, az = -(P[i] - me.x) * sn + (P[i + 1] - me.z) * cs, bx = (P[i + 2] - me.x) * cs + (P[i + 3] - me.z) * sn, bz = -(P[i + 2] - me.x) * sn + (P[i + 3] - me.z) * cs;
      if (segBox(ax, az, bx, bz, me.hx + g, me.hz + g)) { if (g === 0 || segBoxRound(ax, az, bx, bz, me.hx, me.hz, g)) return true; }
    } return false;
  }
}
/* segment against the box grown by r with ROUND corners (exact): true when the segment passes within r of the box */
function segBoxRound(ax, az, bx, bz, hx, hz, r) {
  if (segBox(ax, az, bx, bz, hx, hz + r) || segBox(ax, az, bx, bz, hx + r, hz)) return true;                    // inside the cross-shaped part (flat sides)
  for (const [qx, qz] of [[hx, hz], [-hx, hz], [hx, -hz], [-hx, -hz]]) if (segDist(qx, qz, ax, az, bx, bz) < r) return true;      // or within r of a corner
  return false;
}

/* ---- claims from the game's data (pure, so the self-test can check them) ---- */
export const RAIL_BED = 4.2, STATION_HALF_LEN = 62, STATION_TRACK_GAP = 5.3;
/* a railway edge: flat pts [x, z, ...] in world metres, `tracks` parallel tracks; the bed (ballast and embankment) is wider than the rails: half width = half the track spread + RAIL_BED */
export function railClaim(ko, id, pts, tracks = 1) {
  const hw = (Math.max(1, tracks) - 1) * STATION_TRACK_GAP / 2 + RAIL_BED, out = []; let run = [pts[0], pts[1]], len = 0;       // split into runs of about 300 m so each claim touches few cells
  for (let i = 2; i < pts.length; i += 2) { run.push(pts[i], pts[i + 1]); len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); if (len > 300 && i + 2 < pts.length) { out.push(ko.add('rail:' + id, 'rail', { t: 'line', pts: run, hw })); run = [pts[i], pts[i + 1]]; len = 0; } }
  if (run.length >= 4) out.push(ko.add('rail:' + id, 'rail', { t: 'line', pts: run, hw })); return out;
}
/* a station at world (x, z) on track direction (ux, uz) with `tracks` tracks: platforms + canopy 120 m long along the track, the building 17 m beyond the outer track (rail_view.js buildStation) */
export function stationClaim(ko, id, x, z, ux, uz, tracks = 1) { const halfT = (Math.max(1, tracks) - 1) * STATION_TRACK_GAP / 2; return ko.add('station:' + id, 'station', { t: 'rect', x: x + ux * 10, z: z + uz * 10, hx: STATION_HALF_LEN + 10, hz: halfT + 23, yaw: Math.atan2(uz, ux) }); }
/* a roadSet as a provider: "is a road here". Each Road has an owner name ko.nameOf(road, 'road'); an asker passes its own road's name in `ignore`, so a road's own district does not hear about its own road. */
export function roadProvider(ko, roadSet, owner = 'roads') {
  return ko.addProvider(owner, 'road', (x, z, m, ignore) => { const R = roadSet.roads, ig = ignore ? (Array.isArray(ignore) ? ignore : [ignore]) : null;
    for (let i = 0; i < R.length; i++) { const r = R[i]; if (ig && ig.includes(ko.nameOf(r, 'road'))) continue; if (r.nearest(x, z) && r.hit.d < r.style.outer + 1.5 + m) return true; } return false; });
}
/* the whole railway network: network = { edges: [{ id, pts (flat game x, z) }], stations: [{ id, x, z }], adj: Map(stationId -> edges) } (rail.js), tracks[i] the track count of edges[i], toWorld(gx, gz) -> { x, z } */
export function registerRail(ko, { network, tracks, toWorld }) {
  const edges = network.edges; edges.forEach((e, i) => { const w = new Array(e.pts.length); for (let k = 0; k < e.pts.length; k += 2) { const p = toWorld(e.pts[k], e.pts[k + 1]); w[k] = p.x; w[k + 1] = p.z; } railClaim(ko, e.id, w, (tracks && tracks[i]) || 1); });
  for (const n of network.stations) { const l = network.adj.get(n.id), e = l && l[0]; if (!e) continue; const P = e.pts, fwd = e.a === n.id, i = fwd ? 0 : P.length / 2 - 1, j = fwd ? 1 : P.length / 2 - 2, a = toWorld(P[i * 2], P[i * 2 + 1]), b = toWorld(P[j * 2], P[j * 2 + 1]), tl = Math.hypot(b.x - a.x, b.z - a.z) || 1, w = toWorld(n.x, n.z);
    stationClaim(ko, n.id, w.x, w.z, (b.x - a.x) / tl, (b.z - a.z) / tl, Math.max(...l.map(e2 => (tracks && tracks[edges.indexOf(e2)]) || 1))); }
}
