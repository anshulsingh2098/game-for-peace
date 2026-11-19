/* Which places a sign board points to, kept apart from the mesher so it can be tested without three.js. destsAt() lists, for traffic arriving at a node along an edge, where it can go (left, ahead, right): the place that road leads to (PLACES, built by tools/build_places.mjs) or else the road's name. */
import { hindiName, hindiOf } from './hindi.js';
import { PLACES } from './places.js';
/* Where the arriving traffic can go: the named roads that meet the node, as { en, hi, dir } with dir 'up' (ahead), 'left' or 'right' relative to a driver coming along -t. Biggest road class first, one board a name, at most two. The node's edge lists are built once a graph. */
const RANK = { motorway: 5, trunk: 5, primary: 4, secondary: 3, tertiary: 2, residential: 1 };
export function adjOf(G) { if (!G.__adj) { const head = new Int32Array(G.nodes).fill(-1), nxt = new Int32Array(G.n * 2); for (let e = 0; e < G.n; e++) { nxt[e * 2] = head[G.a[e]]; head[G.a[e]] = e * 2; nxt[e * 2 + 1] = head[G.b[e]]; head[G.b[e]] = e * 2 + 1; } G.__adj = { head, nxt }; } return G.__adj; }
/* The place a road leads to: the most prominent named place (landmark, railway station, metro station: PLACES, built by tools/build_places.mjs from the pack) that lies 0.7 to 14 km away inside a 37 degree cone around the road's first direction (fx, fz) leaving the node. Nearer and bigger places win. The distance is straight-line times 1.25 for the road. This is a signing heuristic (the way a real board names the next big place on that road), not a route search. */
export function placeFor(x, z, fx, fz) {
  let best = null, bs = 0;
  for (const p of PLACES) { const dx = p[2] - x, dz = p[3] - z, d = Math.hypot(dx, dz); if (d < 700 || d > 14000) continue; const c = (dx * fx + dz * fz) / d; if (c < 0.8) continue; const s = p[4] * (1 + (c - 0.8) * 4) / (1 + d / 2500); if (s > bs) { bs = s; best = p; } }
  if (!best) return null; const km = Math.hypot(best[2] - x, best[3] - z) * 1.25 / 1000; return { en: best[0], hi: best[1] || hindiOf(best[0]), km: km >= 10 ? String(Math.round(km)) : km.toFixed(1) };
}
export function destsAt(G, node, id, tx, tz, nx, nz) {
  const { head, nxt } = adjOf(G), own = G.names[G.name[id]], ownEn = own && own.en, found = new Map(), px = G.xz[node * 2], pz = G.xz[node * 2 + 1];
  for (let h = head[node]; h >= 0; h = nxt[h]) { const e = h >> 1; if (e === id) continue; const other = (h & 1) ? G.a[e] : G.b[e], nm = G.names[G.name[e]], en = nm && nm.en, r = RANK[G.classes[G.cls[e]]] || 0; if (!r) continue; const one = G.oneway[e]; if (one !== 0 && one !== (G.a[e] === node ? 1 : -1)) continue;
    const ux = G.xz[other * 2] - px, uz = G.xz[other * 2 + 1] - pz, L = Math.hypot(ux, uz); if (L < 8) continue; const fx = ux / L, fz = uz / L, ahead = -(fx * tx + fz * tz); if (ahead < -0.5) continue;
    const dir = ahead > 0.6 ? 'up' : (fx * nx + fz * nz) > 0 ? 'left' : 'right'; if (en === ownEn && dir !== 'up') continue;
    const pl = r >= 2 ? placeFor(px, pz, fx, fz) : null, key = pl ? pl.en : en; if (!key) continue; const sc = r * 10 + Math.min(L, 400) / 100 + (pl ? 5 : 0); const old = found.get(key);
    if (!old || old.sc < sc) found.set(key, pl ? { en: pl.en, hi: pl.hi, dir, sc, r, km: pl.km } : { en, hi: hindiName(nm), dir, sc, r, km: Math.max(0.1, G.len[e] / 1000).toFixed(1) }); }
  const ORD = { left: 0, up: 1, right: 2 }, all = [...found.values()].sort((a, b) => b.sc - a.sc), pick = all.slice(0, 2).sort((a, b) => ORD[a.dir] - ORD[b.dir]);
  const dirs = new Set(all.map(d => d.dir)); pick.diag = all.length >= 3 && dirs.size >= 3 ? all.filter((d, i, ar) => ar.findIndex(q => q.dir === d.dir) === i).sort((a, b) => ORD[a.dir] - ORD[b.dir]) : null;     // three roads in three directions: a diagram board
  return pick;
}
