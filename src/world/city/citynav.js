/* Navigation on the city pack's street graph (CITY_PLAN D5b follow-up, WORK_REMAINING 12.6). Pure JavaScript (no three.js, no DOM), so tools/selftest.mjs can test it. A port of tools/lib/graphroute.mjs onto the game's
   columnar graph (pack.js decodeGraphColumns), with A* (straight-line distance at the fastest class speed), turn-by-turn steps and `PathRoad`, a polyline that quacks like the engine's Road for autodrive (closestS, at). */
const DRIVE_SKIP = new Set(['footway', 'cycleway', 'busway', 'service']), SLOW = 0.55, VMAX = 100 / 3.6 * SLOW;       // service lanes are skipped by the router (parking aisles, petrol pumps); VMAX: the fastest assumed average speed (m/s)
export const bearingWord = d => { const a = Math.abs(d); return a < 25 ? 'Continue' : a < 60 ? (d > 0 ? 'Bear right' : 'Bear left') : a < 135 ? (d > 0 ? 'Turn right' : 'Turn left') : 'Make a U-turn'; };

/* a spatial index of the street edges (500 m cells, an edge in every cell its chord crosses), filled a slice per step() so it never costs a frame; `keep(className)` chooses the classes (default all but foot, cycle and bus ways) */
const SLICE_POPS = 400, EDGE_SLICE = 2000;                                        // node expansions per slice of a search, and edges per slice of the street index: each about a millisecond
const drain = it => { for (;;) { const r = it.next(); if (r.done) return r.value; } };       // run a generator to its end (the one-go versions of routeNodes and plan)
export class EdgeIndex {
  constructor(G, keep = c => c !== 'footway' && c !== 'cycleway' && c !== 'busway') { this.G = G; this.cell = 500; this.cells = new Map(); this.next = 0; this.done = false; this.seen = new Uint32Array(G.n); this.gen = 0; this.keep = G.classes.map(keep); }
  step(budget = 30000) {
    const G = this.G, c = this.cell, end = Math.min(G.n, this.next + budget);
    for (let e = this.next; e < end; e++) {
      if (!this.keep[G.cls[e]]) continue; const A = G.a[e], B = G.b[e], x0 = G.xz[A * 2], z0 = G.xz[A * 2 + 1], x1 = G.xz[B * 2], z1 = G.xz[B * 2 + 1], n = Math.max(1, Math.ceil(G.len[e] / (c / 2)));
      let last = ''; for (let k = 0; k <= n; k++) { const f = k / n, key = Math.floor((x0 + (x1 - x0) * f) / c) + ',' + Math.floor((z0 + (z1 - z0) * f) / c); if (key === last) continue; last = key; let l = this.cells.get(key); if (!l) this.cells.set(key, l = []); l.push(e); }
    }
    this.next = end; if (end >= G.n) this.done = true;
  }
  finish() { while (!this.done) this.step(1e9); }
  /* each edge (once) with a chord crossing a cell of the box: fn(e) */
  each(x0, z0, x1, z1, fn) { const c = this.cell, g = ++this.gen; for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) { const l = this.cells.get(i + ',' + j); if (l) for (const e of l) { if (this.seen[e] === g) continue; this.seen[e] = g; fn(e); } } }
}

class Heap {                                                                  // binary min-heap on (key, node)
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; } }
  pop() { const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(); if (k.length) { k[0] = lk; v[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < k.length && k[l] < k[s]) s = l; if (r < k.length && k[r] < k[s]) s = r; if (s === i) break; [k[s], k[i]] = [k[i], k[s]]; [v[s], v[i]] = [v[i], v[s]]; i = s; } } return top; }
}

export class CityRouter {
  /* G: decodeGraphColumns result. Ground-level and raised streets are routable; underpass edges too (a layer is only a height here). */
  constructor(G) {
    this.G = G; const N = G.nodes, n = G.n, deg = new Int32Array(N + 1), ok = e => !DRIVE_SKIP.has(G.classes[G.cls[e]]);
    for (let e = 0; e < n; e++) { if (!ok(e)) continue; const o = G.oneway[e]; if (o >= 0) deg[G.a[e]]++; if (o <= 0) deg[G.b[e]]++; }
    const start = new Int32Array(N + 1); for (let i = 0; i < N; i++) start[i + 1] = start[i] + deg[i]; const fill = start.slice(0, N), to = new Int32Array(start[N]), ed = new Int32Array(start[N]);
    for (let e = 0; e < n; e++) { if (!ok(e)) continue; const o = G.oneway[e], a = G.a[e], b = G.b[e]; if (o >= 0) { to[fill[a]] = b; ed[fill[a]++] = e; } if (o <= 0) { to[fill[b]] = a; ed[fill[b]++] = e; } }
    this.start = start; this.to = to; this.ed = ed; this.cell = 250; this.grid = new Map();
    for (let i = 0; i < N; i++) if (start[i + 1] > start[i]) { const k = Math.floor(G.xz[i * 2] / this.cell) + ',' + Math.floor(G.xz[i * 2 + 1] / this.cell); let l = this.grid.get(k); if (!l) this.grid.set(k, l = []); l.push(i); }
    this.edges = new EdgeIndex(G, c => !DRIVE_SKIP.has(c)); this.banned = new Set(); this.penalty = G.classes.map(c => c === 'residential' ? 1.7 : c === 'tertiary' ? 1.15 : 1); this.pool = [];                                   // scratch arrays for searches (one per search running at once, so sliced searches never trample each other)
  }
  acquire() { return this.pool.pop() || { dist: new Float64Array(this.G.nodes), prev: new Int32Array(this.G.nodes), prevE: new Int32Array(this.G.nodes), stamp: new Int32Array(this.G.nodes), gen: 0 }; }
  release(S) { this.pool.push(S); }
  /* the routable node nearest to (x, z), or -1 */
  nearest(x, z) {
    const G = this.G, c = this.cell, ci = Math.floor(x / c), cj = Math.floor(z / c); let best = -1, bd = Infinity;
    for (let r = 0; r < 24 && (best < 0 || r * c < Math.sqrt(bd)); r++) for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) { if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue; const l = this.grid.get(i + ',' + j); if (l) for (const id of l) { const d = (G.xz[id * 2] - x) ** 2 + (G.xz[id * 2 + 1] - z) ** 2; if (d < bd) { bd = d; best = id; } } }
    return best;
  }
  /* A* between two nodes: { nodes, edges (ids, in travel order), metres, seconds } or null. routeNodes runs it in one go; routeNodesGen is the same search as a generator that
     yields every `slice` node expansions (about a millisecond), so a caller can spread one long route over several frames (planSliced). Same code, so the same answer. */
  routeNodes(a, b, maxPops = 3e6) { return drain(this.routeNodesGen(a, b, maxPops)); }
  *routeNodesGen(a, b, maxPops = 3e6, slice = SLICE_POPS) {
    const S = this.acquire();
    try {
      const G = this.G, { start, to, ed } = this, { dist, prev, prevE, stamp } = S, g = ++S.gen, xz = G.xz, bx = xz[b * 2], bz = xz[b * 2 + 1], h = n => Math.hypot(xz[n * 2] - bx, xz[n * 2 + 1] - bz) / VMAX, heap = new Heap();
      stamp[a] = g; dist[a] = 0; prev[a] = -1; heap.push(h(a), a); let pops = 0, sl = 0;
      while (heap.size && pops++ < maxPops) {
        const u = heap.pop(); if (u === b) break; const du = dist[u], pu = prev[u], ux = xz[u * 2], uz = xz[u * 2 + 1], px = pu >= 0 ? ux - xz[pu * 2] : 0, pz = pu >= 0 ? uz - xz[pu * 2 + 1] : 0, pl = Math.hypot(px, pz);
        for (let k = start[u]; k < start[u + 1]; k++) { const e = ed[k], v = to[k], sp = Math.max(10, G.speed[e] || 30) / 3.6 * SLOW, cost = G.len[e] / sp * this.penalty[G.cls[e]] + (G.nodeFlags[v] & 1 ? 8 : 0) + (this.banned.has(e) ? 1e5 : 0) + (pl > 0.5 && (px * (xz[v * 2] - ux) + pz * (xz[v * 2 + 1] - uz)) < -0.8 * pl * Math.hypot(xz[v * 2] - ux, xz[v * 2 + 1] - uz) ? 150 : 0), nd = du + cost; if (stamp[v] !== g || nd < dist[v]) { stamp[v] = g; dist[v] = nd; prev[v] = u; prevE[v] = e; heap.push(nd + h(v), v); } }
        if (++sl >= slice) { sl = 0; yield; }
      }
      if (stamp[b] !== g) return null; const nodes = [], edges = []; let m = 0;
      for (let v = b; v !== -1; v = prev[v]) { nodes.push(v); if (prev[v] !== -1) { edges.push(prevE[v]); m += G.len[prevE[v]]; } }
      nodes.reverse(); edges.reverse(); return { nodes, edges, metres: m, seconds: dist[b] };
    } finally { this.release(S); }
  }
  /* the routable edge nearest to (x, z): { e, f (0..1 along the chord a -> b), d (m), x, z } or null */
  nearestEdge(x, z) {
    this.edges.finish(); const G = this.G; let best = null;
    for (let r = 120; r <= 1920 && !best; r *= 4) this.edges.each(x - r, z - r, x + r, z + r, e => { const A = G.a[e], B = G.b[e], ax = G.xz[A * 2], az = G.xz[A * 2 + 1], dx = G.xz[B * 2] - ax, dz = G.xz[B * 2 + 1] - az, L2 = dx * dx + dz * dz, f = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0, qx = ax + dx * f, qz = az + dz * f, d = Math.hypot(qx - x, qz - z); if (d < r && (!best || d < best.d)) best = { e, f, d, x: qx, z: qz }; });
    return best;
  }
  /* A route between two world points that starts and ends on the street where the points are, not at the nearest crossing (edges run 1 km and more): { nodes, edges, metres, seconds, poly, pre, mid, steps } or null.
     yaw: the car's heading (a start against it costs a U-turn). geom(edgeId): the street's geometry a -> b or null. */
  plan(x0, z0, yaw, x1, z1, geom = null) { return drain(this.planGen(x0, z0, yaw, x1, z1, geom)); }
  /* the same as a generator: it yields about every millisecond of work (the street index is built in slices, each search every `slice` expansions, then the polyline and the turn steps), so planSliced can run it a few ms per frame */
  *planGen(x0, z0, yaw, x1, z1, geom = null) {
    while (!this.edges.done) { this.edges.step(EDGE_SLICE); yield; }
    const G = this.G, S = this.nearestEdge(x0, z0), T = this.nearestEdge(x1, z1); if (!S || !T) return null; yield;
    const sp = e => Math.max(10, G.speed[e] || 30) / 3.6 * SLOW; let best = null;
    const hd = Math.atan2(G.xz[G.b[S.e] * 2 + 1] - G.xz[G.a[S.e] * 2 + 1], G.xz[G.b[S.e] * 2] - G.xz[G.a[S.e] * 2]), oS = G.oneway[S.e], oT = G.oneway[T.e], sEnds = [], tEnds = [];
    if (oS >= 0) sEnds.push({ node: G.b[S.e], toB: true }); if (oS <= 0) sEnds.push({ node: G.a[S.e], toB: false });
    if (oT >= 0) tEnds.push({ node: G.a[T.e], fromA: true }); if (oT <= 0) tEnds.push({ node: G.b[T.e], fromA: false });       // you enter the target street at the end traffic can come from
    for (const s of sEnds) { const dS = G.len[S.e] * (s.toB ? 1 - S.f : S.f), turn = Math.cos((s.toB ? hd : hd + Math.PI) - yaw) < -0.3 ? 40 : 0, cS = dS / sp(S.e) + turn;
      for (const t of tEnds) { const dT = G.len[T.e] * (t.fromA ? T.f : 1 - T.f), cT = dT / sp(T.e); const r = s.node === t.node ? { nodes: [s.node], edges: [], metres: 0, seconds: 0 } : yield* this.routeNodesGen(s.node, t.node); if (!r) continue; const tot = cS + r.seconds + cT; if (!best || tot < best.tot) best = { tot, r, s, t, dS, dT }; } }
    if (!best) return null; const { r, s, t } = best;
    const g = e => { const p = geom ? geom(e) : null; return p && p.length >= 4 ? p : [G.xz[G.a[e] * 2], G.xz[G.a[e] * 2 + 1], G.xz[G.b[e] * 2], G.xz[G.b[e] * 2 + 1]]; };
    yield; const pre = clipFrom(g(S.e), x0, z0, s.toB), post = clipTo(g(T.e), x1, z1, t.fromA), mid = routePolyline(G, r, geom);
    const out = { nodes: r.nodes, edges: r.edges, metres: best.dS + r.metres + best.dT, seconds: best.tot, preP: pre, postP: post, poly: pre.concat(mid, post), pre: polyLen(pre), mid: polyLen(mid), startEdge: S.e, endEdge: T.e }; yield; out.steps = this.steps(out, S.e); return out;
  }
  route(x0, z0, x1, z1) { const a = this.nearest(x0, z0), b = this.nearest(x1, z1); if (a < 0 || b < 0) return null; if (a === b) return { nodes: [a], edges: [], metres: 0, seconds: 0 }; return this.routeNodes(a, b); }
  /* plan() spread over frames: a Promise of the same route, computed a few milliseconds at a time (budgetMs of work, then wait for the next frame), so no frame is blocked by routing.
     opt: { signal (AbortSignal: stop and reject with AbortError), budgetMs (default 3), later (fn(callback), default requestAnimationFrame or setTimeout), now (default performance.now) } */
  planSliced(x0, z0, yaw, x1, z1, geom = null, opt = {}) {
    const it = this.planGen(x0, z0, yaw, x1, z1, geom), signal = opt.signal, budget = opt.budgetMs ?? 3, now = opt.now || (() => performance.now()), later = opt.later || (typeof requestAnimationFrame === 'function' ? f => requestAnimationFrame(f) : f => setTimeout(f, 0));
    return new Promise((ok, no) => {
      const pump = () => {
        if (signal && signal.aborted) { it.return(); no(Object.assign(new Error('route cancelled'), { name: 'AbortError' })); return; }
        const t0 = now(); try { for (;;) { const r = it.next(); if (r.done) { ok(r.value); return; } if (now() - t0 >= budget) break; } } catch (e) { no(e); return; }
        later(pump);
      }; pump();
    });
  }
  /* the street name of an edge ('' when unnamed): the English name, else the ref */
  nameOf(e) { const n = this.G.names[this.G.name[e]]; return n ? n.en || n.ref || '' : ''; }
  /* turn-by-turn steps of a route: [{ dist (m to the next step), at (node), text }] */
  steps(r, startEdge) {
    const G = this.G, out = [], xz = G.xz; if (!r.edges.length) return [{ dist: 0, at: r.nodes[0], text: 'Head along ' + (startEdge === undefined ? 'the road' : this.nameOf(startEdge) || 'the road') }, { dist: 0, at: r.nodes[0], text: 'You have arrived' }];
    const hd = i => { const A = r.nodes[i], B = r.nodes[i + 1]; return Math.atan2(xz[B * 2 + 1] - xz[A * 2 + 1], xz[B * 2] - xz[A * 2]); };
    let acc = 0, lastName = this.nameOf(r.edges[0]), from = r.nodes[0], sn = startEdge === undefined ? lastName : this.nameOf(startEdge), pend = { at: from, text: 'Head along ' + (sn || lastName || 'the road') };
    for (let i = 0; i < r.edges.length; i++) {
      const e = r.edges[i]; acc += G.len[e];
      if (i + 1 < r.edges.length) { const e2 = r.edges[i + 1], nm = this.nameOf(e2); let d = hd(i + 1) - hd(i); d = Math.atan2(Math.sin(d), Math.cos(d)) * 180 / Math.PI; const word = bearingWord(d), node = r.nodes[i + 1], branch = this.G.up ? 0 : 0; void branch;
        const same = nm === lastName || (!nm && !lastName); if (same && Math.abs(d) < 55) continue; if (!same && Math.abs(d) < 25 && !nm) continue;       // a bend in the same street is no instruction; a new name is
        pend.dist = acc; out.push(pend); acc = 0; lastName = nm || lastName; pend = { at: node, text: same ? word + ' at the junction' : (word === 'Continue' ? 'Continue onto ' : word + ' onto ') + (nm || 'the next road') }; }
    }
    pend.dist = acc; out.push(pend); out.push({ dist: 0, at: r.nodes[r.nodes.length - 1], text: 'You have arrived' }); return out;
  }
}

/* A polyline path as an engine "road" for autodrive: closestS(x, z, hint) -> arc length, at(s, out) -> x, z, tx, tz, th (the direction of travel), length. Passing the end gives the last heading. */
export class PathRoad {
  constructor(pts) { this.set(pts); this.style = { id: 'path' }; }
  set(pts) {
    pts = this.pts = roundCorners(pts); const n = pts.length / 2, cum = new Float64Array(n); for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]); this.cum = cum; this.length = n ? cum[n - 1] : 0;
  }
  /* the arc length of the point on the path nearest (x, z): only a window around `hint` is searched (so a loop in the route cannot snap the car forward), widened when nothing is close */
  closestS(x, z, hint = 0) {
    const p = this.pts, n = p.length / 2; if (n < 2) return 0; let i0 = 0, i1 = n - 2;
    const win = (lo, hi) => { let best = -1, bd = Infinity, bs = 0; for (let i = lo; i <= hi; i++) { const dx = p[i * 2 + 2] - p[i * 2], dz = p[i * 2 + 3] - p[i * 2 + 1], L2 = dx * dx + dz * dz, f = L2 ? Math.max(0, Math.min(1, ((x - p[i * 2]) * dx + (z - p[i * 2 + 1]) * dz) / L2)) : 0, d = Math.hypot(p[i * 2] + dx * f - x, p[i * 2 + 1] + dz * f - z); if (d < bd) { bd = d; best = i; bs = this.cum[i] + f * Math.sqrt(L2); } } return { d: bd, s: bs, i: best }; };
    let a = this.seg(Math.max(0, hint - 60)), b = this.seg(Math.min(this.length, hint + 250)); i0 = a; i1 = Math.min(n - 2, b); let r = win(i0, i1); if (r.d > 40) r = win(0, n - 2); return r.s;
  }
  seg(s) { const c = this.cum; let lo = 0, hi = c.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; } return lo; }
  at(s, out = {}) {
    const p = this.pts, n = p.length / 2; if (n < 2) { out.x = n ? p[0] : 0; out.z = n ? p[1] : 0; out.tx = 1; out.tz = 0; out.th = 0; out.y = 0; out.slope = 0; return out; }
    const i = Math.min(n - 2, this.seg(Math.max(0, s))), L = this.cum[i + 1] - this.cum[i] || 1, f = Math.max(0, Math.min(1, (s - this.cum[i]) / L)), dx = p[i * 2 + 2] - p[i * 2], dz = p[i * 2 + 3] - p[i * 2 + 1], d = Math.hypot(dx, dz) || 1;
    out.x = p[i * 2] + dx * f; out.z = p[i * 2 + 1] + dz * f; out.tx = dx / d; out.tz = dz / d; out.th = Math.atan2(dz, dx); out.y = 0; out.slope = 0; return out;
  }
  /* the distance still to go from s */
  remaining(s) { return Math.max(0, this.length - s); }
}

export const polyLen = p => { let L = 0; for (let i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return L; };
const rev = p => { const o = []; for (let i = p.length - 2; i >= 0; i -= 2) o.push(p[i], p[i + 1]); return o; };
/* the part of a polyline (a -> b) from the point nearest (x, z) on to its end (toEnd) or back to its start, beginning with (x, z) itself */
export function clipFrom(p, x, z, toEnd) {
  const q = toEnd ? p : rev(p), n = q.length / 2; let bi = 0, bd = Infinity, bx = q[0], bz = q[1];
  for (let i = 0; i + 1 < n; i++) { const ax = q[i * 2], az = q[i * 2 + 1], dx = q[i * 2 + 2] - ax, dz = q[i * 2 + 3] - az, L2 = dx * dx + dz * dz, f = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0, d = Math.hypot(ax + dx * f - x, az + dz * f - z); if (d < bd) { bd = d; bi = i; bx = ax + dx * f; bz = az + dz * f; } }
  const o = [x, z, bx, bz]; for (let i = bi + 1; i < n; i++) o.push(q[i * 2], q[i * 2 + 1]); return o;
}
/* the part of a polyline that starts at one end (fromA: its first point, else its last) up to the point nearest (x, z), then (x, z) itself */
export function clipTo(p, x, z, fromA) { const q = fromA ? p : rev(p), c = clipFrom(rev(q), x, z, true); return rev(c.slice(2)).concat([x, z]); }

/* corners rounded with a quadratic fillet `d` m long on each side (a car cannot turn on the spot; a sharp polyline vertex makes the pursuit cut across the inside corner) */
export function roundCorners(p, d = 9) {
  const n = p.length / 2; if (n < 3) return p; const out = [p[0], p[1]];
  for (let i = 1; i < n - 1; i++) {
    const ax = p[i * 2] - p[i * 2 - 2], az = p[i * 2 + 1] - p[i * 2 - 1], bx = p[i * 2 + 2] - p[i * 2], bz = p[i * 2 + 3] - p[i * 2 + 1], la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
    if (la < 0.5 || lb < 0.5) continue; const cosT = (ax * bx + az * bz) / (la * lb); if (cosT > 0.94) { out.push(p[i * 2], p[i * 2 + 1]); continue; }                  // under 20 degrees: leave it
    const r = Math.min(d, la / 2.2, lb / 2.2), x = p[i * 2], z = p[i * 2 + 1], sx = x - ax / la * r, sz = z - az / la * r, ex = x + bx / lb * r, ez = z + bz / lb * r;
    for (let k = 0; k <= 4; k++) { const t = k / 4, u = 1 - t; out.push(u * u * sx + 2 * u * t * x + t * t * ex, u * u * sz + 2 * u * t * z + t * t * ez); }
  }
  out.push(p[n * 2 - 2], p[n * 2 - 1]); return out;
}

/* the polyline of a route: node to node, or along the street geometry when `geom(edgeId)` returns the points of the edge in the edge's own direction (a -> b) */
export function routePolyline(G, r, geom) {
  const out = []; const push = (x, z) => { const n = out.length; if (n >= 2 && Math.abs(out[n - 2] - x) < 0.05 && Math.abs(out[n - 1] - z) < 0.05) return; out.push(x, z); };
  for (let i = 0; i < r.edges.length; i++) { const e = r.edges[i], fwd = r.nodes[i] === G.a[e], A = r.nodes[i], B = r.nodes[i + 1], g = geom ? geom(e) : null;
    push(G.xz[A * 2], G.xz[A * 2 + 1]);
    if (g && g.length >= 4) { const n = g.length / 2; if (fwd) for (let k = 0; k < n; k++) push(g[k * 2], g[k * 2 + 1]); else for (let k = n - 1; k >= 0; k--) push(g[k * 2], g[k * 2 + 1]); }
    push(G.xz[B * 2], G.xz[B * 2 + 1]); }
  if (!r.edges.length && r.nodes.length) push(G.xz[r.nodes[0] * 2], G.xz[r.nodes[0] * 2 + 1]);
  return out;
}
