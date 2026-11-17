/* Routing on a decoded city graph (tools/lib/packio.mjs decodeGraph), pure. Used by tools/check_city.mjs (headless check and the drive times in docs/DELHI_LANDMARKS.md) and the self-test.
   mode 'drive': follows one-ways, skips footways, cycleways and busways; cost = seconds at class speed times `slow` (a city does not move at the speed limit).
   mode 'walk': ignores one-ways and layers, skips motorways and trunks; cost = metres / 1.33 m/s. Both return { metres, seconds, nodes } or null. */
const DRIVE_SKIP = new Set(['footway', 'cycleway', 'busway']), WALK_SKIP = new Set(['motorway', 'trunk']);
export const DRIVE_SLOW = 0.55;                       // average urban speed as a share of the class speed (guess, from Delhi's typical peak and off-peak speeds; not measured)

export class Router {
  constructor(g) {
    this.g = g; const N = g.nodes.length, E = g.edges; this.N = N;
    const build = mode => {
      const deg = new Int32Array(N + 1);
      for (const e of E) { if (mode === 'drive' ? DRIVE_SKIP.has(e[3]) : WALK_SKIP.has(e[3])) continue; if (mode === 'drive') { if (e[5] >= 0) deg[e[1]]++; if (e[5] <= 0) deg[e[2]]++; } else { deg[e[1]]++; deg[e[2]]++; } }
      const start = new Int32Array(N + 1); for (let i = 0; i < N; i++) start[i + 1] = start[i] + deg[i];
      const fill = start.slice(0, N), to = new Int32Array(start[N]), ed = new Int32Array(start[N]);
      for (const e of E) { if (mode === 'drive' ? DRIVE_SKIP.has(e[3]) : WALK_SKIP.has(e[3])) continue; const add = (a, b) => { to[fill[a]] = b; ed[fill[a]++] = e[0]; }; if (mode === 'drive') { if (e[5] >= 0) add(e[1], e[2]); if (e[5] <= 0) add(e[2], e[1]); } else { add(e[1], e[2]); add(e[2], e[1]); } }
      return { start, to, ed };
    };
    this.adj = { drive: build('drive'), walk: build('walk') };
    // largest connected part per mode (undirected union-find) so that a start point is never in an island
    this.main = {}; for (const mode of ['drive', 'walk']) { const a = this.adj[mode], p = new Int32Array(N).map((_, i) => i), f = x => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; }; for (let i = 0; i < N; i++) for (let k = a.start[i]; k < a.start[i + 1]; k++) { const r1 = f(i), r2 = f(a.to[k]); if (r1 !== r2) p[r1] = r2; } const cnt = new Map(); for (let i = 0; i < N; i++) if (a.start[i + 1] > a.start[i]) { const r = f(i); cnt.set(r, (cnt.get(r) || 0) + 1); } let best = -1, bc = 0; for (const [r, c] of cnt) if (c > bc) { bc = c; best = r; } this.main[mode] = { f, root: best, size: bc }; }
    this.cell = 250; this.grid = new Map(); g.nodes.forEach(n => { const k = Math.floor(n[1] / this.cell) + ',' + Math.floor(n[2] / this.cell); let l = this.grid.get(k); if (!l) this.grid.set(k, l = []); l.push(n[0]); });
  }
  nearest(x, z, mode = 'drive') {
    const m = this.main[mode], a = this.adj[mode]; let best = -1, bd = Infinity;
    for (let r = 0; r < 40 && best < 0; r++) for (let i = Math.floor(x / this.cell) - r; i <= Math.floor(x / this.cell) + r; i++) for (let j = Math.floor(z / this.cell) - r; j <= Math.floor(z / this.cell) + r; j++) { if (Math.max(Math.abs(i - Math.floor(x / this.cell)), Math.abs(j - Math.floor(z / this.cell))) !== r) continue; const l = this.grid.get(i + ',' + j); if (!l) continue; for (const id of l) { if (a.start[id + 1] === a.start[id] || m.f(id) !== m.root) continue; const n = this.g.nodes[id], d = Math.hypot(n[1] - x, n[2] - z); if (d < bd) { bd = d; best = id; } } }
    return best < 0 ? null : { node: best, d: bd };
  }
  /* Dijkstra from node a to node b */
  route(a, b, mode = 'drive') {
    const { start, to, ed } = this.adj[mode], E = this.g.edges, dist = new Float64Array(this.N).fill(Infinity), prev = new Int32Array(this.N).fill(-1), len = new Float64Array(this.N);
    const heap = [[0, a]]; dist[a] = 0; const push = it => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } }, pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, s = i; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return top; };
    while (heap.length) {
      const [d, u] = pop(); if (d > dist[u]) continue; if (u === b) break;
      for (let k = start[u]; k < start[u + 1]; k++) { const e = E[ed[k]], v = to[k], m = e[7], cost = mode === 'drive' ? m / (e[6] / 3.6 * DRIVE_SLOW) : m / 1.33, nd = d + cost; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; len[v] = len[u] + m; push([nd, v]); } }
    }
    if (!isFinite(dist[b])) return null; return { metres: len[b], seconds: dist[b] };
  }
}
