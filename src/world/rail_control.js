/* The railway control office (pure, headless: no three.js, no DOM; src/world/rail_control_graph.js has the blocks, rail_services.js the trains to run, docs/RAIL_CONTROL.md the design).
   RailControl runs EVERY train of the network in fixed steps of STEP seconds, the way a control office with Centralised Traffic Control and Kavach would:
   - a train holds the blocks it occupies and is granted blocks ahead ("movement authority"); the end of its authority is a red signal and it brakes on a curve to stop before it (so it cannot pass a red signal);
   - single line stretches are reserved whole up to the next loop (absolute block), double and multi line blocks one by one (automatic block);
   - requests are served in precedence order (Rajdhani class first, freight last, the more delayed first), and a lower class train standing at a loop is HELD when a higher class train will need the line it is about
     to enter before it could clear (crossing, overtaking); a hold never lasts longer than SIG.HOLD_MAX and never takes the last free line of a loop;
   - stations allocate a platform (the line a train stops on); trains do not leave before the booked time, run at the booked pace when on time and at full speed when late (recovery);
   - level crossing gates come down before a train needs the crossing and the train stops short if they are not down;
   - a train that has been stuck too long (a deadlock, which the design should make impossible) is taken out and counted, so the self-test can prove there were none.
   Positions are route coordinates (m along the train's route); placeAt() turns one into an edge, a distance on it and a lane for the view. */
import { SIG, PRIORITY, aspectFor, brakeDist } from './rail_signals.js';

export const STEP = 0.5, DAY = 1440;

export class RailControl {
  constructor(graph, services = [], { crossings = [], t0 = 0, days = 2, day = DAY } = {}) {
    this.day = day; this.g = graph; this.S = graph.S; this.services = services; this.t = t0; this.trains = []; this.order = []; this.pending = []; this.queue = []; this.qi = 0; this.nid = 0; this.tick = 0; this.alpha = 1; this.acc = 0; this.nextDay = Math.floor(t0 / day);
    this.demand = new Map(); this.byId = new Map(); this.stats = { spawned: 0, completed: 0, cancelled: 0, deadlockBreaks: 0, emergency: 0, lcViolations: 0, holds: 0, loopStops: 0, platformStops: 0, byClass: [0, 1, 2, 3, 4].map(() => ({ n: 0, sum: 0, pos: 0, max: 0, ok: 0 })), maxPending: 0, running: 0, maxBlocked: 0 };
    this.lcs = crossings.map((c, i) => ({ id: c.id === undefined ? i : c.id, li: c.li, s: c.s, frac: 0, want: false })); this.lcByEdge = new Map(); for (const c of this.lcs) { let l = this.lcByEdge.get(c.li); if (!l) this.lcByEdge.set(c.li, l = []); l.push(c); }
    this.fillQueue(days);
  }
  /* ---- the day's services become instances queued by their spawn time ---- */
  fillQueue(upToDays) {
    while (this.nextDay < upToDays) { for (const s of this.services) { const dep = s.stops[0].dep + this.nextDay * this.day; if (s.once && this.nextDay > 0) continue; this.queue.push({ svc: s, day: this.nextDay, dep, spawnT: dep - 30 }); } this.nextDay++; }
    this.queue.sort((a, b) => a.spawnT - b.spawnT); this.qi = 0; while (this.qi < this.queue.length && this.queue[this.qi].spawnT < this.t - 600) this.qi++;
  }
  /* advance by real seconds (fixed steps; alpha is how far into the next step we are, for smooth drawing) */
  advance(dt) { this.acc += Math.min(dt, 5); let n = 0; while (this.acc >= STEP && n++ < 40) { this.acc -= STEP; this.step(); } this.alpha = this.acc / STEP; }
  runTo(t) { while (this.t < t) this.step(); }

  step() {
    const t = (this.t += STEP), S = this.S; this.tick++;
    if (this.nextDay * this.day <= t + 0.5 * this.day) this.fillQueue(this.nextDay + 1);
    while (this.qi < this.queue.length && this.queue[this.qi].spawnT <= t) { const inst = this.queue[this.qi++]; this.pending.push(this.makeTrain(inst)); }
    if (this.pending.length > this.stats.maxPending) this.stats.maxPending = this.pending.length;
    if (this.tick % 4 === 0) { this.pending.sort((a, b) => a.prio - b.prio || a.inst.dep - b.inst.dep); for (let i = 0; i < this.pending.length; i++) { const T = this.pending[i]; if (this.tryPlace(T)) { this.pending.splice(i--, 1); this.trains.push(T); this.order.push(T); this.stats.spawned++; } else if (t - T.inst.spawnT > 1500) { this.pending.splice(i--, 1); this.stats.cancelled++; } } }
    if (this.tick % 4 === 1) this.buildDemand();
    if (this.tick % 8 === 0) { const t0 = t; this.order.sort((a, b) => a.prio - b.prio || (b.delay - a.delay) || a.id - b.id); void t0; }
    for (const lc of this.lcs) lc.want = false;
    const done = []; if (this.tick % 40 === 0) this.checkDeadlock(done);
    for (let i = 0; i < this.order.length; i++) { const T = this.order[i]; T.headPrev = T.head; this.stepTrain(T, t); if (T.done) done.push(T); }
    if (done.length) { for (const T of done) { this.release(T); this.byId.delete(T.id); const k = this.trains.indexOf(T); if (k >= 0) this.trains.splice(k, 1); const o = this.order.indexOf(T); if (o >= 0) this.order.splice(o, 1); } }
    for (const lc of this.lcs) lc.frac = Math.max(0, Math.min(1, lc.frac + (lc.want ? 1 : -1) * STEP / S.GATE_CLOSE_T));
    this.stats.running = this.trains.length;
  }

  makeTrain(inst) {
    const s = inst.svc, r = s.route, n = r.segs.length;
    const T = { id: ++this.nid, svc: s, inst, route: r, segs: r.segs, prio: s.prio, len: s.len, vmax: s.vmax, accel: s.accel, brake: s.brake, v: 0, head: s.stops[0].x, headPrev: s.stops[0].x, held: new Int16Array(n).fill(-1), rIdx: -1, tIdx: 0, hIdx: 0, si: 0, stopped: true, atStop: 0, hold: null, holdSince: -1, readyAt: inst.dep, delay: 0, blocked: 0, done: false, lastTrack: new Map(), platform: 0, bd: 0, vEff: Math.max(8, s.vmax * 0.75), lcI: 0, lcs: null, style: s.style, real: s.real, local: s.local, cs: s.cs, name: s.name, n: s.n, sched: null };
    T.bd = brakeDist(T.vmax, T.brake * this.S.BRAKE_USE) + 100; T.sched = s.stops.map(st => ({ arr: inst.dep + st.arrRel, dep: inst.dep + st.depRel }));
    T.lcs = this.routeLcs(r); this.byId.set(T.id, T); return T;
  }
  routeLcs(r) {
    if (r.lcs && r.lcsFor === this) return r.lcs; const out = [];
    r.steps.forEach((st, i) => { const li = this.g.liOf.get(st.edge), l = this.lcByEdge.get(li); if (!l) return; const len = this.g.edges[li].len; for (const lc of l) out.push({ lc, x: r.stepX[i] + (st.fwd ? lc.s : len - lc.s) }); });
    out.sort((a, b) => a.x - b.x); r.lcs = out; r.lcsFor = this; return out;
  }
  /* the train appears at its first station if the lines up to the origin stop are free */
  tryPlace(T) {
    this.extend(T); const x = T.svc.stops[0].x;
    if (T.rIdx >= 0 && T.segs[T.rIdx].b >= x - 0.01) { this.releaseBehind(T); this.stats.platformStops++; this.notePlatform(T, 0); return true; }
    this.release(T, true); T.rIdx = -1; T.tIdx = 0; T.held.fill(-1); return false;
  }

  /* ---- reserving ---- */
  limX(T) { let x = T.svc.stops[T.si].x; if (T.hold && T.hold.x < x) x = T.hold.x; return x; }
  maEnd(T) { return T.rIdx >= 0 ? T.segs[T.rIdx].b : 0; }
  extend(T) {
    const segs = T.segs, n = segs.length, lim = this.limX(T); let guard = 0;
    while (T.rIdx + 1 < n && guard++ < 24) {
      const j = T.rIdx + 1, sg = segs[j]; if (sg.a >= lim) break;
      const first = sg.type === 'node' ? segs[j + 1] : sg; if (first && first.a - T.head > T.bd) break;
      const m = this.groupEnd(T, j, lim); if (!this.reserve(T, j, m)) break;
    }
  }
  /* the last segment of the group that must be reserved together starting at j: a node with the block after it; a block of an automatic line alone; a single line stretch up to its refuge (a loop, the stop point, the end of single line) */
  groupEnd(T, j, lim) {
    const segs = T.segs; let k = j; if (segs[k].type === 'node') { k++; if (k >= segs.length) return j; }
    const blk = segs[k].blk; if (blk.mode === 'auto' || blk.loop) return k;
    let m = k;
    for (;;) {
      if (segs[m].b >= lim) break; const nx = segs[m + 1]; if (!nx) break;
      if (nx.type === 'node') { const nn = segs[m + 2]; if (!nn) break; if (nn.a >= lim || nn.blk.mode === 'auto') break; m += 2; if (nn.blk.loop) break; continue; }
      if (nx.a >= lim || nx.blk.mode === 'auto') break; m++; if (nx.blk.loop) break;
    }
    return m;
  }
  /* reserve segments j..m together (and more, see below) or nothing. LAST LINE RULE (SIG.LAST_LINE, off by default: it prevents most deadlocks but holds back too many trains, docs/RAIL_CONTROL.md): a train may not take the last free line of a loop unless it can go straight on (the next stretch is free too), otherwise two loops
     could fill with trains that all want to go to the other one: a deadlock. The extension is tried up to 4 times. */
  reserve(T, j, m) {
    const segs = T.segs, n = segs.length, lim = this.limX(T), picks = []; let end = m, k0 = j, settled = false;
    for (let depth = 0; depth < 4; depth++) {
      for (let k = k0; k <= end; k++) {
        const s = segs[k];
        if (s.type === 'node') { if (!this.nodeFree(s, T)) return false; picks[k - j] = 0; continue; }
        let want = false; if (k === end && s.blk.loop) { const p = this.planLoop(T, k); want = p.want; picks.hold = p.hold; }
        const idx = this.pickLine(T, s, want); if (idx < 0) return false; picks[k - j] = idx;
      }
      const L = segs[end];
      if (this.S.LAST_LINE && L.type === 'blk' && L.blk.loop && this.otherFree(L.blk, picks[end - j]) === 0) { if (end + 1 >= n || segs[end + 1].a >= lim) return false; picks.hold = null; k0 = end + 1; end = this.groupEnd(T, end + 1, lim); continue; }
      settled = true; break;
    }
    if (!settled) return false;
    for (let k = j; k <= end; k++) { const s = segs[k]; if (s.type === 'node') { s.node.hold.set(T.id, s); T.held[k] = 0; } else { s.blk.lines[picks[k - j]].occ = T.id; T.held[k] = picks[k - j]; T.lastTrack.set(s.li, s.blk.lines[picks[k - j]].track); } }
    T.rIdx = end; if (picks.hold) { T.hold = picks.hold; T.holdSince = -1; this.stats.holds++; }
    return true;
  }
  /* free lines of the block that a train going the same way could use, other than the one picked */
  otherFree(blk, pick) { let n = 0; for (let k = 0; k < blk.lines.length; k++) { const ln = blk.lines[k]; if (k === pick || ln.occ !== -1) continue; if (ln.dir === 0 && ln.kind === 'track' && blk.mode === 'auto') continue; n++; } return n; }
  /* a node can carry several trains unless their movements have no edge in common (paths that would cross inside the points); movements that share an edge are kept apart by that edge's own blocks */
  nodeFree(s, T) { for (const [id, m] of s.node.hold) { if (id === T.id) continue; if (m.ea !== s.ea && m.ea !== s.eb && m.eb !== s.ea && m.eb !== s.eb) return false; } return true; }
  pickLine(T, s, wantLoop) {
    const b = s.blk, L = b.lines, dirw = s.fwd ? 1 : -1, last = T.lastTrack.get(s.li); let best = -1, bs = -1e9;
    for (let k = 0; k < L.length; k++) {
      const ln = L[k]; if (ln.occ !== -1 && ln.occ !== T.id) continue; if (ln.dir !== 0 && ln.dir !== dirw) continue; if (ln.dir === 0 && ln.kind === 'track' && b.mode === 'auto') continue;
      if (ln.kind === 'loop' && T.len > b.len - 6) continue;
      let sc = ln.kind === 'loop' ? (wantLoop ? 10 : -5) : (wantLoop ? 0 : 10); if (ln.track === last) sc += 2; if (sc > bs) { bs = sc; best = k; }
    }
    return best;
  }
  /* at a loop: does this train want the loop line (it stops here, or it must wait for a higher class train)? hold = a stop point at the end of the loop where it waits */
  planLoop(T, k) {
    const s = T.segs[k], st = T.svc.stops[T.si], stops = st.x > s.a && st.x <= s.b + 0.1; let want = stops, hold = null;
    if (!stops && T.len <= s.blk.len - 6 && this.freeLines(s.blk, T) >= 1) {
      const eta = Math.max(0, (s.b - T.head) / Math.max(T.vEff * 0.6, 6));
      if (this.holdNeeded(T, k + 1, eta)) { want = true; hold = { x: s.b - this.S.STOP_GAP, seg: k }; }
    }
    return { want, hold };
  }
  /* lines of the block other than the train's own that are free or already held by a higher class train (a hold must leave one for it) */
  freeLines(blk, T) { let n = 0; for (const ln of blk.lines) { if (ln.occ === T.id || (ln.dir === 0 && ln.kind === 'track' && blk.mode === 'auto')) continue; if (ln.occ === -1) n++; else { const o = this.byId.get(ln.occ); if (o && o.prio < T.prio) n++; } } return n; }
  /* ---- precedence: will a higher class train need the stretch ahead of k before this one has cleared it? ---- */
  buildDemand() {
    const D = this.demand; for (const l of D.values()) l.length = 0; const range = this.S.LOOKAHEAD, t = this.t, hs = this.trains.concat(this.pending);
    for (let i = this.qi; i < this.queue.length && this.queue[i].spawnT < t + this.S.PLAN_AHEAD; i++) { const q = this.queue[i]; hs.push(q.ghost || (q.ghost = this.makeTrain(q))); }               // the control office knows the timetable: a train about to start already counts
    for (const H of hs) { const segs = H.segs; for (let k = Math.max(H.rIdx + 1, H.hIdx); k < segs.length; k++) { const s = segs[k]; if (s.a - H.head > range) break; if (s.type !== 'blk') continue; let l = D.get(s.blk.id); if (!l) D.set(s.blk.id, l = []); l.push({ tr: H, d: Math.max(0, s.a - H.head), idx: k }); } }
  }
  holdNeeded(T, j, eta) {
    const segs = T.segs, bl = []; let len = 0, dirw = 0;
    for (let k = j; k < segs.length && len < 4000; k++) { const s = segs[k]; if (s.type !== 'blk') continue; if (!dirw) dirw = s.fwd ? 1 : -1; bl.push(s.blk); len += s.b - s.a; if (s.blk.loop || (s.blk.mode === 'auto' && bl.length >= 3)) break; }
    if (!bl.length) return false; let par = 0; for (const ln of bl[0].lines) if (ln.kind === 'track' && ln.dir === dirw) par++; if (bl[0].mode === 'auto' && par >= 2) return false;
    const tClear = (len + T.len) / Math.max(5, T.vmax * 0.7) + 20, t = this.t;
    for (const b of bl) { const dm = this.demand.get(b.id); if (!dm) continue; for (const e of dm) { const H = e.tr; if (H === T || H.prio >= T.prio || e.idx <= H.rIdx) continue; const wait = H.stopped && H.atStop >= 0 ? Math.max(0, H.readyAt - t) : 0; if (wait + e.d / H.vEff < eta + tClear) return true; } }
    return false;
  }
  mustHold(T, t) {
    if (T.hIdx >= T.segs.length) return false; const hs = T.segs[T.hIdx]; if (hs.type !== 'blk' || !(hs.blk.loop)) return false; if (T.holdSince >= 0 && t - T.holdSince > this.S.HOLD_MAX) return false;
    if (this.freeLines(hs.blk, T) < 1) return false; const nx = T.rIdx + 1; if (nx >= T.segs.length) return false;
    const need = this.holdNeeded(T, Math.max(nx, T.hIdx + 1), 0); if (need && T.holdSince < 0) T.holdSince = t; return need;
  }

  /* the trains whose resources T is waiting for (empty when it waits only for its booked departure) */
  waitsFor(T) {
    if (T.stopped && T.atStop >= 0 && T.atStop === T.si && this.t < T.readyAt) return []; const j = T.rIdx + 1; if (j >= T.segs.length) return [];
    const m = this.groupEnd(T, j, this.limX(T)), out = new Set();
    for (let k = j; k <= m; k++) { const q = T.segs[k];
      if (q.type === 'node') { if (!this.nodeFree(q, T)) for (const [id] of q.node.hold) if (id !== T.id) out.add(id); }
      else if (this.pickLine(T, q, false) < 0) { const dw = q.fwd ? 1 : -1; for (const l of q.blk.lines) { if (l.dir !== 0 && l.dir !== dw) continue; if (l.dir === 0 && l.kind === 'track' && q.blk.mode === 'auto') continue; if (l.occ !== -1 && l.occ !== T.id) out.add(l.occ); } } }
    return [...out];
  }
  /* a deadlock is a cycle of trains that each wait for a resource another one holds; the lowest class train of a cycle is taken out of the network (the design should make this impossible: the self-test counts it) */
  checkDeadlock(done) {
    const by = new Map(), cand = []; for (const T of this.trains) { by.set(T.id, T); if (T.blocked > 60 && !T.done) cand.push(T); } if (!cand.length) return;
    const color = new Map(); let found = null;
    const dfs = (T, path) => { color.set(T.id, 1); path.push(T); for (const id of this.waitsFor(T)) { const U = by.get(id); if (!U || U.v > 0.5 || U.done) continue; const c = color.get(id); if (c === 1) { found = path.slice(path.indexOf(U)); return; } if (!c) { dfs(U, path); if (found) return; } } path.pop(); color.set(T.id, 2); };
    for (const T of cand) { if (!color.get(T.id)) dfs(T, []); if (found) break; }
    if (found) { if (this.onDeadlock) this.onDeadlock(found); found.sort((a, b) => b.prio - a.prio || b.id - a.id); const v = found[0]; v.done = true; done.push(v); this.stats.deadlockBreaks++; this.stats.cancelled++; }
  }
  /* ---- one train, one step ---- */
  releaseBehind(T) {
    const tail = T.head - T.len, segs = T.segs;
    while (T.tIdx <= T.rIdx) { const s = segs[T.tIdx]; if (s.b + (s.type === 'node' ? 0.5 : 0) > tail) break; this.free(T, T.tIdx); T.tIdx++; }
  }
  free(T, k) { const s = T.segs[k], h = T.held[k]; if (h < 0) return; if (s.type === 'node') { s.node.hold.delete(T.id); } else if (s.blk.lines[h].occ === T.id) s.blk.lines[h].occ = -1; T.held[k] = -1; }
  release(T, all) { for (let k = T.tIdx; k <= T.rIdx && k < T.segs.length; k++) this.free(T, k); if (all) { T.rIdx = -1; T.tIdx = 0; } }
  stepTrain(T, t) {
    const S = this.S, segs = T.segs; this.releaseBehind(T);
    if (T.stopped) {
      T.v = 0; const st = T.svc.stops[T.si];
      if (T.atStop === T.si) {                                                                                  // standing at a scheduled stop
        if (t >= T.readyAt) {
          if (T.si === T.svc.stops.length - 1) { T.done = true; this.stats.completed++; return; }
          if (!this.mustHold(T, t)) { T.si++; this.extend(T); if (this.maEnd(T) > T.head + 8) { T.stopped = false; T.atStop = -1; T.holdSince = -1; } else T.si--; }
        }
      } else if (T.hold) {                                                                                       // held in a loop for a higher class train
        if (!this.mustHold(T, t)) { T.hold = null; T.holdSince = -1; T.stopped = false; this.extend(T); }
      } else T.stopped = false;
      void st; if (T.stopped) { this.blockedTick(T, t, true); return; }
    }
    this.extend(T);
    /* kinematics: the train may not go beyond the end of its authority, nor the stop it is heading for, and brakes on a curve (Kavach) */
    const bc = T.brake * S.BRAKE_USE; let tgt = this.limX(T), isStop = !T.hold || T.hold.x >= T.svc.stops[T.si].x; const ma = this.maEnd(T); if (ma - S.STOP_GAP < tgt) { tgt = ma - S.STOP_GAP; isStop = false; }
    let lcCap = Infinity;
    for (let k = T.lcI; k < T.lcs.length; k++) { const c = T.lcs[k]; if (T.head - T.len > c.x + S.GATE_AFTER) { T.lcI = k + 1; continue; } if (c.x - T.head > 600) break; const d = c.x - T.head, trig = T.v * (S.GATE_CLOSE_T + S.GATE_LEAD) + brakeDist(T.v, bc) + 40; if (d <= trig + 20) c.lc.want = true; if (c.lc.frac < 0.999 && d > 0) { const stopAt = c.x - S.GATE_ZONE; if (stopAt < tgt) { tgt = stopAt; isStop = false; } lcCap = 0; } else if (d > 0 && d < 0) lcCap = 0; }
    void lcCap; if (tgt < T.head) tgt = T.head;
    const late = T.delay > 3 || this.t > T.sched[T.si].arr + 3, vc = T.vmax * (late ? 1 : 1 / (1 + S.RECOVERY));
    let vt = Math.min(vc, Math.sqrt(2 * bc * Math.max(0, tgt - T.head)));
    for (let k = T.hIdx; k <= T.rIdx && k < T.hIdx + 6; k++) { const s = segs[k]; if (s.type !== 'blk' || T.held[k] < 0) continue; if (s.blk.lines[T.held[k]].kind === 'loop' && T.head <= s.b) { const d = Math.max(0, s.a - T.head), inside = T.head - s.a;                                                                      /* the turnouts at both ends of the loop limit the speed, not its whole length */
        if (d > 0 || inside < S.LOOP_TURNOUT) vt = Math.min(vt, Math.sqrt(S.LOOP_SPEED * S.LOOP_SPEED + 2 * bc * d)); if (s.b - T.head < S.LOOP_TURNOUT && s.b - T.head >= 0) vt = Math.min(vt, S.LOOP_SPEED + 0.0001); } }
    const dv = vt - T.v; T.v += dv > 0 ? Math.min(dv, T.accel * STEP) : Math.max(dv, -T.brake * STEP); if (T.v < 0) T.v = 0;
    const prevHead = T.head; T.head += T.v * STEP;
    if (T.head >= ma - 0.01 && ma < T.segs[segs.length - 1].b) { if (T.v > 3) this.stats.emergency++; T.head = Math.min(T.head, ma - 0.01); if (T.head < prevHead) T.head = prevHead; if (T.v > 0.5) T.v = Math.min(T.v, 1); }
    for (let k = T.lcI; k < T.lcs.length; k++) { const c = T.lcs[k]; if (c.x > T.head) break; if (c.x > prevHead && c.lc.frac < 0.99) this.stats.lcViolations++; }
    if (tgt - T.head < 0.5 && T.v < 2) { T.head = Math.max(T.head, Math.min(tgt, ma)); T.v = 0; if (isStop || (T.hold && Math.abs(tgt - T.hold.x) < 0.6)) this.arrive(T, t, isStop); else if (tgt >= ma - S.STOP_GAP - 0.01) { /* waiting at a signal */ } }
    while (T.hIdx < segs.length - 1 && segs[T.hIdx].b <= T.head) T.hIdx++;
    this.blockedTick(T, t, false);
  }
  blockedTick(T, t, atRest) {
    if (T.v > 0.5) { T.blocked = 0; return; } if (atRest && T.atStop === T.si && t < T.readyAt) { T.blocked = 0; return; }
    T.blocked += STEP; if (T.blocked > this.stats.maxBlocked) this.stats.maxBlocked = T.blocked;
  }
  arrive(T, t, atStop) {
    const st = T.svc.stops[T.si]; T.stopped = true;
    if (!atStop || Math.abs(T.head - st.x) > 1) { T.atStop = -1; return; }
    T.atStop = T.si; const sc = T.sched[T.si]; T.delay = t - sc.arr; const bc = this.stats.byClass[T.prio];
    if (T.si > 0) { bc.n++; bc.sum += T.delay; bc.pos += Math.max(0, T.delay); if (T.delay > bc.max) bc.max = T.delay; if (T.delay <= this.S.PUNCTUAL) bc.ok++; }
    T.readyAt = T.si === T.svc.stops.length - 1 ? t + this.S.TURNAROUND : Math.max(t + st.dwell, sc.dep); this.notePlatform(T, T.si);
  }
  notePlatform(T, si) {
    const st = T.svc.stops[si], k = T.hIdx; let seg = T.segs[Math.min(k, T.segs.length - 1)]; while (seg && seg.type !== 'blk' && k > 0) seg = T.segs[T.hIdx - 1];
    if (!seg || seg.type !== 'blk' || T.held[T.hIdx] < 0) { T.platform = 0; return; } T.platform = st.node ? this.g.platformNo(st.node, seg.blk, T.held[T.hIdx]) : 0; if (seg.blk.lines[T.held[T.hIdx]].kind === 'loop') this.stats.loopStops++; else this.stats.platformStops++;
  }

  /* ---- what the view and the tests ask ---- */
  segIndexAt(T, x) { const segs = T.segs; let lo = 0, hi = segs.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].a <= x) lo = m; else hi = m - 1; } let k = lo; while (k > 0 && segs[k].type !== 'blk') k--; return k; }
  /* where route coordinate x of train T is: { li, s (distance on the edge), fwd, lane (m from the centre of the edge's tracks), line } */
  placeAt(T, x, out = {}) {
    const r = T.route, sx = r.stepX; let lo = 0, hi = sx.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (sx[m] <= x) lo = m; else hi = m - 1; }
    const st = r.steps[lo], li = this.g.liOf.get(st.edge), e = this.g.edges[li], d = Math.min(Math.max(x - sx[lo], 0), e.len);
    out.li = li; out.s = st.fwd ? d : e.len - d; out.fwd = st.fwd; out.step = lo; const k = this.segIndexAt(T, x), h = T.held[k]; const blk = T.segs[k].blk; out.lane = h >= 0 && blk ? blk.lines[h].off : (blk ? (blk.lines.find(l => l.kind === 'track' && (l.dir === 0 || l.dir === (st.fwd ? 1 : -1))) || blk.lines[0]).off : 0); out.line = h; return out;
  }
  /* spans of train bodies on edge li, as [lo, hi, v, dir] along the edge (for level crossings and the view) */
  spansOnEdge(li, out = []) {
    out.length = 0;
    for (const T of this.trains) { const r = T.route; for (let i = 0; i < r.steps.length; i++) { const x0 = r.stepX[i], e = this.g.edges[this.g.liOf.get(r.steps[i].edge)]; if (e.li !== li) continue; const lo = Math.max(T.head - T.len, x0), hi = Math.min(T.head, x0 + e.len); if (hi <= lo) continue; const a = r.steps[i].fwd ? lo - x0 : e.len - (hi - x0), b = r.steps[i].fwd ? hi - x0 : e.len - (lo - x0); out.push([a, b, T.v, r.steps[i].fwd ? 1 : -1, T]); } }
    return out;
  }
  gate(lcId) { for (const c of this.lcs) if (c.id === lcId) return c; return null; }
  /* aspect of the signal at the entry of block `blk` for a train travelling in direction dirw on line li: clear blocks ahead along the edge (a train in or reserved on a block makes it not clear) */
  aspectAt(blk, dirw) {
    const bs = this.g.edges[blk.li].blocks, i = bs.indexOf(blk); let n = 0; const free = b => { for (const ln of b.lines) if ((ln.dir === dirw || ln.dir === 0) && ln.occ === -1) return true; return false; };
    for (let k = 0; k < 3; k++) { const b = bs[i + dirw * k]; if (!b || !free(b)) break; n++; } return aspectFor(n);
  }
  /* ---- checks used by the self-test: an independent look at where the bodies are ---- */
  /* returns a list of problems: two bodies on the same track of an edge, a body outside the blocks it holds, two trains at one node */
  audit() {
    const bad = [], by = new Map();
    for (const T of this.trains) {
      const tail = T.head - T.len, r = T.route;
      for (let k = 0; k < T.segs.length; k++) { const s = T.segs[k]; if (s.b < tail - 0.01 || s.a > T.head + 0.01) continue; if (s.b - Math.max(s.a, tail) < 0.01 && s.type === 'blk') continue; if (T.held[k] < 0) { bad.push('train ' + T.id + ' is over a segment it does not hold (' + k + ')'); continue; }
        if (s.type === 'node') { const l = by.get('n' + s.node.id) || []; l.push({ id: T.id, s }); by.set('n' + s.node.id, l); continue; }
        const ln = s.blk.lines[T.held[k]], lo = Math.max(s.a, tail), hi = Math.min(s.b, T.head), e = this.g.edges[s.li], a = s.fwd ? lo - r.stepX[s.step] : e.len - (hi - r.stepX[s.step]), b = s.fwd ? hi - r.stepX[s.step] : e.len - (lo - r.stepX[s.step]), key = 'e' + s.li + ':' + ln.track; let l = by.get(key); if (!l) by.set(key, l = []); l.push({ id: T.id, a, b }); }
    }
    for (const [k, l] of by) { if (k[0] === 'n') { for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { const p = l[i], q = l[j]; if (p.id !== q.id && p.s.ea !== q.s.ea && p.s.ea !== q.s.eb && p.s.eb !== q.s.ea && p.s.eb !== q.s.eb) bad.push('node ' + k + ' crossing paths: trains ' + p.id + ' and ' + q.id); } continue; } for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) if (l[i].id !== l[j].id && Math.min(l[i].b, l[j].b) - Math.max(l[i].a, l[j].a) > 0.5) bad.push('collision on ' + k + ': trains ' + l[i].id + ' and ' + l[j].id); }
    return bad;
  }
}
