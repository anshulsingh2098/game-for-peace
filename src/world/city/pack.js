/* The city pack as the game reads it (docs/CITY_PACK.md section 5 and 5a). Pure JavaScript (no three.js, no DOM), so tools/selftest.mjs can test it.
   `dec` and the width tables are copies of tools/lib/packio.mjs (the game must not import from tools/, which is not deployed); the selftest compares the two.
   A CityPack loads the manifest, the graph (columnar, kept as typed arrays: 406,000 edges in Delhi) and the landmarks once, and tiles one at a time on request. */

export const LANE_W = { motorway: 3.5, trunk: 3.5, primary: 3.4, secondary: 3.2, tertiary: 3.0, residential: 2.8, service: 2.8, cycleway: 1.5, busway: 3.4, footway: 1.2 };
export const DEFAULT_SIDEWALK = { motorway: 0, trunk: 0, primary: 2, secondary: 2, tertiary: 2, residential: 1, service: 0, footway: 0, cycleway: 0, busway: 0 };
export const defaultWidth = (cls, lanes) => Math.max(1, Math.round(lanes * LANE_W[cls] * 10) / 10);
/* decimetre, delta coded coordinate list -> metres (the same as packio.dec) */
export function dec(d, ox = 0, oz = 0) { const o = new Array(d.length); let x = 0, z = 0; for (let i = 0; i < d.length; i += 2) { x += d[i]; z += d[i + 1]; o[i] = ox + x / 10; o[i + 1] = oz + z / 10; } return o; }

/* a tile as the loader hands it over: coordinates in absolute metres */
export function decodeTile(j, size) {
  if (j.enc !== 1) return j; const ox = j.tx * size, oz = j.tz * size, o = { ...j }; delete o.enc;
  for (const k of ['streets', 'blocks', 'buildings', 'landuse', 'parks', 'water', 'waterways']) o[k] = (j[k] || []).map(e => { const n = { ...e }; if (n.pts) n.pts = dec(n.pts, ox, oz); if (n.ring) n.ring = dec(n.ring, ox, oz); if (n.holes) n.holes = n.holes.map(h => dec(h, ox, oz)); return n; });
  return o;
}

/* the graph as typed columns: cls (index into classes), lanes, oneway, layer, flags, a, b (node ids), len (m); nodes xz (Float32Array, x then z), nodeFlags; `up[n]` counts the raised edges (layer 1 or more) at a node */
export function decodeGraphColumns(j) {
  if (j.enc !== 1) throw new Error('graph: unknown encoding ' + j.enc);
  const xz = dec(j.nodes.xz), c = j.edges, n = c.a.length, a = new Int32Array(n), b = new Int32Array(n), len = new Float32Array(n), nn = j.nodes.flags.length;
  let pa = 0; for (let i = 0; i < n; i++) { pa += c.a[i]; a[i] = pa; b[i] = pa + c.d[i]; len[i] = c.len[i] / 10; }
  const layer = Int8Array.from(c.layer), up = new Uint8Array(nn), dn = new Uint8Array(nn); for (let i = 0; i < n; i++) { if (layer[i] > 0) { if (up[a[i]] < 255) up[a[i]]++; if (up[b[i]] < 255) up[b[i]]++; } else if (layer[i] < 0) { if (dn[a[i]] < 255) dn[a[i]]++; if (dn[b[i]] < 255) dn[b[i]]++; } }
  return { n, nodes: nn, classes: j.classes, cls: Uint8Array.from(c.cls), lanes: Uint8Array.from(c.lanes), oneway: Int8Array.from(c.oneway), speed: Uint16Array.from(c.speed), layer, flags: Uint8Array.from(c.flags), name: Uint32Array.from(c.name || new Array(n).fill(0)), a, b, len, xz: Float32Array.from(xz), nodeFlags: Uint8Array.from(j.nodes.flags), up, dn, names: j.names };
}

export const LEVEL = 5.6, RAMP = 70;                                       // a flyover deck is 5.6 m per layer above the ground; ramps are up to 70 m long (a grade of 8 %)
const sstep = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/* how far above the ground the road surface of edge `id` is at (x, z): 0 on the ground, layer x LEVEL on a flyover or bridge, with a ramp at each end that does not continue as another raised edge.
   Underpasses (layer below 0) are not drawn yet, so they are not asked. */
export function deckHeight(G, id, x, z) {
  const lay = G.layer[id]; if (lay <= 0) return 0; const A = G.a[id], B = G.b[id], H = Math.min(lay, 3) * LEVEL, ramp = Math.max(8, Math.min(G.len[id] / 2, RAMP * Math.min(lay, 3)));
  const fa = G.up[A] >= 2 ? 1 : sstep(Math.hypot(x - G.xz[A * 2], z - G.xz[A * 2 + 1]) / ramp), fb = G.up[B] >= 2 ? 1 : sstep(Math.hypot(x - G.xz[B * 2], z - G.xz[B * 2 + 1]) / ramp);
  return H * Math.min(fa, fb);
}
/* how far below the ground an underpass street (layer below 0) is at (x, z), as a positive depth: layer x LEVEL, with a ramp at each end that does not continue as another sunken edge (`dn` counts them at a node) */
export function underDepth(G, id, x, z) {
  const lay = G.layer[id]; if (lay >= 0) return 0; const m = Math.min(-lay, 2), A = G.a[id], B = G.b[id], H = m * LEVEL, ramp = Math.max(8, Math.min(G.len[id] / 2, RAMP * m));
  const fa = G.dn[A] >= 2 ? 1 : sstep(Math.hypot(x - G.xz[A * 2], z - G.xz[A * 2 + 1]) / ramp), fb = G.dn[B] >= 2 ? 1 : sstep(Math.hypot(x - G.xz[B * 2], z - G.xz[B * 2 + 1]) / ramp);
  return H * Math.min(fa, fb);
}
export const OPEN_CUT = 3.4;                                                  // a sunken street is open to the sky while shallower than this (m), and roofed (the ground is its ceiling) below it: a car is 1.5 m high
/* width (carriageway, m) and sidewalk (0, 1 or 2 sides) of a street piece of a tile on edge `id` */
export const pieceWidth = (G, s) => (s.width !== undefined ? s.width : defaultWidth(G.classes[G.cls[s.id]], G.lanes[s.id]));
export const pieceSidewalk = (G, s) => (s.sidewalk !== undefined ? s.sidewalk : DEFAULT_SIDEWALK[G.classes[G.cls[s.id]]]);

/* bearing in radians clockwise from north (the pack's convention) -> the game's yaw (direction (cos, sin) in x east, z south) */
export const yawFromBearing = b => Math.atan2(-Math.cos(b), Math.sin(b));

/* the corner of an oriented box around a footprint (flat [x, z, ...]) along `yaw`: { x, z, hx, hz, yaw } as a keep-out rect */
export function footprintRect(fp, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw); let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < fp.length; i += 2) { const u = fp[i] * c + fp[i + 1] * s, v = -fp[i] * s + fp[i + 1] * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2; return { t: 'rect', x: cu * c - cv * s, z: cu * s + cv * c, hx: (u1 - u0) / 2, hz: (v1 - v0) / 2, yaw };
}

export class CityPack {
  constructor(base, fetchJson) { this.base = base.replace(/\/$/, ''); this.get = fetchJson || (async u => { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); this.have = null; }
  async init() {
    const [M, g, L] = await Promise.all([this.get(this.base + '/manifest.json'), this.get(this.base + '/graph.json'), this.get(this.base + '/landmarks.json')]);
    if (M.format > 1) throw new Error('city pack format ' + M.format + ' is newer than this game reads'); this.M = M; this.size = M.tileSize; this.G = decodeGraphColumns(g); this.landmarks = L.landmarks; this.lm = new Map(L.landmarks.map(l => [l.id, l]));
    this.have = new Set(M.tiles.map(t => t.tx + '_' + t.tz)); return this;
  }
  hasTile(tx, tz) { return this.have.has(tx + '_' + tz); }
  async tile(tx, tz) { if (!this.hasTile(tx, tz)) return null; return decodeTile(await this.get(this.base + '/tiles/' + tx + '_' + tz + '.json'), this.size); }
  /* where to start: ?at=<spawn, landmark or gate id>, default the centre spawn. Returns { x, z, yaw (game), name } */
  start(id) {
    const M = this.M, sp = M.spawns.find(s => s.id === id) || M.spawns.find(s => s.id === 'centre') || M.spawns[0];
    if (id) { const g = M.gates.find(x => x.id === id); if (g) return { x: g.x, z: g.z, yaw: yawFromBearing(g.bearing), name: g.name || g.id };
      const l = this.lm.get(id); if (l && !M.spawns.find(s => s.id === id)) { const n = this.nearestNode(l.x, l.z); return { x: n.x, z: n.z, yaw: Math.atan2(l.z - n.z, l.x - n.x), name: l.name.en }; } }
    return { x: sp.x, z: sp.z, yaw: yawFromBearing(sp.yaw), name: sp.name };
  }
  /* the graph node nearest to (x, z) (a plain scan: used once at the start) */
  nearestNode(x, z) { const xz = this.G.xz; let best = 0, bd = Infinity; for (let i = 0; i < this.G.nodes; i++) { const d = (xz[i * 2] - x) ** 2 + (xz[i * 2 + 1] - z) ** 2; if (d < bd) { bd = d; best = i; } } return { x: xz[best * 2], z: xz[best * 2 + 1], d: Math.sqrt(bd) }; }
}
