/* The block and signal layout of the whole network (pure). Every RailLine edge of the RailNetwork is cut into BLOCKS (a block is a stretch of track a train may hold alone, with a signal at its entry):
   - an edge with one track is single line, worked on the ABSOLUTE BLOCK system: a train gets the whole stretch up to the next loop (refuge) or none of it, so two trains can never meet head on;
   - an edge with 2 to 4 tracks has one or two tracks per direction and is worked on AUTOMATIC BLOCK: blocks of about SIG.BLOCK_AUTO m, one train per block, signals with four aspects;
   - crossing LOOPS (a second line beside the main line, SIG.LOOP_LEN m long) are put at the station ends of single and double line edges and along long single line edges: a loop is a block with one more line.
   Nodes (stations, junctions) are held by a train while its body is over them. A station has platforms: the lines of the block at the node end of each edge (numbered 1, 2, ...).
   Routes are lists of steps { edge, fwd }; segsFor() turns them into a flat list of segments (blocks and nodes) in travel order with route coordinates, which the controller reserves one by one. */
import { laneOffsets, TRACK_GAP } from './rail_timetable.js';
import { SIG } from './rail_control_signals.js';

const DIRS = { 1: [0], 2: [1, -1], 3: [1, 0, -1], 4: [1, 1, -1, -1] };

export class ControlGraph {
  constructor(net, tracks = null, opts = {}) {
    this.net = net; this.S = { ...SIG, ...opts }; const S = this.S;
    this.nodes = new Map(net.nodes.map(n => [n.id, { id: n.id, x: n.x, z: n.z, city: n.city, station: !!n.city, deg: n.deg, hold: new Map() }]));
    this.blocks = []; this.edges = net.edges.map((ln, li) => this.makeEdge(ln, li, Math.max(1, Math.min(4, tracks ? tracks[li] || 1 : 1)), S));
    this.platCache = new Map(); this.liOf = new Map(net.edges.map((e, i) => [e, i]));
  }
  makeEdge(ln, li, nT, S) {
    const L = ln.len, aSt = this.nodes.get(ln.a).station, bSt = this.nodes.get(ln.b).station, mode = nT === 1 ? 'abs' : 'auto', loops = [];
    if (nT <= 2 && L >= S.LOOP_MIN_EDGE) {
      const Ll = Math.min(S.LOOP_LEN, L - 2 * S.LOOP_GAP);
      if (aSt) loops.push([S.LOOP_GAP, S.LOOP_GAP + Ll]);
      if (bSt && (!aSt || L >= 2 * (Ll + S.LOOP_GAP) + S.LOOP_GAP)) loops.push([L - S.LOOP_GAP - Ll, L - S.LOOP_GAP]);
      const free = (a, b) => a >= S.LOOP_GAP && b <= L - S.LOOP_GAP && loops.every(l => b < l[0] - 100 || a > l[1] + 100);
      if (!loops.length && free((L - Ll) / 2, (L + Ll) / 2)) loops.push([(L - Ll) / 2, (L + Ll) / 2]);
      for (let p = S.LOOP_SPACING; p < L - Ll / 2; p += S.LOOP_SPACING) if (free(p - Ll / 2, p + Ll / 2)) loops.push([p - Ll / 2, p + Ll / 2]);
      loops.sort((x, y) => x[0] - y[0]);
    }
    const cuts = [[0, false]]; for (const l of loops) { cuts.push([l[0], false], [l[1], true]); } cuts.push([L, false]);       // [position, the interval that ENDS here is a loop]
    const blocks = [], dirs = DIRS[nT], offs = laneOffsets(nT);
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1][0], b = cuts[i][0], isLoop = cuts[i][1]; if (b - a < 0.5) continue;
      const n = mode === 'auto' && !isLoop ? Math.max(1, Math.ceil((b - a) / S.BLOCK_AUTO)) : 1;
      for (let k = 0; k < n; k++) {
        const lo = a + (b - a) * k / n, hi = a + (b - a) * (k + 1) / n, lines = [];
        for (let t = 0; t < nT; t++) lines.push({ occ: -1, kind: 'track', track: t, dir: dirs[t], off: offs[t] });
        if (isLoop) lines.push({ occ: -1, kind: 'loop', track: nT, dir: 0, off: offs[nT - 1] + TRACK_GAP });
        const blk = { id: this.blocks.length, li, a: lo, b: hi, len: hi - lo, mode, loop: isLoop, stub: false, lines };
        this.blocks.push(blk); blocks.push(blk);
      }
    }
    for (let i = 0; i < blocks.length; i++) if (!blocks[i].loop && (blocks[i + 1] && blocks[i + 1].loop || blocks[i - 1] && blocks[i - 1].loop) && blocks[i].len <= S.LOOP_GAP + 1) blocks[i].stub = true;
    return { li, line: ln, len: L, nT, mode, a: ln.a, b: ln.b, blocks, loops };
  }
  /* the block of edge li that contains distance s */
  blockAt(li, s) { const bs = this.edges[li].blocks; for (const b of bs) if (s <= b.b) return b; return bs[bs.length - 1]; }
  /* route steps -> { steps, segs, total, stepX }. segs are blocks { type:'blk', a, b, blk, fwd, li, step } and zero-length nodes { type:'node', a, b, node, step } in travel order, in route coordinates (m) */
  segsFor(steps) {
    const segs = [], stepX = []; let x = 0;
    steps.forEach((st, i) => {
      const e = this.edges[this.liOf.get(st.edge)]; stepX.push(x);
      if (i > 0) { const pe = this.liOf.get(steps[i - 1].edge); segs.push({ type: 'node', a: x, b: x, node: this.nodes.get(st.fwd ? e.a : e.b), step: i, ea: pe, eb: e.li }); }
      const bl = e.blocks; for (let k = 0; k < bl.length; k++) { const b = bl[st.fwd ? k : bl.length - 1 - k]; segs.push({ type: 'blk', a: x + (st.fwd ? b.a : e.len - b.b), b: x + (st.fwd ? b.b : e.len - b.a), blk: b, fwd: st.fwd, li: e.li, step: i }); }
      x += e.len;
    });
    return { steps, segs, total: x, stepX };
  }
  /* the platform number (1, 2, ...) of line `lineIdx` in block `blk` at station node `nodeId`; 0 where it is not a platform line */
  platformNo(nodeId, blk, lineIdx) {
    let m = this.platCache.get(nodeId); if (!m) {
      m = new Map(); let no = 1; const eds = this.edges.filter(e => e.a === nodeId || e.b === nodeId);
      for (const e of eds) { const atB = e.b === nodeId, bl = e.blocks, pb = this.platformBlock(e, atB); for (let k = 0; k < pb.lines.length; k++) if (!(pb.mode === 'auto' && pb.lines[k].kind === 'track' && pb.lines[k].dir === 0)) m.set(pb.id * 8 + k, no++); void bl; }
      this.platCache.set(nodeId, m);
    }
    return m.get(blk.id * 8 + lineIdx) || 0;
  }
  platformBlock(e, atB) { const bl = e.blocks, last = atB ? bl[bl.length - 1] : bl[0]; if (last.stub) return atB ? bl[bl.length - 2] : bl[1]; return last; }
  laneOffset(li, lineIdx, blk) { return blk.lines[lineIdx] ? blk.lines[lineIdx].off : 0; }
}
