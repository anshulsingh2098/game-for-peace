/* Pedestrian simulation (N13): people who walk the sidewalks of the navigation graph, wait at the kerb, cross at the approved crossings, and are bounded and cheap. Pure JavaScript (no
   three.js), so the self-test runs it headless; pedestrians.js draws them.
   Rules:
   - Spawn only on sidewalk nodes ('w') of loaded graph chunks, between SPAWN_MIN and SPAWN_MAX metres from the player (never in his face), at a bounded rate; the number alive is capped
     (pool of 48; the cap is the region's population density times the level); removed beyond DESPAWN metres or when their sidewalk chunk unloads.
   - They move only along walk edges and, at crossing nodes, cross edges: never on the carriageway anywhere else (tested).
   - At a crossing a walker decides to cross (about a third do) and waits at the kerb until it is safe: on a signalled crossing, while the vehicle signal is red with enough red left to
     get across; on an unsignalled one, while no vehicle is close and coming and the player's vehicle is not near. A walker on a crossing marks it `occupied` and the traffic sim stops
     vehicles for it. A walker who is crossing stops if the player's vehicle comes fast and close.
   - Archetypes (from the region's `population.archetypes`): commuter (steady walk), vendor (stands and idles for long spells), tourist (slow, stops often). Two walkers on the same
     sidewalk keep a gap (the one behind slows).
   Usage: const peds = new PedSim(nav, { seed, density: 0.9, archetypes: [...], traffic: trafficSim }); each frame peds.update(dt, { x, z, u }, time); read peds.list. */
import { alea } from '../core/rng.js';
import { Pool } from '../core/runtime.js';
import { signalState, SIGNAL } from '../traffic/sim.js';
import { STEP } from '../world/navgraph.js';

export const LEVELS = { off: 0, low: 0.4, mid: 0.7, high: 1 }, MAX_PEDS = 24, POOL = 48, SPAWN_MIN = 35, SPAWN_MAX = 120, DESPAWN = 170, CROSS_SPEED = 1.5;
export const ARCHETYPES = {
  commuter: { speed: [1.35, 1.7], idle: [0, 0], idleEvery: 0, cross: 0.6 },
  vendor: { speed: [0.9, 1.2], idle: [6, 16], idleEvery: 8, cross: 0.15 },
  tourist: { speed: [0.9, 1.15], idle: [3, 7], idleEvery: 12, cross: 0.5 }
};
const blank = () => ({ handle: 0, id: 0, arch: '', node: '', edge: null, u: 0, speed: 0, base: 0, state: 'walk', wait: 0, idle: 0, nextIdle: 0, x: 0, y: 0, z: 0, yaw: 0, colour: 0, skin: 0, phase: 0, cross: 0, rnd: 0, frozen: 0 });
const reset = p => { for (const k in p) p[k] = typeof p[k] === 'string' ? '' : p[k] === null ? null : 0; p.edge = null; p.state = 'walk'; };

export class PedSim {
  constructor(nav, { seed = 'peds', density = 0.5, archetypes = ['commuter'], level = 'mid', traffic = null } = {}) {
    this.nav = nav; this.g = nav.graph; this.seed = String(seed); this.density = density; this.archetypes = archetypes.filter(a => ARCHETYPES[a]); if (!this.archetypes.length) this.archetypes = ['commuter']; this.traffic = traffic; this.setLevel(level);
    this.pool = new Pool({ cap: POOL, make: blank, reset }); this.list = []; this.nextId = 1; this.R = alea(this.seed, 'peds'); this.spawnT = 0; this.time = 0; this.occupied = new Set(); this.stats = { spawned: 0, removed: 0, crossings: 0, waited: 0 };
  }
  setLevel(level) { this.level = LEVELS[level] !== undefined ? level : 'off'; this.cap = Math.round(MAX_PEDS * Math.max(0, Math.min(1, this.density)) * LEVELS[this.level]); }
  clear() { this.pool.releaseAll(); this.list.length = 0; this.occupied.clear(); if (this.traffic) this.traffic.occupied.clear(); }

  update(dt, player, time) {
    this.time = time; const g = this.g;
    // remove: far away, or the sidewalk they stand on unloaded
    const keep = []; for (const p of this.list) { const far = Math.hypot(p.x - player.x, p.z - player.z) > DESPAWN, gone = !p.edge || !g.edges.has(p.edge.id); if (far || gone) { this.pool.release(p.handle); this.stats.removed++; } else keep.push(p); } this.list = keep;
    if (this.cap && dt > 0) {
      this.spawnT -= dt; if (this.spawnT <= 0 && this.list.length < this.cap) { this.spawnT = 0.4; this.spawn(player); }
      for (const p of this.list) this.step(p, dt, player);
    }
    this.occupied.clear(); for (const p of this.list) if (p.state === 'cross' && p.cross) this.occupied.add(p.cross);
    if (this.traffic) { this.traffic.occupied.clear(); for (const i of this.occupied) this.traffic.occupied.add(i); }
  }

  spawn(player) {
    const g = this.g, R = this.R, near = g.nodesNear(player.x, player.z, SPAWN_MAX, 'w'); if (!near.length) return; const pick = [];
    for (const n of near) { const d = Math.hypot(n.x - player.x, n.z - player.z); if (d >= SPAWN_MIN && !n.carried) pick.push(n); } if (!pick.length) return;
    pick.sort((a, b) => (a.i - b.i) || (a.side - b.side)); const n = pick[Math.floor(R() * pick.length)], edges = g.outEdges(n.id).filter(e => e.kind === 'walk'); if (!edges.length) return;
    for (const q of this.list) if (Math.hypot(q.x - n.x, q.z - n.z) < 3) return;                                                    // not on top of someone
    const got = this.pool.acquire(); if (!got) return; const p = got.obj, arch = this.archetypes[Math.floor(R() * this.archetypes.length)], A = ARCHETYPES[arch];
    Object.assign(p, { handle: got.handle, id: this.nextId++, arch, node: n.id, edge: edges[Math.floor(R() * edges.length)], u: 0, base: A.speed[0] + R() * (A.speed[1] - A.speed[0]), state: 'walk', colour: Math.floor(R() * 64), skin: Math.floor(R() * 8), phase: R() * 6.28, rnd: R(), nextIdle: A.idleEvery ? 2 + R() * A.idleEvery : 0 });
    p.speed = p.base; this.place(p); this.list.push(p); this.stats.spawned++;
  }
  place(p) { const e = p.edge, A = this.g.node(e.a), B = this.g.node(e.b); if (!A || !B) return; const t = e.len > 0 ? Math.min(1, p.u / e.len) : 1; p.x = A.x + (B.x - A.x) * t; p.z = A.z + (B.z - A.z) * t; p.y = A.y + (B.y - A.y) * t; if (e.len > 0.01) p.yaw = Math.atan2(B.z - A.z, B.x - A.x); }

  /* may a walker step off the kerb onto the crossing edge e (crossing at graph index e.a's i) now? */
  safeToCross(e, i, player) {
    const A = this.g.node(e.a), B = this.g.node(e.b); if (!A || !B) return false; const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2, tcross = e.len / CROSS_SPEED;
    if (e.signal) { const t = (this.time + (i * 7) % SIGNAL.cycle) % SIGNAL.cycle, redStart = SIGNAL.green + SIGNAL.amber; return t >= redStart + 1 && (SIGNAL.cycle - t) > tcross * 0.75; }
    if (Math.hypot(player.x - mx, player.z - mz) < 38 && Math.abs(player.u || 0) > 1.5) return false;
    if (this.traffic) for (const c of this.traffic.cars) { const d = Math.hypot(c.x - mx, c.z - mz); if (d < 40 && c.speed > 0.8) return false; }
    return true;
  }

  step(p, dt, player) {
    const g = this.g, A = ARCHETYPES[p.arch];
    if (p.state === 'idle') { p.idle -= dt; if (p.idle <= 0) { p.state = 'walk'; p.nextIdle = A.idleEvery ? 4 + p.rnd * A.idleEvery : 0; } return; }
    if (p.state === 'wait') { p.wait -= dt; if (p.wait > 0) return; const i = p.edge.a.split(':')[1] | 0; if (this.safeToCross(p.edge, i, player)) { p.state = 'cross'; p.cross = i; this.stats.crossings++; } else { p.wait = 0.5; this.stats.waited += 0.5; } return; }
    if (p.state === 'cross') {                                                                                                          // stop if the player's vehicle comes fast and close
      const pl = Math.hypot(player.x - p.x, player.z - p.z); p.frozen = pl < 14 && Math.abs(player.u || 0) > 4 ? 1 : 0; if (p.frozen) return; p.speed = CROSS_SPEED;
    } else {
      if (A.idleEvery) { p.nextIdle -= dt; if (p.nextIdle <= 0) { p.state = 'idle'; p.idle = A.idle[0] + p.rnd * (A.idle[1] - A.idle[0]); p.rnd = (p.rnd * 9301 + 0.4917) % 1; return; } }
      let v = p.base; for (const q of this.list) { if (q === p || q.edge !== p.edge) continue; const ahead = q.u - p.u; if (ahead > 0 && ahead < 1.2) v = Math.min(v, q.speed * 0.8); } p.speed = v;                  // keep a gap to a walker ahead on the same sidewalk
    }
    p.u += p.speed * dt; p.phase += p.speed * dt * 2.6;
    while (p.u >= p.edge.len) {
      p.u -= p.edge.len; const node = g.node(p.edge.b); if (!node) { p.edge = null; return; } const was = p.edge, outs = g.outEdges(node.id); p.node = node.id; p.state = was.kind === 'cross' ? 'walk' : p.state; if (was.kind === 'cross') p.cross = 0;
      const walks = outs.filter(e => e.kind === 'walk' && g.node(e.b) && e.b !== was.a), crosses = node.crossing && was.kind !== 'cross' ? outs.filter(e => e.kind === 'cross') : [];
      if (crosses.length && p.rnd < A.cross && g.node(crosses[0].b)) { p.edge = crosses[0]; p.u = 0; p.state = 'wait'; p.wait = 0; p.rnd = (p.rnd * 7919 + 0.3137) % 1; break; }
      if (walks.length) { p.edge = walks[0]; p.rnd = (p.rnd * 7919 + 0.3137) % 1; } else { const back = outs.filter(e => e.kind === 'walk' && g.node(e.b)); if (back.length) p.edge = back[0]; else { p.edge = null; return; } }       // a dead end turns round
    }
    this.place(p);
  }
}
