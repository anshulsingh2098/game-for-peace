/* Navigation graph (N10): roads, lanes, sidewalks and crossings as a directed graph, built from the road the world already generates, in chunks that follow the world sectors.
   Pure JavaScript (no three.js), so the self-test runs it headless. Two layers:
   - NavGraph: a generic graph (nodes with positions and a kind, directed edges with attributes), a spatial hash for "nearest node", a bounded A* with a cache, route validation and
     recovery. Knows nothing about roads.
   - RoadNav: builds that graph from a Road (router.js) in chunks, one per world sector (sectors.js), and removes a chunk when its sector unloads.
   The road API (`road.at(s)`, bridgeW, tunnelW ...) is read, never changed.

   What the graph holds (RoadNav): every STEP (25 m) of road there is one node per lane per direction ('d' nodes), and one node per side of the road for pedestrians ('w' nodes).
   Edges (kind): 'drive'   along a lane in its direction of travel (traffic keeps right or left as the region says), with a speed target, road class, width, surface, grade, curvature and
                           whether it is carried on a bridge or in a tunnel; 'lane' to the next node of the neighbouring lane going the same way (a lane change);
                 'walk'    along a sidewalk, both ways (never on the carriageway; on a bridge inside the rail; in a tunnel on the raised walkway);
                 'cross'   a pedestrian crossing from one sidewalk to the other, only at crossing nodes (every CROSS_EVERY metres on a straight, uncarried stretch); on boulevards and
                           highways it is signalled: the crossing has a signal id and the drive nodes just before it are marked as stop lines for that signal.
   Junctions and level crossings: the data model supports them (degree above two nodes, an edge `level` for flyovers, which only connect where an edge joins them); the single
   generated road has none yet, N11 adds side streets. The tests cover a roundabout, a dead end and a flyover on synthetic graphs.
   Query contract for traffic and pedestrian systems: nearestNode(x, z, mode), route(from, to, { mode, maxNodes }) -> { ok, nodes, edges, length, version } | { ok: false, reason },
   validateRoute(route), recoverRoute(route, x, z), outEdges(id), node(id). Search is bounded (maxNodes expanded) and cached; nothing scans the whole graph per frame. */
import { laneOffsets } from '../traffic/sim.js';

export const STEP = 25, CROSS_EVERY = 150, SIGNAL_STYLES = ['boulevard', 'highway'], STOP_LINE_NODES = 1;
const SPEED = { 'two-lane': 22, highway: 30, boulevard: 16, dirt: 12, gravel: 14 };       // m/s, the same table as the traffic sim's speed limits

/* is there a pedestrian crossing at road sample i? every CROSS_EVERY metres, on a straight stretch that is not carried on a bridge or in a tunnel (shared with the district builder, so painted crossings and graph crossings are the same places) */
export function crossingAt(road, i, p = {}) {
  if (i % (CROSS_EVERY / STEP) !== 0) return false; const s = i * STEP; if (road.bridgeW(s) === 1 || road.tunnelW(s) >= 0.99) return false;
  road.at(s - STEP, p); const th0 = p.th; road.at(s + STEP, p); return Math.abs(Math.atan2(Math.sin(p.th - th0), Math.cos(p.th - th0))) < 0.12;
}

/* ---------- generic graph ---------- */
export class NavGraph {
  constructor({ cell = 64, cacheSize = 256 } = {}) {
    this.nodes = new Map(); this.edges = new Map(); this.out = new Map(); this.cell = cell; this.hash = new Map(); this.version = 0; this.cache = new Map(); this.cacheSize = cacheSize;
    this.stats = { routes: 0, hits: 0, expanded: 0, failed: 0 };
  }
  key(x, z) { return Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell); }
  addNode(n) {
    if (this.nodes.has(n.id)) return this.nodes.get(n.id); this.nodes.set(n.id, n); this.out.set(n.id, []); const k = this.key(n.x, n.z); let b = this.hash.get(k); if (!b) this.hash.set(k, b = new Set()); b.add(n.id); this.version++; return n;
  }
  /* edge: { id, a, b, kind, len?, ...attributes }; both ends must exist; returns the edge (or the existing one with that id) */
  addEdge(e) {
    if (this.edges.has(e.id)) return this.edges.get(e.id); const A = this.nodes.get(e.a), B = this.nodes.get(e.b); if (!A || !B) return null;
    if (e.len === undefined) e.len = Math.hypot(B.x - A.x, B.z - A.z); this.edges.set(e.id, e); this.out.get(e.a).push(e); this.version++; return e;
  }
  node(id) { return this.nodes.get(id) || null; }
  outEdges(id) { return this.out.get(id) || []; }
  removeNode(id) { return this.removeNodes([id]) > 0; }
  /* remove several nodes with every edge touching them in one pass over the graph (a chunk unloading) */
  removeNodes(ids) {
    const gone = new Set(); for (const id of ids) { const n = this.nodes.get(id); if (!n) continue; gone.add(id); for (const e of this.out.get(id)) this.edges.delete(e.id); this.out.delete(id); this.nodes.delete(id);
      const k = this.key(n.x, n.z), bk = this.hash.get(k); if (bk) { bk.delete(id); if (!bk.size) this.hash.delete(k); } }
    if (!gone.size) return 0; for (const [oid, list] of this.out) { let hit = false; for (const e of list) if (gone.has(e.b)) { hit = true; this.edges.delete(e.id); } if (hit) this.out.set(oid, list.filter(e => !gone.has(e.b))); } this.version++; return gone.size;
  }
  /* the nearest node of a mode ('drive': nodes with kind 'd'; 'walk': kind 'w'; anything else: all) within maxDist, by looking only at the cells around the point */
  nearestNode(x, z, mode = 'drive', maxDist = 80) {
    const want = mode === 'drive' ? 'd' : mode === 'walk' ? 'w' : null; let best = null, bd = maxDist * maxDist; const R = Math.ceil(maxDist / this.cell), cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let i = cx - R; i <= cx + R; i++) for (let j = cz - R; j <= cz + R; j++) { const b = this.hash.get(i + ',' + j); if (!b) continue; for (const id of b) { const n = this.nodes.get(id); if (want && n.kind !== want) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } } }
    return best;
  }
  /* bounded A*: at most maxNodes nodes are expanded; mode 'drive' uses 'drive' and 'lane' edges, 'walk' uses 'walk' and 'cross' edges. Results (and failures) are cached until the graph changes. */
  route(from, to, { mode = 'drive', maxNodes = 600 } = {}) {
    this.stats.routes++; const ck = from + '>' + to + '|' + mode + '|' + maxNodes; const hit = this.cache.get(ck); if (hit && hit.version === this.version) { this.stats.hits++; this.cache.delete(ck); this.cache.set(ck, hit); return hit; }
    const A = this.nodes.get(from), B = this.nodes.get(to); let res;
    if (!A || !B) res = { ok: false, reason: 'no such node', version: this.version };
    else {
      const ok = e => mode === 'drive' ? (e.kind === 'drive' || e.kind === 'lane') : (e.kind === 'walk' || e.kind === 'cross'); const g = new Map([[from, 0]]), prev = new Map(), open = [[Math.hypot(B.x - A.x, B.z - A.z), from]], done = new Set(); let expanded = 0, found = false;
      while (open.length) {
        let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i; const [, id] = open.splice(bi, 1)[0]; if (done.has(id)) continue; done.add(id);
        if (id === to) { found = true; break; } if (++expanded > maxNodes) break;
        for (const e of this.out.get(id) || []) { if (!ok(e) || !this.nodes.has(e.b)) continue; const cost = g.get(id) + e.len * (e.kind === 'lane' ? 1.5 : 1) + (e.signal && e.kind === 'cross' ? 10 : 0); if (cost < (g.has(e.b) ? g.get(e.b) : Infinity)) { g.set(e.b, cost); prev.set(e.b, e); const N = this.nodes.get(e.b); open.push([cost + Math.hypot(B.x - N.x, B.z - N.z), e.b]); } }
      }
      this.stats.expanded += expanded;
      if (found) { const edges = []; let c = to; while (c !== from) { const e = prev.get(c); edges.push(e); c = e.a; } edges.reverse(); res = { ok: true, nodes: [from, ...edges.map(e => e.b)], edges, length: edges.reduce((a, e) => a + e.len, 0), mode, version: this.version, expanded }; }
      else { this.stats.failed++; res = { ok: false, reason: expanded > maxNodes ? 'search limit reached' : 'no path', expanded, version: this.version }; }
    }
    this.cache.set(ck, res); if (this.cache.size > this.cacheSize) this.cache.delete(this.cache.keys().next().value); return res;
  }
  /* does every edge of the route still exist (a sector may have unloaded, the graph may have changed)? */
  validateRoute(route) { return !!route && route.ok && route.edges.every(e => this.edges.get(e.id) === e && this.nodes.has(e.a) && this.nodes.has(e.b)); }
  /* a new route from the node nearest (x, z) to the old route's destination; the old route's result if it is still valid */
  recoverRoute(route, x, z, opts = {}) {
    if (this.validateRoute(route)) return route; const dest = route && route.nodes ? route.nodes[route.nodes.length - 1] : null; if (!dest) return { ok: false, reason: 'no route to recover' };
    const mode = (route && route.mode) || opts.mode || 'drive', start = this.nearestNode(x, z, mode, opts.maxDist || 80); if (!start) return { ok: false, reason: 'no node near' }; return this.route(start.id, dest, { mode, maxNodes: opts.maxNodes || 600 });
  }
}

/* ---------- the road as a graph, in sector chunks ---------- */
export class RoadNav {
  /* road: a Road; drive: 'left' | 'right'; sectorSize: the world sector size (sectors.js) */
  constructor(road, { drive = 'right', sectorSize = 512, graph = new NavGraph() } = {}) {
    this.road = road; this.drive = drive; this.size = sectorSize; this.graph = graph; this.chunks = new Map(); this.lanes = laneOffsets(road.style); this.style = road.style; this._p = {};
    this.walkOff = road.style.shoulder + 1.2; this.signals = new Map();
  }
  sectorOf(x, z) { return Math.floor(x / this.size) + ',' + Math.floor(z / this.size); }
  /* lateral offset (m along the road's left normal) of lane k going dir */
  lateral(dir, k) { const off = this.lanes[k], right = this.drive === 'right'; return (dir > 0) === right ? -off : off; }
  /* the sample index range (inclusive) of road inside a sector square, by walking the road in STEP-metre samples: the index is round(s / STEP) so ids never depend on the chunking */
  indicesInSector(sx, sz) {
    const R = this.road, x0 = sx * this.size, z0 = sz * this.size, x1 = x0 + this.size, z1 = z0 + this.size, out = [], p = this._p, lo = Math.ceil((R.sMin + 30) / STEP), hi = Math.floor((R.sMax - 30) / STEP);
    for (let i = lo; i <= hi; i++) { R.at(i * STEP, p); if (p.x >= x0 && p.x < x1 && p.z >= z0 && p.z < z1) out.push(i); } return out;
  }
  nodeId(kind, i, key) { return kind + ':' + i + ':' + key; }
  /* build (or rebuild) the chunk for a sector; returns the number of nodes created */
  loadSector(sx, sz) {
    const id = sx + ',' + sz; if (this.chunks.has(id)) return 0; const G = this.graph, R = this.road, st = this.style, idx = this.indicesInSector(sx, sz), made = [], p = this._p;
    for (const i of idx) {
      const s = i * STEP; R.at(s, p); const x = p.x, z = p.z, nx = -p.tz, nz = p.tx, bridge = R.bridgeW(s) === 1, tunnel = R.tunnelW(s) >= 0.99, carried = bridge ? 'bridge' : tunnel ? 'tunnel' : null, slope = p.slope;
      const at = (lat) => ({ x: x + nx * lat, z: z + nz * lat, y: p.y });
      for (const dir of [1, -1]) for (let k = 0; k < this.lanes.length; k++) { const key = (dir > 0 ? 'f' : 'b') + k, n = G.addNode({ id: this.nodeId('d', i, key), kind: 'd', i, s, dir, lane: k, carried, sector: id, ...at(this.lateral(dir, k)) }); made.push(n.id); }
      const wl = bridge ? st.shoulder - 0.8 : tunnel ? st.shoulder + 0.8 - 0.35 : this.walkOff;
      for (const side of [1, -1]) { const n = G.addNode({ id: this.nodeId('w', i, side > 0 ? 'L' : 'R'), kind: 'w', i, s, side, carried, sector: id, ...at(side * wl) }); made.push(n.id); }
    }
    this.chunks.set(id, { id, sx, sz, nodes: made, idx });
    for (const i of idx) { this.connect(i); this.connect(i - 1); }                                                      // edges to the neighbours' nodes, if those are loaded: either order of loading gives the same graph
    return made.length;
  }
  /* create every edge between sample i and i + 1 whose two ends exist (and the crossing at i); safe to call again */
  connect(i) {
    const G = this.graph, st = this.style, R = this.road, p = this._p, a = (kind, key) => G.node(this.nodeId(kind, i, key)), b = (kind, key) => G.node(this.nodeId(kind, i + 1, key));
    R.at(i * STEP, p); const th0 = p.th, slope = p.slope; R.at((i + 1) * STEP, p); const curv = Math.abs(Math.atan2(Math.sin(p.th - th0), Math.cos(p.th - th0))) / STEP; const s = i * STEP, bridge = R.bridgeW(s) === 1, tunnel = R.tunnelW(s) >= 0.99, carried = bridge ? 'bridge' : tunnel ? 'tunnel' : null;
    const base = { cls: st.id, speed: SPEED[st.id] || 20, width: st.half / this.lanes.length, surface: st.id === 'dirt' || st.id === 'gravel' ? st.id : 'asphalt', grade: slope, curv, carried };
    for (let k = 0; k < this.lanes.length; k++) {
      const f0 = a('d', 'f' + k), f1 = b('d', 'f' + k), b0 = a('d', 'b' + k), b1 = b('d', 'b' + k);
      if (f0 && f1) G.addEdge({ id: 'e:f' + k + ':' + i, a: f0.id, b: f1.id, kind: 'drive', ...base });
      if (b0 && b1) G.addEdge({ id: 'e:b' + k + ':' + i, a: b1.id, b: b0.id, kind: 'drive', ...base });
      for (const dk of [-1, 1]) { const k2 = k + dk; if (k2 < 0 || k2 >= this.lanes.length) continue; const g1 = b('d', 'f' + k2); if (f0 && g1) G.addEdge({ id: 'e:lf' + k + '>' + k2 + ':' + i, a: f0.id, b: g1.id, kind: 'lane', ...base }); const bb0 = b('d', 'b' + k), ba2 = a('d', 'b' + k2); if (bb0 && ba2) G.addEdge({ id: 'e:lb' + k + '>' + k2 + ':' + i, a: bb0.id, b: ba2.id, kind: 'lane', ...base }); }
    }
    for (const side of ['L', 'R']) { const w0 = a('w', side), w1 = b('w', side); if (w0 && w1) { const wb = { cls: 'sidewalk', speed: 1.4, width: 1.6, surface: 'paved', grade: slope, curv, carried }; G.addEdge({ id: 'e:w' + side + '>' + i, a: w0.id, b: w1.id, kind: 'walk', ...wb }); G.addEdge({ id: 'e:w' + side + '<' + i, a: w1.id, b: w0.id, kind: 'walk', ...wb }); } }
    // crossing at i: straight, uncarried, every CROSS_EVERY metres
    if (crossingAt(R, i, p)) {
      const wl = a('w', 'L'), wr = a('w', 'R');
      if (wl && wr && !wl.carried) {
        const sig = SIGNAL_STYLES.includes(st.id) ? 'sig:' + i : null; wl.crossing = wr.crossing = true; const cb = { cls: 'crossing', speed: 1.4, width: 3, surface: 'paved', grade: 0, curv: 0, carried: null, signal: sig };
        G.addEdge({ id: 'e:xLR:' + i, a: wl.id, b: wr.id, kind: 'cross', ...cb }); G.addEdge({ id: 'e:xRL:' + i, a: wr.id, b: wl.id, kind: 'cross', ...cb });
        if (sig) { this.signals.set(sig, { id: sig, i, s: i * STEP, x: (wl.x + wr.x) / 2, z: (wl.z + wr.z) / 2 }); for (const key of ['f', 'b']) for (let k = 0; k < this.lanes.length; k++) { const j = key === 'f' ? i - STOP_LINE_NODES : i + STOP_LINE_NODES, n = G.node(this.nodeId('d', j, key + k)); if (n) n.stopFor = sig; } }
      }
    }
  }
  /* drop a sector's chunk: its nodes and every edge touching them; routes through it stop being valid */
  unloadSector(sx, sz) {
    const id = sx + ',' + sz, c = this.chunks.get(id); if (!c) return 0; const n = this.graph.removeNodes(c.nodes); this.chunks.delete(id); return n;
  }
  unloadAll() { for (const c of [...this.chunks.values()]) this.unloadSector(c.sx, c.sz); this.signals.clear(); }
  summary() { const g = this.graph; let drive = 0, walk = 0, cross = 0, lane = 0; for (const e of g.edges.values()) { if (e.kind === 'drive') drive++; else if (e.kind === 'walk') walk++; else if (e.kind === 'cross') cross++; else lane++; } return { chunks: this.chunks.size, nodes: g.nodes.size, drive, lane, walk, cross, signals: this.signals.size, ...g.stats, version: g.version }; }
}
